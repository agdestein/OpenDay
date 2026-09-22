// The Netherlands as the game sees it: grids in km, covariates, the four real
// days (adapted), cities, and the per-day Gaussian-process settings.
//
// World coordinates are km from the north-west corner of KNMI's map, x east,
// y south (screen order). Three grids share them:
//   fine   386×280 (~0.7×1.1 km)  land mask only, for a crisp coastline
//   half   193×140                truth, best guess and colours
//   coarse  97×70                 spread (fog) and dreams
import { DAYS, GRID, LAND, URBAN, WATER } from './data';
import type { Hyper } from './gp';

export type DayId = 'heatwave' | 'seabreeze' | 'newyear' | 'frost';
export const DAY_IDS: DayId[] = ['heatwave', 'seabreeze', 'newyear', 'frost'];

const KM_PER_LON = 111.32 * Math.cos(((GRID.lat0 + GRID.lat1) / 2) * (Math.PI / 180));
const KM_PER_LAT = 111.0;
const DLON = (GRID.lon1 - GRID.lon0) / (GRID.fineNx - 1);
const DLAT = (GRID.lat1 - GRID.lat0) / (GRID.fineNy - 1);
export const FINE_NX = GRID.fineNx;
export const FINE_NY = GRID.fineNy;
export const FINE_DX = DLON * KM_PER_LON;
export const FINE_DY = DLAT * KM_PER_LAT;
/** Size of the map in km. */
export const WIDTH_KM = GRID.fineNx * FINE_DX;
export const HEIGHT_KM = GRID.fineNy * FINE_DY;

export function lonLatToKm(lon: number, lat: number): { x: number; y: number } {
  return {
    x: ((lon - GRID.lon0) / DLON + 0.5) * FINE_DX,
    y: ((GRID.lat1 - lat) / DLAT + 0.5) * FINE_DY,
  };
}

/** A regular grid of prediction points with their covariates. */
export interface Grid {
  nx: number;
  ny: number;
  /** Cell size in km. */
  dx: number;
  dy: number;
  n: number;
  x: Float32Array;
  y: Float32Array;
  /** Urban and water fraction, 0..1. */
  u: Float32Array;
  w: Float32Array;
  /** 1 where the cell is (Dutch) land. */
  land: Uint8Array;
}

function decode(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function makeGrid(nx: number, ny: number, dx: number, dy: number): Grid {
  const n = nx * ny;
  const grid: Grid = {
    nx, ny, dx, dy, n,
    x: new Float32Array(n), y: new Float32Array(n),
    u: new Float32Array(n), w: new Float32Array(n), land: new Uint8Array(n),
  };
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      grid.x[j * nx + i] = (i + 0.5) * dx;
      grid.y[j * nx + i] = (j + 0.5) * dy;
    }
  return grid;
}

export interface World {
  /** Fine land mask, 386×280 row-major from the north. */
  fineLand: Uint8Array;
  half: Grid;
  coarse: Grid;
  /** Real temperature per day on the half grid (NaN off land). */
  days: Record<DayId, { t: Float32Array; lo: number; hi: number }>;
}

let cached: World | null = null;

export function world(): World {
  if (cached) return cached;
  const fineLand = new Uint8Array(GRID.fineNx * GRID.fineNy);
  const bits = decode(LAND);
  for (let k = 0; k < fineLand.length; k++) fineLand[k] = (bits[k >> 3] >> (k & 7)) & 1;

  const half = makeGrid(GRID.nx, GRID.ny, 2 * FINE_DX, 2 * FINE_DY);
  const urban = decode(URBAN);
  const water = decode(WATER);
  for (let k = 0; k < half.n; k++) {
    half.u[k] = urban[k] === 255 ? 0 : urban[k] / 254;
    half.w[k] = water[k] === 255 ? 1 : water[k] / 254;
  }

  const days = {} as World['days'];
  for (const id of DAY_IDS) {
    const d = DAYS[id];
    const bytes = decode(d.t);
    const t = new Float32Array(half.n);
    for (let k = 0; k < half.n; k++) t[k] = bytes[k] === 255 ? NaN : d.lo + (bytes[k] / 254) * (d.hi - d.lo);
    days[id] = { t, lo: d.lo, hi: d.hi };
  }
  const t0 = days.heatwave.t;
  for (let k = 0; k < half.n; k++) half.land[k] = Number.isNaN(t0[k]) ? 0 : 1;

  // Coarse grid: 2×2 blocks of the half grid.
  const cnx = Math.ceil(half.nx / 2);
  const cny = Math.ceil(half.ny / 2);
  const coarse = makeGrid(cnx, cny, 2 * half.dx, 2 * half.dy);
  for (let j = 0; j < cny; j++)
    for (let i = 0; i < cnx; i++) {
      let u = 0, w = 0, m = 0, land = 0;
      for (let dj = 0; dj < 2; dj++)
        for (let di = 0; di < 2; di++) {
          const a = 2 * i + di, b = 2 * j + dj;
          if (a >= half.nx || b >= half.ny) continue;
          const k = b * half.nx + a;
          u += half.u[k]; w += half.w[k]; m++; land |= half.land[k];
        }
      const k = j * cnx + i;
      coarse.u[k] = u / m; coarse.w[k] = w / m; coarse.land[k] = land;
    }

  cached = { fineLand, half, coarse, days };
  return cached;
}

