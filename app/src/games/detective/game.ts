// Weather Detective, the game: free play (toy) and three challenge cases on
// one canvas, with DOM controls in the overlay.
import type { GameHost, GameInstance } from '../../shell/types';
import { scoreFlow, type ScoreFlowHandle } from '../../shell/scoreflow';
import { delvePanel, delveToggle, type DelveHandle, type DelveToggleHandle } from '../../shell/delve';
import { pointerPos } from '../../lib/util';
import { Dreamer, GP } from './gp';
import {
  ACCUSATIONS, CASES, HOTTEST_THERMOMETERS, LIARS, MAP_THERMOMETERS,
  caseTruth, computerHottest, computerLiars, computerMap, hottestPoints, landStats, liarPoints, liarStations,
  listened, makeStation, mapError, mapGuess, mapPoints, newGP, randomLand, type CaseDef, type Kind, type Station,
} from './cases';
import {
  CITIES, DAY_IDS, HEIGHT_KM, HYPER, KNMI_STATIONS, WIDTH_KM, landCanvas, lonLatToKm, onLand, rng, sampleHalf, world,
  type DayId,
} from './world';
import { drawHouse, drawLegend, drawTag, drawThermometer, paintError, paintField, paintFog, tempColor, type Scale } from './render';
import { text } from './text';
import { DetectiveDelve } from './delve';
import './style.css';

type View = 'dream' | 'guess';
type RevealView = 'truth' | 'guess' | 'computer' | 'error';

interface Layer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  img: ImageData;
}

function layer(nx: number, ny: number): Layer {
  const canvas = document.createElement('canvas');
  canvas.width = nx;
  canvas.height = ny;
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx, img: ctx.createImageData(nx, ny) };
}

/** Free-play cap, so the model stays snappy. */
const MAX_OFFICIAL = 60;
const HOME_COUNT = 150;

export class DetectiveGame implements GameInstance {
  private ctx: CanvasRenderingContext2D;
  private w = world();
  private time = 0;

  // --- what is on the map ---
  private mode: 'free' | 'case' = 'free';
  private day: DayId = 'seabreeze';
  private truth: Float32Array;
  private scale: Scale;
  private stations: Station[] = [];
  private placedAt = new Map<Station, number>();
  private gp: GP;
  private dreamer: Dreamer;
  private view: View = 'dream';
  private peek = false;

  // --- model outputs ---
  private mean: Float32Array;
  private sd: Float32Array;
  private priorSd: Float32Array;
  private dream: Float32Array;
  private fitDirty = true;
  private sdDirty = true;
  private lastSd = 0;
  private loo: { mean: Float64Array; z: Float64Array } | null = null;

  // --- drawing ---
  private half: Layer;
  private halfB: Layer;
  private coarse: Layer;
  private fog: Layer;
  private land: HTMLCanvasElement;
  private mapCanvas = document.createElement('canvas');
  private mapCtx = this.mapCanvas.getContext('2d')!;
  private glow = document.createElement('canvas');
  private layout = { ox: 0, oy: 0, s: 1, mw: 1, mh: 1, key: '' };

  // --- input ---
  private pointer: { x: number; y: number } | null = null;
  private drag: { station: Station; offset: number } | null = null;

  // --- challenge ---
  private caseIndex = 0;
  private def: CaseDef = CASES[0];
  private phase: 'intro' | 'play' | 'reveal' = 'intro';
  private revealT = 0;
  private revealView: RevealView = 'truth';
  private total = 0;
  private cpu: Station[] = [];
  private cpuMean: Float32Array | null = null;
  private errField: Float32Array | null = null;
  private autoRevealAt = -1;

  // --- DOM ---
  private ui!: HTMLElement;
  private header!: HTMLElement;
  private side!: HTMLElement;
  private toolbar!: HTMLElement;
  private card: HTMLElement | null = null;
  private scoreHandle: ScoreFlowHandle | null = null;
  private toggle!: DelveToggleHandle;
  private delve: DelveHandle | null = null;
  private delveDemo: DetectiveDelve | null = null;

  constructor(private host: GameHost) {
    this.ctx = host.canvas.getContext('2d')!;
    const { half, coarse } = this.w;
    this.mean = new Float32Array(half.n);
    this.sd = new Float32Array(coarse.n);
    this.priorSd = new Float32Array(coarse.n);
    this.dream = new Float32Array(coarse.n);
    this.half = layer(half.nx, half.ny);
    this.halfB = layer(half.nx, half.ny);
    this.coarse = layer(coarse.nx, coarse.ny);
    this.fog = layer(coarse.nx, coarse.ny);
    this.land = landCanvas();
    this.truth = this.w.days[this.day].t;
    this.scale = this.dayScale(this.day);
    this.gp = new GP(HYPER[this.day], [half, coarse]);
    this.dreamer = new Dreamer(this.gp, 1, rng(7));
  }

  // ---------------------------------------------------------------------------
  // lifecycle

