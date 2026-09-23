// Live illustrations for the Ball Pit delve chapters, drawn on the game's
// canvas beside the shared chaptered panel. Most run the pit's own physics
// (BallWorld) in a small box: a ball and its numbers; the pair checks with
// and without the grid; a floor made of atoms that turns the bounce into heat
// (floorsim.ts) beside the pit's one-number shortcut for it; a gas with thermometer and pressure gauge; chaos twins; and
// a dam break of thousands of small balls that, zoomed out, flows like water. Each demo lives in fixed coordinates, fitted
// to the free part of the screen.
import { fmtNumber, pick } from '../../lib/i18n';
import { randRange } from '../../lib/util';
import { DELVE_CAPTIONS, type SwitchName } from './delve';
import { BallWorld, type Ball } from './physics';
import { FloorSim, FLOOR } from './floorsim';
import { averageSquares, drawGridLines, drawSquares, type Squares } from './field';
import { arrow, drawBalls, drawFloor, label, speedColor } from './draw';

interface Area {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Chapter 1: a ball bouncing in a box, its numbers on show. */
const NUMBERS = { w: 360, h: 250, r: 20, g: 500 };
const GRID = { w: 480, h: 320, balls: 60, period: 4 };
/** Chapter 3's shortcut panel: one ball on a plain floor, same drop as the atom floor. */
const SHORTCUT = { w: 150, gap: 40, vx: 40 };
const GAS = { w: 420, h: 300, balls: 50, r: 9, g: 300, period: 10 };
const CHAOS = { w: 240, h: 240, balls: 24, r: 12, speed: 60, nudge: 0.001, period: 14 };
/**
 * Chapter 6: a dam break of ~3 000 small balls, watched through a camera that
 * starts close enough to see single balls and pulls back until they flow like
 * water while the wave still sloshes; then squares take over (from `squares`,
 * the balls fade a second later), with the wave still moving under them. Times in seconds; the camera starts `zoomIn`
 * times closer, aimed at the foot of the dam.
 */
const DAM = { w: 800, h: 400, r: 2.6, fill: 0.85, open: 1.2, zoomIn: 10, zoomFrom: 2.2, zoomTo: 5.5, squares: 5.5, cell: 25, period: 16 };

type Demo =
  | { kind: 'numbers'; x: number; y: number; vx: number; vy: number }
  | { kind: 'grid'; world: BallWorld; t: number }
  | { kind: 'floor'; sim: FloorSim; e0: number; shortcut: BallWorld }
  | { kind: 'gas'; world: BallWorld; t: number; pressure: number }
  | { kind: 'chaos'; a: BallWorld; b: BallWorld; t: number }
  | { kind: 'zoom'; world: BallWorld; t: number; squares: Squares | null };

export class BounceDemos {
  private demo: Demo | null = null;

  /** The labs' switches act on the demos (chapters 2 and 3) as well as on the pit. */
  constructor(private getSwitch: (name: SwitchName) => boolean) {}

  /** Chapter index of the demo showing, or -1. */
  get chapter(): number {
    if (!this.demo) return -1;
    return ['numbers', 'grid', 'floor', 'gas', 'chaos', 'zoom'].indexOf(this.demo.kind);
  }

  clear(): void {
    this.demo = null;
  }

  reset(chapter: number): void {
    if (chapter === 0) this.demo = { kind: 'numbers', x: 90, y: 60, vx: 110, vy: 0 };
    else if (chapter === 1) this.demo = { kind: 'grid', world: gridWorld(), t: 0 };
    else if (chapter === 2) {
      const sim = new FloorSim();
      this.demo = { kind: 'floor', sim, e0: sim.ballEnergy() + sim.floorEnergy(), shortcut: shortcutWorld() };
    } else if (chapter === 3) this.demo = { kind: 'gas', world: gasWorld(), t: 0, pressure: 0 };
    else if (chapter === 4) {
      const [a, b] = chaosTwins();
      this.demo = { kind: 'chaos', a, b, t: 0 };
    } else this.demo = { kind: 'zoom', world: damWorld(), t: 0, squares: null };
  }

