// Routine overview: today's routine (start it, or "heute erledigt"), the streak (days in a row, best, total), the last
// five weeks as a calendar, the daily reminder and the progress photos. Several routines of the community are listed
// one below the other; streak and calendar belong to the first (the main routine).
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, ErrorView, Loading, MenuGroup, Screen, Section, ToggleRow, Txt } from '@/components/ui';
import { minutes, plural } from '@/lib/format';
import { localDay } from '@/lib/nav';
import { applyReminder, DEFAULT_REMINDER, listPhotos, loadReminder, useRoutines, type MemberRoutine, type ProgressPhoto, type Reminder } from '@/lib/routine';
import { useSession } from '@/lib/session';
import { radius, space, usePalette } from '@/lib/theme';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

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

function StreakCard({ routine }: { routine: MemberRoutine }) {
  const p = usePalette();
  const { stats } = routine;
  const done = new Set(stats.days);
  const today = localDay();
  return (
    <Card style={{ padding: space.l, gap: space.l }}>
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
    </Card>
  );
}

function ReminderCard({ routineTitle }: { routineTitle: string }) {
  const p = usePalette();
  const [r, setR] = useState<Reminder>(DEFAULT_REMINDER);
  const [showPicker, setShowPicker] = useState(false);
  useEffect(() => { void loadReminder().then(setR); }, []);

  const update = async (next: Reminder) => {
    setR(next);
    const ok = await applyReminder(next, routineTitle);
    if (!ok && next.enabled) {
      setR({ ...next, enabled: false });
      Alert.alert('Mitteilungen sind aus', 'Erlaube Mitteilungen für die App in den Einstellungen deines Handys, dann klappt die Erinnerung.');
    }
  };
  const time = `${String(r.hour).padStart(2, '0')}:${String(r.minute).padStart(2, '0')} Uhr`;
  const asDate = new Date();
  asDate.setHours(r.hour, r.minute, 0, 0);

  return (
    <View style={{ gap: space.s }}>
      <MenuGroup>
        <ToggleRow label="Tägliche Erinnerung" help={r.enabled ? `Jeden Tag um ${time}` : 'Eine Mitteilung, wenn es Zeit für die Routine ist.'} value={r.enabled} onValueChange={(enabled) => void update({ ...r, enabled })} />
        {r.enabled ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Uhrzeit ändern" onPress={() => setShowPicker((s) => !s)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l, backgroundColor: p.surface }}>
            <Ionicons name="time-outline" size={22} color={p.accent} />
            <Txt variant="heading" style={{ flex: 1 }}>Uhrzeit</Txt>
            <Txt color={p.accent} variant="heading">{time}</Txt>
          </Pressable>
        ) : null}
      </MenuGroup>
      {showPicker && r.enabled && Platform.OS !== 'web' ? (
        <DateTimePicker
          value={asDate}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            if (Platform.OS !== 'ios') setShowPicker(false);
            if (event.type === 'set' && date) void update({ ...r, hour: date.getHours(), minute: date.getMinutes() });
          }}
        />
      ) : null}
    </View>
  );
}

function PhotosCard() {
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
      {first && last && first !== last ? (
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

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  const [main, ...more] = q.data;

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
          {[main, ...more].map((r) => (
            <Card key={r.id} style={{ padding: space.l, gap: space.m, backgroundColor: r === main ? p.accentSoft : p.surface }}>
              <View style={{ gap: space.xs }}>
                <Txt variant="caption" color={p.accent}>{r.stats.doneToday ? 'Heute erledigt' : 'Heute'}</Txt>
                <Txt variant="title">{r.title}</Txt>
                <Txt muted>{plural(r.steps.length, 'Übung', 'Übungen')} · {minutes(r.totalSec)}</Txt>
                {r.description ? <Txt variant="small" muted numberOfLines={3}>{r.description}</Txt> : null}
              </View>
              <Button
                label={r.stats.doneToday ? 'Noch einmal machen' : 'Routine starten'}
                kind={r.stats.doneToday ? 'secondary' : 'primary'}
                onPress={() => router.push(`/routine/${encodeURIComponent(r.id)}` as Href)}
              />
            </Card>
          ))}
          <Section title="Deine Serie">
            <StreakCard routine={main} />
          </Section>
          <ReminderCard routineTitle={main.title} />
        </>
      )}

      <PhotosCard />
    </Screen>
  );
}
