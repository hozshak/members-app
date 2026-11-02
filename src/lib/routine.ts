// The daily routine (app only): the routines of the community with the member's streak (GET /api/member/routines of
// the software, worker/modules/player/routines.ts), marking a day done, the daily reminder (a local notification of the
// phone — no server involved) and the progress photos (stored ONLY on the phone, in the app's own folder; never
// uploaded).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Directory, File, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';
import { ApiError } from './api';
import { localDay } from './nav';
import { useApi } from './session';
import { getItem, setItem } from './storage';
import type { Id } from './types';

// ---------- API (types as in the software's shared/types.ts) ----------

export interface RoutineStats { doneToday: boolean; streak: number; bestStreak: number; totalDays: number; days: string[] }
export interface RoutineStep {
  id: Id; title: string; description: string; durationSec: number; videoId: Id | null;
  videoTitle: string | null; videoThumbnailUrl: string | null; videoAvailable: boolean;
}
/** An N-day challenge of a routine (shared/types.ts RoutineChallenge); null = the routine is no challenge. */
export interface RoutineChallenge { days: number; startDay: string | null; dayNumber: number | null; doneDays: number; completed: boolean }
export interface MemberRoutine {
  id: Id; title: string; description: string; totalSec: number; steps: RoutineStep[]; stats: RoutineStats;
  /** Missing on software versions before the challenges. */
  challenge?: RoutineChallenge | null;
}

export const routineKey = ['routines'] as const;

export function useRoutines() {
  const api = useApi();
  return useQuery({
    queryKey: routineKey,
    queryFn: async () => {
      try {
        return (await api.get<{ items: MemberRoutine[] }>(`/api/member/routines?day=${localDay()}`)).items;
      } catch (err) {
        // a community whose software has no routines yet answers 404: nothing to show, no error
        if (err instanceof ApiError && err.status === 404) return [];
        throw err;
      }
    },
  });
}

/** Marks today done (or undoes it) and puts the new stats into the cache. */
export function useCheckIn(routineId: Id) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (done: boolean) => {
      const path = `/api/member/routines/${encodeURIComponent(routineId)}/days/${localDay()}`;
      type Answer = { stats: RoutineStats; challenge?: RoutineChallenge | null };
      return done ? await api.put<Answer>(path) : await api.del<Answer>(path);
    },
    onSuccess: ({ stats, challenge }) => {
      qc.setQueryData<MemberRoutine[]>(routineKey, (list) => list?.map((r) => (
        r.id === routineId ? { ...r, stats, ...(challenge !== undefined ? { challenge } : {}) } : r
      )));
    },
  });
}

/** Starts (or restarts) the challenge today, or leaves it. */
export function useChallenge(routineId: Id) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (start: boolean) => {
      const base = `/api/member/routines/${encodeURIComponent(routineId)}/challenge`;
      return (start
        ? await api.put<{ challenge: RoutineChallenge }>(base, { startDay: localDay() })
        : await api.del<{ challenge: RoutineChallenge }>(`${base}?day=${localDay()}`)).challenge;
    },
    onSuccess: (challenge) => {
      qc.setQueryData<MemberRoutine[]>(routineKey, (list) => list?.map((r) => (r.id === routineId ? { ...r, challenge } : r)));
    },
  });
}

// ---------- settings of the routine (this phone only) ----------

/** Routine length: the steps' durations scaled (each at least 5 s, rounded to 5 s). */
export type RoutineLength = 'short' | 'normal' | 'long';
export const LENGTH_FACTOR: Record<RoutineLength, number> = { short: 0.6, normal: 1, long: 1.5 };
export const LENGTH_LABEL: Record<RoutineLength, string> = { short: 'Kurz', normal: 'Normal', long: 'Lang' };

export function scaledDuration(sec: number, length: RoutineLength): number {
  if (length === 'normal') return sec;
  return Math.max(5, Math.round((sec * LENGTH_FACTOR[length]) / 5) * 5);
}

