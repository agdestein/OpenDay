// Challenge round "Save the Earth": an asteroid nobody knows exactly, drawn
// as a cloud of possible asteroids (the model is in defense.ts). The red ones
// would hit Earth. Look (🔭) to shrink the cloud around the real one; drag to
// push it once (🚀). The earlier the push, the smaller it needs to be.
import { fmtNumber, pick, type Localized } from '../../lib/i18n';
import { sound } from '../../lib/sound';
import { Defense, DEFENSE, stepRock, type Rock } from './defense';
import { arrow, drawEarth, drawStar, label } from './draw';
import { setLabel, type Round, type RoundHost } from './rounds';
import { PACE } from './scene';

const TEXT: Localized<{
  title: string;
  look: string;
  lookLeft: (n: number) => string;
  lookWait: string;
  lookNone: string;
  years: (y: string) => string;
  chance: (p: string) => string;
  hintStart: string;
  hintLooked: (p: string) => string;
  hintDrag: (p: string) => string;
  hintPushed: string;
  hintLate: string;
  looked: string;
  pushed: string;
  earthLabel: string;
  real: string;
  impactDay: string;
  hit: string;
  safe: string;
  summarySafe: (power: string, looks: number) => string;
  summaryHit: string;
}> = {
  en: {
    title: '☄️ Save the Earth',
    look: 'Look',
    lookLeft: (n) => `Look (${n} left)`,
    lookWait: 'Telescope busy…',
    lookNone: 'No looks left',
    years: (y) => `⏳ ${y} years to go`,
    chance: (p) => `☄️ ${p} chance of impact`,
    hintStart: 'Nobody knows exactly where the asteroid is: every dot is one it could be. Red ones would hit Earth! 🔭 Look to find the real one.',
    hintLooked: (p) => `The cloud shrank around the real asteroid: now a ${p} chance of impact. Drag anywhere to 🚀 push it away!`,
    hintDrag: (p) => `After this push: ${p} chance of impact. Let go to push!`,
    hintPushed: 'Pushed! Now watch it fly past…',
    hintLate: 'Too late to push now: watch!',
    looked: '🔭 A closer look!',
    pushed: '🚀 Pushed!',
    earthLabel: 'Earth',
    real: 'the real asteroid',
    impactDay: 'Impact day',
    hit: '💥 Earth was hit!',
    safe: '🎉 Earth is safe!',
    summarySafe: (power, looks) =>
      `You pushed with ${power} of the rocket's power${looks > 0 ? `, after ${looks} ${looks === 1 ? 'look' : 'looks'}` : ''}. Looking first shows how little push you need, and a tiny push years ahead beats a huge one at the last minute. NASA's DART mission did exactly this to a real asteroid in 2022.`,
    summaryHit:
      'Earth was hit. Next time: look first to see which way it is really going, then push early — a tiny push years ahead beats a huge one at the last minute.',
  },
  nl: {
    title: '☄️ Red de Aarde',
    look: 'Kijk',
    lookLeft: (n) => `Kijk (nog ${n})`,
    lookWait: 'Telescoop bezig…',
    lookNone: 'Niet meer kijken',
    years: (y) => `⏳ nog ${y} jaar`,
    chance: (p) => `☄️ ${p} kans op inslag`,
    hintStart: 'Niemand weet precies waar de planetoïde is: elke stip is er een die het zou kunnen zijn. De rode raken de Aarde! 🔭 Kijk om de echte te vinden.',
    hintLooked: (p) => `De wolk kromp rond de echte planetoïde: nu ${p} kans op inslag. Sleep ergens om hem weg te 🚀 duwen!`,
    hintDrag: (p) => `Na deze duw: ${p} kans op inslag. Laat los om te duwen!`,
    hintPushed: 'Geduwd! Kijk nu hoe hij langs vliegt…',
    hintLate: 'Te laat om te duwen: kijk maar!',
    looked: '🔭 Beter gekeken!',
    pushed: '🚀 Geduwd!',
    earthLabel: 'Aarde',
    real: 'de echte planetoïde',
    impactDay: 'Inslagdag',
    hit: '💥 De Aarde is geraakt!',
    safe: '🎉 De Aarde is veilig!',
    summarySafe: (power, looks) =>
      `Je duwde met ${power} van de kracht van de raket${looks > 0 ? `, na ${looks} keer kijken` : ''}. Eerst kijken laat zien hoe weinig duw je nodig hebt, en een piepklein duwtje jaren van tevoren wint van een enorme duw op het laatste moment. NASA's DART-missie deed precies dit bij een echte planetoïde in 2022.`,
    summaryHit:
      'De Aarde is geraakt. Volgende keer: kijk eerst welke kant hij echt op gaat, en duw dan vroeg — een piepklein duwtje jaren van tevoren wint van een enorme duw op het laatste moment.',
  },
  no: {
    title: '☄️ Redd Jorden',
    look: 'Se',
    lookLeft: (n) => `Se (${n} igjen)`,
    lookWait: 'Teleskopet er opptatt…',
    lookNone: 'Ingen titt igjen',
    years: (y) => `⏳ ${y} år igjen`,
    chance: (p) => `☄️ ${p} sjanse for nedslag`,
    hintStart: 'Ingen vet nøyaktig hvor asteroiden er: hver prikk er en den kan være. De røde treffer Jorden! 🔭 Se etter for å finne den ekte.',
    hintLooked: (p) => `Skyen krympet rundt den ekte asteroiden: nå ${p} sjanse for nedslag. Dra hvor som helst for å 🚀 dytte den bort!`,
    hintDrag: (p) => `Etter dette dyttet: ${p} sjanse for nedslag. Slipp for å dytte!`,
    hintPushed: 'Dyttet! Se den fly forbi…',
    hintLate: 'For sent å dytte nå: se!',
    looked: '🔭 En nærmere titt!',
    pushed: '🚀 Dyttet!',
    earthLabel: 'Jorden',
    real: 'den ekte asteroiden',
    impactDay: 'Nedslagsdagen',
    hit: '💥 Jorden ble truffet!',
    safe: '🎉 Jorden er trygg!',
    summarySafe: (power, looks) =>
      `Du dyttet med ${power} av rakettens kraft${looks > 0 ? `, etter ${looks} ${looks === 1 ? 'titt' : 'titter'}` : ''}. Å se først viser hvor lite dytt du trenger, og et lite dytt flere år i forveien slår et enormt dytt i siste liten. NASAs DART-oppdrag gjorde akkurat dette med en ekte asteroide i 2022.`,
    summaryHit:
      'Jorden ble truffet. Neste gang: se først hvilken vei den egentlig går, og dytt tidlig — et lite dytt flere år i forveien slår et enormt dytt i siste liten.',
  },
};

