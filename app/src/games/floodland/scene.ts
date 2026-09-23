import { FloodSim, GRID_W as W, GRID_H as H } from './water';
export const HOMES = [ [33,17], [38,17], [43,17], [34,23], [39,23], [44,23], [49,20], [49,26] ] as const;
/** A home counts as flooded once the water inside is deeper than this (m). */
export const HOME_FLOOD_DEPTH = .3;
export const PUMP = { x: 51, y: 30, outletX: 7, outletY: 30, capacity: 35, targetLevel: -.95 };
export const INTAKES = [30,31,32].flatMap(y => [50,51,52].map(x => y * W + x));
export const POOL = Array.from({length:6},(_,y)=>y+29).flatMap(y=>Array.from({length:7},(_,x)=>(y*W)+x+48));
/** The old coastal dike occupies these columns; the pointer snaps to its crest. */
export const DIKE_X = [20, 24] as const;
/** Low places in the old dike: a sill at the harbour and a road over the dike. */
export const SILL = { y0: 17, y1: 22, profile: [.3, .5, .8, .5, .3] };
export const ROAD = { y0: 6, y1: 8, profile: [.6, 1.4, 1.9, 1.4, .6] };
const DIKE = [1, 2.4, 3.2, 2.4, 1];
const POLDER = -.65;
/** Erosion: fresh sand is loose, the old dike is clay with grass, the road is weak. */
const SAND = { critical: 1.1, rate: 8e-3 };
const OLD_DIKE = { critical: 1.5, rate: 3e-3 };
const WEAK = { critical: 1.1, rate: 8e-3 };

/** Physical seconds per displayed second: a storm of ~20 minutes plays in ~40 s. */
export const TIME_SCALE = 24;
export const BUDGET = 150;

/** The storm, in displayed seconds from its start: rise, hold, fall. */
export const STORM = { rise: 10, hold: 14, fall: 10, peak: 2.5, waves: .4 };
export const STORM_LENGTH = STORM.rise + STORM.hold + STORM.fall;
/** Challenge: a short warning before the storm, and a calm moment after it. */
export const ROUND = { warning: 5, calm: 4 };
export const ROUND_LENGTH = ROUND.warning + STORM_LENGTH + ROUND.calm;

/** The calm swell's highest level: a breach cut below it never stops leaking. */
export const CALM_SEA = .1;

/** Storm strength between 0 and 1, with smooth ramps. */
export function stormStrength(t: number): number {
  const ramp = (u: number) => Math.sin(Math.PI / 2 * Math.min(1, Math.max(0, u))) ** 2;
  if (t <= 0 || t >= STORM_LENGTH) return 0;
  if (t < STORM.rise) return ramp(t / STORM.rise);
  if (t < STORM.rise + STORM.hold) return 1;
  return ramp((STORM_LENGTH - t) / STORM.fall);
}
/** Sea level at the open boundary: a gentle swell, plus the surge and bigger waves
 * of a storm that started at `stormStart` (displayed seconds), if any. */
export function seaLevelAt(t: number, stormStart: number | null): number {
  const s = stormStart === null ? 0 : stormStrength(t - stormStart);
  return STORM.peak * s + (CALM_SEA + (STORM.waves - CALM_SEA) * s) * Math.sin(2 * Math.PI * t / 2.6);
}

export function makeScene(): FloodSim {
  const s = new FloodSim();
  s.waveBoundary = true;
  const floor = new Float64Array(W * H), hardTop = new Float64Array(W * H);
  const critical = new Float32Array(W * H).fill(OLD_DIKE.critical), rate = new Float32Array(W * H).fill(OLD_DIKE.rate);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let z = x < 16 ? -2.5 : x < 20 ? -2.5 + (x - 15) * 0.6 : POLDER;
    floor[i] = z;
    if (x >= DIKE_X[0] && x <= DIKE_X[1]) {
      const k = x - DIKE_X[0];
      const road = y >= ROAD.y0 && y <= ROAD.y1;
      z = y >= SILL.y0 && y <= SILL.y1 ? SILL.profile[k] : road ? ROAD.profile[k] : DIKE[k];
      floor[i] = POLDER;
      if (road) { critical[i] = WEAK.critical; rate[i] = WEAK.rate; }
    }
    if (x > 54) z = floor[i] = POLDER + (x - 54) * 0.42;
    s.terrain[i] = z;
  }
  // Drainage canal and intake basin, connected to the low-lying fields.
  for (let x = 27; x <= 52; x++) s.terrain[30 * W + x] = floor[30 * W + x] = -1.15;
  for (const i of POOL) s.terrain[i] = floor[i] = -1.45;
  for (const i of INTAKES) s.terrain[i] = floor[i] = -1.65;
  hardTop.set(s.terrain);
  s.erosion = { floor, hardTop, sand: SAND, critical, rate, slump: { height: 1, rate: .01 } };
  resetWater(s);
  return s;
}
export function resetWater(s: FloodSim): void {
  s.water.fill(0); s.mx.fill(0); s.my.fill(0);
  s.boundaryVolume = 0; s.seaLevel = 0; s.pumpedVolume = 0;
  s.pumpConfig = { intakes: INTAKES, outlet: PUMP.outletY * W + PUMP.outletX, capacity: PUMP.capacity, minLevel: PUMP.targetLevel };
  // The sea and internal drainage water are separated by permanent defenses.
  for (let y = 0; y < H; y++) for (let x = 0; x < DIKE_X[0]; x++) s.water[y * W + x] = Math.max(0, -s.terrain[y * W + x]);
  for (let y = 0; y < H; y++) for (let x = DIKE_X[1] + 1; x < W; x++) {
    const i = y * W + x;
    s.water[i] = Math.max(0, -.9 - s.terrain[i]);
  }
}

