// The frame around the profile photo (lib/frame.ts): a ring of metal, with small stars on the highest levels. And the popup that explains it:
// all the frames, how many practice days each one takes, how far the member is.
import { Ionicons } from '@expo/vector-icons';
import { useId, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { FRAMES, type FrameLevel } from '@/lib/frame';
import { radius, space, usePalette } from '@/lib/theme';
import { Button, Txt } from './ui';

/** Where the stars sit on the ring, as an angle in degrees (0 = right, counted clockwise). */
const SPARKLE_ANGLES = [-45, 150, 80];

export function FrameRing({ frame, size, children }: { frame: FrameLevel; size: number; children: ReactNode }) {
  const p = usePalette();
  const id = `ring${useId().replace(/\W/g, '')}`;
  const stroke = Math.max(2, (frame.width * size) / 92);
  const c = size / 2;
  const r = c - stroke / 2 - 1;
  const inner = size - 2 * (stroke + 3);
  const stars = SPARKLE_ANGLES.slice(0, frame.sparkles).map((deg, i) => {
    const a = (deg * Math.PI) / 180;
    const x = c + r * Math.cos(a);
    const y = c + r * Math.sin(a);
    const s = (size / 92) * (i === 0 ? 9 : 7);
    return `M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`;
  });
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {frame.colors ? (
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              {frame.colors.map((color, i) => <Stop key={color} offset={i / (frame.colors!.length - 1)} stopColor={color} />)}
            </LinearGradient>
          </Defs>
        ) : null}
        <Circle cx={c} cy={c} r={r} stroke={frame.colors ? `url(#${id})` : p.line} strokeWidth={stroke} fill="none" />
        {stars.map((d) => <Path key={d} d={d} fill="#FFFFFF" />)}
      </Svg>
      <View style={{ width: inner, height: inner, borderRadius: inner / 2, overflow: 'hidden', backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </View>
    </View>
  );
}

/** "Was bedeutet der Rahmen?": every frame with its practice days. */
export function FramesPopup({ days, initial, onClose }: { days: number; initial: string; onClose: () => void }) {
  const p = usePalette();
  const current = FRAMES.reduce((now, f) => (days >= f.days ? f.level : now), 0);
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'center', padding: space.l }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Schließen" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
        <View accessibilityViewIsModal style={{ gap: space.m, padding: space.xl, borderRadius: radius.xl, backgroundColor: p.surface }}>
          <View style={{ gap: space.xs }}>
            <Txt variant="title">Dein Rahmen</Txt>
            <Txt variant="small" muted>Der Rahmen um dein Profilfoto zeigt, wie gut du dranbleibst. Jeder Tag, an dem du deine Routine erledigst, ist ein Übungstag. Du hast {days === 1 ? '1 Übungstag' : `${days} Übungstage`}.</Txt>
          </View>
          <View style={{ gap: space.s }}>
            {FRAMES.map((f) => {
              const reached = days >= f.days;
              const here = f.level === current;
              return (
                <View key={f.name} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.xs, borderRadius: radius.m, backgroundColor: here ? p.accentSoft : 'transparent' }}>
                  <FrameRing frame={f} size={56}>
                    <Txt variant="heading" color={p.accent}>{initial}</Txt>
                  </FrameRing>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt variant="heading">{f.name}</Txt>
                    <Txt variant="small" muted>{f.days === 0 ? 'Damit fängst du an' : `Ab ${f.days} Übungstagen`}</Txt>
                  </View>
                  {here ? <Txt variant="small" color={p.accent} style={{ fontWeight: '700' }}>Du bist hier</Txt> : reached ? <Ionicons name="checkmark-circle" size={22} color={p.accent} accessibilityLabel="erreicht" /> : null}
                </View>
              );
            })}
          </View>
          <Button label="Alles klar" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
