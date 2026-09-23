import type { ArcadeGame, GameHost, GameInstance } from '../../shell/types';
import { pick } from '../../lib/i18n';
import { scoreFlow, type ScoreFlowHandle } from '../../shell/scoreflow';
import { GRID_W as W, GRID_H as H } from './water';
import {
  BUDGET, DIKE_X, HOMES, PUMP, ROUND, ROUND_LENGTH, SAND_RATE, STORM_LENGTH, TIME_SCALE,
  CALM_SEA, countBits, floodedHomes, homeSpillLevels, makeScene, placeSand, resetWater, sandPlan, seaLevelAt, spillLevel, type Point,
} from './scene';
import { LiveRecording } from './recording';
import { text } from './text';
import './style.css';

type Mode = 'toy' | 'intro' | 'round' | 'result' | 'replay';
interface Puff { x: number; y: number; vx: number; vy: number; life: number }
/** A foam ring from a splash, spreading at the shallow-water wave speed. */
interface Ring { x: number; y: number; age: number }

class FloodInstance implements GameInstance {
  private mode: Mode = 'toy';
  private sim = makeScene();
  /** The untouched landscape: sand shows above it, scars below it. */
  private base = this.sim.terrain.slice();
  /** Displayed seconds since the free play or the round began. */
  private time = 0;
  private stormStart: number | null = null;
  private budget = BUDGET;
  private flooded = 0;
  private spill = spillLevel(this.sim.terrain);
  private spillAge = 0;
  private recording: LiveRecording | null = null;
  private replayTime = 0;
  private replayPlaying = true;
  private model = false;
  private holding = false;
  private splashTimer = 0;
  private pointer: Point | null = null;
  private plan = new Map<number, number>();
  private puffs: Puff[] = [];
  private rings: Ring[] = [];
  private banner = 0;
  private breachRows = new Set<number>();
  private ctx!: CanvasRenderingContext2D;
  private transform = { scale: 1, ox: 0, oy: 0 };
  private bars: Record<'toy' | 'round' | 'replay', HTMLElement> = {} as never;
  private buttons: Record<string, HTMLButtonElement> = {};
  private hud!: HTMLElement;
  private hint!: HTMLElement;
  private inspection!: HTMLElement;
  private message!: HTMLElement;
  private timeline!: HTMLInputElement;
  private card: HTMLElement | null = null;
  private flow: ScoreFlowHandle | null = null;

  constructor(private host: GameHost) {}

  private down = (e: PointerEvent) => {
    if (!e.isPrimary || e.button !== 0 || this.holding) return;
    if (this.mode !== 'toy' && this.mode !== 'round') return;
    const p = this.hit(e);
    if (!p) return;
    this.pointer = p;
    this.host.canvas.setPointerCapture(e.pointerId);
    this.holding = true;
    this.splashTimer = 0;
    // A quick tap acts at once: a splash, or a thin first layer of sand.
    this.interact(1 / 30, p);
  };
  private move = (e: PointerEvent) => {
    if (!e.isPrimary) return;
    this.pointer = this.hit(e);
  };
  private release = () => { this.holding = false; };
  private leave = () => { if (!this.holding) this.pointer = null; };

  start(): void {
    this.ctx = this.host.canvas.getContext('2d')!;
    this.host.canvas.style.touchAction = 'none';
    this.host.canvas.setAttribute('aria-label', pick(floodland.title));
    this.buildUi();
    const c = this.host.canvas;
    c.addEventListener('pointerdown', this.down);
    c.addEventListener('pointermove', this.move);
    c.addEventListener('pointerup', this.release);
    c.addEventListener('pointercancel', this.release);
    c.addEventListener('lostpointercapture', this.release);
    c.addEventListener('pointerleave', this.leave);
    window.addEventListener('blur', this.release);
    this.enterToy();
  }

  destroy(): void {
    const c = this.host.canvas;
    c.removeEventListener('pointerdown', this.down);
    c.removeEventListener('pointermove', this.move);
    c.removeEventListener('pointerup', this.release);
    c.removeEventListener('pointercancel', this.release);
    c.removeEventListener('lostpointercapture', this.release);
    c.removeEventListener('pointerleave', this.leave);
    window.removeEventListener('blur', this.release);
    this.flow?.dispose();
    this.recording = null;
  }

  // ---- UI ----

