// Live illustrations for the Ball Pit delve chapters, drawn on the game's
// canvas beside the shared chaptered panel: a ball and its five numbers,
// slow-motion gravity ticks, a heavy-meets-light collision, friction shrinking
// the arcs, and the energy books. Each demo is its own tiny world in fixed
// coordinates, fitted to the free part of the screen.
import { pick } from '../../lib/i18n';
import { DELVE_CAPTIONS, type SwitchName } from './delve';

interface Pt {
  x: number;
  y: number;
}

/** Chapter 1: a ball drifting in a box, its five numbers on show. */
const NUMBERS = { w: 360, h: 250, r: 20 };
/** Chapter 2: slow-motion gravity ticks. y grows downward. */
const GRAV_DEMO = { x0: -170, x1: 170, floor: 210, g: 2400, stepEvery: 0.13, dtStep: 1 / 50 };
/** Chapter 3: heavy ball rolls into a light one (elastic, slowed down). */
const COLLIDE_DEMO = { ar: 46, br: 18, speed: 260, timeScale: 0.22 };
/** Chapter 4: skipping ball whose arcs shrink from friction losses. */
const FRIC_DEMO = { x0: 20, x1: 500, floor: 250, g: 620, e: 0.72, tang: 0.82 };
/** Chapter 5: energy bookkeeping for one ball in a box (per unit mass). */
const ENERGY_DEMO = { x0: 30, x1: 290, floor: 320, g: 900, e: 0.78, tang: 0.85, roll: 2.5 };

type Demo =
  | { kind: 'numbers'; x: number; y: number; vx: number; vy: number }
  | {
      kind: 'gravity';
      x: number;
      y: number;
      vx: number;
      vy: number;
      pts: Pt[];
      timer: number;
    }
  | {
      kind: 'collide';
      ax: number;
      bx: number;
      avx: number;
      bvx: number;
      flashed: boolean;
      flash: number;
      hold: number;
    }
  | {
      kind: 'friction';
      x: number;
      y: number;
      vx: number;
      vy: number;
      trail: Pt[];
      marks: { x: number; vx: number }[];
      hold: number;
    }
  | {
      kind: 'energy';
      x: number;
      y: number;
      vx: number;
      vy: number;
      trail: Pt[];
      e0: number;
      heat: number;
      hold: number;
    };


export class BounceDemos {
  private demo: Demo | null = null;

  constructor(private getSwitch: (name: SwitchName) => boolean) {}

  /** Chapter index of the demo showing, or -1. */
  get chapter(): number {
    if (!this.demo) return -1;
    return ['numbers', 'gravity', 'collide', 'friction', 'energy'].indexOf(this.demo.kind);
  }

  clear(): void {
    this.demo = null;
  }

  reset(chapter: number): void {
    if (chapter === 0) {
      this.demo = {
        kind: 'numbers',
        x: NUMBERS.w * 0.3,
        y: NUMBERS.h * 0.35,
        vx: 72,
        vy: 46,
      };
    } else if (chapter === 1) {
      this.demo = {
        kind: 'gravity',
        x: -120,
        y: -190,
        vx: 95,
        vy: 0,
        pts: [{ x: -120, y: -190 }],
        timer: 0,
      };
    } else if (chapter === 2) {
      this.demo = {
        kind: 'collide',
        ax: -120,
        bx: 60,
        avx: COLLIDE_DEMO.speed,
        bvx: 0,
        flashed: false,
        flash: 0,
        hold: 0,
      };
    } else if (chapter === 3) {
      this.demo = {
        kind: 'friction',
        x: FRIC_DEMO.x0 + 30,
        y: FRIC_DEMO.floor - 14,
        vx: 185,
        vy: -330,
        trail: [],
        marks: [],
        hold: 0,
      };
    } else {
      const d = ENERGY_DEMO;
      const x = d.x0 + 45;
      const y = 200;
      const vx = 140;
      const vy = -420;
      this.demo = {
        kind: 'energy',
        x,
        y,
        vx,
        vy,
        trail: [],
        e0: (vx * vx + vy * vy) / 2 + d.g * (d.floor - y),
        heat: 0,
        hold: 0,
      };
    }
  }

