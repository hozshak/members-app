// Opening content from any tab: "Start" and "Inhalte" each have their own stack with the same screens (product,
// category, lesson), so a tap stays in the tab the member is in. `useOpen()` knows the current tab from the route.
import { router, useSegments, type Href } from 'expo-router';

export interface Open {
  product(slug: string): void;
  category(slug: string): void;
  lesson(id: string, opts?: { replace?: boolean }): void;
}

export function useOpen(): Open {
  const segments = useSegments() as string[];
  const base = segments.includes('inhalte') ? '/inhalte' : '';
  const go = (path: string, replace = false) => {
    const href = `${base}${path}` as Href;
    if (replace) router.replace(href);
    else router.push(href);
  };
  return {
    product: (slug) => go(`/produkt/${encodeURIComponent(slug)}`),
    category: (slug) => go(`/kategorie/${encodeURIComponent(slug)}`),
    lesson: (id, opts) => go(`/lektion/${encodeURIComponent(id)}`, opts?.replace),
  };
}

/** Today in the phone's time zone as YYYY-MM-DD (routines count days like the member lives them). */
export function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
