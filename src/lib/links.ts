// Links in texts of the community (descriptions, lesson texts, comments). Like the website's LinkifiedText: `https://…`,
// `http://…` and `www.…` in plain text become links, punctuation at the end stays text; also `[Text](Adresse)` and e-mail
// addresses. A link into the member area opens in the app (the browser would ask for the login), a chat invitation in the
// chat app, everything else in the browser inside the app. Other kinds of links are not opened.
import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';
import { useOpen } from './nav';
import { useSession } from './session';

export interface TextPart { text: string; href: string | null }

const LINK_RE = /\[([^\]\n]+)\]\(((?:https?:\/\/|www\.|mailto:|tel:|\/)[^\s)]+)\)|\b(?:https?:\/\/|www\.)[^\s<>"]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}/gi;
const TRAILING_PUNCT = /[.,;:!?)\]}'"»“”‘’]+$/;
const CHAT_APP = /^https:\/\/(chat\.whatsapp\.com|api\.whatsapp\.com|wa\.me|t\.me)\//i;
const IN_APP = /^\/mitglied\/(kategorie|produkt|video)\/([^/?#]+)(?:\/lektion\/([^/?#]+))?/;

/** Plain text split into text and links. */
export function linkParts(text: string): TextPart[] {
  const out: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK_RE)) {
    const start = m.index;
    let raw = m[0];
    let href: string;
    let label: string;
    if (m[1] && m[2]) {
      label = m[1];
      href = m[2];
    } else {
      let trail = TRAILING_PUNCT.exec(raw)?.[0] ?? '';
      if (trail.startsWith(')') && raw.slice(0, raw.length - trail.length).includes('(')) trail = trail.slice(1);
      if (trail) raw = raw.slice(0, raw.length - trail.length);
      if (raw.includes('@') && !/^https?:|^www\./i.test(raw)) href = `mailto:${raw}`;
      else if (raw.length < 8) continue;
      else href = raw;
      label = raw;
    }
    if (start > last) out.push({ text: text.slice(last, start), href: null });
    out.push({ text: label, href });
    last = start + raw.length;
  }
  if (last < text.length) out.push({ text: text.slice(last), href: null });
  return out;
}

/** Opens a link of a text; the address decides how. */
export function useOpenLink(): (href: string) => void {
  const open = useOpen();
  const { api } = useSession();
  return (href) => {
    const raw = href.trim();
    if (/^(mailto|tel):/i.test(raw)) {
      void Linking.openURL(raw).catch(() => undefined);
      return;
    }
    const base = api?.baseUrl ?? '';
    const path = raw.startsWith('/') ? raw : base && raw.toLowerCase().startsWith(`${base.toLowerCase()}/`) ? raw.slice(base.length) : null;
    const inside = path ? IN_APP.exec(path) : null;
    if (inside?.[3]) return open.lesson(decodeURIComponent(inside[3]));
    if (inside?.[1] === 'kategorie') return open.category(decodeURIComponent(inside[2] as string));
    if (inside?.[1] === 'produkt') return open.product(decodeURIComponent(inside[2] as string));
    if (inside?.[1] === 'video') return open.lesson(decodeURIComponent(inside[2] as string));
    const url = path ? base + path : /^www\./i.test(raw) ? `https://${raw}` : raw;
    if (!/^https?:\/\//i.test(url)) return;
    if (CHAT_APP.test(url)) {
      void Linking.openURL(url).catch(() => undefined);
      return;
    }
    void WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url).catch(() => undefined));
  };
}
