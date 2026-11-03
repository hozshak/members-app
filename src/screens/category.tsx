// A category: cover, description, progress, then its items (components/lesson-list.tsx).
import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { LessonList } from '@/components/lesson-list';
import { LinkedText } from '@/components/linked-text';
import { Cover, ErrorView, Loading, ProgressBar, Screen, Txt } from '@/components/ui';
import { minutes, plural } from '@/lib/format';
import { useCategory } from '@/lib/queries';
import { space } from '@/lib/theme';

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const q = useCategory(slug);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  const { category, videos, sections } = q.data;
  const share = category.videoCount > 0 ? category.doneCount / category.videoCount : 0;

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Stack.Screen options={{ title: category.title }} />
      {category.coverUrl ? <Cover url={category.coverUrl} title={category.title} /> : null}
      <View style={{ gap: space.s }}>
        <Txt variant="display">{category.title}</Txt>
        {category.description ? <LinkedText text={category.description} muted /> : null}
        <Txt variant="small" muted>
          {plural(category.videoCount, 'Inhalt', 'Inhalte')}
          {category.totalDurationSec > 0 ? ` · ${minutes(category.totalDurationSec)}` : ''}
        </Txt>
        {category.videoCount > 0 ? <ProgressBar value={share} style={{ marginTop: space.xs }} /> : null}
      </View>

      <LessonList videos={videos} sections={sections} />
    </Screen>
  );
}
