// Doing the routine: one exercise after the other with a countdown, pause / skip / back, a soft vibration at every
// change, the screen stays on. Options of the member (kept on the phone): the front camera as a MIRROR (the countdown
// sits on the picture — face yoga is easier when you see your face), VOICE guidance ("Übung 2: Wangen lockern",
// "Noch 10 Sekunden") and the LENGTH chosen on the overview (durations scaled). An exercise linked to a course video
// can be watched right there. After the last one the day is marked done, the streak and new badges are shown, and the
// success can be shared as a picture.
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { LessonPlayer } from '@/components/player';
import { useShareCard } from '@/components/share-card';
import { Button, ErrorView, Loading, Screen, Txt } from '@/components/ui';
import { errorText } from '@/lib/api';
import { useDayChecks } from '@/lib/goal';
import { clock } from '@/lib/format';
import {
  cancelTodaysRescue, newBadges, scaledDuration, useCheckIn, useRoutinePrefs, useRoutines, type Badge, type MemberRoutine, type RoutineStats,
} from '@/lib/routine';
import { radius, space, usePalette } from '@/lib/theme';
import { prepareVoice, say, spokenDuration, stopVoice } from '@/lib/voice';

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

function Ring({ size, share }: { size: number; share: number }) {
  const p = usePalette();
  const r = (size - STROKE) / 2;
  const c = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={p.surfaceAlt} strokeWidth={STROKE} fill="none" opacity={0.9} />
      <Circle
        cx={size / 2} cy={size / 2} r={r} stroke={p.accent} strokeWidth={STROKE} fill="none" strokeLinecap="round"
        strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - share)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