  start(): void {
    const c = this.host.canvas;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointerleave', this.onLeave);
    c.addEventListener('contextmenu', this.onContext);
    window.addEventListener('pointerup', this.onUp);
    this.buildUI();
    this.setDay(this.day);
  }

  destroy(): void {
    const c = this.host.canvas;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('pointerleave', this.onLeave);
    c.removeEventListener('contextmenu', this.onContext);
    window.removeEventListener('pointerup', this.onUp);
    this.scoreHandle?.dispose();
    this.delve?.dispose();
  }

  frame(dt: number): void {
    this.time += dt;
    const { dpr } = this.host;
    const W = this.host.canvas.width / dpr;
    const H = this.host.canvas.height / dpr;
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.delve && this.delveDemo) {
      this.delveDemo.frame(ctx, W, H, dt);
      return;
    }
    this.updateLayout(W, H);
    this.updateModel();
    if (this.phase === 'reveal') this.revealT += dt;
    if (this.autoRevealAt > 0 && this.time >= this.autoRevealAt) {
      this.autoRevealAt = -1;
      this.reveal();
    }

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0b1a33');
    bg.addColorStop(1, '#07101f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    this.drawMap(ctx);
    this.drawCities(ctx);
    this.drawStations(ctx);
    this.drawRevealMarks(ctx);
    this.drawProbe(ctx);
    this.drawLegendAndHint(ctx);
  }

  // ---------------------------------------------------------------------------
  // model

  private dayScale(day: DayId): Scale {
    const d = this.w.days[day];
    return { lo: d.lo - 1, hi: d.hi + 1 };
  }

  private truthScale(truth: Float32Array): Scale {
    const st = landStats(truth);
    return { lo: Math.floor(st.min) - 1, hi: Math.ceil(st.max) + 1 };
  }

  private refit(): void {
    this.fitDirty = true;
  }

  private updateModel(): void {
    if (this.fitDirty) {
      this.fitDirty = false;
      const live = listened(this.stations);
      this.gp.setObs(live);
      this.gp.meanGrid(0, this.mean);
      this.sdDirty = true;
      this.loo = this.mode === 'case' && this.def.id === 'liars' ? this.gp.loo() : null;
    }
    const now = performance.now();
    // The spread is the expensive part; with many stations, refresh it at most
    // a few times per second while someone drags.
    if (this.sdDirty && (this.gp.n < 60 || now - this.lastSd > 250)) {
      this.gp.sdGrid(1, this.sd, this.w.coarse.land);
      this.sdDirty = false;
      this.lastSd = now;
    }
  }

  private resetPrior(): void {
    const { coarse } = this.w;
    for (let k = 0; k < coarse.n; k++) this.priorSd[k] = Math.sqrt(this.gp.priorVar(coarse.u[k], coarse.w[k]));
  }

  // ---------------------------------------------------------------------------
  // free play

  private setDay(day: DayId): void {
    this.mode = 'free';
    this.day = day;
    this.truth = this.w.days[day].t;
    this.scale = this.dayScale(day);
    const homes = this.stations.some((s) => s.home);
    // Keep the thermometers where they are; they now read the new day.
    this.stations = this.stations
      .filter((s) => !s.home)
      .map((s) => makeStation(this.truth, s.x, s.y, s.kind, rng(Math.round(s.x * 1000 + s.y))));
    this.placedAt.clear();
    this.gp = new GP(freePlayHyper(day), [this.w.half, this.w.coarse]);
    this.dreamer = new Dreamer(this.gp, 1, rng(DAY_IDS.indexOf(day) + 11));
    this.resetPrior();
    if (homes) this.addHomes();
    this.refit();
    this.renderUI();
  }

  private addHomes(): void {
    const r = rng(1234 + DAY_IDS.indexOf(this.day));
    for (let i = 0; i < HOME_COUNT; i++) {
      const p = randomLand(r, true);
      const s = makeStation(this.truth, p.x, p.y, 'home', r, r() < 0.03);
      this.stations.push(s);
      this.placedAt.set(s, this.time + Math.random() * 1.2);
    }
    this.refit();
  }

  private addKnmi(): void {
    const r = rng(42);
    for (const [lon, lat] of KNMI_STATIONS) {
      let p = lonLatToKm(lon, lat);
      if (!onLand(p.x, p.y)) {
        // Coastal stations: nudge onto the nearest land within a few km.
        let found = false;
        for (let d = 1; d <= 6 && !found; d++)
          for (let a = 0; a < 8 && !found; a++) {
            const q = { x: p.x + d * Math.cos((a * Math.PI) / 4), y: p.y + d * Math.sin((a * Math.PI) / 4) };
            if (onLand(q.x, q.y)) {
              p = q;
              found = true;
            }
          }
        if (!found) continue;
      }
      if (this.stations.some((s) => !s.home && Math.hypot(s.x - p.x, s.y - p.y) < 3)) continue;
      const s = makeStation(this.truth, p.x, p.y, 'official', r);
      this.stations.push(s);
      this.placedAt.set(s, this.time + Math.random() * 0.8);
    }
    this.refit();
  }

