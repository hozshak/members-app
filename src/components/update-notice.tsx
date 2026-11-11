// "Neues Update ist da" on the start page (owner 11.11.2026, lib/app-update.ts): a card with the version, "Jetzt aktualisieren" (iPhone: the App Store
// page; Android: the new app file from the community) and "Später" (a day).
import { Ionicons } from '@expo/vector-icons';
import { Linking, View } from 'react-native';
import { useAppUpdate } from '@/lib/app-update';
import { radius, space, usePalette } from '@/lib/theme';
import { Button, Txt } from './ui';

export function UpdateNotice() {
  const p = usePalette();
  const { update, later } = useAppUpdate();
  if (!update) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{ padding: space.l, gap: space.m, borderRadius: radius.l, backgroundColor: p.accentSoft, borderWidth: 1, borderColor: p.accent }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: p.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-up-circle" size={24} color={p.onAccent} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="heading">Neues Update ist da</Txt>
          <Txt variant="small" muted>Version {update.version} ist raus. Bitte aktualisiere bald, damit alles weiter rund läuft.</Txt>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: space.s }}>
        <Button label="Jetzt aktualisieren" onPress={() => void Linking.openURL(update.url)} style={{ flex: 1 }} />
        <Button label="Später" kind="ghost" onPress={later} />
      </View>
    </View>
  );
}
