// The protected video player of a lesson, with the phone's own player (expo-video). Like the website's player
// (ProtectedPlayer.tsx of the software): a stream token from POST …/play (address + resume position + watermark), the
// session as Bearer header on the stream, a new token after `renewAfterSec` while playing, progress every 15 s, on pause
// and at the end (completed). It pauses when the app goes to the background. The watermark moves over the picture; with
// a watermark the native fullscreen is off (it would hide the watermark). The frame takes the shape of the video as soon
// as it is loaded: a portrait (phone) video stands upright — at most 70 % of the screen height, centred — instead of a
// small picture between black bars.
// Variant "coach" (routine, next to the mirror): fills the frame of its parent, no controls, starts at 0 and loops, and
// plays exactly while `playing` is true (the countdown of the exercise); the parent learns the video's shape (onAspect).
import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
  /** 'coach': fills the parent, no controls, loops from the start, follows `playing`. */
  variant?: 'lesson' | 'coach';
  /** coach: plays while true, pauses while false. */
  playing?: boolean;
  /** The real shape (width / height) once the video is loaded. */
  onAspect?: (aspect: number) => void;
}

/** Jumps to a position. expo-video's player is an imperative native object: seeking is assigning `currentTime`. */
function seek(player: VideoPlayer, at: number): void {
  player.currentTime = at;
}

export function LessonPlayer({ playPath, progressPath, aspect = 16 / 9, onCompleted, variant = 'lesson', playing, onAspect }: LessonPlayerProps) {
  const api = useApi();
  const coach = variant === 'coach';
  const player = useVideoPlayer(null, (p) => { p.loop = coach; });
  // the source is attached (coach: only then `playing` can start it)
  const [loaded, setLoaded] = useState(false);
  const [play, setPlay] = useState<PlayResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const alive = useRef(true);
  const savedAt = useRef(0);
  const completedSent = useRef(false);
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  // the real shape of the video (width / height), known once its track is loaded
  const [videoAspect, setVideoAspect] = useState<number | null>(null);
  const { width: screenW, height: screenH } = useWindowDimensions();
  const takeSize = (size: { width: number; height: number } | undefined) => {
    if (!size || size.width <= 0 || size.height <= 0) return;
    setVideoAspect(size.width / size.height);
    onAspect?.(size.width / size.height);
  };
  useEventListener(player, 'sourceLoad', ({ availableVideoTracks }) => takeSize(availableVideoTracks[0]?.size));
  useEventListener(player, 'videoTrackChange', ({ videoTrack }) => takeSize(videoTrack?.size));

  const attach = useCallback(async (resp: PlayResponse, at: number, autoplay: boolean) => {
    await player.replaceAsync({ uri: api.url(resp.src), headers: api.mediaHeaders() });
    if (!alive.current) return;
    if (at > 0) seek(player, at);
    if (autoplay) player.play();
  }, [api, player]);

  // first token (and again after "Noch einmal", which also clears the error)
  useEffect(() => {
    alive.current = true;
    void (async () => {
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
  }, [api, playPath, attach, attempt, coach]);

  // coach: plays exactly while the exercise runs
  useEffect(() => {
    if (!coach || !loaded) return;
    if (playing) player.play();
    else player.pause();
  }, [coach, loaded, playing, player]);

  // a new token after renewAfterSec while playing (the old one would expire mid-video)
  useEffect(() => {
    if (!play || !isPlaying) return;
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
  }, [api, attach, isPlaying, play, playPath, player]);

  const save = useCallback((completed = false) => {
    if (!progressPath) return;
    const pos = player.currentTime;
    const dur = player.duration;
    if (!Number.isFinite(dur) || dur <= 0) return;
    if (!completed && Math.abs(pos - savedAt.current) < 1) return;
    savedAt.current = pos;
    const body: ProgressUpdate = { positionSec: Math.floor(pos), durationSec: Math.round(dur), ...(completed ? { completed: true } : {}) };
    api.put(progressPath, body).catch(() => undefined);
  }, [api, player, progressPath]);

  // progress while playing, on pause
  useEffect(() => {
    if (!isPlaying) {
      save();
      return;
    }
    const id = setInterval(() => save(), PROGRESS_EVERY_MS);
    return () => clearInterval(id);
  }, [isPlaying, save]);

  useEventListener(player, 'playToEnd', () => {
    if (completedSent.current) return;
    completedSent.current = true;
    save(true);
    onCompleted?.();
  });

  // background: pause (and save)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' && player.playing) player.pause();
    });
    return () => sub.remove();
  }, [player]);

  // last position when leaving the lesson
  useEffect(() => () => save(), [save]);

  const wm = play?.watermark;
  return (
    <View style={coach ? [StyleSheet.absoluteFill, { backgroundColor: '#000000' }] : [styles.frame, frameStyle(videoAspect ?? aspect, screenW, screenH), { borderRadius: radius.l }]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        nativeControls={!coach}
        contentFit="contain"
        fullscreenOptions={{ enable: !wm?.enabled }}
        allowsPictureInPicture={false}
      />
      {wm?.enabled && wm.text ? <Watermark text={wm.text} opacity={wm.opacityPct / 100} intervalSec={wm.intervalSec} /> : null}
      {!play && !error ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : null}
      {error || status === 'error' ? (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: 'rgba(0,0,0,0.75)', padding: coach ? space.s : space.l, gap: space.m }]}>
          <Txt color="#FFFFFF" variant={coach ? 'small' : 'body'} style={{ textAlign: 'center' }}>{error ? errorText(error) : 'Das Video konnte nicht geladen werden.'}</Txt>
          <Button label="Noch einmal" kind="secondary" onPress={() => { setPlay(null); setLoaded(false); setError(null); setAttempt((a) => a + 1); }} />
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
});
