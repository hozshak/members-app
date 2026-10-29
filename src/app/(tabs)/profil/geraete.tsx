// Devices: every place the member is logged in (this phone first), with "Abmelden" per device and "Alle anderen
// abmelden". Ending another device needs the password once more (the software asks for it — "sudo" for 10 minutes).
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Card, ErrorView, Field, Loading, Screen, Txt } from '@/components/ui';
import { ApiError, errorText } from '@/lib/api';
import { useSessions } from '@/lib/queries';
import { useApi } from '@/lib/session';
import { space, usePalette } from '@/lib/theme';
import type { SessionInfo } from '@/lib/types';

function when(sec: number): string {
  return new Date(sec * 1000).toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function DevicesScreen() {
  const p = usePalette();
  const api = useApi();
  const qc = useQueryClient();
  const q = useSessions();
  // an action that needs the password once more waits here until it is confirmed
  const [pending, setPending] = useState<{ label: string; run: () => Promise<unknown> } | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ['sessions'] });

  const attempt = async (label: string, run: () => Promise<unknown>) => {
    try {
      await run();
      await refresh();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'sudo_required') {
        setPending({ label, run });
        setPassword('');
        setError(null);
      } else {
        Alert.alert('Das hat nicht geklappt', errorText(err));
      }
    }
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/auth/sudo', { password });
      await pending.run();
      setPending(null);
      await refresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  const sessions = [...q.data].sort((a, b) => Number(b.current) - Number(a.current) || b.lastSeenAt - a.lastSeenAt);
  const others = sessions.filter((s) => !s.current);

  const end = (s: SessionInfo) => void attempt('Gerät abmelden', () => api.del(`/api/profile/sessions/${encodeURIComponent(s.id)}`));

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Txt muted>Hier bist du angemeldet. Erkennst du ein Gerät nicht, melde es ab und ändere dein Passwort.</Txt>

      {pending ? (
        <Card style={{ padding: space.l, gap: space.m }}>
          <Txt variant="heading">Bitte bestätige mit deinem Passwort</Txt>
          <Field label="Passwort" value={password} onChangeText={(v) => { setPassword(v); setError(null); }} secureTextEntry autoComplete="current-password" textContentType="password" error={error} />
          <View style={{ flexDirection: 'row', gap: space.m }}>
            <Button label="Abbrechen" kind="secondary" onPress={() => setPending(null)} style={{ flex: 1 }} />
            <Button label={pending.label} onPress={() => void confirm()} loading={busy} disabled={!password} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : null}

      <View style={{ gap: space.s }}>
        {sessions.map((s) => (
          <Card key={s.id} style={{ padding: space.l, gap: space.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
              <Txt variant="heading" style={{ flex: 1 }}>{s.uaLabel || 'Unbekanntes Gerät'}</Txt>
              {s.current ? <Txt variant="caption" color={p.accent}>Dieses Gerät</Txt> : null}
            </View>
            <Txt variant="small" muted>Zuletzt aktiv {when(s.lastSeenAt)} · angemeldet seit {when(s.createdAt)}</Txt>
            {!s.current ? <Button label="Abmelden" kind="ghost" onPress={() => end(s)} style={{ alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 0 }} /> : null}
          </Card>
        ))}
      </View>

      {others.length > 0 ? (
        <Button label="Alle anderen Geräte abmelden" kind="secondary" onPress={() => void attempt('Alle abmelden', () => api.post('/api/profile/sessions/logout-others'))} />
      ) : null}
    </Screen>
  );
}
