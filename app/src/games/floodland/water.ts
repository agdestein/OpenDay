/** First-order finite volumes: hydrostatic reconstruction + Rusanov flux.
 * Bed-source corrections preserve lake-at-rest; a CFL step handles wet/dry fronts.
 * Units: metres, seconds. Sea forcing exists only at the western boundary.
 */
export const GRID_W = 64;
export const GRID_H = 40;
export const DX = 10;
const G = 9.81;
const EPS = 1e-7;
/** Second order: a face's mass flux, normal momentum flux on each side (with the
 * hydrostatic correction) and tangential flux, written into FLUX. */
const FLUX = new Float64Array(4);
function rusanov(out: Float64Array, hL: number, zL: number, uL: number, vL: number, hR: number, zR: number, uR: number, vR: number): void {
  const z = Math.max(zL, zR);
  const l = Math.max(0, hL + zL - z), r = Math.max(0, hR + zR - z);
  const speed = Math.max(Math.abs(uL) + Math.sqrt(G * l), Math.abs(uR) + Math.sqrt(G * r));
  const mom = (l * uL * uL + r * uR * uR + G * (l * l + r * r) / 2 - speed * (r * uR - l * uL)) / 2;
  out[0] = (l * uL + r * uR - speed * (r - l)) / 2;
  out[1] = mom + G * (hL * hL - l * l) / 2;
  out[2] = mom + G * (hR * hR - r * r) / 2;
  out[3] = (l * uL * vL + r * uR * vR - speed * (r * vR - l * vL)) / 2;
}
/** Monotonized central slopes: sharper than minmod, and a face value never passes
 * a neighbour's, so depths stay positive. */
