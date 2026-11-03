// Small pieces shared by the routine screens: the progress ring, the minutes of a
// zone session, the last 14 days, "Gezielt üben" (the zones: a zone with a plan leads to its plan), and the routine of today as a card for the start page.
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { minutes, plural } from '@/lib/format';
import { localDay } from '@/lib/nav';
import { goalLabel, mainRoutine, overallStats, planLabel, planState } from '@/lib/plans';
import { stepSeconds, useRoutines, type MemberRoutine, type RoutineChallenge } from '@/lib/routine';
import { useZones } from '@/lib/zones';
import { radius, space, usePalette } from '@/lib/theme';
import { Card, Section, Txt } from './ui';

const WEEKDAY = ['M', 'D', 'M', 'D', 'F', 'S', 'S'];

/** The way into a routine: its start screen. */
export const openRoutine = (id: string) => router.push(`/routine/${encodeURIComponent(id)}` as Href);

/** The page of a plan (goal, today's exercises, photos). */
export const openPlan = (id: string) => router.push({ pathname: '/routine/plan', params: { id } } as unknown as Href);

/** Total seconds of a routine. */
export const routineSeconds = (routine: MemberRoutine) => routine.steps.reduce((sum, s) => sum + stepSeconds(s), 0);

export function ProgressRing({ size, share, stroke = 12, track, children }: { size: number; share: number; stroke?: number; track?: string; children?: ReactNode }) {
  const p = usePalette();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute' }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? p.surfaceAlt} strokeWidth={stroke} fill="none" opacity={0.9} />
          <Circle
            cx={size / 2} cy={size / 2} r={r} stroke={p.accent} strokeWidth={stroke} fill="none" strokeLinecap="round"
            strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, share)))} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
      </View>
      {children}
    </View>
  );
}

