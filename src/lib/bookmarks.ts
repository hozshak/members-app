// The member's "Merkliste": lessons saved for later, kept on this phone (one file per community in the app's folder).
// A small snapshot of each lesson is stored, so the list shows at once without asking the server.
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';
import { useSession } from './session';
import type { VideoCard } from './types';

export interface Bookmark {
  id: string; title: string; kind: VideoCard['kind']; durationSec: number | null; categoryTitle: string; savedAt: number;
}

const cache = new Map<string, Bookmark[]>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const EMPTY: Bookmark[] = [];

function fileOf(communityUrl: string): File {
  const key = communityUrl.replace(/^https?:\/\//, '').replace(/[^a-z0-9.-]/gi, '_');
  return new File(Paths.document, `merkliste_${key}.json`);
}

function load(communityUrl: string): Bookmark[] {
  if (Platform.OS === 'web') return EMPTY;
  const hit = cache.get(communityUrl);
  if (hit) return hit;
  let list: Bookmark[] = [];
  try {
    const f = fileOf(communityUrl);
    if (f.exists) list = JSON.parse(f.textSync()) as Bookmark[];
  } catch {
    list = [];
  }
  cache.set(communityUrl, list);
  return list;
}

function store(communityUrl: string, list: Bookmark[]): void {
  cache.set(communityUrl, list);
  emit();
  if (Platform.OS === 'web') return;
  try {
    const f = fileOf(communityUrl);
    if (!f.exists) f.create();
    // the list stays in memory for this visit when writing fails
    f.write(JSON.stringify(list)).catch(() => undefined);
  } catch { /* see above */ }
}

/** The Merkliste of the current community, newest first, plus toggle / check. */
export function useBookmarks() {
  const { community } = useSession();
  const url = community?.url ?? '';
  const list = useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => (url ? load(url) : EMPTY),
    () => EMPTY,
  );
  return {
    list,
    has: (id: string) => list.some((b) => b.id === id),
    toggle: (v: Pick<VideoCard, 'id' | 'title' | 'kind' | 'durationSec' | 'categoryTitle'>) => {
      if (!url) return;
      const current = load(url);
      store(url, current.some((b) => b.id === v.id)
        ? current.filter((b) => b.id !== v.id)
        : [{ id: v.id, title: v.title, kind: v.kind, durationSec: v.durationSec, categoryTitle: v.categoryTitle, savedAt: Date.now() }, ...current]);
    },
  };
}
