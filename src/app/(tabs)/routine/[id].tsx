// The daily routine: its start screen and run (src/screens/routine-session.tsx).
import { router, useLocalSearchParams } from 'expo-router';
import { ErrorView, Loading } from '@/components/ui';
import { useRoutines } from '@/lib/routine';
import { RoutineSession } from '@/screens/routine-session';

export default function RoutineSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useRoutines();
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  const routine = q.data.find((r) => r.id === id);
  if (!routine || routine.steps.length === 0) return <ErrorView error={new Error('not_found')} onRetry={() => router.back()} />;
  return <RoutineSession routine={routine} />;
}
