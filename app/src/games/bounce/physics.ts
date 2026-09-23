// Ball Pit physics: discs in a box under gravity, position-based. Each frame
// is split into short substeps; each substep moves the balls, pushes
// overlapping pairs apart by mass (two passes), reads the velocity off how far
// each ball actually moved, and finally bounces touching pairs off each other
// (restitution, friction). Because velocity comes from real motion, a resting
// pile really rests. A uniform grid finds neighbours, so the cost grows with
// the number of balls, not with the number of pairs. DOM-free so node tests
// can run it.

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Mass, proportional to area (r²). */
  m: number;
  hue: number;
  gold: boolean;
  /** Plinko twins (1, 2) never touch each other; 0 for everyone else. */
  twin: number;
  /** Position and velocity at the start of the substep (solver scratch). */
  px: number;
  py: number;
  ux: number;
  uy: number;
}

export interface Circle {
  x: number;
  y: number;
  r: number;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The pointer as a kinematic disc that shoves balls aside. */
export interface Hand {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  active: boolean;
}

/**
 * A heavy lid across the whole box that slides up and down only; the balls
 * underneath hold it up by drumming on it (round 3's steam engine).
 */
export interface Piston {
  y: number;
  vy: number;
  mass: number;
  active: boolean;
  /** Highest and lowest the lid can go (stops). */
  minY: number;
  maxY: number;
  /** Solver scratch. */
  py: number;
  uy: number;
}

/** Restitution at walls when motion is allowed to turn into heat. */
export const WALL_RESTITUTION = 0.82;
/** Restitution between balls when motion is allowed to turn into heat. */
export const BALL_RESTITUTION = 0.9;
/** Sliding speed kept per wall touch with friction on (the delve's 0.96). */
export const WALL_FRICTION = 0.96;
/** Per-second decay of rolling speed on the floor with friction on. */
const ROLL_FRICTION = 1.6;
const HAND_RESTITUTION = 0.3;
const SUBSTEP = 1 / 240;
const PASSES = 2;
/** Contacts this close (px) still count in the velocity pass. */
const SLOP = 0.5;
/** Fraction of an overlap removed per pass (a little under 1 avoids ringing). */
const RELAX = 0.8;
/** Half thickness of static segments. */
const SEG_R = 2;

export class BallWorld {
  balls: Ball[] = [];
  pegs: Circle[] = [];
  segments: Segment[] = [];
  hand: Hand = { x: 0, y: 0, vx: 0, vy: 0, r: 0, active: false };
  piston: Piston = { y: 0, vy: 0, mass: 1, active: false, minY: -Infinity, maxY: Infinity, py: 0, uy: 0 };
  /** Momentum delivered to the right wall since the caller last reset it (pressure). */
  rightWallImpulse = 0;
  collisions = true;
  friction = true;
  dissipate = true;
  /** Restitution at walls and between balls when losses are on. */
  wallRestitution = WALL_RESTITUTION;
  ballRestitution = BALL_RESTITUTION;
  /** Coulomb coefficient between balls (and against pegs/segments) with friction on. */
  ballFriction = 0.3;
  /** Restitution of pegs and segments (Plinko wants soft pegs). */
  pegRestitution = WALL_RESTITUTION;
  /** Per-second damping of sideways speed above `dragLine` (Plinko's air). */
  sideDrag = 0;
  dragLine = Infinity;
  /** 0..1: the floor is a hot plate that kicks balls upward. */
  heat = 0;
  /** 0..1: strong damping of all motion. */
  cool = 0;
  /** Strongest impact speed since the caller last reset it (for sound). */
  loudest = 0;
  loudestR = 0;
  /** Ball-pair distance checks in one contact pass, averaged over the last step (the cost counter). */
  pairChecks = 0;

  /** Grid cell size: twice the largest ordinary radius. Bigger balls go brute force. */
  cell: number;
  /** Impacts slower than this don't bounce (resting contact, so piles settle). */
  private restSpeed: number;
  private sorted = new Int32Array(0);
  private cellStart = new Int32Array(0);
  private cellIndex = new Int32Array(0);
  private big: number[] = [];

  box: Box;
  gravity: number;
  /** Floor kick speed at heat 1. */
  kick: number;

  constructor(box: Box, gravity: number, maxRadius: number, kick: number) {
    this.box = box;
    this.gravity = gravity;
    this.kick = kick;
    this.cell = 2 * maxRadius;
    this.restSpeed = gravity * 0.02;
  }

  add(b: Pick<Ball, 'x' | 'y' | 'vx' | 'vy' | 'r'> & Partial<Pick<Ball, 'gold' | 'twin' | 'hue'>>): Ball {
    const ball: Ball = { hue: 0, gold: false, twin: 0, ...b, m: b.r * b.r, px: b.x, py: b.y, ux: b.vx, uy: b.vy };
    this.balls.push(ball);
    return ball;
  }

