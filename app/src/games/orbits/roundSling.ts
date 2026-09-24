// Challenge round "Slingshot" (model in sling.ts): launch probes from Earth to
// the golden ring. Earth's rockets are too weak to get there alone; flying
// close behind the moving giant lends a probe the speed it lacks. The
// forecast flies the whole trip, so finding a way is a search: wiggle, wait
// for the giant to come round, and launch when the line reaches the ring.
// Stuck? "🤖 Computer, fly one" spends a probe on the computer's search: time
// stops while it tries every direction at a few strengths (drawn as a fan of
// routes), then it flies the gentlest one that arrives, for half the points.
// In the computer's turn it plays the whole round that way.
import { pick, type Localized } from '../../lib/i18n';
import { sound } from '../../lib/sound';
import { randRange } from '../../lib/util';
import { arrow, label } from './draw';
import { TICK } from './physics';
import { drawBodies, drawPath, PACE, Poofs, Trails } from './scene';
import type { Round, RoundHost } from './rounds';
import { bestRoute, candidates, CPU_SLING, HELP_SLING, SLING, SlingSim, type Route, type SlingOutcome } from './sling';
import { setLabel } from './rounds';

const TEXT: Localized<{
  title: string;
  hint: string;
  hintNone: string;
  ring: string;
  earth: string;
  time: (s: number) => string;
  left: (n: number) => string;
  arrived: (n: number) => string;
  outcome: Record<SlingOutcome, string>;
  photo: string;
  lost: string;
  ask: string;
  trying: (i: number, n: number) => string;
  noRoute: string;
  found: string;
  cpu: string;
  summary: (arrived: number, photos: number, helped: number) => string;
}> = {
  en: {
    title: '🚀 Slingshot',
    hint: "Drag to launch a probe from Earth to the golden ring. Earth's rockets are too weak to get there alone: fly close past the giant to borrow its speed! Stuck? 🤖 lets the computer try.",
    hintNone: 'No probes left: watch them fly…',
    ring: '🎯 the golden ring',
    earth: 'Earth',
    time: (s) => `⏱ ${s} s`,
    left: (n) => `🚀 ${n} left`,
    arrived: (n) => `🎯 ${n}`,
    outcome: { arrive: '🎯 it gets there!', crash: '💥 crash', short: 'not far enough…' },
    photo: '📸 +50',
    lost: 'lost in space…',
    ask: 'Computer, fly one',
    trying: (i, n) => `🤖 trying routes: ${i} of ${n}…`,
    noRoute: '🤖 no route right now — waiting for the planets to move…',
    found: '🤖 this one!',
    cpu: '🤖 Before every launch the computer tries 48 routes, and flies the gentlest one that arrives.',
    summary: (a, p, h) =>
      `${a} ${a === 1 ? 'probe' : 'probes'} reached the ring${h > 0 ? ` (${h} flown by the computer)` : ''}, ${p} ${p === 1 ? 'photo' : 'photos'} of the giant. That is a gravity slingshot: the probe steals a little of the giant's speed. Voyager toured the outer planets this way, and ESA's JUICE is using flybys of the Moon, Earth and Venus on its way to Jupiter.`,
  },
  nl: {
    title: '🚀 Katapult',
    hint: 'Sleep om een sonde van de Aarde naar de gouden ring te lanceren. De raketten van de Aarde zijn te zwak om er alleen te komen: vlieg vlak langs de reus om zijn snelheid te lenen! Lukt het niet? 🤖 laat de computer het proberen.',
    hintNone: 'Geen sondes meer: kijk hoe ze vliegen…',
    ring: '🎯 de gouden ring',
    earth: 'Aarde',
    time: (s) => `⏱ ${s} s`,
    left: (n) => `🚀 nog ${n}`,
    arrived: (n) => `🎯 ${n}`,
    outcome: { arrive: '🎯 hij komt er!', crash: '💥 botsing', short: 'niet ver genoeg…' },
    photo: '📸 +50',
    lost: 'verdwaald in de ruimte…',
    ask: 'Computer, vlieg er een',
    trying: (i, n) => `🤖 routes proberen: ${i} van ${n}…`,
    noRoute: '🤖 nu even geen route — wachten tot de planeten verder zijn…',
    found: '🤖 deze!',
    cpu: '🤖 Voor elke lancering probeert de computer 48 routes, en vliegt de zachtste die aankomt.',
    summary: (a, p, h) =>
      `${a} ${a === 1 ? 'sonde bereikte' : 'sondes bereikten'} de ring${h > 0 ? ` (${h} gevlogen door de computer)` : ''}, ${p} ${p === 1 ? "foto" : "foto's"} van de reus. Dat is een zwaartekrachtkatapult: de sonde steelt een beetje van de snelheid van de reus. Voyager bezocht zo de buitenste planeten, en ESA's JUICE gebruikt scheervluchten langs de Maan, de Aarde en Venus op weg naar Jupiter.`,
  },
  no: {
    title: '🚀 Slyngeskudd',
    hint: 'Dra for å skyte opp en sonde fra Jorden til den gylne ringen. Jordens raketter er for svake til å komme dit alene: fly tett forbi kjempen for å låne farten dens! Står du fast? 🤖 lar datamaskinen prøve.',
    hintNone: 'Ingen sonder igjen: se dem fly…',
    ring: '🎯 den gylne ringen',
    earth: 'Jorden',
    time: (s) => `⏱ ${s} s`,
    left: (n) => `🚀 ${n} igjen`,
    arrived: (n) => `🎯 ${n}`,
    outcome: { arrive: '🎯 den kommer fram!', crash: '💥 krasj', short: 'ikke langt nok…' },
    photo: '📸 +50',
    lost: 'borte i rommet…',
    ask: 'Datamaskin, fly en',
    trying: (i, n) => `🤖 prøver ruter: ${i} av ${n}…`,
    noRoute: '🤖 ingen rute akkurat nå — venter til planetene har flyttet seg…',
    found: '🤖 denne!',
    cpu: '🤖 Før hver oppskyting prøver datamaskinen 48 ruter, og flyr den mildeste som kommer fram.',
    summary: (a, p, h) =>
      `${a} ${a === 1 ? 'sonde' : 'sonder'} nådde ringen${h > 0 ? ` (${h} fløyet av datamaskinen)` : ''}, ${p} ${p === 1 ? 'bilde' : 'bilder'} av kjempen. Det er et tyngdekraft-slyngeskudd: sonden stjeler litt av kjempens fart. Voyager besøkte de ytre planetene slik, og ESAs JUICE bruker forbiflyvninger av Månen, Jorden og Venus på vei til Jupiter.`,
  },
};

