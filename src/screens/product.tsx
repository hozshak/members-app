// A programme (product): cover, description, what is new, its categories in order and its PDFs.
import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { CategoryTile, LessonRow } from '@/components/content';
import { DownloadRow } from '@/components/download';
import { Cover, ErrorView, Loading, ProgressBar, Screen, Section, Txt } from '@/components/ui';
import { plural, uniqueById } from '@/lib/format';
import { useProduct } from '@/lib/queries';
import { space } from '@/lib/theme';

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const q = useProduct(slug);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  const product = q.data;
  const categories = uniqueById(product.categories.filter((c) => c.access !== 'teaser'));
  const share = product.itemCount > 0 ? product.doneCount / product.itemCount : 0;

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Stack.Screen options={{ title: product.title }} />
      <Cover url={product.imageUrl} title={product.title} />
      <View style={{ gap: space.s }}>
        <Txt variant="display">{product.title}</Txt>
        {product.description || product.shortDescription ? <Txt muted>{product.description || product.shortDescription}</Txt> : null}
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

      {product.newItems.length > 0 ? (
        <Section title="Neu für dich">
          <View style={{ gap: space.s }}>
            {uniqueById(product.newItems).map((v, i) => <LessonRow key={v.id} video={v} index={i + 1} />)}
          </View>
        </Section>
      ) : null}

      {categories.length > 0 ? (
        <Section title="Inhalte">
          <View style={{ gap: space.m }}>
            {categories.map((c) => <CategoryTile key={c.id} category={c} />)}
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
    </Screen>
  );
}
