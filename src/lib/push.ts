// Push for the group (owner 10.11.2026: "Benachrichtigung bitte auch"; software migration 0120). The phone asks for permission when the member is in the
// group, gets its Expo push token and tells the community (PUT /api/member/push-token); the community sends through Expo's push service. What reaches the
// member they choose with the bell in the chat (all · the team and answers to me · nothing). A tap on such a push opens the group — also when the app was
// closed: the tab bar opens it as soon as the group's tab is there. While the chat itself is on screen a new message does not ring.
// Logging out removes the phone again.
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { ApiClient } from './api';

export const GROUP_CHANNEL = 'gruppe';
export const GROUP_PATH = '/gruppe';

let registered: { base: string; token: string } | null = null;
let chatOpen = false;
let openPending = false;
const openListeners = new Set<() => void>();

/** The chat says when it is on screen (a push of the group then stays quiet). */
export function setGroupChatOpen(open: boolean): void {
  chatOpen = open;
}

export function isGroupPush(n: Notifications.Notification): boolean {
  return n.request.content.data?.path === GROUP_PATH;
}

/** Shown while the app is open? Not a message of the group while one reads the group. */
export function showWhileOpen(n: Notifications.Notification): boolean {
  return !(isGroupPush(n) && chatOpen);
}

export type PushState = 'on' | 'denied' | 'unavailable';

/** The phone for the group's pushes: the Android channel, the permission (asked only with `ask`), the token to the community (once per app start). */
export async function registerGroupPush(api: ApiClient, ask: boolean): Promise<PushState> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(GROUP_CHANNEL, { name: 'Gruppe', importance: AndroidImportance.HIGH });
    }
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && ask && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return 'denied';
    const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
    const projectId = extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : {});
    if (registered?.token !== token || registered.base !== api.baseUrl) {
      await api.put('/api/member/push-token', { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' });
      registered = { base: api.baseUrl, token };
    }
    return 'on';
  } catch {
    return 'unavailable';
  }
}

/** Logging out: this phone gets no more pushes of the community. */
export async function forgetGroupPush(api: ApiClient): Promise<void> {
  const r = registered;
  registered = null;
  if (!r || r.base !== api.baseUrl) return;
  try {
    await api.del(`/api/member/push-token?token=${encodeURIComponent(r.token)}`);
  } catch { /* the community removes it when Expo calls it unknown */ }
}

/** A tap on a push of the group (lib/routine.ts hands it over): the group opens as soon as its tab is there. */
export function openGroupFromPush(): void {
  openPending = true;
  openListeners.forEach((l) => l());
}

/** In the tab bar: opens the group asked for by a push once `ready` (the group's tab is shown). */
export function useOpenGroupFromPush(ready: boolean): void {
  const [asked, setAsked] = useState(0);
  useEffect(() => {
    const l = () => setAsked((n) => n + 1);
    openListeners.add(l);
    return () => {
      openListeners.delete(l);
    };
  }, []);
  useEffect(() => {
    if (!ready || !openPending) return;
    openPending = false;
    router.navigate(GROUP_PATH as Href);
  }, [ready, asked]);
}

/** In the tab bar: a member in the group keeps the token fresh (without asking; the chat asks). */
export function useGroupPushSync(api: ApiClient | null, inGroup: boolean, wanted: boolean): void {
  useEffect(() => {
    if (api && inGroup && wanted) void registerGroupPush(api, false);
  }, [api, inGroup, wanted]);
}
