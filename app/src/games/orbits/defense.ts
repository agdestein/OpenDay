// The model behind "Save the Earth" (challenge round): the Sun fixed at the
// origin with GM = 1, Earth on a circle of radius 1 (one year = 2π time
// units), and an asteroid that nobody knows exactly. The asteroid is a cloud
// of possible asteroids, all flown by the same steps; one hidden member is the
// real one, built backwards from an impact so that, left alone, it hits.
// Looking shrinks the cloud around the real one; one push changes the
// velocity of every member at once. Pure and seeded, so tests and the game
// agree (tests/orbits.test.ts).

export interface Rock {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export const DEFENSE = {
  /** Screen seconds per year. */
  yearSeconds: 8,
  /** Years from the start of the round to the (would-be) impact: a half, so Earth
   * is across the Sun from where it starts, and the "impact day" mark stands apart. */
  years: 5.5,
  /** Before the last half year, the real asteroid keeps at least this far from Earth. */
  clearance: 0.2,
  /** The round goes on this long past the impact date, for the fly-by. */
  afterYears: 0.25,
  /** Fixed steps per year (velocity Verlet). */
  stepsPerYear: 400,
  /** Earth's capture radius (Earth + gravitational focusing, toy size). */
  capture: 0.05,
  members: 300,
  /** Relative velocity uncertainty at discovery, and after each look. */
  sigma: [0.012, 0.003, 0.0008, 0.0002],
  /** Years the cloud has already been spreading when the round opens, and after a look
   * (so it shows as a short arc, not a single dot). */
  preSpread: 1,
  lookSpread: 0.4,
  /** Years the telescope needs between two looks. */
  lookCooldown: 0.6,
  /** Largest push (the drag is clamped to it). Earth's orbital speed is 1. */
  dvMax: 0.012,
};

const STEP = (2 * Math.PI) / DEFENSE.stepsPerYear;
const YEAR = 2 * Math.PI;

/** Small seeded generator (Park–Miller), so a round replays exactly. */
export function seeded(seed: number): () => number {
  let s = Math.max(1, Math.floor(seed) % 2147483647);
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function gauss(rand: () => number): number {
  return Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-12))) * Math.cos(2 * Math.PI * rand());
}

/** One velocity-Verlet step around the Sun (time reversible, so it runs backwards too). */
export function stepRock(r: Rock, h: number): void {
  let d2 = r.x * r.x + r.y * r.y;
  let k = -1 / (d2 * Math.sqrt(d2));
  r.vx += 0.5 * h * k * r.x;
  r.vy += 0.5 * h * k * r.y;
  r.x += h * r.vx;
  r.y += h * r.vy;
  d2 = r.x * r.x + r.y * r.y;
  k = -1 / (d2 * Math.sqrt(d2));
  r.vx += 0.5 * h * k * r.x;
  r.vy += 0.5 * h * k * r.y;
}

/** A copy of `r` with its speed scaled by (1 + a) and turned by angle b (both small). */
function perturb(r: Rock, a: number, b: number): Rock {
  const c = Math.cos(b);
  const s = Math.sin(b);
  const vx = (1 + a) * (r.vx * c - r.vy * s);
  const vy = (1 + a) * (r.vx * s + r.vy * c);
  return { x: r.x, y: r.y, vx, vy };
}

export class Defense {
  /** Time since the round started (2π per year), on the fixed step grid. */
  t = 0;
  step = 0;
  readonly impactStep: number;
  readonly endStep: number;
  truth: Rock;
  cloud: Rock[] = [];
  /** Per cloud member: will it hit Earth, flown from now to the end? */
  hits: boolean[] = [];
  looks = 0;
  lastLook = -Infinity;
  pushed = false;
  dv = 0;
  /** Closest the real asteroid came to Earth, and whether it hit. */
  truthMin = Infinity;
  truthHit = false;
  /** Earth's angle at t = 0. */
  phase = 0;
  private rand: () => number;

  constructor(seed: number) {
    this.rand = seeded(seed);
    const rand = this.rand;
    this.impactStep = Math.round(DEFENSE.years * DEFENSE.stepsPerYear);
    this.endStep = Math.round((DEFENSE.years + DEFENSE.afterYears) * DEFENSE.stepsPerYear);
    const TE = this.impactStep * STEP;
    // The impact: at TE the asteroid is at Earth, crossing its orbit with a
    // random radial speed and an orbit a little bigger than Earth's. Drawn
    // again if it would pass close to Earth before the last half year.
    let rock: Rock;
    for (let tries = 0; ; tries++) {
      this.phase = rand() * 2 * Math.PI;
      const [ex, ey] = this.earthAt(TE);
      const a = 1.2 + 0.15 * rand();
      const vr = (rand() < 0.5 ? -1 : 1) * (0.28 + 0.14 * rand());
      const vt = Math.sqrt(Math.max(0.2, 2 - 1 / a - vr * vr));
      rock = { x: ex, y: ey, vx: vr * ex - vt * ey, vy: vr * ey + vt * ex };
      // Fly it back to the start of the round, watching Earth on the way.
      let near = Infinity;
      const quiet = this.impactStep - DEFENSE.stepsPerYear / 2;
      for (let i = this.impactStep - 1; i >= 0; i--) {
        stepRock(rock, -STEP);
        if (i < quiet) {
          const [x, y] = this.earthAt(i * STEP);
          near = Math.min(near, Math.hypot(rock.x - x, rock.y - y));
        }
      }
      if (near > DEFENSE.clearance || tries > 20) break;
    }
    this.truth = { ...rock };
    const pre = Math.round(DEFENSE.preSpread * DEFENSE.stepsPerYear);
    for (let i = 0; i < pre; i++) stepRock(rock, -STEP);
    // Discovery: a cloud of possible asteroids around a guess near the real one,
    // sampled a year ago and flown to now, so it opens already stretched.
    this.cloud = this.sample(rock, DEFENSE.sigma[0]);
    for (const m of this.cloud) for (let i = 0; i < pre; i++) stepRock(m, STEP);
    this.hits = this.forecast();
  }

