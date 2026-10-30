// The buttons of the member start page, as on the website (Einstellungen → Mitgliederbereich → "Startseite: Buttons" of
// the software, e.g. "WhatsApp-Gruppe" and "Bewertung abgeben"). Plain https links: a chat invitation opens the chat
// app, everything else the browser. The software only sends enabled buttons the member may see.
import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, View } from 'react-native';
import type { HomeButtonIcon, MemberHomeButton } from '@/lib/types';
import { radius, space, usePalette } from '@/lib/theme';
import { Txt } from './ui';

const ICONS: Record<HomeButtonIcon, keyof typeof Ionicons.glyphMap> = {
  chat: 'chatbubbles', star: 'star', link: 'open-outline', camera: 'camera', calendar: 'calendar',
};

/** The chat icon of WhatsApp for its invitation links (chat.whatsapp.com, wa.me). */
function iconOf(b: MemberHomeButton): keyof typeof Ionicons.glyphMap {
  if (b.icon === 'chat' && /^https:\/\/(chat\.whatsapp\.com|wa\.me)\//i.test(b.url)) return 'logo-whatsapp';
  return ICONS[b.icon] ?? 'open-outline';
}

export function HomeButtons({ buttons }: { buttons: MemberHomeButton[] }) {
  const p = usePalette();
  const links = buttons.filter((b) => /^https:\/\//i.test(b.url));
  if (links.length === 0) return null;
  return (
    <View style={{ gap: space.s }}>
      {links.map((b) => {
        const primary = b.style === 'primary';
        const fg = primary ? p.onAccent : p.text;
        return (
          <Pressable
            key={b.id}
            accessibilityRole="link"
            accessibilityLabel={b.label}
            onPress={() => void Linking.openURL(b.url).catch(() => undefined)}
            style={({ pressed }) => ({
              minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s,
              paddingHorizontal: space.l, borderRadius: radius.l, backgroundColor: primary ? p.accent : p.surfaceAlt,
              opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Ionicons name={iconOf(b)} size={20} color={fg} />
            <Txt variant="heading" color={fg} numberOfLines={1} style={{ flexShrink: 1 }}>{b.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
