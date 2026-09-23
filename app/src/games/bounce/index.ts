// Ball Pit (game id 'bounce', once the Phase-0 placeholder "Bouncy Balls").
// Toy: a pit of balls that opens half full; the mouse is a hand that shoves
// them, holding the button pours more, the hot plate boils the pile into a
// gas and the cold button settles it again, and a heavy golden ball crashes
// in. (It does not rise when shaken, the Brazil-nut effect: that needs
// spinning, rolling balls, which this model leaves out.) Challenge: Plinko, a Galton board where one ball is luck
// and three hundred make the same bell curve every time. Physics in
// physics.ts, the board in plinko.ts, the delve demos in demos.ts.
import type { ArcadeGame, GameHost, GameInstance } from '../../shell/types';
import { clamp, pointerPos, randRange } from '../../lib/util';
import { delvePanel, delveToggle, type DelveHandle, type DelveToggleHandle } from '../../shell/delve';
import { scoreFlow, type ScoreFlowHandle } from '../../shell/scoreflow';
import { sound } from '../../lib/sound';
import { fmtNumber, pick, type Localized } from '../../lib/i18n';
import { bounceDelve, type SwitchName } from './delve';
import { BounceDemos } from './demos';
import { BallWorld, type Ball, type Box, type Circle } from './physics';
import { PLINKO, bucketOf, plinkoLayout, plinkoTally, type PlinkoLayout } from './plinko';

const TEXT: Localized<{
  ballCount: (n: number) => string;
  heat: string;
  cool: string;
  bigBall: string;
  reset: string;
  plinko: string;
  full: string;
  delveHeading: string;
  drop: string;
  stop: string;
  hudBalls: (n: number) => string;
  hudScore: (n: number) => string;
  hintPlace: string;
  dropsIn: (s: number) => string;
  hintTwins: string;
  twinsApart: (n: number) => string;
  twinsSame: string;
  hintPour: string;
  points: (n: number) => string;
  playAgain: string;
  freePlay: string;
}> = {
  en: {
    ballCount: (n) => `${n} balls, each moved 240 times per second`,
    heat: 'Heat',
    cool: 'Cool',
    bigBall: 'Big ball',
    reset: 'Reset',
    plinko: 'Plinko!',
    full: 'Full!',
    delveHeading: '🔬 The science of the Ball Pit',
    drop: 'Drop!',
    stop: 'Stop',
    hudBalls: (n) => `⚪ ${n} to go`,
    hudScore: (n) => `⭐ ${fmtNumber(n)}`,
    hintPlace: 'Drag the white bumpers onto the board to steer the balls into the 🥇 gold bucket!',
    dropsIn: (s) => `Drop! (${s})`,
    hintTwins: 'Two twin balls, dropped a hundredth of a pixel apart…',
    twinsApart: (n) => `…and they land ${n} buckets apart! One ball is luck. Now watch what 300 do.`,
    twinsSame: '…one ball is luck. Now watch what 300 do.',
    hintPour: 'Keep steering: you can drag the bumpers while the balls fall.',
    points: (n) => `${fmtNumber(n)} points`,
    playAgain: 'Play again',
    freePlay: 'Ball pit',
  },
  nl: {
    ballCount: (n) => `${n} ballen, elk 240 keer per seconde verplaatst`,
    heat: 'Verwarm',
    cool: 'Koel af',
    bigBall: 'Grote bal',
    reset: 'Reset',
    plinko: 'Plinko!',
    full: 'Vol!',
    delveHeading: '🔬 De wetenschap van de Ballenbak',
    drop: 'Los!',
    stop: 'Stop',
    hudBalls: (n) => `⚪ nog ${n}`,
    hudScore: (n) => `⭐ ${fmtNumber(n)}`,
    hintPlace: 'Sleep de witte stuiters op het bord en stuur de ballen naar het 🥇 gouden bakje!',
    dropsIn: (s) => `Los! (${s})`,
    hintTwins: 'Twee tweelingballen, een honderdste pixel uit elkaar losgelaten…',
    twinsApart: (n) => `…en ze landen ${n} bakjes uit elkaar! Eén bal is geluk. Kijk nu wat 300 ballen doen.`,
    twinsSame: '…één bal is geluk. Kijk nu wat 300 ballen doen.',
    hintPour: 'Blijf sturen: je mag de stuiters verslepen terwijl de ballen vallen.',
    points: (n) => `${fmtNumber(n)} punten`,
    playAgain: 'Nog een keer',
    freePlay: 'Ballenbak',
  },
  no: {
    ballCount: (n) => `${n} baller, hver flyttet 240 ganger i sekundet`,
    heat: 'Varm opp',
    cool: 'Kjøl ned',
    bigBall: 'Stor ball',
    reset: 'Nullstill',
    plinko: 'Plinko!',
    full: 'Fullt!',
    delveHeading: '🔬 Vitenskapen bak Ballbinga',
    drop: 'Slipp!',
    stop: 'Stopp',
    hudBalls: (n) => `⚪ ${n} igjen`,
    hudScore: (n) => `⭐ ${fmtNumber(n)}`,
    hintPlace: 'Dra de hvite støtfangerne inn på brettet og styr ballene til den 🥇 gylne bøtta!',
    dropsIn: (s) => `Slipp! (${s})`,
    hintTwins: 'To tvillingballer, sluppet en hundredels piksel fra hverandre…',
    twinsApart: (n) => `…og de lander ${n} bøtter fra hverandre! Én ball er flaks. Se nå hva 300 gjør.`,
    twinsSame: '…én ball er flaks. Se nå hva 300 gjør.',
    hintPour: 'Fortsett å styre: du kan dra støtfangerne mens ballene faller.',
    points: (n) => `${fmtNumber(n)} poeng`,
    playAgain: 'Spill igjen',
    freePlay: 'Ballbinge',
  },
};

