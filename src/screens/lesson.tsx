// One lesson: the video (if it has one), title and where it belongs, the lesson text with embedded videos, its PDF,
// "Als erledigt markieren", the way to the previous / next lesson, "Gefällt mir" and the comments. Unlocked categories are
// announced after "erledigt".
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Comments } from '@/components/comments';
import { DownloadRow } from '@/components/download';
import { LessonText } from '@/components/lesson-text';
import { LessonPlayer } from '@/components/player';
import { Button, Card, ErrorView, Loading, Screen, Txt } from '@/components/ui';
import { errorText } from '@/lib/api';
import { clock } from '@/lib/format';
import { useOpen } from '@/lib/nav';
import { useMarkDone, useVideo } from '@/lib/queries';
import { useApi } from '@/lib/session';
import { space, usePalette } from '@/lib/theme';
import type { LessonDoneResult, LikeState } from '@/lib/types';

export default function LessonScreen() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useVideo(id);
  const open = useOpen();
  const done = useMarkDone(id);
  const [result, setResult] = useState<LessonDoneResult | null>(null);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  const v = q.data;
  const hasVideo = v.kind === 'video' || v.kind === 'video_text';
  const isDone = v.done || v.completed;
  // like on the website: a video counts as done after 90 % actually watched (the server checks it too)
  const mustWatch = hasVideo && !isDone && !!v.durationSec && v.watchedSec < v.durationSec * 0.9;
  const go = (to: string | null) => to && open.lesson(to, { replace: true });

  const toggleDone = () => {
    setResult(null);
    done.mutate(!isDone, { onSuccess: (r) => setResult(r) });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: v.sectionTitle ?? v.categoryTitle }} />
      {hasVideo ? (
        <LessonPlayer
          key={v.id}
          playPath={`/api/member/videos/${encodeURIComponent(v.id)}/play`}
          progressPath={`/api/member/videos/${encodeURIComponent(v.id)}/progress`}
          onCompleted={() => void q.refetch()}
        />
      ) : null}

      <View style={{ gap: space.xs }}>
        <Txt variant="small" muted>
          {v.categoryTitle}
          {v.sectionTitle ? ` · ${v.sectionTitle}` : ''}
          {v.durationSec ? ` · ${clock(v.durationSec)}` : ''}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.m }}>
          <Txt variant="title" style={{ flex: 1 }}>{v.title}</Txt>
          <LikeButton key={v.id} videoId={v.id} liked={v.likedByMe} count={v.likeCount} />
        </View>
        {v.description ? <Txt muted>{v.description}</Txt> : null}
      </View>

      {v.bodyMd ? <LessonText lessonId={v.id} bodyMd={v.bodyMd} embeds={v.embeds} /> : null}
      {v.file ? <DownloadRow file={v.file} onOpened={() => void q.refetch()} /> : null}

      <View style={{ gap: space.s }}>
        <Button
          label={isDone ? 'Erledigt – zurücknehmen' : 'Als erledigt markieren'}
          kind={isDone ? 'secondary' : 'primary'}
          onPress={toggleDone}
          loading={done.isPending}
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
