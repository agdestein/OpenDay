// The challenge's second and third rounds, as pure functions the game and the
// tests share: a dike with hidden weak spots and test storms (round 2), and
// "how high?" — a fragility curve, random storms and a century (round 3).
import { FloodSim, GRID_W as W, GRID_H as H } from './water';
import {
  CALM_SEA, DIKE_X, HOMES, OLD_DIKE, STORM_LENGTH, TIME_SCALE, countBits, dikeProfile, floodedHomes,
  homeSpillLevels, makeScene, seaLevelAt, type DikeRow,
} from './scene';

/** Small seeded generator (mulberry32), so rounds and tests are repeatable. */
export function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Round 2: weak spots ----

/** Where a weak spot can hide: sections of four rows along the dike. */
export const SECTIONS = [2, 7, 12, 17, 22, 27, 32].map(y0 => ({ y0, y1: y0 + 3 }));
export const WEAK_COUNT = 3;
export const WEAK_BUDGET = 45;
export const WEAK_TESTS = 3;
/** The real storm is a big one; test storms can be smaller or bigger. */
export const WEAK_STORM = 3;
export const TEST_STORMS = { min: 2.4, max: 3.2 };
const WEAK_CREST = 2.8;
const STRONG = { critical: 2.2, rate: 2e-3 };
const ROTTEN = { critical: .9, rate: 1e-2 };

