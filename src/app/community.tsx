// Stage 1: choose the community. The known communities as cards; any other one by its address
// (e.g. "member.theholyface.de"). The address is checked against /api/public/bootstrap before it is kept.
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { Button, Card, Screen, Txt } from '@/components/ui';
import { errorText } from '@/lib/api';
import { useSession } from '@/lib/session';
import { radius, space, usePalette } from '@/lib/theme';

/** Communities that use the membership software (shown as cards; any other HTTPS address works through the field). */
const KNOWN = [
  { name: 'The Holy Face Method', url: 'member.theholyface.de' },
  { name: 'Vorschau', url: 'mitglieder.altraex.workers.dev' },
];

export default function CommunityScreen() {
  const p = usePalette();
  const { chooseCommunity } = useSession();
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (url: string) => {
    setBusy(url);
    setError(null);
    try {
      await chooseCommunity(url);
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
          <Txt variant="caption" color={p.accent}>Members</Txt>
          <Txt variant="display">Wo bist du Mitglied?</Txt>
          <Txt muted>Wähle deine Community. Danach meldest du dich mit derselben E-Mail und demselben Passwort an wie auf der Website.</Txt>
        </View>

        <View style={{ gap: space.m }}>
          {KNOWN.map((c) => (
            <Card key={c.url} onPress={() => void choose(c.url)} accessibilityLabel={`${c.name} öffnen`} style={{ padding: space.l }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
                <View style={{ width: 44, height: 44, borderRadius: radius.m, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt variant="heading" color={p.accent}>{c.name.slice(0, 1)}</Txt>
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

        <View style={{ gap: space.s, marginTop: space.m }}>
          <Txt variant="heading">Andere Adresse</Txt>
          <TextInput
            value={address}
            onChangeText={(v) => { setAddress(v); setError(null); }}
            placeholder="z. B. mitglieder.deine-seite.de"
            placeholderTextColor={p.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={() => address.trim() && void choose(address)}
            accessibilityLabel="Adresse deines Mitgliederbereichs"
            style={{ minHeight: 50, borderRadius: radius.l, borderWidth: 1, borderColor: p.line, backgroundColor: p.surface, color: p.text, paddingHorizontal: space.l, fontSize: 16 }}
          />
          <Button label="Weiter" kind="secondary" onPress={() => void choose(address)} disabled={!address.trim()} loading={busy === address} />
        </View>

        {error ? <Txt color={p.danger} style={{ textAlign: 'center' }}>{error}</Txt> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
