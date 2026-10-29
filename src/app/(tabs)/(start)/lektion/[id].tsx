// One lesson: the video (if it has one), title and where it belongs, the lesson text with embedded videos, its PDF,
// "Als erledigt markieren" and the way to the previous / next lesson. Unlocked categories are announced after "erledigt".
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { DownloadRow } from '@/components/download';
import { LessonText } from '@/components/lesson-text';
import { LessonPlayer } from '@/components/player';
import { Button, Card, ErrorView, Loading, Screen, Txt } from '@/components/ui';
import { errorText } from '@/lib/api';
import { clock } from '@/lib/format';
import { useMarkDone, useVideo } from '@/lib/queries';
import { space, usePalette } from '@/lib/theme';
import type { LessonDoneResult } from '@/lib/types';

export default function LessonScreen() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useVideo(id);
  const done = useMarkDone(id);
  const [result, setResult] = useState<LessonDoneResult | null>(null);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  const v = q.data;
  const hasVideo = v.kind === 'video' || v.kind === 'video_text';
  const isDone = v.done || v.completed;
  // like on the website: a video counts as done after 90 % actually watched (the server checks it too)
  const mustWatch = hasVideo && !isDone && !!v.durationSec && v.watchedSec < v.durationSec * 0.9;
  const go = (to: string | null) => to && router.replace({ pathname: '/lektion/[id]', params: { id: to } });

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
        <Txt variant="title">{v.title}</Txt>
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
              <Pressable key={c.id} accessibilityRole="link" onPress={() => router.push({ pathname: '/kategorie/[slug]', params: { slug: c.slug } })}>
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
    </Screen>
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
