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
