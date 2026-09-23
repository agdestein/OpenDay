// The "How does this work?" chapters for Save the Netherlands. The shared panel
// shows the text; this module draws each chapter's live picture on the game's
// canvas, next to the panel, and drives the game's lens and storm where needed.
import type { DelveChapter } from '../../shell/delve';
import { FloodSim, GRID_W as W } from './water';
import { SILL, TIME_SCALE, type Point } from './scene';
import { HEIGHT, HARBOUR, ensemble, exceedance, forecastLevel, fragilityRun, random, threatStrength, type Fragility } from './rounds';
import { drawForecast, drawStormOdds } from './charts';
import { text } from './text';

export interface DelveHost {
  sim(): FloodSim;
  /** The landscape before any sand or erosion. */
  base(): Float64Array;
  storm(): void;
  startOver(): void;
  /** Hold the X-ray lens over a grid point, or give it back to the pointer. */
  setLens(p: Point | null): void;
  /** Solver steps in the latest displayed second. */
  stepsPerSecond(): number;
}
export interface Rect { x: number; y: number; w: number; h: number }

/** Computed once and reused: the fragility of a 3 m dike (it shifts with height). */
let shared: Fragility | null = null;
export function shareFragility(f: Fragility): void { shared = f; }

const DIORAMA = [true, false, true, false, false, false, true];
/** The forecast chapter's storm: a peak at 20 s on a 24 s loop. */
const DEMO = { peak: 1.9, time: 20, loop: 24 };
const TANK = 30;

/** "Once every N years", rounded the way people say it. */
export function returnYears(fragility: Fragility, crest: number): number {
  const p = exceedance(fragility.failureStorm(crest));
  if (!(p > 1e-7)) return Infinity;
  const years = 1 / p, digits = Math.pow(10, Math.max(0, Math.floor(Math.log10(years)) - 1));
  return Math.max(1, Math.round(years / digits) * digits);
}

export class FloodDelve {
  chapter = 0;
  private time = 0;
  private tank = new FloodSim(TANK, 1);
  private pourTimer = 0;
  private crest = 2.5;
  private computing: Generator<{ run: number }, Fragility> | null = null;
  private run = 0;
  private members = ensemble(random(7), 1);
  constructor(private host: DelveHost) {
    this.tank.ocean = false;
    for (let x = 0; x < TANK; x++) this.tank.terrain[x] = x >= 14 && x <= 16 ? .3 : 0;
    this.fillTank();
  }
  get diorama(): boolean { return DIORAMA[this.chapter]; }

  chapters(): DelveChapter[] {
    const t = text();
    return t.chapters.map((ch, k) => ({
      title: ch.title, paragraphs: ch.paragraphs, formula: ch.formula,
      extras: k === 1 ? host => this.button(host, `💧 ${t.pour}`, () => this.pour())
        : k === 2 ? host => this.button(host, `🌊 ${t.storm}`, () => this.host.storm())
        : k === 3 ? host => { this.button(host, `🌊 ${t.storm}`, () => this.host.storm()); this.button(host, `🧹 ${t.startOver}`, () => this.host.startOver()); }
        : k === 4 ? host => this.slider(host)
        : undefined,
    }));
  }
  setChapter(k: number): void {
    this.chapter = k;
    this.host.setLens(null);
    if (k === 1) { this.fillTank(); this.pour(); }
    if (k === 4 && !shared && !this.computing) { this.computing = fragilityRun(3); this.run = 0; }
  }
  dispose(): void { this.host.setLens(null); this.computing = null; }

  private button(host: HTMLElement, label: string, onClick: () => void): void {
    const b = document.createElement('button'); b.className = 'arcade-button'; b.textContent = label;
    b.addEventListener('click', onClick); host.appendChild(b);
  }
  private slider(host: HTMLElement): void {
    const label = document.createElement('label'); label.className = 'delta-delve-slider';
    const name = document.createElement('span'); name.textContent = text().dikeHeight;
    const input = document.createElement('input'); input.type = 'range';
    input.min = String(HEIGHT.min); input.max = String(HEIGHT.max); input.step = '0.05'; input.value = String(this.crest);
    const value = document.createElement('strong'); value.textContent = `${this.crest.toFixed(2)} m`;
    input.addEventListener('input', () => { this.crest = Number(input.value); value.textContent = `${this.crest.toFixed(2)} m`; });
    label.append(name, input, value); host.appendChild(label);
  }
  private fillTank(): void {
    this.tank.water.fill(0); this.tank.mx.fill(0); this.tank.my.fill(0);
    for (let x = 0; x < TANK; x++) this.tank.water[x] = Math.max(0, .5 - this.tank.terrain[x]);
  }
  private pour(): void {
    for (let x = 0; x < 5; x++) this.tank.water[x] += 1.4 * (1 - x / 6);
    this.pourTimer = 0;
  }

