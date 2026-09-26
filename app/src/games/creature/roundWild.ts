// Round 3, Into the wild: a learner is only as good as the world it practised
// in. Your Doggo will cross a bumpy course it has never seen (the same course
// for every kid). You choose where it practises: a flat floor (it walks
// farther there — the trap) or bumps that change every generation. Then 12 s
// on the course. Two tries, the best counts. The brain that goes out is the
// one of the last generation's best five that does best on a few fresh
// practice worlds (flat floors, or new bumps), never the course itself.
// (Measured over 16 runs: flat-trained Doggos reach a median 0.2 m on the
// course, 14 of 16 stuck below 3 m; bump-trained ones 7.8 m, none below 3 m —
// tests/creature.test.ts.)
import { bumpyGround, Creature, FLAT, type Ground } from './physics';
import { steadiest } from './evolve';
import { preset, COURSE_SEED } from './presets';
import { TRAINED } from './brains';
import { CPU_PAUSE, type Round, type RoundHost } from './rounds';
import { Teacher } from './teach';
import { Trial } from './trial';
import { fmtMetres } from './text';
import { COLOR, drawCreature, drawGround, label, type View } from './view';
import { fmtNumber, pick, type Localized } from '../../lib/i18n';
import { sound } from '../../lib/sound';

const GENERATIONS = 40;
const TRAIN_RATE = 40;
const POINTS_PER_M = 60;
const TRIES = 2;
const BUMPS = 0.2;

type Practice = 'flat' | 'bumps';