export function chooseWeakSections(rng: () => number): number[] {
  const order = SECTIONS.map((_, k) => k);
  for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(rng() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
  return order.slice(0, WEAK_COUNT).sort((a, b) => a - b);
}
/** A dike that looks the same everywhere, but is rotten inside at the weak sections. */
export function weakDike(weak: readonly number[]): (y: number) => DikeRow {
  const profile = dikeProfile(WEAK_CREST);
  return y => weak.some(k => y >= SECTIONS[k].y0 && y <= SECTIONS[k].y1)
    ? { profile, ...ROTTEN } : { profile, ...STRONG };
}

/** What a storm did, per dike row: ground washed away, and whether water came over. */
export interface StormReport {
  peak: number;
  eroded: Float64Array;
  overtopped: Uint8Array;
  flooded: number;
}

/** Run one whole storm on a copy of a landscape, a slice at a time: each `next()`
 * advances about `sliceSeconds` of displayed time. The last value is the report. */
export function* stormRun(terrain: Float64Array, dike: (y: number) => DikeRow, peak: number, sliceSeconds = .5): Generator<{ progress: number; sim: FloodSim }, StormReport> {
  const sim = makeScene(dike);
  const base = sim.terrain.slice();
  sim.terrain.set(terrain);
  const eroded = new Float64Array(H), overtopped = new Uint8Array(H);
  let flooded = 0;
  const frames = Math.round(STORM_LENGTH * 30);
  for (let f = 1; f <= frames; f++) {
    const t = f / 30;
    sim.seaLevel = seaLevelAt(t, 0, peak);
    sim.advance(TIME_SCALE / 30);
    flooded |= floodedHomes(sim);
    for (let y = 0; y < H; y++) {
      const crest = y * W + (DIKE_X[0] + DIKE_X[1]) / 2;
      if (sim.water[crest] > .05) overtopped[y] = 1;
    }
    if (f % Math.max(1, Math.round(sliceSeconds * 30)) === 0) yield { progress: f / frames, sim };
  }
  homeSpillLevels(sim.terrain).forEach((level, k) => { if (level < CALM_SEA) flooded |= 1 << k; });
  for (let y = 0; y < H; y++) for (let x = DIKE_X[0]; x <= DIKE_X[1]; x++) {
    const i = y * W + x;
    eroded[y] = Math.max(eroded[y], Math.min(base[i], terrain[i]) - sim.terrain[i]);
  }
  return { peak, eroded, overtopped, flooded };
}
/** Run a generator to its end (tests, and anywhere time does not matter). */
export function finish<T, R>(run: Generator<T, R>): R {
  for (;;) { const r = run.next(); if (r.done) return r.value; }
}

// ---- Round 3: how high? ----

export const HEIGHT = { min: 1.5, max: 4, step: .25, start: 2 };
/** Points per metre of dike raised above the minimum, and per home flooded. */
export const COST_PER_METRE = 150;
export const DAMAGE_PER_HOME = 10;
export const YEARS = 100;
export const HEIGHT_BUDGET = 1000;
/** Yearly highest storm: a Gumbel distribution, the classic model for yearly extremes. */
export const GUMBEL = { mu: 1.2, beta: .35 };
/** Storm heights for the fragility runs, relative to the crest. */
export const FRAGILITY_OFFSETS = [-.2, 0, .1, .2, .3, .45];

export function uniformDike(crest: number): (y: number) => DikeRow {
  const profile = dikeProfile(crest);
  return () => ({ profile, ...OLD_DIKE });
}
export function dikeCost(crest: number): number { return Math.round(COST_PER_METRE * (crest - HEIGHT.min)); }
export function gumbelSample(rng: () => number): number {
  return GUMBEL.mu - GUMBEL.beta * Math.log(-Math.log(Math.max(1e-12, rng())));
}
export function gumbelDensity(x: number): number {
  const z = (x - GUMBEL.mu) / GUMBEL.beta;
  return Math.exp(-z - Math.exp(-z)) / GUMBEL.beta;
}
/** Chance that a year's highest storm is higher than x. */
export function exceedance(x: number): number {
  return 1 - Math.exp(-Math.exp(-(x - GUMBEL.mu) / GUMBEL.beta));
}

/** Homes flooded as a function of storm height, measured at a few storm heights for
 * one dike crest and interpolated in between. Engineers call this a fragility curve. */
export class Fragility {
  constructor(readonly crest: number, readonly peaks: number[], readonly flooded: number[]) {}
  /** Homes flooded by a storm of height `peak`, for a dike of height `crest`
   * (shifted: a dike 0.5 m higher fails at storms 0.5 m higher). */
  at(peak: number, crest = this.crest): number {
    // Below the lowest measured storm the damage falls to nothing over 0.3 m.
    const p = peak - (crest - this.crest), ps = [this.peaks[0] - .3, ...this.peaks], fs = [0, ...this.flooded];
    if (p <= ps[0]) return 0;
    for (let k = 1; k < ps.length; k++) if (p <= ps[k]) {
      const u = (p - ps[k - 1]) / (ps[k] - ps[k - 1]);
      return fs[k - 1] + (fs[k] - fs[k - 1]) * u;
    }
    return fs[fs.length - 1];
  }
  /** Average flood damage in points over a century of Gumbel storms (numerical integral). */
  expectedDamage(crest = this.crest): number {
    let sum = 0;
    const lo = GUMBEL.mu - 3 * GUMBEL.beta, hi = GUMBEL.mu + 20 * GUMBEL.beta, n = 800, dx = (hi - lo) / n;
    for (let k = 0; k < n; k++) { const x = lo + (k + .5) * dx; sum += this.at(x, crest) * gumbelDensity(x) * dx; }
    return YEARS * DAMAGE_PER_HOME * sum;
  }
  /** The storm height from which half the homes flood, for a dike of height `crest`. */
  failureStorm(crest = this.crest): number {
    for (let x = 0; x < 8; x += .01) if (this.at(x, crest) >= HOMES.length / 2) return x;
    return Infinity;
  }
}

/** The fragility runs for a uniform dike: one full storm per storm height. */
export function* fragilityRun(crest: number, sliceSeconds = .5): Generator<{ run: number; progress: number; sim: FloodSim }, Fragility> {
  const dike = uniformDike(crest), terrain = makeScene(dike).terrain.slice();
  const peaks = FRAGILITY_OFFSETS.map(o => Math.max(.5, crest + o)), flooded: number[] = [];
  for (let k = 0; k < peaks.length; k++) {
    const run = stormRun(terrain, dike, peaks[k], sliceSeconds);
    for (;;) {
      const r = run.next();
      if (r.done) { flooded.push(countBits(r.value.flooded)); break; }
      yield { run: k, progress: r.value.progress, sim: r.value.sim };
    }
  }
  return new Fragility(crest, peaks, flooded);
}

/** One century of yearly storms and the homes each one floods. */
export function century(fragility: Fragility, rng: () => number): { peaks: number[]; flooded: number[] } {
  const peaks: number[] = [], flooded: number[] = [];
  for (let y = 0; y < YEARS; y++) {
    const p = gumbelSample(rng);
    peaks.push(p);
    flooded.push(Math.round(fragility.at(p)));
  }
  return { peaks, flooded };
}
export function heightScore(fragility: Fragility, crest = fragility.crest): number {
  return Math.max(0, Math.round(HEIGHT_BUDGET - dikeCost(crest) - fragility.expectedDamage(crest)));
}

// ---- Round 4: close the gate ----

/** A harbour channel through the dike, a basin behind low quays, and a gate. */
export const HARBOUR = { y0: 7, y1: 12, x1: 46, quay: .8, bed: -2.5 };
export const GATE = { x0: 21, x1: 23, shut: 3.4, seconds: 3 };
export const BARRIER_LENGTH = 62;
export const ENSEMBLE = 20;
export const SHIP_POINTS = 10;
export interface Threat { peak: number; time: number }
/** Three storm threats: one harmless, one that tops the quays, one big one. */
export function barrierThreats(rng: () => number): Threat[] {
  const peaks = [.5, 1.6, 2.6];
  for (let k = peaks.length - 1; k > 0; k--) { const j = Math.floor(rng() * (k + 1)); [peaks[k], peaks[j]] = [peaks[j], peaks[k]]; }
  return peaks.map((peak, k) => ({ peak, time: 16 + 18 * k }));
}
/** A short storm around its peak time: 5 s up, 5 s high, 5 s down. */
export function threatStrength(fromPeak: number): number {
  const u = Math.abs(fromPeak);
  if (u <= 2.5) return 1;
  if (u >= 7.5) return 0;
  return Math.sin(Math.PI / 2 * (7.5 - u) / 5) ** 2;
}
export function barrierSeaLevel(t: number, threats: readonly Threat[]): number {
  let surge = 0, strength = 0;
  for (const th of threats) { const s = threatStrength(t - th.time); surge += th.peak * s; strength = Math.max(strength, s); }
  return surge + (CALM_SEA + .3 * strength) * Math.sin(2 * Math.PI * t / 2.6);
}
/** Each forecast member is off by its own amount, which shrinks as the storm nears. */
export interface Member { z: number[]; d: number[] }
export function ensemble(rng: () => number, threats: number): Member[] {
  const normal = () => Math.sqrt(-2 * Math.log(Math.max(1e-12, rng()))) * Math.cos(2 * Math.PI * rng());
  return Array.from({ length: ENSEMBLE }, () => ({
    z: Array.from({ length: threats }, normal), d: Array.from({ length: threats }, normal),
  }));
}
/** Forecast uncertainty (m) of a storm's peak, `lead` displayed seconds ahead. */
export function forecastSpread(lead: number): number { return .1 + .07 * Math.max(0, lead); }
/** One member's forecast, made at `now`, of the surge at a later time `t`. */
export function forecastLevel(t: number, now: number, threats: readonly Threat[], m: Member): number {
  let level = 0;
  threats.forEach((th, k) => {
    const lead = Math.max(0, th.time - now);
    const peak = Math.max(0, th.peak + forecastSpread(lead) * m.z[k]);
    level += peak * threatStrength(t - (th.time + .15 * lead * m.d[k]));
  });
  return level;
}

export function harbourScene(): FloodSim {
  const channel = { profile: [HARBOUR.bed, HARBOUR.bed, HARBOUR.bed, HARBOUR.bed, HARBOUR.bed], critical: 99, rate: 0 };
  const strong = { profile: dikeProfile(3.2), critical: 2.5, rate: 2e-3 };
  const sim = makeScene(y => y >= HARBOUR.y0 && y <= HARBOUR.y1 ? channel : strong);
  const { floor, hardTop } = sim.erosion!;
  const set = (x: number, y: number, z: number) => { const i = y * W + x; sim.terrain[i] = floor[i] = hardTop[i] = z; };
  for (let x = 16; x <= HARBOUR.x1 + 2; x++) for (let y = HARBOUR.y0 - 2; y <= HARBOUR.y1 + 2; y++) {
    if (x >= DIKE_X[0] && x <= DIKE_X[1]) continue;
    const inChannel = y >= HARBOUR.y0 && y <= HARBOUR.y1 && x <= HARBOUR.x1;
    if (inChannel) set(x, y, HARBOUR.bed);
    else if (x > DIKE_X[1]) set(x, y, HARBOUR.quay);
  }
  fillHarbour(sim);
  return sim;
}
/** The harbour is open water at sea level (resetWater only knows sea and polder). */
export function fillHarbour(sim: FloodSim): void {
  for (let x = DIKE_X[0]; x <= HARBOUR.x1; x++) for (let y = HARBOUR.y0; y <= HARBOUR.y1; y++) {
    const i = y * W + x;
    sim.water[i] = Math.max(0, -sim.terrain[i]);
  }
}
/** Raise or lower the gate: 0 open, 1 shut. Water on the gate is pushed off the top. */
export function setGate(sim: FloodSim, shut: number): void {
  const z = HARBOUR.bed + (GATE.shut - HARBOUR.bed) * shut;
  for (let x = GATE.x0; x <= GATE.x1; x++) for (let y = HARBOUR.y0; y <= HARBOUR.y1; y++) {
    const i = y * W + x, surface = sim.terrain[i] + sim.water[i];
    sim.terrain[i] = sim.erosion!.floor[i] = sim.erosion!.hardTop[i] = z;
    sim.water[i] = Math.max(0, surface - z);
    if (!sim.water[i]) sim.mx[i] = sim.my[i] = 0;
  }
}
