import type { ArcadeGame, GameHost, GameInstance } from '../../shell/types';
import { pick } from '../../lib/i18n';
import { scoreFlow, type ScoreFlowHandle } from '../../shell/scoreflow';
import { delvePanel, delveToggle, type DelveHandle, type DelveToggleHandle } from '../../shell/delve';
import { FloodSim, GRID_W as W, GRID_H as H } from './water';
import {
  BUDGET, CALM_SEA, DIKE_X, HOMES, PUMP, ROUND, SAND_RATE, STORM, STORM_LENGTH, TIME_SCALE,
  countBits, floodedHomes, holdTheLine, homeSpillLevels, makeScene, placeSand, resetWater, sandPlan,
  seaLevelAt, spillLevel, type DikeRow, type Point,
} from './scene';
import {
  DAMAGE_PER_HOME, FRAGILITY_OFFSETS, HEIGHT, SECTIONS, TEST_STORMS, WEAK_BUDGET, WEAK_STORM, WEAK_TESTS, chooseWeakSections, century,
  dikeCost, fragilityRun, heightScore, random, stormRun, uniformDike, weakDike, type Fragility, type StormReport,
} from './rounds';
import { LiveRecording } from './recording';
import { drawCentury, drawCostCurve, drawMiniMap } from './charts';
import { FloodDelve, returnYears, shareFragility, type Rect } from './delve';
import { text } from './text';
import './style.css';

/** toy: free play · card: a round's intro or result · plan: build or choose before
 * the storm · storm: the storm runs · century: round 3's hundred years · replay. */
type Mode = 'toy' | 'card' | 'plan' | 'storm' | 'century' | 'replay';
interface Puff { x: number; y: number; vx: number; vy: number; life: number }
/** A foam ring from a splash, spreading at the shallow-water wave speed. */
interface Ring { x: number; y: number; age: number }
/** Solver time per frame for background runs (test storms, the century's storms). */
const COMPUTE_MS = 6;
const LENS_RADIUS = 130, LENS_ZOOM = 3.4;

class FloodInstance implements GameInstance {
  private mode: Mode = 'toy';
  /** -1 in free play; 0, 1, 2 during the challenge. */
  private round = -1;
  private scores: number[] = [];
  private dike: (y: number) => DikeRow = holdTheLine;
  private sim = makeScene();
  /** The untouched landscape: sand shows above it, scars below it. */
  private base = this.sim.terrain.slice();
  /** Displayed seconds since this stretch of play began (the storm clock in a round). */
  private time = 0;
  private stormStart: number | null = null;
  private stormPeak = STORM.peak;
  private roundEnd = Infinity;
  private budget = Infinity;
  private budgetMax = BUDGET;
  private flooded = 0;
  private spill = spillLevel(this.sim.terrain);
  private spillAge = 0;
  private recording: LiveRecording | null = null;
  private replayTime = 0;
  private replayPlaying = true;
  // Round 2: weak spots and test storms.
  private rng = random(Date.now());
  private tests: StormReport[] = [];
  private testRun: Generator<{ progress: number; sim: FloodSim }, StormReport> | null = null;
  private testSim: FloodSim | null = null;
  private testPeak = 0;
  private testProgress = 0;
  // Round 3: how high?
  private crest = HEIGHT.start;
  private fragRun: Generator<{ run: number; sim: FloodSim }, Fragility> | null = null;
  private fragSims: FloodSim[] = [];
  private fragility: Fragility | null = null;
  private years: { peaks: number[]; flooded: number[] } | null = null;
  private centuryTime = 0;
  // Pointer, lens and feedback.
  private holding = false;
  private splashTimer = 0;
  private pointer: Point | null = null;
  private mouse: Point | null = null;
  private xray = false;
  private spaceHeld = false;
  private lensAt: Point | null = null;
  private plan = new Map<number, number>();
  private puffs: Puff[] = [];
  private rings: Ring[] = [];
  private banner = 0;
  private breachRows = new Set<number>();
  private stepsPerSecond = 0;
  private stepClock = 0;
  private stepMark = 0;
  // Layout and DOM.
  private ctx!: CanvasRenderingContext2D;
  private transform = { scale: 1, ox: 0, oy: 0 };
  private bars: Record<'toy' | 'storm1' | 'plan2' | 'storm2' | 'plan3' | 'replay', HTMLElement> = {} as never;
  private buttons: Record<string, HTMLButtonElement> = {};
  private hud!: HTMLElement;
  private hint!: HTMLElement;
  private message!: HTMLElement;
  private timeline!: HTMLInputElement;
  private testPanel!: HTMLElement;
  private testCanvas!: HTMLCanvasElement;
  private testList!: HTMLElement;
  private card: HTMLElement | null = null;
  private centuryCanvas: HTMLCanvasElement | null = null;
  private centuryLine: HTMLElement | null = null;
  private flow: ScoreFlowHandle | null = null;
  private toggle!: DelveToggleHandle;
  private delve: DelveHandle | null = null;
  private delveContent: FloodDelve | null = null;

  constructor(private host: GameHost) {}

