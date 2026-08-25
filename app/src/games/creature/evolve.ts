// Neuroevolution loop: a population of muscle-oscillator genomes, selected by
// how far their creature walks. Elitism + tournament selection + crossover +
// gaussian mutation — simple, but it visibly learns within a couple of minutes.
import { MAX_AMP, muscleCount, type BodyPlan, type Genome, type MuscleGene } from './physics';

export const POPULATION = 20;
const ELITES = 2;
const TOURNAMENT = 3;

const FREQ_MIN = 0.6;
const FREQ_MAX = 2.8;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Roughly normal noise (sum of uniforms), cheap and good enough. */
function randn(): number {
  return Math.random() + Math.random() + Math.random() - 1.5;
}

export function randomGenome(plan: BodyPlan): Genome {
  const muscles: MuscleGene[] = [];
  for (let i = 0; i < muscleCount(plan); i++) {
    muscles.push({ amp: Math.random() * MAX_AMP, phase: Math.random() * 2 * Math.PI });
  }
  return { freq: FREQ_MIN + Math.random() * (FREQ_MAX - FREQ_MIN), muscles };
}

export function mutate(g: Genome): Genome {
  const muscles = g.muscles.map((m) =>
    Math.random() < 0.55
      ? {
          amp: clamp(m.amp + randn() * 0.12, 0, MAX_AMP),
          phase: m.phase + randn() * 0.9,
        }
      : { ...m },
  );
  return { freq: clamp(g.freq + randn() * 0.25, FREQ_MIN, FREQ_MAX), muscles };
}

export function crossover(a: Genome, b: Genome): Genome {
  return {
    freq: Math.random() < 0.5 ? a.freq : b.freq,
    muscles: a.muscles.map((m, i) => ({ ...(Math.random() < 0.5 ? m : b.muscles[i]) })),
  };
}

export interface Scored {
  genome: Genome;
  fitness: number;
}

/** Breed the next generation from a scored population (any order). */
export function nextGeneration(scored: Scored[]): Genome[] {
  const ranked = [...scored].sort((a, b) => b.fitness - a.fitness);
  const pick = (): Genome => {
    let best = ranked[Math.floor(Math.random() * ranked.length)];
    for (let i = 1; i < TOURNAMENT; i++) {
      const other = ranked[Math.floor(Math.random() * ranked.length)];
      if (other.fitness > best.fitness) best = other;
    }
    return best.genome;
  };
  const next: Genome[] = ranked.slice(0, ELITES).map((e) => e.genome);
  while (next.length < scored.length) next.push(mutate(crossover(pick(), pick())));
  return next;
}
