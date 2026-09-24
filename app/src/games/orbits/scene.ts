// Drawing and throwing for an N-body sky, shared by Gravity Doodle's toy and
// its challenge rounds: trails, lit bodies, merge flashes, the dashed 🔮
// forecast, the rubber-sheet gravity view, and drag → launch velocity.
import type { Body, Outcome, World } from './physics';
import { drawPlanet, drawStar } from './draw';

export const OUTCOME_COLOR: Record<Outcome, string> = {
  orbit: '#6ee7b7',
  far: '#fde047',
  escape: '#fb923c',
  crash: '#f87171',
  merge: '#f472b6',
};

export interface Pt {
  x: number;
  y: number;
}

/** Each body's recent path, fading towards its tail. */
export class Trails {
  private map = new Map<number, Pt[]>();
  constructor(private length = 180) {}

  update(world: World): void {
    for (const b of world.bodies) {
      let trail = this.map.get(b.id);
      if (!trail) this.map.set(b.id, (trail = []));
      if (!Number.isFinite(b.x + b.y)) continue;
      const last = trail[trail.length - 1];
      if (last && last.x === b.x && last.y === b.y) continue; // big steps: one point per step
      trail.push({ x: b.x, y: b.y });
      if (trail.length > this.length) trail.shift();
    }
    if (this.map.size > world.bodies.length + 8) {
      const alive = new Set(world.bodies.map((b) => b.id));
      for (const id of this.map.keys()) if (!alive.has(id)) this.map.delete(id);
    }
  }

  drop(id: number): void {
    this.map.delete(id);
  }

  clear(): void {
    this.map.clear();
  }

