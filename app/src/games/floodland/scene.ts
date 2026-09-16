import { FloodSim, GRID_W as W, GRID_H as H } from './water';
export const BUDGET = 210;
export const HOMES = [ [33,17], [38,17], [43,17], [34,23], [39,23], [44,23], [49,20], [49,26] ] as const;
export const STORM_DURATION = 42;
export function surge(t: number): number {
  return t < 12 ? 2.2 * t / 12 : t < 25 ? 2.2 : 2.2 * Math.max(0, (STORM_DURATION - t) / 17);
}
export function makeScene(): FloodSim {
  const s = new FloodSim();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let z = x < 16 ? -2.5 : x < 20 ? -2.5 + (x - 15) * 0.6 : -0.65;
    if (x >= 20 && x <= 24) z = [0.6, 1.8, 2.6, 1.8, 0.6][x - 20];
    // One conspicuous opening. Existing crest holds the prescribed storm.
    if (y >= 17 && y <= 22 && x >= 16 && x <= 27) z = -0.8;
    if (x > 54) z = -0.65 + (x - 54) * 0.42;
    s.terrain[y * W + x] = z;
  }
  resetWater(s);
  return s;
}
export function resetWater(s: FloodSim): void {
  s.water.fill(0); s.mx.fill(0); s.my.fill(0);
  s.boundaryVolume = 0; s.seaLevel = 0;
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
        if (HOMES.some(([hx, hy]) => Math.hypot(x - hx, y - hy) < 1.8)) continue;
        const i = y * W + x;
        plan.set(i, Math.max(0, crest - s.terrain[i]));
      }
    }
  }
  return plan;
}
