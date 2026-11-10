// Stage 1: choose the community. For now exactly two (owner 30.10.2026: "erstmal nur zwei zeigen"): The Holy Face Method
// and HOLY SHIT. Each address is checked against /api/public/bootstrap before it is kept. During development a long press
// on "Members" opens a field for any other address (local test servers).
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { Button, Card, Screen, Txt } from '@/components/ui';
import { errorText } from '@/lib/api';
import { useSession } from '@/lib/session';
import { radius, space, usePalette } from '@/lib/theme';

/** The communities of the app (colour = their accent colour on the website). */
const COMMUNITIES = [
  { name: 'The Holy Face Method', url: 'member.theholyface.de', color: '#BD9553' },
  { name: 'HOLY SHIT', url: 'holyshit.feelingxhealthy.de', color: '#FE6E13' },
];

export default function CommunityScreen() {
  const p = usePalette();
  const { chooseCommunity } = useSession();
  const [address, setAddress] = useState('');
  const [devField, setDevField] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (url: string, name?: string) => {
    setBusy(url);
    setError(null);
    try {
      await chooseCommunity(url, name);
    } catch (err) {
      setError(err instanceof Error && err.message && !/^[a-z_]+$/.test(err.message) ? err.message : errorText(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentStyle={{ paddingTop: space.xxl * 2 }}>
        <View style={{ gap: space.s }}>
          <Pressable onLongPress={__DEV__ ? () => setDevField(true) : undefined} accessible={false}>
            <Txt variant="caption" color={p.accent}>THFM</Txt>
          </Pressable>
          <Txt variant="display">Wo bist du Mitglied?</Txt>
          <Txt muted>Wähle deinen Memberbereich. Danach meldest du dich mit derselben E-Mail und demselben Passwort an wie auf der Website.</Txt>
        </View>

        <View style={{ gap: space.m }}>
          {COMMUNITIES.map((c) => (
            <Card key={c.url} onPress={() => void choose(c.url, c.name)} accessibilityLabel={`${c.name} öffnen`} style={{ padding: space.l }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
                <View style={{ width: 48, height: 48, borderRadius: radius.m, backgroundColor: c.color, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt variant="title" color="#FFFFFF">{c.name.replace(/^The /, '').slice(0, 1)}</Txt>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="heading">{c.name}</Txt>
                  <Txt variant="small" muted>{c.url}</Txt>
                </View>
                {busy === c.url ? <Txt variant="small" muted>…</Txt> : null}
              </View>
            </Card>
          ))}
        </View>

        {devField ? (
          <View style={{ gap: space.s, marginTop: space.m }}>
            <Txt variant="heading">Andere Adresse (Entwicklung)</Txt>
            <TextInput
              value={address}
              onChangeText={(v) => { setAddress(v); setError(null); }}
              placeholder="z. B. http://localhost:8090"
              placeholderTextColor={p.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={() => address.trim() && void choose(address)}
              accessibilityLabel="Adresse eines Mitgliederbereichs"
              style={{ minHeight: 50, borderRadius: radius.l, borderWidth: 1, borderColor: p.line, backgroundColor: p.surface, color: p.text, paddingHorizontal: space.l, fontSize: 16 }}
            />
            <Button label="Weiter" kind="secondary" onPress={() => void choose(address)} disabled={!address.trim()} loading={busy === address} />
          </View>
        ) : null}

        {error ? <Txt color={p.danger} style={{ textAlign: 'center' }}>{error}</Txt> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
