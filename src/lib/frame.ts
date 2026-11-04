// The frame around the profile photo: the more days the member has practised, the finer it gets. It takes the place of the badges
// (owner 03.11.2026; names and pictures by Mailin 04.11.2026). Counted from the routine days over all routines (lib/plans.ts overallStats).
// components/frame-ring.tsx draws it.
import type { RoutineStats } from './routine';

export interface FrameLevel {
  level: number; days: number; name: string; line: string;
  /** The picture: transparent outside and in the middle, where the photo shows through. */
  image: number;
}
export interface Frame extends FrameLevel { next: { name: string; days: number } | null }

export const FRAMES: readonly FrameLevel[] = [
  { level: 0, days: 0, name: 'Face Newbie', line: 'Dein erster Schritt', image: require('../../assets/images/frames/face-newbie.png') as number },
  { level: 1, days: 7, name: 'Face Lover', line: 'Dein Gesicht wird wacher', image: require('../../assets/images/frames/face-lover.png') as number },
  { level: 2, days: 30, name: 'Face Addict', line: 'Es wird zum Ritual', image: require('../../assets/images/frames/face-addict.png') as number },
  { level: 3, days: 60, name: 'Face Pro', line: 'Man sieht’s dir an', image: require('../../assets/images/frames/face-pro.png') as number },
  { level: 4, days: 100, name: 'Face Legend', line: 'Ein Teil von dir', image: require('../../assets/images/frames/face-legend.png') as number },
];

export function frameOf(stats: Pick<RoutineStats, 'totalDays'>): Frame {
  let now = FRAMES[0] as FrameLevel;
  for (const f of FRAMES) if (stats.totalDays >= f.days) now = f;
  const next = FRAMES[now.level + 1];
  return { ...now, next: next ? { name: next.name, days: next.days - stats.totalDays } : null };
}
