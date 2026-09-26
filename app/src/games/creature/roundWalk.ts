// Round 2, Race-walk: the computer learns exactly what you reward, not what
// you meant. In race-walking one foot must always touch the ground. You choose
// the reward — distance, or distance with a foot on the ground — the computer
// trains a Wiggler on it (25 generations, fast), and a judge then counts only
// the distance covered while touching; every hop is painted red. Two tries,
// the best counts. (Measured: rewarded for distance alone the worm flies about
// 58 % of the time; with the rule in the reward about 15 % —
// tests/creature.test.ts.)
import type { Reward } from './evolve';
import { preset } from './presets';
import type { Round, RoundHost } from './rounds';
import { Teacher } from './teach';
import { Trial } from './trial';
import { fmtMetres } from './text';
import { COLOR, drawCreature, drawGround, label, type View } from './view';
import { Creature } from './physics';
import { randomGenome } from './evolve';
import { fmtNumber, pick, type Localized } from '../../lib/i18n';
import { sound } from '../../lib/sound';

const GENERATIONS = 25;
/** Simulated seconds per real second while training (a generation every ~0.2 s). */
const TRAIN_RATE = 40;
const POINTS_PER_M = 50;
const TRIES = 2;

type Card = 'far' | 'ground';

const TEXT: Localized<{
  title: string;
  intro: string;
  rule: string;
  cards: Record<Card, string>;
  training: (card: string) => string;
  judging: string;
  flying: string;
  caption: (counts: string, flew: string) => string;
  hopped: string;
  walked: string;
  again: string;
  keep: (points: number) => string;
  hud: (tries: number, best: string) => string;
  summary: (tries: { card: string; air: number; counts: string }[]) => string;
}> = {
  en: {
    title: '👣 Race-walk',
    intro: 'Race-walking: one foot must ALWAYS touch the ground. What will you reward the worms for?',
    rule: '👣 Race-walk: one foot always on the ground!',
    cards: { far: 'As far as you can', ground: 'Far, with a foot on the ground' },
    training: (card) => `🧠 The computer trains 20 worms for 25 generations. Reward: ${card}`,
    judging: '⚖️ The judge counts only the distance with a foot on the ground!',
    flying: '🚫 flying!',
    caption: (counts, flew) => `counts: ${counts}   ·   🚫 flew: ${flew}`,
    hopped: 'It hopped! It never knew about the rule — you didn’t put it in the reward.',
    walked: 'It kept a foot on the ground: it learned the rule, because you rewarded it.',
    again: 'Try again',
    keep: (points) => `Keep ${fmtNumber(points)}`,
    hud: (tries, best) => `🔁 ${tries}/${TRIES}   🏆 ${best}`,
    summary: (tries) =>
      `${tries.map((t) => `Rewarded for “${t.card}”, the worm flew ${Math.round(100 * t.air)} % of the time (${t.counts} counted).`).join(' ')} The computer learns exactly what you reward — not what you meant. Choosing the reward is a big part of a robot engineer’s job.`,
  },
  nl: {
    title: '👣 Snelwandelen',
    intro: 'Snelwandelen: er moet ALTIJD een voet op de grond staan. Waarvoor beloon jij de wormen?',
    rule: '👣 Snelwandelen: altijd een voet op de grond!',
    cards: { far: 'Zo ver mogelijk', ground: 'Ver, met een voet op de grond' },
    training: (card) => `🧠 De computer traint 20 wormen, 25 generaties lang. Beloning: ${card}`,
    judging: '⚖️ De jury telt alleen de afstand met een voet op de grond!',
    flying: '🚫 vliegen!',
    caption: (counts, flew) => `telt: ${counts}   ·   🚫 gevlogen: ${flew}`,
    hopped: 'Hij huppelde! Hij kende de regel niet — je had hem niet in de beloning gestopt.',
    walked: 'Hij hield een voet op de grond: hij leerde de regel, omdat je hem ervoor beloonde.',
    again: 'Nog een keer',
    keep: (points) => `${fmtNumber(points)} houden`,
    hud: (tries, best) => `🔁 ${tries}/${TRIES}   🏆 ${best}`,
    summary: (tries) =>
      `${tries.map((t) => `Beloond voor „${t.card}” vloog de worm ${Math.round(100 * t.air)} % van de tijd (${t.counts} telde mee).`).join(' ')} De computer leert precies wat je beloont — niet wat je bedoelde. De beloning kiezen is een groot deel van het werk van een robotbouwer.`,
  },
  no: {
    title: '👣 Kappgang',
    intro: 'Kappgang: én fot må ALLTID være i bakken. Hva vil du belønne markene for?',
    rule: '👣 Kappgang: alltid én fot i bakken!',
    cards: { far: 'Så langt som mulig', ground: 'Langt, med en fot i bakken' },
    training: (card) => `🧠 Datamaskinen trener 20 mark i 25 generasjoner. Belønning: ${card}`,
    judging: '⚖️ Dommeren teller bare avstanden med en fot i bakken!',
    flying: '🚫 flyr!',
    caption: (counts, flew) => `teller: ${counts}   ·   🚫 fløy: ${flew}`,
    hopped: 'Den hoppet! Den kjente aldri regelen — du la den ikke inn i belønningen.',
    walked: 'Den holdt en fot i bakken: den lærte regelen, fordi du belønnet den.',
    again: 'Prøv igjen',
    keep: (points) => `Behold ${fmtNumber(points)}`,
    hud: (tries, best) => `🔁 ${tries}/${TRIES}   🏆 ${best}`,
    summary: (tries) =>
      `${tries.map((t) => `Belønnet for «${t.card}» fløy marken ${Math.round(100 * t.air)} % av tiden (${t.counts} telte).`).join(' ')} Datamaskinen lærer akkurat det du belønner — ikke det du mente. Å velge belønningen er en stor del av jobben til en robotbygger.`,
  },
};

