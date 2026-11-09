// Texts of the app the coach changes in the dashboard (Routinen → Texte in der App, shared/app-texts.ts of the software, 09.11.2026): the heading of
// "So startest du" and the popup after the routine. They come with the start page and with the routines; software versions before them send none, then
// these stand in. The popup never puts the routine's name into a sentence by default ("Deine ersten 14 Tage ist für heute erledigt").
import { useSyncExternalStore } from 'react';

export interface AppTexts { startKicker: string; startTitle: string; doneTitle: string; doneBody: string }

export const DEFAULT_APP_TEXTS: AppTexts = {
  startKicker: 'So startest du',
  startTitle: 'Womit du anfängst und was du wissen solltest',
  doneTitle: 'Geschafft!',
  doneBody: 'Für heute erledigt. Bis morgen!',
};

let now = DEFAULT_APP_TEXTS;
const listeners = new Set<() => void>();

/** What came over the network: a complete set, else the texts stay as they are. */
export function setAppTexts(raw: unknown): void {
  const t = raw as Partial<AppTexts> | null | undefined;
  if (!t) return;
  const next = { ...DEFAULT_APP_TEXTS };
  for (const key of Object.keys(DEFAULT_APP_TEXTS) as (keyof AppTexts)[]) {
    const v = t[key];
    if (typeof v !== 'string' || v.trim() === '') return;
    next[key] = v;
  }
  if (JSON.stringify(next) === JSON.stringify(now)) return;
  now = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useAppTexts(): AppTexts {
  return useSyncExternalStore(subscribe, () => now, () => now);
}

/** Puts the values into a text; a placeholder without a value disappears. */
export function fillAppText(value: string, values: Readonly<Record<string, string | number>>): string {
  return value.replace(/\{\{\s*([^{}]*?)\s*\}\}/g, (_, name: string) => String(values[name] ?? ''));
}
