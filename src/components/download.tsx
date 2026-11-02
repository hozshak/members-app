// One PDF of a product or a lesson, opened IN the app. The address from the software is short-lived and only valid with
// the member's session, so a browser could never open it (it does not have the session): the app loads the file itself
// into the phone's cache and shows it (iOS: screen /pdf; Android: the phone's PDF viewer, its web view cannot show PDFs).
import { Ionicons } from '@expo/vector-icons';
import { Directory, File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { ApiError, errorText, type ApiClient } from '@/lib/api';
import { useApi } from '@/lib/session';
import { space, usePalette } from '@/lib/theme';
import type { DownloadLink, MemberDownload } from '@/lib/types';
import { Card, Txt } from './ui';

/** Android: the phone's PDF viewer gets read access to this one file (flag 1 = FLAG_GRANT_READ_URI_PERMISSION). */
async function openOnAndroid(uri: string): Promise<void> {
  const data = await getContentUriAsync(uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data, flags: 1, type: 'application/pdf' });
}

/** The browser (development only): with the session as a header, then a new tab. */
async function openOnWeb(api: ApiClient, url: string): Promise<void> {
  const res = await fetch(url, { headers: api.mediaHeaders() });
  if (!res.ok) throw new Error('download_failed');
  window.open(URL.createObjectURL(await res.blob()), '_blank');
}

export function DownloadRow({ file, onOpened }: { file: MemberDownload; onOpened?: () => void }) {
  const p = usePalette();
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const link = await api.post<DownloadLink>(`/api/member/downloads/${encodeURIComponent(file.id)}/link`);
      const url = api.url(link.url);
      if (Platform.OS === 'web') {
        await openOnWeb(api, url);
      } else {
        const dir = new Directory(Paths.cache, 'pdf');
        dir.create({ idempotent: true, intermediates: true });
        const target = new File(dir, `${file.id}.pdf`);
        if (target.exists) target.delete();
        const saved = await File.downloadFileAsync(url, target, { headers: api.mediaHeaders() });
        if (Platform.OS === 'android') await openOnAndroid(saved.uri);
        else router.push({ pathname: '/pdf', params: { uri: saved.uri, title: file.title } } as unknown as Href);
      }
      onOpened?.();
    } catch (err) {
      setError(err instanceof ApiError ? errorText(err) : 'Das PDF konnte nicht geladen werden. Bitte versuche es noch einmal.');
    } finally {
      setBusy(false);
    }
  };
  const mb = Math.max(0.1, Math.round((file.sizeBytes / 1024 / 1024) * 10) / 10).toLocaleString('de-DE');
  return (
    <Card onPress={() => void open()} accessibilityLabel={`${file.title} öffnen`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m }}>
      <Ionicons name="document-text-outline" size={24} color={p.accent} />
      <View style={{ flex: 1 }}>
        <Txt variant="heading" numberOfLines={2}>{file.title}</Txt>
        <Txt variant="small" muted color={error ? p.danger : undefined}>{error ?? (busy ? 'PDF wird geladen …' : `PDF · ${mb} MB`)}</Txt>
      </View>
      {busy ? <ActivityIndicator color={p.accent} /> : <Ionicons name="chevron-forward" size={18} color={p.textMuted} />}
    </Card>
  );
}
