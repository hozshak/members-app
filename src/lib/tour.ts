// The assistant of the app (owner 04.11.2026): one short tour per tab, the first time the tab is opened. It lights up the thing it talks
// about and says what it is; first the start page with a circle around each tab, the other tabs when the member opens them. A step whose
// thing is not on the screen (no downloads, no routine) is left out. Remembered on this phone; "Einführung ansehen" in the profile starts
// over. This file is the state, components/tour.tsx draws it.
// 10.11.2026 (owner: "die Einführung soll auch darauf gehen und erklären", "wenn ich auf einen Plan gehe, soll mir die Routine-Einführung zeigen, wo man
// alles klicken kann"): a tour for the page of a plan (before and after it is started) and "Routine beenden" in the profile. A step can be newer than its
// tour (`since`): who has seen the tour before gets only the new steps, once.
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useSyncExternalStore, type ComponentRef, type RefObject } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView, View } from 'react-native';
import { getItem, setItem } from './storage';

type ViewRef = ComponentRef<typeof View>;
type ScrollRef = ComponentRef<typeof ScrollView>;

/** `plan`: the page of a started plan; `planStart`: the page of a plan before it is started. */
export type TourId = 'start' | 'inhalte' | 'routine' | 'profil' | 'plan' | 'planStart';

/** `target`: a TourTarget on the screen; `tab`: an item of the tab bar; neither: a card in the middle. `since`: the version of the tour it came with (1). */
export interface TourStep { target?: string; tab?: number; title: string; text: string; since?: number }

/** The tabs in the order of the tab bar. */
export const TAB_ROUTES = ['/', '/routine', '/inhalte', '/profil'] as const;

