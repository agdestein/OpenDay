// Challenge round "Goldilocks" (model in zone.ts): throw planets into the
// green zone around the Sun, where water stays liquid. The longer a planet
// stays, the more life grows on it; a collision melts it all away. Planets
// pull on each other, so a crowded zone falls apart.
import { pick, type Localized } from '../../lib/i18n';
import { sound } from '../../lib/sound';
import { clamp, randRange } from '../../lib/util';
import { label } from './draw';
import { forecast, TICK } from './physics';
import { drawBodies, drawPath, launchVelocity, PACE, Poofs, Trails, type Pt } from './scene';
import type { Round, RoundHost } from './rounds';
import { ZONE, ZoneSim } from './zone';

const LIFE = ['🌱', '🌿', '🌳', '🦕'];
const FORECAST_SECONDS = 6;
const GREEN = '#86efac';

const TEXT: Localized<{
  title: string;
  hint: string;
  hintLast: string;
  hintNone: string;
  zone: string;
  time: (s: number) => string;
  left: (n: number) => string;
  melted: (n: number) => string;
  summary: (stages: string, n: number) => string;
}> = {
  en: {
    title: '🌱 Goldilocks',
    hint: 'Throw planets into the green zone: not too hot, not too cold. The longer a planet stays there, the more life grows on it — but a crash melts it all!',
    hintLast: 'Last planet! Give it a calm orbit.',
    hintNone: 'No planets left: watch life grow…',
    zone: 'the water zone',
    time: (s) => `⏱ ${s} s`,
    left: (n) => `🪐 ${n} left`,
    melted: (n) => `💥 life melted −${n}`,
    summary: (stages, n) =>
      `Life on your planets: ${stages || 'none yet'} (${n} ${n === 1 ? 'planet' : 'planets'} in the zone at the end). Planets pull on each other, so a crowded zone falls apart: a few calm orbits beat many. Astronomers look for planets in this zone around other stars — often by the wobble they give their star.`,
  },
  nl: {
    title: '🌱 Goudlokje',
    hint: 'Gooi planeten in de groene zone: niet te heet, niet te koud. Hoe langer een planeet daar blijft, hoe meer leven erop groeit — maar een botsing laat alles smelten!',
    hintLast: 'Laatste planeet! Geef hem een rustige baan.',
    hintNone: 'Geen planeten meer: kijk hoe het leven groeit…',
    zone: 'de waterzone',
    time: (s) => `⏱ ${s} s`,
    left: (n) => `🪐 nog ${n}`,
    melted: (n) => `💥 leven gesmolten −${n}`,
    summary: (stages, n) =>
      `Leven op je planeten: ${stages || 'nog niets'} (${n} ${n === 1 ? 'planeet' : 'planeten'} in de zone aan het eind). Planeten trekken aan elkaar, dus een volle zone valt uit elkaar: een paar rustige banen winnen van veel. Sterrenkundigen zoeken planeten in deze zone rond andere sterren — vaak aan de wiebel die ze hun ster geven.`,
  },
  no: {
    title: '🌱 Gullhår',
    hint: 'Kast planeter inn i den grønne sonen: ikke for varmt, ikke for kaldt. Jo lenger en planet blir der, jo mer liv vokser på den — men et krasj smelter alt!',
    hintLast: 'Siste planet! Gi den en rolig bane.',
    hintNone: 'Ingen planeter igjen: se livet vokse…',
    zone: 'vannsonen',
    time: (s) => `⏱ ${s} s`,
    left: (n) => `🪐 ${n} igjen`,
    melted: (n) => `💥 livet smeltet −${n}`,
    summary: (stages, n) =>
      `Liv på planetene dine: ${stages || 'ingenting ennå'} (${n} ${n === 1 ? 'planet' : 'planeter'} i sonen på slutten). Planeter trekker i hverandre, så en full sone faller fra hverandre: noen få rolige baner slår mange. Astronomer leter etter planeter i denne sonen rundt andre stjerner — ofte ved vaklingen de gir stjernen sin.`,
  },
};

interface Drag {
  x0: number;
  y0: number;
  x: number;
  y: number;
}

export class ZoneRound implements Round {
  readonly title = pick(TEXT).title;
  private sim: ZoneSim;
  private drag: Drag | null = null;
  private trails = new Trails(220);
  private poofs = new Poofs();
  private hue = randRange(0, 360);
  private endTimer = 0;
  private finished = false;
  private clock = 0;

