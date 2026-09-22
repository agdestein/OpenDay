// The three challenge cases: how each builds its hidden map, its stations,
// its score and the computer's way of playing it. Pure logic, no drawing, so
// tests/detective.test.ts can play the cases headless.
import { GP, type GpOptions, type Hyper, type Obs } from './gp';
import { HYPER, gauss, halfCell, onLand, rng, sampleHalf, world, type DayId } from './world';

export type Kind = 'official' | 'home';

export interface Station extends Obs {
  kind: Kind;
  /** A broken home station that reads far too warm (case 3). */
  liar: boolean;
  /** Accused: drawn grey, left out of the model. */
  ignored: boolean;
}

export type CaseId = 'hottest' | 'map' | 'liars';

export interface CaseDef {
  id: CaseId;
  day: DayId;
  emoji: string;
}

export const CASES: CaseDef[] = [
  { id: 'hottest', day: 'heatwave', emoji: '🔥' },
  { id: 'map', day: 'newyear', emoji: '📺' },
  { id: 'liars', day: 'frost', emoji: '🕵️' },
];

/** Case 1: thermometers to find the hottest place with. */
export const HOTTEST_THERMOMETERS = 8;
/** Case 1: extra heat of the hidden heat dome, and the gap (°C) that scores zero. */
export const DOME_HEAT = 5;
export const DOME_RADIUS = 22;
export const HOTTEST_SCALE = 3;
/** Case 2: thermometers for the weather map. */
export const MAP_THERMOMETERS = 6;
/** Case 3. */
export const LIAR_HOMES = 60;
export const LIAR_OFFICIALS = 3;
export const LIARS = 6;
export const ACCUSATIONS = 8;
/** How much too warm a lying station reads, at least (plus up to 2.5 °C more). */
export const LIAR_HEAT = 2.5;

/** Home stations read warm (sun on the wall, close to the house) and wobble. */
const HOME_BIAS = 1.5;
const HOME_BIAS_SPREAD = 0.4;
const HOME_NOISE = 0.5;

export function covariates(x: number, y: number): { u: number; w: number } {
  const { half } = world();
  const k = halfCell(x, y);
  return { u: half.u[k], w: half.w[k] };
}

export function makeStation(truth: Float32Array, x: number, y: number, kind: Kind, r: () => number, liar = false): Station {
  const { u, w } = covariates(x, y);
  let value = sampleHalf(truth, x, y);
  if (kind === 'home') value += HOME_BIAS + HOME_BIAS_SPREAD * gauss(r) + HOME_NOISE * gauss(r);
  else value += 0.1 * gauss(r);
  if (liar) value += LIAR_HEAT + 2.5 * r();
  return { x, y, value, u, w, home: kind === 'home', kind, liar, ignored: false };
}

/** The stations the model listens to. */
export function listened(stations: Station[]): Station[] {
  return stations.filter((s) => !s.ignored);
}

/** A random land point, weighted towards towns when `towns` (where people live). */
export function randomLand(r: () => number, towns = false): { x: number; y: number } {
  const { half } = world();
  for (let tries = 0; tries < 10000; tries++) {
    const k = Math.floor(r() * half.n);
    if (!half.land[k]) continue;
    if (towns && r() > 0.08 + half.u[k]) continue;
    const x = half.x[k] + (r() - 0.5) * half.dx;
    const y = half.y[k] + (r() - 0.5) * half.dy;
    if (onLand(x, y)) return { x, y };
  }
  return { x: half.x[0], y: half.y[0] };
}

// ---------------------------------------------------------------------------
// Hidden maps

export interface Dome {
  x: number;
  y: number;
}

/**
 * The hidden map of a case. Hottest: the real heatwave plus a seeded heat
 * dome somewhere inland, so the answer moves every game. Liars: the frosty
 * morning with a stronger urban heat island (cities stay warmer on cold
 * mornings), so honest city stations are warm for a reason.
 */
export function caseTruth(def: CaseDef, seed: number): { truth: Float32Array; dome?: Dome } {
  const { half, days } = world();
  const truth = days[def.day].t.slice();
  if (def.id === 'hottest') {
    // A smoother, flatter heatwave (city speckle blurred away, contrasts
    // halved) so the hidden dome is a hill you can climb, not one lucky street.
    blurLand(truth, 5);
    const { mean } = landStats(truth);
    for (let k = 0; k < half.n; k++) if (!Number.isNaN(truth[k])) truth[k] = mean + 0.5 * (truth[k] - mean);
    const r = rng(seed * 7 + 1);
    // Somewhere inland: the most inland of a few random tries. (The land mask
    // cuts out rivers and lakes, so nowhere is very far from "coast".)
    let dome: Dome = randomLand(r);
    let best = -1;
    for (let tries = 0; tries < 30; tries++) {
      const p = randomLand(r);
      const d = half.w[halfCell(p.x, p.y)] < 0.25 ? coastDistance(p.x, p.y) : 0;
      if (d > best) {
        best = d;
        dome = p;
      }
    }
    const R = DOME_RADIUS;
    for (let k = 0; k < half.n; k++) {
      if (Number.isNaN(truth[k])) continue;
      const dx = half.x[k] - dome.x, dy = half.y[k] - dome.y;
      truth[k] += DOME_HEAT * Math.exp(-(dx * dx + dy * dy) / (2 * R * R));
    }
    return { truth, dome };
  }
  if (def.id === 'liars') {
    for (let k = 0; k < half.n; k++) if (!Number.isNaN(truth[k])) truth[k] += 1.5 * half.u[k];
  }
  return { truth };
}