// Sizes are in "units": CSS px on a box 620 px tall, scaled to the screen.
const R_MIN = 9;
const R_MAX = 20;
const GOLD_R = 2.4 * R_MAX;
const HAND_R = 40;
/** Gravity in box heights per second² (1800 px/s² on a 620 px box). */
const GRAVITY = 1800 / 620;
/** Hot-plate kick at full heat, relative to the speed of a fall through the whole box. */
const KICK = 1.4;
/** Balls per second while the button is held, and on a single tap. */
const POUR_RATE = 30;
const HANDFUL = 5;
/** The pit is full when balls cover this fraction of it. */
const FILL_LIMIT = 0.6;
/** Height fraction filled when the game opens. */
const START_FILL = 0.4;
const MARGIN = 10;
const BACKGROUND = '#0b1020';

type Mode = 'toy' | 'plinko';
type Phase = 'place' | 'twins' | 'pour' | 'settle' | 'done';

interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
}

interface Plinko {
  layout: PlinkoLayout;
  world: BallWorld;
  bumpers: Circle[];
  phase: Phase;
  timer: number;
  dropped: number;
  acc: number;
  twins: Ball[];
  trails: { x: number; y: number }[][];
  twinsTold: boolean;
  counted: WeakSet<Ball>;
  /** Time of the last points popup per bucket, so they don't pile up. */
  popped: number[];
  score: number;
  counts: number[];
}

class BounceInstance implements GameInstance {
  private ctx: CanvasRenderingContext2D;
  private mode: Mode = 'toy';
  private toy!: BallWorld;
  private box: Box = { x0: 0, y0: 0, x1: 1, y1: 1 };
  private unit = 1;
  private switches: Record<SwitchName, boolean> = { collisions: true, friction: true, dissipate: true };

  private pointer = { x: 0, y: 0, inside: false, down: false, mouse: true };
  private lastHand = { x: 0, y: 0 };
  private pourAcc = 0;
  private fullCooldown = 0;
  private heating = false;
  private cooling = false;
  private heat = 0;
  /** 0..1: how much balls are coloured by speed (a heat view). */
  private tint = 0;
  private popups: Popup[] = [];

  private plinko: Plinko | null = null;
  private dragging: Circle | null = null;
  private flow: ScoreFlowHandle | null = null;

  private toyBar!: HTMLElement;
  private gameBar!: HTMLElement;
  private dropButton!: HTMLButtonElement;
  private hud!: HTMLElement;
  private hint!: HTMLElement;
  private delve: DelveHandle | null = null;
  private toggle!: DelveToggleHandle;
  private demos = new BounceDemos((name) => this.switches[name]);

  constructor(private host: GameHost) {
    this.ctx = host.canvas.getContext('2d')!;
  }

