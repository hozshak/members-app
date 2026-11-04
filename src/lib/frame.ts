// The frame around the profile photo: the more days the member has practised, the finer it gets. It takes the place of the badges
// (owner 03.11.2026). Counted from the routine days over all routines (lib/plans.ts overallStats). components/frame-ring.tsx draws it.
import type { RoutineStats } from './routine';

export interface FrameLevel {
  level: number; days: number; name: string;
  /** The metal of the ring, from dark over light to dark; null: a thin plain line. */
  colors: readonly string[] | null;
  /** Thickness at the size of the profile photo. */
  width: number;
  /** Small stars on the ring. */
  sparkles: number;
}
export interface Frame extends FrameLevel { next: { name: string; days: number } | null }

export const FRAMES: readonly FrameLevel[] = [
  { level: 0, days: 0, name: 'Start', colors: null, width: 2, sparkles: 0 },
  { level: 1, days: 7, name: 'Bronze', colors: ['#7A4A22', '#E2AE7C', '#9A6233'], width: 4, sparkles: 0 },
  { level: 2, days: 30, name: 'Silber', colors: ['#7F8A97', '#F4F7FA', '#98A3B0'], width: 5, sparkles: 0 },
  { level: 3, days: 60, name: 'Gold', colors: ['#A87A12', '#FFE99A', '#C9981F'], width: 6, sparkles: 1 },
  { level: 4, days: 100, name: 'Diamant', colors: ['#3E9BE8', '#E9FBFF', '#5BC9F2'], width: 7, sparkles: 3 },
];

export function frameOf(stats: Pick<RoutineStats, 'totalDays'>): Frame {
  let now = FRAMES[0] as FrameLevel;
  for (const f of FRAMES) if (stats.totalDays >= f.days) now = f;
  const next = FRAMES[now.level + 1];
  return { ...now, next: next ? { name: next.name, days: next.days - stats.totalDays } : null };
}
