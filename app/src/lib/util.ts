export function randRange(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo);
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Pointer event position in CSS-pixel canvas coordinates. */
export function pointerPos(canvas: HTMLCanvasElement, e: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}
