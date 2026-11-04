// When the app asks for a rating (owner 04.11.2026): once after a month of use, counted from the first time the app was opened on this phone.
// "Später" asks again two weeks later; a rating or "Nein danke" ends it.
import { localDay } from './nav';
import { getItem, setItem } from './storage';

const KEY = 'members.rating';
const AFTER_DAYS = 30;
const LATER_DAYS = 14;

interface Saved { first: string; next?: string; done?: boolean }

const dayNumber = (day: string) => Math.round(Date.parse(`${day}T12:00:00Z`) / 86_400_000);

async function load(): Promise<Saved | null> {
  try {
    const raw = await getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

/** Whether to ask now. The first call starts the month. */
export async function ratingDue(): Promise<boolean> {
  const today = localDay();
  const saved = await load();
  if (!saved) {
    await setItem(KEY, JSON.stringify({ first: today } satisfies Saved));
    return false;
  }
  if (saved.done) return false;
  if (saved.next) return dayNumber(today) >= dayNumber(saved.next);
  return dayNumber(today) - dayNumber(saved.first) >= AFTER_DAYS;
}

export async function ratingLater(): Promise<void> {
  const saved = await load();
  const next = localDay(new Date(Date.now() + LATER_DAYS * 86_400_000));
  await setItem(KEY, JSON.stringify({ first: saved?.first ?? localDay(), next } satisfies Saved));
}

export async function ratingDone(): Promise<void> {
  const saved = await load();
  await setItem(KEY, JSON.stringify({ first: saved?.first ?? localDay(), done: true } satisfies Saved));
}
