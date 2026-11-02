// Doing the routine. First a START screen: what is coming, how long (Kurz / Normal / Lang), mirror, video and sound on or
// off, "Los geht's" — then 3-2-1 and one exercise after the other with a countdown, pause / skip / back, a soft vibration
// and a small sound at every change (no voice: owner 02.11.2026), the screen stays on. What comes next is written below.
// With mirror and video on both stand side by side in the same size (a landscape video above the mirror) and the countdown
// sits on the seam; each picture can be enlarged (the other one becomes a small picture in the corner) and made small
// again. The video loops from the start and pauses with the countdown; while it waits for data (slow internet) it says so
// and the countdown waits too, at most HOLD_MAX_MS, so a bad connection never blocks the routine. After the last exercise
// the day is marked done, the streak and new badges are shown, and the success can be shared.
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LessonPlayer } from '@/components/player';
import { LengthPicker, ProgressRing, routineSeconds } from '@/components/routine-parts';
import { useShareCard } from '@/components/share-card';
import { Button, ErrorView, Loading, Screen, Txt } from '@/components/ui';
import { errorText } from '@/lib/api';
import { clock, minutes, plural } from '@/lib/format';
import { useDayChecks } from '@/lib/goal';
import {
  cancelTodaysRescue, newBadges, scaledDuration, useCheckIn, useRoutinePrefs, useRoutines, type Badge, type MemberRoutine, type RoutineStats,
} from '@/lib/routine';
import { playTone, prepareTones } from '@/lib/sounds';
import { radius, space, usePalette } from '@/lib/theme';

/** Shape of an exercise video until it is loaded (most are filmed upright on a phone). */
const PORTRAIT = 9 / 16;
const MIRROR = 3 / 4;
/** The countdown waits for a slow video at most this long per wait. */
const HOLD_MAX_MS = 20_000;
const BADGE = 92;
const PIP_W = 96;

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

// ---------- where the pictures stand ----------

interface Rect { left: number; top: number; width: number; height: number }
type Focus = 'both' | 'video' | 'mirror';

/** The picture in its own shape, centred, as large as the page and `maxShare` of the screen allow. */
function fitted(width: number, screenH: number, aspect: number, maxShare: number): Rect {
  const height = Math.round(Math.min(width / aspect, screenH * maxShare));
  const w = Math.round(Math.min(width, height * aspect));
  return { left: Math.round((width - w) / 2), top: 0, width: w, height };
}

/** The small picture in the bottom right corner of the large one. */
function inCorner(large: Rect, aspect: number): Rect {
  const height = Math.round(Math.min(PIP_W / aspect, large.height * 0.45));
  const width = Math.round(height * aspect);
  return { left: large.left + large.width - width - space.s, top: large.height - height - space.s, width, height };
}

/** One layout for every combination, so that switching only moves the pictures (neither of them starts again). */
function stageLayout(o: { width: number; screenH: number; videoAspect: number; video: boolean; mirror: boolean; focus: Focus }): {
  height: number; video: Rect | null; mirror: Rect | null; pip: 'video' | 'mirror' | null;
} {
  const { width, screenH, videoAspect, video, mirror, focus } = o;
  if (video && mirror) {
    if (focus === 'video') {
      const large = fitted(width, screenH, videoAspect, 0.7);
      return { height: large.height, video: large, mirror: inCorner(large, MIRROR), pip: 'mirror' };
    }
    if (focus === 'mirror') {
      const large = fitted(width, screenH, MIRROR, 0.7);
      return { height: large.height, mirror: large, video: inCorner(large, videoAspect), pip: 'video' };
    }
    if (videoAspect < 1) {
      const w = Math.floor((width - space.s) / 2);
      const h = Math.round(Math.min(w / videoAspect, screenH * 0.56));
      return { height: h, video: { left: 0, top: 0, width: w, height: h }, mirror: { left: width - w, top: 0, width: w, height: h }, pip: null };
    }
    const vh = Math.round(width / videoAspect);
    const mh = Math.round(Math.min(width * 0.75, screenH * 0.34));
    return { height: vh + space.s + mh, video: { left: 0, top: 0, width, height: vh }, mirror: { left: 0, top: vh + space.s, width, height: mh }, pip: null };
  }
  const single = fitted(width, screenH, video ? videoAspect : MIRROR, focus === 'both' ? 0.58 : 0.76);
  return { height: single.height, video: video ? single : null, mirror: mirror ? single : null, pip: null };
}

