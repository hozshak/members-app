// One plan (lib/plans.ts): before the start what it is and, for a zone, the goal with a short word on why 30 days or 3 months; under
// way the day, today's exercises (each can be swapped for another one of the zone, for today only), a new start and the way out; at
// the end the after photo and the comparison with the photo of the start. The goal of a zone plan becomes "Mein Ziel".
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinkedText } from '@/components/linked-text';
import { openRoutine } from '@/components/routine-parts';
import { Button, Card, Cover, ErrorView, Loading, ProgressBar, Screen, Section, Txt } from '@/components/ui';
import { errorText } from '@/lib/api';
import { clock, minutes, plural } from '@/lib/format';
import { useGoal } from '@/lib/goal';
import { localDay } from '@/lib/nav';
import { unlockPhotos, usePhotosVisible } from '@/lib/photo-lock';
import { clearPlanPhotos, goalLabel, planLabel, planState, usePlanPhotos, usePlanStart, useSwaps, withSwaps } from '@/lib/plans';
import { listPhotos, stepSeconds, useRoutinePrefs, useRoutines, type MemberRoutine, type ProgressPhoto, type RoutineStep } from '@/lib/routine';
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

/** One exercise of today: its picture, title, length and, in a zone plan, "Andere Übung". */
function ExerciseRow({ step, swapped, onSwap, onRestore }: { step: RoutineStep; swapped: boolean; onSwap?: () => void; onRestore: () => void }) {
  const p = usePalette();
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m }}>
      {step.videoThumbnailUrl ? (
        <Cover url={step.videoThumbnailUrl} title={step.title} aspect={1} style={{ width: 56 }} />
      ) : (
        <View style={{ width: 56, height: 56, borderRadius: radius.m, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="body-outline" size={24} color={p.accent} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="heading" numberOfLines={2}>{step.title}</Txt>
        <Txt variant="small" muted>{clock(stepSeconds(step))}{swapped ? ' · Für heute getauscht' : ''}</Txt>
      </View>
      {swapped ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${step.title}: zurück zur Übung aus dem Plan`} hitSlop={8} onPress={onRestore}>
          <Ionicons name="arrow-undo-outline" size={22} color={p.accent} />
        </Pressable>
      ) : onSwap ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${step.title}: andere Übung wählen`} hitSlop={8} onPress={onSwap}>
          <Ionicons name="swap-horizontal" size={24} color={p.accent} />
        </Pressable>
      ) : null}
    </Card>
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

/** The photo of the start against the photo of the end, side by side. */
function Comparison({ before, after }: { before: ProgressPhoto; after: ProgressPhoto }) {
  const p = usePalette();
  const when = (ph: ProgressPhoto) => ph.takenAt.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Alle Fotos ansehen" onPress={() => router.push('/routine/fotos' as Href)} style={{ flexDirection: 'row', gap: space.s }}>
      {[{ ph: before, label: 'Vorher' }, { ph: after, label: 'Nachher' }].map(({ ph, label }) => (
        <View key={label} style={{ flex: 1, gap: space.xs }}>
          <Image source={{ uri: ph.uri }} style={{ aspectRatio: 3 / 4, borderRadius: radius.m }} contentFit="cover" accessibilityLabel={`${label}, ${when(ph)}`} />
          <Txt variant="caption" color={p.accent}>{label}</Txt>
          <Txt variant="small" muted>{when(ph)}</Txt>
        </View>
      ))}
    </Pressable>
  );
}

function Plan({ routine }: { routine: MemberRoutine }) {
  const p = usePalette();
  const plan = usePlanStart(routine.id);
  const photos = usePlanPhotos(routine.id);
  const swaps = useSwaps();
  const zones = useZones();
  const [, setGoal] = useGoal();
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
  const busy = plan.start.isPending || plan.leave.isPending;
  const error = plan.start.error ?? plan.leave.error;

  const start = () => plan.start.mutate(isZone ? goal : undefined, {
    onSuccess: () => {
      clearPlanPhotos(routine.id);
      if (isZone) setGoal({ text: info.zoneName ?? routine.title, perWeek: 7, days: goal, startDay: localDay() });
      if (Platform.OS !== 'web') camera(routine.id, 'start');
    },
  });
  const restart = () => Alert.alert(
    'Von vorne beginnen?',
    'Heute ist dann wieder Tag 1. Deine erledigten Tage bleiben erhalten.',
    [{ text: 'Abbrechen', style: 'cancel' }, { text: 'Neu starten', style: 'destructive', onPress: () => plan.start.mutate(undefined, { onSuccess: () => { clearPlanPhotos(routine.id); if (Platform.OS !== 'web') camera(routine.id, 'start'); } }) }],
  );
  const leave = () => Alert.alert(
    'Plan beenden?',
    'Deine erledigten Tage bleiben erhalten. Du kannst den Plan jederzeit neu starten.',
    [{ text: 'Abbrechen', style: 'cancel' }, { text: 'Beenden', style: 'destructive', onPress: () => plan.leave.mutate(undefined, { onSuccess: () => router.back() }) }],
  );

  return (
    <Screen onRefresh={undefined} contentStyle={{ gap: space.xl }}>
      <View style={{ gap: space.xs }}>
        <Txt variant="caption" color={p.accent}>{planLabel(routine)}</Txt>
        <Txt variant="display">{routine.title}</Txt>
        {routine.description ? <LinkedText text={routine.description} muted style={{ marginTop: space.xs }} /> : null}
      </View>

      {error ? <Txt color={p.danger}>{errorText(error)}</Txt> : null}

      {state === 'open' ? (
        <>
          {isZone && info.longDays ? (
            <Section title="Dein Ziel">
              <GoalChoice days={info.days} longDays={info.longDays} value={goal} onChange={chooseGoal} />
            </Section>
          ) : (
            <Txt muted>{goalLabel(info.days)}, jeden Tag mit eigenen Übungen.</Txt>
          )}
          <Card style={{ flexDirection: 'row', gap: space.m, padding: space.l, backgroundColor: p.accentSoft, borderColor: 'transparent' }}>
            <Ionicons name="camera-outline" size={24} color={p.accent} />
            <Txt style={{ flex: 1 }}>Zum Start machst du ein Foto, am Ende noch eins. So siehst du den Unterschied. Die Fotos bleiben nur auf deinem Handy.</Txt>
          </Card>
          <Button label="Plan starten" onPress={start} loading={busy} />
          {isZone ? (
            <Button
              label="Nur kurz üben, ohne Plan"
              kind="ghost"
              onPress={() => router.push({ pathname: '/routine/zone', params: { id: info.zoneId ?? '' } } as unknown as Href)}
            />
          ) : null}
          <Section title="Tag 1">
            <View style={{ gap: space.s }}>
              {routine.steps.map((s) => <ExerciseRow key={s.id} step={s} swapped={false} onRestore={() => undefined} />)}
            </View>
          </Section>
        </>
      ) : null}

      {state === 'running' && ch ? (
        <>
          <View style={{ gap: space.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Txt variant="title">Tag {ch.dayNumber} von {ch.days}</Txt>
              <Txt variant="small" muted>{ch.doneDays} erledigt</Txt>
            </View>
            <ProgressBar value={(ch.dayNumber ?? 0) / ch.days} style={{ height: 10, borderRadius: 5 }} />
          </View>
          {!before ? (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m }}>
              <Ionicons name="camera-outline" size={24} color={p.accent} />
              <Txt style={{ flex: 1 }}>Noch kein Vorher-Foto</Txt>
              <Button label="Foto machen" kind="secondary" onPress={() => camera(routine.id, 'start')} style={{ minHeight: 40, paddingHorizontal: space.m }} />
            </Card>
          ) : null}
          <Section title="Heute" action={<Txt variant="small" muted>{plural(today.steps.length, 'Übung', 'Übungen')} · {minutes(today.steps.reduce((sum, s) => sum + stepSeconds(s), 0))}</Txt>}>
            <View style={{ gap: space.s }}>
              {today.steps.map((s) => (
                <ExerciseRow
                  key={s.id}
                  step={s}
                  swapped={!!swaps.steps[s.id]}
                  onSwap={isZone && exercises.length > 0 && !routine.stats.doneToday ? () => setSwapping(s.id) : undefined}
                  onRestore={() => swaps.restore(s.id)}
                />
              ))}
            </View>
          </Section>
          <Button label={routine.stats.doneToday ? 'Heute erledigt: noch einmal machen' : 'Routine starten'} kind={routine.stats.doneToday ? 'secondary' : 'primary'} onPress={() => openRoutine(routine.id)} />
          {lastDay && routine.stats.doneToday && !after ? <Button label="Nachher-Foto machen" onPress={() => camera(routine.id, 'end')} /> : null}
        </>
      ) : null}

      {state === 'over' && ch ? (
        <>
          <Card style={{ alignItems: 'center', gap: space.s, padding: space.xl, backgroundColor: p.accentSoft, borderColor: 'transparent' }}>
            <Ionicons name="trophy" size={40} color={p.accent} />
            <Txt variant="title" style={{ textAlign: 'center' }}>{ch.completed ? 'Geschafft!' : 'Dein Plan ist zu Ende'}</Txt>
            <Txt muted style={{ textAlign: 'center' }}>{ch.doneDays} von {ch.days} Tagen erledigt</Txt>
          </Card>
          {!after ? (
            <Card style={{ gap: space.m, padding: space.l }}>
              <Txt>Jetzt das Nachher-Foto: gleiches Licht, gleicher Abstand wie beim ersten.</Txt>
              <Button label="Nachher-Foto machen" onPress={() => camera(routine.id, 'end')} />
            </Card>
          ) : null}
          {before && after ? (
            <Section title="Dein Unterschied">
              {photosVisible ? <Comparison before={before} after={after} /> : <Button label="Fotos entsperren" kind="secondary" onPress={() => void unlockPhotos()} />}
            </Section>
          ) : null}
          <Button label="Noch einmal starten" kind="secondary" onPress={() => plan.start.mutate(undefined, { onSuccess: () => { clearPlanPhotos(routine.id); if (Platform.OS !== 'web') camera(routine.id, 'start'); } })} loading={busy} />
        </>
      ) : null}

      {state !== 'open' ? (
        <View style={{ gap: space.xs }}>
          {state === 'running' ? <Button label={isZone ? 'Von vorne beginnen' : 'Zurücksetzen und neu beginnen'} kind="ghost" onPress={restart} /> : null}
          <Button label="Plan beenden" kind="ghost" onPress={leave} />
        </View>
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
