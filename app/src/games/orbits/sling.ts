// The model behind "Slingshot" (challenge round 2): Earth on an inner orbit,
// a heavy giant further out, and a golden ring beyond both. Probes launched
// from Earth are too slow to reach the ring on their own (the launch is
// capped below what a direct flight needs); only a close pass behind the
// moving giant throws them out far enough — a gravity assist. The Sun, Earth
// and the giant move on rails (known circular orbits) and only the probes are
// simulated, as mission planners do: with everything free, the heavy giant
// dragged Earth off its orbit within a minute and into the Sun. Pure (no
// DOM); tests/orbits.test.ts checks that no direct shot arrives, that for any
// position of the giant some shots do, and that Earth stays put.
import { SUN_R, TICK, World, type Body, type Kind } from './physics';

export const SLING = {
  /** Simulated seconds (at PACE.sling ≈ a minute of play). */
  seconds: 32,
  probes: 5,
  /** Orbits, as fractions of the scene's half-size R. */
  earthAt: 0.3,
  giantAt: 0.6,
  targetAt: 0.95,
  giantMass: 0.05,
  earthMass: 0.0005,
  /** Largest launch speed, relative to Earth, as a fraction of Earth's orbital speed. */
  cap: 0.16,
  /** A probe still flying after this long (simulated seconds) is lost. */
  flight: 12,
  /** Passing the giant within this many of its radii takes a photo. */
  photoRange: 4,
  arrive: 200,
  /** An arrival flown by the computer when the player asked it to. */
  arriveHelped: 100,
  photo: 50,
};

/**
 * How hard the computer searches: in its own turn it tries fewer routes and
 * waits longer between launches (so a good player can beat it); flying a
 * probe for the player it tries them all.
 */
export const CPU_SLING = { dirs: 24, strengths: [1, 0.75], pause: 2 };
export const HELP_SLING = { dirs: 48, strengths: [1, 0.85, 0.7, 0.55] };

export interface Route {
  dvx: number;
  dvy: number;
  pts: { x: number; y: number }[];
  outcome: SlingOutcome;
}

/** The launches the computer tries: `dirs` directions round the compass, at a few strengths. */
export function candidates(sim: SlingSim, dirs = 48, strengths = [1, 0.85, 0.7, 0.55]): { dvx: number; dvy: number }[] {
  const out: { dvx: number; dvy: number }[] = [];
  for (let i = 0; i < dirs; i++) {
    const a = (i / dirs) * 2 * Math.PI;
    for (const f of strengths) out.push({ dvx: f * sim.dvMax * Math.cos(a), dvy: f * sim.dvMax * Math.sin(a) });
  }
  return out;
}

/** Of the routes tried, the one that arrives with the gentlest launch (or null). */
export function bestRoute(routes: Route[]): Route | null {
  let best: Route | null = null;
  for (const r of routes) {
    if (r.outcome !== 'arrive') continue;
    if (!best || Math.hypot(r.dvx, r.dvy) < Math.hypot(best.dvx, best.dvy)) best = r;
  }
  return best;
}

export type SlingEvent =
  | { type: 'arrive'; x: number; y: number; points: number }
  | { type: 'photo'; x: number; y: number }
  | { type: 'crash'; x: number; y: number; into: Kind }
  | { type: 'lost'; x: number; y: number };

export type SlingOutcome = 'arrive' | 'crash' | 'short';

interface Probe {
  t: number;
  photo: boolean;
  /** Flown by the computer for the player: its arrival scores less. */
  helped: boolean;
}

export class SlingSim {
  world: World;
  score = 0;
  time = 0;
  left = SLING.probes;
  arrived = 0;
  /** Arrivals the computer flew for the player. */
  helpedArrived = 0;
  photos = 0;
  probes = new Map<number, Probe>();
  readonly earthId: number;
  readonly giantId: number;
  private acc = 0;

  constructor(cx: number, cy: number, readonly R: number, readonly u: number, earthAngle: number, giantAngle: number) {
    const gm = 100 * R * R;
    this.world = new World(cx, cy, u, gm);
    this.world.reach = -1; // everything heavy is on rails: nothing to re-centre
    this.world.add({ kind: 'star', sun: true, x: cx, y: cy, vx: 0, vy: 0, gm, r: SUN_R * u * 0.85, hue: 45, rail: { cx, cy, r: 0, w: 0, phase: 0 } });
    const circle = (kind: Kind, f: number, a: number, mass: number, r: number, hue: number) => {
      const d = f * R;
      const v = Math.sqrt(gm / d);
      const rail = { cx, cy, r: d, w: v / d, phase: a };
      return this.world.add({ kind, x: cx + d * Math.cos(a), y: cy + d * Math.sin(a), vx: -v * Math.sin(a), vy: v * Math.cos(a), gm: mass * gm, r, hue, rail });
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

  /** No more launches once time is up or the probes are spent; probes in flight still finish. */
  get over(): boolean {
    return (this.time >= SLING.seconds || this.left === 0) && this.probes.size === 0;
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

  launch(dvx: number, dvy: number, helped = false): boolean {
    if (this.left <= 0 || this.time >= SLING.seconds || !this.earth) return false;
    const c = this.clampLaunch(dvx, dvy);
    const b = this.world.add(this.probe(c.dvx, c.dvy));
    this.probes.set(b.id, { t: 0, photo: false, helped });
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
    for (const b of [...world.bodies]) if (!Number.isFinite(b.x + b.y + b.vx + b.vy)) world.remove(b);
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
        if (p.helped) this.helpedArrived++;
        const points = p.helped ? SLING.arriveHelped : SLING.arrive;
        this.score += points;
        events.push({ type: 'arrive', x: b.x, y: b.y, points });
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
  forecast(dvx: number, dvy: number, every = 6): Route {
    if (!this.earth) return { dvx, dvy, pts: [], outcome: 'short' };
    const c = this.clampLaunch(dvx, dvy);
    const w = this.world.clone();
    // Other probes are massless: they can't bend this one's path, so leave them out (much faster).
    w.bodies = w.bodies.filter((o) => o.gm > 0);
    const b = w.add(this.probe(c.dvx, c.dvy, -1));
    const pts = [{ x: b.x, y: b.y }];
    const steps = Math.round(SLING.flight / TICK); // the whole flight: the forecast is the probe's fate
    const target = SLING.targetAt * this.R;
    for (let i = 1; i <= steps; i++) {
      w.step();
      const merged = w.takeMerges().find((m) => m.gone.id === b.id);
      if (merged) {
        pts.push({ x: merged.x, y: merged.y });
        return { dvx, dvy, pts, outcome: 'crash' };
      }
      if (i % every === 0) pts.push({ x: b.x, y: b.y });
      const s = w.bodies.find((x) => x.sun) ?? { x: w.cx, y: w.cy };
      if (Math.hypot(b.x - s.x, b.y - s.y) > target) {
        pts.push({ x: b.x, y: b.y });
        return { dvx, dvy, pts, outcome: 'arrive' };
      }
    }
    return { dvx, dvy, pts, outcome: 'short' };
  }
}
