// Challenge round "Slingshot" (model in sling.ts): launch probes from Earth to
// the golden ring. Earth's rockets are too weak to get there alone; flying
// close behind the moving giant lends a probe the speed it lacks. The
// forecast flies the whole trip, so finding a way is a search: wiggle, wait
// for the giant to come round, and launch when the line reaches the ring.
import { pick, type Localized } from '../../lib/i18n';
import { sound } from '../../lib/sound';
import { randRange } from '../../lib/util';
import { arrow, label } from './draw';
import { TICK } from './physics';
import { drawBodies, drawPath, PACE, Poofs, Trails } from './scene';
import type { Round, RoundHost } from './rounds';
import { SLING, SlingSim, type SlingOutcome } from './sling';

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
  summary: (arrived: number, photos: number) => string;
}> = {
  en: {
    title: '🚀 Slingshot',
    hint: "Drag to launch a probe from Earth to the golden ring. Earth's rockets are too weak to get there alone: fly close past the giant to borrow its speed!",
    hintNone: 'No probes left: watch them fly…',
    ring: '🎯 the golden ring',
    earth: 'Earth',
    time: (s) => `⏱ ${s} s`,
    left: (n) => `🚀 ${n} left`,
    arrived: (n) => `🎯 ${n}`,
    outcome: { arrive: '🎯 it gets there!', crash: '💥 crash', short: 'not far enough…' },
    photo: '📸 +50',
    lost: 'lost in space…',
    summary: (a, p) =>
      `${a} ${a === 1 ? 'probe' : 'probes'} reached the ring, ${p} ${p === 1 ? 'photo' : 'photos'} of the giant. That is a gravity slingshot: the probe steals a little of the giant's speed. Voyager toured the outer planets this way, and ESA's JUICE is using flybys of the Moon, Earth and Venus on its way to Jupiter.`,
  },
  nl: {
    title: '🚀 Katapult',
    hint: 'Sleep om een sonde van de Aarde naar de gouden ring te lanceren. De raketten van de Aarde zijn te zwak om er alleen te komen: vlieg vlak langs de reus om zijn snelheid te lenen!',
    hintNone: 'Geen sondes meer: kijk hoe ze vliegen…',
    ring: '🎯 de gouden ring',
    earth: 'Aarde',
    time: (s) => `⏱ ${s} s`,
    left: (n) => `🚀 nog ${n}`,
    arrived: (n) => `🎯 ${n}`,
    outcome: { arrive: '🎯 hij komt er!', crash: '💥 botsing', short: 'niet ver genoeg…' },
    photo: '📸 +50',
    lost: 'verdwaald in de ruimte…',
    summary: (a, p) =>
      `${a} ${a === 1 ? 'sonde bereikte' : 'sondes bereikten'} de ring, ${p} ${p === 1 ? "foto" : "foto's"} van de reus. Dat is een zwaartekrachtkatapult: de sonde steelt een beetje van de snelheid van de reus. Voyager bezocht zo de buitenste planeten, en ESA's JUICE gebruikt scheervluchten langs de Maan, de Aarde en Venus op weg naar Jupiter.`,
  },
  no: {
    title: '🚀 Slyngeskudd',
    hint: 'Dra for å skyte opp en sonde fra Jorden til den gylne ringen. Jordens raketter er for svake til å komme dit alene: fly tett forbi kjempen for å låne farten dens!',
    hintNone: 'Ingen sonder igjen: se dem fly…',
    ring: '🎯 den gylne ringen',
    earth: 'Jorden',
    time: (s) => `⏱ ${s} s`,
    left: (n) => `🚀 ${n} igjen`,
    arrived: (n) => `🎯 ${n}`,
    outcome: { arrive: '🎯 den kommer fram!', crash: '💥 krasj', short: 'ikke langt nok…' },
    photo: '📸 +50',
    lost: 'borte i rommet…',
    summary: (a, p) =>
      `${a} ${a === 1 ? 'sonde' : 'sonder'} nådde ringen, ${p} ${p === 1 ? 'bilde' : 'bilder'} av kjempen. Det er et tyngdekraft-slyngeskudd: sonden stjeler litt av kjempens fart. Voyager besøkte de ytre planetene slik, og ESAs JUICE bruker forbiflyvninger av Månen, Jorden og Venus på vei til Jupiter.`,
  },
};

const OUTCOME_COLOR: Record<SlingOutcome, string> = { arrive: '#86efac', crash: '#f87171', short: 'rgba(238, 242, 255, 0.55)' };
const GOLD = '#fbbf24';
/** Drag length (units) for a full-power launch. */
const FULL_DRAG = 130;
/** The forecast keeps a point every this many steps, and shows a short-falling probe for this long. */
const FORECAST_EVERY = 6;
const SHORT_SECONDS = 4;

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

  constructor(private host: RoundHost) {
    const a = host.area();
    const R = (Math.min(a.x1 - a.x0, a.y1 - a.y0) / 2) * 0.97;
    this.sim = new SlingSim((a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2, R, host.unit(), randRange(0, 2 * Math.PI), randRange(0, 2 * Math.PI));
    host.buttons([]);
    host.hint(pick(TEXT).hint);
  }

  get score(): number {
    return this.sim.score;
  }

  hud(): string {
    const T = pick(TEXT);
    const s = this.sim;
    return [T.time(Math.max(0, Math.ceil((SLING.seconds - s.time) / PACE.sling))), T.left(s.left), T.arrived(s.arrived)].join('   ·   ');
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
    if (this.sim.left <= 0 || this.sim.time >= SLING.seconds) return;
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
        this.host.finish(sim.score, pick(TEXT).summary(sim.arrived, sim.photos));
      }
      return;
    }
    const T = pick(TEXT);
    const u = sim.u;
    if (sim.time >= SLING.seconds && !this.timeUp) {
      this.timeUp = true;
      this.drag = null;
      this.host.hint(T.hintNone);
    }
    // Slower than real time, and slower still while aiming.
    for (const e of sim.step(dt * PACE.sling * (this.drag ? PACE.aiming : 1))) {
      if (e.type === 'arrive') {
        this.host.popup(e.x, e.y - 16 * u, `🎯 +${SLING.arrive}`, GOLD);
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
