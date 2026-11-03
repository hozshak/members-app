// Routine overview, the most important first: today's routine with the big start button, how far today and the last 14 days at
// a glance; the plans under way ("Von Mailin empfohlen", zones); the exercises to tick off (all ticked = day done, unticking or
// "Zurücksetzen" opens the day again); the progress photos (optionally behind Face ID); "Gezielt üben" (plans and short sessions
// by zone); the member's own goal ("Mein Ziel" with a progress bar and a forecast); a challenge when the coach made the routine one
// ("Tag 12 von 30"). The reminders are under "Profil".
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openPlan, openRoutine, ProgressRing, routineSeconds, TwoWeeks, ZonesSection } from '@/components/routine-parts';
import { Button, Card, ErrorView, Loading, ProgressBar, Screen, Section, Txt } from '@/components/ui';
import { errorText } from '@/lib/api';
import { clock, minutes, plural } from '@/lib/format';
import { goalProgress, useDayChecks, useGoal } from '@/lib/goal';
import { unlockPhotos, usePhotosVisible } from '@/lib/photo-lock';
import { mainRoutine, overallStats, planLabel, planState, useSwaps, withSwaps } from '@/lib/plans';
import {
  listPhotos, stepSeconds, syncReminders, useChallenge, useCheckIn, useRoutinePrefs, useRoutines,
  type MemberRoutine, type ProgressPhoto, type RoutineStats,
} from '@/lib/routine';
import { useSession } from '@/lib/session';
import { radius, space, usePalette } from '@/lib/theme';

/** "Mein Ziel": the goal in the member's words, a big bar (routine days done of those needed), this week as dots and a
 *  sentence that says how close it is ("Bleib dran: So erreichst du dein Ziel am 24. November."). */
function GoalCard({ stats }: { stats: RoutineStats }) {
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
  const g = goalProgress(goal, stats);
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

/** Today's exercises to tick off; all ticked = the day is done. Unticking one, or "Zurücksetzen", opens the day again. */
function TodayChecklist({ routine }: { routine: MemberRoutine }) {
  const p = usePalette();
  const checks = useDayChecks(routine.id);
  const checkIn = useCheckIn(routine.id);
  const doneToday = routine.stats.doneToday;
  const ticked = routine.steps.filter((s) => doneToday || checks.isDone(s.id)).length;

  const toggle = (stepId: string) => {
    if (doneToday) {
      // the day was done: this exercise opens, the others stay ticked
      checks.set(routine.steps.filter((s) => s.id !== stepId).map((s) => s.id));
      checkIn.mutate(false);
      return;
    }
    const willBe = new Set(checks.done);
    if (willBe.has(stepId)) willBe.delete(stepId);
    else willBe.add(stepId);
    checks.toggle(stepId);
    if (routine.steps.every((s) => willBe.has(s.id)) && !checkIn.isPending) checkIn.mutate(true);
  };
  const reset = () => {
    checks.set([]);
    if (doneToday) checkIn.mutate(false);
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
              accessibilityState={{ checked: on }}
              accessibilityLabel={s.title}
              onPress={() => toggle(s.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.s, paddingHorizontal: space.m, minHeight: 48, borderRadius: radius.m, backgroundColor: p.surface }}
            >
              <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: on ? p.accent : p.line, backgroundColor: on ? p.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {on ? <Ionicons name="checkmark" size={16} color={p.onAccent} /> : null}
              </View>
              <Txt variant="heading" style={{ flex: 1, textDecorationLine: on ? 'line-through' : 'none', opacity: on ? 0.6 : 1 }} numberOfLines={2}>{i + 1}. {s.title}</Txt>
              <Txt variant="small" muted>{clock(stepSeconds(s))}</Txt>
            </Pressable>
          );
        })}
      </View>
      {checkIn.isError ? <Txt variant="small" color={p.danger}>{errorText(checkIn.error)}</Txt> : null}
      {ticked > 0 ? <Button label={doneToday ? 'Zurücksetzen: Heute ist noch nicht erledigt' : 'Häkchen zurücksetzen'} kind="ghost" onPress={reset} /> : null}
    </Section>
  );
}

