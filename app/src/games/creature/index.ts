// Phase 5: Creature Lab — teach a stick creature to walk with evolution.
// Build mode: draw a body from dots, bones and muscles (or pick a preset).
// Train mode: a whole generation flails on screen at once; the best walkers
// breed, and the learning curve draws itself. Race mode: your champion vs the
// reigning champ of the day, distance in 12 s -> leaderboard.
// Delve mode: the science layer for older kids and parents — four chapters
// with live physics demos (poke a ragdoll, see the muscle waves, watch a mini
// evolution run, meet a zoo of pre-trained bodies).
import type { ArcadeGame, GameHost, GameInstance } from '../../shell/types';
import { scoreFlow, type ScoreFlowHandle } from '../../shell/scoreflow';
import {
  delvePanel,
  delveToggle,
  type DelveHandle,
  type DelveToggleHandle,
} from '../../shell/delve';
import {
  Creature,
  FIXED_DT,
  NODE_R,
  muscleCount,
  type BodyPlan,
  type Genome,
} from './physics';
import { POPULATION, nextGeneration, randomGenome } from './evolve';
import { clonePlan, FALLBACK_CHAMP, PRESET_NAMES, PRESETS, TRAINED } from './presets';
import { pick, type Localized } from '../../lib/i18n';

/** Sim-seconds each generation gets to walk. */
const EVAL_TIME = 7;
const RACE_TIME = 12;
const COUNTDOWN = 3;
const SPEEDS = [1, 3, 10];
const MAX_NODES = 12;
const MAX_STICKS = 18;
const CHAMP_KEY = 'creature-champ-v1';

/** Delve mini-evolution: smaller and faster than the real thing, same code. */
const DELVE_POP = 12;
const DELVE_EVAL_TIME = 5;
const DELVE_SPEED = 6;

const COLOR = {
  node: '#eef2ff',
  bone: '#94a3b8',
  muscle: '#fb5f75',
  you: '#7dd3fc',
  champ: '#fbbf24',
  ground: 'rgba(255, 255, 255, 0.25)',
  groundFill: 'rgba(255, 255, 255, 0.05)',
};

/** Per-muscle colors for the delve "brain waves" chapter. */
const MUSCLE_COLORS = ['#fb5f75', '#7dd3fc', '#fbbf24', '#57d98a', '#c084fc', '#fb923c', '#a3e635', '#f472b6'];

interface CreatureText {
  build: {
    hint: { draw: string; move: string; type: string; erase: string };
    tool: {
      draw: string;
      move: string;
      boneMuscle: string;
      erase: string;
      train: string;
      needsMuscle: string;
    };
  };
  train: {
    hint: string;
    speed: (mult: number) => string;
    race: string;
    bodyShop: string;
    hud: (gen: number, best: string, secs: number) => string;
  };
  race: {
    hint: string;
    winHeading: string;
    loseHeading: string;
    scoreLabel: (you: number, champ: number) => string;
    trainMore: string;
    newCreature: string;
    champLabel: (name: string) => string;
    youLabel: string;
    hudOver: (you: number, champ: number) => string;
    go: string;
  };
  delve: {
    heading: string;
    chapter0: { title: string; p1: string; p2: string; p3: string };
    chapter1: { title: string; p1: string; scramble: string; champion: string; note: string };
    chapter2: { title: string; p1: (pop: number, evalTime: number) => string; p2: string; p3: string };
    chapter3: { title: string; p1: string; p2: string; p3: string; p4: string };
    legend: { dot: string; bone: string; muscle: string };
    wavesLabel: string;
    pokeLabel: string;
    evoLabel: (gen: number, best: string) => string;
    chartLabel: string;
  };
}

