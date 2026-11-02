// Development only: writes the small sounds of the routine to assets/sounds/ (soft sine tones as 16-bit mono WAV), so they
// can be changed without a sound editor. Start: node scripts/make-tones.mjs
//   tick — the last three seconds of an exercise · step — the next exercise · done — the routine is finished
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22_050;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');

/** Notes as [frequency in Hz, start in s, length in s]; each swells in quickly and fades out softly. */
function render(notes, volume) {
  const end = Math.max(...notes.map(([, at, len]) => at + len));
  const samples = new Float64Array(Math.ceil(end * RATE));
  for (const [freq, at, len] of notes) {
    const first = Math.floor(at * RATE);
    const count = Math.floor(len * RATE);
    for (let i = 0; i < count; i++) {
      const t = i / RATE;
      const attack = Math.min(1, t / 0.006);
      const fade = Math.exp((-5 * t) / len) * (1 - i / count);
      // a little of the octave makes it round like a small bell
      samples[first + i] += (Math.sin(2 * Math.PI * freq * t) + 0.18 * Math.sin(4 * Math.PI * freq * t)) * attack * fade;
    }
  }
  return samples.map((v) => v * volume);
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32_767), i * 2));
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVEfmt ', 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

mkdirSync(OUT, { recursive: true });
const tones = {
  tick: render([[880, 0, 0.09]], 0.16),
  step: render([[784, 0, 0.16], [1047, 0.11, 0.3]], 0.22),
  done: render([[523, 0, 0.2], [659, 0.13, 0.2], [784, 0.26, 0.22], [1047, 0.39, 0.55]], 0.22),
};
for (const [name, samples] of Object.entries(tones)) {
  writeFileSync(path.join(OUT, `${name}.wav`), wav(samples));
  console.log(`${name}.wav: ${(samples.length / RATE).toFixed(2)} s`);
}
