// The group of the community (software migration 0119, owner 10.11.2026: "Gruppe … da können die Mitglieder miteinander sprechen"): what the server says
// about it (offer page or group), the messages (newest first, asked again every few seconds while the group is on screen), and everything a member or
// the team does there. A software version without the group answers 404: then there is no group tab. The purchase in the app is in lib/group-store.ts.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { ApiError } from './api';
import { useApi } from './session';
import type { Id, UnixSec } from './types';

export const GROUP_REACTIONS = ['❤️', '👏', '🔥', '😂', '🙏', '😮'] as const;
export const GROUP_POLL_OPTIONS_MAX = 6;
export const GROUP_MUTE_HOURS = [1, 24, 24 * 7] as const;

export type GroupMessageKind = 'text' | 'image' | 'poll';
export interface GroupAuthor { id: Id; name: string; avatarUrl: string | null; isTeam: boolean }
export interface GroupReaction { emoji: string; count: number; mine: boolean }
export interface GroupPoll { question: string; options: string[]; multi: boolean; counts: number[]; voters: number; mine: number[] }
export interface GroupMessage {
  id: Id; kind: GroupMessageKind; author: GroupAuthor; body: string;
  image: { url: string; width: number; height: number } | null;
  poll: GroupPoll | null;
  replyTo: { id: Id; authorName: string; body: string; kind: GroupMessageKind; deleted: boolean } | null;
  reactions: GroupReaction[]; pinned: boolean; deleted: boolean; createdAt: UnixSec; mine: boolean; canDelete: boolean;
  reports?: number; hidden?: boolean;
}
export interface GroupPage { items: GroupMessage[]; hasMore: boolean; now: UnixSec }
export interface GroupInfo {
  enabled: boolean; name: string; pitch: string; rules: string;
  access: 'open' | 'subscribe' | 'banned';
  isTeam: boolean; canPost: boolean; canPostMedia: boolean; rulesAccepted: boolean; mutedUntil: UnixSec | null; viaTag: boolean;
  subscription: { store: 'apple' | 'google'; productId: string; expiresAt: UnixSec | null; autoRenew: boolean; trial: boolean } | null;
  products: { apple: { monthly: string; yearly: string }; google: { productId: string } };
  purchaseToken: string; unread: number; pinned: GroupMessage | null; openReports: number;
  /** What of the group reaches the phone (software migration 0120; an older community does not say: 'coach'). */
  notify?: GroupNotify;
}

export type GroupNotify = 'all' | 'coach' | 'off';

export const groupKey = ['group'] as const;
export const groupMessagesKey = ['group', 'messages'] as const;

/** The group as the server sees it for this member; null: this community has no group (switched off, or an older software). */
export function useGroupInfo(refetchInterval?: number) {
  const api = useApi();
  return useQuery({
    queryKey: groupKey,
    refetchInterval,
    queryFn: async (): Promise<GroupInfo | null> => {
      try {
        const info = await api.get<GroupInfo>('/api/member/group');
        return info.enabled ? info : null;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  });
}

/** The messages, newest first, page by page backwards; asked again every `pollMs` while `live`. */
export function useGroupMessages(live: boolean, pollMs = 4000) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: groupMessagesKey,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => api.get<GroupPage>(`/api/member/group/messages${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ''}`),
    getNextPageParam: (last) => (last.hasMore ? (last.items[last.items.length - 1]?.id ?? null) : null),
    // only the newest page is asked again: older pages stay as they are (they refresh when loaded anew)
    refetchInterval: live ? pollMs : false,
    refetchIntervalInBackground: false,
  });
}

/** One message changed (reaction, vote, pin): put it into the pages in place. */
function useReplaceMessage() {
  const qc = useQueryClient();
  return (m: GroupMessage) => qc.setQueryData<InfiniteData<GroupPage>>(groupMessagesKey, (data) => data && {
    ...data,
    pages: data.pages.map((page) => ({ ...page, items: page.items.map((x) => (x.id === m.id ? m : x)) })),
  });
}

