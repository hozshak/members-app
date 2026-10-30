// Voice guidance of the routine: the best German voice the phone has (an "erweiterte"/premium voice when installed,
// soft female voices first), spoken a little slower and quieter than the default — calm, like a coach next to you.
// Tip for members: iPhone → Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen → Deutsch → e.g.
// "Anna (Premium)" laden; the app then picks it automatically.
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

const SOFT_NAMES = ['anna', 'helena', 'petra', 'marlene', 'vicki', 'sandy', 'shelley'];
const SETTINGS = { rate: 0.88, pitch: 1.0, volume: 0.6 };

let voiceId: string | undefined;
let picked: Promise<void> | null = null;

function score(v: Speech.Voice): number {
  const id = `${v.identifier} ${v.name}`.toLowerCase();
  let s = 0;
  if (v.quality === Speech.VoiceQuality.Enhanced) s += 20;
  if (id.includes('premium')) s += 30;
  if (id.includes('enhanced') || id.includes('erweitert')) s += 15;
  if (SOFT_NAMES.some((n) => id.includes(n))) s += 10;
  if (id.includes('compact')) s -= 10;
  if (/\bde[-_]de\b/i.test(v.language)) s += 2;
  return s;
}

/** Chooses the voice once (async); speaking before that uses the system's German voice. */
function pickVoice(): Promise<void> {
  if (!picked) {
    picked = Speech.getAvailableVoicesAsync().then((voices) => {
      const german = voices.filter((v) => v.language.toLowerCase().startsWith('de'));
      german.sort((a, b) => score(b) - score(a));
      voiceId = german[0]?.identifier;
    }).catch(() => undefined);
  }
  return picked;
}

export function prepareVoice(): void {
  if (Platform.OS !== 'web') void pickVoice();
}

export function say(text: string, on: boolean): void {
  if (!on || Platform.OS === 'web') return;
  void pickVoice().then(() => {
    Speech.stop();
    Speech.speak(text, { language: 'de-DE', ...SETTINGS, ...(voiceId ? { voice: voiceId } : {}) });
  });
}

export function stopVoice(): void {
  if (Platform.OS !== 'web') void Speech.stop();
}

/** 90 → "eine Minute dreißig", 45 → "45 Sekunden" (spoken naturally). */
export function spokenDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} Sekunden`;
  const min = m === 1 ? 'eine Minute' : `${m} Minuten`;
  return s ? `${min} ${s}` : min;
}
