// The introduction of a programme (lib/intro.ts), one thing per page: where the member stands, what to start with (the categories lead straight there), the coach's pages
// (e.g. the group, the tools, staying with it) and the closing words. Closing it at any time is fine: it stays reachable on the page of the programme.
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryTile } from '@/components/content';
import { LinkedText } from '@/components/linked-text';
import { Button, Cover, ErrorView, Loading, Screen, Txt } from '@/components/ui';
import { uniqueById } from '@/lib/format';
import { setIntroState, useIntroState, type ProgrammeIntro } from '@/lib/intro';
import { useProduct } from '@/lib/queries';
import { radius, space, usePalette } from '@/lib/theme';
import type { MemberProductDetail } from '@/lib/types';

type Page = { kind: 'where' } | { kind: 'start' } | { kind: 'page'; title: string; text: string } | { kind: 'closing' };

function Pager({ product, intro, base }: { product: MemberProductDetail; intro: ProgrammeIntro; base: string }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const saved = useIntroState(product.id);
  const [index, setIndex] = useState(0);
  const level = saved.level === null ? null : intro.levels[saved.level] ?? null;
  const pages: Page[] = [
    { kind: 'where' },
    ...(level ? [{ kind: 'start' } as const] : []),
    ...intro.pages.map((x) => ({ kind: 'page' as const, title: x.title, text: x.text })),
    ...(intro.closing ? [{ kind: 'closing' } as const] : []),
  ];
  const page = pages[index] ?? { kind: 'where' as const };
  const isLast = index >= pages.length - 1;
  const categories = uniqueById(product.categories);
  const startWith = level ? level.categoryIds.flatMap((id) => categories.filter((c) => c.id === id)) : [];

  useEffect(() => {
    setIntroState(product.id, { seen: true });
  }, [product.id]);

  const close = () => router.back();
  const finish = () => {
    setIntroState(product.id, { finished: true });
    router.back();
  };
  const openCategory = (slug: string) => {
    setIntroState(product.id, { finished: true });
    router.back();
    router.push(`${base}/kategorie/${encodeURIComponent(slug)}` as Href);
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Screen contentStyle={{ paddingTop: insets.top + space.m, gap: space.l, paddingBottom: 130 + insets.bottom }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          {index > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Zurück" hitSlop={12} onPress={() => setIndex(index - 1)}>
              <Ionicons name="chevron-back" size={28} color={p.text} />
            </Pressable>
          ) : null}
          <View accessibilityLabel={`Schritt ${index + 1} von ${pages.length}`} style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
            {pages.map((_, i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= index ? p.accent : p.surfaceAlt }} />)}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Schließen" hitSlop={12} onPress={close}>
            <Ionicons name="close" size={28} color={p.text} />
          </Pressable>
        </View>

        {page.kind === 'where' ? (
          <>
            <Cover url={product.imageUrl} title={product.title} />
            <View style={{ gap: space.s }}>
              <Txt variant="caption" color={p.accent}>{product.title}</Txt>
              <Txt variant="display">{intro.title}</Txt>
              {intro.lead ? <LinkedText text={intro.lead} muted /> : null}
            </View>
            {intro.levels.length > 0 ? (
              <View style={{ gap: space.m }}>
                <Txt variant="title">{intro.question}</Txt>
                <View accessibilityRole="radiogroup" style={{ gap: space.s }}>
                  {intro.levels.map((l, i) => {
                    const on = saved.level === i;
                    return (
                      <Pressable
                        key={l.label}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={l.hint ? `${l.label}, ${l.hint}` : l.label}
                        onPress={() => {
                          setIntroState(product.id, { level: i });
                          setIndex(1);
                        }}
                        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 72, padding: space.m, borderRadius: radius.l, borderWidth: 2, borderColor: on ? p.accent : p.line, backgroundColor: on ? p.accentSoft : p.surface, opacity: pressed ? 0.85 : 1 })}
                      >
                        <View style={{ flex: 1, gap: 2 }}>
                          <Txt variant="heading">{l.label}</Txt>
                          {l.hint ? <Txt variant="small" muted>{l.hint}</Txt> : null}
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={on ? p.accent : p.textMuted} />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {page.kind === 'start' && level ? (
          <>
            <View style={{ gap: space.s }}>
              <Txt variant="caption" color={p.accent}>Dein Start</Txt>
              <Txt variant="display">{level.label}</Txt>
              <LinkedText text={level.text} />
            </View>
            {startWith.length > 0 ? (
              <View style={{ gap: space.m }}>
                <Txt variant="title">Damit fängst du an</Txt>
                {startWith.map((c) => <CategoryTile key={c.id} category={c} onOpen={() => openCategory(c.slug)} />)}
              </View>
            ) : null}
          </>
        ) : null}

        {page.kind === 'page' ? (
          <View style={{ gap: space.s }}>
            <Txt variant="caption" color={p.accent}>{intro.title}</Txt>
            <Txt variant="display">{page.title}</Txt>
            <LinkedText text={page.text} style={{ marginTop: space.xs }} />
          </View>
        ) : null}

        {page.kind === 'closing' ? (
          <View style={{ alignItems: 'center', gap: space.m, paddingTop: space.xl }}>
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="heart" size={44} color={p.accent} />
            </View>
            <LinkedText text={intro.closing} variant="title" style={{ textAlign: 'center' }} />
          </View>
        ) : null}
      </Screen>

      {page.kind !== 'where' || intro.levels.length === 0 ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.m, backgroundColor: p.bg, borderTopColor: p.line }]}>
          <Button label={isLast ? 'Los geht’s' : 'Weiter'} onPress={isLast ? finish : () => setIndex(index + 1)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.l, paddingTop: space.m, borderTopWidth: StyleSheet.hairlineWidth },
});

export default function IntroScreen() {
  const { slug, base } = useLocalSearchParams<{ slug: string; base?: string }>();
  const q = useProduct(slug);
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data.intro) return <ErrorView error={new Error('not_found')} onRetry={() => router.back()} />;
  return <Pager product={q.data} intro={q.data.intro} base={base ?? ''} />;
}
