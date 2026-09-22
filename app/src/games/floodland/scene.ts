import { FloodSim, GRID_W as W, GRID_H as H } from './water';
export const BUDGET = 210;
export const HOMES = [ [33,17], [38,17], [43,17], [34,23], [39,23], [44,23], [49,20], [49,26] ] as const;
export const STORM_DURATION = 42;
export type Scenario = 'surge' | 'waves';
export const RECOVERY_DURATION = 60;
export const PUMP = { x: 51, y: 30, outletX: 7, outletY: 30, capacity: 35, targetLevel: -.95 };
export const INTAKES = [30,31,32].flatMap(y => [50,51,52].map(x => y * W + x));
export const POOL = Array.from({length:6},(_,y)=>y+29).flatMap(y=>Array.from({length:7},(_,x)=>(y*W)+x+48));
export const BACKGROUND_INFLOW = .3; // m³/s, a small ongoing drainage/seepage supply
export function stormDuration(scenario: Scenario): number { return scenario === 'waves' ? 62 : STORM_DURATION; }
export function totalDuration(scenario: Scenario): number { return stormDuration(scenario) + RECOVERY_DURATION; }
export function scenarioBudget(scenario: Scenario): number { return scenario === 'waves' ? 85 : BUDGET; }
export function seaLevelAt(time: number, scenario: Scenario): number {
  if (scenario === 'surge') return surge(time);
  // Three smooth, finite-duration long-wave pulses; the mean sea returns to zero.
  let level = 0;
  for (const start of [0,17,34]) {
    const phase = (time - start) / 10;
    if (phase > 0 && phase < 1) level += 1.8 * Math.sin(Math.PI * phase) ** 2;
  }
  return level;
}
export function physicalRate(time: number, scenario: Scenario): number {
  return time >= stormDuration(scenario) ? 120 : scenario === 'waves' ? 4 : 24;
}
export function surge(t: number): number {
  return t < 12 ? 2.2 * t / 12 : t < 25 ? 2.2 : 2.2 * Math.max(0, (STORM_DURATION - t) / 17);
}
export function makeScene(scenario: Scenario = 'surge'): FloodSim {
  const s = new FloodSim();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let z = x < 16 ? -2.5 : x < 20 ? -2.5 + (x - 15) * 0.6 : -0.65;
    if (x >= 20 && x <= 24) z = [0.6, 1.8, 2.6, 1.8, 0.6][x - 20];
    // A low, permanent sill is dry at normal sea level but overtops in a surge.
    if (y >= 17 && y <= 22 && x >= 20 && x <= 24) z = [.25,.45,.7,.45,.25][x-20];
    if (x > 54) z = -0.65 + (x - 54) * 0.42;
    s.terrain[y * W + x] = z;
  }
  if (scenario === 'waves') {
    s.friction = .002; s.waveBoundary = true;
    for (let y = 0; y < H; y++) for (let x = 16; x <= 27; x++) {
      const low = y >= 12 && y <= 27;
      if (x >= 20 && x <= 24) s.terrain[y * W + x] = (low ? [.4,.8,1.2,.8,.4] : [.8,2.2,3.4,2.2,.8])[x-20];
      else s.terrain[y * W + x] = x < 20 ? -2.5 + (x - 15) * .6 : -.65;
    }
  }
  // Drainage canal and intake basin, connected to the low-lying fields.
  for (let x = 27; x <= 52; x++) s.terrain[30 * W + x] = -1.15;
  for (const i of POOL) s.terrain[i] = -1.45;
  for (const i of INTAKES) s.terrain[i] = -1.65;
  resetWater(s);
  return s;
}
export function resetWater(s: FloodSim): void {
  s.water.fill(0); s.mx.fill(0); s.my.fill(0);
  s.boundaryVolume = 0; s.seaLevel = 0; s.pumpedVolume = 0; s.sourceVolume = 0;
  s.pumpConfig = { intakes: INTAKES, outlet: PUMP.outletY * W + PUMP.outletX, capacity: PUMP.capacity, minLevel: PUMP.targetLevel };
  s.sourceConfig = { cells: [30 * W + 48], rate: BACKGROUND_INFLOW };
  // The sea and internal drainage water are separated by permanent defenses.
  for (let y = 0; y < H; y++) for (let x = 0; x < 20; x++) s.water[y * W + x] = Math.max(0, -s.terrain[y * W + x]);
  for (let y = 0; y < H; y++) for (let x = 25; x < W; x++) {
    const i = y * W + x;
    s.water[i] = Math.max(0, -.9 - s.terrain[i]);
  }
}
export type Point = { x: number; y: number };
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
        if (POOL.includes(y * W + x)) continue;
        if (HOMES.some(([hx, hy]) => Math.hypot(x - hx, y - hy) < 1.8)) continue;
        const i = y * W + x;
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
