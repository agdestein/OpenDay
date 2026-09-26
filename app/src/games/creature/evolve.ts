// Evolution of muscle-rhythm brains: a population of genomes, each tried in
// the simulation and scored by a reward; the best breed. Elitism + tournament
// selection + crossover + gaussian mutation — simple, but it visibly learns
// within a minute. A kid can also pick the parent by hand (babiesOf).
import {
  Creature,
  FIXED_DT,
  simulate,
  MAX_AMP,
  muscleCount,
  netSize,
  senseCount,
  type BodyPlan,
  type CreatureOptions,
  type Genome,
  type Ground,
  type MuscleGene,
} from './physics';

export const POPULATION = 20;
const ELITES = 2;
const TOURNAMENT = 3;

const FREQ_MIN = 0.6;
const FREQ_MAX = 2.8;

/**
 * What a creature is rewarded for — the only feedback evolution gets.
 * far: distance; ground: distance while a foot touches the ground (race-walking);
 * high: the best jump (all feet off the ground); back: distance backwards.
 */
export type Reward = 'far' | 'ground' | 'high' | 'back';

/** A rhythm brain (a sine wave per muscle), or one that also feels: rhythm plus reflexes from the senses. */
export type Brain = 'rhythm' | 'feel';

/** A shove during a try: at time t (s), every dot gets the velocity (vx, vy) (m/s) added. */
export interface Shove {
  t: number;
  vx: number;
  vy: number;
}

/** Random shoves every 1.5–3 s, forwards or backwards (rough practice, and the push test). */
export function randomShoves(seconds: number, rand: () => number = Math.random, strength = 2.5): Shove[] {
  const out: Shove[] = [];
  for (let t = 1 + rand() * 1.5; t < seconds; t += 1.5 + rand() * 1.5) {
    out.push({ t, vx: (rand() < 0.5 ? -1 : 1) * strength * (0.6 + 0.4 * rand()), vy: strength * 0.4 * rand() });
  }
  return out;
}

/**
 * Hidden neurons of a feeling brain. Measured (Doggo, 50 generations with
 * shoves, 12 runs, a test of 20 shove sequences): rhythm alone flipped a
 * median 10 times, with 4 hidden neurons 1, with 6 hidden 2, and wired
 * straight to the muscles it was no better than the rhythm.
 */
export const REFLEX_HIDDEN = 4;

/**
 * Give a rhythm brain senses and reflexes that start silent: it moves exactly
 * as before until evolution tunes them.
 */