/** Drag length (units) for a full-power push. */
const FULL_DRAG = 160;
/** While dragging, the live preview flies every third member, every few frames. */
const PREVIEW_EVERY = 3;
const PREVIEW_FRAMES = 3;
const RED = '#f87171';

const pct = (p: number) => fmtNumber(Math.round(100 * p)) + ' %';

export class DefenseRound implements Round {
  readonly title = pick(TEXT).title;
  private model: Defense;
  private acc = 0;
  private drag: { x0: number; y0: number; x: number; y: number } | null = null;
  private preview: { dvx: number; dvy: number; hits: boolean[]; chance: number } | null = null;
  private previewAge = 0;
  private lookButton: HTMLButtonElement;
  private endTimer = 0;
  private finished = false;
  private flash = 0;
  private announced = false;
  private truthTrail: { x: number; y: number }[] = [];
  private time = 0;

  constructor(private host: RoundHost, seed = Math.floor(Math.random() * 1e9)) {
    this.model = new Defense(seed);
    [this.lookButton] = host.buttons([{ emoji: '🔭', label: pick(TEXT).look, onClick: () => this.look() }]);
    host.hint(pick(TEXT).hintStart);
  }

  get score(): number {
    return this.finished || this.model.over ? this.model.score() : 0;
  }

  hud(): string {
    const T = pick(TEXT);
    const m = this.model;
    return [T.years(fmtNumber(m.yearsLeft, { minimumFractionDigits: 1, maximumFractionDigits: 1 })), T.chance(pct(this.preview?.chance ?? m.chance))].join('   ·   ');
  }

  // ---- geometry: model units (Earth's orbit = 1) to screen ----

  private view(): { cx: number; cy: number; s: number } {
    const a = this.host.area();
    const s = Math.min(a.x1 - a.x0, a.y1 - a.y0) / 2 / 2.05;
    return { cx: (a.x0 + a.x1) / 2, cy: (a.y0 + a.y1) / 2, s };
  }

