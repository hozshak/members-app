// Progress photo: the front camera with an oval for the face and — once there is an earlier photo of the same angle — that photo faintly
// on top, so every picture has the same distance and angle. The picture is kept only on this phone. With `plan` and `slot` it is the
// photo at the start or the end of a plan (lib/plans.ts), which can also wait: "Jetzt nicht".
// Opened from the Routine tab (/routine/kamera) and from a page of the introduction (/foto, above it).
// 10.11.2026 (owner: "vorher und nachher: front und rechts und links"): one set of three, one after the other — from the front, the right side, the left
// side. The sides can be skipped; the set shares its time (lib/routine.ts), and a plan keeps the first photo of it.
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, Mask, Rect } from 'react-native-svg';
import { Button, Screen, Txt } from '@/components/ui';
import { usePhotosVisible } from '@/lib/photo-lock';
import { setPlanPhoto } from '@/lib/plans';
import { listPhotos, PHOTO_ANGLES, savePhoto, useRoutinePrefs, type PhotoAngle } from '@/lib/routine';
import { space, usePalette } from '@/lib/theme';

/** What the member does for each angle (the picture is mirrored like a mirror: "rechte Seite" is the member's own right cheek). */
const HOW: Record<PhotoAngle, { title: string; text: string }> = {
  front: { title: 'Von vorne', text: 'Gesicht ins Oval, gerade in die Kamera, gleiches Licht wie beim letzten Mal.' },
  right: { title: 'Rechte Seite', text: 'Dreh den Kopf nach links, bis deine rechte Gesichtshälfte zur Kamera zeigt. Kinn gerade lassen.' },
  left: { title: 'Linke Seite', text: 'Dreh den Kopf nach rechts, bis deine linke Gesichtshälfte zur Kamera zeigt. Kinn gerade lassen.' },
};

const pill = { paddingHorizontal: space.m, paddingVertical: space.xs, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.5)' } as const;

export default function CameraScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<ComponentRef<typeof CameraView>>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ghost, setGhost] = useState(true);
  const [step, setStep] = useState(0);
  // the time of the set: given by its first photo
  const setAt = useRef<Date | null>(null);
  const [prefs] = useRoutinePrefs();
  // the earlier photo as a template only when the photos are not locked away
  const photosVisible = usePhotosVisible(prefs.photoLock);
  const [all] = useState(() => listPhotos('all'));
  const { plan, slot } = useLocalSearchParams<{ plan?: string; slot?: 'start' | 'end' }>();
  const angle = PHOTO_ANGLES[step] ?? 'front';
  const last = useMemo(() => all.filter((x) => x.angle === angle).at(-1) ?? null, [all, angle]);
  const lastStep = step >= PHOTO_ANGLES.length - 1;

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

  const next = () => {
    if (lastStep) router.back();
    else setStep((s) => s + 1);
  };

  const take = async () => {
    if (!camera.current || !ready || busy) return;
    setBusy(true);
    try {
      const pic = await camera.current.takePictureAsync({ quality: 0.85 });
      setAt.current ??= new Date();
      const saved = savePhoto(pic.uri, setAt.current, angle);
      // the plan keeps the first photo of the set; the others are found by its time
      if (plan && slot && step === 0) setPlanPhoto(plan, slot, saved.name);
      next();
    } finally {
      setBusy(false);
    }
  };

  const how = HOW[angle];
  const heading = slot ? `${slot === 'start' ? 'Vorher' : 'Nachher'}: ${how.title}` : how.title;

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

      <View style={{ position: 'absolute', top: insets.top + space.m, left: space.l, right: space.l, flexDirection: 'row', alignItems: 'flex-start', gap: space.m }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Schließen" hitSlop={12} onPress={() => router.back()}>
          <Ionicons name="close" size={30} color="#FFFFFF" />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="caption" color="#FFFFFFCC">Foto {step + 1} von {PHOTO_ANGLES.length}</Txt>
          <Txt variant="heading" color="#FFFFFF">{heading}</Txt>
          <Txt color="#FFFFFF">{how.text}</Txt>
        </View>
      </View>

      <View style={{ position: 'absolute', bottom: insets.bottom + space.xl, left: 0, right: 0, alignItems: 'center', gap: space.m }}>
        {last && photosVisible ? (
          <Pressable accessibilityRole="switch" accessibilityState={{ checked: ghost }} onPress={() => setGhost((g) => !g)} style={pill}>
            <Txt variant="small" color="#FFFFFF">{ghost ? 'Letztes Foto ausblenden' : 'Letztes Foto einblenden'}</Txt>
          </Pressable>
        ) : null}
        {step > 0 ? (
          <View style={{ flexDirection: 'row', gap: space.s }}>
            <Pressable accessibilityRole="button" onPress={next} hitSlop={8} style={pill}>
              <Txt variant="small" color="#FFFFFF">{lastStep ? 'Ohne linke Seite fertig' : 'Seite überspringen'}</Txt>
            </Pressable>
            {lastStep ? null : (
              <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8} style={pill}>
                <Txt variant="small" color="#FFFFFF">Fertig</Txt>
              </Pressable>
            )}
          </View>
        ) : plan ? (
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8} style={pill}>
            <Txt variant="small" color="#FFFFFF">Jetzt nicht</Txt>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Foto aufnehmen: ${how.title}`}
          onPress={() => void take()}
          style={({ pressed }) => ({ width: 78, height: 78, borderRadius: 39, borderWidth: 5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', opacity: ready ? 1 : 0.5, transform: [{ scale: pressed ? 0.94 : 1 }] })}
        >
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: p.accent }} />}
        </Pressable>
      </View>
    </View>
  );
}
