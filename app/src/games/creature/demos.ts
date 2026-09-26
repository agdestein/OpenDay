// Live illustrations for the delve's six chapters, drawn on the game canvas to
// the right of the delve card:
//   0 dots and springs: a limp Doggo to grab and throw;
//   1 the brain is a rhythm: brain waves, scramble, and a nudged twin (chaos);
//   2 learning is searching: a map of two-number brains, painted live; point at
//     it and that brain walks; six hill-climbers search it without seeing it;
//   3 it does what you reward: the race-walk worms side by side;
//   4 it finds every flaw: the old limitless muscles (cartwheels, a flying worm;
//     the 🐞 switch turns them off) and flat- versus bump-trained Doggos on a course;
//   5 brains that feel: three Doggos get the same shoves (practised calmly,
//     practised with shoves, and with senses too), with the feeling brain drawn live;
//   6 robots go to school: the zoo of trained bodies.
import { bumpyGround, Creature, FIXED_DT, simulate, type BodyPlan, type Genome, type Ground } from './physics';
import { randomGenome, randomShoves, seededRandom, type Shove } from './evolve';
import { COURSE_SEED, KIND_NAMES, PRESETS, preset } from './presets';
import { DEMO_BRAINS, TRAINED } from './brains';
import { Park } from './park';
import { fmtMetres } from './text';
import { COLOR, MUSCLE_COLORS, drawCreature, drawGround, label, panel, type View } from './view';
import { pick, type Localized } from '../../lib/i18n';
import { sound } from '../../lib/sound';

