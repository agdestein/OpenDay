// Ball Pit (game id 'bounce', once the Phase-0 placeholder "Bouncy Balls").
// Toy: a pit of balls that opens half full; the mouse is a hand that shoves
// them, holding the button pours more, the hot plate boils the pile into a
// gas and the cold button settles it again, a heavy golden ball crashes in,
// and the zoom slider blurs the balls into the smooth field a fluid
// simulation would compute. (The golden ball does not rise when shaken, the
// Brazil-nut effect: that needs spinning, rolling balls, which this model
// leaves out.) Challenge: three rounds — Plinko (luck and crowds), Silo
// (random jams) and Steam engine (temperature and pressure) — summed onto
// the day's scoreboard. Physics in physics.ts, rounds in round*.ts, the delve
// demos in demos.ts.
import type { ArcadeGame, GameHost, GameInstance } from '../../shell/types';
import { clamp, pointerPos, randRange } from '../../lib/util';
import { delvePanel, delveToggle, type DelveHandle, type DelveToggleHandle } from '../../shell/delve';
import { scoreFlow, type ScoreFlowHandle } from '../../shell/scoreflow';
import { sound } from '../../lib/sound';
import { fmtNumber, pick, type Localized } from '../../lib/i18n';
import { bounceDelve, type SwitchName } from './delve';
import { BounceDemos } from './demos';
import { BallWorld, type Ball, type Box } from './physics';
import { drawBalls, drawFrame, label, speedColor } from './draw';
import { averageSquares, drawGridLines, drawSquares, type Squares } from './field';
import { makeHold, toolButton, type ButtonDef, type Round, type RoundHost } from './rounds';
import { PlinkoRound } from './roundPlinko';
import { SiloRound } from './roundSilo';
import { SteamRound } from './roundSteam';

const TEXT: Localized<{
  ballCount: (n: number) => string;
  pairs: (pairs: number, checks: number) => string;
  zoomCaption: (squares: number, balls: number) => [string, string];
  heat: string;
  cool: string;
  bigBall: string;
  zoom: string;
  reset: string;
  challenge: string;
  full: string;
  delveHeading: string;
  stop: string;
  round: (i: number, n: number) => string;
  roundPoints: (n: number) => string;
  nextRound: string;
  finalScore: string;
  challengeHeading: string;
  points: (n: number) => string;
  playAgain: string;
  freePlay: string;
}> = {
  en: {
    ballCount: (n) => `${n} balls, each moved 240 times per second`,
    pairs: (p, c) => `${fmtNumber(p)} pairs could touch; the grid checks only ${fmtNumber(c)}`,
    zoomCaption: (s, n) => [
      'Zoomed out: each square keeps only how full it is and how fast its balls move.',
      `${s} squares instead of ${n} balls. That is what Swirl Lab computes.`,
    ],
    heat: 'Heat',
    cool: 'Cool',
    bigBall: 'Big ball',
    zoom: 'Zoom out',
    reset: 'Reset',
    challenge: 'Challenge!',
    full: 'Full!',
    delveHeading: '🔬 The science of the Ball Pit',
    stop: 'Stop',
    round: (i, n) => `Round ${i}/${n}`,
    roundPoints: (n) => `+${fmtNumber(n)} points`,
    nextRound: 'Next round ▶',
    finalScore: 'Final score ▶',
    challengeHeading: '🏀 Ball Pit challenge',
    points: (n) => `${fmtNumber(n)} points`,
    playAgain: 'Play again',
    freePlay: 'Ball pit',
  },
  nl: {
    ballCount: (n) => `${n} ballen, elk 240 keer per seconde verplaatst`,
    pairs: (p, c) => `${fmtNumber(p)} paren kunnen botsen; het rooster controleert er maar ${fmtNumber(c)}`,
    zoomCaption: (s, n) => [
      'Uitgezoomd: elk vakje onthoudt alleen hoe vol het is en hoe snel de ballen erin gaan.',
      `${s} vakjes in plaats van ${n} ballen. Dat rekent Wervel-lab uit.`,
    ],
    heat: 'Verwarm',
    cool: 'Koel af',
    bigBall: 'Grote bal',
    zoom: 'Zoom uit',
    reset: 'Reset',
    challenge: 'Uitdaging!',
    full: 'Vol!',
    delveHeading: '🔬 De wetenschap van de Ballenbak',
    stop: 'Stop',
    round: (i, n) => `Ronde ${i}/${n}`,
    roundPoints: (n) => `+${fmtNumber(n)} punten`,
    nextRound: 'Volgende ronde ▶',
    finalScore: 'Eindscore ▶',
    challengeHeading: '🏀 Ballenbak-uitdaging',
    points: (n) => `${fmtNumber(n)} punten`,
    playAgain: 'Nog een keer',
    freePlay: 'Ballenbak',
  },
  no: {
    ballCount: (n) => `${n} baller, hver flyttet 240 ganger i sekundet`,
    pairs: (p, c) => `${fmtNumber(p)} par kan kollidere; rutenettet sjekker bare ${fmtNumber(c)}`,
    zoomCaption: (s, n) => [
      'Zoomet ut: hver rute husker bare hvor full den er og hvor fort ballene i den går.',
      `${s} ruter i stedet for ${n} baller. Det er det Virvellab regner ut.`,
    ],
    heat: 'Varm opp',
    cool: 'Kjøl ned',
    bigBall: 'Stor ball',
    zoom: 'Zoom ut',
    reset: 'Nullstill',
    challenge: 'Utfordring!',
    full: 'Fullt!',
    delveHeading: '🔬 Vitenskapen bak Ballbinga',
    stop: 'Stopp',
    round: (i, n) => `Runde ${i}/${n}`,
    roundPoints: (n) => `+${fmtNumber(n)} poeng`,
    nextRound: 'Neste runde ▶',
    finalScore: 'Sluttpoeng ▶',
    challengeHeading: '🏀 Ballbinge-utfordring',
    points: (n) => `${fmtNumber(n)} poeng`,
    playAgain: 'Spill igjen',
    freePlay: 'Ballbinge',
  },
};

