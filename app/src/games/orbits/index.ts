// Gravity Doodle. Toy: fling planets (or pebbles, giants, even a second star)
// around the Sun with drag-and-release, or grab one and throw it again. Every
// body pulls on every other and bodies that touch merge (physics.ts), so near
// misses bend paths, giants make the Sun wobble and a second star turns the
// system wild. While you aim, the 🔮 forecast — the same simulation copied and
// run ahead — shows the future exactly. Challenge: "Save the Earth"
// (roundDefense.ts), a cloud of possible asteroids you look at and push. The
// delve (delve.ts, demos.ts) explains the science.
import type { ArcadeGame, GameHost, GameInstance } from '../../shell/types';
import { clamp, pointerPos, randRange } from '../../lib/util';
import { delvePanel, delveToggle, type DelveHandle, type DelveToggleHandle } from '../../shell/delve';
import { scoreFlow, type ScoreFlowHandle } from '../../shell/scoreflow';
import { sound } from '../../lib/sound';
import { fmtNumber, pick, type Localized } from '../../lib/i18n';
import { orbitsDelve } from './delve';
import { OrbitsDemos } from './demos';
import { forecast, KINDS, SUN_R, TICK, World, type Body, type Kind, type Outcome } from './physics';
import { drawPlanet, drawStar, label, starfield } from './draw';
import { toolButton, type Area, type ButtonDef, type Round, type RoundHost } from './rounds';
import { DefenseRound } from './roundDefense';

const TEXT: Localized<{
  dragHint: string;
  delveHeading: string;
  outcomeLabel: Record<Outcome, string>;
  kinds: Record<Kind, string>;
  years: (n: number) => string;
  clear: string;
  challenge: string;
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
    dragHint: 'Drag and release to launch a planet — longer drag = faster!',
    delveHeading: '🔬 The science of Gravity Doodle',
    outcomeLabel: {
      orbit: '🔮 nice orbit!',
      far: '🌠 a huge orbit — gone for a long while',
      escape: '🚀 past escape speed!',
      crash: '💥 heading into a star',
      merge: '💥 it will smash into a planet!',
    },
    kinds: { pebble: 'Pebble', planet: 'Planet', giant: 'Giant', star: 'Star' },
    years: (n) => (n === 1 ? '1 year!' : `${n} years!`),
    clear: 'Clear',
    challenge: 'Challenge!',
    stop: 'Stop',
    round: (i, n) => `Round ${i}/${n}`,
    roundPoints: (n) => `+${fmtNumber(n)} points`,
    nextRound: 'Next round ▶',
    finalScore: 'Final score ▶',
    challengeHeading: '🪐 Gravity Doodle challenge',
    points: (n) => `${fmtNumber(n)} points`,
    playAgain: 'Play again',
    freePlay: 'Free play',
  },
  nl: {
    dragHint: 'Sleep en laat los om een planeet te lanceren — langer slepen = sneller!',
    delveHeading: '🔬 De wetenschap van Zwaartekracht-doodle',
    outcomeLabel: {
      orbit: '🔮 mooie baan!',
      far: '🌠 een enorme baan — lang weg',
      escape: '🚀 voorbij de ontsnappingssnelheid!',
      crash: '💥 op weg naar een ster',
      merge: '💥 hij botst op een planeet!',
    },
    kinds: { pebble: 'Steentje', planet: 'Planeet', giant: 'Reus', star: 'Ster' },
    years: (n) => `${n} jaar!`,
    clear: 'Leeg',
    challenge: 'Uitdaging!',
    stop: 'Stop',
    round: (i, n) => `Ronde ${i}/${n}`,
    roundPoints: (n) => `+${fmtNumber(n)} punten`,
    nextRound: 'Volgende ronde ▶',
    finalScore: 'Eindscore ▶',
    challengeHeading: '🪐 Zwaartekracht-doodle-uitdaging',
    points: (n) => `${fmtNumber(n)} punten`,
    playAgain: 'Nog een keer',
    freePlay: 'Vrij spelen',
  },
  no: {
    dragHint: 'Dra og slipp for å skyte opp en planet — lengre drag = raskere!',
    delveHeading: '🔬 Vitenskapen bak Tyngdekraft-doodle',
    outcomeLabel: {
      orbit: '🔮 fin bane!',
      far: '🌠 en enorm bane — borte lenge',
      escape: '🚀 forbi unnslipningshastigheten!',
      crash: '💥 på vei inn i en stjerne',
      merge: '💥 den krasjer i en planet!',
    },
    kinds: { pebble: 'Stein', planet: 'Planet', giant: 'Kjempe', star: 'Stjerne' },
    years: (n) => `${n} år!`,
    clear: 'Tøm',
    challenge: 'Utfordring!',
    stop: 'Stopp',
    round: (i, n) => `Runde ${i}/${n}`,
    roundPoints: (n) => `+${fmtNumber(n)} poeng`,
    nextRound: 'Neste runde ▶',
    finalScore: 'Sluttpoeng ▶',
    challengeHeading: '🪐 Tyngdekraft-doodle-utfordring',
    points: (n) => `${fmtNumber(n)} poeng`,
    playAgain: 'Spill igjen',
    freePlay: 'Fri lek',
  },
};

