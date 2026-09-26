// Shared drawing for every Creature Lab screen: a View maps world metres
// (y up, ground at 0) to canvas pixels; creatures, ground, labels and the
// learning chart are drawn through one.
import { NODE_R, type BodyPlan, type Creature, type Ground } from './physics';
import { fmtNumber } from '../../lib/i18n';

export interface View {
  /** World x at the canvas point centerX. */
  camX: number;
  /** Pixels per metre. */
  scale: number;
  centerX: number;
  /** Canvas y of world y = 0. */
  groundY: number;
  /** The band of the canvas this view draws into (lanes). */
  top: number;
  height: number;
}

export const COLOR = {
  background: '#0b1020',
  node: '#eef2ff',
  bone: '#94a3b8',
  muscle: '#fb5f75',
  you: '#7dd3fc',
  champ: '#fbbf24',
  ground: 'rgba(255, 255, 255, 0.3)',
  groundFill: 'rgba(255, 255, 255, 0.06)',
  grass: '#1c3b2a',
  text: 'rgba(238, 242, 255, 0.92)',
  dim: 'rgba(238, 242, 255, 0.6)',
  bad: '#fb7185',
  good: '#57d98a',
};

/** Per-muscle colours for the brain lens and the delve's brain waves. */
export const MUSCLE_COLORS = ['#fb5f75', '#7dd3fc', '#fbbf24', '#57d98a', '#c084fc', '#fb923c', '#a3e635', '#f472b6'];

export const sx = (v: View, x: number): number => v.centerX + (x - v.camX) * v.scale;
export const sy = (v: View, y: number): number => v.groundY - y * v.scale;

export function toWorld(v: View, px: number, py: number): { x: number; y: number } {
  return { x: (px - v.centerX) / v.scale + v.camX, y: (v.groundY - py) / v.scale };
}

/** Text with a dark halo, readable over anything. */
export function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color = COLOR.text,
  align: CanvasTextAlign = 'center',
  weight = 700,
): void {
  ctx.font = `${weight} ${Math.round(size)}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size / 5);
  ctx.strokeStyle = 'rgba(5, 8, 20, 0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export interface GroundOptions {
  ground?: Ground;
  /** Metre marks and numbers, counted from startX. */
  metres?: boolean;
  startX?: number;
  /** The start flag at startX. */
  flag?: boolean;
  /** Paint the stretch from..to (world x) in a colour, e.g. the race-walk judge's red hops. */
  marks?: { from: number; to: number; color: string }[];
}

export function drawGround(ctx: CanvasRenderingContext2D, v: View, w: number, opts: GroundOptions = {}): void {
  const g = opts.ground;
  const bottom = v.top + v.height;
  const left = v.camX - v.centerX / v.scale;
  const right = v.camX + (w - v.centerX) / v.scale;
  ctx.beginPath();
  if (g) {
    const dx = 4 / v.scale;
    ctx.moveTo(0, bottom);
    for (let x = left; x <= right + dx; x += dx) ctx.lineTo(sx(v, x), sy(v, g(x)));
    ctx.lineTo(w, bottom);
    ctx.closePath();
  } else {
    ctx.rect(0, v.groundY, w, bottom - v.groundY);
  }
  ctx.fillStyle = COLOR.groundFill;
  ctx.fill();
  ctx.strokeStyle = COLOR.ground;
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (g) {
    const dx = 4 / v.scale;
    for (let x = left; x <= right + dx; x += dx) {
      if (x === left) ctx.moveTo(sx(v, x), sy(v, g(x)));
      else ctx.lineTo(sx(v, x), sy(v, g(x)));
    }
  } else {
    ctx.moveTo(0, v.groundY);
    ctx.lineTo(w, v.groundY);
  }
  ctx.stroke();

  for (const m of opts.marks ?? []) {
    if (m.to < left || m.from > right) continue;
    ctx.strokeStyle = m.color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(sx(v, m.from), v.groundY + 5);
    ctx.lineTo(sx(v, m.to), v.groundY + 5);
    ctx.stroke();
  }

  const start = opts.startX ?? 0;
  if (opts.metres) {
    const size = Math.max(12, Math.min(17, v.scale * 0.12));
    const every = v.scale < 40 ? 5 : v.scale < 70 ? 2 : 1;
    for (let m = Math.floor((left - start) / every) * every; m <= right - start; m += every) {
      const x = sx(v, start + m);
      const y = sy(v, g ? g(start + m) : 0);
      ctx.fillStyle = 'rgba(238, 242, 255, 0.45)';
      ctx.fillRect(x - 1, y, 2, 8);
      if (m > 0) label(ctx, `${m} m`, x, y + 26, size, COLOR.dim, 'center', 600);
    }
  }
  if (opts.flag) {
    ctx.font = `${Math.round(Math.max(22, v.scale * 0.22))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('🚩', sx(v, start) + 8, sy(v, g ? g(start) : 0) - 6);
  }
}