type Phase = 'choose' | 'train' | 'judge' | 'result';

export class WalkRound implements Round {
  readonly title = pick(TEXT).title;
  score = 0;
  private plan = preset('Wiggler').plan;
  private phase: Phase = 'choose';
  private card: Card = 'far';
  private teacher: Teacher | null = null;
  private trial: Trial | null = null;
  private tries: { card: Card; air: number; counts: number }[] = [];
  private idle: Creature;

  constructor(private host: RoundHost) {
    this.idle = new Creature(this.plan, randomGenome(this.plan));
    this.choose();
  }

  private choose(): void {
    const T = pick(TEXT);
    this.phase = 'choose';
    this.host.hint(T.intro);
    this.host.buttons([
      { emoji: '🏁', label: T.cards.far, onClick: () => this.train('far') },
      { emoji: '👣', label: T.cards.ground, onClick: () => this.train('ground') },
    ]);
  }

  private train(card: Card): void {
    const T = pick(TEXT);
    this.card = card;
    this.phase = 'train';
    const reward: Reward = card;
    this.teacher = new Teacher(this.plan, 'Wiggler', { reward });
    this.teacher.rate = TRAIN_RATE;
    this.teacher.picking = false;
    this.host.hint(T.training(T.cards[card]));
    this.host.buttons([]);
    sound.play('whoosh');
  }

  private judge(): void {
    const t = this.teacher!;
    this.phase = 'judge';
    this.trial = new Trial(this.plan, t.evo.best!.genome, undefined, 12, true);
    this.host.hint(pick(TEXT).judging);
    sound.play('horn');
  }

  private result(): void {
    const T = pick(TEXT);
    const c = this.trial!.c;
    const counts = Math.max(0, c.groundDist);
    this.tries.push({ card: this.card, air: c.airborne(), counts });
    this.score = Math.round(Math.max(...this.tries.map((x) => x.counts)) * POINTS_PER_M);
    this.phase = 'result';
    this.host.hint(c.airborne() > 0.3 ? T.hopped : T.walked);
    sound.play(c.airborne() > 0.3 ? 'thud' : 'cheer');
    const defs = [];
    if (this.tries.length < TRIES) defs.push({ emoji: '🔁', label: T.again, onClick: () => this.choose() });
    defs.push({ emoji: '✅', label: T.keep(this.score), onClick: () => this.finish() });
    this.host.buttons(defs);
  }

  private finish(): void {
    const T = pick(TEXT);
    this.host.finish(
      this.score,
      T.summary(this.tries.map((t) => ({ card: T.cards[t.card], air: t.air, counts: fmtMetres(t.counts) }))),
    );
  }

  hud(): string {
    const best = this.tries.length ? fmtMetres(Math.max(...this.tries.map((t) => t.counts))) : '—';
    return pick(TEXT).hud(this.tries.length, best);
  }

  step(dt: number): void {
    if (this.phase === 'choose') {
      this.idle.step();
      this.idle.step();
    } else if (this.phase === 'train' && this.teacher) {
      this.teacher.step(dt);
      if (this.teacher.evo.generation > GENERATIONS && this.teacher.evo.best) this.judge();
    } else if (this.phase === 'judge' && this.trial) {
      if (this.trial.step(dt)) this.result();
    }
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const T = pick(TEXT);
    if (this.phase === 'choose') {
      const scale = Math.max(45, Math.min(160, 0.22 * Math.min(w, h)));
      const v: View = { camX: this.idle.comX(), scale, centerX: w / 2, groundY: h * 0.62, top: 0, height: h };
      drawGround(ctx, v, w);
      drawCreature(ctx, v, this.idle, { head: COLOR.you });
      label(ctx, T.rule, w / 2, h * 0.24, Math.max(26, Math.min(44, w / 28)), COLOR.text, 'center', 800);
      return;
    }
    if (this.phase === 'train' && this.teacher) {
      this.teacher.layout(w, h);
      this.teacher.draw(ctx);
      return;
    }
    if (this.trial) {
      const c = this.trial.c;
      const flew = Math.max(0, c.dist() - c.groundDist);
      this.trial.draw(ctx, w, h, T.caption(fmtMetres(Math.max(0, c.groundDist)), fmtMetres(flew)), T.flying);
    }
  }

  down(): void {}
  move(): void {}
  up(): void {}
  dispose(): void {}
}
