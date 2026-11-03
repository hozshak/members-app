// A PDF inside the app (owner 02.11.2026: "die PDF-Datei sollte man in der App öffnen können"). components/download.tsx has
// loaded it into the phone's cache with the member's session; iOS shows it here with pinch to zoom, the button at the top
// saves or sends it. (Android's web view cannot show PDFs: there the phone's PDF viewer opens instead.) The copy goes away on close.
import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Txt } from '@/components/ui';
import { space, usePalette } from '@/lib/theme';

export default function PdfScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { uri, title } = useLocalSearchParams<{ uri: string; title?: string }>();

  useEffect(() => () => {
    try {
      const copy = new File(uri);
      if (copy.exists) copy.delete();
    } catch { /* the cache is cleaned by the system anyway */ }
  }, [uri]);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingTop: insets.top + space.s, paddingBottom: space.s, paddingHorizontal: space.l, backgroundColor: p.surface }}>
        <Pressable accessibilityRole="button" accessibilityLabel="PDF schließen" hitSlop={12} onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={p.text} />
        </Pressable>
        <Txt variant="heading" numberOfLines={1} style={{ flex: 1 }}>{title ?? 'PDF'}</Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="PDF herunterladen oder teilen"
          hitSlop={12}
          onPress={() => void Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title }).catch(() => undefined)}
        >
          <Ionicons name="download-outline" size={24} color={p.accent} />
        </Pressable>
      </View>
      <WebView
        source={{ uri }}
        originWhitelist={['*']}
        allowFileAccess
        allowingReadAccessToURL={Paths.cache.uri}
        style={{ flex: 1, backgroundColor: p.bg }}
        startInLoadingState
        renderLoading={() => (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={p.accent} />
          </View>
        )}
      />
    </View>
  );
}
