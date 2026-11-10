// Plain text of the community with its links tappable (src/lib/links.ts). With `rich` (the texts of an introduction, 10.11.2026) `**Wort**` is bold too.
import type { ComponentProps, ReactNode } from 'react';
import { Text } from 'react-native';
import { boldRuns } from '@/lib/intro-text';
import { linkParts, useOpenLink } from '@/lib/links';
import { usePalette } from '@/lib/theme';
import { Txt } from './ui';

/** The pieces of a text inside a Txt: links tappable, and with `rich` the bold of the coach. */
export function useTextSpans(): (text: string, rich?: boolean) => ReactNode[] {
  const p = usePalette();
  const openLink = useOpenLink();
  const links = (text: string, bold: boolean, key: string) => linkParts(text).map((part, i) => {
    const href = part.href;
    if (href) {
      return (
        <Text key={`${key}-${i}`} accessibilityRole="link" onPress={() => openLink(href)} style={[{ color: p.accent, textDecorationLine: 'underline' }, bold ? { fontWeight: '700' } : null]}>
          {part.text}
        </Text>
      );
    }
    return bold ? <Text key={`${key}-${i}`} style={{ fontWeight: '700' }}>{part.text}</Text> : part.text;
  });
  return (text, rich = false) => (rich ? boldRuns(text).flatMap((run, i) => links(run.text, run.bold, String(i))) : links(text, false, 't'));
}

export function LinkedText({ text, rich = false, ...props }: { text: string; rich?: boolean } & Omit<ComponentProps<typeof Txt>, 'children'>) {
  const spans = useTextSpans();
  return <Txt {...props}>{spans(text, rich)}</Txt>;
}