  step(dt: number): void {
    const n = Math.max(1, Math.ceil(dt / SUBSTEP - 1e-6));
    const h = dt / n;
    this.pairChecks = 0;
    for (let s = 0; s < n; s++) this.substep(h);
    this.pairChecks /= n * (PASSES + 1);
    this.guard();
  }

  private substep(h: number): void {
    const g = this.gravity;
    const damp = this.cool > 0 ? Math.max(0, 1 - this.cool * 6 * h) : 1;
    const side = Math.max(0, 1 - this.sideDrag * h);
    const pis = this.piston;
    if (pis.active) {
      pis.vy += g * h;
      pis.py = pis.y;
      pis.uy = pis.vy;
      pis.y += pis.vy * h;
      this.stopPiston();
    }
    for (const b of this.balls) {
      b.vy += g * h;
      b.vx *= damp;
      b.vy *= damp;
      if (b.y < this.dragLine) b.vx *= side;
      b.px = b.x;
      b.py = b.y;
      b.ux = b.vx;
      b.uy = b.vy;
      b.x += b.vx * h;
      b.y += b.vy * h;
    }
    for (let pass = 0; pass < PASSES; pass++) {
      if (this.collisions) this.collidePairs(false);
      for (const b of this.balls) this.collideStatic(b, false, h);
    }
    const inv = 1 / h;
    for (const b of this.balls) {
      b.vx = (b.x - b.px) * inv;
      b.vy = (b.y - b.py) * inv;
    }
    if (pis.active) pis.vy = (pis.y - pis.py) * inv;
    if (this.collisions) this.collidePairs(true);
    for (const b of this.balls) this.collideStatic(b, true, h);
  }

  // ---- ball-ball ----

  private collidePairs(velocity: boolean): void {
    const balls = this.balls;
    const { x0, y0, x1, y1 } = this.box;
    const cell = this.cell;
    const nx = Math.max(1, Math.ceil((x1 - x0) / cell));
    const ny = Math.max(1, Math.ceil((y1 - y0) / cell));
    const cells = nx * ny;
    if (this.cellStart.length < cells + 1) this.cellStart = new Int32Array(cells + 1);
    if (this.cellIndex.length < balls.length) {
      this.cellIndex = new Int32Array(balls.length * 2);
      this.sorted = new Int32Array(balls.length * 2);
    }
    const start = this.cellStart;
    const index = this.cellIndex;
    const sorted = this.sorted;
    start.fill(0, 0, cells + 1);
    const big = this.big;
    big.length = 0;

    // Counting sort of the ordinary balls into cells.
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      if (2 * b.r > cell) {
        big.push(i);
        index[i] = -1;
        continue;
      }
      const cx = Math.min(nx - 1, Math.max(0, Math.floor((b.x - x0) / cell)));
      const cy = Math.min(ny - 1, Math.max(0, Math.floor((b.y - y0) / cell)));
      const c = cy * nx + cx;
      index[i] = c;
      start[c + 1]++;
    }
    for (let c = 0; c < cells; c++) start[c + 1] += start[c];
    const fill = start.slice(0, cells);
    for (let i = 0; i < balls.length; i++) {
      const c = index[i];
      if (c >= 0) sorted[fill[c]++] = i;
    }

    // Each pair once: own cell, then right, lower-left, lower, lower-right.
    for (let cy = 0; cy < ny; cy++) {
      for (let cx = 0; cx < nx; cx++) {
        const c = cy * nx + cx;
        const s0 = start[c];
        const s1 = start[c + 1];
        for (let p = s0; p < s1; p++) {
          const a = balls[sorted[p]];
          for (let q = p + 1; q < s1; q++) this.contact(a, balls[sorted[q]], velocity);
          if (cx + 1 < nx) this.against(a, c + 1, velocity);
          if (cy + 1 < ny) {
            if (cx > 0) this.against(a, c + nx - 1, velocity);
            this.against(a, c + nx, velocity);
            if (cx + 1 < nx) this.against(a, c + nx + 1, velocity);
          }
        }
      }
    }

    // Big balls (the golden one) against everything.
    for (let k = 0; k < big.length; k++) {
      const a = balls[big[k]];
      for (let i = 0; i < balls.length; i++) {
        if (i === big[k]) continue;
        if (index[i] === -1 && big.indexOf(i) < k) continue; // big pairs once
        this.contact(a, balls[i], velocity);
      }
    }
  }

