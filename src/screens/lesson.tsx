// One lesson: the video (if it has one), title and where it belongs, the lesson text with embedded videos, its PDF,
// "Als erledigt markieren", the way to the previous / next lesson, "Gefällt mir" and the comments. Unlocked categories are
// announced after "erledigt". The hint of its category (11.11.2026, e.g. "Teil der kompletten Routine in …") stands under the title as a card — plain
// text, no link: Apple and Google allow no way to a purchase outside the app.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Comments } from '@/components/comments';
import { DownloadRow } from '@/components/download';
import { LessonText } from '@/components/lesson-text';
import { LinkedText } from '@/components/linked-text';
import { LessonPlayer } from '@/components/player';
import { Button, Card, ErrorView, Loading, Screen, Txt } from '@/components/ui';
import { errorText } from '@/lib/api';
import { useBookmarks } from '@/lib/bookmarks';
import { clock } from '@/lib/format';
import { useOpen } from '@/lib/nav';
import { useMarkDone, useVideo } from '@/lib/queries';
import { useApi } from '@/lib/session';
import { radius, space, usePalette } from '@/lib/theme';
import type { LessonDoneResult, LikeState, VideoDetail } from '@/lib/types';

/** Share of the video that has to be watched before "erledigt" (the same rule as on the server). */
const DONE_AT = 0.9;
/** A longer step of the player is a jump, not watching (like on the website: WATCH_STEP_MAX_SEC). */
const WATCH_STEP_MAX_SEC = 3;
/** The button opens this much after the 90 %, so the server's own count has certainly arrived there as well. */
const DONE_MARGIN_SEC = 1;

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useVideo(id);
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  return <Lesson key={q.data.id} v={q.data} refetch={() => void q.refetch()} />;
}

function Lesson({ v, refetch }: { v: VideoDetail; refetch: () => void }) {
  const p = usePalette();
  const api = useApi();
  const open = useOpen();
  const done = useMarkDone(v.id);
  const [result, setResult] = useState<LessonDoneResult | null>(null);
  const hasVideo = v.kind === 'video' || v.kind === 'video_text';
  const playPath = `/api/member/videos/${encodeURIComponent(v.id)}/play`;
  const progressPath = `/api/member/videos/${encodeURIComponent(v.id)}/progress`;
  const serverEnough = !!v.durationSec && v.watchedSec >= v.durationSec * DONE_AT;

  // The 90 % while the video runs: counts watched seconds like the server (small forward steps, never a jump), so the
  // button opens at that moment and not only on the next visit.
  const live = useRef({ played: v.watchedSec, last: -1, pos: 0, dur: v.durationSec ?? 0, enough: false });
  const [liveEnough, setLiveEnough] = useState(false);
  const report = useCallback(
    () => api.put(progressPath, { positionSec: live.current.pos, durationSec: live.current.dur }),
    [api, progressPath],
  );
  const onTime = useCallback((pos: number, dur: number) => {
    const l = live.current;
    const step = pos - l.last;
    if (l.last >= 0 && step > 0 && step <= WATCH_STEP_MAX_SEC) l.played += step;
    l.last = pos;
    l.pos = pos;
    if (!l.dur && dur > 0) l.dur = dur;
    if (!l.enough && l.dur > 0 && l.played >= l.dur * DONE_AT + DONE_MARGIN_SEC) {
      l.enough = true;
      setLiveEnough(true);
      report().catch(() => undefined);
    }
  }, [report]);

  // like on the website: a video counts as done after 90 % actually watched (the server checks it too)
  const mustWatch = hasVideo && !v.done && !!v.durationSec && !serverEnough && !liveEnough;
  const go = (to: string | null) => to && open.lesson(to, { replace: true });

  const toggleDone = () => {
    if (done.isPending) return;
    setResult(null);
    done.mutate({ done: !v.done, flush: !v.done && liveEnough && !serverEnough ? report : undefined }, { onSuccess: (r) => setResult(r) });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: v.sectionTitle ?? v.categoryTitle }} />
      {hasVideo ? (
        <LessonPlayer autoPlay posterUrl={v.thumbnailUrl} playPath={playPath} progressPath={progressPath} onTime={onTime} onCompleted={refetch} />
      ) : null}

      <View style={{ gap: space.xs }}>
        <Txt variant="small" muted>
          {v.categoryTitle}
          {v.sectionTitle ? ` · ${v.sectionTitle}` : ''}
          {v.durationSec ? ` · ${clock(v.durationSec)}` : ''}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.m }}>
          <Txt variant="title" style={{ flex: 1 }}>{v.title}</Txt>
          <BookmarkButton video={v} />
          <LikeButton key={v.id} videoId={v.id} liked={v.likedByMe} count={v.likeCount} />
        </View>
        {v.description ? <LinkedText text={v.description} muted /> : null}
      </View>

      {v.appHint ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.m, padding: space.m, borderRadius: radius.l, backgroundColor: p.accentSoft }}>
          <Ionicons name="sparkles-outline" size={20} color={p.accent} style={{ marginTop: 2 }} />
          <Txt style={{ flex: 1 }}>{v.appHint}</Txt>
        </View>
      ) : null}

      {v.bodyMd ? <LessonText lessonId={v.id} bodyMd={v.bodyMd} embeds={v.embeds} /> : null}
      {v.file ? <DownloadRow file={v.file} onOpened={refetch} /> : null}

      <View style={{ gap: space.s }}>
        <Button
          label={v.done ? 'Erledigt – zurücknehmen' : 'Als erledigt markieren'}
          kind={v.done ? 'secondary' : 'primary'}
          onPress={toggleDone}
          disabled={mustWatch}
        />
        {mustWatch ? <Txt variant="small" muted style={{ textAlign: 'center' }}>Schau das Video zu 90 % an, dann kannst du es als erledigt markieren.</Txt> : null}
        {done.isError ? <Txt color={p.danger}>{errorText(done.error)}</Txt> : null}
        {result && result.unlocked.length > 0 ? (
          <Card style={{ padding: space.l, gap: space.xs }}>
            <Txt variant="heading">Neu freigeschaltet</Txt>
            {result.unlocked.map((c) => (
              <Pressable key={c.id} accessibilityRole="link" onPress={() => open.category(c.slug)}>
                <Txt color={p.accent}>{c.title} ›</Txt>
              </Pressable>
            ))}
          </Card>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: space.m }}>
        <NavButton label="Zurück" icon="chevron-back" disabled={!v.prevId} onPress={() => go(v.prevId)} />
        <NavButton label="Weiter" icon="chevron-forward" disabled={!v.nextId} onPress={() => go(v.nextId)} trailing />
      </View>

      {v.commentsEnabled ? <Comments key={v.id} videoId={v.id} /> : null}
    </Screen>
  );
}