const TEXT: Localized<CreatureText> = {
  en: {
    build: {
      hint: {
        draw: 'Drag from a dot to grow arms, legs and tails — then hit TRAIN! 🧠',
        move: 'Drag the dots to reshape your creature.',
        type: 'Click a stick to flip it: gray bones are stiff, red muscles push and pull.',
        erase: 'Click a dot or stick to remove it.',
      },
      tool: {
        draw: 'Draw',
        move: 'Move',
        boneMuscle: 'Bone/muscle',
        erase: 'Erase',
        train: 'TRAIN!',
        needsMuscle: 'Needs a muscle!',
      },
    },
    train: {
      hint: 'Every creature has different muscle wiring — the farthest walkers get babies with small mutations. Nobody tells them HOW to walk!',
      speed: (mult) => `Speed ×${mult}`,
      race: 'Race the champ',
      bodyShop: 'Body shop',
      hud: (gen, best, secs) => `🧬 Generation ${gen}   🏆 Best walk: ${best}   ⏱ ${secs}s`,
    },
    race: {
      hint: 'Farthest in 12 seconds wins the crown! 🏁',
      winHeading: '👑 You took the crown!',
      loseHeading: '🏁 The champ holds the throne!',
      scoreLabel: (you, champ) => `You: ${you.toFixed(2)} m — Champ: ${champ.toFixed(2)} m`,
      trainMore: '🧠 Train more',
      newCreature: '🛠 New creature',
      champLabel: (name) => `👑 ${name}`,
      youLabel: '⭐ YOUR CREATURE',
      hudOver: (you, champ) => `🏁 You: ${you.toFixed(2)} m — Champ: ${champ.toFixed(2)} m`,
      go: 'GO!',
    },
    delve: {
      heading: '🔬 The science of Creature Lab',
      chapter0: {
        title: 'A creature is dots and springs',
        p1: 'Everything you see is simulated physics. Each dot is a little mass that feels gravity and friction. Gray sticks are bones: they always keep their length. Red sticks are muscles: springs that can rhythmically stretch and squeeze.',
        p2: 'Nothing about standing, tripping or tumbling is programmed anywhere — it all follows from Newton’s laws, recomputed 120 times per second. The same technique animates cloth, hair and ragdolls in films and video games.',
        p3: '👉 Click the creature to poke it. Every wobble you cause is pure physics.',
      },
      chapter1: {
        title: 'The “brain” is a rhythm',
        p1: 'This creature’s brain contains no walking instructions — only a beat for each muscle. Every muscle changes its length like a wave:',
        scramble: '🎲 Scramble the brain',
        champion: '👑 Champion brain',
        note: 'The whole brain is just these numbers: how strongly (A), how fast (f) and in which order (φ) each muscle fires. The colored waves below are the live heartbeat of each muscle — scramble them and watch walking fall apart.',
      },
      chapter2: {
        title: 'Learning = try, measure, mutate',
        p1: (pop, evalTime) =>
          `A live experiment: ${pop} creatures start with random brains. After ${evalTime} seconds we measure a single number — how far did you get? The best get “babies”: copies with small random changes. Repeat.`,
        p2: 'Nobody teaches them how to walk; the distance score is the only feedback. That is enough for the learning curve to climb all by itself.',
        p3: 'Scientists call this evolutionary optimization — a close cousin of reinforcement learning, the trial-and-error method used to train game-playing AIs and real robots.',
      },
      chapter3: {
        title: 'Where the real world uses this',
        p1: 'Real robots learn to walk exactly like this: first many thousands of attempts in a physics simulation (cheap, safe, fast), then the best behaviour is moved onto real legs. Four-legged inspection robots learned their gaits this way.',
        p2: 'The same recipe — try, measure, keep the best, mutate — has designed NASA satellite antennas, searched for new medicines, and optimizes wind-farm layouts (try the wind farm game!).',
        p3: 'Simulating the world well enough that a computer can learn from it is what the Scientific Computing group at CWI works on every day.',
        p4: 'These four bodies were all trained by the exact same algorithm — it knew nothing about legs, worms or frogs beforehand.',
      },
      legend: { dot: 'dot: a little mass', bone: 'bone: fixed length', muscle: 'muscle: pulsing spring' },
      wavesLabel: 'each muscle’s length over time  ·  ● = now',
      pokeLabel: '👉 poke it!',
      evoLabel: (gen, best) => `🧬 Generation ${gen} · best ${best}`,
      chartLabel: 'best distance per generation',
    },
  },
  nl: {
    build: {
      hint: {
        draw: 'Sleep vanaf een stip om armen, benen en staarten te laten groeien — druk dan op TRAINEN! 🧠',
        move: 'Sleep de stippen om je beestje een nieuwe vorm te geven.',
        type: 'Klik op een stok om hem om te draaien: grijze botten zijn stijf, rode spieren duwen en trekken.',
        erase: 'Klik op een stip of stok om hem te verwijderen.',
      },
      tool: {
        draw: 'Tekenen',
        move: 'Verplaatsen',
        boneMuscle: 'Bot/spier',
        erase: 'Wissen',
        train: 'TRAINEN!',
        needsMuscle: 'Heeft een spier nodig!',
      },
    },
    train: {
      hint: 'Elk beestje heeft andere spierbedrading — de verste lopers krijgen baby’s met kleine mutaties. Niemand vertelt ze HOE ze moeten lopen!',
      speed: (mult) => `Snelheid ×${mult}`,
      race: 'Race tegen de kampioen',
      bodyShop: 'Werkplaats',
      hud: (gen, best, secs) => `🧬 Generatie ${gen}   🏆 Beste wandeling: ${best}   ⏱ ${secs}s`,
    },
    race: {
      hint: 'Wie in 12 seconden het verst komt, wint de kroon! 🏁',
      winHeading: '👑 Jij hebt de kroon veroverd!',
      loseHeading: '🏁 De kampioen houdt de troon!',
      scoreLabel: (you, champ) => `Jij: ${you.toFixed(2)} m — Kampioen: ${champ.toFixed(2)} m`,
      trainMore: '🧠 Meer trainen',
      newCreature: '🛠 Nieuw beestje',
      champLabel: (name) => `👑 ${name}`,
      youLabel: '⭐ JOUW BEESTJE',
      hudOver: (you, champ) => `🏁 Jij: ${you.toFixed(2)} m — Kampioen: ${champ.toFixed(2)} m`,
      go: 'AF!',
    },
    delve: {
      heading: '🔬 De wetenschap van het Beestenlab',
      chapter0: {
        title: 'Een beestje is stippen en veren',
        p1: 'Alles wat je ziet is gesimuleerde natuurkunde. Elke stip is een klein gewicht dat zwaartekracht en wrijving voelt. Grijze stokken zijn botten: die houden altijd dezelfde lengte. Rode stokken zijn spieren: veren die ritmisch kunnen uitrekken en samentrekken.',
        p2: 'Er is nergens geprogrammeerd hoe iets moet staan, struikelen of tuimelen — het volgt allemaal uit de wetten van Newton, 120 keer per seconde opnieuw berekend. Dezelfde techniek animeert stof, haar en ragdolls in films en videogames.',
        p3: '👉 Klik op het beestje om het te porren. Elke wiebel die je veroorzaakt is pure natuurkunde.',
      },
      chapter1: {
        title: 'Het “brein” is een ritme',
        p1: 'Het brein van dit beestje bevat geen loopinstructies — alleen een ritme voor elke spier. Elke spier verandert van lengte als een golf:',
        scramble: '🎲 Brein husselen',
        champion: '👑 Kampioensbrein',
        note: 'Het hele brein bestaat uit deze getallen: hoe sterk (A), hoe snel (f) en in welke volgorde (φ) elke spier afvuurt. De gekleurde golven hieronder zijn de levende hartslag van elke spier — hussel ze en kijk hoe het lopen uit elkaar valt.',
      },
      chapter2: {
        title: 'Leren = proberen, meten, muteren',
        p1: (pop, evalTime) =>
          `Een live experiment: ${pop} beestjes beginnen met willekeurige breinen. Na ${evalTime} seconden meten we één getal — hoe ver kwam je? De besten krijgen “baby’s”: kopieën met kleine willekeurige veranderingen. Herhaal.`,
        p2: 'Niemand leert ze lopen; de afstandsscore is de enige feedback. Dat is genoeg om de leercurve helemaal vanzelf te laten stijgen.',
        p3: 'Wetenschappers noemen dit evolutionaire optimalisatie — een naaste neef van reinforcement learning, de vallen-en-opstaan-methode waarmee spelende AI’s en echte robots worden getraind.',
      },
      chapter3: {
        title: 'Waar de echte wereld dit gebruikt',
        p1: 'Echte robots leren op precies deze manier lopen: eerst duizenden pogingen in een natuurkundige simulatie (goedkoop, veilig, snel), waarna het beste gedrag wordt overgezet naar echte poten. Viervoetige inspectierobots hebben hun manier van lopen zo geleerd.',
        p2: 'Hetzelfde recept — proberen, meten, de beste bewaren, muteren — heeft NASA-satellietantennes ontworpen, gezocht naar nieuwe medicijnen, en optimaliseert de indeling van windmolenparken (probeer het windmolenpark-spel!).',
        p3: 'Het simuleren van de wereld, goed genoeg zodat een computer ervan kan leren — daar werkt de groep Scientific Computing bij het CWI elke dag aan.',
        p4: 'Deze vier lichamen zijn allemaal getraind met precies hetzelfde algoritme — het wist vooraf niets over benen, wormen of kikkers.',
      },
      legend: { dot: 'stip: een klein gewicht', bone: 'bot: vaste lengte', muscle: 'spier: kloppende veer' },
      wavesLabel: 'lengte van elke spier in de tijd  ·  ● = nu',
      pokeLabel: '👉 porren maar!',
      evoLabel: (gen, best) => `🧬 Generatie ${gen} · beste ${best}`,
      chartLabel: 'beste afstand per generatie',
    },
  },
  no: {
    build: {
      hint: {
        draw: 'Dra fra en prikk for å la armer, ben og haler vokse — trykk så på TREN! 🧠',
        move: 'Dra i prikkene for å forme skapningen din på nytt.',
        type: 'Klikk på en pinne for å bytte type: grå bein er stive, røde muskler skyver og drar.',
        erase: 'Klikk på en prikk eller pinne for å fjerne den.',
      },
      tool: {
        draw: 'Tegn',
        move: 'Flytt',
        boneMuscle: 'Bein/muskel',
        erase: 'Slett',
        train: 'TREN!',
        needsMuscle: 'Trenger en muskel!',
      },
    },
    train: {
      hint: 'Hver skapning har ulik muskelkobling — de som går lengst får babyer med små mutasjoner. Ingen forteller dem HVORDAN de skal gå!',
      speed: (mult) => `Fart ×${mult}`,
      race: 'Løp mot mesteren',
      bodyShop: 'Verksted',
      hud: (gen, best, secs) => `🧬 Generasjon ${gen}   🏆 Beste gange: ${best}   ⏱ ${secs}s`,
    },
    race: {
      hint: 'Den som kommer lengst på 12 sekunder, vinner kronen! 🏁',
      winHeading: '👑 Du tok kronen!',
      loseHeading: '🏁 Mesteren beholder tronen!',
      scoreLabel: (you, champ) => `Du: ${you.toFixed(2)} m — Mester: ${champ.toFixed(2)} m`,
      trainMore: '🧠 Tren mer',
      newCreature: '🛠 Ny skapning',
      champLabel: (name) => `👑 ${name}`,
      youLabel: '⭐ DIN SKAPNING',
      hudOver: (you, champ) => `🏁 Du: ${you.toFixed(2)} m — Mester: ${champ.toFixed(2)} m`,
      go: 'KJØR!',
    },
    delve: {
      heading: '🔬 Vitenskapen bak Skapningslab',
      chapter0: {
        title: 'En skapning er prikker og fjærer',
        p1: 'Alt du ser er simulert fysikk. Hver prikk er en liten masse som kjenner tyngdekraft og friksjon. Grå pinner er bein: de holder alltid samme lengde. Røde pinner er muskler: fjærer som rytmisk kan strekke seg og trekke seg sammen.',
        p2: 'Ingenting om å stå, snuble eller trille rundt er programmert noe sted — alt følger av Newtons lover, regnet ut på nytt 120 ganger i sekundet. Den samme teknikken animerer stoff, hår og ragdoll-figurer i filmer og dataspill.',
        p3: '👉 Klikk på skapningen for å dytte den. Hver risting du lager, er ren fysikk.',
      },
      chapter1: {
        title: '«Hjernen» er en rytme',
        p1: 'Hjernen til denne skapningen inneholder ingen gå-instruksjoner — bare en rytme for hver muskel. Hver muskel endrer lengde som en bølge:',
        scramble: '🎲 Rot til hjernen',
        champion: '👑 Mesterhjerne',
        note: 'Hele hjernen består bare av disse tallene: hvor sterkt (A), hvor fort (f) og i hvilken rekkefølge (φ) hver muskel avfyrer. De fargede bølgene under er den levende hjerterytmen til hver muskel — rot dem til og se gangen falle fra hverandre.',
      },
      chapter2: {
        title: 'Læring = prøve, måle, mutere',
        p1: (pop, evalTime) =>
          `Et live eksperiment: ${pop} skapninger starter med tilfeldige hjerner. Etter ${evalTime} sekunder måler vi ett eneste tall — hvor langt kom du? De beste får «babyer»: kopier med små tilfeldige endringer. Gjenta.`,
        p2: 'Ingen lærer dem å gå; avstandspoenget er den eneste tilbakemeldingen. Det er nok til at læringskurven stiger helt av seg selv.',
        p3: 'Forskere kaller dette evolusjonær optimalisering — en nær slektning av reinforcement learning, prøve-og-feile-metoden som brukes til å trene spillende AI-er og ekte roboter.',
      },
      chapter3: {
        title: 'Hvor den virkelige verden bruker dette',
        p1: 'Ekte roboter lærer å gå på nøyaktig denne måten: først mange tusen forsøk i en fysikksimulering (billig, trygt, raskt), og så flyttes den beste oppførselen over på ekte bein. Firbeinte inspeksjonsroboter lærte gangarten sin på denne måten.',
        p2: 'Den samme oppskriften — prøve, måle, beholde de beste, mutere — har designet NASA-satellittantenner, lett etter nye medisiner, og optimaliserer layouten til vindparker (prøv vindpark-spillet!).',
        p3: 'Å simulere verden godt nok til at en datamaskin kan lære av den, er det gruppen Scientific Computing ved CWI jobber med hver dag.',
        p4: 'Disse fire kroppene ble alle trent med akkurat samme algoritme — den visste ingenting om bein, mark eller frosker på forhånd.',
      },
      legend: { dot: 'prikk: en liten masse', bone: 'bein: fast lengde', muscle: 'muskel: pulserende fjær' },
      wavesLabel: 'hver muskels lengde over tid  ·  ● = nå',
      pokeLabel: '👉 dytt den!',
      evoLabel: (gen, best) => `🧬 Generasjon ${gen} · beste ${best}`,
      chartLabel: 'beste avstand per generasjon',
    },
  },
};

