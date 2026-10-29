// Home: greeting, "Weiterschauen" (started videos), the member's programmes with their progress, then categories that
// are open for everyone or unlocked by a tag. Teasers (things to buy) are left out — the app sells nothing.
import { Image } from 'expo-image';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryTile, ContinueTile, ProductTile } from '@/components/content';
import { ErrorView, Loading, Screen, Section, Txt } from '@/components/ui';
import { greeting } from '@/lib/format';
import { useHome } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { space, usePalette } from '@/lib/theme';

export default function HomeScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { community, me } = useSession();
  const home = useHome();

  if (home.isPending) return <Loading />;
  if (home.isError) return <ErrorView error={home.error} onRetry={() => void home.refetch()} />;
  const h = home.data;
  const name = h.greetingName || me?.firstName || '';
  const others = [...h.free, ...h.more];
  const empty = h.products.length === 0 && others.length === 0;

  return (
    <Screen onRefresh={() => void home.refetch()} refreshing={home.isRefetching} contentStyle={{ paddingTop: insets.top + space.l, gap: space.xl }}>
      <View style={{ gap: space.s }}>
        {community?.logoUrl ? (
          <Image source={{ uri: community.logoUrl }} style={{ height: 28, width: 140 }} contentFit="contain" contentPosition="left" accessibilityLabel={community.name} />
        ) : (
          <Txt variant="caption" color={p.accent}>{community?.name}</Txt>
        )}
        <Txt variant="display">{name ? `${greeting()}, ${name}` : greeting()}</Txt>
      </View>

      {h.continueWatching.length > 0 ? (
        <Section title="Weiterschauen">
          <FlatList
            horizontal
            data={h.continueWatching}
            keyExtractor={(v) => v.id}
            renderItem={({ item }) => <ContinueTile video={item} />}
            ItemSeparatorComponent={() => <View style={{ width: space.m }} />}
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -space.l }}
            contentContainerStyle={{ paddingHorizontal: space.l }}
          />
        </Section>
      ) : null}

      {h.products.length > 0 ? (
        <Section title={h.products.length === 1 ? 'Dein Programm' : 'Deine Programme'}>
          <View style={{ gap: space.l }}>
            {h.products.map((product) => <ProductTile key={product.id} product={product} />)}
          </View>
        </Section>
      ) : null}

      {others.length > 0 ? (
        <Section title="Für dich freigeschaltet">
          <View style={{ gap: space.m }}>
            {others.map((c) => <CategoryTile key={c.id} category={c} />)}
          </View>
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
