// The protected video player of a lesson, with the phone's own player (expo-video). Like the website's player
// (ProtectedPlayer.tsx of the software): a stream token from POST …/play (address + resume position + watermark), the
// session as Bearer header on the stream, a new token after `renewAfterSec` while playing, progress every 15 s, on pause
// and at the end (completed). It pauses when the app goes to the background. The watermark moves over the picture; with
// a watermark the native fullscreen is off (it would hide the watermark). The frame takes the shape of the video as soon
// as it is loaded: a portrait (phone) video stands upright — at most 70 % of the screen height, centred — instead of a
// small picture between black bars.
// While the video has to wait for data it says so ("Internet langsam – Video lädt …" after a moment). A lesson video can be
// enlarged to the whole screen and back, also with a watermark (the watermark stays on the picture).
// "Neu laden" gets a new address and goes on at the same place (a stuck stream, or another device took over the stream).
// A lesson video starts by itself (`autoPlay`), pauses while another screen or tab is in front and goes on afterwards. Until
// its first picture is there the video's thumbnail stands in (`posterUrl`).
// Variant "coach" (routine, next to the mirror): fills the frame of its parent, starts at 0 and loops, plays exactly while
// `playing` is true (the countdown of the exercise), has buttons for "10 seconds back", "Neu laden" and sound instead of
// controls; the parent learns the video's shape (onAspect) and when it waits for data (onWaiting).
// A video stopped from outside (a call, the system's audio) goes on by itself. A picture that stands still although the video
// plays counts as waiting, and a stuck or failed video reloads by itself (at most twice per stall; never one that is only
// buffering, that would throw away what it has). With `file` (the video is on the phone, lib/exercise-videos.ts) it plays from there, whatever the
// connection does; the server only adds the watermark, and the parent may keep it mounted hidden with `playing` false: it is
// ready at once at its turn.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router';
import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorText } from '@/lib/api';
import { useApi } from '@/lib/session';
import { radius, space } from '@/lib/theme';
import type { PlayResponse, ProgressUpdate } from '@/lib/types';
import { Button, Txt } from './ui';

const PROGRESS_EVERY_MS = 15_000;

export interface LessonPlayerProps {
  /** POST path that returns a PlayResponse (lesson video or a video embedded in a lesson text). */
  playPath: string;
  /** PUT path for progress; none for embedded videos (they never count as watched). */
  progressPath?: string;
  /** Shape before the video is loaded (16:9); afterwards the video's own. */
  aspect?: number;
  onCompleted?: () => void;
  /** Starts as soon as it is loaded (the lesson's own video; not a video embedded in the text). */
  autoPlay?: boolean;
  /** Every second while the position changes: position and length in seconds. */
  onTime?: (positionSec: number, durationSec: number) => void;
  /** 'coach': fills the parent, no controls, loops from the start, follows `playing`. */
  variant?: 'lesson' | 'coach';
  /** coach: plays while true, pauses while false. */
  playing?: boolean;
  /** The real shape (width / height) once the video is loaded. */
  onAspect?: (aspect: number) => void;
  /** coach: true while the video waits for data (first load or slow internet). */
  onWaiting?: (waiting: boolean) => void;
  /** The video's thumbnail, shown until its first picture is there. */
  posterUrl?: string | null;
  /** The video as a file on the phone; read once, a player stays with its source (`key` for another one). */
  file?: string | null;
  /** The file does not play. */
  onFileFailed?: () => void;
  /** coach: a very small picture (no button, no text). */
  mini?: boolean;
  /** coach: without sound. */
  muted?: boolean;
  onToggleMuted?: () => void;
}

/** After this long without data the waiting indicator also says why. */
const SLOW_AFTER_MS = 2500;
/** coach: the picture stands still for this many seconds although it should play: it counts as waiting. */
const FROZEN_AFTER_SEC = 5;
/** coach: still waiting after this long: a new address by itself, at most AUTO_RELOADS times per stall. */
const AUTO_RELOAD_MS = 9000;
const AUTO_RELOADS = 2;

