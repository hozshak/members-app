// The building blocks of every screen: text in the type scale, buttons, cards, cover images (with the session, the
// community's media need it), a progress bar, loading and error states. Colours come from usePalette().
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorText } from '@/lib/api';
import { useSession } from '@/lib/session';
import { radius, space, type, usePalette } from '@/lib/theme';

type Variant = keyof typeof type;

export function Txt({ variant = 'body', muted, color, style, children, numberOfLines }: {
  variant?: Variant; muted?: boolean; color?: string; style?: StyleProp<TextStyle>; children: ReactNode; numberOfLines?: number;
}) {
  const p = usePalette();
  return (
    <Text numberOfLines={numberOfLines} style={[type[variant], { color: color ?? (muted ? p.textMuted : p.text) }, variant === 'caption' && { textTransform: 'uppercase' }, style]}>
      {children}
    </Text>
  );
}

/** Scrollable page on the app background; pull to refresh when `onRefresh` is given. */
export function Screen({ children, onRefresh, refreshing = false, padded = true, contentStyle }: {
  children: ReactNode; onRefresh?: () => void; refreshing?: boolean; padded?: boolean; contentStyle?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[padded && { padding: space.l }, { paddingBottom: insets.bottom + space.xxl, gap: space.l }, contentStyle]}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.accent} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function Button({ label, onPress, kind = 'primary', loading, disabled, style }: {
  label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'ghost'; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const bg = kind === 'primary' ? p.accent : kind === 'secondary' ? p.surfaceAlt : 'transparent';
  const fg = kind === 'primary' ? p.onAccent : kind === 'secondary' ? p.text : p.accent;
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: off ? 0.5 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[type.heading, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

/** A tappable surface (product, category, lesson). */
export function Card({ children, onPress, style, accessibilityLabel }: {
  children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; accessibilityLabel?: string;
}) {
  const p = usePalette();
  const base = [styles.card, { backgroundColor: p.surface, borderColor: p.line }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [...base, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] }]}
    >
      {children}
    </Pressable>
  );
}

/** A cover image of the community (sent with the session); a soft accent field with the initial when there is none. */
export function Cover({ url, title, aspect = 16 / 9, style, rounded = radius.m, children }: {
  url: string | null; title: string; aspect?: number; style?: StyleProp<ViewStyle>; rounded?: number; children?: ReactNode;
}) {
  const p = usePalette();
  const { api } = useSession();
  const initial = Array.from(title.trim())[0]?.toLocaleUpperCase('de-DE') ?? '';
  return (
    <View style={[{ aspectRatio: aspect, borderRadius: rounded, overflow: 'hidden', backgroundColor: p.accentSoft }, style]}>
      {url && api ? (
        <Image source={{ uri: api.url(url), headers: api.mediaHeaders() }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={{ fontSize: 34, fontWeight: '700', color: p.accent }}>{initial}</Text>
        </View>
      )}
      {children}
    </View>
  );
}

export function ProgressBar({ value, style }: { value: number; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={[{ height: 6, borderRadius: 3, backgroundColor: p.surfaceAlt, overflow: 'hidden' }, style]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: p.accent, borderRadius: 3 }} />
    </View>
  );
}

export function Badge({ label, tone = 'accent' }: { label: string; tone?: 'accent' | 'neutral' | 'success' }) {
  const p = usePalette();
  const bg = tone === 'accent' ? p.accent : tone === 'success' ? p.success : p.surfaceAlt;
  const fg = tone === 'neutral' ? p.textMuted : tone === 'success' ? '#FFFFFF' : p.onAccent;
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={[type.caption, { color: fg, fontSize: 11, textTransform: 'uppercase' }]}>{label}</Text>
    </View>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <View style={{ gap: space.m }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.m }}>
        <Txt variant="title">{title}</Txt>
        {action}
      </View>
      {children}
    </View>
  );
}

export function Loading() {
  const p = usePalette();
  return (
    <View style={[styles.center, { flex: 1, backgroundColor: p.bg, padding: space.xxl }]}>
      <ActivityIndicator color={p.accent} size="large" />
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const p = usePalette();
  return (
    <View style={[styles.center, { flex: 1, backgroundColor: p.bg, padding: space.xxl, gap: space.l }]}>
      <Txt variant="heading" style={{ textAlign: 'center' }}>{errorText(error)}</Txt>
      <Button label="Noch einmal" onPress={onRetry} kind="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 50, borderRadius: radius.l, paddingHorizontal: space.xl, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radius.l, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