  /** `dots`: mark every point (with big steps each point is one step of the computer). */
  draw(ctx: CanvasRenderingContext2D, world: World, u: number, dots = false): void {
    const CHUNKS = 6;
    for (const b of world.bodies) {
      const trail = this.map.get(b.id);
      if (!trail || trail.length < 2 || b.sun) continue;
      const n = trail.length;
      for (let c = 0; c < CHUNKS; c++) {
        const i0 = Math.floor((c * (n - 1)) / CHUNKS);
        const i1 = Math.floor(((c + 1) * (n - 1)) / CHUNKS);
        if (i1 <= i0) continue;
        ctx.beginPath();
        ctx.moveTo(trail[i0].x, trail[i0].y);
        for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(trail[i].x, trail[i].y);
        ctx.strokeStyle = `hsla(${b.hue}, 80%, 70%, ${(0.55 * (c + 1)) / CHUNKS})`;
        ctx.lineWidth = Math.max(1.5, 2.5 * u);
        ctx.stroke();
      }
      if (dots) {
        ctx.fillStyle = `hsla(${b.hue}, 85%, 80%, 0.8)`;
        for (const p of trail) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(1.5, 2.5 * u), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
}

export function nearestStar(x: number, y: number, stars: Body[], fallback: Pt): Pt {
  let best = fallback;
  let bd = Infinity;
  for (const s of stars) {
    const d = (s.x - x) ** 2 + (s.y - y) ** 2;
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

/** Stars first (under the planets), then planets lit from the nearest star; giants get rings. */
export function drawBodies(ctx: CanvasRenderingContext2D, world: World, time: number, skip?: (b: Body) => boolean): void {
  // A non-finite body would make the canvas throw and stop the frame loop: never draw one.
  const ok = (b: Body) => Number.isFinite(b.x + b.y + b.r);
  const stars = world.bodies.filter((b) => b.kind === 'star' && ok(b));
  for (const b of stars) drawStar(ctx, b.x, b.y, b.r, b.hue, Math.sin(time * 2 + b.id));
  const centre = { x: world.cx, y: world.cy };
  for (const b of world.bodies) {
    if (b.kind === 'star' || skip?.(b) || !ok(b)) continue;
    const light = nearestStar(b.x, b.y, stars, centre);
    drawPlanet(ctx, b.x, b.y, b.r, b.hue, light.x, light.y, b.kind === 'giant');
  }
}

/** Flashes where bodies merged. */
export class Poofs {
  private list: { x: number; y: number; t: number; hue: number; r: number }[] = [];

  add(x: number, y: number, hue: number, r: number): void {
    this.list.push({ x, y, t: 0, hue, r });
  }

  step(dt: number): void {
    for (const f of this.list) f.t += dt;
    this.list = this.list.filter((f) => f.t < 0.8);
  }

  draw(ctx: CanvasRenderingContext2D, u: number): void {
    for (const f of this.list) {
      const k = f.t / 0.8;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r + k * 70 * u, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${f.hue}, 90%, 75%, ${0.8 * (1 - k)})`;
      ctx.lineWidth = 4 * u;
      ctx.stroke();
      if (k < 0.25) {
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * 1.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 247, 214, ${0.8 * (1 - k / 0.25)})`;
        ctx.fill();
      }
    }
  }
}

/** The dashed, marching forecast line (and an ✕ where it ends in a crash). */
export function drawPath(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, u: number, time: number, cross = false): void {
  if (pts.length > 1) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.setLineDash([8, 8]);
    ctx.lineDashOffset = -time * 40;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 * u;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }
  if (cross && pts.length) {
    const end = pts[pts.length - 1];
    const k = 8 * u;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(end.x - k, end.y - k);
    ctx.lineTo(end.x + k, end.y + k);
    ctx.moveTo(end.x + k, end.y - k);
    ctx.lineTo(end.x - k, end.y + k);
    ctx.stroke();
  }
}

/**
 * Drag → launch velocity. `m` is the scene size (the toy: the screen's short
 * side): a drag of 0.3·m reaches the circle speed at 0.35·m. Capped at `cap`
 * times the escape speed from the stars at the launch point.
 */
export function launchVelocity(world: World, m: number, x0: number, y0: number, x1: number, y1: number, cap = 1.2): Pt {
  const gm = world.refGm;
  const k = Math.sqrt(gm / (0.35 * m)) / (0.3 * m);
  let vx = (x1 - x0) * k;
  let vy = (y1 - y0) * k;
  const s = world.stars();
  const r = Math.max(Math.hypot(x0 - s.x, y0 - s.y), 30 * world.unit);
  const vMax = cap * Math.sqrt((2 * Math.max(s.gm, gm * 0.5)) / r);
  const v = Math.hypot(vx, vy);
  if (v > vMax) {
    vx *= vMax / v;
    vy *= vMax / v;
  }
  return { x: vx, y: vy };
}

/**
 * The rubber sheet: a grid that sags towards every mass. Each grid point is
 * pulled towards each body by an amount that grows with its mass (as the
 * square root, so planets still make visible dimples) and fades with
 * distance; never further than most of the way to the body, so lines don't
 * cross. The deeper the sag, the brighter the line.
 */
export function drawGravityGrid(ctx: CanvasRenderingContext2D, world: World, w: number, h: number, u: number): void {
  const step = 34 * u;
  const nx = Math.ceil(w / step) + 1;
  const ny = Math.ceil(h / step) + 1;
  const ox = (w - (nx - 1) * step) / 2;
  const oy = (h - (ny - 1) * step) / 2;
  const px = new Float32Array(nx * ny);
  const py = new Float32Array(nx * ny);
  const depth = new Float32Array(nx * ny);
  const pulls = world.bodies
    .filter((b) => b.gm > 0)
    .map((b) => {
      const s = Math.sqrt(b.gm / world.refGm);
      return { x: b.x, y: b.y, amp: 70 * u * s, reach: 90 * u * Math.sqrt(s) + b.r };
    });
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const gx = ox + i * step;
      const gy = oy + j * step;
      let dx = 0;
      let dy = 0;
      let dep = 0;
      for (const p of pulls) {
        const ex = p.x - gx;
        const ey = p.y - gy;
        const d = Math.hypot(ex, ey) || 1e-6;
        const f = p.reach / (d + p.reach);
        const pull = Math.min(p.amp * f * f, 0.85 * d);
        dx += (ex / d) * pull;
        dy += (ey / d) * pull;
        dep += p.amp * f;
      }
      px[k] = gx + dx;
      py[k] = gy + dy;
      depth[k] = dep;
    }
  }
  // Segments bucketed by depth: a few strokes per frame instead of one per segment.
  const LEVELS = 6;
  const paths = Array.from({ length: LEVELS }, () => new Path2D());
  const seg = (a: number, b: number) => {
    const d = Math.min(1, (depth[a] + depth[b]) / (2 * 60 * u));
    const path = paths[Math.min(LEVELS - 1, Math.floor(d * LEVELS))];
    path.moveTo(px[a], py[a]);
    path.lineTo(px[b], py[b]);
  };
  for (let j = 0; j < ny; j++) for (let i = 0; i + 1 < nx; i++) seg(j * nx + i, j * nx + i + 1);
  for (let j = 0; j + 1 < ny; j++) for (let i = 0; i < nx; i++) seg(j * nx + i, (j + 1) * nx + i);
  ctx.lineWidth = 1;
  paths.forEach((path, l) => {
    const d = (l + 0.5) / LEVELS;
    ctx.strokeStyle = `rgba(${Math.round(90 + 110 * d)}, ${Math.round(140 + 60 * d)}, 255, ${0.12 + 0.4 * d})`;
    ctx.stroke(path);
  });
}