  frame(dt: number): void {
    this.time += dt;
    if (this.chapter === 0) {
      const t = this.time;
      this.host.setLens({ x: 30 + 12 * Math.sin(t * .35), y: 20 + 9 * Math.sin(t * .23 + 1) });
    }
    if (this.chapter === 1) {
      this.pourTimer += dt;
      if (this.pourTimer > 7) this.pour();
      this.tank.advance(dt * 12);
    }
    if (this.computing) {
      const start = performance.now();
      while (performance.now() - start < 6) {
        const r = this.computing.next();
        if (r.done) { shared = r.value; this.computing = null; break; }
        this.run = r.value.run;
      }
    }
  }

  draw(c: CanvasRenderingContext2D, r: Rect): void {
    const t = text();
    c.save();
    if (this.chapter === 1) this.drawTank(c, r);
    if (this.chapter === 2) {
      const steps = this.host.stepsPerSecond();
      const box = { x: r.x + r.w / 2 - 210, y: r.y + 6, w: 420, h: 74 };
      c.fillStyle = '#0b202bdd'; c.strokeStyle = '#547079';
      c.beginPath(); c.roundRect(box.x, box.y, box.w, box.h, 12); c.fill(); c.stroke();
      c.fillStyle = '#eaf3ee'; c.textAlign = 'center'; c.font = '800 22px system-ui';
      c.fillText(t.steps(steps), box.x + box.w / 2, box.y + 32);
      c.font = '600 14px system-ui'; c.fillStyle = '#9fc3c3';
      c.fillText(t.stepSize(steps ? (TIME_SCALE / steps).toFixed(2) : '–'), box.x + box.w / 2, box.y + 56);
    }
    if (this.chapter === 3) this.drawSection(c, r);
    if (this.chapter === 5) this.drawForecastDemo(c, r);
    if (this.chapter === 4) {
      const pad = { l: 70, r: 30, t: 70, b: 60 };
      if (shared) {
        drawStormOdds(c, r.x + pad.l, r.y + pad.t, r.w - pad.l - pad.r, r.h - pad.t - pad.b, shared, this.crest,
          { storm: t.chart.storm, often: t.chart.often, homes: t.chart.homes, dike: t.chart.dike });
        c.fillStyle = '#eaf3ee'; c.font = '800 20px system-ui'; c.textAlign = 'center';
        c.fillText(t.returnPeriod(returnYears(shared, this.crest)), r.x + r.w / 2, r.y + 36);
      } else {
        c.fillStyle = '#eaf3ee'; c.font = '700 18px system-ui'; c.textAlign = 'center';
        c.fillText(t.computing(this.run + 1, 6), r.x + r.w / 2, r.y + r.h / 2);
      }
    }
    c.restore();
  }

  /** A storm coming on a loop: the 20 forecasts close in on it as it nears. */
  private drawForecastDemo(c: CanvasRenderingContext2D, r: Rect): void {
    const t = text(), now = this.time % DEMO.loop, threat = [{ peak: DEMO.peak, time: DEMO.time }];
    const times: number[] = [], past: { t: number; level: number }[] = [];
    for (let k = 0; k <= 40; k++) times.push(now + k * .5);
    for (let tt = Math.max(0, now - 8); tt <= now; tt += .25) past.push({ t: tt, level: DEMO.peak * threatStrength(tt - DEMO.time) });
    const members = this.members.map(m => times.map(tt => forecastLevel(tt, now, threat, m)));
    drawForecast(c, r.x + 60, r.y + 70, r.w - 90, r.h - 130, now, past, times, members, HARBOUR.quay, { quay: t.forecastQuay, now: t.forecastNow });
    const over = members.filter(m => m.some(v => v > HARBOUR.quay)).length;
    c.fillStyle = over ? '#ff9d8a' : '#eaf3ee'; c.font = '800 20px system-ui'; c.textAlign = 'center';
    c.fillText(t.forecastSays(over, members.length), r.x + r.w / 2, r.y + 40);
  }

