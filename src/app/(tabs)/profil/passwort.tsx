// Change the password in the app (POST /api/auth/change-password). All other devices are logged out by the software;
// this phone stays logged in with the new session token from the answer.
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Button, Field, Screen, Txt } from '@/components/ui';
import { ApiError, errorText } from '@/lib/api';
import { useSession } from '@/lib/session';
import { space, usePalette } from '@/lib/theme';
import type { ChangePasswordResponse } from '@/lib/types';

const POLICY: Record<string, string> = {
  password_too_short: 'Das neue Passwort ist zu kurz.',
  password_common: 'Dieses Passwort ist zu bekannt – wähle ein anderes.',
  password_contains_context: 'Das Passwort darf deinen Namen oder deine E-Mail nicht enthalten.',
};

export default function ChangePasswordScreen() {
  const p = usePalette();
  const { api, me, replaceToken } = useSession();
  const min = me?.passwordMinLength ?? 10;
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (me?.linkedAccount) {
    return (
      <Screen>
        <Txt>Dein Passwort verwaltest du im Hauptbereich deiner Community. Melde dich dort auf der Website an, um es zu ändern.</Txt>
      </Screen>
    );
  }

  const save = async () => {
    if (!api) return;
    if (next.length < min) return setError(`Das neue Passwort braucht mindestens ${min} Zeichen.`);
    if (next !== repeat) return setError('Die beiden neuen Passwörter sind nicht gleich.');
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<ChangePasswordResponse>('/api/auth/change-password', { currentPassword: current, newPassword: next });
      if (res.token) await replaceToken(res.token);
      Alert.alert('Passwort geändert', 'Auf allen anderen Geräten bist du jetzt abgemeldet.');
      router.back();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'invalid_credentials') setError('Dein aktuelles Passwort stimmt nicht.');
      else if (err instanceof ApiError && err.code === 'password_policy') setError(POLICY[err.fields.newPassword ?? ''] ?? 'Dieses Passwort ist nicht sicher genug. Wähle ein längeres oder anderes.');
      else setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        <View style={{ gap: space.m }}>
          <Field label="Aktuelles Passwort" value={current} onChangeText={(v) => { setCurrent(v); setError(null); }} secureTextEntry autoComplete="current-password" textContentType="password" />
          <Field label="Neues Passwort" value={next} onChangeText={(v) => { setNext(v); setError(null); }} secureTextEntry autoComplete="new-password" textContentType="newPassword" help={`Mindestens ${min} Zeichen. Am sichersten: ein kurzer Satz.`} />
          <Field label="Neues Passwort wiederholen" value={repeat} onChangeText={(v) => { setRepeat(v); setError(null); }} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
        </View>
        {error ? <Txt color={p.danger}>{error}</Txt> : null}
        <Button label="Passwort ändern" onPress={() => void save()} loading={busy} disabled={!current || !next || !repeat} />
        <Txt variant="small" muted>Danach bist du auf allen anderen Geräten abgemeldet – hier bleibst du angemeldet.</Txt>
      </Screen>
    </KeyboardAvoidingView>
  );
}
