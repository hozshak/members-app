// Zungen-Erinnerung (owner 10.11.2026): a few times a day the phone asks "Wo ist deine Zunge gerade?" — the habit that is forgotten all the time. Local
// notifications of the phone that repeat every day (no server, nothing about the member leaves the phone), spread evenly over the hours the member chooses.
// They use their own identifiers, so the reminders of the routine (lib/routine.ts) never touch them. The widget with the small tongue is in
// src/widgets/tongue-widget.*.tsx.
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { getItem, setItem } from './storage';

export interface TonguePrefs {
  on: boolean;
  /** How many times a day. */
  times: number;
  /** From this full hour … */
  fromHour: number;
  /** … to this full hour (the last reminder). */
  toHour: number;
}

export const TONGUE_DEFAULTS: TonguePrefs = { on: false, times: 4, fromHour: 9, toHour: 21 };
export const TONGUE_TIME_CHOICES = [3, 4, 5, 6] as const;
export const TONGUE_QUESTION = 'Wo ist deine Zunge gerade?';

const KEY = 'members.tongue';
const PREFIX = 'tongue-';
const CHANNEL = 'tongue';

/** The times of a day: `times` reminders spread evenly from `fromHour` to `toHour`, on five minutes. One reminder: in the middle. */
export function tongueTimes(prefs: Pick<TonguePrefs, 'times' | 'fromHour' | 'toHour'>): { hour: number; minute: number }[] {
  const from = Math.min(prefs.fromHour, prefs.toHour) * 60;
  const to = Math.max(prefs.fromHour, prefs.toHour) * 60;
  const n = Math.max(1, Math.min(12, Math.round(prefs.times)));
  const at = (min: number) => {
    const m = Math.round(min / 5) * 5;
    return { hour: Math.floor(m / 60) % 24, minute: m % 60 };
  };
  if (n === 1) return [at((from + to) / 2)];
  const step = (to - from) / (n - 1);
  const out = Array.from({ length: n }, (_, i) => at(from + i * step));
  // a short window gives the same minute twice: once is enough
  return out.filter((t, i) => out.findIndex((u) => u.hour === t.hour && u.minute === t.minute) === i);
}

/** "9:00, 13:00, 17:00 und 21:00 Uhr". */
export function tongueTimesLabel(prefs: TonguePrefs): string {
  const list = tongueTimes(prefs).map((t) => `${t.hour}:${String(t.minute).padStart(2, '0')}`);
  if (list.length <= 1) return `${list[0] ?? ''} Uhr`;
  return `${list.slice(0, -1).join(', ')} und ${list[list.length - 1]} Uhr`;
}

function readPrefs(raw: string | null): TonguePrefs {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<TonguePrefs>) : {};
    const hour = (x: unknown, d: number) => (typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 23 ? x : d);
    return {
      on: v.on === true,
      times: typeof v.times === 'number' && v.times >= 1 && v.times <= 12 ? Math.round(v.times) : TONGUE_DEFAULTS.times,
      fromHour: hour(v.fromHour, TONGUE_DEFAULTS.fromHour),
      toHour: hour(v.toHour, TONGUE_DEFAULTS.toHour),
    };
  } catch {
    return TONGUE_DEFAULTS;
  }
}

let prefs: TonguePrefs | null = null;
const listeners = new Set<() => void>();

function subscribe(l: () => void): () => void {
  listeners.add(l);
  if (prefs === null) {
    void getItem(KEY).then((raw) => {
      if (prefs !== null) return;
      prefs = readPrefs(raw);
      listeners.forEach((x) => x());
    });
  }
  return () => { listeners.delete(l); };
}

/** The settings on this phone; null while they are read. */
export function useTonguePrefs(): TonguePrefs | null {
  return useSyncExternalStore(subscribe, () => prefs, () => prefs);
}

async function cancelTongue(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(all.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

/** Plans the reminders anew (all off when `on` is false). False: the phone does not allow notifications. */
async function plan(p: TonguePrefs): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await cancelTongue();
  if (!p.on) return true;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Zungen-Erinnerung', importance: AndroidImportance.DEFAULT, vibrationPattern: [0, 60, 90, 60],
    });
  }
  const allowed = (await Notifications.getPermissionsAsync()).granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!allowed) return false;
  await Promise.all(tongueTimes(p).map((t, i) => Notifications.scheduleNotificationAsync({
    identifier: `${PREFIX}${i}`,
    content: { title: `👅 ${TONGUE_QUESTION}`, body: 'Kurz nachspüren, dann geht’s weiter.', sound: 'default' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: t.hour, minute: t.minute, channelId: CHANNEL },
  })));
  return true;
}

/** Saves the settings and plans the reminders. False: switched on, but the phone does not allow notifications (then it stays off). */
export async function setTonguePrefs(next: TonguePrefs): Promise<boolean> {
  const ok = await plan(next).catch(() => false);
  prefs = ok ? next : { ...next, on: false };
  await setItem(KEY, JSON.stringify(prefs));
  listeners.forEach((l) => l());
  return ok || !next.on;
}
