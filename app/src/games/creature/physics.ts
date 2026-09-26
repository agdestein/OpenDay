// Tiny Verlet physics for stick-and-muscle creatures (no external engine).
// A creature is nodes + sticks; a stick is either a rigid bone or a "muscle"
// whose rest length oscillates as a sine wave. The oscillation parameters are
// the genome that evolution tunes in evolve.ts.
//
// Muscles have a speed limit, like real ones. Without it (the first version of
// this game) evolution found out within minutes: stick-men learned to
// cartwheel and a 1.4 m worm to leap 5 m, its head at ~100 km/h. The delve's
// 🐞 switch brings those old muscles back (`oldMuscles`).
//
// The ground is flat, or a height function g(x) for the bumpy courses.

/** Design-time body description (editor output). Units: meters, y up, ground at y=0. */
export interface PlanNode {
  x: number;
  y: number;
}

export interface PlanStick {
  a: number;
  b: number;
  muscle: boolean;
}

export interface BodyPlan {
  /** nodes[0] is the head (gets the googly eye). */
  nodes: PlanNode[];
  sticks: PlanStick[];
  /** A preset's id, or 'Own' for a drawn or edited body (crowns are per kind). */
  kind?: string;
}

export interface MuscleGene {
  /** Relative length swing, 0..MAX_AMP. */
  amp: number;
  /** Phase offset in radians. */
  phase: number;
}

/** One creature brain: a sine oscillator per muscle plus a shared clock. */
export interface Genome {
  /** Shared oscillation frequency in Hz. */
  freq: number;
  /** Aligned with the plan's muscle sticks in order of appearance. */
  muscles: MuscleGene[];
}

export const FIXED_DT = 1 / 120;
export const NODE_R = 0.07;
export const MAX_AMP = 0.3;
/** How fast a muscle may pull or push its ends (m/s). */
export const MUSCLE_SPEED = 2.4;

const GRAVITY = 22; // m/s^2 — heavier than Earth so gaits hug the ground
const ITERATIONS = 10;
const GROUND_FRICTION = 0.75; // fraction of tangential velocity lost on contact
const AIR_DRAG = 0.004;
const MUSCLE_STIFFNESS = 0.4;
/** The most a muscle may move each end in one constraint iteration. */
const MUSCLE_STEP = (MUSCLE_SPEED * FIXED_DT) / ITERATIONS;
/** A dot this close to the ground counts as touching it. */
const CONTACT = 5e-3;

/** Ground height (m) at world x. */
export type Ground = (x: number) => number;
export const FLAT: Ground = () => 0;

/**
 * A bumpy course: Gaussian bumps (and a few dips) from x = 1.5 m on, the
 * same for the same seed. Sampled into a table so the physics can afford it.
 */
export function bumpyGround(seed: number, amp = 0.2): Ground {
  let s = seed >>> 0 || 1;
  const rand = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const bumps: { c: number; h: number; w: number }[] = [];
  for (let x = 1.5; x < 120; x += 0.8 + rand() * 1.6) {
    bumps.push({ c: x, h: (0.3 + 0.7 * rand()) * amp * (rand() < 0.25 ? -0.6 : 1), w: 0.25 + rand() * 0.6 });
  }
  const X0 = -10;
  const X1 = 130;
  const DX = 0.02;
  const n = Math.round((X1 - X0) / DX) + 1;
  const table = new Float64Array(n);
  for (const b of bumps) {
    const i0 = Math.max(0, Math.floor((b.c - 3 * b.w - X0) / DX));
    const i1 = Math.min(n - 1, Math.ceil((b.c + 3 * b.w - X0) / DX));
    for (let i = i0; i <= i1; i++) {
      const d = (X0 + i * DX - b.c) / b.w;
      table[i] += b.h * Math.exp(-d * d);
    }
  }
  return (x) => {
    const f = (x - X0) / DX;
    if (!(f >= 0 && f < n - 1)) return 0;
    const i = Math.floor(f);
    return table[i] + (table[i + 1] - table[i]) * (f - i);
  };
}

