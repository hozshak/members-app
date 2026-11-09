// Home: greeting with the buttons of the start page next to it (e.g. "WhatsApp-Gruppe", "Bewertung abgeben"), "So startest du" with the
// introduction of each programme (always there; the quote of the day is gone, owner 06.11.2026), today's routine (one tap to its start) and where the
// member stands in the programmes and the routine. The contents themselves
// are under "Inhalte". After a month the popup that asks for a rating; the first time the assistant (lib/tour.ts).
import { Image } from 'expo-image';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeButtons, RatingPrompt, ToolsButton } from '@/components/home-buttons';
import { ProgressOverview } from '@/components/home-parts';
import { IntroStart } from '@/components/intro-card';
import { RoutineTodayCard } from '@/components/routine-parts';
import { TourTarget } from '@/components/tour';
import { ErrorView, Loading, Screen, Txt } from '@/components/ui';
import { greeting, uniqueById } from '@/lib/format';
import { useHome } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { space, usePalette } from '@/lib/theme';
import { useTourOnFocus } from '@/lib/tour';

export default function HomeScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { community, me } = useSession();
  const home = useHome();
  useTourOnFocus('start', !home.isPending);

  if (home.isPending) return <Loading />;
  if (home.isError) return <ErrorView error={home.error} onRetry={() => void home.refetch()} />;
  const h = home.data;
  const name = h.greetingName || me?.firstName || '';
  const others = uniqueById([...h.free, ...h.more]);
  const empty = h.products.length === 0 && others.length === 0;

  return (
    <Screen tour="start" onRefresh={() => void home.refetch()} refreshing={home.isRefetching} contentStyle={{ paddingTop: insets.top + space.l, gap: space.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.m }}>
      <View style={{ flex: 1, gap: space.s }}>
        {community?.logoUrl ? (
          <Image source={{ uri: community.logoUrl }} style={{ height: 28, width: 140 }} contentFit="contain" contentPosition="left" accessibilityLabel={community.name} />
        ) : (
          <Txt variant="caption" color={p.accent}>{community?.name}</Txt>
        )}
        <Txt variant="display">{name ? `${greeting()}, ${name}` : greeting()}</Txt>
      </View>
      {(h.buttons && h.buttons.length > 0) || (h.tools && h.tools.length > 0) ? (
        <TourTarget id="start.buttons">
          <View style={{ flexDirection: 'row', gap: space.s }}>
            {h.tools && h.tools.length > 0 ? <ToolsButton /> : null}
            {h.buttons ? <HomeButtons buttons={h.buttons} /> : null}
          </View>
        </TourTarget>
      ) : null}
      </View>

      <TourTarget id="start.intro"><IntroStart products={h.products} /></TourTarget>

      <RoutineTodayCard />

      <ProgressOverview products={h.products} others={others} />

      {empty ? (
        <View style={{ paddingVertical: space.xxl, gap: space.s }}>
          <Txt variant="title">Noch nichts freigeschaltet</Txt>
          <Txt muted>Sobald du Zugang zu einem Programm hast, findest du es unter „Inhalte“.</Txt>
        </View>
      ) : null}

      {h.buttons ? <RatingPrompt buttons={h.buttons} /> : null}
    </Screen>
  );
}
