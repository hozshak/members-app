// Keeps the home screen widget (lib/widget.ts) up to date while the member area is open: at the start, after a check-in and
// whenever the routines are loaded again.
import { useEffect } from 'react';
import { mainRoutine, overallStats, useReloadOnNewDay } from './plans';
import { scaledDuration, useRoutinePrefs, useRoutines } from './routine';
import { useSession } from './session';
import { clearRoutineWidget, sendRoutineToWidget } from './widget';

export function useRoutineWidgetSync(): void {
  const q = useRoutines();
  useReloadOnNewDay();
  const { community } = useSession();
  const [prefs] = useRoutinePrefs();
  const routine = mainRoutine(q.data);
  const stats = overallStats(q.data);
  const streak = stats.streak;
  const days = stats.days;
  const loaded = q.data !== undefined;
  const accent = community?.accentColor;
  useEffect(() => {
    if (!loaded) return;
    if (!routine) {
      clearRoutineWidget(accent);
      return;
    }
    sendRoutineToWidget({
      title: routine.title, streak, doneToday: routine.stats.doneToday, days,
      seconds: routine.steps.reduce((sum, s) => sum + scaledDuration(s.durationSec, prefs.length), 0), accent: accent ?? '#BD9553',
      riskHour: prefs.rescueHour, riskMinute: prefs.rescueMinute,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `days` is new on every render; it only changes with the routines
  }, [accent, loaded, prefs.length, prefs.rescueHour, prefs.rescueMinute, routine, streak, q.data]);
}
