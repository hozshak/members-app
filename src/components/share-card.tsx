// A picture of the member's success for Instagram & co. (4:5): the community, the streak or a badge, the routine. It is
// drawn off screen, captured as a PNG (react-native-view-shot) and handed to the phone's share sheet.
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { useRef, type ComponentRef } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useSession } from '@/lib/session';
import { onColor } from '@/lib/theme';

export interface ShareContent {
  big: string;        // "30"
  label: string;      // "Tage in Folge"
  line: string;       // the routine's title or the badge
}

const W = 360;

/** Returns the off-screen card element and `share(content)`; render the element once in the screen. */
export function useShareCard(content: ShareContent | null) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const { community } = useSession();
  const accent = community?.accentColor ?? '#C2410C';
  const fg = onColor(accent);

  const share = async () => {
    if (!ref.current || Platform.OS === 'web') return;
    try {
      const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Teilen geht auf diesem Gerät nicht.');
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Erfolg teilen', UTI: 'public.png' });
    } catch {
      Alert.alert('Das Bild konnte nicht erstellt werden.');
    }
  };

  const element = content ? (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={{ position: 'absolute', left: -W * 3, top: 0 }}
    >
      <View ref={ref} collapsable={false} style={{ width: W, height: W * 1.25, backgroundColor: accent, padding: 32, justifyContent: 'space-between', overflow: 'hidden' }}>
        <Ionicons name="flame" size={300} color={fg} style={{ position: 'absolute', right: -60, bottom: -40, opacity: 0.12 }} />
        <Text style={{ color: fg, fontSize: 14, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' }}>{community?.name ?? ''}</Text>
        <View>
          <Text style={{ color: fg, fontSize: 120, lineHeight: 124, fontWeight: '800', letterSpacing: -4 }}>{content.big}</Text>
          <Text style={{ color: fg, fontSize: 30, lineHeight: 34, fontWeight: '700' }}>{content.label}</Text>
          <Text style={{ color: fg, fontSize: 18, lineHeight: 24, marginTop: 12, opacity: 0.85 }}>{content.line}</Text>
        </View>
        <Text style={{ color: fg, fontSize: 13, opacity: 0.75 }}>Meine Routine · mit der App „Members“</Text>
      </View>
    </View>
  ) : null;

  return { element, share };
}
