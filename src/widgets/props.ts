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