  private down = (e: PointerEvent) => {
    if (!e.isPrimary || e.button !== 0 || this.holding || !this.canBuild()) return;
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
    const r = this.host.canvas.getBoundingClientRect();
    this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
    this.pointer = this.hit(e);
  };
  private release = () => { this.holding = false; };
  private leave = () => { if (!this.holding) { this.pointer = null; this.mouse = null; } };
  private key = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || (e.target as HTMLElement)?.tagName === 'INPUT') return;
    this.spaceHeld = e.type === 'keydown';
    e.preventDefault();
  };

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
    window.addEventListener('keydown', this.key);
    window.addEventListener('keyup', this.key);
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
    window.removeEventListener('keydown', this.key);
    window.removeEventListener('keyup', this.key);
    this.flow?.dispose();
    this.closeDelve();
    this.recording = null; this.testRun = null; this.fragRun = null;
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
    for (const key of Object.keys({ toy: 0, storm1: 0, plan2: 0, storm2: 0, plan3: 0, replay: 0 }) as (keyof typeof this.bars)[]) this.bars[key] = bar();
    const xray = (b: HTMLElement, key: string) => add(b, key, '🔍', t.xray, () => { this.xray = !this.xray; });
    add(this.bars.toy, 'storm', '🌊', t.storm, () => { this.stormStart = this.time; });
    xray(this.bars.toy, 'xrayToy');
    add(this.bars.toy, 'reset', '🧹', t.startOver, () => this.enterToy());
    add(this.bars.toy, 'challenge', '🏆', t.challenge, () => this.enterChallenge());
    xray(this.bars.storm1, 'xray1');
    add(this.bars.storm1, 'stop1', '⏹', t.stop, () => this.enterToy());
    add(this.bars.plan2, 'test', '🖥️', t.testStorm(WEAK_TESTS), () => this.startTest());
    xray(this.bars.plan2, 'xray2');
    add(this.bars.plan2, 'go2', '🌊', t.startStorm, () => this.startStorm());
    add(this.bars.plan2, 'stop2', '⏹', t.stop, () => this.enterToy());
    xray(this.bars.storm2, 'xray3');
    add(this.bars.storm2, 'stop3', '⏹', t.stop, () => this.enterToy());
    add(this.bars.plan3, 'lower', '🔽', t.lower, () => this.setCrest(this.crest - HEIGHT.step));
    add(this.bars.plan3, 'higher', '🔼', t.higher, () => this.setCrest(this.crest + HEIGHT.step));
    add(this.bars.plan3, 'live', '⏩', t.liveCentury, () => this.startCentury());
    add(this.bars.plan3, 'stop4', '⏹', t.stop, () => this.enterToy());
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
    add(this.bars.replay, 'replayNext', '▶️', t.next, () => this.enterRound(this.round + 1));
    add(this.bars.replay, 'replayStop', '⏹', t.stop, () => this.enterToy());
    this.hud = document.createElement('div'); this.hud.className = 'challenge-hud delta-hud';
    this.hint = document.createElement('p'); this.hint.className = 'challenge-hint delta-hint';
    this.message = document.createElement('div'); this.message.className = 'delta-banner'; this.message.textContent = `⚠️ ${t.breach}`;
    this.testPanel = document.createElement('div'); this.testPanel.className = 'delta-tests';
    this.testCanvas = document.createElement('canvas');
    this.testList = document.createElement('ol');
    this.testPanel.append(this.testCanvas, this.testList);
    this.toggle = delveToggle(() => (this.delve ? this.closeDelve() : this.openDelve()));
    this.host.overlay.append(...Object.values(this.bars), this.hud, this.hint, this.message, this.testPanel, this.toggle.element);
  }

  private currentBar(): keyof typeof this.bars | null {
    if (this.delve) return null;
    if (this.mode === 'toy') return 'toy';
    if (this.mode === 'replay') return 'replay';
    if (this.mode === 'storm') return this.round === 0 ? 'storm1' : 'storm2';
    if (this.mode === 'plan') return this.round === 1 ? 'plan2' : 'plan3';
    return null;
  }

  private updateUi(): void {
    const t = text();
    const bar = this.currentBar();
    for (const [key, el] of Object.entries(this.bars)) el.hidden = key !== bar;
    this.toggle.element.classList.toggle('hidden', this.mode !== 'toy');
    this.buttons.storm.disabled = this.stormStart !== null;
    for (const key of ['xrayToy', 'xray1', 'xray2', 'xray3']) this.buttons[key].classList.toggle('active', this.xray);
    const testsLeft = WEAK_TESTS - this.tests.length - (this.testRun ? 1 : 0);
    this.buttons.test.querySelector('.tool-label')!.textContent = t.testStorm(Math.max(0, testsLeft));
    this.buttons.test.disabled = testsLeft <= 0 || this.testRun !== null;
    this.buttons.lower.disabled = this.crest <= HEIGHT.min + 1e-9;
    this.buttons.higher.disabled = this.crest >= HEIGHT.max - 1e-9;
    if (this.mode === 'replay' && this.recording) {
      const done = this.replayTime >= this.recording.duration;
      const playing = this.replayPlaying && !done;
      this.buttons.playPause.querySelector('.tool-emoji')!.textContent = playing ? '⏸' : '▶️';
      this.buttons.playPause.querySelector('.tool-label')!.textContent = playing ? t.pause : t.play;
      this.timeline.max = String(this.recording.duration);
      this.timeline.value = String(this.replayTime);
      this.timeline.style.setProperty('--progress', `${100 * this.replayTime / Math.max(1e-6, this.recording.duration)}%`);
    }
    this.updateHud();
    let hint = '';
    if (this.mode === 'toy' && !this.delve) hint = this.stormStart === null ? t.toyHint : t.toyStormHint;
    if (this.mode === 'storm') {
      const s = this.stormStart ?? 0;
      hint = this.time < s ? t.warning(Math.ceil(s - this.time))
        : this.time > s + STORM_LENGTH ? (this.spill < CALM_SEA && this.round === 0 ? t.holeHint : t.calmHint)
        : this.round === 0 ? t.roundHint : t.lockedHint;
    }
    if (this.mode === 'plan') hint = this.round === 1 ? t.planWeakHint : t.planHeightHint;
    if (this.mode === 'replay') hint = t.scrub;
    this.hint.textContent = hint;
    this.hint.hidden = !hint;
    this.message.classList.toggle('show', this.banner > 0);
    this.testPanel.classList.toggle('hidden', !(this.round === 1 && (this.mode === 'plan' || this.mode === 'storm') && (this.testRun || this.tests.length)));
  }
  private updateHud(): void {
    const t = text();
    const inRound = this.mode === 'storm' || this.mode === 'replay' || (this.mode === 'plan' && this.round === 1);
    const heights = this.mode === 'plan' && this.round === 2;
    this.hud.hidden = !inRound && !heights;
    if (heights) {
      this.hud.replaceChildren(
        this.hudItem('🧱', `${t.dike} ${this.crest.toFixed(2)} m`, t.dike, ''),
        this.hudItem('🪙', `${t.cost} ${dikeCost(this.crest)}`, t.cost, ''),
      );
      return;
    }
    if (!inRound) return;
    const dry = HOMES.length - countBits(this.flooded);
    const clock = this.mode === 'replay' ? this.replayTime : this.time;
    const items = [this.hudItem('🏠', `${dry}/${HOMES.length}`, t.homes, this.flooded ? 'bad' : ''), this.hudSand()];
    if (this.mode !== 'plan') items.push(this.hudItem('⏱', `${Math.max(0, Math.ceil(this.roundEnd - clock))}`, t.time, ''));
    this.hud.replaceChildren(...items);
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
    const fill = document.createElement('span'); fill.style.width = `${100 * this.budget / this.budgetMax}%`;
    bar.append(fill);
    item.append('🟨 ', bar, ` ${Math.floor(this.budget)}`);
    return item;
  }
  private updateTestPanel(): void {
    const t = text();
    this.testList.replaceChildren(...this.tests.map(r => {
      const li = document.createElement('li');
      const broke = this.brokenSections(r);
      li.textContent = `${t.testTitle(r.peak.toFixed(1))}: ${broke ? t.testBroke(broke) : t.testNothing}`;
      li.className = broke ? 'bad' : '';
      return li;
    }));
    if (this.testRun) {
      const li = document.createElement('li'); li.textContent = `${t.testTitle(this.testPeak.toFixed(1))}: ${t.testRunning}`;
      this.testList.append(li);
    }
  }
  private brokenSections(r: StormReport): number {
    return SECTIONS.filter(s => { for (let y = s.y0; y <= s.y1; y++) if (r.eroded[y] > .15) return true; return false; }).length;
  }

  // ---- modes ----

  private clearCards(): void {
    this.card?.remove(); this.card = null;
    this.centuryCanvas = null; this.centuryLine = null;
    this.flow?.dispose(); this.flow = null;
  }
  private freshScene(dike: (y: number) => DikeRow): void {
    this.dike = dike;
    this.sim = makeScene(dike); this.base = this.sim.terrain.slice();
    this.spill = spillLevel(this.sim.terrain);
    this.time = 0; this.stormStart = null; this.roundEnd = Infinity; this.flooded = 0;
    this.holding = false; this.plan.clear(); this.puffs = []; this.rings = []; this.banner = 0; this.breachRows.clear();
  }
  private enterToy(): void {
    this.clearCards();
    this.round = -1; this.scores = [];
    this.freshScene(holdTheLine);
    this.budget = Infinity; this.stormPeak = STORM.peak;
    this.recording = null; this.testRun = null; this.fragRun = null; this.tests = [];
    this.mode = 'toy';
    this.updateUi();
  }
  private enterChallenge(): void {
    this.scores = [];
    this.enterRound(0);
  }
  /** A round's intro card, over the new landscape with a calm sea. */
  private enterRound(k: number): void {
    this.clearCards();
    this.round = k;
    this.recording = null; this.testRun = null; this.testSim = null; this.tests = [];
    this.fragRun = null; this.fragility = null; this.years = null; this.fragSims = [];
    if (k === 0) { this.freshScene(holdTheLine); this.budget = this.budgetMax = BUDGET; }
    if (k === 1) { this.freshScene(weakDike(chooseWeakSections(this.rng))); this.budget = this.budgetMax = WEAK_BUDGET; }
    if (k === 2) { this.crest = HEIGHT.start; this.freshScene(uniformDike(this.crest)); this.budget = 0; }
    this.mode = 'card';
    const t = text(), info = t.rounds[k];
    const go = this.showCard(t.roundLabel(k), `🌊 ${info.title}`, [info.text], info.science, [{ label: t.go, onClick: () => this.beginRound() }]);
    go[0].focus();
    this.updateUi();
  }
  private beginRound(): void {
    this.clearCards();
    if (this.round === 0) this.startStorm();
    else { this.mode = 'plan'; this.time = 0; }
    this.updateUi();
  }
  private startStorm(): void {
    this.testRun = null; this.testSim = null;
    this.holding = false; this.plan.clear();
    this.mode = 'storm';
    this.time = 0;
    this.stormStart = this.round === 0 ? ROUND.warning : 1;
    this.stormPeak = this.round === 0 ? STORM.peak : WEAK_STORM;
    this.roundEnd = this.stormStart + STORM_LENGTH + ROUND.calm;
    this.flooded = 0;
    this.recording = new LiveRecording(W * H, this.roundEnd + 1);
    this.recording.capture(0, this.sim, 0);
    this.updateUi();
  }
  private finishStorm(): void {
    this.holding = false; this.plan.clear();
    // A breach cut below the calm sea keeps letting it in: those homes are lost too.
    homeSpillLevels(this.sim.terrain).forEach((level, k) => { if (level < CALM_SEA) this.flooded |= 1 << k; });
    const t = text();
    const dry = HOMES.length - countBits(this.flooded), sand = Math.floor(this.budget);
    const score = dry * 100 + sand;
    this.scores[this.round] = score;
    this.mode = 'card';
    this.showCard(t.roundLabel(this.round), t.roundHeading(dry, HOMES.length), [t.breakdown(dry, sand)], '', [
      { label: `▶️ ${t.next}`, onClick: () => this.enterRound(this.round + 1) },
      { label: `⏪ ${t.watchAgain}`, onClick: () => this.enterReplay() },
    ], t.points(score));
    this.updateUi();
  }
  private showCard(label: string, heading: string, lines: string[], science: string,
    actions: { label: string; onClick: () => void }[], score?: string): HTMLButtonElement[] {
    const card = document.createElement('div'); card.className = 'score-flow delta-card';
    const small = document.createElement('p'); small.className = 'delta-card-label'; small.textContent = label;
    const h = document.createElement('h2'); h.textContent = heading;
    card.append(small, h);
    if (score) { const s = document.createElement('div'); s.className = 'score-flow-score'; s.textContent = score; card.append(s); }
    for (const line of lines) { const p = document.createElement('p'); p.textContent = line; card.append(p); }
    if (science) { const p = document.createElement('p'); p.className = 'delta-science'; p.textContent = `🔬 ${science}`; card.append(p); }
    const row = document.createElement('div'); row.className = 'score-flow-actions';
    const buttons = actions.map(a => {
      const b = document.createElement('button'); b.className = 'arcade-button'; b.textContent = a.label;
      b.addEventListener('click', a.onClick); row.append(b); return b;
    });
    card.append(row);
    this.card = card;
    this.host.overlay.append(card);
    return buttons;
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
  private finishChallenge(): void {
    this.clearCards();
    this.mode = 'card';
    const t = text();
    const total = this.scores.reduce((a, b) => a + b, 0);
    this.flow = scoreFlow({
      gameId: 'floodland',
      heading: t.finalHeading,
      score: total,
      scoreLabel: t.points(total),
      actions: [
        { label: `🏆 ${t.playAgain}`, onClick: () => this.enterChallenge() },
        { label: `🌊 ${t.freePlay}`, onClick: () => this.enterToy() },
      ],
    });
    const breakdown = document.createElement('p'); breakdown.className = 'delta-breakdown';
    breakdown.textContent = t.finalBreakdown(this.scores);
    this.flow.element.querySelector('.score-flow-score')?.after(breakdown);
    this.host.overlay.appendChild(this.flow.element);
    this.updateUi();
  }

  // ---- round 2: test storms ----

  private startTest(): void {
    if (this.testRun || this.tests.length >= WEAK_TESTS) return;
    this.testPeak = Math.round((TEST_STORMS.min + (TEST_STORMS.max - TEST_STORMS.min) * this.rng()) * 10) / 10;
    this.testRun = stormRun(this.sim.terrain.slice(), this.dike, this.testPeak);
    this.testProgress = 0;
    this.updateTestPanel();
  }
  private stepTest(): void {
    if (!this.testRun) return;
    const start = performance.now();
    while (performance.now() - start < COMPUTE_MS) {
      const r = this.testRun.next();
      if (r.done) { this.tests.push(r.value); this.testRun = null; this.updateTestPanel(); break; }
      this.testSim = r.value.sim; this.testProgress = r.value.progress;
    }
  }
  private drawTestMap(): void {
    if (this.testPanel.classList.contains('hidden') || !this.testSim) return;
    const dpr = this.host.dpr, w = 256, h = 160, cv = this.testCanvas;
    if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; cv.style.width = `${w}px`; cv.style.height = `${h}px`; }
    const c = cv.getContext('2d')!;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawMiniMap(c, this.testSim, 0, 0, w, h);
    if (this.testRun) { c.fillStyle = '#e5c579'; c.fillRect(0, h - 5, w * this.testProgress, 5); }
  }

  // ---- round 3: how high? ----

  private setCrest(crest: number): void {
    this.crest = Math.min(HEIGHT.max, Math.max(HEIGHT.min, Math.round(crest / HEIGHT.step) * HEIGHT.step));
    const time = this.time;
    this.freshScene(uniformDike(this.crest));
    this.time = time;
  }
  private startCentury(): void {
    this.mode = 'century';
    this.fragRun = fragilityRun(this.crest);
    this.fragSims = []; this.fragility = null; this.years = null; this.centuryTime = 0;
    const t = text();
    const card = document.createElement('div'); card.className = 'score-flow delta-card delta-century';
    const small = document.createElement('p'); small.className = 'delta-card-label'; small.textContent = t.roundLabel(2);
    const h = document.createElement('h2'); h.textContent = t.fragilityTitle;
    const canvas = document.createElement('canvas');
    const line = document.createElement('p'); line.className = 'delta-century-line';
    card.append(small, h, canvas, line);
    this.card = card; this.centuryCanvas = canvas; this.centuryLine = line;
    this.host.overlay.append(card);
    this.updateUi();
  }
  private stepCentury(dt: number): void {
    if (this.fragRun) {
      const start = performance.now();
      while (performance.now() - start < COMPUTE_MS) {
        const r = this.fragRun.next();
        if (r.done) {
          this.fragility = r.value; this.fragRun = null;
          shareFragility(r.value);
          this.years = century(r.value, this.rng);
          this.card!.querySelector('h2')!.textContent = text().centuryTitle;
          break;
        }
        this.fragSims[r.value.run] = r.value.sim;
      }
      return;
    }
    if (!this.years || !this.fragility) return;
    const before = this.centuryTime;
    this.centuryTime += dt;
    if (before < 6 && this.centuryTime >= 6) this.finishCentury();
  }
  private finishCentury(): void {
    const f = this.fragility!, t = text();
    const score = heightScore(f, this.crest), damage = Math.round(f.expectedDamage(this.crest));
    this.scores[2] = score;
    const card = this.card!;
    card.querySelector('h2')!.textContent = t.heightHeading(returnYears(f, this.crest));
    const s = document.createElement('div'); s.className = 'score-flow-score'; s.textContent = t.points(score);
    const p = document.createElement('p'); p.className = 'delta-breakdown'; p.textContent = t.heightBreakdown(dikeCost(this.crest), damage);
    const avg = document.createElement('p'); avg.className = 'delta-science'; avg.textContent = t.average(damage);
    const row = document.createElement('div'); row.className = 'score-flow-actions';
    const next = document.createElement('button'); next.className = 'arcade-button'; next.textContent = `🏆 ${t.total}`;
    next.addEventListener('click', () => this.finishChallenge());
    row.append(next);
    card.querySelector('h2')!.after(s, p);
    card.append(avg, row);
  }
  private drawCenturyCard(): void {
    const cv = this.centuryCanvas;
    if (!cv) return;
    const t = text(), dpr = this.host.dpr, w = Math.min(640, window.innerWidth * .94 - 70), h = Math.min(250, window.innerHeight * .34);
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = h * dpr; cv.style.width = `${w}px`; cv.style.height = `${h}px`; }
    const c = cv.getContext('2d')!;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    if (!this.fragility) {
      // Six storms against the dike, side by side, as the computer runs them.
      const cols = 3, gap = 12, mw = (w - gap * (cols - 1)) / cols, mh = mw * H / W;
      for (let k = 0; k < 6; k++) {
        const x = (k % cols) * (mw + gap), y = Math.floor(k / cols) * (mh + 30);
        const sim = this.fragSims[k];
        if (sim) drawMiniMap(c, sim, x, y, mw, mh);
        else { c.fillStyle = '#1b3440'; c.fillRect(x, y, mw, mh); }
        c.fillStyle = '#dbe8e4'; c.font = '700 12px system-ui'; c.textAlign = 'left';
        const peak = this.crest + FRAGILITY_OFFSETS[k];
        const dry = sim ? HOMES.length - countBits(floodedHomes(sim)) : null;
        c.fillText(`🌊 ${peak.toFixed(2)} m${dry === null ? '' : `   🏠 ${dry}/${HOMES.length}`}`, x, y + mh + 16);
      }
      if (this.centuryLine) this.centuryLine.textContent = t.computing(Math.min(6, this.fragSims.length), 6);
      return;
    }
    const years = this.years!, shown = Math.min(100, Math.floor(this.centuryTime * 20));
    if (this.centuryTime < 6) {
      drawCentury(c, 44, 8, w - 54, h - 44, years.peaks, years.flooded, shown, this.crest, { years: t.chart.years, storm: t.chart.storm, dike: t.chart.dike });
      let floods = 0, damage = 0;
      for (let k = 0; k < shown; k++) if (years.flooded[k] > 0) { floods++; damage += years.flooded[k] * DAMAGE_PER_HOME; }
      if (this.centuryLine) this.centuryLine.textContent = t.yearLine(shown, floods, damage);
    } else {
      drawCostCurve(c, 50, 8, w - 60, h - 44, this.fragility, this.crest, t.chart);
      if (this.centuryLine) this.centuryLine.textContent = '';
    }
  }

  // ---- delve ----

  private openDelve(): void {
    if (this.delve || this.mode !== 'toy') return;
    this.holding = false;
    this.delveContent = new FloodDelve({
      sim: () => this.sim,
      base: () => this.base,
      storm: () => { if (this.stormStart === null) this.stormStart = this.time; },
      startOver: () => { this.freshScene(holdTheLine); },
      setLens: p => { this.lensAt = p; },
      stepsPerSecond: () => this.stepsPerSecond,
    });
    this.delve = delvePanel({
      heading: text().delveHeading,
      chapters: this.delveContent.chapters(),
      onChapter: i => this.delveContent?.setChapter(i),
      onExit: () => this.closeDelve(),
    });
    this.host.overlay.appendChild(this.delve.element);
    this.toggle.setOpen(true);
    this.updateUi();
  }
  private closeDelve(): void {
    if (!this.delve) return;
    this.delve.dispose(); this.delve = null;
    this.delveContent?.dispose(); this.delveContent = null;
    this.lensAt = null;
    this.toggle.setOpen(false);
    this.updateUi();
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
    } else this.live(dt);
    if (this.mode === 'plan' && this.round === 1) this.stepTest();
    if (this.mode === 'century') this.stepCentury(dt);
    this.delveContent?.frame(dt);
    this.preview();
    this.updateUi();
    this.draw();
    this.drawTestMap();
    this.drawCenturyCard();
  }

  private canBuild(): boolean {
    if (this.delve) return false;
    return this.mode === 'toy' || (this.round === 0 && this.mode === 'storm') || (this.round === 1 && this.mode === 'plan');
  }

  private live(dt: number): void {
    this.time += dt;
    if (this.holding && this.pointer && this.canBuild()) this.interact(dt, this.pointer);
    if (this.mode === 'toy' && this.stormStart !== null && this.time - this.stormStart > STORM_LENGTH) this.stormStart = null;
    this.sim.seaLevel = seaLevelAt(this.time, this.mode === 'toy' || this.mode === 'storm' ? this.stormStart : null, this.stormPeak);
    try {
      this.sim.advance(dt * TIME_SCALE);
    } catch (error) {
      // Kiosk safety: never freeze on a numerical failure; keep the landscape.
      console.error(error);
      resetWater(this.sim);
    }
    this.stepClock += dt;
    if (this.stepClock >= 1) { this.stepsPerSecond = Math.round((this.sim.steps - this.stepMark) / this.stepClock); this.stepMark = this.sim.steps; this.stepClock = 0; }
    const now = floodedHomes(this.sim);
    this.flooded = this.mode === 'storm' ? this.flooded | now : now;
    this.watchForBreaches();
    this.spillAge += dt;
    if (this.spillAge > .2) { this.spillAge = 0; this.spill = spillLevel(this.sim.terrain); }
    if (this.mode === 'storm') {
      this.recording?.capture(this.time, this.sim, this.flooded);
      if (this.time >= this.roundEnd) this.finishStorm();
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
    const used = placeSand(this.sim, [p], SAND_RATE * dt, this.budget);
    if (this.mode !== 'toy') this.budget = Math.max(0, this.budget - used);
    if (used > 0) {
      const s = this.project(p.x, p.y, this.sim.terrain[i]);
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
    if (!this.canBuild() || !this.pointer || this.holding) { this.plan = new Map(); return; }
    const p = this.pointer;
    const i = Math.floor(p.y) * W + Math.floor(p.x);
    const splash = this.mode === 'toy' && p.x < DIKE_X[0] && this.sim.water[i] > .3;
    this.plan = splash ? new Map() : sandPlan(this.sim, [p], .2);
  }

  // ---- drawing ----

  private project(x: number, y: number, z = 0): Point {
    return { x: x * 12 - y * 8, y: x * 3.4 + y * 7 - z * 11 };
  }
  private toScreen(p: Point): Point {
    const { scale, ox, oy } = this.transform;
    return { x: ox + p.x * scale, y: oy + p.y * scale };
  }
  private hit(e: PointerEvent): Point | null {
    const r = this.host.canvas.getBoundingClientRect(), { scale, ox, oy } = this.transform;
    const px = (e.clientX - r.left - ox) / scale, py = (e.clientY - r.top - oy) / scale;
    const snap = (wx: number) => wx >= DIKE_X[0] + .5 && wx <= DIKE_X[1] + .5 ? (DIKE_X[0] + DIKE_X[1] + 1) / 2 : wx;
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

  /** Where the landscape goes: right of the explainer panel when it is open. */
  private area(width: number, height: number): Rect & { gauge: boolean } {
    const narrow = width < 700;
    if (this.delve) {
      const r = this.delve.element.getBoundingClientRect(), c = this.host.canvas.getBoundingClientRect();
      if (r.width < width * .6) return { x: r.right - c.left + 20, y: 70, w: width - (r.right - c.left) - 40, h: height - 100, gauge: false };
      return { x: 12, y: 70, w: width - 24, h: r.top - c.top - 90, gauge: false };
    }
    const gauge = narrow ? 0 : 110;
    const top = narrow ? 70 : 78, bottom = height - (narrow ? 120 : 150);
    return { x: gauge, y: top, w: width - gauge - 40, h: bottom - top, gauge: !narrow };
  }

  private draw(): void {
    const c = this.ctx, dpr = this.host.dpr;
    const width = this.host.canvas.width / dpr, height = this.host.canvas.height / dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = c.createLinearGradient(0, 0, 0, height); bg.addColorStop(0, '#15333e'); bg.addColorStop(1, '#091c28'); c.fillStyle = bg; c.fillRect(0, 0, width, height);
    const area = this.area(width, height);
    if (this.delveContent && !this.delveContent.diorama) { this.delveContent.draw(c, area); return; }
    const worldW = W * 12 + H * 8, worldH = W * 3.4 + H * 7 + 100;
    const scale = Math.max(.15, Math.min(area.w / worldW, area.h / worldH));
    const ox = area.x + (area.w - worldW * scale) / 2 + H * 8 * scale;
    const oy = area.y + Math.max(0, (area.h - worldH * scale) / 2) + 45 * scale;
    this.transform = { scale, ox, oy }; c.translate(ox, oy); c.scale(scale, scale);
    this.drawLandscape();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const p of this.puffs) {
      const s = this.toScreen(p);
      c.fillStyle = `rgba(232,205,140,${Math.max(0, p.life) * .8})`;
      c.beginPath(); c.arc(s.x, s.y, 2.5 + (1 - p.life) * 4, 0, Math.PI * 2); c.fill();
    }
    const lens = this.lensAt ? { screen: this.toScreen(this.project(this.lensAt.x, this.lensAt.y, 0)), grid: this.lensAt }
      : (this.xray || this.spaceHeld) && this.mouse && this.pointer ? { screen: this.mouse, grid: this.pointer } : null;
    if (lens) this.drawLens(lens.screen, lens.grid);
    if (area.gauge) this.drawGauge(34, area.y + 60, area.y + area.h - 10);
    this.delveContent?.draw(c, area);
  }

  private drawLandscape(): void {
    const c = this.ctx;
    const { terrain, water } = this.sim;
    const hardTop = this.sim.erosion!.hardTop;
    const pulse = .5 + .5 * Math.sin(performance.now() / 90);
    // The exposed earth makes the below-sea-level polder legible.
    for (let x = 0; x < W; x++) this.poly([this.project(x, H, terrain[(H - 1) * W + x]), this.project(x + 1, H, terrain[(H - 1) * W + x]), this.project(x + 1, H, -5), this.project(x, H, -5)], x % 3 ? '#80694d' : '#8d7555');
    for (let y = 0; y < H; y++) this.poly([this.project(W, y, terrain[y * W + W - 1]), this.project(W, y + 1, terrain[y * W + W - 1]), this.project(W, y + 1, -5), this.project(W, y, -5)], '#554e3b');
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, z = terrain[i], h = water[i];
      const sand = z > hardTop[i] + .01;
      const scar = z < this.base[i] - .05;
      const field = (Math.floor(x / 6) + Math.floor(y / 5)) % 3;
      let land = z < -1 ? '#b8b18a' : z > 1 ? '#91aa67' : ['#78935d', '#889f65', '#718c58'][field];
      if (scar) land = '#8a6a45';
      if (sand) land = '#d9b86e';
      const front = y < H - 1 ? terrain[i + W] : z;
      const right = x < W - 1 ? terrain[i + 1] : z;
      if (z > front) this.poly([this.project(x, y + 1, z), this.project(x + 1, y + 1, z), this.project(x + 1, y + 1, front), this.project(x, y + 1, front)], sand ? '#a48b50' : scar ? '#6d5236' : '#667d49');
      if (z > right) this.poly([this.project(x + 1, y, z), this.project(x + 1, y + 1, z), this.project(x + 1, y + 1, right), this.project(x + 1, y, right)], sand ? '#b29858' : scar ? '#7a5c3d' : '#819358');
      this.tile(x, y, z, land);
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
        // Join unequal neighbouring surfaces so a moving front has no cracks.
        const wf = y < H - 1 ? Math.max(z, terrain[i + W] + water[i + W]) : z;
        const wr = x < W - 1 ? Math.max(z, terrain[i + 1] + water[i + 1]) : z;
        if (z + h > wf) this.poly([this.project(x, y + 1, z + h), this.project(x + 1, y + 1, z + h), this.project(x + 1, y + 1, wf), this.project(x, y + 1, wf)], waterColor);
        if (z + h > wr) this.poly([this.project(x + 1, y, z + h), this.project(x + 1, y + 1, z + h), this.project(x + 1, y + 1, wr), this.project(x + 1, y, wr)], waterColor);
        this.tile(x, y, z + h, waterColor, `rgba(180,241,243,${.29 * opacity})`);
        if ((x * 7 + y * 11) % 19 === 0) {
          const p = this.project(x + .2, y + .5, z + h); c.strokeStyle = '#b9eeef60'; c.lineWidth = .7; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + 7, p.y + 1); c.stroke();
        }
      }
      // The ground is washing away here: a pulsing red outline.
      if (this.sim.wear[i] > 2e-4) this.tile(x, y, z + h, `rgba(255,90,70,${.15 + .25 * pulse})`, `rgba(255,120,90,${.6 + .4 * pulse})`);
    }
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
    this.drawTestMarks();
    const calm = this.mode === 'storm' && this.stormStart !== null && this.time > this.stormStart + STORM_LENGTH;
    HOMES.forEach(([x, y], k) => { const wet = (this.flooded & (1 << k)) !== 0; this.house(x, y, wet, k === 6, calm && !wet); });
    this.drawPump();
    this.drawLevelPosts();
    const p = this.project(58, 10, 1), a0 = (this.mode === 'replay' ? this.replayTime : this.time) * 1.2;
    c.fillStyle = '#e2d6b8'; c.fillRect(p.x - 4, p.y - 23, 8, 25); c.strokeStyle = '#eee6cd'; c.lineWidth = 3;
    for (let k = 0; k < 4; k++) { const a = a0 + k * Math.PI / 2; c.beginPath(); c.moveTo(p.x, p.y - 20); c.lineTo(p.x + Math.cos(a) * 17, p.y - 20 + Math.sin(a) * 17); c.stroke(); }
    let cost = 0; for (const d of this.plan.values()) cost += d;
    const ghostColor = this.mode === 'toy' || cost <= this.budget ? '#ffdc8480' : '#ff736eaa';
    for (const [i, rise] of this.plan) {
      if (rise <= 0) continue;
      const x = i % W, y = Math.floor(i / W), z = terrain[i];
      this.poly([this.project(x, y + 1, z + rise), this.project(x + 1, y + 1, z + rise), this.project(x + 1, y + 1, z), this.project(x, y + 1, z)], ghostColor);
      this.poly([this.project(x + 1, y, z + rise), this.project(x + 1, y + 1, z + rise), this.project(x + 1, y + 1, z), this.project(x + 1, y, z)], ghostColor);
      this.tile(x, y, z + rise, ghostColor, '#fff1bd');
    }
    // Final overlay pass: neighbouring water tiles and buildings cannot cover arrows.
    for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) {
      const i = y * W + x, z = terrain[i], h = water[i];
      if (h <= .035) continue;
      const u = this.sim.mx[i] / h, v = this.sim.my[i] / h, speed = Math.hypot(u, v);
      // Only real currents get arrows, not the gentle swell.
      if (speed <= .35) continue;
      const len = Math.min(1.8, .6 + speed), a = this.project(x + .5, y + .5, z + h + .05), q = this.project(x + .5 + u / speed * len, y + .5 + v / speed * len, z + h + .05);
      const angle = Math.atan2(q.y - a.y, q.x - a.x);
      c.strokeStyle = '#efffff'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(q.x, q.y); c.lineTo(q.x - 4 * Math.cos(angle - .5), q.y - 4 * Math.sin(angle - .5)); c.moveTo(q.x, q.y); c.lineTo(q.x - 4 * Math.cos(angle + .5), q.y - 4 * Math.sin(angle + .5)); c.stroke();
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
  }

  /** Round 2: where test storms broke the dike (red) or only came over it (blue). */
  private drawTestMarks(): void {
    if (this.round !== 1 || !this.tests.length || this.mode === 'replay') return;
    const c = this.ctx, x = (DIKE_X[0] + DIKE_X[1] + 1) / 2;
    for (let y = 0; y < H; y++) {
      const broke = this.tests.filter(r => r.eroded[y] > .15).length;
      const over = this.tests.some(r => r.overtopped[y]);
      if (!broke && !over) continue;
      const z = this.sim.terrain[y * W + Math.floor(x)];
      const p = this.project(x, y + .5, z + .9);
      c.fillStyle = broke ? `rgba(255,90,70,${.5 + .5 * broke / this.tests.length})` : '#7fd3e6aa';
      c.beginPath(); c.arc(p.x, p.y, broke ? 6 : 3.5, 0, Math.PI * 2); c.fill();
      if (broke) { c.fillStyle = '#fff'; c.font = '800 9px system-ui'; c.textAlign = 'center'; c.fillText('!', p.x, p.y + 3); }
    }
  }

  /** The magnifying glass: the numbers the computer keeps for each square. */
  private drawLens(center: Point, g: Point): void {
    const c = this.ctx, t = text(), s = this.transform.scale * LENS_ZOOM;
    const flat = (x: number, y: number) => this.project(x, y, 0);
    const g0 = flat(g.x, g.y);
    const S = (x: number, y: number) => { const p = flat(x, y); return { x: center.x + (p.x - g0.x) * s, y: center.y + (p.y - g0.y) * s }; };
    c.save();
    c.beginPath(); c.arc(center.x, center.y, LENS_RADIUS, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#0b1a22f2'; c.fillRect(center.x - LENS_RADIUS, center.y - LENS_RADIUS, LENS_RADIUS * 2, LENS_RADIUS * 2);
    const reach = Math.ceil(LENS_RADIUS / (5 * s)) + 2;
    const font = Math.max(9, Math.min(14, 4.2 * s));
    c.textAlign = 'center';
    for (let y = Math.max(0, Math.floor(g.y) - reach); y <= Math.min(H - 1, Math.floor(g.y) + reach); y++) {
      for (let x = Math.max(0, Math.floor(g.x) - reach); x <= Math.min(W - 1, Math.floor(g.x) + reach); x++) {
        const mid = S(x + .5, y + .5);
        if (Math.hypot(mid.x - center.x, mid.y - center.y) > LENS_RADIUS + 30) continue;
        const i = y * W + x, z = this.sim.terrain[i], h = this.sim.water[i], wet = h > .02;
        const deep = Math.min(1, h / 3);
        const fill = wet ? `rgb(${Math.round(40 - 20 * deep)},${Math.round(120 - 50 * deep)},${Math.round(150 - 40 * deep)})`
          : z > 1 ? '#4c5e3a' : z > 0 ? '#44573a' : '#3a4a33';
        this.poly([S(x, y), S(x + 1, y), S(x + 1, y + 1), S(x, y + 1)], fill, '#ffffff38');
        c.fillStyle = wet ? '#e8fbff' : '#c9d6b0';
        c.font = `${wet ? 700 : 500} ${font}px system-ui`;
        c.fillText((wet ? h : z).toFixed(1), mid.x, mid.y + font / 3);
        if (wet) {
          const u = this.sim.mx[i] / h, v = this.sim.my[i] / h, speed = Math.hypot(u, v);
          if (speed > .05) {
            const len = .15 + .3 * Math.min(1, speed / 3), q = S(x + .5 + u / speed * len, y + .5 + v / speed * len);
            c.strokeStyle = '#ffe79a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(mid.x, mid.y - font); c.lineTo(q.x, q.y - font); c.stroke();
          }
        }
      }
    }
    c.restore();
    c.strokeStyle = '#e5c579'; c.lineWidth = 4; c.beginPath(); c.arc(center.x, center.y, LENS_RADIUS, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#e5c579'; c.font = '700 13px system-ui'; c.textAlign = 'center';
    c.fillText(`🔍 ${t.lens}`, center.x, center.y - LENS_RADIUS - 10);
    c.font = '600 11px system-ui'; c.fillStyle = '#b5dedc';
    c.fillText(`${t.depth} / ${t.ground} (m)`, center.x, center.y + LENS_RADIUS + 18);
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
    en: 'After the 1953 flood, a mathematician at CWI\'s predecessor worked out how high Dutch dikes should be. Here the computer moves real water, square by square.',
    nl: 'Na de watersnood van 1953 berekende een wiskundige van de voorloper van het CWI hoe hoog Nederlandse dijken moeten zijn. Hier laat de computer echt water stromen, vakje voor vakje.',
    no: 'Etter flommen i 1953 regnet en matematiker ved CWIs forgjenger ut hvor høye nederlandske diker burde være. Her flytter datamaskinen ekte vann, rute for rute.',
  },
  tileEmoji: '🌊',
  create: host => new FloodInstance(host),
};