  private against(a: Ball, c: number, velocity: boolean): void {
    const s1 = this.cellStart[c + 1];
    for (let q = this.cellStart[c]; q < s1; q++) this.contact(a, this.balls[this.sorted[q]], velocity);
  }

  private contact(a: Ball, b: Ball, velocity: boolean): void {
    this.pairChecks++;
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const minD = a.r + b.r + (velocity ? SLOP : 0);
    if (dx >= minD || dx <= -minD || dy >= minD || dy <= -minD) return;
    const d2 = dx * dx + dy * dy;
    if (d2 >= minD * minD) return;
    if (a.twin && b.twin) return;
    let d = Math.sqrt(d2);
    if (d < 1e-9) {
      // Exactly on top of each other (a fresh pour): split sideways.
      dx = Math.random() - 0.5;
      dy = 0;
      d = Math.abs(dx) || 0.5;
    }
    const nx = dx / d;
    const ny = dy / d;
    const ia = 1 / a.m;
    const ib = 1 / b.m;
    const w = ia + ib;
    if (!velocity) {
      const corr = ((minD - d) * RELAX) / w;
      a.x -= nx * corr * ia;
      a.y -= ny * corr * ia;
      b.x += nx * corr * ib;
      b.y += ny * corr * ib;
      return;
    }
    // Velocity pass: the normal speed becomes what the bounce says it should
    // be, whatever the position pushes left behind (they add no energy).
    const before = (b.ux - a.ux) * nx + (b.uy - a.uy) * ny;
    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const vn = rvx * nx + rvy * ny;
    let want: number;
    if (before < 0) {
      const e = this.dissipate ? (-before < this.restSpeed ? 0 : this.ballRestitution) : 1;
      want = -e * before;
      this.noise(-before, Math.min(a.r, b.r));
    } else {
      want = Math.min(vn, before);
    }
    const jn = (want - vn) / w;
    a.vx -= jn * nx * ia;
    a.vy -= jn * ny * ia;
    b.vx += jn * nx * ib;
    b.vy += jn * ny * ib;
    if (this.friction && before < 0) {
      const tx = -ny;
      const ty = nx;
      const vt = rvx * tx + rvy * ty;
      const cap = this.ballFriction * Math.abs(jn);
      const jt = Math.max(-cap, Math.min(cap, -vt / w));
      a.vx -= jt * tx * ia;
      a.vy -= jt * ty * ia;
      b.vx += jt * tx * ib;
      b.vy += jt * ty * ib;
    }
  }

  // ---- walls, pegs, segments, hand ----

  private collideStatic(b: Ball, velocity: boolean, h: number): void {
    for (const p of this.pegs) {
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      const m = b.r + p.r + (velocity ? SLOP : 0);
      if (dx >= m || dx <= -m || dy >= m || dy <= -m) continue;
      const d = Math.hypot(dx, dy);
      if (d >= m) continue;
      if (d < 1e-9) this.wall(b, 0, -1, m, velocity, false, this.pegRestitution);
      else this.wall(b, dx / d, dy / d, Math.max(0, m - d), velocity, false, this.pegRestitution);
    }
    for (const s of this.segments) {
      const ex = s.x2 - s.x1;
      const ey = s.y2 - s.y1;
      const len2 = ex * ex + ey * ey;
      let u = len2 > 0 ? ((b.x - s.x1) * ex + (b.y - s.y1) * ey) / len2 : 0;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const dx = b.x - (s.x1 + u * ex);
      const dy = b.y - (s.y1 + u * ey);
      const m = b.r + SEG_R + (velocity ? SLOP : 0);
      const d2 = dx * dx + dy * dy;
      if (d2 >= m * m) continue;
      const d = Math.sqrt(d2);
      if (d < 1e-9) continue;
      this.wall(b, dx / d, dy / d, Math.max(0, m - d), velocity, false, this.pegRestitution);
    }
    const hand = this.hand;
    if (hand.active) {
      const dx = b.x - hand.x;
      const dy = b.y - hand.y;
      const m = b.r + hand.r + (velocity ? SLOP : 0);
      const d2 = dx * dx + dy * dy;
      if (d2 < m * m && d2 > 1e-12) {
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        if (!velocity) {
          b.x += nx * (m - d);
          b.y += ny * (m - d);
        } else {
          // Leave the hand at least as fast as it pushes, plus a little bounce.
          const before = (b.ux - hand.vx) * nx + (b.uy - hand.vy) * ny;
          const vn = (b.vx - hand.vx) * nx + (b.vy - hand.vy) * ny;
          const want = before < 0 ? -HAND_RESTITUTION * before : Math.min(vn, before);
          b.vx += (want - vn) * nx;
          b.vy += (want - vn) * ny;
        }
      }
    }
    if (this.piston.active) this.collidePiston(b, velocity);
    const { x0, y0, x1, y1 } = this.box;
    const r = b.r + (velocity ? SLOP : 0);
    if (b.x < x0 + r) this.wall(b, 1, 0, Math.max(0, x0 + b.r - b.x), velocity, false);
    else if (b.x > x1 - r) {
      const vx = b.vx;
      this.wall(b, -1, 0, Math.max(0, b.x - (x1 - b.r)), velocity, false);
      if (velocity) this.rightWallImpulse += b.m * Math.abs(b.vx - vx);
    }
    if (b.y < y0 + r) this.wall(b, 0, 1, Math.max(0, y0 + b.r - b.y), velocity, false);
    else if (b.y > y1 - r) {
      this.wall(b, 0, -1, b.y - (y1 - b.r), velocity, true);
      if (velocity && this.friction) b.vx *= Math.max(0, 1 - ROLL_FRICTION * h);
    }
  }

