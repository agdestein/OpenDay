// Round 2, Keep it flowing: four grain silos pour balls through a narrow
// exit. Now and then balls wedge into an arch and a silo jams dead — at a
// random moment nobody can predict. Click a jammed silo to knock it loose
// (real silos have vibrators and air cannons for exactly this); knocks are
// limited, and there are more jams than knocks. Score: balls delivered.
import { sound } from '../../lib/sound';
import { fmtNumber, pick, type Localized } from '../../lib/i18n';
import type { BallWorld, Box } from './physics';
import { SILO, knock, makeSilo, recycle } from './silo';
import { drawBalls, drawFrame, label } from './draw';
import type { Round, RoundHost } from './rounds';

const TEXT: Localized<{
  hint: string;
  jam: string;
  hudTime: (s: number) => string;
  hudKnocks: (n: number) => string;
  hudOut: (n: number) => string;
  noKnocks: string;
  summary: (jams: number) => string;
}> = {
  en: {
    hint: 'Balls can wedge into an arch and jam a silo. Click a jammed silo to knock it loose! 🔨',
    jam: 'JAM!',
    hudTime: (s) => `⏱ ${s} s`,
    hudKnocks: (n) => `🔨 ×${n}`,
    hudOut: (n) => `⬇ ${fmtNumber(n)}`,
    noKnocks: 'No knocks left!',
    summary: (jams) =>
      `Your silos jammed ${jams} times. Nobody can say when a silo will jam, only how often, by simulating many silos. Real silos jam too, and have knockers and vibrators for it.`,
  },
  nl: {
    hint: 'Ballen kunnen zich vastzetten in een boogje en een silo verstoppen. Klik op een verstopte silo om hem los te kloppen! 🔨',
    jam: 'VAST!',
    hudTime: (s) => `⏱ ${s} s`,
    hudKnocks: (n) => `🔨 ×${n}`,
    hudOut: (n) => `⬇ ${fmtNumber(n)}`,
    noKnocks: 'Geen klopjes meer!',
    summary: (jams) =>
      `Je silo's zaten ${jams} keer vast. Niemand kan zeggen wánnéér een silo vastloopt, alleen hoe vaak, door heel veel silo's te simuleren. Echte silo's lopen ook vast en hebben er kloppers en trilmotoren voor.`,
  },
  no: {
    hint: 'Ballene kan kile seg fast i en bue og tette en silo. Klikk på en tett silo for å banke den løs! 🔨',
    jam: 'TETT!',
    hudTime: (s) => `⏱ ${s} s`,
    hudKnocks: (n) => `🔨 ×${n}`,
    hudOut: (n) => `⬇ ${fmtNumber(n)}`,
    noKnocks: 'Ingen bank igjen!',
    summary: (jams) =>
      `Siloene dine gikk tett ${jams} ganger. Ingen kan si når en silo går tett, bare hvor ofte, ved å simulere mange siloer. Ekte siloer går også tett, og har bankere og vibratorer for det.`,
  },
};

interface Silo {
  world: BallWorld;
  out: number;
  lastOut: number;
  jammed: boolean;
  shake: number;
}

export class SiloRound implements Round {
  get title(): string {
    return pick({ en: '🌾 Silo', nl: '🌾 Silo', no: '🌾 Silo' });
  }
  score = 0;
  private silos: Silo[] = [];
  private time = 0;
  private knocks = SILO.knocks;
  private jams = 0;
  private done = false;
  private box: Box;

  constructor(private host: RoundHost) {
    this.box = { ...host.box, y1: host.box.y1 - 34 };
    for (let i = 0; i < SILO.count; i++) {
      this.silos.push({ world: makeSilo(), out: 0, lastOut: 0, jammed: false, shake: 0 });
    }
    host.buttons([]);
    host.hint(pick(TEXT).hint);
  }

  dispose(): void {}

