// The items of a category: first those without a "Lektion", then each Lektion with a heading, numbered through like on the
// website.
import { View } from 'react-native';
import { space } from '@/lib/theme';
import type { SectionCard, VideoCard } from '@/lib/types';
import { LessonRow } from './content';
import { LinkedText } from './linked-text';
import { Txt } from './ui';

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

export function LessonList({ videos, sections }: { videos: VideoCard[]; sections: SectionCard[] }) {
  return (
    <>
      {groupBySection(videos, sections).map((g) => (
        <View key={g.section?.id ?? 'ohne'} style={{ gap: space.s }}>
          {g.section ? (
            <View style={{ gap: 2, marginTop: space.s }}>
              <Txt variant="title">{g.section.title}</Txt>
              {g.section.description ? <LinkedText text={g.section.description} variant="small" muted /> : null}
            </View>
          ) : null}
          {g.videos.map((v, i) => <LessonRow key={v.id} video={v} index={g.first + i} />)}
        </View>
      ))}
    </>
  );
}
