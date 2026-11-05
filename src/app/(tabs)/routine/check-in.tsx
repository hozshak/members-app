// A check-in (lib/progress-check.ts), one thing per page: the photos with the tips of the coach, what the member sees, how it feels, the result with a note.
// "Speichern" keeps it on this phone, "An … schicken" also sends the answers and the note to the dashboard; the photos only ever leave in a mail of the member's own.
// The closing check-in on the last day of a plan adds the coach's closing words and uses the plan's after photo.
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnswerCounts, AnswerRow, PhotoPair, usePhotoMail } from '@/components/check-in-parts';
import { PhotoSlot } from '@/components/routine-parts';
import { Button, ErrorView, Field, Loading, Screen, Txt } from '@/components/ui';
import { errorText } from '@/lib/api';
import { localDay } from '@/lib/nav';
import { unlockPhotos, usePhotosVisible } from '@/lib/photo-lock';
import { usePlanPhotos } from '@/lib/plans';
import { checkDue, saveCheckIn, useCheckIns, useSendCheckIn, type AnswerValue, type CheckAnswer, type SavedCheck } from '@/lib/progress-check';
import { clockTime, listPhotos, useRoutinePrefs, useRoutines, type MemberRoutine, type ProgressCheckConfig, type ProgressPhoto } from '@/lib/routine';
import { useSession } from '@/lib/session';
import { radius, space, usePalette } from '@/lib/theme';

/** From this many hours apart the time of day of two photos is worth a word (the coach: morning and evening is no fair comparison). */
const OTHER_TIME_HOURS = 4;

type Step = 'photos' | 'looks' | 'feels' | 'result';