export interface RoutinePrefs {
  /** Daily reminder at a fixed time. */
  reminder: boolean; hour: number; minute: number;
  /** "Serie retten": at this time, when the routine of the day is still open. */
  rescue: boolean; rescueHour: number; rescueMinute: number;
  /** A photo reminder once a week: weekday 1 = Sunday … 7 = Saturday. */
  photoReminder: boolean; photoWeekday: number; photoHour: number; photoMinute: number;
  /** The progress photos need Face ID / the phone's code. */
  photoLock: boolean;
  /** In the routine: front camera as a mirror, small sounds, length. */
  mirror: boolean; sound: boolean; length: RoutineLength;
  /** The exercise video next to the mirror (on by default), and whether it plays without sound. */
  video: boolean; videoMuted: boolean;
}
const PREFS_KEY = 'members.routine';
export const DEFAULT_PREFS: RoutinePrefs = {
  reminder: false, hour: 8, minute: 0, rescue: false, rescueHour: 20, rescueMinute: 0, photoReminder: false, photoWeekday: 1, photoHour: 10, photoMinute: 0,
  photoLock: false, mirror: false, sound: true, length: 'normal', video: true, videoMuted: false,
};

/** Weekdays in the order of the week, numbered as the reminders need them (1 = Sunday). */
export const REMINDER_DAYS = [
  { day: 2, short: 'Mo', long: 'montags' }, { day: 3, short: 'Di', long: 'dienstags' }, { day: 4, short: 'Mi', long: 'mittwochs' }, { day: 5, short: 'Do', long: 'donnerstags' },
  { day: 6, short: 'Fr', long: 'freitags' }, { day: 7, short: 'Sa', long: 'samstags' }, { day: 1, short: 'So', long: 'sonntags' },
] as const;

