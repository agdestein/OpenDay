export function randRange(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo);
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Device pixel ratio, capped so phone screens (dpr 3+) don't get huge canvas backing stores. */
export function cappedDpr(): number {
  return Math.min(window.devicePixelRatio || 1, 2);
}

/** Pointer event position in CSS-pixel canvas coordinates. */
export function pointerPos(canvas: HTMLCanvasElement, e: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}
