// A small Gaussian process for weather maps, fast enough to rerun every frame.
//
// The prior is a sum of simple pieces:
//
//   k(x, x') = c² + a_u² u(x)u(x') + a_w² w(x)w(x') + θ² m(|x − x'| / ℓ)
//
// with the Matérn-3/2 correlation m(r) = (1 + √3 r) e^(−√3 r). (The smoother
// squared exponential overshoots wildly between close stations on real maps.)
// a constant ("how warm is today?"), random slopes for the urban and water
// fraction ("the computer knows the map") and a smooth field (the weather).
// Measurements add noise (official: small, home: larger), and home stations
// share one extra random offset b²: their warm bias, learned from the data by
// the same algebra and left out of the prediction. Everything is in the
// kernel, so two thermometers are already a well-posed problem.
//
// Grids get per-station columns of the smooth part cached, so moving one
// thermometer recomputes one column. Dreams are posterior samples: a prior
// sample from random Fourier features (with slowly turning phases, so the
// dream drifts) conditioned on the measurements by Matheron's rule.

import type { Grid } from './world';

export interface Hyper {
  /** Expected temperature before measuring (°C). */
  mean: number;
  /** Prior spread of the overall level. */
  c: number;
  /** Prior spread of the urban and water slopes (°C per unit fraction). */
  au: number;
  aw: number;
  /** Spread and length scale (km) of the smooth weather. */
  theta: number;
  ell: number;
  /** Measurement noise (°C). */
  sdOfficial: number;
  sdHome: number;
  /** Prior spread of the shared home-station offset. */
  bias: number;
}

export interface Obs {
  x: number;
  y: number;
  value: number;
  u: number;
  w: number;
  home: boolean;
}

export interface GpOptions {
  /** Use the urban/water covariates ("map knowledge"). */
  map: boolean;
  /** Model the home stations' shared offset ("bias correction"). */
  bias: boolean;
}

const JITTER = 1e-6;

export class GP {
  readonly obs: Obs[] = [];
  n = 0;
  private L: Float64Array = new Float64Array(0);
  private alpha: Float64Array = new Float64Array(0);
  /** Sums c²Σα, a_u²Σαu, a_w²Σαw used by the mean on every grid. */
  private s0 = 0;
  private s1 = 0;
  private s2 = 0;
  /** cols[g][i]: m(d/ℓ) from station i to every cell of grid g. */
  private cols: Float32Array[][];
  private colKeys: string[][];

  constructor(
    public hyper: Hyper,
    public readonly grids: Grid[],
    public options: GpOptions = { map: true, bias: true },
  ) {
    this.cols = grids.map(() => []);
    this.colKeys = grids.map(() => []);
  }

  get au(): number {
    return this.options.map ? this.hyper.au : 0;
  }
  get aw(): number {
    return this.options.map ? this.hyper.aw : 0;
  }
  private get b(): number {
    return this.options.bias ? this.hyper.bias : 0;
  }

  noise(o: Obs): number {
    return o.home ? this.hyper.sdHome : this.hyper.sdOfficial;
  }

  /** Change hyperparameters or options; call `setObs` afterwards. */
  retune(hyper: Hyper, options: GpOptions = this.options): void {
    if (hyper.ell !== this.hyper.ell) this.colKeys = this.grids.map(() => []);
    this.hyper = hyper;
    this.options = options;
  }

  /** Smooth part only, unscaled. */
  se(dx: number, dy: number): number {
    return matern(Math.sqrt(dx * dx + dy * dy) / this.hyper.ell);
  }

  /** Prior covariance of the field (no noise, no bias) between two points. */
  kf(x1: number, y1: number, u1: number, w1: number, x2: number, y2: number, u2: number, w2: number): number {
    const h = this.hyper;
    return h.c * h.c + this.au * this.au * u1 * u2 + this.aw * this.aw * w1 * w2 + h.theta * h.theta * this.se(x1 - x2, y1 - y2);
  }

  priorVar(u: number, w: number): number {
    const h = this.hyper;
    return h.c * h.c + this.au * this.au * u * u + this.aw * this.aw * w * w + h.theta * h.theta;
  }

