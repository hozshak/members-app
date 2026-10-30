// "Inhalte": a search over every lesson, the Merkliste (lessons saved on this phone), then everything the member has as
// a library — each programme with its categories (and progress), then the categories open for every member and those
// unlocked by a tag. Teasers (things to buy) are left out.
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CategoryTile, kindLabel, LessonLink } from '@/components/content';
import { ErrorView, Loading, ProgressBar, Screen, Section, Txt } from '@/components/ui';
import { plural, uniqueById } from '@/lib/format';
import { useOpen } from '@/lib/nav';
import { useBookmarks } from '@/lib/bookmarks';
import { searchable, useLibrary, useSearchIndex } from '@/lib/queries';
import { radius, space, usePalette } from '@/lib/theme';

function SearchResults({ query }: { query: string }) {
  const index = useSearchIndex(true);
  const words = searchable(query).split(/\s+/).filter(Boolean);
  const hits = index.items.filter((v) => {
    const text = searchable(`${v.title} ${v.categoryTitle}`);
    return words.every((w) => text.includes(w));
  });
  if (index.loading && hits.length === 0) return <Txt muted>Suche …</Txt>;
  if (hits.length === 0) return <Txt muted>Nichts gefunden für „{query}“.</Txt>;
  return (
    <View style={{ gap: space.s }}>
      <Txt variant="small" muted>{plural(hits.length, 'Treffer', 'Treffer')}</Txt>
      {hits.slice(0, 50).map((v) => (
        <LessonLink key={v.id} id={v.id} title={v.title} subtitle={`${v.categoryTitle} · ${kindLabel(v.kind, v.durationSec)}`} />
      ))}
    </View>
  );
}

export default function LibraryScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const open = useOpen();
  const q = useLibrary();
  const bookmarks = useBookmarks();
  const [query, setQuery] = useState('');
  const searching = query.trim().length >= 2;

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  const lib = q.data;
  const empty = lib.products.length === 0 && lib.free.length === 0 && lib.more.length === 0;

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching} contentStyle={{ paddingTop: insets.top + space.l, gap: space.xl }}>
      <Txt variant="display">Inhalte</Txt>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: 48, paddingHorizontal: space.m, borderRadius: radius.l, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line }}>
        <Ionicons name="search" size={20} color={p.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Übungen und Lektionen suchen"
          placeholderTextColor={p.textMuted}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Suchen"
          style={{ flex: 1, color: p.text, fontSize: 16, paddingVertical: space.s }}
        />
        {query ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Suche leeren" hitSlop={8} onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={20} color={p.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {searching ? <SearchResults query={query.trim()} /> : null}

      {!searching && bookmarks.list.length > 0 ? (
        <Section title="Merkliste">
          <View style={{ gap: space.s }}>
            {bookmarks.list.map((b) => (
              <LessonLink key={b.id} id={b.id} title={b.title} subtitle={`${b.categoryTitle} · ${kindLabel(b.kind, b.durationSec)}`} icon="bookmark" />
            ))}
          </View>
        </Section>
      ) : null}

      {!searching && lib.products.map((product) => {
        const categories = uniqueById(product.categories.filter((c) => c.access !== 'teaser'));
        const share = product.itemCount > 0 ? product.doneCount / product.itemCount : 0;
        return (
          <View key={product.id} style={{ gap: space.m }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${product.title} öffnen`} onPress={() => open.product(product.slug)} style={{ gap: space.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
                <Txt variant="title" style={{ flex: 1 }}>{product.title}</Txt>
                <Ionicons name="chevron-forward" size={20} color={p.textMuted} />
              </View>
              {product.itemCount > 0 ? (
                <View style={{ gap: space.xs }}>
                  <ProgressBar value={share} />
                  <Txt variant="small" muted>{product.doneCount} von {plural(product.itemCount, 'Inhalt', 'Inhalten')} erledigt</Txt>
                </View>
              ) : null}
            </Pressable>
            {categories.map((c) => <CategoryTile key={c.id} category={c} />)}
          </View>
        );
      })}

      {!searching && lib.free.length > 0 ? (
        <Section title="Für alle Mitglieder">
          <View style={{ gap: space.m }}>{uniqueById(lib.free).map((c) => <CategoryTile key={c.id} category={c} />)}</View>
        </Section>
      ) : null}

      {!searching && lib.more.length > 0 ? (
        <Section title="Weitere Inhalte">
          <View style={{ gap: space.m }}>{uniqueById(lib.more).map((c) => <CategoryTile key={c.id} category={c} />)}</View>
        </Section>
      ) : null}

      {!searching && empty ? (
        <View style={{ paddingVertical: space.xxl, gap: space.s }}>
          <Txt variant="title">Noch nichts freigeschaltet</Txt>
          <Txt muted>Sobald du Zugang zu einem Programm hast, findest du es hier.</Txt>
        </View>
      ) : null}
    </Screen>
  );
}