/** Jumps to a position. expo-video's player is an imperative native object: seeking is assigning `currentTime`. */
function seek(player: VideoPlayer, at: number): void {
  player.currentTime = at;
}

function setMuted(player: VideoPlayer, muted: boolean): void {
  player.muted = muted;
}

/** Development: what happened to the stream, in the log of the dev server (never the address: it carries the token). */
function logVideo(what: string, detail?: string): void {
  if (__DEV__) console.warn(`[Video] ${what}${detail ? `: ${detail.replace(/([?&]t=)[^&\s]+/g, '$1…')}` : ''}`);
}

export function LessonPlayer({
  playPath, progressPath, aspect = 16 / 9, onCompleted, autoPlay = false, onTime, variant = 'lesson', playing, onAspect, onWaiting, posterUrl, file, onFileFailed, mini = false, muted = false, onToggleMuted,
}: LessonPlayerProps) {
  const api = useApi();
  const coach = variant === 'coach';
  const [localFile] = useState(file ?? null);
  const fileFailed = useRef(onFileFailed);
  useEffect(() => {
    fileFailed.current = onFileFailed;
  }, [onFileFailed]);
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const player = useVideoPlayer(null, (p) => {
    p.loop = coach;
    // the small sounds of the routine play along instead of stopping the video
    if (coach) p.audioMixingMode = 'mixWithOthers';
    else p.timeUpdateEventInterval = 1;
  });
  // lesson: the whole screen (only one picture at a time: the player moves over)
  const [large, setLarge] = useState(false);
  // the source is attached (coach: only then `playing` can start it)
  const [loaded, setLoaded] = useState(false);
  const [play, setPlay] = useState<PlayResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [frozen, setFrozen] = useState(false);
  const [firstFrame, setFirstFrame] = useState(false);
  const alive = useRef(true);
  const reloading = useRef(false);
  const autoReloads = useRef(0);
  const savedAt = useRef(0);
  const completedSent = useRef(false);
  const resumeOnFocus = useRef(false);
  const autoStarted = useRef(false);
  const seen = useRef({ pos: 0, dur: 0 });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  // the real shape of the video (width / height), known once its track is loaded
  const [videoAspect, setVideoAspect] = useState<number | null>(null);
  const { width: screenW, height: screenH } = useWindowDimensions();
  const takeSize = (size: { width: number; height: number } | undefined) => {
    if (!size || size.width <= 0 || size.height <= 0) return;
    setVideoAspect(size.width / size.height);
  };
  useEventListener(player, 'sourceLoad', ({ availableVideoTracks }) => takeSize(availableVideoTracks[0]?.size));
  useEventListener(player, 'videoTrackChange', ({ videoTrack }) => takeSize(videoTrack?.size));
  useEventListener(player, 'statusChange', (e) => {
    if (e.status !== 'error') return;
    logVideo('Fehler', e.error?.message);
    if (localFile) fileFailed.current?.();
  });
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    seen.current = { pos: currentTime, dur: player.duration };
    onTime?.(currentTime, player.duration);
  });
  // also when the parent starts to listen later (a hidden video that becomes the visible one)
  useEffect(() => {
    if (videoAspect) onAspect?.(videoAspect);
  }, [onAspect, videoAspect]);

  const attach = useCallback(async (resp: PlayResponse, at: number, autoplay: boolean) => {
    await player.replaceAsync({ uri: api.url(resp.src), headers: api.mediaHeaders() });
    if (!alive.current) return;
    if (at > 0) seek(player, at);
    if (autoplay) player.play();
  }, [api, player]);

  /** A new token and address, at the same place (button "Neu laden", "Noch einmal", a stuck video). */
  const reload = useCallback(async (why: string) => {
    if (reloading.current) return;
    reloading.current = true;
    const at = player.currentTime;
    const wasPlaying = player.playing;
    logVideo('neu laden', `${why} bei ${Math.round(at)} s`);
    setLoaded(false);
    setError(null);
    setFrozen(false);
    try {
      if (localFile) {
        await player.replaceAsync({ uri: localFile });
        if (alive.current && at > 0) seek(player, at);
      } else {
        const resp = await api.post<PlayResponse>(playPath);
        if (!alive.current) return;
        setPlay(resp);
        // coach: `playing` starts it again as soon as it is loaded
        await attach(resp, at, !coach && wasPlaying);
      }
      if (alive.current) setLoaded(true);
    } catch (err) {
      logVideo('neu laden fehlgeschlagen', err instanceof Error ? err.message : undefined);
      if (alive.current) setError(err);
    } finally {
      reloading.current = false;
    }
  }, [api, attach, coach, localFile, playPath, player]);

  // first token
  useEffect(() => {
    alive.current = true;
    void (async () => {
      if (localFile) {
        // from the phone at once; the answer of the server only brings the watermark (without a connection: none)
        try {
          await player.replaceAsync({ uri: localFile });
          if (alive.current) setLoaded(true);
        } catch {
          if (alive.current) fileFailed.current?.();
          return;
        }
        try {
          const resp = await api.post<PlayResponse>(playPath);
          if (alive.current) setPlay(resp);
        } catch { /* see above */ }
        return;
      }
      try {
        const resp = await api.post<PlayResponse>(playPath);
        if (!alive.current) return;
        setPlay(resp);
        // coach: the exercise always from the start (not where the lesson was left)
        await attach(resp, coach ? 0 : resp.resumeAtSec, false);
        if (alive.current) setLoaded(true);
      } catch (err) {
        if (alive.current) setError(err);
      }
    })();
    return () => { alive.current = false; };
  }, [api, playPath, attach, coach, localFile, player]);

  // lesson: starts by itself as soon as there is something to play (once, and only with the lesson in front)
  useEffect(() => {
    if (!autoPlay || autoStarted.current || !loaded || status !== 'readyToPlay' || !focused) return;
    autoStarted.current = true;
    player.play();
  }, [autoPlay, focused, loaded, player, status]);

  // lesson: another screen or tab in front: pause, and go on when the lesson is back
  useEffect(() => {
    if (coach) return;
    if (!focused) {
      resumeOnFocus.current = player.playing;
      player.pause();
    } else if (resumeOnFocus.current) {
      resumeOnFocus.current = false;
      player.play();
    }
  }, [coach, focused, player]);

  // coach: the sound of the video
  useEffect(() => {
    if (coach) setMuted(player, muted);
  }, [coach, muted, player]);

  // coach: it should play: stopped from outside it goes on; a picture that stands still anyway counts as waiting (no status
  // tells that)
  useEffect(() => {
    if (!coach || !loaded || !playing || status !== 'readyToPlay') return;
    let last = player.currentTime;
    let still = 0;
    const t = setInterval(() => {
      if (!player.playing) player.play();
      const now = player.currentTime;
      still = Math.abs(now - last) < 0.05 ? still + 1 : 0;
      last = now;
      if (still === 0) autoReloads.current = 0;
      setFrozen(still >= FROZEN_AFTER_SEC);
    }, 1000);
    return () => {
      clearInterval(t);
      setFrozen(false);
    };
  }, [coach, loaded, playing, player, status]);

  // coach: plays exactly while the exercise runs
  useEffect(() => {
    if (!coach || !loaded) return;
    if (playing) player.play();
    else player.pause();
  }, [coach, loaded, playing, player]);

  // a new token after renewAfterSec while playing (the old one would expire mid-video); a file needs none
  useEffect(() => {
    if (!play || !isPlaying || localFile) return;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const at = player.currentTime;
          const resp = await api.post<PlayResponse>(playPath);
          if (!alive.current) return;
          setPlay(resp);
          await attach(resp, at, true);
        } catch { /* the error event of the player shows it */ }
      })();
    }, Math.max(30, play.renewAfterSec) * 1000);
    return () => clearTimeout(t);
  }, [api, attach, isPlaying, localFile, play, playPath, player]);

  const save = useCallback(async (completed = false) => {
    if (!progressPath) return;
    // leaving the lesson: the player may already be released, then the last position seen counts
    try {
      seen.current = { pos: player.currentTime, dur: player.duration };
    } catch { /* released */ }
    const { pos, dur } = seen.current;
    if (!Number.isFinite(dur) || dur <= 0) return;
    if (!completed && Math.abs(pos - savedAt.current) < 1) return;
    savedAt.current = pos;
    // the exact position: the server counts the watched seconds from these reports
    const body: ProgressUpdate = { positionSec: pos, durationSec: Math.round(dur), ...(completed ? { completed: true } : {}) };
    await api.put(progressPath, body).catch(() => undefined);
  }, [api, player, progressPath]);

  // progress while playing, on pause
  useEffect(() => {
    if (!isPlaying) {
      void save();
      return;
    }
    const id = setInterval(() => void save(), PROGRESS_EVERY_MS);
    return () => clearInterval(id);
  }, [isPlaying, save]);

  useEventListener(player, 'playToEnd', () => {
    if (completedSent.current) return;
    completedSent.current = true;
    // the report first: the parent asks the server afterwards what counts now
    void save(true).then(() => onCompleted?.());
  });

  // background: pause (and save)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' && player.playing) player.pause();
    });
    return () => sub.remove();
  }, [player]);

  // last position when leaving the lesson
  useEffect(() => () => void save(), [save]);

  // waiting for data: says so, after a moment also why
  const failed = !!error || status === 'error';
  const waiting = !failed && (!loaded || status === 'loading' || frozen);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => {
      clearTimeout(t);
      setSlow(false);
    };
  }, [waiting]);
  useEffect(() => {
    onWaiting?.(waiting);
  }, [onWaiting, waiting]);
  // coach: standing still for a while or failed (e.g. the address ran out), while it should play: a new address by itself. A
  // video that is only loading or buffering is left alone.
  const stuck = coach && !!playing && (frozen || failed);
  useEffect(() => {
    if (!stuck || autoReloads.current >= AUTO_RELOADS) return;
    const t = setTimeout(() => {
      autoReloads.current += 1;
      void reload(`hängt (Versuch ${autoReloads.current})`);
    }, failed ? 0 : AUTO_RELOAD_MS);
    return () => clearTimeout(t);
  }, [failed, loaded, reload, stuck]);

  const toggleLarge = () => {
    const wasPlaying = player.playing;
    setLarge((v) => !v);
    if (wasPlaying) setTimeout(() => player.play(), 0);
  };

  const wm = play?.watermark;
  const showPoster = !!posterUrl && !firstFrame && !isPlaying && !failed;
  const waitingView = waiting ? (
    <View style={[StyleSheet.absoluteFill, styles.center, { gap: space.s, padding: space.s, backgroundColor: slow ? 'rgba(0,0,0,0.45)' : 'transparent' }]} pointerEvents="box-none">
      <ActivityIndicator color="#FFFFFF" />
      {slow && !mini ? <Text style={styles.slow} accessibilityLiveRegion="polite">{localFile ? 'Video lädt …' : 'Internet langsam – Video lädt …'}</Text> : null}
      {slow && !mini ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => void reload('Knopf')} style={styles.reload}>
          <Ionicons name="refresh" size={16} color="#FFFFFF" />
          <Text style={styles.reloadText}>Neu laden</Text>
        </Pressable>
      ) : null}
    </View>
  ) : null;
  return (
    <View style={coach ? [StyleSheet.absoluteFill, { backgroundColor: '#000000' }] : [styles.frame, frameStyle(videoAspect ?? aspect, screenW, screenH), { borderRadius: radius.l }]}>
      {large ? null : (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          nativeControls={!coach}
          contentFit="contain"
          // Android: a hidden video (loading ahead) really stays invisible only on a texture
          surfaceType={coach ? 'textureView' : undefined}
          fullscreenOptions={{ enable: !wm?.enabled }}
          allowsPictureInPicture={false}
          onFirstFrameRender={() => setFirstFrame(true)}
        />
      )}
      {showPoster && posterUrl ? (
        <Image
          pointerEvents="none"
          source={{ uri: api.url(posterUrl), headers: api.mediaHeaders() }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}
      {wm?.enabled && wm.text ? <Watermark text={wm.text} opacity={wm.opacityPct / 100} intervalSec={wm.intervalSec} /> : null}
      {waitingView}
      {coach && !mini && !failed ? (
        <View style={{ position: 'absolute', left: space.s, bottom: space.s, flexDirection: 'row', gap: space.xs }}>
          <RoundIcon icon="play-back" label="10 Sekunden zurück" onPress={() => player.seekBy(-10)} />
          <RoundIcon icon="refresh" label="Video neu laden" onPress={() => void reload('Knopf')} />
          {onToggleMuted ? <RoundIcon icon={muted ? 'volume-mute' : 'volume-high'} label={muted ? 'Video-Ton einschalten' : 'Video stumm schalten'} onPress={onToggleMuted} /> : null}
        </View>
      ) : null}
      {!coach && !failed ? (
        <RoundIcon icon="expand" label="Video vergrößern" onPress={toggleLarge} style={{ position: 'absolute', right: space.s, top: space.s }} />
      ) : null}
      {!coach ? (
        <Modal visible={large} animationType="fade" onRequestClose={toggleLarge} statusBarTranslucent>
          <View style={{ flex: 1, backgroundColor: '#000000' }}>
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              nativeControls
              contentFit="contain"
              fullscreenOptions={{ enable: false }}
              allowsPictureInPicture={false}
            />
            {wm?.enabled && wm.text ? <Watermark text={wm.text} opacity={wm.opacityPct / 100} intervalSec={wm.intervalSec} /> : null}
            {waitingView}
            <RoundIcon icon="contract" label="Video verkleinern" onPress={toggleLarge} style={{ position: 'absolute', right: space.l, top: insets.top + space.s }} />
          </View>
        </Modal>
      ) : null}
      {failed ? (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: 'rgba(0,0,0,0.75)', padding: coach ? space.s : space.l, gap: space.m }]}>
          <Txt color="#FFFFFF" variant={coach ? 'small' : 'body'} style={{ textAlign: 'center' }}>{error ? errorText(error) : 'Das Video konnte nicht geladen werden.'}</Txt>
          <Button label="Noch einmal" kind="secondary" onPress={() => void reload('Noch einmal')} />
        </View>
      ) : null}
    </View>
  );
}

