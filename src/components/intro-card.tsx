// The way to the introduction of a programme (lib/intro.ts). On its page: the start the member chose with its categories, or the way in; it also opens by itself the first
// time. On the start page: a hint per programme until its introduction has been seen.
import { Ionicons } from '@expo/vector-icons';
import { useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { CategoryTile } from '@/components/content';
import { Card, Txt } from '@/components/ui';
import { uniqueById } from '@/lib/format';
import { openIntro, useIntroState, useIntrosLoaded } from '@/lib/intro';
import { space, usePalette } from '@/lib/theme';
import type { MemberProduct, MemberProductDetail } from '@/lib/types';

function useBase(): string {
  const segments = useSegments() as string[];
  return segments.includes('inhalte') ? '/inhalte' : '';
}

/** On the page of a programme. */
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
  const again = () => openIntro(product.slug, base);

  if (level) {
    return (
      <View style={{ gap: space.m }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.m }}>
          <Txt variant="title">Dein Start</Txt>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={again}>
            <Txt variant="small" color={p.accent} style={{ fontWeight: '600' }}>Einführung ansehen</Txt>
          </Pressable>
        </View>
        <Txt variant="small" muted>{level.label}</Txt>
        {startWith.map((c) => <CategoryTile key={c.id} category={c} />)}
      </View>
    );
  }
  return (
    <Card onPress={again} accessibilityLabel={intro.title} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m, backgroundColor: p.accentSoft, borderColor: 'transparent' }}>
      <Ionicons name="compass-outline" size={26} color={p.accent} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="heading">{intro.title}</Txt>
        <Txt variant="small" muted>Womit du anfängst und was du wissen solltest.</Txt>
      </View>
      <Ionicons name="chevron-forward" size={18} color={p.accent} />
    </Card>
  );
}

function IntroHint({ product }: { product: MemberProduct }) {
  const p = usePalette();
  const base = useBase();
  const state = useIntroState(product.id);
  if (!product.intro || state.seen) return null;
  return (
    <Card onPress={() => openIntro(product.slug, base)} accessibilityLabel={`${product.intro.title}: ${product.title}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m, backgroundColor: p.accentSoft, borderColor: 'transparent' }}>
      <Ionicons name="compass-outline" size={26} color={p.accent} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="heading">{product.intro.title}</Txt>
        <Txt variant="small" muted>{product.title}: womit du anfängst und was du wissen solltest.</Txt>
      </View>
      <Ionicons name="chevron-forward" size={18} color={p.accent} />
    </Card>
  );
}

/** On the start page. */
export function IntroHints({ products }: { products: readonly MemberProduct[] }) {
  const loaded = useIntrosLoaded();
  if (!loaded) return null;
  return <>{products.map((x) => <IntroHint key={x.id} product={x} />)}</>;
}
