// The frame around the profile photo: the more days the member has practised, the finer it gets. It takes the place of the badges
// (owner 03.11.2026). Counted from the routine days over all routines (lib/plans.ts overallStats).
import type { RoutineStats } from './routine';

export interface Frame { level: number; name: string; color: string | null; width: number; next: { name: string; days: number } | null }

const LEVELS = [
  { days: 0, name: 'Start', color: null, width: 2 },
  { days: 7, name: 'Bronze', color: '#B87A4B', width: 3 },
  { days: 30, name: 'Silber', color: '#AEB8C4', width: 4 },
  { days: 60, name: 'Gold', color: '#E3B341', width: 5 },
  { days: 100, name: 'Diamant', color: '#6FD3F0', width: 6 },
] as const;

export function frameOf(stats: Pick<RoutineStats, 'totalDays'>): Frame {
  let level = 0;
  LEVELS.forEach((l, i) => {
    if (stats.totalDays >= l.days) level = i;
  });
  const now = LEVELS[level] as (typeof LEVELS)[number];
  const next = LEVELS[level + 1];
  return { level, name: now.name, color: now.color, width: now.width, next: next ? { name: next.name, days: next.days - stats.totalDays } : null };
}