const STEPS: Record<TourId, TourStep[]> = {
  start: [
    { title: 'Willkommen bei {name}', text: 'Schön, dass du da bist! Ich zeige dir kurz, was wo ist. Die anderen Bereiche erkläre ich dir, sobald du sie zum ersten Mal öffnest.' },
    { target: 'start.buttons', title: 'WhatsApp, Tools und Bewertung', text: 'Hier oben kommst du in die WhatsApp-Gruppe und zu deinen Tools. Mit dem goldenen Stern gibst du eine Bewertung ab.' },
    { target: 'start.intro', title: 'So startest du', text: 'Für jedes Programm steht hier, womit du anfängst. Tippe drauf, dann öffnet sich die Einführung.' },
    { target: 'start.routine', title: 'Deine Routine heute', text: 'Ein Fingertipp, und du bist bei deinen Übungen für heute.' },
    { target: 'start.progress', title: 'Dein Fortschritt', text: 'So weit bist du in deinen Programmen und in der Routine. Tippe drauf, und du bist direkt dort.' },
    { tab: 1, title: 'Routine', text: 'Hier ist dein tägliches Training: Übungen zum Mitmachen und deine Fotos.' },
    { tab: 2, title: 'Inhalte', text: 'Hier sind deine Programme mit allen Videos und deine Downloads.' },
    { tab: 3, title: 'Profil', text: 'Hier stellst du deine Erinnerungen ein, beendest eine Routine und siehst deinen Rahmen. Tippe auf einen Bereich, dann zeige ich ihn dir.' },
  ],
  inhalte: [
    { title: 'Das erste Mal hier?', text: 'Du bist jetzt das erste Mal im Bereich „Inhalte“. Ich führe dich einmal rum.' },
    { target: 'inhalte.search', title: 'Suche', text: 'Hier findest du jede Übung und jede Lektion.' },
    { target: 'inhalte.programmes', title: 'Deine Programme', text: 'Tippe auf ein Programm. Darin findest du alle Videos, schön der Reihe nach.' },
    { target: 'inhalte.downloads', title: 'Deine Downloads', text: 'Hier liegen deine PDFs, zum Öffnen und zum Herunterladen.' },
    { target: 'inhalte.continue', title: 'Weiterschauen', text: 'Die Videos aus deinen Programmen, die du angefangen hast.' },
    { target: 'inhalte.bookmarks', title: 'Merkliste', text: 'Was du dir in einer Lektion merkst, steht hier.' },
  ],
  routine: [
    { title: 'Das erste Mal hier?', text: 'Du bist jetzt das erste Mal im Bereich „Routine“. Ich führe dich einmal rum.' },
    { target: 'routine.hero', title: 'Deine Routine heute', text: 'Hier startest du deine Übungen von heute. Die Videos zeigen dir, wie es geht.' },
    { target: 'routine.days', title: 'Deine letzten 14 Tage', text: 'Jeder Tag, an dem du deine Routine gemacht hast, bekommt einen Haken.' },
    { target: 'routine.reminder', title: 'Erinnerung', text: 'Die Erinnerung ist noch aus. Wir empfehlen sie dir, dann bleibst du leichter dran.' },
    { target: 'routine.check', title: 'Heute abhaken', text: 'Hier siehst du, welche Übungen du heute schon gemacht hast. Die Haken setzt die App, während du die Routine machst.' },
    { target: 'routine.photos', title: 'Fortschrittsfotos', text: 'So siehst du, was sich verändert. Die Fotos bleiben nur auf deinem Handy.' },
    { target: 'routine.checkins', title: 'Deine Check-ins', text: 'Hier oben findest du deine Check-ins: Fotos vergleichen und kurz in dich hineinhören.' },
  ],
  profil: [
    { title: 'Das erste Mal hier?', text: 'Du bist jetzt das erste Mal im Bereich „Profil“. Ich führe dich einmal rum.' },
    { target: 'profil.frame', title: 'Dein Rahmen', text: 'Mit jedem Übungstag wird der Rahmen um dein Foto schöner. Das Ausrufezeichen zeigt dir alle Stufen.' },
    { target: 'profil.reminders', title: 'Erinnerungen', text: 'Hier stellst du ein, wann dich die App an deine Routine erinnert.' },
    { target: 'profil.routines', title: 'Routine beenden', text: 'Hier siehst du deine Routinen und kannst eine beenden, zum Beispiel um eine andere anzufangen. Deine erledigten Tage bleiben erhalten.', since: 2 },
    { target: 'profil.tongue', title: 'Zungen-Erinnerung', text: 'Ein paar Mal am Tag fragt dich die App: „Wo ist deine Zunge gerade?“. Hier schaltest du das ein.', since: 2 },
    { target: 'profil.icon', title: 'App-Icon', text: 'Such dir aus, wie die App auf deinem Home-Bildschirm aussieht.' },
    { target: 'profil.intro', title: 'Einführung ansehen', text: 'Hier kannst du dir das alles noch einmal zeigen lassen.' },
  ],
  planStart: [
    { title: 'Dein neuer Plan', text: 'Ich zeige dir kurz, wo du was findest, bevor du startest.' },
    { target: 'plan.goal', title: 'Dein Ziel', text: 'Wähle, wie lange du üben möchtest. Du kannst es später ändern.' },
    { target: 'plan.how', title: 'So läuft dein Plan', text: 'Hier steht in drei Sätzen, wie dein Plan funktioniert.' },
    { target: 'plan.start', title: 'Plan starten', text: 'Ein Tipp, und dein Plan beginnt heute. Danach machst du dein Vorher-Foto.' },
    { target: 'plan.firstDay', title: 'Dein erster Tag', text: 'Diese Übungen erwarten dich an Tag 1, mit ihrer Dauer.' },
  ],
  plan: [
    { title: 'Dein Plan', text: 'Ich zeige dir einmal, wo du hier was findest.' },
    { target: 'plan.hero', title: 'Routine starten', text: 'Hier startest du deine Übungen von heute. Die App spielt dir jedes Video vor und hakt ab, was du gemacht hast.' },
    { target: 'plan.today', title: 'Heute', text: 'Deine Übungen für heute. Mit den Pfeilen tauschst du eine Übung für heute gegen eine andere, wenn sie angeboten werden.' },
    { target: 'plan.days', title: 'Dein Weg', text: 'Jeder erledigte Tag bekommt einen Haken. So siehst du, wie weit du schon bist.' },
    { target: 'plan.photos', title: 'Vorher und Nachher', text: 'Am Start machst du Fotos von vorne, rechts und links, am letzten Tag noch einmal. Tippe drauf, dann vergleichst du sie.' },
    { target: 'plan.checkins', title: 'Deine Check-ins', text: 'Zwischendurch fragt dich die App, wie es dir geht, und du machst neue Fotos. Hier findest du alle.' },
    { target: 'plan.menu', title: 'Neu beginnen oder beenden', text: 'Hier fängst du den Plan von vorne an oder beendest ihn. Beenden geht auch im Profil.' },
  ],
};

/** The version of each tour: its newest step. */
const versionOf = (tour: TourId) => Math.max(...STEPS[tour].map((s) => s.since ?? 1));

const KEY = 'members.tour';

export interface ActiveTour { tour: TourId; steps: TourStep[]; index: number }

