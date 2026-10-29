// Personal data: first and last name, the name shown at comments, and the address (for invoices) — saved with
// PATCH /api/profile like on the website. The e-mail address is changed on the website (it needs a confirmation mail).
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Button, ErrorView, Field, Loading, Screen, Txt } from '@/components/ui';
import { ApiError, errorText } from '@/lib/api';
import { useProfile } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { space, usePalette } from '@/lib/theme';
import type { Address, Profile } from '@/lib/types';

type Form = { firstName: string; lastName: string; displayName: string } & Pick<Address, 'company' | 'street' | 'zip' | 'city' | 'country'>;

function formOf(pr: Profile): Form {
  return {
    firstName: pr.firstName, lastName: pr.lastName, displayName: pr.displayName,
    company: pr.address.company, street: pr.address.street, zip: pr.address.zip, city: pr.address.city, country: pr.address.country,
  };
}

export default function PersonalDataScreen() {
  const q = useProfile();
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  return <PersonalDataForm profile={q.data} />;
}

function PersonalDataForm({ profile }: { profile: Profile }) {
  const p = usePalette();
  const qc = useQueryClient();
  const { api, refreshMe } = useSession();
  const [form, setForm] = useState<Form>(() => formOf(profile));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof Form) => (v: string) => { setForm((f) => ({ ...f, [k]: v })); setError(null); };

  const save = async () => {
    if (!api) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch('/api/profile', {
        firstName: form.firstName.trim(), lastName: form.lastName.trim(), displayName: form.displayName.trim(),
        address: { company: form.company.trim(), street: form.street.trim(), zip: form.zip.trim(), city: form.city.trim(), country: form.country.trim() },
      });
      await Promise.all([qc.invalidateQueries({ queryKey: ['profile'] }), refreshMe()]);
      Alert.alert('Gespeichert', 'Deine Daten sind aktualisiert.');
      router.back();
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'validation_failed' ? 'Bitte prüfe deine Eingaben.' : errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        <View style={{ gap: space.m }}>
          <Field label="Vorname" value={form.firstName} onChangeText={set('firstName')} autoComplete="given-name" textContentType="givenName" />
          <Field label="Nachname" value={form.lastName} onChangeText={set('lastName')} autoComplete="family-name" textContentType="familyName" />
          <Field label="Anzeigename" value={form.displayName} onChangeText={set('displayName')} help="So erscheinst du bei Kommentaren." />
        </View>
        <View style={{ gap: space.m }}>
          <Txt variant="heading">Anschrift</Txt>
          <Field label="Firma (optional)" value={form.company} onChangeText={set('company')} autoComplete="organization" />
          <Field label="Straße und Hausnummer" value={form.street} onChangeText={set('street')} autoComplete="street-address" textContentType="streetAddressLine1" />
          <View style={{ flexDirection: 'row', gap: space.m }}>
            <View style={{ width: 110 }}><Field label="PLZ" value={form.zip} onChangeText={set('zip')} autoComplete="postal-code" keyboardType="number-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Ort" value={form.city} onChangeText={set('city')} textContentType="addressCity" /></View>
          </View>
          <Field label="Land" value={form.country} onChangeText={set('country')} textContentType="countryName" />
        </View>
        <Txt variant="small" muted>Deine E-Mail-Adresse ({profile.email}) änderst du auf der Website – dafür kommt eine Bestätigung per E-Mail.</Txt>
        {error ? <Txt color={p.danger}>{error}</Txt> : null}
        <Button label="Speichern" onPress={() => void save()} loading={busy} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
