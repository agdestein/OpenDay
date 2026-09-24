// Small synthesized sound effects for the whole arcade: no audio files, so
// nothing to load and nothing to break offline. Every game can call
// `sound.play('splash')`; the shell owns the mute button. Muting is remembered
// on the machine; `?sound=off` in the URL starts a machine muted.

export type SoundName =
  | 'click' | 'thud' | 'splash' | 'alarm' | 'flood' | 'cheer' | 'fanfare' | 'tick' | 'gate' | 'horn' | 'ding' | 'clack' | 'whoosh' | 'sizzle';

const KEY = 'arcade-muted';
/** Shortest gap between two plays of the same sound (s), so a held button or a
 * frame loop cannot turn a sound into a buzz. */
const GAP: Partial<Record<SoundName, number>> = { thud: .09, splash: .15, click: .04, tick: .3, ding: .06, flood: .4, alarm: 1.5, horn: 1.2, clack: .035, whoosh: .08, sizzle: .25 };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
const last: Partial<Record<SoundName, number>> = {};
const listeners = new Set<(muted: boolean) => void>();

function initialMuted(): boolean {
  if (new URLSearchParams(location.search).get('sound') === 'off') return true;
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}
let muted = initialMuted();

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    master = ctx.createGain(); master.gain.value = .5; master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  } catch { ctx = null; }
  return ctx;
}

/** Browsers only allow sound after a user gesture: resume on the first one. */
function unlock(): void { const a = audio(); if (a && a.state === 'suspended') void a.resume(); }
window.addEventListener('pointerdown', unlock, { capture: true });
window.addEventListener('keydown', unlock, { capture: true });

function tone(a: AudioContext, at: number, freq: number, length: number, volume: number, type: OscillatorType = 'sine', slideTo?: number): void {
  const osc = a.createOscillator(), gain = a.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, at);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + length);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(volume, at + .01);
  gain.gain.exponentialRampToValueAtTime(1e-4, at + length);
  osc.connect(gain).connect(master!);
  osc.start(at); osc.stop(at + length + .02);
}
function hiss(a: AudioContext, at: number, length: number, volume: number, from: number, to: number, q = 1): void {
  const src = a.createBufferSource(), filter = a.createBiquadFilter(), gain = a.createGain();
  src.buffer = noise; filter.type = 'bandpass'; filter.Q.value = q;
  filter.frequency.setValueAtTime(from, at); filter.frequency.exponentialRampToValueAtTime(to, at + length);
  gain.gain.setValueAtTime(volume, at); gain.gain.exponentialRampToValueAtTime(1e-4, at + length);
  src.connect(filter).connect(gain).connect(master!);
  src.start(at, Math.random() * .5); src.stop(at + length + .02);
}

/** `pitch` and `volume` are multipliers (1 = as designed); most recipes ignore them. */
const RECIPES: Record<SoundName, (a: AudioContext, t: number, pitch: number, volume: number) => void> = {
  click: (a, t) => tone(a, t, 900, .05, .15, 'triangle'),
  thud: (a, t) => { tone(a, t, 140, .12, .35, 'sine', 60); hiss(a, t, .08, .15, 900, 300); },
  splash: (a, t) => { hiss(a, t, .45, .5, 2400, 300, .8); tone(a, t, 500, .15, .1, 'sine', 180); },
  alarm: (a, t) => { for (let k = 0; k < 3; k++) { tone(a, t + k * .32, 740, .15, .22, 'square'); tone(a, t + k * .32 + .16, 560, .15, .22, 'square'); } },
  flood: (a, t) => { tone(a, t, 420, .5, .25, 'triangle', 150); hiss(a, t, .5, .2, 700, 200); },
  cheer: (a, t) => [523, 659, 784, 1047].forEach((f, k) => tone(a, t + k * .09, f, .3, .22, 'triangle')),
  fanfare: (a, t) => [392, 523, 659, 784, 1047].forEach((f, k) => tone(a, t + k * .11, f, k === 4 ? .7 : .22, .24, 'triangle')),
  tick: (a, t) => tone(a, t, 1300, .06, .18, 'square'),
  gate: (a, t) => { tone(a, t, 70, 1.4, .35, 'sawtooth', 50); hiss(a, t, 1.2, .12, 300, 120); },
  horn: (a, t) => { tone(a, t, 110, .9, .2, 'sawtooth'); tone(a, t, 138, .9, .15, 'sawtooth'); },
  ding: (a, t) => tone(a, t, 1568, .35, .15, 'sine'),
  whoosh: (a, t, p, v) => { hiss(a, t, .35, .22 * v, 500 * p, 2600 * p, 1.5); tone(a, t, 180 * p, .25, .06 * v, 'sine', 420 * p); },
  sizzle: (a, t) => { hiss(a, t, .7, .28, 5200, 1400, .7); tone(a, t, 260, .4, .08, 'sawtooth', 90); },
  clack: (a, t, p, v) => { tone(a, t, 1500 * p, .045, .12 * v, 'triangle', 1100 * p); hiss(a, t, .03, .1 * v, 4200 * p, 2600 * p, 2); },
};

export const sound = {
  play(name: SoundName, mod?: { pitch?: number; volume?: number }): void {
    if (muted) return;
    const a = audio();
    if (!a || !master || a.state !== 'running') return;
    const now = a.currentTime;
    if (now - (last[name] ?? -1) < (GAP[name] ?? 0)) return;
    last[name] = now;
    try { RECIPES[name](a, now + .005, mod?.pitch ?? 1, mod?.volume ?? 1); } catch { /* sound is never worth a crash */ }
  },
  get muted(): boolean { return muted; },
  setMuted(value: boolean): void {
    muted = value;
    try { localStorage.setItem(KEY, value ? '1' : '0'); } catch { /* private window */ }
    listeners.forEach(l => l(muted));
  },
  onChange(listener: (muted: boolean) => void): () => void { listeners.add(listener); return () => listeners.delete(listener); },
};
