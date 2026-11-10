// The daily routine (app only): the routines of the community with the member's streak (GET /api/member/routines of
// the software, worker/modules/player/routines.ts), marking a day done or opening it again, the daily reminder (local notifications
// of the phone, another text every day, none on a day already done; only their texts come from the server, with the routines) and the progress
// photos (stored ONLY on the phone, in the app's own folder; never uploaded).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Directory, File, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { Platform } from 'react-native';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { ApiError } from './api';
import { setAppTexts } from './app-texts';
import { useIntroStates, type IntroState } from './intro';
import { localDay } from './nav';
import { DEFAULT_REMINDER_TEXTS, plannedReminders, readReminderTexts } from './reminder-texts';
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
  /** "Freiwillig" (migration 0114): after the routine, by choice; missing on older software versions. */
  optional?: boolean;
}
/** A routine with its own exercises per day (shared/types.ts MemberRoutinePlan, lib/plans.ts): `steps` are then those of today. */
export interface MemberRoutinePlan {
  kind: 'recommended' | 'zone'; label: string; zoneId: Id | null; zoneName: string | null;
  days: number; longDays: number | null; planDays: number; planDay: number;
}
/** An N-day challenge of a routine (shared/types.ts RoutineChallenge); null = the routine is no challenge. */
export interface RoutineChallenge { days: number; startDay: string | null; dayNumber: number | null; doneDays: number; completed: boolean }
/** The check-in the coach switched on for a routine (shared/types.ts ProgressCheckConfig, lib/progress-check.ts). */
export interface ProgressCheckQuestion { title: string; question: string }
export interface ProgressCheckConfig {
  contactName: string; photoTips: string[]; photoHint: string; looks: ProgressCheckQuestion[]; feels: ProgressCheckQuestion[]; encouragement: string; closing: string;
}
export interface MemberRoutine {
  id: Id; title: string; description: string; totalSec: number; steps: RoutineStep[]; stats: RoutineStats;
  /** null = switched off; missing on software versions before the check-in. */
  progressCheck?: ProgressCheckConfig | null;
  /** Missing on software versions before the challenges. */
  challenge?: RoutineChallenge | null;
  /** Missing on software versions before the plans. */
  plan?: MemberRoutinePlan | null;
  /** Own picture from the dashboard (09.11.2026); missing or null = the first video's thumbnail. */
  imageUrl?: string | null;
  /** The programmes behind the routine's tags; missing on older software versions. */
  productIds?: Id[];
  /** Set here, never by the server: a recommended plan the member skips, see skippedByIntro. */
  skipped?: boolean;
}

/**
 * A recommended plan the member skips (owner 09.11.2026): not started, and in the introduction of one of its programmes the member chose any answer but the
 * first ("Ich bin schon länger dabei"). A plan for all members counts every programme. It stays there to be started by choice.
 */
export function skippedByIntro(r: MemberRoutine, intros: Readonly<Record<string, IntroState>>): boolean {
  const ch = r.challenge;
  const open = !ch || !ch.startDay || ch.dayNumber === null;
  if (r.plan?.kind !== 'recommended' || !open) return false;
  const experienced = (id: string) => (intros[id]?.level ?? 0) > 0;
  const ids = r.productIds ?? [];
  return ids.length > 0 ? ids.some(experienced) : Object.keys(intros).some(experienced);
}

export const routineKey = ['routines'] as const;

/** The texts of the reminders as the coach set them; they come with the routines. Software versions before them send none: the app's own stay. */
let textsNow = DEFAULT_REMINDER_TEXTS;
const textsListeners = new Set<() => void>();

function setReminderTexts(raw: unknown): void {
  const next = readReminderTexts(raw) ?? DEFAULT_REMINDER_TEXTS;
  if (JSON.stringify(next) === JSON.stringify(textsNow)) return;
  textsNow = next;
  textsListeners.forEach((l) => l());
}

function subscribeTexts(l: () => void): () => void {
  textsListeners.add(l);
  return () => { textsListeners.delete(l); };
}

export function useReminderTexts() {
  return useSyncExternalStore(subscribeTexts, () => textsNow, () => textsNow);
}