const ROUNDS: ((host: RoundHost) => Round)[] = [(host) => new DefenseRound(host)];

const OUTCOME_COLOR: Record<Outcome, string> = {
  orbit: '#6ee7b7',
  far: '#fde047',
  escape: '#fb923c',
  crash: '#f87171',
  merge: '#f472b6',
};
const KIND_EMOJI: Record<Kind, string> = { pebble: '🪨', planet: '🌍', giant: '🪐', star: '⭐' };
const KIND_ORDER: Kind[] = ['pebble', 'planet', 'giant', 'star'];
/** Hues a new star may get: golden, blue-white, red. */
const STAR_HUES = [45, 205, 12];
const newHue = (kind: Kind) => (kind === 'star' ? STAR_HUES[Math.floor(Math.random() * STAR_HUES.length)] : randRange(0, 360));

const MAX_BODIES = 32;
const TRAIL_LENGTH = 180;
/** How far the 🔮 forecast looks ahead (s), and every how many steps it keeps a point. */
const FORECAST_SECONDS = 6;
const FORECAST_EVERY = 6;
/** Launch speed cap, as a multiple of the escape speed at the launch point. */
const LAUNCH_CAP = 1.2;
/** Most fixed steps per frame (the shell clamps dt to 0.05 s = 12 steps). */
const MAX_STEPS = 16;
/** Lap popups (with a ding) for these birthdays only. */
const LAP_POPUPS = new Set([1, 2, 3, 10, 25, 50, 100]);
const BACKGROUND = '#05081a';

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

interface Drag {
  x0: number;
  y0: number;
  /** A body picked up to throw again (not in the world while held). */
  grab: Body | null;
}

class OrbitsInstance implements GameInstance {
  private ctx: CanvasRenderingContext2D;
  private world!: World;
  private w = 0;
  private h = 0;
  private unit = 1;
  private gm = 1;
  private acc = 0;
  private time = 0;

  private kind: Kind = 'planet';
  private drag: Drag | null = null;
  private pointer = { x: 0, y: 0, inside: false, mouse: true };
  private trails = new Map<number, { x: number; y: number }[]>();
  private laps = new Map<number, { last: number; turned: number; laps: number }>();
  private poofs: { x: number; y: number; t: number; hue: number; r: number }[] = [];
  private popups: Popup[] = [];
  private launched = false;
  private hintAlpha = 1;
  private sunlessFor = 0;
  private emptyFor = 0;
  private stars: ReturnType<typeof starfield> = [];

  private challenge: Challenge | null = null;
  private flow: ScoreFlowHandle | null = null;
  private toyBar!: HTMLElement;
  private gameBar!: HTMLElement;
  private kindButtons = new Map<Kind, HTMLButtonElement>();
  private hud!: HTMLElement;
  private hint!: HTMLElement;
  private delve: DelveHandle | null = null;
  private toggle!: DelveToggleHandle;
  private demos = new OrbitsDemos();

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
    this.seed();
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

  // ---- layout and seeding ----

  /** Screen size, and the scale everything is measured in (1 unit = 1 px on a 720 px tall screen). */
  private measure(): void {
    const { canvas, dpr } = this.host;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    const m = Math.min(w, h);
    this.unit = m / 720;
    this.gm = 25 * m * m;
    this.stars = starfield(w, h);
    if (this.world) {
      this.world.cx = w / 2;
      this.world.cy = h / 2;
      this.world.reach = 3 * Math.max(w, h);
    }
  }

