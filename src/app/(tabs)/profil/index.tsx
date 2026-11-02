// Profile overview: photo (tap to change or remove — chosen from the phone, cropped square, sent as a 512 px JPEG),
// name, e-mail and member number; the settings in the app; legal pages of the community in the browser; log out;
// switch the community.
import { router, type Href } from 'expo-router';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, MenuGroup, MenuRow, Screen, Txt } from '@/components/ui';
import { errorText } from '@/lib/api';
import { useSession } from '@/lib/session';
import { space, usePalette } from '@/lib/theme';

export default function ProfileScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { me, community, api, logout, forgetCommunity, refreshMe } = useSession();
  const [busy, setBusy] = useState(false);
  if (!community || !api) return null;
  const name = me?.displayName || [me?.firstName, me?.lastName].filter(Boolean).join(' ') || me?.email || '';

  const pickPhoto = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (picked.canceled || !picked.assets[0]) return;
    setBusy(true);
    try {
      const rendered = await ImageManipulator.manipulate(picked.assets[0].uri).resize({ width: 512 }).renderAsync();
      const saved = await rendered.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
      await api.putFile('/api/profile/avatar', saved.uri, 'image/jpeg');
      await refreshMe();
    } catch (err) {
      Alert.alert('Foto nicht gespeichert', errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = async () => {
    setBusy(true);
    try {
      await api.del('/api/profile/avatar');
      await refreshMe();
    } catch (err) {
      Alert.alert('Foto nicht entfernt', errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const photoMenu = () => Alert.alert('Profilfoto', undefined, [
    { text: 'Foto auswählen', onPress: () => void pickPhoto() },
    ...(me?.avatarUrl ? [{ text: 'Foto entfernen', style: 'destructive' as const, onPress: () => void removePhoto() }] : []),
    { text: 'Abbrechen', style: 'cancel' as const },
  ]);

  return (
    <Screen contentStyle={{ paddingTop: insets.top + space.l, gap: space.xl }}>
      <View style={{ gap: space.m, alignItems: 'flex-start' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Profilfoto ändern" onPress={photoMenu}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {me?.avatarUrl ? (
              <Image source={{ uri: api.url(me.avatarUrl), headers: api.mediaHeaders() }} style={{ width: 80, height: 80 }} contentFit="cover" />
            ) : (
              <Txt variant="display" color={p.accent}>{(name.trim()[0] ?? '?').toLocaleUpperCase('de-DE')}</Txt>
            )}
            {busy ? <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }]}><ActivityIndicator color="#FFFFFF" /></View> : null}
          </View>
          <Txt variant="small" color={p.accent} style={{ marginTop: space.xs, textAlign: 'center' }}>Foto ändern</Txt>
        </Pressable>
        <View style={{ gap: 2 }}>
          <Txt variant="display">{name}</Txt>
          {me?.email && me.email !== name ? <Txt muted>{me.email}</Txt> : null}
          <Txt variant="small" muted>Mitglied bei {community.name}{me?.memberNo ? ` · Nr. ${me.memberNo}` : ''}</Txt>
        </View>
      </View>

      <MenuGroup>
        <MenuRow icon="person-outline" label="Persönliche Daten" onPress={() => router.push('/profil/daten' as Href)} />
        <MenuRow icon="key-outline" label="Passwort ändern" onPress={() => router.push('/profil/passwort' as Href)} />
        <MenuRow icon="notifications-outline" label="Benachrichtigungen" onPress={() => router.push('/profil/benachrichtigungen' as Href)} />
        <MenuRow icon="phone-portrait-outline" label="Geräte" onPress={() => router.push('/profil/geraete' as Href)} />
        <MenuRow icon="bag-handle-outline" label="Meine Käufe" onPress={() => router.push('/profil/kaeufe' as Href)} />
      </MenuGroup>

      <MenuGroup>
        <MenuRow icon="shield-checkmark-outline" label="Datenschutz" external onPress={() => void WebBrowser.openBrowserAsync(`${community.url}/rechtliches/datenschutz`)} />
        <MenuRow icon="document-text-outline" label="Impressum" external onPress={() => void WebBrowser.openBrowserAsync(`${community.url}/rechtliches/impressum`)} />
      </MenuGroup>

      <View style={{ gap: space.m }}>
        <Button label="Abmelden" kind="secondary" onPress={() => void logout()} />
        <Button label="Anderen Memberbereich wählen" kind="ghost" onPress={() => void forgetCommunity()} />
      </View>
    </Screen>
  );
}
