// One plan (lib/plans.ts), one page with one main action. Before the start: what it is, for a zone the goal with a short word on why 30 days
// or 3 months, how the plan works and the first day. Under way: the day and the way into today's routine on a large picture, today's exercises
// (each can be swapped for another one of the zone, for today only), all days of the plan at a glance, the photos before and after, a new start
// and the way out at the very end. At the end: the result, the after photo and the comparison. The goal of a zone plan becomes "Mein Ziel".
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckInCard, CheckInsRow } from '@/components/check-in-parts';
import { LinkedText } from '@/components/linked-text';
import { ExerciseThumb, HeroButton, HeroCard, HeroDone, openRoutine, PhotoSlot } from '@/components/routine-parts';
import { Button, Card, Cover, ErrorView, Loading, MenuGroup, MenuRow, ProgressBar, Screen, Section, Txt } from '@/components/ui';
import { errorText } from '@/lib/api';
import { clock, minutes, plural } from '@/lib/format';
import { useDayChecks, useGoal } from '@/lib/goal';
import { localDay } from '@/lib/nav';
import { unlockPhotos, usePhotosVisible } from '@/lib/photo-lock';
import { clearPlanPhotos, goalLabel, planLabel, planState, usePlanPhotos, usePlanStart, useSwaps, withSwaps } from '@/lib/plans';
import { openCheckIn, useCheckDue } from '@/lib/progress-check';
import { listPhotos, stepSeconds, useCheckIn, useRoutinePrefs, useRoutines, type MemberRoutine, type ProgressPhoto, type RoutineChallenge, type RoutineStep } from '@/lib/routine';
import { radius, space, usePalette } from '@/lib/theme';
import { useZones, type MemberZoneExercise } from '@/lib/zones';

const camera = (routineId: string, slot: 'start' | 'end') =>
  router.push({ pathname: '/routine/kamera', params: { plan: routineId, slot } } as unknown as Href);

