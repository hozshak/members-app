// The member's own goal (like a language app's goal): what they want to reach ("Straffere Kinnpartie"), how often per
// week and for how long. Progress counts the routine days done since the start (the check-ins of the main routine);
// the forecast says when the goal will be reached at the member's pace. Kept on this phone with the routine settings.
// Also: the exercises of today ticked off one by one (checkboxes), reset every day.
import { useSyncExternalStore } from 'react';
import { localDay } from './nav';
import type { RoutineStats } from './routine';
import { getItem, setItem } from './storage';

export interface Goal { text: string; perWeek: number; days: number; startDay: string }

export const GOAL_EXAMPLES = ['Straffere Kinnpartie', 'Weniger Stirnfalten', 'Mehr Ausstrahlung', 'Entspannter Kiefer', 'Wachere Augen'];
export const GOAL_PER_WEEK = [3, 4, 5, 6, 7];
export const GOAL_DAYS = [30, 60, 90];

const DAY_MS = 86_400_000;
const toDate = (d: string) => new Date(`${d}T12:00:00`);
export const addDays = (d: string, n: number) => localDay(new Date(toDate(d).getTime() + n * DAY_MS));
const diffDays = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY_MS);

export interface GoalProgress {
  target: number;        // routine days needed
  done: number;          // routine days done since the start (within the goal's time)
  share: number;         // 0…1
  endDay: string;        // last day of the goal's time
  dayOfGoal: number;     // 1-based day since the start (capped at days)
  forecast: string | null; // day the goal will be reached at the current pace
  reached: boolean;
  weekDone: number;      // routine days of this week (Monday to Sunday)
  weekDays: { day: string; done: boolean; future: boolean }[];
  message: string;
}

const fmt = (d: string) => toDate(d).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });

export function goalProgress(goal: Goal, stats: RoutineStats, today = localDay()): GoalProgress {
  const target = Math.max(1, Math.ceil((goal.days * goal.perWeek) / 7));
  const endDay = addDays(goal.startDay, goal.days - 1);
  const doneDays = stats.days.filter((d) => d >= goal.startDay && d <= endDay);
  const done = doneDays.length;
  const elapsed = Math.min(goal.days, Math.max(1, diffDays(goal.startDay, today) + 1));
  const reached = done >= target;
  const remaining = Math.max(0, target - done);

  // pace: the member's own once there are a few days, else the planned rhythm
  const planned = goal.perWeek / 7;
  const pace = elapsed >= 4 && done > 0 ? done / elapsed : planned;
  const forecast = reached ? null : addDays(today, Math.max(0, Math.ceil(remaining / Math.max(pace, 0.05)) - (stats.doneToday ? 0 : 1)));

  const monday = addDays(today, -((toDate(today).getDay() + 6) % 7));
  const set = new Set(stats.days);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i);
    return { day, done: set.has(day), future: day > today };
  });
  const weekDone = weekDays.filter((d) => d.done).length;

  let message: string;
  if (reached) message = `Ziel erreicht! Du hast ${done} Tage durchgezogen – stark.`;
  else if (done === 0) message = 'Los geht’s – jeder Tag bringt dich deinem Ziel näher.';
  else if (remaining <= 3) message = `Fast geschafft – nur noch ${remaining} ${remaining === 1 ? 'Tag' : 'Tage'}!`;
  else if (forecast && forecast <= endDay) message = `Bleib dran: So erreichst du dein Ziel am ${fmt(forecast)}.`;
  else if (stats.doneToday) message = `Stark, heute erledigt! Noch ${remaining} Tage bis zu deinem Ziel.`;
  else message = `Mit ${goal.perWeek}× pro Woche schaffst du es bis zum ${fmt(endDay)} – mach heute weiter.`;

  return {
    target, done, share: Math.min(1, done / target), endDay, dayOfGoal: elapsed,
    forecast, reached, weekDone, weekDays, message,
  };
}

// ---------- goal + today's ticks (shared state, saved on the phone) ----------

interface Saved { goal: Goal | null; checks: { day: string; done: Record<string, string[]> } }
const KEY = 'members.goal';
let state: Saved = { goal: null, checks: { day: '', done: {} } };
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(l: () => void): () => void {
  listeners.add(l);
  if (!loaded) {
    loaded = true;
    void getItem(KEY).then((raw) => {
      try { if (raw) state = { ...state, ...(JSON.parse(raw) as Partial<Saved>) }; } catch { /* keep defaults */ }
      emit();
    });
  }
  return () => { listeners.delete(l); };
}

function save(next: Saved) {
  state = next;
  emit();
  void setItem(KEY, JSON.stringify(next));
}

export function useGoal(): [Goal | null, (g: Goal | null) => void] {
  const s = useSyncExternalStore(subscribe, () => state, () => state);
  return [s.goal, (goal) => save({ ...state, goal })];
}

/** Today's ticked exercises of a routine; a new day starts empty. */
export function useDayChecks(routineId: string) {
  const s = useSyncExternalStore(subscribe, () => state, () => state);
  const today = localDay();
  const done = s.checks.day === today ? (s.checks.done[routineId] ?? []) : [];
  // always from the latest state: the timer may tick several exercises before the screen renders again
  const current = () => (state.checks.day === today ? (state.checks.done[routineId] ?? []) : []);
  const write = (ids: string[]) => {
    const base = state.checks.day === today ? state.checks.done : {};
    save({ ...state, checks: { day: today, done: { ...base, [routineId]: ids } } });
  };
  return {
    done,
    isDone: (stepId: string) => done.includes(stepId),
    toggle: (stepId: string) => {
      const ids = current();
      write(ids.includes(stepId) ? ids.filter((id) => id !== stepId) : [...ids, stepId]);
    },
    mark: (stepId: string) => {
      const ids = current();
      if (!ids.includes(stepId)) write([...ids, stepId]);
    },
  };
}