let active: ActiveTour | null = null;
/** The version of each tour seen on this phone (`true` from before the versions: 1). */
let seen: Partial<Record<TourId, boolean | number>> | null = null;
const listeners = new Set<() => void>();
const targets = new Map<string, RefObject<ViewRef | null>>();
const scrollers = new Map<TourId, { ref: RefObject<ScrollRef | null>; y: number }>();

const emit = () => listeners.forEach((l) => l());

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** The running tour, null when there is none. */
export function useActiveTour(): ActiveTour | null {
  return useSyncExternalStore(subscribe, () => active, () => active);
}

async function loadSeen(): Promise<Partial<Record<TourId, boolean | number>>> {
  if (seen) return seen;
  try {
    const raw = await getItem(KEY);
    seen = raw ? (JSON.parse(raw) as Partial<Record<TourId, boolean | number>>) : {};
  } catch {
    seen = {};
  }
  return seen;
}

/** The version of a tour seen here, 0 for none. */
export function seenVersion(value: boolean | number | undefined): number {
  if (value === true) return 1;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** The steps of a tour still to show: all of them the first time, afterwards only the ones newer than the version seen. */
export function stepsToShow(steps: readonly TourStep[], seenAt: number): TourStep[] {
  return seenAt === 0 ? [...steps] : steps.filter((s) => (s.since ?? 1) > seenAt);
}

async function beginIfNew(tour: TourId): Promise<void> {
  const state = await loadSeen();
  const seenAt = seenVersion(state[tour]);
  if (active || seenAt >= versionOf(tour)) return;
  const steps = stepsToShow(STEPS[tour], seenAt).filter((s) => !s.target || targets.has(s.target));
  // only the welcome left: there is nothing to show yet
  if (!steps.some((s) => s.target || s.tab !== undefined)) return;
  active = { tour, steps, index: 0 };
  emit();
}

/** On the first screen of a tab: its tour, the first time the tab is opened (`ready`: its content is there). */
export function useTourOnFocus(tour: TourId, ready: boolean): void {
  useFocusEffect(useCallback(() => {
    if (!ready) return;
    // the screen has to stand before the tour can point at it
    const t = setTimeout(() => void beginIfNew(tour), 500);
    return () => clearTimeout(t);
  }, [tour, ready]));
}

export function nextTourStep(): void {
  if (!active) return;
  if (active.index + 1 >= active.steps.length) {
    endTour();
    return;
  }
  active = { ...active, index: active.index + 1 };
  emit();
}

export function endTour(): void {
  if (!active) return;
  const { tour } = active;
  active = null;
  seen = { ...seen, [tour]: versionOf(tour) };
  void setItem(KEY, JSON.stringify(seen));
  scrollers.get(tour)?.ref.current?.scrollTo({ y: 0, animated: true });
  emit();
}

/** "Einführung ansehen": everything from the start page on. */
export function replayTours(): void {
  seen = {};
  void setItem(KEY, '{}');
  router.navigate('/' as Href);
}

/** The thing a step points at registers itself under its name. */
export function useTourTargetRef(id: string): RefObject<ViewRef | null> {
  const ref = useRef<ViewRef>(null);
  useEffect(() => {
    targets.set(id, ref);
    return () => {
      if (targets.get(id) === ref) targets.delete(id);
    };
  }, [id]);
  return ref;
}

export interface Box { x: number; y: number; width: number; height: number }

/** Where the thing stands on the screen; null when it is not there. */
export function measureTarget(id: string): Promise<Box | null> {
  const view = targets.get(id)?.current;
  if (!view) return Promise.resolve(null);
  return new Promise((resolve) => {
    view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}

/** The page of a tab: the tour scrolls it to what it talks about. */
export function useTourScroll(tour?: TourId): RefObject<ScrollRef | null> {
  const ref = useRef<ScrollRef>(null);
  useEffect(() => {
    if (!tour) return;
    const entry = { ref, y: 0 };
    scrollers.set(tour, entry);
    return () => {
      if (scrollers.get(tour) === entry) scrollers.delete(tour);
    };
  }, [tour]);
  return ref;
}

/** How far the page of a tab is scrolled. */
export function noteTourScroll(tour: TourId, e: NativeSyntheticEvent<NativeScrollEvent>): void {
  const s = scrollers.get(tour);
  if (s) s.y = e.nativeEvent.contentOffset.y;
}

/** Scrolls the page of the tour by this much. False when it cannot. */
export function scrollTourBy(tour: TourId, delta: number): boolean {
  const s = scrollers.get(tour);
  if (!s?.ref.current) return false;
  s.ref.current.scrollTo({ y: Math.max(0, s.y + delta), animated: true });
  return true;
}
