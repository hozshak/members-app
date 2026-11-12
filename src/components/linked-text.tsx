// Plain text of the community with its links tappable (src/lib/links.ts). With `rich` (the texts of an introduction) the coach's format too: `**Wort**`
// bold (10.11.2026), `_Wort_` italic and `++Wort++` underlined (12.11.2026) — lib/intro-text.ts introRuns.
import type { ComponentProps, ReactNode } from 'react';
import { Text, type TextStyle } from 'react-native';
import { introRuns, type IntroRun } from '@/lib/intro-text';
import { linkParts, useOpenLink } from '@/lib/links';
import { usePalette } from '@/lib/theme';
import { Txt } from './ui';

type Format = Omit<IntroRun, 'text'>;
const PLAIN: Format = { bold: false, italic: false, underline: false };

/** The style of a run (null when plain); a link is underlined anyway. */
function formatStyle(f: Format): TextStyle | null {
  if (!f.bold && !f.italic && !f.underline) return null;
  return {
    ...(f.bold ? { fontWeight: '700' as const } : null),
    ...(f.italic ? { fontStyle: 'italic' as const } : null),
    ...(f.underline ? { textDecorationLine: 'underline' as const } : null),
  };
}

/** The pieces of a text inside a Txt: links tappable, and with `rich` the format of the coach. */
export function useTextSpans(): (text: string, rich?: boolean) => ReactNode[] {
  const p = usePalette();
  const openLink = useOpenLink();
  const links = (text: string, f: Format, key: string) => linkParts(text).map((part, i) => {
    const href = part.href;
    const style = formatStyle(f);
    if (href) {
      return (
        <Text key={`${key}-${i}`} accessibilityRole="link" onPress={() => openLink(href)} style={[style, { color: p.accent, textDecorationLine: 'underline' }]}>
          {part.text}
        </Text>
      );
    }
    return style ? <Text key={`${key}-${i}`} style={style}>{part.text}</Text> : part.text;
  });
  return (text, rich = false) => (rich ? introRuns(text).flatMap((run, i) => links(run.text, run, String(i))) : links(text, PLAIN, 't'));
}

export function LinkedText({ text, rich = false, ...props }: { text: string; rich?: boolean } & Omit<ComponentProps<typeof Txt>, 'children'>) {
  const spans = useTextSpans();
  return <Txt {...props}>{spans(text, rich)}</Txt>;
}
