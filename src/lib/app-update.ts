// Is a newer app out? (owner 11.11.2026: "wenn ein neues Update kommt, soll in der App für Android und Apple zu sehen sein: neues Update ist raus, die
// müssen bald updaten")
//   Android  the community names the version of the app file uploaded in its dashboard (GET /api/member/home → app.androidVersionCode, read from the
//            file by the software); an app with a smaller version code (expo-application nativeBuildVersion) is older → the file is the update.
//   iPhone   Apple's public lookup tells the version in the App Store (itunes.apple.com/lookup?bundleId=…); an app with a smaller version number
//            (nativeApplicationVersion, e.g. "1.0.3") is older → its App Store page is the update. A build from TestFlight with the same number is not.
// "Später" hides the notice for a day; the next app start after that shows it again until the update is installed.
import { useQuery } from '@tanstack/react-query';
import * as Application from 'expo-application';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useHome } from './queries';
import { useSession } from './session';
import { getItem, setItem } from './storage';

export interface AppUpdate { version: string; url: string }

const LATER_KEY = 'members.updateLater';
const DAY_MS = 24 * 60 * 60 * 1000;

/** "1.10.2" > "1.9" (missing parts count as 0). */
export function newerVersion(latest: string, own: string): boolean {
  const a = latest.split('.').map((x) => Number.parseInt(x, 10) || 0);
  const b = own.split('.').map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

function useAppStoreVersion(enabled: boolean) {
  return useQuery({
    queryKey: ['app-store-version', Application.applicationId],
    enabled: enabled && !!Application.applicationId,
    staleTime: 6 * 60 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<{ version: string; url: string } | null> => {
      const res = await fetch(`https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(Application.applicationId ?? '')}&country=de`);
      if (!res.ok) return null;
      const body = (await res.json()) as { results?: { version?: string; trackViewUrl?: string }[] };
      const hit = body.results?.[0];
      return hit?.version && hit.trackViewUrl ? { version: hit.version, url: hit.trackViewUrl } : null;
    },
  });
}

/** The update to show now, or null (none, not known, or put off with "Später"). `later()` puts it off for a day. */
export function useAppUpdate(): { update: AppUpdate | null; later: () => void } {
  const { api } = useSession();
  const home = useHome();
  const ios = Platform.OS === 'ios';
  const store = useAppStoreVersion(ios);
  // the version put off with "Später" (only while its day runs)
  const [putOff, setPutOff] = useState<string | null>(null);
  useEffect(() => {
    void getItem(LATER_KEY).then((raw) => {
      try {
        const v = raw ? (JSON.parse(raw) as { version: string; until: number }) : null;
        if (v && typeof v.version === 'string' && typeof v.until === 'number' && v.until > Date.now()) setPutOff(v.version);
      } catch { /* none */ }
    });
  }, []);

  let update: AppUpdate | null = null;
  const app = home.data?.app;
  if (Platform.OS === 'android' && app?.android && app.androidVersionCode && api) {
    const own = Number.parseInt(Application.nativeBuildVersion ?? '', 10);
    if (Number.isFinite(own) && app.androidVersionCode > own) {
      update = { version: app.androidVersionName ?? String(app.androidVersionCode), url: api.url(app.android) };
    }
  } else if (ios && store.data && Application.nativeApplicationVersion && newerVersion(store.data.version, Application.nativeApplicationVersion)) {
    update = store.data;
  }
  if (update && putOff === update.version) update = null;

  const version = update?.version ?? null;
  const later = useCallback(() => {
    if (!version) return;
    setPutOff(version);
    void setItem(LATER_KEY, JSON.stringify({ version, until: Date.now() + DAY_MS }));
  }, [version]);
  return { update, later };
}
