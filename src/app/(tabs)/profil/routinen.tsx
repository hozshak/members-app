// "Routine beenden" in the profile (owner 10.11.2026: "Routine beenden möchte ich im Profil auch"): the plans the member has started, each with its day and a
// button to end it (the same as in the menu of the plan: the done days stay, the plan can be started again any time). A tap on a plan opens it.
import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, View } from 'react-native';
import { openPlan } from '@/components/routine-parts';
import { Button, ErrorView, Loading, Screen, Txt } from '@/components/ui';
import { errorText } from '@/lib/api';
import { planLabel, planState, usePlanStart } from '@/lib/plans';
import { useRoutines, type MemberRoutine } from '@/lib/routine';
import { radius, space, usePalette } from '@/lib/theme';

function PlanRow({ routine }: { routine: MemberRoutine }) {
  const p = usePalette();
  const plan = usePlanStart(routine.id);
  const ch = routine.challenge;
  const over = planState(routine) === 'over';
  const line = !ch ? '' : over ? `Beendet · ${ch.doneDays} von ${ch.days} Tagen erledigt` : `Tag ${ch.dayNumber} von ${ch.days} · ${ch.doneDays} erledigt`;
  const leave = () => Alert.alert(
    'Routine beenden?',
    `„${routine.title}“ wird beendet. Deine erledigten Tage bleiben erhalten. Du kannst die Routine jederzeit neu starten.`,
    [{ text: 'Abbrechen', style: 'cancel' }, {
      text: 'Beenden',
      style: 'destructive',
      onPress: () => plan.leave.mutate(undefined, { onError: (err) => Alert.alert('Nicht beendet', errorText(err)) }),
    }],
  );
  return (
    <View style={{ gap: space.m, padding: space.l, borderRadius: radius.l, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${routine.title} öffnen`}
        onPress={() => openPlan(routine.id)}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.m, opacity: pressed ? 0.7 : 1 })}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="caption" color={p.accent}>{planLabel(routine)}</Txt>
          <Txt variant="heading">{routine.title}</Txt>
          {line ? <Txt variant="small" muted>{line}</Txt> : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={p.textMuted} />
      </Pressable>
      <Button label="Routine beenden" kind="secondary" onPress={leave} loading={plan.leave.isPending} />
    </View>
  );
}

export default function RoutinesScreen() {
  const q = useRoutines();
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  const started = q.data.filter((r) => r.plan && planState(r) !== 'open');
  return (
    <Screen contentStyle={{ gap: space.l }}>
      <Txt muted>Beendest du eine Routine, bleiben deine erledigten Tage erhalten. Du kannst sie jederzeit unter „Routine“ neu starten.</Txt>
      {started.length === 0 ? (
        <Txt>Du hast gerade keine Routine gestartet.</Txt>
      ) : started.map((r) => <PlanRow key={r.id} routine={r} />)}
    </Screen>
  );
}
