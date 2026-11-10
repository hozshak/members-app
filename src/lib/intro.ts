// The introduction of a programme (owner 05.11.2026): how to start and with what. The coach writes it per programme in the dashboard (product.intro); the member says where
// they stand ("Ich fange gerade an" / "Ich bin schon länger dabei"), sees what to start with and goes on through the coach's pages. It opens by itself the first time
// the programme is opened and stays reachable on its page, which also keeps the chosen start. Kept on this phone: seen or not, and the choice.
import { router, type Href } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { getItem, setItem } from './storage';
import type { Id } from './types';

export interface ProgrammeIntroLevel { label: string; hint: string; text: string; categoryIds: Id[] }
/** A picture where the line `[Bild: <label>]` stands in the text (09.11.2026, lib/intro-text.ts). */
export interface ProgrammeIntroImage { label: string; url: string }
/** The button at the end of a page (09.11.2026): the programme's plan, its before photo, a category of the programme (`target` its id), a website. */
export interface ProgrammeIntroLink { kind: 'plan' | 'photo' | 'category' | 'url'; label: string; target: string }
/** `images` and `link` are missing on software versions before 09.11.2026. */
export interface ProgrammeIntroPage { title: string; text: string; images?: ProgrammeIntroImage[]; link?: ProgrammeIntroLink | null }
/** The programme's row in "So startest du" (10.11.2026): '' / null = the product's title, "Hier fängst du an" and its picture. Missing on older software. */
export interface ProgrammeIntroStartRow { title: string; text: string; imageUrl: string | null }
export interface ProgrammeIntro {
  title: string; lead: string; leadImages?: ProgrammeIntroImage[]; question: string; levels: ProgrammeIntroLevel[]; pages: ProgrammeIntroPage[]; closing: string;
  startRow?: ProgrammeIntroStartRow;
}

/**
 * `seen`: it opened by itself once. `finished`: gone through to the end or on into a category; until then the start page keeps pointing to it (leaving it by
 * accident loses nothing). `page`: where the member left it, e.g. for the plan or a category a page links to; it opens there again until it is finished.
 */
export interface IntroState { seen: boolean; level: number | null; finished?: boolean; page?: number }

const KEY = 'members.intros';
const NONE: IntroState = { seen: false, level: null };
let state: Record<string, IntroState> = {};
let loaded = false;
let loading = false;
const listeners = new Set<() => void>();

function subscribe(l: () => void): () => void {
  listeners.add(l);
  if (!loading) {
    loading = true;
    void getItem(KEY).then((raw) => {
      try {
        if (raw) state = JSON.parse(raw) as Record<string, IntroState>;
      } catch { /* starts empty */ }
      loaded = true;
      listeners.forEach((x) => x());
    });
  }
  return () => { listeners.delete(l); };
}

/** Until the phone has answered, nothing opens by itself. */
export function useIntrosLoaded(): boolean {
  return useSyncExternalStore(subscribe, () => loaded, () => loaded);
}

export function useIntroState(productId: Id | undefined): IntroState {
  return useSyncExternalStore(subscribe, () => (productId ? state[productId] ?? NONE : NONE), () => NONE);
}

/** Every programme's state on this phone (the routine looks at the answers: "Ich bin schon länger dabei" skips the recommended plan). */
export function useIntroStates(): Readonly<Record<string, IntroState>> {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function setIntroState(productId: Id, patch: Partial<IntroState>): void {
  state = { ...state, [productId]: { ...(state[productId] ?? NONE), ...patch } };
  listeners.forEach((x) => x());
  void setItem(KEY, JSON.stringify(state));
}

/** `base`: the tab the member is in ('/inhalte' or ''), so that a category opened from the introduction stays there. */
export function openIntro(slug: string, base: string): void {
  router.push({ pathname: '/einfuehrung', params: { slug, base } } as unknown as Href);
}
