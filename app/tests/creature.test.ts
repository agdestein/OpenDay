// Creature Lab: physics, evolution and the pre-trained brains (npm run test:creature).
import { bumpyGround, Creature, FIXED_DT, FLAT, NODE_R, simulate, type BodyPlan, type Genome } from '../src/games/creature/physics.ts';
import { babiesOf, Evolution, randomGenome, randomShoves, seededRandom, steadiest, withReflexes, type Reward } from '../src/games/creature/evolve.ts';
import { COURSE_SEED, PRESETS, preset } from '../src/games/creature/presets.ts';
import { DEMO_BRAINS, TRAINED } from '../src/games/creature/brains.ts';
import assert from 'node:assert/strict';

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const f1 = (x: number) => x.toFixed(1);
const doggo = preset('Doggo').plan;
const wiggler = preset('Wiggler').plan;
const stick = preset('Stickman').plan;
const course = bumpyGround(COURSE_SEED, 0.2);

// ---- the muscle speed limit ----
{
  const oldJump = simulate(wiggler, DEMO_BRAINS.wormOldJump, 8, { oldMuscles: true }).bestClear;
  const newJump = simulate(wiggler, DEMO_BRAINS.wormOldJump, 8).bestClear;
  assert.ok(oldJump > 3, `old muscles: the worm flies (${oldJump})`);
  assert.ok(newJump < 1.2, `limited muscles: the worm stays low (${newJump})`);
  const oldTurns = simulate(stick, DEMO_BRAINS.stickOld, 12, { oldMuscles: true }).turns();
  const newTurns = simulate(stick, DEMO_BRAINS.stickOld, 12).turns();
  assert.ok(oldTurns > 5, `old muscles: the stick-man cartwheels (${oldTurns})`);
  assert.ok(newTurns < 2, `limited muscles: no cartwheels (${newTurns})`);
  // Trained for height with today's muscles, nobody clears much more than a metre.
  const clears = [0, 1, 2, 3].map((r) => {
    const evo = new Evolution(wiggler, { reward: 'high', evalTime: 5, rand: seededRandom(900 + r) });
    evo.runGenerations(15);
    return evo.best!.score;
  });
  assert.ok(Math.max(...clears) < 1.5, `jumps with limited muscles: ${clears.map(f1)}`);
  console.log(`PASS: muscle limit — worm jump ${f1(oldJump)} → ${f1(newJump)} m, cartwheels ${f1(oldTurns)} → ${f1(newTurns)} turns, trained jumps ${clears.map(f1).join(' ')} m.`);
}

// ---- never blows up: random kid-style bodies ----
{
  const rand = seededRandom(7);
  const r = (a: number, b: number) => a + rand() * (b - a);
  let bad = 0;
  for (let k = 0; k < 24; k++) {
    const n = 3 + Math.floor(rand() * 8);
    const nodes = Array.from({ length: n }, () => ({ x: r(-1.2, 1.2), y: r(0.07, 1.6) }));
    const sticks = [];
    for (let i = 1; i < n; i++) sticks.push({ a: Math.floor(rand() * i), b: i, muscle: rand() < 0.7 });
    for (let e = 0; e < n; e++) {
      const a = Math.floor(rand() * n), b = Math.floor(rand() * n);
      if (a !== b) sticks.push({ a, b, muscle: rand() < 0.7 });
    }
    sticks[0].muscle = true;
    const plan: BodyPlan = { nodes, sticks };
    for (const old of [false, true]) {
      const evo = new Evolution(plan, { rand, oldMuscles: old, population: 8, groundFor: k % 3 === 0 ? () => course : undefined });
      evo.runGenerations(4);
      for (const c of evo.creatures) if (!c.finite()) bad++;
      if (!Number.isFinite(evo.best!.score)) bad++;
    }
  }
  assert.equal(bad, 0, 'every creature stays finite');
  console.log('PASS: 24 random bodies × old and new muscles × 4 generations stay finite.');
}

// ---- terrain: no dot sinks into the bumps ----
{
  const c = new Creature(doggo, DEMO_BRAINS.doggoBumps, { ground: course });
  let worst = 0;
  for (let i = 0; i < 12 / FIXED_DT; i++) {
    c.step();
    for (const p of c.pts) worst = Math.max(worst, course(p.x) + NODE_R - p.y);
  }
  assert.ok(worst < 1e-9, `deepest dot below the ground: ${worst}`);
  console.log(`PASS: terrain — nothing sinks into the bumps (bump-trained Doggo: ${f1(c.dist())} m).`);
}

