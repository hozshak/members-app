// Colours of the app: a calm warm neutral in light and dark, plus the accent colour of the community (from its
// branding) for buttons, progress and the active tab. Text on the accent is black or white, whichever reads better.
import { useColorScheme } from 'react-native';
import { useSession } from './session';

export interface Palette {
  scheme: 'light' | 'dark';
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  line: string;
  accent: string;
  onAccent: string;
  accentSoft: string;
  success: string;
  danger: string;
}

const LIGHT = { bg: '#F6F4F1', surface: '#FFFFFF', surfaceAlt: '#EFEBE6', text: '#1C1A18', textMuted: '#6B655F', line: '#E3DED7', success: '#2F7D4F', danger: '#B42318' };
const DARK = { bg: '#121110', surface: '#1C1A18', surfaceAlt: '#272421', text: '#F3F0EB', textMuted: '#A39C94', line: '#302C28', success: '#5CC08A', danger: '#F97066' };

function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (ch[0] ?? 0) + 0.7152 * (ch[1] ?? 0) + 0.0722 * (ch[2] ?? 0);
}

/** Black or white, whichever has more contrast on `hex`. */
export function onColor(hex: string): string {
  const l = luminance(hex);
  return (1.05) / (l + 0.05) >= (l + 0.05) / 0.05 ? '#FFFFFF' : '#111111';
}

export function usePalette(): Palette {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { community } = useSession();
  const accent = community?.accentColor ?? '#C2410C';
  const base = scheme === 'dark' ? DARK : LIGHT;
  return { scheme, ...base, accent, onAccent: onColor(accent), accentSoft: `${accent}${scheme === 'dark' ? '33' : '1F'}` };
}

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const radius = { s: 8, m: 12, l: 16, xl: 22 } as const;
export const type = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '700' as const, letterSpacing: -0.6 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 23 },
  small: { fontSize: 14, lineHeight: 19 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.6 },
};