function ChallengeBlock({ routine }: { routine: MemberRoutine }) {
  const p = usePalette();
  const ch = routine.challenge;
  const mutate = useChallenge(routine.id);
  if (!ch) return null;
  const started = ch.startDay !== null && ch.dayNumber !== null;
  const leave = () => Alert.alert('Challenge verlassen?', 'Deine erledigten Tage bleiben erhalten. Du kannst jederzeit neu starten.', [
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

/** A plan: where the member stands, one tap to its page. */
function PlanCard({ routine }: { routine: MemberRoutine }) {
  const p = usePalette();
  const ch = routine.challenge;
  const state = planState(routine);
  return (
    <Card onPress={() => openPlan(routine.id)} accessibilityLabel={`${planLabel(routine)}: ${routine.title}`} style={{ padding: space.l, gap: space.s }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
        <Ionicons name={state === 'over' ? 'trophy' : 'ribbon'} size={18} color={p.accent} />
        <Txt variant="caption" color={p.accent} style={{ flex: 1 }}>{planLabel(routine)}</Txt>
        <Ionicons name="chevron-forward" size={18} color={p.textMuted} />
      </View>
      <Txt variant="heading">{routine.title}</Txt>
      {state === 'running' && ch ? (
        <>
          <ProgressBar value={(ch.dayNumber ?? 0) / ch.days} />
          <Txt variant="small" muted>Tag {ch.dayNumber} von {ch.days} · {ch.doneDays} erledigt</Txt>
        </>
      ) : (
        <Txt variant="small" muted>{state === 'over' ? 'Zu Ende: Sieh dir deinen Unterschied an.' : 'Noch nicht gestartet'}</Txt>
      )}
    </Card>
  );
}

/** Today's routine: what, how long, how far today, the last 14 days, and the way in. */
function TodayHero({ routine, days }: { routine: MemberRoutine; days: string[] }) {
  const p = usePalette();
  const checks = useDayChecks(routine.id);
  const done = routine.stats.doneToday;
  const state = routine.plan ? planState(routine) : null;
  const total = routine.steps.length;
  const ticked = done ? total : routine.steps.filter((s) => checks.isDone(s.id)).length;
  return (
    <Card style={{ padding: space.l, gap: space.l, backgroundColor: p.accentSoft, borderColor: 'transparent' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <View style={{ flex: 1, gap: space.xs }}>
          <Txt variant="caption" color={p.accent}>{done ? 'Heute erledigt' : routine.plan ? planLabel(routine) : 'Heute dran'}</Txt>
          <Txt variant="title">{routine.title}</Txt>
          <Txt muted>
            {state === 'running' ? `Tag ${routine.challenge?.dayNumber} von ${routine.challenge?.days} · ` : ''}
            {plural(total, 'Übung', 'Übungen')} · {minutes(routineSeconds(routine))}
          </Txt>
        </View>
        <ProgressRing size={76} share={ticked / Math.max(1, total)} stroke={8} track={p.surface}>
          {done ? <Ionicons name="checkmark" size={32} color={p.accent} /> : <Txt variant="heading" style={{ fontVariant: ['tabular-nums'] }}>{ticked}/{total}</Txt>}
        </ProgressRing>
      </View>
      <TwoWeeks days={days} plan={state === 'running' ? routine.challenge : null} />
      {state === 'open' || state === 'over'
        ? <Button label={state === 'open' ? 'Ansehen und starten' : 'Ergebnis ansehen'} onPress={() => openPlan(routine.id)} />
        : <Button label={done ? 'Noch einmal machen' : 'Routine starten'} kind={done ? 'secondary' : 'primary'} onPress={() => openRoutine(routine.id)} />}
      {state === 'running' ? <Button label="Zum Plan" kind="ghost" onPress={() => openPlan(routine.id)} /> : null}
    </Card>
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
  const swaps = useSwaps();
  const main = mainRoutine(q.data);

  // keep the scheduled reminders in line with the settings and the routine
  useEffect(() => {
    if (q.data) void syncReminders(prefs, main);
  }, [q.data, prefs, main]);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;

  // calendar and goal count every routine: changing from one plan to another does not lose them
  const stats = overallStats(q.data);
  const today = main ? withSwaps(main, swaps.steps) : null;
  const plans = q.data.filter((r) => r.plan && r.id !== main?.id && (r.plan.kind === 'recommended' || planState(r) !== 'open'));

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching} contentStyle={{ paddingTop: insets.top + space.l, gap: space.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.m }}>
        <Txt variant="display">Routine</Txt>
        {stats.streak > 0 ? (
          <View accessibilityLabel={`${plural(stats.streak, 'Tag', 'Tage')} in Folge`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.m, paddingVertical: space.xs, borderRadius: 999, backgroundColor: p.accentSoft }}>
            <Ionicons name="flame" size={18} color={p.accent} />
            <Txt variant="heading" color={p.accent} style={{ fontVariant: ['tabular-nums'] }}>{stats.streak}</Txt>
          </View>
        ) : null}
      </View>

      {!main || !today ? (
        <>
          <Card style={{ padding: space.xl, gap: space.s }}>
            <Ionicons name="flame-outline" size={32} color={p.accent} />
            <Txt variant="title">Noch keine Routine</Txt>
            <Txt muted>Sobald {community?.name ?? 'dein Memberbereich'} eine tägliche Routine für dich anlegt, findest du sie hier, mit Timer und Erinnerung.</Txt>
          </Card>
          <PhotosCard />
          <ZonesSection />
        </>
      ) : (
        <>
          <TodayHero routine={today} days={stats.days} />
          {plans.map((r) => <PlanCard key={r.id} routine={r} />)}
          {!main.plan || planState(main) === 'running' ? <TodayChecklist routine={today} /> : null}
          <PhotosCard />
          <ZonesSection />
          <GoalCard stats={stats} />
          {main.plan ? null : <ChallengeBlock routine={main} />}
        </>
      )}
    </Screen>
  );
}
