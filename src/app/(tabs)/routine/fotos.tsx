// All progress photos of this phone: the comparison (first against latest — or any two chosen) side by side with their
// dates, a time-lapse that plays all photos one after the other, then every photo (tap: compare or delete). With
// "Fotos schützen" the screen opens only after Face ID / the phone's code.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, MenuGroup, Screen, ToggleRow, Txt } from '@/components/ui';
import { unlockPhotos, usePhotosVisible } from '@/lib/photo-lock';
import { deletePhoto, listPhotos, useRoutinePrefs, type ProgressPhoto } from '@/lib/routine';
import { radius, space, usePalette } from '@/lib/theme';

const date = (d: Date) => d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
const FRAME_MS = 700;

/** Full-screen time-lapse: every photo for a moment, with its date; tap to close. */
function TimeLapse({ photos, onClose }: { photos: ProgressPhoto[]; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % (photos.length + 2)), FRAME_MS);
    return () => clearInterval(t);
  }, [photos.length]);
  // the last photo stays a little longer before it starts again
  const ph = photos[Math.min(i, photos.length - 1)];
  if (!ph) return null;
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityRole="button" accessibilityLabel="Zeitraffer schließen" onPress={onClose} style={{ flex: 1, backgroundColor: '#000' }}>
        <Image source={{ uri: ph.uri }} style={StyleSheet.absoluteFill} contentFit="contain" transition={250} />
        <View style={{ position: 'absolute', left: space.l, right: space.l, bottom: insets.bottom + space.xl, alignItems: 'center', gap: space.xs }}>
          <Txt variant="title" color="#FFFFFF">{date(ph.takenAt)}</Txt>
          <Txt variant="small" color="#FFFFFFAA">{Math.min(i, photos.length - 1) + 1} / {photos.length} · Tippen zum Schließen</Txt>
        </View>
      </Pressable>
    </Modal>
  );
}

export default function PhotosScreen() {
  const p = usePalette();
  const [prefs, update] = useRoutinePrefs();
  const visible = usePhotosVisible(prefs.photoLock);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [pick, setPick] = useState<{ a: string | null; b: string | null }>({ a: null, b: null });
  const [playing, setPlaying] = useState(false);
  useFocusEffect(useCallback(() => { setPhotos(listPhotos()); }, []));

  const a = photos.find((ph) => ph.name === pick.a) ?? photos[0];
  const b = photos.find((ph) => ph.name === pick.b) ?? photos[photos.length - 1];

  const choose = (ph: ProgressPhoto) => Alert.alert(date(ph.takenAt), undefined, [
    { text: 'Als „Vorher“ vergleichen', onPress: () => setPick((s) => ({ ...s, a: ph.name })) },
    { text: 'Als „Nachher“ vergleichen', onPress: () => setPick((s) => ({ ...s, b: ph.name })) },
    { text: 'Löschen', style: 'destructive', onPress: () => { deletePhoto(ph); setPhotos(listPhotos()); } },
    { text: 'Abbrechen', style: 'cancel' },
  ]);

  const toggleLock = async (on: boolean) => {
    // switching the lock off needs the owner too
    if (!on && !(await unlockPhotos())) return;
    update({ photoLock: on });
  };

  if (!visible) {
    return (
      <Screen contentStyle={{ alignItems: 'center', paddingTop: space.xxl * 2, gap: space.l }}>
        <Ionicons name="lock-closed" size={44} color={p.accent} />
        <Txt variant="title" style={{ textAlign: 'center' }}>Deine Fotos sind geschützt</Txt>
        <Button label="Entsperren" onPress={() => void unlockPhotos()} />
      </Screen>
    );
  }

  if (photos.length === 0) {
    return <Screen><Txt muted>Noch keine Fotos. Mach dein erstes Foto im Tab „Routine“.</Txt></Screen>;
  }

  return (
    <Screen>
      {playing ? <TimeLapse photos={photos} onClose={() => setPlaying(false)} /> : null}
      {a && b && a !== b ? (
        <Card style={{ padding: space.m, gap: space.s }}>
          <View style={{ flexDirection: 'row', gap: space.s }}>
            {[{ ph: a, label: 'Vorher' }, { ph: b, label: 'Nachher' }].map(({ ph, label }) => (
              <View key={label} style={{ flex: 1, gap: space.xs }}>
                <Image source={{ uri: ph.uri }} style={{ aspectRatio: 3 / 4, borderRadius: radius.m }} contentFit="cover" accessibilityLabel={`${label}, ${date(ph.takenAt)}`} />
                <Txt variant="caption" color={p.accent}>{label}</Txt>
                <Txt variant="small" muted>{date(ph.takenAt)}</Txt>
              </View>
            ))}
          </View>
          <Txt variant="small" muted>Tippe unten auf ein Foto, um ein anderes zu vergleichen.</Txt>
        </Card>
      ) : null}

      {photos.length >= 2 ? <Button label="Zeitraffer abspielen" kind="secondary" onPress={() => setPlaying(true)} /> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {[...photos].reverse().map((ph) => (
          <Pressable key={ph.name} accessibilityRole="button" accessibilityLabel={`Foto vom ${date(ph.takenAt)}`} onPress={() => choose(ph)} onLongPress={() => choose(ph)} style={{ width: '31.5%' }}>
            <Image source={{ uri: ph.uri }} style={{ aspectRatio: 3 / 4, borderRadius: radius.s }} contentFit="cover" />
            <Txt variant="small" muted style={{ marginTop: 2 }}>{ph.takenAt.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</Txt>
          </Pressable>
        ))}
      </View>

      <MenuGroup>
        <ToggleRow label="Fotos schützen" help="Fotos erst nach Face ID oder deinem Handy-Code zeigen." value={prefs.photoLock} onValueChange={(on) => void toggleLock(on)} />
      </MenuGroup>
    </Screen>
  );
}
