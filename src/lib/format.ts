// German formatting for durations and counts.

/** 754 → "12:34", 3754 → "1:02:34". */
export function clock(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return '';
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** 5400 → "1 Std. 30 Min.", 600 → "10 Min.". */
export function minutes(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 60) return `${Math.max(1, m)} Min.`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} Std. ${rest} Min.` : `${h} Std.`;
}

export function plural(n: number, one: string, other: string): string {
  return `${n.toLocaleString('de-DE')} ${n === 1 ? one : other}`;
}

/** "Guten Morgen" … by the hour of the phone. */
export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 11) return 'Guten Morgen';
  if (h < 18) return 'Hallo';
  return 'Guten Abend';
}

/** Each id once, first occurrence wins (the same video or category can come from two programmes). */
export function uniqueById<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  return items.filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)));
}
