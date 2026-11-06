// Routine overview, with one main action and the most important first: today on a large picture with the way in; where the member stands (the
// plan with its 14 days, a tap leads to the whole plan; without a plan the last 14 days); a small hint that recommends the reminder while it is
// off; today's exercises with their ticks (set by the routine itself, never by hand, owner 06.11.2026; "Zurücksetzen und neu beginnen" of the plan takes
// them away); the progress photos (optionally behind Face ID); a challenge when the coach made the routine one ("Tag 12 von 30"). A tap on the flame says
// what it counts. The settings of the reminders are under "Profil". When the coach offers a check-in (lib/progress-check.ts) the app suggests it below
// the plan when it is due, and the button "Check-ins" next to the flame leads to the ones done so far.
// "Gezielt üben" and the own goal are out of the app (owner 06.11.2026); their screens (routine/zone.tsx, routine/ziel.tsx) are no longer linked.
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckInsButton, CheckInSuggestion } from '@/components/check-in-parts';
import { ReminderPopup } from '@/components/reminder-popup';
import { ExerciseThumb, HeroButton, HeroCard, HeroDone, openPlan, openRoutine, routineSeconds, TwoWeeks } from '@/components/routine-parts';
import { TourTarget } from '@/components/tour';
import { Button, Card, ErrorView, Loading, MenuGroup, ProgressBar, Screen, Section, Txt } from '@/components/ui';
import { errorText } from '@/lib/api';
import { clock, minutes, plural } from '@/lib/format';
import { useDayChecks } from '@/lib/goal';
import { unlockPhotos, usePhotosVisible } from '@/lib/photo-lock';
import { goalLabel, mainRoutine, overallStats, planLabel, planState, useSwaps, waitingFor, withSwaps } from '@/lib/plans';
import {
  allowNotifications, listPhotos, stepSeconds, syncReminders, useChallenge, useRoutinePrefs, useRoutines,
  type MemberRoutine, type ProgressPhoto, type RoutineStats,
} from '@/lib/routine';
import { useSession } from '@/lib/session';
import { radius, space, usePalette } from '@/lib/theme';
import { useTourOnFocus } from '@/lib/tour';

/** The reminder is off until the member allows notifications: this says so and recommends it, one tap away. */
function ReminderHint({ routine }: { routine: MemberRoutine }) {
  const p = usePalette();
  const [prefs, update] = useRoutinePrefs();
  const [choosing, setChoosing] = useState(false);
  const turnOn = async () => {
    if (!(await allowNotifications())) {
      Alert.alert('Mitteilungen sind aus', 'Erlaube Mitteilungen für die App in den Einstellungen deines Handys, dann klappt die Erinnerung.');
      return;
    }
    await syncReminders(update({ reminder: true }), routine);
    setChoosing(true);
  };
  return (
    <>
      {!prefs.reminder && !prefs.reminderHintClosed ? (
        <TourTarget id="routine.reminder">
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m }}>
            <Ionicons name="alarm-outline" size={24} color={p.accent} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="heading">Erinnerung ist aus</Txt>
              <Txt variant="small" muted>Empfohlen, damit du dranbleibst.</Txt>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => void turnOn()}
              style={({ pressed }) => ({ minHeight: 40, justifyContent: 'center', paddingHorizontal: space.m, borderRadius: 999, backgroundColor: p.accentSoft, opacity: pressed ? 0.7 : 1 })}
            >
              <Txt variant="small" color={p.accent} style={{ fontWeight: '700' }}>Einschalten</Txt>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Nicht jetzt" hitSlop={10} onPress={() => update({ reminderHintClosed: true })}>
              <Ionicons name="close" size={20} color={p.textMuted} />
            </Pressable>
          </Card>
        </TourTarget>
      ) : null}
      {choosing ? (
        <ReminderPopup
          title="Tägliche Erinnerung"
          hint="Wann ist Zeit für deine Routine?"
          hour={prefs.hour}
          minute={prefs.minute}
          onSave={(hour, minute) => {
            void syncReminders(update({ hour, minute }), routine);
            setChoosing(false);
          }}
          onClose={() => setChoosing(false)}
        />
      ) : null}
    </>
  );
}