function Pane({ rect, label, pip, expanded, onExpand, children }: {
  rect: Rect; label: string; pip: boolean; expanded: boolean; onExpand: () => void; children: ReactNode;
}) {
  return (
    <View style={{ position: 'absolute', ...rect, borderRadius: pip ? radius.m : radius.xl, overflow: 'hidden', backgroundColor: '#000000', zIndex: pip ? 2 : 1, borderWidth: pip ? 2 : 0, borderColor: '#FFFFFF' }}>
      {children}
      {pip ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${label} groß anzeigen`} onPress={onExpand} style={StyleSheet.absoluteFill} />
      ) : (
        <>
          <View pointerEvents="none" style={{ position: 'absolute', top: space.s, left: space.s, paddingHorizontal: space.s, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <Txt variant="small" color="#FFFFFF" style={{ fontWeight: '700', fontSize: 12, lineHeight: 16 }}>{label}</Txt>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label} ${expanded ? 'verkleinern' : 'vergrößern'}`}
            hitSlop={8}
            onPress={onExpand}
            style={{ position: 'absolute', top: space.s, right: space.s, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' }}
          >
            <Ionicons name={expanded ? 'contract' : 'expand'} size={18} color="#FFFFFF" />
          </Pressable>
        </>
      )}
    </View>
  );
}

// ---------- the run ----------

