// Live illustrations for Gravity Doodle's delve chapters, drawn beside the
// chaptered panel (shell/delve.ts): four speeds from one spot, the two-body
// dance, the energy trade, Euler against symplectic steps, and the Apollo
// free-return figure-8. Each chapter's demo lives in fixed world coordinates
// fitted to the free canvas area.
import { pick, type Localized } from '../../lib/i18n';
import type { Integrator } from './delve';

interface Pt {
  x: number;
  y: number;
}

const TEXT: Localized<{
  shapesLabels: [string, string, string, string];
  shapesCaption: string;
  balancePoint: string;
  samePull: string;
  heavyWobble: string;
  lightBig: string;
  closeFast: string;
  farSlow: string;
  energySpeed: string;
  energyHeight: string;
  energyTotal: string;
  stepsTitleEuler: string;
  stepsTitleSymplectic: string;
  trueOrbit: string;
  stepsEnergyEuler: string;
  stepsEnergySymplectic: string;
  trueEnergy: string;
  moonGrip: string;
  ghostFallsShort: string;
  earth: string;
  moon: string;
  splashdown: string;
  slingshot: string;
}> = {
  en: {
    shapesLabels: [
      '35% of circle speed — falls into the Sun 💥',
      '100% — a perfect circle',
      '120% — an ellipse',
      '150% (more than √2) — escapes forever 🚀',
    ],
    shapesCaption: 'same spot, different speed',
    balancePoint: 'balance point',
    samePull: 'same pull, both ways!',
    heavyWobble: '4× the mass → small wobble',
    lightBig: 'light → big orbit, high speed',
    closeFast: 'close → fast! 🏎',
    farSlow: 'far → slow… 🐢',
    energySpeed: '🏎 speed energy',
    energyHeight: '🪜 height energy',
    energyTotal: 'total — never changes!',
    stepsTitleEuler: '📐 simple steps (Euler, 1768) — watch it drift!',
    stepsTitleSymplectic: '🪄 smart steps (symplectic) — it stays!',
    trueOrbit: 'true orbit',
    stepsEnergyEuler: 'energy the computer thinks it has — growing out of nothing!',
    stepsEnergySymplectic: 'energy — wobbles, but never drifts away',
    trueEnergy: 'true energy –',
    moonGrip: "the Moon's grip",
    ghostFallsShort: '👻 without the Moon: falls short!',
    earth: '🌍 Earth',
    moon: '🌕 Moon',
    splashdown: '🌊 splashdown — home for free!',
    slingshot: 'gravity slingshot!',
  },
  nl: {
    shapesLabels: [
      '35% van de cirkelsnelheid — valt in de Zon 💥',
      '100% — een perfecte cirkel',
      '120% — een ellips',
      '150% (meer dan √2) — ontsnapt voorgoed 🚀',
    ],
    shapesCaption: 'zelfde plek, andere snelheid',
    balancePoint: 'zwaartepunt',
    samePull: 'zelfde trekkracht, twee kanten op!',
    heavyWobble: '4× de massa → kleine wiebel',
    lightBig: 'licht → grote baan, hoge snelheid',
    closeFast: 'dichtbij → snel! 🏎',
    farSlow: 'ver weg → langzaam… 🐢',
    energySpeed: '🏎 bewegingsenergie',
    energyHeight: '🪜 hoogte-energie',
    energyTotal: 'totaal — verandert nooit!',
    stepsTitleEuler: '📐 simpele stappen (Euler, 1768) — kijk hem wegdrijven!',
    stepsTitleSymplectic: '🪄 slimme stappen (symplectisch) — hij blijft!',
    trueOrbit: 'echte baan',
    stepsEnergyEuler: 'energie die de computer denkt te hebben — groeit uit het niets!',
    stepsEnergySymplectic: 'energie — wiebelt, maar drijft nooit weg',
    trueEnergy: 'echte energie –',
    moonGrip: 'de greep van de Maan',
    ghostFallsShort: '👻 zonder de Maan: komt tekort!',
    earth: '🌍 Aarde',
    moon: '🌕 Maan',
    splashdown: '🌊 landing op zee — gratis naar huis!',
    slingshot: 'zwaartekracht-slingerschot!',
  },
  no: {
    shapesLabels: [
      '35 % av sirkelfarten — faller i Solen 💥',
      '100 % — en perfekt sirkel',
      '120 % — en ellipse',
      '150 % (mer enn √2) — unnslipper for godt 🚀',
    ],
    shapesCaption: 'samme sted, ulik fart',
    balancePoint: 'tyngdepunkt',
    samePull: 'samme drag, begge veier!',
    heavyWobble: '4× massen → liten vakling',
    lightBig: 'lett → stor bane, høy fart',
    closeFast: 'nær → raskt! 🏎',
    farSlow: 'langt unna → sakte… 🐢',
    energySpeed: '🏎 bevegelsesenergi',
    energyHeight: '🪜 høydeenergi',
    energyTotal: 'totalt — endrer seg aldri!',
    stepsTitleEuler: '📐 enkle steg (Euler, 1768) — se den drive utover!',
    stepsTitleSymplectic: '🪄 smarte steg (symplektisk) — den blir værende!',
    trueOrbit: 'ekte bane',
    stepsEnergyEuler: 'energien datamaskinen tror den har — vokser ut av ingenting!',
    stepsEnergySymplectic: 'energi — vakler, men driver aldri bort',
    trueEnergy: 'ekte energi –',
    moonGrip: 'Månens grep',
    ghostFallsShort: '👻 uten Månen: kommer for kort!',
    earth: '🌍 Jorden',
    moon: '🌕 Månen',
    splashdown: '🌊 landing i havet — gratis hjem!',
    slingshot: 'tyngdekraft-slyngeskudd!',
  },
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

export class OrbitsDemos {
  private demo: Demo | null = null;
  integrator: Integrator = 'euler';

  reset(chapter: number): void {
    this.resetDemo(chapter);
  }

  clear(): void {
    this.demo = null;
  }

  step(dt: number): void {
    this.stepDemo(dt);
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawDelve(ctx, w, h);
  }

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
      const labels = pick(TEXT).shapesLabels;
      this.demo = {
        kind: 'shapes',
        bodies: [
          make(0.35, '#f87171', labels[0]),
          make(1.0, '#4ade80', labels[1]),
          make(1.2, '#7dd3fc', labels[2]),
          make(1.5, '#fb923c', labels[3]),
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
    this.caption(ctx, pick(TEXT).shapesCaption, X(-SHAPES.R), Y(0) + 28);

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
    this.caption(ctx, pick(TEXT).balancePoint, X(0), Y(0) - 14);

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
    this.caption(ctx, pick(TEXT).samePull, X((b1.x + b2.x) / 2), Y((b1.y + b2.y) / 2) - 16);

    // Velocity arrows: the light one visibly faster.
    const vScale = 1.1 * s;
    this.arrow(ctx, X(b1.x), Y(b1.y), b1.vx * vScale, b1.vy * vScale, '#4ade80', 3);
    this.arrow(ctx, X(b2.x), Y(b2.y), b2.vx * vScale, b2.vy * vScale, '#4ade80', 3);

    ctx.font = '700 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(pick(TEXT).heavyWobble, X(b1.x), Y(b1.y) + 48);
    ctx.fillStyle = '#7dd3fc';
    ctx.fillText(pick(TEXT).lightBig, X(b2.x), Y(b2.y) - 26);
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
    this.caption(ctx, near ? pick(TEXT).closeFast : pick(TEXT).farSlow, X(demo.x), Y(demo.y) - 16);

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

    const t = pick(TEXT);
    const series: {
      color: string;
      label: string;
      total: boolean;
      of: (hp: { ke: number; pe: number }) => number;
    }[] = [
      { color: '#fbbf24', label: t.energySpeed, total: false, of: (p) => p.ke },
      { color: '#7dd3fc', label: t.energyHeight, total: false, of: (p) => p.pe - peMin },
      { color: '#4ade80', label: t.energyTotal, total: true, of: (p) => p.ke + p.pe - peMin },
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
        ctx.lineWidth = ser.total ? 3.5 : 2;
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

    const t = pick(TEXT);
    ctx.fillStyle = euler ? '#fb923c' : '#4ade80';
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      euler ? t.stepsTitleEuler : t.stepsTitleSymplectic,
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
    this.caption(ctx, t.trueOrbit, X(0), Y(0) - STEPS.R * s - 8);

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
      euler ? t.stepsEnergyEuler : t.stepsEnergySymplectic,
      px0 + 10,
      py0 - 8,
    );
    ctx.textAlign = 'right';
    ctx.fillText(t.trueEnergy, px0 - 4, yOf(0) + 4);
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
    this.caption(ctx, pick(TEXT).moonGrip, X(D), Y(-gripR) - 10);

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
        ctx.fillText(pick(TEXT).ghostFallsShort, X(g.x) + 12, Y(g.y) - 10);
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
    this.caption(ctx, pick(TEXT).earth, X(0), Y(0) + earthR + 20);
    this.caption(ctx, pick(TEXT).moon, X(MOON.D), Y(0) + moonR + 20);

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
      ctx.fillText(pick(TEXT).splashdown, (area.x0 + area.x1) / 2, area.y0 + 30);
    } else if (Math.hypot(p.x - MOON.D, p.y) < 120) {
      this.caption(ctx, pick(TEXT).slingshot, X(p.x), Y(p.y) - 18);
    }
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
}
