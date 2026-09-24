// N-body physics for Gravity Doodle's toy: every body pulls on every other,
// bodies that touch merge (momentum kept), and the whole scene is gently
// re-centred on its centre of mass so it never drifts off screen (a uniform
// shift of everything changes nothing about how the bodies move relative to
// each other). Steps are fixed (velocity Verlet at 1/240 s), independent of
// the frame rate, so the forecast — the same world copied and run ahead — is
// exactly what will happen. Pure: no DOM, tested in tests/orbits.test.ts.

export type Kind = 'pebble' | 'planet' | 'giant' | 'star';

/**
 * How the computer steps time forward: 'smart' is velocity Verlet (kick,
 * drift, kick: symplectic, so energy wobbles but never drifts); 'simple' is
 * Euler's method from 1768 (move with the old speed, then update the speed
 * with the old pull), which invents energy and spirals outward.
 */
export type Method = 'smart' | 'simple';

export interface Body {
  id: number;
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  /** Gravitational parameter G·m, in px³/s². */
  gm: number;
  r: number;
  hue: number;
  /** The first star: never grabbed, reseeded if lost. */
  sun?: boolean;
}

/** One fixed physics step, in seconds. */
export const TICK = 1 / 240;

/** Mass (as a fraction of the Sun's) and radius (in units) per kind. */
export const KINDS: Record<Kind, { mass: number; r: number }> = {
  pebble: { mass: 0.001, r: 7 },
  planet: { mass: 0.005, r: 11 },
  giant: { mass: 0.03, r: 17 },
  star: { mass: 0.6, r: 22 },
};

export const SUN_R = 28;
/** Largest planet radius after merging (units); stars barely grow. */
const MAX_PLANET_R = 26;
const MAX_STAR_R = 36;

export interface Merge {
  /** The body that survives (already updated) and the one swallowed. */
  into: Body;
  gone: Body;
  x: number;
  y: number;
}

export class World {
  bodies: Body[] = [];
  /** Where the centre of mass is pulled to (the screen centre). */
  cx: number;
  cy: number;
  /** Screen scale: radii and the softening length are in units of this many px. */
  unit: number;
  /** The Sun's G·m: the reference for the kinds' masses. */
  refGm: number;
  /** Bodies farther than this from the centre don't count for the re-centring. */
  reach = 4000;
  /** Step size (s) and recipe: the game's are TICK and 'smart'; the step lab changes them. */
  h = TICK;
  method: Method = 'smart';
  /** Merges since the last call to takeMerges (for flashes and sounds). */
  merges: Merge[] = [];
  private nextId = 1;
  private accValid = false;

  constructor(cx: number, cy: number, unit: number, refGm: number) {
    this.cx = cx;
    this.cy = cy;
    this.unit = unit;
    this.refGm = refGm;
  }

  add(b: Omit<Body, 'id' | 'ax' | 'ay'> & { id?: number }): Body {
    const body: Body = { ...b, id: b.id ?? this.nextId++, ax: 0, ay: 0 };
    this.nextId = Math.max(this.nextId, body.id + 1);
    this.bodies.push(body);
    this.accValid = false;
    return body;
  }

  remove(body: Body): void {
    const i = this.bodies.indexOf(body);
    if (i >= 0) this.bodies.splice(i, 1);
    this.accValid = false;
  }

  /** A deep copy (for forecasts): same bodies, same ids. */
  clone(): World {
    const w = new World(this.cx, this.cy, this.unit, this.refGm);
    w.reach = this.reach;
    w.h = this.h;
    w.method = this.method;
    w.nextId = this.nextId;
    w.bodies = this.bodies.map((b) => ({ ...b }));
    w.accValid = this.accValid;
    return w;
  }

  totalGm(): number {
    let m = 0;
    for (const b of this.bodies) m += b.gm;
    return m;
  }

  centreOfMass(): { x: number; y: number; vx: number; vy: number } {
    let m = 0;
    let x = 0;
    let y = 0;
    let vx = 0;
    let vy = 0;
    for (const b of this.bodies) {
      m += b.gm;
      x += b.gm * b.x;
      y += b.gm * b.y;
      vx += b.gm * b.vx;
      vy += b.gm * b.vy;
    }
    if (m === 0) return { x: this.cx, y: this.cy, vx: 0, vy: 0 };
    return { x: x / m, y: y / m, vx: vx / m, vy: vy / m };
  }

