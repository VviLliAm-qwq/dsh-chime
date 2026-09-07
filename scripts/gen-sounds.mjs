#!/usr/bin/env node
/**
 * generate 4 groups x 4 scenarios = 16 WAV notification sounds.
 * Pure-node WAV writer: 16-bit PCM, 48kHz, mono.
 * Groups: 1 crisp-sine, 2 wood-tap, 3 chiptune-square, 4 warm-piano.
 * Scenarios: done-focus, done-blur, ask-focus, ask-blur.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'assets', 'sounds');
const SR = 48000;
/** Master volume: 0.8 = 80% of the original full-scale sounds. */
const VOLUME = 0.8;

// ── note frequencies ──────────────────────────────────────────────
const N = (name) => {
  const base = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  const m = /^([A-G]#?)(\d)$/.exec(name);
  const semitone = base[m[1]] + (parseInt(m[2], 10) + 1) * 12;
  return 440 * Math.pow(2, (semitone - 69) / 12);
};

// ── mixer / envelope ──────────────────────────────────────────────
// tone(t, f, dur, {wave, attack, decay}) returns a sample contribution.
function tone(t, start, freq, dur, opts = {}) {
  if (t < start || t >= start + dur) return 0;
  const local = t - start;
  const attack = opts.attack ?? 0.008;
  const env = local < attack
    ? local / attack
    : Math.exp(-(local - attack) / (opts.decay ?? (dur * 0.55)));
  const phase = 2 * Math.PI * freq * local;
  let s;
  if (opts.wave === 'square') {
    s = Math.sin(phase) >= 0 ? 1 : -1;
  } else if (opts.wave === 'piano') {
    // fundamental + 2 harmonics, slightly detuned second for warmth
    s = Math.sin(phase)
      + 0.45 * Math.sin(phase * 2)
      + 0.18 * Math.sin(phase * 3 + 0.3)
      + 0.1 * Math.sin(phase * 1.003 + 1.2);
  } else {
    s = Math.sin(phase);
  }
  return s * env * (opts.gain ?? 0.5);
}

// A scenario as a list of note steps: [freq, startMs, durMs, opts]
function scenario(notes, opts = {}) {
  const total = Math.max(...notes.map(n => n[1] + n[2])) + 120;
  const samples = new Float64Array(Math.ceil((total / 1000) * SR));
  for (const [freq, startMs, durMs, noteOpts] of notes) {
    const startSec = startMs / 1000;
    const durSec = durMs / 1000;
    for (let i = 0; i < samples.length; i++) {
      const t = i / SR;
      if (t < startSec || t >= startSec + durSec) continue;
      samples[i] += tone(t, startSec, freq, durSec, { ...opts, ...noteOpts });
    }
  }
  return samples;
}

// ── layout: 16 scenarios ──────────────────────────────────────────
const G = {
  1: { wave: 'sine', gain: 0.42, decay: 0.08 },
  2: { wave: 'sine', gain: 0.55, decay: 0.05, attack: 0.002 },
  3: { wave: 'square', gain: 0.28, decay: 0.09 },
  4: { wave: 'piano', gain: 0.4, decay: 0.28, attack: 0.004 },
};
// per-group octave/velocity flavor
const FLAVOR = {
  1: { up: ['C5', 'E5', 'G5'], down: ['G5', 'E5'], ding: ['G5', 'C6'], solo: 'A5' },
  2: { up: ['C4', 'E4', 'G4'], down: ['G4', 'E4'], ding: ['E4', 'C4'], solo: 'A3' },
  3: { up: ['C5', 'E5', 'G5'], down: ['G5', 'E5'], ding: ['E6', 'C6'], solo: 'A5' },
  4: { up: ['C5', 'E5', 'G5'], down: ['G5', 'E5'], ding: ['G5', 'C6'], solo: 'A4' },
};

function build(groupId, scenarioId) {
  const f = FLAVOR[groupId];
  const o = G[groupId];
  const seq = [];
  const NOTE_MS = { '1': 130, '2': 95, '3': 140, '4': 260 };
  const noteMs = NOTE_MS[String(groupId)];
  const list = scenarioId === 'done-focus' ? f.up : f.down;
  const base = (i, extra = {}) => [N(list[i]), i * (noteMs * 1.35), noteMs + (groupId === 4 ? 180 : 0), extra];
  if (scenarioId === 'done-focus') {
    seq.push(base(0), base(1), base(2));
  } else if (scenarioId === 'done-blur') {
    seq.push(base(0), base(1, { gain: (o.gain ?? 0.4) * 0.7 }));
  } else if (scenarioId === 'ask-focus') {
    const [d1, d2] = f.ding;
    seq.push([N(d1), 0, noteMs * 1.2], [N(d2), noteMs * 1.8, noteMs * 1.5]);
  } else {
    seq.push([N(f.solo), 0, noteMs * 3, { gain: (o.gain ?? 0.4) * 0.75 }]);
  }
  return scenario(seq, o);
}

// ── WAV writer ────────────────────────────────────────────────────
function writeWav(path, samples) {
  const peak = Math.max(1e-9, ...samples.map(Math.abs));
  const scale = (0.88 * VOLUME) / peak;
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    data.writeInt16LE(Math.round(samples[i] * scale * 32767), i * 2);
  }
  const buf = Buffer.alloc(44 + data.length);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + data.length, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(data.length, 40);
  data.copy(buf, 44);
  writeFileSync(path, buf);
}

mkdirSync(OUT, { recursive: true });
const SCENARIOS = ['done-focus', 'done-blur', 'ask-focus', 'ask-blur'];
let count = 0;
for (const g of [1, 2, 3, 4]) {
  for (const s of SCENARIOS) {
    const file = join(OUT, `g${g}-${s}.wav`);
    writeWav(file, build(g, s));
    count++;
  }
}
console.log(`generated ${count} wav files in ${OUT}`);
