// Home: greeting with the buttons of the start page next to it (e.g. "WhatsApp-Gruppe", "Bewertung abgeben"), the quote of the day,
// today's routine (one tap to its start) and where the member stands in the programmes and the routine. The contents themselves
// are under "Inhalte".
import { Image } from 'expo-image';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeButtons } from '@/components/home-buttons';
import { DailyQuote, ProgressOverview } from '@/components/home-parts';
import { RoutineTodayCard } from '@/components/routine-parts';
import { ErrorView, Loading, Screen, Txt } from '@/components/ui';
import { greeting, uniqueById } from '@/lib/format';
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
  const others = uniqueById([...h.free, ...h.more]);
  const empty = h.products.length === 0 && others.length === 0;

  return (
    <Screen onRefresh={() => void home.refetch()} refreshing={home.isRefetching} contentStyle={{ paddingTop: insets.top + space.l, gap: space.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.m }}>
      <View style={{ flex: 1, gap: space.s }}>
        {community?.logoUrl ? (
          <Image source={{ uri: community.logoUrl }} style={{ height: 28, width: 140 }} contentFit="contain" contentPosition="left" accessibilityLabel={community.name} />
        ) : (
          <Txt variant="caption" color={p.accent}>{community?.name}</Txt>
        )}
        <Txt variant="display">{name ? `${greeting()}, ${name}` : greeting()}</Txt>
      </View>
      {h.buttons && h.buttons.length > 0 ? <HomeButtons buttons={h.buttons} /> : null}
      </View>

      <DailyQuote />

      <RoutineTodayCard />

      <ProgressOverview products={h.products} others={others} />

      {empty ? (
        <View style={{ paddingVertical: space.xxl, gap: space.s }}>
          <Txt variant="title">Noch nichts freigeschaltet</Txt>
          <Txt muted>Sobald du Zugang zu einem Programm hast, findest du es unter „Inhalte“.</Txt>
        </View>
      ) : null}
    </Screen>
  );
}
