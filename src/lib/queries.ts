// Data of the member area (React Query): the same endpoints as the website's member area (src/modules/player/api.ts
// of the software). Marking a lesson as done refreshes everything that shows progress.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  return useQuery({ queryKey: keys.home, queryFn: () => api.get<MemberHome>('/api/member/home') });
}

export function useLibrary() {
  const api = useApi();
  return useQuery({ queryKey: keys.library, queryFn: () => api.get<MemberLibrary>('/api/member/library') });
}

export function useProduct(slug: string) {
  const api = useApi();
  return useQuery({ queryKey: keys.product(slug), queryFn: () => api.get<MemberProductDetail>(`/api/member/products/${enc(slug)}`) });
}

export function useCategory(slug: string) {
  const api = useApi();
  return useQuery({ queryKey: keys.category(slug), queryFn: () => api.get<MemberCategoryDetail>(`/api/member/categories/${enc(slug)}`) });
}

export function useVideo(id: string) {
  const api = useApi();
  return useQuery({ queryKey: keys.video(id), queryFn: () => api.get<VideoDetail>(`/api/member/videos/${enc(id)}`) });
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

export function useMarkDone(videoId: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (done: boolean) => api.put<LessonDoneResult>(`/api/member/videos/${enc(videoId)}/done`, { done }),
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