  /** The cloud's anchor: the member nearest the cloud's mean position. */
  private anchor(): Rock {
    const c = this.model.cloud;
    let mx = 0;
    let my = 0;
    for (const m of c) {
      mx += m.x;
      my += m.y;
    }
    mx /= c.length;
    my /= c.length;
    let best = c[0];
    let bd = Infinity;
    for (const m of c) {
      const d = (m.x - mx) ** 2 + (m.y - my) ** 2;
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    return best;
  }

  private canPush(): boolean {
    const m = this.model;
    return !m.pushed && !m.over && m.step < m.impactStep;
  }

  // ---- actions ----

  private look(): void {
    if (!this.model.look()) return;
    sound.play('ding');
    const { cx, cy, s } = this.view();
    const a = this.anchor();
    this.host.popup(cx + s * a.x, cy + s * a.y - 20, pick(TEXT).looked, '#7dd3fc');
    if (this.canPush()) this.host.hint(pick(TEXT).hintLooked(pct(this.model.chance)));
  }

  private pushVector(d: { x0: number; y0: number; x: number; y: number }): { dvx: number; dvy: number } {
    const u = this.host.unit();
    let dx = (d.x - d.x0) / (FULL_DRAG * u);
    let dy = (d.y - d.y0) / (FULL_DRAG * u);
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    return { dvx: dx * DEFENSE.dvMax, dvy: dy * DEFENSE.dvMax };
  }

  down(x: number, y: number): void {
    if (!this.canPush()) return;
    this.drag = { x0: x, y0: y, x, y };
    this.preview = null;
    this.previewAge = PREVIEW_FRAMES;
  }

  move(x: number, y: number): void {
    if (!this.drag) return;
    this.drag.x = x;
    this.drag.y = y;
  }

  up(): void {
    const d = this.drag;
    this.drag = null;
    this.preview = null;
    if (!d || !this.canPush()) return;
    if (Math.hypot(d.x - d.x0, d.y - d.y0) < 6 * this.host.unit()) return; // a tap is not a push
    const { dvx, dvy } = this.pushVector(d);
    this.model.push(dvx, dvy);
    sound.play('whoosh', { pitch: 0.8 + 0.6 * (this.model.dv / DEFENSE.dvMax) });
    const { cx, cy, s } = this.view();
    const a = this.anchor();
    this.host.popup(cx + s * a.x, cy + s * a.y - 20, pick(TEXT).pushed, '#fbbf24');
    this.host.hint(pick(TEXT).hintPushed);
  }

  // ---- time ----

  step(dt: number): void {
    this.time += dt;
    const m = this.model;
    this.flash = Math.max(0, this.flash - dt);
    if (!m.over) {
      const perStep = DEFENSE.yearSeconds / DEFENSE.stepsPerYear;
      // Time slows while a push is being aimed.
      this.acc += dt * (this.drag ? PACE.aiming : 1);
      while (this.acc >= perStep && !m.over) {
        this.acc -= perStep;
        m.advance();
        this.truthTrail.push({ x: m.truth.x, y: m.truth.y });
        if (this.truthTrail.length > 260) this.truthTrail.shift();
      }
      if (m.step >= m.impactStep && !m.pushed && !this.announced) {
        this.announced = true;
        this.drag = null;
        this.preview = null;
      }
    }
    if (m.over && !this.finished) {
      if (this.endTimer === 0) {
        const T = pick(TEXT);
        const { cx, cy, s } = this.view();
        if (m.truthHit) {
          this.flash = 1.2;
          sound.play('thud');
          sound.play('alarm');
          this.host.popup(cx + s * m.truth.x, cy + s * m.truth.y - 30, T.hit, RED);
        } else {
          sound.play('cheer');
          this.host.popup(cx, cy - s * 1.2, T.safe, '#6ee7b7');
        }
        this.host.hint('');
      }
      this.endTimer += dt;
      if (this.endTimer > 2.4) {
        this.finished = true;
        const T = pick(TEXT);
        this.host.finish(
          m.score(),
          m.truthHit ? T.summaryHit : T.summarySafe(pct(m.dv / DEFENSE.dvMax), m.looks),
        );
      }
    }

    // The look button tells you why you can't look.
    const T = pick(TEXT);
    this.lookButton.disabled = !m.canLook;
    setLabel(this.lookButton, m.looksLeft === 0 ? T.lookNone : m.lookWait > 0 ? T.lookWait : T.lookLeft(m.looksLeft));
    if (m.step >= m.impactStep && !m.pushed && !m.over) this.host.hint(T.hintLate);

    // Live preview of the push being dragged: a subset, every few frames.
    if (this.drag && this.canPush()) {
      this.previewAge++;
      if (this.previewAge >= PREVIEW_FRAMES) {
        this.previewAge = 0;
        const { dvx, dvy } = this.pushVector(this.drag);
        const subset = m.cloud.filter((_, i) => i % PREVIEW_EVERY === 0);
        const hits = m.forecast(dvx, dvy, subset);
        const chance = hits.filter(Boolean).length / Math.max(1, hits.length);
        this.preview = { dvx, dvy, hits, chance };
        this.host.hint(T.hintDrag(pct(chance)));
      }
    }
  }

  // ---- drawing ----

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const m = this.model;
    const { cx, cy, s } = this.view();
    const u = this.host.unit();
    const X = (x: number) => cx + s * x;
    const Y = (y: number) => cy + s * y;
    const T = pick(TEXT);

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(248, 113, 113, ${0.35 * this.flash})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Earth's orbit, and where Earth will be on impact day.
    ctx.beginPath();
    ctx.arc(cx, cy, s, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (m.step < m.impactStep) {
      const [ix, iy] = m.earthAt((m.impactStep * 2 * Math.PI) / DEFENSE.stepsPerYear);
      ctx.beginPath();
      ctx.arc(X(ix), Y(iy), 12 * u, 0, Math.PI * 2);
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = 'rgba(248, 113, 113, 0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      label(ctx, T.impactDay, X(ix), Y(iy) - 16 * u, 12 * u + 3, 'rgba(252, 165, 165, 0.8)');
    }

    drawStar(ctx, cx, cy, 16 * u, 45, Math.sin(this.time * 2));
    const [ex, ey] = m.earthAt(m.t);
    drawEarth(ctx, X(ex), Y(ey), 9 * u);
    label(ctx, T.earthLabel, X(ex), Y(ey) + 26 * u, 13 * u + 3, 'rgba(147, 197, 253, 0.9)');

    // The forecast of the cloud's middle: where it is heading next.
    const a = this.anchor();
    const ghost = { ...a };
    const steps = DEFENSE.stepsPerYear;
    const pts: { x: number; y: number }[] = [];
    const p = { x: ghost.x, y: ghost.y, vx: ghost.vx + (this.preview?.dvx ?? 0), vy: ghost.vy + (this.preview?.dvy ?? 0) };
    for (let i = 0; i < steps; i++) {
      stepRock(p, (2 * Math.PI) / DEFENSE.stepsPerYear);
      if (i % 5 === 0) pts.push({ x: p.x, y: p.y });
    }
    ctx.beginPath();
    ctx.moveTo(X(a.x), Y(a.y));
    for (const q of pts) ctx.lineTo(X(q.x), Y(q.y));
    ctx.setLineDash([6, 7]);
    ctx.lineDashOffset = -this.time * 30;
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // The cloud: every dot is an asteroid it could be; red ones hit.
    const prev = this.preview;
    const r = Math.max(2, 3 * u);
    m.cloud.forEach((c, i) => {
      let color: string;
      if (prev) {
        if (i % PREVIEW_EVERY !== 0) color = 'rgba(148, 163, 184, 0.25)';
        else color = prev.hits[i / PREVIEW_EVERY] ? RED : 'rgba(226, 232, 240, 0.9)';
      } else {
        color = m.hits[i] ? RED : 'rgba(203, 213, 225, 0.75)';
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(X(c.x), Y(c.y), r, 0, Math.PI * 2);
      ctx.fill();
    });

    // The push being dragged, drawn from the cloud.
    if (this.drag && this.canPush()) {
      const { dvx, dvy } = this.pushVector(this.drag);
      const scale = (FULL_DRAG * u) / DEFENSE.dvMax;
      const power = Math.hypot(dvx, dvy) / DEFENSE.dvMax;
      arrow(ctx, X(a.x), Y(a.y), dvx * scale, dvy * scale, `hsl(${45 - 45 * power}, 95%, 60%)`, 4);
      label(ctx, `🚀 ${pct(power)}`, X(a.x) + dvx * scale, Y(a.y) + dvy * scale - 14, 16 * u + 4, '#fde68a');
    } else if (this.canPush() && m.looks > 0) {
      // A pulse around the cloud: it can be pushed.
      const pr = (18 + 6 * Math.sin(this.time * 4)) * u;
      ctx.beginPath();
      ctx.arc(X(a.x), Y(a.y), pr, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(253, 230, 138, 0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // At the end, the real asteroid shows itself.
    if (m.over) {
      if (this.truthTrail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(X(this.truthTrail[0].x), Y(this.truthTrail[0].y));
        for (const q of this.truthTrail) ctx.lineTo(X(q.x), Y(q.y));
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(X(m.truth.x), Y(m.truth.y), 6 * u, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      label(ctx, T.real, X(m.truth.x), Y(m.truth.y) - 14 * u, 14 * u + 3, '#fde68a');
    }
  }

  dispose(): void {
    this.drag = null;
  }
}
