// Keeps the home screen widget (lib/widget.ts) up to date while the member area is open: at the start, after a check-in and
// whenever the routines are loaded again.
import { useEffect } from 'react';
import { mainRoutine, overallStats, useReloadOnNewDay } from './plans';
import { stepSeconds, useRoutines } from './routine';
import { useSession } from './session';
import { clearRoutineWidget, sendRoutineToWidget } from './widget';

/** From this hour the widget warns that today is still open. */
const RISK_HOUR = 20;

export function useRoutineWidgetSync(): void {
  const q = useRoutines();
  useReloadOnNewDay();
  const { community } = useSession();
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
      seconds: routine.steps.reduce((sum, s) => sum + stepSeconds(s), 0), accent: accent ?? '#BD9553',
      riskHour: RISK_HOUR, riskMinute: 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `days` is new on every render; it only changes with the routines
  }, [accent, loaded, routine, streak, q.data]);
}
