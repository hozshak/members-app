// The way to the introduction of a programme (lib/intro.ts). On its page: the start the member chose with its categories, or the way in; it also opens by itself the first
// time. On the start page: "So startest du", always there (owner 06.11.2026), with a row per programme that has an introduction; the coach writes them in the dashboard.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { CategoryTile } from '@/components/content';
import { Card, Txt } from '@/components/ui';
import { uniqueById } from '@/lib/format';
import { openIntro, useIntroState, useIntrosLoaded } from '@/lib/intro';
import { radius, space, usePalette } from '@/lib/theme';
import type { MemberProduct, MemberProductDetail } from '@/lib/types';

function useBase(): string {
  const segments = useSegments() as string[];
  return segments.includes('inhalte') ? '/inhalte' : '';
}

/** On the page of a programme. The way back into the introduction is on the start page (owner 06.11.2026: no "Einführung ansehen" here). */
export function IntroCard({ product }: { product: MemberProductDetail }) {
  const p = usePalette();
  const intro = product.intro;
  const base = useBase();
  const loaded = useIntrosLoaded();
  const state = useIntroState(product.id);
  const opened = useRef(false);

  useEffect(() => {
    if (!intro || !loaded || state.seen || opened.current) return;
    opened.current = true;
    openIntro(product.slug, base);
  }, [base, intro, loaded, product.slug, state.seen]);

  if (!intro) return null;
  const level = state.level === null ? null : intro.levels[state.level] ?? null;
  const categories = uniqueById(product.categories);
  const startWith = level ? level.categoryIds.flatMap((id) => categories.filter((c) => c.id === id)) : [];

  if (level) {
    return (
      <View style={{ gap: space.m }}>
        <Txt variant="title">Dein Start</Txt>
        <Txt variant="small" muted>{level.label}</Txt>
        {startWith.map((c) => <CategoryTile key={c.id} category={c} />)}
      </View>
    );
  }
  return (
    <Card onPress={() => openIntro(product.slug, base)} accessibilityLabel={intro.title} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m, backgroundColor: p.accentSoft, borderColor: 'transparent' }}>
      <Ionicons name="compass-outline" size={26} color={p.accent} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="heading">{intro.title}</Txt>
        <Txt variant="small" muted>Womit du anfängst und was du wissen solltest.</Txt>
      </View>
      <Ionicons name="chevron-forward" size={18} color={p.accent} />
    </Card>
  );
}

/** One programme in "So startest du". */
function IntroRow({ product }: { product: MemberProduct }) {
  const p = usePalette();
  const base = useBase();
  const state = useIntroState(product.id);
  const intro = product.intro;
  if (!intro) return null;
  const level = state.level === null ? null : intro.levels[state.level] ?? null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${intro.title}: ${product.title}`}
      onPress={() => openIntro(product.slug, base)}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.s, paddingRight: space.m, borderRadius: radius.m, backgroundColor: p.surfaceAlt, opacity: pressed ? 0.75 : 1 })}
    >
      {product.imageUrl ? (
        <Image source={{ uri: product.imageUrl }} style={{ width: 52, height: 52, borderRadius: radius.s }} contentFit="cover" />
      ) : (
        <View style={{ width: 52, height: 52, borderRadius: radius.s, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="compass-outline" size={24} color={p.accent} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="heading" numberOfLines={2}>{product.title}</Txt>
        <Txt variant="small" muted numberOfLines={1}>{level ? `Dein Start: ${level.label}` : 'Hier fängst du an'}</Txt>
      </View>
      <Ionicons name="chevron-forward" size={18} color={p.textMuted} />
    </Pressable>
  );
}

/** On the start page: as large as the quote of the day was, and always there, also after the introductions have been gone through. */
export function IntroStart({ products }: { products: readonly MemberProduct[] }) {
  const p = usePalette();
  const loaded = useIntrosLoaded();
  const withIntro = products.filter((x) => x.intro);
  if (!loaded || withIntro.length === 0) return null;
  return (
    <View style={{ gap: space.m, padding: space.l, borderRadius: radius.l, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line }}>
      <View style={{ gap: space.s }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Ionicons name="compass" size={16} color={p.accent} />
          <Txt variant="caption" color={p.accent}>So startest du</Txt>
        </View>
        <Txt variant="title">Womit du anfängst und was du wissen solltest</Txt>
      </View>
      <View style={{ gap: space.s }}>
        {withIntro.map((x) => <IntroRow key={x.id} product={x} />)}
      </View>
    </View>
  );
}