  /** Refit to a new set of measurements (cheap for N up to a few hundred). */
  setObs(obs: Obs[]): void {
    this.obs.length = 0;
    this.obs.push(...obs);
    const n = (this.n = obs.length);
    const b2 = this.b * this.b;
    const K = new Float64Array(n * n);
    for (let i = 0; i < n; i++) {
      const oi = obs[i];
      for (let j = 0; j <= i; j++) {
        const oj = obs[j];
        let k = this.kf(oi.x, oi.y, oi.u, oi.w, oj.x, oj.y, oj.u, oj.w);
        if (oi.home && oj.home) k += b2;
        if (i === j) k += this.noise(oi) ** 2 + JITTER;
        K[i * n + j] = K[j * n + i] = k;
      }
    }
    this.L = cholesky(K, n);
    const r = new Float64Array(n);
    for (let i = 0; i < n; i++) r[i] = obs[i].value - this.hyper.mean;
    this.alpha = solveChol(this.L, n, r);
    this.s0 = this.s1 = this.s2 = 0;
    for (let i = 0; i < n; i++) {
      this.s0 += this.alpha[i];
      this.s1 += this.alpha[i] * obs[i].u;
      this.s2 += this.alpha[i] * obs[i].w;
    }
    for (let g = 0; g < this.grids.length; g++) this.syncColumns(g);
  }

  private syncColumns(g: number): void {
    const grid = this.grids[g];
    const cols = this.cols[g];
    const keys = this.colKeys[g];
    // Reuse a cached column when some station sits exactly there already.
    const byKey = new Map<string, Float32Array>();
    keys.forEach((key, i) => byKey.set(key, cols[i]));
    const ell = this.hyper.ell;
    for (let i = 0; i < this.n; i++) {
      const o = this.obs[i];
      const key = `${o.x},${o.y}`;
      let col = byKey.get(key);
      if (col) byKey.delete(key);
      else {
        col = new Float32Array(grid.n);
        for (let k = 0; k < grid.n; k++) {
          const dx = grid.x[k] - o.x, dy = grid.y[k] - o.y;
          col[k] = matern(Math.sqrt(dx * dx + dy * dy) / ell);
        }
      }
      cols[i] = col;
      keys[i] = key;
    }
    cols.length = keys.length = this.n;
  }

  /** Posterior mean on grid g. */
  meanGrid(g: number, out: Float32Array): void {
    const grid = this.grids[g];
    const h = this.hyper;
    const c0 = h.mean + h.c * h.c * this.s0;
    const cu = this.au * this.au * this.s1;
    const cw = this.aw * this.aw * this.s2;
    for (let k = 0; k < grid.n; k++) out[k] = c0 + cu * grid.u[k] + cw * grid.w[k];
    const t2 = h.theta * h.theta;
    const cols = this.cols[g];
    for (let i = 0; i < this.n; i++) {
      const a = t2 * this.alpha[i];
      const col = cols[i];
      for (let k = 0; k < grid.n; k++) out[k] += a * col[k];
    }
  }

  /** Posterior standard deviation on grid g (only where `mask` is set, if given). */
  sdGrid(g: number, out: Float32Array, mask?: Uint8Array): void {
    const grid = this.grids[g];
    const n = this.n;
    const h = this.hyper;
    const c2 = h.c * h.c, au2 = this.au * this.au, aw2 = this.aw * this.aw, t2 = h.theta * h.theta;
    const cols = this.cols[g];
    const L = this.L;
    const z = new Float64Array(n);
    for (let k = 0; k < grid.n; k++) {
      if (mask && !mask[k]) {
        out[k] = 0;
        continue;
      }
      const u = grid.u[k], w = grid.w[k];
      // Forward solve L z = k*, accumulating |z|².
      let q = 0;
      for (let i = 0; i < n; i++) {
        const o = this.obs[i];
        let s = c2 + au2 * u * o.u + aw2 * w * o.w + t2 * cols[i][k];
        const row = i * n;
        for (let j = 0; j < i; j++) s -= L[row + j] * z[j];
        const zi = s / L[row + i];
        z[i] = zi;
        q += zi * zi;
      }
      out[k] = Math.sqrt(Math.max(0, this.priorVar(u, w) - q));
    }
  }