export interface CreatureStyle {
  alpha?: number;
  /** Colour of the head (the eye's rim). */
  head?: string;
  /** Muscle colours by muscle index (the brain lens), else all red. */
  muscleColors?: string[];
  /** A world point for the eye to look at (the cursor), else the way it's going. */
  look?: { x: number; y: number } | null;
  /** A soft halo around the body (selected, hovered, champion). */
  glow?: string;
  /** Draw everything in one colour (ghosts). */
  tint?: string;
}

/** A live creature, from its Verlet points. */
export function drawCreature(ctx: CanvasRenderingContext2D, v: View, c: Creature, style: CreatureStyle = {}): void {
  const pts = c.pts;
  ctx.globalAlpha = style.alpha ?? 1;
  ctx.lineCap = 'round';
  if (style.glow) {
    ctx.strokeStyle = style.glow;
    ctx.lineWidth = Math.max(6, 0.13 * v.scale);
    ctx.globalAlpha = (style.alpha ?? 1) * 0.22;
    ctx.beginPath();
    for (const s of c.sticks) {
      const a = pts[s.a];
      const b = pts[s.b];
      if (!Number.isFinite(a.x + a.y + b.x + b.y)) continue;
      ctx.moveTo(sx(v, a.x), sy(v, a.y));
      ctx.lineTo(sx(v, b.x), sy(v, b.y));
    }
    ctx.stroke();
    ctx.globalAlpha = style.alpha ?? 1;
  }
  for (const s of c.sticks) {
    const a = pts[s.a];
    const b = pts[s.b];
    if (!Number.isFinite(a.x + a.y + b.x + b.y)) continue;
    const muscle = s.muscle >= 0;
    const strain = muscle ? c.stickStrain(s) : 0;
    ctx.strokeStyle =
      style.tint ??
      (muscle ? (style.muscleColors?.[s.muscle % style.muscleColors.length] ?? COLOR.muscle) : COLOR.bone);
    ctx.lineWidth = Math.max(2, (muscle ? 0.055 * (1 - strain * 1.5) : 0.045) * v.scale);
    ctx.beginPath();
    ctx.moveTo(sx(v, a.x), sy(v, a.y));
    ctx.lineTo(sx(v, b.x), sy(v, b.y));
    ctx.stroke();
  }
  pts.forEach((p, i) => {
    if (!Number.isFinite(p.x + p.y)) return;
    const x = sx(v, p.x);
    const y = sy(v, p.y);
    ctx.fillStyle = i === 0 ? (style.tint ?? style.head ?? COLOR.you) : (style.tint ?? COLOR.node);
    ctx.beginPath();
    ctx.arc(x, y, (i === 0 ? NODE_R * 2 : NODE_R) * v.scale, 0, Math.PI * 2);
    ctx.fill();
    if (i === 0 && c.genome.net && !style.tint) {
      // A brain that feels: a dashed ring of senses round the head.
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.85)';
      ctx.lineWidth = Math.max(1.5, 0.018 * v.scale);
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(x, y, NODE_R * 3 * v.scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (i === 0 && !style.tint) {
      const look = style.look;
      const dir = look ? { x: look.x - p.x, y: look.y - p.y } : { x: p.x - p.px || 1, y: 0 };
      drawEye(ctx, x, y, NODE_R * 1.1 * v.scale, dir.x, -dir.y);
    }
  });
  ctx.globalAlpha = 1;
}

/** Googly eye: the pupil looks along (dx, dy) in screen directions. */
export function drawEye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, dx: number, dy: number): void {
  const d = Math.hypot(dx, dy) || 1;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0b1020';
  ctx.beginPath();
  ctx.arc(x + (dx / d) * r * 0.4, y + (dy / d) * r * 0.4, r * 0.48, 0, Math.PI * 2);
  ctx.fill();
}

