// The live illustrations of Swirl Lab's delve layer. The chapter text lives
// in delve.ts; this stage turns the running fluid simulation itself into the
// picture for each chapter — velocity arrows, a coarsened "cells" view,
// pressure and swirl fields, magnifier lenses, a two-turbine wake demo — and
// draws callouts on a 2D overlay canvas. The fluid stays stirrable throughout.
import type { GameHost } from '../../shell/types';
import type { FieldView, FluidSolver, Lens, Obstacle } from './fluid';
import { WakeDemo } from './game';
import { pick, type Localized } from '../../lib/i18n';

/** Chapter order in delve.ts. */
export const CH_ARROWS = 0;
export const CH_CELLS = 1;
export const CH_RULES = 2;
export const CH_TURBULENCE = 3;
export const CH_WAKES = 4;

/** Slider stops of the cells chapter: cells across the screen (0 = the real grid). */
export const CELL_STEPS = [12, 24, 48, 96, 192, 0];
/** One arrow per cell up to this many cells across; finer grids get too dense. */
const MAX_CELL_ARROWS = 48;
/** Arrows across the screen in the arrows chapter. */
const ARROWS_ACROSS = 36;
/** Full wind (60 reference cells/sec) shown as a friendly 10 m/s. */
const TO_METERS_PER_SECOND = 10 / 60;
/** Seconds without stirring before the automatic stirrer takes over. */
const AUTO_STIR_DELAY = 2.5;

/**
 * The turbulence chapter's two magnifiers (4x and 16x) in the right margin.
 * Both look at the same spot, which follows the pointer (or trails the
 * automatic stirrer when nobody points).
 */
const LENS_RADIUS = 0.19;
const LENS_SPOTS = [
  { x: 0.86, y: 0.71, zoom: 4, grid: false },
  { x: 0.86, y: 0.27, zoom: 16, grid: true },
];
/** Figure-eight path of the automatic stirrers: center, amplitude, angular speeds. */
const GENTLE_STIR = { cx: 0.66, cy: 0.5, ax: 0.17, ay: 0.26, wx: 1.9, wy: 3.1, force: 1 };
const HARD_STIR = { cx: 0.55, cy: 0.5, ax: 0.2, ay: 0.3, wx: 2.4, wy: 3.4, force: 1.6 };

const TEXT: Localized<{ cellStores: string; cellLabel: string; lensCells: string }> = {
  en: { cellStores: 'This cell stores:', cellLabel: 'm/s', lensCells: 'the computer’s cells' },
  nl: { cellStores: 'Deze cel onthoudt:', cellLabel: 'm/s', lensCells: 'de cellen van de computer' },
  no: { cellStores: 'Denne cellen husker:', cellLabel: 'm/s', lensCells: 'datamaskinens celler' },
};

export interface DelveStageHooks {
  setWind(on: boolean): void;
  setObstacles(obstacles: Obstacle[]): void;
  /** Seconds since the player last stirred. */
  sinceStir(): number;
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

export class DelveStage {
  chapter = -1;
  /** Cells chapter: index into CELL_STEPS. */
  cellStep = 1;
  /** Rules chapter: the field on show. */
  rulesView: FieldView = 'pressure';

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private wakeDemo: WakeDemo | null = null;
  private time = 0;
  private autoTime = 0;
  private hue = Math.random();
  private pointer: { x: number; y: number; at: number } | null = null;
  private cellVelocity: [number, number] = [0, 0];
  private sinceProbe = 0;
  /** Where the magnifiers look (uv), and where they are heading on their own. */
  private lensSrc = { x: 0.55, y: 0.5 };
  private lensAuto = { x: 0.55, y: 0.5 };
  private sinceScan = Infinity;

  private onPointerMove = (e: PointerEvent) => {
    const rect = this.host.canvas.getBoundingClientRect();
    this.pointer = {
      x: (e.clientX - rect.left) / rect.width,
      y: 1 - (e.clientY - rect.top) / rect.height,
      at: this.time,
    };
  };

  constructor(
    private host: GameHost,
    private solver: FluidSolver,
    private hooks: DelveStageHooks,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'delve-stage';
    this.ctx = this.canvas.getContext('2d')!;
    // Beneath the card and toolbar, above the fluid.
    host.overlay.prepend(this.canvas);
    host.canvas.addEventListener('pointermove', this.onPointerMove);
  }