  // ---------------------------------------------------------------------------
  // challenge

  private startChallenge(): void {
    this.total = 0;
    this.openCase(0);
  }

  private openCase(i: number): void {
    this.mode = 'case';
    this.caseIndex = i;
    this.def = CASES[i];
    const seed = 1 + Math.floor(Math.random() * 100000);
    const { truth } = caseTruth(this.def, seed);
    this.truth = truth;
    this.scale = this.truthScale(truth);
    this.gp = newGP(this.def);
    this.dreamer = new Dreamer(this.gp, 1, rng(seed));
    this.resetPrior();
    this.stations = this.def.id === 'liars' ? liarStations(truth, seed) : [];
    this.placedAt.clear();
    for (const s of this.stations) this.placedAt.set(s, this.time + Math.random() * 1.2);
    this.view = 'guess';
    this.peek = false;
    this.phase = 'intro';
    this.revealView = 'truth';
    this.cpuMean = null;
    this.errField = null;
    this.autoRevealAt = -1;
    // The computer plays the same case while the intro card is up.
    if (this.def.id === 'hottest') this.cpu = computerHottest(this.def, truth, seed);
    else if (this.def.id === 'map') {
      this.cpu = computerMap(this.def, truth, seed);
      const gp = newGP(this.def);
      gp.setObs(this.cpu);
      this.cpuMean = mapGuess(gp);
    } else this.cpu = computerLiars(this.def, this.stations);
    this.refit();
    this.renderUI();
  }

  private placedCount(): number {
    return this.stations.filter((s) => !s.home).length;
  }

  private accusations(): number {
    return this.stations.filter((s) => s.ignored).length;
  }

  private reveal(): void {
    if (this.phase !== 'play') return;
    this.phase = 'reveal';
    this.revealT = 0;
    this.updateModel();
    if (this.def.id === 'map') {
      const { half } = this.w;
      this.errField = new Float32Array(half.n);
      for (let k = 0; k < half.n; k++) this.errField[k] = Number.isNaN(this.truth[k]) ? NaN : Math.abs(this.mean[k] - this.truth[k]);
    }
    this.renderUI();
  }

  private caseResult(): { lines: string[]; points: number } {
    const t = text();
    if (this.def.id === 'hottest') {
      const you = hottestPoints(this.truth, this.stations);
      const cpu = hottestPoints(this.truth, this.cpu);
      return { lines: t.hottestResult(you.best, you.max, cpu.best), points: you.points };
    }
    if (this.def.id === 'map') {
      const you = mapError(this.truth, this.mean);
      const cpu = mapError(this.truth, this.cpuMean!);
      return { lines: t.mapResult(you.mae, cpu.mae), points: mapPoints(you.mae, you.flat) };
    }
    const you = liarPoints(this.stations);
    const cpu = liarPoints(this.cpu);
    return { lines: t.liarsResult(you.caught, LIARS, you.wrong, cpu.caught, cpu.wrong), points: you.points };
  }

  private nextCase(points: number): void {
    this.total += points;
    if (this.caseIndex + 1 < CASES.length) {
      this.openCase(this.caseIndex + 1);
      return;
    }
    this.closeCard();
    const t = text();
    this.scoreHandle?.dispose();
    this.scoreHandle = scoreFlow({
      gameId: 'detective',
      heading: t.totalHeading,
      score: this.total,
      scoreLabel: t.totalLabel(this.total),
      actions: [
        { label: t.playAgain, onClick: () => { this.scoreHandle?.dispose(); this.scoreHandle = null; this.startChallenge(); } },
        { label: t.backToFree, onClick: () => { this.scoreHandle?.dispose(); this.scoreHandle = null; this.backToFree(); } },
      ],
    });
    this.host.overlay.appendChild(this.scoreHandle.element);
  }

  private backToFree(): void {
    this.stations = [];
    this.view = 'dream';
    this.phase = 'intro';
    this.setDay(this.day);
  }

  // ---------------------------------------------------------------------------
  // input

  private toKm(p: { x: number; y: number }): { x: number; y: number } {
    const { ox, oy, s } = this.layout;
    return { x: (p.x - ox) / s, y: (p.y - oy) / s };
  }

  private toPx(x: number, y: number): { x: number; y: number } {
    const { ox, oy, s } = this.layout;
    return { x: ox + x * s, y: oy + y * s };
  }

  private thermoSize(): number {
    return Math.max(30, Math.min(58, this.layout.s * 13));
  }

  private houseSize(): number {
    return Math.max(9, Math.min(16, this.layout.s * 4));
  }

