// A category: cover, description, progress, then its items — first those without a "Lektion", then each Lektion with a
// heading — numbered through like on the website.
import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { LessonRow } from '@/components/content';
import { Cover, ErrorView, Loading, ProgressBar, Screen, Txt } from '@/components/ui';
import { minutes, plural } from '@/lib/format';
import { useCategory } from '@/lib/queries';
import { space } from '@/lib/theme';
import type { SectionCard, VideoCard } from '@/lib/types';

/** `first`: the number of its first item (items are numbered through the whole category). */
interface Group { section: SectionCard | null; videos: VideoCard[]; first: number }

function groupBySection(videos: VideoCard[], sections: SectionCard[]): Group[] {
  const raw = [{ section: null, videos: videos.filter((v) => v.sectionId === null) }, ...sections.map((s) => ({ section: s, videos: videos.filter((v) => v.sectionId === s.id) }))]
    .filter((g) => g.videos.length > 0);
  const groups: Group[] = [];
  let first = 1;
  for (const g of raw) {
    groups.push({ ...g, first });
    first += g.videos.length;
  }
  return groups;
}

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const q = useCategory(slug);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  const { category, videos, sections } = q.data;
  const groups = groupBySection(videos, sections);
  const share = category.videoCount > 0 ? category.doneCount / category.videoCount : 0;

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Stack.Screen options={{ title: category.title }} />
      {category.coverUrl ? <Cover url={category.coverUrl} title={category.title} /> : null}
      <View style={{ gap: space.s }}>
        <Txt variant="display">{category.title}</Txt>
        {category.description ? <Txt muted>{category.description}</Txt> : null}
        <Txt variant="small" muted>
          {plural(category.videoCount, 'Inhalt', 'Inhalte')}
          {category.totalDurationSec > 0 ? ` · ${minutes(category.totalDurationSec)}` : ''}
        </Txt>
        {category.videoCount > 0 ? <ProgressBar value={share} style={{ marginTop: space.xs }} /> : null}
      </View>

      {groups.map((g) => (
        <View key={g.section?.id ?? 'ohne'} style={{ gap: space.s }}>
          {g.section ? (
            <View style={{ gap: 2, marginTop: space.s }}>
              <Txt variant="title">{g.section.title}</Txt>
              {g.section.description ? <Txt variant="small" muted>{g.section.description}</Txt> : null}
            </View>
          ) : null}
          {g.videos.map((v, i) => <LessonRow key={v.id} video={v} index={g.first + i} />)}
        </View>
      ))}
    </Screen>
  );
}
