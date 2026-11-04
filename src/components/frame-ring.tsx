// The frame around the profile photo (lib/frame.ts): its picture lies over the photo. And the popup that explains it: all the frames, how many
// practice days each one takes, how far the member is.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FRAMES, type FrameLevel } from '@/lib/frame';
import { radius, space, usePalette } from '@/lib/theme';
import { Button, Txt } from './ui';

/** The photo's diameter as a share of the frame's picture (all pictures in assets/images/frames are made for this). */
const PHOTO_SHARE = 0.595;
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });

/** `size`: the whole picture with everything around the photo; the photo (`children`) takes the round opening in its middle. */
export function FrameRing({ frame, size, children }: { frame: FrameLevel; size: number; children: ReactNode }) {
  const p = usePalette();
  const photo = size * PHOTO_SHARE;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: photo, height: photo, borderRadius: photo / 2, overflow: 'hidden', backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </View>
      <Image source={frame.image} style={StyleSheet.absoluteFill} contentFit="contain" pointerEvents="none" accessibilityIgnoresInvertColors />
    </View>
  );
}

/** The first letter of the name in place of a photo. */
export function FrameInitial({ letter, size }: { letter: string; size: number }) {
  const p = usePalette();
  return <Text style={{ fontFamily: SERIF, fontSize: size, color: p.accent }}>{letter}</Text>;
}

/** "Was bedeutet der Rahmen?": every frame with its practice days. */
export function FramesPopup({ days, initial, onClose }: { days: number; initial: string; onClose: () => void }) {
  const p = usePalette();
  const current = FRAMES.reduce((now, f) => (days >= f.days ? f.level : now), 0);
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'center', padding: space.m }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Schließen" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
        <View accessibilityViewIsModal style={{ maxHeight: '94%', gap: space.m, padding: space.l, borderRadius: radius.xl, backgroundColor: p.surface }}>
          <View style={{ gap: space.xs }}>
            <Txt variant="title">Dein Rahmen</Txt>
            <Txt variant="small" muted>Jeder Tag, an dem du deine Routine erledigst, ist ein Übungstag. Je mehr Übungstage, desto schöner dein Rahmen. Du hast {days === 1 ? '1 Übungstag' : `${days} Übungstage`}.</Txt>
          </View>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: space.s }}>
            {FRAMES.map((f) => {
              const reached = days >= f.days;
              const here = f.level === current;
              return (
                <View key={f.name} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.xs, paddingLeft: space.xs, paddingRight: space.m, borderRadius: radius.l, borderWidth: 1, borderColor: here ? p.accent : p.line, backgroundColor: here ? p.accentSoft : 'transparent' }}>
                  <FrameRing frame={f} size={88}>
                    <FrameInitial letter={initial} size={24} />
                  </FrameRing>
                  <View style={{ width: 1, alignSelf: 'stretch', marginVertical: space.m, backgroundColor: p.line }} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Txt variant="heading">{f.name}</Txt>
                    <Txt variant="small">{f.line}</Txt>
                    <Txt variant="small" muted>{f.days === 0 ? 'Damit fängst du an' : `Ab ${f.days} Übungstagen`}</Txt>
                    {here ? <Txt variant="small" color={p.accent} style={{ fontWeight: '700' }}>Du bist hier</Txt> : null}
                  </View>
                  {reached && !here ? <Ionicons name="checkmark-circle" size={22} color={p.accent} accessibilityLabel="erreicht" /> : null}
                </View>
              );
            })}
          </ScrollView>
          <Button label="Alles klar" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