interface Point {
  x: number;
  y: number;
  px: number;
  py: number;
}

interface Stick {
  a: number;
  b: number;
  rest: number;
  /** Index into genome.muscles, or -1 for a rigid bone. */
  muscle: number;
}

export interface CreatureOptions {
  ground?: Ground;
  /** Muscles without the speed limit (the delve's 🐞 switch). */
  oldMuscles?: boolean;
  /** World x where the creature's centre starts (default 0). */
  x?: number;
  /** Extra height to drop it from (m). */
  lift?: number;
}

export function muscleCount(plan: BodyPlan): number {
  return plan.sticks.filter((s) => s.muscle).length;
}

export class Creature {
  pts: Point[] = [];
  sticks: Stick[] = [];
  time = 0;
  ground: Ground;
  oldMuscles: boolean;
  /** Where the centre started: distances are measured from here. */
  readonly startX: number;
  steps = 0;
  airSteps = 0;
  /** Whether some dot touched the ground in the last step. */
  touching = true;
  /** How far the centre moved while some dot touched the ground (race-walk judging). */
  groundDist = 0;
  /** The best jump: the lowest dot's highest clearance above the ground (m). */
  bestClear = 0;
  /** How far the head has turned around the centre (radians, unwrapped): cartwheels. */
  turn = 0;
  /** A dot held by the mouse, pinned to (x, y). */
  pin: { i: number; x: number; y: number } | null = null;
  private lastAngle: number;

  constructor(
    public plan: BodyPlan,
    public genome: Genome,
    opts: CreatureOptions = {},
  ) {
    this.ground = opts.ground ?? FLAT;
    this.oldMuscles = opts.oldMuscles ?? false;
    // Drop the plan so its lowest node rests on the ground, centred on x.
    let minY = Infinity;
    let sumX = 0;
    for (const n of plan.nodes) {
      minY = Math.min(minY, n.y);
      sumX += n.x;
    }
    const x0 = opts.x ?? 0;
    const dx = x0 - sumX / Math.max(1, plan.nodes.length);
    let floor = -Infinity;
    for (const n of plan.nodes) floor = Math.max(floor, this.ground(n.x + dx));
    const dy = NODE_R - minY + floor + (opts.lift ?? 0);
    for (const n of plan.nodes) {
      const x = n.x + dx;
      const y = n.y + dy;
      this.pts.push({ x, y, px: x, py: y });
    }
    let m = 0;
    for (const s of plan.sticks) {
      const rest = Math.hypot(plan.nodes[s.a].x - plan.nodes[s.b].x, plan.nodes[s.a].y - plan.nodes[s.b].y);
      this.sticks.push({ a: s.a, b: s.b, rest: Math.max(rest, 0.05), muscle: s.muscle ? m++ : -1 });
    }
    this.startX = this.comX();
    this.lastAngle = this.headAngle();
  }