  /** The Sun and three planets on circular orbits spaced to stay stable, so the screen is alive at once. */
  private seed(): void {
    const { w, h, unit: u, gm } = this;
    this.world = new World(w / 2, h / 2, u, gm);
    this.world.reach = 3 * Math.max(w, h);
    this.trails.clear();
    this.laps.clear();
    this.world.add({ kind: 'star', sun: true, x: w / 2, y: h / 2, vx: 0, vy: 0, gm, r: SUN_R * u, hue: 45 });
    const m = Math.min(w, h);
    const seeds: [Kind, number][] = [['pebble', 0.11], ['planet', 0.2], ['giant', 0.44]];
    for (const [kind, f] of seeds) {
      const r = f * m;
      const angle = randRange(0, Math.PI * 2);
      const speed = Math.sqrt(gm / r);
      this.addBody(kind, w / 2 + r * Math.cos(angle), h / 2 + r * Math.sin(angle), -speed * Math.sin(angle), speed * Math.cos(angle));
    }
    this.sunlessFor = 0;
    this.emptyFor = 0;
  }

  private addBody(kind: Kind, x: number, y: number, vx: number, vy: number): Body {
    const k = KINDS[kind];
    return this.world.add({ kind, x, y, vx, vy, gm: k.mass * this.gm, r: k.r * this.unit, hue: newHue(kind) });
  }

  private area(): Area {
    const top = this.hud.offsetHeight ? this.hud.offsetTop + this.hud.offsetHeight + 8 : 70;
    const bar = this.gameBar.offsetHeight || this.toyBar.offsetHeight || 70;
    return { x0: 0, y0: top, x1: this.w, y1: this.h - bar - 60 };
  }

  // ---- input ----

  private onDown = (e: PointerEvent) => {
    if (this.delve || this.flow || this.challenge?.card) return;
    const p = pointerPos(this.host.canvas, e);
    Object.assign(this.pointer, p, { inside: true, mouse: e.pointerType !== 'touch' });
    try {
      this.host.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic or already-gone pointer: moves over the canvas still arrive.
    }
    if (this.challenge) {
      this.challenge.round.down(p.x, p.y);
      return;
    }
    // Pressing on a planet picks it up; anywhere else starts a new throw.
    let grab: Body | null = null;
    let best = Infinity;
    for (const b of this.world.bodies) {
      if (b.sun) continue;
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (d < b.r + 10 * this.unit && d < best) {
        best = d;
        grab = b;
      }
    }
    if (grab) {
      this.world.remove(grab);
      this.drag = { x0: grab.x, y0: grab.y, grab };
    } else {
      this.drag = { x0: p.x, y0: p.y, grab: null };
    }
  };

  private onMove = (e: PointerEvent) => {
    const p = pointerPos(this.host.canvas, e);
    Object.assign(this.pointer, p, { inside: true, mouse: e.pointerType !== 'touch' });
    this.challenge?.round.move(p.x, p.y);
  };

  private onUp = () => {
    this.challenge?.round.up();
    const d = this.drag;
    this.drag = null;
    if (!d || this.challenge) return;
    const v = this.launchVelocity(d, this.pointer);
    this.throwBody(d, v);
  };

  private onLeave = () => {
    if (!this.drag) this.pointer.inside = false;
  };

  /** Drag vector → launch velocity: a comfortable drag reaches circle speed mid-screen; capped a little past escape. */
  private launchVelocity(from: { x0: number; y0: number }, to: { x: number; y: number }): { x: number; y: number } {
    const m = Math.min(this.w, this.h);
    const k = Math.sqrt(this.gm / (0.35 * m)) / (0.3 * m);
    let vx = (to.x - from.x0) * k;
    let vy = (to.y - from.y0) * k;
    const s = this.world.stars();
    const r = Math.max(Math.hypot(from.x0 - s.x, from.y0 - s.y), SUN_R * this.unit + 4);
    const vMax = LAUNCH_CAP * Math.sqrt((2 * Math.max(s.gm, this.gm * 0.5)) / r);
    const v = Math.hypot(vx, vy);
    if (v > vMax) {
      vx *= vMax / v;
      vy *= vMax / v;
    }
    return { x: vx, y: vy };
  }