  private hitStation(p: { x: number; y: number }): Station | null {
    const h = this.thermoSize();
    const hs = this.houseSize();
    let best: Station | null = null;
    let bestD = Infinity;
    for (const s of this.stations) {
      const q = this.toPx(s.x, s.y);
      let d: number;
      if (s.home) d = Math.hypot(p.x - q.x, p.y - q.y) <= hs * 1.1 ? Math.hypot(p.x - q.x, p.y - q.y) : Infinity;
      else {
        const inside = Math.abs(p.x - q.x) < h * 0.3 && p.y > q.y - h && p.y < q.y + 4;
        d = inside ? Math.abs(p.x - q.x) + Math.abs(p.y - (q.y - h / 2)) * 0.3 : Infinity;
      }
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  private onDown = (e: PointerEvent) => {
    if (this.delve || this.card || this.scoreHandle) return;
    const p = pointerPos(this.host.canvas, e);
    this.pointer = p;
    const km = this.toKm(p);
    const hit = this.hitStation(p);

    if (this.mode === 'free') {
      if (e.button === 2) {
        if (hit) this.removeStation(hit);
        return;
      }
      if (hit && !hit.home) {
        this.drag = { station: hit, offset: hit.value - sampleHalf(this.truth, hit.x, hit.y) };
        this.host.canvas.setPointerCapture(e.pointerId);
        return;
      }
      if (onLand(km.x, km.y) && this.placedCount() < MAX_OFFICIAL) {
        const s = this.place(km.x, km.y, 'official');
        this.drag = { station: s, offset: s.value - sampleHalf(this.truth, s.x, s.y) };
        this.host.canvas.setPointerCapture(e.pointerId);
      }
      return;
    }

    if (this.phase !== 'play') return;
    if (this.def.id === 'liars') {
      if (hit && hit.home) {
        if (hit.ignored) hit.ignored = false;
        else if (this.accusations() < ACCUSATIONS) hit.ignored = true;
        this.refit();
        this.renderUI();
      }
      return;
    }
    const limit = this.def.id === 'hottest' ? HOTTEST_THERMOMETERS : MAP_THERMOMETERS;
    if (onLand(km.x, km.y) && this.placedCount() < limit) {
      this.place(km.x, km.y, 'official');
      this.renderUI();
      if (this.def.id === 'hottest' && this.placedCount() === limit) this.autoRevealAt = this.time + 1.4;
    }
  };

  private onMove = (e: PointerEvent) => {
    const p = pointerPos(this.host.canvas, e);
    this.pointer = p;
    if (!this.drag) return;
    const km = this.toKm(p);
    const s = this.drag.station;
    // Off the map (or on the sea) the thermometer can't read anything: it
    // hangs there until you let go, and letting go there removes it.
    if (!onLand(km.x, km.y)) return;
    const moved = makeStation(this.truth, km.x, km.y, s.kind, () => 0.5);
    s.x = moved.x;
    s.y = moved.y;
    s.u = moved.u;
    s.w = moved.w;
    s.value = sampleHalf(this.truth, km.x, km.y) + this.drag.offset;
    this.refit();
  };

  private onUp = (e: PointerEvent) => {
    if (!this.drag) return;
    const km = this.toKm(pointerPos(this.host.canvas, e));
    if (!onLand(km.x, km.y)) this.removeStation(this.drag.station);
    this.drag = null;
    this.renderUI();
  };

  private onLeave = () => {
    this.pointer = null;
  };

  private onContext = (e: Event) => e.preventDefault();

  private place(x: number, y: number, kind: Kind): Station {
    const s = makeStation(this.truth, x, y, kind, Math.random);
    this.stations.push(s);
    this.placedAt.set(s, this.time);
    this.refit();
    return s;
  }

  private removeStation(s: Station): void {
    this.stations = this.stations.filter((o) => o !== s);
    this.refit();
    this.renderUI();
  }

  // ---------------------------------------------------------------------------
  // drawing

  private updateLayout(W: number, H: number): void {
    const key = `${W}x${H}x${this.host.dpr}`;
    if (key === this.layout.key) return;
    const narrow = W < 800;
    const top = narrow ? 70 : 96;
    const bottom = narrow ? 110 : 84;
    const right = narrow ? 70 : Math.min(360, W * 0.27);
    const left = narrow ? 12 : 40;
    const s = Math.max(0.5, Math.min((H - top - bottom) / HEIGHT_KM, (W - right - left - 70) / WIDTH_KM));
    const mw = WIDTH_KM * s, mh = HEIGHT_KM * s;
    const ox = left + (W - right - left - 70 - mw) / 2;
    const oy = top + (H - top - bottom - mh) / 2;
    this.layout = { ox, oy, s, mw, mh, key };
    const dpr = this.host.dpr;
    this.mapCanvas.width = Math.ceil(mw * dpr);
    this.mapCanvas.height = Math.ceil(mh * dpr);
    // A soft glow around the land, rendered once per size.
    const pad = 30;
    this.glow.width = Math.ceil((mw + 2 * pad) * dpr);
    this.glow.height = Math.ceil((mh + 2 * pad) * dpr);
    const g = this.glow.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, mw + 2 * pad, mh + 2 * pad);
    g.shadowColor = 'rgba(140, 200, 255, 0.55)';
    g.shadowBlur = 18;
    g.imageSmoothingEnabled = true;
    for (let i = 0; i < 2; i++) g.drawImage(this.land, pad, pad, mw, mh);
  }

  /** Draw a grid layer onto the map canvas, scaled to its true extent. */
  private blit(l: Layer, grid: { nx: number; ny: number; dx: number; dy: number }): void {
    const { s } = this.layout;
    const dpr = this.host.dpr;
    this.mapCtx.drawImage(l.canvas, 0, 0, grid.nx * grid.dx * s * dpr, grid.ny * grid.dy * s * dpr);
  }

  private drawMap(ctx: CanvasRenderingContext2D): void {
    const { half, coarse } = this.w;
    const { ox, oy, mw, mh } = this.layout;
    const m = this.mapCtx;
    const dpr = this.host.dpr;
    ctx.drawImage(this.glow, ox - 30, oy - 30, mw + 60, mh + 60);
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.globalCompositeOperation = 'source-over';
    m.clearRect(0, 0, this.mapCanvas.width, this.mapCanvas.height);
    m.imageSmoothingEnabled = true;
    m.imageSmoothingQuality = 'high';

    const revealing = this.mode === 'case' && this.phase === 'reveal';
    const showTruth = this.peek || (revealing && this.revealView === 'truth');

    if (revealing && this.revealView !== 'truth') {
      const field = this.revealView === 'computer' ? this.cpuMean : this.revealView === 'guess' ? this.mean : null;
      if (field) paintField(this.half.img, field, this.scale, half.land);
      else paintError(this.half.img, this.errField ?? new Float32Array(half.n), 2);
      this.half.ctx.putImageData(this.half.img, 0, 0);
      this.blit(this.half, half);
    } else if (this.view === 'dream' && !showTruth) {
      this.dreamer.sample(this.time, this.dream);
      paintField(this.coarse.img, this.dream, this.scale, coarse.land, false);
      this.coarse.ctx.putImageData(this.coarse.img, 0, 0);
      // Dreams are soft by nature: blur away the coarse grid.
      m.filter = `blur(${(0.6 * this.layout.s * dpr).toFixed(1)}px)`;
      this.blit(this.coarse, coarse);
      m.filter = 'none';
    } else {
      paintField(this.half.img, this.mean, this.scale, half.land);
      this.half.ctx.putImageData(this.half.img, 0, 0);
      this.blit(this.half, half);
      if (!showTruth || revealing) {
        paintFog(this.fog.img, this.sd, this.priorSd, coarse.nx, this.time);
        this.fog.ctx.putImageData(this.fog.img, 0, 0);
        this.blit(this.fog, coarse);
      }
    }

    if (showTruth) {
      paintField(this.halfB.img, this.truth, this.scale, half.land);
      this.halfB.ctx.putImageData(this.halfB.img, 0, 0);
      // During the reveal the real map wipes in from the west.
      const wipe = revealing ? Math.min(1, this.revealT / 1.3) : 1;
      m.save();
      m.beginPath();
      m.rect(0, 0, this.mapCanvas.width * wipe, this.mapCanvas.height);
      m.clip();
      this.blit(this.halfB, half);
      m.restore();
      if (wipe < 1) {
        m.fillStyle = 'rgba(255,255,255,0.9)';
        m.fillRect(this.mapCanvas.width * wipe - 2 * dpr, 0, 4 * dpr, this.mapCanvas.height);
      }
    }

    m.globalCompositeOperation = 'destination-in';
    m.drawImage(this.land, 0, 0, this.mapCanvas.width, this.mapCanvas.height);
    m.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.mapCanvas, ox, oy, mw, mh);
  }

