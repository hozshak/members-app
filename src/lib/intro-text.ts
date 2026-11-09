// The text of an introduction page as the coach writes it (owner 09.11.2026: the introduction replaces an intro video). Line by line:
//   "[Bild: Zungen-Grafik]"        the picture uploaded for that line in the dashboard; a line without a picture shows nothing (yet);
//   "Tipp für den Alltag: …"       a line that starts with "Tipp" stands in a box of its own;
//   "Woche 1–2: Viele merken …"    a short label before the colon is bold;
//   anything else                  a paragraph, with its links tappable (lib/links.ts).
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
    const label = m?.[1] ? m[1].trim() : null;
    const rest = m?.[2] ?? line;
    out.push({ kind: /^tipp\b/i.test(line) ? 'tip' : 'text', label, text: label ? rest : line });
  }
  return out;
}
