// Height-field shallow water on a coarse grid (virtual-pipes scheme, explicit,
// heavily damped: stability over accuracy) over a stylized map of the Dutch
// coast. Sea on the left; a dune ridge with estuary gaps; polders below sea
// level behind it; the Zeeland delta in the south; higher ground to the east.
export const GRID_W = 160;
export const GRID_H = 90;
const N = GRID_W * GRID_H;

/** Water shallower than this is treated as dry land. */
export const DRY = 0.02;
/** A house with more than this much water on its cell is flooded. */
export const FLOOD_DEPTH = 0.35;
const GRAVITY = 30;
const FLUX_DAMP = 0.8; // per second
const MAX_FLUX = 8;
const MAX_TERRAIN = 5.2;

/** Estuary gaps in the dune ridge (grid y), each with a river corridor. */
const GAPS = [32, 58];
const DELTA_Y = 68; // south of this: the Zeeland delta

export interface House {
  x: number;
  y: number;
  flooded: boolean;
}

export interface Village {
  name: string;
  /** Population in thousands. */
  pop: number;
  x: number;
  y: number;
  houses: House[];
  oma?: boolean;
}

const smooth01 = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/** Deterministic value noise so the map is identical every run. */
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

export const coastX = (y: number) => 40 + 8 * Math.sin(y * 0.09) + 5 * Math.sin(y * 0.033 + 1.7);

export class FloodSim {
  terrain = new Float32Array(N);
  water = new Float32Array(N);
  /** How much the player has raised each cell (for sandbag coloring). */
  built = new Float32Array(N);
  villages: Village[] = [];
  /** Current sea level and wave amplitude at the western boundary. */
  seaLevel = 0;
  waveAmp = 0;

  private fx = new Float32Array(N); // flux to the right neighbor
  private fy = new Float32Array(N); // flux to the neighbor below
  private scale = new Float32Array(N);
  private time = 0;

  constructor() {
    this.generateTerrain();
    this.placeVillages();
    this.resetWater();
  }

  /** Fresh map: undoes all player terraforming. */
  resetAll(): void {
    this.generateTerrain();
    this.built.fill(0);
    this.seaLevel = 0;
    this.waveAmp = 0;
    this.resetWater();
  }

