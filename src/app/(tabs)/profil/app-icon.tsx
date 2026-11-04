// "App-Icon": which picture the app has on the home screen (lib/app-icon.ts). The phone itself confirms the change with a short message.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Screen, Txt } from '@/components/ui';
import { APP_ICONS, currentAppIcon, setAppIcon, type AppIconId } from '@/lib/app-icon';
import { radius, space, usePalette } from '@/lib/theme';

export default function AppIconScreen() {
  const p = usePalette();
  const [current, setCurrent] = useState<AppIconId>(() => currentAppIcon());

  const choose = async (id: AppIconId) => {
    if (id === current) return;
    try {
      await setAppIcon(id);
      setCurrent(id);
    } catch {
      Alert.alert('Das hat nicht geklappt', 'Das Icon konnte gerade nicht geändert werden. Versuch es bitte noch einmal.');
    }
  };

  return (
    <Screen contentStyle={{ gap: space.m }}>
      <Txt muted>So sieht die App auf deinem Home-Bildschirm aus. Dein Handy bestätigt den Wechsel kurz mit einer Meldung.</Txt>
      {APP_ICONS.map((icon) => {
        const on = icon.id === current;
        return (
          <Pressable
            key={icon.name}
            accessibilityRole="radio"
            accessibilityLabel={icon.name}
            accessibilityState={{ checked: on }}
            onPress={() => void choose(icon.id)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: space.l, padding: space.m, borderRadius: radius.l, borderWidth: 2,
              borderColor: on ? p.accent : p.line, backgroundColor: on ? p.accentSoft : p.surface, opacity: pressed ? 0.85 : 1,
            })}
          >
            <Image source={icon.source} style={{ width: 84, height: 84 }} contentFit="contain" accessibilityIgnoresInvertColors />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="heading">{icon.name}</Txt>
              {icon.id === null ? <Txt variant="small" muted>Das normale Icon</Txt> : <Txt variant="small" muted>Mit goldenem Rahmen</Txt>}
            </View>
            <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={24} color={on ? p.accent : p.textMuted} />
          </Pressable>
        );
      })}
    </Screen>
  );
}
