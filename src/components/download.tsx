// One PDF of a product or a lesson: "Öffnen" shows it IN the app, "Herunterladen" saves it (the phone's own dialog: Dateien,
// AirDrop, Mail …). The address from the software is short-lived and only valid with the member's session, so a browser could
// never open it (it does not have the session): the app loads the file itself into the phone's cache and shows it (iOS:
// screen /pdf; Android: the phone's PDF viewer, its web view cannot show PDFs).
import { Ionicons } from '@expo/vector-icons';
import { Directory, File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { router, type Href } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';
import { ApiError, errorText, type ApiClient } from '@/lib/api';
import { useApi } from '@/lib/session';
import { radius, space, usePalette } from '@/lib/theme';
import type { DownloadLink, MemberDownload } from '@/lib/types';
import { Card, Txt } from './ui';

type Action = 'open' | 'save';

/** Android: the phone's PDF viewer gets read access to this one file (flag 1 = FLAG_GRANT_READ_URI_PERMISSION). */
async function openOnAndroid(uri: string): Promise<void> {
  const data = await getContentUriAsync(uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data, flags: 1, type: 'application/pdf' });
}

/** The browser (development only): with the session as a header, then a new tab or a saved file. */
async function loadOnWeb(api: ApiClient, url: string, action: Action, filename: string): Promise<void> {
  const res = await fetch(url, { headers: api.mediaHeaders() });
  if (!res.ok) throw new Error('download_failed');
  const local = URL.createObjectURL(await res.blob());
  if (action === 'open') {
    window.open(local, '_blank');
    return;
  }
  const a = document.createElement('a');
  a.href = local;
  a.download = filename;
  a.click();
}

/** The name the file gets when it is saved. */
function saveName(file: MemberDownload): string {
  const name = (file.filename || file.title).replace(/[\\/:*?"<>|]/g, '_').trim() || 'Dokument';
  return /\.pdf$/i.test(name) ? name : `${name}.pdf`;
}

function ActionButton({ icon, label, busy, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; busy: boolean; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy }}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs,
        paddingHorizontal: space.s, borderRadius: radius.m, backgroundColor: p.surfaceAlt, opacity: pressed ? 0.85 : 1,
      })}
    >
      {busy ? <ActivityIndicator color={p.accent} size="small" /> : <Ionicons name={icon} size={18} color={p.accent} />}
      <Txt variant="small" style={{ fontWeight: '700' }} numberOfLines={1}>{label}</Txt>
    </Pressable>
  );
}

export function DownloadRow({ file, onOpened }: { file: MemberDownload; onOpened?: () => void }) {
  const p = usePalette();
  const api = useApi();
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: Action) => {
    if (busy) return;
    setBusy(action);
    setError(null);
    try {
      const link = await api.post<DownloadLink>(`/api/member/downloads/${encodeURIComponent(file.id)}/link`);
      const url = api.url(link.url);
      if (Platform.OS === 'web') {
        await loadOnWeb(api, url, action, saveName(file));
      } else {
        const dir = new Directory(Paths.cache, 'pdf');
        dir.create({ idempotent: true, intermediates: true });
        const target = new File(dir, action === 'save' ? saveName(file) : `${file.id}.pdf`);
        if (target.exists) target.delete();
        const saved = await File.downloadFileAsync(url, target, { headers: api.mediaHeaders() });
        if (action === 'save') await Sharing.shareAsync(saved.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: file.title });
        else if (Platform.OS === 'android') await openOnAndroid(saved.uri);
        else router.push({ pathname: '/pdf', params: { uri: saved.uri, title: file.title } } as unknown as Href);
      }
      onOpened?.();
    } catch (err) {
      setError(err instanceof ApiError ? errorText(err) : 'Das PDF konnte nicht geladen werden. Bitte versuche es noch einmal.');
    } finally {
      setBusy(null);
    }
  };
  const mb = Math.max(0.1, Math.round((file.sizeBytes / 1024 / 1024) * 10) / 10).toLocaleString('de-DE');
  return (
    <Card style={{ gap: space.m, padding: space.m }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <Ionicons name="document-text-outline" size={24} color={p.accent} />
        <View style={{ flex: 1 }}>
          <Txt variant="heading" numberOfLines={2}>{file.title}</Txt>
          <Txt variant="small" muted color={error ? p.danger : undefined}>{error ?? (busy ? 'PDF wird geladen …' : `PDF · ${mb} MB`)}</Txt>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: space.s }}>
        <ActionButton icon="book-outline" label="Öffnen" busy={busy === 'open'} onPress={() => void run('open')} />
        <ActionButton icon="download-outline" label="Herunterladen" busy={busy === 'save'} onPress={() => void run('save')} />
      </View>
    </Card>
  );
}
