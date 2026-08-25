// Gravity Doodle: fling planets around a sun with drag-and-release. The drag
// preview integrates the future path so orbits are easy to aim, and a delve
// layer (shared chaptered panel) explains the science of celestial mechanics.
import type { ArcadeGame, GameHost, GameInstance } from '../../shell/types';
import { pointerPos, randRange } from '../../lib/util';
import {
  delvePanel,
  delveToggle,
  type DelveHandle,
  type DelveToggleHandle,
} from '../../shell/delve';
import { orbitsDelve, type Integrator } from './delve';

interface Planet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
  trail: { x: number; y: number }[];
}

interface Pt {
  x: number;
  y: number;
}

const TRAIL_LENGTH = 110;
const SUN_RADIUS = 26;
const MAX_PLANETS = 60;
/** Launch speed cap, as a multiple of the escape speed at the launch point. */
const LAUNCH_CAP = 1.2;

type Outcome = 'orbit' | 'far' | 'escape' | 'crash';

const OUTCOME_STYLE: Record<Outcome, { color: string; label: string }> = {
  orbit: { color: '#6ee7b7', label: 'nice orbit!' },
  far: { color: '#fde047', label: '🌠 a huge orbit — gone for a long while' },
  escape: { color: '#fb923c', label: '🚀 past escape speed!' },
  crash: { color: '#f87171', label: '💥 heading for the Sun' },
};

// ---- delve demo worlds (fixed world coordinates, fitted to the canvas) ----

interface ShapeBody {
  f: number;
  color: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: Pt[];
  alive: boolean;
  respawn: number;
}

type Demo =
  | { kind: 'shapes'; bodies: ShapeBody[] }
  | {
      kind: 'newton';
      b1: { x: number; y: number; vx: number; vy: number; trail: Pt[] };
      b2: { x: number; y: number; vx: number; vy: number; trail: Pt[] };
    }
  | {
      kind: 'energy';
      x: number;
      y: number;
      vx: number;
      vy: number;
      trail: Pt[];
      hist: { ke: number; pe: number }[];
      sample: number;
    }
  | {
      kind: 'steps';
      x: number;
      y: number;
      vx: number;
      vy: number;
      path: Pt[];
      energies: number[];
      timer: number;
    }
  | {
      kind: 'moon';
      path: { x: number; y: number; vx: number; vy: number }[];
      /** Same launch with the Moon's gravity switched off: falls short. */
      ghost: { x: number; y: number; vx: number; vy: number }[];
      idx: number;
      hold: number;
    };

const SHAPES = { gm: 1.44e6, R: 170, sunR: 14 };
const NEWTON = { s: 190, m1: 4, m2: 1, period: 9 };
const ENERGY = { gm: 4e6, rp: 110, f: 1.25, samples: 240 };
const STEPS = { gm: 2e6, R: 150, perOrbit: 40, maxSteps: 78, every: 0.24 };
// f and the Moon's mass are tuned by hand so that, with this integrator and
// dt, the path is the iconic self-crossing figure-8: out on one side, a full
// loop around the Moon, and home on the other side in ~10 s. The Moon is
// heavier than the real one (1/20 of Earth instead of 1/81) so the loop is
// big enough to read from across a room. The same launch with the Moon's
// gravity switched off turns back 4 units short of the Moon's "grip" circle.
const MOON = { D: 420, gmE: 4e6, gmM: 4e6 / 20, r0: 45, f: 1.326, dt: 0.02 };

class OrbitsInstance implements GameInstance {
  private ctx: CanvasRenderingContext2D;
  private planets: Planet[] = [];
  private drag: Pt | null = null;
  private pointer = { x: 0, y: 0 };
  private poofs: { x: number; y: number; t: number; hue: number }[] = [];
  private time = 0;

  private delve: DelveHandle | null = null;
  private toggle!: DelveToggleHandle;
  private demo: Demo | null = null;
  private integrator: Integrator = 'euler';

  private onDown = (e: PointerEvent) => {
    if (this.delve) return;
    this.drag = pointerPos(this.host.canvas, e);
    this.pointer = { ...this.drag };
  };
  private onMove = (e: PointerEvent) => {
    this.pointer = pointerPos(this.host.canvas, e);
  };
  private onUp = (e: PointerEvent) => {
    if (!this.drag) return;
    const p = pointerPos(this.host.canvas, e);
    const v = this.launchVelocity(this.drag, p);
    this.launch(this.drag.x, this.drag.y, v.x, v.y);
    this.drag = null;
  };

  constructor(private host: GameHost) {
    this.ctx = host.canvas.getContext('2d')!;
  }

  start(): void {
    const { canvas } = this.host;
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    this.toggle = delveToggle(() => (this.delve ? this.closeDelve() : this.openDelve()));
    this.host.overlay.appendChild(this.toggle.element);
    // Seed two planets on roughly circular orbits so the screen is alive immediately.
    const { w, h } = this.size();
    for (const radius of [Math.min(w, h) * 0.22, Math.min(w, h) * 0.38]) {
      const angle = randRange(0, Math.PI * 2);
      const speed = Math.sqrt(this.gm() / radius);
      this.launch(
        w / 2 + radius * Math.cos(angle),
        h / 2 + radius * Math.sin(angle),
        -speed * Math.sin(angle),
        speed * Math.cos(angle),
      );
    }
  }