  private drawCities(ctx: CanvasRenderingContext2D): void {
    const size = Math.max(10, Math.min(14, this.layout.s * 3.2));
    ctx.save();
    ctx.font = `600 ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const c of CITIES) {
      const km = lonLatToKm(c.lon, c.lat);
      const p = this.toPx(km.x, km.y);
      ctx.fillStyle = 'rgba(15, 20, 35, 0.85)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(10, 14, 26, 0.6)';
      ctx.strokeText(c.name, p.x + 5, p.y);
      ctx.fillStyle = 'rgba(245, 248, 255, 0.85)';
      ctx.fillText(c.name, p.x + 5, p.y);
    }
    ctx.restore();
  }

  private drawStations(ctx: CanvasRenderingContext2D): void {
    const h = this.thermoSize();
    const hs = this.houseSize();
    const t = text();
    const revealing = this.mode === 'case' && this.phase === 'reveal';
    const hover = this.pointer && !this.drag ? this.hitStation(this.pointer) : null;
    const fill = (v: number) => (v - this.scale.lo) / (this.scale.hi - this.scale.lo);
    // Home stations first (small), thermometers on top.
    for (const s of this.stations) {
      if (!s.home) continue;
      const p = this.toPx(s.x, s.y);
      const age = this.time - (this.placedAt.get(s) ?? -10);
      if (age < 0) continue;
      const drop = age < 0.4 ? (1 - age / 0.4) ** 2 * 40 : 0;
      let ring: string | undefined;
      let cross = false;
      if (revealing && this.def.id === 'liars') {
        if (s.liar) ring = s.ignored ? '#4ade80' : '#ff4d4d';
        cross = s.ignored && !s.liar;
      } else if (s.ignored) cross = true;
      drawHouse(ctx, p.x, p.y - drop, hs, tempColor(s.value, this.scale), { grey: s.ignored, ring, cross });
    }
    for (const s of this.stations) {
      if (s.home) continue;
      const p = this.toPx(s.x, s.y);
      const age = this.time - (this.placedAt.get(s) ?? -10);
      if (age < 0) continue;
      // Drop in with a bounce, and a ripple the size of one thermometer's reach.
      const drop = age < 0.35 ? (1 - age / 0.35) ** 2 * 60 : age < 0.55 ? Math.sin(((age - 0.35) / 0.2) * Math.PI) * 6 : 0;
      if (age < 1.2 && !this.drag) {
        const r = (age / 1.2) * this.gp.hyper.ell * this.layout.s;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - age / 1.2)})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      drawThermometer(ctx, p.x, p.y - drop, h, fill(s.value), tempColor(s.value, this.scale), {
        glow: this.drag?.station === s ? 'rgba(255,255,255,0.9)' : undefined,
      });
      drawTag(ctx, t.deg(s.value), p.x, p.y - drop - h - h * 0.28, Math.max(12, h * 0.3));
    }
    if (revealing && this.def.id !== 'liars') {
      for (const s of this.cpu) {
        const p = this.toPx(s.x, s.y);
        drawThermometer(ctx, p.x, p.y, h * 0.62, fill(s.value), tempColor(s.value, this.scale), { ghost: true });
        drawTag(ctx, `🤖 ${t.deg(s.value)}`, p.x, p.y - h * 0.82, Math.max(10, h * 0.22), 'rgba(40, 60, 110, 0.85)');
      }
    }
    // Hovering a home station: its reading (and, when catching liars, what the others say).
    if (hover && hover.home) {
      const p = this.toPx(hover.x, hover.y);
      let label = t.deg(hover.value);
      if (this.loo && !hover.ignored) {
        const i = listened(this.stations).indexOf(hover);
        if (i >= 0) label = t.looTag(hover.value, this.loo.mean[i]);
      }
      drawTag(ctx, label, p.x, p.y - hs * 1.8, 14);
    }
  }

  private drawRevealMarks(ctx: CanvasRenderingContext2D): void {
    if (this.mode !== 'case' || this.phase !== 'reveal' || this.revealT < 1.3) return;
    if (this.def.id !== 'hottest') return;
    const st = landStats(this.truth);
    const { half } = this.w;
    const p = this.toPx(half.x[st.maxAt], half.y[st.maxAt]);
    const pulse = 1 + 0.15 * Math.sin(this.time * 5);
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14 * pulse, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.restore();
    drawTag(ctx, text().hottestHere(st.max), p.x, p.y + 30, 15, 'rgba(160, 20, 30, 0.92)');
  }

  private drawProbe(ctx: CanvasRenderingContext2D): void {
    const p = this.pointer;
    if (!p || this.drag || this.delve || this.card || this.scoreHandle) return;
    const km = this.toKm(p);
    if (!onLand(km.x, km.y) || this.hitStation(p)) return;
    const t = text();
    const h = this.thermoSize() * 0.8;
    if (this.mode === 'free') {
      // Toy mode: the cursor is a thermometer that reads the real weather.
      const v = sampleHalf(this.truth, km.x, km.y);
      drawThermometer(ctx, p.x, p.y + h * 0.15, h, (v - this.scale.lo) / (this.scale.hi - this.scale.lo), tempColor(v, this.scale), { ghost: true });
      drawTag(ctx, t.deg(v), p.x + h * 0.55, p.y - h * 0.55, 13, 'rgba(12,17,30,0.7)');
      return;
    }
    if (this.phase !== 'play' || this.def.id === 'liars') return;
    const { u, w } = { u: this.w.half.u[this.halfIndex(km)], w: this.w.half.w[this.halfIndex(km)] };
    const g = this.gp.predict(km.x, km.y, u, w);
    drawTag(ctx, t.guessTag(g.mean, g.sd), p.x, p.y - 26, 14, 'rgba(12,17,30,0.8)');
  }

  private halfIndex(km: { x: number; y: number }): number {
    const { half } = this.w;
    const i = Math.min(half.nx - 1, Math.max(0, Math.floor(km.x / half.dx)));
    const j = Math.min(half.ny - 1, Math.max(0, Math.floor(km.y / half.dy)));
    return j * half.nx + i;
  }

  private drawLegendAndHint(ctx: CanvasRenderingContext2D): void {
    const { ox, oy, mw, mh } = this.layout;
    const revealing = this.mode === 'case' && this.phase === 'reveal';
    if (revealing && this.revealView === 'error') drawLegendError(ctx, ox + mw + 18, oy + mh * 0.2, 14, mh * 0.6);
    else drawLegend(ctx, ox + mw + 18, oy + mh * 0.2, 14, mh * 0.6, this.scale);
    const t = text();
    let hint = '';
    if (this.peek) hint = t.hintPeek;
    else if (this.mode === 'free') hint = this.stations.length === 0 ? t.hintEmpty : this.view === 'dream' ? t.hintDream : t.hintGuess;
    else if (this.phase === 'play') hint = this.view === 'dream' ? t.hintDream : t.hintGuess;
    if (!hint) return;
    // The North Sea corner of the map is empty: the hint lives there.
    const size = Math.max(13, Math.min(19, mw * 0.034));
    ctx.save();
    ctx.font = `700 ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(240, 245, 255, 0.92)';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 6;
    const maxW = mw * 0.34;
    let line = '';
    let y = oy + mh * 0.05;
    for (const word of hint.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxW && line) {
        ctx.fillText(line, ox, y);
        y += size * 1.3;
        line = word;
      } else line = next;
    }
    ctx.fillText(line, ox, y);
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // DOM