export function withReflexes(g: Genome, plan: BodyPlan, rand: () => number = Math.random, hidden = REFLEX_HIDDEN): Genome {
  // Hidden neurons (if any) start random; every weight into a muscle starts at zero.
  const hiddenWeights = hidden > 0 ? hidden * (senseCount(plan) + 1) : 0;
  const w = Array.from({ length: netSize(plan, hidden) }, (_, i) => (i < hiddenWeights ? randn(rand) * 1.2 : 0));
  return { freq: g.freq, muscles: g.muscles.map((m) => ({ ...m })), net: { hidden, w } };
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Roughly normal noise (sum of uniforms), cheap and good enough. */
function randn(rand: () => number): number {
  return rand() + rand() + rand() - 1.5;
}

export function randomGenome(plan: BodyPlan, rand: () => number = Math.random, brain: Brain = 'rhythm'): Genome {
  const muscles: MuscleGene[] = [];
  for (let i = 0; i < muscleCount(plan); i++) {
    muscles.push({ amp: rand() * MAX_AMP, phase: rand() * 2 * Math.PI });
  }
  const g = { freq: FREQ_MIN + rand() * (FREQ_MAX - FREQ_MIN), muscles };
  return brain === 'feel' ? withReflexes(g, plan, rand) : g;
}

export function mutate(g: Genome, rand: () => number = Math.random): Genome {
  const net = g.net ? { hidden: g.net.hidden, w: g.net.w.map((x) => (rand() < 0.2 ? x + randn(rand) * 0.6 : x)) } : undefined;
  const muscles = g.muscles.map((m) =>
    rand() < 0.55
      ? {
          amp: clamp(m.amp + randn(rand) * 0.12, 0, MAX_AMP),
          phase: m.phase + randn(rand) * 0.9,
        }
      : { ...m },
  );
  return { freq: clamp(g.freq + randn(rand) * 0.25, FREQ_MIN, FREQ_MAX), muscles, ...(net ? { net } : {}) };
}

export function crossover(a: Genome, b: Genome, rand: () => number = Math.random): Genome {
  const bw = b.net?.w;
  const net = a.net && bw ? { hidden: a.net.hidden, w: a.net.w.map((x, i) => (rand() < 0.5 ? x : bw[i])) } : undefined;
  return {
    freq: rand() < 0.5 ? a.freq : b.freq,
    muscles: a.muscles.map((m, i) => ({ ...(rand() < 0.5 ? m : b.muscles[i]) })),
    ...(net ? { net } : {}),
  };
}

export function cloneGenome(g: Genome): Genome {
  return { freq: g.freq, muscles: g.muscles.map((m) => ({ ...m })), ...(g.net ? { net: { hidden: g.net.hidden, w: [...g.net.w] } } : {}) };
}

export interface Scored {
  genome: Genome;
  score: number;
}

/** Breed the next generation from a scored population (any order). */
export function nextGeneration(scored: Scored[], rand: () => number = Math.random): Genome[] {
  const ranked = [...scored].sort((a, b) => b.score - a.score);
  const pick = (): Genome => {
    let best = ranked[Math.floor(rand() * ranked.length)];
    for (let i = 1; i < TOURNAMENT; i++) {
      const other = ranked[Math.floor(rand() * ranked.length)];
      if (other.score > best.score) best = other;
    }
    return best.genome;
  };
  const next: Genome[] = ranked.slice(0, ELITES).map((e) => e.genome);
  while (next.length < scored.length) next.push(mutate(crossover(pick(), pick(), rand), rand));
  return next;
}

/** A hand-picked parent's litter: itself, then n − 1 mutated babies. */
export function babiesOf(parent: Genome, n: number, rand: () => number = Math.random): Genome[] {
  return [parent, ...Array.from({ length: n - 1 }, () => mutate(parent, rand))];
}

/** A creature's score under a reward (a creature that blew up scores nothing). */
export function rewardScore(c: Creature, reward: Reward): number {
  if (!c.finite()) return -999;
  const d = c.dist();
  if (Math.abs(d) > 1e4) return -999;
  switch (reward) {
    case 'far':
      return d;
    case 'ground':
      return c.groundDist;
    case 'high':
      return c.bestClear;
    case 'back':
      return -d;
  }
}

export interface EvolutionOptions {
  population?: number;
  /** Simulated seconds each try lasts. */
  evalTime?: number;
  reward?: Reward;
  /** The world each generation practises in (default: flat); a new one per generation = varied practice. */
  groundFor?: (generation: number) => Ground;
  oldMuscles?: boolean;
  rand?: () => number;
  /** Carry on from this brain (it and its mutated babies) instead of random brains. */
  start?: Genome;
  /** Which kind of brain the random first generation gets. */
  brain?: Brain;
  /** Shoves during each generation's tries (the same for everyone in a generation). */
  shovesFor?: (generation: number) => Shove[];
}

export interface Best {
  score: number;
  dist: number;
  genome: Genome;
}

/**
 * One running evolution: the population on screen, stepped in fixed time
 * steps; a generation ends when its time is up, or when someone picks a parent.
 */
export class Evolution {
  readonly population: number;
  readonly evalTime: number;
  reward: Reward;
  genomes: Genome[];
  creatures: Creature[] = [];
  /** 1-based number of the generation now trying. */
  generation = 1;
  /** Simulated seconds into the current generation. */
  genElapsed = 0;
  /** Best of all generations (in a world that changes, the best of the last one). */
  best: Best | null = null;
  /** The best score of each finished generation. */
  history: number[] = [];
  /** The last finished generation's best five, best first. */
  lastTop: Genome[] = [];
  /** Generations where the kid picked the parent (indices into history). */
  picked = new Set<number>();
  /** Everything simulated so far: tries and simulated seconds of practice. */
  tries = 0;
  practice = 0;
  private stepAccum = 0;
  private readonly groundFor?: (generation: number) => Ground;
  private shovesFor?: (generation: number) => Shove[];
  private shoves: Shove[] = [];
  private nextShove = 0;
  /** When the last shove came (simulated seconds into the generation), for a puff on screen. */
  lastShove = -1;
  private readonly oldMuscles: boolean;
  private readonly rand: () => number;

  constructor(
    readonly plan: BodyPlan,
    opts: EvolutionOptions = {},
  ) {
    this.population = opts.population ?? POPULATION;
    this.evalTime = opts.evalTime ?? 7;
    this.reward = opts.reward ?? 'far';
    this.groundFor = opts.groundFor;
    this.shovesFor = opts.shovesFor;
    this.oldMuscles = opts.oldMuscles ?? false;
    this.rand = opts.rand ?? Math.random;
    this.genomes = opts.start
      ? babiesOf(opts.start, this.population, this.rand)
      : Array.from({ length: this.population }, () => randomGenome(plan, this.rand, opts.brain));
    this.spawn();
  }

  /** The world the current generation practises in. */
  ground(): Ground | undefined {
    return this.groundFor?.(this.generation);
  }

  private spawn(): void {
    const opts: CreatureOptions = { ground: this.ground(), oldMuscles: this.oldMuscles };
    this.creatures = this.genomes.map((g) => new Creature(this.plan, g, opts));
    this.genElapsed = 0;
    this.shoves = this.shovesFor?.(this.generation) ?? [];
    this.nextShove = 0;
    this.lastShove = -1;
  }

  score(i: number): number {
    return rewardScore(this.creatures[i], this.reward);
  }

  /** Index of the creature doing best so far this generation. */
  leader(): number {
    let best = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < this.creatures.length; i++) {
      const s = this.score(i);
      if (s > bestScore) {
        bestScore = s;
        best = i;
      }
    }
    return best;
  }

  /**
   * Advance `seconds` of simulated time (at most `maxSteps` fixed steps, the
   * rest is dropped). Returns how many generations ended.
   */
  advance(seconds: number, maxSteps = 240): number {
    this.stepAccum += seconds;
    let steps = Math.min(maxSteps, Math.floor(this.stepAccum / FIXED_DT));
    this.stepAccum -= steps * FIXED_DT;
    // A throttled tab builds a backlog; drop it rather than fast-forwarding.
    if (this.stepAccum > 0.5) this.stepAccum = 0;
    let ended = 0;
    while (steps-- > 0) {
      for (const c of this.creatures) c.step();
      this.genElapsed += FIXED_DT;
      this.shove();
      if (this.genElapsed >= this.evalTime - 1e-9) {
        this.endGeneration();
        ended++;
      }
    }
    return ended;
  }

  /** Run whole generations at once (turbo, tests). */
  runGenerations(n: number): void {
    for (let k = 0; k < n; k++) {
      const steps = Math.round((this.evalTime - this.genElapsed) / FIXED_DT);
      for (let s = 0; s < steps; s++) {
        for (const c of this.creatures) c.step();
        this.genElapsed += FIXED_DT;
        this.shove();
      }
      this.genElapsed = this.evalTime;
      this.endGeneration();
    }
  }

  private shove(): void {
    const s = this.shoves[this.nextShove];
    if (s && this.genElapsed >= s.t) {
      for (const c of this.creatures) c.kick(s.vx, s.vy);
      this.nextShove++;
      this.lastShove = this.genElapsed;
    }
  }

  /** Practise with random shoves from the next generation on (or stop). */
  setShoves(on: boolean): void {
    this.shovesFor = on ? () => randomShoves(this.evalTime, this.rand) : undefined;
    if (!on) this.shoves = [];
  }

  get shoving(): boolean {
    return this.shovesFor !== undefined;
  }

  /** The kind of brain the population has now. */
  brain(): Brain {
    return this.genomes[0]?.net ? 'feel' : 'rhythm';
  }

  /** Give the whole population senses (silent reflexes) or take them away; the generation starts over. */
  setBrain(brain: Brain): void {
    if (brain === this.brain()) return;
    this.genomes = this.genomes.map((g) =>
      brain === 'feel' ? withReflexes(g, this.plan, this.rand) : { freq: g.freq, muscles: g.muscles.map((m) => ({ ...m })) },
    );
    this.best = null;
    this.history = [];
    this.picked.clear();
    this.spawn();
  }

  /** End the generation now: the kid's pick breeds, or else the best do. */
  endGeneration(parent?: number): void {
    const scored = this.creatures.map((c, i) => ({ genome: this.genomes[i], score: this.score(i), dist: c.dist() }));
    this.tries += this.creatures.length;
    this.practice += this.creatures.length * this.genElapsed;
    let top = scored[0];
    for (const s of scored) if (s.score > top.score) top = s;
    // In a world that changes (bumps, shoves) a lucky old score says little: keep the latest best.
    if (this.groundFor || this.shovesFor || !this.best || top.score > this.best.score) {
      this.best = { score: top.score, dist: top.dist, genome: top.genome };
    }
    this.lastTop = [...scored].sort((a, b) => b.score - a.score).slice(0, 5).map((s) => s.genome);
    if (parent !== undefined) this.picked.add(this.history.length);
    this.history.push(top.score);
    this.genomes =
      parent !== undefined
        ? babiesOf(this.genomes[parent], this.population, this.rand)
        : nextGeneration(scored, this.rand);
    this.generation++;
    this.spawn();
  }

  /** Change what is rewarded: the population carries on, the record starts over. */
  setReward(reward: Reward): void {
    if (reward === this.reward) return;
    this.reward = reward;
    this.best = null;
    this.history = [];
    this.picked.clear();
  }
}

/** A seeded random number generator (for tests and offline training). */
export function seededRandom(seed: number): () => number {
  // mulberry32
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * For practice in changing worlds: the one of the last generation's best five
 * that does best on average over a few fresh practice worlds (a check on
 * practice-like ground, never on the test course itself).
 */
export function steadiest(evo: Evolution, worlds: Ground[], seconds = 12): Genome {
  let best = evo.best!.genome;
  let bestScore = -Infinity;
  for (const g of evo.lastTop) {
    let sum = 0;
    for (const ground of worlds) sum += rewardScore(simulate(evo.plan, g, seconds, { ground }), evo.reward);
    if (sum > bestScore) {
      bestScore = sum;
      best = g;
    }
  }
  return best;
}
