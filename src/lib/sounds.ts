// The small sounds of the routine instead of a voice (owner 02.11.2026: "ich will nicht, dass er spricht, aber so kleine
// Töne"): a short tick in the last three seconds, a soft two-note sound at the next exercise, a little chime at the end.
// They mix with the sound of the exercise video and other apps instead of stopping them. Made by scripts/make-tones.mjs.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

const SOURCES = {
  tick: require('../../assets/sounds/tick.wav') as number,
  step: require('../../assets/sounds/step.wav') as number,
  done: require('../../assets/sounds/done.wav') as number,
};
export type Tone = keyof typeof SOURCES;

const players: Partial<Record<Tone, AudioPlayer>> = {};
let prepared = false;

/** Loads the sounds ahead (the first one would otherwise come late); call when a routine opens. */
export function prepareTones(): void {
  if (!prepared) {
    prepared = true;
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(() => undefined);
  }
  for (const tone of Object.keys(SOURCES) as Tone[]) {
    try {
      players[tone] ??= createAudioPlayer(SOURCES[tone]);
    } catch { /* no sound, the routine goes on */ }
  }
}

export function playTone(tone: Tone, on: boolean): void {
  if (!on) return;
  const player = players[tone];
  if (!player) return;
  try {
    void player.seekTo(0);
    player.play();
  } catch { /* no sound, the routine goes on */ }
}
