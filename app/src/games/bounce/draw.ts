// Drawing shared by the ball pit and the challenge rounds.
import type { Ball, Box } from './physics';

/**
 * Balls in their own colours, crossfading into a speed colour (blue slow, red
 * fast) as `tint` goes to 1; golden balls on top.
 */
export function drawBalls(ctx: CanvasRenderingContext2D, balls: Ball[], tint: number, vref: number): void {
  for (const b of balls) {
    if (b.gold) continue;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${b.hue}, 85%, 62%)`;
    ctx.fill();
    if (tint > 0.01) {
      ctx.globalAlpha = tint;
      ctx.fillStyle = speedColor(Math.hypot(b.vx, b.vy) / vref);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.arc(b.x - 0.35 * b.r, b.y - 0.35 * b.r, 0.3 * b.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();
  }
  for (const b of balls) {
    if (!b.gold) continue;
    const g = ctx.createRadialGradient(b.x - 0.4 * b.r, b.y - 0.4 * b.r, 0.1 * b.r, b.x, b.y, b.r);
    g.addColorStop(0, '#fff7c2');
    g.addColorStop(0.45, '#fbbf24');
    g.addColorStop(1, '#b45309');
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }
}

/** 0 = still (blue) … 1 and above = fast (red). */
export function speedColor(s: number): string {
  const t = Math.max(0, Math.min(1, s));
  return `hsl(${230 - 230 * t}, 90%, ${50 + 12 * t}%)`;
}

/** The pit's frame: base strip under the floor, outline, and a floor line that glows with heat. */
export function drawFrame(ctx: CanvasRenderingContext2D, box: Box, w: number, h: number, heat = 0): void {
  const { x0, y0, x1, y1 } = box;
  ctx.fillStyle = '#10172e';
  ctx.fillRect(0, y1, w, h - y1);
  ctx.strokeStyle = 'rgba(238, 242, 255, 0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  drawFloor(ctx, x0, x1, y1, heat);
}

/** A floor line; with heat it becomes a glowing hot plate. */
export function drawFloor(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, heat: number, glow = 90): void {
  if (heat > 0) {
    const g = ctx.createLinearGradient(0, y, 0, y - glow);
    g.addColorStop(0, `rgba(251, 146, 60, ${0.45 * heat})`);
    g.addColorStop(1, 'rgba(251, 146, 60, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y - glow, x1 - x0, glow);
  }
  ctx.strokeStyle = heat > 0 ? `rgb(${160 + 95 * heat}, ${170 - 40 * heat}, ${190 - 150 * heat})` : 'rgba(238, 242, 255, 0.45)';
  ctx.lineWidth = 4 + 3 * heat;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
}

export function arrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
  color: string,
  width = 3,
): void {
  const len = Math.hypot(dx, dy);
  if (len < 4) return;
  const ux = dx / len;
  const uy = dy / len;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dx - ux * 8, y + dy - uy * 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + dx, y + dy);
  ctx.lineTo(x + dx - ux * 10 - uy * 5, y + dy - uy * 10 + ux * 5);
  ctx.lineTo(x + dx - ux * 10 + uy * 5, y + dy - uy * 10 - ux * 5);
  ctx.closePath();
  ctx.fill();
}

/** Centered text with a dark halo, readable over balls. */
export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center'): void {
  ctx.font = `700 ${Math.round(size)}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size / 4);
  ctx.strokeStyle = 'rgba(5, 8, 20, 0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
