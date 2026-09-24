// Drawing helpers shared by Gravity Doodle's toy and its challenge rounds.

/** A glowing star: a white-hot core fading through its colour into space. */
export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, hue = 45, pulse = 0): void {
  const R = r * (2.4 + 0.15 * pulse);
  const glow = ctx.createRadialGradient(x, y, r * 0.15, x, y, R);
  glow.addColorStop(0, '#fffbe6');
  glow.addColorStop(0.35, `hsl(${hue}, 100%, 62%)`);
  glow.addColorStop(0.55, `hsla(${hue}, 100%, 55%, 0.35)`);
  glow.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * A planet lit from one side: bright where it faces (lx, ly), dark on the
 * far side. Giants get a ring.
 */
export function drawPlanet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  hue: number,
  lx: number,
  ly: number,
  ring = false,
): void {
  const d = Math.hypot(lx - x, ly - y) || 1;
  const ux = (lx - x) / d;
  const uy = (ly - y) / d;
  if (ring) drawRing(ctx, x, y, r, hue, false);
  const g = ctx.createRadialGradient(x + ux * r * 0.45, y + uy * r * 0.45, r * 0.1, x, y, r * 1.05);
  g.addColorStop(0, `hsl(${hue}, 85%, 80%)`);
  g.addColorStop(0.55, `hsl(${hue}, 70%, 55%)`);
  g.addColorStop(1, `hsl(${hue}, 60%, 18%)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (ring) drawRing(ctx, x, y, r, hue, true);
}

/** Half a tilted ring: the back half before the planet, the front half after. */
function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, hue: number, front: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.35);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.9, r * 0.55, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
  ctx.strokeStyle = `hsla(${(hue + 30) % 360}, 60%, 75%, 0.75)`;
  ctx.lineWidth = Math.max(2, r * 0.22);
  ctx.stroke();
  ctx.restore();
}

/** Blue-and-green Earth. */
export function drawEarth(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#3b82f6';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - r * 0.25, y - r * 0.2, r * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = '#4ade80';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + r * 0.35, y + r * 0.35, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

/** Centred text with a dark halo, readable over trails and stars. */
export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center'): void {
  ctx.font = `700 ${Math.round(size)}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(5, 8, 26, 0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, color: string, width = 3): void {
  const len = Math.hypot(dx, dy);
  if (len < 4) return;
  const ux = dx / len;
  const uy = dy / len;
  const head = 6 + width * 2;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dx - ux * head * 0.8, y + dy - uy * head * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + dx, y + dy);
  ctx.lineTo(x + dx - ux * head - uy * head * 0.5, y + dy - uy * head + ux * head * 0.5);
  ctx.lineTo(x + dx - ux * head + uy * head * 0.5, y + dy - uy * head - ux * head * 0.5);
  ctx.closePath();
  ctx.fill();
}

/** A soft starfield, fixed per screen size (seeded), so the dark isn't empty. */
export function starfield(w: number, h: number): { x: number; y: number; r: number; a: number }[] {
  let s = 12345;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const n = Math.round((w * h) / 9000);
  return Array.from({ length: n }, () => ({ x: rnd() * w, y: rnd() * h, r: 0.4 + rnd() * 1.1, a: 0.15 + rnd() * 0.45 }));
}
