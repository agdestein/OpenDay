// Headless calibration of Outbreak!: the challenge rounds must play the way
// the game's cards and tips say. Every number here is a mean over seeded runs,
// driven through the same RoundRun the game uses.
import assert from 'node:assert/strict';
import { OutbreakSim, TOY_DISEASE, type Age } from '../src/games/outbreak/sim.ts';
import { HEADLESS_DT, ROUNDS, RoundRun, forecast, type Round } from '../src/games/outbreak/rounds.ts';

interface Policy {
  vaccinate?: Age;
  /** Close school and market once this many people are sick. */
  closeAt?: number;
  /** Use every test on a random visibly sick person. */
  isolate?: boolean;
}

function play(round: Round, seed: number, policy: Policy): number {
  const run = new RoundRun(round, new OutbreakSim(seed, round.disease));
  while (!run.finished) {
    if (policy.vaccinate) while (run.batchesReady > 0) run.vaccinate(policy.vaccinate);
    if (policy.closeAt !== undefined && run.closureLeft > 0 && run.sim.counts.i >= policy.closeAt) {
      if (run.sim.schoolOpen) run.toggle(0);
      if (run.sim.marketOpen) run.toggle(1);
    }
    if (policy.isolate && run.testsReady > 0) {
      const sim = run.sim;
      const pool = sim.agents.filter((a) => a.state === 'I' && a.bed < 0 && !a.isolated && !sim.isHidden(a));
      if (pool.length > 0) run.isolate(pool[Math.floor(sim.rand() * pool.length)]);
    }
    run.step(HEADLESS_DT);
  }
  return run.sim.counts.d;
}

const RUNS = 24;
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

// Hidden cases: contagious before they show, and they cannot be isolated.
{
  const run = new RoundRun(ROUNDS[2], new OutbreakSim(3, ROUNDS[2].disease));
  let sawHidden = false;
  while (run.sim.day < 20) {
    run.step(HEADLESS_DT);
    const hidden = run.sim.agents.find((a) => run.sim.isHidden(a));
    if (hidden) {
      sawHidden = true;
      assert.equal(run.sim.isolate(hidden), false, 'hidden cases cannot be isolated');
    }
    assert.ok(run.testsReady <= ROUNDS[2].tests.max, 'tests are capped');
  }
  assert.ok(sawHidden, 'the unknown virus has hidden cases');
  const copy = run.clone(1);
  assert.equal(copy.closureLeft, run.closureLeft);
  assert.equal(copy.testsReady, run.testsReady);
  assert.equal(copy.batchesArrived, run.batchesArrived);
  assert.equal(copy.sim.counts.i, run.sim.counts.i);
}

// Asking the model: in the middle of the flu, closing now beats carrying on.
{
  let same = 0;
  let close = 0;
  for (let k = 0; k < 6; k++) {
    const run = new RoundRun(ROUNDS[0], new OutbreakSim(500 + k, ROUNDS[0].disease));
    while (run.sim.counts.i < 40 && run.sim.day < 40) run.step(HEADLESS_DT);
    const a = forecast(run, 'same', 6);
    const b = forecast(run, 'close', 6);
    a.work(Infinity);
    b.work(Infinity);
    const peak = (f: typeof a) =>
      f.runs.reduce((m, r) => m + Math.max(...r.sim.history.map((s) => s.i)), 0) / f.runs.length;
    same += peak(a);
    close += peak(b);
    for (const r of b.runs) assert.ok(r.sim.day <= run.sim.day + 31, 'forecast stops at its horizon');
  }
  console.log(`forecast peaks: carry on ${(same / 6).toFixed(0)}, close now ${(close / 6).toFixed(0)}`);
  assert.ok(close < same * 0.85, 'closing now lowers the forecast peak');
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
  const isolate = deaths(r, { isolate: true });
  console.log(
    `${id}: nothing ${nothing.toFixed(1)}, vaccinate grandparents ${elders.toFixed(1)}, close at 10 sick ${early.toFixed(1)}, at 40 sick ${mid.toFixed(1)}, isolate ${isolate.toFixed(1)}`,
  );
  // Enough deaths without intervention for "lives saved" to mean something.
  assert.ok(nothing >= 7, `${id}: do-nothing deaths ${nothing}`);
  // Every tool helps on its own.
  assert.ok(elders < nothing * 0.85, `${id}: vaccinating grandparents helps`);
  // Closing pays off against the fast fever and the new virus; against the
  // flu, protecting grandparents and isolating the sick matter far more.
  if (id !== 'flu') assert.ok(Math.min(early, mid) < nothing * 0.9, `${id}: closing helps`);
  assert.ok(isolate < nothing * 0.9, `${id}: isolating helps`);
  // Each round's tip is true.
  if (id === 'flu') {
    assert.ok(elders < nothing * 0.5, 'flu: protecting grandparents halves deaths');
    assert.ok(isolate < nothing * 0.6, 'flu: test-and-isolate keeps up with a slow disease');
  }
  if (id === 'fever') {
    const late = deaths(r, { closeAt: 90 });
    console.log(`fever: close at 90 sick ${late.toFixed(1)}`);
    assert.ok(mid < late * 0.8, 'fever: closing before the wave is big beats closing late');
  }
  if (id === 'unknown') {
    const both = deaths(r, { vaccinate: 'elder', closeAt: 10 });
    const late = deaths(r, { vaccinate: 'elder', closeAt: 40 });
    console.log(`unknown: vaccinate + close at 10 ${both.toFixed(1)}, vaccinate + close at 40 ${late.toFixed(1)}`);
    assert.ok(both < late * 0.7, 'unknown: closing early buys time for the vaccine');
  }
}
console.log('outbreak: all checks passed');