  /** The body a drag would throw, as it would enter the world. */
  private thrown(d: Drag, v: { x: number; y: number }, id?: number): Omit<Body, 'ax' | 'ay' | 'id'> & { id?: number } {
    if (d.grab) {
      const { ax: _ax, ay: _ay, ...rest } = d.grab;
      return { ...rest, x: d.x0, y: d.y0, vx: v.x, vy: v.y };
    }
    const k = KINDS[this.kind];
    return { id, kind: this.kind, x: d.x0, y: d.y0, vx: v.x, vy: v.y, gm: k.mass * this.gm, r: k.r * this.unit, hue: this.nextHue };
  }

  /** The next new body's colour, fixed before the throw so the forecast shows it. */
  private nextHue = randRange(0, 360);

  private throwBody(d: Drag, v: { x: number; y: number }): void {
    this.world.add(this.thrown(d, v));
    if (!d.grab) this.nextHue = newHue(this.kind);
    const speed = Math.hypot(v.x, v.y) / Math.sqrt(this.gm / (0.3 * Math.min(this.w, this.h)));
    sound.play('whoosh', { pitch: clamp(0.7 + 0.5 * speed, 0.6, 1.8), volume: clamp(0.4 + 0.6 * speed, 0.3, 1) });
    this.launched = true;
    this.trim();
  }

  /** Too many bodies: first drop ones far off screen, then the smallest planet. */
  private trim(): void {
    const B = this.world.bodies;
    while (B.length > MAX_BODIES) {
      const off = B.find((b) => !b.sun && !this.onScreen(b, 0));
      let victim = off;
      if (!victim) {
        for (const b of B) if (!b.sun && b.kind !== 'star' && (!victim || b.gm < victim.gm)) victim = b;
      }
      if (!victim) break;
      this.world.remove(victim);
    }
  }

  private onScreen(b: Body, margin: number): boolean {
    return b.x > -margin && b.x < this.w + margin && b.y > -margin && b.y < this.h + margin;
  }

  // ---- frame ----

  frame(dt: number): void {
    this.time += dt;
    const { dpr } = this.host;
    this.measure();
    const { w, h } = this;
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, w, h);
    this.drawStarfield(ctx);