/** A body plan as drawn in the editor (static, muscles gently pulsing). */
export function drawPlan(ctx: CanvasRenderingContext2D, v: View, plan: BodyPlan, time: number, attached?: Set<number>): void {
  ctx.lineCap = 'round';
  plan.sticks.forEach((s, i) => {
    const a = plan.nodes[s.a];
    const b = plan.nodes[s.b];
    ctx.globalAlpha = !attached || attached.has(s.a) ? 1 : 0.35;
    ctx.strokeStyle = s.muscle ? COLOR.muscle : COLOR.bone;
    const pulse = s.muscle ? 1 + 0.18 * Math.sin(time * 3 + i) : 1;
    ctx.lineWidth = (s.muscle ? 0.055 : 0.045) * v.scale * pulse;
    ctx.beginPath();
    ctx.moveTo(sx(v, a.x), sy(v, a.y));
    ctx.lineTo(sx(v, b.x), sy(v, b.y));
    ctx.stroke();
  });
  plan.nodes.forEach((n, i) => {
    const x = sx(v, n.x);
    const y = sy(v, n.y);
    ctx.globalAlpha = !attached || attached.has(i) ? 1 : 0.35;
    ctx.fillStyle = COLOR.node;
    ctx.beginPath();
    ctx.arc(x, y, (i === 0 ? NODE_R * 2 : NODE_R * 1.3) * v.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(11, 16, 32, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (i === 0) drawEye(ctx, x, y, NODE_R * 1.1 * v.scale, 1, 0);
  });
  ctx.globalAlpha = 1;
}

export function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = 'rgba(5, 8, 20, 0.7)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export interface ChartSeries {
  values: number[];
  color: string;
  /** Indices drawn with a ❤️ (the kid picked that generation's parent). */
  picked?: Set<number>;
}

/** Learning curve: one bar (or line) per generation, best score. */
export function drawChart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  series: ChartSeries[],
  unit = 'm',
): void {
  panel(ctx, x, y, w, h);
  label(ctx, title, x + 12, y + 22, 15, COLOR.dim, 'left', 600);
  const all = series.flatMap((s) => s.values);
  if (all.length === 0) return;
  const max = Math.max(1e-6, ...all);
  const x0 = x + 12;
  const y0 = y + h - 12;
  const W = w - 24;
  const H = h - 46;
  label(ctx, `${fmtNumber(max, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} ${unit}`, x + w - 10, y + 22, 14, COLOR.dim, 'right', 600);
  const n = Math.max(...series.map((s) => s.values.length));
  if (series.length === 1 && n <= 40) {
    const s = series[0];
    const bw = Math.min(26, W / n);
    s.values.forEach((d, i) => {
      const bh = Math.max(2, (H * Math.max(0, d)) / max);
      ctx.fillStyle = i === s.values.length - 1 ? s.color : 'rgba(125, 211, 252, 0.45)';
      ctx.fillRect(x0 + i * bw, y0 - bh, bw - 3, bh);
      if (s.picked?.has(i)) {
        ctx.font = `${Math.round(Math.min(14, bw))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('❤️', x0 + i * bw + (bw - 3) / 2, y0 - bh - 3);
      }
    });
    return;
  }
  for (const s of series) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    s.values.forEach((d, i) => {
      const px = x0 + (W * i) / Math.max(1, n - 1);
      const py = y0 - (H * Math.max(0, d)) / max;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }
}

/** "45 s", "12 min", "1 h 10 min": simulated practice time. */
export function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const min = Math.floor(seconds / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${min % 60} min`;
}