/** Homes with more than HOME_FLOOD_DEPTH of water, as a bit mask. */
export function floodedHomes(s: FloodSim): number {
  let mask = 0;
  HOMES.forEach(([x, y], k) => { if (s.water[y * W + x] > HOME_FLOOD_DEPTH) mask |= 1 << k; });
  return mask;
}
export function countBits(mask: number): number { let n = 0; for (; mask; mask &= mask - 1) n++; return n; }

/** The lowest sea level that can reach a home: over every path from the sea, the
 * highest ground crossed, minimised (a priority flood). This is the height the
 * defenses hold to, wherever the player built them. */
export function spillLevel(terrain: Float64Array): number {
  return Math.min(...homeSpillLevels(terrain));
}
/** The same, per home. */
export function homeSpillLevels(terrain: Float64Array): number[] {
  const level = new Float64Array(W * H).fill(Infinity);
  const heap: number[] = [];
  const push = (i: number, v: number) => {
    if (v >= level[i]) return;
    level[i] = v; heap.push(i);
    for (let k = heap.length - 1; k > 0;) {
      const p = (k - 1) >> 1;
      if (level[heap[p]] <= level[heap[k]]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]]; k = p;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let k = 0; ;) {
        const a = 2 * k + 1, b = a + 1;
        let m = k;
        if (a < heap.length && level[heap[a]] < level[heap[m]]) m = a;
        if (b < heap.length && level[heap[b]] < level[heap[m]]) m = b;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]]; k = m;
      }
    }
    return top;
  };
  const done = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) push(y * W, terrain[y * W]);
  while (heap.length) {
    const i = pop();
    if (done[i]) continue;
    done[i] = 1;
    const x = i % W, y = (i - x) / W;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const j = ny * W + nx;
      if (!done[j]) push(j, Math.max(level[i], terrain[j]));
    }
  }
  return HOMES.map(([x, y]) => level[y * W + x]);
}

export type Point = { x: number; y: number };
const PROTECTED = new Uint8Array(W * H);
for (const i of POOL) PROTECTED[i] = 1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (HOMES.some(([hx, hy]) => Math.hypot(x - hx, y - hy) < 1.8)) PROTECTED[y * W + x] = 1;
}
/** Continuous, fixed-width footprint, independent of pointer-event frequency. */
export function dikePlan(s: FloodSim, points: Point[], crest: number): Map<number, number> {
  const plan = new Map<number, number>();
  for (let k = 0; k < points.length; k++) {
    const a = points[Math.max(0, k - 1)], b = points[k];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 3));
    for (let t = 0; t <= n; t++) {
      const px = a.x + (b.x - a.x) * t / n, py = a.y + (b.y - a.y) * t / n;
      for (let y = Math.floor(py - 1.2); y <= Math.ceil(py + 1.2); y++) for (let x = Math.floor(px - 1.2); x <= Math.ceil(px + 1.2); x++) {
        if (x < 16 || x >= W - 2 || y < 1 || y >= H - 1 || Math.hypot(x + .5 - px, y + .5 - py) > 1.2) continue;
        const i = y * W + x;
        if (PROTECTED[i]) continue;
        plan.set(i, Math.max(0, crest - s.terrain[i]));
      }
    }
  }
  return plan;
}

export const SAND_RATE = 1.4; // metres per second of holding, independent of frame rate
export const MAX_CREST = 4;
/** Preview/apply a small layer rather than jumping straight to a preset height. */
export function sandPlan(sim: FloodSim, points: Point[], rise: number): Map<number, number> {
  const plan = dikePlan(sim, points, MAX_CREST);
  for (const [i, room] of plan) plan.set(i, Math.min(room, Math.max(0, rise)));
  return plan;
}
export function placeSand(sim: FloodSim, points: Point[], rise: number, budget: number): number {
  const plan = sandPlan(sim, points, rise);
  const wanted = [...plan.values()].reduce((sum, value) => sum + value, 0);
  const fraction = wanted > 0 ? Math.min(1, Math.max(0, budget) / wanted) : 0;
  for (const [i, amount] of plan) sim.terrain[i] += amount * fraction;
  return wanted * fraction;
}