/** A tap on the flame: what it counts. */
function StreakPopup({ stats, onClose }: { stats: RoutineStats; onClose: () => void }) {
  const p = usePalette();
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'center', padding: space.l }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Schließen" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
        <View accessibilityViewIsModal style={{ alignItems: 'center', gap: space.m, padding: space.xl, borderRadius: radius.xl, backgroundColor: p.surface }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="flame" size={40} color={p.accent} />
          </View>
          <Txt variant="title" style={{ textAlign: 'center' }}>{plural(stats.streak, 'Tag', 'Tage')} in Folge</Txt>
          <Txt muted style={{ textAlign: 'center' }}>Die Flamme zählt die Tage, an denen du deine Routine ohne Pause gemacht hast. Lässt du einen Tag aus, fängt sie wieder von vorn an.</Txt>
          <View style={{ flexDirection: 'row', alignSelf: 'stretch', gap: space.m }}>
            {[{ value: stats.bestStreak, label: 'Dein bester Lauf' }, { value: stats.totalDays, label: 'Tage insgesamt' }].map((x) => (
              <View key={x.label} style={{ flex: 1, alignItems: 'center', gap: 2, padding: space.m, borderRadius: radius.m, backgroundColor: p.surfaceAlt }}>
                <Txt variant="title" style={{ fontVariant: ['tabular-nums'] }}>{x.value}</Txt>
                <Txt variant="small" muted style={{ textAlign: 'center' }}>{x.label}</Txt>
              </View>
            ))}
          </View>
          <Button label="Alles klar" onPress={onClose} style={{ alignSelf: 'stretch' }} />
        </View>
      </View>
    </Modal>
  );
}

/**
 * Today's exercises with their ticks. Only the routine sets them, exercise by exercise, and "Zurücksetzen und neu beginnen" of the plan takes them away; a
 * tap does nothing (owner 06.11.2026: not by hand).
 */