  /** The wakes chapter shows the wind-farm view (speed colors and tracers). */
  get wakeView(): boolean {
    return this.chapter === CH_WAKES;
  }

  setChapter(chapter: number): void {
    if (chapter === this.chapter) return;
    this.chapter = chapter;
    this.wakeDemo?.destroy();
    this.wakeDemo = null;
    // Each chapter starts from a clean, steady flow.
    const windy = chapter === CH_RULES || chapter === CH_WAKES;
    this.hooks.setWind(windy);
    this.hooks.setObstacles(chapter === CH_RULES ? [{ x: 0.6, y: 0.5, r: 0.07 }] : []);
    this.solver.wind = windy ? 60 : 0;
    this.solver.windAngle = 0;
    this.solver.reset();
    if (chapter === CH_WAKES) this.wakeDemo = new WakeDemo(this.host, this.solver);
  }

  /** Called once per simulation substep, before solver.step(dt). */
  tick(dt: number): void {
    this.time += dt;
    if (this.chapter === CH_ARROWS || this.chapter === CH_CELLS) {
      if (this.hooks.sinceStir() > AUTO_STIR_DELAY) this.autoStir(dt, GENTLE_STIR, false);
    }
    if (this.chapter === CH_TURBULENCE) {
      // The storm keeps going even while the player stirs along.
      this.autoStir(dt, HARD_STIR, true);
      this.aimLenses(dt);
    }
    this.wakeDemo?.tick(dt);
  }

  /** Configure the display for the current chapter (after the game's defaults). */
  applyView(solver: FluidSolver): void {
    switch (this.chapter) {
      case CH_ARROWS:
        solver.arrowsAcross = ARROWS_ACROSS;
        break;
      case CH_CELLS: {
        const across = CELL_STEPS[this.cellStep];
        solver.cellsAcross = across;
        solver.arrowsAcross = across > 0 && across <= MAX_CELL_ARROWS ? across : 0;
        break;
      }
      case CH_RULES:
        solver.view = this.rulesView;
        break;
      case CH_TURBULENCE:
        solver.lenses = this.lenses();
        break;
    }
  }

  /** Redraw the 2D overlay (callouts, lens connectors). Called once per frame. */
  drawOverlay(): void {
    const dpr = this.host.dpr;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (this.chapter === CH_CELLS) this.drawCellCallout(ctx, w, h);
    if (this.chapter === CH_TURBULENCE) this.drawLensConnectors(ctx, w, h);
  }

  dispose(): void {
    this.wakeDemo?.destroy();
    this.wakeDemo = null;
    this.hooks.setObstacles([]);
    this.host.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.remove();
  }

  // ---- automatic stirring, so there is always something to look at ----

  /**
   * A figure-eight stir, like a hand dragging through the fluid. The banded
   * variant lays down two alternating contrasting dyes, so the folding of
   * turbulence shows at every scale instead of mixing into one color.
   */
  private autoStir(dt: number, path: typeof GENTLE_STIR, banded: boolean): void {
    const t0 = this.autoTime;
    this.autoTime += dt;
    const at = (t: number) => ({
      x: path.cx + path.ax * Math.sin(t * path.wx),
      y: path.cy + path.ay * Math.sin(t * path.wy + 0.7),
    });
    const a = at(t0);
    const b = at(this.autoTime);
    // Same scaling as a pointer drag in index.ts (uv delta per event x 6000).
    const force = 6000 * path.force;
    this.solver.splatVelocity(b.x, b.y, (b.x - a.x) * force, (b.y - a.y) * force);
    let color: [number, number, number];
    if (banded) {
      color = Math.floor(this.autoTime / 0.5) % 2 ? [1.0, 0.5, 0.12] : [0.12, 0.7, 1.0];
    } else {
      this.hue = (this.hue + dt * 0.08) % 1;
      color = hsvToRgb(this.hue, 0.85, 1);
    }
    const gain = banded ? 0.16 : 0.1;
    this.solver.splatDye(b.x, b.y, color[0] * gain, color[1] * gain, color[2] * gain, 0.0025);
  }

