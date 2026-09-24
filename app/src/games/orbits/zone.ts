// The model behind "Goldilocks" (challenge round 1): the Sun, a giant outside
// the green zone, and the planets the player throws. Life grows on a planet
// for every second it spends in the zone (🌱 → 🌿 → 🌳 → 🦕); a collision melts
// it away. The score is the life alive right now, so it can go down: a crowd
// that keeps bumping loses what it grew. Pure (no DOM), so
// tests/orbits.test.ts plays it with bots: one planet 250, two or three calm
// ones ≈ 400–500, six crowded together ≈ 300–400.
import { forecast, SUN_R, TICK, World, type Body, type Kind } from './physics';

export const ZONE = {
  /** Simulated seconds (at PACE.zone ≈ a minute of play). */
  seconds: 40,
  planets: 6,
  /** The zone, as fractions of the scene's half-size R. */
  inner: 0.3,
  outer: 0.58,
  giantAt: 0.95,
  /** Masses (fractions of the Sun's) and planet radius (units): lighter and
   * smaller than the toy's, or no two planets could share a zone this narrow. */
  giantMass: 0.005,
  planetMass: 0.001,
  planetR: 7,
  /** Simulated seconds in the zone for each stage of life, and what a planet at that stage is worth. */
  stages: [6, 12, 18, 24],
  worth: [25, 75, 150, 250],
};

/** The computer's plan in its turn: two calm planets, early, well apart (simulated s, fractions of R). */
export const CPU_ZONE = { times: [0.4, 2.4], radii: [0.38, 0.5] };

export type ZoneEvent =
  | { type: 'stage'; body: Body; stage: number; points: number }
  | { type: 'merge'; x: number; y: number; hue: number; r: number; into: Kind; lost: number };

export class ZoneSim {
  world: World;
  time = 0;
  left = ZONE.planets;
  /** Seconds each planet has spent in the zone since its last collision. */
  life = new Map<number, number>();
  private acc = 0;

  constructor(cx: number, cy: number, readonly R: number, readonly u: number, giantAngle: number) {
    const gm = 100 * R * R;
    this.world = new World(cx, cy, u, gm);
    this.world.reach = 8 * R;
    this.world.add({ kind: 'star', sun: true, x: cx, y: cy, vx: 0, vy: 0, gm, r: SUN_R * u * 0.85, hue: 45 });
    const r = ZONE.giantAt * R;
    const v = Math.sqrt(gm / r);
    this.world.add({
      kind: 'giant',
      x: cx + r * Math.cos(giantAngle),
      y: cy + r * Math.sin(giantAngle),
      vx: -v * Math.sin(giantAngle),
      vy: v * Math.cos(giantAngle),
      gm: ZONE.giantMass * gm,
      r: 16 * u,
      hue: 28,
    });
  }

  get over(): boolean {
    return this.time >= ZONE.seconds;
  }

  get sun(): { x: number; y: number } {
    return this.world.bodies.find((b) => b.sun) ?? { x: this.world.cx, y: this.world.cy };
  }

  inZone(x: number, y: number): boolean {
    const s = this.sun;
    const d = Math.hypot(x - s.x, y - s.y);
    return d > ZONE.inner * this.R && d < ZONE.outer * this.R;
  }

  /** The life alive right now: what every planet's stage is worth. */
  get score(): number {
    let sum = 0;
    for (const b of this.world.bodies) if (b.kind === 'planet') sum += this.worth(b.id);
    return sum;
  }

  worth(id: number): number {
    const stage = this.stageOf(id);
    return stage > 0 ? ZONE.worth[stage - 1] : 0;
  }

  /** Seconds of life → stage (0 = none yet, 4 = 🦕). */
  stageOf(id: number): number {
    const t = this.life.get(id) ?? 0;
    return ZONE.stages.filter((st) => t >= st).length;
  }

  planet(x: number, y: number, vx: number, vy: number, hue: number, id?: number) {
    return { id, kind: 'planet' as const, x, y, vx, vy, gm: ZONE.planetMass * this.world.refGm, r: ZONE.planetR * this.u, hue };
  }

  throw(x: number, y: number, vx: number, vy: number, hue = 200): boolean {
    if (this.left <= 0 || this.over) return false;
    this.world.add(this.planet(x, y, vx, vy, hue));
    this.left--;
    return true;
  }

  /**
   * The computer's throw: a circle at radius f·R, at the first of 16 angles
   * whose 10 s forecast is a plain orbit (no collision).
   */
  cpuThrow(f: number): { x: number; y: number; vx: number; vy: number } | null {
    const s = this.sun;
    const r = f * this.R;
    const v = Math.sqrt(this.world.refGm / r);
    for (let i = 0; i < 16; i++) {
      const a = -Math.PI / 2 + (i / 16) * 2 * Math.PI;
      const t = { x: s.x + r * Math.cos(a), y: s.y + r * Math.sin(a), vx: -v * Math.sin(a), vy: v * Math.cos(a) };
      const copy = this.world.clone();
      const b = copy.add(this.planet(t.x, t.y, t.vx, t.vy, 0, -1));
      if (forecast(copy, b.id, Math.round(10 / TICK), 30, 4 * this.R).outcome === 'orbit') return t;
    }
    return null;
  }

  /** Advance by dt (fixed physics ticks inside); returns what happened. */
  step(dt: number): ZoneEvent[] {
    const events: ZoneEvent[] = [];
    if (this.over) return events;
    this.time += dt;
    const world = this.world;
    this.acc = Math.min(this.acc + dt, 16 * TICK);
    while (this.acc >= TICK) {
      this.acc -= TICK;
      world.step();
    }
    for (const m of world.takeMerges()) {
      // Both planets' life melts in the crash.
      const lost = this.worth(m.gone.id) + (m.into.kind === 'planet' ? this.worth(m.into.id) : 0);
      this.life.delete(m.gone.id);
      if (m.into.kind === 'planet') this.life.set(m.into.id, 0);
      events.push({ type: 'merge', x: m.x, y: m.y, hue: m.gone.hue, r: m.gone.r, into: m.into.kind, lost });
    }
    for (const b of [...world.bodies]) {
      if (!Number.isFinite(b.x + b.y) || Math.hypot(b.x - world.cx, b.y - world.cy) > 6 * this.R) world.remove(b);
    }
    for (const b of world.bodies) {
      if (b.kind !== 'planet' || !this.inZone(b.x, b.y)) continue;
      const t0 = this.life.get(b.id) ?? 0;
      const t1 = t0 + dt;
      this.life.set(b.id, t1);
      ZONE.stages.forEach((st, i) => {
        if (t0 < st && t1 >= st) events.push({ type: 'stage', body: b, stage: i, points: ZONE.worth[i] - (i > 0 ? ZONE.worth[i - 1] : 0) });
      });
    }
    return events;
  }
}