  step(dt: number): void {
    const demo = this.demo;
    if (!demo) return;

    if (demo.kind === 'numbers') {
      const r = NUMBERS.r;
      demo.x += demo.vx * dt;
      demo.y += demo.vy * dt;
      if (demo.x < r || demo.x > NUMBERS.w - r) {
        demo.vx = -demo.vx;
        demo.x = Math.min(Math.max(demo.x, r), NUMBERS.w - r);
      }
      if (demo.y < r || demo.y > NUMBERS.h - r) {
        demo.vy = -demo.vy;
        demo.y = Math.min(Math.max(demo.y, r), NUMBERS.h - r);
      }
    } else if (demo.kind === 'gravity') {
      // Slow motion: one big visible tick every stepEvery seconds.
      demo.timer += dt;
      while (demo.timer >= GRAV_DEMO.stepEvery) {
        demo.timer -= GRAV_DEMO.stepEvery;
        demo.vy += GRAV_DEMO.g * GRAV_DEMO.dtStep;
        demo.x += demo.vx * GRAV_DEMO.dtStep;
        demo.y += demo.vy * GRAV_DEMO.dtStep;
        if (demo.y > GRAV_DEMO.floor - 10) {
          demo.y = GRAV_DEMO.floor - 10;
          demo.vy = -Math.abs(demo.vy);
        }
        demo.pts.push({ x: demo.x, y: demo.y });
        if (demo.pts.length > 34) demo.pts.shift();
        if (demo.x > GRAV_DEMO.x1 - 20) {
          this.reset(1);
          break;
        }
      }
    } else if (demo.kind === 'collide') {
      const ts = COLLIDE_DEMO.timeScale;
      demo.ax += demo.avx * dt * ts;
      demo.bx += demo.bvx * dt * ts;
      // Contact moment: flash equal-and-opposite impulse arrows.
      const gap = demo.bx - COLLIDE_DEMO.br - (demo.ax + COLLIDE_DEMO.ar);
      if (!demo.flashed && gap <= 0) {
        demo.flashed = true;
        demo.flash = 1;
        // Elastic 1-D exchange for masses ∝ r².
        const ma = COLLIDE_DEMO.ar ** 2;
        const mb = COLLIDE_DEMO.br ** 2;
        const va = demo.avx;
        const vb = demo.bvx;
        demo.avx = ((ma - mb) * va + 2 * mb * vb) / (ma + mb);
        demo.bvx = ((mb - ma) * vb + 2 * ma * va) / (ma + mb);
      }
      if (demo.flash > 0) demo.flash -= dt;
      // The light ball exits the view; hold a moment, then loop.
      if (demo.flashed && demo.flash <= 0) {
        demo.hold += dt;
        if (demo.hold > 4) this.reset(2);
      }
    } else if (demo.kind === 'friction') {
      const d = FRIC_DEMO;
      demo.vy += d.g * dt;
      demo.x += demo.vx * dt;
      demo.y += demo.vy * dt;
      if (demo.x < d.x0 || demo.x > d.x1) {
        demo.vx = -demo.vx;
        demo.x = Math.min(Math.max(demo.x, d.x0), d.x1);
      }
      if (demo.y >= d.floor - 14) {
        demo.y = d.floor - 14;
        if (demo.vy > 40) {
          demo.marks.push({ x: demo.x, vx: demo.vx });
          if (demo.marks.length > 9) demo.marks.shift();
        }
        demo.vy = -Math.abs(demo.vy) * d.e;
        demo.vx *= d.tang;
        if (Math.abs(demo.vy) < 26) demo.vy = 0;
      }
      demo.trail.push({ x: demo.x, y: demo.y });
      if (demo.trail.length > 600) demo.trail.shift();
      if (demo.vy === 0 && Math.abs(demo.vx) < 12) {
        demo.hold += dt;
        if (demo.hold > 1.8) this.reset(3);
      } else {
        demo.hold = 0;
      }
    } else {
      const d = ENERGY_DEMO;
      const r = 22;
      const mech = () => (demo.vx * demo.vx + demo.vy * demo.vy) / 2 + d.g * (d.floor - demo.y);
      const e = this.getSwitch('dissipate') ? d.e : 1;
      demo.vy += d.g * dt;
      demo.x += demo.vx * dt;
      demo.y += demo.vy * dt;
      if (demo.x < d.x0 + r) {
        demo.x = d.x0 + r;
        demo.vx = Math.abs(demo.vx) * e;
        if (this.getSwitch('friction')) demo.vx *= d.tang;
      } else if (demo.x > d.x1 - r) {
        demo.x = d.x1 - r;
        demo.vx = -Math.abs(demo.vx) * e;
        if (this.getSwitch('friction')) demo.vx *= d.tang;
      }
      if (demo.y >= d.floor - r) {
        demo.y = d.floor - r;
        demo.vy = -Math.abs(demo.vy) * e;
        if (this.getSwitch('friction') && Math.abs(demo.vy) < 60) {
          demo.vx *= Math.max(0, 1 - d.roll * dt);
        }
      }
      demo.heat = Math.max(0, demo.e0 - mech());
      demo.trail.push({ x: demo.x, y: demo.y });
      if (demo.trail.length > 90) demo.trail.shift();
      const settled = mech() < demo.e0 * 0.02 && demo.y >= d.floor - r - 0.5;
      if (settled) {
        demo.hold += dt;
        if (demo.hold > 2.4) this.reset(4);
      } else {
        demo.hold = 0;
      }
    }
  }

