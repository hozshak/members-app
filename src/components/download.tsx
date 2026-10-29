// One PDF of a product or a lesson: a short-lived signed address from the software, opened in the phone's browser
// (which shows or saves the PDF).
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { View } from 'react-native';
import { errorText } from '@/lib/api';
import { useApi } from '@/lib/session';
import { space, usePalette } from '@/lib/theme';
import type { DownloadLink, MemberDownload } from '@/lib/types';
import { Card, Txt } from './ui';

export function DownloadRow({ file, onOpened }: { file: MemberDownload; onOpened?: () => void }) {
  const p = usePalette();
  const api = useApi();
  const [error, setError] = useState<string | null>(null);
  const open = async () => {
    setError(null);
    try {
      const link = await api.post<DownloadLink>(`/api/member/downloads/${encodeURIComponent(file.id)}/link`);
      await WebBrowser.openBrowserAsync(api.url(link.url));
      onOpened?.();
    } catch (err) {
      setError(errorText(err));
    }
  };
  const mb = Math.max(0.1, Math.round((file.sizeBytes / 1024 / 1024) * 10) / 10).toLocaleString('de-DE');
  return (
    <Card onPress={() => void open()} accessibilityLabel={`${file.title} öffnen`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m }}>
      <Ionicons name="document-text-outline" size={24} color={p.accent} />
      <View style={{ flex: 1 }}>
        <Txt variant="heading" numberOfLines={2}>{file.title}</Txt>
        <Txt variant="small" muted color={error ? p.danger : undefined}>{error ?? `PDF · ${mb} MB`}</Txt>
      </View>
      <Ionicons name="open-outline" size={18} color={p.textMuted} />
    </Card>
  );
}
