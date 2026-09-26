// Trains Creature Lab's pre-trained brains with the game's own physics and
// writes app/src/games/creature/brains.ts. Run from app/: `npm run train:creature`
// (about a minute). Seeded, so it gives the same brains every time.
//
// Every brain is rounded to four decimals and then checked rounded, and must be
// robust: with each phase nudged by up to ±1e-4 rad (8 tries) it must still
// reach 85 % of its distance. Gaits are chaotic, and browsers may round the
// last bit of Math.sin differently, so a fragile brain could trip on the day.
// Among the robust ones, the park's walkers (and the built-in champions) are the
// median of their runs, not the best: kids who train should be able to win.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bumpyGround, simulate, type BodyPlan, type Creature, type CreatureOptions, type Genome } from '../../app/src/games/creature/physics';
import { Evolution, seededRandom, type Reward } from '../../app/src/games/creature/evolve';
import { COURSE_SEED, PRESETS, preset, type PresetId } from '../../app/src/games/creature/presets';

const RACE = 12;

const round = (g: Genome): Genome => ({
  freq: +g.freq.toFixed(4),
  muscles: g.muscles.map((m) => ({ amp: +m.amp.toFixed(4), phase: +(((m.phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).toFixed(4) })),
});

interface Candidate {
  genome: Genome;
  value: number;
  robust: boolean;
  airborne: number;
  turns: number;
  dist: number;
}

type Measure = (c: Creature) => number;

function assess(plan: BodyPlan, genome: Genome, secs: number, measure: Measure, opts: CreatureOptions, rand: () => number): Candidate {
  const c = simulate(plan, genome, secs, opts);
  const value = measure(c);
  let worst = Infinity;
  for (let k = 0; k < 8; k++) {
    const nudged = { ...genome, muscles: genome.muscles.map((m) => ({ ...m, phase: m.phase + (rand() * 2 - 1) * 1e-4 })) };
    worst = Math.min(worst, measure(simulate(plan, nudged, secs, opts)));
  }
  return { genome, value, robust: value > 0 && worst >= 0.85 * value, airborne: c.airborne(), turns: c.turns(), dist: c.dist() };
}

function trainRuns(
  plan: BodyPlan,
  runs: number,
  gens: number,
  seed: number,
  opts: { reward?: Reward; evalTime?: number; oldMuscles?: boolean; bumps?: boolean },
): Genome[] {
  const out: Genome[] = [];
  for (let r = 0; r < runs; r++) {
    const evo = new Evolution(plan, {
      reward: opts.reward,
      evalTime: opts.evalTime,
      oldMuscles: opts.oldMuscles,
      rand: seededRandom(seed * 1000 + r),
      groundFor: opts.bumps ? (gen) => bumpyGround(seed * 100000 + r * 1000 + gen, 0.2) : undefined,
    });
    evo.runGenerations(gens);
    out.push(round(evo.best!.genome));
  }
  return out;
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const fmt = (c: Candidate) => `${c.value.toFixed(2)} (dist ${c.dist.toFixed(1)} m, airborne ${(100 * c.airborne).toFixed(0)} %, turns ${c.turns.toFixed(1)}${c.robust ? '' : ', FRAGILE'})`;

function pickClosest(cands: Candidate[], target: number): Candidate {
  const robust = cands.filter((c) => c.robust);
  const pool = robust.length ? robust : cands;
  return pool.reduce((a, b) => (Math.abs(b.value - target) < Math.abs(a.value - target) ? b : a));
}

const rand = seededRandom(424242);
const far: Measure = (c) => c.dist();
const out: string[] = [];
const trained: Partial<Record<PresetId, Genome>> = {};

// Park walkers and built-in champions: distance on flat ground, 40 generations, median of 8 runs.
const flatDoggo: Candidate[] = [];
for (const p of PRESETS) {
  const cands = trainRuns(p.plan, 8, 40, 1 + PRESETS.indexOf(p), {}).map((g) => assess(p.plan, g, RACE, far, {}, rand));
  const chosen = pickClosest(cands, median(cands.map((c) => c.value)));
  trained[p.id] = chosen.genome;
  if (p.id === 'Doggo') flatDoggo.push(...cands);
  console.log(`${p.id}: runs ${cands.map((c) => c.value.toFixed(1)).join(' ')} → chose ${fmt(chosen)}`);
}

// Race-walk demo: the Wiggler rewarded for distance (it hops) and for distance on the ground (it crawls).
const wiggler = preset('Wiggler').plan;
const hopCands = trainRuns(wiggler, 8, 25, 11, {}).map((g) => assess(wiggler, g, RACE, (c) => c.groundDist, {}, rand));
const hop = hopCands.filter((c) => c.robust).sort((a, b) => b.airborne - a.airborne)[0] ?? hopCands[0];
console.log(`wigglerHop: airborne ${hopCands.map((c) => (100 * c.airborne).toFixed(0)).join(' ')} % → ${fmt(hop)}`);
const groundCands = trainRuns(wiggler, 8, 25, 12, { reward: 'ground' }).map((g) => assess(wiggler, g, RACE, (c) => c.groundDist, {}, rand));
const ground = pickClosest(groundCands.filter((c) => c.airborne < 0.1).length ? groundCands.filter((c) => c.airborne < 0.1) : groundCands, median(groundCands.map((c) => c.value)));
console.log(`wigglerGround: judged ${groundCands.map((c) => c.value.toFixed(1)).join(' ')} → ${fmt(ground)}`);

// The old, limitless muscles: the stick-man cartwheels, the worm flies.
const stick = preset('Stickman').plan;
const old: CreatureOptions = { oldMuscles: true };
const stickCands = trainRuns(stick, 8, 30, 21, { oldMuscles: true }).map((g) => assess(stick, g, RACE, far, old, rand));
const cartwheel = stickCands.filter((c) => c.robust && c.turns >= 3).sort((a, b) => b.turns - a.turns)[0] ?? stickCands.sort((a, b) => b.turns - a.turns)[0];
console.log(`stickOld: turns ${stickCands.map((c) => c.turns.toFixed(1)).join(' ')} → ${fmt(cartwheel)}`);
const jumpCands = trainRuns(wiggler, 6, 20, 22, { reward: 'high', evalTime: 5, oldMuscles: true }).map((g) => assess(wiggler, g, 8, (c) => c.bestClear, old, rand));
const jump = jumpCands.filter((c) => c.robust).sort((a, b) => b.value - a.value)[0] ?? jumpCands.sort((a, b) => b.value - a.value)[0];
const capped = simulate(wiggler, jump.genome, 8).bestClear;
console.log(`wormOldJump: clearance ${jumpCands.map((c) => c.value.toFixed(2)).join(' ')} m → ${fmt(jump)}; with today's muscles ${capped.toFixed(2)} m`);

// Practice worlds: a Doggo that practised on a flat floor and one that practised on changing bumps, on the course.
const doggo = preset('Doggo').plan;
const course: CreatureOptions = { ground: bumpyGround(COURSE_SEED, 0.2) };
const onCourse: Measure = (c) => c.dist();
const flatOnCourse = flatDoggo.map((c) => assess(doggo, c.genome, RACE, onCourse, course, rand));
const bumpCands = trainRuns(doggo, 8, 40, 31, { bumps: true }).map((g) => assess(doggo, g, RACE, onCourse, course, rand));
console.log(`doggo on the course: flat-trained ${flatOnCourse.map((c) => c.value.toFixed(1)).join(' ')}; bump-trained ${bumpCands.map((c) => c.value.toFixed(1)).join(' ')}`);
// The flat demo walks well on the flat but, like most flat-trained Doggos, gets stuck on the course.
const stuck = flatDoggo
  .map((c, i) => ({ flat: c, course: flatOnCourse[i] }))
  .filter((x) => x.flat.value > 12 && x.course.value < 3)
  .sort((a, b) => b.flat.value - a.flat.value)[0];
const flatChoice = stuck?.course ?? flatOnCourse.find((c) => c.genome === trained.Doggo)!;
const bumpChoice = pickClosest(bumpCands, median(bumpCands.map((c) => c.value)));
console.log(`doggoFlat on the course: ${fmt(flatChoice)} (on the flat ${stuck?.flat.value.toFixed(1)}); doggoBumps: ${fmt(bumpChoice)}`);

const g = (x: Genome) =>
  `{ freq: ${x.freq}, muscles: [${x.muscles.map((m) => `{ amp: ${m.amp}, phase: ${m.phase} }`).join(', ')}] }`;
out.push(
  `// Generated by tools/creature/train.ts (\`npm run train:creature\`) — do not edit.`,
  `// Trained with the game's own physics, rounded, then checked again rounded:`,
  `// gaits are chaotic, so "tidier" decimals can turn a trot into a faceplant.`,
  `// Re-generate whenever physics.ts or evolve.ts changes.`,
  `import type { Genome } from './physics';`,
  `import type { PresetId } from './presets';`,
  ``,
  `/** One brain per preset, trained for distance on flat ground: the park's walkers and the built-in champions. */`,
  `export const TRAINED: Record<PresetId, Genome> = {`,
  ...PRESETS.map((p) => `  ${p.id}: ${g(trained[p.id]!)},`),
  `};`,
  ``,
  `/** Delve brains, each showing one thing (see train.ts for how each was chosen). */`,
  `export const DEMO_BRAINS: Record<'wigglerHop' | 'wigglerGround' | 'stickOld' | 'wormOldJump' | 'doggoFlat' | 'doggoBumps', Genome> = {`,
  `  /** Wiggler rewarded for distance only: it hops. */`,
  `  wigglerHop: ${g(hop.genome)},`,
  `  /** Wiggler rewarded for distance with a foot on the ground: it crawls. */`,
  `  wigglerGround: ${g(ground.genome)},`,
  `  /** Stick-man trained with the old, limitless muscles: it cartwheels. */`,
  `  stickOld: ${g(cartwheel.genome)},`,
  `  /** Wiggler trained with the old muscles to jump: it flies. */`,
  `  wormOldJump: ${g(jump.genome)},`,
  `  /** Doggo that practised on a flat floor: it walks well there and gets stuck on the course. */`,
  `  doggoFlat: ${g(flatChoice.genome)},`,
  `  /** Doggo that practised on changing bumps. */`,
  `  doggoBumps: ${g(bumpChoice.genome)},`,
  `};`,
  ``,
);
// npm runs scripts from app/.
const file = process.env.BRAINS_OUT ?? resolve('src/games/creature/brains.ts');
writeFileSync(file, out.join('\n'));
console.log(`wrote ${file}`);