  private collidePiston(b: Ball, velocity: boolean): void {
    const pis = this.piston;
    const top = b.y - b.r - (velocity ? SLOP : 0);
    if (top >= pis.y) return;
    const ib = 1 / b.m;
    const ip = 1 / pis.mass;
    const w = ib + ip;
    if (!velocity) {
      const pen = pis.y - (b.y - b.r);
      b.y += (pen * ib) / w;
      pis.y -= (pen * ip) / w;
      this.stopPiston();
      return;
    }
    // Normal points down, from the lid into the ball.
    const before = b.uy - pis.uy;
    const vn = b.vy - pis.vy;
    const e = this.dissipate ? (-before < this.restSpeed ? 0 : this.ballRestitution) : 1;
    const want = before < 0 ? -e * before : Math.min(vn, before);
    const j = (want - vn) / w;
    b.vy += j * ib;
    pis.vy -= j * ip;
    if (before < 0) this.noise(-before, b.r);
  }

  private stopPiston(): void {
    const pis = this.piston;
    const top = Math.max(this.box.y0, pis.minY);
    if (pis.y < top) pis.y = top;
    if (pis.y > pis.maxY) pis.y = pis.maxY;
  }

  /** Contact with something immovable; n points from it towards the ball. */
  private wall(
    b: Ball,
    nx: number,
    ny: number,
    pen: number,
    velocity: boolean,
    floor: boolean,
    restitution = this.wallRestitution,
  ): void {
    if (!velocity) {
      b.x += nx * pen;
      b.y += ny * pen;
      return;
    }
    const before = b.ux * nx + b.uy * ny;
    const vn = b.vx * nx + b.vy * ny;
    if (before < 0) {
      const e = this.dissipate ? (-before < this.restSpeed ? 0 : restitution) : 1;
      const want = -e * before;
      b.vx += (want - vn) * nx;
      b.vy += (want - vn) * ny;
      this.noise(-before, b.r);
      if (this.friction && -before >= this.restSpeed) {
        const tx = -ny;
        const ty = nx;
        const vt = b.vx * tx + b.vy * ty;
        b.vx -= (1 - WALL_FRICTION) * vt * tx;
        b.vy -= (1 - WALL_FRICTION) * vt * ty;
      }
    } else if (vn > before) {
      b.vx += (before - vn) * nx;
      b.vy += (before - vn) * ny;
    }
    if (floor && this.heat > 0) {
      // Hot plate: every ball touching the floor is kicked up at random.
      const k = this.heat * this.kick;
      b.vy = Math.min(b.vy, -k * (0.4 + 0.9 * Math.random()));
      b.vx += (Math.random() - 0.5) * 0.5 * k;
    }
  }

  private noise(speed: number, r: number): void {
    if (speed > this.loudest) {
      this.loudest = speed;
      this.loudestR = r;
    }
  }

  /** Kiosk safety: no NaN and no runaway speed survives a step. */
  private guard(): void {
    const { x0, y0, x1, y1 } = this.box;
    // Eight times the speed of a fall through the whole box (with a floor
    // for gravity-free boxes, which would otherwise cap every speed at zero).
    const vmax = 8 * Math.sqrt(Math.max(this.gravity, 1000) * (y1 - y0));
    for (const b of this.balls) {
      if (!Number.isFinite(b.x + b.y + b.vx + b.vy)) {
        b.x = (x0 + x1) / 2 + (Math.random() - 0.5) * 20;
        b.y = y0 + b.r + 1;
        b.vx = 0;
        b.vy = 0;
        continue;
      }
      const v2 = b.vx * b.vx + b.vy * b.vy;
      if (v2 > vmax * vmax) {
        const k = vmax / Math.sqrt(v2);
        b.vx *= k;
        b.vy *= k;
      }
    }
  }
}
