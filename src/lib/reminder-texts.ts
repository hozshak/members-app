// What the reminders say and when (owner 04.11.2026: "etwas motivierter"): another sentence every day, and special ones when the plan makes them
// true (the first day, halfway, the last day). They speak about staying with it and never promise a result. Nothing from the phone in here, so
// that it can be tried out on its own.
import type { MemberRoutine } from './routine';

export interface ReminderText { title: string; body: string }
export interface PlannedReminder { day: string; date: Date; text: ReminderText }

export const PHOTO_REMINDER: ReminderText = {
  title: 'Zeit für dein Fortschrittsfoto 📸',
  body: 'Zehn Sekunden, gleiches Licht. Später wirst du froh sein, dass du es gemacht hast.',
};

const DAILY: readonly ((routine: string) => ReminderText)[] = [
  (t) => ({ title: 'Nur ein paar Minuten für dich ✨', body: `${t} ist bereit. Du musst nur noch anfangen.` }),
  (t) => ({ title: 'Bereit für heute? 💪', body: `Ein paar Minuten ${t}, dann ist es geschafft.` }),
  (t) => ({ title: 'Jeder Tag zählt', body: `Mach heute ${t}. Morgen bist du froh, dass du es getan hast.` }),
  (t) => ({ title: 'Kleine Schritte, jeden Tag 🌱', body: `So wird es zur Gewohnheit. Jetzt ${t} starten.` }),
  (t) => ({ title: 'Zeit für dich', body: `Kurz durchatmen, Handy hinstellen, los geht’s: ${t}.` }),
  (t) => ({ title: 'Du hast es dir versprochen 😉', body: `${t} ist heute dran. Du schaffst das.` }),
  (t) => ({ title: 'Heute schon an dich gedacht?', body: `${t} wartet auf dich. Fang einfach an.` }),
];

/** `planDay` and `planDays`: the day of the plan on the day of the reminder; `streak`: days in a row this reminder keeps going; `sentence` chooses the daily one. */
export function reminderText(routine: string, planDay: number | null, planDays: number | null, streak: number, sentence: number): ReminderText {
  if (planDay !== null && planDays !== null) {
    if (planDay === planDays) return { title: 'Dein letzter Tag! 🏆', body: 'Heute schließt du deinen Plan ab. Stark, dass du so weit gekommen bist.' };
    if (planDays >= 6 && planDay === Math.ceil(planDays / 2)) return { title: 'Halbzeit! 💪', body: `Tag ${planDay} von ${planDays}. Die Hälfte hast du schon, bleib dran.` };
  }
  if (streak >= 3) return { title: `${streak} Tage in Folge 🔥`, body: `Richtig gut! Mach heute mit ${routine} weiter.` };
  const daily = (DAILY[sentence % DAILY.length] as (routine: string) => ReminderText)(routine);
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
      text: reminderText(routine.title, planDay, planDay !== null && ch ? ch.days : null, out.length === 0 ? routine.stats.streak : 0, Math.floor(date.getTime() / 86_400_000)),
    });
  }
  return out;
}
