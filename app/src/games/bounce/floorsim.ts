// Delve chapter 3's floor seen up close: a ball bouncing on a floor made of
// atoms, each tied to its place and to its neighbours by springs. Every
// landing sets the atoms shaking, and that shaking is heat: the ball's
// energy moves into the floor while the total stays the same. A tiny
// mass-spring model, stepped with small symplectic-Euler ticks so energy is
// (nearly) conserved. DOM-free so it can be tested in node.

export const FLOOR = {
  width: 400,
  cols: 25,
  rows: 4,
  spacing: 16,
  /** y of the top row of atoms. */
  top: 250,
  atomR: 6,
  /** Spring to the atom's own place, and to each neighbour. */
  tether: 20000,
  bond: 40000,
  contact: 60000,
  ballR: 22,
  /**
   * In atom masses. Tuned in node so the bounces match the pit's shortcut
   * (restitution 0.82): peaks 144, 102, 84, 66 px against 149, 108, 81, 63.
   */
  ballMass: 6,
  gravity: 900,
  dt: 1 / 6000,
};

export class FloorSim {
  // Atoms: rest place, position, velocity (mass 1).
  rx: Float64Array;
  ry: Float64Array;
  x: Float64Array;
  y: Float64Array;
  vx: Float64Array;
  vy: Float64Array;
  ball = { x: 0, y: 0, vx: 0, vy: 0 };
  time = 0;
  private fx: Float64Array;
  private fy: Float64Array;

  constructor() {
    const n = FLOOR.cols * FLOOR.rows;
    this.rx = new Float64Array(n);
    this.ry = new Float64Array(n);
    this.x = new Float64Array(n);
    this.y = new Float64Array(n);
    this.vx = new Float64Array(n);
    this.vy = new Float64Array(n);
    this.fx = new Float64Array(n);
    this.fy = new Float64Array(n);
    const x0 = (FLOOR.width - (FLOOR.cols - 1) * FLOOR.spacing) / 2;
    for (let j = 0; j < FLOOR.rows; j++) {
      for (let i = 0; i < FLOOR.cols; i++) {
        const k = j * FLOOR.cols + i;
        this.rx[k] = this.x[k] = x0 + i * FLOOR.spacing;
        this.ry[k] = this.y[k] = FLOOR.top + j * FLOOR.spacing;
      }
    }
    this.ball = { x: FLOOR.width / 2 - 3, y: 40, vx: 0, vy: 0 };
  }

  /** Advance by `seconds` in small ticks. */
  advance(seconds: number): void {
    const steps = Math.round(seconds / FLOOR.dt);
    for (let s = 0; s < steps; s++) this.tick();
  }

  private tick(): void {
    const { cols, rows, tether, bond, contact, dt } = FLOOR;
    const n = cols * rows;
    const { x, y, fx, fy } = this;
    for (let k = 0; k < n; k++) {
      fx[k] = -tether * (x[k] - this.rx[k]);
      fy[k] = -tether * (y[k] - this.ry[k]);
    }
    // Bonds to the right and below, spring force along the bond.
    const L = FLOOR.spacing;
    const spring = (a: number, b: number) => {
      const dx = x[b] - x[a];
      const dy = y[b] - y[a];
      const d = Math.hypot(dx, dy) || 1e-9;
      const f = (bond * (d - L)) / d;
      fx[a] += f * dx;
      fy[a] += f * dy;
      fx[b] -= f * dx;
      fy[b] -= f * dy;
    };
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        if (i + 1 < cols) spring(k, k + 1);
        if (j + 1 < rows) spring(k, k + cols);
      }
    }
    // The ball pushes on the top-row atoms it overlaps.
    const b = this.ball;
    let bfx = 0;
    let bfy = FLOOR.ballMass * FLOOR.gravity;
    const reach = FLOOR.ballR + FLOOR.atomR;
    for (let k = 0; k < cols; k++) {
      const dx = x[k] - b.x;
      const dy = y[k] - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= reach * reach) continue;
      const d = Math.sqrt(d2) || 1e-9;
      const f = (contact * (reach - d)) / d;
      fx[k] += f * dx;
      fy[k] += f * dy;
      bfx -= f * dx;
      bfy -= f * dy;
    }
    // Symplectic Euler: velocities first, then positions.
    for (let k = 0; k < n; k++) {
      this.vx[k] += fx[k] * dt;
      this.vy[k] += fy[k] * dt;
      x[k] += this.vx[k] * dt;
      y[k] += this.vy[k] * dt;
    }
    b.vx += (bfx / FLOOR.ballMass) * dt;
    b.vy += (bfy / FLOOR.ballMass) * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    // Side walls for the ball only (elastic).
    if (b.x < FLOOR.ballR || b.x > FLOOR.width - FLOOR.ballR) b.vx = -b.vx;
    this.time += dt;
  }

  /** The ball's energy: motion plus height above the floor's top row. */
  ballEnergy(): number {
    const b = this.ball;
    return 0.5 * FLOOR.ballMass * (b.vx * b.vx + b.vy * b.vy) + FLOOR.ballMass * FLOOR.gravity * (FLOOR.top - b.y);
  }

  /** The floor's energy: atom motion plus stretched springs (the heat). */
  floorEnergy(): number {
    const { cols, rows, tether, bond } = FLOOR;
    const n = cols * rows;
    const { x, y } = this;
    let e = 0;
    for (let k = 0; k < n; k++) {
      e += 0.5 * (this.vx[k] ** 2 + this.vy[k] ** 2);
      e += 0.5 * tether * ((x[k] - this.rx[k]) ** 2 + (y[k] - this.ry[k]) ** 2);
    }
    const L = FLOOR.spacing;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        if (i + 1 < cols) e += 0.5 * bond * (Math.hypot(x[k + 1] - x[k], y[k + 1] - y[k]) - L) ** 2;
        if (j + 1 < rows) e += 0.5 * bond * (Math.hypot(x[k + cols] - x[k], y[k + cols] - y[k]) - L) ** 2;
      }
    }
    // Contact springs are only squeezed during a landing; count them with the floor.
    const reach = FLOOR.ballR + FLOOR.atomR;
    for (let k = 0; k < cols; k++) {
      const d = Math.hypot(x[k] - this.ball.x, y[k] - this.ball.y);
      if (d < reach) e += 0.5 * FLOOR.contact * (reach - d) ** 2;
    }
    return e;
  }

  /** Speed of atom k (for colouring by heat). */
  speed(k: number): number {
    return Math.hypot(this.vx[k], this.vy[k]);
  }
}