  /**
   * The magnifiers' shared target: the pointer if it is aiming; otherwise the
   * most swirly spot in view, found twice a second from a coarse readback of
   * the dye (the cell whose color differs most from its neighbours).
   */
  private aimLenses(dt: number): void {
    const p = this.pointer;
    const aiming = p && this.time - p.at < 3 && p.x > 0.3 && !this.overLens(p.x, p.y);
    this.sinceScan += dt;
    if (!aiming && this.sinceScan > 0.5) {
      this.sinceScan = 0;
      this.lensAuto = this.findDetail();
    }
    const target = aiming ? p : this.lensAuto;
    // Glide rather than jump.
    const k = 1 - Math.exp(-dt * (aiming ? 20 : 2));
    this.lensSrc.x += (target.x - this.lensSrc.x) * k;
    this.lensSrc.y += (target.y - this.lensSrc.y) * k;
  }

  private findDetail(): { x: number; y: number } {
    const W = 48;
    const H = 27;
    const dye = this.solver.readDye(W, H);
    const at = (i: number, j: number) => (j * W + i) * 4;
    let best = this.lensAuto;
    let bestScore = -1;
    for (let j = 4; j < H - 4; j++) {
      for (let i = 1; i < W - 1; i++) {
        const x = (i + 0.5) / W;
        const y = (j + 0.5) / H;
        // Only the open middle: not under the card or the lenses.
        if (x < 0.33 || x > 0.72) continue;
        const c = at(i, j);
        let contrast = 0;
        for (const n of [at(i - 1, j), at(i + 1, j), at(i, j - 1), at(i, j + 1)]) {
          contrast += Math.abs(dye[c] - dye[n]) + Math.abs(dye[c + 1] - dye[n + 1]) + Math.abs(dye[c + 2] - dye[n + 2]);
        }
        // Prefer staying put a little, so the lenses don't flit about.
        const d2 = (x - this.lensAuto.x) ** 2 + (y - this.lensAuto.y) ** 2;
        const score = contrast * (1 + 0.6 * Math.exp(-d2 / 0.01));
        if (score > bestScore) {
          bestScore = score;
          best = { x, y };
        }
      }
    }
    return best;
  }

  private overLens(x: number, y: number): boolean {
    const aspect = this.host.canvas.clientWidth / Math.max(1, this.host.canvas.clientHeight);
    return LENS_SPOTS.some((l) => Math.hypot((x - l.x) * aspect, y - l.y) < LENS_RADIUS * 1.1);
  }

  private lenses(): Lens[] {
    return LENS_SPOTS.map((l) => ({ ...l, r: LENS_RADIUS, srcX: this.lensSrc.x, srcY: this.lensSrc.y }));
  }

  // ---- overlay drawings ----

  /**
   * Cells chapter: highlight one cell (under the pointer, or a default one)
   * and show the two numbers it stores, live.
   */
  private drawCellCallout(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const across = CELL_STEPS[this.cellStep] || this.solver.gridSize[0];
    const down = CELL_STEPS[this.cellStep] ? this.solver.cellsDown(across) : this.solver.gridSize[1];
    const recent = this.pointer && this.time - this.pointer.at < 4 && this.pointer.x > 0.3;
    const target = recent ? this.pointer! : { x: 0.7, y: 0.6 };
    const col = Math.min(across - 1, Math.max(0, Math.floor(target.x * across)));
    const row = Math.min(down - 1, Math.max(0, Math.floor(target.y * down)));
    const cx = (col + 0.5) / across;
    const cy = (row + 0.5) / down;

    // A few readbacks per second are plenty for a number display.
    this.sinceProbe += 1;
    if (this.sinceProbe >= 6) {
      this.sinceProbe = 0;
      const v = this.solver.sampleVelocities([{ x: cx, y: cy }]);
      this.cellVelocity = [v[0], v[1]];
    }

    const cellW = w / across;
    const cellH = h / down;
    const left = col * cellW;
    const top = (down - 1 - row) * cellH;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fde047';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 6;
    ctx.strokeRect(left - 1.5, top - 1.5, Math.max(cellW, 6) + 3, Math.max(cellH, 6) + 3);

    // Callout box beside the cell, flipped to stay on screen.
    const T = pick(TEXT);
    const font = Math.max(14, h * 0.022);
    const boxW = font * 11;
    const boxH = font * 5.6;
    const gap = font * 1.5;
    const flip = left + cellW + gap + boxW > w - 10;
    const bx = flip ? left - gap - boxW : left + cellW + gap;
    const by = Math.min(h - boxH - h * 0.12, Math.max(h * 0.08, top + cellH / 2 - boxH / 2));
    ctx.beginPath();
    ctx.moveTo(flip ? left : left + cellW, top + cellH / 2);
    ctx.lineTo(flip ? bx + boxW : bx, by + boxH / 2);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(8, 12, 26, 0.9)';
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.8)';
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, font * 0.6);
    ctx.fill();
    ctx.stroke();

