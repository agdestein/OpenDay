// Drawing helpers for Weather Detective: the weather-map palette, turning a
// grid into an image, fog, thermometers and home stations.

/** Weather-map colours from cold to hot (TV style). */
const STOPS: [number, number, number][] = [
  [38, 52, 140],
  [48, 110, 200],
  [70, 180, 220],
  [120, 205, 150],
  [205, 225, 95],
  [250, 205, 70],
  [245, 140, 50],
  [220, 60, 40],
  [150, 20, 45],
];

const LUT = new Uint8ClampedArray(256 * 3);
for (let i = 0; i < 256; i++) {
  const t = (i / 255) * (STOPS.length - 1);
  const k = Math.min(STOPS.length - 2, Math.floor(t));
  const f = t - k;
  for (let c = 0; c < 3; c++) LUT[i * 3 + c] = STOPS[k][c] + (STOPS[k + 1][c] - STOPS[k][c]) * f;
}

/** The same colours as an RGBA byte table, for the GPU renderer. */
export const LUT_RGBA = new Uint8Array(256 * 4);
for (let i = 0; i < 256; i++) {
  LUT_RGBA.set([LUT[i * 3], LUT[i * 3 + 1], LUT[i * 3 + 2], 255], i * 4);
}

export interface Scale {
  lo: number;
  hi: number;
}

/** CSS colour for a temperature on a scale. */
export function tempColor(t: number, scale: Scale, alpha = 1): string {
  const i = Math.max(0, Math.min(255, Math.round(((t - scale.lo) / (scale.hi - scale.lo)) * 255)));
  return `rgba(${LUT[i * 3]}, ${LUT[i * 3 + 1]}, ${LUT[i * 3 + 2]}, ${alpha})`;
}

/**
 * Paint a temperature field into an image of the same grid size, with thin
 * isotherm lines every degree (the weather-map look).
 */
export function paintField(img: ImageData, field: Float32Array, scale: Scale, land?: Uint8Array, isotherms = true): void {
  const d = img.data;
  const nx = img.width;
  const span = scale.hi - scale.lo;
  for (let k = 0; k < field.length; k++) {
    const t = field[k];
    const o = k * 4;
    if ((land && !land[k]) || Number.isNaN(t)) {
      d[o + 3] = 0;
      continue;
    }
    const i = Math.max(0, Math.min(255, ((t - scale.lo) / span) * 255)) | 0;
    // A contour where this cell and its left or upper neighbour sit on
    // different sides of a whole degree.
    let line = 1;
    if (isotherms) {
      const f = Math.floor(t);
      const l = k % nx > 0 ? field[k - 1] : t;
      const u = k >= nx ? field[k - nx] : t;
      if ((!Number.isNaN(l) && Math.floor(l) !== f) || (!Number.isNaN(u) && Math.floor(u) !== f)) line = 0.84;
    }
    d[o] = LUT[i * 3] * line;
    d[o + 1] = LUT[i * 3 + 1] * line;
    d[o + 2] = LUT[i * 3 + 2] * line;
    d[o + 3] = 255;
  }
}

/** Paint an error field: transparent where right, deepening red where wrong. */
export function paintError(img: ImageData, err: Float32Array, full: number): void {
  const d = img.data;
  for (let k = 0; k < err.length; k++) {
    const e = err[k];
    const o = k * 4;
    if (Number.isNaN(e)) {
      d[o + 3] = 0;
      continue;
    }
    const a = Math.max(0, Math.min(1, e / full));
    d[o] = 255 - 60 * a;
    d[o + 1] = 245 - 215 * a;
    d[o + 2] = 235 - 205 * a;
    d[o + 3] = 255;
  }
}

/**
 * "Unknown" overlay for the 2D fallback: grey, thicker where the spread is
 * large relative to the prior spread (fully grey = "no idea").
 */
export function paintFog(img: ImageData, sd: Float32Array, prior: Float32Array, nx: number, t: number): void {
  const d = img.data;
  for (let k = 0; k < sd.length; k++) {
    const o = k * 4;
    const rel = prior[k] > 0 ? sd[k] / prior[k] : 0;
    const base = Math.max(0, Math.min(1, (rel - 0.12) / 0.7));
    const x = k % nx, y = (k / nx) | 0;
    const n = 0.72 + 0.14 * Math.sin(x * 0.31 + t * 0.6) * Math.sin(y * 0.27 - t * 0.45) + 0.14 * Math.sin((x + y) * 0.13 + t * 0.3);
    const a = base * n;
    d[o] = 128;
    d[o + 1] = 133;
    d[o + 2] = 145;
    d[o + 3] = Math.min(245, a * 255);
  }
}

