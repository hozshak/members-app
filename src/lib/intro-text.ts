// The text of an introduction page as the coach writes it (owner 09.11.2026: the introduction replaces an intro video). Line by line:
//   "[Bild: Zungen-Grafik]"        the picture uploaded for that line in the dashboard; a line without a picture shows nothing (yet);
//   "Tipp für den Alltag: …"       a line that starts with "Tipp" stands in a box of its own;
//   "Woche 1–2: Viele merken …"    a short label before the colon is bold;
//   anything else                  a paragraph, with its links tappable (lib/links.ts);
//   "**Wort**", "_Wort_", "++Wort++"  bold, italic, underlined (the "B", "I", "U" of the dashboard, 10. and 12.11.2026) — introRuns below.
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

// The format of the coach (the buttons "B", "I", "U" of the dashboard; shared/programme-intro.ts introRuns of the software, the same rules):
//   **Wort**   bold         never across a line, never with a space just inside the marks
//   _Wort_     italic       the same, and only around whole words — an address or a name with "_" in it stays as it is (12.11.2026)
//   ++Wort++   underlined   like bold (12.11.2026)
// Marks nest ("**_Wort_**"); a mark inside itself and marks without a partner stay as they are.
export type IntroMark = 'bold' | 'italic' | 'underline';
export interface IntroRun { text: string; bold: boolean; italic: boolean; underline: boolean }

const RUN_RES: readonly (readonly [IntroMark, RegExp])[] = [
  ['bold', /\*\*(\S(?:[^\n]*?\S)?)\*\*/],
  ['underline', /\+\+(\S(?:[^\n]*?\S)?)\+\+/],
  // group 1: what stands before the first "_" (kept), group 2: the words
  ['italic', /(^|[\s([{„“"'‚‘*+])_(\S(?:[^\n]*?\S)?)_(?=$|[\s.,;:!?)\]}“”"'‘’…*+–-])/],
];

export function introRuns(text: string, style: Omit<IntroRun, 'text'> = { bold: false, italic: false, underline: false }): IntroRun[] {
  const out: IntroRun[] = [];
  let rest = text;
  while (rest) {
    let best: { mark: IntroMark; at: number; len: number; inner: string } | null = null;
    for (const [mark, re] of RUN_RES) {
      if (style[mark]) continue;
      const m = re.exec(rest);
      if (!m) continue;
      const lead = mark === 'italic' ? (m[1] ?? '').length : 0;
      const at = m.index + lead;
      if (!best || at < best.at) best = { mark, at, len: m[0].length - lead, inner: (mark === 'italic' ? m[2] : m[1]) ?? '' };
    }
    if (!best) {
      out.push({ text: rest, ...style });
      break;
    }
    if (best.at > 0) out.push({ text: rest.slice(0, best.at), ...style });
    out.push(...introRuns(best.inner, { ...style, [best.mark]: true }));
    rest = rest.slice(best.at + best.len);
  }
  return out;
}