  // ---- rendering (one live illustration per chapter, beside the panel) ----

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const panelW = Math.min(500, w * 0.46);
    const area = { x0: panelW + 30, y0: 24, x1: w - 30, y1: h - 24 };
    const demo = this.demo;
    if (!demo) return;
    if (demo.kind === 'numbers') this.drawNumbers(ctx, area, demo);
    else if (demo.kind === 'gravity') this.drawGravity(ctx, area, demo);
    else if (demo.kind === 'collide') this.drawCollide(ctx, area, demo);
    else if (demo.kind === 'friction') this.drawFriction(ctx, area, demo);
    else this.drawEnergy(ctx, area, demo);
  }

  /** World bbox -> screen transform, aspect-preserving, centered in a rect. */
  private fit(
    area: { x0: number; y0: number; x1: number; y1: number },
    bbox: { x0: number; y0: number; x1: number; y1: number },
  ): { s: number; ox: number; oy: number } {
    const s = Math.min(
      (area.x1 - area.x0) / (bbox.x1 - bbox.x0),
      (area.y1 - area.y0) / (bbox.y1 - bbox.y0),
    );
    return {
      s,
      ox: (area.x0 + area.x1) / 2 - (s * (bbox.x0 + bbox.x1)) / 2,
      oy: (area.y0 + area.y1) / 2 - (s * (bbox.y0 + bbox.y1)) / 2,
    };
  }

  private arrow(
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

  private caption(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
    ctx.fillStyle = 'rgba(238, 242, 255, 0.75)';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
  }

  /** Chapter 1: a ball is its five numbers; watch them tick along. */
  private drawNumbers(
    ctx: CanvasRenderingContext2D,
    area: { x0: number; y0: number; x1: number; y1: number },
    demo: Extract<Demo, { kind: 'numbers' }>,
  ): void {
    const { s, ox, oy } = this.fit(area, { x0: -42, y0: -42, x1: NUMBERS.w + 42, y1: NUMBERS.h + 42 });
    const X = (x: number) => ox + s * x;
    const Y = (y: number) => oy + s * y;

    // Faint grid + box.
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= NUMBERS.w; gx += 60) {
      ctx.beginPath();
      ctx.moveTo(X(gx), Y(0));
      ctx.lineTo(X(gx), Y(NUMBERS.h));
      ctx.stroke();
    }
    for (let gy = 0; gy <= NUMBERS.h; gy += 50) {
      ctx.beginPath();
      ctx.moveTo(X(0), Y(gy));
      ctx.lineTo(X(NUMBERS.w), Y(gy));
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.28)';
    ctx.lineWidth = 2;
    ctx.strokeRect(X(0), Y(0), NUMBERS.w * s, NUMBERS.h * s);

    // Guides from the ball to the axes.
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(X(0), Y(demo.y));
    ctx.lineTo(X(demo.x), Y(demo.y));
    ctx.moveTo(X(demo.x), Y(NUMBERS.h));
    ctx.lineTo(X(demo.x), Y(demo.y));
    ctx.stroke();
    ctx.setLineDash([]);

    // The ball and its velocity, split into components.
    const k = 0.85;
    this.arrow(ctx, X(demo.x), Y(demo.y), demo.vx * k, 0, '#fb923c', 2.5);
    this.arrow(ctx, X(demo.x), Y(demo.y), 0, demo.vy * k, '#7dd3fc', 2.5);
    this.arrow(ctx, X(demo.x), Y(demo.y), demo.vx * k, demo.vy * k, '#4ade80', 3.5);
    ctx.beginPath();
    ctx.arc(X(demo.x), Y(demo.y), NUMBERS.r * s, 0, Math.PI * 2);
    ctx.fillStyle = 'hsl(210, 80%, 65%)';
    ctx.fill();

    // The state table.
    ctx.fillStyle = 'rgba(238, 242, 255, 0.9)';
    ctx.font = '600 15px ui-monospace, monospace';
    ctx.textAlign = 'right';
    const rows: [string, number][] = [
      ['x', demo.x],
      ['y', demo.y],
      ['vx', demo.vx],
      ['vy', demo.vy],
      ['r', NUMBERS.r],
    ];
    rows.forEach(([name, v], i) => {
      ctx.fillText(`${name} = ${Math.round(v)}`, area.x1 - 8, area.y0 + 72 + i * 22);
    });
  }

  /** Chapter 2: giant slow-motion gravity ticks; every hop dead straight. */
  private drawGravity(
    ctx: CanvasRenderingContext2D,
    area: { x0: number; y0: number; x1: number; y1: number },
    demo: Extract<Demo, { kind: 'gravity' }>,
  ): void {
    const { s, ox, oy } = this.fit(area, { x0: GRAV_DEMO.x0, y0: -230, x1: GRAV_DEMO.x1, y1: GRAV_DEMO.floor + 20 });
    const X = (x: number) => ox + s * x;
    const Y = (y: number) => oy + s * y;

    // Floor.
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(X(GRAV_DEMO.x0), Y(GRAV_DEMO.floor));
    ctx.lineTo(X(GRAV_DEMO.x1), Y(GRAV_DEMO.floor));
    ctx.stroke();

    // The hop polygon with a dot at every tick position.
    if (demo.pts.length > 1) {
      ctx.beginPath();
      ctx.moveTo(X(demo.pts[0].x), Y(demo.pts[0].y));
      for (const p of demo.pts) ctx.lineTo(X(p.x), Y(p.y));
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.75)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    for (const p of demo.pts) {
      ctx.beginPath();
      ctx.arc(X(p.x), Y(p.y), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#7dd3fc';
      ctx.fill();
    }

    // Current velocity arrow, bending downward between hops.
    this.arrow(ctx, X(demo.x), Y(demo.y), demo.vx * 0.085, demo.vy * 0.085, '#4ade80', 3);
    ctx.beginPath();
    ctx.arc(X(demo.x), Y(demo.y), 9, 0, Math.PI * 2);
    ctx.fillStyle = '#eef2ff';
    ctx.fill();

    this.caption(ctx, pick(DELVE_CAPTIONS).tick, (area.x0 + area.x1) / 2, area.y1 - 10);
  }

  /** Chapter 3: heavy meets light; push along the line of centers only. */
  private drawCollide(
    ctx: CanvasRenderingContext2D,
    area: { x0: number; y0: number; x1: number; y1: number },
    demo: Extract<Demo, { kind: 'collide' }>,
  ): void {
    const { s, ox, oy } = this.fit(area, { x0: -310, y0: -120, x1: 310, y1: 120 });
    const X = (x: number) => ox + s * x;
    const Y = (y: number) => oy + s * y;

    // The line of centers.
    ctx.setLineDash([7, 8]);
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(X(-300), Y(0));
    ctx.lineTo(X(300), Y(0));
    ctx.stroke();
    ctx.setLineDash([]);
    this.caption(ctx, pick(DELVE_CAPTIONS).lineOfCenters, X(215), Y(0) + 24);

    // Velocity arrows.
    this.arrow(ctx, X(demo.ax), Y(0), demo.avx * 0.16, 0, '#fbbf24', 3.5);
    this.arrow(ctx, X(demo.bx), Y(0), demo.bvx * 0.16, 0, '#7dd3fc', 3.5);

    // The two balls (radii are their masses, m ∝ r²).
    ctx.beginPath();
    ctx.arc(X(demo.ax), Y(0), COLLIDE_DEMO.ar * s, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(X(demo.bx), Y(0), COLLIDE_DEMO.br * s, 0, Math.PI * 2);
    ctx.fillStyle = '#7dd3fc';
    ctx.fill();

    // Contact flash: equal and opposite impulses at the touch point.
    if (demo.flash > 0) {
      const a = Math.min(1, demo.flash);
      const mid = X(demo.ax + COLLIDE_DEMO.ar) + 6;
      ctx.globalAlpha = a;
      this.arrow(ctx, mid + 14, Y(0), 62, 0, '#fb923c', 5);
      this.arrow(ctx, mid - 14, Y(0), -62, 0, '#fb923c', 5);
      ctx.globalAlpha = 1;
    }
  }

  /** Chapter 4: arcs shrink as friction taxes every slide and roll. */
  private drawFriction(
    ctx: CanvasRenderingContext2D,
    area: { x0: number; y0: number; x1: number; y1: number },
    demo: Extract<Demo, { kind: 'friction' }>,
  ): void {
    const { s, ox, oy } = this.fit(area, { x0: 0, y0: -20, x1: 520, y1: FRIC_DEMO.floor + 25 });
    const X = (x: number) => ox + s * x;
    const Y = (y: number) => oy + s * y;

    ctx.strokeStyle = 'rgba(238, 242, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(X(FRIC_DEMO.x0 - 20), Y(FRIC_DEMO.floor));
    ctx.lineTo(X(FRIC_DEMO.x1 + 20), Y(FRIC_DEMO.floor));
    ctx.stroke();

    if (demo.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(X(demo.trail[0].x), Y(demo.trail[0].y));
      for (const p of demo.trail) ctx.lineTo(X(p.x), Y(p.y));
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Sliding speed left at each floor contact: shrinking every time.
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center';
    for (const m of demo.marks) {
      ctx.beginPath();
      ctx.arc(X(m.x), Y(FRIC_DEMO.floor), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(`vx=${Math.round(m.vx)}`, X(m.x), Y(FRIC_DEMO.floor) + 20);
    }

    ctx.beginPath();
    ctx.arc(X(demo.x), Y(demo.y), 10, 0, Math.PI * 2);
    ctx.fillStyle = '#eef2ff';
    ctx.fill();
    this.arrow(ctx, X(demo.x), Y(demo.y), demo.vx * 0.22, 0, '#4ade80', 3);
  }

  /** Chapter 5: the books always balance — speed + height + heat = total. */
  private drawEnergy(
    ctx: CanvasRenderingContext2D,
    area: { x0: number; y0: number; x1: number; y1: number },
    demo: Extract<Demo, { kind: 'energy' }>,
  ): void {
    const d = ENERGY_DEMO;
    const plotH = 148;
    const boxArea = { ...area, y1: area.y1 - plotH };
    const { s, ox, oy } = this.fit(boxArea, { x0: 0, y0: 0, x1: 320, y1: 340 });
    const X = (x: number) => ox + s * x;
    const Y = (y: number) => oy + s * y;

    // The box and the bouncing ball.
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(X(d.x0 - 22), Y(-24), (d.x1 - d.x0 + 44) * s, (d.floor + 24) * s);
    if (demo.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(X(demo.trail[0].x), Y(demo.trail[0].y));
      for (const p of demo.trail) ctx.lineTo(X(p.x), Y(p.y));
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(X(demo.x), Y(demo.y), 22 * s, 0, Math.PI * 2);
    ctx.fillStyle = 'hsl(210, 80%, 65%)';
    ctx.fill();

    // The books: one track per energy kind, widths share the fixed total.
    const t = pick(DELVE_CAPTIONS);
    const ke = (demo.vx ** 2 + demo.vy ** 2) / 2;
    const pe = d.g * (d.floor - demo.y);
    const parts: { label: string; color: string; frac: number }[] = [
      { label: t.barSpeed, color: '#4ade80', frac: ke / demo.e0 },
      { label: t.barHeight, color: '#7dd3fc', frac: pe / demo.e0 },
      { label: t.barHeat, color: '#f87171', frac: demo.heat / demo.e0 },
    ];
    const bx0 = area.x0 + 12;
    const bx1 = area.x1 - 12;
    const labelW = 118;
    const tx0 = bx0 + labelW;
    const tw = bx1 - tx0;
    const rowH = 32;
    const by0 = area.y1 - plotH + 18;
    ctx.font = '600 15px system-ui, sans-serif';
    parts.forEach((p, i) => {
      const y = by0 + i * rowH;
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(238, 242, 255, 0.85)';
      ctx.fillText(p.label, bx0, y + 14);
      ctx.strokeStyle = 'rgba(238, 242, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(tx0, y, tw, 18);
      ctx.fillStyle = p.color;
      ctx.fillRect(tx0, y, tw * Math.min(1, Math.max(0, p.frac)), 18);
    });

    // The total line nothing ever crosses.
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx0 + tw, by0 - 10);
    ctx.lineTo(tx0 + tw, by0 + 2 * rowH + 24);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(238, 242, 255, 0.8)';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(t.barTotal, tx0 + tw, by0 - 16);

    if (demo.hold > 0.4) {
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fca5a5';
      ctx.fillText(t.allHeat, (boxArea.x0 + boxArea.x1) / 2, boxArea.y0 + 28);
    }
  }

}
