// The check-in of a routine (owner 05.11.2026, after the coach's "Vorher-Nachher-Check"): compare the photos, answer a few questions, a note.
// Always voluntary. The coach switches it on per routine and writes the questions (routine.progressCheck); the app suggests it every 7 days and
// on the last day of a plan, "Jetzt nicht" hides the suggestion for a while. A check-in stays on this phone. Only "An … schicken" sends the answers
// and the note to the dashboard, and it can be taken back; the photos never go through the server, the member can attach them to a mail of their own.
import { useMutation, useQuery } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import { router, type Href } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { ApiError } from './api';
import { localDay } from './nav';
import { planState } from './plans';
import type { MemberRoutine } from './routine';
import { useApi } from './session';

export type AnswerValue = 'yes' | 'some' | 'no';
export interface CheckAnswer { group: 'look' | 'feel'; title: string; question: string; answer: AnswerValue | null }
export interface SavedCheck {
  id: string; routineId: string; routineTitle: string; day: string; savedAt: number; final: boolean;
  answers: CheckAnswer[]; note: string;
  /** File names of the progress photos (lib/routine.ts listPhotos). */
  photoBefore: string | null; photoNow: string | null;
  /** On the server, seen by the coach. */
  sent: { id: string; at: number } | null;
}
export type CheckDue = 'week' | 'final';

export const ANSWER_LABELS: Record<AnswerValue, string> = { yes: 'Ja', some: 'Ein bisschen', no: 'Noch nicht' };

/** Days between two local days 'YYYY-MM-DD'. */
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
const addDays = (day: string, days: number) => new Date(Date.parse(`${day}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

const EVERY_DAYS = 7;
/** "Jetzt nicht" hides the suggestion this long. */
const SNOOZE_DAYS: Record<CheckDue, number> = { week: 3, final: 14 };

/**
 * Should the app suggest a check-in today? A plan: the closing one on its last day and afterwards until it is done, before that every 7 days from its
 * start; only with at least one day done in this run of the plan. A routine without a plan: every 7 days from the first day done.
 */
export function checkDue(routine: MemberRoutine, mine: readonly SavedCheck[], today = localDay()): CheckDue | null {
  if (!routine.progressCheck) return null;
  const ch = routine.plan ? routine.challenge : null;
  if (routine.plan) {
    const state = planState(routine);
    if (!ch?.startDay || state === 'open' || ch.doneDays === 0) return null;
    const inRun = mine.filter((c) => c.day >= (ch.startDay as string));
    if (state === 'over' || (ch.dayNumber ?? 0) >= ch.days) return inRun.some((c) => c.final) ? null : 'final';
    return daysBetween(inRun[0]?.day ?? ch.startDay, today) >= EVERY_DAYS ? 'week' : null;
  }
  const first = [...routine.stats.days].sort()[0];
  if (!first) return null;
  return daysBetween(mine[0]?.day ?? first, today) >= EVERY_DAYS ? 'week' : null;
}

export function countAnswers(answers: readonly CheckAnswer[]): Record<AnswerValue, number> {
  const out: Record<AnswerValue, number> = { yes: 0, some: 0, no: 0 };
  for (const a of answers) if (a.answer) out[a.answer] += 1;
  return out;
}

export const openCheckIn = (routineId: string, replace = false) => {
  const target = { pathname: '/routine/check-in', params: { id: routineId } } as unknown as Href;
  if (replace) router.replace(target);
  else router.push(target);
};

// ---------- on this phone (a file: the secure storage is too small for notes) ----------

interface Saved { checks: SavedCheck[]; snoozed: Record<string, string> }

const NAME = 'members.check_ins';
let state: Saved | null = null;
const listeners = new Set<() => void>();

function read(): Saved {
  if (state) return state;
  let next: Saved = { checks: [], snoozed: {} };
  try {
    const raw = Platform.OS === 'web'
      ? globalThis.localStorage?.getItem(NAME)
      : (() => {
        const f = new File(Paths.document, `${NAME}.json`);
        return f.exists ? f.textSync() : null;
      })();
    if (raw) next = { ...next, ...(JSON.parse(raw) as Partial<Saved>) };
  } catch { /* starts empty */ }
  state = next;
  return next;
}

function write(next: Saved): void {
  state = next;
  listeners.forEach((l) => l());
  const raw = JSON.stringify(next);
  try {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(NAME, raw);
      return;
    }
    const f = new File(Paths.document, `${NAME}.json`);
    if (!f.exists) f.create();
    f.write(raw);
  } catch { /* stays in memory for this visit */ }
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

/** The check-ins of a routine (without one: all), newest first. */
export function useCheckIns(routineId?: string): SavedCheck[] {
  const all = useSyncExternalStore(subscribe, () => read().checks, () => read().checks);
  return routineId ? all.filter((c) => c.routineId === routineId) : all;
}

/** Is one due, and not put off with "Jetzt nicht"? */
export function useCheckDue(routine: MemberRoutine | null | undefined): CheckDue | null {
  const mine = useCheckIns(routine?.id);
  const until = useSyncExternalStore(subscribe, () => (routine ? read().snoozed[routine.id] : undefined), () => undefined);
  if (!routine) return null;
  const today = localDay();
  if (until && today < until) return null;
  return checkDue(routine, mine, today);
}

export function snoozeCheckIn(routineId: string, due: CheckDue): void {
  const now = read();
  write({ ...now, snoozed: { ...now.snoozed, [routineId]: addDays(localDay(), SNOOZE_DAYS[due]) } });
}

export function saveCheckIn(check: Omit<SavedCheck, 'id' | 'savedAt' | 'sent'>): SavedCheck {
  const now = read();
  const saved: SavedCheck = { ...check, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, savedAt: Date.now(), sent: null };
  write({ ...now, checks: [saved, ...now.checks] });
  return saved;
}

export function removeCheckIn(id: string): void {
  const now = read();
  write({ ...now, checks: now.checks.filter((c) => c.id !== id) });
}

function setSent(id: string, sent: SavedCheck['sent']): void {
  const now = read();
  write({ ...now, checks: now.checks.map((c) => (c.id === id ? { ...c, sent } : c)) });
}

// ---------- to the coach ----------

/** Sends the answers and the note (never the photos). */
export function useSendCheckIn() {
  const api = useApi();
  return useMutation({
    mutationFn: (check: SavedCheck) => api.post<{ id: string; sentAt: number }>(
      `/api/member/routines/${encodeURIComponent(check.routineId)}/progress-checks`,
      { day: localDay(), final: check.final, answers: check.answers, note: check.note },
    ),
    onSuccess: (sent, check) => setSent(check.id, { id: sent.id, at: sent.sentAt }),
  });
}

/** Takes a sent check-in back from the dashboard; it stays on this phone. */
export function useTakeBackCheckIn() {
  const api = useApi();
  return useMutation({
    mutationFn: async (check: SavedCheck) => {
      if (!check.sent) return;
      try {
        await api.del<void>(`/api/member/progress-checks/${encodeURIComponent(check.sent.id)}`);
      } catch (err) {
        // the coach deleted it already: nothing left to take back
        if (!(err instanceof ApiError && err.status === 404)) throw err;
      }
    },
    onSuccess: (_, check) => setSent(check.id, null),
  });
}

/** The address of the member area, for the mail with the photos ('' = none set). */
export function useSupportEmail(): string {
  const api = useApi();
  const q = useQuery({
    queryKey: ['check-in-support-email'],
    queryFn: () => api.get<{ supportEmail?: string }>('/api/public/bootstrap'),
    staleTime: 3_600_000,
  });
  return q.data?.supportEmail ?? '';
}