  step(dt: number): void {
    const d = this.demo;
    if (!d) return;
    if (d.kind === 'numbers') {
      const { w, h, r, g } = NUMBERS;
      d.vy += g * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.x < r || d.x > w - r) {
        d.vx = -d.vx;
        d.x = Math.min(Math.max(d.x, r), w - r);
      }
      if (d.y > h - r) {
        d.vy = -Math.abs(d.vy);
        d.y = h - r;
      }
    } else if (d.kind === 'grid') {
      d.t += dt;
      d.world.collisions = this.getSwitch('collisions');
      d.world.step(dt);
    } else if (d.kind === 'floor') {
      d.sim.advance(Math.min(dt, 1 / 30));
      d.shortcut.dissipate = this.getSwitch('dissipate');
      d.shortcut.friction = this.getSwitch('friction');
      d.shortcut.step(Math.min(dt, 1 / 30));
      if (d.sim.time > 14) this.reset(2);
    } else if (d.kind === 'gas') {
      d.t += dt;
      d.world.heat = 0.5 - 0.5 * Math.cos((2 * Math.PI * d.t) / GAS.period);
      d.world.rightWallImpulse = 0;
      d.world.step(dt);
      const rate = d.world.rightWallImpulse / Math.max(dt, 1e-3);
      d.pressure += (rate - d.pressure) * Math.min(1, dt * 1.5);
    } else if (d.kind === 'chaos') {
      d.t += dt;
      d.a.step(1 / 60);
      d.b.step(1 / 60);
      if (d.t > CHAOS.period) this.reset(4);
    } else {
      d.t += dt;
      if (d.t > DAM.open) d.world.segments = [];
      d.world.step(Math.min(dt, 1 / 30));
      if (d.t > DAM.period) this.reset(5);
    }
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const panelW = Math.min(500, w * 0.46);
    const area = { x0: panelW + 30, y0: 70, x1: w - 30, y1: h - 24 };
    const d = this.demo;
    if (!d) return;
    if (d.kind === 'numbers') this.drawNumbers(ctx, area, d);
    else if (d.kind === 'grid') this.drawGrid(ctx, area, d);
    else if (d.kind === 'floor') this.drawFloor(ctx, area, d);
    else if (d.kind === 'gas') this.drawGas(ctx, area, d);
    else if (d.kind === 'chaos') this.drawChaos(ctx, area, d);
    else this.drawZoom(ctx, area, d);
  }

  // ---- chapter 1 ----