function TodayChecklist({ routine }: { routine: MemberRoutine }) {
  const p = usePalette();
  const checks = useDayChecks(routine.id);
  const doneToday = routine.stats.doneToday;
  const total = routine.steps.length;
  const ticked = routine.steps.filter((s) => doneToday || checks.isDone(s.id)).length;

  return (
    <Section
      title="Heute abhaken"
      action={ticked === total
        ? <Txt variant="small" color={p.accent} style={{ fontWeight: '700' }}>Alles erledigt</Txt>
        : <Txt variant="small" muted>{ticked} von {total}</Txt>}
    >
      <MenuGroup>
        {routine.steps.map((s) => {
          const on = doneToday || checks.isDone(s.id);
          return (
            <View
              key={s.id}
              accessible
              accessibilityLabel={`${s.title}, ${on ? 'erledigt' : 'noch offen'}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m, minHeight: 72, backgroundColor: p.surface }}
            >
              <View style={{ opacity: on ? 0.55 : 1 }}>
                <ExerciseThumb step={s} size={56} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="heading" numberOfLines={2} color={on ? p.textMuted : p.text}>{s.title}</Txt>
                <Txt variant="small" muted>{clock(stepSeconds(s))}</Txt>
              </View>
              <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: on ? p.accent : p.line, backgroundColor: on ? p.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {on ? <Ionicons name="checkmark" size={18} color={p.onAccent} /> : null}
              </View>
            </View>
          );
        })}
      </MenuGroup>
      {ticked < total ? <Txt variant="small" muted>Die Haken setzt die App, während du die Routine machst.</Txt> : null}
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

/** Another plan: where the member stands, one tap to its page. A recommended plan that has to wait for the one before it stays closed until then. */
function PlanCard({ routine, waiting }: { routine: MemberRoutine; waiting: MemberRoutine | null }) {
  const p = usePalette();
  const ch = routine.challenge;
  const state = planState(routine);
  if (waiting) {
    return (
      <Card accessibilityLabel={`Danach: ${routine.title}, startet nach ${waiting.title}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m, backgroundColor: p.surfaceAlt, borderColor: 'transparent' }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="lock-closed" size={20} color={p.textMuted} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="caption" muted>Danach</Txt>
          <Txt variant="heading" color={p.textMuted}>{routine.title}</Txt>
          <Txt variant="small" muted>Startet, sobald du „{waiting.title}“ geschafft hast.</Txt>
        </View>
      </Card>
    );
  }
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

/** Today's routine on a large picture, with the one action of this page. */
function TodayHero({ routine }: { routine: MemberRoutine }) {
  const state = routine.plan ? planState(routine) : null;
  const ch = routine.challenge;
  const picture = routine.steps.find((s) => s.videoThumbnailUrl)?.videoThumbnailUrl ?? null;
  const open = () => openPlan(routine.id);
  const label = state === 'running' && ch ? `Tag ${ch.dayNumber} von ${ch.days}` : state === 'over' ? 'Plan beendet' : routine.plan ? planLabel(routine) : 'Heute';
  const line = state === 'open' && routine.plan
    ? `${goalLabel(routine.plan.days)}, jeden Tag deine Übungen`
    : state === 'over' && ch
      ? `${ch.doneDays} von ${ch.days} Tagen erledigt`
      : `${plural(routine.steps.length, 'Übung', 'Übungen')} · ${minutes(routineSeconds(routine))}`;
  return (
    <TourTarget id="routine.hero">
      <HeroCard imageUrl={picture} label={label} title={routine.title} line={line}>
        {state === 'open' ? <HeroButton label="Ansehen und starten" icon="arrow-forward" onPress={open} />
          : state === 'over' ? <HeroButton label="Ergebnis ansehen" icon="trophy" onPress={open} />
            : routine.stats.doneToday ? <HeroDone text="Heute erledigt. Bis morgen!" />
              : <HeroButton label="Routine starten" icon="play" onPress={() => openRoutine(routine.id)} />}
      </HeroCard>
    </TourTarget>
  );
}

/** Where the member stands: the plan under way with its 14 days, a tap leads to the whole plan; otherwise the last 14 days. */
function WayCard({ routine, days }: { routine: MemberRoutine; days: string[] }) {
  const p = usePalette();
  const ch = routine.challenge;
  if (routine.plan && ch && planState(routine) === 'running') {
    return (
      <TourTarget id="routine.days">
        <Card onPress={() => openPlan(routine.id)} accessibilityLabel={`${planLabel(routine)}: alle Tage, Übungen und Fotos ansehen`} style={{ padding: space.l, gap: space.m }}>
          <View style={{ gap: space.s }}>
            <Txt variant="caption" color={p.accent}>{planLabel(routine)}</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.m }}>
              <Txt variant="title" style={{ flex: 1 }}>Tag {ch.dayNumber} von {ch.days}</Txt>
              <Txt variant="small" muted>{ch.doneDays} erledigt</Txt>
            </View>
            <ProgressBar value={(ch.dayNumber ?? 0) / ch.days} style={{ height: 8, borderRadius: 4 }} />
          </View>
          <TwoWeeks days={days} plan={ch} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <Txt variant="small" color={p.accent} style={{ flex: 1, fontWeight: '600' }}>Alle Tage, Übungen und Fotos</Txt>
            <Ionicons name="chevron-forward" size={18} color={p.accent} />
          </View>
        </Card>
      </TourTarget>
    );
  }
  return (
    <TourTarget id="routine.days">
      <Card style={{ padding: space.l, gap: space.m }}>
        <Txt variant="heading">Deine letzten 14 Tage</Txt>
        <TwoWeeks days={days} />
      </Card>
    </TourTarget>
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
  const all = () => router.push('/routine/fotos' as Href);
  return (
    <Section
      title="Fortschrittsfotos"
      action={photos.length > 0 ? (
        <Pressable accessibilityRole="button" hitSlop={10} onPress={all}>
          <Txt variant="small" color={p.accent} style={{ fontWeight: '600' }}>Alle ansehen</Txt>
        </Pressable>
      ) : undefined}
    >
      <Card style={{ padding: space.m, gap: space.m }}>
        {photos.length > 0 && !visible ? (
          <Pressable accessibilityRole="button" onPress={() => void unlockPhotos()} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, padding: space.m, borderRadius: radius.m, backgroundColor: p.surfaceAlt }}>
            <Ionicons name="lock-closed" size={20} color={p.accent} />
            <Txt variant="heading" style={{ flex: 1 }}>Fotos entsperren</Txt>
          </Pressable>
        ) : first && last && first !== last ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Vergleich ansehen" onPress={all} style={{ flexDirection: 'row', gap: space.s }}>
            {[first, last].map((ph, i) => (
              <View key={ph.name} style={{ flex: 1, gap: space.xs }}>
                <Image source={{ uri: ph.uri }} style={{ aspectRatio: 1, borderRadius: radius.m }} contentFit="cover" />
                <Txt variant="small" muted>{i === 0 ? 'Vorher' : 'Jetzt'} · {ph.takenAt.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</Txt>
              </View>
            ))}
          </Pressable>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
            {last ? (
              <Image source={{ uri: last.uri }} style={{ width: 56, height: 72, borderRadius: radius.m }} contentFit="cover" />
            ) : (
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="camera-outline" size={22} color={p.accent} />
              </View>
            )}
            <Txt variant="small" muted style={{ flex: 1 }}>
              {last ? 'Mach bald das nächste Foto im gleichen Licht, dann siehst du den Unterschied.' : 'Einmal pro Woche ein Foto zeigt dir, was sich verändert. Die Fotos bleiben nur auf deinem Handy.'}
            </Txt>
          </View>
        )}
        <Button label="Foto machen" kind="secondary" onPress={() => router.push('/routine/kamera' as Href)} />
      </Card>
    </Section>
  );
}

export default function RoutineScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { community } = useSession();
  const q = useRoutines();
  const swaps = useSwaps();
  const main = mainRoutine(q.data);
  const [flameOpen, setFlameOpen] = useState(false);
  useTourOnFocus('routine', !q.isPending);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;

  // calendar and goal count every routine: changing from one plan to another does not lose them
  const stats = overallStats(q.data);
  const today = main ? withSwaps(main, swaps.steps) : null;
  const plans = q.data.filter((r) => r.plan && r.id !== main?.id && (r.plan.kind === 'recommended' || planState(r) !== 'open'));
  const showWay = !!main && (planState(main) === 'running' || !main.plan || stats.totalDays > 0);

  return (
    <Screen tour="routine" onRefresh={() => void q.refetch()} refreshing={q.isRefetching} contentStyle={{ paddingTop: insets.top + space.l, gap: space.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.m }}>
        <Txt variant="display" style={{ flexShrink: 1 }}>Routine</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
        <TourTarget id="routine.checkins"><CheckInsButton routine={main} /></TourTarget>
        {stats.streak > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${plural(stats.streak, 'Tag', 'Tage')} in Folge`}
            accessibilityHint="Erklärt, was die Flamme bedeutet"
            hitSlop={8}
            onPress={() => setFlameOpen(true)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.m, paddingVertical: space.xs, borderRadius: 999, backgroundColor: p.accentSoft, opacity: pressed ? 0.7 : 1 })}
          >
            <Ionicons name="flame" size={18} color={p.accent} />
            <Txt variant="heading" color={p.accent} style={{ fontVariant: ['tabular-nums'] }}>{stats.streak}</Txt>
          </Pressable>
        ) : null}
        </View>
      </View>
      {flameOpen ? <StreakPopup stats={stats} onClose={() => setFlameOpen(false)} /> : null}

      {!main || !today ? (
        <>
          <Card style={{ padding: space.xl, gap: space.s }}>
            <Ionicons name="flame-outline" size={32} color={p.accent} />
            <Txt variant="title">Noch keine Routine</Txt>
            <Txt muted>Sobald {community?.name ?? 'dein Memberbereich'} eine tägliche Routine für dich anlegt, findest du sie hier, mit Timer und Erinnerung.</Txt>
          </Card>
          <TourTarget id="routine.photos"><PhotosCard /></TourTarget>
        </>
      ) : (
        <>
          <TodayHero routine={today} />
          {showWay ? <WayCard routine={main} days={stats.days} /> : null}
          <CheckInSuggestion routine={main} />
          {main.plan && planState(main) === 'over' ? null : <ReminderHint routine={main} />}
          {plans.map((r) => <PlanCard key={r.id} routine={r} waiting={waitingFor(q.data, r)} />)}
          {!main.plan || planState(main) === 'running' ? <TourTarget id="routine.check"><TodayChecklist routine={today} /></TourTarget> : null}
          <TourTarget id="routine.photos"><PhotosCard /></TourTarget>
          {main.plan ? null : <ChallengeBlock routine={main} />}
        </>
      )}
    </Screen>
  );
}
