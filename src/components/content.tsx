// Cards of the member area: a product (programme) with its progress, a category, a "continue watching" tile and one
// lesson row (video, text, PDF) with its state. Locked things are shown, but not as links.
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { clock, minutes, plural } from '@/lib/format';
import { useOpen } from '@/lib/nav';
import { space, usePalette } from '@/lib/theme';
import type { CategoryCard, MemberProduct, VideoCard } from '@/lib/types';
import { Badge, Card, Cover, ProgressBar, Txt } from './ui';

export function ProductTile({ product }: { product: MemberProduct }) {
  const open = useOpen();
  const share = product.itemCount > 0 ? product.doneCount / product.itemCount : 0;
  return (
    <Card onPress={() => open.product(product.slug)} accessibilityLabel={product.title}>
      <Cover url={product.imageUrl} title={product.title} rounded={0}>
        {product.newCount > 0 ? <View style={{ position: 'absolute', top: space.m, left: space.m }}><Badge label={`${product.newCount} neu`} /></View> : null}
      </Cover>
      <View style={{ padding: space.l, gap: space.s }}>
        <Txt variant="title">{product.title}</Txt>
        {product.shortDescription ? <Txt muted numberOfLines={2}>{product.shortDescription}</Txt> : null}
        {product.itemCount > 0 ? (
          <View style={{ gap: space.xs, marginTop: space.xs }}>
            <ProgressBar value={share} />
            <Txt variant="small" muted>{product.doneCount} von {plural(product.itemCount, 'Inhalt', 'Inhalten')} erledigt</Txt>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

export function CategoryTile({ category }: { category: CategoryCard }) {
  const p = usePalette();
  const open = useOpen();
  const locked = category.access !== 'full';
  const share = category.videoCount > 0 ? category.doneCount / category.videoCount : 0;
  return (
    <Card
      onPress={locked ? undefined : () => open.category(category.slug)}
      accessibilityLabel={category.title}
      style={{ flexDirection: 'row', alignItems: 'center', padding: space.m, gap: space.m, opacity: locked ? 0.6 : 1 }}
    >
      <Cover url={category.coverUrl} title={category.title} style={{ width: 96 }} />
      <View style={{ flex: 1, gap: space.xs }}>
        {category.newCount > 0 ? <Badge label="Neu" /> : null}
        <Txt variant="heading" numberOfLines={2}>{category.title}</Txt>
        {locked && category.lockedBy ? (
          <Txt variant="small" muted>Öffnet sich nach „{category.lockedBy.title}“</Txt>
        ) : (
          <Txt variant="small" muted>
            {plural(category.videoCount, 'Inhalt', 'Inhalte')}
            {category.totalDurationSec > 0 ? ` · ${minutes(category.totalDurationSec)}` : ''}
          </Txt>
        )}
        {!locked && category.videoCount > 0 ? <ProgressBar value={share} style={{ marginTop: 2 }} /> : null}
      </View>
      {locked ? <Ionicons name="lock-closed" size={18} color={p.textMuted} accessibilityLabel="gesperrt" /> : null}
    </Card>
  );
}

/** A tile of "Weiterschauen": the thumbnail with the watched share. */
export function ContinueTile({ video }: { video: VideoCard }) {
  const open = useOpen();
  const share = video.durationSec ? Math.min(1, video.progressSec / video.durationSec) : 0;
  return (
    <Card onPress={() => open.lesson(video.id)} accessibilityLabel={`${video.title} weiterschauen`} style={{ width: 240 }}>
      <Cover url={video.thumbnailUrl} title={video.title} rounded={0}>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
          <ProgressBar value={share} style={{ borderRadius: 0, height: 4 }} />
        </View>
      </Cover>
      <View style={{ padding: space.m, gap: 2 }}>
        <Txt variant="heading" numberOfLines={2}>{video.title}</Txt>
        <Txt variant="small" muted numberOfLines={1}>{video.categoryTitle}</Txt>
      </View>
    </Card>
  );
}

const KIND_LABEL: Record<VideoCard['kind'], string> = { video: 'Video', video_text: 'Video', text: 'Text', pdf: 'PDF' };

/** One lesson in a list: number or check, title, kind and length; locked lessons are not tappable. */
export function LessonRow({ video, index }: { video: VideoCard; index: number }) {
  const p = usePalette();
  const open = useOpen();
  const finished = video.done || video.completed;
  return (
    <Card
      onPress={video.locked ? undefined : () => open.lesson(video.id)}
      accessibilityLabel={`${video.title}${finished ? ', erledigt' : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', padding: space.m, gap: space.m, opacity: video.locked ? 0.55 : 1 }}
    >
      <View
        style={{
          width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
          backgroundColor: finished ? p.accent : p.surfaceAlt,
        }}
      >
        {finished
          ? <Ionicons name="checkmark" size={18} color={p.onAccent} />
          : <Txt variant="small" color={p.textMuted} style={{ fontWeight: '700' }}>{String(index)}</Txt>}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="heading" numberOfLines={2}>{video.title}</Txt>
        <Txt variant="small" muted>
          {KIND_LABEL[video.kind]}
          {video.durationSec ? ` · ${clock(video.durationSec)}` : ''}
          {video.isNew ? ' · Neu' : ''}
        </Txt>
      </View>
      <Ionicons name={video.locked ? 'lock-closed' : 'chevron-forward'} size={18} color={p.textMuted} accessibilityLabel={video.locked ? 'gesperrt' : undefined} />
    </Card>
  );
}
