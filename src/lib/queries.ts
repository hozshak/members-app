// Data of the member area (React Query): the same endpoints as the website's member area (src/modules/player/api.ts
// of the software). Marking a lesson as done refreshes everything that shows progress.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './session';
import type { LessonDoneResult, MemberCategoryDetail, MemberHome, MemberProductDetail, PlayResponse, ProgressUpdate, VideoDetail } from './types';

const enc = encodeURIComponent;

export const keys = {
  home: ['home'] as const,
  product: (slug: string) => ['product', slug] as const,
  category: (slug: string) => ['category', slug] as const,
  video: (id: string) => ['video', id] as const,
};

export function useHome() {
  const api = useApi();
  return useQuery({ queryKey: keys.home, queryFn: () => api.get<MemberHome>('/api/member/home') });
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
    },
  });
}