  frame(dt: number): void {
    this.time += dt;
    const { dpr } = this.host;
    const { w, h } = this.size();
    const ctx = this.ctx;

    if (this.delve) {
      this.stepDemo(dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#05081a';
      ctx.fillRect(0, 0, w, h);
      this.drawDelve(ctx, w, h);
      return;
    }

    const cx = w / 2;
    const cy = h / 2;
    const gm = this.gm();

    for (const p of this.planets) {
      const dx = cx - p.x;
      const dy = cy - p.y;
      const r2 = Math.max(dx * dx + dy * dy, 900);
      const r = Math.sqrt(r2);
      const a = gm / r2;
      p.vx += ((a * dx) / r) * dt;
      p.vy += ((a * dy) / r) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > TRAIL_LENGTH) p.trail.shift();
    }
    // Planets that hit the sun burst; ones that fly far away disappear.
    const limit = Math.max(w, h) * 2;
    this.planets = this.planets.filter((p) => {
      const dist = Math.hypot(p.x - cx, p.y - cy);
      if (dist <= SUN_RADIUS + p.r) {
        this.poofs.push({ x: p.x, y: p.y, t: 0, hue: p.hue });
        return false;
      }
      return dist < limit;
    });
    for (const f of this.poofs) f.t += dt;
    this.poofs = this.poofs.filter((f) => f.t < 0.6);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#05081a';
    ctx.fillRect(0, 0, w, h);

    this.drawSun(ctx, cx, cy, SUN_RADIUS);

    for (const p of this.planets) {
      if (p.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(p.trail[0].x, p.trail[0].y);
        for (const t of p.trail) ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = `hsla(${p.hue}, 80%, 70%, 0.35)`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${p.hue}, 80%, 65%)`;
      ctx.fill();
    }

    for (const f of this.poofs) {
      ctx.beginPath();
      ctx.arc(f.x, f.y, 4 + f.t * 60, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${f.hue}, 90%, 70%, ${0.7 * (1 - f.t / 0.6)})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    if (this.drag) this.drawLaunchPreview(ctx, cx, cy);

    ctx.fillStyle = 'rgba(238, 242, 255, 0.85)';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Drag and release to launch a planet — longer drag = faster!', w / 2, 40);
  }

  destroy(): void {
    const { canvas } = this.host;
    canvas.removeEventListener('pointerdown', this.onDown);
    canvas.removeEventListener('pointermove', this.onMove);
    canvas.removeEventListener('pointerup', this.onUp);
    this.delve?.dispose();
  }

  private size(): { w: number; h: number } {
    return {
      w: this.host.canvas.width / this.host.dpr,
      h: this.host.canvas.height / this.host.dpr,
    };
  }

  /** Gravitational parameter tuned so nice orbits fit the screen. */
  private gm(): number {
    const { w, h } = this.size();
    return 25 * Math.min(w, h) ** 2;
  }

  /**
   * Drag vector -> launch velocity. Scaled so a comfortable drag (~30% of the
   * screen) reaches circular speed mid-screen, and capped a little above the
   * escape speed so planets can leave, but not at silly velocities.
   */
  private launchVelocity(from: Pt, to: Pt): Pt {
    const { w, h } = this.size();
    const m = Math.min(w, h);
    const k = Math.sqrt(this.gm() / (0.35 * m)) / (0.3 * m);
    let vx = (to.x - from.x) * k;
    let vy = (to.y - from.y) * k;
    const r = Math.max(Math.hypot(from.x - w / 2, from.y - h / 2), SUN_RADIUS + 4);
    const vMax = LAUNCH_CAP * Math.sqrt((2 * this.gm()) / r);
    const v = Math.hypot(vx, vy);
    if (v > vMax) {
      vx *= vMax / v;
      vy *= vMax / v;
    }
    return { x: vx, y: vy };
  }

  private launch(x: number, y: number, vx: number, vy: number): void {
    this.planets.push({ x, y, vx, vy, r: randRange(5, 12), hue: randRange(0, 360), trail: [] });
    if (this.planets.length > MAX_PLANETS) this.planets.shift();
  }

  /** Integrate the future path of a would-be launch (same physics as the game). */
  private previewPath(
    cx: number,
    cy: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
  ): { pts: Pt[]; outcome: Outcome } {
    const gm = this.gm();
    const { w, h } = this.size();
    const limit = Math.max(w, h) * 2;
    const r0 = Math.max(Math.hypot(x - cx, y - cy), 1);
    const energy = (vx * vx + vy * vy) / 2 - gm / r0;
    let outcome: Outcome;
    if (energy >= 0) {
      outcome = 'escape';
    } else {
      // Bound orbit: find the apogee from the orbital elements. An orbit whose
      // far end is beyond the cull limit is gone for so long it may as well be.
      const hAng = (x - cx) * vy - (y - cy) * vx;
      const semi = -gm / (2 * energy);
      const ecc = Math.sqrt(Math.max(0, 1 + (2 * energy * hAng * hAng) / (gm * gm)));
      outcome = semi * (1 + ecc) > limit ? 'far' : 'orbit';
    }
    const pts: Pt[] = [{ x, y }];
    const step = 1 / 120;
    for (let i = 0; i < 840; i++) {
      const dx = cx - x;
      const dy = cy - y;
      const r2 = Math.max(dx * dx + dy * dy, 900);
      const r = Math.sqrt(r2);
      const a = gm / r2;
      vx += ((a * dx) / r) * step;
      vy += ((a * dy) / r) * step;
      x += vx * step;
      y += vy * step;
      if (i % 4 === 0) pts.push({ x, y });
      if (r < SUN_RADIUS + 6) {
        outcome = 'crash';
        pts.push({ x, y });
        break;
      }
      if (r > limit) break;
    }
    return { pts, outcome };
  }

  private drawLaunchPreview(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    if (!this.drag) return;
    const v = this.launchVelocity(this.drag, this.pointer);
    const { pts, outcome } = this.previewPath(cx, cy, this.drag.x, this.drag.y, v.x, v.y);
    const style = OUTCOME_STYLE[outcome];

    // The drag itself (thin), then the predicted path (dashed, outcome-colored).
    ctx.beginPath();
    ctx.moveTo(this.drag.x, this.drag.y);
    ctx.lineTo(this.pointer.x, this.pointer.y);
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.setLineDash([7, 7]);
    ctx.lineDashOffset = -this.time * 40;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    if (outcome === 'crash') {
      const end = pts[pts.length - 1];
      ctx.strokeStyle = style.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(end.x - 7, end.y - 7);
      ctx.lineTo(end.x + 7, end.y + 7);
      ctx.moveTo(end.x + 7, end.y - 7);
      ctx.lineTo(end.x - 7, end.y + 7);
      ctx.stroke();
    }

    ctx.fillStyle = style.color;
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(style.label, this.drag.x + 14, this.drag.y - 12);
  }

  private drawSun(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
    const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, radius * 2.5);
    glow.addColorStop(0, '#fff3b0');
    glow.addColorStop(0.4, '#ffb703');
    glow.addColorStop(1, 'rgba(255, 183, 3, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- delve layer ----

  private openDelve(): void {
    if (this.delve) return;
    this.drag = null;
    this.delve = delvePanel({
      heading: '🔬 The science of Gravity Doodle',
      chapters: orbitsDelve({
        getIntegrator: () => this.integrator,
        setIntegrator: (kind) => {
          this.integrator = kind;
          this.resetDemo(3);
        },
      }),
      onChapter: (i) => this.resetDemo(i),
      onExit: () => this.closeDelve(),
    });
    this.host.overlay.appendChild(this.delve.element);
    this.toggle.setOpen(true);
  }

  private closeDelve(): void {
    if (!this.delve) return;
    this.delve.dispose();
    this.delve = null;
    this.demo = null;
    this.toggle.setOpen(false);
  }

  // ---- delve demo simulation ----

  private resetDemo(chapter: number): void {
    if (chapter === 0) {
      const vc = Math.sqrt(SHAPES.gm / SHAPES.R);
      const make = (f: number, color: string, label: string): ShapeBody => ({
        f,
        color,
        label,
        x: -SHAPES.R,
        y: 0,
        vx: 0,
        vy: f * vc,
        trail: [],
        alive: true,
        respawn: 0,
      });
      this.demo = {
        kind: 'shapes',
        bodies: [
          make(0.35, '#f87171', '35% of circle speed — falls into the Sun 💥'),
          make(1.0, '#4ade80', '100% — a perfect circle'),
          make(1.2, '#7dd3fc', '120% — an ellipse'),
          make(1.5, '#fb923c', '150% (more than √2) — escapes forever 🚀'),
        ],
      };
    } else if (chapter === 1) {
      const { s, m1, m2, period } = NEWTON;
      const omega = (2 * Math.PI) / period;
      const r1 = (s * m2) / (m1 + m2);
      const r2 = (s * m1) / (m1 + m2);
      this.demo = {
        kind: 'newton',
        b1: { x: -r1, y: 0, vx: 0, vy: -omega * r1, trail: [] },
        b2: { x: r2, y: 0, vx: 0, vy: omega * r2, trail: [] },
      };
    } else if (chapter === 2) {
      const v = ENERGY.f * Math.sqrt(ENERGY.gm / ENERGY.rp);
      this.demo = {
        kind: 'energy',
        x: ENERGY.rp,
        y: 0,
        vx: 0,
        vy: v,
        trail: [],
        hist: [],
        sample: 0,
      };
    } else if (chapter === 3) {
      this.demo = {
        kind: 'steps',
        x: STEPS.R,
        y: 0,
        vx: 0,
        vy: Math.sqrt(STEPS.gm / STEPS.R),
        path: [{ x: STEPS.R, y: 0 }],
        energies: [this.orbitEnergy(STEPS.gm, STEPS.R, 0, 0, Math.sqrt(STEPS.gm / STEPS.R))],
        timer: 0,
      };
    } else {
      this.demo = {
        kind: 'moon',
        path: this.computeMoonPath(true),
        ghost: this.computeMoonPath(false),
        idx: 0,
        hold: 0,
      };
    }
  }

  private orbitEnergy(gm: number, x: number, y: number, vx: number, vy: number): number {
    return (vx * vx + vy * vy) / 2 - gm / Math.hypot(x, y);
  }

  /** Semi-implicit Euler substep for a point mass around a sun at the origin. */
  private substep(
    gm: number,
    b: { x: number; y: number; vx: number; vy: number },
    step: number,
  ): void {
    const r2 = Math.max(b.x * b.x + b.y * b.y, 25);
    const a = -gm / (r2 * Math.sqrt(r2));
    b.vx += a * b.x * step;
    b.vy += a * b.y * step;
    b.x += b.vx * step;
    b.y += b.vy * step;
  }

  /** The Apollo-style free-return figure-8 around a static Earth and Moon. */
  private computeMoonPath(moonOn: boolean): { x: number; y: number; vx: number; vy: number }[] {
    const { D, gmE, gmM, r0, f, dt } = MOON;
    let x = -r0;
    let y = 0;
    let vx = 0;
    let vy = -f * Math.sqrt(gmE / r0);
    const path = [{ x, y, vx, vy }];
    for (let t = 0; t < 25; t += dt) {
      const dE = Math.hypot(x, y);
      const dM = Math.hypot(x - D, y);
      const aE = -gmE / (dE * dE * dE);
      const aM = moonOn ? -gmM / (dM * dM * dM) : 0;
      vx += (aE * x + aM * (x - D)) * dt;
      vy += (aE * y + aM * y) * dt;
      x += vx * dt;
      y += vy * dt;
      path.push({ x, y, vx, vy });
      if (t > 2 && dE < r0 + 25) break;
    }
    return path;
  }

  private stepDemo(dt: number): void {
    const demo = this.demo;
    if (!demo) return;
    const h = 1 / 240;

    if (demo.kind === 'shapes') {
      const vc = Math.sqrt(SHAPES.gm / SHAPES.R);
      for (const b of demo.bodies) {
        if (!b.alive) {
          b.respawn -= dt;
          if (b.respawn <= 0) {
            b.x = -SHAPES.R;
            b.y = 0;
            b.vx = 0;
            b.vy = b.f * vc;
            b.trail = [];
            b.alive = true;
          }
          continue;
        }
        for (let t = 0; t < dt; t += h) this.substep(SHAPES.gm, b, h);
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 720) b.trail.shift();
        const r = Math.hypot(b.x, b.y);
        if (r < SHAPES.sunR || r > 900) {
          b.alive = false;
          b.respawn = 1.4;
        }
      }
    } else if (demo.kind === 'newton') {
      const { m1, m2, s, period } = NEWTON;
      const omega = (2 * Math.PI) / period;
      const mu = omega * omega * s * s * s; // G(m1+m2)
      const g1 = (mu * m1) / (m1 + m2); // G·m1
      const g2 = (mu * m2) / (m1 + m2); // G·m2
      for (let t = 0; t < dt; t += h) {
        const dx = demo.b2.x - demo.b1.x;
        const dy = demo.b2.y - demo.b1.y;
        const r2 = dx * dx + dy * dy;
        const r = Math.sqrt(r2);
        // b1 is pulled toward b2 by G·m2, and vice versa (equal, opposite force).
        demo.b1.vx += ((g2 / r2) * dx) / r * h;
        demo.b1.vy += ((g2 / r2) * dy) / r * h;
        demo.b2.vx -= ((g1 / r2) * dx) / r * h;
        demo.b2.vy -= ((g1 / r2) * dy) / r * h;
        demo.b1.x += demo.b1.vx * h;
        demo.b1.y += demo.b1.vy * h;
        demo.b2.x += demo.b2.vx * h;
        demo.b2.y += demo.b2.vy * h;
      }
      demo.b1.trail.push({ x: demo.b1.x, y: demo.b1.y });
      demo.b2.trail.push({ x: demo.b2.x, y: demo.b2.y });
      if (demo.b1.trail.length > 400) demo.b1.trail.shift();
      if (demo.b2.trail.length > 400) demo.b2.trail.shift();
    } else if (demo.kind === 'energy') {
      for (let t = 0; t < dt; t += h) this.substep(ENERGY.gm, demo, h);
      demo.trail.push({ x: demo.x, y: demo.y });
      if (demo.trail.length > 800) demo.trail.shift();
      demo.sample += dt;
      if (demo.sample >= 0.05) {
        demo.sample = 0;
        demo.hist.push({
          ke: (demo.vx * demo.vx + demo.vy * demo.vy) / 2,
          pe: -ENERGY.gm / Math.hypot(demo.x, demo.y),
        });
        if (demo.hist.length > ENERGY.samples) demo.hist.shift();
      }
    } else if (demo.kind === 'steps') {
      demo.timer += dt;
      if (demo.timer >= STEPS.every) {
        demo.timer = 0;
        const T = 2 * Math.PI * Math.sqrt(STEPS.R ** 3 / STEPS.gm);
        const big = T / STEPS.perOrbit;
        const ox = demo.x;
        const oy = demo.y;
        const r2 = Math.max(ox * ox + oy * oy, 25);
        const a = -STEPS.gm / (r2 * Math.sqrt(r2));
        if (this.integrator === 'euler') {
          // Forward Euler: move along the OLD velocity, then update it with
          // the pull at the OLD position.
          demo.x += demo.vx * big;
          demo.y += demo.vy * big;
          demo.vx += a * ox * big;
          demo.vy += a * oy * big;
        } else {
          // Symplectic Euler: update the velocity first, step with the new one.
          demo.vx += a * demo.x * big;
          demo.vy += a * demo.y * big;
          demo.x += demo.vx * big;
          demo.y += demo.vy * big;
        }
        demo.path.push({ x: demo.x, y: demo.y });
        demo.energies.push(this.orbitEnergy(STEPS.gm, demo.x, demo.y, demo.vx, demo.vy));
        const gone = Math.hypot(demo.x, demo.y) > STEPS.R * 3.4;
        if (demo.path.length > STEPS.maxSteps || gone) this.resetDemo(3);
      }
    } else if (demo.kind === 'moon') {
      if (demo.idx >= demo.path.length - 1) {
        demo.hold += dt;
        if (demo.hold > 1.6) this.resetDemo(4);
        return;
      }
      demo.idx = Math.min(demo.path.length - 1, demo.idx + dt / MOON.dt);
    }
  }

  // ---- delve rendering (one live illustration per chapter, beside the panel) ----

  private drawDelve(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const panelW = Math.min(500, w * 0.46);
    const area = { x0: panelW + 30, y0: 24, x1: w - 30, y1: h - 24 };
    const demo = this.demo;
    if (!demo) return;
    if (demo.kind === 'shapes') this.drawShapes(ctx, area, demo);
    else if (demo.kind === 'newton') this.drawNewton(ctx, area, demo);
    else if (demo.kind === 'energy') this.drawEnergy(ctx, area, demo);
    else if (demo.kind === 'steps') this.drawSteps(ctx, area, demo);
    else this.drawMoon(ctx, area, demo);
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

  /** Chapter 1: same launch spot, four speeds, four fates. */
  private drawShapes(
    ctx: CanvasRenderingContext2D,
    area: { x0: number; y0: number; x1: number; y1: number },
    demo: Extract<Demo, { kind: 'shapes' }>,
  ): void {
    const legendH = 118;
    const view = { ...area, y0: area.y0 + legendH };
    const { s, ox, oy } = this.fit(view, { x0: -260, y0: -300, x1: 500, y1: 300 });
    const X = (x: number) => ox + s * x;
    const Y = (y: number) => oy + s * y;

    this.drawSun(ctx, X(0), Y(0), SHAPES.sunR * s);

    // Launch point marker.
    ctx.fillStyle = 'rgba(238, 242, 255, 0.9)';
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🚀', X(-SHAPES.R), Y(0) + 6);
    this.caption(ctx, 'same spot, different speed', X(-SHAPES.R), Y(0) + 28);

    for (const b of demo.bodies) {
      if (b.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(X(b.trail[0].x), Y(b.trail[0].y));
        for (const t of b.trail) ctx.lineTo(X(t.x), Y(t.y));
        ctx.strokeStyle = b.color + 'aa';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (b.alive) {
        ctx.beginPath();
        ctx.arc(X(b.x), Y(b.y), 7, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
      }
    }

    // Legend at the top of the demo area.
    ctx.textAlign = 'left';
    ctx.font = '600 15px system-ui, sans-serif';
    demo.bodies.forEach((b, i) => {
      const y = area.y0 + 18 + i * 26;
      ctx.beginPath();
      ctx.arc(area.x0 + 12, y - 5, 6, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.fillStyle = 'rgba(238, 242, 255, 0.85)';
      ctx.fillText(b.label, area.x0 + 26, y);
    });
  }

  /** Chapter 2: two-body dance with equal-and-opposite force arrows. */
  private drawNewton(
    ctx: CanvasRenderingContext2D,
    area: { x0: number; y0: number; x1: number; y1: number },
    demo: Extract<Demo, { kind: 'newton' }>,
  ): void {
    const { s, ox, oy } = this.fit(area, { x0: -240, y0: -240, x1: 240, y1: 240 });
    const X = (x: number) => ox + s * x;
    const Y = (y: number) => oy + s * y;
    const { b1, b2 } = demo;

    for (const [b, color] of [
      [b1, 'rgba(251, 191, 36, 0.5)'],
      [b2, 'rgba(125, 211, 252, 0.5)'],
    ] as const) {
      if (b.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(X(b.trail[0].x), Y(b.trail[0].y));
        for (const t of b.trail) ctx.lineTo(X(t.x), Y(t.y));
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Balance point (barycenter) at the world origin.
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X(0) - 8, Y(0));
    ctx.lineTo(X(0) + 8, Y(0));
    ctx.moveTo(X(0), Y(0) - 8);
    ctx.lineTo(X(0), Y(0) + 8);
    ctx.stroke();
    this.caption(ctx, 'balance point', X(0), Y(0) - 14);

    // Bodies: heavy star and light planet.
    ctx.beginPath();
    ctx.arc(X(b1.x), Y(b1.y), 26, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(X(b2.x), Y(b2.y), 11, 0, Math.PI * 2);
    ctx.fillStyle = '#7dd3fc';
    ctx.fill();

    // Equal and opposite gravity arrows (deliberately the same length).
    const dx = X(b2.x) - X(b1.x);
    const dy = Y(b2.y) - Y(b1.y);
    const d = Math.hypot(dx, dy);
    const L = 52;
    this.arrow(ctx, X(b1.x) + (dx / d) * 30, Y(b1.y) + (dy / d) * 30, (dx / d) * L, (dy / d) * L, '#fb923c', 4);
    this.arrow(ctx, X(b2.x) - (dx / d) * 15, Y(b2.y) - (dy / d) * 15, (-dx / d) * L, (-dy / d) * L, '#fb923c', 4);
    this.caption(ctx, 'same pull, both ways!', X((b1.x + b2.x) / 2), Y((b1.y + b2.y) / 2) - 16);

    // Velocity arrows: the light one visibly faster.
    const vScale = 1.1 * s;
    this.arrow(ctx, X(b1.x), Y(b1.y), b1.vx * vScale, b1.vy * vScale, '#4ade80', 3);
    this.arrow(ctx, X(b2.x), Y(b2.y), b2.vx * vScale, b2.vy * vScale, '#4ade80', 3);

    ctx.font = '700 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('4× the mass → small wobble', X(b1.x), Y(b1.y) + 48);
    ctx.fillStyle = '#7dd3fc';
    ctx.fillText('light → big orbit, high speed', X(b2.x), Y(b2.y) - 26);
  }

  /** Chapter 3: eccentric orbit + live kinetic/potential/total energy plot. */
  private drawEnergy(
    ctx: CanvasRenderingContext2D,
    area: { x0: number; y0: number; x1: number; y1: number },
    demo: Extract<Demo, { kind: 'energy' }>,
  ): void {
    const plotH = Math.min(210, (area.y1 - area.y0) * 0.34);
    const orbitArea = { ...area, y1: area.y1 - plotH - 26 };
    const { s, ox, oy } = this.fit(orbitArea, { x0: -420, y0: -230, x1: 140, y1: 230 });
    const X = (x: number) => ox + s * x;
    const Y = (y: number) => oy + s * y;

    this.drawSun(ctx, X(0), Y(0), 14 * s);
    if (demo.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(X(demo.trail[0].x), Y(demo.trail[0].y));
      for (const t of demo.trail) ctx.lineTo(X(t.x), Y(t.y));
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(X(demo.x), Y(demo.y), 9, 0, Math.PI * 2);
    ctx.fillStyle = '#7dd3fc';
    ctx.fill();
    const near = Math.hypot(demo.x, demo.y) < ENERGY.rp * 1.7;
    this.caption(ctx, near ? 'close → fast! 🏎' : 'far → slow… 🐢', X(demo.x), Y(demo.y) - 16);

    // Energy strip: kinetic, shifted potential, and their (flat) sum.
    const peMin = -ENERGY.gm / ENERGY.rp;
    const keMax = (ENERGY.f * ENERGY.f * ENERGY.gm) / ENERGY.rp / 2;
    const px0 = area.x0 + 46;
    const px1 = area.x1 - 12;
    const py1 = area.y1 - 20;
    const py0 = py1 - plotH;
    const yOf = (v: number) => py1 - (v / (keMax * 1.15)) * plotH;
    const xOf = (i: number) => px0 + (i / (ENERGY.samples - 1)) * (px1 - px0);

    ctx.strokeStyle = 'rgba(238, 242, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px0, py0, px1 - px0, py1 - py0);

    const series: { color: string; label: string; of: (hp: { ke: number; pe: number }) => number }[] = [
      { color: '#fbbf24', label: '🏎 speed energy', of: (p) => p.ke },
      { color: '#7dd3fc', label: '🪜 height energy', of: (p) => p.pe - peMin },
      { color: '#4ade80', label: 'total — never changes!', of: (p) => p.ke + p.pe - peMin },
    ];
    for (const ser of series) {
      if (demo.hist.length > 1) {
        ctx.beginPath();
        demo.hist.forEach((p, i) => {
          const x = xOf(i);
          const y = yOf(ser.of(p));
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.strokeStyle = ser.color;
        ctx.lineWidth = ser.label.startsWith('total') ? 3.5 : 2;
        ctx.stroke();
      }
    }
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    series.forEach((ser, i) => {
      ctx.fillStyle = ser.color;
      ctx.fillText(ser.label, px0 + 10 + i * ((px1 - px0 - 20) / 3), py0 - 8);
    });
  }

  /** Chapter 4: giant visible integration steps, Euler vs symplectic. */
  private drawSteps(
    ctx: CanvasRenderingContext2D,
    area: { x0: number; y0: number; x1: number; y1: number },
    demo: Extract<Demo, { kind: 'steps' }>,
  ): void {
    const plotH = Math.min(180, (area.y1 - area.y0) * 0.3);
    const orbitArea = { ...area, y0: area.y0 + 34, y1: area.y1 - plotH - 30 };
    const euler = this.integrator === 'euler';
    const span = euler ? 500 : 260;
    const { s, ox, oy } = this.fit(orbitArea, { x0: -span, y0: -span, x1: span, y1: span });
    const X = (x: number) => ox + s * x;
    const Y = (y: number) => oy + s * y;

    ctx.fillStyle = euler ? '#fb923c' : '#4ade80';
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      euler ? '📐 simple steps (Euler, 1768) — watch it drift!' : '🪄 smart steps (symplectic) — it stays!',
      (area.x0 + area.x1) / 2,
      area.y0 + 12,
    );

    this.drawSun(ctx, X(0), Y(0), 12 * s);
    // The true orbit, for reference.
    ctx.beginPath();
    ctx.arc(X(0), Y(0), STEPS.R * s, 0, Math.PI * 2);
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
    this.caption(ctx, 'true orbit', X(0), Y(0) - STEPS.R * s - 8);

    // The step polygon: straight hops with a dot at every step.
    const color = euler ? '#fb923c' : '#4ade80';
    if (demo.path.length > 1) {
      ctx.beginPath();
      ctx.moveTo(X(demo.path[0].x), Y(demo.path[0].y));
      for (const p of demo.path) ctx.lineTo(X(p.x), Y(p.y));
      ctx.strokeStyle = color + 'cc';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    for (const p of demo.path) {
      ctx.beginPath();
      ctx.arc(X(p.x), Y(p.y), 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(X(demo.x), Y(demo.y), 8, 0, Math.PI * 2);
    ctx.fillStyle = '#eef2ff';
    ctx.fill();

    // Where the next straight hop will land.
    const T = 2 * Math.PI * Math.sqrt(STEPS.R ** 3 / STEPS.gm);
    const big = T / STEPS.perOrbit;
    this.arrow(ctx, X(demo.x), Y(demo.y), demo.vx * big * s, demo.vy * big * s, 'rgba(238, 242, 255, 0.6)', 2);

    // Energy per step, relative to the true value.
    const e0 = demo.energies[0];
    const px0 = area.x0 + 46;
    const px1 = area.x1 - 12;
    const py1 = area.y1 - 22;
    const py0 = py1 - plotH;
    const rel = demo.energies.map((e) => (e - e0) / Math.abs(e0));
    const range = Math.max(0.5, ...rel.map((r) => Math.abs(r) * 1.2));
    const yOf = (r: number) => py1 - ((r + range) / (2 * range)) * plotH;
    const xOf = (i: number) => px0 + (i / (STEPS.maxSteps - 1)) * (px1 - px0);

    ctx.strokeStyle = 'rgba(238, 242, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px0, py0, px1 - px0, py1 - py0);
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(px0, yOf(0));
    ctx.lineTo(px1, yOf(0));
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.5)';
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    rel.forEach((r, i) => {
      const x = xOf(i);
      const y = yOf(r);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(238, 242, 255, 0.75)';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      euler ? 'energy the computer thinks it has — growing out of nothing!' : 'energy — wobbles, but never drifts away',
      px0 + 10,
      py0 - 8,
    );
    ctx.textAlign = 'right';
    ctx.fillText('true energy –', px0 - 4, yOf(0) + 4);
  }

  /** Chapter 5: the free-return figure-8 around the Moon, flown live. */
  private drawMoon(
    ctx: CanvasRenderingContext2D,
    area: { x0: number; y0: number; x1: number; y1: number },
    demo: Extract<Demo, { kind: 'moon' }>,
  ): void {
    const { D, gmE, gmM } = MOON;
    const { s, ox, oy } = this.fit(area, { x0: -120, y0: -150, x1: 525, y1: 175 });
    const X = (x: number) => ox + s * x;
    const Y = (y: number) => oy + s * y;

    // Gravity field: one small arrow per grid point, pointing where gravity
    // pulls. Length is proportional to the true field strength — so it decays
    // with 1/r² away from each body — capped only right next to them. Arrows
    // inside the Moon's grip (where its pull beats Earth's) are brighter, so
    // the Moon's little kingdom stands out.
    // The Moon's grip: inside this disk its pull is stronger than Earth's.
    // A soft fill (under the arrows), so it cannot be mistaken for an orbit.
    const gripR = D / (1 + Math.sqrt(gmE / gmM));
    const grip = ctx.createRadialGradient(X(D), Y(0), 0, X(D), Y(0), gripR * s);
    grip.addColorStop(0, 'rgba(148, 163, 184, 0.16)');
    grip.addColorStop(1, 'rgba(148, 163, 184, 0.04)');
    ctx.fillStyle = grip;
    ctx.beginPath();
    ctx.arc(X(D), Y(0), gripR * s, 0, Math.PI * 2);
    ctx.fill();
    this.caption(ctx, "the Moon's grip", X(D), Y(-gripR) - 10);

    for (let wx = -100; wx <= 515; wx += 22) {
      for (let wy = -145; wy <= 170; wy += 22) {
        const dE = Math.hypot(wx, wy);
        const dM = Math.hypot(wx - D, wy);
        if (dE < 40 || dM < 14) continue;
        const gx = (-gmE * wx) / dE ** 3 + (-gmM * (wx - D)) / dM ** 3;
        const gy = (-gmE * wy) / dE ** 3 + (-gmM * wy) / dM ** 3;
        const g = Math.hypot(gx, gy);
        const len = Math.min(9, 0.085 * g) * s;
        if (len < 2.5) continue;
        const ux = gx / g;
        const uy = gy / g;
        const head = Math.min(3.5, 1.8 + len * 0.1);
        const moonWins = gmM / (dM * dM) > gmE / (dE * dE);
        ctx.strokeStyle = moonWins ? 'rgba(203, 213, 225, 0.6)' : 'rgba(148, 163, 184, 0.3)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(X(wx), Y(wy));
        ctx.lineTo(X(wx) + ux * len, Y(wy) + uy * len);
        // Small chevron head, scaled with the arrow.
        ctx.moveTo(X(wx) + ux * len - (ux + uy * 0.6) * head, Y(wy) + uy * len - (uy - ux * 0.6) * head);
        ctx.lineTo(X(wx) + ux * len, Y(wy) + uy * len);
        ctx.lineTo(X(wx) + ux * len - (ux - uy * 0.6) * head, Y(wy) + uy * len - (uy + ux * 0.6) * head);
        ctx.stroke();
      }
    }

    // Ghost mission: same launch, Moon's gravity switched off. It noses up to
    // the edge of the grip circle, falls short, and swings back — no Moon.
    const idx = Math.floor(demo.idx);
    const gIdx = Math.min(idx, demo.ghost.length - 1);
    const ghostDone = idx >= demo.ghost.length - 1;
    ctx.beginPath();
    ctx.moveTo(X(demo.ghost[0].x), Y(demo.ghost[0].y));
    for (let i = 1; i <= gIdx; i++) ctx.lineTo(X(demo.ghost[i].x), Y(demo.ghost[i].y));
    ctx.setLineDash([2, 6]);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
    if (!ghostDone) {
      const g = demo.ghost[gIdx];
      ctx.beginPath();
      ctx.arc(X(g.x), Y(g.y), 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Label the ghost only once the two ships have visibly parted ways.
      const real = demo.path[Math.min(idx, demo.path.length - 1)];
      if (Math.hypot(real.x - g.x, real.y - g.y) > 30) {
        ctx.fillStyle = 'rgba(203, 213, 225, 0.75)';
        ctx.font = '600 14px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('👻 without the Moon: falls short!', X(g.x) + 12, Y(g.y) - 10);
      }
    }

    // Full planned figure-8, faint and dashed.
    ctx.beginPath();
    ctx.moveTo(X(demo.path[0].x), Y(demo.path[0].y));
    for (const p of demo.path) ctx.lineTo(X(p.x), Y(p.y));
    ctx.setLineDash([3, 7]);
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.28)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);

    // Earth and Moon.
    const earthR = Math.max(14, 16 * s);
    ctx.beginPath();
    ctx.arc(X(0), Y(0), earthR, 0, Math.PI * 2);
    ctx.fillStyle = '#3b82f6';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(X(0) - earthR * 0.25, Y(0) - earthR * 0.2, earthR * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#4ade80';
    ctx.fill();
    const moonR = Math.max(8, 9 * s);
    ctx.beginPath();
    ctx.arc(X(MOON.D), Y(0), moonR, 0, Math.PI * 2);
    ctx.fillStyle = '#cbd5e1';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(X(MOON.D) + moonR * 0.3, Y(0) - moonR * 0.2, moonR * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = '#94a3b8';
    ctx.fill();
    this.caption(ctx, '🌍 Earth', X(0), Y(0) + earthR + 20);
    this.caption(ctx, '🌕 Moon', X(MOON.D), Y(0) + moonR + 20);

    // Flown part of the trajectory, bright.
    ctx.beginPath();
    ctx.moveTo(X(demo.path[0].x), Y(demo.path[0].y));
    for (let i = 1; i <= idx; i++) ctx.lineTo(X(demo.path[i].x), Y(demo.path[i].y));
    ctx.strokeStyle = 'rgba(110, 231, 183, 0.8)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // The spacecraft: a small triangle pointing along its velocity.
    const p = demo.path[idx];
    const ang = Math.atan2(p.vy, p.vx);
    ctx.save();
    ctx.translate(X(p.x), Y(p.y));
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-7, -6);
    ctx.lineTo(-7, 6);
    ctx.closePath();
    ctx.fillStyle = '#eef2ff';
    ctx.fill();
    ctx.restore();

    if (demo.idx >= demo.path.length - 1) {
      ctx.font = '700 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#6ee7b7';
      ctx.fillText('🌊 splashdown — home for free!', (area.x0 + area.x1) / 2, area.y0 + 30);
    } else if (Math.hypot(p.x - MOON.D, p.y) < 120) {
      this.caption(ctx, 'gravity slingshot!', X(p.x), Y(p.y) - 18);
    }
  }
}

export const orbits: ArcadeGame = {
  id: 'orbits',
  title: 'Gravity Doodle',
  scienceLine:
    'The same math that flings these planets around plans real space missions.',
  tileEmoji: '🪐',
  create: (host) => new OrbitsInstance(host),
};