    const [vx, vy] = this.cellVelocity.map((v) => v * TO_METERS_PER_SECOND);
    const fmt = (v: number) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`;
    ctx.fillStyle = 'rgba(238, 242, 255, 0.75)';
    ctx.font = `600 ${font * 0.85}px system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(T.cellStores, bx + font * 0.8, by + font * 0.6);
    ctx.fillStyle = '#fde047';
    ctx.font = `800 ${font * 1.35}px system-ui, sans-serif`;
    ctx.fillText(`→ ${fmt(vx)}`, bx + font * 0.8, by + font * 1.9);
    ctx.fillText(`↑ ${fmt(vy)}`, bx + font * 0.8, by + font * 3.5);
    ctx.fillStyle = 'rgba(238, 242, 255, 0.6)';
    ctx.font = `600 ${font * 0.8}px system-ui, sans-serif`;
    ctx.fillText(T.cellLabel, bx + font * 5.6, by + font * 2.3);
    ctx.fillText(T.cellLabel, bx + font * 5.6, by + font * 3.9);

    // The cell's arrow, drawn big.
    const ax = bx + boxW - font * 2.3;
    const ay = by + boxH / 2 + font * 0.2;
    const speed = Math.hypot(vx, vy);
    const len = font * 0.9 + font * 1.3 * (1 - Math.exp(-speed / 4));
    const angle = Math.atan2(-vy * (h / 144) / (w / 256), vx);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(angle);
    ctx.strokeStyle = '#fde047';
    ctx.fillStyle = '#fde047';
    ctx.lineWidth = font * 0.2;
    ctx.beginPath();
    ctx.moveTo(-len / 2, 0);
    ctx.lineTo(len / 2 - font * 0.4, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(len / 2, 0);
    ctx.lineTo(len / 2 - font * 0.55, -font * 0.35);
    ctx.lineTo(len / 2 - font * 0.55, font * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /**
   * Turbulence chapter: a zoom chain. The 4x lens magnifies a marked spot of
   * the main view; the 16x lens magnifies the middle of the 4x lens, marked
   * inside it.
   */
  private drawLensConnectors(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const T = pick(TEXT);
    const font = Math.max(14, h * 0.024);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(217, 234, 255, 0.55)';
    ctx.fillStyle = 'rgba(238, 242, 255, 0.95)';
    ctx.font = `800 ${font}px system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    const lenses = this.lenses();
    lenses.forEach((lens, i) => {
      const parent = lenses[i - 1];
      // Marker: in the main view for the first lens, inside the previous lens after that.
      const sx = (parent ? parent.x : lens.srcX) * w;
      const sy = (1 - (parent ? parent.y : lens.srcY)) * h;
      const sr = (lens.r / lens.zoom) * (parent ? parent.zoom : 1) * h;
      const lx = lens.x * w;
      const ly = (1 - lens.y) * h;
      const lr = lens.r * h;
      // The two outer tangent lines between the spot and the lens, like the
      // sides of a magnifier's cone. Tangent points share the normal angle psi:
      // (l - s)·n = -(lr - sr).
      const d = Math.hypot(lx - sx, ly - sy);
      const base = Math.atan2(ly - sy, lx - sx);
      const spread = Math.acos(Math.min(1, (lr - sr) / d));
      ctx.beginPath();
      for (const sign of [1, -1]) {
        const psi = base + sign * (Math.PI - spread);
        ctx.moveTo(sx + Math.cos(psi) * sr, sy + Math.sin(psi) * sr);
        ctx.lineTo(lx + Math.cos(psi) * lr, ly + Math.sin(psi) * lr);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(sr, 3), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillText(`${lens.zoom}×`, lx - lr * 0.95, ly - lr * 0.85);
      if (lens.grid) {
        ctx.font = `600 ${font * 0.75}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`▲ ${T.lensCells}`, lx, ly + lr + font * 0.9);
        ctx.textAlign = 'start';
        ctx.font = `800 ${font}px system-ui, sans-serif`;
      }
    });
  }
}