  private buildUi(): void {
    const t = text();
    const add = (bar: HTMLElement, key: string, emoji: string, label: string, onClick: () => void) => {
      const b = document.createElement('button');
      b.className = 'tool-button';
      const icon = document.createElement('span'); icon.className = 'tool-emoji'; icon.textContent = emoji;
      const name = document.createElement('span'); name.className = 'tool-label'; name.textContent = label;
      b.append(icon, name);
      b.addEventListener('pointerdown', e => e.stopPropagation());
      b.addEventListener('click', () => { onClick(); this.updateUi(); });
      bar.appendChild(b); this.buttons[key] = b;
      return b;
    };
    const bar = () => { const b = document.createElement('div'); b.className = 'game-toolbar delta-toolbar'; return b; };
    this.bars.toy = bar(); this.bars.round = bar(); this.bars.replay = bar();
    add(this.bars.toy, 'storm', '🌊', t.storm, () => { this.stormStart = this.time; });
    add(this.bars.toy, 'model', '🔢', t.computer, () => { this.model = !this.model; });
    add(this.bars.toy, 'reset', '🧹', t.startOver, () => this.enterToy());
    add(this.bars.toy, 'challenge', '🏆', t.challenge, () => this.enterIntro());
    add(this.bars.round, 'roundModel', '🔢', t.computer, () => { this.model = !this.model; });
    add(this.bars.round, 'stop', '⏹', t.stop, () => this.enterToy());
    this.timeline = document.createElement('input');
    this.timeline.type = 'range'; this.timeline.min = '0'; this.timeline.step = '0.01';
    this.timeline.className = 'delta-scrubber';
    this.timeline.setAttribute('aria-label', t.scrub);
    this.timeline.addEventListener('pointerdown', e => e.stopPropagation());
    this.timeline.addEventListener('input', () => { this.replayPlaying = false; this.seek(Number(this.timeline.value)); this.updateUi(); });
    const scrubber = document.createElement('div'); scrubber.className = 'delta-scrub-row';
    scrubber.append(this.timeline);
    this.bars.replay.append(scrubber);
    add(this.bars.replay, 'playPause', '⏸', t.pause, () => {
      if (!this.recording) return;
      if (this.replayTime >= this.recording.duration) this.seek(0);
      this.replayPlaying = !this.replayPlaying;
    });
    add(this.bars.replay, 'replayAgain', '🏆', t.playAgain, () => this.enterIntro());
    add(this.bars.replay, 'replayDone', '⏹', t.freePlay, () => this.enterToy());
    this.hud = document.createElement('div'); this.hud.className = 'challenge-hud delta-hud';
    this.hint = document.createElement('p'); this.hint.className = 'challenge-hint delta-hint';
    this.inspection = document.createElement('p'); this.inspection.className = 'delta-inspection';
    this.message = document.createElement('div'); this.message.className = 'delta-banner'; this.message.textContent = `⚠️ ${t.breach}`;
    this.host.overlay.append(this.bars.toy, this.bars.round, this.bars.replay, this.hud, this.hint, this.inspection, this.message);
  }

  private updateUi(): void {
    const t = text();
    for (const [key, bar] of Object.entries(this.bars)) bar.hidden = key !== (this.mode === 'intro' || this.mode === 'result' ? '' : this.mode);
    this.buttons.storm.disabled = this.stormStart !== null;
    for (const key of ['model', 'roundModel']) {
      this.buttons[key].querySelector('.tool-label')!.textContent = this.model ? t.landscape : t.computer;
      this.buttons[key].querySelector('.tool-emoji')!.textContent = this.model ? '🏡' : '🔢';
    }
    if (this.mode === 'replay' && this.recording) {
      const done = this.replayTime >= this.recording.duration;
      const playing = this.replayPlaying && !done;
      this.buttons.playPause.querySelector('.tool-emoji')!.textContent = playing ? '⏸' : '▶️';
      this.buttons.playPause.querySelector('.tool-label')!.textContent = playing ? t.pause : t.play;
      this.timeline.max = String(this.recording.duration);
      this.timeline.value = String(this.replayTime);
      this.timeline.style.setProperty('--progress', `${100 * this.replayTime / Math.max(1e-6, this.recording.duration)}%`);
    }
    const showHud = this.mode === 'round' || this.mode === 'replay';
    this.hud.hidden = !showHud;
    if (showHud) {
      const dry = HOMES.length - countBits(this.flooded);
      const left = this.mode === 'round' ? Math.max(0, Math.ceil(ROUND_LENGTH - this.time)) : Math.max(0, Math.ceil(ROUND_LENGTH - this.replayTime));
      this.hud.replaceChildren(
        this.hudItem('🏠', `${dry}/${HOMES.length}`, t.homes, this.flooded ? 'bad' : ''),
        this.hudSand(),
        this.hudItem('⏱', `${left}`, t.time, ''),
      );
    }
    let hint = '';
    if (this.mode === 'toy') hint = this.stormStart === null ? t.toyHint : t.toyStormHint;
    if (this.mode === 'round') {
      hint = this.time < ROUND.warning ? t.warning(Math.ceil(ROUND.warning - this.time))
        : this.time > ROUND.warning + STORM_LENGTH ? (this.spill < CALM_SEA ? t.holeHint : t.calmHint) : t.roundHint;
    }
    if (this.mode === 'replay') hint = t.scrub;
    this.hint.textContent = hint;
    this.hint.hidden = !hint;
    this.message.classList.toggle('show', this.banner > 0);
    const p = this.pointer;
    if (this.model && p && this.mode !== 'intro' && this.mode !== 'result') {
      const i = Math.floor(p.y) * W + Math.floor(p.x), h = this.sim.water[i];
      const speed = h > 1e-3 ? Math.hypot(this.sim.mx[i], this.sim.my[i]) / h : 0;
      this.inspection.textContent = `${t.ground} ${this.sim.terrain[i].toFixed(2)} m · ${t.depth} ${h.toFixed(2)} m · ${t.speed} ${speed.toFixed(1)} m/s`;
    } else this.inspection.textContent = '';
    this.inspection.hidden = !this.inspection.textContent;
  }
  private hudItem(emoji: string, value: string, label: string, tone: string): HTMLElement {
    const item = document.createElement('span'); item.className = `delta-hud-item ${tone}`;
    item.title = label;
    item.textContent = `${emoji} ${value}`;
    return item;
  }
  private hudSand(): HTMLElement {
    const item = document.createElement('span'); item.className = 'delta-hud-item';
    item.title = text().sand;
    const bar = document.createElement('span'); bar.className = 'delta-sand-bar';
    const fill = document.createElement('span'); fill.style.width = `${100 * this.budget / BUDGET}%`;
    bar.append(fill);
    item.append('🟨 ', bar, ` ${Math.floor(this.budget)}`);
    return item;
  }