const LAB: Localized<{
  legend: { dot: string; bone: string; muscle: string };
  grab: string;
  waves: string;
  twinGap: (d: string) => string;
  twins: string;
  map: string;
  painting: (pct: number) => string;
  point: string;
  axes: [string, string];
  climbers: string;
  lanes: { hop: string; ground: string };
  flew: (pct: number) => string;
  bug: { cartwheel: (turns: number) => string; jump: (h: string) => string; flat: string; bumps: string };
  zoo: (name: string, d: string) => string;
  feel: {
    calm: string;
    shoved: string;
    withSenses: string;
    flips: (n: number) => string;
    net: string;
    icons: string[];
    sensesCol: string;
    neuronsCol: string;
    musclesCol: string;
  };
}> = {
  en: {
    legend: { dot: 'dot: a little mass', bone: 'bone: fixed length', muscle: 'muscle: pulsing spring' },
    grab: '👉 grab it and throw it!',
    waves: 'each muscle’s length over time  ·  ● = now',
    twinGap: (d) => `the twins are ${d} apart`,
    twins: '👯 the same brain, nudged by a hair',
    map: 'every pixel is a brain: bright walks far',
    painting: (pct) => `painting the map: ${pct} % of the brains tried`,
    point: '👆 point at the map: that brain walks below',
    axes: ['timing of the back leg →', 'timing of the front leg →'],
    climbers: '● six climbers: keep the better step, try again',
    lanes: { hop: '🏁 rewarded for distance', ground: '👣 rewarded for distance with a foot on the ground' },
    flew: (pct) => `🚫 flying ${pct} % of the time`,
    bug: {
      cartwheel: (turns) => `🐞 stick-man: ${turns} cartwheels`,
      jump: (h) => `🐞 worm: jumps ${h} high`,
      flat: '🟫 practised on a flat floor',
      bumps: '⛰ practised on changing bumps',
    },
    zoo: (name, d) => `${name} — ${d}`,
    feel: {
      calm: '🎵 practised on calm ground',
      shoved: '🎵 practised with shoves',
      withSenses: '👁 practised with shoves, with senses',
      flips: (n) => `🙃 on its back ${n}×`,
      net: 'the bottom Doggo’s brain, live: senses → neurons → muscles (yellow +, blue −)',
      icons: ['⏱ sin', '⏱ cos', '📐 tilt', '🔄 spin', '⬆ head', '➡ speed', '⬆ speed', '🦶 back', '🦶 front', '🦶', '🦶'],
      sensesCol: 'senses',
      neuronsCol: 'neurons',
      musclesCol: 'muscles',
    },
  },
  nl: {
    legend: { dot: 'stip: een klein gewicht', bone: 'bot: vaste lengte', muscle: 'spier: kloppende veer' },
    grab: '👉 pak hem en gooi hem!',
    waves: 'lengte van elke spier in de tijd  ·  ● = nu',
    twinGap: (d) => `de tweelingen zijn ${d} uit elkaar`,
    twins: '👯 hetzelfde brein, een haartje verschoven',
    map: 'elke pixel is een brein: helder loopt ver',
    painting: (pct) => `de kaart wordt geschilderd: ${pct} % van de breinen geprobeerd`,
    point: '👆 wijs een plek aan: dat brein loopt hieronder',
    axes: ['timing van de achterpoot →', 'timing van de voorpoot →'],
    climbers: '● zes klimmers: houd de betere stap, probeer opnieuw',
    lanes: { hop: '🏁 beloond voor afstand', ground: '👣 beloond voor afstand met een voet op de grond' },
    flew: (pct) => `🚫 vliegt ${pct} % van de tijd`,
    bug: {
      cartwheel: (turns) => `🐞 stokmannetje: ${turns} radslagen`,
      jump: (h) => `🐞 worm: springt ${h} hoog`,
      flat: '🟫 oefende op een vlakke vloer',
      bumps: '⛰ oefende op steeds andere hobbels',
    },
    zoo: (name, d) => `${name} — ${d}`,
    feel: {
      calm: '🎵 oefende op rustige grond',
      shoved: '🎵 oefende met duwtjes',
      withSenses: '👁 oefende met duwtjes, met zintuigen',
      flips: (n) => `🙃 ${n}× op zijn rug`,
      net: 'het brein van het onderste hondje, live: zintuigen → neuronen → spieren (geel +, blauw −)',
      icons: ['⏱ sin', '⏱ cos', '📐 scheef', '🔄 draai', '⬆ kop', '➡ vaart', '⬆ vaart', '🦶 achter', '🦶 voor', '🦶', '🦶'],
      sensesCol: 'zintuigen',
      neuronsCol: 'neuronen',
      musclesCol: 'spieren',
    },
  },
  no: {
    legend: { dot: 'prikk: en liten masse', bone: 'bein: fast lengde', muscle: 'muskel: pulserende fjær' },
    grab: '👉 grip den og kast den!',
    waves: 'hver muskels lengde over tid  ·  ● = nå',
    twinGap: (d) => `tvillingene er ${d} fra hverandre`,
    twins: '👯 samme hjerne, flyttet et hårstrå',
    map: 'hver piksel er en hjerne: lys går langt',
    painting: (pct) => `kartet males: ${pct} % av hjernene prøvd`,
    point: '👆 pek på kartet: den hjernen går her under',
    axes: ['takten til bakbeinet →', 'takten til forbeinet →'],
    climbers: '● seks klatrere: behold det bedre steget, prøv igjen',
    lanes: { hop: '🏁 belønnet for avstand', ground: '👣 belønnet for avstand med en fot i bakken' },
    flew: (pct) => `🚫 flyr ${pct} % av tiden`,
    bug: {
      cartwheel: (turns) => `🐞 pinnemann: ${turns} hjul`,
      jump: (h) => `🐞 mark: hopper ${h} høyt`,
      flat: '🟫 øvde på flatt gulv',
      bumps: '⛰ øvde på humper som skiftet',
    },
    zoo: (name, d) => `${name} — ${d}`,
    feel: {
      calm: '🎵 øvde på rolig bakke',
      shoved: '🎵 øvde med dytt',
      withSenses: '👁 øvde med dytt, med sanser',
      flips: (n) => `🙃 på ryggen ${n}×`,
      net: 'hjernen til den nederste vovsen, live: sanser → nevroner → muskler (gult +, blått −)',
      icons: ['⏱ sin', '⏱ cos', '📐 skjev', '🔄 snurr', '⬆ hode', '➡ fart', '⬆ fart', '🦶 bak', '🦶 foran', '🦶', '🦶'],
      sensesCol: 'sanser',
      neuronsCol: 'nevroner',
      musclesCol: 'muskler',
    },
  },
};

/** The landscape chapter: two of Doggo's numbers vary, the rest are the champion's. */
const MAP_N = 40;
const MAP_SECONDS = 5;
const MAP_GENES = [1, 2];
const MAP_BUDGET = 8;
/** Kept between openings of the delve: the map takes a few seconds to paint. */
let landscape: Float32Array | null = null;
let painted = 0;

interface Lane {
  c: Creature;
  plan: BodyPlan;
  genome: Genome;
  ground?: Ground;
  old?: boolean;
  seconds: number;
  camX: number;
  camY: number;
  marks: { from: number; to: number }[];
  airFrom: number | null;
  best: number;
  /** Times it has ended up on its back, and whether it is now. */
  flips: number;
  upside: boolean;
}

