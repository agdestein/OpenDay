import { FloodSim, GRID_W as W, GRID_H as H } from './water';
export const BUDGET = 210;
export const HOMES = [ [33,17], [38,17], [43,17], [34,23], [39,23], [44,23], [49,20], [49,26] ] as const;
export const STORM_DURATION = 42;
export type Scenario = 'surge' | 'waves';
export const RECOVERY_DURATION = 60;
export const PUMP = { x: 51, y: 30, outletX: 7, outletY: 30, capacity: 35 };
export const INTAKES = [29,30,31].flatMap(y => [50,51,52].map(x => y * W + x));
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
export function setRecoveryGate(sim: FloodSim, time: number, scenario: Scenario): void {
  sim.gates.fill(0);
  // A visible emergency gate isolates the breached polder before pumping.
  // It changes fluxes, not terrain or water volume.
  if (scenario === 'surge' && time >= STORM_DURATION) {
    for (let y = 17; y <= 22; y++) sim.gates[y * W + 23] = 1;
  }
}
export function surge(t: number): number {
  return t < 12 ? 2.2 * t / 12 : t < 25 ? 2.2 : 2.2 * Math.max(0, (STORM_DURATION - t) / 17);
}
export function makeScene(scenario: Scenario = 'surge'): FloodSim {
  const s = new FloodSim();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let z = x < 16 ? -2.5 : x < 20 ? -2.5 + (x - 15) * 0.6 : -0.65;
    if (x >= 20 && x <= 24) z = [0.6, 1.8, 2.6, 1.8, 0.6][x - 20];
    // One conspicuous opening. Existing crest holds the prescribed storm.
    if (y >= 17 && y <= 22 && x >= 16 && x <= 27) z = -0.8;
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
  for (const i of INTAKES) s.terrain[i] = -1.35;
  resetWater(s);
  return s;
}
export function resetWater(s: FloodSim): void {
  s.water.fill(0); s.mx.fill(0); s.my.fill(0);
  s.boundaryVolume = 0; s.seaLevel = 0; s.gates.fill(0); s.pumpConfig = null; s.pumpedVolume = 0;
  // Deliberately dry polder: this is the repeatable start, before the breach fills.
  for (let y = 0; y < H; y++) for (let x = 0; x < 20; x++) s.water[y * W + x] = Math.max(0, -s.terrain[y * W + x]);
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
        if (INTAKES.includes(y * W + x)) continue;
        if (HOMES.some(([hx, hy]) => Math.hypot(x - hx, y - hy) < 1.8)) continue;
        const i = y * W + x;
        plan.set(i, Math.max(0, crest - s.terrain[i]));
      }
    }
  }
  return plan;
}