// ---- the pre-trained brains ----
{
  const rows: string[] = [];
  for (const p of PRESETS) {
    const d = simulate(p.plan, TRAINED[p.id], 12).dist();
    const nudged = [1, 2, 3, 4].map((k) => {
      const g: Genome = { ...TRAINED[p.id], muscles: TRAINED[p.id].muscles.map((m, i) => ({ ...m, phase: m.phase + 1e-6 * Math.sin(k * 7 + i) })) };
      return simulate(p.plan, g, 12).dist();
    });
    assert.ok(d > 8, `${p.id} walks (${d})`);
    assert.ok(Math.min(...nudged) > 0.7 * d, `${p.id} is robust (${nudged.map(f1)} vs ${f1(d)})`);
    rows.push(`${p.id} ${f1(d)} m`);
  }
  const hop = simulate(wiggler, DEMO_BRAINS.wigglerHop, 12);
  const crawl = simulate(wiggler, DEMO_BRAINS.wigglerGround, 12);
  assert.ok(hop.airborne() > 0.4 && crawl.airborne() < 0.1, `hop ${hop.airborne()}, crawl ${crawl.airborne()}`);
  assert.ok(crawl.groundDist > hop.groundDist + 3, `race-walk judge: crawl ${crawl.groundDist} vs hop ${hop.groundDist}`);
  const flat = simulate(doggo, DEMO_BRAINS.doggoFlat, 12);
  const flatOnCourse = simulate(doggo, DEMO_BRAINS.doggoFlat, 12, { ground: course });
  const bumpsOnCourse = simulate(doggo, DEMO_BRAINS.doggoBumps, 12, { ground: course });
  assert.ok(flat.dist() > 12 && flatOnCourse.dist() < 3 && bumpsOnCourse.dist() > 8, 'practice-world demo');
  console.log(
    `PASS: brains — ${rows.join(', ')}; worm hop ${(100 * hop.airborne()).toFixed(0)} % airborne (judged ${f1(hop.groundDist)} m) vs crawl ${(100 * crawl.airborne()).toFixed(0)} % (${f1(crawl.groundDist)} m); ` +
      `flat-trained Doggo ${f1(flat.dist())} m on flat, ${f1(flatOnCourse.dist())} m on the course; bump-trained ${f1(bumpsOnCourse.dist())} m.`,
  );
}

// ---- grab and fling: the throw speed is capped ----
{
  const c = new Creature(doggo, TRAINED.Doggo, { x: 3 });
  c.pin = { i: 0, x: 3, y: 2 };
  for (let i = 0; i < 30; i++) c.step();
  c.release(200, 50);
  const p = c.pts[0];
  const v = Math.hypot(p.x - p.px, p.y - p.py) / FIXED_DT;
  assert.ok(v <= 12 + 1e-6, `release speed ${v}`);
  for (let i = 0; i < 600; i++) c.step();
  assert.ok(c.finite(), 'a flung creature stays finite');
  console.log(`PASS: grab — held at the pointer, thrown at ${f1(v)} m/s at most.`);
}

// ---- learning: picking parents by hand (round 1) ----
{
  const season = (plan: BodyPlan, pop: Genome[]) => pop.map((g) => simulate(plan, g, 4).dist());
  const runs = (policy: 'farthest' | 'random') => {
    const first: number[] = [], last: number[] = [];
    for (let r = 0; r < 12; r++) {
      const rand = seededRandom(100 + r);
      let pop = Array.from({ length: 6 }, () => randomGenome(doggo, rand));
      for (let k = 0; k < 10; k++) {
        const d = season(doggo, pop);
        if (k === 0) first.push(Math.max(...d));
        if (k === 9) last.push(Math.max(...d));
        const i = policy === 'farthest' ? d.indexOf(Math.max(...d)) : Math.floor(rand() * 6);
        pop = babiesOf(pop[i], 6, rand);
      }
    }
    return { first: median(first), last: median(last) };
  };
  const far = runs('farthest');
  const rnd = runs('random');
  assert.ok(far.last > 1.4 * far.first, `picking the farthest learns: ${f1(far.first)} → ${f1(far.last)}`);
  assert.ok(far.last > 1.5 * rnd.last, `picking at random doesn't: ${f1(rnd.first)} → ${f1(rnd.last)}`);
  console.log(`PASS: hand-picking — farthest ${f1(far.first)} → ${f1(far.last)} m in 10 picks; random ${f1(rnd.first)} → ${f1(rnd.last)} m.`);
}