  /**
   * Calm start: sea at level 0 fills everything it can reach from the west
   * (flood fill), so leveed polders below sea level start dry — that's the
   * Netherlands. Also drains floods and repairs houses between storms.
   */
  resetWater(): void {
    this.water.fill(0);
    this.fx.fill(0);
    this.fy.fill(0);
    const queue: number[] = [];
    const seen = new Uint8Array(N);
    for (let y = 0; y < GRID_H; y++) {
      const i = y * GRID_W;
      if (this.terrain[i] < 0) {
        queue.push(i);
        seen[i] = 1;
      }
    }
    while (queue.length > 0) {
      const i = queue.pop()!;
      this.water[i] = -this.terrain[i];
      const x = i % GRID_W;
      const y = (i - x) / GRID_W;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
        const j = ny * GRID_W + nx;
        if (!seen[j] && this.terrain[j] < 0) {
          seen[j] = 1;
          queue.push(j);
        }
      }
    }
    for (const v of this.villages) for (const h of v.houses) h.flooded = false;
  }

  step(dt: number): void {
    this.time += dt;
    const { terrain, water, fx, fy, scale } = this;
    const damp = Math.max(0, 1 - FLUX_DAMP * dt);
    const g = GRAVITY * dt;

    // The deep sea is an infinite reservoir: every cell below -3 m directly
    // tracks the (wavy) sea level, so surge and waves start near the shore
    // instead of having to propagate across the whole damped basin.
    for (let y = 0; y < GRID_H; y++) {
      const level = this.seaLevel + this.waveAmp * Math.sin(this.time * 1.4 + y * 0.3);
      const row = y * GRID_W;
      for (let x = 0; x < GRID_W; x++) {
        const i = row + x;
        if (terrain[i] < -3) water[i] = Math.max(0, level - terrain[i]);
      }
    }

    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const i = y * GRID_W + x;
        const s = terrain[i] + water[i];
        // Thin films carry little momentum (the depth factor); without it,
        // nearly-dry cells beside deep water oscillate and blow up.
        if (x < GRID_W - 1) {
          const r = i + 1;
          if (water[i] < DRY && water[r] < DRY) {
            fx[i] = 0;
          } else {
            const k = Math.min(1, water[i] + water[r]);
            const f = (fx[i] + g * k * (s - terrain[r] - water[r])) * damp;
            fx[i] = Math.max(-MAX_FLUX, Math.min(MAX_FLUX, f));
          }
        }
        if (y < GRID_H - 1) {
          const b = i + GRID_W;
          if (water[i] < DRY && water[b] < DRY) {
            fy[i] = 0;
          } else {
            const k = Math.min(1, water[i] + water[b]);
            const f = (fy[i] + g * k * (s - terrain[b] - water[b])) * damp;
            fy[i] = Math.max(-MAX_FLUX, Math.min(MAX_FLUX, f));
          }
        }
      }
    }

    // Limit each cell's total outflow to the water it actually has.
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const i = y * GRID_W + x;
        let out = 0;
        if (x < GRID_W - 1 && fx[i] > 0) out += fx[i];
        if (x > 0 && fx[i - 1] < 0) out -= fx[i - 1];
        if (y < GRID_H - 1 && fy[i] > 0) out += fy[i];
        if (y > 0 && fy[i - GRID_W] < 0) out -= fy[i - GRID_W];
        out *= dt;
        scale[i] = water[i] <= 0 ? 0 : out > water[i] ? water[i] / out : 1;
      }
    }
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const i = y * GRID_W + x;
        if (x < GRID_W - 1) {
          const f = fx[i] * dt * (fx[i] > 0 ? scale[i] : scale[i + 1]);
          water[i] -= f;
          water[i + 1] += f;
        }
        if (y < GRID_H - 1) {
          const f = fy[i] * dt * (fy[i] > 0 ? scale[i] : scale[i + GRID_W]);
          water[i] -= f;
          water[i + GRID_W] += f;
        }
      }
    }
    for (let i = 0; i < N; i++) if (water[i] < 0) water[i] = 0;
  }

  /**
   * Raise terrain in a small brush (dike building). `budget` caps the spent
   * sand (1 sand = 1 meter·cell); returns how much was actually spent.
   */
  raise(cx: number, cy: number, amount: number, budget: number): number {
    let spent = 0;
    const r = 2;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(GRID_H - 1, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(GRID_W - 1, Math.ceil(cx + r)); x++) {
        const d2 = (x - cx) ** 2 + (y - cy) ** 2;
        if (d2 > r * r) continue;
        const i = y * GRID_W + x;
        const want = Math.min(amount * Math.exp(-d2 / 1.4), MAX_TERRAIN - this.terrain[i]);
        const dh = Math.min(want, budget - spent);
        if (dh <= 0) continue;
        this.terrain[i] += dh;
        this.built[i] += dh;
        // Sand dumped into water fills it up rather than lifting it.
        this.water[i] = Math.max(0, this.water[i] - dh);
        spent += dh;
      }
    }
    return spent;
  }

  /** Lower terrain (toy mode digging). */
  lower(cx: number, cy: number, amount: number): void {
    const r = 2;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(GRID_H - 1, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(GRID_W - 1, Math.ceil(cx + r)); x++) {
        const d2 = (x - cx) ** 2 + (y - cy) ** 2;
        if (d2 > r * r) continue;
        const i = y * GRID_W + x;
        this.terrain[i] = Math.max(-6, this.terrain[i] - amount * Math.exp(-d2 / 2));
        this.built[i] = Math.max(0, this.built[i] - amount);
      }
    }
  }

  /** Dump a blob of water (toy mode splashing). */
  splash(cx: number, cy: number): void {
    const r = 3;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(GRID_H - 1, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(GRID_W - 1, Math.ceil(cx + r)); x++) {
        const d2 = (x - cx) ** 2 + (y - cy) ** 2;
        if (d2 > r * r) continue;
        this.water[y * GRID_W + x] += 2.2 * Math.exp(-d2 / 4);
      }
    }
  }

  /** Mark houses standing in deep water as flooded (sticky until resetWater). */
  updateFlooding(): void {
    for (const v of this.villages) {
      for (const h of v.houses) {
        if (!h.flooded && this.water[h.y * GRID_W + h.x] > FLOOD_DEPTH) h.flooded = true;
      }
    }
  }

  /** People currently dry, in thousands (villages count fractionally). */
  savedStats(): { saved: number; total: number; omaDry: boolean } {
    let saved = 0;
    let total = 0;
    let omaDry = true;
    for (const v of this.villages) {
      total += v.pop;
      const dry = v.houses.filter((h) => !h.flooded).length / v.houses.length;
      saved += v.pop * dry;
      if (v.oma && dry < 1) omaDry = false;
    }
    return { saved: Math.round(saved), total, omaDry };
  }

  flux(i: number): number {
    return Math.abs(this.fx[i]) + Math.abs(this.fy[i]);
  }

  // ---- map generation ----

  private generateTerrain(): void {
    const gapMask = (y: number) => {
      let m = 0;
      for (const gy of GAPS) m += Math.exp(-(((y - gy) / 3.2) ** 2));
      return m;
    };
    for (let y = 0; y < GRID_H; y++) {
      const xc = coastX(y);
      // Dune crest = -0.5 base + amp: ~2.3 m in the north (falls in storm 2),
      // ~3.3 m near Den Haag (falls in storm 3), ~4.2 m elsewhere (holds).
      let duneAmp = y < 20 ? 2.8 : y >= 42 && y <= 52 ? 3.8 : 4.7;
      duneAmp *= Math.max(0.06, 1 - gapMask(y));
      for (let x = 0; x < GRID_W; x++) {
        const d = x - xc;
        let t: number;
        if (d < 0) {
          t = -5.5 + 5 * smooth01((d + 9) / 9); // sea floor shelving up to the beach
        } else if (d < 6) {
          t = -0.5;
        } else {
          t = -1.2 + 0.3 * (hash(x, y) - 0.5); // polders below sea level
        }
        t += duneAmp * Math.exp(-(((d - 3) / 2.2) ** 2));
        t += 6.5 * smooth01((d - 46) / 28); // higher ground in the east
        this.terrain[y * GRID_W + x] = t;
      }
    }
    // River corridors through the gaps: low levees beside them and an end cap,
    // so calm sea fills the corridor but stays out of the polders. A surge
    // overtops the 0.7 m levees unless the player reinforces or dams them.
    for (const gy of GAPS) {
      for (let y = gy - 3; y <= gy + 3; y++) {
        const xc = coastX(y);
        const off = Math.abs(y - gy);
        for (let d = 0; d <= 21; d++) {
          const i = y * GRID_W + Math.round(xc + d);
          if (d >= 19) this.terrain[i] = Math.max(this.terrain[i], 0.7);
          else if (off <= 1) this.terrain[i] = Math.min(this.terrain[i], -0.9);
          else if (d >= 2) this.terrain[i] = Math.max(this.terrain[i], 0.7);
        }
      }
    }
    // The Zeeland delta: open water with a couple of low islands, held back
    // from the polders by low banks along its north and east edges.
    for (let y = DELTA_Y; y < GRID_H; y++) {
      const xc = coastX(y);
      for (let x = 0; x < GRID_W; x++) {
        const d = x - xc;
        const i = y * GRID_W + x;
        if (d < 18) this.terrain[i] = Math.min(this.terrain[i], -3.3 + 0.3 * hash(x, y));
        else if (d < 20) this.terrain[i] = Math.max(this.terrain[i], 2.4);
      }
    }
    for (let y = DELTA_Y - 2; y < DELTA_Y; y++) {
      const xc = coastX(y);
      for (let d = 3; d < 20; d++) {
        const i = y * GRID_W + Math.round(xc + d);
        this.terrain[i] = Math.max(this.terrain[i], 2.4);
      }
    }
    const island = (cx: number, cy: number, r: number, h: number) => {
      for (let y = Math.max(0, cy - r - 2); y <= Math.min(GRID_H - 1, cy + r + 2); y++) {
        for (let x = Math.max(0, cx - r - 2); x <= Math.min(GRID_W - 1, cx + r + 2); x++) {
          const d2 = ((x - cx) ** 2 + (y - cy) ** 2) / (r * r);
          const i = y * GRID_W + x;
          this.terrain[i] = Math.max(this.terrain[i], -2.5 + (h + 2.5) * Math.exp(-d2 * 1.8));
        }
      }
    };
    island(48, 73, 6, 1.7); // Middelburg's island
    island(35, 79, 4, 1.3); // Oma's island
  }

  private placeVillages(): void {
    const make = (
      name: string,
      pop: number,
      x: number,
      y: number,
      count: number,
      oma = false,
    ): Village => {
      const houses: House[] = [];
      for (let k = 0; k < count; k++) {
        const angle = (k / count) * Math.PI * 2 + 0.8;
        const r = k === 0 ? 0 : 1.6 + (k % 2);
        let hx = Math.round(x + Math.cos(angle) * r);
        let hy = Math.round(y + Math.sin(angle) * r * 0.8);
        // Nobody builds a house in the river: nudge onto the driest nearby cell.
        if (this.terrain[hy * GRID_W + hx] < -0.2) {
          let best = -10;
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const t = this.terrain[(hy + dy) * GRID_W + hx + dx];
              if (t > best && t < 3) {
                best = t;
                if (t > -0.2) {
                  hx += dx;
                  hy += dy;
                  dy = dx = 3;
                }
              }
            }
          }
        }
        houses.push({ x: hx, y: hy, flooded: false });
      }
      return { name, pop, x, y, houses, oma };
    };
    const at = (dInland: number, y: number) => Math.round(coastX(y) + dInland);
    this.villages = [
      make('Groningen', 230, at(14, 10), 10, 4),
      make('Amsterdam', 900, at(18, 30), 30, 8),
      make('Den Haag', 550, at(7, 47), 47, 6),
      make('Utrecht', 360, at(54, 44), 44, 5),
      make('Rotterdam', 650, at(15, 55), 55, 7),
      make('Middelburg', 50, 48, 73, 3),
      make('Oma 👵', 1, 35, 79, 1, true),
    ];
  }
}