/** The two goals of a zone plan. */
function GoalChoice({ days, longDays, value, onChange }: { days: number; longDays: number; value: number; onChange: (days: number) => void }) {
  const p = usePalette();
  const options = [
    { days, tag: 'Standard', why: 'Gut zum Einstieg: Genug Zeit, damit die Übungen zur Gewohnheit werden und du den Ablauf sicher kannst.' },
    { days: longDays, tag: 'Maximum', why: 'Für alle, die dranbleiben wollen: Der Plan läuft mehrmals durch, und Veränderungen bekommen mehr Zeit, sichtbar zu werden.' },
  ];
  return (
    <View accessibilityRole="radiogroup" style={{ gap: space.s }}>
      {options.map((o) => {
        const on = o.days === value;
        return (
          <Pressable
            key={o.days}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${goalLabel(o.days)}, ${o.tag}`}
            onPress={() => onChange(o.days)}
            style={{ flexDirection: 'row', gap: space.m, padding: space.m, borderRadius: radius.l, borderWidth: 2, borderColor: on ? p.accent : p.line, backgroundColor: on ? p.accentSoft : p.surface }}
          >
            <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? p.accent : p.textMuted} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.s }}>
                <Txt variant="heading">{goalLabel(o.days)}</Txt>
                <Txt variant="small" muted>{o.tag}</Txt>
              </View>
              <Txt variant="small" muted>{o.why}</Txt>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const HOW_IT_WORKS = [
  { icon: 'camera-outline', title: 'Foto zum Start', text: 'Damit du später den Unterschied siehst. Es bleibt nur auf deinem Handy.' },
  { icon: 'calendar-outline', title: 'Jeden Tag deine Übungen', text: 'Die App zeigt dir, was heute dran ist. Du machst einfach mit.' },
  { icon: 'sparkles-outline', title: 'Foto am Ende', text: 'Am letzten Tag siehst du Vorher und Nachher nebeneinander.' },
] as const;

function HowItWorks() {
  const p = usePalette();
  return (
    <View style={{ gap: space.m }}>
      {HOW_IT_WORKS.map((step) => (
        <View key={step.title} style={{ flexDirection: 'row', gap: space.m }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={step.icon} size={22} color={p.accent} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="heading">{step.title}</Txt>
            <Txt variant="small" muted>{step.text}</Txt>
          </View>
        </View>
      ))}
    </View>
  );
}

/** One exercise of today: its picture, title, length and, in a zone plan, "Andere Übung". */
function ExerciseRow({ step, swapped, onSwap, onRestore }: { step: RoutineStep; swapped: boolean; onSwap?: () => void; onRestore: () => void }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m, minHeight: 72 }}>
      <ExerciseThumb step={step} size={56} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="heading" numberOfLines={2}>{step.title}</Txt>
        <Txt variant="small" muted>{clock(stepSeconds(step))}{swapped ? ' · Für heute getauscht' : ''}</Txt>
      </View>
      {swapped ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${step.title}: zurück zur Übung aus dem Plan`} hitSlop={10} onPress={onRestore}>
          <Ionicons name="arrow-undo-outline" size={24} color={p.accent} />
        </Pressable>
      ) : onSwap ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${step.title}: andere Übung wählen`} hitSlop={10} onPress={onSwap}>
          <Ionicons name="swap-horizontal" size={24} color={p.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** "Andere Übung": the exercises of the zone. */
function SwapSheet({ zoneName, exercises, onPick, onClose }: { zoneName: string; exercises: MemberZoneExercise[]; onPick: (x: MemberZoneExercise) => void; onClose: () => void }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Schließen" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
        <View accessibilityViewIsModal style={{ maxHeight: '75%', backgroundColor: p.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingTop: space.l }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.l, paddingBottom: space.m }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="title">Andere Übung</Txt>
              <Txt variant="small" muted>{zoneName}, nur für heute. Morgen geht es mit dem Plan weiter.</Txt>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Schließen" hitSlop={10} onPress={onClose}>
              <Ionicons name="close" size={26} color={p.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: space.l, paddingBottom: insets.bottom + space.l, gap: space.s }}>
            {exercises.map((x) => (
              <Card key={x.videoId} onPress={() => onPick(x)} accessibilityLabel={x.title} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m }}>
                <Cover url={x.thumbnailUrl} title={x.title} aspect={1} style={{ width: 48 }} />
                <Txt variant="heading" style={{ flex: 1 }} numberOfLines={2}>{x.title}</Txt>
                {x.durationSec ? <Txt variant="small" muted>{clock(x.durationSec)}</Txt> : null}
              </Card>
            ))}
            {exercises.length === 0 ? <Txt muted>Für diese Zone gibt es gerade keine anderen Übungen.</Txt> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** A long plan shows its current four weeks; a short one all of its days. */
const LONG_PLAN = 35;
const PAGE_DAYS = 28;
const PER_ROW = 7;

/** All days of the plan at a glance: a tick on the days done, a ring around today, what is still to come is faint. */
function PlanDays({ challenge, done }: { challenge: RoutineChallenge; done: readonly string[] }) {
  const p = usePalette();
  const today = localDay();
  const finished = new Set(done);
  const start = new Date(`${challenge.startDay}T12:00:00`);
  const long = challenge.days > LONG_PLAN;
  const page = long ? Math.floor(Math.max(0, (challenge.dayNumber ?? 1) - 1) / PAGE_DAYS) : 0;
  const from = page * PAGE_DAYS;
  const to = long ? Math.min(challenge.days, from + PAGE_DAYS) : challenge.days;
  const cells = Array.from({ length: to - from }, (_, i) => {
    const number = from + i + 1;
    return { number, key: localDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + from + i, 12)) };
  });
  const rows = Array.from({ length: Math.ceil(cells.length / PER_ROW) }, (_, r) => cells.slice(r * PER_ROW, (r + 1) * PER_ROW));
  return (
    <Card style={{ padding: space.m, gap: space.xs }}>
      {long ? <Txt variant="small" muted style={{ textAlign: 'center', marginBottom: space.xs }}>Tag {from + 1} bis {to} von {challenge.days}</Txt> : null}
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.map((c) => {
            const isDone = finished.has(c.key);
            const isToday = c.key === today;
            const coming = c.key > today;
            return (
              <View key={c.key} style={{ width: `${100 / PER_ROW}%`, alignItems: 'center', paddingVertical: 3 }}>
                <View
                  accessibilityLabel={`Tag ${c.number}${isDone ? ', erledigt' : isToday ? ', heute' : ''}`}
                  style={{
                    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', opacity: coming ? 0.45 : 1,
                    backgroundColor: isDone ? p.accent : p.surfaceAlt, borderWidth: isToday && !isDone ? 2 : 0, borderColor: p.accent,
                  }}
                >
                  {isDone
                    ? <Ionicons name="checkmark" size={20} color={p.onAccent} />
                    : <Txt variant="small" color={isToday ? p.accent : p.textMuted} style={{ fontVariant: ['tabular-nums'], fontWeight: isToday ? '700' : '400' }}>{c.number}</Txt>}
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </Card>
  );
}

function Plan({ routine }: { routine: MemberRoutine }) {
  const p = usePalette();
  const plan = usePlanStart(routine.id);
  const photos = usePlanPhotos(routine.id);
  const swaps = useSwaps();
  const zones = useZones();
  const [, setGoal] = useGoal();
  const due = useCheckDue(routine);
  const dayChecks = useDayChecks(routine.id);
  const undoToday = useCheckIn(routine.id);
  const [prefs] = useRoutinePrefs();
  const photosVisible = usePhotosVisible(prefs.photoLock);
  const info = routine.plan;
  const [goal, chooseGoal] = useState(info?.days ?? 30);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [all, setAll] = useState<ProgressPhoto[]>([]);
  useFocusEffect(useCallback(() => { setAll(listPhotos()); }, []));

  if (!info) return null;
  const isZone = info.kind === 'zone';
  const state = planState(routine);
  const ch = routine.challenge;
  const today = withSwaps(routine, swaps.steps);
  const before = all.find((x) => x.name === photos.start);
  const after = all.find((x) => x.name === photos.end);
  const exercises = (zones.data ?? []).find((z) => z.id === info.zoneId)?.exercises ?? [];
  const lastDay = !!ch && ch.dayNumber !== null && ch.dayNumber >= ch.days;
  const doneToday = routine.stats.doneToday;
  const busy = plan.start.isPending || plan.leave.isPending;
  const error = plan.start.error ?? plan.leave.error;
  const picture = today.steps.find((s) => s.videoThumbnailUrl)?.videoThumbnailUrl ?? null;
  const todaySec = today.steps.reduce((sum, s) => sum + stepSeconds(s), 0);
  const seePhotos = () => router.push('/routine/fotos' as Href);

  const start = () => plan.start.mutate(isZone ? goal : undefined, {
    onSuccess: () => {
      clearPlanPhotos(routine.id);
      if (isZone) setGoal({ text: info.zoneName ?? routine.title, perWeek: 7, days: goal, startDay: localDay() });
      if (Platform.OS !== 'web') camera(routine.id, 'start');
    },
  });
  const startAgain = () => plan.start.mutate(undefined, {
    onSuccess: () => {
      clearPlanPhotos(routine.id);
      if (Platform.OS !== 'web') camera(routine.id, 'start');
    },
  });
  // the reset is the one way to take today's ticks back (owner 06.11.2026): today is day 1 again and open
  const restart = () => Alert.alert(
    'Von vorne beginnen?',
    'Heute ist dann wieder Tag 1 und noch offen. Deine erledigten Tage davor bleiben erhalten.',
    [{ text: 'Abbrechen', style: 'cancel' }, {
      text: 'Neu starten',
      style: 'destructive',
      onPress: () => {
        dayChecks.set([]);
        if (routine.stats.doneToday) undoToday.mutate(false);
        startAgain();
      },
    }],
  );
  const leave = () => Alert.alert(
    'Routine beenden?',
    'Deine erledigten Tage bleiben erhalten. Du kannst die Routine jederzeit neu starten.',
    [{ text: 'Abbrechen', style: 'cancel' }, { text: 'Beenden', style: 'destructive', onPress: () => plan.leave.mutate(undefined, { onSuccess: () => router.back() }) }],
  );

  const beforeAfter = (
    <Section title="Vorher und Nachher">
      {(before || after) && !photosVisible ? (
        <Button label="Fotos entsperren" kind="secondary" onPress={() => void unlockPhotos()} />
      ) : (
        <View style={{ flexDirection: 'row', gap: space.s }}>
          <PhotoSlot
            label="Vorher"
            photo={before}
            empty={state === 'over' ? { icon: 'image-outline', text: 'Kein Foto vom Start' } : { icon: 'camera-outline', text: 'Jetzt Foto machen' }}
            onPress={before ? seePhotos : state === 'over' ? undefined : () => camera(routine.id, 'start')}
          />
          <PhotoSlot
            label="Nachher"
            photo={after}
            empty={lastDay || state === 'over' ? { icon: 'camera-outline', text: 'Jetzt Foto machen' } : { icon: 'lock-closed-outline', text: 'Am letzten Tag deines Plans' }}
            onPress={after ? seePhotos : lastDay || state === 'over' ? () => camera(routine.id, 'end') : undefined}
          />
        </View>
      )}
    </Section>
  );

  return (
    <Screen contentStyle={{ gap: space.xl }}>
      {error ? <Txt color={p.danger}>{errorText(error)}</Txt> : null}

      {state === 'open' ? (
        <>
          <HeroCard imageUrl={picture} minHeight={240} label={planLabel(routine)} title={routine.title} line={`${goalLabel(isZone ? goal : info.days)}, jeden Tag deine Übungen`} />
          {routine.description ? <LinkedText text={routine.description} muted /> : null}
          {isZone && info.longDays ? (
            <Section title="Dein Ziel">
              <GoalChoice days={info.days} longDays={info.longDays} value={goal} onChange={chooseGoal} />
            </Section>
          ) : null}
          <Section title="So läuft dein Plan">
            <HowItWorks />
          </Section>
          <View style={{ gap: space.xs }}>
            <Button label="Plan starten" onPress={start} loading={busy} />
            {isZone ? (
              <Button
                label="Nur kurz üben, ohne Plan"
                kind="ghost"
                onPress={() => router.push({ pathname: '/routine/zone', params: { id: info.zoneId ?? '' } } as unknown as Href)}
              />
            ) : null}
          </View>
          <Section title="Dein erster Tag" action={<Txt variant="small" muted>{plural(routine.steps.length, 'Übung', 'Übungen')}</Txt>}>
            <MenuGroup>
              {routine.steps.map((s) => <ExerciseRow key={s.id} step={s} swapped={false} onRestore={() => undefined} />)}
            </MenuGroup>
          </Section>
        </>
      ) : null}

      {state === 'running' && ch ? (
        <>
          <HeroCard imageUrl={picture} minHeight={260} label={planLabel(routine)} title={`Tag ${ch.dayNumber} von ${ch.days}`} line={`${routine.title} · ${plural(ch.doneDays, 'Tag', 'Tage')} erledigt`}>
            <ProgressBar value={(ch.dayNumber ?? 0) / ch.days} style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' }} />
            {doneToday
              ? <HeroDone text="Heute erledigt. Bis morgen!" />
              : <HeroButton label={`Routine starten · ${minutes(todaySec)}`} icon="play" onPress={() => openRoutine(routine.id)} />}
          </HeroCard>
          {due ? <CheckInCard routine={routine} due={due} /> : null}
          {lastDay && doneToday && !after && !routine.progressCheck ? <Button label="Nachher-Foto machen" onPress={() => camera(routine.id, 'end')} /> : null}
          <Section title="Heute" action={<Txt variant="small" muted>{plural(today.steps.length, 'Übung', 'Übungen')}</Txt>}>
            <MenuGroup>
              {today.steps.map((s) => (
                <ExerciseRow
                  key={s.id}
                  step={s}
                  swapped={!!swaps.steps[s.id]}
                  onSwap={isZone && exercises.length > 0 && !doneToday ? () => setSwapping(s.id) : undefined}
                  onRestore={() => swaps.restore(s.id)}
                />
              ))}
            </MenuGroup>
          </Section>
          <Section title="Dein Weg" action={<Txt variant="small" muted>{ch.doneDays} von {ch.days} erledigt</Txt>}>
            <PlanDays challenge={ch} done={routine.stats.days} />
          </Section>
          {beforeAfter}
          <CheckInsRow routine={routine} />
          {routine.description ? (
            <Section title="Über diesen Plan">
              <LinkedText text={routine.description} muted />
            </Section>
          ) : null}
          <MenuGroup>
            <MenuRow icon="refresh-outline" label={isZone ? 'Von vorne beginnen' : 'Zurücksetzen und neu beginnen'} onPress={restart} />
            <MenuRow icon="close-circle-outline" label="Routine beenden" onPress={leave} />
          </MenuGroup>
        </>
      ) : null}

      {state === 'over' && ch ? (
        <>
          <HeroCard imageUrl={picture} minHeight={240} label="Plan beendet" title={ch.completed ? 'Geschafft!' : 'Dein Plan ist zu Ende'} line={`${routine.title} · ${ch.doneDays} von ${ch.days} Tagen erledigt`}>
            {due === 'final'
              ? <HeroButton label="Abschluss-Check machen" icon="ribbon" onPress={() => openCheckIn(routine.id)} />
              : !after ? <HeroButton label="Nachher-Foto machen" icon="camera" onPress={() => camera(routine.id, 'end')} /> : null}
          </HeroCard>
          {beforeAfter}
          <CheckInsRow routine={routine} />
          <Section title="Dein Weg" action={<Txt variant="small" muted>{ch.doneDays} von {ch.days} erledigt</Txt>}>
            <PlanDays challenge={ch} done={routine.stats.days} />
          </Section>
          <View style={{ gap: space.m }}>
            <Button label="Noch einmal starten" kind="secondary" onPress={startAgain} loading={busy} />
            <MenuGroup>
              <MenuRow icon="close-circle-outline" label="Routine beenden" onPress={leave} />
            </MenuGroup>
          </View>
        </>
      ) : null}

      {swapping ? (
        <SwapSheet
          zoneName={info.zoneName ?? ''}
          exercises={exercises}
          onClose={() => setSwapping(null)}
          onPick={(x) => {
            swaps.swap(swapping, { videoId: x.videoId, title: x.title, thumbnailUrl: x.thumbnailUrl, durationSec: x.durationSec });
            setSwapping(null);
          }}
        />
      ) : null}
    </Screen>
  );
}

export default function PlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useRoutines();
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  const routine = q.data.find((r) => r.id === id);
  if (!routine?.plan) return <ErrorView error={new Error('not_found')} onRetry={() => router.back()} />;
  return <Plan routine={routine} />;
}
