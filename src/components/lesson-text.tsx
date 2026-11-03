// The text of a lesson (Markdown of the software's lesson editor). Videos embedded in it (`::video{id="…"}` on their own
// line) become players at that place; `<u>…</u>` (underline) is shown as plain text; links open as in src/lib/links.ts,
// also addresses written without a link around them. Lesson texts hold no program code: a block Markdown takes for code (text
// indented by accident, as in the lesson "Kurs als App") is shown as normal text, as on the website.
import { View } from 'react-native';
import Markdown, { MarkdownIt, type ASTNode, type RenderRules } from 'react-native-markdown-display';
import { useOpenLink } from '@/lib/links';
import { space, type, usePalette } from '@/lib/theme';
import type { LessonEmbed } from '@/lib/types';
import { LinkedText } from './linked-text';
import { LessonPlayer } from './player';
import { Card, Txt } from './ui';

const VIDEO_LINE = /^::video\{id="([0-9a-f-]{36})"\}\s*$/;
const MARKDOWN = MarkdownIt({ typographer: true, linkify: true });

const plainBlock = (node: ASTNode) => (
  <LinkedText key={node.key} text={node.content.replace(/^[ \t]+/gm, '').trim()} style={{ marginBottom: space.m }} />
);
const RULES: RenderRules = { code_block: plainBlock, fence: plainBlock };

type Part = { kind: 'md'; text: string } | { kind: 'video'; id: string };

/** Markdown and embedded videos in text order (exported for tests). */
export function splitLessonText(md: string): Part[] {
  const parts: Part[] = [];
  let buf: string[] = [];
  const flush = () => {
    const text = buf.join('\n').replace(/<\/?u>/g, '').trim();
    if (text) parts.push({ kind: 'md', text });
    buf = [];
  };
  for (const line of md.split(/\r?\n/)) {
    const m = VIDEO_LINE.exec(line.trim());
    if (m?.[1]) {
      flush();
      parts.push({ kind: 'video', id: m[1] });
    } else {
      buf.push(line);
    }
  }
  flush();
  return parts;
}

export function LessonText({ lessonId, bodyMd, embeds }: { lessonId: string; bodyMd: string; embeds: LessonEmbed[] }) {
  const p = usePalette();
  const styles = {
    body: { ...type.body, color: p.text },
    heading1: { ...type.title, color: p.text, marginTop: space.l, marginBottom: space.s },
    heading2: { ...type.title, fontSize: 20, color: p.text, marginTop: space.l, marginBottom: space.s },
    heading3: { ...type.heading, color: p.text, marginTop: space.m, marginBottom: space.xs },
    paragraph: { marginTop: 0, marginBottom: space.m },
    link: { color: p.accent, textDecorationLine: 'underline' as const },
    bullet_list: { marginBottom: space.m },
    ordered_list: { marginBottom: space.m },
    list_item: { marginBottom: space.xs },
    strong: { fontWeight: '700' as const },
    code_inline: { color: p.text, backgroundColor: p.surfaceAlt, borderColor: p.line },
    blockquote: { backgroundColor: p.surfaceAlt, borderLeftColor: p.accent, borderLeftWidth: 3, paddingHorizontal: space.m, paddingVertical: space.s },
    hr: { backgroundColor: p.line, marginVertical: space.l },
  };
  const openLink = useOpenLink();
  const onLinkPress = (url: string) => {
    openLink(url);
    return false;
  };
  return (
    <View>
      {splitLessonText(bodyMd).map((part, i) => {
        if (part.kind === 'md') return <Markdown key={i} style={styles} markdownit={MARKDOWN} rules={RULES} onLinkPress={onLinkPress}>{part.text}</Markdown>;
        const embed = embeds.find((e) => e.id === part.id);
        if (!embed?.available) {
          return (
            <Card key={i} style={{ padding: space.l, marginBottom: space.m }}>
              <Txt muted>Dieses Video ist gerade nicht verfügbar.</Txt>
            </Card>
          );
        }
        return (
          <View key={i} style={{ marginBottom: space.m, gap: space.xs }}>
            <LessonPlayer posterUrl={embed.thumbnailUrl} playPath={`/api/member/lessons/${encodeURIComponent(lessonId)}/embeds/${encodeURIComponent(part.id)}/play`} />
            {embed.title ? <Txt variant="small" muted>{embed.title}</Txt> : null}
          </View>
        );
      })}
    </View>
  );
}