type Mode = 'build' | 'train' | 'race' | 'delve';
type Tool = 'draw' | 'move' | 'type' | 'erase';

interface StoredChamp {
  name: string;
  score: number;
  plan: BodyPlan;
  genome: Genome;
}

/** A camera-defined horizontal band of the canvas with its own ground line. */
interface View {
  camX: number;
  scale: number;
  /** Screen x where camX lands (canvas center, or offset beside the delve panel). */
  centerX: number;
  top: number;
  height: number;
  groundY: number;
}

interface Racer {
  creature: Creature;
  label: string;
  color: string;
  camX: number;
}

/** One running evolution: the train mode uses a big one, the delve a mini one. */
interface EvoState {
  plan: BodyPlan;
  evalTime: number;
  genomes: Genome[];
  creatures: Creature[];
  generation: number;
  genElapsed: number;
  stepAccum: number;
  bestEver: { fitness: number; dist: number; genome: Genome } | null;
  history: number[];
  camX: number;
}

function makeEvoState(plan: BodyPlan, pop: number, evalTime: number): EvoState {
  const genomes = Array.from({ length: pop }, () => randomGenome(plan));
  return {
    plan,
    evalTime,
    genomes,
    creatures: genomes.map((g) => new Creature(plan, g)),
    generation: 1,
    genElapsed: 0,
    stepAccum: 0,
    bestEver: null,
    history: [],
    camX: 0,
  };
}

function endEvoGeneration(s: EvoState): void {
  const scored = s.creatures.map((c, i) => ({
    genome: s.genomes[i],
    fitness: c.fitness(),
    dist: c.comX(),
  }));
  let best = scored[0];
  for (const entry of scored) if (entry.fitness > best.fitness) best = entry;
  if (!s.bestEver || best.fitness > s.bestEver.fitness) {
    s.bestEver = { fitness: best.fitness, dist: best.dist, genome: best.genome };
  }
  s.history.push(Math.max(0, best.dist));
  s.genomes = nextGeneration(scored);
  s.creatures = s.genomes.map((g) => new Creature(s.plan, g));
  s.generation++;
  s.genElapsed = 0;
  s.stepAccum = 0;
}

function stepEvo(s: EvoState, dt: number, speed: number): void {
  s.stepAccum += dt * speed;
  let steps = Math.min(240, Math.floor(s.stepAccum / FIXED_DT));
  s.stepAccum -= steps * FIXED_DT;
  // A throttled tab (unfocused) builds a backlog; drop it rather than
  // fast-forwarding at 30x when focus returns.
  if (s.stepAccum > 1) s.stepAccum = 0;
  while (steps-- > 0) {
    for (const c of s.creatures) c.step();
    s.genElapsed += FIXED_DT;
    if (s.genElapsed >= s.evalTime) {
      endEvoGeneration(s);
      break;
    }
  }
  const leader = Math.max(0, ...s.creatures.map((c) => c.comX()));
  s.camX += (leader - s.camX) * Math.min(1, dt * 3);
}

function evoLeader(s: EvoState): number {
  let best = 0;
  for (let i = 1; i < s.creatures.length; i++) {
    if (s.creatures[i].fitness() > s.creatures[best].fitness()) best = i;
  }
  return best;
}

/** All muscles off: for the delve ragdoll that shows the raw physics. */
function limpGenome(plan: BodyPlan): Genome {
  return {
    freq: 1,
    muscles: Array.from({ length: muscleCount(plan) }, () => ({ amp: 0, phase: 0 })),
  };
}

class CreatureInstance implements GameInstance {
  private ctx!: CanvasRenderingContext2D;
  private mode: Mode = 'build';
  private time = 0;

  // Build state.
  private plan: BodyPlan = clonePlan(PRESETS[0].plan);
  private tool: Tool = 'draw';
  private drag: { node: number; moved: boolean; x: number; y: number } | null = null;

  // Train state.
  private evo: EvoState | null = null;
  private speedIdx = 1;