const TEXT: Localized<{
  title: string;
  intro: string;
  course: string;
  cards: Record<Practice, string>;
  training: (card: string) => string;
  testing: string;
  caption: (d: string) => string;
  outcome: Record<`${Practice}-${'good' | 'bad'}`, string>;
  again: string;
  keep: (points: number) => string;
  hud: (tries: number, best: string) => string;
  summary: (tries: { card: string; dist: string }[]) => string;
}> = {
  en: {
    title: '⛰️ Into the wild',
    intro: 'Your Doggo will cross bumpy ground it has never seen. Where should it practise?',
    course: '⛰️ The course: bumps it has never seen',
    cards: { flat: 'Practise on a flat floor', bumps: 'Practise on changing bumps' },
    training: (card) => `🧠 ${card}: 20 Doggos, 40 generations.`,
    testing: '⛰️ Now the real thing: 12 seconds across the course!',
    caption: (d) => `⛰️ ${d} across the course`,
    outcome: {
      'flat-bad': 'Great on the flat floor, tripped by the bumps: it had never seen one.',
      'flat-good': 'It never saw a bump and still got across: lucky this time!',
      'bumps-good': 'It practised on bumps that changed every time, so these new ones were nothing new.',
      'bumps-bad': 'Bumps are hard, even with practice. Try again?',
    },
    again: 'Try again',
    keep: (points) => `Keep ${fmtNumber(points)}`,
    hud: (tries, best) => `🔁 ${tries}/${TRIES}   🏆 ${best}`,
    summary: (tries) =>
      `${tries.map((t) => `${t.card}: ${t.dist} across the course.`).join(' ')} A learner is only as good as the world it practised in. That is why robots practise in thousands of different simulated worlds — and why the simulations must be like the real world.`,
  },
  nl: {
    title: '⛰️ De wildernis in',
    intro: 'Je hondje moet over hobbelige grond die het nog nooit heeft gezien. Waar gaat het oefenen?',
    course: '⛰️ Het parcours: hobbels die het nooit zag',
    cards: { flat: 'Oefenen op een vlakke vloer', bumps: 'Oefenen op steeds andere hobbels' },
    training: (card) => `🧠 ${card}: 20 hondjes, 40 generaties.`,
    testing: '⛰️ Nu het echte werk: 12 seconden over het parcours!',
    caption: (d) => `⛰️ ${d} over het parcours`,
    outcome: {
      'flat-bad': 'Top op de vlakke vloer, gestruikeld over de hobbels: het had er nog nooit een gezien.',
      'flat-good': 'Het zag nooit een hobbel en kwam er toch over: geluk gehad!',
      'bumps-good': 'Het oefende op hobbels die elke keer anders waren, dus deze nieuwe waren niets nieuws.',
      'bumps-bad': 'Hobbels zijn lastig, zelfs met oefenen. Nog een keer?',
    },
    again: 'Nog een keer',
    keep: (points) => `${fmtNumber(points)} houden`,
    hud: (tries, best) => `🔁 ${tries}/${TRIES}   🏆 ${best}`,
    summary: (tries) =>
      `${tries.map((t) => `${t.card}: ${t.dist} over het parcours.`).join(' ')} Wie leert, is maar zo goed als de wereld waarin hij oefende. Daarom oefenen robots in duizenden verschillende gesimuleerde werelden — en moeten de simulaties op de echte wereld lijken.`,
  },
  no: {
    title: '⛰️ Ut i villmarken',
    intro: 'Vovven din skal over humpete bakke den aldri har sett. Hvor skal den øve?',
    course: '⛰️ Løypa: humper den aldri har sett',
    cards: { flat: 'Øv på et flatt gulv', bumps: 'Øv på humper som skifter' },
    training: (card) => `🧠 ${card}: 20 vovser, 40 generasjoner.`,
    testing: '⛰️ Nå gjelder det: 12 sekunder over løypa!',
    caption: (d) => `⛰️ ${d} over løypa`,
    outcome: {
      'flat-bad': 'Flott på flatt gulv, snublet i humpene: den hadde aldri sett en.',
      'flat-good': 'Den så aldri en hump og kom seg likevel over: flaks denne gangen!',
      'bumps-good': 'Den øvde på humper som var nye hver gang, så disse nye var ikke noe nytt.',
      'bumps-bad': 'Humper er vanskelige, selv med øving. Prøv igjen?',
    },
    again: 'Prøv igjen',
    keep: (points) => `Behold ${fmtNumber(points)}`,
    hud: (tries, best) => `🔁 ${tries}/${TRIES}   🏆 ${best}`,
    summary: (tries) =>
      `${tries.map((t) => `${t.card}: ${t.dist} over løypa.`).join(' ')} Den som lærer, blir aldri bedre enn verdenen den øvde i. Derfor øver roboter i tusenvis av ulike simulerte verdener — og derfor må simuleringene ligne den virkelige verden.`,
  },
};

type Phase = 'choose' | 'train' | 'test' | 'result';

export class WildRound implements Round {
  readonly title = pick(TEXT).title;
  score = 0;
  private plan = preset('Doggo').plan;
  private course: Ground = bumpyGround(COURSE_SEED, BUMPS);
  private phase: Phase = 'choose';
  private practice: Practice = 'flat';
  private teacher: Teacher | null = null;
  private trial: Trial | null = null;
  private tries: { practice: Practice; dist: number }[] = [];
  private idle: Creature;
  /** The computer's turn: seconds since its last move. */
  private wait = 0;
  private finished = false;
  private seed = Math.floor(Math.random() * 1e6);

  constructor(private host: RoundHost) {
    this.idle = new Creature(this.plan, TRAINED.Doggo, { ground: this.course });
    this.choose();
  }

  private choose(): void {
    const T = pick(TEXT);
    this.phase = 'choose';
    this.wait = 0;
    this.host.hint(T.intro);
    this.host.buttons([
      { emoji: '🟫', label: T.cards.flat, onClick: () => this.train('flat') },
      { emoji: '⛰️', label: T.cards.bumps, onClick: () => this.train('bumps') },
    ]);
  }

