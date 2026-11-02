// Readable colours on the community's accent (also for the widget, which must not depend on the session).
function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (ch[0] ?? 0) + 0.7152 * (ch[1] ?? 0) + 0.0722 * (ch[2] ?? 0);
}

/** Black or white, whichever has more contrast on `hex`. */
export function onColor(hex: string): string {
  const l = luminance(hex);
  return (1.05) / (l + 0.05) >= (l + 0.05) / 0.05 ? '#FFFFFF' : '#111111';
}
