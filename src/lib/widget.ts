// The app's side of the home screen widget (src/widgets): sends streak and today's routine. The widget needs its own app
// build: in Expo Go and in the browser everything here does nothing, and the native module is only loaded when a build has
// it (expo-widgets would crash the app on import otherwise). On iOS a second timeline entry turns "Heute erledigt" off at
// midnight even when the app stays closed; Android has no timelines and shows what the app last sent.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import type { RoutineWidgetProps } from '@/widgets/props';
import { localDay } from './nav';

interface WidgetHandle {
  updateSnapshot(props: RoutineWidgetProps): void;
  updateTimeline(entries: { date: Date; props: RoutineWidgetProps }[]): void;
}

const available = Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
let handle: WidgetHandle | null | undefined;

function widget(): WidgetHandle | null {
  if (!available) return null;
  if (handle === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- must not load in Expo Go: the native module is missing there
      handle = (require('@/widgets/routine-widget') as { default: WidgetHandle }).default;
    } catch {
      handle = null;
    }
  }
  return handle;
}

/** The week (Monday to Sunday) of `date`: done or not. */
export function weekOf(days: readonly string[], date = new Date()): boolean[] {
  const monday = new Date(date);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return days.includes(localDay(d));
  });
}

export function sendRoutineToWidget(o: { title: string; streak: number; doneToday: boolean; seconds: number; days: readonly string[]; accent: string }): void {
  const w = widget();
  if (!w) return;
  const props: RoutineWidgetProps = {
    hasRoutine: true, title: o.title, streak: o.streak, doneToday: o.doneToday, minutes: Math.max(1, Math.round(o.seconds / 60)), week: weekOf(o.days), accent: o.accent,
  };
  const midnight = new Date();
  midnight.setHours(24, 0, 5, 0);
  try {
    w.updateTimeline([
      { date: new Date(), props },
      // a new day: nothing done yet, and without today the streak is over
      { date: midnight, props: { ...props, doneToday: false, streak: o.doneToday ? o.streak : 0, week: weekOf(o.days, midnight) } },
    ]);
    if (Platform.OS === 'android') w.updateSnapshot(props);
  } catch { /* the app works without the widget */ }
}

/** Logged out or no routine: the widget shows no personal data any more. */
export function clearRoutineWidget(accent = '#BD9553'): void {
  try {
    widget()?.updateSnapshot({ hasRoutine: false, title: '', streak: 0, doneToday: false, minutes: 0, week: [false, false, false, false, false, false, false], accent });
  } catch { /* the app works without the widget */ }
}