  // ---- modes ----

  private clearCards(): void {
    this.card?.remove(); this.card = null;
    this.flow?.dispose(); this.flow = null;
  }
  private freshScene(): void {
    this.sim = makeScene(); this.base = this.sim.terrain.slice();
    this.spill = spillLevel(this.sim.terrain);
    this.time = 0; this.stormStart = null; this.flooded = 0; this.budget = BUDGET;
    this.holding = false; this.plan.clear(); this.puffs = []; this.rings = []; this.banner = 0; this.breachRows.clear();
  }
  private enterToy(): void {
    this.clearCards();
    this.freshScene();
    this.recording = null;
    this.mode = 'toy';
    this.updateUi();
  }
  private enterIntro(): void {
    this.clearCards();
    this.freshScene();
    this.recording = null;
    this.mode = 'intro';
    const t = text();
    const card = document.createElement('div'); card.className = 'score-flow delta-card';
    const heading = document.createElement('h2'); heading.textContent = `🌊 ${t.introTitle}`;
    const body = document.createElement('p'); body.textContent = t.introText;
    const actions = document.createElement('div'); actions.className = 'score-flow-actions';
    const go = document.createElement('button'); go.className = 'arcade-button'; go.textContent = t.go;
    go.addEventListener('click', () => this.enterRound());
    actions.append(go);
    card.append(heading, body, actions);
    this.card = card;
    this.host.overlay.append(card);
    this.updateUi();
    go.focus();
  }
  private enterRound(): void {
    this.clearCards();
    this.freshScene();
    this.mode = 'round';
    this.stormStart = ROUND.warning;
    this.recording = new LiveRecording(W * H, ROUND_LENGTH + 1);
    this.recording.capture(0, this.sim, 0);
    this.updateUi();
  }
  private finishRound(): void {
    this.mode = 'result';
    this.holding = false; this.plan.clear();
    const t = text();
    // A breach cut below the calm sea keeps letting it in: those homes are lost too.
    homeSpillLevels(this.sim.terrain).forEach((level, k) => { if (level < CALM_SEA) this.flooded |= 1 << k; });
    const dry = HOMES.length - countBits(this.flooded);
    const sand = Math.floor(this.budget);
    const score = dry * 100 + sand;
    this.flow = scoreFlow({
      gameId: 'floodland',
      heading: t.resultHeading(dry, HOMES.length),
      score,
      scoreLabel: t.points(score),
      actions: [
        { label: `🏆 ${t.playAgain}`, onClick: () => this.enterIntro() },
        { label: `⏪ ${t.watchAgain}`, onClick: () => this.enterReplay() },
        { label: `🌊 ${t.freePlay}`, onClick: () => this.enterToy() },
      ],
    });
    const breakdown = document.createElement('p'); breakdown.className = 'delta-breakdown';
    breakdown.textContent = t.breakdown(dry, sand);
    this.flow.element.querySelector('.score-flow-score')?.after(breakdown);
    this.host.overlay.appendChild(this.flow.element);
    this.updateUi();
  }
  private enterReplay(): void {
    this.clearCards();
    this.mode = 'replay';
    this.replayPlaying = true;
    this.seek(0);
    this.updateUi();
  }
  private seek(time: number): void {
    if (!this.recording) return;
    this.replayTime = Math.max(0, Math.min(this.recording.duration, time));
    this.flooded = this.recording.restore(this.replayTime, this.sim);
    this.spill = spillLevel(this.sim.terrain);
  }

  // ---- simulation ----

