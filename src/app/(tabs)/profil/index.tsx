// Profile: who is logged in where, the account on the website (profile and password are managed there for now),
// log out, and switching the community.
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Screen, Txt } from '@/components/ui';
import { useSession } from '@/lib/session';
import { space, usePalette } from '@/lib/theme';

function LinkRow({ label, icon, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  const p = usePalette();
  return (
    <Card onPress={onPress} accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l }}>
      <Ionicons name={icon} size={22} color={p.accent} />
      <Txt variant="heading" style={{ flex: 1 }}>{label}</Txt>
      <Ionicons name="open-outline" size={18} color={p.textMuted} />
    </Card>
  );
}

export default function ProfileScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { me, community, logout, forgetCommunity } = useSession();
  if (!community) return null;
  const name = me?.displayName || [me?.firstName, me?.lastName].filter(Boolean).join(' ') || me?.email || '';

  return (
    <Screen contentStyle={{ paddingTop: insets.top + space.l, gap: space.xl }}>
      <View style={{ gap: space.m, alignItems: 'flex-start' }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Txt variant="title" color={p.accent}>{(name.trim()[0] ?? '?').toLocaleUpperCase('de-DE')}</Txt>
        </View>
        <View style={{ gap: 2 }}>
          <Txt variant="display">{name}</Txt>
          {me?.email && me.email !== name ? <Txt muted>{me.email}</Txt> : null}
          <Txt variant="small" muted>Mitglied bei {community.name}{me?.memberNo ? ` · Nr. ${me.memberNo}` : ''}</Txt>
        </View>
      </View>

      <View style={{ gap: space.m }}>
        <LinkRow label="Profil und Passwort" icon="person-outline" onPress={() => void WebBrowser.openBrowserAsync(`${community.url}/profil`)} />
        <LinkRow label="Hilfe und Datenschutz" icon="help-circle-outline" onPress={() => void WebBrowser.openBrowserAsync(`${community.url}/rechtliches/datenschutz`)} />
      </View>

      <View style={{ gap: space.m }}>
        <Button label="Abmelden" kind="secondary" onPress={() => void logout()} />
        <Button label="Andere Community wählen" kind="ghost" onPress={() => void forgetCommunity()} />
      </View>
    </Screen>
  );
}
