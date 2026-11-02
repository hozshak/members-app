// "Gezielt üben" (GET /api/member/zones of the software, worker/modules/player/zones.ts): the videos of a zone, e.g. Hals, the
// member may open. A short session is put together here: as many exercises as fit the chosen minutes, starting at another
// exercise every day. The session does not count for the streak; that belongs to the daily routine.
import { useQuery } from '@tanstack/react-query';
import { ApiError } from './api';
import { localDay } from './nav';
import type { MemberRoutine, RoutineStep } from './routine';
import { useApi } from './session';
import type { Id } from './types';

export interface MemberZoneExercise { videoId: Id; title: string; durationSec: number | null; thumbnailUrl: string | null }
export interface MemberZone { id: Id; name: string; exercises: MemberZoneExercise[] }

export const PRACTICE_MINUTES = [3, 5, 10] as const;
/** A video without a known length counts as this long. */
const UNKNOWN_SEC = 60;
/** Less than this left is not worth another exercise. */
const MIN_STEP_SEC = 20;
const MAX_STEPS = 30;

export function useZones() {
  const api = useApi();
  return useQuery({
    queryKey: ['zones'],
    queryFn: async () => {
      try {
        return (await api.get<{ items: MemberZone[] }>('/api/member/zones')).items;
      } catch (err) {
        // a community whose software has no zones yet answers 404: nothing to show, no error
        if (err instanceof ApiError && err.status === 404) return [];
        throw err;
      }
    },
  });
}

/**
 * The exercises for `minutes`: each as long as its video (the last one shortened to what is left), from another start every
 * day, the list again from the top when it is shorter than the time. Never empty for a zone with exercises.
 */
export function practiceSteps(zone: MemberZone, minutes: number, day = localDay()): RoutineStep[] {
  const list = zone.exercises;
  if (list.length === 0) return [];
  const start = Math.floor(Date.parse(`${day}T12:00:00Z`) / 86_400_000) % list.length;
  const steps: RoutineStep[] = [];
  let left = minutes * 60;
  while (left >= MIN_STEP_SEC && steps.length < MAX_STEPS) {
    const e = list[(start + steps.length) % list.length] as MemberZoneExercise;
    const sec = Math.min(Math.max(MIN_STEP_SEC, e.durationSec ?? UNKNOWN_SEC), left);
    steps.push({
      id: `${e.videoId}:${steps.length}`, title: e.title, description: '', durationSec: sec,
      videoId: e.videoId, videoTitle: e.title, videoThumbnailUrl: e.thumbnailUrl, videoAvailable: true,
    });
    left -= sec;
  }
  return steps;
}

/** A session of a zone in the shape of a routine, for the same run screen (no stats: it does not count for the streak). */
export function practiceRoutine(zone: MemberZone, minutes: number): MemberRoutine {
  const steps = practiceSteps(zone, minutes);
  return {
    id: `zone:${zone.id}`, title: zone.name, description: '', totalSec: steps.reduce((sum, s) => sum + s.durationSec, 0), steps,
    stats: { doneToday: false, streak: 0, bestStreak: 0, totalDays: 0, days: [] },
  };
}