  frame(rawDt: number): void {
    const dt = Math.min(rawDt, .05);
    this.banner = Math.max(0, this.banner - dt);
    for (const p of this.puffs) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; p.life -= dt * 2; }
    this.puffs = this.puffs.filter(p => p.life > 0);
    for (const r of this.rings) r.age += dt;
    this.rings = this.rings.filter(r => r.age < 1.2);
    if (this.mode === 'replay') {
      if (this.replayPlaying && this.recording) {
        this.seek(this.replayTime + dt);
        if (this.replayTime >= this.recording.duration) this.replayPlaying = false;
      }
    } else if (this.mode !== 'intro') this.live(dt);
    this.preview();
    this.updateUi();
    this.draw();
  }

  private live(dt: number): void {
    this.time += dt;
    const building = this.mode === 'toy' || this.mode === 'round';
    if (building && this.holding && this.pointer) this.interact(dt, this.pointer);
    if (this.mode === 'toy' && this.stormStart !== null && this.time - this.stormStart > STORM_LENGTH) this.stormStart = null;
    this.sim.seaLevel = seaLevelAt(this.time, this.stormStart);
    try {
      this.sim.advance(dt * TIME_SCALE);
    } catch (error) {
      // Kiosk safety: never freeze on a numerical failure; keep the landscape.
      console.error(error);
      resetWater(this.sim);
    }
    const now = floodedHomes(this.sim);
    this.flooded = this.mode === 'toy' ? now : this.flooded | now;
    this.watchForBreaches();
    this.spillAge += dt;
    if (this.spillAge > .2) { this.spillAge = 0; this.spill = spillLevel(this.sim.terrain); }
    if (this.mode === 'round') {
      this.recording?.capture(this.time, this.sim, this.flooded);
      if (this.time >= ROUND_LENGTH) this.finishRound();
    }
  }

  private interact(dt: number, p: Point): void {
    const i = Math.floor(p.y) * W + Math.floor(p.x);
    if (this.mode === 'toy' && p.x < DIKE_X[0] && this.sim.water[i] > .3) {
      this.splashTimer -= dt;
      if (this.splashTimer <= 0) {
        this.sim.splash(p.x, p.y, 1.4, 2);
        this.rings.push({ x: p.x, y: p.y, age: 0 });
        this.splashTimer = .25;
      }
      return;
    }
    const budget = this.mode === 'toy' ? Infinity : this.budget;
    const used = placeSand(this.sim, [p], SAND_RATE * dt, budget);
    if (this.mode === 'round') this.budget = Math.max(0, this.budget - used);
    if (used > 0) {
      const z = this.sim.terrain[i];
      const s = this.project(p.x, p.y, z);
      for (let k = 0; k < 2; k++) {
        this.puffs.push({ x: s.x + (Math.random() - .5) * 14, y: s.y, vx: (Math.random() - .5) * 50, vy: -30 - Math.random() * 40, life: 1 });
      }
    }
  }

  /** A banner when the old dike starts to give way somewhere new. */
  private watchForBreaches(): void {
    for (let y = 0; y < H; y++) {
      if (this.breachRows.has(y)) continue;
      for (let x = DIKE_X[0]; x <= DIKE_X[1]; x++) {
        const i = y * W + x;
        if (this.sim.wear[i] > 0 && this.sim.terrain[i] < this.base[i] - .4) {
          for (let dy = -3; dy <= 3; dy++) this.breachRows.add(y + dy);
          this.banner = 2.2;
          break;
        }
      }
    }
  }

  private preview(): void {
    const building = (this.mode === 'toy' || this.mode === 'round') && this.pointer && !this.holding;
    if (!building) { this.plan = new Map(); return; }
    const p = this.pointer!;
    const i = Math.floor(p.y) * W + Math.floor(p.x);
    const splash = this.mode === 'toy' && p.x < DIKE_X[0] && this.sim.water[i] > .3;
    this.plan = splash ? new Map() : sandPlan(this.sim, [p], .2);
  }

  // ---- drawing ----

  private project(x: number, y: number, z = 0): Point {
    return this.model ? { x: x * 13, y: y * 13 } : { x: x * 12 - y * 8, y: x * 3.4 + y * 7 - z * 11 };
  }
  private hit(e: PointerEvent): Point | null {
    const r = this.host.canvas.getBoundingClientRect(), { scale, ox, oy } = this.transform;
    const px = (e.clientX - r.left - ox) / scale, py = (e.clientY - r.top - oy) / scale;
    const snap = (wx: number) => wx >= DIKE_X[0] + .5 && wx <= DIKE_X[1] + .5 ? (DIKE_X[0] + DIKE_X[1] + 1) / 2 : wx;
    if (this.model) {
      const x = px / 13, y = py / 13;
      return x >= 0 && x < W && y >= 0 && y < H ? { x: snap(x), y } : null;
    }
    // Match the visible faces in reverse draw order: the top of each column, then
    // its front and right walls (the sides of a dike or a sand pile are clickable too).
    const t = this.sim.terrain;
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x, z = t[i];
      const yy = py + z * 11;
      const wx = (7 * px + 8 * yy) / 111.2, wy = (12 * yy - 3.4 * px) / 111.2;
      if (wx >= x && wx < x + 1 && wy >= y && wy < y + 1) return { x: snap(wx), y: wy };
      const front = y < H - 1 ? t[i + W] : -5;
      const fx = (px + 8 * (y + 1)) / 12, fz = (3.4 * fx + 7 * (y + 1) - py) / 11;
      if (z > front && fx >= x && fx < x + 1 && fz >= front && fz <= z) return { x: snap(fx), y: y + .99 };
      const right = x < W - 1 ? t[i + 1] : -5;
      const ry = (12 * (x + 1) - px) / 8, rz = (3.4 * (x + 1) + 7 * ry - py) / 11;
      if (z > right && ry >= y && ry < y + 1 && rz >= right && rz <= z) return { x: snap(x + .99), y: ry };
    }
    return null;
  }
  private poly(points: Point[], fill: string, stroke?: string): void {
    const c = this.ctx; c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.fillStyle = fill; c.fill();
    c.strokeStyle = stroke || fill; c.lineWidth = .5; c.stroke();
  }
  private tile(x: number, y: number, z: number, fill: string, stroke?: string): void {
    this.poly([this.project(x, y, z), this.project(x + 1, y, z), this.project(x + 1, y + 1, z), this.project(x, y + 1, z)], fill, stroke);
  }
  private house(x: number, y: number, wet: boolean, school: boolean, glow: boolean): void {
    const z = this.sim.terrain[y * W + x], p = this.project(x + .5, y + .5, z), c = this.ctx;
    if (this.model) { c.strokeStyle = wet ? '#ff8f7a' : '#f9eed2'; c.lineWidth = 2.5; c.strokeRect(p.x - 6, p.y - 6, 12, 12); return; }
    const w = school ? 17 : 12, h = school ? 26 : 20;
    const depth = this.sim.water[y * W + x];
    if (glow) {
      const g = c.createRadialGradient(p.x, p.y - h / 2, 2, p.x, p.y - h / 2, 34);
      g.addColorStop(0, '#ffe79a90'); g.addColorStop(1, '#ffe79a00');
      c.fillStyle = g; c.fillRect(p.x - 36, p.y - h / 2 - 36, 72, 72);
    }
    c.save();
    c.beginPath(); c.rect(p.x - 40, p.y - 80, 80, 86 - depth * 11); c.clip();
    this.poly([{ x: p.x - w, y: p.y - h }, { x: p.x, y: p.y - h + 6 }, { x: p.x, y: p.y + 6 }, { x: p.x - w, y: p.y }], wet ? '#8ca3a4' : '#eee1c3');
    this.poly([{ x: p.x, y: p.y - h + 6 }, { x: p.x + w, y: p.y - h }, { x: p.x + w, y: p.y }, { x: p.x, y: p.y + 6 }], wet ? '#64858b' : '#bcbaaa');
    this.poly([{ x: p.x - w - 2, y: p.y - h }, { x: p.x - 1, y: p.y - h - 12 }, { x: p.x + w + 2, y: p.y - h }, { x: p.x, y: p.y - h + 7 }], wet ? '#a16c57' : '#c46e4e');
    c.fillStyle = wet ? '#74c8df' : '#fff3b4'; c.fillRect(p.x + 4, p.y - h + 9, 4, 6);
    c.restore();
    if (wet && depth > .05) { c.strokeStyle = '#9ce7f4'; c.lineWidth = 1; c.beginPath(); c.ellipse(p.x, p.y + 3 - depth * 11, 17, 6, 0, 0, Math.PI * 2); c.stroke(); }
    if (wet) { c.font = '16px system-ui'; c.textAlign = 'center'; c.fillText('🆘', p.x, p.y - h - 16); }
  }

  private draw(): void {
    const c = this.ctx, dpr = this.host.dpr;
    const width = this.host.canvas.width / dpr, height = this.host.canvas.height / dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = c.createLinearGradient(0, 0, 0, height); bg.addColorStop(0, '#15333e'); bg.addColorStop(1, '#091c28'); c.fillStyle = bg; c.fillRect(0, 0, width, height);
    const narrow = width < 700;
    const gauge = narrow ? 0 : 110;
    const top = narrow ? 70 : 78, bottom = height - (narrow ? 120 : 150);
    const worldW = this.model ? W * 13 : W * 12 + H * 8;
    const worldH = this.model ? H * 13 : W * 3.4 + H * 7 + 100;
    const scale = Math.max(.15, Math.min((width - gauge - 40) / worldW, (bottom - top) / worldH));
    const ox = gauge + (width - gauge - worldW * scale) / 2 + (this.model ? 0 : H * 8 * scale);
    const oy = top + Math.max(0, (bottom - top - worldH * scale) / 2) + (this.model ? 0 : 45 * scale);
    this.transform = { scale, ox, oy }; c.translate(ox, oy); c.scale(scale, scale);
    const { terrain, water } = this.sim;
    const hardTop = this.sim.erosion!.hardTop;
    const pulse = .5 + .5 * Math.sin(performance.now() / 90);
    if (!this.model) {
      // The exposed earth makes the below-sea-level polder legible.
      for (let x = 0; x < W; x++) this.poly([this.project(x, H, terrain[(H - 1) * W + x]), this.project(x + 1, H, terrain[(H - 1) * W + x]), this.project(x + 1, H, -5), this.project(x, H, -5)], x % 3 ? '#80694d' : '#8d7555');
      for (let y = 0; y < H; y++) this.poly([this.project(W, y, terrain[y * W + W - 1]), this.project(W, y + 1, terrain[y * W + W - 1]), this.project(W, y + 1, -5), this.project(W, y, -5)], '#554e3b');
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, z = terrain[i], h = water[i];
      const sand = z > hardTop[i] + .01;
      const scar = z < this.base[i] - .05;
      const field = (Math.floor(x / 6) + Math.floor(y / 5)) % 3;
      let land = z < -1 ? '#b8b18a' : z > 1 ? '#91aa67' : ['#78935d', '#889f65', '#718c58'][field];
      if (scar) land = '#8a6a45';
      if (sand) land = '#d9b86e';
      if (this.model) land = sand ? '#b8a76c' : scar ? '#6e5438' : z > 1 ? '#62715e' : '#354d45';
      if (!this.model) {
        const front = y < H - 1 ? terrain[i + W] : z;
        const right = x < W - 1 ? terrain[i + 1] : z;
        if (z > front) this.poly([this.project(x, y + 1, z), this.project(x + 1, y + 1, z), this.project(x + 1, y + 1, front), this.project(x, y + 1, front)], sand ? '#a48b50' : scar ? '#6d5236' : '#667d49');
        if (z > right) this.poly([this.project(x + 1, y, z), this.project(x + 1, y + 1, z), this.project(x + 1, y + 1, right), this.project(x + 1, y, right)], sand ? '#b29858' : scar ? '#7a5c3d' : '#819358');
      }
      this.tile(x, y, z, land, this.model ? '#ffffff25' : undefined);
      if (h > .012) {
        const deep = Math.min(1, h / 3);
        const opacity = Math.min(1, h / .18);
        // Light the surface by its slope, so waves and splashes show as bright and dark bands.
        const eta = z + h;
        const etaFront = y < H - 1 && water[i + W] > .012 ? terrain[i + W] + water[i + W] : eta;
        const etaRight = x < W - 1 && water[i + 1] > .012 ? terrain[i + 1] + water[i + 1] : eta;
        const light = Math.max(-.3, Math.min(.45, (2 * eta - etaFront - etaRight) * 1.4));
        const shade = (base: number) => Math.round(light > 0 ? base + (255 - base) * light : base * (1 + light));
        const waterColor = `rgba(${shade(64 - 35 * deep)},${shade(167 - 64 * deep)},${shade(178 - 43 * deep)},${opacity})`;
        if (!this.model) {
          // Join unequal neighbouring surfaces so a moving front has no cracks.
          const front = y < H - 1 ? Math.max(z, terrain[i + W] + water[i + W]) : z;
          const right = x < W - 1 ? Math.max(z, terrain[i + 1] + water[i + 1]) : z;
          if (z + h > front) this.poly([this.project(x, y + 1, z + h), this.project(x + 1, y + 1, z + h), this.project(x + 1, y + 1, front), this.project(x, y + 1, front)], waterColor);
          if (z + h > right) this.poly([this.project(x + 1, y, z + h), this.project(x + 1, y + 1, z + h), this.project(x + 1, y + 1, right), this.project(x + 1, y, right)], waterColor);
        }
        this.tile(x, y, z + h, waterColor, `rgba(180,241,243,${.29 * opacity})`);
        if ((x * 7 + y * 11) % 19 === 0 && !this.model) {
          const p = this.project(x + .2, y + .5, z + h); c.strokeStyle = '#b9eeef60'; c.lineWidth = .7; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + 7, p.y + 1); c.stroke();
        }
      }
      // The ground is washing away here: a pulsing red outline.
      if (this.sim.wear[i] > 2e-4) this.tile(x, y, z + h, `rgba(255,90,70,${.15 + .25 * pulse})`, `rgba(255,120,90,${.6 + .4 * pulse})`);
    }
    if (!this.model) {
      // Small lanes and trees give the polder a human scale without hiding flow.
      c.strokeStyle = '#c4bfa18a'; c.lineWidth = 2;
      c.beginPath();
      for (let x = 30; x <= 51; x++) { const p = this.project(x, 20, terrain[20 * W + x] + .03); if (x === 30) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y); }
      c.stroke();
      for (const [x, y] of [[30, 12], [47, 12], [52, 36], [31, 29], [55, 8], [54, 34]]) {
        const i = y * W + x; if (water[i] > .1) continue;
        const p = this.project(x, y, terrain[i]); c.fillStyle = '#6c6347'; c.fillRect(p.x - 1, p.y - 8, 2, 9);
        c.fillStyle = '#416952'; c.beginPath(); c.ellipse(p.x, p.y - 13, 5, 8, 0, 0, Math.PI * 2); c.fill();
      }
    }
    const calm = (this.mode === 'round' && this.time > ROUND.warning + STORM_LENGTH) || this.mode === 'result';
    HOMES.forEach(([x, y], k) => { const wet = (this.flooded & (1 << k)) !== 0; this.house(x, y, wet, k === 6, calm && !wet); });
    this.drawPump();
    if (!this.model) this.drawLevelPosts();
    if (!this.model) {
      const p = this.project(58, 10, 1), a0 = (this.mode === 'replay' ? this.replayTime : this.time) * 1.2;
      c.fillStyle = '#e2d6b8'; c.fillRect(p.x - 4, p.y - 23, 8, 25); c.strokeStyle = '#eee6cd'; c.lineWidth = 3;
      for (let k = 0; k < 4; k++) { const a = a0 + k * Math.PI / 2; c.beginPath(); c.moveTo(p.x, p.y - 20); c.lineTo(p.x + Math.cos(a) * 17, p.y - 20 + Math.sin(a) * 17); c.stroke(); }
    }
    if (this.pointer && this.model) { const { x, y } = this.pointer; this.tile(Math.floor(x), Math.floor(y), 0, '#ffffff22', '#fff'); }
    let cost = 0; for (const d of this.plan.values()) cost += d;
    const ghostColor = this.mode === 'toy' || cost <= this.budget ? '#ffdc8480' : '#ff736eaa';
    for (const [i, rise] of this.plan) {
      if (rise <= 0) continue;
      const x = i % W, y = Math.floor(i / W), z = terrain[i];
      if (!this.model) {
        this.poly([this.project(x, y + 1, z + rise), this.project(x + 1, y + 1, z + rise), this.project(x + 1, y + 1, z), this.project(x, y + 1, z)], ghostColor);
        this.poly([this.project(x + 1, y, z + rise), this.project(x + 1, y + 1, z + rise), this.project(x + 1, y + 1, z), this.project(x + 1, y, z)], ghostColor);
      }
      this.tile(x, y, z + rise, ghostColor, '#fff1bd');
    }
    // Final overlay pass: neighbouring water tiles and buildings cannot cover arrows.
    for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) {
      const i = y * W + x, z = terrain[i], h = water[i];
      if (h <= .035) continue;
      const u = this.sim.mx[i] / h, v = this.sim.my[i] / h, speed = Math.hypot(u, v);
      // In the landscape only real currents get arrows, not the gentle swell.
      if (speed <= (this.model ? .025 : .35)) continue;
      const len = Math.min(1.8, .6 + speed), p = this.project(x + .5, y + .5, z + h + .05), q = this.project(x + .5 + u / speed * len, y + .5 + v / speed * len, z + h + .05);
      const angle = Math.atan2(q.y - p.y, q.x - p.x);
      c.strokeStyle = '#efffff'; c.lineWidth = this.model ? 1.6 : 1.2; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.lineTo(q.x - 4 * Math.cos(angle - .5), q.y - 4 * Math.sin(angle - .5)); c.moveTo(q.x, q.y); c.lineTo(q.x - 4 * Math.cos(angle + .5), q.y - 4 * Math.sin(angle + .5)); c.stroke();
    }
    // Wave speed √(g·depth) in the 2.5 m sea, in cells per displayed second.
    const ringSpeed = Math.sqrt(9.81 * 2.5) * TIME_SCALE / 10;
    for (const r of this.rings) {
      const radius = .5 + r.age * ringSpeed, level = this.sim.seaLevel + .1;
      c.strokeStyle = `rgba(235,252,255,${.85 * (1 - r.age / 1.2)})`; c.lineWidth = 2.5 * (1 - r.age / 1.2) + .5;
      c.beginPath();
      for (let k = 0; k <= 48; k++) {
        const a = k / 48 * Math.PI * 2, gx = r.x + Math.cos(a) * radius, gy = r.y + Math.sin(a) * radius;
        const q = this.project(Math.max(0, Math.min(DIKE_X[0], gx)), Math.max(0, Math.min(H, gy)), level);
        if (k) c.lineTo(q.x, q.y); else c.moveTo(q.x, q.y);
      }
      c.stroke();
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const p of this.puffs) {
      const s = this.transform;
      c.fillStyle = `rgba(232,205,140,${Math.max(0, p.life) * .8})`;
      c.beginPath(); c.arc(s.ox + p.x * s.scale, s.oy + p.y * s.scale, 2.5 + (1 - p.life) * 4, 0, Math.PI * 2); c.fill();
    }
    if (gauge) this.drawGauge(34, top + 60, bottom - 10);
  }

  /** A tide gauge: the sea against the lowest point of the defenses. */
  private drawGauge(x: number, y0: number, y1: number): void {
    const c = this.ctx, t = text(), lo = -1, hi = 4;
    const yOf = (z: number) => y1 - (z - lo) / (hi - lo) * (y1 - y0);
    const sea = this.sim.seaLevel, over = sea > this.spill;
    c.fillStyle = '#0b202bcc'; c.strokeStyle = '#547079'; c.lineWidth = 1;
    c.beginPath(); c.roundRect(x - 4, y0 - 36, 64, y1 - y0 + 60, 12); c.fill(); c.stroke();
    c.fillStyle = '#183846'; c.fillRect(x + 8, y0, 24, y1 - y0);
    const seaY = yOf(Math.min(hi, Math.max(lo, sea)));
    const g = c.createLinearGradient(0, seaY, 0, y1); g.addColorStop(0, '#5ec2d4'); g.addColorStop(1, '#1f6f86');
    c.fillStyle = g; c.fillRect(x + 8, seaY, 24, y1 - seaY);
    c.font = '600 10px system-ui'; c.textAlign = 'right'; c.fillStyle = '#9fc3c3'; c.strokeStyle = '#9fc3c3';
    for (let m = 0; m <= hi; m++) {
      const yy = yOf(m); c.beginPath(); c.moveTo(x + 2, yy); c.lineTo(x + 8, yy); c.stroke();
      c.fillText(`${m}`, x + 1, yy + 3);
    }
    if (Number.isFinite(this.spill)) {
      const yy = yOf(Math.min(hi, this.spill));
      c.strokeStyle = over ? `rgba(255,110,90,${.6 + .4 * Math.sin(performance.now() / 90)})` : '#e5c579'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(x + 4, yy); c.lineTo(x + 36, yy); c.stroke();
      c.fillStyle = over ? '#ff8f7a' : '#e5c579';
      c.beginPath(); c.moveTo(x + 36, yy); c.lineTo(x + 46, yy - 7); c.lineTo(x + 46, yy + 7); c.closePath(); c.fill();
      c.save(); c.translate(x + 56, yy); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.font = '700 12px system-ui'; c.fillText(t.gaugeDike, 0, 0); c.restore();
    }
    c.textAlign = 'center'; c.fillStyle = '#eaf3ee'; c.font = '700 13px system-ui';
    c.fillText(`🌊 ${sea.toFixed(1)} m`, x + 24, y0 - 16);
    c.font = '600 10px system-ui'; c.fillStyle = '#9fc3c3'; c.fillText(t.gaugeSea, x + 20, y1 + 16);
  }

  private drawLevelPosts(): void {
    const c = this.ctx;
    for (const [x, y] of [[35, 25], [48, 16]]) {
      const i = y * W + x, z = this.sim.terrain[i], h = this.sim.water[i];
      const foot = this.project(x, y, z), top = this.project(x, y, z + 3);
      c.strokeStyle = '#f8eed1'; c.lineWidth = 2; c.beginPath(); c.moveTo(foot.x, foot.y); c.lineTo(top.x, top.y); c.stroke();
      for (let level = 0; level <= 3; level++) {
        const p = this.project(x, y, z + level); c.beginPath(); c.moveTo(p.x - 3, p.y); c.lineTo(p.x + 3, p.y); c.stroke();
      }
      const surface = this.project(x, y, z + h);
      c.strokeStyle = '#ffd585'; c.lineWidth = 3; c.beginPath(); c.moveTo(surface.x - 6, surface.y); c.lineTo(surface.x + 6, surface.y); c.stroke();
    }
  }
  private drawPump(): void {
    const c = this.ctx, pumped = this.sim.pumpedVolume;
    // Exposed pipe route explains the transfer across the dike to the sea.
    c.strokeStyle = '#d8d4b5'; c.lineWidth = 2.5; c.setLineDash([5, 4]);
    c.lineDashOffset = -pumped / 25;
    c.beginPath();
    for (let x = PUMP.x; x >= PUMP.outletX; x--) {
      const i = PUMP.y * W + x, p = this.project(x + .5, PUMP.y + .5, Math.max(this.sim.terrain[i] + .15, this.sim.terrain[i] + this.sim.water[i] + .1));
      if (x === PUMP.x) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y);
    }
    c.stroke(); c.setLineDash([]); c.lineDashOffset = 0;
    const i = PUMP.y * W + PUMP.x, p = this.project(PUMP.x + .5, PUMP.y + .5, Math.max(0, this.sim.terrain[i] + this.sim.water[i]));
    c.fillStyle = '#1a4556'; c.fillRect(p.x - 10, p.y - 17, 20, 19); c.strokeStyle = '#cfe7dd'; c.lineWidth = 1.5; c.strokeRect(p.x - 10, p.y - 17, 20, 19);
    c.beginPath(); c.arc(p.x, p.y - 7, 6, 0, Math.PI * 2); c.stroke();
    const angle = pumped / 5;
    c.beginPath(); c.moveTo(p.x - 5 * Math.cos(angle), p.y - 7 - 5 * Math.sin(angle)); c.lineTo(p.x + 5 * Math.cos(angle), p.y - 7 + 5 * Math.sin(angle)); c.stroke();
  }
}

export const floodland: ArcadeGame = {
  id: 'floodland',
  title: { en: 'Save the Netherlands', nl: 'Red Nederland', no: 'Redd Nederland' },
  scienceLine: {
    en: 'The computer moves real water across the landscape, square by square. Our group works with Deltares on how likely Dutch dikes are to fail.',
    nl: 'De computer laat echt water over het landschap stromen, vakje voor vakje. Onze groep werkt met Deltares aan de kans dat Nederlandse dijken bezwijken.',
    no: 'Datamaskinen flytter ekte vann over landskapet, rute for rute. Gruppen vår jobber med Deltares på hvor sannsynlig det er at nederlandske diker svikter.',
  },
  tileEmoji: '🌊',
  create: host => new FloodInstance(host),
};
