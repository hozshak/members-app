// Profile overview: photo (tap to change or remove — chosen from the phone, cropped square, sent as a 512 px JPEG) in a frame that gets
// finer with the days practised (lib/frame.ts; the exclamation mark explains it); name, e-mail and member number; the settings in the app;
// the icon of the app; the introduction again; legal pages of the community in the browser; log out; switch the community.
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FrameInitial, FrameRing, FramesPopup } from '@/components/frame-ring';
import { TourTarget } from '@/components/tour';
import { Button, MenuGroup, MenuRow, Screen, Txt } from '@/components/ui';
import { errorText } from '@/lib/api';
import { frameOf } from '@/lib/frame';
import { overallStats } from '@/lib/plans';
import { useRoutines } from '@/lib/routine';
import { useSession } from '@/lib/session';
import { space, usePalette } from '@/lib/theme';
import { replayTours, useTourOnFocus } from '@/lib/tour';

export default function ProfileScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { me, community, api, logout, forgetCommunity, refreshMe } = useSession();
  const [busy, setBusy] = useState(false);
  const [framesOpen, setFramesOpen] = useState(false);
  const routines = useRoutines();
  useTourOnFocus('profil', !routines.isPending);
  if (!community || !api) return null;
  const hasRoutines = (routines.data?.length ?? 0) > 0;
  const stats = overallStats(routines.data);
  const frame = frameOf(stats);
  const name = me?.displayName || [me?.firstName, me?.lastName].filter(Boolean).join(' ') || me?.email || '';
  const initial = (name.trim()[0] ?? '?').toLocaleUpperCase('de-DE');

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
    <Screen tour="profil" contentStyle={{ paddingTop: insets.top + space.l, gap: space.xl }}>
      <TourTarget id="profil.frame" style={{ gap: space.m, alignItems: 'center' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Profilfoto ändern" onPress={photoMenu}>
          <FrameRing frame={frame} size={176}>
            {me?.avatarUrl ? (
              <Image source={{ uri: api.url(me.avatarUrl), headers: api.mediaHeaders() }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <FrameInitial letter={initial} size={44} />
            )}
            {busy ? <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }]}><ActivityIndicator color="#FFFFFF" /></View> : null}
          </FrameRing>
          <Txt variant="small" color={p.accent} style={{ textAlign: 'center', marginTop: -space.m }}>Foto ändern</Txt>
        </Pressable>
        <View style={{ gap: 2, alignItems: 'center' }}>
          <Txt variant="display" style={{ textAlign: 'center' }}>{name}</Txt>
          {me?.email && me.email !== name ? <Txt muted>{me.email}</Txt> : null}
          <Txt variant="small" muted style={{ textAlign: 'center' }}>Mitglied bei {community.name}{me?.memberNo ? ` · Nr. ${me.memberNo}` : ''}</Txt>
          {hasRoutines ? (
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Erklärt den Rahmen und zeigt alle Stufen"
              onPress={() => setFramesOpen(true)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, minHeight: 36, marginTop: space.xs, opacity: pressed ? 0.6 : 1 })}
            >
              <Txt variant="small" style={{ fontWeight: '700', flexShrink: 1 }}>
                {frame.name}
                {` · ${stats.totalDays === 1 ? '1 Übungstag' : `${stats.totalDays} Übungstage`}`}
                {frame.next ? `, noch ${frame.next.days} bis ${frame.next.name}` : ''}
              </Txt>
              <Ionicons name="alert-circle" size={22} color={p.accent} />
            </Pressable>
          ) : null}
        </View>
      </TourTarget>

      <MenuGroup>
        <MenuRow icon="person-outline" label="Persönliche Daten" onPress={() => router.push('/profil/daten' as Href)} />
        <MenuRow icon="key-outline" label="Passwort ändern" onPress={() => router.push('/profil/passwort' as Href)} />
        <TourTarget id="profil.reminders"><MenuRow icon="alarm-outline" label="Erinnerungen" onPress={() => router.push('/profil/erinnerungen' as Href)} /></TourTarget>
        <MenuRow icon="notifications-outline" label="Benachrichtigungen" onPress={() => router.push('/profil/benachrichtigungen' as Href)} />
        <MenuRow icon="phone-portrait-outline" label="Geräte" onPress={() => router.push('/profil/geraete' as Href)} />
        <MenuRow icon="bag-handle-outline" label="Meine Käufe" onPress={() => router.push('/profil/kaeufe' as Href)} />
        <TourTarget id="profil.icon"><MenuRow icon="color-palette-outline" label="App-Icon" onPress={() => router.push('/profil/app-icon' as Href)} /></TourTarget>
        <TourTarget id="profil.intro"><MenuRow icon="compass-outline" label="Einführung ansehen" onPress={replayTours} /></TourTarget>
      </MenuGroup>

      <MenuGroup>
        <MenuRow icon="shield-checkmark-outline" label="Datenschutz" external onPress={() => void WebBrowser.openBrowserAsync(`${community.url}/rechtliches/datenschutz`)} />
        <MenuRow icon="document-text-outline" label="Impressum" external onPress={() => void WebBrowser.openBrowserAsync(`${community.url}/rechtliches/impressum`)} />
      </MenuGroup>

      <View style={{ gap: space.m }}>
        <Button label="Abmelden" kind="secondary" onPress={() => void logout()} />
        <Button label="Anderen Memberbereich wählen" kind="ghost" onPress={() => void forgetCommunity()} />
      </View>

      {framesOpen ? <FramesPopup days={stats.totalDays} initial={initial} onClose={() => setFramesOpen(false)} /> : null}
    </Screen>
  );
}