function lane(plan: BodyPlan, genome: Genome, seconds: number, ground?: Ground, old = false): Lane {
  return { c: new Creature(plan, genome, { ground, oldMuscles: old }), plan, genome, ground, old, seconds, camX: 1, camY: 0, marks: [], airFrom: null, best: 0, flips: 0, upside: false };
}

function restart(l: Lane): void {
  l.c = new Creature(l.plan, l.genome, { ground: l.ground, oldMuscles: l.old });
  l.marks = [];
  l.airFrom = null;
  l.best = 0;
  l.flips = 0;
  l.upside = false;
}

function limp(plan: BodyPlan): Genome {
  return { freq: 1, muscles: plan.sticks.filter((s) => s.muscle).map(() => ({ amp: 0, phase: 0 })) };
}

export class CreatureDemos {
  chapter = -1;
  /** The 🐞 switch: the stick-man and the worm on the old, limitless muscles. */
  oldMuscles = true;
  private own: { plan: BodyPlan; genome: Genome } | null = null;
  private acc = 0;
  private time = 0;
  private w = 1;
  private h = 1;
  // chapter 0
  private park = new Park();
  // chapter 1
  private brain: Creature | null = null;
  private twin: Creature | null = null;
  private brainCam = 0;
  private brainIsChampion = true;
  // chapter 2
  private hoverCell = -1;
  private walker: Creature | null = null;
  private climbers: { i: number; j: number; trail: [number, number][] }[] = [];
  private climbAcc = 0;
  // chapters 3–6
  private lanes: Lane[] = [];
  // chapter 5: the same shoves for all three, every 1.5–3 s
  private shoves: Shove[] = [];
  private nextShove = 0;
  private puff = -1;

  setOwnBrain(brain: { plan: BodyPlan; genome: Genome } | null): void {
    this.own = brain;
  }

  /** The brain chapter shows the kid's own trained creature when there is one. */
  private champion(): { plan: BodyPlan; genome: Genome } {
    return this.own ?? { plan: preset('Doggo').plan, genome: TRAINED.Doggo };
  }

  clear(): void {
    this.chapter = -1;
    this.lanes = [];
    this.brain = this.twin = this.walker = null;
    this.park = new Park();
  }

  reset(chapter: number): void {
    this.chapter = chapter;
    this.acc = 0;
    this.lanes = [];
    this.brain = this.twin = this.walker = null;
    if (chapter === 0) {
      this.park = new Park();
      const doggo = preset('Doggo').plan;
      this.layoutPark();
      this.park.add(doggo, limp(doggo), 'Doggo', { x: this.park.width * 0.5, select: false });
    } else if (chapter === 1) {
      this.setBrain(true);
    } else if (chapter === 2) {
      this.climbers = [];
      this.hoverCell = -1;
    } else if (chapter === 3) {
      const worm = preset('Wiggler').plan;
      this.lanes = [lane(worm, DEMO_BRAINS.wigglerHop, 12), lane(worm, DEMO_BRAINS.wigglerGround, 12)];
    } else if (chapter === 4) {
      this.bugLanes();
    } else if (chapter === 5) {
      const doggo = preset('Doggo').plan;
      this.lanes = [lane(doggo, TRAINED.Doggo, 14), lane(doggo, DEMO_BRAINS.doggoShoved, 14), lane(doggo, DEMO_BRAINS.doggoFeel, 14)];
      this.shoves = randomShoves(14, seededRandom(4242));
      this.nextShove = 0;
    } else if (chapter === 6) {
      this.lanes = PRESETS.map((p) => lane(p.plan, TRAINED[p.id], 14));
    }
  }

  /** The lab's button: everyone in the chapter gets the same shove, now. */
  shoveNow(): void {
    const vx = (Math.random() < 0.5 ? -1 : 1) * 2.5;
    for (const l of this.lanes) l.c.kick(vx, 0.8);
    this.puff = 0;
    sound.play('whoosh');
  }

  private bugLanes(): void {
    const course = bumpyGround(COURSE_SEED, 0.2);
    const doggo = preset('Doggo').plan;
    this.lanes = [
      lane(preset('Stickman').plan, DEMO_BRAINS.stickOld, 10, undefined, this.oldMuscles),
      lane(preset('Wiggler').plan, DEMO_BRAINS.wormOldJump, 8, undefined, this.oldMuscles),
      lane(doggo, DEMO_BRAINS.doggoFlat, 12, course),
      lane(doggo, DEMO_BRAINS.doggoBumps, 12, course),
    ];
  }

