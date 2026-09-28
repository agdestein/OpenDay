export function randRange(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo);
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/**
 * Largest canvas backing store (device pixels) worth rendering: about 1080p.
 * A big screen at 4K with 200 % scaling would otherwise render four times the
 * pixels in every game, for no visible gain from two metres away.
 */
const MAX_CANVAS_PIXELS = 2.2e6;
/** `?dpr=1.5` pins the ratio on a machine (staff tuning for a slow or huge screen). */
let dprOverride: number | undefined;

/**
 * Device pixel ratio for canvas backing stores: capped at 2 (phones have 3+),
 * and lowered towards 1 when the screen is so large that the canvas would pass
 * MAX_CANVAS_PIXELS. Never below 1 unless `?dpr=` asks for it.
 */
export function cappedDpr(): number {
  // Read lazily: the Node tests import this module without a `location`.
  dprOverride ??= Number(new URLSearchParams(location.search).get('dpr')) || 0;
  if (dprOverride > 0) return dprOverride;
  const area = Math.max(1, window.innerWidth * window.innerHeight);
  const budget = Math.max(1, Math.sqrt(MAX_CANVAS_PIXELS / area));
  return Math.min(window.devicePixelRatio || 1, 2, budget);
}

/** Pointer event position in CSS-pixel canvas coordinates. */
export function pointerPos(canvas: HTMLCanvasElement, e: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}
