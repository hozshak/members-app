// "Inhalte": a search over every lesson, then everything the member has: the programmes (inside them the videos), all PDFs
// ("Deine Downloads"; a product of nothing but PDFs, like The Face Code, is no programme), the categories open for every member
// and those unlocked by a tag, what was started ("Weiterschauen"), the Merkliste (lessons saved on this phone). Teasers (things
// to buy) are left out.
import { useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CategoryTile, ContinueTile, kindLabel, LessonLink, ProductTile } from '@/components/content';
import { DownloadRow } from '@/components/download';
import { ErrorView, Loading, Screen, Section, Txt } from '@/components/ui';
import { plural, uniqueById } from '@/lib/format';
import { useBookmarks } from '@/lib/bookmarks';
import { searchable, useHome, useLibrary, useSearchIndex } from '@/lib/queries';
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
  const q = useLibrary();
  const home = useHome();
  const bookmarks = useBookmarks();
  const [query, setQuery] = useState('');
  const searching = query.trim().length >= 2;

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  const lib = q.data;
  const empty = lib.products.length === 0 && lib.free.length === 0 && lib.more.length === 0;
  const continueWatching = uniqueById(home.data?.continueWatching ?? []);
  const programmes = lib.products.filter((x) => x.itemCount > 0 || x.downloads.length === 0);
  const downloads = uniqueById(lib.products.flatMap((x) => x.downloads));

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

      {!searching && programmes.length > 0 ? (
        <Section title={programmes.length === 1 ? 'Dein Programm' : 'Deine Programme'}>
          <View style={{ gap: space.l }}>
            {programmes.map((product) => <ProductTile key={product.id} product={product} />)}
          </View>
        </Section>
      ) : null}

      {!searching && downloads.length > 0 ? (
        <Section title="Deine Downloads">
          <View style={{ gap: space.s }}>
            {downloads.map((f) => <DownloadRow key={f.id} file={f} />)}
          </View>
        </Section>
      ) : null}

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

      {!searching && continueWatching.length > 0 ? (
        <Section title="Weiterschauen">
          <FlatList
            horizontal
            data={continueWatching}
            keyExtractor={(v) => v.id}
            renderItem={({ item }) => <ContinueTile video={item} />}
            ItemSeparatorComponent={() => <View style={{ width: space.m }} />}
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -space.l }}
            contentContainerStyle={{ paddingHorizontal: space.l }}
          />
        </Section>
      ) : null}

      {!searching && bookmarks.list.length > 0 ? (
        <Section title="Merkliste">
          <View style={{ gap: space.s }}>
            {bookmarks.list.map((b) => (
              <LessonLink key={b.id} id={b.id} title={b.title} subtitle={`${b.categoryTitle} · ${kindLabel(b.kind, b.durationSec)}`} icon="bookmark" />
            ))}
          </View>
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
