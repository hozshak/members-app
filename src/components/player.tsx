// The protected video player of a lesson, with the phone's own player (expo-video). Like the website's player
// (ProtectedPlayer.tsx of the software): a stream token from POST …/play (address + resume position + watermark), the
// session as Bearer header on the stream, a new token after `renewAfterSec` while playing, progress every 15 s, on pause
// and at the end (completed). It pauses when the app goes to the background. The watermark moves over the picture; with
// a watermark the native fullscreen is off (it would hide the watermark).
import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
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
  /** 16:9 unless the video says otherwise. */
  aspect?: number;
  onCompleted?: () => void;
}

/** Jumps to a position. expo-video's player is an imperative native object: seeking is assigning `currentTime`. */
function seek(player: VideoPlayer, at: number): void {
  player.currentTime = at;
}

export function LessonPlayer({ playPath, progressPath, aspect = 16 / 9, onCompleted }: LessonPlayerProps) {
  const api = useApi();
  const player = useVideoPlayer(null);
  const [play, setPlay] = useState<PlayResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const alive = useRef(true);
  const savedAt = useRef(0);
  const completedSent = useRef(false);
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

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
        await attach(resp, resp.resumeAtSec, false);
      } catch (err) {
        if (alive.current) setError(err);
      }
    })();
    return () => { alive.current = false; };
  }, [api, playPath, attach, attempt]);

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
    <View style={[styles.frame, { aspectRatio: aspect, borderRadius: radius.l }]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        nativeControls
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
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: 'rgba(0,0,0,0.75)', padding: space.l, gap: space.m }]}>
          <Txt color="#FFFFFF" style={{ textAlign: 'center' }}>{error ? errorText(error) : 'Das Video konnte nicht geladen werden.'}</Txt>
          <Button label="Noch einmal" kind="secondary" onPress={() => { setPlay(null); setError(null); setAttempt((a) => a + 1); }} />
        </View>
      ) : null}
    </View>
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
  frame: { width: '100%', backgroundColor: '#000000', overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