/** Box blur over land cells only (radius in half cells), in place. */
function blurLand(field: Float32Array, radius: number): void {
  const { half } = world();
  const src = field.slice();
  for (let j = 0; j < half.ny; j++)
    for (let i = 0; i < half.nx; i++) {
      const k = j * half.nx + i;
      if (Number.isNaN(src[k])) continue;
      let s = 0, n = 0;
      for (let dj = -radius; dj <= radius; dj++)
        for (let di = -radius; di <= radius; di++) {
          const a = i + di, b = j + dj;
          if (a < 0 || b < 0 || a >= half.nx || b >= half.ny) continue;
          const v = src[b * half.nx + a];
          if (!Number.isNaN(v)) {
            s += v;
            n++;
          }
        }
      field[k] = s / n;
    }
}

/** Rough distance (km) to the nearest non-land half cell. */
function coastDistance(x: number, y: number): number {
  const { half } = world();
  const i0 = Math.floor(x / half.dx), j0 = Math.floor(y / half.dy);
  let best = Infinity;
  const R = 25;
  for (let dj = -R; dj <= R; dj++)
    for (let di = -R; di <= R; di++) {
      const i = i0 + di, j = j0 + dj;
      const outside = i < 0 || j < 0 || i >= half.nx || j >= half.ny;
      if (outside || !half.land[j * half.nx + i]) best = Math.min(best, Math.hypot(di * half.dx, dj * half.dy));
    }
  return best;
}

export function landStats(truth: Float32Array): { max: number; maxAt: number; min: number; mean: number } {
  let max = -Infinity, min = Infinity, maxAt = 0, sum = 0, n = 0;
  for (let k = 0; k < truth.length; k++) {
    const t = truth[k];
    if (Number.isNaN(t)) continue;
    if (t > max) {
      max = t;
      maxAt = k;
    }
    min = Math.min(min, t);
    sum += t;
    n++;
  }
  return { max, maxAt, min, mean: sum / n };
}

/**
 * Model settings per case. The hottest-place map is the heatwave with a
 * dome on top and less city speckle, so its model expects a shorter reach
 * and weaker city heat.
 */
export function caseHyper(def: CaseDef): Hyper {
  if (def.id === 'hottest') return { ...HYPER.heatwave, au: 1, aw: 1.5, theta: 2.5, ell: 35 };
  return HYPER[def.day];
}

/**
 * Map knowledge (city and water slopes) only pays off with a dozen or more
 * stations; with six it mostly adds guesswork, so case 2 goes without.
 */
export function caseOptions(def: CaseDef): GpOptions {
  return { map: def.id !== 'map', bias: true };
}

export function newGP(def: CaseDef): GP {
  const { half, coarse } = world();
  return new GP(caseHyper(def), [half, coarse], caseOptions(def));
}

