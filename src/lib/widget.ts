// The app's side of the home screen widget (src/widgets): sends streak and today's routine. The widget needs its own app
// build: in Expo Go and in the browser everything here does nothing, and the native module is only loaded when a build has
// it (expo-widgets would crash the app on import otherwise). On iOS a timeline carries the next two days, so the widget stays
// right when the app stays closed: "in Gefahr" from the time of "Serie retten" with the hours counting down, a new day at
// midnight, the streak lost when a day stayed open. Android has no timelines and shows what the app last sent.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import type { RoutineWidgetProps } from '@/widgets/props';
import { localDay } from './nav';
import { onColor } from './color';

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

export interface WidgetRoutine {
  title: string; streak: number; doneToday: boolean; seconds: number; days: readonly string[]; accent: string;
  /** From this time on an open day counts as "in Gefahr" (the time of "Serie retten"). */
  riskHour: number; riskMinute: number;
}

/** What the widget shows from now on, one entry per moment that changes something (exported for the check of the layouts). */
export function widgetTimeline(o: WidgetRoutine, now = new Date()): { date: Date; props: RoutineWidgetProps }[] {
  const props = (at: Date, doneToday: boolean, streak: number, risk: boolean, midnight: Date): RoutineWidgetProps => ({
    hasRoutine: true, title: o.title, streak, doneToday, minutes: Math.max(1, Math.round(o.seconds / 60)), week: weekOf(o.days, at), todayIndex: (at.getDay() + 6) % 7,
    atRisk: risk, hoursLeft: risk ? Math.ceil((midnight.getTime() - at.getTime()) / 3_600_000) : 0, accent: o.accent, onAccent: onColor(o.accent),
  });
  const entries: { date: Date; props: RoutineWidgetProps }[] = [];
  // Today, tomorrow (only if the streak is still alive then) and the day after. An open day that ends loses the streak.
  let alive = o.streak;
  for (let offset = 0; offset < 3; offset++) {
    const start = offset === 0 ? now : new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 0, 0, 5);
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset + 1, 0, 0, 0);
    const done = offset === 0 && o.doneToday;
    const riskAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, o.riskHour, o.riskMinute, 0);
    const canLose = !done && alive > 0;
    entries.push({ date: start, props: props(start, done, alive, canLose && start >= riskAt, midnight) });
    if (canLose) {
      // the evening: from the time of "Serie retten", then every full hour (the hours left count down)
      for (let at = riskAt; at < midnight; at = new Date(at.getFullYear(), at.getMonth(), at.getDate(), at.getHours() + 1, 0, 0)) {
        if (at > start) entries.push({ date: at, props: props(at, false, alive, true, midnight) });
      }
    }
    if (!done) alive = 0;
  }
  return entries;
}

export function sendRoutineToWidget(o: WidgetRoutine): void {
  const w = widget();
  if (!w) return;
  const entries = widgetTimeline(o);
  try {
    w.updateTimeline(entries);
    if (Platform.OS === 'android' && entries[0]) w.updateSnapshot(entries[0].props);
  } catch { /* the app works without the widget */ }
}

/** Logged out or no routine: the widget shows no personal data any more. */
export function clearRoutineWidget(accent = '#BD9553'): void {
  try {
    widget()?.updateSnapshot({
      hasRoutine: false, title: '', streak: 0, doneToday: false, minutes: 0, week: [false, false, false, false, false, false, false], todayIndex: 0, atRisk: false, hoursLeft: 0,
      accent, onAccent: onColor(accent),
    });
  } catch { /* the app works without the widget */ }
}