  // Race state.
  private racers: Racer[] = [];
  private raceElapsed = 0;
  private raceOver = false;
  private raceAccum = 0;

  // Delve state.
  private delve: DelveHandle | null = null;
  private toggle!: DelveToggleHandle;
  private delveFrom: 'build' | 'train' = 'build';
  private demoAccum = 0;
  private pokeC: Creature | null = null;
  private pokeCamX = 0;
  private brainC: Creature | null = null;
  private brainCamX = 0;
  private demoEvo: EvoState | null = null;
  private zoo: { name: string; emoji: string; creature: Creature; camX: number }[] = [];

  private presetBar!: HTMLElement;
  private buildBar!: HTMLElement;
  private trainBar!: HTMLElement;
  private hud!: HTMLElement;
  private hint!: HTMLElement;
  private buttons: Record<string, HTMLButtonElement> = {};
  private flow: ScoreFlowHandle | null = null;

  private onPointerDown = (e: PointerEvent) => {
    if (this.mode === 'delve') {
      this.pokeAt(e);
      return;
    }
    if (this.mode !== 'build') return;
    const p = this.toWorld(e);
    const node = this.nodeAt(p.x, p.y);
    if (this.tool === 'draw') {
      if (node >= 0) {
        this.drag = { node, moved: false, x: p.x, y: p.y };
      } else if (this.plan.nodes.length < MAX_NODES) {
        this.plan.nodes.push({ x: p.x, y: Math.max(p.y, NODE_R) });
        this.drag = { node: this.plan.nodes.length - 1, moved: false, x: p.x, y: p.y };
        this.refreshBuildUi();
      }
    } else if (this.tool === 'move') {
      if (node >= 0) this.drag = { node, moved: false, x: p.x, y: p.y };
    } else if (this.tool === 'type') {
      const stick = this.stickAt(p.x, p.y);
      if (stick >= 0) {
        this.plan.sticks[stick].muscle = !this.plan.sticks[stick].muscle;
        this.refreshBuildUi();
      }
    } else if (this.tool === 'erase') {
      if (node >= 0) this.eraseNode(node);
      else {
        const stick = this.stickAt(p.x, p.y);
        if (stick >= 0) this.plan.sticks.splice(stick, 1);
      }
      this.refreshBuildUi();
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.drag) return;
    const p = this.toWorld(e);
    if (Math.hypot(p.x - this.drag.x, p.y - this.drag.y) > 0.04) this.drag.moved = true;
    this.drag.x = p.x;
    this.drag.y = p.y;
    if (this.tool === 'move') {
      const n = this.plan.nodes[this.drag.node];
      n.x = Math.min(2.5, Math.max(-2.5, p.x));
      n.y = Math.min(3, Math.max(NODE_R, p.y));
    }
  };

  private onPointerUp = () => {
    const drag = this.drag;
    this.drag = null;
    if (!drag || this.tool !== 'draw' || !drag.moved) return;
    if (this.plan.sticks.length >= MAX_STICKS) return;
    let target = this.nodeAt(drag.x, drag.y, drag.node);
    if (target < 0) {
      if (this.plan.nodes.length >= MAX_NODES) return;
      this.plan.nodes.push({ x: drag.x, y: Math.max(drag.y, NODE_R) });
      target = this.plan.nodes.length - 1;
    }
    const exists = this.plan.sticks.some(
      (s) =>
        (s.a === drag.node && s.b === target) || (s.a === target && s.b === drag.node),
    );
    if (!exists) this.plan.sticks.push({ a: drag.node, b: target, muscle: true });
    this.refreshBuildUi();
  };

  constructor(private host: GameHost) {}

  start(): void {
    this.ctx = this.host.canvas.getContext('2d')!;
    this.buildUi();
    const c = this.host.canvas;
    c.addEventListener('pointerdown', this.onPointerDown);
    c.addEventListener('pointermove', this.onPointerMove);
    c.addEventListener('pointerup', this.onPointerUp);
    this.enterBuild();
  }

  frame(dt: number): void {
    this.time += dt;
    if (this.mode === 'train' && this.evo) stepEvo(this.evo, dt, SPEEDS[this.speedIdx]);
    else if (this.mode === 'race') this.stepRace(dt);
    else if (this.mode === 'delve') this.stepDelve(dt);
    this.updateHud();
    this.draw();
  }

  destroy(): void {
    const c = this.host.canvas;
    c.removeEventListener('pointerdown', this.onPointerDown);
    c.removeEventListener('pointermove', this.onPointerMove);
    c.removeEventListener('pointerup', this.onPointerUp);
    this.flow?.dispose();
    this.delve?.dispose();
  }

  // ---- mode switching ----

  private enterBuild(): void {
    this.mode = 'build';
    this.flow?.dispose();
    this.flow = null;
    this.presetBar.classList.remove('hidden');
    this.buildBar.classList.remove('hidden');
    this.trainBar.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.toggle.element.classList.remove('hidden');
    this.setTool('draw');
    this.refreshBuildUi();
  }

  private enterTrain(fresh: boolean): void {
    if (fresh || !this.evo) this.evo = makeEvoState(clonePlan(this.plan), POPULATION, EVAL_TIME);
    this.mode = 'train';
    this.flow?.dispose();
    this.flow = null;
    this.presetBar.classList.add('hidden');
    this.buildBar.classList.add('hidden');
    this.trainBar.classList.remove('hidden');
    this.hud.classList.remove('hidden');
    this.toggle.element.classList.remove('hidden');
    this.hint.textContent = pick(TEXT).train.hint;
  }

  private enterRace(): void {
    if (!this.evo) return;
    const T = pick(TEXT);
    const champ = this.loadChamp();
    const yourGenome = this.evo.bestEver?.genome ?? this.evo.genomes[evoLeader(this.evo)];
    this.racers = [
      { creature: new Creature(champ.plan, champ.genome), label: T.race.champLabel(champ.name), color: COLOR.champ, camX: 0 },
      { creature: new Creature(this.evo.plan, yourGenome), label: T.race.youLabel, color: COLOR.you, camX: 0 },
    ];
    this.mode = 'race';
    this.raceElapsed = -COUNTDOWN;
    this.raceOver = false;
    this.raceAccum = 0;
    this.trainBar.classList.add('hidden');
    this.toggle.element.classList.add('hidden');
    this.hint.textContent = T.race.hint;
  }

  // ---- simulation ----

  private stepRace(dt: number): void {
    if (this.raceOver) return;
    this.raceElapsed += dt;
    if (this.raceElapsed > 0) {
      this.raceAccum += Math.min(dt, this.raceElapsed);
      let steps = Math.min(240, Math.floor(this.raceAccum / FIXED_DT));
      this.raceAccum -= steps * FIXED_DT;
      while (steps-- > 0) for (const r of this.racers) r.creature.step();
    }
    for (const r of this.racers) {
      r.camX += (Math.max(0, r.creature.comX()) - r.camX) * Math.min(1, dt * 3);
    }
    if (this.raceElapsed >= RACE_TIME) this.finishRace();
  }

  private finishRace(): void {
    this.raceOver = true;
    const champDist = this.racers[0].creature.comX();
    const yourDist = this.racers[1].creature.comX();
    const won = yourDist > champDist;
    if (won && this.evo) {
      this.saveChamp({
        name: 'CHAMP',
        score: yourDist,
        plan: clonePlan(this.evo.plan),
        genome: this.racers[1].creature.genome,
      });
    }
    this.hint.textContent = '';
    this.flow?.dispose();
    const T = pick(TEXT);
    this.flow = scoreFlow({
      gameId: 'creature',
      heading: won ? T.race.winHeading : T.race.loseHeading,
      score: Math.round(Math.max(0, yourDist) * 100),
      scoreLabel: T.race.scoreLabel(yourDist, champDist),
      actions: [
        { label: T.race.trainMore, onClick: () => this.enterTrain(false) },
        { label: T.race.newCreature, onClick: () => this.enterBuild() },
      ],
    });
    this.host.overlay.appendChild(this.flow.element);
  }

