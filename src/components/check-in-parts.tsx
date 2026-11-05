// The parts of the check-in (lib/progress-check.ts): the suggestion on the routine pages, one question with its three answers, the count of the answers,
// the photos side by side, and the mail with the photos: the phone's mail form with both files, or, on a phone without a mail account there,
// one picture of both for the share sheet.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as MailComposer from 'expo-mail-composer';
import { router, type Href } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useRef, type ComponentRef } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { Card, Txt } from '@/components/ui';
import {
  ANSWER_LABELS, countAnswers, openCheckIn, snoozeCheckIn, useCheckDue, useCheckIns, useSupportEmail, type AnswerValue, type CheckAnswer, type CheckDue,
} from '@/lib/progress-check';
import type { MemberRoutine, ProgressPhoto } from '@/lib/routine';
import { radius, space, usePalette } from '@/lib/theme';

const CHOICES: readonly AnswerValue[] = ['yes', 'some', 'no'];

/** One question: title, question and the three answers; a second tap takes the answer back. */
export function AnswerRow({ title, question, value, onChange }: { title: string; question: string; value: AnswerValue | null; onChange: (v: AnswerValue | null) => void }) {
  const p = usePalette();
  return (
    <View style={{ gap: space.s, padding: space.m, borderRadius: radius.l, backgroundColor: p.surface }}>
      <View style={{ gap: 2 }}>
        <Txt variant="heading">{title}</Txt>
        <Txt muted>{question}</Txt>
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel={question} style={{ flexDirection: 'row', gap: space.xs }}>
        {CHOICES.map((c) => {
          const on = value === c;
          return (
            <Pressable
              key={c}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => onChange(on ? null : c)}
              style={({ pressed }) => ({ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xs, borderRadius: radius.m, backgroundColor: on ? p.accent : p.surfaceAlt, opacity: pressed ? 0.8 : 1 })}
            >
              <Txt variant="small" color={on ? p.onAccent : p.text} style={{ fontWeight: '600', textAlign: 'center' }}>{ANSWER_LABELS[c]}</Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** How often each answer was given. */
export function AnswerCounts({ answers }: { answers: readonly CheckAnswer[] }) {
  const p = usePalette();
  const n = countAnswers(answers);
  return (
    <View style={{ flexDirection: 'row', gap: space.s }}>
      {CHOICES.map((c) => (
        <View key={c} accessibilityLabel={`${n[c]} mal ${ANSWER_LABELS[c]}`} style={{ flex: 1, alignItems: 'center', gap: 2, padding: space.m, borderRadius: radius.m, backgroundColor: p.surfaceAlt }}>
          <Txt variant="title" style={{ fontVariant: ['tabular-nums'] }}>{n[c]}</Txt>
          <Txt variant="small" muted style={{ textAlign: 'center' }}>{ANSWER_LABELS[c]}</Txt>
        </View>
      ))}
    </View>
  );
}

/** Two photos side by side, each with its label and day. */
export function PhotoPair({ before, now }: { before: ProgressPhoto; now: ProgressPhoto }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.s }}>
      {[{ photo: before, label: 'Vorher' }, { photo: now, label: 'Jetzt' }].map(({ photo, label }) => (
        <View key={label} style={{ flex: 1, aspectRatio: 3 / 4, borderRadius: radius.l, overflow: 'hidden' }}>
          <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={`${label}, ${photo.takenAt.toLocaleDateString('de-DE')}`} />
          <View style={{ position: 'absolute', left: space.s, bottom: space.s, paddingHorizontal: space.s, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)' }}>
            <Txt variant="small" color="#FFFFFF" style={{ fontSize: 12, lineHeight: 16, fontWeight: '600' }}>{label} · {photo.takenAt.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</Txt>
          </View>
        </View>
      ))}
    </View>
  );
}

const CAPTURE_W = 720;

/** `mail(photos)` opens the mail with the photos; render `element` once in the screen (the picture for the share sheet is drawn off screen). */
export function usePhotoMail({ routineTitle, contactName, before, now }: { routineTitle: string; contactName: string; before: ProgressPhoto | null; now: ProgressPhoto | null }) {
  const to = useSupportEmail();
  const ref = useRef<ComponentRef<typeof View>>(null);
  const photos = [before, now].filter((x): x is ProgressPhoto => !!x);

  const mail = async () => {
    try {
      if (await MailComposer.isAvailableAsync()) {
        await MailComposer.composeAsync({
          recipients: to ? [to] : [],
          subject: `Mein Check-in: ${routineTitle}`,
          body: `Hallo ${contactName},\n\nhier sind meine Fotos vom Check-in.\n\n`,
          attachments: photos.map((x) => x.uri),
        });
        return;
      }
      if (!ref.current || !(await Sharing.isAvailableAsync())) {
        Alert.alert('Das geht auf diesem Handy nicht', 'Auf diesem Handy ist keine Mail-App eingerichtet.');
        return;
      }
      const uri = await captureRef(ref, { format: 'jpg', quality: 0.9, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: to ? `Fotos an ${to}` : 'Fotos schicken' });
    } catch {
      Alert.alert('Das hat nicht geklappt', 'Die Fotos konnten nicht vorbereitet werden.');
    }
  };

  const element = photos.length > 0 ? (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={{ position: 'absolute', left: -CAPTURE_W * 3, top: 0 }}>
      <View ref={ref} collapsable={false} style={{ width: CAPTURE_W * photos.length, height: CAPTURE_W * (4 / 3), flexDirection: 'row', backgroundColor: '#000000' }}>
        {photos.map((x) => <Image key={x.name} source={{ uri: x.uri }} style={{ width: CAPTURE_W, height: '100%' }} contentFit="cover" />)}
      </View>
    </View>
  ) : null;

  return { mail, element, canMail: photos.length > 0 };
}

/** The suggestion: voluntary, one tap away, "Jetzt nicht" puts it off. */
export function CheckInCard({ routine, due }: { routine: MemberRoutine; due: CheckDue }) {
  const p = usePalette();
  const final = due === 'final';
  return (
    <Card accessibilityLabel={final ? 'Dein Abschluss-Check' : 'Zeit für deinen Check-in'} style={{ padding: space.l, gap: space.m, backgroundColor: p.accentSoft, borderColor: 'transparent' }}>
      <View style={{ flexDirection: 'row', gap: space.m }}>
        <Ionicons name={final ? 'ribbon-outline' : 'clipboard-outline'} size={26} color={p.accent} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="heading">{final ? 'Dein Abschluss-Check' : 'Zeit für deinen Check-in'}</Txt>
          <Txt variant="small" muted>{final ? 'Vergleich deine Fotos und schau, was sich getan hat. Ganz freiwillig.' : 'Zwei Minuten: Fotos vergleichen und kurz in dich hineinhören. Ganz freiwillig.'}</Txt>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
        <Pressable accessibilityRole="button" onPress={() => openCheckIn(routine.id)} style={({ pressed }) => ({ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.m, backgroundColor: p.accent, opacity: pressed ? 0.85 : 1 })}>
          <Txt variant="small" color={p.onAccent} style={{ fontWeight: '700' }}>Los geht’s</Txt>
        </Pressable>
        <Pressable accessibilityRole="button" hitSlop={6} onPress={() => snoozeCheckIn(routine.id, due)} style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', paddingHorizontal: space.m, opacity: pressed ? 0.6 : 1 })}>
          <Txt variant="small" color={p.accent} style={{ fontWeight: '600' }}>Jetzt nicht</Txt>
        </Pressable>
      </View>
    </Card>
  );
}

/** The suggestion of a routine, when one is due. */
export function CheckInSuggestion({ routine }: { routine: MemberRoutine }) {
  const due = useCheckDue(routine);
  return due ? <CheckInCard routine={routine} due={due} /> : null;
}

/** The way to the check-ins done so far; only where the coach offers them or there are some. */
export function CheckInsRow({ routine }: { routine: MemberRoutine | null }) {
  const p = usePalette();
  const all = useCheckIns();
  if (!routine?.progressCheck && all.length === 0) return null;
  const open = () => router.push({ pathname: '/routine/check-ins', params: routine?.progressCheck ? { id: routine.id } : {} } as unknown as Href);
  return (
    <Card onPress={open} accessibilityLabel="Deine Check-ins" style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="clipboard-outline" size={22} color={p.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="heading">Deine Check-ins</Txt>
        <Txt variant="small" muted>{all.length === 0 ? 'Noch keiner. Du kannst jederzeit einen machen.' : all.length === 1 ? '1 Check-in gespeichert' : `${all.length} Check-ins gespeichert`}</Txt>
      </View>
      <Ionicons name="chevron-forward" size={18} color={p.textMuted} />
    </Card>
  );
}