  private train(practice: Practice): void {
    const T = pick(TEXT);
    this.practice = practice;
    this.phase = 'train';
    const seed = this.seed++ * 1000;
    this.teacher = new Teacher(this.plan, 'Doggo', {
      groundFor: practice === 'flat' ? undefined : (gen) => bumpyGround(seed + gen, BUMPS),
    });
    this.teacher.rate = TRAIN_RATE;
    this.teacher.picking = false;
    this.host.hint(T.training(T.cards[practice]));
    this.host.buttons([]);
    sound.play('whoosh');
  }

  private test(): void {
    this.phase = 'test';
    const worlds = this.practice === 'flat' ? [FLAT] : [1, 2, 3].map((k) => bumpyGround(this.seed * 7919 + k, BUMPS));
    this.trial = new Trial(this.plan, steadiest(this.teacher!.evo, worlds), this.course, 12);
    this.host.hint(pick(TEXT).testing);
    sound.play('horn');
  }

  private result(): void {
    const T = pick(TEXT);
    const d = this.trial!.c.dist();
    this.tries.push({ practice: this.practice, dist: d });
    this.score = Math.round(Math.max(0, ...this.tries.map((t) => t.dist)) * POINTS_PER_M);
    this.phase = 'result';
    this.wait = 0;
    const good = d > 4;
    this.host.hint(T.outcome[`${this.practice}-${good ? 'good' : 'bad'}`]);
    sound.play(good ? 'cheer' : 'thud');
    const defs = [];
    if (this.tries.length < TRIES) defs.push({ emoji: '🔁', label: T.again, onClick: () => this.choose() });
    defs.push({ emoji: '✅', label: T.keep(this.score), onClick: () => this.finish() });
    this.host.buttons(defs);
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    const T = pick(TEXT);
    this.host.finish(this.score, T.summary(this.tries.map((t) => ({ card: T.cards[t.practice], dist: fmtMetres(Math.max(0, t.dist)) }))));
  }

  hud(): string {
    const best = this.tries.length ? fmtMetres(Math.max(0, ...this.tries.map((t) => t.dist))) : '—';
    return pick(TEXT).hud(this.tries.length, best);
  }

  step(dt: number): void {
    // The computer's turn: it tries both practice worlds and keeps the better.
    if (this.host.auto() && (this.phase === 'choose' || this.phase === 'result')) {
      this.wait += dt;
      if (this.wait > CPU_PAUSE) {
        if (this.phase === 'choose') this.train(this.tries.length === 0 ? 'flat' : 'bumps');
        else if (this.tries.length < TRIES) this.choose();
        else this.finish();
      }
    }
    if (this.phase === 'choose') {
      this.idle.step();
      this.idle.step();
      if (this.idle.dist() > 7 || this.idle.time > 10) this.idle = new Creature(this.plan, TRAINED.Doggo, { ground: this.course });
    } else if (this.phase === 'train' && this.teacher) {
      this.teacher.step(dt);
      if (this.teacher.evo.generation > GENERATIONS && this.teacher.evo.best) this.test();
    } else if (this.phase === 'test' && this.trial) {
      if (this.trial.step(dt)) this.result();
    }
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const T = pick(TEXT);
    if (this.phase === 'choose') {
      // A look at the course ahead, and a Doggo on the flat floor it knows.
      const scale = Math.max(35, Math.min(100, 0.13 * Math.min(w, h)));
      const v: View = { camX: 4.5, scale, centerX: w / 2, groundY: h * 0.62, top: 0, height: h };
      drawGround(ctx, v, w, { ground: this.course, metres: true, flag: true });
      drawCreature(ctx, v, this.idle, { head: COLOR.you });
      label(ctx, T.course, w / 2, h * 0.24, Math.max(24, Math.min(40, w / 30)), COLOR.text, 'center', 800);
      return;
    }
    if (this.phase === 'train' && this.teacher) {
      this.teacher.layout(w, h);
      this.teacher.draw(ctx);
      return;
    }
    if (this.trial) this.trial.draw(ctx, w, h, T.caption(fmtMetres(Math.max(0, this.trial.c.dist()))), '');
  }

  down(): void {}
  move(): void {}
  up(): void {}
  dispose(): void {}
}
