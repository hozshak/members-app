// The daily routine (app only): the routines of the community with the member's streak (GET /api/member/routines of
// the software, worker/modules/player/routines.ts), marking a day done, the daily reminder (a local notification of the
// phone — no server involved) and the progress photos (stored ONLY on the phone, in the app's own folder; never
// uploaded).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Directory, File, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
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
export interface MemberRoutine { id: Id; title: string; description: string; totalSec: number; steps: RoutineStep[]; stats: RoutineStats }

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
      return (done ? await api.put<{ stats: RoutineStats }>(path) : await api.del<{ stats: RoutineStats }>(path)).stats;
    },
    onSuccess: (stats) => {
      qc.setQueryData<MemberRoutine[]>(routineKey, (list) => list?.map((r) => (r.id === routineId ? { ...r, stats } : r)));
    },
  });
}

// ---------- daily reminder (local notification) ----------

export interface Reminder { enabled: boolean; hour: number; minute: number }
const REMINDER_KEY = 'members.reminder';
const CHANNEL = 'routine';
export const DEFAULT_REMINDER: Reminder = { enabled: false, hour: 8, minute: 0 };

export async function loadReminder(): Promise<Reminder> {
  try {
    const raw = await getItem(REMINDER_KEY);
    return raw ? { ...DEFAULT_REMINDER, ...(JSON.parse(raw) as Partial<Reminder>) } : DEFAULT_REMINDER;
  } catch {
    return DEFAULT_REMINDER;
  }
}

/**
 * Saves the reminder and (re)schedules it: one notification every day at the chosen time. Returns false when the
 * member did not allow notifications (then it stays off).
 */
export async function applyReminder(r: Reminder, routineTitle: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (r.enabled) {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Routine', importance: AndroidImportance.DEFAULT });
    }
    const perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) {
      await setItem(REMINDER_KEY, JSON.stringify({ ...r, enabled: false }));
      return false;
    }
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Zeit für deine Routine', body: `${routineTitle} – ein paar Minuten nur für dich.` },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: r.hour, minute: r.minute, channelId: CHANNEL },
    });
  }
  await setItem(REMINDER_KEY, JSON.stringify(r));
  return true;
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
