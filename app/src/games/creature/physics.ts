// Tiny Verlet physics for stick-and-muscle creatures (no external engine).
// A creature is nodes + sticks; a stick is either a rigid bone or a "muscle"
// whose rest length oscillates as a sine wave. The oscillation parameters are
// the genome that evolution tunes in evolve.ts.

/** Design-time body description (build-mode editor output). Units: meters, y up, ground at y=0. */
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

const GRAVITY = 22; // m/s^2 — heavier than Earth so gaits hug the ground
const ITERATIONS = 10;
const GROUND_FRICTION = 0.75; // fraction of tangential velocity lost on contact
const AIR_DRAG = 0.004;
const MUSCLE_STIFFNESS = 0.4;

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

export function muscleCount(plan: BodyPlan): number {
  return plan.sticks.filter((s) => s.muscle).length;
}

export class Creature {
  pts: Point[] = [];
  sticks: Stick[] = [];
  time = 0;
  /** Fraction of steps so far with at least one node on the ground. */
  contactFraction = 1;
  private steps = 0;
  private contactSteps = 0;

  constructor(
    public plan: BodyPlan,
    public genome: Genome,
  ) {
    // Drop the plan so its lowest node rests exactly on the ground at x=0.
    let minY = Infinity;
    let sumX = 0;
    for (const n of plan.nodes) {
      minY = Math.min(minY, n.y);
      sumX += n.x;
    }
    const dy = NODE_R - minY;
    const dx = -sumX / Math.max(1, plan.nodes.length);
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
  }

  /** Advance one fixed time step. */
  step(): void {
    this.time += FIXED_DT;
    const fall = GRAVITY * FIXED_DT * FIXED_DT;

    for (const p of this.pts) {
      let vx = (p.x - p.px) * (1 - AIR_DRAG);
      const vy = (p.y - p.py) * (1 - AIR_DRAG);
      if (p.y <= NODE_R + 1e-3) vx *= 1 - GROUND_FRICTION;
      p.px = p.x;
      p.py = p.y;
      p.x += vx;
      p.y += vy - fall;
    }

    const omega = 2 * Math.PI * this.genome.freq * this.time;
    for (let iter = 0; iter < ITERATIONS; iter++) {
      for (const s of this.sticks) {
        const pa = this.pts[s.a];
        const pb = this.pts[s.b];
        let rest = s.rest;
        let stiff = 1;
        if (s.muscle >= 0) {
          const gene = this.genome.muscles[s.muscle];
          rest *= 1 + gene.amp * Math.sin(omega + gene.phase);
          stiff = MUSCLE_STIFFNESS;
        }
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const d = Math.hypot(dx, dy) || 1e-9;
        const push = ((d - rest) / d) * 0.5 * stiff;
        pa.x += dx * push;
        pa.y += dy * push;
        pb.x -= dx * push;
        pb.y -= dy * push;
      }
      for (const p of this.pts) if (p.y < NODE_R) p.y = NODE_R;
    }

    this.steps++;
    if (this.pts.some((p) => p.y <= NODE_R + 5e-3)) this.contactSteps++;
    this.contactFraction = this.contactSteps / this.steps;
  }

  /**
   * What evolution optimizes: distance, discounted for time spent flying.
   * Without the discount, evolution reliably discovers glitchy pogo launches
   * instead of anything that reads as walking.
   */
  fitness(): number {
    const x = this.comX();
    if (!isFinite(x) || Math.abs(x) > 1e4) return -999;
    return x * (0.25 + 0.75 * this.contactFraction);
  }

  /** Current visible length of a stick (for drawing muscle contraction). */
  stickStrain(s: Stick): number {
    if (s.muscle < 0) return 0;
    const d = Math.hypot(this.pts[s.a].x - this.pts[s.b].x, this.pts[s.a].y - this.pts[s.b].y);
    return (d - s.rest) / s.rest;
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
}