/** A thermometer standing at (x, y) (its bulb's bottom), `h` px tall. */
export function drawThermometer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  fill: number,
  color: string,
  opts: { ghost?: boolean; grey?: boolean; glow?: string } = {},
): void {
  const w = h * 0.28;
  const bulb = w * 0.85;
  const top = y - h;
  const tubeBottom = y - bulb * 1.6;
  ctx.save();
  if (opts.ghost) ctx.globalAlpha = 0.75;
  if (opts.glow) {
    ctx.shadowColor = opts.glow;
    ctx.shadowBlur = h * 0.5;
  }
  // Glass.
  ctx.fillStyle = opts.grey ? '#8c93a0' : '#f4f7fb';
  ctx.strokeStyle = '#1b2233';
  ctx.lineWidth = Math.max(1.5, h * 0.045);
  ctx.beginPath();
  ctx.roundRect(x - w / 2, top, w, tubeBottom - top + w / 2, w / 2);
  ctx.arc(x, y - bulb, bulb, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  // Glass again over the seam between tube and bulb.
  ctx.beginPath();
  ctx.roundRect(x - w / 2 + ctx.lineWidth / 2, top + ctx.lineWidth / 2, w - ctx.lineWidth, tubeBottom - top + w / 2, w / 2);
  ctx.arc(x, y - bulb, bulb - ctx.lineWidth / 2, 0, Math.PI * 2);
  ctx.fill();
  // Mercury.
  const m = opts.grey ? '#5d6470' : color;
  ctx.fillStyle = m;
  ctx.beginPath();
  ctx.arc(x, y - bulb, bulb * 0.66, 0, Math.PI * 2);
  ctx.fill();
  const inner = w * 0.42;
  const colTop = tubeBottom - Math.max(0.06, Math.min(1, fill)) * (tubeBottom - top - w * 0.35);
  ctx.fillRect(x - inner / 2, colTop, inner, y - bulb - colTop);
  ctx.restore();
}

/** A little house (a home weather station), centre at (x, y). */
export function drawHouse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  color: string,
  opts: { grey?: boolean; ring?: string; cross?: boolean } = {},
): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - s * 0.55, y + s * 0.5);
  ctx.lineTo(x - s * 0.55, y - s * 0.05);
  ctx.lineTo(x, y - s * 0.6);
  ctx.lineTo(x + s * 0.55, y - s * 0.05);
  ctx.lineTo(x + s * 0.55, y + s * 0.5);
  ctx.closePath();
  ctx.fillStyle = opts.grey ? '#7c828d' : color;
  ctx.fill();
  ctx.lineWidth = Math.max(1.2, s * 0.14);
  ctx.strokeStyle = '#141a28';
  ctx.stroke();
  if (opts.ring) {
    ctx.beginPath();
    ctx.arc(x, y, s * 1.15, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(2, s * 0.2);
    ctx.strokeStyle = opts.ring;
    ctx.stroke();
  }
  if (opts.cross) {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y - s * 0.5);
    ctx.lineTo(x + s * 0.5, y + s * 0.5);
    ctx.moveTo(x + s * 0.5, y - s * 0.5);
    ctx.lineTo(x - s * 0.5, y + s * 0.5);
    ctx.lineWidth = Math.max(2, s * 0.22);
    ctx.strokeStyle = '#ff5a4f';
    ctx.stroke();
  }
  ctx.restore();
}

/** A rounded label with dark outline, readable over any colour. */
export function drawTag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, bg = 'rgba(12, 17, 30, 0.86)', fg = '#fff'): void {
  ctx.save();
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  const w = ctx.measureText(text).width + size * 0.7;
  const h = size * 1.45;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + size * 0.04);
  ctx.restore();
}

/** Vertical colour legend with degree ticks. */
export function drawLegend(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, scale: Scale, unit = '°C'): void {
  const g = ctx.createLinearGradient(0, y + h, 0, y);
  for (let i = 0; i <= 16; i++) {
    const t = scale.lo + ((scale.hi - scale.lo) * i) / 16;
    g.addColorStop(i / 16, tempColor(t, scale));
  }
  ctx.save();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, w / 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  const span = scale.hi - scale.lo;
  const step = span > 14 ? 5 : span > 6 ? 2 : 1;
  ctx.fillStyle = 'rgba(235, 240, 250, 0.9)';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let t = Math.ceil(scale.lo / step) * step; t <= scale.hi; t += step) {
    const ty = y + h - ((t - scale.lo) / span) * h;
    ctx.fillRect(x + w, ty, 5, 1.5);
    ctx.fillText(`${t}${unit}`, x + w + 8, ty);
  }
  ctx.restore();
}