  /** Posterior mean and standard deviation at one point. */
  predict(x: number, y: number, u: number, w: number): { mean: number; sd: number } {
    const n = this.n;
    const ks = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const o = this.obs[i];
      ks[i] = this.kf(x, y, u, w, o.x, o.y, o.u, o.w);
    }
    let mean = this.hyper.mean;
    for (let i = 0; i < n; i++) mean += ks[i] * this.alpha[i];
    const z = forward(this.L, n, ks);
    let q = 0;
    for (let i = 0; i < n; i++) q += z[i] * z[i];
    return { mean, sd: Math.sqrt(Math.max(0, this.priorVar(u, w) - q)) };
  }

  /**
   * Leave-one-out check per station: what all the other stations predict it
   * should read, and how many spreads its actual reading is away from that.
   */
  loo(): { mean: Float64Array; z: Float64Array } {
    const n = this.n;
    const inv = invFromChol(this.L, n);
    const mean = new Float64Array(n), z = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const d = inv[i * n + i];
      mean[i] = this.obs[i].value - this.alpha[i] / d;
      z[i] = this.alpha[i] / Math.sqrt(d);
    }
    return { mean, z };
  }

  /** Estimated shared offset of home stations (posterior mean of the bias term). */
  biasEstimate(): number {
    const b2 = this.b * this.b;
    let s = 0;
    for (let i = 0; i < this.n; i++) if (this.obs[i].home) s += b2 * this.alpha[i];
    return s;
  }

  // --- used by Dreamer ---
  get chol(): Float64Array {
    return this.L;
  }
  columns(g: number): Float32Array[] {
    return this.cols[g];
  }
}

/** Posterior samples that drift slowly in time ("the computer dreams"). */
export class Dreamer {
  private F: number;
  private omx: Float64Array;
  private omy: Float64Array;
  private phase: Float64Array;
  private speed: Float64Array;
  private cosTab: Float32Array;
  private sinTab: Float32Array;
  private ell = -1;
  /** Rotating standard normals: z(t) = a cos νt + b sin νt. */
  private globals: { a: number; b: number; nu: number }[];
  private noiseA: number[] = [];
  private noiseB: number[] = [];
  private noiseNu: number[] = [];

  constructor(
    private gp: GP,
    private g: number,
    private rand: () => number,
    features = 150,
  ) {
    this.F = features;
    this.omx = new Float64Array(features);
    this.omy = new Float64Array(features);
    this.phase = new Float64Array(features);
    this.speed = new Float64Array(features);
    const n = gp.grids[g].n;
    this.cosTab = new Float32Array(features * n);
    this.sinTab = new Float32Array(features * n);
    this.globals = [0, 1, 2, 3].map(() => ({ a: this.normal(), b: this.normal(), nu: 0.15 + 0.2 * rand() }));
    this.build();
  }