/** "Merken": puts the lesson on the Merkliste of this phone (tab "Inhalte"). */
function BookmarkButton({ video }: { video: VideoDetail }) {
  const p = usePalette();
  const bookmarks = useBookmarks();
  const saved = bookmarks.has(video.id);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Von der Merkliste nehmen' : 'Auf die Merkliste'}
      hitSlop={10}
      onPress={() => bookmarks.toggle(video)}
      style={{ paddingTop: 4 }}
    >
      <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={24} color={saved ? p.accent : p.textMuted} />
    </Pressable>
  );
}

/** "Gefällt mir" of the lesson (heart + count), answered at once and corrected by the server. */
function LikeButton({ videoId, liked, count }: { videoId: string; liked: boolean; count: number }) {
  const p = usePalette();
  const api = useApi();
  const [state, setState] = useState({ liked, count });
  const toggle = async () => {
    const next = !state.liked;
    setState({ liked: next, count: state.count + (next ? 1 : -1) });
    try {
      const path = `/api/member/videos/${encodeURIComponent(videoId)}/like`;
      const r = next ? await api.put<LikeState>(path) : await api.del<LikeState>(path);
      setState({ liked: r.liked, count: r.likeCount });
    } catch {
      setState({ liked, count });
    }
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={state.liked ? 'Gefällt mir nicht mehr' : 'Gefällt mir'}
      hitSlop={10}
      onPress={() => void toggle()}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 4 }}
    >
      <Ionicons name={state.liked ? 'heart' : 'heart-outline'} size={24} color={state.liked ? p.accent : p.textMuted} />
      {state.count > 0 ? <Txt variant="small" muted>{state.count}</Txt> : null}
    </Pressable>
  );
}

function NavButton({ label, icon, disabled, onPress, trailing }: {
  label: string; icon: 'chevron-back' | 'chevron-forward'; disabled: boolean; onPress: () => void; trailing?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => ({
        flex: 1, minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: p.line, backgroundColor: p.surface,
        flexDirection: trailing ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs,
        opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={p.text} />
      <Txt variant="heading">{label}</Txt>
    </Pressable>
  );
}
