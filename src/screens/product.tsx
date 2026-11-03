// A programme (product): cover, description, its categories in order (a programme with only one: its videos directly), its
// PDFs and, at the end, what is new.
import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { CategoryTile, LessonRow } from '@/components/content';
import { DownloadRow } from '@/components/download';
import { LessonList } from '@/components/lesson-list';
import { LinkedText } from '@/components/linked-text';
import { Cover, ErrorView, Loading, ProgressBar, Screen, Section, Txt } from '@/components/ui';
import { plural, uniqueById } from '@/lib/format';
import { useCategory, useProduct } from '@/lib/queries';
import { space } from '@/lib/theme';

/** The videos of the only category of a programme: no extra step in between. */
function OnlyCategory({ slug }: { slug: string }) {
  const q = useCategory(slug);
  if (q.isPending) return <Txt muted>Wird geladen …</Txt>;
  if (q.isError) return <Txt muted>Die Inhalte konnten nicht geladen werden. Zieh die Seite nach unten, um es noch einmal zu versuchen.</Txt>;
  return <LessonList videos={q.data.videos} sections={q.data.sections} />;
}

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const q = useProduct(slug);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  const product = q.data;
  const categories = uniqueById(product.categories.filter((c) => c.access !== 'teaser'));
  const only = categories.length === 1 && categories[0]?.access === 'full' ? categories[0] : null;
  const share = product.itemCount > 0 ? product.doneCount / product.itemCount : 0;

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Stack.Screen options={{ title: product.title }} />
      <Cover url={product.imageUrl} title={product.title} />
      <View style={{ gap: space.s }}>
        <Txt variant="display">{product.title}</Txt>
        {product.description || product.shortDescription ? <LinkedText text={product.description || product.shortDescription} muted /> : null}
        {product.accessUntil ? (
          <Txt variant="small" muted>Zugang bis {new Date(product.accessUntil * 1000).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}</Txt>
        ) : null}
        {product.itemCount > 0 ? (
          <View style={{ gap: space.xs, marginTop: space.s }}>
            <ProgressBar value={share} />
            <Txt variant="small" muted>{product.doneCount} von {plural(product.itemCount, 'Inhalt', 'Inhalten')} erledigt</Txt>
          </View>
        ) : null}
      </View>

      {categories.length > 0 ? (
        <Section title="Inhalte">
          <View style={{ gap: space.m }}>
            {only ? <OnlyCategory slug={only.slug} /> : categories.map((c) => <CategoryTile key={c.id} category={c} />)}
          </View>
        </Section>
      ) : null}

      {product.downloads.length > 0 ? (
        <Section title="Downloads">
          <View style={{ gap: space.s }}>
            {product.downloads.map((f) => <DownloadRow key={f.id} file={f} />)}
          </View>
        </Section>
      ) : null}

      {product.newItems.length > 0 ? (
        <Section title="Neu für dich">
          <View style={{ gap: space.s }}>
            {uniqueById(product.newItems).map((v, i) => <LessonRow key={v.id} video={v} index={i + 1} />)}
          </View>
        </Section>
      ) : null}
    </Screen>
  );
}
