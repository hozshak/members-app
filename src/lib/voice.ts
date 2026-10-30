// Voice guidance of the routine: the phone's standard German voice at normal speed and volume (the automatic choice of
// a "better" voice was taken back on 30.10.2026 — on iPhones it picked robotic novelty voices).
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

export function say(text: string, on: boolean): void {
  if (!on || Platform.OS === 'web') return;
  void Speech.stop();
  Speech.speak(text, { language: 'de-DE', rate: 1.0 });
}

export function stopVoice(): void {
  if (Platform.OS !== 'web') void Speech.stop();
}

/** 90 → "1 Minute 30", 45 → "45 Sekunden" (spoken). */
export function spokenDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} Sekunden`;
  return `${m} ${m === 1 ? 'Minute' : 'Minuten'}${s ? ` ${s}` : ''}`;
}
