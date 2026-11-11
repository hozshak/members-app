// Data of the member area (React Query): the same endpoints as the website's member area (src/modules/player/api.ts
// of the software). Marking a lesson as done refreshes everything that shows progress.
import { setAppTexts } from './app-texts';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './session';
import type {
  LessonDoneResult, MemberCategoryDetail, MemberHome, MemberLibrary, MemberProductDetail, PlayResponse, Profile, ProgressUpdate, Purchase, SessionInfo, VideoDetail,
} from './types';

const enc = encodeURIComponent;

export const keys = {
  home: ['home'] as const,
  library: ['library'] as const,
  product: (slug: string) => ['product', slug] as const,
  category: (slug: string) => ['category', slug] as const,
  video: (id: string) => ['video', id] as const,
};

export function useHome() {
  const api = useApi();
  return useQuery({
    queryKey: keys.home,
    queryFn: async () => {
      const home = await api.get<MemberHome>('/api/member/home');
      setAppTexts(home.appTexts);
      return home;
    },
  });
}

export function useLibrary() {
  const api = useApi();
  return useQuery({ queryKey: keys.library, queryFn: () => api.get<MemberLibrary>('/api/member/library') });
}

export function useProduct(slug: string) {
  const api = useApi();
  return useQuery({ queryKey: keys.product(slug), queryFn: () => api.get<MemberProductDetail>(`/api/member/products/${enc(slug)}`) });
}

/**
 * The first look ends "Neu" (software migration 0123, 11.11.2026): opening an item or a category that was new makes the lists ask again, so its "Neu"
 * is gone when the member goes back.
 */
function useRefreshNew() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: keys.home });
    void qc.invalidateQueries({ queryKey: keys.library });
    void qc.invalidateQueries({ queryKey: ['product'] });
  };
}

export function useCategory(slug: string) {
  const api = useApi();
  const refreshNew = useRefreshNew();
  return useQuery({
    queryKey: keys.category(slug),
    queryFn: async () => {
      const detail = await api.get<MemberCategoryDetail>(`/api/member/categories/${enc(slug)}`);
      if (detail.category.newCount > 0) refreshNew();
      return detail;
    },
  });
}

export function useVideo(id: string) {
  const api = useApi();
  const qc = useQueryClient();
  const refreshNew = useRefreshNew();
  return useQuery({
    queryKey: keys.video(id),
    queryFn: async () => {
      const detail = await api.get<VideoDetail>(`/api/member/videos/${enc(id)}`);
      if (detail.isNew) {
        refreshNew();
        void qc.invalidateQueries({ queryKey: ['category'] });
      }
      return detail;
    },
  });
}

/** Stream token + address + resume position of a lesson video. */
export function usePlayApi() {
  const api = useApi();
  return {
    play: (videoId: string) => api.post<PlayResponse>(`/api/member/videos/${enc(videoId)}/play`),
    progress: (videoId: string, body: ProgressUpdate) => api.put<void>(`/api/member/videos/${enc(videoId)}/progress`, body),
    url: api.url,
    headers: api.mediaHeaders,
  };
}

/** `flush`: what has to reach the server before it decides (the report of the player that passes the 90 %). */
export function useMarkDone(videoId: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ done, flush }: { done: boolean; flush?: () => Promise<unknown> }) => {
      await flush?.();
      return api.put<LessonDoneResult>(`/api/member/videos/${enc(videoId)}/done`, { done });
    },
    // the button answers at once, in both directions; an error puts it back
    onMutate: async ({ done }) => {
      await qc.cancelQueries({ queryKey: keys.video(videoId) });
      const before = qc.getQueryData<VideoDetail>(keys.video(videoId));
      if (before) qc.setQueryData<VideoDetail>(keys.video(videoId), { ...before, done });
      return { before };
    },
    onError: (_err, _vars, context) => {
      if (context?.before) qc.setQueryData(keys.video(videoId), context.before);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.video(videoId) });
      void qc.invalidateQueries({ queryKey: ['category'] });
      void qc.invalidateQueries({ queryKey: ['product'] });
      void qc.invalidateQueries({ queryKey: keys.home });
      void qc.invalidateQueries({ queryKey: keys.library });
    },
  });
}

// ---------- profile ----------

export function useProfile() {
  const api = useApi();
  return useQuery({ queryKey: ['profile'] as const, queryFn: () => api.get<Profile>('/api/profile') });
}

export function useSessions() {
  const api = useApi();
  return useQuery({ queryKey: ['sessions'] as const, queryFn: async () => (await api.get<{ items: SessionInfo[] }>('/api/profile/sessions')).items });
}

export function usePurchases() {
  const api = useApi();
  return useQuery({ queryKey: ['purchases'] as const, queryFn: async () => (await api.get<{ items: Purchase[] }>('/api/member/purchases')).items });
}

// ---------- search over every lesson the member can open ----------

/** Loads the categories of the library (cached like the category pages) when `enabled`; lessons with their category. */
export function useSearchIndex(enabled: boolean) {
  const api = useApi();
  const lib = useLibrary();
  const slugs = enabled && lib.data
    ? [...new Set([...lib.data.products.flatMap((pr) => pr.categories), ...lib.data.free, ...lib.data.more]
      .filter((c) => c.access === 'full').map((c) => c.slug))]
    : [];
  const results = useQueries({
    queries: slugs.map((slug) => ({
      queryKey: keys.category(slug),
      queryFn: () => api.get<MemberCategoryDetail>(`/api/member/categories/${enc(slug)}`),
      staleTime: 5 * 60_000,
    })),
  });
  const items = results.flatMap((r) => (r.data ? r.data.videos.filter((v) => !v.locked) : []));
  return { items: [...new Map(items.map((v) => [v.id, v])).values()], loading: enabled && (lib.isPending || results.some((r) => r.isPending)) };
}

/** Lower case without accents (ß → ss) for comparing search words. */
export function searchable(text: string): string {
  return text.toLocaleLowerCase('de-DE').replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