  hud(): string {
    const T = pick(TEXT);
    const out = this.silos.reduce((a, s) => a + s.out, 0);
    return `${T.hudTime(Math.max(0, Math.ceil(SILO.seconds - this.time)))}   ·   ${T.hudKnocks(this.knocks)}   ·   ${T.hudOut(out)}`;
  }

  /** Where silo i is drawn: offset and scale from silo units to screen px. */
  private tile(i: number): { x: number; y: number; s: number; w: number } {
    const { x0, y0, x1, y1 } = this.box;
    const tw = (x1 - x0) / SILO.count;
    const heightUnits = SILO.outlet + 90 - SILO.top;
    const s = Math.min((tw * 0.86) / SILO.width, (y1 - y0 - 10) / heightUnits);
    return { x: x0 + tw * i + (tw - SILO.width * s) / 2, y: y0 + 6 - SILO.top * s, s, w: tw };
  }

  down(x: number): void {
    if (this.done) return;
    const i = Math.floor((x - this.box.x0) / ((this.box.x1 - this.box.x0) / SILO.count));
    const silo = this.silos[i];
    if (!silo) return;
    if (this.knocks <= 0) {
      this.host.popup(x, this.box.y0 + 80, pick(TEXT).noKnocks, '#fca5a5');
      return;
    }
    this.knocks--;
    knock(silo.world);
    silo.lastOut = this.time;
    silo.jammed = false;
    silo.shake = 0.25;
    sound.play('thud');
  }

  move(): void {}
  up(): void {}

  step(dt: number): void {
    if (this.done) return;
    this.time += dt;
    let out = 0;
    for (const silo of this.silos) {
      silo.world.step(dt);
      silo.world.loudest = 0;
      silo.shake = Math.max(0, silo.shake - dt);
      const n = recycle(silo.world);
      if (n > 0) {
        silo.out += n;
        silo.lastOut = this.time;
        silo.jammed = false;
      } else if (!silo.jammed && this.time - silo.lastOut > SILO.jamAfter) {
        silo.jammed = true;
        this.jams++;
        sound.play('tick');
      }
      out += silo.out;
    }
    this.score = out;
    if (this.time >= SILO.seconds) {
      this.done = true;
      this.host.finish(this.score, pick(TEXT).summary(this.jams));
    }
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    drawFrame(ctx, this.box, w, h);
    const T = pick(TEXT);
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
    this.silos.forEach((silo, i) => {
      const t = this.tile(i);
      const jiggle = silo.shake > 0 ? (Math.random() - 0.5) * 8 * silo.shake * 4 : 0;
      ctx.save();
      ctx.translate(t.x + jiggle, t.y);
      ctx.scale(t.s, t.s);
      if (silo.jammed) {
        ctx.fillStyle = `rgba(248, 113, 113, ${0.08 + 0.08 * pulse})`;
        ctx.fillRect(0, SILO.top, SILO.width, SILO.outlet - SILO.top);
      }
      drawBalls(ctx, silo.world.balls, 0, 1);
      ctx.strokeStyle = silo.jammed ? '#f87171' : 'rgba(238, 242, 255, 0.7)';
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (const s of silo.world.segments) {
        ctx.moveTo(s.x1, Math.max(s.y1, SILO.top));
        ctx.lineTo(s.x2, s.y2);
      }
      ctx.stroke();
      ctx.restore();

      const cx = t.x + (SILO.width / 2) * t.s;
      const exitY = t.y + SILO.outlet * t.s;
      label(ctx, `⬇ ${fmtNumber(silo.out)}`, cx, exitY + 60 * t.s, 15 + 6 * this.host.unit, 'rgba(238, 242, 255, 0.9)');
      if (silo.jammed) {
        label(ctx, `🔨 ${T.jam}`, cx, t.y + (SILO.wallEnd - 80) * t.s, (20 + 10 * this.host.unit) * (1 + 0.08 * pulse), '#fca5a5');
      }
    });
  }
}
