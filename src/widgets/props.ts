// What the home screen widget shows. The widget itself runs in its own small runtime outside the app and only knows these
// values; the app sends them (lib/widget.ts).
export interface RoutineWidgetProps {
  /** false: logged out or no routine; the widget only invites to open the app. */
  hasRoutine: boolean;
  title: string;
  streak: number;
  doneToday: boolean;
  minutes: number;
  /** Monday to Sunday of this week: done or not. */
  week: boolean[];
  /** Which of `week` is today (0 = Monday). */
  todayIndex: number;
  /** Today is still open, the streak would be lost and the evening has come (the time of "Serie retten"). */
  atRisk: boolean;
  /** While at risk: hours left until midnight, rounded up. */
  hoursLeft: number;
  /** The accent colour of the member's community, and the readable colour on top of it. */
  accent: string;
  onAccent: string;
}

/** What the check-in widget shows (owner 06.11.2026); the app sends it (lib/widget.ts), computed from lib/progress-check.ts. */
export interface CheckInWidgetProps {
  /** none: logged out, or the coach offers no check-in; wait: none in sight yet (no day done); soon: the next comes in `inDays` days; week / final: today. */
  state: 'none' | 'wait' | 'soon' | 'week' | 'final';
  inDays: number;
  /** Check-ins kept on this phone. */
  count: number;
  /** The routine of the check-in, for the link of a tap. */
  routineId: string;
  /** The community's accent, a deeper shade of it, and the readable colour on top. */
  accent: string;
  accentDeep: string;
  onAccent: string;
}

/** The tongue widget (owner 10.11.2026, "Zungen-Erinnerung"): only the colours of the community; the app sends them (lib/widget.ts). */
export interface TongueWidgetProps {
  accent: string;
  accentDeep: string;
  onAccent: string;
}