  constructor(private host: RoundHost) {
    const a = host.area();
    const R = (Math.min(a.x1 - a.x0, a.y1 - a.y0) / 2) * 0.97;
    this.sim = new ZoneSim((a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2, R, host.unit(), randRange(0, 2 * Math.PI));
    host.buttons([]);
    host.hint(pick(TEXT).hint);
  }

  get score(): number {
    return this.sim.score;
  }

  hud(): string {
    const T = pick(TEXT);
    return [T.time(Math.max(0, Math.ceil((ZONE.seconds - this.sim.time) / PACE.zone))), T.left(this.sim.left)].join('   ·   ');
  }

  private velocity(d: Drag): Pt {
    return launchVelocity(this.sim.world, 2 * this.sim.R, d.x0, d.y0, d.x, d.y);
  }

  down(x: number, y: number): void {
    if (this.sim.left <= 0 || this.sim.over) return;
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
    if (!d) return;
    const v = this.velocity(d);
    if (!this.sim.throw(d.x0, d.y0, v.x, v.y, this.hue)) return;
    this.hue = randRange(0, 360);
    sound.play('whoosh', { pitch: 1.1 });
    const T = pick(TEXT);
    const left = this.sim.left;
    this.host.hint(left === 1 ? T.hintLast : left === 0 ? T.hintNone : T.hint);
  }

  step(dt: number): void {
    this.clock += dt;
    if (this.finished) return;
    const sim = this.sim;
    if (sim.over) {
      this.drag = null;
      this.endTimer += dt;
      if (this.endTimer > 1.2) this.finish();
      return;
    }
    const u = sim.u;
    // Slower than real time, and slower still while aiming.
    for (const e of sim.step(dt * PACE.zone * (this.drag ? PACE.aiming : 1))) {
      if (e.type === 'stage') {
        this.host.popup(e.body.x, e.body.y - 18 * u, `${LIFE[e.stage]} +${e.points}`, GREEN);
        sound.play('ding', { pitch: 0.8 + 0.15 * e.stage });
      } else {
        this.poofs.add(e.x, e.y, e.hue, e.r);
        sound.play(e.into === 'star' ? 'sizzle' : 'thud');
        if (e.lost > 0) this.host.popup(e.x, e.y - 20 * u, pick(TEXT).melted(e.lost), '#fca5a5');
      }
    }
    this.trails.update(sim.world);
    this.poofs.step(dt);
  }

  private finish(): void {
    this.finished = true;
    const sim = this.sim;
    const planets = sim.world.bodies.filter((b) => b.kind === 'planet');
    const stages = planets
      .map((b) => sim.stageOf(b.id))
      .filter((s) => s > 0)
      .map((s) => LIFE[s - 1])
      .join(' ');
    const n = planets.filter((b) => sim.inZone(b.x, b.y)).length;
    this.host.finish(sim.score, pick(TEXT).summary(stages, n));
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const sim = this.sim;
    const world = sim.world;
    const u = sim.u;
    const s = sim.sun;
    const r0 = ZONE.inner * sim.R;
    const r1 = ZONE.outer * sim.R;

    // The water zone: a soft green ring.
    ctx.beginPath();
    ctx.arc(s.x, s.y, r1, 0, Math.PI * 2);
    ctx.arc(s.x, s.y, r0, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(74, 222, 128, 0.10)';
    ctx.fill();
    for (const r of [r0, r1]) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(134, 239, 172, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    label(ctx, `🌊 ${pick(TEXT).zone}`, s.x, s.y - r1 - 8 * u, 13 * u + 4, 'rgba(134, 239, 172, 0.85)');

    this.trails.draw(ctx, world, u);
    drawBodies(ctx, world, this.clock);
    this.poofs.draw(ctx, u);

    // Life on each planet: its stage, and a ring filling towards the next one.
    for (const b of world.bodies) {
      if (b.kind !== 'planet') continue;
      const t = sim.life.get(b.id) ?? 0;
      const stage = sim.stageOf(b.id);
      const next = ZONE.stages[stage];
      if (next !== undefined && sim.inZone(b.x, b.y)) {
        const prev = stage > 0 ? ZONE.stages[stage - 1] : 0;
        const k = clamp((t - prev) / (next - prev), 0, 1);
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 5 * u, -Math.PI / 2, -Math.PI / 2 + k * 2 * Math.PI);
        ctx.strokeStyle = GREEN;
        ctx.lineWidth = 2.5 * u;
        ctx.stroke();
      }
      if (stage > 0) {
        ctx.font = `${Math.round(16 * u + 4)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(LIFE[stage - 1], b.x, b.y - b.r - 8 * u);
      }
    }

    if (this.drag) this.drawForecast(ctx, this.drag);
  }

  /** The forecast, green where it runs through the zone. */
  private drawForecast(ctx: CanvasRenderingContext2D, d: Drag): void {
    const sim = this.sim;
    const u = sim.u;
    const v = this.velocity(d);
    const copy = sim.world.clone();
    const body = copy.add(sim.planet(d.x0, d.y0, v.x, v.y, this.hue, -1));
    const f = forecast(copy, body.id, Math.round(FORECAST_SECONDS / TICK), 6, 4 * sim.R);
    ctx.beginPath();
    ctx.moveTo(d.x0, d.y0);
    ctx.lineTo(d.x, d.y);
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Split the path into runs inside and outside the zone.
    let run: Pt[] = [];
    let inside = f.pts.length ? sim.inZone(f.pts[0].x, f.pts[0].y) : false;
    const flush = () => {
      if (run.length > 1) drawPath(ctx, run, inside ? GREEN : 'rgba(238, 242, 255, 0.55)', u, this.clock);
    };
    for (const p of f.pts) {
      const now = sim.inZone(p.x, p.y);
      run.push(p);
      if (now !== inside) {
        flush();
        run = [p];
        inside = now;
      }
    }
    flush();
    if (f.outcome === 'crash' || f.outcome === 'merge') drawPath(ctx, f.pts.slice(-1), '#f87171', u, this.clock, true);
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(d.x0, d.y0, ZONE.planetR * u, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${this.hue}, 70%, 60%)`;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  dispose(): void {
    this.drag = null;
  }
}
