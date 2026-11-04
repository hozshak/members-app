// The frame around the profile photo: the more days the member has practised, the finer it gets. It takes the place of the badges
// (owner 03.11.2026; names and looks by Mailin 04.11.2026). Counted from the routine days over all routines (lib/plans.ts overallStats).
// components/frame-ring.tsx draws it.
import type { Ionicons } from '@expo/vector-icons';
import type { RoutineStats } from './routine';

/** A small picture on the ring: `angle` in degrees (0 = right, clockwise), `share` of the frame's size, `turn` in degrees. */
export interface FrameOrnament { icon: keyof typeof Ionicons.glyphMap; angle: number; share: number; color: string; turn?: number }

export interface FrameLevel {
  level: number; days: number; name: string; line: string;
  /** The metal of the ring, from dark over light to dark. */
  colors: readonly string[];
  /** Thickness at the size of the profile photo. */
  width: number;
  ornaments: readonly FrameOrnament[];
}
export interface Frame extends FrameLevel { next: { name: string; days: number } | null }

const SHINE = '#E2B75C';
const HEART = '#E6466C';
const STAR = '#F2B01E';
const ROSE = '#D63B63';
const GOLD_HAND = '#D9A520';

export const FRAMES: readonly FrameLevel[] = [
  {
    level: 0, days: 0, name: 'Face Newbie', line: 'Dein erster Schritt', colors: ['#CFAE74', '#FFF8E4', '#DDBF8A'], width: 3,
    ornaments: [{ icon: 'sparkles', angle: -48, share: 0.26, color: SHINE }, { icon: 'sparkles', angle: 140, share: 0.18, color: SHINE }],
  },
  {
    level: 1, days: 7, name: 'Face Lover', line: 'Dein Gesicht wird wacher', colors: ['#C4607C', '#FFD9E2', '#DB8299'], width: 4,
    ornaments: [{ icon: 'heart', angle: -52, share: 0.24, color: HEART }, { icon: 'heart', angle: -18, share: 0.17, color: HEART }, { icon: 'heart', angle: 142, share: 0.2, color: HEART }],
  },
  {
    level: 2, days: 30, name: 'Face Addict', line: 'Es wird zum Ritual', colors: ['#A96F35', '#F9DCAE', '#C48B4A'], width: 5,
    ornaments: [
      { icon: 'star', angle: -56, share: 0.25, color: STAR }, { icon: 'star', angle: -20, share: 0.17, color: STAR },
      { icon: 'star', angle: 128, share: 0.2, color: STAR }, { icon: 'star', angle: 168, share: 0.15, color: STAR },
    ],
  },
  {
    level: 3, days: 60, name: 'Face Pro', line: 'Man sieht’s dir an', colors: ['#7F8A97', '#F4F7FA', '#98A3B0'], width: 5,
    ornaments: [-90, -30, 30, 90, 150, 210].map((angle) => ({ icon: 'rose' as const, angle, share: 0.25, color: ROSE })),
  },
  {
    level: 4, days: 100, name: 'Face Legend', line: 'Ein Teil von dir', colors: ['#A87A12', '#FFE99A', '#C9981F'], width: 7,
    ornaments: [
      { icon: 'hand-right', angle: 128, share: 0.36, color: GOLD_HAND, turn: -40 }, { icon: 'hand-left', angle: 52, share: 0.36, color: GOLD_HAND, turn: 40 },
      { icon: 'sparkles', angle: -60, share: 0.2, color: SHINE },
    ],
  },
];

export function frameOf(stats: Pick<RoutineStats, 'totalDays'>): Frame {
  let now = FRAMES[0] as FrameLevel;
  for (const f of FRAMES) if (stats.totalDays >= f.days) now = f;
  const next = FRAMES[now.level + 1];
  return { ...now, next: next ? { name: next.name, days: next.days - stats.totalDays } : null };
}
