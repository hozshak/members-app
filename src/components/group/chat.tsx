// The group as a chat (owner 10.11.2026): the newest message at the bottom, older ones load when scrolling up; asked again every few seconds while it is
// on screen. A pinned message stands on top. A long press opens the menu: react, answer, copy, report, block (members' content, App Review 1.2), and for
// the team: pin, delete, mute or ban the author, look at reports. Writing: text for everybody who may; pictures, GIFs and polls for the team (the "+").
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Txt } from '@/components/ui';
import { errorText } from '@/lib/api';
import {
  flatMessages, GROUP_MUTE_HOURS, GROUP_POLL_OPTIONS_MAX, GROUP_REACTIONS, useGroupActions, useGroupMessages, type GroupInfo, type GroupMessage,
} from '@/lib/group';
import { useSession } from '@/lib/session';
import { radius, space, usePalette } from '@/lib/theme';
import { MessageBubble } from './message';

const hoursLabel = (h: number) => (h === 1 ? '1 Stunde' : h === 24 ? '24 Stunden' : '7 Tage');

/** The menu of a long press: the reactions on top, then what can be done. */
function MessageSheet({ m, info, onClose, onReply }: { m: GroupMessage; info: GroupInfo; onClose: () => void; onReply: () => void }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const act = useGroupActions();
  const team = info.isTeam;
  const done = (fn: () => Promise<unknown>) => () => {
    onClose();
    void fn().catch((err) => Alert.alert('Hat nicht geklappt', errorText(err)));
  };
  const rows: { icon: keyof typeof Ionicons.glyphMap; label: string; danger?: boolean; onPress: () => void }[] = [];
  if (!m.deleted) {
    if (info.canPost) rows.push({ icon: 'arrow-undo-outline', label: 'Antworten', onPress: () => { onClose(); onReply(); } });
    if (m.body) rows.push({ icon: 'copy-outline', label: 'Text kopieren', onPress: done(() => Clipboard.setStringAsync(m.body)) });
    if (team) rows.push({ icon: m.pinned ? 'pin-outline' : 'pin', label: m.pinned ? 'Nicht mehr anpinnen' : 'Oben anpinnen', onPress: done(() => act.pin.mutateAsync({ id: m.id, pin: !m.pinned })) });
    if (team && (m.reports ?? 0) > 0) {
      rows.push({ icon: 'checkmark-circle-outline', label: 'Meldungen ansehen: Nachricht behalten', onPress: done(() => act.resolve.mutateAsync({ id: m.id, keep: true })) });
    }
    if (!m.mine) {
      rows.push({
        icon: 'flag-outline', label: 'Melden', onPress: () => {
          onClose();
          Alert.alert('Nachricht melden?', 'Das Team schaut sie sich an. Nach mehreren Meldungen wird sie ausgeblendet.', [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Melden', style: 'destructive', onPress: () => void act.report.mutateAsync({ id: m.id, reason: '' }).then(() => Alert.alert('Danke', 'Die Nachricht wurde gemeldet.')).catch((err) => Alert.alert('Nicht gemeldet', errorText(err))) },
          ]);
        },
      });
      rows.push({
        icon: 'eye-off-outline', label: `${m.author.name} blockieren`, onPress: () => {
          onClose();
          Alert.alert(`${m.author.name} blockieren?`, 'Du siehst dann keine Nachrichten mehr von dieser Person.', [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Blockieren', style: 'destructive', onPress: () => void act.block.mutateAsync(m.author.id).catch((err) => Alert.alert('Nicht blockiert', errorText(err))) },
          ]);
        },
      });
    }
    if (m.canDelete) {
      rows.push({
        icon: 'trash-outline', label: 'Löschen', danger: true, onPress: () => {
          onClose();
          Alert.alert('Nachricht löschen?', 'Sie wird für alle als „Nachricht gelöscht“ angezeigt.', [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Löschen', style: 'destructive', onPress: () => void act.remove.mutateAsync(m.id).catch((err) => Alert.alert('Nicht gelöscht', errorText(err))) },
          ]);
        },
      });
    }
    if (team && !m.mine && !m.author.isTeam) {
      rows.push({
        icon: 'volume-mute-outline', label: `${m.author.name} stummschalten`, onPress: () => {
          onClose();
          Alert.alert(`${m.author.name} stummschalten`, 'Wie lange darf diese Person nicht schreiben?', [
            ...GROUP_MUTE_HOURS.map((h) => ({ text: hoursLabel(h), onPress: () => void act.moderate.mutateAsync({ userId: m.author.id, muteHours: h }) })),
            { text: 'Wieder schreiben lassen', onPress: () => void act.moderate.mutateAsync({ userId: m.author.id, muteHours: 0 }) },
            { text: 'Abbrechen', style: 'cancel' as const },
          ]);
        },
      });
      rows.push({
        icon: 'ban-outline', label: `${m.author.name} aus der Gruppe nehmen`, danger: true, onPress: () => {
          onClose();
          Alert.alert(`${m.author.name} aus der Gruppe nehmen?`, 'Die Person sieht die Gruppe nicht mehr. Ein laufendes Abo kündigt sie selbst bei Apple oder Google.', [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Aus der Gruppe nehmen', style: 'destructive', onPress: () => void act.moderate.mutateAsync({ userId: m.author.id, ban: true }) },
          ]);
        },
      });
    }
  }
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="Schließen" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom + space.m, paddingTop: space.m, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: p.surface, gap: space.s }}>
        {!m.deleted ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: space.l, paddingBottom: space.s }}>
            {GROUP_REACTIONS.map((emoji) => {
              const mine = m.reactions.some((r) => r.emoji === emoji && r.mine);
              return (
                <Pressable
                  key={emoji}
                  accessibilityRole="button"
                  accessibilityLabel={`Mit ${emoji} reagieren`}
                  onPress={done(() => act.react.mutateAsync({ id: m.id, emoji }))}
                  style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: mine ? p.accentSoft : p.surfaceAlt, transform: [{ scale: pressed ? 0.9 : 1 }] })}
                >
                  <Txt style={{ fontSize: 24, lineHeight: 30 }}>{emoji}</Txt>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {rows.map((r) => (
          <Pressable
            key={r.label}
            accessibilityRole="button"
            onPress={r.onPress}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 50, paddingHorizontal: space.xl, backgroundColor: pressed ? p.surfaceAlt : 'transparent' })}
          >
            <Ionicons name={r.icon} size={20} color={r.danger ? p.danger : p.text} />
            <Txt color={r.danger ? p.danger : p.text}>{r.label}</Txt>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

/** The team makes a poll: question, two to six answers, one or several choices. */
function PollEditor({ onClose }: { onClose: () => void }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const act = useGroupActions();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multi, setMulti] = useState(false);
  const filled = options.map((o) => o.trim()).filter(Boolean);
  const ready = question.trim().length > 0 && filled.length >= 2;
  const input = { minHeight: 46, borderRadius: radius.m, borderWidth: 1, borderColor: p.line, paddingHorizontal: space.m, color: p.text, backgroundColor: p.bg, fontSize: 16 };
  const send = () => act.postPoll.mutate({ question: question.trim(), options: filled, multi }, {
    onSuccess: onClose,
    onError: (err) => Alert.alert('Umfrage nicht gesendet', errorText(err)),
  });
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: p.surface }}>
        <View style={{ flex: 1, padding: space.xl, paddingBottom: insets.bottom + space.l, gap: space.m }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Txt variant="title">Umfrage</Txt>
            <Pressable accessibilityRole="button" accessibilityLabel="Schließen" hitSlop={10} onPress={onClose}><Ionicons name="close" size={26} color={p.text} /></Pressable>
          </View>
          <TextInput value={question} onChangeText={setQuestion} placeholder="Deine Frage" placeholderTextColor={p.textMuted} maxLength={200} style={input} />
          {options.map((o, i) => (
            <TextInput
              key={i}
              value={o}
              onChangeText={(v) => setOptions((list) => list.map((x, j) => (j === i ? v : x)))}
              placeholder={`Antwort ${i + 1}`}
              placeholderTextColor={p.textMuted}
              maxLength={80}
              style={input}
            />
          ))}
          {options.length < GROUP_POLL_OPTIONS_MAX ? (
            <Pressable accessibilityRole="button" onPress={() => setOptions((list) => [...list, ''])} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: 44 }}>
              <Ionicons name="add-circle-outline" size={20} color={p.accent} />
              <Txt color={p.accent}>Antwort hinzufügen</Txt>
            </Pressable>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
            <Txt>Mehrere Antworten erlauben</Txt>
            <Switch value={multi} onValueChange={setMulti} trackColor={{ true: p.accent, false: p.surfaceAlt }} />
          </View>
          <View style={{ flex: 1 }} />
          <Button label="Umfrage senden" onPress={send} disabled={!ready} loading={act.postPoll.isPending} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function GroupChat({ info }: { info: GroupInfo }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { api } = useSession();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  const q = useGroupMessages(focused);
  const act = useGroupActions();
  const messages = useMemo(() => flatMessages(q.data), [q.data]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [sheet, setSheet] = useState<GroupMessage | null>(null);
  const [pollOpen, setPollOpen] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // being here marks everything as read
  const newest = messages[0]?.id;
  const { mutate: markRead } = act.markRead;
  useFocusEffect(useCallback(() => {
    if (newest) markRead();
  }, [newest, markRead]));

  const send = () => {
    const body = text.trim();
    if (!body) return;
    act.post.mutate({ body, replyToId: replyTo?.id ?? null }, {
      onSuccess: () => {
        setText('');
        setReplyTo(null);
      },
      onError: (err) => Alert.alert('Nicht gesendet', errorText(err)),
    });
  };

  const pickImage = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 1, allowsEditing: false,
      // a GIF stays a GIF (else the phone hands over a still JPEG)
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    });
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset) return;
    setUploading(true);
    try {
      const gif = (asset.mimeType ?? '').includes('gif') || asset.uri.toLowerCase().endsWith('.gif');
      let uri = asset.uri;
      let mime = gif ? 'image/gif' : 'image/jpeg';
      if (!gif) {
        // photos: at most 2048 px, as JPEG (fast to load for everybody)
        const r = await ImageManipulator.manipulate(asset.uri).resize(asset.width > asset.height ? { width: Math.min(2048, asset.width) } : { height: Math.min(2048, asset.height) }).renderAsync();
        const saved = await r.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
        uri = saved.uri;
        mime = 'image/jpeg';
      }
      await act.postImage.mutateAsync({ uri, mime, caption: text.trim() });
      setText('');
    } catch (err) {
      Alert.alert('Bild nicht gesendet', errorText(err));
    } finally {
      setUploading(false);
    }
  };

  const plusMenu = () => Alert.alert('Senden', undefined, [
    { text: 'Bild oder GIF', onPress: () => void pickImage() },
    { text: 'Umfrage', onPress: () => setPollOpen(true) },
    { text: 'Abbrechen', style: 'cancel' },
  ]);

  const muted = info.mutedUntil !== null;
  const composer = info.canPost ? (
    <View style={{ gap: space.xs, paddingHorizontal: space.m, paddingTop: space.s, paddingBottom: Math.max(insets.bottom, space.s) + 56, borderTopWidth: 1, borderTopColor: p.line, backgroundColor: p.surface }}>
      {replyTo ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, paddingHorizontal: space.s }}>
          <View style={{ flex: 1, borderLeftWidth: 3, borderLeftColor: p.accent, paddingLeft: space.s }}>
            <Txt variant="small" style={{ fontWeight: '700' }}>Antwort an {replyTo.author.name}</Txt>
            <Txt variant="small" muted numberOfLines={1}>{replyTo.body || (replyTo.poll ? replyTo.poll.question : 'Bild')}</Txt>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Antwort abbrechen" hitSlop={10} onPress={() => setReplyTo(null)}><Ionicons name="close-circle" size={22} color={p.textMuted} /></Pressable>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.s }}>
        {info.canPostMedia ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Bild, GIF oder Umfrage senden" onPress={plusMenu} disabled={uploading} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: p.surfaceAlt }}>
            {uploading ? <ActivityIndicator color={p.accent} /> : <Ionicons name="add" size={24} color={p.accent} />}
          </Pressable>
        ) : null}
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Nachricht schreiben"
          placeholderTextColor={p.textMuted}
          multiline
          maxLength={2000}
          accessibilityLabel="Nachricht"
          style={{ flex: 1, minHeight: 44, maxHeight: 140, borderRadius: 22, paddingHorizontal: space.l, paddingTop: 11, paddingBottom: 11, backgroundColor: p.bg, color: p.text, fontSize: 16, borderWidth: 1, borderColor: p.line }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Senden"
          onPress={send}
          disabled={!text.trim() || act.post.isPending}
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: text.trim() ? p.accent : p.surfaceAlt }}
        >
          {act.post.isPending ? <ActivityIndicator color={p.onAccent} /> : <Ionicons name="arrow-up" size={22} color={text.trim() ? p.onAccent : p.textMuted} />}
        </Pressable>
      </View>
    </View>
  ) : (
    <View style={{ padding: space.l, paddingBottom: Math.max(insets.bottom, space.s) + 56, borderTopWidth: 1, borderTopColor: p.line, backgroundColor: p.surface }}>
      <Txt variant="small" muted style={{ textAlign: 'center' }}>
        {muted ? `Du kannst bis ${new Date((info.mutedUntil ?? 0) * 1000).toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} nicht schreiben.` : 'Hier schreibt nur das Team. Du kannst reagieren und abstimmen.'}
      </Txt>
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: p.bg }}>
      <View style={{ paddingTop: insets.top + space.s, paddingHorizontal: space.l, paddingBottom: space.s, gap: space.s, borderBottomWidth: 1, borderBottomColor: p.line, backgroundColor: p.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
          <Txt variant="display" style={{ flex: 1 }} numberOfLines={1}>{info.name}</Txt>
          {info.isTeam && info.openReports > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.s, paddingVertical: 4, borderRadius: 999, backgroundColor: p.danger }}>
              <Ionicons name="flag" size={12} color="#FFFFFF" />
              <Txt variant="small" color="#FFFFFF" style={{ fontWeight: '700' }}>{info.openReports} gemeldet</Txt>
            </View>
          ) : null}
        </View>
        {info.pinned ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, padding: space.s, borderRadius: radius.m, backgroundColor: p.accentSoft }}>
            <Ionicons name="pin" size={16} color={p.accent} />
            <Txt variant="small" numberOfLines={2} style={{ flex: 1 }}>{info.pinned.body || info.pinned.poll?.question || 'Bild'}</Txt>
          </View>
        ) : null}
      </View>
      {q.isPending ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={p.accent} /></View>
      ) : (
        <FlatList
          data={messages}
          inverted
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingVertical: space.m }}
          renderItem={({ item }) => (
            <MessageBubble
              m={item}
              onLongPress={() => setSheet(item)}
              onReact={(emoji) => act.react.mutate({ id: item.id, emoji })}
              onVote={(options) => act.vote.mutate({ id: item.id, options }, { onError: (err) => Alert.alert('Stimme nicht gezählt', errorText(err)) })}
              onOpenImage={setViewer}
            />
          )}
          onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage(); }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={p.accent} style={{ margin: space.l }} /> : undefined}
          ListEmptyComponent={(
            <View style={{ padding: space.xl, alignItems: 'center', gap: space.s, transform: [{ scaleY: -1 }] }}>
              <Ionicons name="chatbubbles-outline" size={36} color={p.accent} />
              <Txt variant="heading">Noch ganz still hier</Txt>
              <Txt muted style={{ textAlign: 'center' }}>Schreib die erste Nachricht und sag Hallo.</Txt>
            </View>
          )}
        />
      )}
      {composer}
      {sheet ? <MessageSheet m={sheet} info={info} onClose={() => setSheet(null)} onReply={() => setReplyTo(sheet)} /> : null}
      {pollOpen ? <PollEditor onClose={() => setPollOpen(false)} /> : null}
      {viewer && api ? (
        <Modal visible animationType="fade" onRequestClose={() => setViewer(null)} statusBarTranslucent>
          <Pressable accessibilityRole="button" accessibilityLabel="Bild schließen" onPress={() => setViewer(null)} style={{ flex: 1, backgroundColor: '#000' }}>
            <Image source={{ uri: api.url(viewer), headers: api.mediaHeaders() }} style={StyleSheet.absoluteFill} contentFit="contain" autoplay />
          </Pressable>
        </Modal>
      ) : null}
    </KeyboardAvoidingView>
  );
}
