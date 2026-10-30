// Comments under a lesson, like on the website: newest first, replies under their comment, like, reply, delete own,
// report others (spam / insult / illegal / other). A new comment may wait for approval ("Wartet auf Freigabe").
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, TextInput, View } from 'react-native';
import { errorText } from '@/lib/api';
import { uniqueById } from '@/lib/format';
import { useApi } from '@/lib/session';
import { radius, space, usePalette } from '@/lib/theme';
import type { Comment, CommentsPage, LikeState } from '@/lib/types';
import { Button, Txt } from './ui';

const enc = encodeURIComponent;

function ago(sec: number): string {
  const d = Math.max(0, Date.now() / 1000 - sec);
  if (d < 60) return 'gerade eben';
  if (d < 3600) return `vor ${Math.floor(d / 60)} Min.`;
  if (d < 86400) return `vor ${Math.floor(d / 3600)} Std.`;
  if (d < 7 * 86400) return `vor ${Math.floor(d / 86400)} Tag${Math.floor(d / 86400) === 1 ? '' : 'en'}`;
  return new Date(sec * 1000).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
}

const REPORT_REASONS: { reason: 'spam' | 'insult' | 'illegal' | 'other'; label: string }[] = [
  { reason: 'spam', label: 'Spam' },
  { reason: 'insult', label: 'Beleidigung' },
  { reason: 'illegal', label: 'Rechtswidrig' },
  { reason: 'other', label: 'Etwas anderes' },
];

export function Comments({ videoId }: { videoId: string }) {
  const p = usePalette();
  const api = useApi();
  const qc = useQueryClient();
  const key = ['comments', videoId] as const;
  const q = useInfiniteQuery({
    queryKey: key,
    initialPageParam: '' as string,
    queryFn: ({ pageParam }) => api.get<CommentsPage>(`/api/member/videos/${enc(videoId)}/comments?sort=newest${pageParam ? `&cursor=${enc(pageParam)}` : ''}`),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const send = useMutation({
    mutationFn: () => api.post<Comment>(`/api/member/videos/${enc(videoId)}/comments`, { body: text.trim(), ...(replyTo ? { parentId: replyTo.id } : {}) }),
    onSuccess: () => { setText(''); setReplyTo(null); void refresh(); },
  });

  const total = q.data?.pages[0]?.total ?? 0;
  // a comment can show up on two pages when new ones arrived in between
  const items = uniqueById(q.data?.pages.flatMap((pg) => pg.items) ?? []);

  return (
    <View style={{ gap: space.m }}>
      <Txt variant="title">Kommentare{total > 0 ? ` (${total})` : ''}</Txt>

      <View style={{ gap: space.s }}>
        {replyTo ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            <Txt variant="small" muted style={{ flex: 1 }}>Antwort an {replyTo.author.displayName}</Txt>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setReplyTo(null)}><Txt variant="small" color={p.accent}>Abbrechen</Txt></Pressable>
          </View>
        ) : null}
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={replyTo ? 'Deine Antwort …' : 'Schreib einen Kommentar …'}
          placeholderTextColor={p.textMuted}
          multiline
          maxLength={4000}
          accessibilityLabel="Kommentar"
          style={{ minHeight: 80, borderRadius: radius.l, borderWidth: 1, borderColor: p.line, backgroundColor: p.surface, color: p.text, padding: space.m, fontSize: 16, textAlignVertical: 'top' }}
        />
        {send.isError ? <Txt color={p.danger}>{errorText(send.error)}</Txt> : null}
        <Button label={replyTo ? 'Antworten' : 'Kommentieren'} onPress={() => send.mutate()} disabled={!text.trim()} loading={send.isPending} />
      </View>

      {q.isPending ? <Txt muted>Kommentare werden geladen …</Txt> : null}
      {q.isError ? <Txt color={p.danger}>{errorText(q.error)}</Txt> : null}
      {items.length === 0 && !q.isPending ? <Txt muted>Noch keine Kommentare. Schreib den ersten!</Txt> : null}

      {items.map((c) => (
        <View key={c.id} style={{ gap: space.s }}>
          <CommentItem comment={c} onReply={() => setReplyTo(c)} onChanged={refresh} />
          {c.replies.map((r) => (
            <View key={r.id} style={{ marginLeft: space.xl }}>
              <CommentItem comment={r} onChanged={refresh} />
            </View>
          ))}
        </View>
      ))}

      {q.hasNextPage ? <Button label="Mehr Kommentare" kind="secondary" onPress={() => void q.fetchNextPage()} loading={q.isFetchingNextPage} /> : null}
    </View>
  );
}

