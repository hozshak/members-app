// Small pieces shared by the routine screens: the large picture card with its one action, the progress ring, the minutes of a zone session,
// the picture of an exercise, the last 14 days, "Gezielt üben" (the zones: a zone with a plan leads to its plan), and the routine of today as a
// card for the start page.
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useId, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { minutes, plural } from '@/lib/format';
import { localDay } from '@/lib/nav';
import { goalLabel, mainRoutine, overallStats, planLabel, planState } from '@/lib/plans';
import { stepSeconds, useRoutines, type MemberRoutine, type RoutineChallenge, type RoutineStep } from '@/lib/routine';
import { useZones } from '@/lib/zones';
import { radius, space, usePalette } from '@/lib/theme';
import { TourTarget } from './tour';
import { Card, Cover, Section, Txt } from './ui';

const WEEKDAY = ['M', 'D', 'M', 'D', 'F', 'S', 'S'];

/** The way into a routine: its start screen. */
export const openRoutine = (id: string) => router.push(`/routine/${encodeURIComponent(id)}` as Href);

/** The page of a plan (goal, today's exercises, photos). */
export const openPlan = (id: string) => router.push({ pathname: '/routine/plan', params: { id } } as unknown as Href);

/** Total seconds of a routine. */
export const routineSeconds = (routine: MemberRoutine) => routine.steps.reduce((sum, s) => sum + stepSeconds(s), 0);

const ON_PICTURE = '#FFFFFF';
const ON_PICTURE_SOFT = 'rgba(255,255,255,0.85)';

/** Darkens a picture towards the bottom, so that white text reads on any picture. */
function PictureFade() {
  const id = `fade${useId().replace(/\W/g, '')}`;
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000000" stopOpacity={0.22} />
          <Stop offset="0.38" stopColor="#000000" stopOpacity={0.08} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0.86} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** The top of a routine page: a large picture (the accent colour without one), a label above, what it is and its one action below. */
export function HeroCard({ imageUrl, label, title, line, minHeight = 280, children }: {
  imageUrl: string | null; label: string; title: string; line: string; minHeight?: number; children?: ReactNode;
}) {
  const p = usePalette();
  return (
    <View style={{ minHeight, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: p.accent }}>
      {imageUrl ? <Cover url={imageUrl} title="" aspect={null} rounded={0} style={StyleSheet.absoluteFill} /> : null}
      <PictureFade />
      <View style={{ flexGrow: 1, minHeight, justifyContent: 'space-between', gap: space.xl, padding: space.l }}>
        <View style={{ alignSelf: 'flex-start', paddingHorizontal: space.m, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <Txt variant="caption" color={ON_PICTURE}>{label}</Txt>
        </View>
        <View style={{ gap: space.m }}>
          <View style={{ gap: 2 }}>
            <Txt variant="display" color={ON_PICTURE} numberOfLines={2}>{title}</Txt>
            <Txt color={ON_PICTURE_SOFT}>{line}</Txt>
          </View>
          {children}
        </View>
      </View>
    </View>
  );
}

/** The one action on a picture: white, so that it stands out on any picture and with any accent colour. */
export function HeroButton({ label, icon, onPress, loading }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; loading?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: !!loading }}
      onPress={loading ? undefined : onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s, minHeight: 54, borderRadius: radius.l, backgroundColor: ON_PICTURE, opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}
    >
      {loading ? <ActivityIndicator color="#111111" /> : (
        <>
          <Ionicons name={icon} size={22} color="#111111" />
          <Txt variant="heading" color="#111111">{label}</Txt>
        </>
      )}
    </Pressable>
  );
}

/** Today is done: says so on the picture, in place of the action. */
export function HeroDone({ text }: { text: string }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 54 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: p.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="checkmark" size={26} color={p.onAccent} />
      </View>
      <Txt variant="heading" color={ON_PICTURE} style={{ flex: 1 }}>{text}</Txt>
    </View>
  );
}

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

/** The picture of an exercise: the thumbnail of its video, or a small figure without one. */
export function ExerciseThumb({ step, size = 48 }: { step: Pick<RoutineStep, 'title' | 'videoThumbnailUrl'>; size?: number }) {
  const p = usePalette();
  if (step.videoThumbnailUrl) return <Cover url={step.videoThumbnailUrl} title={step.title} aspect={1} style={{ width: size }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: radius.m, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="body-outline" size={size / 2} color={p.accent} />
    </View>
  );
}

/**
 * "Gezielt üben": one tile per zone with videos the member may open; nothing when there is none. Grey and closed until a recommended plan is
 * finished (owner 04.11.2026); without a recommended plan, or for a zone plan already under way, it stays open.
 */