function limit(a: number, b: number): number {
  if (a > 0 && b > 0) { const m = 2 * (a < b ? a : b), c = (a + b) / 2; return m < c ? m : c; }
  if (a < 0 && b < 0) { const m = 2 * (a > b ? a : b), c = (a + b) / 2; return m > c ? m : c; }
  return 0;
}

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
  /** Second order in space and time (minmod slopes, Heun's method): short waves
   * travel much further before the scheme smears them out. Off by default; the
   * challenge is calibrated on the first-order scheme. */
  secondOrder = false;
  /** Manning's roughness n (s/m^⅓): extra friction that grows in shallow water. */
  manning = 0;
  /** Springs: water added to a cell, in m³/s. */
  sources: { index: number; rate: number }[] = [];
  /** Time steps taken so far (the explainer counts them). */
  steps = 0;
  /** Second order: the state at the start of a step, velocities and slopes. */
  private start: Float64Array[] = [];
  private vel: Float64Array[] = [];
  private slope: Float64Array[] = [];
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
      const dt = Math.min(duration, (this.secondOrder ? .45 : .38) * DX / speed);
      if (this.secondOrder) this.step2(dt); else this.step(dt);
      for (const { index, rate } of this.sources) this.water[index] += rate * dt / (DX * DX);
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
  /** One Heun step of the second-order scheme: two first-order-like stages on
   * reconstructed face values, averaged. */
  private step2(dt: number): void {
    const n = this.water.length;
    if (!this.start.length) {
      this.start = [0, 1, 2].map(() => new Float64Array(n));
      this.vel = [0, 1].map(() => new Float64Array(n));
      this.slope = Array.from({ length: 8 }, () => new Float64Array(n));
    }
    const h0 = this.start[0], mx0 = this.start[1], my0 = this.start[2];
    const water = this.water, mx = this.mx, my = this.my, dh = this.dh, du = this.du, dv = this.dv;
    h0.set(water); mx0.set(mx); my0.set(my);
    for (let stage = 0; stage < 2; stage++) {
      this.rhs2(dt, .5);
      for (let i = 0; i < n; i++) {
        let h = water[i] + dh[i], u = mx[i] + du[i], v = my[i] + dv[i];
        if (stage === 1) { h = (h0[i] + h) / 2; u = (mx0[i] + u) / 2; v = (my0[i] + v) / 2; }
        if (!(h >= -1e-3)) throw new Error('Negative shallow-water depth');
        if (h < EPS) { h = Math.max(0, h); u = v = 0; }
        water[i] = h; mx[i] = u; my[i] = v;
      }
    }
    const gn2 = G * this.manning * this.manning;
    for (let i = 0; i < n; i++) {
      const h = water[i];
      if (h <= 0) continue;
      let k = this.friction;
      if (gn2 > 0 && h > EPS) k += gn2 * Math.hypot(mx[i], my[i]) / (h * h * Math.cbrt(h));
      const friction = 1 / (1 + k * dt);
      mx[i] *= friction; my[i] *= friction;
    }
  }
  /** Increments for one stage: limited slopes of depth, surface and velocity (none
   * next to dry ground), hydrostatic reconstruction at every face, and the centred
   * bed term that keeps a lake at rest (Audusse et al. 2004, second order). */
  private rhs2(dt: number, boundaryWeight: number): void {
    const { width: w, height: hh, water, terrain, mx, my, dh, du, dv } = this;
    const u = this.vel[0], v = this.vel[1], s = this.slope;
    const shx = s[0], sex = s[1], sux = s[2], svx = s[3], shy = s[4], sey = s[5], suy = s[6], svy = s[7];
    const n = water.length, DRY = 1e-3;
    for (let i = 0; i < n; i++) {
      const h = water[i];
      u[i] = h > EPS ? mx[i] / h : 0; v[i] = h > EPS ? my[i] / h : 0;
    }
    shx.fill(0); sex.fill(0); sux.fill(0); svx.fill(0); shy.fill(0); sey.fill(0); suy.fill(0); svy.fill(0);
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, h = water[i];
      if (h <= DRY) continue;
      const eta = h + terrain[i];
      if (x > 0 && x < w - 1 && water[i - 1] > DRY && water[i + 1] > DRY) {
        const a = i - 1, b = i + 1;
        shx[i] = limit(h - water[a], water[b] - h);
        sex[i] = limit(eta - water[a] - terrain[a], water[b] + terrain[b] - eta);
        sux[i] = limit(u[i] - u[a], u[b] - u[i]);
        svx[i] = limit(v[i] - v[a], v[b] - v[i]);
      }
      if (y > 0 && y < hh - 1 && water[i - w] > DRY && water[i + w] > DRY) {
        const a = i - w, b = i + w;
        shy[i] = limit(h - water[a], water[b] - h);
        sey[i] = limit(eta - water[a] - terrain[a], water[b] + terrain[b] - eta);
        suy[i] = limit(u[i] - u[a], u[b] - u[i]);
        svy[i] = limit(v[i] - v[a], v[b] - v[i]);
      }
    }
    dh.fill(0); du.fill(0); dv.fill(0);
    const f = dt / DX, out = FLUX;
    // Faces between columns (x-direction); the sea is the western edge.
    for (let y = 0; y < hh; y++) for (let x = 0; x <= w; x++) {
      const a = x > 0 ? y * w + x - 1 : -1, b = x < w ? y * w + x : -1;
      const sea = x === 0 && this.ocean;
      if ((a < 0 || water[a] <= 0) && (b < 0 || water[b] <= 0) && !sea) continue;
      let hL = 0, zL = 0, uL = 0, vL = 0, hR = 0, zR = 0, uR = 0, vR = 0;
      if (a >= 0) { hL = water[a] + shx[a] / 2; zL = terrain[a] + (sex[a] - shx[a]) / 2; uL = u[a] + sux[a] / 2; vL = v[a] + svx[a] / 2; }
      if (b >= 0) { hR = water[b] - shx[b] / 2; zR = terrain[b] - (sex[b] - shx[b]) / 2; uR = u[b] - sux[b] / 2; vR = v[b] - svx[b] / 2; }
      if (a < 0) {
        zL = zR; vL = vR;
        if (sea) {
          hL = Math.max(0, this.seaLevel - zL); uL = uR;
          if (this.waveBoundary) {
            const incoming = 2 * Math.sqrt(G * hL), outgoing = uR - 2 * Math.sqrt(G * hR);
            uL = (incoming + outgoing) / 2;
            hL = Math.max(0, (incoming - outgoing) / 4) ** 2 / G;
          }
        } else { hL = hR; uL = -uR; }
      }
      if (b < 0) { hR = hL; zR = zL; uR = -uL; vR = vL; }
      rusanov(out, hL, zL, uL, vL, hR, zR, uR, vR);
      if (a >= 0) { dh[a] -= f * out[0]; du[a] -= f * out[1]; dv[a] -= f * out[3]; }
      if (b >= 0) { dh[b] += f * out[0]; du[b] += f * out[2]; dv[b] += f * out[3]; }
      if (sea) this.boundaryVolume += out[0] * dt * boundaryWeight * DX;
    }
    // Faces between rows (y-direction): walls at both ends.
    for (let y = 0; y <= hh; y++) for (let x = 0; x < w; x++) {
      const a = y > 0 ? (y - 1) * w + x : -1, b = y < hh ? y * w + x : -1;
      if ((a < 0 || water[a] <= 0) && (b < 0 || water[b] <= 0)) continue;
      let hL = 0, zL = 0, uL = 0, vL = 0, hR = 0, zR = 0, uR = 0, vR = 0;
      if (a >= 0) { hL = water[a] + shy[a] / 2; zL = terrain[a] + (sey[a] - shy[a]) / 2; uL = v[a] + svy[a] / 2; vL = u[a] + suy[a] / 2; }
      if (b >= 0) { hR = water[b] - shy[b] / 2; zR = terrain[b] - (sey[b] - shy[b]) / 2; uR = v[b] - svy[b] / 2; vR = u[b] - suy[b] / 2; }
      if (a < 0) { hL = hR; zL = zR; uL = -uR; vL = vR; }
      if (b < 0) { hR = hL; zR = zL; uR = -uL; vR = vL; }
      rusanov(out, hL, zL, uL, vL, hR, zR, uR, vR);
      if (a >= 0) { dh[a] -= f * out[0]; dv[a] -= f * out[1]; du[a] -= f * out[3]; }
      if (b >= 0) { dh[b] += f * out[0]; dv[b] += f * out[2]; du[b] += f * out[3]; }
    }
    // The centred bed term: zero for a flat cell, balances the face pressures at rest.
    for (let i = 0; i < n; i++) {
      if (shx[i] !== 0 || sex[i] !== 0) du[i] -= f * G * water[i] * (sex[i] - shx[i]);
      if (shy[i] !== 0 || sey[i] !== 0) dv[i] -= f * G * water[i] * (sey[i] - shy[i]);
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
