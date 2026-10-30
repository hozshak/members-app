// Doing the routine: one exercise after the other with a countdown, pause / skip / back, a soft vibration at every
// change, the screen stays on. Options of the member (kept on the phone): the front camera as a MIRROR, the exercise
// VIDEO, VOICE guidance ("Als Nächstes: Wangen lockern", "Noch zehn Sekunden") and the LENGTH chosen on the overview
// (durations scaled). With mirror and video on (owner 30.10.2026: "das Video neben meinen Spiegel, damit ich beide
// sehe") both stand side by side in the same size — a portrait video left, the mirror right; a landscape video above
// the mirror — and the countdown sits on the seam. The video loops from the start and pauses with the countdown.
// After the last exercise the day is marked done, the streak and new badges are shown, and the success can be shared.
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
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
import { say, spokenDuration, stopVoice } from '@/lib/voice';

const STROKE = 12;
/** Shape of an exercise video until it is loaded (most are filmed upright on a phone). */
const PORTRAIT = 9 / 16;

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

function Ring({ size, share, stroke = STROKE }: { size: number; share: number; stroke?: number }) {
  const p = usePalette();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={p.surfaceAlt} strokeWidth={stroke} fill="none" opacity={0.9} />
      <Circle
        cx={size / 2} cy={size / 2} r={r} stroke={p.accent} strokeWidth={stroke} fill="none" strokeLinecap="round"
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
  // shape of the current exercise video (width / height), reported by the player
  const [videoAspect, setVideoAspect] = useState(PORTRAIT);
  const { width: screenW, height: screenH } = useWindowDimensions();
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
    setVideoAspect(PORTRAIT);
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
  const anyVideo = routine.steps.some((x) => x.videoId && x.videoAvailable);
  const video = !!(step.videoId && step.videoAvailable) && prefs.video;
  const contentW = screenW - 2 * space.l;
  const time = (big: boolean) => (
    <View style={{ position: 'absolute', alignItems: 'center' }}>
      <Txt style={{ fontSize: big ? 56 : 24, lineHeight: big ? 64 : 28, fontWeight: '700', fontVariant: ['tabular-nums'] }} accessibilityLabel={`noch ${remaining} Sekunden`}>
        {clock(remaining)}
      </Txt>
      {!running ? <Txt variant="small" muted style={{ fontSize: big ? 14 : 11 }}>Pausiert</Txt> : null}
    </View>
  );
  /** The countdown as a small round badge (on the picture or on the seam between video and mirror). */
  const badge = (size: number, style: ViewStyle) => (
    <View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Ring size={size} share={share} stroke={8} />
      {time(false)}
    </View>
  );
  const videoPane = (
    <LessonPlayer
      key={step.id}
      variant="coach"
      playing={running}
      onAspect={setVideoAspect}
      playPath={`/api/member/videos/${encodeURIComponent(step.videoId ?? '')}/play`}
    />
  );
  const mirrorPane = <CameraView style={StyleSheet.absoluteFill} facing="front" mirror />;

  let stage: ReactNode;
  if (video && mirror) {
    const BADGE = 92;
    if (videoAspect < 1) {
      // portrait video: two equal panes side by side
      const paneW = Math.floor((contentW - space.s) / 2);
      const paneH = Math.round(Math.min(paneW / videoAspect, screenH * 0.56));
      stage = (
        <View style={{ marginBottom: BADGE / 2 - space.s }}>
          <View style={{ flexDirection: 'row', gap: space.s }}>
            <Pane label="Vormachen" width={paneW} height={paneH}>{videoPane}</Pane>
            <Pane label="Du" width={paneW} height={paneH}>{mirrorPane}</Pane>
          </View>
          {badge(BADGE, { left: (contentW - BADGE) / 2, bottom: -BADGE / 2 })}
        </View>
      );
    } else {
      // landscape video: video above, the mirror below
      const videoH = Math.round(contentW / videoAspect);
      const mirrorH = Math.round(Math.min(contentW * 0.75, screenH * 0.34));
      stage = (
        <View style={{ gap: space.s, marginBottom: BADGE / 2 - space.s }}>
          <Pane label="Vormachen" width={contentW} height={videoH}>{videoPane}</Pane>
          <Pane label="Du" width={contentW} height={mirrorH}>{mirrorPane}</Pane>
          {badge(BADGE, { left: (contentW - BADGE) / 2, bottom: -BADGE / 2 })}
        </View>
      );
    }
  } else if (video || mirror) {
    // one picture: the video in its own shape, or the mirror (3:4); the countdown in the corner
    const a = video ? videoAspect : 3 / 4;
    const h = Math.round(Math.min(contentW / a, screenH * 0.58));
    const w = Math.round(Math.min(contentW, h * a));
    stage = (
      <View style={{ alignSelf: 'center' }}>
        <Pane label={video ? 'Vormachen' : 'Du'} width={w} height={h}>
          {video ? videoPane : mirrorPane}
          {badge(104, { right: space.m, bottom: space.m, opacity: 0.94 })}
        </Pane>
      </View>
    );
  } else {
    stage = (
      <View style={{ alignItems: 'center', justifyContent: 'center', marginVertical: space.m }}>
        <Ring size={240} share={share} />
        {time(true)}
      </View>
    );
  }

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

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        <OptionChip icon={prefs.mirror ? 'scan' : 'scan-outline'} label="Spiegel" on={prefs.mirror} onPress={() => void toggleMirror()} />
        {anyVideo ? <OptionChip icon={prefs.video ? 'videocam' : 'videocam-outline'} label="Video" on={prefs.video} onPress={() => update({ video: !prefs.video })} /> : null}
        <OptionChip icon={prefs.voice ? 'volume-high' : 'volume-mute'} label="Ansage" on={prefs.voice} onPress={() => { if (prefs.voice) stopVoice(); update({ voice: !prefs.voice }); }} />
      </View>

      <View style={{ gap: space.xs }}>
        <Txt variant="caption" color={p.accent}>Übung {index + 1}</Txt>
        <Txt variant={video && mirror ? 'title' : 'display'}>{step.title}</Txt>
      </View>

      {stage}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
        <RoundButton icon="play-skip-back" label="Vorherige Übung" disabled={index === 0} onPress={() => goTo(index - 1)} />
        <RoundButton icon={running ? 'pause' : 'play'} label={running ? 'Pause' : 'Weiter'} big onPress={togglePause} />
        <RoundButton icon="play-skip-forward" label="Nächste Übung" onPress={() => (index + 1 < routine.steps.length ? goTo(index + 1) : finish())} />
      </View>

      {step.description ? <Txt style={{ marginTop: space.s }}>{step.description}</Txt> : null}

      {step.videoId && step.videoAvailable && !prefs.video ? (
        <Button label={`Video einblenden${step.videoTitle ? `: ${step.videoTitle}` : ''}`} kind="secondary" onPress={() => update({ video: true })} />
      ) : null}
      {video && !mirror && Platform.OS !== 'web' ? (
        <Button label="Spiegel daneben einschalten" kind="ghost" onPress={() => void toggleMirror()} />
      ) : null}
    </Screen>
  );
}

/** One picture of the stage (video or mirror) with a small label in the corner. */
function Pane({ label, width, height, children }: { label: string; width: number; height: number; children: ReactNode }) {
  return (
    <View style={{ width, height, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#000000' }}>
      {children}
      <View pointerEvents="none" style={{ position: 'absolute', top: space.s, left: space.s, paddingHorizontal: space.s, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <Txt variant="small" color="#FFFFFF" style={{ fontWeight: '700', fontSize: 12, lineHeight: 16 }}>{label}</Txt>
      </View>
    </View>
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