// ---- rewards: race-walking (round 2) and practice worlds (round 3) ----
{
  const train = (plan: BodyPlan, reward: Reward, gens: number, seed: number, bumps: boolean) => {
    const evo = new Evolution(plan, {
      reward,
      rand: seededRandom(seed),
      groundFor: bumps ? (gen) => bumpyGround(seed * 1000 + gen, 0.2) : undefined,
    });
    evo.runGenerations(gens);
    return evo.best!.genome;
  };
  const far = [0, 1, 2, 3, 4, 5].map((r) => simulate(wiggler, train(wiggler, 'far', 25, 300 + r, false), 12));
  const grd = [0, 1, 2, 3, 4, 5].map((r) => simulate(wiggler, train(wiggler, 'ground', 25, 400 + r, false), 12));
  const air = (cs: Creature[]) => median(cs.map((c) => c.airborne()));
  const judged = (cs: Creature[]) => median(cs.map((c) => c.groundDist));
  assert.ok(air(far) > air(grd) + 0.25, `airborne: far ${air(far)}, ground ${air(grd)}`);
  assert.ok(judged(grd) > judged(far), `judged: far ${judged(far)}, ground ${judged(grd)}`);
  console.log(`PASS: race-walk — rewarded for distance the worm flies ${(100 * air(far)).toFixed(0)} % (judged ${f1(judged(far))} m); with a foot on the ground ${(100 * air(grd)).toFixed(0)} % (${f1(judged(grd))} m).`);

  // Round 3 as played: 40 generations, then the steadiest of the best five on fresh practice worlds.
  const wild = (seed: number, bumps: boolean) => {
    const evo = new Evolution(doggo, { rand: seededRandom(seed), groundFor: bumps ? (gen) => bumpyGround(seed * 1000 + gen, 0.2) : undefined });
    evo.runGenerations(40);
    const worlds = bumps ? [1, 2, 3].map((k) => bumpyGround(seed * 7919 + k, 0.2)) : [FLAT];
    return simulate(doggo, steadiest(evo, worlds), 12, { ground: course }).dist();
  };
  const flat = [0, 1, 2, 3, 4, 5, 6, 7].map((r) => wild(500 + r, false));
  const bumpy = [0, 1, 2, 3, 4, 5, 6, 7].map((r) => wild(600 + r, true));
  assert.ok(median(bumpy) > 2 * Math.max(1, median(flat)), `course: flat ${flat.map(f1)}, bumps ${bumpy.map(f1)}`);
  assert.ok(bumpy.filter((d) => d < 3).length <= 1, `bump-trained Doggos stuck: ${bumpy.map(f1)}`);
  console.log(`PASS: practice worlds — on the course, flat-trained Doggos ${flat.map(f1).join(' ')} m; bump-trained ${bumpy.map(f1).join(' ')} m.`);
}

// ---- cost ----
{
  const cs = PRESETS.map((p) => new Creature(p.plan, TRAINED[p.id]));
  const t0 = performance.now();
  for (let i = 0; i < 2400; i++) for (const c of cs) c.step();
  const us = ((performance.now() - t0) * 1000) / (2400 * cs.length);
  assert.ok(us < 20, `${us} µs per creature-step`);
  console.log(`PASS: cost — ${us.toFixed(2)} µs per creature per step.`);
}

// ---- brains that feel (phase C) ----
{
  // Silent reflexes change nothing; a brain with senses survives being stored as a crown (JSON).
  for (const p of PRESETS) {
    const plain = simulate(p.plan, TRAINED[p.id], 12).dist();
    const silent = simulate(p.plan, withReflexes(TRAINED[p.id], p.plan, seededRandom(3)), 12).dist();
    assert.equal(silent, plain, `${p.id}: silent reflexes change nothing`);
  }
  const stored = JSON.parse(JSON.stringify(DEMO_BRAINS.doggoFeel)) as Genome;
  assert.equal(simulate(doggo, stored, 12).dist(), simulate(doggo, DEMO_BRAINS.doggoFeel, 12).dist(), 'a feeling brain survives JSON');
  // The push test of the delve's chapter: the same 20 shove sequences for all three Doggos.
  const tests = Array.from({ length: 20 }, (_, k) => randomShoves(12, seededRandom(9000 + k)));
  const flips = (g: Genome) => tests.filter((q) => simulate(doggo, g, 12, {}, q).turns() > 0.4).length;
  const calm = flips(TRAINED.Doggo);
  const shoved = flips(DEMO_BRAINS.doggoShoved);
  const feel = flips(DEMO_BRAINS.doggoFeel);
  assert.ok(calm > shoved && shoved > feel && feel <= 3, `on its back: calm ${calm}, shoved ${shoved}, senses ${feel}`);
  // Senses on and off in a running evolution; shoves reach every creature.
  const evo = new Evolution(doggo, { start: TRAINED.Doggo, rand: seededRandom(11) });
  evo.setBrain('feel');
  assert.equal(evo.brain(), 'feel');
  evo.setShoves(true);
  evo.runGenerations(2);
  evo.advance(4, 1000); // mid-generation: a shove has come (the first by 2.5 s)
  assert.ok(evo.lastShove > 0 && evo.creatures.every((c) => c.finite()), 'shoved practice runs');
  evo.setBrain('rhythm');
  assert.ok(evo.genomes.every((g) => !g.net), 'senses off');
  console.log(`PASS: brains that feel — silent reflexes change nothing; in 20 shoved runs on its back: calm ${calm}, practised with shoves ${shoved}, with senses ${feel}.`);
}
