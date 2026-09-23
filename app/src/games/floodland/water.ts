/** First-order finite volumes: hydrostatic reconstruction + Rusanov flux.
 * Bed-source corrections preserve lake-at-rest; a CFL step handles wet/dry fronts.
 * Units: metres, seconds. Sea forcing exists only at the western boundary.
 */
export const GRID_W = 64;
export const GRID_H = 40;
export const DX = 10;
const G = 9.81;
const EPS = 1e-7;

/** How the ground wears away under fast water. Two layers per cell: loose sand
 * above `hardTop`, the old ground below it (with its own resistance per cell),
 * and nothing erodes below `floor`.
 * Rate: dz/dt = rate · (speed − critical)², the usual excess-velocity form. */
export interface Erosion {
  floor: Float64Array;
  hardTop: Float64Array;
  sand: { critical: number; rate: number };
  critical: Float32Array;
  rate: Float32Array;
  /** An undercut wall collapses: a wet cell standing more than `height` above an
   * eroding neighbour slumps towards it at `rate` (m/s). */
  slump: { height: number; rate: number };
}

export class FloodSim {
  readonly terrain: Float64Array;
  readonly water: Float64Array;
  readonly mx: Float64Array;
  readonly my: Float64Array;
  /** Ground lost per physical second in the latest step (m/s); drawn as a warning. */
  readonly wear: Float32Array;
  friction = 0.018;
  /** Open sea boundary: the incoming characteristic is that of water at rest at
   * `seaLevel`, so the sea settles at that level while reflected waves leave. */
  waveBoundary = false;
  private dh: Float64Array;
  private du: Float64Array;
  private dv: Float64Array;
  seaLevel = 0;
  ocean = true;
  boundaryVolume = 0;
  pumpedVolume = 0;
  pumpConfig: { intakes: readonly number[]; outlet: number; capacity: number; minLevel?: number } | null = null;
  erosion: Erosion | null = null;
  /** Time steps taken so far (the explainer counts them). */
  steps = 0;
  constructor(readonly width = GRID_W, readonly height = GRID_H) {
    const n = width * height;
    this.terrain = new Float64Array(n);
    this.water = new Float64Array(n);
    this.mx = new Float64Array(n);
    this.my = new Float64Array(n);
    this.wear = new Float32Array(n);
    this.dh = new Float64Array(n);
    this.du = new Float64Array(n);
    this.dv = new Float64Array(n);
  }
  volume(): number { return this.water.reduce((a, b) => a + b, 0) * DX * DX; }
  /** A pump transfers only available intake water to an explicit outlet.
   * Momentum leaves with extracted water; outlet water is mixed at rest.
   * Return transferred volume (m³), bounded by capacity × elapsed time.
   */
  pump(intakes: readonly number[], outlet: number, capacity: number, dt: number, minLevel = -Infinity): number {
    const removable = (i: number) => Math.max(0, this.water[i] - Math.max(0, minLevel - this.terrain[i]));
    const available = intakes.reduce((sum, i) => sum + removable(i), 0);
    if (available <= 0) return 0;
    const volume = Math.min(available * DX * DX, capacity * dt);
    const fraction = volume / (available * DX * DX);
    for (const i of intakes) {
      const removed = removable(i) * fraction;
      const retained = this.water[i] > 0 ? 1 - removed / this.water[i] : 0;
      this.water[i] -= removed;
      this.mx[i] *= retained;
      this.my[i] *= retained;
    }
    this.water[outlet] += volume / (DX * DX);
    return volume;
  }
  /** Drop a smooth bump of water where there already is some; it spreads as a ring. */
  splash(cx: number, cy: number, height: number, radius: number): void {
    const reach = Math.ceil(radius * 2.5);
    for (let y = Math.max(0, Math.floor(cy) - reach); y <= Math.min(this.height - 1, Math.floor(cy) + reach); y++) {
      for (let x = Math.max(0, Math.floor(cx) - reach); x <= Math.min(this.width - 1, Math.floor(cx) + reach); x++) {
        const i = y * this.width + x;
        if (this.water[i] < .05) continue;
        const d2 = ((x + .5 - cx) ** 2 + (y + .5 - cy) ** 2) / (radius * radius);
        this.water[i] += height * Math.exp(-d2);
      }
    }
  }
  /** Advance the requested physical duration using stable substeps. */
  advance(duration: number): void {
    this.wear.fill(0);
    while (duration > 1e-9) {
      let speed = 0.1;
      for (let i = 0; i < this.water.length; i++) {
        const h = this.water[i];
        if (h > EPS) speed = Math.max(speed, Math.abs(this.mx[i] / h) + Math.abs(this.my[i] / h) + 2 * Math.sqrt(G * h));
      }
      const dt = Math.min(duration, 0.38 * DX / speed);
      this.step(dt);
      this.steps++;
      if (this.erosion) this.erode(dt);
      if (this.pumpConfig) {
        const { intakes, outlet, capacity, minLevel } = this.pumpConfig;
        this.pumpedVolume += this.pump(intakes, outlet, capacity, dt, minLevel);
      }
      duration -= dt;
    }
  }
  /** Lower the bed where water runs fast over erodible ground. The depth is kept,
   * so the water surface drops with the bed and volume is conserved. */
  private erode(dt: number): void {
    const { floor, hardTop, sand, critical: oldCritical, rate: oldRate } = this.erosion!;
    for (let i = 0; i < this.terrain.length; i++) {
      const z = this.terrain[i], h = this.water[i];
      if (z <= floor[i] || h < .02) continue;
      const speed = Math.hypot(this.mx[i], this.my[i]) / h;
      const soft = z > hardTop[i];
      const critical = soft ? sand.critical : oldCritical[i], rate = soft ? sand.rate : oldRate[i];
      if (speed <= critical) continue;
      const bottom = soft ? Math.max(floor[i], hardTop[i]) : floor[i];
      const next = Math.max(bottom, z - rate * (speed - critical) ** 2 * dt);
      this.terrain[i] = next;
      this.wear[i] += (z - next) / dt;
    }
    const { width: w } = this, { height, rate } = this.erosion!.slump;
    for (let i = 0; i < this.terrain.length; i++) {
      const z = this.terrain[i];
      if (z <= floor[i] || this.water[i] < .02) continue;
      const x = i % w;
      let target = z;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j >= 0 && j < this.terrain.length && this.wear[j] > 0) target = Math.min(target, this.terrain[j] + height);
      }
      if (target >= z) continue;
      const next = Math.max(floor[i], target, z - rate * dt);
      this.terrain[i] = next;
      this.wear[i] += (z - next) / dt;
    }
  }
  private step(dt: number): void {
    this.dh.fill(0); this.du.fill(0); this.dv.fill(0);
    const { width: w, height: h } = this;
    for (let y = 0; y < h; y++) for (let x = 0; x <= w; x++) {
      this.face(x > 0 ? y * w + x - 1 : -1, x < w ? y * w + x : -1, true, dt, x === 0 && this.ocean);
    }
    for (let y = 0; y <= h; y++) for (let x = 0; x < w; x++) {
      this.face(y > 0 ? (y - 1) * w + x : -1, y < h ? y * w + x : -1, false, dt, false);
    }
    for (let i = 0; i < this.water.length; i++) {
      this.water[i] += this.dh[i];
      if (!(this.water[i] >= -1e-8)) throw new Error('Negative shallow-water depth');
      this.water[i] = Math.max(0, this.water[i]);
      const friction = 1 / (1 + this.friction * dt);
      this.mx[i] = (this.mx[i] + this.du[i]) * friction;
      this.my[i] = (this.my[i] + this.dv[i]) * friction;
      if (this.water[i] < EPS) this.mx[i] = this.my[i] = 0;
    }
  }
  private face(a: number, b: number, horizontal: boolean, dt: number, sea: boolean): void {
    const ai = a < 0 ? b : a, bi = b < 0 ? a : b;
    const za = this.terrain[ai], zb = this.terrain[bi];
    let ha = this.water[ai], hb = this.water[bi];
    const normal = horizontal ? this.mx : this.my;
    const tangent = horizontal ? this.my : this.mx;
    let ua = ha > EPS ? normal[ai] / ha : 0;
    let ub = hb > EPS ? normal[bi] / hb : 0;
    const va = ha > EPS ? tangent[ai] / ha : 0;
    const vb = hb > EPS ? tangent[bi] / hb : 0;
    if (a < 0) {
      if (sea) {
        ha = Math.max(0, this.seaLevel - za); ua = ub;
        if (this.waveBoundary) {
          const incoming = 2 * Math.sqrt(G * ha);
          const outgoing = ub - 2 * Math.sqrt(G * hb);
          ua = (incoming + outgoing) / 2;
          ha = Math.max(0, (incoming - outgoing) / 4) ** 2 / G;
        }
      } else ua = -ub;
    }
    if (b < 0) ub = -ua;
    const z = Math.max(za, zb);
    const l = Math.max(0, ha + za - z), r = Math.max(0, hb + zb - z);
    const speed = Math.max(Math.abs(ua) + Math.sqrt(G * l), Math.abs(ub) + Math.sqrt(G * r));
    const mass = (l * ua + r * ub - speed * (r - l)) / 2;
    const mom = (l * ua * ua + r * ub * ub + G * (l * l + r * r) / 2 - speed * (r * ub - l * ua)) / 2;
    const cross = (l * ua * va + r * ub * vb - speed * (r * vb - l * va)) / 2;
    const f = dt / DX;
    const dn = horizontal ? this.du : this.dv, dc = horizontal ? this.dv : this.du;
    if (a >= 0) { this.dh[a] -= f * mass; dn[a] -= f * (mom + G * (ha * ha - l * l) / 2); dc[a] -= f * cross; }
    if (b >= 0) { this.dh[b] += f * mass; dn[b] += f * (mom + G * (hb * hb - r * r) / 2); dc[b] += f * cross; }
    if (sea) this.boundaryVolume += mass * dt * DX;
  }
}