  private buildUI(): void {
    this.ui = document.createElement('div');
    this.ui.className = 'wd-ui';
    this.header = document.createElement('header');
    this.header.className = 'wd-header';
    this.side = document.createElement('aside');
    this.side.className = 'wd-side';
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'wd-toolbar';
    this.ui.append(this.header, this.side, this.toolbar);
    this.host.overlay.appendChild(this.ui);
    this.toggle = delveToggle(() => (this.delve ? this.closeDelve() : this.openDelve()));
    this.host.overlay.appendChild(this.toggle.element);
  }

  private button(label: string, onClick: () => void, cls = ''): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `wd-button ${cls}`;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  private renderUI(): void {
    const t = text();
    // Header.
    const eyebrow = document.createElement('small');
    eyebrow.textContent = t.eyebrow;
    const title = document.createElement('h1');
    if (this.mode === 'free') {
      const d = t.days[this.day];
      title.textContent = `${d.emoji} ${d.name}`;
      const sub = document.createElement('p');
      sub.textContent = `${d.when} · ${t.freePlay}`;
      this.header.replaceChildren(eyebrow, title, sub);
    } else {
      const c = t.caseText[this.def.id];
      title.textContent = `${this.def.emoji} ${c.title}`;
      const sub = document.createElement('p');
      sub.textContent = t.caseOf(this.caseIndex + 1, CASES.length);
      this.header.replaceChildren(eyebrow, title, sub);
    }

    // Side panel.
    this.side.replaceChildren();
    const viewSwitch = document.createElement('div');
    viewSwitch.className = 'wd-switch';
    for (const v of ['dream', 'guess'] as View[]) {
      const b = this.button(v === 'dream' ? t.dreams : t.guess, () => {
        this.view = v;
        this.renderUI();
      });
      b.setAttribute('aria-pressed', String(this.view === v));
      viewSwitch.appendChild(b);
    }
    if (this.mode === 'free') {
      const about = document.createElement('p');
      about.textContent = t.aboutFree;
      const count = document.createElement('p');
      count.className = 'wd-count';
      const homes = this.stations.filter((s) => s.home).length;
      count.textContent = t.stationsLine(this.placedCount(), homes);
      const days = document.createElement('div');
      days.className = 'wd-days';
      for (const id of DAY_IDS) {
        const d = t.days[id];
        const b = this.button(`${d.emoji} ${d.name}`, () => this.setDay(id));
        b.setAttribute('aria-pressed', String(this.day === id));
        days.appendChild(b);
      }
      this.side.append(viewSwitch, days, about, count);
      if (homes > 0) {
        const bias = document.createElement('p');
        bias.className = 'wd-note';
        this.gp.setObs(listened(this.stations));
        bias.textContent = t.homeBias(this.gp.biasEstimate());
        this.side.appendChild(bias);
      }
    } else if (this.phase === 'play') {
      const c = t.caseText[this.def.id];
      const story = document.createElement('p');
      story.textContent = c.story;
      const count = document.createElement('p');
      count.className = 'wd-count';
      if (this.def.id === 'liars') count.textContent = t.accusationsLeft(ACCUSATIONS - this.accusations());
      else count.textContent = t.thermometersLeft((this.def.id === 'hottest' ? HOTTEST_THERMOMETERS : MAP_THERMOMETERS) - this.placedCount());
      this.side.append(viewSwitch, count, story);
      if (this.def.id !== 'hottest') {
        const done = this.button(this.def.id === 'map' ? t.makeMap : t.done, () => this.reveal(), 'wd-primary');
        done.disabled = this.def.id === 'map' && this.placedCount() === 0;
        this.side.appendChild(done);
      }
    } else if (this.phase === 'reveal' && this.def.id === 'map') {
      const views = document.createElement('div');
      views.className = 'wd-views';
      for (const v of ['truth', 'guess', 'computer', 'error'] as RevealView[]) {
        const b = this.button(t.views[v], () => {
          this.revealView = v;
          this.renderUI();
        });
        b.setAttribute('aria-pressed', String(this.revealView === v));
        views.appendChild(b);
      }
      this.side.appendChild(views);
    }

    // Toolbar (free play only).
    this.toolbar.replaceChildren();
    if (this.mode === 'free') {
      const tools = document.createElement('div');
      tools.className = 'wd-tools';
      const homes = this.stations.some((s) => s.home);
      tools.append(
        this.button(homes ? t.homesRemove : t.homesAdd, () => {
          if (homes) {
            this.stations = this.stations.filter((s) => !s.home);
            this.refit();
          } else this.addHomes();
          this.renderUI();
        }),
        this.button(t.knmi, () => {
          this.addKnmi();
          this.renderUI();
        }),
        this.peekButton(t.peek),
        this.button(t.clear, () => {
          this.stations = [];
          this.refit();
          this.renderUI();
        }),
      );
      const go = this.button(t.cases, () => this.startChallenge(), 'wd-primary');
      this.toolbar.append(tools, go);
    }

    // Cards.
    this.closeCard();
    if (this.mode === 'case' && this.phase === 'intro') this.showIntro();
    if (this.mode === 'case' && this.phase === 'reveal') this.showResult();
  }

