// The zoom-out view: cut the pit into squares and keep, per square, only what a
// fluid simulation keeps — how full it is and how fast its balls move — instead
// of every ball. Drawn as flat squares on the same grid the other games show,
// so "the computer keeps these numbers" is literally what you see.
import type { Ball, Box } from './physics';

export interface Squares {
  nx: number;
  ny: number;
  cell: number;
  /** Fraction of each square covered by balls, 0..1. */
  full: Float32Array;
  /** Root-mean-square speed of the balls in each square. */
  speed: Float32Array;
}

/** Averages the balls onto squares of size `cell`, starting at the box corner. */
export function averageSquares(balls: Ball[], box: Box, cell: number, into?: Squares): Squares {
  const nx = Math.max(1, Math.ceil((box.x1 - box.x0) / cell));
  const ny = Math.max(1, Math.ceil((box.y1 - box.y0) / cell));
  const n = nx * ny;
  const sq =
    into && into.full.length >= n
      ? into
      : { nx, ny, cell, full: new Float32Array(n), speed: new Float32Array(n) };
  sq.nx = nx;
  sq.ny = ny;
  sq.cell = cell;
  const mass = new Float32Array(n);
  sq.full.fill(0, 0, n);
  sq.speed.fill(0, 0, n);
  for (const b of balls) {
    const i = Math.min(nx - 1, Math.max(0, Math.floor((b.x - box.x0) / cell)));
    const j = Math.min(ny - 1, Math.max(0, Math.floor((b.y - box.y0) / cell)));
    const c = j * nx + i;
    sq.full[c] += Math.PI * b.r * b.r;
    mass[c] += b.m;
    sq.speed[c] += b.m * (b.vx * b.vx + b.vy * b.vy);
  }
  // A square packed with discs is ~80 % covered; call that full.
  const packed = 0.8 * cell * cell;
  for (let c = 0; c < n; c++) {
    sq.full[c] = Math.min(1, sq.full[c] / packed);
    sq.speed[c] = mass[c] > 0 ? Math.sqrt(sq.speed[c] / mass[c]) : 0;
  }
  return sq;
}

/** One flat square per cell, coloured by `color` (null = leave it empty). */
export function drawSquares(
  ctx: CanvasRenderingContext2D,
  sq: Squares,
  box: Box,
  alpha: number,
  color: (full: number, speed: number) => string | null,
): void {
  const gap = Math.max(1, sq.cell * 0.04);
  ctx.globalAlpha = alpha;
  for (let j = 0; j < sq.ny; j++) {
    for (let i = 0; i < sq.nx; i++) {
      const c = j * sq.nx + i;
      const fill = color(sq.full[c], sq.speed[c]);
      if (!fill) continue;
      const x = box.x0 + i * sq.cell;
      const y = box.y0 + j * sq.cell;
      ctx.fillStyle = fill;
      ctx.fillRect(x + gap / 2, y + gap / 2, Math.min(sq.cell, box.x1 - x) - gap, Math.min(sq.cell, box.y1 - y) - gap);
    }
  }
  ctx.globalAlpha = 1;
}

export function drawGridLines(ctx: CanvasRenderingContext2D, box: Box, cell: number, alpha: number, lineWidth = 1): void {
  ctx.strokeStyle = `rgba(238, 242, 255, ${alpha})`;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  for (let x = box.x0 + cell; x < box.x1 - 0.5; x += cell) {
    ctx.moveTo(x, box.y0);
    ctx.lineTo(x, box.y1);
  }
  for (let y = box.y0 + cell; y < box.y1 - 0.5; y += cell) {
    ctx.moveTo(box.x0, y);
    ctx.lineTo(box.x1, y);
  }
  ctx.stroke();
}
