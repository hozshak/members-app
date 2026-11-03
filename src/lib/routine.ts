// The daily routine (app only): the routines of the community with the member's streak (GET /api/member/routines of
// the software, worker/modules/player/routines.ts), marking a day done or opening it again, the daily reminder (a local notification
// of the phone — no server involved) and the progress photos (stored ONLY on the phone, in the app's own folder; never
// uploaded).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Directory, File, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { Platform } from 'react-native';
import { useEffect, useSyncExternalStore } from 'react';
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
  /** The length of the video; missing on older versions of the software. */
  videoDurationSec?: number | null;
}
/** A routine with its own exercises per day (shared/types.ts MemberRoutinePlan, lib/plans.ts): `steps` are then those of today. */
export interface MemberRoutinePlan {
  kind: 'recommended' | 'zone'; label: string; zoneId: Id | null; zoneName: string | null;
  days: number; longDays: number | null; planDays: number; planDay: number;
}
/** An N-day challenge of a routine (shared/types.ts RoutineChallenge); null = the routine is no challenge. */
export interface RoutineChallenge { days: number; startDay: string | null; dayNumber: number | null; doneDays: number; completed: boolean }
export interface MemberRoutine {
  id: Id; title: string; description: string; totalSec: number; steps: RoutineStep[]; stats: RoutineStats;
  /** Missing on software versions before the challenges. */
  challenge?: RoutineChallenge | null;
  /** Missing on software versions before the plans. */
  plan?: MemberRoutinePlan | null;
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
    onSuccess: ({ stats, challenge }, done) => {
      if (done) void cancelSnooze();
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

/** How long an exercise runs: as long as its video; without a video the time set in the admin. */
export function stepSeconds(step: Pick<RoutineStep, 'durationSec' | 'videoAvailable' | 'videoDurationSec'>): number {
  return step.videoAvailable && step.videoDurationSec ? step.videoDurationSec : step.durationSec;
}

export interface RoutinePrefs {
  /** Daily reminder at a fixed time. */
  reminder: boolean; hour: number; minute: number;
  /** A photo reminder once a week: weekday 1 = Sunday … 7 = Saturday. */
  photoReminder: boolean; photoWeekday: number; photoHour: number; photoMinute: number;
  /** The progress photos need Face ID / the phone's code. */
  photoLock: boolean;
  /** In the routine: front camera as a mirror, small sounds. */
  mirror: boolean; sound: boolean;
  /** The exercise video next to the mirror (on by default), and whether it plays without sound. */
  video: boolean; videoMuted: boolean;
}
const PREFS_KEY = 'members.routine';
export const DEFAULT_PREFS: RoutinePrefs = {
  reminder: false, hour: 8, minute: 0, photoReminder: false, photoWeekday: 1, photoHour: 10, photoMinute: 0,
  photoLock: false, mirror: false, sound: true, video: true, videoMuted: false,
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
/** "Serie retten" is gone (03.11.2026): what an older version scheduled is removed. */
const RESCUE_PREFIX = 'rescue-';
const SNOOZE_ID = 'routine-snooze';
/** The daily reminder can be moved from the notification itself; a tap on a button opens the app, which schedules it again. */
const REMINDER_CATEGORY = 'routine-reminder';
const SNOOZE_ACTION = /^snooze-(\d+)$/;

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

/** Brings the scheduled notifications in line with the settings: the daily reminder and the weekly photo reminder. */
export async function syncReminders(prefs: RoutinePrefs, routine: { title: string } | null): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(DAILY_ID).catch(() => undefined);
  await Notifications.cancelScheduledNotificationAsync(PHOTO_ID).catch(() => undefined);
  await cancelPrefix(RESCUE_PREFIX);
  const anything = (prefs.reminder && routine !== null) || prefs.photoReminder;
  if (!anything || !(await Notifications.getPermissionsAsync()).granted) return;

  if (prefs.reminder && routine) {
    await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY, [
      { identifier: 'snooze-60', buttonTitle: 'In 1 Stunde', options: { opensAppToForeground: true } },
      { identifier: 'snooze-180', buttonTitle: 'In 3 Stunden', options: { opensAppToForeground: true } },
    ]);
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_ID,
      content: { title: 'Zeit für deine Routine', body: `${routine.title} – ein paar Minuten nur für dich.`, categoryIdentifier: REMINDER_CATEGORY },
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
}

/** The routine is done: a moved reminder has nothing left to say. */
async function cancelSnooze(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(SNOOZE_ID).catch(() => undefined);
}

/** A button of the reminder ("In 1 Stunde"): the same notification again later. A tap on the notification itself opens the routine. */
export function useReminderActions(): void {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const handle = (response: Notifications.NotificationResponse) => {
      const minutes = SNOOZE_ACTION.exec(response.actionIdentifier)?.[1];
      if (minutes) {
        const { title, body } = response.notification.request.content;
        void Notifications.scheduleNotificationAsync({
          identifier: SNOOZE_ID,
          content: { title, body, categoryIdentifier: REMINDER_CATEGORY },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(Date.now() + Number(minutes) * 60_000), channelId: CHANNEL },
        });
      }
      router.navigate('/routine' as Href);
    };
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    // the app was closed: the answer that started it
    void Notifications.getLastNotificationResponseAsync().then((last) => {
      if (!last) return;
      handle(last);
      void Notifications.clearLastNotificationResponseAsync();
    });
    return () => sub.remove();
  }, []);
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
  new File(tempUri).copySync(target);
  return { uri: target.uri, name, takenAt: at };
}

export function deletePhoto(photo: ProgressPhoto): void {
  const f = new File(photoDir(), photo.name);
  if (f.exists) f.delete();
}