/** 8, 5 → "08:05 Uhr". */
export function clockTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} Uhr`;
}

export async function loadPrefs(): Promise<RoutinePrefs> {
  try {
    const raw = await getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<RoutinePrefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function savePrefs(prefs: RoutinePrefs): Promise<void> {
  await setItem(PREFS_KEY, JSON.stringify(prefs));
}

/** The settings as shared state of the app (loaded once, saved on every change). */
let prefsNow: RoutinePrefs = DEFAULT_PREFS;
let prefsLoaded = false;
const prefsListeners = new Set<() => void>();
const emitPrefs = () => prefsListeners.forEach((l) => l());

function subscribePrefs(l: () => void): () => void {
  prefsListeners.add(l);
  if (!prefsLoaded) {
    prefsLoaded = true;
    void loadPrefs().then((p) => { prefsNow = p; emitPrefs(); });
  }
  return () => { prefsListeners.delete(l); };
}

export function useRoutinePrefs(): [RoutinePrefs, (patch: Partial<RoutinePrefs>) => RoutinePrefs] {
  const prefs = useSyncExternalStore(subscribePrefs, () => prefsNow, () => prefsNow);
  const update = (patch: Partial<RoutinePrefs>) => {
    prefsNow = { ...prefsNow, ...patch };
    emitPrefs();
    void savePrefs(prefsNow);
    return prefsNow;
  };
  return [prefs, update];
}

// ---------- reminders (local notifications, each under its own id) ----------

const CHANNEL = 'routine';
const DAILY_ID = 'routine-daily';
const PHOTO_ID = 'photo-weekly';
const RESCUE_PREFIX = 'rescue-';
const RESCUE_DAYS = 7;

/** Asks for the permission (Android: after creating the channel). False = not allowed. */
export async function allowNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Routine', importance: AndroidImportance.DEFAULT });
  }
  return (await Notifications.requestPermissionsAsync()).granted;
}

async function cancelPrefix(prefix: string): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(all.filter((n) => n.identifier.startsWith(prefix)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

/**
 * Brings the scheduled notifications in line with the settings: the daily reminder, the weekly photo reminder and
 * "Serie retten" for the next days (today's only while the routine of today is still open).
 */
export async function syncReminders(prefs: RoutinePrefs, routine: { title: string; stats: RoutineStats } | null): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(DAILY_ID).catch(() => undefined);
  await Notifications.cancelScheduledNotificationAsync(PHOTO_ID).catch(() => undefined);
  await cancelPrefix(RESCUE_PREFIX);
  const anything = (prefs.reminder || prefs.rescue) && routine !== null || prefs.photoReminder;
  if (!anything || !(await Notifications.getPermissionsAsync()).granted) return;

  if (prefs.reminder && routine) {
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_ID,
      content: { title: 'Zeit für deine Routine', body: `${routine.title} – ein paar Minuten nur für dich.` },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: prefs.hour, minute: prefs.minute, channelId: CHANNEL },
    });
  }
  if (prefs.photoReminder) {
    await Notifications.scheduleNotificationAsync({
      identifier: PHOTO_ID,
      content: { title: 'Zeit für dein Fortschrittsfoto', body: 'Gleiches Licht, gleicher Abstand – in 10 Sekunden erledigt.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: prefs.photoWeekday, hour: prefs.photoHour, minute: prefs.photoMinute, channelId: CHANNEL },
    });
  }
  if (prefs.rescue && routine) {
    const now = new Date();
    for (let i = 0; i < RESCUE_DAYS; i++) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, prefs.rescueHour, prefs.rescueMinute, 0);
      if (at <= now) continue;
      if (i === 0 && routine.stats.doneToday) continue;
      const streak = i === 0 ? routine.stats.streak : 0;
      await Notifications.scheduleNotificationAsync({
        identifier: `${RESCUE_PREFIX}${localDay(at)}`,
        content: {
          title: streak > 1 ? `Deine Serie von ${streak} Tagen wartet` : 'Heute schon an dich gedacht?',
          body: `${routine.title} dauert nur ein paar Minuten – mach sie noch heute.`,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
      });
    }
  }
}

/** Today's routine is done: no "Serie retten" for today. */
export async function cancelTodaysRescue(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(`${RESCUE_PREFIX}${localDay()}`).catch(() => undefined);
}

// ---------- badges (from the stats; nothing stored) ----------

export interface Badge { id: string; label: string; detail: string; earned: boolean; icon: 'flame' | 'trophy' | 'star' | 'ribbon' }

export function badgesOf(stats: RoutineStats): Badge[] {
  const streak = [3, 7, 14, 30, 60, 100].map((n) => ({
    id: `streak-${n}`, label: `${n} Tage`, detail: `${n} Tage in Folge`, earned: stats.bestStreak >= n, icon: n >= 30 ? 'trophy' as const : 'flame' as const,
  }));
  const total = [10, 50, 100, 365].map((n) => ({
    id: `total-${n}`, label: `${n}×`, detail: `${n} Tage insgesamt`, earned: stats.totalDays >= n, icon: n >= 100 ? 'ribbon' as const : 'star' as const,
  }));
  return [...streak, ...total];
}

/** Badges earned by this check-in (compared with the stats before). */
export function newBadges(before: RoutineStats | undefined, after: RoutineStats): Badge[] {
  const had = new Set(before ? badgesOf(before).filter((b) => b.earned).map((b) => b.id) : []);
  return badgesOf(after).filter((b) => b.earned && !had.has(b.id));
}

// ---------- progress photos (only on this phone) ----------

export interface ProgressPhoto { uri: string; name: string; takenAt: Date }

function photoDir(): Directory {
  const dir = new Directory(Paths.document, 'fortschritt');
  if (!dir.exists) dir.create({ idempotent: true, intermediates: true });
  return dir;
}

/** "2026-10-29_081530.jpg" → its date. */
function dateOf(name: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(\d{2})\.jpg$/.exec(name);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])) : null;
}

/** All photos, oldest first. */
export function listPhotos(): ProgressPhoto[] {
  if (Platform.OS === 'web') return [];
  const out: ProgressPhoto[] = [];
  for (const entry of photoDir().list()) {
    if (!(entry instanceof File)) continue;
    const takenAt = dateOf(entry.name);
    if (takenAt) out.push({ uri: entry.uri, name: entry.name, takenAt });
  }
  return out.sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime());
}

/** Moves a freshly taken picture (temporary file of the camera) into the photo folder. */
export function savePhoto(tempUri: string, at = new Date()): ProgressPhoto {
  const pad = (n: number) => String(n).padStart(2, '0');
  const name = `${localDay(at)}_${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}.jpg`;
  const target = new File(photoDir(), name);
  new File(tempUri).copy(target);
  return { uri: target.uri, name, takenAt: at };
}

export function deletePhoto(photo: ProgressPhoto): void {
  const f = new File(photoDir(), photo.name);
  if (f.exists) f.delete();
}
