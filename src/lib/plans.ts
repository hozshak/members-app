// Plans (migration 0108 of the software): a routine with its own exercises per day, either the recommended one ("Von Mailin
// empfohlen") or the plan of a zone under "Gezielt üben", where the member also chooses the goal. The plan runs by the calendar from
// the member's start; day and done days come from the routine's challenge. Kept on this phone with the settings: the before and
// after photos of a plan (they stay on the phone anyway) and the exercises swapped for today.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { localDay } from './nav';
import {
  routineKey, routinePrefsLoaded, syncReminders, useRoutinePrefs, useRoutines, type MemberRoutine, type RoutineChallenge, type RoutineStats, type RoutineStep,
} from './routine';
import { useApi } from './session';
import { getItem, setItem } from './storage';
import type { Me } from './types';

export type PlanState = 'open' | 'running' | 'over';

/** Not started, under way, or past its last day (or every day done). */
export function planState(routine: MemberRoutine): PlanState {
  const ch = routine.challenge;
  if (!ch || !ch.startDay || ch.dayNumber === null) return 'open';
  return ch.completed || ch.dayNumber > ch.days ? 'over' : 'running';
}

export const planLabel = (routine: MemberRoutine) => routine.plan?.label || (routine.plan?.kind === 'zone' ? 'Gezielt üben' : 'Empfohlen für dich');

/** 90 → "3 Monate", 30 → "30 Tage". */
export const goalLabel = (days: number) => (days % 30 === 0 && days >= 60 ? `${days / 30} Monate` : `${days} Tage`);

/**
 * The routine of today: a plan under way (the recommended one first), then the recommended plan not started yet, then the first
 * normal routine, then a finished plan. A zone plan nobody chose is no routine of the member.
 */
export function mainRoutine(list: readonly MemberRoutine[] | undefined): MemberRoutine | null {
  if (!list) return null;
  const usable = list.filter((r) => r.steps.length > 0);
  const running = usable.filter((r) => r.plan && planState(r) === 'running');
  return running.find((r) => r.plan?.kind === 'recommended') ?? running[0]
    ?? usable.find((r) => r.plan?.kind === 'recommended' && planState(r) === 'open')
    ?? usable.find((r) => !r.plan)
    ?? usable.find((r) => r.plan && planState(r) === 'over')
    ?? null;
}

/**
 * There is one recommended plan per programme (owner 04.11.2026). Who has several does them one after the other, in the order of the list: the
 * plan this one still waits for, null when it may start.
 */
export function waitingFor(list: readonly MemberRoutine[] | undefined, routine: MemberRoutine): MemberRoutine | null {
  if (routine.plan?.kind !== 'recommended' || planState(routine) !== 'open') return null;
  for (const r of list ?? []) {
    if (r.id === routine.id) return null;
    if (r.plan?.kind === 'recommended' && r.steps.length > 0 && planState(r) !== 'over') return r;
  }
  return null;
}

/**
 * "Gezielt üben" and "Mein Ziel" open once a recommended plan is finished (owner 04.11.2026): what to tell the member until then; null when they
 * are open, also when there is no recommended plan. The team always sees them open, so that it can try them out (owner 05.11.2026).
 */
export function closedUntilRecommended(list: readonly MemberRoutine[] | undefined, role: Me['role'] | undefined): string | null {
  if (role && role !== 'member') return null;
  const recommended = (list ?? []).filter((r) => r.plan?.kind === 'recommended' && r.steps.length > 0);
  if (recommended.length === 0 || recommended.some((r) => planState(r) === 'over')) return null;
  const under = recommended.find((r) => planState(r) === 'running')?.challenge;
  if (under) {
    const left = under.days - (under.dayNumber ?? 1) + 1;
    return `Noch ${left === 1 ? '1 Tag' : `${left} Tage`} in deiner empfohlenen Routine, dann wird das frei.`;
  }
  const plan = recommended[0]?.plan;
  return `Das wird frei, sobald du deine empfohlene Routine (${plan ? goalLabel(plan.days) : ''}) geschafft hast.`;
}

const dayNumber = (day: string) => Math.round(Date.parse(`${day}T12:00:00Z`) / 86_400_000);

/** Streak and calendar over all routines: changing from the recommended plan to a zone does not lose the series. */
export function overallStats(list: readonly MemberRoutine[] | undefined): RoutineStats {
  const all = list ?? [];
  const days = [...new Set(all.flatMap((r) => r.stats.days))].sort();
  const set = new Set(days.map(dayNumber));
  const today = dayNumber(localDay());
  const doneToday = set.has(today);
  let streak = 0;
  for (let d = doneToday ? today : today - 1; set.has(d); d--) streak++;
  let run = 0;
  let best = 0;
  let prev: number | null = null;
  for (const n of [...set].sort((a, b) => a - b)) {
    run = prev !== null && n === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = n;
  }
  return {
    doneToday,
    streak,
    bestStreak: Math.max(streak, best, ...all.map((r) => r.stats.bestStreak)),
    totalDays: Math.max(days.length, ...all.map((r) => r.stats.totalDays)),
    days,
  };
}