  private loadChamp(): StoredChamp {
    try {
      const raw = localStorage.getItem(CHAMP_KEY);
      if (raw) {
        const champ = JSON.parse(raw) as StoredChamp;
        if (champ.plan?.nodes?.length && champ.genome?.muscles) return champ;
      }
    } catch {
      // Fall through to the built-in champion.
    }
    return FALLBACK_CHAMP;
  }

  private saveChamp(champ: StoredChamp): void {
    try {
      localStorage.setItem(CHAMP_KEY, JSON.stringify(champ));
    } catch {
      // localStorage full or unavailable — the race still worked.
    }
  }

  // ---- delve layer ----

  private enterDelve(): void {
    this.delveFrom = this.mode === 'train' ? 'train' : 'build';
    this.mode = 'delve';
    this.presetBar.classList.add('hidden');
    this.buildBar.classList.add('hidden');
    this.trainBar.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.hint.textContent = '';
    this.toggle.setOpen(true);
    this.delve = delvePanel({
      heading: pick(TEXT).delve.heading,
      chapters: this.delveChapters(),
      onChapter: (i) => this.setDelveChapter(i),
      onExit: () => this.exitDelve(),
    });
    this.host.overlay.appendChild(this.delve.element);
  }

  private exitDelve(): void {
    this.delve?.dispose();
    this.delve = null;
    this.toggle.setOpen(false);
    this.pokeC = null;
    this.brainC = null;
    this.demoEvo = null;
    this.zoo = [];
    if (this.delveFrom === 'train' && this.evo) this.enterTrain(false);
    else this.enterBuild();
  }

  private delveChapters() {
    const T = pick(TEXT).delve;
    return [
      {
        title: T.chapter0.title,
        paragraphs: [T.chapter0.p1, T.chapter0.p2, T.chapter0.p3],
      },
      {
        title: T.chapter1.title,
        paragraphs: [T.chapter1.p1],
        formula: 'length(t) = rest × (1 + A · sin(2π f t + φ))',
        extras: (host: HTMLElement) => {
          const scramble = document.createElement('button');
          scramble.className = 'arcade-button';
          scramble.textContent = T.chapter1.scramble;
          scramble.addEventListener('click', () => this.setBrain(false));
          const champ = document.createElement('button');
          champ.className = 'arcade-button';
          champ.textContent = T.chapter1.champion;
          champ.addEventListener('click', () => this.setBrain(true));
          host.append(scramble, champ);
          const note = document.createElement('p');
          note.textContent = T.chapter1.note;
          host.parentElement?.insertBefore(note, host);
        },
      },
      {
        title: T.chapter2.title,
        paragraphs: [T.chapter2.p1(DELVE_POP, DELVE_EVAL_TIME), T.chapter2.p2, T.chapter2.p3],
      },
      {
        title: T.chapter3.title,
        paragraphs: [T.chapter3.p1, T.chapter3.p2, T.chapter3.p3, T.chapter3.p4],
      },
    ];
  }

  private setDelveChapter(chapter: number): void {
    this.demoAccum = 0;
    if (chapter === 0) {
      const plan = this.delvePlan();
      this.pokeC = new Creature(plan, limpGenome(plan));
      this.pokeCamX = 0;
    } else if (chapter === 1) {
      this.setBrain(true);
    } else if (chapter === 2) {
      this.demoEvo = makeEvoState(this.delvePlan(), DELVE_POP, DELVE_EVAL_TIME);
    } else if (chapter === 3) {
      this.zoo = PRESETS.map((p) => ({
        name: pick(PRESET_NAMES)[p.name],
        emoji: p.emoji,
        creature: new Creature(p.plan, TRAINED[p.name]),
        camX: 0,
      }));
    }
  }

  /** The kid's own creature when it is trainable, else the Doggo preset. */
  private delvePlan(): BodyPlan {
    return muscleCount(this.plan) > 0 ? this.plan : PRESETS[0].plan;
  }

  private setBrain(champion: boolean): void {
    // Prefer the kid's own trained creature so the story is about *their* work.
    const trained = this.evo?.bestEver;
    const plan = trained ? this.evo!.plan : PRESETS[0].plan;
    const champGenome = trained ? trained.genome : TRAINED.Doggo;
    this.brainC = new Creature(plan, champion ? champGenome : randomGenome(plan));
    this.brainCamX = 0;
  }

  private stepDelve(dt: number): void {
    const chapter = this.delve?.chapter ?? -1;
    this.demoAccum += dt;
    let steps = Math.min(60, Math.floor(this.demoAccum / FIXED_DT));
    this.demoAccum -= steps * FIXED_DT;
    if (this.demoAccum > 0.5) this.demoAccum = 0; // drop throttled-tab backlog
    if (chapter === 0 && this.pokeC) {
      while (steps-- > 0) this.pokeC.step();
      // A hard poke can launch it out of view — respawn where the camera is.
      if (Math.abs(this.pokeC.comX() - this.pokeCamX) > 8 || this.pokeC.comY() > 12) {
        this.setDelveChapter(0);
      } else {
        this.pokeCamX += (this.pokeC.comX() - this.pokeCamX) * Math.min(1, dt * 2);
      }
    } else if (chapter === 1 && this.brainC) {
      while (steps-- > 0) this.brainC.step();
      this.brainCamX += (this.brainC.comX() - this.brainCamX) * Math.min(1, dt * 3);
    } else if (chapter === 2 && this.demoEvo) {
      stepEvo(this.demoEvo, dt, DELVE_SPEED);
    } else if (chapter === 3) {
      while (steps-- > 0) for (const z of this.zoo) z.creature.step();
      for (const z of this.zoo) {
        z.camX += (Math.max(0, z.creature.comX()) - z.camX) * Math.min(1, dt * 3);
      }
    }
  }

  private pokeAt(e: PointerEvent): void {
    if ((this.delve?.chapter ?? -1) !== 0 || !this.pokeC) return;
    const rect = this.host.canvas.getBoundingClientRect();
    const view = this.pokeView(rect.width, rect.height);
    const wx = (e.clientX - rect.left - view.centerX) / view.scale + view.camX;
    const wy = (view.groundY - (e.clientY - rect.top)) / view.scale;
    for (const p of this.pokeC.pts) {
      const dx = p.x - wx;
      const dy = p.y - wy;
      const d = Math.hypot(dx, dy);
      if (d < 1.1) {
        // Verlet velocity kick: shove points away from the click, slightly up.
        const kick = 0.09 * (1 - d / 1.1);
        p.px -= (dx / (d || 1e-9)) * kick;
        p.py -= (dy / (d || 1e-9)) * kick + kick * 0.6;
      }
    }
  }

  // ---- editor helpers ----