  private normal(): number {
    const u = Math.max(this.rand(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.rand());
  }

  private build(): void {
    const ell = this.gp.hyper.ell;
    this.ell = ell;
    const grid = this.gp.grids[this.g];
    for (let f = 0; f < this.F; f++) {
      // Matérn-3/2 spectrum: a Student-t with 3 degrees of freedom.
      const chi2 = this.normal() ** 2 + this.normal() ** 2 + this.normal() ** 2;
      const scale = Math.sqrt(3 / Math.max(chi2, 1e-9)) / ell;
      this.omx[f] = this.normal() * scale;
      this.omy[f] = this.normal() * scale;
      this.phase[f] = 2 * Math.PI * this.rand();
      this.speed[f] = 0.5 * this.normal();
      for (let k = 0; k < grid.n; k++) {
        const a = this.omx[f] * grid.x[k] + this.omy[f] * grid.y[k] + this.phase[f];
        this.cosTab[f * grid.n + k] = Math.cos(a);
        this.sinTab[f * grid.n + k] = Math.sin(a);
      }
    }
  }

  private rot(k: number, t: number): number {
    const z = this.globals[k];
    return z.a * Math.cos(z.nu * t) + z.b * Math.sin(z.nu * t);
  }

  /** Writes one posterior sample at time t (seconds) on the dreamer's grid. */
  sample(t: number, out: Float32Array): void {
    const gp = this.gp;
    if (gp.hyper.ell !== this.ell) this.build();
    const h = gp.hyper;
    const grid = gp.grids[this.g];
    const F = this.F;
    const n = gp.n;
    const amp = h.theta * Math.sqrt(2 / F);
    const cf = new Float64Array(F), sf = new Float64Array(F);
    for (let f = 0; f < F; f++) {
      cf[f] = Math.cos(this.speed[f] * t);
      sf[f] = Math.sin(this.speed[f] * t);
    }
    const z0 = this.rot(0, t), z1 = this.rot(1, t), z2 = this.rot(2, t), zb = this.rot(3, t);
    const au = gp.au, aw = gp.aw, b = gp.options.bias ? h.bias : 0;

    // Prior sample at the stations, then v = K⁻¹(y − mean − prior).
    while (this.noiseA.length < n) {
      this.noiseA.push(this.normal());
      this.noiseB.push(this.normal());
      this.noiseNu.push(0.2 + 0.3 * this.rand());
    }
    const r = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const o = gp.obs[i];
      let s = 0;
      for (let f = 0; f < F; f++) s += Math.cos(this.omx[f] * o.x + this.omy[f] * o.y + this.phase[f] + this.speed[f] * t);
      let prior = amp * s + h.c * z0 + au * z1 * o.u + aw * z2 * o.w;
      if (o.home) prior += b * zb;
      const nz = this.noiseA[i] * Math.cos(this.noiseNu[i] * t) + this.noiseB[i] * Math.sin(this.noiseNu[i] * t);
      prior += gp.noise(o) * nz;
      r[i] = o.value - h.mean - prior;
    }
    const v = solveChol(gp.chol, n, r);
    let v0 = 0, vu = 0, vw = 0;
    for (let i = 0; i < n; i++) {
      v0 += v[i];
      vu += v[i] * gp.obs[i].u;
      vw += v[i] * gp.obs[i].w;
    }
    const c0 = h.mean + h.c * z0 + h.c * h.c * v0;
    const cu = au * z1 + au * au * vu;
    const cw = aw * z2 + aw * aw * vw;
    for (let k = 0; k < grid.n; k++) out[k] = c0 + cu * grid.u[k] + cw * grid.w[k];
    for (let f = 0; f < F; f++) {
      const a = amp * cf[f], s = -amp * sf[f];
      const base = f * grid.n;
      for (let k = 0; k < grid.n; k++) out[k] += a * this.cosTab[base + k] + s * this.sinTab[base + k];
    }
    const t2 = h.theta * h.theta;
    const cols = gp.columns(this.g);
    for (let i = 0; i < n; i++) {
      const a = t2 * v[i];
      const col = cols[i];
      for (let k = 0; k < grid.n; k++) out[k] += a * col[k];
    }
  }
}

const SQRT3 = Math.sqrt(3);

/** Matérn-3/2 correlation at distance r (in length scales). */
export function matern(r: number): number {
  const a = SQRT3 * r;
  return (1 + a) * Math.exp(-a);
}

// --- dense linear algebra (row-major, lower-triangular Cholesky) ---

export function cholesky(A: Float64Array, n: number): Float64Array {
  const L = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i * n + j];
      for (let k = 0; k < j; k++) s -= L[i * n + k] * L[j * n + k];
      if (i === j) L[i * n + i] = Math.sqrt(Math.max(s, 1e-10));
      else L[i * n + j] = s / L[j * n + j];
    }
  }
  return L;
}

function forward(L: Float64Array, n: number, b: ArrayLike<number>): Float64Array {
  const z = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = b[i];
    for (let j = 0; j < i; j++) s -= L[i * n + j] * z[j];
    z[i] = s / L[i * n + i];
  }
  return z;
}

function backward(L: Float64Array, n: number, z: Float64Array): Float64Array {
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = z[i];
    for (let j = i + 1; j < n; j++) s -= L[j * n + i] * x[j];
    x[i] = s / L[i * n + i];
  }
  return x;
}

export function solveChol(L: Float64Array, n: number, b: ArrayLike<number>): Float64Array {
  return backward(L, n, forward(L, n, b));
}

function invFromChol(L: Float64Array, n: number): Float64Array {
  const inv = new Float64Array(n * n);
  const e = new Float64Array(n);
  for (let c = 0; c < n; c++) {
    e.fill(0);
    e[c] = 1;
    const x = solveChol(L, n, e);
    for (let r = 0; r < n; r++) inv[r * n + c] = x[r];
  }
  return inv;
}
