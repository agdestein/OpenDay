// Round 1, Pick the parents: choosing the best, again and again, is learning.
// Six pens, a Doggo on a random brain in each. After four seconds the pens
// freeze and you click the one you want as parent: it gets five babies with
// small mutations, plus a copy of itself. Ten picks, then the last litter
// walks, and its best is the score. Then the computer does exactly the same,
// three hundred times in a few seconds, its curve drawn over yours.
// (Measured: picking the farthest takes Doggo from ~2 to ~4 m in ten picks;
// picking at random learns nothing — tests/creature.test.ts.)
import { Creature, FIXED_DT, simulate, type Genome } from './physics';
import { babiesOf, randomGenome } from './evolve';
import { preset } from './presets';
import type { Round, RoundHost } from './rounds';
import { fmtMetres } from './text';
import { COLOR, drawChart, drawCreature, drawGround, label, panel, type View } from './view';
import { fmtNumber, pick, type Localized } from '../../lib/i18n';
import { sound } from '../../lib/sound';

const PENS = 6;
const SEASON = 4;
const PICKS = 10;
const CPU_PICKS = 300;
/** The computer's search may take this long per frame (ms). */
const CPU_BUDGET = 8;
const POINTS_PER_M = 100;

const TEXT: Localized<{
  title: string;
  watch: string;
  pickNow: string;
  last: string;
  cpu: string;
  hud: (picks: number, best: string) => string;
  parent: string;
  baby: string;
  you: (picks: number) => string;
  computer: (picks: number) => string;
  chart: string;
  summary: (you: string, cpu: string, picks: number) => string;
}> = {
  en: {
    title: '❤️ Pick the parents',
    watch: 'Watch them walk… after four seconds, pick the one you want as a parent!',
    pickNow: '👆 Click the one you want as a parent. Its babies are copies with small changes.',
    last: 'Your last litter walks: its best is your score!',
    cpu: '🤖 Now the computer does exactly the same: it always picks the farthest…',
    hud: (picks, best) => `❤️ ${picks}/${PICKS}   🏆 ${best}`,
    parent: '❤️ parent',
    baby: 'baby',
    you: (n) => `you: ${n} picks`,
    computer: (n) => `computer: ${fmtNumber(n)} picks`,
    chart: 'farthest of the six, pick by pick',
    summary: (you, cpu, picks) =>
      `Your ${PICKS} picks: ${you}. The computer's ${fmtNumber(picks)} picks, in a few seconds: ${cpu}. Picking the best, again and again, is all it takes to learn — and computers can do it millions of times.`,
  },
  nl: {
    title: '❤️ Kies de ouders',
    watch: 'Kijk hoe ze lopen… na vier seconden kies je welke ouder mag worden!',
    pickNow: '👆 Klik op degene die ouder mag worden. De baby’s zijn kopieën met kleine veranderingen.',
    last: 'Je laatste nestje loopt: de beste is je score!',
    cpu: '🤖 Nu doet de computer precies hetzelfde: hij kiest steeds de verste…',
    hud: (picks, best) => `❤️ ${picks}/${PICKS}   🏆 ${best}`,
    parent: '❤️ ouder',
    baby: 'baby',
    you: (n) => `jij: ${n} keuzes`,
    computer: (n) => `computer: ${fmtNumber(n)} keuzes`,
    chart: 'de verste van de zes, keuze na keuze',
    summary: (you, cpu, picks) =>
      `Jouw ${PICKS} keuzes: ${you}. De ${fmtNumber(picks)} keuzes van de computer, in een paar seconden: ${cpu}. Steeds de beste kiezen is alles wat nodig is om te leren — en computers kunnen dat miljoenen keren doen.`,
  },
  no: {
    title: '❤️ Velg foreldrene',
    watch: 'Se dem gå… etter fire sekunder velger du hvem som blir forelder!',
    pickNow: '👆 Klikk på den du vil ha som forelder. Babyene er kopier med små endringer.',
    last: 'Det siste kullet ditt går: den beste er poengsummen din!',
    cpu: '🤖 Nå gjør datamaskinen akkurat det samme: den velger alltid den som kom lengst…',
    hud: (picks, best) => `❤️ ${picks}/${PICKS}   🏆 ${best}`,
    parent: '❤️ forelder',
    baby: 'baby',
    you: (n) => `du: ${n} valg`,
    computer: (n) => `datamaskinen: ${fmtNumber(n)} valg`,
    chart: 'den lengste av de seks, valg for valg',
    summary: (you, cpu, picks) =>
      `Dine ${PICKS} valg: ${you}. Datamaskinens ${fmtNumber(picks)} valg, på noen sekunder: ${cpu}. Å velge den beste, igjen og igjen, er alt som skal til for å lære — og datamaskiner kan gjøre det millioner av ganger.`,
  },
};