function Session({ routine }: { routine: MemberRoutine }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const checkIn = useCheckIn(routine.id);
  const checks = useDayChecks(routine.id);
  const [prefs, update] = useRoutinePrefs();
  const [camPerm, requestCam] = useCameraPermissions();
  // the durations of this run (length chosen before the start; changing it later does not disturb the run)
  const [durations] = useState(() => routine.steps.map((s) => scaledDuration(s.durationSec, prefs.length)));
  const [statsBefore] = useState(() => routine.stats);
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(durations[0] ?? 0);
  const [running, setRunning] = useState(true);
  const [showVideo, setShowVideo] = useState(false);
  const [finished, setFinished] = useState<RoutineStats | null>(null);
  const [earned, setEarned] = useState<Badge[]>([]);
  // end time of the running countdown (set when it starts or resumes)
  const endsAt = useRef(0);
  const spokeTen = useRef(-1);
  const step = routine.steps[index];
  const mirror = prefs.mirror && !!camPerm?.granted && Platform.OS !== 'web';
  const card = useShareCard(finished ? { big: String(finished.streak), label: finished.streak === 1 ? 'Tag in Folge' : 'Tage in Folge', line: routine.title } : null);

  const announce = (i: number) => {
    const s = routine.steps[i];
    if (!s) return;
    const lead = i === 0 ? 'Los geht’s. Erste Übung:' : i === routine.steps.length - 1 ? 'Und zum Schluss:' : 'Als Nächstes:';
    say(`${lead} ${s.title}. ${spokenDuration(durations[i] ?? s.durationSec)}.`, prefs.voice);
  };

  const goTo = (next: number) => {
    const s = routine.steps[next];
    if (!s) return;
    // moving on ticks the exercise just finished (the checklist of the overview)
    const current = routine.steps[index];
    if (next > index && current) checks.mark(current.id);
    setIndex(next);
    setRemaining(durations[next] ?? s.durationSec);
    endsAt.current = Date.now() + (durations[next] ?? s.durationSec) * 1000;
    setShowVideo(false);
    buzz('step');
    announce(next);
  };

  const save = () => checkIn.mutate(true, {
    onSuccess: ({ stats }) => {
      setFinished(stats);
      setEarned(newBadges(statsBefore, stats));
      void cancelTodaysRescue();
    },
  });

  const finish = () => {
    const last = routine.steps[routine.steps.length - 1];
    if (last) checks.mark(last.id);
    setRunning(false);
    buzz('done');
    say('Geschafft. Schön gemacht.', prefs.voice);
    save();
  };

  // first exercise announced once; speech stops when leaving
  useEffect(() => {
    prepareVoice();
    announce(0);
    return () => stopVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only at the start of the run
  }, []);

  // the countdown: compares with the end time (keeps exact when the phone is busy), next exercise at zero
  useEffect(() => {
    if (!running || finished) return;
    endsAt.current = Date.now() + remaining * 1000;
    const t = setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 10 && (durations[index] ?? 0) >= 25 && spokeTen.current !== index) {
        spokeTen.current = index;
        say('Noch zehn Sekunden.', prefs.voice);
      }
      if (left === 0) {
        clearInterval(t);
        if (index + 1 < routine.steps.length) goTo(index + 1);
        else finish();
      }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restarts only when pausing/resuming or the step changes
  }, [running, index, finished]);

  const togglePause = () => {
    if (running) stopVoice();
    setRunning((v) => !v);
  };

  const toggleMirror = async () => {
    if (!prefs.mirror && !camPerm?.granted) {
      const res = await requestCam();
      if (!res.granted) return;
    }
    update({ mirror: !prefs.mirror });
  };

  if (finished || checkIn.isPending || checkIn.isError) {
    return (
      <Screen contentStyle={{ paddingTop: insets.top + space.xxl * 2, alignItems: 'center', gap: space.l }}>
        {card.element}
        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="flame" size={64} color={p.accent} />
        </View>
        <Txt variant="display" style={{ textAlign: 'center' }}>Geschafft!</Txt>
        {finished ? (
          <Txt variant="title" style={{ textAlign: 'center' }}>{finished.streak === 1 ? 'Tag 1 deiner Serie' : `${finished.streak} Tage in Folge`}</Txt>
        ) : checkIn.isError ? (
          <View style={{ gap: space.m, alignItems: 'center' }}>
            <Txt color={p.danger} style={{ textAlign: 'center' }}>{errorText(checkIn.error)}</Txt>
            <Button label="Noch einmal speichern" onPress={save} />
          </View>
        ) : (
          <Txt muted>Wird gespeichert …</Txt>
        )}
        {earned.length > 0 ? (
          <View style={{ alignSelf: 'stretch', gap: space.s, padding: space.l, borderRadius: radius.l, backgroundColor: p.accentSoft }}>
            <Txt variant="caption" color={p.accent}>{earned.length === 1 ? 'Neues Abzeichen' : 'Neue Abzeichen'}</Txt>
            {earned.map((b) => (
              <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
                <Ionicons name={b.icon} size={24} color={p.accent} />
                <Txt variant="heading">{b.detail}</Txt>
              </View>
            ))}
          </View>
        ) : null}
        <Txt muted style={{ textAlign: 'center' }}>{routine.title} ist für heute erledigt. Bis morgen!</Txt>
        {finished && Platform.OS !== 'web' ? <Button label="Erfolg teilen" kind="secondary" onPress={() => void card.share()} style={{ alignSelf: 'stretch' }} /> : null}
        <Button label="Fertig" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
      </Screen>
    );
  }
  if (!step) return null;

  const dur = durations[index] ?? step.durationSec;
  const share = dur > 0 ? remaining / dur : 0;
  const time = (
    <View style={{ position: 'absolute', alignItems: 'center' }}>
      <Txt style={{ fontSize: mirror ? 30 : 56, lineHeight: mirror ? 36 : 64, fontWeight: '700', fontVariant: ['tabular-nums'] }} accessibilityLabel={`noch ${remaining} Sekunden`}>
        {clock(remaining)}
      </Txt>
      {!running ? <Txt variant="small" muted>Pausiert</Txt> : null}
    </View>
  );

  return (
    <Screen contentStyle={{ paddingTop: insets.top + space.m, gap: space.l }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Routine beenden" hitSlop={12} onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={p.text} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
          {routine.steps.map((s, i) => (
            <View key={s.id} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= index ? p.accent : p.surfaceAlt, opacity: i === index ? 0.6 : 1 }} />
          ))}
        </View>
        <Txt variant="small" muted>{index + 1}/{routine.steps.length}</Txt>
      </View>

      <View style={{ flexDirection: 'row', gap: space.s }}>
        <OptionChip icon={prefs.mirror ? 'scan' : 'scan-outline'} label="Spiegel" on={prefs.mirror} onPress={() => void toggleMirror()} />
        <OptionChip icon={prefs.voice ? 'volume-high' : 'volume-mute'} label="Ansage" on={prefs.voice} onPress={() => { if (prefs.voice) stopVoice(); update({ voice: !prefs.voice }); }} />
      </View>

      <View style={{ gap: space.xs }}>
        <Txt variant="caption" color={p.accent}>Übung {index + 1}</Txt>
        <Txt variant="display">{step.title}</Txt>
      </View>

      {mirror ? (
        <View style={{ aspectRatio: 3 / 4, maxHeight: 460, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#000' }}>
          <CameraView style={StyleSheet.absoluteFill} facing="front" mirror />
          <View style={{ position: 'absolute', right: space.m, bottom: space.m, width: 120, height: 120, borderRadius: 60, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', opacity: 0.92 }}>
            <Ring size={120} share={share} />
            {time}
          </View>
        </View>
      ) : (
        <View style={{ alignItems: 'center', justifyContent: 'center', marginVertical: space.m }}>
          <Ring size={240} share={share} />
          {time}
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
        <RoundButton icon="play-skip-back" label="Vorherige Übung" disabled={index === 0} onPress={() => goTo(index - 1)} />
        <RoundButton icon={running ? 'pause' : 'play'} label={running ? 'Pause' : 'Weiter'} big onPress={togglePause} />
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

function OptionChip({ icon, label, on, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; on: boolean; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.m, paddingVertical: space.s, borderRadius: 999, backgroundColor: on ? p.accentSoft : p.surfaceAlt }}
    >
      <Ionicons name={icon} size={18} color={on ? p.accent : p.textMuted} />
      <Txt variant="small" color={on ? p.accent : p.textMuted} style={{ fontWeight: '600' }}>{label}</Txt>
    </Pressable>
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
