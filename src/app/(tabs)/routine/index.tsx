// Routine overview, the most important first: today's routine with the big start button, today's progress and this week
// at a glance; the exercises to tick off (all ticked = day done); the member's own goal ("Mein Ziel" with a progress bar
// and a forecast); a challenge when the coach made the routine one ("Tag 12 von 30"); the streak with the last five weeks
// and a share picture, the badges, the progress photos (optionally behind Face ID) and the reminders. The length is chosen
// on the start screen of the routine. Several routines follow as small cards; streak and badges belong to the first.
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShareCard } from '@/components/share-card';
import { openRoutine, ProgressRing, routineSeconds, WeekStrip } from '@/components/routine-parts';
import { Button, Card, ErrorView, Loading, MenuGroup, ProgressBar, Screen, Section, ToggleRow, Txt } from '@/components/ui';
import { errorText } from '@/lib/api';
import { clock, minutes, plural } from '@/lib/format';
import { goalProgress, useDayChecks, useGoal } from '@/lib/goal';
import { localDay } from '@/lib/nav';
import { unlockPhotos, usePhotosVisible } from '@/lib/photo-lock';
import {
  allowNotifications, badgesOf, cancelTodaysRescue, listPhotos, newBadges, scaledDuration, syncReminders, useChallenge, useCheckIn,
  useRoutinePrefs, useRoutines,
  type MemberRoutine, type ProgressPhoto,
} from '@/lib/routine';
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


/** "Mein Ziel": the goal in the member's words, a big bar (routine days done of those needed), this week as dots and a
 *  sentence that says how close it is ("Bleib dran: So erreichst du dein Ziel am 24. November."). */