  setOldMuscles(on: boolean): void {
    this.oldMuscles = on;
    if (this.chapter === 4) {
      for (const l of this.lanes.slice(0, 2)) {
        l.old = on;
        restart(l);
      }
    }
  }

  // ---- chapter 1: the brain ----

  setBrain(champion: boolean): void {
    const b = this.champion();
    this.brain = new Creature(b.plan, champion ? b.genome : randomGenome(b.plan));
    this.brainIsChampion = champion;
    this.twin = null;
    this.brainCam = 0;
    sound.play(champion ? 'ding' : 'pop');
  }

  /**
   * Twins: the brain on show and a copy with every timing nudged by a hair.
   * A good walk shrugs it off (they stay together); a flailing brain is often
   * chaotic, and then they part. Only about a third of scrambled brains part
   * within 10 s, so, like Ball Pit's Plinko twins, it quietly tries up to
   * forty on a copy and shows one whose twins are 0.7 m apart by 6 s (found in
   * 48 of 50 searches, ~40 ms each).
   */
  nudge(): void {
    const b = this.champion();
    const nudged = (g: Genome): Genome => ({ ...g, muscles: g.muscles.map((m) => ({ ...m, phase: m.phase + (Math.random() * 2 - 1) * 0.01 })) });
    let genome = this.brain?.genome ?? b.genome;
    let twin = nudged(genome);
    if (!this.brainIsChampion) {
      for (let k = 0; k < 40; k++) {
        const g = k === 0 ? genome : randomGenome(b.plan);
        const t = nudged(g);
        if (Math.abs(simulate(b.plan, g, 6).dist() - simulate(b.plan, t, 6).dist()) > 0.7) {
          genome = g;
          twin = t;
          break;
        }
      }
    }
    this.brain = new Creature(b.plan, genome);
    this.twin = new Creature(b.plan, twin);
    this.brainCam = 0;
    sound.play('boing');
  }

  // ---- frame ----

  /** Left edge of the demo area (right of the delve card). */
  private left(): number {
    return Math.min(24 + 440, 24 + 0.42 * this.w) + 16;
  }

  private layoutPark(): void {
    const left = this.left();
    const scale = Math.max(55, Math.min(170, this.h * 0.2));
    const width = (this.w - left) / scale;
    this.park.width = width;
    this.park.view = { camX: width / 2, scale, centerX: left + (this.w - left) / 2, groundY: this.h * 0.72, top: 0, height: this.h };
  }

  step(dt: number): void {
    this.time += dt;
    if (this.chapter === 0) {
      this.park.step(dt);
      return;
    }
    if (this.chapter === 2) {
      this.paint();
      this.climb(dt);
    }
    this.acc += dt;
    let steps = Math.min(40, Math.floor(this.acc / FIXED_DT));
    this.acc -= steps * FIXED_DT;
    if (this.acc > 0.3) this.acc = 0;
    while (steps-- > 0) {
      this.brain?.step();
      this.twin?.step();
      this.walker?.step();
      for (const l of this.lanes) {
        l.c.step();
        if (!l.c.touching && l.airFrom === null) l.airFrom = l.c.dist();
        else if (l.c.touching && l.airFrom !== null) {
          l.marks.push({ from: l.airFrom, to: l.c.dist() });
          l.airFrom = null;
        }
        l.best = Math.max(l.best, l.c.bestClear);
      }
    }
    if (this.chapter === 5 && this.lanes.length) {
      const s = this.shoves[this.nextShove];
      if (s && this.lanes[0].c.time >= s.t) {
        for (const l of this.lanes) l.c.kick(s.vx, s.vy);
        this.nextShove++;
        this.puff = 0;
        sound.play('whoosh', { pitch: 0.8, volume: 0.7 });
      }
      for (const l of this.lanes) {
        const t = Math.abs(l.c.tilt());
        if (!l.upside && t > (2 * Math.PI) / 3) {
          l.upside = true;
          l.flips++;
          sound.play('thud');
        } else if (l.upside && t < Math.PI / 3) l.upside = false;
      }
      // All three start again together, with the same shoves.
      if (this.lanes.some((l) => l.c.time >= l.seconds || !l.c.finite())) {
        for (const l of this.lanes) restart(l);
        this.nextShove = 0;
      }
    }
    if (this.puff >= 0) {
      this.puff += dt;
      if (this.puff > 0.8) this.puff = -1;
    }
    for (const l of this.lanes) {
      if (l.c.time >= l.seconds || !l.c.finite()) restart(l);
      l.camX += (Math.max(1, l.c.dist() + 0.3) - l.camX) * Math.min(1, dt * 3);
    }
    if (this.walker && (this.walker.time > 6 || !this.walker.finite())) this.walker = null;
    if (this.brain) {
      const d = this.twin ? (this.brain.dist() + this.twin.dist()) / 2 : this.brain.dist();
      this.brainCam += (d - this.brainCam) * Math.min(1, dt * 3);
    }
  }