function Session({ routine }: { routine: MemberRoutine }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const checkIn = useCheckIn(routine.id);
  const checks = useDayChecks(routine.id);
  const [prefs, update] = useRoutinePrefs();
  const [camPerm, requestCam] = useCameraPermissions();
  const [phase, setPhase] = useState<'ready' | 'count' | 'run'>('ready');
  const [count, setCount] = useState(3);
  // the durations of this run (fixed at "Los geht's"; changing the length later does not disturb the run)
  const [durations, setDurations] = useState<number[]>([]);
  const [statsBefore] = useState(() => routine.stats);
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [focus, setFocus] = useState<Focus>('both');
  const [videoAspect, setVideoAspect] = useState(PORTRAIT);
  const [waiting, setWaiting] = useState(false);
  const [holdOver, setHoldOver] = useState(false);
  const [finished, setFinished] = useState<RoutineStats | null>(null);
  const [earned, setEarned] = useState<Badge[]>([]);
  // end time of the running countdown (set when it starts or resumes)
  const endsAt = useRef(0);
  const lastTick = useRef('');
  const step = routine.steps[index];
  const mirror = prefs.mirror && !!camPerm?.granted && Platform.OS !== 'web';
  const video = !!(step?.videoId && step.videoAvailable) && prefs.video;
  // the countdown waits while the video waits for data (at most HOLD_MAX_MS)
  const held = video && waiting && !holdOver;
  const ticking = phase === 'run' && running && !held && !finished;
  const card = useShareCard(finished ? { big: String(finished.streak), label: finished.streak === 1 ? 'Tag in Folge' : 'Tage in Folge', line: routine.title } : null);

  const onWaiting = useCallback((w: boolean) => {
    setWaiting(w);
    if (!w) setHoldOver(false);
  }, []);

  useEffect(() => {
    prepareTones();
  }, []);

  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(() => setHoldOver(true), HOLD_MAX_MS);
    return () => clearTimeout(t);
  }, [waiting]);

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
    setHoldOver(false);
    buzz('step');
    playTone('step', prefs.sound);
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
    playTone('done', prefs.sound);
    save();
  };

  const begin = () => {
    const list = routine.steps.map((s) => scaledDuration(s.durationSec, prefs.length));
    setDurations(list);
    setRemaining(list[0] ?? 0);
    setCount(3);
    setPhase('count');
    playTone('tick', prefs.sound);
  };

  // 3-2-1: the first video is already loading meanwhile
  useEffect(() => {
    if (phase !== 'count') return;
    const t = setInterval(() => {
      setCount((c) => {
        if (c > 1) {
          playTone('tick', prefs.sound);
          return c - 1;
        }
        clearInterval(t);
        setPhase('run');
        setRunning(true);
        buzz('step');
        playTone('step', prefs.sound);
        return c;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per countdown
  }, [phase]);

  // the countdown: compares with the end time (keeps exact when the phone is busy), next exercise at zero
  useEffect(() => {
    if (!ticking) return;
    endsAt.current = Date.now() + remaining * 1000;
    const t = setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt.current - Date.now()) / 1000));
      setRemaining(left);
      const mark = `${index}:${left}`;
      if (left > 0 && left <= 3 && lastTick.current !== mark) {
        lastTick.current = mark;
        playTone('tick', prefs.sound);
      }
      if (left === 0) {
        clearInterval(t);
        if (index + 1 < routine.steps.length) goTo(index + 1);
        else finish();
      }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restarts only when pausing/resuming or the step changes
  }, [ticking, index]);

  const toggleMirror = async () => {
    if (!prefs.mirror && !camPerm?.granted) {
      const res = await requestCam();
      if (!res.granted) return;
    }
    update({ mirror: !prefs.mirror });
  };

  const chips = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
      <OptionChip icon={prefs.mirror ? 'scan' : 'scan-outline'} label="Spiegel" on={prefs.mirror} onPress={() => void toggleMirror()} />
      {routine.steps.some((x) => x.videoId && x.videoAvailable) ? (
        <>
          <OptionChip icon={prefs.video ? 'videocam' : 'videocam-outline'} label="Video" on={prefs.video} onPress={() => update({ video: !prefs.video })} />
          <OptionChip icon={prefs.videoMuted ? 'volume-mute' : 'volume-high'} label="Video-Ton" on={!prefs.videoMuted} onPress={() => update({ videoMuted: !prefs.videoMuted })} />
        </>
      ) : null}
      <OptionChip icon={prefs.sound ? 'musical-note' : 'notifications-off-outline'} label="Signaltöne" on={prefs.sound} onPress={() => update({ sound: !prefs.sound })} />
    </View>
  );

  // ---------- start screen ----------
  if (phase === 'ready') {
    const totalFor = (l: typeof prefs.length) => routineSeconds(routine, l);
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <Screen contentStyle={{ paddingTop: insets.top + space.m, gap: space.xl, paddingBottom: 120 + insets.bottom }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Zurück zur Übersicht" hitSlop={12} onPress={() => router.back()} style={{ alignSelf: 'flex-start' }}>
            <Ionicons name="close" size={28} color={p.text} />
          </Pressable>
          <View style={{ gap: space.xs }}>
            <Txt variant="caption" color={p.accent}>{routine.stats.doneToday ? 'Heute schon erledigt – gern noch einmal' : 'Deine Routine heute'}</Txt>
            <Txt variant="display">{routine.title}</Txt>
            <Txt muted>{plural(routine.steps.length, 'Übung', 'Übungen')} · {minutes(totalFor(prefs.length))}</Txt>
            {routine.description ? <Txt muted style={{ marginTop: space.xs }}>{routine.description}</Txt> : null}
          </View>

          <View style={{ gap: space.s }}>
            <Txt variant="heading">Wie lange heute?</Txt>
            <LengthPicker value={prefs.length} onChange={(length) => update({ length })} totalFor={totalFor} />
          </View>

          <View style={{ gap: space.s }}>
            <Txt variant="heading">So machst du mit</Txt>
            {chips}
            <Txt variant="small" muted>
              {prefs.mirror ? 'Stell dein Handy so hin, dass du dich siehst und beide Hände frei hast.' : 'Mit dem Spiegel siehst du dich selbst neben dem Video.'}
            </Txt>
          </View>

          <View style={{ gap: space.s }}>
            <Txt variant="heading">Das erwartet dich</Txt>
            <View style={{ borderRadius: radius.l, backgroundColor: p.surface, overflow: 'hidden' }}>
              {routine.steps.map((s, i) => (
                <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: p.line }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Txt variant="small" color={p.accent} style={{ fontWeight: '700' }}>{i + 1}</Txt>
                  </View>
                  <Txt style={{ flex: 1 }} numberOfLines={2}>{s.title}</Txt>
                  {s.videoId && s.videoAvailable ? <Ionicons name="videocam-outline" size={16} color={p.textMuted} accessibilityLabel="mit Video" /> : null}
                  <Txt variant="small" muted style={{ fontVariant: ['tabular-nums'] }}>{clock(scaledDuration(s.durationSec, prefs.length))}</Txt>
                </View>
              ))}
            </View>
          </View>
        </Screen>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.l, paddingTop: space.m, paddingBottom: insets.bottom + space.m, backgroundColor: p.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.line }}>
          <Button label="Los geht’s" onPress={begin} />
        </View>
      </View>
    );
  }

  // ---------- done ----------
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

  // ---------- one exercise ----------
  const dur = durations[index] ?? step.durationSec;
  const share = dur > 0 ? remaining / dur : 0;
  const next = routine.steps[index + 1];
  const status = phase === 'run' && !running ? 'Pausiert' : held ? 'Video lädt' : null;
  const time = (big: boolean) => (
    <View style={{ alignItems: 'center' }}>
      <Txt style={{ fontSize: big ? 56 : 24, lineHeight: big ? 64 : 28, fontWeight: '700', fontVariant: ['tabular-nums'] }} accessibilityLabel={`noch ${remaining} Sekunden`}>
        {clock(remaining)}
      </Txt>
      {status ? <Txt variant="small" muted style={{ fontSize: big ? 14 : 10, lineHeight: big ? 18 : 12 }}>{status}</Txt> : null}
    </View>
  );
  /** The countdown as a small round badge (on the picture or on the seam between video and mirror). */
  const badge = (size: number, style: ViewStyle) => (
    <View style={[{ position: 'absolute', zIndex: 3, width: size, height: size, borderRadius: size / 2, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }, style]}>
      <ProgressRing size={size} share={share} stroke={8}>{time(false)}</ProgressRing>
    </View>
  );

  const width = screenW - 2 * space.l;
  const layout = stageLayout({ width, screenH, videoAspect, video, mirror, focus });
  const both = video && mirror;
  const toggle = (kind: 'video' | 'mirror') => setFocus((f) => (f === kind ? 'both' : kind));
  const stage = video || mirror ? (
    <View style={{ width, height: layout.height, marginBottom: both ? BADGE / 2 - space.s : 0 }}>
      {layout.video ? (
        <Pane key="video" rect={layout.video} label="Vormachen" pip={layout.pip === 'video'} expanded={focus === 'video'} onExpand={() => toggle('video')}>
          <LessonPlayer
            key={step.id}
            variant="coach"
            mini={layout.pip === 'video'}
            playing={phase === 'run' && running}
            onAspect={setVideoAspect}
            onWaiting={onWaiting}
            muted={prefs.videoMuted}
            onToggleMuted={() => update({ videoMuted: !prefs.videoMuted })}
            playPath={`/api/member/videos/${encodeURIComponent(step.videoId ?? '')}/play`}
          />
        </Pane>
      ) : null}
      {layout.mirror ? (
        <Pane key="mirror" rect={layout.mirror} label="Du" pip={layout.pip === 'mirror'} expanded={focus === 'mirror'} onExpand={() => toggle('mirror')}>
          <CameraView style={StyleSheet.absoluteFill} facing="front" mirror />
        </Pane>
      ) : null}
      {both
        ? badge(BADGE, { left: (width - BADGE) / 2, bottom: -BADGE / 2 })
        : badge(BADGE, { right: (layout.video ?? layout.mirror)?.left ? ((layout.video ?? layout.mirror) as Rect).left + space.s : space.s, bottom: space.s, opacity: 0.94 })}
    </View>
  ) : (
    <View style={{ alignItems: 'center', justifyContent: 'center', marginVertical: space.m }}>
      <ProgressRing size={240} share={share}>{time(true)}</ProgressRing>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
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

        {chips}

        <View style={{ gap: space.xs }}>
          <Txt variant="caption" color={p.accent}>Übung {index + 1}</Txt>
          <Txt variant={both ? 'title' : 'display'}>{step.title}</Txt>
        </View>

        {stage}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
          <RoundButton icon="play-skip-back" label="Vorherige Übung" disabled={index === 0} onPress={() => goTo(index - 1)} />
          <RoundButton icon={running ? 'pause' : 'play'} label={running ? 'Pause' : 'Weiter'} big onPress={() => setRunning((v) => !v)} />
          <RoundButton icon="play-skip-forward" label="Nächste Übung" onPress={() => (index + 1 < routine.steps.length ? goTo(index + 1) : finish())} />
        </View>

        {next ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, justifyContent: 'center' }}>
            <Txt variant="small" muted>Danach:</Txt>
            <Txt variant="small" style={{ fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>{next.title}</Txt>
          </View>
        ) : (
          <Txt variant="small" muted style={{ textAlign: 'center' }}>Letzte Übung</Txt>
        )}

        {step.description ? <Txt>{step.description}</Txt> : null}
      </Screen>

      {phase === 'count' ? (
        <View accessibilityLiveRegion="assertive" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: p.bg, gap: space.m }]}>
          <Txt variant="caption" color={p.accent}>{step.title}</Txt>
          <Txt style={{ fontSize: 120, lineHeight: 132, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{count}</Txt>
          <Txt muted>Mach dich bereit</Txt>
        </View>
      ) : null}
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
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.m, paddingVertical: space.s, minHeight: 40, borderRadius: 999, backgroundColor: on ? p.accentSoft : p.surfaceAlt }}
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
