// The check-ins done so far (lib/progress-check.ts), newest first: they live on this phone. Each opens to its answers, note and photos; from here one can still go to the
// coach, be taken back, or be deleted from the phone. With `id` (the routine that offers one) a new check-in can be started at any time.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { AnswerCounts, PhotoPair, usePhotoMail } from '@/components/check-in-parts';
import { Button, Card, Screen, Txt } from '@/components/ui';
import { errorText } from '@/lib/api';
import { usePhotosVisible } from '@/lib/photo-lock';
import {
  ANSWER_LABELS, openCheckIn, removeCheckIn, useCheckIns, useSendCheckIn, useTakeBackCheckIn, type SavedCheck,
} from '@/lib/progress-check';
import { listPhotos, useRoutinePrefs, useRoutines, type ProgressPhoto } from '@/lib/routine';
import { useSession } from '@/lib/session';
import { space, usePalette } from '@/lib/theme';

const dayText = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });

function CheckCard({ check, photos }: { check: SavedCheck; photos: readonly ProgressPhoto[] }) {
  const p = usePalette();
  const { community } = useSession();
  const routines = useRoutines();
  const [prefs] = useRoutinePrefs();
  const photosVisible = usePhotosVisible(prefs.photoLock);
  const [open, setOpen] = useState(false);
  const send = useSendCheckIn();
  const takeBack = useTakeBackCheckIn();
  const name = routines.data?.find((r) => r.id === check.routineId)?.progressCheck?.contactName || community?.name || 'deinen Coach';
  const before = photos.find((x) => x.name === check.photoBefore) ?? null;
  const now = photos.find((x) => x.name === check.photoNow) ?? null;
  const mail = usePhotoMail({ routineTitle: check.routineTitle, contactName: name, before, now });
  const canSend = check.answers.some((a) => a.answer) || check.note.length > 0;
  const error = send.error ?? takeBack.error;

  const remove = () => Alert.alert(
    'Check-in löschen?',
    check.sent ? `Er verschwindet von diesem Handy. Bei ${name} bleibt er, bis du ihn zurücknimmst.` : 'Er verschwindet von diesem Handy. Deine Fotos bleiben.',
    [{ text: 'Abbrechen', style: 'cancel' }, { text: 'Löschen', style: 'destructive', onPress: () => removeCheckIn(check.id) }],
  );
  const back = () => Alert.alert(
    'Zurücknehmen?',
    `${name} sieht diesen Check-in dann nicht mehr. Auf deinem Handy bleibt er.`,
    [{ text: 'Abbrechen', style: 'cancel' }, { text: 'Zurücknehmen', style: 'destructive', onPress: () => takeBack.mutate(check) }],
  );

  return (
    <Card style={{ padding: space.l, gap: space.m }}>
      {mail.element}
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)} style={{ gap: space.m }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="caption" color={p.accent}>{check.final ? 'Abschluss-Check' : 'Check-in'}</Txt>
            <Txt variant="heading">{dayText(check.day)}</Txt>
            <Txt variant="small" muted numberOfLines={1}>{check.routineTitle}</Txt>
          </View>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={p.textMuted} />
        </View>
        {check.answers.some((a) => a.answer) ? <AnswerCounts answers={check.answers} /> : null}
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <Ionicons name={check.sent ? 'paper-plane-outline' : 'phone-portrait-outline'} size={14} color={p.textMuted} />
        <Txt variant="small" muted style={{ flex: 1 }}>{check.sent ? `An ${name} geschickt` : 'Nur auf deinem Handy'}</Txt>
      </View>
      {open ? (
        <View style={{ gap: space.m }}>
          {before && now && photosVisible ? <PhotoPair before={before} now={now} /> : null}
          {check.answers.map((a) => (
            <View key={`${a.group}:${a.title}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
              <Txt style={{ flex: 1 }}>{a.title}</Txt>
              <Txt variant="small" color={a.answer ? p.accent : p.textMuted} style={{ fontWeight: '600' }}>{a.answer ? ANSWER_LABELS[a.answer] : 'Keine Antwort'}</Txt>
            </View>
          ))}
          {check.note ? (
            <View style={{ gap: 2 }}>
              <Txt variant="small" muted>Deine Notiz</Txt>
              <Txt>{check.note}</Txt>
            </View>
          ) : null}
          {error ? <Txt variant="small" color={p.danger}>{errorText(error)}</Txt> : null}
          <View style={{ gap: space.xs }}>
            {check.sent
              ? <Button label="Zurücknehmen" kind="secondary" loading={takeBack.isPending} onPress={back} />
              : canSend ? <Button label={`An ${name} schicken`} kind="secondary" loading={send.isPending} onPress={() => send.mutate(check)} /> : null}
            {mail.canMail && Platform.OS !== 'web' ? <Button label="Fotos per Mail schicken" kind="secondary" onPress={() => void mail.mail()} /> : null}
            <Button label="Von diesem Handy löschen" kind="ghost" onPress={remove} />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

export default function CheckInsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const checks = useCheckIns();
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  useFocusEffect(useCallback(() => { setPhotos(listPhotos()); }, []));
  return (
    <Screen contentStyle={{ gap: space.l }}>
      {id ? <Button label="Neuer Check-in" onPress={() => openCheckIn(id)} /> : null}
      {checks.length === 0 ? <Txt muted>Hier siehst du später deine Check-ins. Sie bleiben auf deinem Handy, bis du einen selbst verschickst.</Txt> : null}
      {checks.map((c) => <CheckCard key={c.id} check={c} photos={photos} />)}
    </Screen>
  );
}