function CommentItem({ comment: c, onReply, onChanged }: { comment: Comment; onReply?: () => void; onChanged: () => void }) {
  const p = usePalette();
  const api = useApi();
  const [like, setLike] = useState({ liked: c.likedByMe, count: c.likeCount });

  const toggleLike = async () => {
    const next = !like.liked;
    setLike({ liked: next, count: like.count + (next ? 1 : -1) });
    try {
      const r = next
        ? await api.put<LikeState>(`/api/member/comments/${enc(c.id)}/like`)
        : await api.del<LikeState>(`/api/member/comments/${enc(c.id)}/like`);
      setLike({ liked: r.liked, count: r.likeCount });
    } catch {
      setLike({ liked: c.likedByMe, count: c.likeCount });
    }
  };

  const remove = () => Alert.alert('Kommentar löschen?', 'Das lässt sich nicht rückgängig machen.', [
    { text: 'Abbrechen', style: 'cancel' },
    { text: 'Löschen', style: 'destructive', onPress: () => void api.del(`/api/member/comments/${enc(c.id)}`).then(onChanged, (err) => Alert.alert(errorText(err))) },
  ]);

  const report = () => {
    const send = (reason: (typeof REPORT_REASONS)[number]['reason']) =>
      void api.post(`/api/member/comments/${enc(c.id)}/report`, { reason }).then(
        () => Alert.alert('Danke für deine Meldung', 'Das Team schaut sich den Kommentar an.'),
        (err) => Alert.alert(errorText(err)),
      );
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: 'Warum meldest du den Kommentar?', options: [...REPORT_REASONS.map((r) => r.label), 'Abbrechen'], cancelButtonIndex: REPORT_REASONS.length },
        (i) => { const r = REPORT_REASONS[i]; if (r) send(r.reason); },
      );
    } else {
      Alert.alert('Warum meldest du den Kommentar?', undefined, [
        ...REPORT_REASONS.map((r) => ({ text: r.label, onPress: () => send(r.reason) })),
        { text: 'Abbrechen', style: 'cancel' as const },
      ]);
    }
  };

  return (
    <View style={{ gap: space.xs, padding: space.m, borderRadius: radius.l, backgroundColor: c.pinned ? p.accentSoft : p.surface, borderWidth: 1, borderColor: p.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
        <Txt variant="heading" style={{ flexShrink: 1 }} numberOfLines={1}>{c.author.displayName}</Txt>
        {c.author.isTeam ? <Txt variant="caption" color={p.accent}>Team</Txt> : null}
        <Txt variant="small" muted>{ago(c.createdAt)}</Txt>
      </View>
      {c.status === 'pending' ? <Txt variant="small" color={p.textMuted}>Wartet auf Freigabe</Txt> : null}
      <Txt>{c.status === 'deleted' ? 'Dieser Kommentar wurde gelöscht.' : c.body}</Txt>
      {c.status !== 'deleted' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.l, marginTop: space.xs }}>
          <Pressable accessibilityRole="button" accessibilityLabel={like.liked ? 'Gefällt mir nicht mehr' : 'Gefällt mir'} hitSlop={8} onPress={() => void toggleLike()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name={like.liked ? 'heart' : 'heart-outline'} size={18} color={like.liked ? p.accent : p.textMuted} />
            {like.count > 0 ? <Txt variant="small" muted>{like.count}</Txt> : null}
          </Pressable>
          {onReply ? (
            <Pressable accessibilityRole="button" hitSlop={8} onPress={onReply}><Txt variant="small" color={p.accent}>Antworten</Txt></Pressable>
          ) : null}
          {c.canDelete ? (
            <Pressable accessibilityRole="button" hitSlop={8} onPress={remove}><Txt variant="small" muted>Löschen</Txt></Pressable>
          ) : null}
          {c.canReport ? (
            <Pressable accessibilityRole="button" hitSlop={8} onPress={report}><Txt variant="small" muted>Melden</Txt></Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
