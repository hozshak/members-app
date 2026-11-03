// Progress photo: the front camera with an oval for the face and — once there is an earlier photo — that photo faintly
// on top, so every picture has the same distance and angle. The picture is kept only on this phone. With `plan` and `slot` it is the
// photo at the start or the end of a plan (lib/plans.ts), which can also wait: "Jetzt nicht".
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, Mask, Rect } from 'react-native-svg';
import { Button, Screen, Txt } from '@/components/ui';
import { usePhotosVisible } from '@/lib/photo-lock';
import { setPlanPhoto } from '@/lib/plans';
import { listPhotos, savePhoto, useRoutinePrefs } from '@/lib/routine';
import { space, usePalette } from '@/lib/theme';

export default function CameraScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<ComponentRef<typeof CameraView>>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ghost, setGhost] = useState(true);
  const [prefs] = useRoutinePrefs();
  // the earlier photo as a template only when the photos are not locked away
  const photosVisible = usePhotosVisible(prefs.photoLock);
  const [last] = useState(() => listPhotos().at(-1) ?? null);
  const { plan, slot } = useLocalSearchParams<{ plan?: string; slot?: 'start' | 'end' }>();

  if (!permission) return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  if (!permission.granted) {
    return (
      <Screen contentStyle={{ paddingTop: insets.top + space.xxl * 2, gap: space.l }}>
        <Txt variant="title">Kamera erlauben</Txt>
        <Txt muted>Für Fortschrittsfotos braucht die App deine Frontkamera. Die Fotos bleiben nur auf deinem Handy.</Txt>
        <Button label="Kamera erlauben" onPress={() => void requestPermission()} />
        <Button label={plan ? 'Jetzt nicht' : 'Zurück'} kind="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  const take = async () => {
    if (!camera.current || !ready || busy) return;
    setBusy(true);
    try {
      const pic = await camera.current.takePictureAsync({ quality: 0.85 });
      const saved = savePhoto(pic.uri);
      if (plan && slot) setPlanPhoto(plan, slot, saved.name);
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="front" mirror onCameraReady={() => setReady(true)} />
      {last && ghost && photosVisible ? <Image source={{ uri: last.uri }} style={[StyleSheet.absoluteFill, { opacity: 0.3 }]} contentFit="cover" pointerEvents="none" /> : null}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Mask id="hole">
            <Rect width="100%" height="100%" fill="white" />
            <Ellipse cx="50%" cy="44%" rx="34%" ry="26%" fill="black" />
          </Mask>
        </Defs>
        <Rect width="100%" height="100%" fill="rgba(0,0,0,0.45)" mask="url(#hole)" />
        <Ellipse cx="50%" cy="44%" rx="34%" ry="26%" stroke="#FFFFFF" strokeWidth={2} strokeDasharray="8 8" fill="none" />
      </Svg>

      <View style={{ position: 'absolute', top: insets.top + space.m, left: space.l, right: space.l, flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Schließen" hitSlop={12} onPress={() => router.back()}>
          <Ionicons name="close" size={30} color="#FFFFFF" />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          {slot ? <Txt variant="heading" color="#FFFFFF">{slot === 'start' ? 'Dein Vorher-Foto' : 'Dein Nachher-Foto'}</Txt> : null}
          <Txt color="#FFFFFF">Gesicht ins Oval, gerade in die Kamera, gleiches Licht wie beim letzten Mal.</Txt>
        </View>
      </View>

      <View style={{ position: 'absolute', bottom: insets.bottom + space.xl, left: 0, right: 0, alignItems: 'center', gap: space.m }}>
        {last && photosVisible ? (
          <Pressable accessibilityRole="switch" accessibilityState={{ checked: ghost }} onPress={() => setGhost((g) => !g)} style={{ paddingHorizontal: space.m, paddingVertical: space.xs, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <Txt variant="small" color="#FFFFFF">{ghost ? 'Letztes Foto ausblenden' : 'Letztes Foto einblenden'}</Txt>
          </Pressable>
        ) : null}
        {plan ? (
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8} style={{ paddingHorizontal: space.m, paddingVertical: space.xs, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <Txt variant="small" color="#FFFFFF">Jetzt nicht</Txt>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Foto aufnehmen"
          onPress={() => void take()}
          style={({ pressed }) => ({ width: 78, height: 78, borderRadius: 39, borderWidth: 5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', opacity: ready ? 1 : 0.5, transform: [{ scale: pressed ? 0.94 : 1 }] })}
        >
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: p.accent }} />}
        </Pressable>
      </View>
    </View>
  );
}