function Wizard({ routine, config }: { routine: MemberRoutine; config: ProgressCheckConfig }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { community } = useSession();
  const [prefs] = useRoutinePrefs();
  const photosVisible = usePhotosVisible(prefs.photoLock);
  const planPhotos = usePlanPhotos(routine.id);
  const mine = useCheckIns(routine.id);
  const send = useSendCheckIn();
  // fixed when the check-in opens: saving it must not change what this one is
  const [final] = useState(() => checkDue(routine, mine) === 'final');
  const [last] = useState(() => mine[0] ?? null);
  const steps: Step[] = ['photos', ...(config.looks.length > 0 ? ['looks' as const] : []), ...(config.feels.length > 0 ? ['feels' as const] : []), 'result'];
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<Record<string, AnswerValue | null>>({});
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState<SavedCheck | null>(null);
  const [all, setAll] = useState<ProgressPhoto[]>([]);
  useFocusEffect(useCallback(() => { setAll(listPhotos()); }, []));

  const step = steps[index] ?? 'result';
  const who = config.contactName || community?.name || 'deinen Coach';
  const before = all.find((x) => x.name === planPhotos.start) ?? all[0] ?? null;
  const newest = all[all.length - 1] ?? null;
  const now = newest && newest !== before && localDay(newest.takenAt) === localDay() ? newest : null;
  const otherTime = before && now && Math.abs(before.takenAt.getHours() - now.takenAt.getHours()) >= OTHER_TIME_HOURS;
  const mail = usePhotoMail({ routineTitle: routine.title, contactName: config.contactName || community?.name || '', before, now });
  const answers: CheckAnswer[] = [
    ...config.looks.map((q, i) => ({ group: 'look' as const, title: q.title, question: q.question, answer: picked[`look:${i}`] ?? null })),
    ...config.feels.map((q, i) => ({ group: 'feel' as const, title: q.title, question: q.question, answer: picked[`feel:${i}`] ?? null })),
  ];
  const anything = answers.some((a) => a.answer) || note.trim().length > 0;
  const heading = final ? 'Dein Abschluss-Check' : 'Dein Check-in';

  const camera = () => router.push((final ? { pathname: '/routine/kamera', params: { plan: routine.id, slot: 'end' } } : '/routine/kamera') as unknown as Href);
  const close = () => {
    if (!anything || saved) {
      router.back();
      return;
    }
    Alert.alert('Check-in abbrechen?', 'Deine Antworten werden nicht gespeichert.', [
      { text: 'Weitermachen', style: 'cancel' },
      { text: 'Abbrechen', style: 'destructive', onPress: () => router.back() },
    ]);
  };
  const keep = (): SavedCheck => {
    const check = saveCheckIn({
      routineId: routine.id, routineTitle: routine.title, day: localDay(), final, answers, note: note.trim(), photoBefore: before?.name ?? null, photoNow: now?.name ?? null,
    });
    setSaved(check);
    return check;
  };

  const questions = (group: 'look' | 'feel') => (group === 'look' ? config.looks : config.feels).map((q, i) => (
    <AnswerRow
      key={`${group}:${i}`}
      title={q.title}
      question={q.question}
      value={picked[`${group}:${i}`] ?? null}
      onChange={(v) => setPicked((x) => ({ ...x, [`${group}:${i}`]: v }))}
    />
  ));
  const pair = before && now && photosVisible ? <PhotoPair before={before} now={now} /> : null;

  // ---------- done ----------
  if (saved) {
    // (from the store: "sent" comes in after saving)
    const current = mine.find((c) => c.id === saved.id) ?? saved;
    const isSent = !!current.sent;
    return (
      <Screen contentStyle={{ paddingTop: insets.top + space.xxl, gap: space.l }}>
        {mail.element}
        <View style={{ alignItems: 'center', gap: space.m }}>
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={isSent ? 'paper-plane' : 'checkmark'} size={44} color={p.accent} />
          </View>
          <Txt variant="display" style={{ textAlign: 'center' }}>{isSent ? 'Geschickt' : 'Gespeichert'}</Txt>
          <Txt muted style={{ textAlign: 'center' }}>
            {isSent
              ? `${who} sieht jetzt deine Antworten und deine Notiz. Deine Fotos bleiben auf deinem Handy.`
              : 'Dein Check-in bleibt nur auf deinem Handy. Du findest ihn unter „Deine Check-ins“.'}
          </Txt>
        </View>
        {send.isError ? <Txt color={p.danger} style={{ textAlign: 'center' }}>{errorText(send.error)}</Txt> : null}
        <View style={{ gap: space.s }}>
          {!isSent && anything ? <Button label={`Doch an ${who} schicken`} kind="secondary" loading={send.isPending} onPress={() => send.mutate(current)} /> : null}
          {mail.canMail && Platform.OS !== 'web' ? (
            <View style={{ gap: space.xs }}>
              <Button label="Fotos per Mail schicken" kind="secondary" onPress={() => void mail.mail()} />
              <Txt variant="small" muted style={{ textAlign: 'center' }}>Öffnet deine Mail-App. Das entscheidest du jedes Mal selbst.</Txt>
            </View>
          ) : null}
          <Button label="Fertig" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  // ---------- the pages ----------
  const footer = step === 'photos' ? (
    <View style={{ gap: space.xs }}>
      {Platform.OS !== 'web' && !now ? <Button label="Foto machen" onPress={camera} /> : <Button label="Weiter" onPress={() => setIndex(index + 1)} />}
      {Platform.OS !== 'web' && !now ? <Button label="Ohne Foto weiter" kind="ghost" onPress={() => setIndex(index + 1)} /> : null}
    </View>
  ) : step !== 'result' ? (
    <Button label="Weiter" onPress={() => setIndex(index + 1)} />
  ) : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentStyle={{ paddingTop: insets.top + space.m, gap: space.l, paddingBottom: (footer ? 170 : space.xxl) + insets.bottom }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          {index > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Zurück" hitSlop={12} onPress={() => setIndex(index - 1)}>
              <Ionicons name="chevron-back" size={28} color={p.text} />
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel="Schließen" hitSlop={12} onPress={close}>
              <Ionicons name="close" size={28} color={p.text} />
            </Pressable>
          )}
          <View style={{ flex: 1, flexDirection: 'row', gap: 4 }} accessibilityLabel={`Schritt ${index + 1} von ${steps.length}`}>
            {steps.map((s, i) => <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= index ? p.accent : p.surfaceAlt }} />)}
          </View>
          {index > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Schließen" hitSlop={12} onPress={close}>
              <Ionicons name="close" size={28} color={p.text} />
            </Pressable>
          ) : null}
        </View>

        {step === 'photos' ? (
          <>
            <View style={{ gap: space.xs }}>
              <Txt variant="caption" color={p.accent}>{heading}</Txt>
              <Txt variant="display">Erst die Fotos</Txt>
              <Txt muted>Ganz freiwillig. Deine Fotos bleiben auf deinem Handy.</Txt>
            </View>
            {config.photoTips.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
                {config.photoTips.map((tip) => (
                  <View key={tip} style={{ flexBasis: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: 64, padding: space.m, borderRadius: radius.l, backgroundColor: p.surface }}>
                    <Ionicons name="checkmark-circle" size={20} color={p.accent} />
                    <Txt variant="small" style={{ flex: 1, fontWeight: '600' }}>{tip}</Txt>
                  </View>
                ))}
              </View>
            ) : null}
            {config.photoHint ? <Txt variant="small" muted>{config.photoHint}</Txt> : null}
            {before && !photosVisible ? (
              <Button label="Fotos entsperren" kind="secondary" onPress={() => void unlockPhotos()} />
            ) : (
              <View style={{ flexDirection: 'row', gap: space.s }}>
                <PhotoSlot label="Vorher" photo={before ?? undefined} empty={{ icon: 'image-outline', text: 'Noch kein Foto' }} />
                <PhotoSlot label="Jetzt" photo={now ?? undefined} empty={{ icon: 'camera-outline', text: 'Noch kein Foto von heute' }} onPress={Platform.OS !== 'web' ? camera : undefined} />
              </View>
            )}
            {before && !now && photosVisible ? (
              <Txt variant="small" muted>Dein Vorher-Foto ist von {clockTime(before.takenAt.getHours(), before.takenAt.getMinutes())}. Am besten machst du das neue zur gleichen Tageszeit.</Txt>
            ) : null}
            {otherTime ? <Txt variant="small" color={p.accent}>Dein neues Foto ist zu einer anderen Tageszeit entstanden als das Vorher-Foto. Das kann den Vergleich verfälschen.</Txt> : null}
          </>
        ) : null}

        {step === 'looks' ? (
          <>
            <View style={{ gap: space.xs }}>
              <Txt variant="caption" color={p.accent}>{heading}</Txt>
              <Txt variant="display">Was siehst du?</Txt>
              <Txt muted>Schau Stück für Stück hin. Beantworte nur, was du möchtest.</Txt>
            </View>
            {pair}
            {questions('look')}
          </>
        ) : null}

        {step === 'feels' ? (
          <>
            <View style={{ gap: space.xs }}>
              <Txt variant="caption" color={p.accent}>{heading}</Txt>
              <Txt variant="display">Wie fühlst du dich?</Txt>
              <Txt muted>Nicht nur die Fotos zählen. Das hier zählt genauso.</Txt>
            </View>
            {questions('feel')}
          </>
        ) : null}

        {step === 'result' ? (
          <>
            <View style={{ gap: space.xs }}>
              <Txt variant="caption" color={p.accent}>{heading}</Txt>
              <Txt variant="display">Dein Ergebnis</Txt>
            </View>
            {answers.some((a) => a.answer) ? <AnswerCounts answers={answers} /> : null}
            {last ? <Txt variant="small" muted>Beim letzten Mal ({new Date(`${last.day}T12:00:00`).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}): {last.answers.filter((a) => a.answer === 'yes').length} × Ja, {last.answers.filter((a) => a.answer === 'some').length} × Ein bisschen, {last.answers.filter((a) => a.answer === 'no').length} × Noch nicht</Txt> : null}
            {pair}
            {final && config.closing ? (
              <View style={{ gap: space.s, padding: space.l, borderRadius: radius.l, backgroundColor: p.accentSoft }}>
                <Ionicons name="ribbon-outline" size={26} color={p.accent} />
                <Txt>{config.closing}</Txt>
              </View>
            ) : config.encouragement ? (
              <View style={{ padding: space.l, borderRadius: radius.l, backgroundColor: p.surface }}>
                <Txt>{config.encouragement}</Txt>
              </View>
            ) : null}
            <Field label="Deine Notiz (freiwillig)" value={note} onChangeText={setNote} multiline maxLength={2000} placeholder="Was ist dir aufgefallen?" textAlignVertical="top" />
            <View style={{ gap: space.s }}>
              <Button label="Speichern" onPress={keep} />
              <Txt variant="small" muted style={{ textAlign: 'center' }}>Bleibt nur auf deinem Handy.</Txt>
              <Button
                label={`An ${who} schicken`}
                kind="secondary"
                disabled={!anything}
                loading={send.isPending}
                onPress={() => send.mutate(keep())}
              />
              <Txt variant="small" muted style={{ textAlign: 'center' }}>{who} sieht deine Antworten und deine Notiz, nicht deine Fotos. Du kannst das später zurücknehmen.</Txt>
            </View>
          </>
        ) : null}
      </Screen>
      {footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.m, backgroundColor: p.bg, borderTopColor: p.line }]}>{footer}</View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.l, paddingTop: space.m, borderTopWidth: StyleSheet.hairlineWidth },
});

export default function CheckInScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useRoutines();
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  const routine = q.data.find((r) => r.id === id);
  if (!routine?.progressCheck) return <ErrorView error={new Error('not_found')} onRetry={() => router.back()} />;
  return <Wizard routine={routine} config={routine.progressCheck} />;
}
