// All progress photos of this phone: the comparison (first against latest — or any two chosen) side by side with their
// dates, then every photo; a long press deletes one.
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Card, Screen, Txt } from '@/components/ui';
import { deletePhoto, listPhotos, type ProgressPhoto } from '@/lib/routine';
import { radius, space, usePalette } from '@/lib/theme';

const date = (d: Date) => d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });

export default function PhotosScreen() {
  const p = usePalette();
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [pick, setPick] = useState<{ a: string | null; b: string | null }>({ a: null, b: null });
  useFocusEffect(useCallback(() => { setPhotos(listPhotos()); }, []));

  const a = photos.find((ph) => ph.name === pick.a) ?? photos[0];
  const b = photos.find((ph) => ph.name === pick.b) ?? photos[photos.length - 1];

  const choose = (ph: ProgressPhoto) => Alert.alert(date(ph.takenAt), undefined, [
    { text: 'Als „Vorher“ vergleichen', onPress: () => setPick((s) => ({ ...s, a: ph.name })) },
    { text: 'Als „Nachher“ vergleichen', onPress: () => setPick((s) => ({ ...s, b: ph.name })) },
    { text: 'Löschen', style: 'destructive', onPress: () => { deletePhoto(ph); setPhotos(listPhotos()); } },
    { text: 'Abbrechen', style: 'cancel' },
  ]);

  if (photos.length === 0) {
    return <Screen><Txt muted>Noch keine Fotos. Mach dein erstes Foto im Tab „Routine“.</Txt></Screen>;
  }

  return (
    <Screen>
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

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {[...photos].reverse().map((ph) => (
          <Pressable key={ph.name} accessibilityRole="button" accessibilityLabel={`Foto vom ${date(ph.takenAt)}`} onPress={() => choose(ph)} onLongPress={() => choose(ph)} style={{ width: '31.5%' }}>
            <Image source={{ uri: ph.uri }} style={{ aspectRatio: 3 / 4, borderRadius: radius.s }} contentFit="cover" />
            <Txt variant="small" muted style={{ marginTop: 2 }}>{ph.takenAt.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</Txt>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