  private peekButton(label: string): HTMLButtonElement {
    const b = this.button(label, () => {});
    const on = (e: Event) => {
      e.preventDefault();
      this.peek = true;
    };
    const off = () => {
      this.peek = false;
    };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointerleave', off);
    b.addEventListener('pointercancel', off);
    return b;
  }

  private closeCard(): void {
    this.card?.remove();
    this.card = null;
  }

  private showIntro(): void {
    const t = text();
    const c = t.caseText[this.def.id];
    const card = document.createElement('div');
    card.className = 'wd-card';
    const big = document.createElement('div');
    big.className = 'wd-card-emoji';
    big.textContent = this.def.emoji;
    const small = document.createElement('small');
    small.textContent = `${t.caseOf(this.caseIndex + 1, CASES.length)} · ${t.days[this.def.day].emoji} ${t.days[this.def.day].name}`;
    const h = document.createElement('h2');
    h.textContent = c.title;
    const p = document.createElement('p');
    p.textContent = c.story;
    const go = this.button(t.start, () => {
      this.phase = 'play';
      this.renderUI();
    }, 'wd-primary');
    card.append(big, small, h, p, go);
    this.card = card;
    this.host.overlay.appendChild(card);
  }

  private showResult(): void {
    const t = text();
    const { lines, points } = this.caseResult();
    const card = document.createElement('div');
    card.className = 'wd-card wd-result';
    const h = document.createElement('h2');
    h.textContent = `${this.def.emoji} ${t.caseText[this.def.id].title}`;
    const list = document.createElement('ul');
    for (const line of lines) {
      const li = document.createElement('li');
      li.textContent = line;
      list.appendChild(li);
    }
    const pts = document.createElement('div');
    pts.className = 'wd-points';
    pts.textContent = t.points(points);
    const tip = document.createElement('p');
    tip.className = 'wd-tip';
    tip.textContent = t.caseText[this.def.id].tip;
    const next = this.button(this.caseIndex + 1 < CASES.length ? t.next : t.finish, () => this.nextCase(points), 'wd-primary');
    card.append(h, list, pts, tip, next);
    // Let the wipe play before the card covers anything (first time only).
    if (this.revealT < 1.3) card.style.animationDelay = `${(1.3 - this.revealT).toFixed(2)}s`;
    this.card = card;
    this.host.overlay.appendChild(card);
  }

