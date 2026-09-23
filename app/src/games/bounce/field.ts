// The zoom-out view: average the balls onto a coarse grid of squares and draw
// only what a fluid simulation keeps — how full each square is (density) and
// how fast its balls jiggle (temperature) — blurred into a smooth field. With
// a boiling pit this looks like the fluids in Swirl Lab and Save the
// Netherlands, which is the point: they compute the crowd, not the balls.
import type { Ball, Box } from './physics';

// Swirl Lab's blue (brightened to show on the dark ground) and orange, cold
// to hot, ending in pale yellow.
const COLD = [56, 132, 220];
const MID = [240, 140, 31];
const HOT = [255, 236, 170];

export class FieldView {
  private canvas = document.createElement('canvas');
  private image: ImageData | null = null;
  private area = new Float32Array(0);
  private mass = new Float32Array(0);
  private energy = new Float32Array(0);

  /**
   * `cell` is the square size in px; `vref` the jiggle speed that counts as
   * hot. Returns the grid size so callers can draw its lines.
   */
  draw(ctx: CanvasRenderingContext2D, balls: Ball[], box: Box, cell: number, vref: number, alpha: number): { nx: number; ny: number } {
    const nx = Math.max(1, Math.ceil((box.x1 - box.x0) / cell));
    const ny = Math.max(1, Math.ceil((box.y1 - box.y0) / cell));
    const n = nx * ny;
    if (this.area.length < n) {
      this.area = new Float32Array(n);
      this.mass = new Float32Array(n);
      this.energy = new Float32Array(n);
    }
    this.area.fill(0, 0, n);
    this.mass.fill(0, 0, n);
    this.energy.fill(0, 0, n);
    for (const b of balls) {
      const i = Math.min(nx - 1, Math.max(0, Math.floor((b.x - box.x0) / cell)));
      const j = Math.min(ny - 1, Math.max(0, Math.floor((b.y - box.y0) / cell)));
      const c = j * nx + i;
      this.area[c] += Math.PI * b.r * b.r;
      this.mass[c] += b.m;
      this.energy[c] += b.m * (b.vx * b.vx + b.vy * b.vy);
    }
    if (this.canvas.width !== nx || this.canvas.height !== ny || !this.image) {
      this.canvas.width = nx;
      this.canvas.height = ny;
      this.image = new ImageData(nx, ny);
    }
    const data = this.image.data;
    const full = cell * cell;
    for (let c = 0; c < n; c++) {
      const density = Math.min(1, this.area[c] / (0.75 * full));
      const t = this.mass[c] > 0 ? Math.min(1, Math.sqrt(this.energy[c] / this.mass[c]) / vref) : 0;
      const [r, g, b] = ramp(t);
      data[4 * c] = r;
      data[4 * c + 1] = g;
      data[4 * c + 2] = b;
      data[4 * c + 3] = Math.round(255 * density);
    }
    this.canvas.getContext('2d')!.putImageData(this.image, 0, 0);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.filter = `blur(${Math.round(cell * 0.2)}px)`;
    ctx.drawImage(this.canvas, box.x0, box.y0, nx * cell, ny * cell);
    ctx.restore();
    return { nx, ny };
  }
}

function ramp(t: number): number[] {
  const mix = (a: number[], b: number[], s: number) => a.map((v, k) => v + (b[k] - v) * s);
  return t < 0.5 ? mix(COLD, MID, t / 0.5) : mix(MID, HOT, (t - 0.5) / 0.5);
}
