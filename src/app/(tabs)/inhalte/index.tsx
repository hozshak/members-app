// "Inhalte": everything the member has, as a library — each programme with its categories (and progress), then the
// categories open for every member and those unlocked by a tag. Teasers (things to buy) are left out.
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CategoryTile } from '@/components/content';
import { ErrorView, Loading, ProgressBar, Screen, Section, Txt } from '@/components/ui';
import { plural, uniqueById } from '@/lib/format';
import { useOpen } from '@/lib/nav';
import { useLibrary } from '@/lib/queries';
import { space, usePalette } from '@/lib/theme';

export default function LibraryScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const open = useOpen();
  const q = useLibrary();

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  const lib = q.data;
  const empty = lib.products.length === 0 && lib.free.length === 0 && lib.more.length === 0;

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching} contentStyle={{ paddingTop: insets.top + space.l, gap: space.xl }}>
      <Txt variant="display">Inhalte</Txt>

      {lib.products.map((product) => {
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

      {lib.free.length > 0 ? (
        <Section title="Für alle Mitglieder">
          <View style={{ gap: space.m }}>{uniqueById(lib.free).map((c) => <CategoryTile key={c.id} category={c} />)}</View>
        </Section>
      ) : null}

      {lib.more.length > 0 ? (
        <Section title="Weitere Inhalte">
          <View style={{ gap: space.m }}>{uniqueById(lib.more).map((c) => <CategoryTile key={c.id} category={c} />)}</View>
        </Section>
      ) : null}

      {empty ? (
        <View style={{ paddingVertical: space.xxl, gap: space.s }}>
          <Txt variant="title">Noch nichts freigeschaltet</Txt>
          <Txt muted>Sobald du Zugang zu einem Programm hast, findest du es hier.</Txt>
        </View>
      ) : null}
    </Screen>
  );
}
