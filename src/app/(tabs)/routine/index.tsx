// Routine overview: today's routine (length short / normal / long, start it, or "heute erledigt"), a challenge when the
// coach made the routine one ("Tag 12 von 30"), the streak (days in a row, best, total) with the last five weeks and a
// share picture, the badges, the reminders (daily, "Serie retten" in the evening, weekly photo) and the progress photos
// (optionally behind Face ID). Several routines are listed one below the other; streak and badges belong to the first.
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShareCard } from '@/components/share-card';
import { Button, Card, ErrorView, Loading, MenuGroup, ProgressBar, Screen, Section, ToggleRow, Txt } from '@/components/ui';
import { errorText } from '@/lib/api';
import { minutes, plural } from '@/lib/format';
import { localDay } from '@/lib/nav';
import { unlockPhotos, usePhotosVisible } from '@/lib/photo-lock';
import {
  allowNotifications, badgesOf, LENGTH_LABEL, listPhotos, scaledDuration, syncReminders, useChallenge, useRoutinePrefs, useRoutines,
  type MemberRoutine, type ProgressPhoto, type RoutineLength,
} from '@/lib/routine';
import { useSession } from '@/lib/session';
import { radius, space, usePalette } from '@/lib/theme';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const LENGTHS: RoutineLength[] = ['short', 'normal', 'long'];

/** The last five weeks (Monday to Sunday) ending with this week, as YYYY-MM-DD; days after today are null. */
function calendarWeeks(today = new Date()): (string | null)[][] {
  const start = new Date(today);
  start.setHours(12, 0, 0, 0);
  const weekday = (start.getDay() + 6) % 7; // Monday = 0
  start.setDate(start.getDate() - weekday - 28);
  const todayKey = localDay(today);
  const weeks: (string | null)[][] = [];
  for (let w = 0; w < 5; w++) {
    const week: (string | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      const key = localDay(day);
      week.push(key > todayKey ? null : key);
    }
    weeks.push(week);
  }
  return weeks;
}

