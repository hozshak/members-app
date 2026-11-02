// "Gezielt üben": a short session of one zone, e.g. 3 minutes for the neck (src/lib/zones.ts), in the routine's run screen.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ErrorView, Loading } from '@/components/ui';
import { PRACTICE_MINUTES, practiceRoutine, useZones } from '@/lib/zones';
import { RoutineSession } from '@/screens/routine-session';

export default function ZoneSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useZones();
  const [minutes, setMinutes] = useState<number>(PRACTICE_MINUTES[0]);
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  const zone = q.data.find((z) => z.id === id);
  if (!zone || zone.exercises.length === 0) return <ErrorView error={new Error('not_found')} onRetry={() => router.back()} />;
  return <RoutineSession routine={practiceRoutine(zone, minutes)} practice={{ minutes, options: PRACTICE_MINUTES, onMinutes: setMinutes }} />;
}
