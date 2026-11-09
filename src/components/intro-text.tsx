// The text of an introduction page (lib/intro-text.ts): paragraphs with their bold labels, tips in a box, the coach's pictures at their place.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ProgrammeIntroImage } from '@/lib/intro';
import { introBlocks } from '@/lib/intro-text';
import { linkParts, useOpenLink } from '@/lib/links';
import { useSession } from '@/lib/session';
import { radius, space, usePalette } from '@/lib/theme';
import { Txt } from './ui';

function Paragraph({ label, text, muted }: { label: string | null; text: string; muted?: boolean }) {
  const p = usePalette();
  const openLink = useOpenLink();
  return (
    <Txt muted={muted}>
      {label ? <Text style={{ fontWeight: '700', color: p.text }}>{label}: </Text> : null}
      {linkParts(text).map((part, i) => {
        const href = part.href;
        return href ? (
          <Text key={i} accessibilityRole="link" onPress={() => openLink(href)} style={{ color: p.accent, textDecorationLine: 'underline' }}>{part.text}</Text>
        ) : (
          part.text
        );
      })}
    </Txt>
  );
}

/** A picture of the coach, in its own proportions (until it is loaded 4:3). */
function Picture({ url, label }: { url: string; label: string }) {
  const p = usePalette();
  const { api } = useSession();
  const [aspect, setAspect] = useState(4 / 3);
  if (!api) return null;
  return (
    <Image
      source={{ uri: api.url(url), headers: api.mediaHeaders() }}
      accessibilityLabel={label}
      onLoad={(e) => {
        const { width, height } = e.source;
        if (width > 0 && height > 0) setAspect(Math.max(0.5, Math.min(2.4, width / height)));
      }}
      style={{ width: '100%', aspectRatio: aspect, borderRadius: radius.l, backgroundColor: p.surfaceAlt }}
      contentFit="cover"
      transition={150}
      accessibilityIgnoresInvertColors
    />
  );
}

export function IntroText({ text, images, muted, style }: { text: string; images?: readonly ProgrammeIntroImage[]; muted?: boolean; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  const blocks = introBlocks(text, images ?? []);
  if (blocks.length === 0) return null;
  return (
    <View style={[{ gap: space.m }, style]}>
      {blocks.map((b, i) => {
        if (b.kind === 'image') return <Picture key={i} url={b.url} label={b.label} />;
        if (b.kind === 'tip') {
          return (
            <View key={i} style={{ flexDirection: 'row', gap: space.m, padding: space.m, borderRadius: radius.l, backgroundColor: p.accentSoft }}>
              <Ionicons name="bulb-outline" size={22} color={p.accent} style={{ marginTop: 1 }} />
              <View style={{ flex: 1, gap: 2 }}>
                {b.label ? <Txt variant="heading" color={p.accent}>{b.label}</Txt> : null}
                <Paragraph label={null} text={b.text} />
              </View>
            </View>
          );
        }
        return <Paragraph key={i} label={b.label} text={b.text} muted={muted} />;
      })}
    </View>
  );
}