export function useRoutines() {
  const api = useApi();
  const intros = useIntroStates();
  const marks = JSON.stringify(Object.entries(intros).map(([id, s]) => [id, s.level]));
  const select = useCallback(
    (list: MemberRoutine[]) => (list.some((r) => skippedByIntro(r, intros)) ? list.map((r) => (skippedByIntro(r, intros) ? { ...r, skipped: true } : r)) : list),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `marks` stands for the answers in `intros`
    [marks],
  );
  return useQuery({
    select,
    queryKey: routineKey,
    queryFn: async () => {
      try {
        const answer = await api.get<{ items: MemberRoutine[]; reminderTexts?: unknown; appTexts?: unknown }>(`/api/member/routines?day=${localDay()}`);
        setReminderTexts(answer.reminderTexts);
        setAppTexts(answer.appTexts);
        return answer.items;
      } catch (err) {
        // a community whose software has no routines yet answers 404: nothing to show, no error
        if (err instanceof ApiError && err.status === 404) {
          setReminderTexts(null);
          return [];
        }
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
  /** In the routine: front camera as a mirror. */
  mirror: boolean;
  /** "Nicht jetzt" on the hint that recommends the reminder (it is off until the member allows notifications). */
  reminderHintClosed: boolean;
}
const PREFS_KEY = 'members.routine';
export const DEFAULT_PREFS: RoutinePrefs = {
  reminder: false, hour: 8, minute: 0, photoReminder: false, photoWeekday: 1, photoHour: 10, photoMinute: 0,
  photoLock: false, mirror: false, reminderHintClosed: false,
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
let prefsLoading = false;
let prefsLoaded = false;
const prefsListeners = new Set<() => void>();
const emitPrefs = () => prefsListeners.forEach((l) => l());

function subscribePrefs(l: () => void): () => void {
  prefsListeners.add(l);
  if (!prefsLoading) {
    prefsLoading = true;
    void loadPrefs().then((p) => {
      prefsNow = p;
      prefsLoaded = true;
      emitPrefs();
    });
  }
  return () => { prefsListeners.delete(l); };
}

/** The saved settings are there (before that the defaults stand in: nothing should be planned from those). */
export const routinePrefsLoaded = () => prefsLoaded;

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
/** One notification per day under this prefix plus the date: each has its own text, and a day that is done has none. */
const DAILY_PREFIX = 'routine-daily';
/** How many days ahead; the app plans again whenever it opens. iOS keeps at most 64 pending notifications. */
const DAILY_AHEAD = 30;
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

let lastPlanned = '';
let planning: Promise<void> = Promise.resolve();

async function planReminders(prefs: RoutinePrefs, routine: MemberRoutine | null): Promise<void> {
  await cancelPrefix(DAILY_PREFIX);
  await Notifications.cancelScheduledNotificationAsync(PHOTO_ID).catch(() => undefined);
  await cancelPrefix(RESCUE_PREFIX);
  const anything = (prefs.reminder && routine !== null) || prefs.photoReminder;
  if (!anything || !(await Notifications.getPermissionsAsync()).granted) return;

  if (prefs.reminder && routine) {
    await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY, [
      { identifier: 'snooze-60', buttonTitle: 'In 1 Stunde', options: { opensAppToForeground: true } },
      { identifier: 'snooze-180', buttonTitle: 'In 3 Stunden', options: { opensAppToForeground: true } },
    ]);
    for (const r of plannedReminders(prefs, routine, DAILY_AHEAD, textsNow)) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${DAILY_PREFIX}-${r.day}`,
        content: { ...r.text, categoryIdentifier: REMINDER_CATEGORY },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.date, channelId: CHANNEL },
      });
    }
  }
  if (prefs.photoReminder) {
    await Notifications.scheduleNotificationAsync({
      identifier: PHOTO_ID,
      content: textsNow.photo,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: prefs.photoWeekday, hour: prefs.photoHour, minute: prefs.photoMinute, channelId: CHANNEL },
    });
  }
}

/** Brings the scheduled notifications in line with the settings and the routine; one after the other, and only when something changed. */
export function syncReminders(prefs: RoutinePrefs, routine: MemberRoutine | null): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  const state = JSON.stringify([
    localDay(), prefs.reminder, prefs.hour, prefs.minute, prefs.photoReminder, prefs.photoWeekday, prefs.photoHour, prefs.photoMinute,
    routine?.title, routine?.stats.doneToday, routine?.stats.streak, routine?.challenge?.dayNumber, routine?.challenge?.days, textsNow,
  ]);
  if (state === lastPlanned) return planning;
  lastPlanned = state;
  planning = planning.then(() => planReminders(prefs, routine)).catch(() => undefined);
  return planning;
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

// Three angles (owner 10.11.2026: "vorher und nachher: front und rechts und links"): one set of photos shares the time in its name, the sides carry
// "_rechts" / "_links". A name without an angle is a photo from the front (all photos from before).
export type PhotoAngle = 'front' | 'right' | 'left';
export const PHOTO_ANGLES: readonly PhotoAngle[] = ['front', 'right', 'left'];
export const PHOTO_ANGLE_LABELS: Record<PhotoAngle, string> = { front: 'Vorne', right: 'Rechts', left: 'Links' };
const ANGLE_SUFFIX: Record<PhotoAngle, string> = { front: '', right: '_rechts', left: '_links' };

/** `set`: the time in the name, the same for the photos of one set. */
export interface ProgressPhoto { uri: string; name: string; takenAt: Date; angle: PhotoAngle; set: string }

function photoDir(): Directory {
  const dir = new Directory(Paths.document, 'fortschritt');
  if (!dir.exists) dir.create({ idempotent: true, intermediates: true });
  return dir;
}

/** "2026-10-29_081530.jpg" / "2026-10-29_081530_rechts.jpg" → its date, angle and set; null for any other file. */
export function parsePhotoName(name: string): { takenAt: Date; angle: PhotoAngle; set: string } | null {
  const m = /^((\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(\d{2}))(?:_(rechts|links))?\.jpg$/.exec(name);
  if (!m) return null;
  const takenAt = new Date(Number(m[2]), Number(m[3]) - 1, Number(m[4]), Number(m[5]), Number(m[6]), Number(m[7]));
  return { takenAt, angle: m[8] === 'rechts' ? 'right' : m[8] === 'links' ? 'left' : 'front', set: m[1] as string };
}

/** The photos of one angle, oldest first: by default the ones from the front (what the check-ins and the routine compare); 'all' for every angle. */
export function listPhotos(angle: PhotoAngle | 'all' = 'front'): ProgressPhoto[] {
  if (Platform.OS === 'web') return [];
  const out: ProgressPhoto[] = [];
  for (const entry of photoDir().list()) {
    if (!(entry instanceof File)) continue;
    const parsed = parsePhotoName(entry.name);
    if (parsed && (angle === 'all' || parsed.angle === angle)) out.push({ uri: entry.uri, name: entry.name, ...parsed });
  }
  return out.sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime() || PHOTO_ANGLES.indexOf(a.angle) - PHOTO_ANGLES.indexOf(b.angle));
}

/** The photo of the same set in another angle (the set of a plan's before photo, say). */
export function photoInSet(all: readonly ProgressPhoto[], name: string | undefined, angle: PhotoAngle): ProgressPhoto | undefined {
  const set = name ? parsePhotoName(name)?.set : undefined;
  return set ? all.find((x) => x.set === set && x.angle === angle) : undefined;
}

/** Moves a freshly taken picture (temporary file of the camera) into the photo folder; the photos of one set get the same `at`. */
export function savePhoto(tempUri: string, at = new Date(), angle: PhotoAngle = 'front'): ProgressPhoto {
  const pad = (n: number) => String(n).padStart(2, '0');
  const set = `${localDay(at)}_${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
  const name = `${set}${ANGLE_SUFFIX[angle]}.jpg`;
  const target = new File(photoDir(), name);
  if (target.exists) target.delete();
  new File(tempUri).copySync(target);
  return { uri: target.uri, name, takenAt: at, angle, set };
}

export function deletePhoto(photo: ProgressPhoto): void {
  const f = new File(photoDir(), photo.name);
  if (f.exists) f.delete();
}