function LengthPicker({ value, onChange, totalFor }: { value: RoutineLength; onChange: (l: RoutineLength) => void; totalFor: (l: RoutineLength) => number }) {
  const p = usePalette();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: p.surface, borderRadius: radius.l, padding: 4, gap: 4 }}>
      {LENGTHS.map((l) => {
        const on = l === value;
        return (
          <Pressable
            key={l}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(l)}
            style={{ flex: 1, alignItems: 'center', paddingVertical: space.s, borderRadius: radius.m, backgroundColor: on ? p.accent : 'transparent' }}
          >
            <Txt variant="heading" color={on ? p.onAccent : p.text}>{LENGTH_LABEL[l]}</Txt>
            <Txt variant="small" color={on ? p.onAccent : p.textMuted}>{minutes(totalFor(l))}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

function ChallengeBlock({ routine }: { routine: MemberRoutine }) {
  const p = usePalette();
  const ch = routine.challenge;
  const mutate = useChallenge(routine.id);
  if (!ch) return null;
  const started = ch.startDay !== null && ch.dayNumber !== null;
  const leave = () => Alert.alert('Challenge verlassen?', 'Deine erledigten Tage bleiben in deiner Serie. Du kannst jederzeit neu starten.', [
    { text: 'Abbrechen', style: 'cancel' },
    { text: 'Verlassen', style: 'destructive', onPress: () => mutate.mutate(false) },
  ]);
  return (
    <View style={{ gap: space.s, padding: space.m, borderRadius: radius.l, backgroundColor: p.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
        <Ionicons name={ch.completed ? 'trophy' : 'calendar-outline'} size={20} color={p.accent} />
        <Txt variant="heading" style={{ flex: 1 }}>{ch.days}-Tage-Challenge</Txt>
        {started && !ch.completed ? <Txt variant="small" muted>Tag {Math.min(ch.dayNumber ?? 1, ch.days)} von {ch.days}</Txt> : null}
      </View>
      {ch.completed ? (
        <Txt>Geschafft! Du hast alle {ch.days} Tage gemacht.</Txt>
      ) : started ? (
        <>
          <ProgressBar value={ch.doneDays / ch.days} />
          <Txt variant="small" muted>{ch.doneDays} von {ch.days} Tagen erledigt</Txt>
        </>
      ) : (
        <Txt variant="small" muted>Starte heute und mach die Routine {ch.days} Tage lang – die App zählt mit.</Txt>
      )}
      {mutate.isError ? <Txt variant="small" color={p.danger}>{errorText(mutate.error)}</Txt> : null}
      {!started || ch.completed ? (
        <Button label={ch.completed ? 'Noch einmal starten' : 'Challenge starten'} kind="secondary" onPress={() => mutate.mutate(true)} loading={mutate.isPending} />
      ) : (
        <Pressable accessibilityRole="button" onPress={leave} hitSlop={8}><Txt variant="small" muted>Challenge verlassen</Txt></Pressable>
      )}
    </View>
  );
}

function RoutineCard({ routine, main }: { routine: MemberRoutine; main: boolean }) {
  const p = usePalette();
  const [prefs, update] = useRoutinePrefs();
  const totalFor = (l: RoutineLength) => routine.steps.reduce((sum, s) => sum + scaledDuration(s.durationSec, l), 0);
  return (
    <Card style={{ padding: space.l, gap: space.m, backgroundColor: main ? p.accentSoft : p.surface }}>
      <View style={{ gap: space.xs }}>
        <Txt variant="caption" color={p.accent}>{routine.stats.doneToday ? 'Heute erledigt' : 'Heute'}</Txt>
        <Txt variant="title">{routine.title}</Txt>
        <Txt muted>{plural(routine.steps.length, 'Übung', 'Übungen')} · {minutes(totalFor(prefs.length))}</Txt>
        {routine.description ? <Txt variant="small" muted numberOfLines={3}>{routine.description}</Txt> : null}
      </View>
      <LengthPicker value={prefs.length} onChange={(length) => update({ length })} totalFor={totalFor} />
      <ChallengeBlock routine={routine} />
      <Button
        label={routine.stats.doneToday ? 'Noch einmal machen' : 'Routine starten'}
        kind={routine.stats.doneToday ? 'secondary' : 'primary'}
        onPress={() => router.push(`/routine/${encodeURIComponent(routine.id)}` as Href)}
      />
    </Card>
  );
}

function StreakCard({ routine }: { routine: MemberRoutine }) {
  const p = usePalette();
  const { stats } = routine;
  const done = new Set(stats.days);
  const today = localDay();
  const card = useShareCard({ big: String(stats.streak), label: stats.streak === 1 ? 'Tag in Folge' : 'Tage in Folge', line: routine.title });
  return (
    <Card style={{ padding: space.l, gap: space.l }}>
      {card.element}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="flame" size={30} color={p.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="display">{stats.streak}</Txt>
          <Txt muted>{stats.streak === 1 ? 'Tag in Folge' : 'Tage in Folge'}</Txt>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Txt variant="small" muted>Bestwert {stats.bestStreak}</Txt>
          <Txt variant="small" muted>{plural(stats.totalDays, 'Tag', 'Tage')} gesamt</Txt>
        </View>
      </View>
      <View style={{ gap: space.xs }}>
        <View style={{ flexDirection: 'row' }}>
          {WEEKDAYS.map((d) => <Txt key={d} variant="caption" muted style={{ flex: 1, textAlign: 'center' }}>{d}</Txt>)}
        </View>
        {calendarWeeks().map((week, i) => (
          <View key={i} style={{ flexDirection: 'row' }}>
            {week.map((day, j) => {
              const isDone = !!day && done.has(day);
              const isToday = day === today;
              return (
                <View key={j} style={{ flex: 1, alignItems: 'center', paddingVertical: 3 }}>
                  <View
                    accessibilityLabel={day ? `${day}${isDone ? ', erledigt' : ''}` : undefined}
                    style={{
                      width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: isDone ? p.accent : day ? p.surfaceAlt : 'transparent',
                      borderWidth: isToday ? 2 : 0, borderColor: p.accent,
                    }}
                  >
                    {isDone ? <Ionicons name="checkmark" size={16} color={p.onAccent} /> : day ? <Txt variant="small" muted>{Number(day.slice(8))}</Txt> : null}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </View>
      {stats.streak > 0 && Platform.OS !== 'web' ? <Button label="Serie teilen" kind="secondary" onPress={() => void card.share()} /> : null}
    </Card>
  );
}

function BadgesCard({ routine }: { routine: MemberRoutine }) {
  const p = usePalette();
  const badges = badgesOf(routine.stats);
  const earned = badges.filter((b) => b.earned).length;
  return (
    <Section title="Abzeichen" action={<Txt variant="small" muted>{earned} von {badges.length}</Txt>}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {badges.map((b) => (
          <View
            key={b.id}
            accessibilityLabel={`${b.detail}${b.earned ? ', erreicht' : ', noch nicht erreicht'}`}
            style={{ width: '23%', alignItems: 'center', gap: 4, paddingVertical: space.m, borderRadius: radius.l, backgroundColor: b.earned ? p.accentSoft : p.surface, borderWidth: 1, borderColor: p.line, opacity: b.earned ? 1 : 0.55 }}
          >
            <Ionicons name={b.earned ? b.icon : 'lock-closed-outline'} size={26} color={b.earned ? p.accent : p.textMuted} />
            <Txt variant="small" style={{ fontWeight: '700' }}>{b.label}</Txt>
          </View>
        ))}
      </View>
      <Txt variant="small" muted>Flammen für Tage in Folge, Sterne für Tage insgesamt.</Txt>
    </Section>
  );
}

function RemindersCard({ routine }: { routine: MemberRoutine | null }) {
  const p = usePalette();
  const [prefs, update] = useRoutinePrefs();
  const [showPicker, setShowPicker] = useState(false);

  const turnOn = async (patch: Parameters<typeof update>[0]) => {
    if (!(await allowNotifications())) {
      Alert.alert('Mitteilungen sind aus', 'Erlaube Mitteilungen für die App in den Einstellungen deines Handys, dann klappen die Erinnerungen.');
      return;
    }
    await syncReminders(update(patch), routine);
  };
  const set = (patch: Parameters<typeof update>[0], on: boolean) => {
    if (on) void turnOn(patch);
    else void syncReminders(update(patch), routine);
  };
  const time = `${String(prefs.hour).padStart(2, '0')}:${String(prefs.minute).padStart(2, '0')} Uhr`;
  const asDate = new Date();
  asDate.setHours(prefs.hour, prefs.minute, 0, 0);

  return (
    <Section title="Erinnerungen">
      <MenuGroup>
        {routine ? <ToggleRow label="Tägliche Erinnerung" help={prefs.reminder ? `Jeden Tag um ${time}` : 'Eine Mitteilung, wenn es Zeit für die Routine ist.'} value={prefs.reminder} onValueChange={(v) => set({ reminder: v }, v)} /> : null}
        {routine && prefs.reminder ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Uhrzeit ändern" onPress={() => setShowPicker((s) => !s)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l, backgroundColor: p.surface }}>
            <Ionicons name="time-outline" size={22} color={p.accent} />
            <Txt variant="heading" style={{ flex: 1 }}>Uhrzeit</Txt>
            <Txt color={p.accent} variant="heading">{time}</Txt>
          </Pressable>
        ) : null}
        {routine ? <ToggleRow label="Serie retten" help="Um 20 Uhr, falls du die Routine heute noch nicht gemacht hast." value={prefs.rescue} onValueChange={(v) => set({ rescue: v }, v)} /> : null}
        <ToggleRow label="Wöchentliches Foto" help="Sonntags um 10 Uhr eine Erinnerung an dein Fortschrittsfoto." value={prefs.photoReminder} onValueChange={(v) => set({ photoReminder: v }, v)} />
      </MenuGroup>
      {showPicker && prefs.reminder && Platform.OS !== 'web' ? (
        <DateTimePicker
          value={asDate}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            if (Platform.OS !== 'ios') setShowPicker(false);
            if (event.type === 'set' && date) void syncReminders(update({ hour: date.getHours(), minute: date.getMinutes() }), routine);
          }}
        />
      ) : null}
    </Section>
  );
}

function PhotosCard() {
  const p = usePalette();
  const [prefs] = useRoutinePrefs();
  const visible = usePhotosVisible(prefs.photoLock);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  useFocusEffect(useCallback(() => { setPhotos(listPhotos()); }, []));
  const first = photos[0];
  const last = photos[photos.length - 1];
  return (
    <Card style={{ padding: space.l, gap: space.m }}>
      <View style={{ gap: 2 }}>
        <Txt variant="heading">Fortschrittsfotos</Txt>
        <Txt variant="small" muted>Einmal pro Woche ein Foto im gleichen Licht – so siehst du, was sich verändert. Die Fotos bleiben nur auf deinem Handy.</Txt>
      </View>
      {photos.length > 0 && !visible ? (
        <Pressable accessibilityRole="button" onPress={() => void unlockPhotos()} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, padding: space.m, borderRadius: radius.m, backgroundColor: p.surfaceAlt }}>
          <Ionicons name="lock-closed" size={20} color={p.accent} />
          <Txt variant="heading" style={{ flex: 1 }}>Fotos entsperren</Txt>
        </Pressable>
      ) : first && last && first !== last ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Vergleich ansehen" onPress={() => router.push('/routine/fotos' as Href)} style={{ flexDirection: 'row', gap: space.s }}>
          {[first, last].map((ph, i) => (
            <View key={ph.name} style={{ flex: 1, gap: space.xs }}>
              <Image source={{ uri: ph.uri }} style={{ aspectRatio: 3 / 4, borderRadius: radius.m }} contentFit="cover" />
              <Txt variant="small" muted>{i === 0 ? 'Vorher' : 'Jetzt'} · {ph.takenAt.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</Txt>
            </View>
          ))}
        </Pressable>
      ) : last ? (
        <Image source={{ uri: last.uri }} style={{ width: 120, aspectRatio: 3 / 4, borderRadius: radius.m }} contentFit="cover" />
      ) : null}
      <View style={{ flexDirection: 'row', gap: space.m }}>
        <Button label="Foto machen" onPress={() => router.push('/routine/kamera' as Href)} style={{ flex: 1 }} />
        {photos.length > 0 ? <Button label="Alle Fotos" kind="secondary" onPress={() => router.push('/routine/fotos' as Href)} style={{ flex: 1 }} /> : null}
      </View>
    </Card>
  );
}

export default function RoutineScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { community } = useSession();
  const q = useRoutines();
  const [prefs] = useRoutinePrefs();
  const main = q.data?.[0] ?? null;

  // keep the scheduled reminders in line with today's state (e.g. no "Serie retten" once today is done)
  useEffect(() => {
    if (q.data) void syncReminders(prefs, main);
  }, [q.data, prefs, main]);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching} contentStyle={{ paddingTop: insets.top + space.l, gap: space.xl }}>
      <Txt variant="display">Routine</Txt>

      {!main ? (
        <Card style={{ padding: space.xl, gap: space.s }}>
          <Ionicons name="flame-outline" size={32} color={p.accent} />
          <Txt variant="title">Noch keine Routine</Txt>
          <Txt muted>Sobald {community?.name ?? 'deine Community'} eine tägliche Routine für dich anlegt, findest du sie hier – mit Timer, Erinnerung und deiner Serie.</Txt>
        </Card>
      ) : (
        <>
          {q.data.map((r) => <RoutineCard key={r.id} routine={r} main={r === main} />)}
          <Section title="Deine Serie">
            <StreakCard routine={main} />
          </Section>
          <BadgesCard routine={main} />
        </>
      )}

      <RemindersCard routine={main} />
      <PhotosCard />
    </Screen>
  );
}