/** Nearest half-grid cell index for a point in km (clamped to the map). */
export function halfCell(x: number, y: number): number {
  const { half } = world();
  const i = Math.min(half.nx - 1, Math.max(0, Math.floor(x / half.dx)));
  const j = Math.min(half.ny - 1, Math.max(0, Math.floor(y / half.dy)));
  return j * half.nx + i;
}

/** The fine land mask as an image (alpha 255 on land), for crisp coastlines. */
export function landCanvas(): HTMLCanvasElement {
  const { fineLand } = world();
  const canvas = document.createElement('canvas');
  canvas.width = GRID.fineNx;
  canvas.height = GRID.fineNy;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(GRID.fineNx, GRID.fineNy);
  for (let k = 0; k < fineLand.length; k++) img.data[k * 4 + 3] = fineLand[k] ? 255 : 0;
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Is this point on Dutch land (fine mask)? */
export function onLand(x: number, y: number): boolean {
  const { fineLand } = world();
  const i = Math.floor(x / FINE_DX), j = Math.floor(y / FINE_DY);
  if (i < 0 || j < 0 || i >= GRID.fineNx || j >= GRID.fineNy) return false;
  return fineLand[j * GRID.fineNx + i] === 1;
}

/** Value of a half-grid field at a point: the nearest land cell around it. */
export function sampleHalf(field: Float32Array, x: number, y: number): number {
  const { half } = world();
  const k = halfCell(x, y);
  if (!Number.isNaN(field[k])) return field[k];
  const i0 = k % half.nx, j0 = Math.floor(k / half.nx);
  for (let r = 1; r < 6; r++)
    for (let dj = -r; dj <= r; dj++)
      for (let di = -r; di <= r; di++) {
        const i = i0 + di, j = j0 + dj;
        if (i < 0 || j < 0 || i >= half.nx || j >= half.ny) continue;
        const v = field[j * half.nx + i];
        if (!Number.isNaN(v)) return v;
      }
  return NaN;
}

/**
 * Per-day model settings, read off the data by eye (regression on the
 * covariates plus a variogram of what is left; tools/detective/prep.jl
 * explains the grids). `mean` is what the computer expects before any
 * measurement: "it is summer, so about 33 °C".
 */
export const HYPER: Record<DayId, Hyper> = {
  heatwave: { mean: 33, c: 2, au: 5, aw: 3, theta: 2, ell: 60, sdOfficial: 0.3, sdHome: 1, bias: 2 },
  seabreeze: { mean: 23, c: 2, au: 1.5, aw: 5, theta: 1.2, ell: 35, sdOfficial: 0.2, sdHome: 1, bias: 2 },
  newyear: { mean: 7, c: 1.5, au: 1.5, aw: 1.5, theta: 1.3, ell: 70, sdOfficial: 0.15, sdHome: 0.8, bias: 2 },
  frost: { mean: -3.5, c: 1.5, au: 1, aw: 2, theta: 1, ell: 40, sdOfficial: 0.15, sdHome: 0.8, bias: 2 },
};

/** City labels (lon, lat). */
export const CITIES: { name: string; lon: number; lat: number }[] = [
  { name: 'Amsterdam', lon: 4.9, lat: 52.37 },
  { name: 'Rotterdam', lon: 4.48, lat: 51.92 },
  { name: 'Den Haag', lon: 4.3, lat: 52.08 },
  { name: 'Utrecht', lon: 5.12, lat: 52.09 },
  { name: 'Eindhoven', lon: 5.47, lat: 51.44 },
  { name: 'Groningen', lon: 6.57, lat: 53.22 },
  { name: 'Maastricht', lon: 5.69, lat: 50.85 },
  { name: 'Zwolle', lon: 6.09, lat: 52.51 },
  { name: 'Arnhem', lon: 5.9, lat: 51.98 },
  { name: 'Leeuwarden', lon: 5.8, lat: 53.2 },
  { name: 'Middelburg', lon: 3.61, lat: 51.5 },
  { name: 'Den Helder', lon: 4.76, lat: 52.96 },
  { name: 'Enschede', lon: 6.89, lat: 52.22 },
  { name: 'Breda', lon: 4.78, lat: 51.59 },
];

/** KNMI's automatic weather stations (as listed in the 2025 Science Day game). */
export const KNMI_STATIONS: [number, number][] = [
  [6.585, 53.124], [5.52, 52.457], [5.752, 53.223], [5.872, 52.055], [4.436, 52.14],
  [4.979, 52.643], [6.259, 52.435], [4.447, 51.961], [4.935, 51.565], [5.18, 52.099],
  [4.342, 51.448], [3.596, 51.441], [4.79, 52.317], [4.603, 52.505], [5.887, 52.702],
  [7.149, 53.194], [4.122, 51.991], [5.762, 50.905], [5.383, 52.897], [6.891, 52.273],
  [5.377, 51.45], [5.763, 51.197], [4.921, 53.24], [6.199, 53.412], [4.781, 52.927],
  [6.573, 52.749], [3.861, 51.225], [5.145, 51.858], [6.196, 51.497], [5.346, 53.391],
  [6.657, 52.068], [4.926, 51.969], [5.707, 51.659],
];

/** Small seeded RNG (mulberry32) so rounds and tests are repeatable. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(r: () => number): number {
  const u = Math.max(r(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}
