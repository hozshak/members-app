// "Deine Tools" (owner 09.11.2026): the things the coach uses in her routines, with a link each (often her affiliate links). Opened from its own icon at the
// top of the start page; the list comes with the start page (Einstellungen → Mitgliederbereich → Toolbox der App in the dashboard). A tap opens the link.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Linking, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen, Txt } from '@/components/ui';
import { useHome } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { radius, space, usePalette } from '@/lib/theme';

export default function ToolsScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { community } = useSession();
  const tools = useHome().data?.tools ?? [];
  return (
    <Screen contentStyle={{ paddingTop: insets.top + space.m, gap: space.l }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Schließen" hitSlop={12} onPress={() => router.back()} style={{ alignSelf: 'flex-start' }}>
        <Ionicons name="close" size={28} color={p.text} />
      </Pressable>
      <View style={{ gap: space.xs }}>
        <Txt variant="caption" color={p.accent}>Toolbox</Txt>
        <Txt variant="display">Deine Tools</Txt>
        <Txt muted>Damit arbeitet {community?.name ?? 'dein Memberbereich'} in den Übungen. Ein Tipp öffnet den Link.</Txt>
      </View>
      <View style={{ gap: space.s }}>
        {tools.length === 0 ? <Txt muted>Gerade sind hier keine Tools eingetragen.</Txt> : null}
        {tools.map((t) => (
          <Pressable
            key={t.id}
            accessibilityRole="link"
            accessibilityLabel={t.text ? `${t.title}: ${t.text}` : t.title}
            onPress={() => void Linking.openURL(t.url).catch(() => undefined)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m, borderRadius: radius.l,
              backgroundColor: p.surface, borderWidth: 1, borderColor: p.line, opacity: pressed ? 0.75 : 1,
            })}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="bag-handle-outline" size={22} color={p.accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="heading">{t.title}</Txt>
              {t.text ? <Txt variant="small" muted>{t.text}</Txt> : null}
            </View>
            <Ionicons name="open-outline" size={18} color={p.textMuted} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