  /** The stars' combined pull, as if all at their centre of mass (for outcome labels). */
  stars(): { x: number; y: number; vx: number; vy: number; gm: number } {
    let m = 0;
    let x = 0;
    let y = 0;
    let vx = 0;
    let vy = 0;
    for (const b of this.bodies) {
      if (b.kind !== 'star') continue;
      m += b.gm;
      x += b.gm * b.x;
      y += b.gm * b.y;
      vx += b.gm * b.vx;
      vy += b.gm * b.vy;
    }
    if (m === 0) return { x: this.cx, y: this.cy, vx: 0, vy: 0, gm: 0 };
    return { x: x / m, y: y / m, vx: vx / m, vy: vy / m, gm: m };
  }

  private accelerations(): void {
    const B = this.bodies;
    const n = B.length;
    const s2 = (4 * this.unit) ** 2;
    for (const b of B) {
      b.ax = 0;
      b.ay = 0;
    }
    for (let i = 0; i < n; i++) {
      const a = B[i];
      for (let j = i + 1; j < n; j++) {
        const b = B[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy + s2;
        const inv = 1 / (d2 * Math.sqrt(d2));
        a.ax += b.gm * dx * inv;
        a.ay += b.gm * dy * inv;
        b.ax -= a.gm * dx * inv;
        b.ay -= a.gm * dy * inv;
      }
    }
    this.accValid = true;
  }

  /** One step of size h (kick–drift–kick, or Euler); then merges; then the gentle re-centring. */
  step(): void {
    if (!this.accValid) this.accelerations();
    const h = this.h;
    if (this.method === 'simple') {
      // Euler: move with the old velocity, then change it with the old pull.
      for (const b of this.bodies) {
        b.x += h * b.vx;
        b.y += h * b.vy;
        b.vx += h * b.ax;
        b.vy += h * b.ay;
      }
      this.accelerations();
    } else {
      for (const b of this.bodies) {
        b.vx += 0.5 * h * b.ax;
        b.vy += 0.5 * h * b.ay;
        b.x += h * b.vx;
        b.y += h * b.vy;
      }
      this.accelerations();
      for (const b of this.bodies) {
        b.vx += 0.5 * h * b.ax;
        b.vy += 0.5 * h * b.ay;
      }
    }
    this.collide();
    this.recentre();
  }

  /** Total energy, kinetic + potential, with G = 1 and gm as the mass (for tests and the step lab). */
  energy(): number {
    const B = this.bodies;
    const s2 = (4 * this.unit) ** 2;
    let e = 0;
    for (let i = 0; i < B.length; i++) {
      const a = B[i];
      e += 0.5 * a.gm * (a.vx * a.vx + a.vy * a.vy);
      for (let j = i + 1; j < B.length; j++) {
        const b = B[j];
        e -= (a.gm * b.gm) / Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + s2);
      }
    }
    return e;
  }

