// The team's two views of the group (owner 11.11.2026): "Gemeldet" — what is reported, by whom and why, with "Zur Nachricht", "Meldung verwerfen" (the
// message stays) and "Nachricht löschen"; and who voted what in a poll.
import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Txt } from '@/components/ui';
import { errorText } from '@/lib/api';
import { useGroupActions, useGroupReports, usePollVoters, type GroupMessage } from '@/lib/group';
import { radius, space, usePalette } from '@/lib/theme';

const when = (sec: number) => new Date(sec * 1000).toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const snippet = (m: GroupMessage) => (m.poll ? `Umfrage: ${m.poll.question}` : m.body || (m.image ? 'Bild' : ''));

function SheetFrame({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: p.surface }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.xl, paddingBottom: space.m }}>
          <Txt variant="title">{title}</Txt>
          <Pressable accessibilityRole="button" accessibilityLabel="Schließen" hitSlop={10} onPress={onClose}><Ionicons name="close" size={26} color={p.text} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: insets.bottom + space.xl, gap: space.m }}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

/** "N gemeldet": the reported messages with their reports. */
export function ReportsSheet({ onClose, onJump }: { onClose: () => void; onJump: (id: string) => void }) {
  const p = usePalette();
  const q = useGroupReports(true);
  const act = useGroupActions();
  const resolve = (id: string, keep: boolean) => act.resolve.mutate({ id, keep }, { onError: (err) => Alert.alert('Hat nicht geklappt', errorText(err)) });
  return (
    <SheetFrame title="Gemeldet" onClose={onClose}>
      {q.isPending ? <ActivityIndicator color={p.accent} /> : null}
      {q.data && q.data.length === 0 ? <Txt muted>Keine offenen Meldungen.</Txt> : null}
      {(q.data ?? []).map(({ message: m, reports }) => (
        <View key={m.id} style={{ gap: space.s, padding: space.m, borderRadius: radius.l, borderWidth: 1, borderColor: p.line, backgroundColor: p.bg }}>
          <Txt variant="small" muted>{m.author.name} · {when(m.createdAt)}{m.hidden ? ' · ausgeblendet' : ''}</Txt>
          <Txt numberOfLines={4}>{snippet(m)}</Txt>
          <View style={{ gap: 4, paddingLeft: space.s, borderLeftWidth: 3, borderLeftColor: p.danger }}>
            {reports.map((r, i) => (
              <Txt key={i} variant="small">
                <Txt variant="small" style={{ fontWeight: '700' }}>{r.name}</Txt>{r.reason ? `: ${r.reason}` : ' hat gemeldet'}
              </Txt>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            <Button label="Zur Nachricht" kind="secondary" onPress={() => { onClose(); onJump(m.id); }} />
            <Button label="Meldung verwerfen" kind="secondary" onPress={() => resolve(m.id, true)} />
            <Button
              label="Nachricht löschen"
              kind="ghost"
              onPress={() => Alert.alert('Nachricht löschen?', 'Sie wird für alle als „Nachricht gelöscht“ angezeigt.', [
                { text: 'Abbrechen', style: 'cancel' },
                { text: 'Löschen', style: 'destructive', onPress: () => resolve(m.id, false) },
              ])}
            />
          </View>
        </View>
      ))}
    </SheetFrame>
  );
}

/** Who voted what in a poll (the team only; members are told under the poll). */
export function VotesSheet({ messageId, question, onClose }: { messageId: string; question: string; onClose: () => void }) {
  const p = usePalette();
  const q = usePollVoters(messageId);
  return (
    <SheetFrame title="Abstimmung" onClose={onClose}>
      <Txt variant="heading">{question}</Txt>
      {q.isPending ? <ActivityIndicator color={p.accent} /> : null}
      {q.isError ? <Txt color={p.danger}>{errorText(q.error)}</Txt> : null}
      {(q.data?.options ?? []).map((o) => (
        <View key={o.option} style={{ gap: space.xs }}>
          <Txt style={{ fontWeight: '700' }}>{o.option} · {o.voters.length}</Txt>
          <Txt muted>{o.voters.length > 0 ? o.voters.map((v) => v.name).join(', ') : 'Noch niemand'}</Txt>
        </View>
      ))}
    </SheetFrame>
  );
}