/** Starts or restarts a plan today (`days`: the goal, left out = as chosen before); ends it with `leave`. */
export function usePlanStart(routineId: string) {
  const api = useApi();
  const qc = useQueryClient();
  const path = `/api/member/routines/${encodeURIComponent(routineId)}/challenge`;
  // the exercises depend on the day of the plan: the list is loaded again
  const refresh = () => qc.invalidateQueries({ queryKey: routineKey });
  return {
    start: useMutation({
      mutationFn: (days?: number) => api.put<{ challenge: RoutineChallenge }>(path, { startDay: localDay(), ...(days ? { days } : {}) }),
      onSuccess: refresh,
    }),
    leave: useMutation({
      mutationFn: () => api.del<{ challenge: RoutineChallenge }>(`${path}?day=${localDay()}`),
      onSuccess: refresh,
    }),
  };
}

/** In the member area: the reminders of the coming days are planned at every start of the app and whenever the routine changes. */
export function useReminderSync(): void {
  const q = useRoutines();
  const [prefs] = useRoutinePrefs();
  const main = mainRoutine(q.data);
  const loaded = q.data !== undefined;
  useEffect(() => {
    if (loaded && routinePrefsLoaded()) void syncReminders(prefs, main);
  }, [loaded, prefs, main]);
}

/** The first days of a new day after a night in the background: today's exercises and "heute erledigt" are loaded again. */
export function useReloadOnNewDay(): void {
  const qc = useQueryClient();
  useEffect(() => {
    let day = localDay();
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' || localDay() === day) return;
      day = localDay();
      void qc.invalidateQueries({ queryKey: routineKey });
    });
    return () => sub.remove();
  }, [qc]);
}

// ---------- on this phone: photos of a plan, exercises swapped today ----------

export interface PlanPhotos { start?: string; end?: string }
/** The video that replaces an exercise for one day. */
export interface SwappedExercise { videoId: string; title: string; thumbnailUrl: string | null; durationSec: number | null }

interface Saved {
  photos: Record<string, PlanPhotos>;
  swaps: { day: string; steps: Record<string, SwappedExercise> };
}

const KEY = 'members.plans';
let state: Saved = { photos: {}, swaps: { day: '', steps: {} } };
let loaded = false;
const listeners = new Set<() => void>();

function subscribe(l: () => void): () => void {
  listeners.add(l);
  if (!loaded) {
    loaded = true;
    void getItem(KEY).then((raw) => {
      try {
        if (raw) state = { ...state, ...(JSON.parse(raw) as Partial<Saved>) };
      } catch { /* keep the defaults */ }
      listeners.forEach((x) => x());
    });
  }
  return () => { listeners.delete(l); };
}

function save(next: Saved) {
  state = next;
  listeners.forEach((x) => x());
  void setItem(KEY, JSON.stringify(next));
}

/** The photos of a plan by file name (lib/routine.ts listPhotos). */
export function usePlanPhotos(routineId: string): PlanPhotos {
  return useSyncExternalStore(subscribe, () => state.photos[routineId] ?? NO_PHOTOS, () => NO_PHOTOS);
}
const NO_PHOTOS: PlanPhotos = {};

export function setPlanPhoto(routineId: string, slot: keyof PlanPhotos, name: string): void {
  save({ ...state, photos: { ...state.photos, [routineId]: { ...state.photos[routineId], [slot]: name } } });
}

/** A new start: the plan begins without photos (the old ones stay in "Fortschrittsfotos"). */
export function clearPlanPhotos(routineId: string): void {
  save({ ...state, photos: { ...state.photos, [routineId]: {} } });
}

/** The exercises swapped today; a new day starts with the plan again. */
export function useSwaps() {
  const swaps = useSyncExternalStore(subscribe, () => state.swaps, () => state.swaps);
  const today = localDay();
  const steps = swaps.day === today ? swaps.steps : NO_SWAPS;
  return {
    steps,
    swap: (stepId: string, exercise: SwappedExercise) => {
      save({ ...state, swaps: { day: today, steps: { ...steps, [stepId]: exercise } } });
    },
    restore: (stepId: string) => {
      const { [stepId]: _gone, ...rest } = steps;
      save({ ...state, swaps: { day: today, steps: rest } });
    },
  };
}
const NO_SWAPS: Record<string, SwappedExercise> = {};

/** The exercises of today with the swaps applied (title, video and its length change, the id stays). */
export function withSwaps<T extends { steps: RoutineStep[] }>(routine: T, swaps: Record<string, SwappedExercise>): T {
  if (!routine.steps.some((s) => swaps[s.id])) return routine;
  return {
    ...routine,
    steps: routine.steps.map((s) => {
      const x = swaps[s.id];
      return x ? { ...s, title: x.title, description: '', videoId: x.videoId, videoTitle: x.title, videoThumbnailUrl: x.thumbnailUrl, videoAvailable: true, videoDurationSec: x.durationSec } : s;
    }),
  };
}