  // ---- chapter 2: the landscape ----

  private mapGenome(i: number, j: number): Genome {
    const g = TRAINED.Doggo;
    const muscles = g.muscles.map((m) => ({ ...m }));
    muscles[MAP_GENES[0]].phase = (2 * Math.PI * i) / MAP_N;
    muscles[MAP_GENES[1]].phase = (2 * Math.PI * j) / MAP_N;
    return { freq: g.freq, muscles };
  }

  private paint(): void {
    if (!landscape) landscape = new Float32Array(MAP_N * MAP_N);
    const plan = preset('Doggo').plan;
    const t0 = performance.now();
    while (painted < MAP_N * MAP_N && performance.now() - t0 < MAP_BUDGET) {
      const i = painted % MAP_N;
      const j = Math.floor(painted / MAP_N);
      landscape[painted] = simulate(plan, this.mapGenome(i, j), MAP_SECONDS).dist();
      painted++;
    }
    if (painted >= MAP_N * MAP_N && this.climbers.length === 0) {
      for (let k = 0; k < 6; k++) {
        const i = Math.floor(Math.random() * MAP_N);
        const j = Math.floor(Math.random() * MAP_N);
        this.climbers.push({ i, j, trail: [[i, j]] });
      }
    }
  }

  private climb(dt: number): void {
    if (!landscape || painted < MAP_N * MAP_N) return;
    this.climbAcc += dt;
    if (this.climbAcc < 0.35) return;
    this.climbAcc = 0;
    const wrap = (k: number) => ((k % MAP_N) + MAP_N) % MAP_N;
    for (const c of this.climbers) {
      const i = wrap(c.i + Math.round((Math.random() * 2 - 1) * 3));
      const j = wrap(c.j + Math.round((Math.random() * 2 - 1) * 3));
      if (landscape[j * MAP_N + i] > landscape[c.j * MAP_N + c.i]) {
        c.i = i;
        c.j = j;
        c.trail.push([i, j]);
      }
    }
  }

  private mapRect(): { x: number; y: number; s: number } {
    const left = this.left();
    const s = Math.min(this.w - left - 60, this.h * 0.56);
    return { x: left + (this.w - left - s) / 2, y: 70, s };
  }

  // ---- input ----

  down(px: number, py: number): void {
    if (this.chapter === 0) this.park.down(px, py);
    else if (this.chapter === 2) this.move(px, py);
  }

  move(px: number, py: number): void {
    if (this.chapter === 0) {
      this.park.move(px, py);
      return;
    }
    if (this.chapter !== 2 || !landscape) return;
    const r = this.mapRect();
    const i = Math.floor(((px - r.x) / r.s) * MAP_N);
    const j = Math.floor(((py - r.y) / r.s) * MAP_N);
    if (i < 0 || j < 0 || i >= MAP_N || j >= MAP_N) return;
    const cell = j * MAP_N + i;
    if (cell === this.hoverCell || cell >= painted) return;
    this.hoverCell = cell;
    this.walker = new Creature(preset('Doggo').plan, this.mapGenome(i, j));
  }

  up(): void {
    if (this.chapter === 0) this.park.up();
  }

