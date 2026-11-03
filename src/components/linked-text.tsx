// Plain text of the community with its links tappable (src/lib/links.ts).
import type { ComponentProps } from 'react';
import { Text } from 'react-native';
import { linkParts, useOpenLink } from '@/lib/links';
import { usePalette } from '@/lib/theme';
import { Txt } from './ui';

export function LinkedText({ text, ...props }: { text: string } & Omit<ComponentProps<typeof Txt>, 'children'>) {
  const p = usePalette();
  const openLink = useOpenLink();
  return (
    <Txt {...props}>
      {linkParts(text).map((part, i) => {
        const href = part.href;
        return href ? (
          <Text key={i} accessibilityRole="link" onPress={() => openLink(href)} style={{ color: p.accent, textDecorationLine: 'underline' }}>{part.text}</Text>
        ) : (
          part.text
        );
      })}
    </Txt>
  );
}