/** Everything a member (or the team) does in the group. */
export function useGroupActions() {
  const api = useApi();
  const qc = useQueryClient();
  const replace = useReplaceMessage();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: groupMessagesKey });
    void qc.invalidateQueries({ queryKey: groupKey });
  };
  return {
    post: useMutation({
      mutationFn: (v: { body: string; replyToId?: Id | null }) => api.post<GroupMessage>('/api/member/group/messages', v),
      onSuccess: refresh,
    }),
    postImage: useMutation({
      mutationFn: (v: { uri: string; mime: string; caption: string }) =>
        api.putFile<GroupMessage>(`/api/member/group/images${v.caption ? `?caption=${encodeURIComponent(v.caption)}` : ''}`, v.uri, v.mime),
      onSuccess: refresh,
    }),
    postPoll: useMutation({
      mutationFn: (v: { question: string; options: string[]; multi: boolean }) => api.post<GroupMessage>('/api/member/group/polls', v),
      onSuccess: refresh,
    }),
    react: useMutation({
      mutationFn: (v: { id: Id; emoji: string }) => api.post<GroupMessage>(`/api/member/group/messages/${v.id}/reactions`, { emoji: v.emoji }),
      onSuccess: replace,
    }),
    vote: useMutation({
      mutationFn: (v: { id: Id; options: number[] }) => api.post<GroupMessage>(`/api/member/group/messages/${v.id}/votes`, { options: v.options }),
      onSuccess: replace,
    }),
    remove: useMutation({ mutationFn: (id: Id) => api.del(`/api/member/group/messages/${id}`), onSuccess: refresh }),
    pin: useMutation({
      mutationFn: (v: { id: Id; pin: boolean }) => (v.pin ? api.put<GroupMessage>(`/api/member/group/messages/${v.id}/pin`) : api.del<GroupMessage>(`/api/member/group/messages/${v.id}/pin`)),
      onSuccess: refresh,
    }),
    report: useMutation({ mutationFn: (v: { id: Id; reason: string }) => api.post(`/api/member/group/messages/${v.id}/report`, { reason: v.reason }), onSuccess: refresh }),
    resolve: useMutation({ mutationFn: (v: { id: Id; keep: boolean }) => api.post(`/api/member/group/messages/${v.id}/resolve`, { keep: v.keep }), onSuccess: refresh }),
    block: useMutation({ mutationFn: (userId: Id) => api.put(`/api/member/group/blocks/${userId}`), onSuccess: refresh }),
    moderate: useMutation({
      mutationFn: (v: { userId: Id; muteHours?: number; ban?: boolean }) =>
        api.post(`/api/member/group/members/${v.userId}/moderate`, { ...(v.muteHours !== undefined ? { muteHours: v.muteHours } : {}), ...(v.ban !== undefined ? { ban: v.ban } : {}) }),
      onSuccess: refresh,
    }),
    notify: useMutation({
      mutationFn: (mode: GroupNotify) => api.put('/api/member/group/notify', { mode }),
      onSuccess: (_r, mode) => qc.setQueryData<GroupInfo | null>(groupKey, (info) => info && { ...info, notify: mode }),
    }),
    acceptRules: useMutation({ mutationFn: () => api.post('/api/member/group/rules'), onSuccess: refresh }),
    markRead: useMutation({
      mutationFn: () => api.post('/api/member/group/read'),
      onSuccess: () => qc.setQueryData<GroupInfo | null>(groupKey, (info) => info && { ...info, unread: 0 }),
    }),
  };
}

/** All messages of the loaded pages, newest first, each once. */
export function flatMessages(data: InfiniteData<GroupPage> | undefined): GroupMessage[] {
  const seen = new Set<string>();
  const out: GroupMessage[] = [];
  for (const page of data?.pages ?? []) {
    for (const m of page.items) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
    }
  }
  return out;
}

/** The team: reported messages with who reported them and why (software 11.11.2026). */
export interface GroupReportedMessage { message: GroupMessage; reports: { name: string; reason: string; at: UnixSec }[] }
/** The team: who voted what. */
export interface GroupPollVoters { options: { option: string; voters: { id: Id; name: string }[] }[] }

export function useGroupReports(open: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: [...groupKey, 'reports'] as const,
    enabled: open,
    queryFn: async () => (await api.get<{ items: GroupReportedMessage[] }>('/api/member/group/reports')).items,
  });
}

export function usePollVoters(messageId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: [...groupKey, 'votes', messageId] as const,
    enabled: !!messageId,
    queryFn: () => api.get<GroupPollVoters>(`/api/member/group/messages/${messageId}/votes`),
  });
}
