// What the reminders say and when (owner 04.11.2026: "etwas motivierter"): another sentence every day, and special ones when the plan makes them
// true (halfway, the last day). They speak about staying with it and never promise a result. Nothing from the phone in here, so that it can be tried
// out on its own.
// The coach changes the texts in the dashboard (Routinen → Erinnerungen, shared/reminder-texts.ts of the software, 05.11.2026); they come with the routines.
// The ones here stand in for a community whose software does not send them yet. They do not put the name of the routine into a sentence: "Deine ersten
// 14 Tage ist bereit" is what that made of a plural title.
import type { MemberRoutine } from './routine';

export interface ReminderText { title: string; body: string }
export interface ReminderTexts { daily: ReminderText[]; halfway: ReminderText; lastDay: ReminderText; streak: ReminderText; photo: ReminderText }
export interface PlannedReminder { day: string; date: Date; text: ReminderText }

export const DEFAULT_REMINDER_TEXTS: ReminderTexts = {
  daily: [
    { title: 'Nur ein paar Minuten für dich ✨', body: 'Deine Routine ist bereit. Du musst nur noch anfangen.' },
    { title: 'Bereit für heute? 💪', body: 'Ein paar Minuten, dann ist es geschafft.' },
    { title: 'Jeder Tag zählt', body: 'Mach heute deine Routine. Morgen bist du froh, dass du es getan hast.' },
    { title: 'Kleine Schritte, jeden Tag 🌱', body: 'So wird es zur Gewohnheit. Jetzt deine Routine starten.' },
    { title: 'Zeit für dich', body: 'Kurz durchatmen, Handy hinstellen, los geht’s.' },
    { title: 'Du hast es dir versprochen 😉', body: 'Deine Routine ist heute dran. Du schaffst das.' },
    { title: 'Heute schon an dich gedacht?', body: 'Deine Routine wartet auf dich. Fang einfach an.' },
  ],
  halfway: { title: 'Halbzeit! 💪', body: 'Tag {{tag}} von {{tage}}. Die Hälfte hast du schon, bleib dran.' },
  lastDay: { title: 'Dein letzter Tag! 🏆', body: 'Heute schließt du deinen Plan ab. Stark, dass du so weit gekommen bist.' },
  streak: { title: '{{serie}} Tage in Folge 🔥', body: 'Richtig gut! Mach heute mit deiner Routine weiter.' },
  photo: { title: 'Zeit für dein Fortschrittsfoto 📸', body: 'Zehn Sekunden, gleiches Licht. Später wirst du froh sein, dass du es gemacht hast.' },
};

const isText = (v: unknown): v is ReminderText => {
  const t = v as Partial<ReminderText> | null | undefined;
  return typeof t?.title === 'string' && typeof t.body === 'string' && t.title !== '' && t.body !== '';
};

/** What came over the network: only a complete set counts, else the texts of the app stay. */
export function readReminderTexts(raw: unknown): ReminderTexts | null {
  const t = raw as Partial<ReminderTexts> | null | undefined;
  if (!t || !Array.isArray(t.daily) || t.daily.length === 0 || !t.daily.every(isText)) return null;
  if (!isText(t.halfway) || !isText(t.lastDay) || !isText(t.streak) || !isText(t.photo)) return null;
  return { daily: t.daily, halfway: t.halfway, lastDay: t.lastDay, streak: t.streak, photo: t.photo };
}

/** Puts the values into a text; a placeholder without a value disappears. */
function fill(text: ReminderText, values: Readonly<Record<string, string | number>>): ReminderText {
  const put = (s: string) => s.replace(/\{\{\s*([^{}]*?)\s*\}\}/g, (_, name: string) => String(values[name] ?? ''));
  return { title: put(text.title), body: put(text.body) };
}

/** `planDay` and `planDays`: the day of the plan on the day of the reminder; `streak`: days in a row this reminder keeps going; `sentence` chooses the daily one. */
export function reminderText(texts: ReminderTexts, routine: string, planDay: number | null, planDays: number | null, streak: number, sentence: number): ReminderText {
  if (planDay !== null && planDays !== null) {
    if (planDay === planDays) return fill(texts.lastDay, { routine, tage: planDays });
    if (planDays >= 6 && planDay === Math.ceil(planDays / 2)) return fill(texts.halfway, { routine, tag: planDay, tage: planDays });
  }
  if (streak >= 3) return fill(texts.streak, { routine, serie: streak });
  const daily = fill(texts.daily[sentence % texts.daily.length] as ReminderText, { routine });
  return planDay !== null && planDays !== null ? { title: daily.title, body: `Tag ${planDay} von ${planDays}. ${daily.body}` } : daily;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The daily reminders of the coming days, each with its own text. Today only when its time is still to come and the routine is not done yet.
 * The series only goes into the next one: nobody knows what happens until the ones after it.
 */
export function plannedReminders(
  time: { hour: number; minute: number },
  routine: Pick<MemberRoutine, 'title' | 'stats' | 'challenge' | 'plan'>,
  ahead: number,
  texts: ReminderTexts = DEFAULT_REMINDER_TEXTS,
  now = new Date(),
): PlannedReminder[] {
  const ch = routine.plan ? routine.challenge : null;
  const dayToday = ch && ch.dayNumber !== null && !ch.completed ? ch.dayNumber : null;
  const out: PlannedReminder[] = [];
  for (let i = 0; i <= ahead; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, time.hour, time.minute);
    if (date <= now || (i === 0 && routine.stats.doneToday)) continue;
    const planDay = dayToday !== null && ch && dayToday + i <= ch.days ? dayToday + i : null;
    out.push({
      day: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      date,
      text: reminderText(texts, routine.title, planDay, planDay !== null && ch ? ch.days : null, out.length === 0 ? routine.stats.streak : 0, Math.floor(date.getTime() / 86_400_000)),
    });
  }
  return out;
}