const OUTCOME_COLOR: Record<SlingOutcome, string> = { arrive: '#86efac', crash: '#f87171', short: 'rgba(238, 242, 255, 0.55)' };
const GOLD = '#fbbf24';
/** Drag length (units) for a full-power launch. */
const FULL_DRAG = 130;
/** The forecast keeps a point every this many steps, and shows a short-falling probe for this long. */
const FORECAST_EVERY = 6;
const SHORT_SECONDS = 4;
/** The computer's search takes about this many frames, whatever the number of routes (so the fan is seen), then shows its pick (s); when nothing arrives it waits (simulated s). */
const SEARCH_FRAMES = 40;
const SHOW_PICK = 0.8;
const RETRY_WAIT = 0.6;

interface Search {
  queue: { dvx: number; dvy: number }[];
  total: number;
  tried: Route[];
  /** For the player (half points) or the computer's own turn. */
  helped: boolean;
  /** The chosen route, shown for a moment before launch. */
  pick: Route | null;
  showFor: number;
}

interface Drag {
  x0: number;
  y0: number;
  x: number;
  y: number;
}

export class SlingRound implements Round {
  readonly title = pick(TEXT).title;
  private sim: SlingSim;
  private drag: Drag | null = null;
  private trails = new Trails(260);
  private poofs = new Poofs();
  private finished = false;
  private endTimer = 0;
  private clock = 0;
  private search: Search | null = null;
  /** Simulated seconds until the computer searches again (after "no route", or between its own launches). */
  private wait = 0;
  /** A probe the player gave the computer, still to be flown. */
  private owed = false;
  private askButton: HTMLButtonElement | null = null;