  start(): void {
    const c = this.host.canvas;
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onUp);
    c.addEventListener('pointerleave', this.onLeave);
    this.buildUi();
    this.measure();
    this.fillToy();
  }

  destroy(): void {
    const c = this.host.canvas;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('pointercancel', this.onUp);
    c.removeEventListener('pointerleave', this.onLeave);
    this.delve?.dispose();
    this.flow?.dispose();
  }

  // ---- layout ----

  /** The pit fills the screen above the toolbar; everything scales with its height. */
  private measure(): void {
    const { canvas, dpr } = this.host;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const bar = this.toyBar.offsetHeight || this.gameBar.offsetHeight || 70;
    const box = { x0: MARGIN, y0: MARGIN, x1: w - MARGIN, y1: h - bar - 30 };
    if (box.x0 === this.box.x0 && box.x1 === this.box.x1 && box.y1 === this.box.y1) return;
    this.box = box;
    this.unit = clamp((box.y1 - box.y0) / 620, 0.5, 2);
    if (this.toy) this.fitWorld(this.toy);
  }

  private fitWorld(world: BallWorld): void {
    const bh = this.box.y1 - this.box.y0;
    world.box = this.box;
    world.gravity = GRAVITY * bh;
    world.kick = KICK * Math.sqrt(2 * world.gravity * bh);
  }

  private fillToy(): void {
    const u = this.unit;
    this.toy = new BallWorld(this.box, 1, R_MAX * u, 1);
    this.fitWorld(this.toy);
    this.applySwitches();
    const { x0, x1, y1 } = this.box;
    const top = y1 - START_FILL * (y1 - this.box.y0);
    const step = 2 * R_MAX * u;
    for (let y = y1 - R_MAX * u; y > top; y -= step) {
      for (let x = x0 + R_MAX * u; x < x1 - R_MAX * u; x += step) {
        this.addBall(this.toy, x + randRange(-2, 2), y, 0, 0);
      }
    }
    // Let the pile settle before anybody sees it.
    for (let k = 0; k < 90; k++) this.toy.step(1 / 60);
    this.toy.loudest = 0;
  }

  private addBall(world: BallWorld, x: number, y: number, vx: number, vy: number): Ball {
    return world.add({ x, y, vx, vy, r: randRange(R_MIN, R_MAX) * this.unit, hue: randRange(0, 360) });
  }

  private applySwitches(): void {
    this.toy.collisions = this.switches.collisions;
    this.toy.friction = this.switches.friction;
    this.toy.dissipate = this.switches.dissipate;
  }

  // ---- input ----

  private onDown = (e: PointerEvent) => {
    if (this.delve || this.flow) return;
    const p = pointerPos(this.host.canvas, e);
    Object.assign(this.pointer, p, { inside: true, down: true, mouse: e.pointerType !== 'touch' });
    try {
      this.host.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic or already-gone pointer: moves over the canvas still arrive.
    }
    if (this.mode === 'plinko' && this.plinko) {
      const reach = 14 * this.unit;
      this.dragging =
        this.plinko.bumpers.find((b) => Math.hypot(b.x - p.x, b.y - p.y) < b.r + reach) ?? null;
      if (this.dragging) sound.play('click');
      return;
    }
    // A tap drops a handful; holding keeps pouring (see frame).
    this.pour(HANDFUL);
    this.pourAcc = 0;
  };

  private onMove = (e: PointerEvent) => {
    const p = pointerPos(this.host.canvas, e);
    Object.assign(this.pointer, p, { inside: true, mouse: e.pointerType !== 'touch' });
    const d = this.dragging;
    if (d && this.plinko) {
      const a = this.plinko.layout.dragArea;
      d.x = clamp(p.x, a.x0, a.x1);
      d.y = clamp(p.y, a.y0, a.y1);
    }
  };

  private onUp = () => {
    this.pointer.down = false;
    this.dragging = null;
  };

  private onLeave = () => {
    if (!this.pointer.down) this.pointer.inside = false;
  };

  private pour(count: number): void {
    const world = this.toy;
    const u = this.unit;
    const { x0, y0, x1, y1 } = this.box;
    let area = 0;
    for (const b of world.balls) area += Math.PI * b.r * b.r;
    const limit = FILL_LIMIT * (x1 - x0) * (y1 - y0);
    for (let k = 0; k < count; k++) {
      if (area > limit) {
        if (this.fullCooldown <= 0) {
          this.popups.push({ x: this.pointer.x, y: this.pointer.y - 30 * u, text: pick(TEXT).full, color: '#fca5a5', age: 0 });
          sound.play('thud');
          this.fullCooldown = 1.2;
        }
        return;
      }
      const x = clamp(this.pointer.x + randRange(-18, 18) * u, x0 + R_MAX * u, x1 - R_MAX * u);
      const y = clamp(this.pointer.y + randRange(-18, 18) * u, y0 + R_MAX * u, y1 - R_MAX * u);
      const b = this.addBall(world, x, y, randRange(-150, 150) * u, randRange(-150, 50) * u);
      area += Math.PI * b.r * b.r;
    }
  }

  private dropGold(): void {
    const world = this.toy;
    world.balls = world.balls.filter((b) => !b.gold);
    const r = GOLD_R * this.unit;
    const { x0, x1, y0 } = this.box;
    world.add({ x: randRange(x0 + r, x1 - r), y: y0 + r + 2, vx: 0, vy: 0, r, gold: true, hue: 45 });
    sound.play('ding');
  }

  // ---- frame ----

  frame(dt: number): void {
    const { canvas, dpr } = this.host;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, w, h);

    if (this.delve) {
      this.demos.step(dt);
      this.demos.draw(ctx, w, h);
      return;
    }
    if (this.mode === 'toy') this.measure();
    this.fullCooldown -= dt;

    if (this.mode === 'plinko' && this.plinko) {
      this.stepPlinko(this.plinko, dt);
      this.drawPit(ctx, w, h, this.plinko.world);
      this.drawPlinko(ctx, this.plinko);
    } else {
      this.stepToy(dt);
      this.drawPit(ctx, w, h, this.toy);
      this.drawHand(ctx);
      ctx.fillStyle = 'rgba(238, 242, 255, 0.8)';
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pick(TEXT).ballCount(this.toy.balls.length), w / 2, this.box.y0 + 34);
    }
    this.drawPopups(ctx, dt);
  }

  private stepToy(dt: number): void {
    const world = this.toy;
    this.heat = this.heating ? Math.min(1, this.heat + 0.5 * dt) : Math.max(0, this.heat - 0.8 * dt);
    world.heat = this.heat;
    world.cool = this.cooling ? 1 : 0;
    this.tint = this.heat > 0.02 || this.cooling ? 1 : Math.max(0, this.tint - 0.3 * dt);

    const hand = world.hand;
    const p = this.pointer;
    hand.active = p.inside && p.mouse && !p.down;
    hand.r = HAND_R * this.unit;
    const vmax = 4000 * this.unit;
    hand.vx = clamp((p.x - this.lastHand.x) / Math.max(dt, 1e-3), -vmax, vmax);
    hand.vy = clamp((p.y - this.lastHand.y) / Math.max(dt, 1e-3), -vmax, vmax);
    hand.x = p.x;
    hand.y = p.y;
    this.lastHand = { x: p.x, y: p.y };

    if (p.down) {
      this.pourAcc += POUR_RATE * dt;
      const n = Math.floor(this.pourAcc);
      this.pourAcc -= n;
      if (n > 0) this.pour(n);
    }

    world.step(dt);
    this.clack(world);
  }

  /** One collision sound per frame, for the hardest hit: pitch by size, volume by speed. */
  private clack(world: BallWorld): void {
    const vref = Math.sqrt(2 * world.gravity * (this.box.y1 - this.box.y0));
    if (world.loudest > 0.08 * vref) {
      sound.play('clack', {
        pitch: clamp((14 * this.unit) / world.loudestR, 0.5, 1.8),
        volume: clamp(world.loudest / (0.5 * vref), 0.1, 1),
      });
    }
    world.loudest = 0;
  }

  // ---- drawing ----

  private drawPit(ctx: CanvasRenderingContext2D, w: number, h: number, world: BallWorld): void {
    const { x0, y0, x1, y1 } = world.box;
    const u = this.unit;

    // Base under the floor (where the toolbar sits), and the hot/cold plate.
    ctx.fillStyle = '#10172e';
    ctx.fillRect(0, y1, w, h - y1);
    if (this.mode === 'toy' && this.heat > 0) {
      const g = ctx.createLinearGradient(0, y1, 0, y1 - 90 * u);
      g.addColorStop(0, `rgba(251, 146, 60, ${0.45 * this.heat})`);
      g.addColorStop(1, 'rgba(251, 146, 60, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x0, y1 - 90 * u, x1 - x0, 90 * u);
    }
    if (this.mode === 'toy' && this.cooling) {
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, 'rgba(125, 211, 252, 0.12)');
      g.addColorStop(1, 'rgba(125, 211, 252, 0.02)');
      ctx.fillStyle = g;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    const hot = this.mode === 'toy' ? this.heat : 0;
    ctx.strokeStyle = hot > 0 ? `rgb(${160 + 95 * hot}, ${170 - 40 * hot}, ${190 - 150 * hot})` : 'rgba(238, 242, 255, 0.45)';
    ctx.lineWidth = 4 + 3 * hot;
    ctx.beginPath();
    ctx.moveTo(x0, y1);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    // Balls: own colour, crossfading into a speed colour (blue slow, red fast).
    const vref = 0.35 * world.kick || 1;
    const tint = this.mode === 'toy' ? this.tint : 0;
    for (const b of world.balls) {
      if (b.gold) continue;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${b.hue}, 85%, 62%)`;
      ctx.fill();
      if (tint > 0.01) {
        const s = Math.min(1, Math.hypot(b.vx, b.vy) / vref);
        ctx.globalAlpha = tint;
        ctx.fillStyle = `hsl(${230 - 230 * s}, 90%, ${50 + 12 * s}%)`;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.beginPath();
      ctx.arc(b.x - 0.35 * b.r, b.y - 0.35 * b.r, 0.3 * b.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fill();
    }
    for (const b of world.balls) {
      if (!b.gold) continue;
      const g = ctx.createRadialGradient(b.x - 0.4 * b.r, b.y - 0.4 * b.r, 0.1 * b.r, b.x, b.y, b.r);
      g.addColorStop(0, '#fff7c2');
      g.addColorStop(0.45, '#fbbf24');
      g.addColorStop(1, '#b45309');
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    }
  }

  private drawHand(ctx: CanvasRenderingContext2D): void {
    const hand = this.toy.hand;
    if (!hand.active) return;
    ctx.beginPath();
    ctx.arc(hand.x, hand.y, hand.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(238, 242, 255, 0.07)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawPopups(ctx: CanvasRenderingContext2D, dt: number): void {
    ctx.textAlign = 'center';
    for (const p of this.popups) {
      p.age += dt;
      ctx.globalAlpha = Math.max(0, 1 - p.age);
      ctx.fillStyle = p.color;
      ctx.font = `800 ${Math.round(22 * this.unit + 6)}px system-ui, sans-serif`;
      ctx.fillText(p.text, p.x, p.y - 40 * p.age * this.unit);
    }
    ctx.globalAlpha = 1;
    this.popups = this.popups.filter((p) => p.age < 1);
  }

  // ---- Plinko ----

  /** The board stands a little higher than the pit, leaving a line for the hint. */
  private plinkoBox(): Box {
    return { ...this.box, y1: this.box.y1 - 34 };
  }

  private plinkoWorld(layout: PlinkoLayout, bumpers: Circle[]): BallWorld {
    const box = this.plinkoBox();
    const world = new BallWorld(box, 1, layout.ballR, 0);
    world.box = box;
    world.gravity = GRAVITY * (this.box.y1 - this.box.y0);
    world.kick = 0;
    world.pegRestitution = 0.3;
    // Air in the board: without it balls skate sideways and the bell turns flat.
    world.sideDrag = 6;
    world.dragLine = layout.bucketTop;
    world.pegs = [...layout.pegs, ...bumpers];
    world.segments = layout.segments;
    return world;
  }

  private startPlinko(): void {
    this.closeDelve();
    this.flow?.dispose();
    this.flow = null;
    const side = Math.random() < 0.5 ? -1 : 1;
    const layout = plinkoLayout(this.plinkoBox(), this.unit, side * 3);
    const bumpers = layout.bumperStarts.map((p) => ({ x: p.x, y: p.y, r: layout.bumperR }));
    this.plinko = {
      layout,
      world: this.plinkoWorld(layout, bumpers),
      bumpers,
      phase: 'place',
      timer: PLINKO.placeTime,
      dropped: 0,
      acc: 0,
      twins: [],
      trails: [[], []],
      twinsTold: false,
      counted: new WeakSet(),
      popped: new Array(PLINKO.buckets).fill(-1),
      score: 0,
      counts: new Array(PLINKO.buckets).fill(0),
    };
    this.mode = 'plinko';
    this.heating = false;
    this.cooling = false;
    this.toyBar.classList.add('hidden');
    this.gameBar.classList.remove('hidden');
    this.dropButton.disabled = false;
    this.toggle.element.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.hint.textContent = pick(TEXT).hintPlace;
  }

  private drop(pl: Plinko): void {
    pl.phase = 'twins';
    pl.timer = 0;
    this.dropButton.disabled = true;
    this.setLabel(this.dropButton, pick(TEXT).drop);
    this.hint.textContent = pick(TEXT).hintTwins;
    // Try a few twin pairs on a scratch copy of the board and show one that
    // parts ways: every pair really starts a hundredth of a pixel apart.
    const { layout } = pl;
    let best = 0;
    let bestGap = -1;
    for (let k = 0; k < 8 && bestGap < 2; k++) {
      const offset = randRange(-0.8, 0.8) * this.unit;
      const scratch = this.plinkoWorld(layout, pl.bumpers.map((b) => ({ ...b })));
      const [a, b] = this.addTwins(scratch, offset);
      for (let t = 0; t < 4; t += 1 / 60) scratch.step(1 / 60);
      const gap = Math.abs(bucketOf(layout, a.x) - bucketOf(layout, b.x));
      if (gap > bestGap) {
        bestGap = gap;
        best = offset;
      }
    }
    pl.twins = this.addTwins(pl.world, best);
    sound.play('click');
  }

  private addTwins(world: BallWorld, offset: number): Ball[] {
    const { spout, ballR } = this.plinko!.layout;
    return [0, PLINKO.twinGap].map((gap, i) =>
      world.add({ x: spout.x + offset + gap, y: spout.y, vx: 0, vy: 0, r: ballR, twin: i + 1, hue: 0 }),
    );
  }

  private stepPlinko(pl: Plinko, dt: number): void {
    const T = pick(TEXT);
    const { layout, world } = pl;
    if (pl.phase === 'place') {
      pl.timer -= dt;
      this.setLabel(this.dropButton, T.dropsIn(Math.max(0, Math.ceil(pl.timer))));
      if (pl.timer <= 0) this.drop(pl);
    } else if (pl.phase === 'twins') {
      pl.timer += dt;
      if (pl.timer >= PLINKO.twinTime) {
        pl.phase = 'pour';
        pl.acc = 0;
      }
    } else if (pl.phase === 'pour') {
      pl.acc += PLINKO.rate * dt;
      while (pl.acc >= 1 && pl.dropped < PLINKO.balls) {
        pl.acc -= 1;
        pl.dropped++;
        const jitter = randRange(-1, 1) * this.unit;
        world.add({ x: layout.spout.x + jitter, y: layout.spout.y, vx: 0, vy: 0, r: layout.ballR, hue: randRange(0, 360) });
      }
      if (pl.dropped >= PLINKO.balls) {
        pl.phase = 'settle';
        pl.timer = 0;
      }
    } else if (pl.phase === 'settle') {
      pl.timer += dt;
      const still = 30 * this.unit;
      const moving = world.balls.some((b) => b.y < layout.countLine || Math.hypot(b.vx, b.vy) > still);
      if ((pl.timer > 1.5 && !moving) || pl.timer > 8) this.finishPlinko(pl);
    }
    if (pl.phase === 'done') return;

    world.step(dt);
    world.loudest = 0;
    pl.twins.forEach((b, i) => {
      const trail = pl.trails[i];
      if (b.y < layout.countLine || trail.length === 0) trail.push({ x: b.x, y: b.y });
    });
    if (!pl.twinsTold && pl.twins.length && pl.twins.every((b) => b.y > layout.countLine)) {
      pl.twinsTold = true;
      const gap = Math.abs(bucketOf(layout, pl.twins[0].x) - bucketOf(layout, pl.twins[1].x));
      this.hint.textContent = gap > 0 ? T.twinsApart(gap) : T.twinsSame;
      window.setTimeout(() => {
        if (this.plinko === pl && pl.phase !== 'done') this.hint.textContent = T.hintPour;
      }, 5000);
    }

    // Points pop out of the buckets as the balls land.
    for (const b of world.balls) {
      if (b.twin || b.y < layout.countLine || pl.counted.has(b)) continue;
      pl.counted.add(b);
      const i = bucketOf(layout, b.x);
      const now = performance.now() / 1000;
      if (i < 0 || now - pl.popped[i] < 0.45) continue;
      if (i === layout.gold || layout.silver.includes(i)) pl.popped[i] = now;
      if (i === layout.gold) {
        this.popups.push({ x: layout.edges[i] + layout.spacing / 2, y: layout.countLine, text: `+${PLINKO.goldPoints}`, color: '#fbbf24', age: 0 });
        sound.play('ding');
      } else if (layout.silver.includes(i)) {
        this.popups.push({ x: layout.edges[i] + layout.spacing / 2, y: layout.countLine, text: `+${PLINKO.silverPoints}`, color: '#cbd5e1', age: 0.3 });
        sound.play('click');
      }
    }
    const tally = plinkoTally(layout, world.balls);
    pl.score = tally.score;
    pl.counts = tally.counts;
    this.hud.textContent = `🎯 Plinko   ·   ${T.hudBalls(PLINKO.balls - pl.dropped)}   ·   ${T.hudScore(pl.score)}`;
  }

  private finishPlinko(pl: Plinko): void {
    pl.phase = 'done';
    const T = pick(TEXT);
    this.gameBar.classList.add('hidden');
    this.hint.textContent = '';
    this.flow = scoreFlow({
      gameId: 'bounce',
      heading: '🎯 Plinko',
      score: pl.score,
      scoreLabel: T.points(pl.score),
      actions: [
        { label: T.playAgain, onClick: () => this.startPlinko() },
        { label: T.freePlay, onClick: () => this.exitToToy() },
      ],
    });
    this.host.overlay.appendChild(this.flow.element);
  }

  private exitToToy(): void {
    this.flow?.dispose();
    this.flow = null;
    this.plinko = null;
    this.dragging = null;
    this.mode = 'toy';
    this.gameBar.classList.add('hidden');
    this.toyBar.classList.remove('hidden');
    this.toggle.element.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.hint.textContent = '';
  }

  private drawPlinko(ctx: CanvasRenderingContext2D, pl: Plinko): void {
    const { layout } = pl;
    const u = this.unit;
    const { y1 } = pl.world.box;
    const S = layout.spacing;
    const edges = layout.edges;

    // Bucket colours and multipliers, drawn over the balls so they stay readable.
    const buckets = (fillOnly: boolean) => {
      for (let i = 0; i < edges.length - 1; i++) {
        const gold = i === layout.gold;
        const silver = layout.silver.includes(i);
        if (!gold && !silver) continue;
        if (fillOnly) {
          ctx.fillStyle = gold ? 'rgba(251, 191, 36, 0.2)' : 'rgba(203, 213, 225, 0.1)';
          ctx.fillRect(edges[i], layout.bucketTop, S, y1 - layout.bucketTop);
          continue;
        }
        ctx.fillStyle = gold ? '#fbbf24' : '#cbd5e1';
        ctx.font = `800 ${Math.round(S * 0.3)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(gold ? `🥇×${PLINKO.goldPoints}` : `×${PLINKO.silverPoints}`, edges[i] + S / 2, layout.bucketTop + S * 0.45);
      }
    };
    buckets(true);
    buckets(false);

    // Pegs and bucket walls.
    ctx.fillStyle = 'rgba(238, 242, 255, 0.55)';
    for (const p of layout.pegs) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.45)';
    ctx.lineWidth = 3;
    for (const s of layout.segments) {
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }

    // The spout.
    const { spout } = layout;
    ctx.fillStyle = 'rgba(238, 242, 255, 0.35)';
    ctx.beginPath();
    ctx.moveTo(spout.x - S * 0.5, spout.y - S * 0.6);
    ctx.lineTo(spout.x + S * 0.5, spout.y - S * 0.6);
    ctx.lineTo(spout.x + S * 0.15, spout.y - layout.ballR);
    ctx.lineTo(spout.x - S * 0.15, spout.y - layout.ballR);
    ctx.closePath();
    ctx.fill();

    // Bumpers: pulse while waiting to be placed.
    const pulse = pl.phase === 'place' ? 0.5 + 0.5 * Math.sin(performance.now() / 250) : 0;
    for (const b of pl.bumpers) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = b === this.dragging ? '#ffffff' : 'rgba(238, 242, 255, 0.85)';
      ctx.fill();
      ctx.strokeStyle = `rgba(125, 211, 252, ${0.4 + 0.6 * pulse})`;
      ctx.lineWidth = 3 + 3 * pulse;
      ctx.stroke();
    }

    // The twins and their paths.
    const colors = ['#f472b6', '#22d3ee'];
    pl.twins.forEach((b, i) => {
      const trail = pl.trails[i];
      if (trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(trail[0].x, trail[0].y);
        for (const p of trail) ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = colors[i];
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 1.6, 0, Math.PI * 2);
      ctx.fillStyle = colors[i];
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Live counts above the buckets.
    ctx.font = `700 ${Math.round(12 * u + 4)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(238, 242, 255, 0.85)';
    pl.counts.forEach((n, i) => {
      if (n > 0) ctx.fillText(String(n), edges[i] + S / 2, layout.bucketTop - 6);
    });
  }

  // ---- UI ----

  private setLabel(button: HTMLButtonElement, text: string): void {
    const label = button.querySelector('.tool-label')!;
    if (label.textContent !== text) label.textContent = text;
  }

  private buildUi(): void {
    const T = pick(TEXT);
    const add = (bar: HTMLElement, emoji: string, label: string, onClick?: () => void): HTMLButtonElement => {
      const button = document.createElement('button');
      button.className = 'tool-button';
      const icon = document.createElement('span');
      icon.className = 'tool-emoji';
      icon.textContent = emoji;
      const text = document.createElement('span');
      text.className = 'tool-label';
      text.textContent = label;
      button.append(icon, text);
      if (onClick) button.addEventListener('click', onClick);
      bar.appendChild(button);
      return button;
    };
    /** Held buttons: a tap gives a burst, holding keeps it going. */
    const hold = (button: HTMLButtonElement, set: (on: boolean) => void) => {
      button.addEventListener('pointerdown', (e) => {
        try {
          button.setPointerCapture(e.pointerId);
        } catch {
          // No live pointer to capture: pointerup still ends the hold.
        }
        button.classList.add('active');
        set(true);
      });
      const off = () => {
        button.classList.remove('active');
        set(false);
      };
      button.addEventListener('pointerup', off);
      button.addEventListener('pointercancel', off);
      button.addEventListener('lostpointercapture', off);
    };

    this.toyBar = document.createElement('div');
    this.toyBar.className = 'game-toolbar';
    hold(add(this.toyBar, '🔥', T.heat), (on) => {
      this.heating = on;
      if (on) {
        this.heat = Math.max(this.heat, 0.45);
        this.cooling = false;
      }
    });
    hold(add(this.toyBar, '❄️', T.cool), (on) => {
      this.cooling = on;
      if (on) this.heat = 0;
    });
    add(this.toyBar, '🟡', T.bigBall, () => this.dropGold());
    add(this.toyBar, '🧹', T.reset, () => this.fillToy());
    add(this.toyBar, '🎯', T.plinko, () => this.startPlinko());

    this.gameBar = document.createElement('div');
    this.gameBar.className = 'game-toolbar hidden';
    this.dropButton = add(this.gameBar, '▶️', T.drop, () => {
      if (this.plinko?.phase === 'place') this.drop(this.plinko);
    });
    add(this.gameBar, '⏹', T.stop, () => this.exitToToy());

    this.hud = document.createElement('div');
    this.hud.className = 'challenge-hud hidden';
    this.hint = document.createElement('p');
    this.hint.className = 'challenge-hint';

    this.toggle = delveToggle(() => (this.delve ? this.closeDelve() : this.openDelve()));
    this.host.overlay.append(this.toyBar, this.gameBar, this.hud, this.hint, this.toggle.element);
  }

  // ---- delve layer ----

  /** Single entry point for switch flips from the delve labs. */
  private setSwitch(name: SwitchName, value: boolean): void {
    this.switches[name] = value;
    this.applySwitches();
    // The chapter-5 demo is an energy story about these switches: restart it
    // so the books stay honest.
    if (this.delve && this.delve.chapter === 4) this.demos.reset(4);
  }

  private openDelve(): void {
    if (this.delve) return;
    this.heating = false;
    this.cooling = false;
    this.pointer.down = false;
    this.delve = delvePanel({
      heading: pick(TEXT).delveHeading,
      chapters: bounceDelve({
        getSwitch: (name) => this.switches[name],
        setSwitch: (name, value) => this.setSwitch(name, value),
      }),
      onChapter: (i) => this.demos.reset(i),
      onExit: () => this.closeDelve(),
    });
    this.host.overlay.appendChild(this.delve.element);
    this.toggle.setOpen(true);
    this.toyBar.classList.add('hidden');
  }

  private closeDelve(): void {
    if (!this.delve) return;
    this.delve.dispose();
    this.delve = null;
    this.demos.clear();
    this.toggle.setOpen(false);
    if (this.mode === 'toy') this.toyBar.classList.remove('hidden');
  }
}

export const bounce: ArcadeGame = {
  id: 'bounce',
  title: { en: 'Ball Pit', nl: 'Ballenbak', no: 'Ballbinge' },
  scienceLine: {
    en: 'Every ball follows one simple rule, yet together they pour like sand and boil like a gas. Some of the very first computer simulations of molecules, in the 1950s, were balls just like these.',
    nl: 'Elke bal volgt één simpele regel, maar samen stromen ze als zand en koken ze als een gas. Een paar van de allereerste computersimulaties van moleculen, in de jaren vijftig, waren ballen zoals deze.',
    no: 'Hver ball følger én enkel regel, men sammen renner de som sand og koker som en gass. Noen av de aller første datasimuleringene av molekyler, på 1950-tallet, var baller akkurat som disse.',
  },
  tileEmoji: '🏀',
  create: (host) => new BounceInstance(host),
};
