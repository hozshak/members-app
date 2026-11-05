// Cards of the member area: a product (programme) with its progress, a category, a "continue watching" tile and one
// lesson row (video, text, PDF) with its state. Locked things are shown, but not as links.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { clock, minutes, plural } from '@/lib/format';
import { useOpen } from '@/lib/nav';
import { useSession } from '@/lib/session';
import { radius, space, usePalette } from '@/lib/theme';
import type { CategoryCard, MemberProduct, VideoCard } from '@/lib/types';
import { Badge, Card, Cover, PictureFade, ProgressBar, Txt } from './ui';

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

export function CategoryTile({ category, onOpen }: { category: CategoryCard; onOpen?: () => void }) {
  const p = usePalette();
  const open = useOpen();
  const locked = category.access !== 'full';
  const share = category.videoCount > 0 ? category.doneCount / category.videoCount : 0;
  return (
    <Card
      onPress={locked ? undefined : (onOpen ?? (() => open.category(category.slug)))}
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

export const NEW_TILE_WIDTH = 176;
const NEW_TILE_HEIGHT = 300;

/**
 * A tile of "Neu für dich": upright, to swipe through like pictures (Mailin 04.11.2026). The thumbnails are wide and often carry their title, so
 * the whole picture stands in the tile on a blurred copy of itself instead of being cut.
 */
export function NewTile({ video }: { video: VideoCard }) {
  const p = usePalette();
  const open = useOpen();
  const { api } = useSession();
  const source = video.thumbnailUrl && api ? { uri: api.url(video.thumbnailUrl), headers: api.mediaHeaders() } : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${video.title}${video.done ? ', erledigt' : ''}`}
      accessibilityState={{ disabled: video.locked }}
      onPress={video.locked ? undefined : () => open.lesson(video.id)}
      style={({ pressed }) => ({
        width: NEW_TILE_WIDTH, height: NEW_TILE_HEIGHT, borderRadius: radius.l, overflow: 'hidden', backgroundColor: p.accent,
        opacity: video.locked ? 0.55 : pressed ? 0.9 : 1, transform: [{ scale: pressed && !video.locked ? 0.98 : 1 }],
      })}
    >
      {source ? (
        <>
          <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={22} accessibilityIgnoresInvertColors />
          <Image source={source} style={[StyleSheet.absoluteFill, { bottom: 76 }]} contentFit="contain" transition={150} accessibilityIgnoresInvertColors />
        </>
      ) : null}
      <PictureFade />
      <View style={{ position: 'absolute', top: space.s, left: space.s, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: video.done ? p.accent : 'rgba(0,0,0,0.5)' }}>
        <Ionicons name={video.locked ? 'lock-closed' : video.done ? 'checkmark' : 'play'} size={15} color={video.done && !video.locked ? p.onAccent : '#FFFFFF'} />
      </View>
      <View style={{ position: 'absolute', left: space.m, right: space.m, bottom: space.m, gap: 2 }}>
        <Txt variant="heading" color="#FFFFFF" numberOfLines={3}>{video.title}</Txt>
        <Txt variant="small" color="rgba(255,255,255,0.85)">{KIND_LABEL[video.kind]}{video.durationSec ? ` · ${clock(video.durationSec)}` : ''}</Txt>
      </View>
    </Pressable>
  );
}

/** One lesson in a list: its thumbnail, number or check, title, kind and length; locked lessons are not tappable. */
export function LessonRow({ video, index }: { video: VideoCard; index: number }) {
  const p = usePalette();
  const open = useOpen();
  // only the member's own "erledigt" (like on the website): watching 90 % alone sets `completed`, not this
  const finished = video.done;
  return (
    <Card
      onPress={video.locked ? undefined : () => open.lesson(video.id)}
      accessibilityLabel={`${video.title}${finished ? ', erledigt' : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', padding: space.m, gap: space.m, opacity: video.locked ? 0.55 : 1 }}
    >
      {video.thumbnailUrl ? (
        <Cover url={video.thumbnailUrl} title={video.title} style={{ width: 104 }}>
          <View style={{ position: 'absolute', left: 4, top: 4, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: finished ? p.accent : 'rgba(0,0,0,0.6)' }}>
            {finished
              ? <Ionicons name="checkmark" size={15} color={p.onAccent} />
              : <Txt variant="small" color="#FFFFFF" style={{ fontWeight: '700', fontSize: 12, lineHeight: 16 }}>{String(index)}</Txt>}
          </View>
        </Cover>
      ) : (
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
      )}
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

/** A lesson as one line with where it is (Merkliste, search results). */
export function LessonLink({ id, title, subtitle, icon = 'play-circle-outline' }: {
  id: string; title: string; subtitle: string; icon?: keyof typeof Ionicons.glyphMap;
}) {
  const p = usePalette();
  const open = useOpen();
  return (
    <Card onPress={() => open.lesson(id)} accessibilityLabel={title} style={{ flexDirection: 'row', alignItems: 'center', padding: space.m, gap: space.m }}>
      <Ionicons name={icon} size={24} color={p.accent} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="heading" numberOfLines={2}>{title}</Txt>
        <Txt variant="small" muted numberOfLines={1}>{subtitle}</Txt>
      </View>
      <Ionicons name="chevron-forward" size={18} color={p.textMuted} />
    </Card>
  );
}

export const kindLabel = (kind: VideoCard['kind'], durationSec: number | null) =>
  `${KIND_LABEL[kind]}${durationSec ? ` · ${clock(durationSec)}` : ''}`;
