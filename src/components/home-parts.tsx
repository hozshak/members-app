// The start page shows no course contents (owner 03.11.2026), those are under "Inhalte". It shows where the member stands: the progress in
// each programme and in the routine. The quote of the day and the own goal are gone (owner 06.11.2026).
import { router, type Href } from 'expo-router';
import { View } from 'react-native';
import { plural } from '@/lib/format';
import { useOpen } from '@/lib/nav';
import { mainRoutine, overallStats } from '@/lib/plans';
import { useRoutines, type RoutineStats } from '@/lib/routine';
import { space, usePalette } from '@/lib/theme';
import type { CategoryCard, MemberProduct } from '@/lib/types';
import { TwoWeeks } from './routine-parts';
import { TourTarget } from './tour';
import { Card, ProgressBar, Section, Txt } from './ui';

/** One programme: how much is done and which part the member is in. */
function ProgressRow({ title, done, total, line, onPress }: { title: string; done: number; total: number; line: string | null; onPress: () => void }) {
  const p = usePalette();
  const share = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <Card onPress={onPress} accessibilityLabel={`${title}: ${done} von ${total} erledigt`} style={{ padding: space.l, gap: space.s }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.m }}>
        <Txt variant="heading" numberOfLines={2} style={{ flex: 1 }}>{title}</Txt>
        <Txt variant="heading" color={p.accent} style={{ fontVariant: ['tabular-nums'] }}>{Math.round(share * 100)} %</Txt>
      </View>
      <ProgressBar value={share} />
      <Txt variant="small" muted>{done} von {plural(total, 'Inhalt', 'Inhalten')} erledigt</Txt>
      {line ? <Txt variant="small" numberOfLines={2}>{line}</Txt> : null}
    </Card>
  );
}

const countOf = (categories: readonly CategoryCard[]) => categories.reduce(
  (sum, c) => ({ done: sum.done + c.doneCount, total: sum.total + c.videoCount }),
  { done: 0, total: 0 },
);

/** The first part that is not finished: where the member stands. */
function whereNow(categories: readonly CategoryCard[]): { category: CategoryCard | null; line: string | null } {
  const open = categories.filter((c) => c.access === 'full' && c.videoCount > 0);
  const category = open.find((c) => c.doneCount < c.videoCount) ?? null;
  if (!category) return { category: null, line: open.length > 0 ? 'Alles geschafft – stark!' : null };
  const started = open.some((c) => c.doneCount > 0);
  return { category, line: `${started ? 'Gerade bei' : 'Als Nächstes'}: ${category.title} (${category.doneCount} von ${category.videoCount})` };
}

function ProductProgress({ product }: { product: MemberProduct }) {
  const open = useOpen();
  const now = whereNow(product.categories);
  return (
    <ProgressRow
      title={product.title}
      done={product.doneCount}
      total={product.itemCount}
      line={now.line}
      onPress={() => (now.category ? open.category(now.category.slug) : open.product(product.slug))}
    />
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Txt variant="title" style={{ fontVariant: ['tabular-nums'] }}>{value}</Txt>
      <Txt variant="small" muted>{label}</Txt>
    </View>
  );
}

function RoutineProgress({ stats }: { stats: RoutineStats }) {
  return (
    <Card onPress={() => router.navigate('/routine' as Href)} accessibilityLabel="Deine Routine" style={{ padding: space.l, gap: space.m }}>
      <View style={{ flexDirection: 'row', gap: space.m }}>
        <Figure value={String(stats.streak)} label={stats.streak === 1 ? 'Tag in Folge' : 'Tage in Folge'} />
        <Figure value={String(stats.totalDays)} label={stats.totalDays === 1 ? 'Tag insgesamt' : 'Tage insgesamt'} />
      </View>
      <TwoWeeks days={stats.days} />
    </Card>
  );
}

/** Nothing when there is nothing to count yet. */
export function ProgressOverview({ products, others }: { products: readonly MemberProduct[]; others: readonly CategoryCard[] }) {
  const routines = useRoutines();
  const routine = mainRoutine(routines.data);
  const counted = products.filter((x) => x.itemCount > 0);
  const rest = countOf(others.filter((c) => c.access === 'full'));
  const hasRoutine = !!routine && routine.steps.length > 0;
  if (counted.length === 0 && rest.total === 0 && !hasRoutine) return null;
  return (
    <TourTarget id="start.progress">
      <Section title="Dein Fortschritt">
        <View style={{ gap: space.m }}>
          {counted.map((product) => <ProductProgress key={product.id} product={product} />)}
          {rest.total > 0 ? (
            <ProgressRow title="Weitere Inhalte" done={rest.done} total={rest.total} line={null} onPress={() => router.navigate('/inhalte' as Href)} />
          ) : null}
          {hasRoutine ? <RoutineProgress stats={overallStats(routines.data)} /> : null}
        </View>
      </Section>
    </TourTarget>
  );
}
