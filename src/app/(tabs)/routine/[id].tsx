// Doing the routine: one exercise after the other with a countdown ring, pause / skip / back, a soft vibration at every
// change, the screen stays on. An exercise linked to a course video can be watched right there. After the last one the
// day is marked done (PUT …/days/<today>) and the new streak is shown.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { LessonPlayer } from '@/components/player';
import { Button, ErrorView, Loading, Screen, Txt } from '@/components/ui';
import { errorText } from '@/lib/api';
import { clock } from '@/lib/format';
import { useCheckIn, useRoutines, type MemberRoutine, type RoutineStats } from '@/lib/routine';
import { space, usePalette } from '@/lib/theme';

const RING = 240;
const STROKE = 12;

function buzz(kind: 'step' | 'done') {
  if (Platform.OS === 'web') return;
  void (kind === 'done'
    ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

export default function RoutineSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useRoutines();
  useKeepAwake();
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  const routine = q.data.find((r) => r.id === id);
  if (!routine || routine.steps.length === 0) return <ErrorView error={new Error('not_found')} onRetry={() => router.back()} />;
  return <Session routine={routine} />;
}

function Session({ routine }: { routine: MemberRoutine }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const checkIn = useCheckIn(routine.id);
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(routine.steps[0]?.durationSec ?? 0);
  const [running, setRunning] = useState(true);
  const [showVideo, setShowVideo] = useState(false);
  const [finished, setFinished] = useState<RoutineStats | null>(null);
  // end time of the running countdown (set when it starts or resumes)
  const endsAt = useRef(0);
  const step = routine.steps[index];

  const goTo = (next: number) => {
    const s = routine.steps[next];
    if (!s) return;
    setIndex(next);
    setRemaining(s.durationSec);
    endsAt.current = Date.now() + s.durationSec * 1000;
    setShowVideo(false);
    buzz('step');
  };

  const finish = () => {
    setRunning(false);
    buzz('done');
    checkIn.mutate(true, { onSuccess: (stats) => setFinished(stats) });
  };

  // the countdown: compares with the end time (keeps exact when the phone is busy), next exercise at zero
  useEffect(() => {
    if (!running || finished) return;
    endsAt.current = Date.now() + remaining * 1000;
    const t = setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        clearInterval(t);
        if (index + 1 < routine.steps.length) goTo(index + 1);
        else finish();
      }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restarts only when pausing/resuming or the step changes
  }, [running, index, finished]);

  if (finished || checkIn.isPending || checkIn.isError) {
    return (
      <Screen contentStyle={{ paddingTop: insets.top + space.xxl * 2, alignItems: 'center', gap: space.l }}>
        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="flame" size={64} color={p.accent} />
        </View>
        <Txt variant="display" style={{ textAlign: 'center' }}>Geschafft!</Txt>
        {finished ? (
          <Txt variant="title" style={{ textAlign: 'center' }}>{finished.streak === 1 ? 'Tag 1 deiner Serie' : `${finished.streak} Tage in Folge`}</Txt>
        ) : checkIn.isError ? (
          <View style={{ gap: space.m, alignItems: 'center' }}>
            <Txt color={p.danger} style={{ textAlign: 'center' }}>{errorText(checkIn.error)}</Txt>
            <Button label="Noch einmal speichern" onPress={() => checkIn.mutate(true, { onSuccess: (stats) => setFinished(stats) })} />
          </View>
        ) : (
          <Txt muted>Wird gespeichert …</Txt>
        )}
        <Txt muted style={{ textAlign: 'center' }}>{routine.title} ist für heute erledigt. Bis morgen!</Txt>
        <Button label="Fertig" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
      </Screen>
    );
  }
  if (!step) return null;

  const share = step.durationSec > 0 ? remaining / step.durationSec : 0;
  const r = (RING - STROKE) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <Screen contentStyle={{ paddingTop: insets.top + space.m, gap: space.l }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Routine beenden" hitSlop={12} onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={p.text} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
          {routine.steps.map((s, i) => (
            <View key={s.id} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < index ? p.accent : i === index ? p.accent : p.surfaceAlt, opacity: i === index ? 0.6 : 1 }} />
          ))}
        </View>
        <Txt variant="small" muted>{index + 1}/{routine.steps.length}</Txt>
      </View>

      <View style={{ gap: space.xs }}>
        <Txt variant="caption" color={p.accent}>Übung {index + 1}</Txt>
        <Txt variant="display">{step.title}</Txt>
      </View>

      <View style={{ alignItems: 'center', justifyContent: 'center', marginVertical: space.m }}>
        <Svg width={RING} height={RING}>
          <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={p.surfaceAlt} strokeWidth={STROKE} fill="none" />
          <Circle
            cx={RING / 2} cy={RING / 2} r={r} stroke={p.accent} strokeWidth={STROKE} fill="none" strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - share)}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        </Svg>
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          <Txt style={{ fontSize: 56, lineHeight: 64, fontWeight: '700', fontVariant: ['tabular-nums'] }} accessibilityLabel={`noch ${remaining} Sekunden`}>{clock(remaining)}</Txt>
          {!running ? <Txt muted>Pausiert</Txt> : null}
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
        <RoundButton icon="play-skip-back" label="Vorherige Übung" disabled={index === 0} onPress={() => goTo(index - 1)} />
        <RoundButton icon={running ? 'pause' : 'play'} label={running ? 'Pause' : 'Weiter'} big onPress={() => setRunning((v) => !v)} />
        <RoundButton icon="play-skip-forward" label="Nächste Übung" onPress={() => (index + 1 < routine.steps.length ? goTo(index + 1) : finish())} />
      </View>

      {step.description ? <Txt style={{ marginTop: space.s }}>{step.description}</Txt> : null}

      {step.videoId && step.videoAvailable ? (
        showVideo ? (
          <LessonPlayer key={step.id} playPath={`/api/member/videos/${encodeURIComponent(step.videoId)}/play`} />
        ) : (
          <Button label={`Übung im Video ansehen${step.videoTitle ? `: ${step.videoTitle}` : ''}`} kind="secondary" onPress={() => { setRunning(false); setShowVideo(true); }} />
        )
      ) : null}
    </Screen>
  );
}

function RoundButton({ icon, label, onPress, disabled, big }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean; big?: boolean;
}) {
  const p = usePalette();
  const size = big ? 80 : 56;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => ({
        width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
        backgroundColor: big ? p.accent : p.surfaceAlt, opacity: disabled ? 0.35 : pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Ionicons name={icon} size={big ? 36 : 24} color={big ? p.onAccent : p.text} />
    </Pressable>
  );
}