const ROUNDS: ((host: RoundHost) => Round)[] = [
  (host) => new PlinkoRound(host),
  (host) => new SiloRound(host),
  (host) => new SteamRound(host),
];

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
/** Zoom-out squares, in units: about three ball widths, so each holds a handful. */
const FIELD_CELL = 90;
const MARGIN = 10;
const BACKGROUND = '#0b1020';

interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
}

interface Challenge {
  index: number;
  total: number;
  round: Round;
  card: HTMLElement | null;
}

class BounceInstance implements GameInstance {
  private ctx: CanvasRenderingContext2D;
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
  private zoom = 0;
  private squares: Squares | null = null;
  private popups: Popup[] = [];

  private challenge: Challenge | null = null;
  private flow: ScoreFlowHandle | null = null;

  private toyBar!: HTMLElement;
  private gameBar!: HTMLElement;
  private zoomInput!: HTMLInputElement;
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
    this.challenge?.round.dispose();
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
    if (this.toy) this.fitToy();
  }

  private fitToy(): void {
    const bh = this.box.y1 - this.box.y0;
    this.toy.box = this.box;
    this.toy.gravity = GRAVITY * bh;
    this.toy.kick = KICK * Math.sqrt(2 * this.toy.gravity * bh);
  }

  private fillToy(): void {
    const u = this.unit;
    this.toy = new BallWorld(this.box, 1, R_MAX * u, 1);
    this.fitToy();
    this.applySwitches();
    const { x0, x1, y1 } = this.box;
    const top = y1 - START_FILL * (y1 - this.box.y0);
    const step = 2 * R_MAX * u;
    for (let y = y1 - R_MAX * u; y > top; y -= step) {
      for (let x = x0 + R_MAX * u; x < x1 - R_MAX * u; x += step) {
        this.addBall(x + randRange(-2, 2), y, 0, 0);
      }
    }
    // Let the pile settle before anybody sees it.
    for (let k = 0; k < 90; k++) this.toy.step(1 / 60);
    this.toy.loudest = 0;
  }

  private addBall(x: number, y: number, vx: number, vy: number): Ball {
    return this.toy.add({ x, y, vx, vy, r: randRange(R_MIN, R_MAX) * this.unit, hue: randRange(0, 360) });
  }

  private applySwitches(): void {
    this.toy.collisions = this.switches.collisions;
    this.toy.friction = this.switches.friction;
    this.toy.dissipate = this.switches.dissipate;
  }

  // ---- input ----

  private onDown = (e: PointerEvent) => {
    if (this.delve || this.flow || this.challenge?.card) return;
    const p = pointerPos(this.host.canvas, e);
    Object.assign(this.pointer, p, { inside: true, down: true, mouse: e.pointerType !== 'touch' });
    try {
      this.host.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic or already-gone pointer: moves over the canvas still arrive.
    }
    if (this.challenge) {
      this.challenge.round.down(p.x, p.y);
      return;
    }
    // A tap drops a handful; holding keeps pouring (see frame).
    this.pour(HANDFUL);
    this.pourAcc = 0;
  };

  private onMove = (e: PointerEvent) => {
    const p = pointerPos(this.host.canvas, e);
    Object.assign(this.pointer, p, { inside: true, mouse: e.pointerType !== 'touch' });
    this.challenge?.round.move(p.x, p.y);
  };

  private onUp = () => {
    this.pointer.down = false;
    this.challenge?.round.up();
  };

  private onLeave = () => {
    if (!this.pointer.down) this.pointer.inside = false;
  };

  private pour(count: number): void {
    const u = this.unit;
    const { x0, y0, x1, y1 } = this.box;
    let area = 0;
    for (const b of this.toy.balls) area += Math.PI * b.r * b.r;
    const limit = FILL_LIMIT * (x1 - x0) * (y1 - y0);
    for (let k = 0; k < count; k++) {
      if (area > limit) {
        if (this.fullCooldown <= 0) {
          this.popup(this.pointer.x, this.pointer.y - 30 * u, pick(TEXT).full, '#fca5a5');
          sound.play('thud');
          this.fullCooldown = 1.2;
        }
        return;
      }
      const x = clamp(this.pointer.x + randRange(-18, 18) * u, x0 + R_MAX * u, x1 - R_MAX * u);
      const y = clamp(this.pointer.y + randRange(-18, 18) * u, y0 + R_MAX * u, y1 - R_MAX * u);
      const b = this.addBall(x, y, randRange(-150, 150) * u, randRange(-150, 50) * u);
      area += Math.PI * b.r * b.r;
    }
  }

  private dropGold(): void {
    this.toy.balls = this.toy.balls.filter((b) => !b.gold);
    const r = GOLD_R * this.unit;
    const { x0, x1, y0 } = this.box;
    this.toy.add({ x: randRange(x0 + r, x1 - r), y: y0 + r + 2, vx: 0, vy: 0, r, gold: true, hue: 45 });
    sound.play('ding');
  }

  private popup(x: number, y: number, text: string, color: string): void {
    this.popups.push({ x, y, text, color, age: 0 });
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
    this.fullCooldown -= dt;
    const ch = this.challenge;
    if (ch) {
      ch.round.step(dt);
      ch.round.draw(ctx, w, h);
      this.updateHud(ch);
    } else {
      this.measure();
      this.stepToy(dt);
      this.drawToy(ctx, w, h);
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
    // One collision sound per frame, for the hardest hit: pitch by size, volume by speed.
    const vref = Math.sqrt(2 * world.gravity * (this.box.y1 - this.box.y0));
    if (world.loudest > 0.08 * vref) {
      sound.play('clack', {
        pitch: clamp((14 * this.unit) / world.loudestR, 0.5, 1.8),
        volume: clamp(world.loudest / (0.5 * vref), 0.1, 1),
      });
    }
    world.loudest = 0;
  }

  private drawToy(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const world = this.toy;
    const { x0, y0, x1, y1 } = this.box;
    const u = this.unit;
    drawFrame(ctx, this.box, w, h, this.heat);
    if (this.cooling) {
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, 'rgba(125, 211, 252, 0.12)');
      g.addColorStop(1, 'rgba(125, 211, 252, 0.02)');
      ctx.fillStyle = g;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }

    // The zoom slider, in steps you can see: balls take their speed colours,
    // a grid appears, each square fills with the average of its balls (how
    // full, how fast), and finally the balls go and only the squares remain.
    const z = this.zoom;
    const vref = 0.35 * world.kick;
    const cell = FIELD_CELL * u;
    let kept = 0;
    if (z > 0.3) {
      this.squares = averageSquares(world.balls, this.box, cell, this.squares ?? undefined);
      const sq = this.squares;
      for (let c = 0; c < sq.nx * sq.ny; c++) if (sq.full[c] > 0.02) kept++;
      drawSquares(ctx, sq, this.box, smooth(0.3, 0.7, z), (full, speed) =>
        full > 0.02 ? speedColor(speed / vref, 0.25 + 0.75 * full) : null,
      );
    }
    const ballsAlpha = 1 - smooth(0.7, 0.95, z);
    if (ballsAlpha > 0) {
      ctx.globalAlpha = ballsAlpha;
      drawBalls(ctx, world.balls, Math.max(this.tint, smooth(0, 0.3, z)), vref);
      ctx.globalAlpha = 1;
    }
    if (z > 0.1) drawGridLines(ctx, this.box, cell, 0.35 * smooth(0.1, 0.4, z));

    const hand = world.hand;
    if (hand.active) {
      ctx.beginPath();
      ctx.arc(hand.x, hand.y, hand.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(238, 242, 255, 0.07)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(238, 242, 255, 0.45)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Below the corner buttons and the delve pill, which own the top row.
    const T = pick(TEXT);
    const cx = (x0 + x1) / 2;
    const top = y0 + 80;
    if (z > 0.5) {
      const [line1, line2] = T.zoomCaption(kept, world.balls.length);
      label(ctx, line1, cx, top, 18, 'rgba(238, 242, 255, 0.9)');
      label(ctx, line2, cx, top + 24, 16, 'rgba(238, 242, 255, 0.7)');
    } else {
      const n = world.balls.length;
      label(ctx, T.ballCount(n), cx, top, 20, 'rgba(238, 242, 255, 0.85)');
      if (world.collisions) {
        label(ctx, T.pairs((n * (n - 1)) / 2, Math.round(world.pairChecks)), cx, top + 24, 14, 'rgba(238, 242, 255, 0.55)');
      }
    }
  }

  private drawPopups(ctx: CanvasRenderingContext2D, dt: number): void {
    for (const p of this.popups) {
      p.age += dt;
      ctx.globalAlpha = Math.max(0, 1 - p.age);
      label(ctx, p.text, p.x, p.y - 40 * p.age * this.unit, 22 * this.unit + 6, p.color);
    }
    ctx.globalAlpha = 1;
    this.popups = this.popups.filter((p) => p.age < 1);
  }

  // ---- challenge ----

  private roundHost(): RoundHost {
    return {
      box: this.box,
      unit: this.unit,
      hint: (text) => (this.hint.textContent = text),
      popup: (x, y, text, color) => this.popup(x, y, text, color),
      buttons: (defs) => this.roundButtons(defs),
      finish: (score, summary) => this.roundOver(score, summary),
    };
  }

  private startChallenge(): void {
    this.closeDelve();
    this.flow?.dispose();
    this.flow = null;
    this.challenge?.round.dispose();
    this.heating = false;
    this.cooling = false;
    this.toyBar.classList.add('hidden');
    this.toggle.element.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.gameBar.classList.remove('hidden');
    this.challenge = { index: 0, total: 0, round: ROUNDS[0](this.roundHost()), card: null };
  }

  private nextRound(): void {
    const ch = this.challenge;
    if (!ch) return;
    ch.card?.remove();
    ch.card = null;
    ch.round.dispose();
    ch.index++;
    this.gameBar.classList.remove('hidden');
    ch.round = ROUNDS[ch.index](this.roundHost());
  }

  private roundOver(score: number, summary: string): void {
    const ch = this.challenge;
    if (!ch) return;
    ch.total += score;
    const T = pick(TEXT);
    this.gameBar.classList.add('hidden');
    this.hint.textContent = '';
    const last = ch.index === ROUNDS.length - 1;
    const card = document.createElement('div');
    card.className = 'score-flow';
    const heading = document.createElement('h2');
    heading.textContent = ch.round.title;
    const points = document.createElement('div');
    points.className = 'score-flow-score';
    points.textContent = T.roundPoints(score);
    const text = document.createElement('p');
    text.className = 'score-flow-prompt';
    text.style.maxWidth = '32rem';
    text.textContent = summary;
    const actions = document.createElement('div');
    actions.className = 'score-flow-actions';
    const next = document.createElement('button');
    next.className = 'arcade-button';
    next.textContent = last ? T.finalScore : T.nextRound;
    next.addEventListener('click', () => (last ? this.finishChallenge() : this.nextRound()));
    actions.appendChild(next);
    card.append(heading, points, text, actions);
    ch.card = card;
    this.host.overlay.appendChild(card);
    sound.play('cheer');
  }

  private finishChallenge(): void {
    const ch = this.challenge;
    if (!ch) return;
    ch.card?.remove();
    ch.card = null;
    const T = pick(TEXT);
    this.flow = scoreFlow({
      gameId: 'bounce',
      heading: T.challengeHeading,
      score: ch.total,
      scoreLabel: T.points(ch.total),
      actions: [
        { label: T.playAgain, onClick: () => this.startChallenge() },
        { label: T.freePlay, onClick: () => this.exitToToy() },
      ],
    });
    this.host.overlay.appendChild(this.flow.element);
  }

  private exitToToy(): void {
    this.flow?.dispose();
    this.flow = null;
    const ch = this.challenge;
    if (ch) {
      ch.card?.remove();
      ch.round.dispose();
    }
    this.challenge = null;
    this.gameBar.classList.add('hidden');
    this.toyBar.classList.remove('hidden');
    this.toggle.element.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.hint.textContent = '';
  }

  private updateHud(ch: Challenge): void {
    const T = pick(TEXT);
    const text = [
      T.round(ch.index + 1, ROUNDS.length),
      ch.round.title,
      ch.round.hud(),
      `⭐ ${fmtNumber(ch.total + (ch.card ? 0 : ch.round.score))}`,
    ].join('   ·   ');
    if (this.hud.textContent !== text) this.hud.textContent = text;
  }

  // ---- UI ----

  private makeButton(bar: HTMLElement, def: ButtonDef): HTMLButtonElement {
    const button = toolButton(def.emoji, def.label);
    if (def.onClick) button.addEventListener('click', def.onClick);
    if (def.hold) makeHold(button, def.hold);
    bar.appendChild(button);
    return button;
  }

  /** The round's buttons, then Stop. */
  private roundButtons(defs: ButtonDef[]): HTMLButtonElement[] {
    this.gameBar.replaceChildren();
    const buttons = defs.map((def) => this.makeButton(this.gameBar, def));
    this.makeButton(this.gameBar, { emoji: '⏹', label: pick(TEXT).stop, onClick: () => this.exitToToy() });
    return buttons;
  }

  private buildUi(): void {
    const T = pick(TEXT);
    this.toyBar = document.createElement('div');
    this.toyBar.className = 'game-toolbar';
    this.makeButton(this.toyBar, {
      emoji: '🔥',
      label: T.heat,
      hold: (on) => {
        this.heating = on;
        if (on) {
          this.heat = Math.max(this.heat, 0.45);
          this.cooling = false;
        }
      },
    });
    this.makeButton(this.toyBar, {
      emoji: '❄️',
      label: T.cool,
      hold: (on) => {
        this.cooling = on;
        if (on) this.heat = 0;
      },
    });
    this.makeButton(this.toyBar, { emoji: '🟡', label: T.bigBall, onClick: () => this.dropGold() });

    // The zoom slider lives in a tool-button-shaped box (a range input can't sit in a button).
    const zoom = document.createElement('label');
    zoom.className = 'tool-button';
    const icon = document.createElement('span');
    icon.className = 'tool-emoji';
    icon.textContent = '🔭';
    this.zoomInput = document.createElement('input');
    this.zoomInput.type = 'range';
    this.zoomInput.min = '0';
    this.zoomInput.max = '1';
    this.zoomInput.step = '0.01';
    this.zoomInput.value = '0';
    this.zoomInput.setAttribute('aria-label', T.zoom);
    this.zoomInput.style.cssText = 'width:6.5rem;margin:0.1rem 0 0;accent-color:#7dd3fc;';
    this.zoomInput.addEventListener('input', () => (this.zoom = Number(this.zoomInput.value)));
    zoom.append(icon, this.zoomInput);
    this.toyBar.appendChild(zoom);

    this.makeButton(this.toyBar, { emoji: '🧹', label: T.reset, onClick: () => this.fillToy() });
    this.makeButton(this.toyBar, { emoji: '🎯', label: T.challenge, onClick: () => this.startChallenge() });

    this.gameBar = document.createElement('div');
    this.gameBar.className = 'game-toolbar hidden';

    this.hud = document.createElement('div');
    this.hud.className = 'challenge-hud hidden';
    this.hint = document.createElement('p');
    this.hint.className = 'challenge-hint';

    this.toggle = delveToggle(() => (this.delve ? this.closeDelve() : this.openDelve()));
    this.host.overlay.append(this.toyBar, this.gameBar, this.hud, this.hint, this.toggle.element);
  }

  // ---- delve layer ----

  private setSwitch(name: SwitchName, value: boolean): void {
    this.switches[name] = value;
    this.applySwitches();
    // Chapter 3 compares the atom floor with the shortcut: restart both together.
    if (this.demos.chapter === 2) this.demos.reset(2);
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
    if (!this.challenge) this.toyBar.classList.remove('hidden');
  }
}

function smooth(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
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