  private collide(): void {
    const B = this.bodies;
    for (let i = 0; i < B.length; i++) {
      for (let j = i + 1; j < B.length; j++) {
        const a = B[i];
        const b = B[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const rr = a.r + b.r;
        if (dx * dx + dy * dy >= rr * rr) continue;
        this.merge(a, b);
        j = i; // a changed: check it against everything again
      }
    }
  }

  /** a and b become one body: mass and momentum kept, at their centre of mass. */
  private merge(a: Body, b: Body): void {
    // The heavier one (or the Sun) survives and keeps its identity and colour.
    const keepA = a.sun || (!b.sun && a.gm >= b.gm);
    const into = keepA ? a : b;
    const gone = keepA ? b : a;
    const m = a.gm + b.gm;
    // Weights by mass; two massless bodies (probes) just meet halfway.
    const wa = m > 0 ? a.gm / m : 0.5;
    const wb = 1 - wa;
    const x = wa * a.x + wb * b.x;
    const y = wa * a.y + wb * b.y;
    into.vx = wa * a.vx + wb * b.vx;
    into.vy = wa * a.vy + wb * b.vy;
    into.x = x;
    into.y = y;
    const u = this.unit;
    if (a.kind === 'star' || b.kind === 'star') {
      into.kind = 'star';
      const big = Math.max(a.r, b.r);
      into.r = Math.max(big, Math.min(big + 0.15 * Math.min(a.r, b.r), MAX_STAR_R * u));
    } else {
      const big = Math.max(a.r, b.r);
      into.r = Math.max(big, Math.min(Math.cbrt(a.r ** 3 + b.r ** 3), MAX_PLANET_R * u));
      if (into.kind !== 'giant' && m >= 0.8 * KINDS.giant.mass * this.refGm) into.kind = 'giant';
    }
    into.gm = m;
    this.remove(gone);
    this.merges.push({ into, gone, x, y });
  }

  /**
   * Nudge the centre of mass of the bodies near the screen back to the
   * screen centre, and take away its drift. Everything moves by the same
   * amount, so the bodies' motion relative to each other is untouched.
   */
  private recentre(): void {
    let m = 0;
    let x = 0;
    let y = 0;
    let vx = 0;
    let vy = 0;
    const reach = this.reach;
    for (const b of this.bodies) {
      if (Math.abs(b.x - this.cx) > reach || Math.abs(b.y - this.cy) > reach) continue;
      m += b.gm;
      x += b.gm * b.x;
      y += b.gm * b.y;
      vx += b.gm * b.vx;
      vy += b.gm * b.vy;
    }
    if (m === 0) return;
    const k = Math.min(0.5, (0.004 * this.h) / TICK); // ~1/e in a second, whatever the step
    const sx = k * (this.cx - x / m);
    const sy = k * (this.cy - y / m);
    const svx = -k * (vx / m);
    const svy = -k * (vy / m);
    for (const b of this.bodies) {
      b.x += sx;
      b.y += sy;
      b.vx += svx;
      b.vy += svy;
    }
  }

  takeMerges(): Merge[] {
    const m = this.merges;
    this.merges = [];
    return m;
  }
}

export type Outcome = 'orbit' | 'far' | 'escape' | 'crash' | 'merge';

export interface Forecast {
  pts: { x: number; y: number }[];
  outcome: Outcome;
}

/**
 * Fly a copy of the world ahead and follow one body (by id): its path, and
 * how its story ends — into a star, into a planet, off for good, a huge
 * orbit, or an orbit. `limit` is how far from the centre counts as gone.
 */
export function forecast(world: World, id: number, steps: number, every: number, limit: number): Forecast {
  const w = world.clone();
  const body = () => w.bodies.find((b) => b.id === id);
  const start = body();
  if (!start) return { pts: [], outcome: 'orbit' };
  const pts = [{ x: start.x, y: start.y }];
  for (let i = 1; i <= steps; i++) {
    w.step();
    for (const m of w.takeMerges()) {
      if (m.gone.id === id || m.into.id === id) {
        const other = m.gone.id === id ? m.into : m.gone;
        pts.push({ x: m.x, y: m.y });
        // Swallowing a pebble is no end to a planet's story; being swallowed is.
        if (m.gone.id === id) return { pts, outcome: other.kind === 'star' ? 'crash' : 'merge' };
      }
    }
    const b = body();
    if (!b) return { pts, outcome: 'crash' };
    if (i % every === 0) pts.push({ x: b.x, y: b.y });
    if (Math.hypot(b.x - w.cx, b.y - w.cy) > limit) break;
  }
  const b = body()!;
  // Bound or not, measured against the stars as one mass at their centre.
  const s = w.stars();
  if (s.gm === 0) return { pts, outcome: 'escape' };
  const dx = b.x - s.x;
  const dy = b.y - s.y;
  const dvx = b.vx - s.vx;
  const dvy = b.vy - s.vy;
  const r = Math.hypot(dx, dy);
  const mu = s.gm + b.gm;
  const energy = (dvx * dvx + dvy * dvy) / 2 - mu / r;
  if (energy >= 0) return { pts, outcome: 'escape' };
  const h = dx * dvy - dy * dvx;
  const a = -mu / (2 * energy);
  const e = Math.sqrt(Math.max(0, 1 + (2 * energy * h * h) / (mu * mu)));
  return { pts, outcome: a * (1 + e) > limit ? 'far' : 'orbit' };
}