function GoalCard({ routine }: { routine: MemberRoutine }) {
  const p = usePalette();
  const [goal] = useGoal();
  if (!goal) {
    return (
      <Card style={{ padding: space.l, gap: space.m }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="flag" size={24} color={p.accent} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="heading">Setz dir ein Ziel</Txt>
            <Txt variant="small" muted>Was willst du erreichen? Jeden Tag Routine bringt dich ein Stück näher – du siehst genau, wie weit.</Txt>
          </View>
        </View>
        <Button label="Ziel festlegen" onPress={() => router.push('/routine/ziel' as Href)} />
      </Card>
    );
  }
  const g = goalProgress(goal, routine.stats);
  return (
    <Card style={{ padding: space.l, gap: space.m }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
        <Ionicons name={g.reached ? 'trophy' : 'flag'} size={18} color={p.accent} />
        <Txt variant="caption" color={p.accent} style={{ flex: 1 }}>Mein Ziel</Txt>
        <Pressable accessibilityRole="button" accessibilityLabel="Ziel bearbeiten" hitSlop={10} onPress={() => router.push('/routine/ziel' as Href)}>
          <Ionicons name="create-outline" size={20} color={p.textMuted} />
        </Pressable>
      </View>
      <Txt variant="title">{goal.text}</Txt>
      <View style={{ gap: space.xs }}>
        <ProgressBar value={g.share} style={{ height: 14, borderRadius: 7 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt variant="small" muted>{g.done} von {g.target} Routine-Tagen</Txt>
          <Txt variant="small" style={{ fontWeight: '700' }} color={p.accent}>{Math.round(g.share * 100)} %</Txt>
        </View>
      </View>
      <Txt variant="heading" color={g.reached ? p.success : p.text}>{g.message}</Txt>
      <Txt variant="small" muted>Diese Woche: {g.weekDone} von {goal.perWeek} · Tag {g.dayOfGoal} von {goal.days}</Txt>
    </Card>
  );
}

/** Today's exercises to tick off; all ticked = the day is done (saved like after the timer). */
function TodayChecklist({ routine }: { routine: MemberRoutine }) {
  const p = usePalette();
  const checks = useDayChecks(routine.id);
  const checkIn = useCheckIn(routine.id);
  const [prefs] = useRoutinePrefs();
  const doneToday = routine.stats.doneToday;
  const ticked = routine.steps.filter((s) => doneToday || checks.isDone(s.id)).length;

  const toggle = (stepId: string) => {
    if (doneToday) return;
    const willBe = new Set(checks.done);
    if (willBe.has(stepId)) willBe.delete(stepId);
    else willBe.add(stepId);
    checks.toggle(stepId);
    if (routine.steps.every((s) => willBe.has(s.id)) && !checkIn.isPending) {
      const before = routine.stats;
      checkIn.mutate(true, {
        onSuccess: ({ stats }) => {
          void cancelTodaysRescue();
          const earned = newBadges(before, stats);
          Alert.alert(
            'Tag geschafft!',
            `${stats.streak === 1 ? 'Tag 1 deiner Serie.' : `${stats.streak} Tage in Folge.`}${earned.length ? `\nNeues Abzeichen: ${earned.map((b) => b.detail).join(', ')}` : ''}`,
          );
        },
      });
    }
  };

  return (
    <Section title="Heute abhaken" action={<Txt variant="small" muted>{ticked} von {routine.steps.length}</Txt>}>
      <View style={{ gap: space.s }}>
      {routine.steps.map((s, i) => {
        const on = doneToday || checks.isDone(s.id);
        return (
          <Pressable
            key={s.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on, disabled: doneToday }}
            accessibilityLabel={s.title}
            onPress={() => toggle(s.id)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.s, paddingHorizontal: space.m, minHeight: 48, borderRadius: radius.m, backgroundColor: p.surface }}
          >
            <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: on ? p.accent : p.line, backgroundColor: on ? p.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {on ? <Ionicons name="checkmark" size={16} color={p.onAccent} /> : null}
            </View>
            <Txt variant="heading" style={{ flex: 1, textDecorationLine: on ? 'line-through' : 'none', opacity: on ? 0.6 : 1 }} numberOfLines={2}>{i + 1}. {s.title}</Txt>
            <Txt variant="small" muted>{clock(scaledDuration(s.durationSec, prefs.length))}</Txt>
          </Pressable>
        );
      })}
      </View>
    </Section>
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

/** Today's routine: what, how long, how far today, this week, and the way in. */
function TodayHero({ routine }: { routine: MemberRoutine }) {
  const p = usePalette();
  const [prefs] = useRoutinePrefs();
  const checks = useDayChecks(routine.id);
  const done = routine.stats.doneToday;
  const total = routine.steps.length;
  const ticked = done ? total : routine.steps.filter((s) => checks.isDone(s.id)).length;
  return (
    <Card style={{ padding: space.l, gap: space.l, backgroundColor: p.accentSoft, borderColor: 'transparent' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <View style={{ flex: 1, gap: space.xs }}>
          <Txt variant="caption" color={p.accent}>{done ? 'Heute erledigt' : 'Heute dran'}</Txt>
          <Txt variant="title">{routine.title}</Txt>
          <Txt muted>{plural(total, 'Übung', 'Übungen')} · {minutes(routineSeconds(routine, prefs.length))}</Txt>
        </View>
        <ProgressRing size={76} share={ticked / Math.max(1, total)} stroke={8} track={p.surface}>
          {done ? <Ionicons name="checkmark" size={32} color={p.accent} /> : <Txt variant="heading" style={{ fontVariant: ['tabular-nums'] }}>{ticked}/{total}</Txt>}
        </ProgressRing>
      </View>
      <WeekStrip days={routine.stats.days} />
      <Button label={done ? 'Noch einmal machen' : 'Routine starten'} kind={done ? 'secondary' : 'primary'} onPress={() => openRoutine(routine.id)} />
    </Card>
  );
}

/** A further routine, small. */
function OtherRoutine({ routine }: { routine: MemberRoutine }) {
  const p = usePalette();
  const [prefs] = useRoutinePrefs();
  return (
    <Card onPress={() => openRoutine(routine.id)} accessibilityLabel={`${routine.title} starten`} style={{ padding: space.l, flexDirection: 'row', alignItems: 'center', gap: space.m }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="heading" numberOfLines={2}>{routine.title}</Txt>
        <Txt variant="small" muted>{routine.stats.doneToday ? 'Heute erledigt · ' : ''}{plural(routine.steps.length, 'Übung', 'Übungen')} · {minutes(routineSeconds(routine, prefs.length))}</Txt>
      </View>
      <Ionicons name={routine.stats.doneToday ? 'checkmark-circle' : 'play-circle'} size={32} color={p.accent} />
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
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.m }}>
        <Txt variant="display">Routine</Txt>
        {main && main.stats.streak > 0 ? (
          <View accessibilityLabel={`${plural(main.stats.streak, 'Tag', 'Tage')} in Folge`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.m, paddingVertical: space.xs, borderRadius: 999, backgroundColor: p.accentSoft }}>
            <Ionicons name="flame" size={18} color={p.accent} />
            <Txt variant="heading" color={p.accent} style={{ fontVariant: ['tabular-nums'] }}>{main.stats.streak}</Txt>
          </View>
        ) : null}
      </View>

      {!main ? (
        <Card style={{ padding: space.xl, gap: space.s }}>
          <Ionicons name="flame-outline" size={32} color={p.accent} />
          <Txt variant="title">Noch keine Routine</Txt>
          <Txt muted>Sobald {community?.name ?? 'dein Memberbereich'} eine tägliche Routine für dich anlegt, findest du sie hier – mit Timer, Erinnerung und deiner Serie.</Txt>
        </Card>
      ) : (
        <>
          <TodayHero routine={main} />
          <TodayChecklist routine={main} />
          <GoalCard routine={main} />
          <ChallengeBlock routine={main} />
          {q.data.length > 1 ? (
            <Section title="Weitere Routinen">
              <View style={{ gap: space.m }}>
                {q.data.slice(1).map((r) => <OtherRoutine key={r.id} routine={r} />)}
              </View>
            </Section>
          ) : null}
          <Section title="Deine Serie">
            <StreakCard routine={main} />
          </Section>
          <BadgesCard routine={main} />
        </>
      )}

      <PhotosCard />
      <RemindersCard routine={main} />
    </Screen>
  );
}
