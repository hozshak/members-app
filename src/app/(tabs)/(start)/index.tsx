// Home: greeting, the thought of the day, today's routine (one tap to its start), where the member stands in the programmes
// and the routine, then the buttons of the start page (e.g. "WhatsApp-Gruppe", "Bewertung abgeben" — as on the website).
// The contents themselves are under "Inhalte".
import { Image } from 'expo-image';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeButtons } from '@/components/home-buttons';
import { DailyThought, ProgressOverview } from '@/components/home-parts';
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
      <View style={{ gap: space.s }}>
        {community?.logoUrl ? (
          <Image source={{ uri: community.logoUrl }} style={{ height: 28, width: 140 }} contentFit="contain" contentPosition="left" accessibilityLabel={community.name} />
        ) : (
          <Txt variant="caption" color={p.accent}>{community?.name}</Txt>
        )}
        <Txt variant="display">{name ? `${greeting()}, ${name}` : greeting()}</Txt>
      </View>

      <DailyThought />

      <RoutineTodayCard />

      <ProgressOverview products={h.products} others={others} />

      {h.buttons && h.buttons.length > 0 ? <HomeButtons buttons={h.buttons} /> : null}

      {empty ? (
        <View style={{ paddingVertical: space.xxl, gap: space.s }}>
          <Txt variant="title">Noch nichts freigeschaltet</Txt>
          <Txt muted>Sobald du Zugang zu einem Programm hast, findest du es unter „Inhalte“.</Txt>
        </View>
      ) : null}
    </Screen>
  );
}