  private drawNumbers(ctx: CanvasRenderingContext2D, area: Area, d: Extract<Demo, { kind: 'numbers' }>): void {
    const { w, h, r } = NUMBERS;
    const { s, ox, oy } = fit(area, { x0: -42, y0: -42, x1: w + 42, y1: h + 42 });
    const X = (x: number) => ox + s * x;
    const Y = (y: number) => oy + s * y;
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = 0; gx <= w; gx += 60) {
      ctx.moveTo(X(gx), Y(0));
      ctx.lineTo(X(gx), Y(h));
    }
    for (let gy = 0; gy <= h; gy += 50) {
      ctx.moveTo(X(0), Y(gy));
      ctx.lineTo(X(w), Y(gy));
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.28)';
    ctx.lineWidth = 2;
    ctx.strokeRect(X(0), Y(0), w * s, h * s);
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(X(0), Y(d.y));
    ctx.lineTo(X(d.x), Y(d.y));
    ctx.moveTo(X(d.x), Y(h));
    ctx.lineTo(X(d.x), Y(d.y));
    ctx.stroke();
    ctx.setLineDash([]);
    const k = 0.3 * s;
    arrow(ctx, X(d.x), Y(d.y), d.vx * k, 0, '#fb923c', 2.5);
    arrow(ctx, X(d.x), Y(d.y), 0, d.vy * k, '#7dd3fc', 2.5);
    arrow(ctx, X(d.x), Y(d.y), d.vx * k, d.vy * k, '#4ade80', 3.5);
    ctx.beginPath();
    ctx.arc(X(d.x), Y(d.y), r * s, 0, Math.PI * 2);
    ctx.fillStyle = 'hsl(210, 80%, 65%)';
    ctx.fill();
    ctx.font = '600 15px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(238, 242, 255, 0.9)';
    const rows: [string, number][] = [
      ['x', d.x],
      ['y', d.y],
      ['vx', d.vx],
      ['vy', d.vy],
      ['r', r],
    ];
    rows.forEach(([name, v], i) => ctx.fillText(`${name} = ${Math.round(v)}`, area.x1 - 8, area.y0 + 22 + i * 22));
  }

  // ---- chapter 2 ----

  private drawGrid(ctx: CanvasRenderingContext2D, area: Area, d: Extract<Demo, { kind: 'grid' }>): void {
    const { w, h } = GRID;
    const world = d.world;
    const t = pick(DELVE_CAPTIONS);
    const gridMode = Math.floor(d.t / GRID.period) % 2 === 1;
    // With collisions off nothing is checked, so no check lines or grid.
    const checking = world.collisions;
    const { s, ox, oy } = fit({ ...area, y1: area.y1 - 40 }, { x0: -10, y0: -10, x1: w + 10, y1: h + 10 });
    const X = (x: number) => ox + s * x;
    const Y = (y: number) => oy + s * y;
    const me = world.balls[0];
    const cell = world.cell;
    const ci = Math.floor(me.x / cell);
    const cj = Math.floor(me.y / cell);
    const near = (b: Ball) => Math.abs(Math.floor(b.x / cell) - ci) <= 1 && Math.abs(Math.floor(b.y / cell) - cj) <= 1;

    if (checking && gridMode) {
      ctx.fillStyle = 'rgba(125, 211, 252, 0.15)';
      ctx.fillRect(X((ci - 1) * cell), Y((cj - 1) * cell), 3 * cell * s, 3 * cell * s);
      ctx.strokeStyle = 'rgba(238, 242, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = cell; x < w; x += cell) {
        ctx.moveTo(X(x), Y(0));
        ctx.lineTo(X(x), Y(h));
      }
      for (let y = cell; y < h; y += cell) {
        ctx.moveTo(X(0), Y(y));
        ctx.lineTo(X(w), Y(y));
      }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const b of world.balls) {
      if (!checking || b === me || (gridMode && !near(b))) continue;
      ctx.moveTo(X(me.x), Y(me.y));
      ctx.lineTo(X(b.x), Y(b.y));
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(X(0), Y(0), w * s, h * s);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    drawBalls(ctx, world.balls, 0, 1);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(X(me.x), Y(me.y), me.r * s + 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    const n = world.balls.length;
    const text = !world.collisions
      ? t.noCollisions
      : gridMode
        ? t.gridPairs(fmtNumber(Math.round(world.pairChecks)))
        : t.allPairs(fmtNumber((n * (n - 1)) / 2));
    label(ctx, text, (area.x0 + area.x1) / 2, area.y1 - 10, 20, gridMode ? '#7dd3fc' : '#fbbf24');
  }

  // ---- chapter 3 ----

  private drawFloor(ctx: CanvasRenderingContext2D, area: Area, d: Extract<Demo, { kind: 'floor' }>): void {
    const sim = d.sim;
    const plotH = 120;
    const floorBottom = FLOOR.top + FLOOR.rows * FLOOR.spacing;
    const { s, ox, oy } = fit(
      { ...area, y1: area.y1 - plotH },
      { x0: 0, y0: 20, x1: FLOOR.width + SHORTCUT.gap + SHORTCUT.w, y1: floorBottom + 40 },
    );
    const X = (x: number) => ox + s * x;
    const Y = (y: number) => oy + s * y;
    const { cols, rows } = FLOOR;

    // Springs, then atoms coloured by how fast they shake.
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        if (i + 1 < cols) {
          ctx.moveTo(X(sim.x[k]), Y(sim.y[k]));
          ctx.lineTo(X(sim.x[k + 1]), Y(sim.y[k + 1]));
        }
        if (j + 1 < rows) {
          ctx.moveTo(X(sim.x[k]), Y(sim.y[k]));
          ctx.lineTo(X(sim.x[k + cols]), Y(sim.y[k + cols]));
        }
      }
    }
    ctx.stroke();
    for (let k = 0; k < cols * rows; k++) {
      ctx.beginPath();
      ctx.arc(X(sim.x[k]), Y(sim.y[k]), FLOOR.atomR * s, 0, Math.PI * 2);
      ctx.fillStyle = speedColor(sim.speed(k) / 60);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(X(sim.ball.x), Y(sim.ball.y), FLOOR.ballR * s, 0, Math.PI * 2);
    ctx.fillStyle = 'hsl(210, 80%, 65%)';
    ctx.fill();

    // Beside it, the pit's shortcut: the same ball on a plain floor that keeps
    // 82 % of the speed per bounce (or all of it, with the loss switched off).
    const t = pick(DELVE_CAPTIONS);
    const sx = FLOOR.width + SHORTCUT.gap;
    const sb = d.shortcut.box;
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X(sx), Y(20));
    ctx.lineTo(X(sx), Y(sb.y1));
    ctx.moveTo(X(sx + sb.x1), Y(20));
    ctx.lineTo(X(sx + sb.x1), Y(sb.y1));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.6)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(X(sx), Y(sb.y1));
    ctx.lineTo(X(sx + sb.x1), Y(sb.y1));
    ctx.stroke();
    for (const b of d.shortcut.balls) {
      ctx.beginPath();
      ctx.arc(X(sx + b.x), Y(b.y), b.r * s, 0, Math.PI * 2);
      ctx.fillStyle = 'hsl(210, 80%, 65%)';
      ctx.fill();
    }
    const cap = Math.max(12, 16 * s);
    label(ctx, t.atoms, X(FLOOR.width / 2), Y(floorBottom + 30), cap, 'rgba(238, 242, 255, 0.8)');
    const factor = d.shortcut.dissipate ? fmtNumber(0.82) : fmtNumber(1);
    label(ctx, t.shortcut(factor), X(sx + sb.x1 / 2), Y(floorBottom + 30), cap, d.shortcut.dissipate ? 'rgba(238, 242, 255, 0.8)' : '#fbbf24');

    energyBars(ctx, area, plotH, [
      { label: t.barBall, color: '#7dd3fc', frac: sim.ballEnergy() / d.e0 },
      { label: t.barFloor, color: '#f87171', frac: sim.floorEnergy() / d.e0 },
    ], t.barTotal);
  }

  // ---- chapter 4 ----

  private drawGas(ctx: CanvasRenderingContext2D, area: Area, d: Extract<Demo, { kind: 'gas' }>): void {
    const { w, h } = GAS;
    const world = d.world;
    const gaugeW = 150;
    const { s, ox, oy } = fit({ ...area, x1: area.x1 - gaugeW }, { x0: -10, y0: -10, x1: w + 10, y1: h + 30 });
    const X = (x: number) => ox + s * x;
    const Y = (y: number) => oy + s * y;
    const vref = 0.6 * world.kick;
    let v2 = 0;
    for (const b of world.balls) v2 += b.vx * b.vx + b.vy * b.vy;
    const n = world.balls.length;
    const temp = Math.min(1, v2 / n / (vref * vref));
    const m = GAS.r * GAS.r;
    const press = Math.min(1, (2 * d.pressure * w) / (n * m * vref * vref));

    drawFloor(ctx, X(0), X(w), Y(h), world.heat, 50 * s);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    drawBalls(ctx, world.balls, 1, 0.5 * vref);
    ctx.restore();
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(X(0), Y(0), w * s, h * s);
    // The right wall glows with the pressure on it.
    ctx.strokeStyle = `rgba(125, 211, 252, ${0.3 + 0.7 * press})`;
    ctx.lineWidth = 3 + 6 * press;
    ctx.beginPath();
    ctx.moveTo(X(w), Y(0));
    ctx.lineTo(X(w), Y(h));
    ctx.stroke();

    const t = pick(DELVE_CAPTIONS);
    const gx = area.x1 - gaugeW + 30;
    const top = Y(0);
    const bottom = Y(h);
    const gauge = (x: number, frac: number, color: string, text: string) => {
      ctx.fillStyle = 'rgba(238, 242, 255, 0.1)';
      ctx.fillRect(x, top, 26, bottom - top);
      ctx.fillStyle = color;
      ctx.fillRect(x, bottom - (bottom - top) * frac, 26, (bottom - top) * frac);
      // Emoji over the word, so neighbouring gauges' labels don't collide.
      const [emoji, ...words] = text.split(' ');
      label(ctx, emoji, x + 13, bottom + 24, 18, '#fff');
      label(ctx, words.join(' '), x + 13, bottom + 44, 12, 'rgba(238, 242, 255, 0.85)');
    };
    gauge(gx, temp, '#f87171', t.thermometer);
    gauge(gx + 70, press, '#7dd3fc', t.pressure);
  }

  // ---- chapter 5 ----

  private drawChaos(ctx: CanvasRenderingContext2D, area: Area, d: Extract<Demo, { kind: 'chaos' }>): void {
    const { w, h } = CHAOS;
    const gap = 30;
    const { s, ox, oy } = fit({ ...area, y1: area.y1 - 40 }, { x0: -10, y0: -10, x1: 2 * w + gap + 10, y1: h + 10 });
    let biggest = 0;
    const colors: string[] = [];
    d.a.balls.forEach((a, i) => {
      const b = d.b.balls[i];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      biggest = Math.max(biggest, dist);
      // Log scale: a thousandth of a pixel is blue, a ball's width is red.
      const f = Math.log10(Math.max(dist, CHAOS.nudge) / CHAOS.nudge) / Math.log10((2 * CHAOS.r) / CHAOS.nudge);
      colors.push(speedColor(f));
    });
    [d.a, d.b].forEach((world, k) => {
      const x = ox + k * (w + gap) * s;
      ctx.strokeStyle = 'rgba(238, 242, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, oy, w * s, h * s);
      world.balls.forEach((b, i) => {
        ctx.beginPath();
        ctx.arc(x + b.x * s, oy + b.y * s, b.r * s, 0, Math.PI * 2);
        ctx.fillStyle = colors[i];
        ctx.fill();
      });
    });
    const px = biggest < 1 ? biggest.toPrecision(2) : fmtNumber(Math.round(biggest));
    label(ctx, pick(DELVE_CAPTIONS).difference(px), (area.x0 + area.x1) / 2, area.y1 - 10, 20, '#fbbf24');
  }

  // ---- chapter 6 ----

  private drawZoom(ctx: CanvasRenderingContext2D, area: Area, d: Extract<Demo, { kind: 'zoom' }>): void {
    const { w, h } = DAM;
    const world = d.world;
    const t = d.t;
    const view = { ...area, y1: area.y1 - 40 };
    const full = fit(view, { x0: -8, y0: -8, x1: w + 8, y1: h + 8 });
    // Camera: close up on the foot of the dam, then an even (exponential) pull-back.
    const k =
      t < DAM.zoomFrom ? DAM.zoomIn : t > DAM.zoomTo ? 1 : DAM.zoomIn ** (1 - (t - DAM.zoomFrom) / (DAM.zoomTo - DAM.zoomFrom));
    const s = full.s * k;
    const aim = (k - 1) / (DAM.zoomIn - 1);
    const fx = w / 2 + (w / 3 - w / 2) * aim;
    const fy = h / 2 + (h - 30 - h / 2) * aim;
    const cx = (view.x0 + view.x1) / 2;
    const cy = (view.y0 + view.y1) / 2;
    const ox = cx - fx * s;
    const oy = cy - fy * s;

    ctx.save();
    ctx.beginPath();
    ctx.rect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    ctx.clip();

    // Squares fade in once zoomed out; then the balls go.
    const squaresAlpha = smoothstep((t - DAM.squares) / 1.5);
    const ballsAlpha = 1 - smoothstep((t - DAM.squares - 1) / 1.5);
    if (squaresAlpha > 0) {
      d.squares = averageSquares(world.balls, world.box, DAM.cell, d.squares ?? undefined);
      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(s, s);
      drawSquares(ctx, d.squares, world.box, squaresAlpha, (f) => (f > 0.02 ? `rgba(56, 152, 230, ${0.15 + 0.85 * f})` : null));
      drawGridLines(ctx, world.box, DAM.cell, 0.3 * squaresAlpha, 1 / s);
      ctx.restore();
    }
    if (ballsAlpha > 0) {
      // One path for all balls; far away they are specks, drawn as tiny squares.
      ctx.globalAlpha = ballsAlpha;
      ctx.fillStyle = 'hsl(205, 85%, 62%)';
      ctx.beginPath();
      for (const b of world.balls) {
        const px = ox + b.x * s;
        const py = oy + b.y * s;
        const pr = b.r * s;
        if (pr < 1.2) ctx.rect(px - 0.8, py - 0.8, 1.6, 1.6);
        else {
          ctx.moveTo(px + pr, py);
          ctx.arc(px, py, pr, 0, Math.PI * 2);
        }
      }
      ctx.fill();
      if (s * DAM.r > 6) {
        // Close up, a highlight makes them read as balls.
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath();
        for (const b of world.balls) {
          const pr = b.r * s;
          ctx.moveTo(ox + b.x * s - 0.35 * pr + 0.3 * pr, oy + b.y * s - 0.35 * pr);
          ctx.arc(ox + b.x * s - 0.35 * pr, oy + b.y * s - 0.35 * pr, 0.3 * pr, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Tank and dam.
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy, w * s, h * s);
    if (world.segments.length) {
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = Math.max(3, 2 * s);
      ctx.beginPath();
      ctx.moveTo(ox + (w / 3) * s, oy);
      ctx.lineTo(ox + (w / 3) * s, oy + h * s);
      ctx.stroke();
    }
    ctx.restore();

    const c = pick(DELVE_CAPTIONS);
    const text = t < DAM.zoomFrom ? c.zoomIn : t < DAM.zoomTo ? c.zooming : t < DAM.squares + 1 ? c.zoomOut : c.squares;
    label(ctx, text, (area.x0 + area.x1) / 2, area.y1 - 10, 20, t < DAM.zoomTo ? '#eef2ff' : '#fbbf24');
  }
}

function smoothstep(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

// ---- demo worlds ----

/** A frictionless, lossless gas without gravity: balls fly forever. */
function billiards(w: number, h: number, count: number, rMin: number, rMax: number, speed: number): BallWorld {
  const world = new BallWorld({ x0: 0, y0: 0, x1: w, y1: h }, 0, rMax, 0);
  world.dissipate = false;
  world.friction = false;
  const cols = Math.ceil(Math.sqrt((count * w) / h));
  const dx = w / cols;
  const dy = h / Math.ceil(count / cols);
  for (let i = 0; i < count; i++) {
    const a = randRange(0, 2 * Math.PI);
    world.add({
      x: dx * (0.5 + (i % cols)) + randRange(-2, 2),
      y: dy * (0.5 + Math.floor(i / cols)) + randRange(-2, 2),
      vx: speed * Math.cos(a),
      vy: speed * Math.sin(a),
      r: randRange(rMin, rMax),
      hue: randRange(0, 360),
    });
  }
  return world;
}

function gridWorld(): BallWorld {
  return billiards(GRID.w, GRID.h, GRID.balls, 8, 12, 150);
}

function shortcutWorld(): BallWorld {
  // Its floor sits where the atom floor's ball comes to rest on the top row.
  const floor = FLOOR.top - FLOOR.atomR;
  const world = new BallWorld({ x0: 0, y0: -200, x1: SHORTCUT.w, y1: floor }, FLOOR.gravity, FLOOR.ballR, 0);
  world.add({ x: FLOOR.ballR + 4, y: 40, vx: SHORTCUT.vx, vy: 0, r: FLOOR.ballR, hue: 210 });
  return world;
}

function gasWorld(): BallWorld {
  const { w, h, g } = GAS;
  const world = new BallWorld({ x0: 0, y0: 0, x1: w, y1: h }, g, GAS.r, 1.2 * Math.sqrt(2 * g * h));
  world.friction = false;
  world.wallRestitution = 0.97;
  world.ballRestitution = 0.98;
  for (let i = 0; i < GAS.balls; i++) {
    world.add({ x: 15 + (i % 20) * 20, y: h - GAS.r - Math.floor(i / 20) * 20, vx: 0, vy: 0, r: GAS.r, hue: 200 });
  }
  return world;
}

/** Two identical boxes; one ball in the second is nudged a thousandth of a pixel. */
function chaosTwins(): BallWorld[] {
  const a = billiards(CHAOS.w, CHAOS.h, CHAOS.balls, CHAOS.r, CHAOS.r, CHAOS.speed);
  const b = new BallWorld({ ...a.box }, 0, CHAOS.r, 0);
  b.dissipate = false;
  b.friction = false;
  for (const ball of a.balls) b.add({ x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, r: ball.r, hue: ball.hue });
  b.balls[0].x += CHAOS.nudge;
  return [a, b];
}

/** Water behind a dam in the left third of a tank: small, slippery balls. */
function damWorld(): BallWorld {
  const { w, h, r } = DAM;
  // Slow motion (0.2 g) and bouncy balls: the wave still sloshes back and forth
  // at 10–11 s (in node), so the squares get to show it moving.
  const world = new BallWorld({ x0: 0, y0: 0, x1: w, y1: h }, 0.2 * 1800 * (h / 620), 1.1 * r, 0);
  world.friction = false;
  world.ballRestitution = 0.97;
  world.wallRestitution = 0.95;
  const step = 2.1 * r;
  const cols = Math.floor((w / 3 - r) / step);
  const rows = Math.floor((DAM.fill * h) / step);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      world.add({ x: r + i * step + randRange(0, 0.3), y: h - r - j * step, vx: 0, vy: 0, r: r * randRange(0.9, 1.1), hue: 205 });
    }
  }
  world.segments = [{ x1: w / 3, y1: 0, x2: w / 3, y2: h }];
  return world;
}

// ---- helpers ----

/** World bbox -> screen transform, aspect-preserving, centered in a rect. */
function fit(area: Area, bbox: Area): { s: number; ox: number; oy: number } {
  const s = Math.min((area.x1 - area.x0) / (bbox.x1 - bbox.x0), (area.y1 - area.y0) / (bbox.y1 - bbox.y0));
  return {
    s,
    ox: (area.x0 + area.x1) / 2 - (s * (bbox.x0 + bbox.x1)) / 2,
    oy: (area.y0 + area.y1) / 2 - (s * (bbox.y0 + bbox.y1)) / 2,
  };
}

/** Horizontal bars sharing one fixed total, with the total marked. */
function energyBars(
  ctx: CanvasRenderingContext2D,
  area: Area,
  plotH: number,
  parts: { label: string; color: string; frac: number }[],
  totalLabel: string,
): void {
  const bx0 = area.x0 + 12;
  const bx1 = area.x1 - 12;
  const labelW = 140;
  const tx0 = bx0 + labelW;
  const tw = bx1 - tx0;
  const rowH = 32;
  const by0 = area.y1 - plotH + 30;
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
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = 'rgba(238, 242, 255, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tx0 + tw, by0 - 10);
  ctx.lineTo(tx0 + tw, by0 + (parts.length - 1) * rowH + 24);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(238, 242, 255, 0.8)';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText(totalLabel, tx0 + tw, by0 - 16);
}