  // ---------------------------------------------------------------------------
  // delve

  private openDelve(): void {
    if (this.delve) return;
    this.drag = null;
    this.peek = false;
    this.delveDemo = new DetectiveDelve();
    this.delve = delvePanel({
      heading: text().delveHeading,
      chapters: this.delveDemo.chapters(),
      onChapter: (i) => this.delveDemo?.setChapter(i),
      onExit: () => this.closeDelve(),
    });
    this.host.overlay.appendChild(this.delve.element);
    this.toggle.setOpen(true);
    this.ui.hidden = true;
    if (this.card) this.card.hidden = true;
    this.delveDemo.attach(this.host.canvas);
  }

  private closeDelve(): void {
    if (!this.delve) return;
    this.delve.dispose();
    this.delve = null;
    this.delveDemo?.detach();
    this.delveDemo = null;
    this.toggle.setOpen(false);
    this.ui.hidden = false;
    if (this.card) this.card.hidden = false;
  }
}

/**
 * Free play dreams a little wilder than the cases: a wider "no idea" spread
 * makes unmeasured places swing through the whole colour scale.
 */
function freePlayHyper(day: DayId) {
  const h = HYPER[day];
  return { ...h, c: h.c * 1.5, theta: h.theta * 1.8 };
}

function drawLegendError(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, y + h, 0, y);
  g.addColorStop(0, 'rgb(255,245,235)');
  g.addColorStop(1, 'rgb(195,30,30)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, w / 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(235, 240, 250, 0.9)';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('0°', x + w + 8, y + h);
  ctx.fillText('2°+', x + w + 8, y);
  ctx.restore();
}
