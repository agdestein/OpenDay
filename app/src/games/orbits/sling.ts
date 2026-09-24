// The model behind "Slingshot" (challenge round 2): Earth on an inner orbit,
// a heavy giant further out, and a golden ring beyond both. Probes launched
// from Earth are too slow to reach the ring on their own (the launch is
// capped below what a direct flight needs); only a close pass behind the
// moving giant throws them out far enough — a gravity assist. Pure (no DOM);
// tests/orbits.test.ts checks that no direct shot arrives and that, for any
// position of the giant, some shots do.
import { SUN_R, TICK, World, type Body, type Kind } from './physics';

export const SLING = {
  seconds: 60,
  probes: 5,
  /** Orbits, as fractions of the scene's half-size R. */
  earthAt: 0.3,
  giantAt: 0.6,
  targetAt: 0.95,
  giantMass: 0.05,
  earthMass: 0.0005,
  /** Largest launch speed, relative to Earth, as a fraction of Earth's orbital speed. */
  cap: 0.16,
  /** A probe still flying after this long is lost. */
  flight: 14,
  /** Passing the giant within this many of its radii takes a photo. */
  photoRange: 4,
  arrive: 200,
  photo: 50,
};

export type SlingEvent =
  | { type: 'arrive'; x: number; y: number }
  | { type: 'photo'; x: number; y: number }
  | { type: 'crash'; x: number; y: number; into: Kind }
  | { type: 'lost'; x: number; y: number };

export type SlingOutcome = 'arrive' | 'crash' | 'short';

interface Probe {
  t: number;
  photo: boolean;
}

export class SlingSim {
  world: World;
  score = 0;
  time = 0;
  left = SLING.probes;
  arrived = 0;
  photos = 0;
  probes = new Map<number, Probe>();
  readonly earthId: number;
  readonly giantId: number;
  private acc = 0;

  constructor(cx: number, cy: number, readonly R: number, readonly u: number, earthAngle: number, giantAngle: number) {
    const gm = 100 * R * R;
    this.world = new World(cx, cy, u, gm);
    this.world.reach = 8 * R;
    this.world.add({ kind: 'star', sun: true, x: cx, y: cy, vx: 0, vy: 0, gm, r: SUN_R * u * 0.85, hue: 45 });
    const circle = (kind: Kind, f: number, a: number, mass: number, r: number, hue: number) => {
      const d = f * R;
      const v = Math.sqrt(gm / d);
      return this.world.add({ kind, x: cx + d * Math.cos(a), y: cy + d * Math.sin(a), vx: -v * Math.sin(a), vy: v * Math.cos(a), gm: mass * gm, r, hue });
    };
    this.earthId = circle('planet', SLING.earthAt, earthAngle, SLING.earthMass, 9 * u, 212).id;
    this.giantId = circle('giant', SLING.giantAt, giantAngle, SLING.giantMass, 17 * u, 28).id;
  }

  private body(id: number): Body | undefined {
    return this.world.bodies.find((b) => b.id === id);
  }

  get earth(): Body | undefined {
    return this.body(this.earthId);
  }

  get giant(): Body | undefined {
    return this.body(this.giantId);
  }

  get sun(): { x: number; y: number } {
    return this.world.bodies.find((b) => b.sun) ?? { x: this.world.cx, y: this.world.cy };
  }

  get over(): boolean {
    return this.time >= SLING.seconds || (this.left === 0 && this.probes.size === 0);
  }

  /** The largest launch speed (relative to Earth). */
  get dvMax(): number {
    return SLING.cap * Math.sqrt(this.world.refGm / (SLING.earthAt * this.R));
  }

  /** A probe leaving Earth with velocity (dvx, dvy) relative to it, just outside its surface. */
  probe(dvx: number, dvy: number, id?: number) {
    const e = this.earth!;
    const dv = Math.hypot(dvx, dvy);
    const ux = dv > 0 ? dvx / dv : e.vx / Math.hypot(e.vx, e.vy);
    const uy = dv > 0 ? dvy / dv : e.vy / Math.hypot(e.vx, e.vy);
    const off = e.r + 5 * this.u;
    return { id, kind: 'pebble' as const, x: e.x + ux * off, y: e.y + uy * off, vx: e.vx + dvx, vy: e.vy + dvy, gm: 0, r: 3 * this.u, hue: 0 };
  }

