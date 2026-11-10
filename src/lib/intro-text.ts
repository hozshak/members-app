// The text of an introduction page as the coach writes it (owner 09.11.2026: the introduction replaces an intro video). Line by line:
//   "[Bild: Zungen-Grafik]"        the picture uploaded for that line in the dashboard; a line without a picture shows nothing (yet);
//   "Tipp für den Alltag: …"       a line that starts with "Tipp" stands in a box of its own;
//   "Woche 1–2: Viele merken …"    a short label before the colon is bold;
//   anything else                  a paragraph, with its links tappable (lib/links.ts);
//   "**Wort**"                     bold (the "B" of the dashboard, 10.11.2026) — never across a line, never with a space just inside the stars.
// The same rules as in the dashboard (shared/programme-intro.ts of the software).
import type { ProgrammeIntroImage } from './intro';

export type IntroBlock =
  | { kind: 'text'; label: string | null; text: string }
  | { kind: 'tip'; label: string | null; text: string }
  | { kind: 'image'; label: string; url: string };

const IMAGE_LINE = /^\[\s*(?:bild|foto)\s*(?::\s*([^\]]*?))?\s*\]$/i;
// up to 40 characters without a sentence end before ": " (an address has no space after its colon)
const LABEL = /^([^.!?:[\]\n]{2,40}):\s+(\S.*)$/;

export function introBlocks(text: string, images: readonly ProgrammeIntroImage[] = []): IntroBlock[] {
  const out: IntroBlock[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const picture = IMAGE_LINE.exec(line);
    if (picture) {
      const label = (picture[1] ?? '').trim() || 'Bild';
      const url = images.find((x) => x.label === label)?.url;
      if (url) out.push({ kind: 'image', label, url });
      continue;
    }
    const m = LABEL.exec(line);
    // a label the coach made bold herself ("**Woche 1:** …", "**Woche 1**: …") is bold anyway: without its stars
    const label = m?.[1] ? m[1].replace(/\*\*/g, '').trim() || null : null;
    const rest = (m?.[2] ?? line).replace(/^\*\*\s*/, (stars) => (m?.[1]?.includes('**') ? '' : stars));
    out.push({ kind: /^tipp\b/i.test(line) ? 'tip' : 'text', label, text: label ? rest : line });
  }
  return out;
}

/** `**Wort**` (shared/programme-intro.ts INTRO_BOLD_RE of the software): the text in runs, bold or not. Stars without a partner stay as they are. */
const BOLD = /\*\*(\S(?:[^\n]*?\S)?)\*\*/g;

export function boldRuns(text: string): { text: string; bold: boolean }[] {
  const out: { text: string; bold: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(BOLD)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), bold: false });
    out.push({ text: m[1] ?? '', bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), bold: false });
  return out;
}