/** Candidate spots for the computer: coarse cell centres on land, with their own covariates. */
function candidates(): { x: number; y: number; u: number; w: number }[] {
  const { coarse } = world();
  const out = [];
  for (let k = 0; k < coarse.n; k++) {
    if (!coarse.land[k] || !onLand(coarse.x[k], coarse.y[k])) continue;
    out.push({ x: coarse.x[k], y: coarse.y[k], ...covariates(coarse.x[k], coarse.y[k]) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Case 1: the hottest place

/** Points for the hottest reading, compared with the true hottest place. */
export function hottestPoints(truth: Float32Array, stations: Station[]): { points: number; best: number; max: number } {
  const { max } = landStats(truth);
  let best = -Infinity;
  for (const s of stations) best = Math.max(best, sampleHalf(truth, s.x, s.y));
  const gap = max - best;
  return { points: Math.round(100 * Math.max(0, Math.min(1, 1 - gap / HOTTEST_SCALE))), best, max };
}

/**
 * The computer's play: Bayesian optimisation. Each thermometer goes where
 * "best guess + spread" is highest: warm-looking places, or places
 * nobody knows yet.
 */
export function computerHottest(def: CaseDef, truth: Float32Array, seed: number): Station[] {
  const gp = new GP(caseHyper(def), []);
  const r = rng(seed * 13 + 5);
  const spots = candidates();
  const stations: Station[] = [];
  for (let n = 0; n < HOTTEST_THERMOMETERS; n++) {
    gp.setObs(stations);
    let best = -Infinity, at = spots[0];
    for (const c of spots) {
      const p = gp.predict(c.x, c.y, c.u, c.w);
      const score = p.mean + UCB_KAPPA * p.sd;
      if (score > best) {
        best = score;
        at = c;
      }
    }
    stations.push(makeStation(truth, at.x, at.y, 'official', r));
  }
  return stations;
}

/** How much the computer's hunt favours "nobody knows" over "looks warm". */
export const UCB_KAPPA = 1;

// ---------------------------------------------------------------------------
// Case 2: the weather map

/** Mean absolute error of a map over land, and of a flat guess (the day's average). */
export function mapError(truth: Float32Array, guess: Float32Array): { mae: number; flat: number } {
  const { mean } = landStats(truth);
  let e = 0, f = 0, n = 0;
  for (let k = 0; k < truth.length; k++) {
    if (Number.isNaN(truth[k])) continue;
    e += Math.abs(guess[k] - truth[k]);
    f += Math.abs(mean - truth[k]);
    n++;
  }
  return { mae: e / n, flat: f / n };
}

/**
 * Points from the error relative to the day's own contrast (the error of a
 * flat map at the true average): no error is 100, 1.6× the flat error is 0.
 * Generous on purpose, so every honest map scores something.
 */
export function mapPoints(mae: number, flat: number): number {
  return Math.round(100 * Math.max(0, Math.min(1, 1 - mae / flat / 1.6)));
}

export function mapGuess(gp: GP): Float32Array {
  const out = new Float32Array(world().half.n);
  gp.meanGrid(0, out);
  return out;
}

/**
 * The computer's play: each thermometer where the map is least sure (greedy
 * maximum-variance design: it looks at the fog, never at the readings).
 */
export function computerMap(def: CaseDef, truth: Float32Array, seed: number): Station[] {
  // Placement ignores the map knowledge: pure "fill the emptiest spot".
  const gp = new GP(caseHyper(def), [], { map: false, bias: true });
  const r = rng(seed * 17 + 3);
  const spots = candidates();
  const stations: Station[] = [];
  for (let n = 0; n < MAP_THERMOMETERS; n++) {
    gp.setObs(stations);
    let best = -Infinity, at = spots[0];
    for (const c of spots) {
      const sd = gp.predict(c.x, c.y, c.u, c.w).sd;
      if (sd > best) {
        best = sd;
        at = c;
      }
    }
    stations.push(makeStation(truth, at.x, at.y, 'official', r));
  }
  return stations;
}

// ---------------------------------------------------------------------------
// Case 3: the lying stations

export function liarStations(truth: Float32Array, seed: number): Station[] {
  const r = rng(seed * 31 + 11);
  const stations: Station[] = [];
  for (let i = 0; i < LIAR_OFFICIALS; i++) {
    const p = randomLand(r);
    stations.push(makeStation(truth, p.x, p.y, 'official', r));
  }
  const liarAt = new Set<number>();
  while (liarAt.size < LIARS) liarAt.add(Math.floor(r() * LIAR_HOMES));
  for (let i = 0; i < LIAR_HOMES; i++) {
    const p = randomLand(r, true);
    stations.push(makeStation(truth, p.x, p.y, 'home', r, liarAt.has(i)));
  }
  return stations;
}

export function liarPoints(stations: Station[]): { points: number; caught: number; wrong: number } {
  let caught = 0, wrong = 0;
  for (const s of stations) {
    if (!s.ignored) continue;
    if (s.liar) caught++;
    else wrong++;
  }
  return { points: Math.round(Math.max(0, Math.min(100, (100 * caught) / LIARS - 12 * wrong))), caught, wrong };
}

/**
 * The computer's play: accuse, one at a time, the station that disagrees most
 * with what all the others predict for it (leave-one-out check), refitting
 * after each accusation, until nobody is more than 3 spreads off.
 */
export function computerLiars(def: CaseDef, stations: Station[]): Station[] {
  const copy = stations.map((s) => ({ ...s, ignored: false }));
  const gp = new GP(caseHyper(def), []);
  for (let n = 0; n < ACCUSATIONS; n++) {
    const live = copy.filter((s) => !s.ignored);
    gp.setObs(live);
    const { z } = gp.loo();
    let worst = 0, at = -1;
    for (let i = 0; i < live.length; i++)
      if (live[i].home && z[i] > worst) {
        worst = z[i];
        at = i;
      }
    if (at < 0 || worst < 3) break;
    live[at].ignored = true;
  }
  return copy;
}
