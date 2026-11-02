// Small pieces shared by the routine screens: the progress ring, the length picker (Kurz / Normal / Lang), the minutes of a
// zone session, this week as a row of days, "Gezielt üben" (the zones), and the routine of today as a card for the start page.
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { minutes, plural } from '@/lib/format';
import { localDay } from '@/lib/nav';
import { LENGTH_LABEL, scaledDuration, useRoutinePrefs, useRoutines, type MemberRoutine, type RoutineLength } from '@/lib/routine';
import { useZones } from '@/lib/zones';
import { radius, space, usePalette } from '@/lib/theme';
import { Card, Section, Txt } from './ui';

const LENGTHS: RoutineLength[] = ['short', 'normal', 'long'];
const WEEKDAY = ['M', 'D', 'M', 'D', 'F', 'S', 'S'];

/** The way into a routine: its start screen. */
export const openRoutine = (id: string) => router.push(`/routine/${encodeURIComponent(id)}` as Href);

/** Total seconds of a routine at a length. */
export const routineSeconds = (routine: MemberRoutine, length: RoutineLength) =>
  routine.steps.reduce((sum, s) => sum + scaledDuration(s.durationSec, length), 0);

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

export function LengthPicker({ value, onChange, totalFor }: { value: RoutineLength; onChange: (l: RoutineLength) => void; totalFor: (l: RoutineLength) => number }) {
  const p = usePalette();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: p.surface, borderRadius: radius.l, padding: 4, gap: 4 }}>
      {LENGTHS.map((l) => {
        const on = l === value;
        return (
          <Pressable
            key={l}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(l)}
            style={{ flex: 1, alignItems: 'center', paddingVertical: space.s, borderRadius: radius.m, backgroundColor: on ? p.accent : 'transparent' }}
          >
            <Txt variant="heading" color={on ? p.onAccent : p.text}>{LENGTH_LABEL[l]}</Txt>
            <Txt variant="small" color={on ? p.onAccent : p.textMuted}>{minutes(totalFor(l))}</Txt>
          </Pressable>
        );
      })}
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
  const zones = q.data ?? [];
  if (zones.length === 0) return null;
  return (
    <Section title="Gezielt üben">
      <Txt muted>Wenig Zeit? Nimm dir nur einen Bereich vor.</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {zones.map((z) => (
          <Pressable
            key={z.id}
            accessibilityRole="button"
            accessibilityLabel={`${z.name}, ${plural(z.exercises.length, 'Übung', 'Übungen')}`}
            onPress={() => router.push({ pathname: '/routine/zone', params: { id: z.id } } as unknown as Href)}
            style={({ pressed }) => ({
              flexGrow: 1, flexBasis: '45%', minHeight: 72, justifyContent: 'center', gap: 2, padding: space.m, borderRadius: radius.l, borderWidth: 1,
              borderColor: p.line, backgroundColor: p.surface, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Txt variant="heading" numberOfLines={1}>{z.name}</Txt>
            <Txt variant="small" muted>{plural(z.exercises.length, 'Übung', 'Übungen')}</Txt>
          </Pressable>
        ))}
      </View>
    </Section>
  );
}

/** Monday to Sunday of this week: done days filled, today outlined. */
export function WeekStrip({ days }: { days: readonly string[] }) {
  const p = usePalette();
  const done = new Set(days);
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const today = localDay(now);
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {WEEKDAY.map((label, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const key = localDay(d);
        const isDone = done.has(key);
        const isToday = key === today;
        return (
          <View key={key} style={{ alignItems: 'center', gap: 4 }}>
            <View
              accessibilityLabel={`${key}${isDone ? ', erledigt' : ''}`}
              style={{
                width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
                backgroundColor: isDone ? p.accent : p.surface, borderWidth: isToday && !isDone ? 2 : 0, borderColor: p.accent,
              }}
            >
              {isDone ? <Ionicons name="checkmark" size={18} color={p.onAccent} /> : null}
            </View>
            <Txt variant="small" muted style={isToday ? { fontWeight: '700' } : undefined}>{label}</Txt>
          </View>
        );
      })}
    </View>
  );
}

/** The start page: today's routine with the streak, one tap from the start screen. Nothing when there is no routine. */
export function RoutineTodayCard() {
  const p = usePalette();
  const q = useRoutines();
  const [prefs] = useRoutinePrefs();
  const routine = q.data?.[0];
  if (!routine || routine.steps.length === 0) return null;
  const done = routine.stats.doneToday;
  return (
    <Card
      onPress={() => openRoutine(routine.id)}
      accessibilityLabel={`${routine.title}${done ? ', heute erledigt' : ', starten'}`}
      style={{ padding: space.l, flexDirection: 'row', alignItems: 'center', gap: space.m, backgroundColor: p.accentSoft, borderColor: 'transparent' }}
    >
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: done ? p.accent : p.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={done ? 'checkmark' : 'flame'} size={done ? 30 : 26} color={done ? p.onAccent : p.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="caption" color={p.accent}>{done ? 'Heute erledigt' : 'Deine Routine heute'}</Txt>
        <Txt variant="heading" numberOfLines={2}>{routine.title}</Txt>
        <Txt variant="small" muted>
          {plural(routine.steps.length, 'Übung', 'Übungen')} · {minutes(routineSeconds(routine, prefs.length))}
          {routine.stats.streak > 0 ? ` · ${plural(routine.stats.streak, 'Tag', 'Tage')} in Folge` : ''}
        </Txt>
      </View>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: done ? p.surface : p.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={done ? 'refresh' : 'play'} size={22} color={done ? p.textMuted : p.onAccent} />
      </View>
    </Card>
  );
}