/** Landscape: full width. Portrait: upright, at most 70 % of the screen high and never wider than the page, centred. */
function frameStyle(aspect: number, screenW: number, screenH: number) {
  if (aspect >= 1) return { width: '100%' as const, aspectRatio: aspect };
  const pageW = screenW - 2 * space.l;
  const height = Math.round(Math.min(screenH * 0.7, pageW / aspect));
  return { height, width: Math.round(height * aspect), alignSelf: 'center' as const };
}

/** A small round button on the picture. */
function RoundIcon({ icon, label, onPress, style }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; style?: object }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} style={[styles.round, style]}>
      <Ionicons name={icon} size={18} color="#FFFFFF" />
    </Pressable>
  );
}

/** The member's name/e-mail, moved to another corner every `intervalSec` (like on the website). */
function Watermark({ text, opacity, intervalSec }: { text: string; opacity: number; intervalSec: number }) {
  const [pos, setPos] = useState({ top: '12%', left: '8%' });
  useEffect(() => {
    const id = setInterval(() => {
      setPos({ top: `${8 + Math.round(Math.random() * 70)}%`, left: `${4 + Math.round(Math.random() * 50)}%` });
    }, Math.max(5, intervalSec) * 1000);
    return () => clearInterval(id);
  }, [intervalSec]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill]}>
      <Text style={{ position: 'absolute', top: pos.top as `${number}%`, left: pos.left as `${number}%`, color: '#FFFFFF', opacity, fontSize: 13, fontWeight: '600', textShadowColor: '#000', textShadowRadius: 3 }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { maxWidth: '100%', backgroundColor: '#000000', overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  slow: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  reload: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: space.m, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.65)' },
  reloadText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  round: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
});