    if (this.delve) {
      this.demos.step(dt);
      this.demos.draw(ctx, w, h);
      return;
    }
    const ch = this.challenge;
    if (ch) {
      ch.round.step(dt);
      ch.round.draw(ctx, w, h);
      this.updateHud(ch);
    } else {
      this.stepToy(dt);
      this.drawToy(ctx);
    }
    this.drawPopups(ctx, dt);
  }

  private stepToy(dt: number): void {
    const world = this.world;
    this.acc = Math.min(this.acc + dt, MAX_STEPS * TICK);
    while (this.acc >= TICK) {
      this.acc -= TICK;
      world.step();
    }

    // Merges: a flash, and a sizzle into a star or a thud between planets.
    for (const m of world.takeMerges()) {
      this.poofs.push({ x: m.x, y: m.y, t: 0, hue: m.gone.hue, r: m.gone.r });
      if (m.into.kind === 'star') sound.play('sizzle');
      else sound.play('thud', { pitch: clamp((12 * this.unit) / m.into.r, 0.5, 1.5) });
      this.trails.delete(m.gone.id);
      this.laps.delete(m.gone.id);
    }

    // Kiosk guards: lost or broken bodies go; a system without a star is reseeded.
    const far = 8 * Math.max(this.w, this.h);
    for (const b of [...world.bodies]) {
      const bad = !Number.isFinite(b.x + b.y + b.vx + b.vy);
      if (bad || Math.hypot(b.x - world.cx, b.y - world.cy) > far) {
        world.remove(b);
        this.trails.delete(b.id);
        this.laps.delete(b.id);
      }
    }
    const starNear = world.bodies.some((b) => b.kind === 'star' && this.onScreen(b, 0.5 * Math.max(this.w, this.h)));
    this.sunlessFor = starNear ? 0 : this.sunlessFor + dt;
    if (this.sunlessFor > 3) this.seed();
    // Only stars left for a while: bring planets back, so an idle screen stays alive.
    this.emptyFor = world.bodies.some((b) => b.kind !== 'star') || this.drag ? 0 : this.emptyFor + dt;
    if (this.emptyFor > 20) this.seed();

    // Trails and years (laps around the stars).
    const s = world.stars();
    for (const b of world.bodies) {
      let trail = this.trails.get(b.id);
      if (!trail) this.trails.set(b.id, (trail = []));
      trail.push({ x: b.x, y: b.y });
      if (trail.length > TRAIL_LENGTH) trail.shift();
      if (b.kind === 'star' || s.gm === 0) continue;
      const angle = Math.atan2(b.y - s.y, b.x - s.x);
      const lap = this.laps.get(b.id);
      if (!lap) {
        this.laps.set(b.id, { last: angle, turned: 0, laps: 0 });
        continue;
      }
      let d = angle - lap.last;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      lap.turned += d;
      lap.last = angle;
      const laps = Math.floor(Math.abs(lap.turned) / (2 * Math.PI));
      if (laps > lap.laps) {
        lap.laps = laps;
        if (LAP_POPUPS.has(laps) && this.onScreen(b, 0)) {
          this.popup(b.x, b.y - b.r - 10, pick(TEXT).years(laps), `hsl(${b.hue}, 85%, 75%)`);
          sound.play('ding', { volume: 0.5 });
        }
      }
    }
    for (const f of this.poofs) f.t += dt;
    this.poofs = this.poofs.filter((f) => f.t < 0.8);
    if (this.launched) this.hintAlpha = Math.max(0, this.hintAlpha - dt / 1.5);
  }

  // ---- drawing ----

  private drawStarfield(ctx: CanvasRenderingContext2D): void {
    for (const s of this.stars) {
      ctx.globalAlpha = s.a;
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;
  }

  private drawToy(ctx: CanvasRenderingContext2D): void {
    const world = this.world;
    const u = this.unit;

    // Trails, fading towards their tails.
    const CHUNKS = 6;
    for (const b of world.bodies) {
      const trail = this.trails.get(b.id);
      if (!trail || trail.length < 2 || b.kind === 'star' && b.sun) continue;
      const n = trail.length;
      for (let c = 0; c < CHUNKS; c++) {
        const i0 = Math.floor((c * (n - 1)) / CHUNKS);
        const i1 = Math.floor(((c + 1) * (n - 1)) / CHUNKS);
        if (i1 <= i0) continue;
        ctx.beginPath();
        ctx.moveTo(trail[i0].x, trail[i0].y);
        for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(trail[i].x, trail[i].y);
        ctx.strokeStyle = `hsla(${b.hue}, 80%, 70%, ${(0.55 * (c + 1)) / CHUNKS})`;
        ctx.lineWidth = Math.max(1.5, 2.5 * u);
        ctx.stroke();
      }
    }

    // Stars first (under the planets), then planets lit from the nearest star.
    const starBodies = world.bodies.filter((b) => b.kind === 'star');
    for (const b of starBodies) drawStar(ctx, b.x, b.y, b.r, b.hue, Math.sin(this.time * 2 + b.id));
    for (const b of world.bodies) {
      if (b.kind === 'star') continue;
      const light = this.nearestStar(b.x, b.y, starBodies);
      drawPlanet(ctx, b.x, b.y, b.r, b.hue, light.x, light.y, b.kind === 'giant');
    }

    for (const f of this.poofs) {
      const k = f.t / 0.8;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r + k * 70 * u, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${f.hue}, 90%, 75%, ${0.8 * (1 - k)})`;
      ctx.lineWidth = 4 * u;
      ctx.stroke();
      if (k < 0.25) {
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * 1.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 247, 214, ${0.8 * (1 - k / 0.25)})`;
        ctx.fill();
      }
    }

    this.drawEdgeArrows(ctx);

    if (this.drag) {
      this.drawForecast(ctx, this.drag);
    } else if (this.pointer.inside && this.pointer.mouse && !this.hoveredBody()) {
      // The next body, waiting at the cursor.
      ctx.globalAlpha = 0.45;
      this.drawGhost(ctx, this.pointer.x, this.pointer.y);
      ctx.globalAlpha = 1;
    }

    if (this.hintAlpha > 0) {
      ctx.globalAlpha = this.hintAlpha;
      label(ctx, pick(TEXT).dragHint, this.w / 2, 74, 20, 'rgba(238, 242, 255, 0.9)');
      ctx.globalAlpha = 1;
    }
  }

  private nearestStar(x: number, y: number, stars: Body[]): { x: number; y: number } {
    let best = { x: this.w / 2, y: this.h / 2 };
    let bd = Infinity;
    for (const s of stars) {
      const d = (s.x - x) ** 2 + (s.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  private hoveredBody(): Body | null {
    for (const b of this.world.bodies) {
      if (!b.sun && Math.hypot(b.x - this.pointer.x, b.y - this.pointer.y) < b.r + 10 * this.unit) return b;
    }
    return null;
  }

  private drawGhost(ctx: CanvasRenderingContext2D, x: number, y: number, body?: Body): void {
    const kind = body?.kind ?? this.kind;
    const r = body?.r ?? KINDS[kind].r * this.unit;
    const hue = body?.hue ?? this.nextHue;
    if (kind === 'star') drawStar(ctx, x, y, r, hue);
    else {
      const light = this.nearestStar(x, y, this.world.bodies.filter((b) => b.kind === 'star'));
      drawPlanet(ctx, x, y, r, hue, light.x, light.y, kind === 'giant');
    }
  }

  /** Arrows at the screen edge for bodies out of view, so a huge orbit is known to come back. */
  private drawEdgeArrows(ctx: CanvasRenderingContext2D): void {
    const m = 22 * this.unit;
    const cx = this.w / 2;
    const cy = this.h / 2;
    for (const b of this.world.bodies) {
      if (this.onScreen(b, 0)) continue;
      const dx = b.x - cx;
      const dy = b.y - cy;
      const t = Math.min((cx - m) / Math.abs(dx || 1e-9), (cy - m) / Math.abs(dy || 1e-9));
      const x = cx + dx * t;
      const y = cy + dy * t;
      const a = Math.atan2(dy, dx);
      const dist = Math.hypot(b.x - x, b.y - y);
      const size = clamp(14 * this.unit * (1 - dist / (3 * Math.max(this.w, this.h))), 6, 14 * this.unit);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.lineTo(-size * 0.7, -size * 0.7);
      ctx.lineTo(-size * 0.7, size * 0.7);
      ctx.closePath();
      ctx.fillStyle = b.kind === 'star' ? `hsl(${b.hue}, 100%, 65%)` : `hsla(${b.hue}, 80%, 70%, 0.8)`;
      ctx.fill();
      ctx.restore();
    }
  }

  /** The 🔮 forecast: the world copied, the throw added, and all of it run ahead. */
  private drawForecast(ctx: CanvasRenderingContext2D, d: Drag): void {
    const v = this.launchVelocity(d, this.pointer);
    const copy = this.world.clone();
    const body = copy.add(this.thrown(d, v, d.grab ? undefined : -1));
    const limit = 2 * Math.max(this.w, this.h);
    const { pts, outcome } = forecast(copy, body.id, Math.round(FORECAST_SECONDS / TICK), FORECAST_EVERY, limit);
    const color = OUTCOME_COLOR[outcome];

    ctx.beginPath();
    ctx.moveTo(d.x0, d.y0);
    ctx.lineTo(this.pointer.x, this.pointer.y);
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (pts.length > 1) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts) ctx.lineTo(p.x, p.y);
      ctx.setLineDash([8, 8]);
      ctx.lineDashOffset = -this.time * 40;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3 * this.unit;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }
    if (outcome === 'crash' || outcome === 'merge') {
      const end = pts[pts.length - 1];
      const k = 8 * this.unit;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(end.x - k, end.y - k);
      ctx.lineTo(end.x + k, end.y + k);
      ctx.moveTo(end.x + k, end.y - k);
      ctx.lineTo(end.x - k, end.y + k);
      ctx.stroke();
    }

    this.drawGhost(ctx, d.x0, d.y0, d.grab ?? undefined);
    label(ctx, pick(TEXT).outcomeLabel[outcome], d.x0 + 16 * this.unit, d.y0 - 16 * this.unit, 16 * this.unit + 4, color, 'left');
  }

  private popup(x: number, y: number, text: string, color: string): void {
    this.popups.push({ x, y, text, color, age: 0 });
  }

  private drawPopups(ctx: CanvasRenderingContext2D, dt: number): void {
    const u = this.unit;
    for (const p of this.popups) {
      p.age += dt;
      ctx.globalAlpha = Math.max(0, 1 - p.age / 1.4);
      label(ctx, p.text, p.x, p.y - 40 * p.age * u, 20 * u + 6, p.color);
    }
    ctx.globalAlpha = 1;
    this.popups = this.popups.filter((p) => p.age < 1.4);
  }

  // ---- challenge ----

  private roundHost(): RoundHost {
    return {
      area: () => this.area(),
      unit: () => this.unit,
      hint: (text) => {
        if (this.hint.textContent !== text) this.hint.textContent = text;
      },
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
    this.challenge?.card?.remove();
    if (this.drag?.grab) this.world.add(this.drag.grab);
    this.drag = null;
    this.popups = [];
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
  }

  private finishChallenge(): void {
    const ch = this.challenge;
    if (!ch) return;
    ch.card?.remove();
    ch.card = null;
    const T = pick(TEXT);
    this.flow = scoreFlow({
      gameId: 'orbits',
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
    this.popups = [];
    this.gameBar.classList.add('hidden');
    this.toyBar.classList.remove('hidden');
    this.toggle.element.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.hint.textContent = '';
  }

  private updateHud(ch: Challenge): void {
    const T = pick(TEXT);
    const parts = [ch.round.title, ch.round.hud()];
    if (ROUNDS.length > 1) parts.unshift(T.round(ch.index + 1, ROUNDS.length));
    if (ch.total + ch.round.score > 0) parts.push(`⭐ ${fmtNumber(ch.total + (ch.card ? 0 : ch.round.score))}`);
    const text = parts.join('   ·   ');
    if (this.hud.textContent !== text) this.hud.textContent = text;
  }

  // ---- UI ----

  private makeButton(bar: HTMLElement, def: ButtonDef): HTMLButtonElement {
    const button = toolButton(def.emoji, def.label);
    button.addEventListener('click', def.onClick);
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

  private setKind(kind: Kind): void {
    this.kind = kind;
    this.nextHue = newHue(kind);
    for (const [k, b] of this.kindButtons) b.classList.toggle('active', k === kind);
  }

  private buildUi(): void {
    const T = pick(TEXT);
    this.toyBar = document.createElement('div');
    this.toyBar.className = 'game-toolbar';
    for (const kind of KIND_ORDER) {
      this.kindButtons.set(kind, this.makeButton(this.toyBar, { emoji: KIND_EMOJI[kind], label: T.kinds[kind], onClick: () => this.setKind(kind) }));
    }
    this.setKind('planet');
    this.makeButton(this.toyBar, { emoji: '🧹', label: T.clear, onClick: () => this.seed() });
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

  private openDelve(): void {
    if (this.delve) return;
    if (this.drag?.grab) this.world.add(this.drag.grab);
    this.drag = null;
    this.delve = delvePanel({
      heading: pick(TEXT).delveHeading,
      chapters: orbitsDelve({
        getIntegrator: () => this.demos.integrator,
        setIntegrator: (kind) => {
          this.demos.integrator = kind;
          this.demos.reset(3);
        },
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

export const orbits: ArcadeGame = {
  id: 'orbits',
  title: { en: 'Gravity Doodle', nl: 'Zwaartekracht-doodle', no: 'Tyngdekraft-doodle' },
  scienceLine: {
    en: "Newton's law of gravity is 340 years old, but for three planets it has no formula: the only way to see their future is to compute it. That is how space missions are planned, and how we check that asteroids will miss us.",
    nl: 'De zwaartekrachtwet van Newton is 340 jaar oud, maar voor drie planeten bestaat er geen formule: hun toekomst zie je alleen door hem uit te rekenen. Zo worden ruimtemissies gepland, en zo controleren we dat planetoïden ons missen.',
    no: 'Newtons gravitasjonslov er 340 år gammel, men for tre planeter finnes det ingen formel: den eneste måten å se fremtiden deres på er å regne den ut. Slik planlegges romferder, og slik sjekker vi at asteroider bommer på oss.',
  },
  tileEmoji: '🪐',
  create: (host) => new OrbitsInstance(host),
};