  /** A row of water columns seen from the side, with numbers and the flow between them. */
  private drawTank(c: CanvasRenderingContext2D, r: Rect): void {
    const n = TANK, left = r.x + 20, width = r.w - 40, cw = width / n, floorY = r.y + r.h * .75, scale = r.h * .22;
    const { terrain, water, mx } = this.tank;
    for (let x = 0; x < n; x++) {
      const gx = left + x * cw, z = terrain[x], h = water[x];
      c.fillStyle = '#7a6448'; c.fillRect(gx, floorY - z * scale, cw - 1, 30 + z * scale);
      c.fillStyle = '#4fb3c8'; c.fillRect(gx, floorY - (z + h) * scale, cw - 1, h * scale);
      c.fillStyle = '#eaf3ee'; c.font = `600 ${Math.min(12, cw * .42)}px system-ui`; c.textAlign = 'center';
      c.fillText(h.toFixed(1), gx + cw / 2, floorY - (z + h) * scale - 8);
    }
    // Flow through each wall between two columns: an arrow, longer for more water.
    for (let x = 0; x < n - 1; x++) {
      const q = (mx[x] + mx[x + 1]) / 2;
      if (Math.abs(q) < .02) continue;
      const gx = left + (x + 1) * cw - .5, level = Math.max(terrain[x] + water[x], terrain[x + 1] + water[x + 1]);
      const y = floorY - level * scale - 34, len = Math.min(cw * 1.4, 6 + Math.abs(q) * 10) * Math.sign(q);
      c.strokeStyle = '#ffe79a'; c.lineWidth = 2.5; c.beginPath();
      c.moveTo(gx - len / 2, y); c.lineTo(gx + len / 2, y);
      c.lineTo(gx + len / 2 - 6 * Math.sign(q), y - 4); c.moveTo(gx + len / 2, y); c.lineTo(gx + len / 2 - 6 * Math.sign(q), y + 4);
      c.stroke();
    }
    c.strokeStyle = '#ffffff30'; c.lineWidth = 1;
    for (let x = 0; x <= n; x++) { c.beginPath(); c.moveTo(left + x * cw - .5, r.y + r.h * .15); c.lineTo(left + x * cw - .5, floorY + 30); c.stroke(); }
  }

  /** A slice through the harbour sill: the ground as it was, as it is, and the water. */
  private drawSection(c: CanvasRenderingContext2D, r: Rect): void {
    const sim = this.host.sim(), base = this.host.base(), y = Math.round((SILL.y0 + SILL.y1) / 2);
    const x0 = 10, x1 = 36, n = x1 - x0, lo = -3, hi = 4.5;
    const left = r.x + 50, width = r.w - 80, top = r.y + 60, height = r.h - 120;
    const X = (x: number) => left + (x - x0) / n * width, Z = (z: number) => top + (hi - z) / (hi - lo) * height;
    c.fillStyle = '#9fc3c3'; c.font = '600 11px system-ui'; c.textAlign = 'right';
    for (let m = -2; m <= 4; m += 2) { c.fillText(`${m} m`, left - 8, Z(m) + 4); c.strokeStyle = '#ffffff18'; c.beginPath(); c.moveTo(left, Z(m)); c.lineTo(left + width, Z(m)); c.stroke(); }
    for (let x = x0; x < x1; x++) {
      const i = y * W + x, z = sim.terrain[i], h = sim.water[i], wear = sim.wear[i] > 2e-4;
      c.fillStyle = z < base[i] - .05 ? '#8a6a45' : z > base[i] + .05 ? '#d9b86e' : '#7d9460';
      c.fillRect(X(x), Z(z), X(x + 1) - X(x) + .5, Z(lo) - Z(z));
      if (h > .01) { c.fillStyle = '#4fb3c8cc'; c.fillRect(X(x), Z(z + h), X(x + 1) - X(x) + .5, Z(z) - Z(z + h)); }
      if (wear) { c.strokeStyle = '#ff6e5a'; c.lineWidth = 3; c.strokeRect(X(x) + 1.5, Z(z) - 1.5, X(x + 1) - X(x) - 3, 5); }
    }
    c.strokeStyle = '#f1dfb9'; c.lineWidth = 2; c.setLineDash([5, 4]); c.beginPath();
    for (let x = x0; x < x1; x++) { const z = base[y * W + x]; c.lineTo(X(x), Z(z)); c.lineTo(X(x + 1), Z(z)); }
    c.stroke(); c.setLineDash([]);
  }
}