/** The minutes of a zone session. */
export function MinutesPicker({ value, options, onChange }: { value: number; options: readonly number[]; onChange: (minutes: number) => void }) {
  const p = usePalette();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: p.surface, borderRadius: radius.l, padding: 4, gap: 4 }}>
      {options.map((m) => {
        const on = m === value;
        return (
          <Pressable
            key={m}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(m)}
            style={{ flex: 1, alignItems: 'center', paddingVertical: space.m, borderRadius: radius.m, backgroundColor: on ? p.accent : 'transparent' }}
          >
            <Txt variant="heading" color={on ? p.onAccent : p.text}>{m} Min.</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** "Gezielt üben": one tile per zone with videos the member may open; nothing when there is none. */
export function ZonesSection() {
  const p = usePalette();
  const q = useZones();
  const routines = useRoutines();
  const zones = q.data ?? [];
  if (zones.length === 0) return null;
  const planOf = (zoneId: string) => routines.data?.find((r) => r.plan?.kind === 'zone' && r.plan.zoneId === zoneId);
  const line = (zoneId: string, exercises: number) => {
    const plan = planOf(zoneId);
    if (!plan?.plan) return plural(exercises, 'Übung', 'Übungen');
    const state = planState(plan);
    if (state === 'running') return `Tag ${plan.challenge?.dayNumber} von ${plan.challenge?.days}`;
    return state === 'over' ? 'Plan beendet' : `Plan · ${goalLabel(plan.plan.days)}`;
  };
  return (
    <Section title="Gezielt üben">
      <Txt muted>Wähle einen Bereich und setz dir ein Ziel. Dein Plan sagt dir jeden Tag, was dran ist.</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {zones.map((z) => (
          <Pressable
            key={z.id}
            accessibilityRole="button"
            accessibilityLabel={`${z.name}, ${line(z.id, z.exercises.length)}`}
            onPress={() => {
              const plan = planOf(z.id);
              if (plan) openPlan(plan.id);
              else router.push({ pathname: '/routine/zone', params: { id: z.id } } as unknown as Href);
            }}
            style={({ pressed }) => ({
              flexGrow: 1, flexBasis: '45%', minHeight: 72, justifyContent: 'center', gap: 2, padding: space.m, borderRadius: radius.l, borderWidth: 1,
              borderColor: p.line, backgroundColor: p.surface, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Txt variant="heading" numberOfLines={1}>{z.name}</Txt>
            <Txt variant="small" muted>{line(z.id, z.exercises.length)}</Txt>
          </Pressable>
        ))}
      </View>
    </Section>
  );
}

/**
 * 14 days at a glance, done days filled, today outlined: during a plan its current 14 days, numbered by the day of the plan;
 * otherwise last week and this week, Monday to Sunday.
 */
export function TwoWeeks({ days, plan }: { days: readonly string[]; plan?: RoutineChallenge | null }) {
  const p = usePalette();
  const done = new Set(days);
  const today = localDay();
  const now = new Date(`${today}T12:00:00`);
  const shift = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
  const inPlan = !!plan?.startDay && plan.dayNumber !== null;
  // the block of 14 days the plan is in, or the Monday of last week
  const offset = inPlan ? Math.floor(((plan.dayNumber as number) - 1) / 14) * 14 : 0;
  const first = inPlan ? shift(new Date(`${plan.startDay}T12:00:00`), offset) : shift(now, -((now.getDay() + 6) % 7) - 7);
  const cells = Array.from({ length: 14 }, (_, i) => {
    const d = shift(first, i);
    return { key: localDay(d), label: inPlan ? offset + i + 1 : d.getDate() };
  });
  return (
    <View style={{ gap: space.xs }}>
      {inPlan ? null : (
        <View style={{ flexDirection: 'row' }}>
          {WEEKDAY.map((label, i) => <Txt key={i} variant="small" muted style={{ flex: 1, textAlign: 'center' }}>{label}</Txt>)}
        </View>
      )}
      {[cells.slice(0, 7), cells.slice(7)].map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.map((c) => {
            const isDone = done.has(c.key);
            const isToday = c.key === today;
            const future = c.key > today;
            return (
              <View key={c.key} style={{ flex: 1, alignItems: 'center', paddingVertical: 3 }}>
                <View
                  accessibilityLabel={`${c.key}${isDone ? ', erledigt' : ''}`}
                  style={{
                    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', opacity: future ? 0.45 : 1,
                    backgroundColor: isDone ? p.accent : p.surface, borderWidth: isToday && !isDone ? 2 : 0, borderColor: p.accent,
                  }}
                >
                  {isDone
                    ? <Ionicons name="checkmark" size={18} color={p.onAccent} />
                    : <Txt variant="small" muted style={{ fontVariant: ['tabular-nums'], fontWeight: isToday ? '700' : '400' }}>{c.label}</Txt>}
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** The start page: today's routine with the streak, one tap from the start screen. Nothing when there is no routine. */
export function RoutineTodayCard() {
  const p = usePalette();
  const q = useRoutines();
  const routine = mainRoutine(q.data);
  if (!routine || routine.steps.length === 0) return null;
  const done = routine.stats.doneToday;
  const streak = overallStats(q.data).streak;
  const state = routine.plan ? planState(routine) : null;
  return (
    <Card
      onPress={() => (state === 'running' || !routine.plan ? openRoutine(routine.id) : openPlan(routine.id))}
      accessibilityLabel={`${routine.title}${done ? ', heute erledigt' : ', starten'}`}
      style={{ padding: space.l, flexDirection: 'row', alignItems: 'center', gap: space.m, backgroundColor: p.accentSoft, borderColor: 'transparent' }}
    >
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: done ? p.accent : p.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={done ? 'checkmark' : 'flame'} size={done ? 30 : 26} color={done ? p.onAccent : p.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="caption" color={p.accent}>{done ? 'Heute erledigt' : routine.plan ? planLabel(routine) : 'Deine Routine heute'}</Txt>
        <Txt variant="heading" numberOfLines={2}>{routine.title}</Txt>
        <Txt variant="small" muted>
          {state === 'running' ? `Tag ${routine.challenge?.dayNumber} von ${routine.challenge?.days} · ` : ''}
          {plural(routine.steps.length, 'Übung', 'Übungen')} · {minutes(routineSeconds(routine))}
          {streak > 0 ? ` · ${plural(streak, 'Tag', 'Tage')} in Folge` : ''}
        </Txt>
      </View>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: done ? p.surface : p.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={done ? 'refresh' : 'play'} size={22} color={done ? p.textMuted : p.onAccent} />
      </View>
    </Card>
  );
}