  /** Clamp a launch to the cap. */
  clampLaunch(dvx: number, dvy: number): { dvx: number; dvy: number } {
    const dv = Math.hypot(dvx, dvy);
    const max = this.dvMax;
    return dv > max ? { dvx: (dvx * max) / dv, dvy: (dvy * max) / dv } : { dvx, dvy };
  }

  launch(dvx: number, dvy: number): boolean {
    if (this.left <= 0 || this.time >= SLING.seconds || !this.earth) return false;
    const c = this.clampLaunch(dvx, dvy);
    const b = this.world.add(this.probe(c.dvx, c.dvy));
    this.probes.set(b.id, { t: 0, photo: false });
    this.left--;
    return true;
  }

  private distFromSun(b: { x: number; y: number }): number {
    const s = this.sun;
    return Math.hypot(b.x - s.x, b.y - s.y);
  }

  /** Advance by dt (fixed physics ticks inside); returns what happened to the probes. */
  step(dt: number): SlingEvent[] {
    const events: SlingEvent[] = [];
    if (this.over) return events;
    this.time += dt;
    const world = this.world;
    this.acc = Math.min(this.acc + dt, 16 * TICK);
    while (this.acc >= TICK) {
      this.acc -= TICK;
      world.step();
    }
    for (const m of world.takeMerges()) {
      if (this.probes.has(m.gone.id)) {
        this.probes.delete(m.gone.id);
        events.push({ type: 'crash', x: m.x, y: m.y, into: m.into.kind });
      }
    }
    const giant = this.giant;
    for (const [id, p] of this.probes) {
      const b = this.body(id);
      if (!b) {
        this.probes.delete(id);
        continue;
      }
      p.t += dt;
      if (giant && !p.photo && Math.hypot(b.x - giant.x, b.y - giant.y) < SLING.photoRange * giant.r) {
        p.photo = true;
        this.photos++;
        this.score += SLING.photo;
        events.push({ type: 'photo', x: b.x, y: b.y });
      }
      if (this.distFromSun(b) > SLING.targetAt * this.R) {
        this.arrived++;
        this.score += SLING.arrive;
        events.push({ type: 'arrive', x: b.x, y: b.y });
        world.remove(b);
        this.probes.delete(id);
      } else if (p.t > SLING.flight) {
        events.push({ type: 'lost', x: b.x, y: b.y });
        world.remove(b);
        this.probes.delete(id);
      }
    }
    return events;
  }

  /** Fly a would-be launch ahead in a copy of the world: its path and how it ends. */
  forecast(dvx: number, dvy: number, every = 6): { pts: { x: number; y: number }[]; outcome: SlingOutcome } {
    if (!this.earth) return { pts: [], outcome: 'short' };
    const c = this.clampLaunch(dvx, dvy);
    const w = this.world.clone();
    const b = w.add(this.probe(c.dvx, c.dvy, -1));
    const pts = [{ x: b.x, y: b.y }];
    const steps = Math.round(SLING.flight / TICK); // the whole flight: the forecast is the probe's fate
    const target = SLING.targetAt * this.R;
    for (let i = 1; i <= steps; i++) {
      w.step();
      const merged = w.takeMerges().find((m) => m.gone.id === b.id);
      if (merged) {
        pts.push({ x: merged.x, y: merged.y });
        return { pts, outcome: 'crash' };
      }
      if (i % every === 0) pts.push({ x: b.x, y: b.y });
      const s = w.bodies.find((x) => x.sun) ?? { x: w.cx, y: w.cy };
      if (Math.hypot(b.x - s.x, b.y - s.y) > target) {
        pts.push({ x: b.x, y: b.y });
        return { pts, outcome: 'arrive' };
      }
    }
    return { pts, outcome: 'short' };
  }
}