  constructor(private host: RoundHost) {
    const a = host.area();
    const R = (Math.min(a.x1 - a.x0, a.y1 - a.y0) / 2) * 0.97;
    this.sim = new SlingSim((a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2, R, host.unit(), randRange(0, 2 * Math.PI), randRange(0, 2 * Math.PI));
    if (host.auto()) {
      host.buttons([]);
      host.hint(pick(TEXT).cpu);
      this.wait = 0.3;
    } else {
      [this.askButton] = host.buttons([{ emoji: '🤖', label: pick(TEXT).ask, onClick: () => this.ask() }]);
      host.hint(pick(TEXT).hint);
    }
  }

  private ask(): void {
    if (this.owed || this.search || this.sim.left <= 0 || this.sim.time >= SLING.seconds) return;
    this.drag = null;
    this.owed = true;
    this.startSearch(true);
  }

  private startSearch(helped: boolean): void {
    const q = helped ? HELP_SLING : CPU_SLING;
    const queue = candidates(this.sim, q.dirs, q.strengths);
    this.search = { queue, total: queue.length, tried: [], helped, pick: null, showFor: 0 };
  }

  /** One frame of the computer's search (time stands still meanwhile). */
  private searchStep(dt: number): void {
    const s = this.search!;
    const T = pick(TEXT);
    if (s.pick) {
      s.showFor -= dt;
      if (s.showFor <= 0) {
        this.sim.launch(s.pick.dvx, s.pick.dvy, s.helped);
        sound.play('whoosh', { pitch: 1.3 });
        this.search = null;
        this.owed = false;
        this.wait = this.host.auto() ? CPU_SLING.pause : 0;
        if (!this.host.auto()) this.host.hint(this.sim.left === 0 ? T.hintNone : T.hint);
      }
      return;
    }
    const perFrame = Math.max(1, Math.ceil(s.total / SEARCH_FRAMES));
    for (let k = 0; k < perFrame && s.queue.length; k++) {
      const c = s.queue.shift()!;
      s.tried.push(this.sim.forecast(c.dvx, c.dvy, FORECAST_EVERY));
    }
    this.host.hint(T.trying(s.tried.length, s.total));
    if (s.queue.length) return;
    const best = bestRoute(s.tried);
    if (best) {
      s.pick = best;
      s.showFor = SHOW_PICK;
      this.host.hint(T.found);
      sound.play('ding');
    } else {
      this.search = null;
      this.wait = RETRY_WAIT;
      this.host.hint(T.noRoute);
    }
  }

  get score(): number {
    return this.sim.score;
  }

  hud(): string {
    const T = pick(TEXT);
    const s = this.sim;
    return [T.time(Math.max(0, Math.ceil((SLING.seconds - s.time) / (PACE.sling * this.host.speed())))), T.left(s.left), T.arrived(s.arrived)].join('   ·   ');
  }

  private launchVector(d: Drag): { dvx: number; dvy: number } {
    const u = this.sim.u;
    let dx = (d.x - d.x0) / (FULL_DRAG * u);
    let dy = (d.y - d.y0) / (FULL_DRAG * u);
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    return { dvx: dx * this.sim.dvMax, dvy: dy * this.sim.dvMax };
  }

  down(x: number, y: number): void {
    if (this.sim.left <= 0 || this.sim.time >= SLING.seconds || this.search || this.owed || this.host.auto()) return;
    this.drag = { x0: x, y0: y, x, y };
  }

  move(x: number, y: number): void {
    if (!this.drag) return;
    this.drag.x = x;
    this.drag.y = y;
  }

  up(): void {
    const d = this.drag;
    this.drag = null;
    if (!d || Math.hypot(d.x - d.x0, d.y - d.y0) < 6 * this.sim.u) return;
    const { dvx, dvy } = this.launchVector(d);
    if (!this.sim.launch(dvx, dvy)) return;
    sound.play('whoosh', { pitch: 1.3 });
    if (this.sim.left === 0) this.host.hint(pick(TEXT).hintNone);
  }

  private timeUp = false;

  step(dt: number): void {
    this.clock += dt;
    if (this.finished) return;
    const sim = this.sim;
    if (sim.over) {
      this.drag = null;
      this.endTimer += dt;
      if (this.endTimer > 1.2) {
        this.finished = true;
        this.host.finish(sim.score, pick(TEXT).summary(sim.arrived, sim.photos, sim.helpedArrived));
      }
      return;
    }
    const T = pick(TEXT);
    const u = sim.u;
    if (this.askButton) {
      this.askButton.disabled = !!this.search || this.owed || sim.left <= 0 || sim.time >= SLING.seconds;
      setLabel(this.askButton, T.ask);
    }
    // The computer thinking: the sky stands still until it has chosen.
    if (this.search) {
      this.searchStep(dt);
      return;
    }
    // A probe owed to the computer (after "no route"), or the computer's own turn: search again after a wait.
    if ((this.owed || this.host.auto()) && sim.left > 0 && sim.time < SLING.seconds) {
      this.wait -= dt * PACE.sling;
      if (this.wait <= 0) this.startSearch(this.owed);
    }
    if (sim.time >= SLING.seconds && !this.timeUp) {
      this.timeUp = true;
      this.drag = null;
      this.host.hint(T.hintNone);
    }
    // Slower than real time, and slower still while aiming.
    for (const e of sim.step(dt * PACE.sling * (this.drag ? PACE.aiming : 1))) {
      if (e.type === 'arrive') {
        this.host.popup(e.x, e.y - 16 * u, `🎯 +${e.points}`, GOLD);
        sound.play('cheer');
      } else if (e.type === 'photo') {
        this.host.popup(e.x, e.y - 16 * u, T.photo, '#7dd3fc');
        sound.play('tick');
      } else if (e.type === 'crash') {
        this.poofs.add(e.x, e.y, 0, 4 * u);
        sound.play(e.into === 'star' ? 'sizzle' : 'thud');
      } else {
        this.host.popup(e.x, e.y - 16 * u, T.lost, 'rgba(203, 213, 225, 0.8)');
      }
    }
    this.trails.update(sim.world);
    this.poofs.step(dt);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const sim = this.sim;
    const u = sim.u;
    const s = sim.sun;
    const T = pick(TEXT);

    // The golden ring, and faint guides for Earth's and the giant's orbits.
    const rt = SLING.targetAt * sim.R;
    ctx.beginPath();
    ctx.arc(s.x, s.y, rt, 0, Math.PI * 2);
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = this.clock * 12;
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
    ctx.lineWidth = 3 * u;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    label(ctx, T.ring, s.x, s.y - rt - 8 * u, 13 * u + 4, 'rgba(253, 230, 138, 0.9)');
    for (const f of [SLING.earthAt, SLING.giantAt]) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, f * sim.R, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    this.trails.draw(ctx, sim.world, u);
    drawBodies(ctx, sim.world, this.clock, (b) => sim.probes.has(b.id));
    for (const id of sim.probes.keys()) {
      const b = sim.world.bodies.find((x) => x.id === id);
      if (!b) continue;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(Math.atan2(b.vy, b.vx));
      ctx.beginPath();
      ctx.moveTo(7 * u, 0);
      ctx.lineTo(-5 * u, -4 * u);
      ctx.lineTo(-5 * u, 4 * u);
      ctx.closePath();
      ctx.fillStyle = '#eef2ff';
      ctx.fill();
      ctx.restore();
    }
    this.poofs.draw(ctx, u);
    const e = sim.earth;
    if (e) label(ctx, T.earth, e.x, e.y + e.r + 16 * u, 12 * u + 3, 'rgba(147, 197, 253, 0.9)');

    // The computer's search: every route tried so far, faint; its pick, in gold.
    if (this.search && e) {
      const shortPts = Math.round(SHORT_SECONDS / (FORECAST_EVERY * TICK));
      ctx.globalAlpha = this.search.pick ? 0.25 : 0.55;
      for (const r of this.search.tried) {
        const pts = r.outcome === 'short' ? r.pts.slice(0, shortPts) : r.pts;
        if (pts.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (const p of pts) ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = r.outcome === 'arrive' ? 'rgba(134, 239, 172, 0.8)' : r.outcome === 'crash' ? 'rgba(248, 113, 113, 0.45)' : 'rgba(203, 213, 225, 0.3)';
        ctx.lineWidth = r.outcome === 'arrive' ? 2 * u : 1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const p = this.search.pick;
      if (p) {
        drawPath(ctx, p.pts, GOLD, u, this.clock);
        const scale = (FULL_DRAG * u * 0.6) / sim.dvMax;
        arrow(ctx, e.x, e.y, p.dvx * scale, p.dvy * scale, GOLD, 3);
      }
    }

    // The launch being dragged: an arrow from Earth, and the whole trip ahead.
    if (this.drag && e) {
      const { dvx, dvy } = this.launchVector(this.drag);
      const f = sim.forecast(dvx, dvy, FORECAST_EVERY);
      // A probe that falls short circles for its whole flight: show only its start.
      const pts = f.outcome === 'short' ? f.pts.slice(0, Math.round(SHORT_SECONDS / (FORECAST_EVERY * TICK))) : f.pts;
      drawPath(ctx, pts, OUTCOME_COLOR[f.outcome], u, this.clock, f.outcome === 'crash');
      const scale = (FULL_DRAG * u * 0.6) / sim.dvMax;
      arrow(ctx, e.x, e.y, dvx * scale, dvy * scale, '#fde68a', 3);
      label(ctx, T.outcome[f.outcome], e.x + dvx * scale + 12 * u, e.y + dvy * scale - 10 * u, 15 * u + 4, OUTCOME_COLOR[f.outcome], 'left');
    }
  }

  dispose(): void {
    this.drag = null;
  }
}
