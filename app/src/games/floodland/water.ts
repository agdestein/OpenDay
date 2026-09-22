/** First-order finite volumes: hydrostatic reconstruction + Rusanov flux.
 * Bed-source corrections preserve lake-at-rest; a CFL step handles wet/dry fronts.
 * Units: metres, seconds. Sea forcing exists only at the western boundary.
 */
export const GRID_W = 64;
export const GRID_H = 40;
export const DX = 10;
const G = 9.81;
const EPS = 1e-7;
export class FloodSim {
  readonly terrain: Float64Array;
  readonly water: Float64Array;
  readonly mx: Float64Array;
  readonly my: Float64Array;
  friction = 0.018;
  /** Prescribe the incoming long-wave characteristic; let reflections exit. */
  waveBoundary = false;
  private dh: Float64Array;
  private du: Float64Array;
  private dv: Float64Array;
  seaLevel = 0;
  ocean = true;
  boundaryVolume = 0;
  pumpedVolume = 0;
  sourceVolume = 0;
  sourceConfig: { cells: readonly number[]; rate: number } | null = null;
  pumpConfig: { intakes: readonly number[]; outlet: number; capacity: number; minLevel?: number } | null = null;
  constructor(readonly width = GRID_W, readonly height = GRID_H) {
    const n = width * height;
    this.terrain = new Float64Array(n);
    this.water = new Float64Array(n);
    this.mx = new Float64Array(n);
    this.my = new Float64Array(n);
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
  /** Advance the requested physical duration using stable substeps. */
  advance(duration: number): void {
    while (duration > 1e-9) {
      let speed = 0.1;
      for (let i = 0; i < this.water.length; i++) {
        const h = this.water[i];
        if (h > EPS) speed = Math.max(speed, Math.abs(this.mx[i] / h) + Math.abs(this.my[i] / h) + 2 * Math.sqrt(G * h));
      }
      const dt = Math.min(duration, 0.38 * DX / speed);
      this.step(dt);
      if (this.sourceConfig) {
        const { cells, rate } = this.sourceConfig;
        const volume = rate * dt;
        for (const i of cells) this.water[i] += volume / (cells.length * DX * DX);
        this.sourceVolume += volume;
      }
      if (this.pumpConfig) {
        const { intakes, outlet, capacity, minLevel } = this.pumpConfig;
        this.pumpedVolume += this.pump(intakes, outlet, capacity, dt, minLevel);
      }
      duration -= dt;
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
      if (this.water[i] < -1e-8) throw new Error('Negative shallow-water depth');
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
          const incoming = 4 * Math.sqrt(G * ha) - 2 * Math.sqrt(G * Math.max(0, -za));
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