  earthAt(t: number): [number, number] {
    return [Math.cos(this.phase + t), Math.sin(this.phase + t)];
  }

  get sigma(): number {
    return DEFENSE.sigma[Math.min(this.looks, DEFENSE.sigma.length - 1)];
  }

  get years(): number {
    return this.t / YEAR;
  }

  get yearsLeft(): number {
    return Math.max(0, (this.impactStep - this.step) / DEFENSE.stepsPerYear);
  }

  get over(): boolean {
    return this.truthHit || this.step >= this.endStep;
  }

  get looksLeft(): number {
    return DEFENSE.sigma.length - 1 - this.looks;
  }

  /** Years until the telescope can look again (0 = now). */
  get lookWait(): number {
    return Math.max(0, this.lastLook + DEFENSE.lookCooldown - this.years);
  }

  get canLook(): boolean {
    return this.looksLeft > 0 && this.lookWait === 0 && !this.over && this.step < this.impactStep;
  }

  /** Share of the cloud that will hit Earth. */
  get chance(): number {
    let n = 0;
    for (const h of this.hits) if (h) n++;
    return n / Math.max(1, this.hits.length);
  }

  /** Members sampled around a guess that is itself one sigma off the real rock. */
  private sample(center: Rock, sigma: number): Rock[] {
    const rand = this.rand;
    const guess = perturb(center, sigma * gauss(rand), sigma * gauss(rand));
    const out: Rock[] = [];
    for (let i = 0; i < DEFENSE.members; i++) out.push(perturb(guess, sigma * gauss(rand), sigma * gauss(rand)));
    return out;
  }

  /** One fixed step for Earth, the real asteroid and the cloud. */
  advance(): void {
    if (this.over) return;
    stepRock(this.truth, STEP);
    for (const m of this.cloud) stepRock(m, STEP);
    this.step++;
    this.t = this.step * STEP;
    const [ex, ey] = this.earthAt(this.t);
    const d = Math.hypot(this.truth.x - ex, this.truth.y - ey);
    this.truthMin = Math.min(this.truthMin, d);
    if (d < DEFENSE.capture) this.truthHit = true;
  }

  /** Telescope: the cloud shrinks around the real asteroid (as it is now). */
  look(): boolean {
    if (!this.canLook) return false;
    this.looks++;
    this.lastLook = this.years;
    const back = { ...this.truth };
    const n = Math.round(DEFENSE.lookSpread * DEFENSE.stepsPerYear);
    for (let i = 0; i < n; i++) stepRock(back, -STEP);
    this.cloud = this.sample(back, this.sigma);
    for (const m of this.cloud) for (let i = 0; i < n; i++) stepRock(m, STEP);
    this.hits = this.forecast();
    return true;
  }

  /** Would each member hit Earth if pushed by (dvx, dvy) now? Flies each one to the end. */
  forecast(dvx = 0, dvy = 0, members: Rock[] = this.cloud): boolean[] {
    const cap2 = DEFENSE.capture * DEFENSE.capture;
    const n = this.endStep - this.step;
    // Earth's positions on the step grid, once for all members.
    const earth = new Float64Array(2 * n);
    for (let i = 0; i < n; i++) {
      const [x, y] = this.earthAt((this.step + i + 1) * STEP);
      earth[2 * i] = x;
      earth[2 * i + 1] = y;
    }
    return members.map((m0) => {
      const m = { x: m0.x, y: m0.y, vx: m0.vx + dvx, vy: m0.vy + dvy };
      for (let i = 0; i < n; i++) {
        stepRock(m, STEP);
        const dx = m.x - earth[2 * i];
        const dy = m.y - earth[2 * i + 1];
        if (dx * dx + dy * dy < cap2) return true;
      }
      return false;
    });
  }

  /** The one push: every member (and the real asteroid) gets the same kick. */
  push(dvx: number, dvy: number): void {
    if (this.pushed || this.over) return;
    const dv = Math.hypot(dvx, dvy);
    if (dv > DEFENSE.dvMax) {
      dvx *= DEFENSE.dvMax / dv;
      dvy *= DEFENSE.dvMax / dv;
    }
    this.pushed = true;
    this.dv = Math.min(dv, DEFENSE.dvMax);
    for (const m of [this.truth, ...this.cloud]) {
      m.vx += dvx;
      m.vy += dvy;
    }
    this.hits = this.forecast();
  }

  /** Round score: saving Earth is worth 400, and pushing no harder than needed up to 600 more. */
  score(): number {
    if (this.truthHit) return 50;
    if (!this.pushed) return 400 + 600; // it was never going to hit (not possible in the round, but safe)
    return Math.round(400 + 600 * (1 - this.dv / DEFENSE.dvMax));
  }
}
