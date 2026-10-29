// Stage 2: log in to the chosen community with the same e-mail (or user name) and password as on the website.
// "Passwort vergessen?" opens the community's own page in the browser; "Andere Community" goes back to stage 1.
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { Button, Screen, Txt } from '@/components/ui';
import { errorText } from '@/lib/api';
import { useSession } from '@/lib/session';
import { radius, space, usePalette } from '@/lib/theme';

export default function LoginScreen() {
  const p = usePalette();
  const { community, login, forgetCommunity } = useSession();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  if (!community) return null;

  const submit = async () => {
    if (!name.trim() || !password) {
      setError('Bitte gib E-Mail und Passwort ein.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(name, password);
    } catch (err) {
      setError(err instanceof Error && err.message && !/^[a-z_]+$/.test(err.message) && !/^http_/.test(err.message) ? err.message : errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const field = { minHeight: 52, borderRadius: radius.l, borderWidth: 1, borderColor: p.line, backgroundColor: p.surface, color: p.text, paddingHorizontal: space.l, fontSize: 16 } as const;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentStyle={{ paddingTop: space.xxl * 2 }}>
        <View style={{ gap: space.m }}>
          {community.logoUrl ? (
            <Image source={{ uri: community.logoUrl }} style={{ height: 48, width: 160 }} contentFit="contain" contentPosition="left" accessibilityLabel={community.name} />
          ) : (
            <Txt variant="caption" color={p.accent}>{community.name}</Txt>
          )}
          <Txt variant="display">Anmelden</Txt>
          <Txt muted>Mit derselben E-Mail und demselben Passwort wie auf der Website von {community.name}.</Txt>
        </View>

        <View style={{ gap: space.m }}>
          <View style={{ gap: space.xs }}>
            <Txt variant="small" muted>E-Mail oder Benutzername</Txt>
            <TextInput
              value={name}
              onChangeText={(v) => { setName(v); setError(null); }}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="username"
              keyboardType="email-address"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              accessibilityLabel="E-Mail oder Benutzername"
              style={field}
            />
          </View>
          <View style={{ gap: space.xs }}>
            <Txt variant="small" muted>Passwort</Txt>
            <TextInput
              ref={passwordRef}
              value={password}
              onChangeText={(v) => { setPassword(v); setError(null); }}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              accessibilityLabel="Passwort"
              style={field}
            />
          </View>
          {error ? <Txt color={p.danger}>{error}</Txt> : null}
          <Button label="Anmelden" onPress={() => void submit()} loading={busy} style={{ marginTop: space.s }} />
        </View>

        <View style={{ gap: space.s, alignItems: 'center' }}>
          <Pressable accessibilityRole="link" hitSlop={10} onPress={() => void WebBrowser.openBrowserAsync(`${community.url}/passwort-vergessen`)}>
            <Txt color={p.accent} variant="heading">Passwort vergessen?</Txt>
          </Pressable>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={() => void forgetCommunity()}>
            <Txt muted variant="small">Andere Community wählen</Txt>
          </Pressable>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