  // ---- drawing ----

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.w = w;
    this.h = h;
    const T = pick(LAB);
    const left = this.left();
    const mid = left + (w - left) / 2;
    if (this.chapter === 0) {
      this.layoutPark();
      this.park.draw(ctx, w, h, () => null);
      this.legend(ctx, w);
      label(ctx, T.grab, mid - 60, h * 0.34, 24);
    } else if (this.chapter === 1 && this.brain) {
      const wavesH = Math.min(220, h * 0.32);
      const scale = Math.max(45, Math.min(130, 0.17 * Math.min(w, h)));
      const v: View = { camX: this.brainCam, scale, centerX: mid, groundY: (h - wavesH) * 0.8, top: 0, height: h - wavesH };
      drawGround(ctx, v, w, { metres: true, flag: true });
      if (this.twin) {
        drawCreature(ctx, v, this.twin, { alpha: 0.6, tint: COLOR.champ });
        label(ctx, T.twins, mid, 90, 20, COLOR.champ);
        label(ctx, T.twinGap(fmtMetres(Math.abs(this.twin.dist() - this.brain.dist()))), mid, 120, 22);
      }
      drawCreature(ctx, v, this.brain, { muscleColors: MUSCLE_COLORS });
      this.waves(ctx, w, h, wavesH);
    } else if (this.chapter === 2) {
      this.drawMap(ctx, w, h);
    } else if (this.chapter === 3) {
      const texts = [T.lanes.hop, T.lanes.ground];
      this.drawLanes(ctx, w, h, 2, (l, i) => `${texts[i]}  ·  ${T.flew(Math.round(100 * l.c.airborne()))}`, true);
    } else if (this.chapter === 4) {
      const L = T.bug;
      this.drawLanes(
        ctx,
        w,
        h,
        4,
        (l, i) =>
          i === 0
            ? L.cartwheel(Math.floor(l.c.turns()))
            : i === 1
              ? L.jump(fmtMetres(l.best))
              : `${i === 2 ? L.flat : L.bumps}  ·  ${fmtMetres(Math.max(0, l.c.dist()))}`,
        false,
      );
    } else if (this.chapter === 5) {
      const F = T.feel;
      const titles = [F.calm, F.shoved, F.withSenses];
      const netH = Math.min(250, h * 0.36);
      this.drawLanes(ctx, w, h, 3, (l, i) => `${titles[i]}  ·  ${F.flips(l.flips)}  ·  ${fmtMetres(Math.max(0, l.c.dist()))}`, false, h - netH - 10);
      if (this.puff >= 0) {
        ctx.globalAlpha = Math.max(0, 1 - this.puff / 0.8);
        label(ctx, '💨', left + 60 + 80 * this.puff, (h - netH) / 2, 64);
        ctx.globalAlpha = 1;
      }
      if (this.lanes[2]) this.drawNet(ctx, this.lanes[2].c, left, h - netH, w - left - 20, netH - 14);
    } else if (this.chapter === 6) {
      const names = pick(KIND_NAMES);
      this.drawLanes(ctx, w, h, 4, (l, i) => `${PRESETS[i].emoji} ${T.zoo(names[PRESETS[i].id], fmtMetres(Math.max(0, l.c.dist())))}`, false);
    }
  }

  /** A feeling brain, live: senses on the left, neurons in the middle, muscles on the right. */
  private drawNet(ctx: CanvasRenderingContext2D, c: Creature, x: number, y: number, w: number, h: number): void {
    const net = c.genome.net;
    if (!net || c.senses.length === 0) return;
    const F = pick(LAB).feel;
    panel(ctx, x, y, w, h);
    label(ctx, F.net, x + 14, y + 22, 15, COLOR.dim, 'left', 600);
    const cols = [c.senses, net.hidden > 0 ? c.neurons : [], c.commands].filter((col) => col.length > 0);
    const colX = cols.map((_, i) => x + 90 + ((w - 150) * i) / Math.max(1, cols.length - 1));
    const rowY = (n: number, k: number) => y + 40 + ((h - 56) * (k + 0.5)) / n;
    const colour = (v: number) => (v >= 0 ? `rgba(251, 191, 36, ${0.25 + 0.75 * Math.min(1, v)})` : `rgba(125, 211, 252, ${0.25 + 0.75 * Math.min(1, -v)})`);
    // Wires, faint, coloured by weight sign.
    const w8 = net.w;
    let k = 0;
    for (let col = 1; col < cols.length; col++) {
      const from = cols[col - 1];
      const to = cols[col];
      for (let j = 0; j < to.length; j++) {
        k++; // bias
        for (let i = 0; i < from.length; i++) {
          const wt = w8[k++] ?? 0;
          if (Math.abs(wt) < 0.05) continue;
          ctx.strokeStyle = wt > 0 ? `rgba(251, 191, 36, ${Math.min(0.5, Math.abs(wt) * 0.3)})` : `rgba(125, 211, 252, ${Math.min(0.5, Math.abs(wt) * 0.3)})`;
          ctx.lineWidth = Math.min(3, 0.5 + Math.abs(wt));
          ctx.beginPath();
          ctx.moveTo(colX[col - 1], rowY(from.length, i));
          ctx.lineTo(colX[col], rowY(to.length, j));
          ctx.stroke();
        }
      }
    }
    const icons = F.icons;
    cols.forEach((col, ci) => {
      col.forEach((v, i) => {
        const cx = colX[ci];
        const cy = rowY(col.length, i);
        ctx.fillStyle = colour(v);
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(11, (h - 56) / col.length / 2.4), 0, Math.PI * 2);
        ctx.fill();
        if (ci === 0) label(ctx, icons[Math.min(i, icons.length - 1)], cx - 18, cy + 5, 13, COLOR.dim, 'right', 600);
        if (ci === cols.length - 1) {
          ctx.fillStyle = MUSCLE_COLORS[i % MUSCLE_COLORS.length];
          ctx.fillRect(cx + 16, cy - 3, 26, 6);
        }
      });
    });
    const heads = [F.sensesCol, F.neuronsCol, F.musclesCol];
    cols.forEach((_, ci) => label(ctx, ci === cols.length - 1 ? heads[2] : heads[ci], colX[ci], y + h - 6, 13, COLOR.dim, 'center', 600));
  }

  private drawLanes(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    n: number,
    caption: (l: Lane, i: number) => string,
    judge: boolean,
    bottom = h - 20,
  ): void {
    const left = this.left();
    const top = 70;
    const laneH = (bottom - top) / n;
    this.lanes.forEach((l, i) => {
      const y0 = top + i * laneH;
      // The flying worm needs room above it: a smaller scale in its lane.
      const tall = this.chapter === 4 && i === 1;
      const scale = Math.max(22, Math.min(110, (tall ? laneH / 7 : laneH / 2.4)));
      const v: View = { camX: tall ? l.c.comX() : l.camX, scale, centerX: left + (w - left) * 0.45, groundY: y0 + laneH * 0.86, top: y0, height: laneH };
      ctx.save();
      ctx.beginPath();
      ctx.rect(left - 16, y0, w - left + 16, laneH);
      ctx.clip();
      const start = l.c.startX;
      drawGround(ctx, v, w, {
        ground: l.ground,
        metres: !tall,
        flag: !tall,
        startX: start,
        marks: judge
          ? [...l.marks, ...(l.airFrom !== null ? [{ from: l.airFrom, to: l.c.dist() }] : [])].map((m) => ({ from: start + m.from, to: start + m.to, color: COLOR.bad }))
          : [],
      });
      drawCreature(ctx, v, l.c, {
        head: i === 0 || !judge ? COLOR.you : COLOR.good,
        glow: (judge && !l.c.touching) || l.upside ? COLOR.bad : undefined,
      });
      ctx.restore();
      label(ctx, caption(l, i), left + 8, y0 + 26, 17, COLOR.text, 'left');
      if (i > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(left - 16, y0);
        ctx.lineTo(w, y0);
        ctx.stroke();
      }
    });
  }

  private drawMap(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const T = pick(LAB);
    const r = this.mapRect();
    const cell = r.s / MAP_N;
    let lo = Infinity;
    let hi = -Infinity;
    if (landscape) for (let k = 0; k < painted; k++) {
      lo = Math.min(lo, landscape[k]);
      hi = Math.max(hi, landscape[k]);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fillRect(r.x, r.y, r.s, r.s);
    if (landscape) {
      for (let k = 0; k < painted; k++) {
        const t = Math.max(0, Math.min(1, (landscape[k] - lo) / Math.max(1e-6, hi - lo)));
        ctx.fillStyle = heat(t);
        ctx.fillRect(r.x + (k % MAP_N) * cell, r.y + Math.floor(k / MAP_N) * cell, cell + 0.5, cell + 0.5);
      }
    }
    for (const c of this.climbers) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      c.trail.forEach(([i, j], k) => {
        const x = r.x + (i + 0.5) * cell;
        const y = r.y + (j + 0.5) * cell;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(r.x + (c.i + 0.5) * cell, r.y + (c.j + 0.5) * cell, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0b1020';
      ctx.stroke();
    }
    if (this.hoverCell >= 0) {
      ctx.strokeStyle = COLOR.you;
      ctx.lineWidth = 3;
      ctx.strokeRect(r.x + (this.hoverCell % MAP_N) * cell - 2, r.y + Math.floor(this.hoverCell / MAP_N) * cell - 2, cell + 4, cell + 4);
    }
    label(ctx, T.map, r.x + r.s / 2, r.y - 14, 18);
    label(ctx, T.axes[0], r.x + r.s / 2, r.y + r.s + 24, 15, COLOR.dim);
    ctx.save();
    ctx.translate(r.x - 12, r.y + r.s / 2);
    ctx.rotate(-Math.PI / 2);
    label(ctx, T.axes[1], 0, 0, 15, COLOR.dim);
    ctx.restore();
    const done = painted >= MAP_N * MAP_N;
    label(ctx, done ? (this.climbers.length ? T.climbers : T.point) : T.painting(Math.round((100 * painted) / (MAP_N * MAP_N))), r.x + r.s / 2, r.y + r.s + 50, 17, done ? COLOR.text : COLOR.champ);
    // The brain under the pointer, walking.
    const stripTop = r.y + r.s + 62;
    if (this.walker && h - stripTop > 60) {
      const scale = Math.max(22, Math.min(70, (h - stripTop - 10) / 2.2));
      const v: View = { camX: Math.max(1, this.walker.dist() + 0.3), scale, centerX: r.x + r.s / 2, groundY: h - 14, top: stripTop, height: h - stripTop };
      drawGround(ctx, v, w, { metres: true, flag: true });
      drawCreature(ctx, v, this.walker, { head: COLOR.you });
    } else if (done && h - stripTop > 40) {
      label(ctx, T.point, r.x + r.s / 2, stripTop + 30, 17, COLOR.dim);
    }
  }

  /** Legend for chapter 0: what the dots and sticks are. */
  private legend(ctx: CanvasRenderingContext2D, w: number): void {
    const T = pick(LAB).legend;
    const x = w - 280;
    const y = 104;
    panel(ctx, x - 20, y - 26, 270, 124);
    const row = (dy: number, draw: () => void, text: string) => {
      draw();
      label(ctx, text, x + 64, y + dy + 6, 16, COLOR.text, 'left', 600);
    };
    row(0, () => {
      ctx.fillStyle = COLOR.node;
      ctx.beginPath();
      ctx.arc(x + 24, y, 9, 0, Math.PI * 2);
      ctx.fill();
    }, T.dot);
    ctx.lineCap = 'round';
    row(36, () => {
      ctx.strokeStyle = COLOR.bone;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 36);
      ctx.lineTo(x + 46, y + 36);
      ctx.stroke();
    }, T.bone);
    row(72, () => {
      ctx.strokeStyle = COLOR.muscle;
      ctx.lineWidth = 7 + 2.5 * Math.sin(this.time * 4);
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 72);
      ctx.lineTo(x + 46, y + 72);
      ctx.stroke();
    }, T.muscle);
  }

  /** Live per-muscle sine waves with a moving "now" dot. */
  private waves(ctx: CanvasRenderingContext2D, w: number, h: number, wavesH: number): void {
    if (!this.brain) return;
    const genome = this.brain.genome;
    const n = genome.muscles.length;
    if (n === 0) return;
    const x0 = this.left() + 14;
    const W = w - x0 - 40;
    const rowH = Math.min(44, (wavesH - 34) / n);
    const y0 = h - wavesH + 12;
    panel(ctx, x0 - 14, y0 - 8, W + 28, n * rowH + 30);
    label(ctx, pick(LAB).waves, x0, y0 + 10, 14, COLOR.dim, 'left', 600);
    const span = 2 / genome.freq;
    const tNow = this.brain.time % span;
    genome.muscles.forEach((gene, m) => {
      const midY = y0 + 26 + m * rowH + rowH / 2;
      const amp = rowH * 0.4 * (gene.amp / 0.3);
      const color = MUSCLE_COLORS[m % MUSCLE_COLORS.length];
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, midY);
      ctx.lineTo(x0 + W, midY);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let k = 0; k <= 80; k++) {
        const t = (span * k) / 80;
        const y = midY - amp * Math.sin(2 * Math.PI * genome.freq * t + gene.phase);
        if (k === 0) ctx.moveTo(x0 + (W * k) / 80, y);
        else ctx.lineTo(x0 + (W * k) / 80, y);
      }
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x0 + (W * tNow) / span, midY - amp * Math.sin(2 * Math.PI * genome.freq * tNow + gene.phase), 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

/** Dark blue → teal → yellow: how far a brain walks. */
function heat(t: number): string {
  const stops: [number, number, number][] = [
    [18, 24, 56],
    [34, 94, 140],
    [52, 170, 150],
    [180, 220, 90],
    [253, 231, 110],
  ];
  const f = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(f));
  const k = f - i;
  const c = stops[i].map((a, n) => Math.round(a + (stops[i + 1][n] - a) * k));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