  /** Advance one fixed time step. */
  step(): void {
    this.time += FIXED_DT;
    const fall = GRAVITY * FIXED_DT * FIXED_DT;
    const ground = this.ground;
    const x0 = this.comX();

    for (const p of this.pts) {
      let vx = (p.x - p.px) * (1 - AIR_DRAG);
      const vy = (p.y - p.py) * (1 - AIR_DRAG);
      if (p.y <= ground(p.x) + NODE_R + 1e-3) vx *= 1 - GROUND_FRICTION;
      p.px = p.x;
      p.py = p.y;
      p.x += vx;
      p.y += vy - fall;
    }

    const omega = 2 * Math.PI * this.genome.freq * this.time;
    const limit = this.oldMuscles ? Infinity : MUSCLE_STEP;
    const pin = this.pin;
    for (let iter = 0; iter < ITERATIONS; iter++) {
      for (const s of this.sticks) {
        const pa = this.pts[s.a];
        const pb = this.pts[s.b];
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const d = Math.hypot(dx, dy) || 1e-9;
        let push: number;
        if (s.muscle >= 0) {
          const gene = this.genome.muscles[s.muscle];
          const rest = s.rest * (1 + gene.amp * Math.sin(omega + gene.phase));
          // Each end moves (d - rest)/2 · stiffness, at most `limit`.
          const move = (d - rest) * 0.5 * MUSCLE_STIFFNESS;
          push = Math.max(-limit, Math.min(limit, move)) / d;
        } else {
          push = ((d - s.rest) / d) * 0.5;
        }
        pa.x += dx * push;
        pa.y += dy * push;
        pb.x -= dx * push;
        pb.y -= dy * push;
      }
      for (const p of this.pts) {
        const g = ground(p.x) + NODE_R;
        if (p.y < g) p.y = g;
      }
      if (pin) {
        const p = this.pts[pin.i];
        p.x = pin.x;
        p.y = Math.max(pin.y, ground(pin.x) + NODE_R);
      }
    }

    this.steps++;
    let clear = Infinity;
    for (const p of this.pts) clear = Math.min(clear, p.y - ground(p.x) - NODE_R);
    this.touching = clear <= CONTACT;
    if (this.touching) this.groundDist += this.comX() - x0;
    else this.airSteps++;
    if (clear > this.bestClear && isFinite(clear)) this.bestClear = clear;
    const angle = this.headAngle();
    let d = angle - this.lastAngle;
    if (d > Math.PI) d -= 2 * Math.PI;
    else if (d < -Math.PI) d += 2 * Math.PI;
    this.turn += d;
    this.lastAngle = angle;
  }

  /** Let go of the mouse: the held dot keeps the hand's velocity (m/s, clamped). */
  release(vx: number, vy: number, maxSpeed = 12): void {
    if (!this.pin) return;
    const p = this.pts[this.pin.i];
    const speed = Math.hypot(vx, vy);
    const k = speed > maxSpeed ? maxSpeed / speed : 1;
    p.px = p.x - vx * k * FIXED_DT;
    p.py = p.y - vy * k * FIXED_DT;
    this.pin = null;
  }

  /** Move the whole creature sideways, velocities kept (the park wraps round). */
  shift(dx: number): void {
    for (const p of this.pts) {
      p.x += dx;
      p.px += dx;
    }
    (this as { startX: number }).startX += dx;
  }

  /** Kick every dot (m/s), e.g. a startle. */
  kick(vx: number, vy: number): void {
    for (const p of this.pts) {
      p.px -= vx * FIXED_DT;
      p.py -= vy * FIXED_DT;
    }
  }

  /** Current visible length of a stick relative to its rest (for drawing muscle contraction). */
  stickStrain(s: Stick): number {
    if (s.muscle < 0) return 0;
    const d = Math.hypot(this.pts[s.a].x - this.pts[s.b].x, this.pts[s.a].y - this.pts[s.b].y);
    return (d - s.rest) / s.rest;
  }

  /** Metres travelled since the start (forward is +x). */
  dist(): number {
    return this.comX() - this.startX;
  }

  /** Share of the steps so far with no dot on the ground. */
  airborne(): number {
    return this.airSteps / Math.max(1, this.steps);
  }

  /** Full turns of the head around the centre (cartwheels). */
  turns(): number {
    return Math.abs(this.turn) / (2 * Math.PI);
  }

  finite(): boolean {
    for (const p of this.pts) if (!Number.isFinite(p.x + p.y + p.px + p.py)) return false;
    return true;
  }

  comX(): number {
    let x = 0;
    for (const p of this.pts) x += p.x;
    return x / this.pts.length;
  }

  comY(): number {
    let y = 0;
    for (const p of this.pts) y += p.y;
    return y / this.pts.length;
  }

  private headAngle(): number {
    const h = this.pts[0];
    return Math.atan2(h.y - this.comY(), h.x - this.comX());
  }
}

/** Run a creature for `seconds` of simulated time. */
export function simulate(plan: BodyPlan, genome: Genome, seconds: number, opts?: CreatureOptions): Creature {
  const c = new Creature(plan, genome, opts);
  const n = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < n; i++) c.step();
  return c;
}