type Phase = 'walk' | 'pick' | 'final' | 'cpu' | 'done';

export class PickRound implements Round {
  readonly title = pick(TEXT).title;
  score = 0;
  private plan = preset('Doggo').plan;
  private genomes: Genome[];
  private pens: Creature[] = [];
  private parent = -1;
  private phase: Phase = 'walk';
  private picks = 0;
  private acc = 0;
  private hover = -1;
  private rects: { x: number; y: number; w: number; h: number }[] = [];
  /** Farthest of the six in each season: yours, then the computer's. */
  private mine: number[] = [];
  private cpu: number[] = [];
  private cpuGenomes: Genome[] = [];
  private flashAge = 9;

  constructor(private host: RoundHost) {
    this.genomes = Array.from({ length: PENS }, () => randomGenome(this.plan));
    this.spawn();
    host.buttons([]);
    host.hint(pick(TEXT).watch);
  }

  private spawn(): void {
    this.pens = this.genomes.map((g) => new Creature(this.plan, g));
  }

  private best(): number {
    return Math.max(...this.pens.map((c) => c.dist()));
  }

  hud(): string {
    const T = pick(TEXT);
    return T.hud(this.picks, this.mine.length ? fmtMetres(Math.max(...this.mine, 0)) : '—');
  }

  step(dt: number): void {
    this.flashAge += dt;
    if (this.phase === 'walk' || this.phase === 'final') {
      this.acc += dt;
      let steps = Math.min(40, Math.floor(this.acc / FIXED_DT));
      this.acc -= steps * FIXED_DT;
      const total = Math.round(SEASON / FIXED_DT);
      while (steps-- > 0 && this.pens[0].steps < total) for (const c of this.pens) c.step();
      if (this.pens[0].steps >= total) {
        this.mine.push(Math.max(0, this.best()));
        if (this.phase === 'final') {
          this.score = Math.round(Math.max(0, this.best()) * POINTS_PER_M);
          this.startCpu();
        } else {
          this.phase = 'pick';
          sound.play('ding');
          this.host.hint(pick(TEXT).pickNow);
        }
      }
    } else if (this.phase === 'cpu') {
      const t0 = performance.now();
      while (this.cpu.length <= CPU_PICKS && performance.now() - t0 < CPU_BUDGET) {
        const d = this.cpuGenomes.map((g) => simulate(this.plan, g, SEASON).dist());
        const i = d.indexOf(Math.max(...d));
        this.cpu.push(Math.max(0, d[i]));
        this.cpuGenomes = babiesOf(this.cpuGenomes[i], PENS);
      }
      if (this.cpu.length > CPU_PICKS) {
        this.phase = 'done';
        const T = pick(TEXT);
        sound.play('cheer');
        this.host.finish(this.score, T.summary(fmtMetres(this.mine[this.mine.length - 1]), fmtMetres(this.cpu[this.cpu.length - 1]), CPU_PICKS));
      }
    }
  }

  private startCpu(): void {
    this.phase = 'cpu';
    this.host.hint(pick(TEXT).cpu);
    this.cpuGenomes = Array.from({ length: PENS }, () => randomGenome(this.plan));
    sound.play('whoosh');
  }