export function ZonesSection() {
  const p = usePalette();
  const q = useZones();
  const routines = useRoutines();
  const zones = q.data ?? [];
  if (zones.length === 0) return null;
  const recommended = (routines.data ?? []).filter((r) => r.plan?.kind === 'recommended' && r.steps.length > 0);
  const closed = recommended.length > 0 && !recommended.some((r) => planState(r) === 'over');
  const goal = recommended[0]?.plan ? goalLabel(recommended[0].plan.days) : '';
  const under = recommended.find((r) => planState(r) === 'running')?.challenge;
  const daysLeft = under ? under.days - (under.dayNumber ?? 1) + 1 : 0;
  const planOf = (zoneId: string) => routines.data?.find((r) => r.plan?.kind === 'zone' && r.plan.zoneId === zoneId);
  const line = (zoneId: string, exercises: number) => {
    const plan = planOf(zoneId);
    if (!plan?.plan) return plural(exercises, 'Übung', 'Übungen');
    const state = planState(plan);
    if (state === 'running') return `Tag ${plan.challenge?.dayNumber} von ${plan.challenge?.days}`;
    return state === 'over' ? 'Plan beendet' : `Plan · ${goalLabel(plan.plan.days)}`;
  };
  const stillClosed = (zoneId: string) => {
    const plan = planOf(zoneId);
    return closed && !(plan && planState(plan) === 'running');
  };
  const closedText = under
    ? `Noch ${plural(daysLeft, 'Tag', 'Tage')} in deiner empfohlenen Routine, dann wird das frei.`
    : `Das wird frei, sobald du deine empfohlene Routine (${goal}) geschafft hast.`;
  return (
    <TourTarget id="routine.zones">
      <Section title="Gezielt üben">
        <Txt muted>{closed ? closedText : 'Wähle einen Bereich und setz dir ein Ziel. Dein Plan sagt dir jeden Tag, was dran ist.'}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {zones.map((z) => {
            const off = stillClosed(z.id);
            const picture = z.exercises.find((x) => x.thumbnailUrl)?.thumbnailUrl ?? null;
            const onPicture = !!picture && !off;
            return (
              <Pressable
                key={z.id}
                accessibilityRole="button"
                accessibilityState={{ disabled: off }}
                accessibilityLabel={off ? `${z.name}, noch gesperrt` : `${z.name}, ${line(z.id, z.exercises.length)}`}
                onPress={() => {
                  if (off) {
                    Alert.alert('Noch gesperrt', closedText);
                    return;
                  }
                  const plan = planOf(z.id);
                  if (plan) openPlan(plan.id);
                  else router.push({ pathname: '/routine/zone', params: { id: z.id } } as unknown as Href);
                }}
                style={({ pressed }) => ({
                  flexGrow: 1, flexBasis: '45%', height: 124, borderRadius: radius.l, overflow: 'hidden',
                  backgroundColor: p.surfaceAlt, opacity: pressed && !off ? 0.88 : 1, transform: [{ scale: pressed && !off ? 0.98 : 1 }],
                })}
              >
                {picture ? (
                  <View style={[StyleSheet.absoluteFill, off ? { opacity: 0.18 } : null]}>
                    <Cover url={picture} title="" aspect={null} rounded={0} style={StyleSheet.absoluteFill} />
                  </View>
                ) : null}
                {onPicture ? <PictureFade /> : null}
                {off ? (
                  <View style={{ position: 'absolute', top: space.s, right: space.s, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: p.surface }}>
                    <Ionicons name="lock-closed" size={15} color={p.textMuted} />
                  </View>
                ) : null}
                <View style={{ flex: 1, justifyContent: 'flex-end', gap: 2, padding: space.m }}>
                  <Txt variant="heading" numberOfLines={1} color={onPicture ? ON_PICTURE : off ? p.textMuted : p.text}>{z.name}</Txt>
                  <Txt variant="small" color={onPicture ? ON_PICTURE_SOFT : p.textMuted}>{off ? 'Noch gesperrt' : line(z.id, z.exercises.length)}</Txt>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Section>
    </TourTarget>
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
                    backgroundColor: isDone ? p.accent : p.surfaceAlt, borderWidth: isToday && !isDone ? 2 : 0, borderColor: p.accent,
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
  const go = () => {
    if (done) router.navigate('/routine' as Href);
    else if (state === 'running' || !routine.plan) openRoutine(routine.id);
    else openPlan(routine.id);
  };
  return (
    <TourTarget id="start.routine">
      <Card
        onPress={go}
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
        {done ? (
          <Ionicons name="chevron-forward" size={22} color={p.textMuted} />
        ) : (
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="play" size={22} color={p.onAccent} />
          </View>
        )}
      </Card>
    </TourTarget>
  );
}