  private nodeAt(x: number, y: number, ignore = -1): number {
    let best = -1;
    let bestD = 0.14;
    this.plan.nodes.forEach((n, i) => {
      if (i === ignore) return;
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  private stickAt(x: number, y: number): number {
    let best = -1;
    let bestD = 0.07;
    this.plan.sticks.forEach((s, i) => {
      const a = this.plan.nodes[s.a];
      const b = this.plan.nodes[s.b];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy || 1e-9;
      const t = Math.min(1, Math.max(0, ((x - a.x) * dx + (y - a.y) * dy) / len2));
      const d = Math.hypot(a.x + t * dx - x, a.y + t * dy - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  private eraseNode(node: number): void {
    if (this.plan.nodes.length <= 2) return;
    this.plan.nodes.splice(node, 1);
    this.plan.sticks = this.plan.sticks
      .filter((s) => s.a !== node && s.b !== node)
      .map((s) => ({
        ...s,
        a: s.a > node ? s.a - 1 : s.a,
        b: s.b > node ? s.b - 1 : s.b,
      }));
  }

  // ---- UI ----

  private buildUi(): void {
    const T = pick(TEXT);
    const add = (
      bar: HTMLElement,
      key: string,
      emoji: string,
      label: string,
      onClick: () => void,
    ): HTMLButtonElement => {
      const button = document.createElement('button');
      button.className = 'tool-button';
      const icon = document.createElement('span');
      icon.className = 'tool-emoji';
      icon.textContent = emoji;
      const text = document.createElement('span');
      text.className = 'tool-label';
      text.textContent = label;
      button.append(icon, text);
      button.addEventListener('click', onClick);
      bar.appendChild(button);
      this.buttons[key] = button;
      return button;
    };

    this.presetBar = document.createElement('div');
    this.presetBar.className = 'game-toolbar creature-presets';
    for (const preset of PRESETS) {
      add(this.presetBar, `preset-${preset.name}`, preset.emoji, pick(PRESET_NAMES)[preset.name], () => {
        this.plan = clonePlan(preset.plan);
        this.refreshBuildUi();
      });
    }

    this.buildBar = document.createElement('div');
    this.buildBar.className = 'game-toolbar';
    add(this.buildBar, 'draw', '✏️', T.build.tool.draw, () => this.setTool('draw'));
    add(this.buildBar, 'move', '✋', T.build.tool.move, () => this.setTool('move'));
    add(this.buildBar, 'type', '💪', T.build.tool.boneMuscle, () => this.setTool('type'));
    add(this.buildBar, 'erase', '🧽', T.build.tool.erase, () => this.setTool('erase'));
    add(this.buildBar, 'train', '🧠', T.build.tool.train, () => this.enterTrain(true));

    this.trainBar = document.createElement('div');
    this.trainBar.className = 'game-toolbar hidden';
    add(this.trainBar, 'speed', '⏩', T.train.speed(SPEEDS[this.speedIdx]), () => {
      this.speedIdx = (this.speedIdx + 1) % SPEEDS.length;
      this.buttons.speed.querySelector('.tool-label')!.textContent =
        pick(TEXT).train.speed(SPEEDS[this.speedIdx]);
    });
    add(this.trainBar, 'race', '🏁', T.train.race, () => this.enterRace());
    add(this.trainBar, 'back', '🛠', T.train.bodyShop, () => this.enterBuild());

    this.hud = document.createElement('div');
    this.hud.className = 'challenge-hud';
    this.hint = document.createElement('p');
    this.hint.className = 'challenge-hint';

    this.toggle = delveToggle(() => {
      if (this.mode === 'delve') this.exitDelve();
      else this.enterDelve();
    });

    this.host.overlay.append(
      this.presetBar,
      this.buildBar,
      this.trainBar,
      this.hud,
      this.hint,
      this.toggle.element,
    );
  }

  private setTool(tool: Tool): void {
    this.tool = tool;
    for (const key of ['draw', 'move', 'type', 'erase'] as const) {
      this.buttons[key].classList.toggle('active', key === tool);
    }
    const hint = pick(TEXT).build.hint;
    this.hint.textContent = {
      draw: hint.draw,
      move: hint.move,
      type: hint.type,
      erase: hint.erase,
    }[tool];
  }

  private refreshBuildUi(): void {
    const T = pick(TEXT).build.tool;
    const muscles = muscleCount(this.plan);
    const trainButton = this.buttons.train;
    trainButton.disabled = muscles === 0 || this.plan.sticks.length === 0;
    trainButton.querySelector('.tool-label')!.textContent = trainButton.disabled
      ? T.needsMuscle
      : T.train;
  }

  private updateHud(): void {
    if (this.mode === 'build') {
      const muscles = muscleCount(this.plan);
      this.hud.textContent = `🦴 ${this.plan.sticks.length - muscles}  💪 ${muscles}  ⚪ ${this.plan.nodes.length}/${MAX_NODES}`;
    } else if (this.mode === 'train' && this.evo) {
      const best = this.evo.bestEver ? `${Math.max(0, this.evo.bestEver.dist).toFixed(1)} m` : '—';
      this.hud.textContent = pick(TEXT).train.hud(
        this.evo.generation,
        best,
        Math.ceil(EVAL_TIME - this.evo.genElapsed),
      );
    } else if (this.mode === 'race') {
      const t = Math.max(0, RACE_TIME - this.raceElapsed);
      const you = this.racers[1].creature.comX();
      const champ = this.racers[0].creature.comX();
      this.hud.textContent = this.raceOver
        ? pick(TEXT).race.hudOver(you, champ)
        : `⏱ ${t.toFixed(1)}s   ⭐ ${Math.max(0, you).toFixed(1)} m   👑 ${Math.max(0, champ).toFixed(1)} m`;
    }
  }

  // ---- rendering ----

  private size(): { w: number; h: number } {
    return {
      w: this.host.canvas.width / this.host.dpr,
      h: this.host.canvas.height / this.host.dpr,
    };
  }

  private draw(): void {
    const { w, h } = this.size();
    const ctx = this.ctx;
    ctx.setTransform(this.host.dpr, 0, 0, this.host.dpr, 0, 0);
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, w, h);

    if (this.mode === 'build') this.drawBuild(ctx, w, h);
    else if (this.mode === 'train') this.drawTrain(ctx, w, h);
    else if (this.mode === 'race') this.drawRace(ctx, w, h);
    else this.drawDelve(ctx, w, h);
  }

  private drawBuild(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const view: View = {
      camX: 0.55,
      scale: 0.3 * Math.min(w, h),
      centerX: w / 2,
      top: 0,
      height: h,
      groundY: h * 0.78,
    };
    this.drawGround(ctx, view, w);
    this.drawPlan(ctx, view);
    if (this.drag && this.tool === 'draw' && this.drag.moved) {
      const from = this.plan.nodes[this.drag.node];
      ctx.strokeStyle = 'rgba(251, 95, 117, 0.6)';
      ctx.lineWidth = 6;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(this.sx(view, from.x), this.sy(view, from.y));
      ctx.lineTo(this.sx(view, this.drag.x), this.sy(view, this.drag.y));
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawTrain(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.evo) return;
    const view: View = {
      camX: Math.max(1.5, this.evo.camX) + 0.5,
      scale: 0.2 * Math.min(w, h),
      centerX: w / 2,
      top: 0,
      height: h,
      groundY: h * 0.74,
    };
    this.drawEvo(ctx, view, w, this.evo);
    this.drawChart(ctx, 24, h - 144 - 24, this.evo.history);
  }

  /** Ghost population + highlighted leader + record line (train mode and delve). */
  private drawEvo(ctx: CanvasRenderingContext2D, view: View, w: number, s: EvoState): void {
    this.drawGround(ctx, view, w);
    let leader = 0;
    for (let i = 1; i < s.creatures.length; i++) {
      if (s.creatures[i].comX() > s.creatures[leader].comX()) leader = i;
    }
    s.creatures.forEach((c, i) => {
      if (i !== leader) this.drawCreature(ctx, view, c, 0.16, COLOR.node);
    });
    const lead = s.creatures[leader];
    if (lead) {
      this.drawCreature(ctx, view, lead, 1, COLOR.you);
      const x = this.sx(view, lead.comX());
      ctx.fillStyle = 'rgba(238, 242, 255, 0.9)';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.max(0, lead.comX()).toFixed(1)} m`, x, this.sy(view, 0) - view.scale * 2.2);
    }
    if (s.bestEver && s.bestEver.dist > 0.5) {
      const x = this.sx(view, s.bestEver.dist);
      if (x > -40 && x < w + 40) {
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
        ctx.setLineDash([10, 10]);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, view.groundY - view.scale * 3);
        ctx.lineTo(x, view.groundY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '34px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🏆', x, view.groundY - view.scale * 3 - 10);
      }
    }
  }

  private drawRace(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const laneH = h / 2;
    this.racers.forEach((racer, i) => {
      const view: View = {
        camX: Math.max(1.5, racer.camX) + 1,
        scale: 0.17 * Math.min(w, h),
        centerX: w / 2,
        top: i * laneH,
        height: laneH,
        groundY: i * laneH + laneH * 0.82,
      };
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, view.top, w, view.height);
      ctx.clip();
      this.drawGround(ctx, view, w);
      this.drawCreature(ctx, view, racer.creature, 1, racer.color);
      ctx.fillStyle = racer.color;
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(racer.label, 24, view.top + 42);
      ctx.restore();
    });
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, laneH);
    ctx.lineTo(w, laneH);
    ctx.stroke();

    if (this.raceElapsed < 0.8 && !this.raceOver) {
      const label = this.raceElapsed < 0 ? `${Math.ceil(-this.raceElapsed)}` : pick(TEXT).race.go;
      ctx.fillStyle = 'rgba(238, 242, 255, 0.95)';
      ctx.font = 'bold 120px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, w / 2, h / 2);
      ctx.textBaseline = 'alphabetic';
    }
  }

  // ---- delve rendering ----

  /** Screen x of the demo area's center: to the right of the delve panel. */
  private demoCenterX(w: number): number {
    const panel = Math.min(500, w * 0.46);
    return panel + (w - panel) / 2;
  }

  private pokeView(w: number, h: number): View {
    return {
      camX: this.pokeCamX,
      scale: 0.24 * Math.min(w, h),
      centerX: this.demoCenterX(w),
      top: 0,
      height: h,
      groundY: h * 0.72,
    };
  }

  private drawDelve(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const chapter = this.delve?.chapter ?? -1;
    if (chapter === 0 && this.pokeC) {
      const view = this.pokeView(w, h);
      this.drawGround(ctx, view, w);
      this.drawCreature(ctx, view, this.pokeC, 1, COLOR.you);
      this.drawLegend(ctx, w);
      ctx.fillStyle = 'rgba(238, 242, 255, 0.7)';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pick(TEXT).delve.pokeLabel, this.demoCenterX(w), h * 0.18);
    } else if (chapter === 1 && this.brainC) {
      const wavesH = Math.min(220, h * 0.32);
      const view: View = {
        camX: Math.max(0, this.brainCamX),
        scale: 0.17 * Math.min(w, h),
        centerX: this.demoCenterX(w),
        top: 0,
        height: h - wavesH,
        groundY: (h - wavesH) * 0.86,
      };
      this.drawGround(ctx, view, w);
      this.drawCreature(ctx, view, this.brainC, 1, COLOR.you, MUSCLE_COLORS);
      this.drawWaves(ctx, w, h, wavesH);
    } else if (chapter === 2 && this.demoEvo) {
      const view: View = {
        camX: Math.max(1.2, this.demoEvo.camX) + 0.5,
        scale: 0.16 * Math.min(w, h),
        centerX: this.demoCenterX(w),
        top: 0,
        height: h,
        groundY: h * 0.7,
      };
      this.drawEvo(ctx, view, w, this.demoEvo);
      this.drawChart(ctx, w - 320 - 34, h - 144 - 24, this.demoEvo.history);
      ctx.fillStyle = 'rgba(238, 242, 255, 0.85)';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      {
        const best = this.demoEvo.bestEver ? `${Math.max(0, this.demoEvo.bestEver.dist).toFixed(1)} m` : '—';
        ctx.fillText(
          pick(TEXT).delve.evoLabel(this.demoEvo.generation, best),
          this.demoCenterX(w),
          44,
        );
      }
    } else if (chapter === 3) {
      const laneH = h / this.zoo.length;
      const labelX = Math.min(500, w * 0.46) + 24;
      this.zoo.forEach((z, i) => {
        const view: View = {
          camX: Math.max(1.2, z.camX) + 0.8,
          scale: 0.105 * Math.min(w, h),
          centerX: this.demoCenterX(w),
          top: i * laneH,
          height: laneH,
          groundY: i * laneH + laneH * 0.8,
        };
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, view.top, w, view.height);
        ctx.clip();
        this.drawGround(ctx, view, w);
        this.drawCreature(ctx, view, z.creature, 1, COLOR.you);
        ctx.fillStyle = 'rgba(238, 242, 255, 0.85)';
        ctx.font = 'bold 19px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(
          `${z.emoji} ${z.name} — ${Math.max(0, z.creature.comX()).toFixed(1)} m`,
          labelX,
          view.top + 30,
        );
        ctx.restore();
        if (i > 0) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, view.top);
          ctx.lineTo(w, view.top);
          ctx.stroke();
        }
      });
    }
  }

  /** Little "what am I looking at" legend for the physics chapter. */
  private drawLegend(ctx: CanvasRenderingContext2D, w: number): void {
    const T = pick(TEXT).delve.legend;
    const x = w - 250;
    const y = 110; // below the top-right "close the science" pill
    ctx.fillStyle = 'rgba(5, 8, 20, 0.6)';
    ctx.beginPath();
    ctx.roundRect(x - 20, y - 24, 240, 118, 12);
    ctx.fill();
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    const row = (dy: number, draw: () => void, label: string) => {
      draw();
      ctx.fillStyle = 'rgba(238, 242, 255, 0.85)';
      ctx.fillText(label, x + 64, y + dy + 5);
    };
    row(
      0,
      () => {
        ctx.fillStyle = COLOR.node;
        ctx.beginPath();
        ctx.arc(x + 24, y, 9, 0, Math.PI * 2);
        ctx.fill();
      },
      T.dot,
    );
    row(
      34,
      () => {
        ctx.strokeStyle = COLOR.bone;
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 34);
        ctx.lineTo(x + 46, y + 34);
        ctx.stroke();
      },
      T.bone,
    );
    row(
      68,
      () => {
        ctx.strokeStyle = COLOR.muscle;
        ctx.lineWidth = 7 + 2.5 * Math.sin(this.time * 4);
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 68);
        ctx.lineTo(x + 46, y + 68);
        ctx.stroke();
      },
      T.muscle,
    );
  }

  /** Live per-muscle sine waves with a moving "now" cursor (delve chapter 2). */
  private drawWaves(ctx: CanvasRenderingContext2D, w: number, h: number, wavesH: number): void {
    if (!this.brainC) return;
    const genome = this.brainC.genome;
    const n = genome.muscles.length;
    if (n === 0) return;
    const panelX = Math.min(500, w * 0.46) + 30;
    const W = w - panelX - 40;
    const rowH = Math.min(44, (wavesH - 34) / n);
    const y0 = h - wavesH + 12;

    ctx.fillStyle = 'rgba(5, 8, 20, 0.6)';
    ctx.beginPath();
    ctx.roundRect(panelX - 14, y0 - 8, W + 28, n * rowH + 30, 12);
    ctx.fill();
    ctx.fillStyle = 'rgba(238, 242, 255, 0.6)';
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(pick(TEXT).delve.wavesLabel, panelX, y0 + 8);

    const window = 2 / genome.freq; // show two beats
    const tNow = this.brainC.time % window;
    genome.muscles.forEach((gene, m) => {
      const mid = y0 + 26 + m * rowH + rowH / 2;
      const amp = rowH * 0.36;
      const color = MUSCLE_COLORS[m % MUSCLE_COLORS.length];
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(panelX, mid);
      ctx.lineTo(panelX + W, mid);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let k = 0; k <= 80; k++) {
        const t = (window * k) / 80;
        const y = mid - amp * (gene.amp / 0.3) * Math.sin(2 * Math.PI * genome.freq * t + gene.phase);
        if (k === 0) ctx.moveTo(panelX + (W * k) / 80, y);
        else ctx.lineTo(panelX + (W * k) / 80, y);
      }
      ctx.stroke();
      const cx = panelX + (W * tNow) / window;
      const cy = mid - amp * (gene.amp / 0.3) * Math.sin(2 * Math.PI * genome.freq * tNow + gene.phase);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ---- shared world rendering ----

  private sx(view: View, wx: number): number {
    return view.centerX + (wx - view.camX) * view.scale;
  }

  private sy(view: View, wy: number): number {
    return view.groundY - wy * view.scale;
  }

  private drawGround(ctx: CanvasRenderingContext2D, view: View, w: number): void {
    ctx.fillStyle = COLOR.groundFill;
    ctx.fillRect(0, view.groundY, w, view.top + view.height - view.groundY);
    ctx.strokeStyle = COLOR.ground;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, view.groundY);
    ctx.lineTo(w, view.groundY);
    ctx.stroke();

    const left = Math.floor(view.camX - view.centerX / view.scale);
    const right = Math.ceil(view.camX + (w - view.centerX) / view.scale);
    ctx.fillStyle = 'rgba(238, 242, 255, 0.4)';
    ctx.font = '15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let m = left; m <= right; m++) {
      const x = this.sx(view, m);
      ctx.fillRect(x - 1, view.groundY, 2, 8);
      if (m > 0) ctx.fillText(`${m} m`, x, view.groundY + 26);
    }
    const startX = this.sx(view, 0);
    ctx.font = '30px system-ui, sans-serif';
    ctx.fillText('🚩', startX + 8, view.groundY - 8);
  }

  /** Draw a live creature (world positions from its Verlet points). */
  private drawCreature(
    ctx: CanvasRenderingContext2D,
    view: View,
    c: Creature,
    alpha: number,
    nodeColor: string,
    muscleColors?: string[],
  ): void {
    ctx.globalAlpha = alpha;
    for (const s of c.sticks) {
      const a = c.pts[s.a];
      const b = c.pts[s.b];
      if (!isFinite(a.x + a.y + b.x + b.y)) continue;
      const muscle = s.muscle >= 0;
      const strain = muscle ? c.stickStrain(s) : 0;
      ctx.strokeStyle = muscle
        ? (muscleColors?.[s.muscle % (muscleColors.length || 1)] ?? COLOR.muscle)
        : COLOR.bone;
      ctx.lineWidth = Math.max(2, (muscle ? 0.055 * (1 - strain * 1.5) : 0.045) * view.scale);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.sx(view, a.x), this.sy(view, a.y));
      ctx.lineTo(this.sx(view, b.x), this.sy(view, b.y));
      ctx.stroke();
    }
    c.pts.forEach((p, i) => {
      if (!isFinite(p.x + p.y)) return;
      const x = this.sx(view, p.x);
      const y = this.sy(view, p.y);
      ctx.fillStyle = i === 0 ? nodeColor : COLOR.node;
      ctx.beginPath();
      ctx.arc(x, y, (i === 0 ? NODE_R * 2 : NODE_R) * view.scale, 0, Math.PI * 2);
      ctx.fill();
      if (i === 0) this.drawEye(ctx, x, y, view.scale, p.x - p.px);
    });
    ctx.globalAlpha = 1;
  }

  /** Googly eye on the head, pupil looking in the direction of travel. */
  private drawEye(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    vx: number,
  ): void {
    const r = NODE_R * 1.1 * scale;
    const look = Math.sign(vx || 1) * r * 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b1020';
    ctx.beginPath();
    ctx.arc(x + look, y, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Draw the editable plan in build mode (static, with gently pulsing muscles). */
  private drawPlan(ctx: CanvasRenderingContext2D, view: View): void {
    this.plan.sticks.forEach((s, i) => {
      const a = this.plan.nodes[s.a];
      const b = this.plan.nodes[s.b];
      ctx.strokeStyle = s.muscle ? COLOR.muscle : COLOR.bone;
      const pulse = s.muscle ? 1 + 0.18 * Math.sin(this.time * 3 + i) : 1;
      ctx.lineWidth = (s.muscle ? 0.055 : 0.045) * view.scale * pulse;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.sx(view, a.x), this.sy(view, a.y));
      ctx.lineTo(this.sx(view, b.x), this.sy(view, b.y));
      ctx.stroke();
    });
    this.plan.nodes.forEach((n, i) => {
      const x = this.sx(view, n.x);
      const y = this.sy(view, n.y);
      ctx.fillStyle = COLOR.node;
      ctx.beginPath();
      ctx.arc(x, y, (i === 0 ? NODE_R * 2 : NODE_R * 1.3) * view.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(11, 16, 32, 0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (i === 0) this.drawEye(ctx, x, y, view.scale, 1);
    });
  }

  /** Learning curve: best distance per generation. */
  private drawChart(ctx: CanvasRenderingContext2D, x: number, y: number, history: number[]): void {
    if (history.length === 0) return;
    const W = 320;
    const H = 120;
    ctx.fillStyle = 'rgba(5, 8, 20, 0.6)';
    ctx.beginPath();
    ctx.roundRect(x - 10, y - 30, W + 20, H + 44, 12);
    ctx.fill();
    ctx.fillStyle = 'rgba(238, 242, 255, 0.7)';
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(pick(TEXT).delve.chartLabel, x, y - 10);
    const max = Math.max(1, ...history);
    const bw = Math.min(24, W / history.length);
    history.forEach((d, i) => {
      const bh = Math.max(2, (H * d) / max);
      ctx.fillStyle = i === history.length - 1 ? COLOR.you : 'rgba(125, 211, 252, 0.45)';
      ctx.fillRect(x + i * bw, y + H - bh, bw - 3, bh);
    });
  }

  private toWorld(e: PointerEvent): { x: number; y: number } {
    const rect = this.host.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const scale = 0.3 * Math.min(w, h);
    const groundY = h * 0.78;
    return {
      x: (e.clientX - rect.left - w / 2) / scale + 0.55,
      y: (groundY - (e.clientY - rect.top)) / scale,
    };
  }
}

export const creature: ArcadeGame = {
  id: 'creature',
  title: { en: 'Creature Lab', nl: 'Beestenlab', no: 'Skapningslab' },
  scienceLine: {
    en: 'Nobody programmed these creatures to walk — they learn by evolution: try, keep the best, mutate, repeat. The same trial-and-error math trains real robots.',
    nl: 'Niemand heeft deze beestjes geprogrammeerd om te lopen — ze leren door evolutie: proberen, de beste bewaren, muteren, herhalen. Dezelfde vallen-en-opstaan-wiskunde traint echte robots.',
    no: 'Ingen har programmert disse skapningene til å gå — de lærer gjennom evolusjon: prøve, beholde de beste, mutere, gjenta. Den samme prøve-og-feile-matematikken trener ekte roboter.',
  },
  tileEmoji: '🧬',
  create: (host) => new CreatureInstance(host),
};
