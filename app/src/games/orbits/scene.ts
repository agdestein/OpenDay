// Drawing and throwing for an N-body sky, shared by Gravity Doodle's toy and
// its challenge rounds: trails, lit bodies, merge flashes, the dashed 🔮
// forecast, the rubber-sheet gravity view, and drag → launch velocity.
import type { Body, Outcome, World } from './physics';
import { drawPlanet, drawStar } from './draw';

/**
 * How fast the skies run: simulated seconds per real second. Slower than
 * real-time orbits would look at this scale, so there is time to plan; and
 * while you aim (drag), time slows further, to `aiming` of that.
 */
export const PACE = { toy: 0.65, zone: 0.65, sling: 0.5, aiming: 0.3 };

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

/**
 * The dashed, marching forecast line (and an ✕ where it ends in a crash).
 * `fade`: the far future fades out, so a long forecast stays readable.
 */
export function drawPath(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, u: number, time: number, cross = false, fade = false): void {
  if (pts.length > 1) {
    const CHUNKS = fade ? 5 : 1;
    const base = ctx.globalAlpha;
    ctx.setLineDash([8, 8]);
    ctx.lineDashOffset = -time * 40;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 * u;
    for (let c = 0; c < CHUNKS; c++) {
      const i0 = Math.floor((c * (pts.length - 1)) / CHUNKS);
      const i1 = Math.floor(((c + 1) * (pts.length - 1)) / CHUNKS);
      if (i1 <= i0) continue;
      ctx.globalAlpha = base * (fade ? 1 - (0.7 * c) / (CHUNKS - 1) : 1);
      ctx.beginPath();
      ctx.moveTo(pts[i0].x, pts[i0].y);
      for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
    ctx.globalAlpha = base;
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
 * Who the throw would run into: a pulsing red ring round that body, and its
 * own path (thin, dashed) to where they meet — so it can be dodged.
 */
export function drawPartner(ctx: CanvasRenderingContext2D, world: World, partner: { id: number; pts: Pt[] } | undefined, u: number, time: number): void {
  if (!partner) return;
  const b = world.bodies.find((x) => x.id === partner.id);
  if (!b || b.sun) return;
  const pts = partner.pts;
  if (pts.length > 1) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.setLineDash([4, 6]);
    ctx.lineDashOffset = -time * 30;
    ctx.strokeStyle = 'rgba(248, 113, 113, 0.7)';
    ctx.lineWidth = 2 * u;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r + (6 + 3 * Math.sin(time * 8)) * u, 0, Math.PI * 2);
  ctx.strokeStyle = '#f87171';
  ctx.lineWidth = 3 * u;
  ctx.stroke();
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
 * The rubber sheet: a grid that sags towards every mass, drawn as smooth
 * curves. Each mass pulls a grid point at distance r towards itself by
 *   p(r) = k · r · s³ / (r² + s²)^1.5,
 * which is zero at the mass, peaks at r ≈ s·0.7 and fades as 1/r² far away.
 * Its slope is at most k, so for k < 1 lines get denser near the mass but can
 * never cross or collapse (the old pull, up to 85 % of the way to the mass,
 * folded rings into a knot). k and s grow with the mass's cube root: the Sun
 * squeezes space near it about 4×, a pebble makes a small dimple. Where
 * several wells overlap, their summed squeeze is capped so lines still don't
 * cross. The deeper the sheet, the brighter the line.
 */
export function gravitySheet(world: World, u: number): (x: number, y: number) => [number, number, number] {
  const wells = world.bodies
    .filter((b) => b.gm > 0 && Number.isFinite(b.x + b.y))
    .map((b) => {
      const m = Math.cbrt(Math.min(1.5, b.gm / world.refGm));
      const s = (40 + 90 * m) * u + b.r;
      return { x: b.x, y: b.y, k: 0.78 * m, s, s2: s * s, s3: s * s * s, far2: (8 * s) ** 2 };
    });
  /** The sheet at (x, y): where the point is drawn, and how deep it lies (0–1). */
  return (x: number, y: number): [number, number, number] => {
    let dx = 0;
    let dy = 0;
    let squeeze = 0;
    let depth = 0;
    for (const q of wells) {
      const ex = q.x - x;
      const ey = q.y - y;
      const r2 = ex * ex + ey * ey;
      if (r2 > q.far2) continue;
      const g = q.s3 / (r2 + q.s2) ** 1.5; // p(r) / r, and roughly the local squeeze
      dx += q.k * g * ex;
      dy += q.k * g * ey;
      squeeze += q.k * g;
      depth += q.k * Math.sqrt(q.s2 / (r2 + q.s2));
    }
    const cap = squeeze > 0.85 ? 0.85 / squeeze : 1; // overlapping wells: never fold
    return [x + dx * cap, y + dy * cap, Math.min(1, depth)];
  };
}

export function drawGravityGrid(ctx: CanvasRenderingContext2D, world: World, w: number, h: number, u: number): void {
  const cell = 26 * u;
  const sample = 6 * u;
  const at = gravitySheet(world, u);
  const LEVELS = 6;
  const paths = Array.from({ length: LEVELS }, () => new Path2D());
  const line = (x0: number, y0: number, ux: number, uy: number, n: number) => {
    let [px, py, pd] = at(x0, y0);
    for (let i = 1; i <= n; i++) {
      const [qx, qy, qd] = at(x0 + ux * i * sample, y0 + uy * i * sample);
      const path = paths[Math.min(LEVELS - 1, Math.floor(((pd + qd) / 2) * LEVELS))];
      path.moveTo(px, py);
      path.lineTo(qx, qy);
      px = qx;
      py = qy;
      pd = qd;
    }
  };
  const ox = (w % cell) / 2;
  const oy = (h % cell) / 2;
  const nx = Math.ceil((w + 2 * cell) / sample);
  const ny = Math.ceil((h + 2 * cell) / sample);
  for (let y = oy - cell; y <= h + cell; y += cell) line(-cell, y, 1, 0, nx);
  for (let x = ox - cell; x <= w + cell; x += cell) line(x, -cell, 0, 1, ny);
  ctx.lineWidth = 1;
  paths.forEach((path, l) => {
    const d = (l + 0.5) / LEVELS;
    ctx.strokeStyle = `rgba(${Math.round(90 + 120 * d)}, ${Math.round(140 + 70 * d)}, 255, ${0.14 + 0.46 * d})`;
    ctx.stroke(path);
  });
}
