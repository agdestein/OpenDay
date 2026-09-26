// ⛰️ The design challenge: build a body that crosses the bumpy course, when it
// may only practise on a flat floor. The body is the kid's; the brain is
// evolution's (30 generations on the flat, fast), and then the steadiest brain
// of the last generation's best five walks 12 s across the course (the same
// course as round 3). The lesson: a good body needs less practice. Measured
// (flat practice only, 0.2 m bumps, median of 6): Doggo 0.4 m, stick-man 4.9,
// a long-legged Doggo 5.1, a wheel 6.0, Hopper 11.3, a tripod 15.9, a
// caterpillar 18.6, Wiggler 19.5 — low, long or many-legged bodies don't trip.
import { bumpyGround, FLAT, type BodyPlan, type Ground } from './physics';
import { steadiest } from './evolve';
import { COURSE_SEED, kindOf } from './presets';
import { Teacher } from './teach';
import { Trial } from './trial';
import { fmtMetres } from './text';
import { pick, type Localized } from '../../lib/i18n';
import { sound } from '../../lib/sound';

export const DESIGN_GENERATIONS = 30;
const TRAIN_RATE = 40;
export const DESIGN_BUMPS = 0.2;

export const DESIGN_TEXT: Localized<{
  button: string;
  brief: string;
  test: string;
  hud: (best: string) => string;
  training: string;
  testing: string;
  caption: (d: string) => string;
  tripped: string;
  crossed: string;
  change: string;
  board: string;
  park: string;
  heading: string;
}> = {
  en: {
    button: 'Design',
    brief: '⛰️ Build a creature that crosses the bumps. The catch: it may only practise on a flat floor!',
    test: 'Test it!',
    hud: (best) => `⛰️ Design challenge   🏆 ${best}`,
    training: '🧠 30 generations of practice — on a flat floor only.',
    testing: '⛰️ Now the bumps it has never seen: 12 seconds!',
    caption: (d) => `⛰️ ${d} across the course`,
    tripped: 'It tripped. Can you build a body that doesn’t — lower? longer? more legs?',
    crossed: 'It crossed without ever seeing a bump! A good body needs less practice.',
    change: 'Change the body',
    board: 'On the board',
    park: 'To the park',
    heading: '⛰️ Today’s best climbers',
  },
  nl: {
    button: 'Ontwerpen',
    brief: '⛰️ Bouw een beestje dat over de hobbels komt. Maar: het mag alleen oefenen op een vlakke vloer!',
    test: 'Testen!',
    hud: (best) => `⛰️ Ontwerpuitdaging   🏆 ${best}`,
    training: '🧠 30 generaties oefenen — alleen op een vlakke vloer.',
    testing: '⛰️ Nu de hobbels die het nooit zag: 12 seconden!',
    caption: (d) => `⛰️ ${d} over het parcours`,
    tripped: 'Het struikelde. Kun jij een lijf bouwen dat niet struikelt — lager? langer? meer poten?',
    crossed: 'Het kwam erover zonder ooit een hobbel te zien! Een goed lijf heeft minder oefening nodig.',
    change: 'Lijf aanpassen',
    board: 'Op het bord',
    park: 'Naar het park',
    heading: '⛰️ De beste klimmers van vandaag',
  },
  no: {
    button: 'Design',
    brief: '⛰️ Bygg en skapning som kommer seg over humpene. Men: den får bare øve på flatt gulv!',
    test: 'Test den!',
    hud: (best) => `⛰️ Designutfordring   🏆 ${best}`,
    training: '🧠 30 generasjoner øving — bare på flatt gulv.',
    testing: '⛰️ Nå humpene den aldri har sett: 12 sekunder!',
    caption: (d) => `⛰️ ${d} over løypa`,
    tripped: 'Den snublet. Klarer du å bygge en kropp som ikke snubler — lavere? lengre? flere bein?',
    crossed: 'Den kom over uten å ha sett en hump! En god kropp trenger mindre øving.',
    change: 'Endre kroppen',
    board: 'På tavla',
    park: 'Til parken',
    heading: '⛰️ Dagens beste klatrere',
  },
};

/** One tried design: practice on the flat floor, then the course. */
export class DesignRun {
  phase: 'train' | 'test' | 'done' = 'train';
  readonly course: Ground = bumpyGround(COURSE_SEED, DESIGN_BUMPS);
  private teacher: Teacher;
  private trial: Trial | null = null;

  constructor(
    readonly plan: BodyPlan,
    private hint: (text: string) => void,
  ) {
    this.teacher = new Teacher(plan, kindOf(plan));
    this.teacher.rate = TRAIN_RATE;
    this.teacher.picking = false;
    hint(pick(DESIGN_TEXT).training);
    sound.play('whoosh');
  }

  /** Metres across the course (when done). */
  get dist(): number {
    return this.trial ? Math.max(0, this.trial.c.dist()) : 0;
  }

  get genome() {
    return this.trial?.c.genome ?? null;
  }

  step(dt: number): void {
    if (this.phase === 'train') {
      this.teacher.step(dt);
      if (this.teacher.evo.generation > DESIGN_GENERATIONS && this.teacher.evo.best) {
        this.phase = 'test';
        this.trial = new Trial(this.plan, steadiest(this.teacher.evo, [FLAT]), this.course, 12);
        this.hint(pick(DESIGN_TEXT).testing);
        sound.play('horn');
      }
    } else if (this.phase === 'test' && this.trial?.step(dt)) {
      this.phase = 'done';
      const T = pick(DESIGN_TEXT);
      const good = this.dist > 4;
      this.hint(good ? T.crossed : T.tripped);
      sound.play(good ? 'cheer' : 'thud');
    }
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.phase === 'train') {
      this.teacher.layout(w, h);
      this.teacher.draw(ctx);
    } else if (this.trial) {
      this.trial.draw(ctx, w, h, pick(DESIGN_TEXT).caption(fmtMetres(this.dist)), '');
    }
  }
}
