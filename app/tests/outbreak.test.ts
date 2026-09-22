// Headless calibration of Outbreak!: the challenge rounds must play the way
// the game's cards and tips say. Every number here is a mean over seeded runs,
// driven through the same RoundRun the game uses.
import assert from 'node:assert/strict';
import { OutbreakSim, TOY_DISEASE, type Age } from '../src/games/outbreak/sim.ts';
import { HEADLESS_DT, ROUNDS, RoundRun, type Round } from '../src/games/outbreak/rounds.ts';

interface Policy {
  vaccinate?: Age;
  /** Close school and market once this many people are sick. */
  closeAt?: number;
}

function play(round: Round, seed: number, policy: Policy): number {
  const run = new RoundRun(round, new OutbreakSim(seed, round.disease));
  while (!run.finished) {
    if (policy.vaccinate) while (run.batchesReady > 0) run.vaccinate(policy.vaccinate);
    if (policy.closeAt !== undefined && run.closureLeft > 0 && run.sim.counts.i >= policy.closeAt) {
      if (run.sim.schoolOpen) run.toggle(0);
      if (run.sim.marketOpen) run.toggle(1);
    }
    run.step(HEADLESS_DT);
  }
  return run.sim.counts.d;
}

const RUNS = 16;
function deaths(r: number, policy: Policy): number {
  let sum = 0;
  for (let k = 0; k < RUNS; k++) sum += play(ROUNDS[r], 9000 + k, policy);
  return sum / RUNS;
}

// Reproducible from a seed, and a clone continues identically to its original
// only when given the same stream: different seeds give different futures.
{
  const a = new OutbreakSim(42);
  const b = new OutbreakSim(42);
  a.seedCases(3);
  b.seedCases(3);
  for (let k = 0; k < 600; k++) {
    a.step(HEADLESS_DT);
    b.step(HEADLESS_DT);
  }
  assert.deepEqual(a.counts, b.counts, 'same seed, same epidemic');
  const c1 = a.clone(7);
  const c2 = a.clone(8);
  for (let k = 0; k < 600; k++) {
    c1.step(HEADLESS_DT);
    c2.step(HEADLESS_DT);
  }
  assert.notDeepEqual(c1.agents.map((x) => x.state), c2.agents.map((x) => x.state));
  assert.equal(a.agents.length, c1.agents.length);
}

// Free play without deaths: serious cases still go to hospital, nobody dies.
{
  const s = new OutbreakSim(5, TOY_DISEASE);
  s.deaths = false;
  s.seedCases(3);
  let beds = 0;
  for (let k = 0; k < 60 * 30; k++) {
    s.step(HEADLESS_DT);
    beds = Math.max(beds, s.counts.beds);
  }
  assert.equal(s.counts.d, 0, 'no deaths in free play by default');
  assert.ok(beds > 0, 'hospital is used');
  assert.ok(s.counts.r > 250, `free-play outbreak takes off (${s.counts.r} recovered)`);
}

for (let r = 0; r < ROUNDS.length; r++) {
  const id = ROUNDS[r].id;
  const nothing = deaths(r, {});
  const elders = deaths(r, { vaccinate: 'elder' });
  const early = deaths(r, { closeAt: 10 });
  const mid = deaths(r, { closeAt: 40 });
  console.log(
    `${id}: nothing ${nothing.toFixed(1)}, vaccinate grandparents ${elders.toFixed(1)}, close at 10 sick ${early.toFixed(1)}, at 40 sick ${mid.toFixed(1)}`,
  );
  // Enough deaths without intervention for "lives saved" to mean something.
  assert.ok(nothing >= 9, `${id}: do-nothing deaths ${nothing}`);
  // Every tool helps on its own.
  // (The unknown virus's vaccine comes late: alone it helps only a little.)
  const vaccineGain = id === 'unknown' ? 0.97 : 0.85;
  assert.ok(elders < nothing * vaccineGain, `${id}: vaccinating grandparents helps`);
  assert.ok(Math.min(early, mid) < nothing * 0.8, `${id}: closing helps`);
  // Each round's tip is true.
  if (id === 'flu') assert.ok(elders < nothing * 0.5, 'flu: protecting grandparents halves deaths');
  if (id === 'fever') assert.ok(mid < early, 'fever: closing as the wave builds beats closing at once');
  if (id === 'unknown') {
    const both = deaths(r, { vaccinate: 'elder', closeAt: 10 });
    const late = deaths(r, { vaccinate: 'elder', closeAt: 40 });
    console.log(`unknown: vaccinate + close at 10 ${both.toFixed(1)}, vaccinate + close at 40 ${late.toFixed(1)}`);
    assert.ok(both < late * 0.7, 'unknown: closing early buys time for the vaccine');
  }
}
console.log('outbreak: all checks passed');