  private layout(w: number, h: number): void {
    const top = 84;
    const bottom = h - 130;
    const gap = 14;
    const pw = (w - 40 - 2 * gap) / 3;
    const ph = (bottom - top - gap) / 2;
    this.rects = Array.from({ length: PENS }, (_, i) => ({
      x: 20 + (i % 3) * (pw + gap),
      y: top + Math.floor(i / 3) * (ph + gap),
      w: pw,
      h: ph,
    }));
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.layout(w, h);
    const T = pick(TEXT);
    if (this.phase === 'cpu' || this.phase === 'done') {
      const cw = Math.min(900, w - 80);
      const ch = Math.min(420, h - 260);
      const x = (w - cw) / 2;
      const y = 110;
      drawChart(ctx, x, y, cw, ch, T.chart, [
        { values: this.cpu, color: COLOR.champ },
        { values: this.mine, color: COLOR.you },
      ]);
      label(ctx, T.you(this.picks), x + 24, y + ch + 34, 22, COLOR.you, 'left');
      label(ctx, T.computer(Math.max(0, this.cpu.length - 1)), x + cw - 24, y + ch + 34, 22, COLOR.champ, 'right');
      return;
    }
    const bestIdx = this.pens.map((c) => c.dist()).reduce((b, d, i, a) => (d > a[b] ? i : b), 0);
    this.pens.forEach((c, i) => {
      const r = this.rects[i];
      const scale = Math.min(r.h / 2.6, r.w / 3.6);
      const v: View = { camX: Math.max(1.3, c.dist() + 0.4), scale, centerX: r.x + r.w * 0.45, groundY: r.y + r.h * 0.8, top: r.y, height: r.h };
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 14);
      ctx.clip();
      const picking = this.canPick();
      ctx.fillStyle = i === this.hover && picking ? 'rgba(244, 114, 182, 0.12)' : 'rgba(255, 255, 255, 0.03)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      drawGround(ctx, v, r.x + r.w, { metres: true, flag: true });
      const lead = this.phase === 'pick' && i === bestIdx;
      drawCreature(ctx, v, c, {
        head: i === this.parent ? '#f472b6' : COLOR.you,
        glow: picking && i === this.hover ? '#f472b6' : lead ? COLOR.champ : undefined,
      });
      ctx.restore();
      const hot = picking && i === this.hover;
      ctx.strokeStyle = hot ? '#f472b6' : this.phase === 'pick' ? 'rgba(244, 114, 182, 0.55)' : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = hot || this.phase === 'pick' ? 3 : 1.5;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 14);
      ctx.stroke();
      label(ctx, fmtMetres(Math.max(0, c.dist())), r.x + r.w - 14, r.y + 34, 26, lead ? COLOR.champ : COLOR.text, 'right', 800);
      if (this.picks > 0) label(ctx, i === this.parent ? T.parent : T.baby, r.x + 14, r.y + 30, 17, i === this.parent ? '#f9a8d4' : COLOR.dim, 'left');
    });
    if (this.flashAge < 0.8) {
      ctx.globalAlpha = 1 - this.flashAge / 0.8;
      panel(ctx, w / 2 - 120, h / 2 - 40, 240, 70);
      label(ctx, '❤️ 🐣🐣🐣🐣🐣', w / 2, h / 2 + 8, 32);
      ctx.globalAlpha = 1;
    }
  }

  /** Picks count once the pens have walked a second (or when they freeze at four). */
  private canPick(): boolean {
    return this.phase === 'pick' || (this.phase === 'walk' && this.pens[0].time > 1);
  }

  down(x: number, y: number): void {
    if (!this.canPick()) return;
    // A pick before the pens froze: this season counts as far as it got.
    if (this.phase === 'walk') this.mine.push(Math.max(0, this.best()));
    const i = this.rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    if (i < 0) return;
    this.picks++;
    const babies = babiesOf(this.genomes[i], PENS);
    // The parent's copy stays in its pen; babies fill the others.
    this.genomes = this.genomes.map((_, k) => (k === i ? babies[0] : babies[k < i ? k + 1 : k]));
    this.parent = i;
    this.spawn();
    this.acc = 0;
    this.flashAge = 0;
    sound.play('pop', { pitch: 1.3 });
    sound.play('boing', { volume: 0.7 });
    if (this.picks >= PICKS) {
      this.phase = 'final';
      this.host.hint(pick(TEXT).last);
    } else {
      this.phase = 'walk';
      this.host.hint(pick(TEXT).watch);
    }
  }

  move(x: number, y: number): void {
    this.hover = this.rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  }

  up(): void {}

  dispose(): void {}
}
