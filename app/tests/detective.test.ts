// Headless checks and calibration for Weather Detective: the GP does its
// algebra right, and the three cases play the way their cards say.
import assert from 'node:assert/strict';
import { GP, Dreamer, matern, type Hyper } from '../src/games/detective/gp.ts';
import { HYPER, lonLatToKm, rng, world } from '../src/games/detective/world.ts';

/** Six well-spread spots: Groningen, Zwolle, Amsterdam, Rotterdam, Eindhoven, Arnhem. */
const SPREAD: [number, number][] = [[6.57, 53.22], [6.09, 52.51], [4.9, 52.37], [4.48, 51.92], [5.47, 51.44], [5.9, 51.98]];
import {
  ACCUSATIONS, CASES, HOTTEST_THERMOMETERS, LIARS, MAP_THERMOMETERS,
  caseTruth, computerHottest, computerLiars, computerMap, hottestPoints, landStats,
  liarPoints, liarStations, makeStation, mapError, mapGuess, mapPoints, newGP, randomLand,
  type Station,
} from '../src/games/detective/cases.ts';

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const fmt = (x: number) => x.toFixed(2);

// --- GP algebra -------------------------------------------------------------

{
  // One pure-smooth-part station: textbook 1-point GP.
  const h: Hyper = { mean: 10, c: 0, au: 0, aw: 0, theta: 2, ell: 30, sdOfficial: 0.5, sdHome: 1, bias: 0 };
  const grid = { nx: 2, ny: 1, dx: 1, dy: 1, n: 2, x: new Float32Array([0, 30]), y: new Float32Array([0, 0]), u: new Float32Array(2), w: new Float32Array(2), land: new Uint8Array([1, 1]) };
  const gp = new GP(h, [grid]);
  gp.setObs([{ x: 0, y: 0, value: 14, u: 0, w: 0, home: false }]);
  const m = new Float32Array(2), s = new Float32Array(2);
  gp.meanGrid(0, m);
  gp.sdGrid(0, s);
  const k0 = 4 / (4 + 0.25);
  assert.ok(Math.abs(m[0] - (10 + 4 * k0)) < 1e-4, 'mean at the station');
  const e = matern(1);
  assert.ok(Math.abs(m[1] - (10 + 4 * e * k0)) < 1e-4, 'mean one length scale away');
  assert.ok(Math.abs(s[0] - Math.sqrt(4 - 16 / 4.25)) < 1e-4, 'sd at the station');
  assert.ok(Math.abs(s[1] - Math.sqrt(4 - (4 * e) ** 2 / 4.25)) < 1e-4, 'sd one length scale away');
  const p = gp.predict(30, 0, 0, 0);
  assert.ok(Math.abs(p.mean - m[1]) < 1e-4 && Math.abs(p.sd - s[1]) < 1e-4, 'predict matches the grid');
}

{
  // Dreams: over many times, samples average to the posterior mean and spread.
  const { coarse } = world();
  const h = HYPER.seabreeze;
  const gp = new GP(h, [coarse]);
  const r = rng(3);
  const truth = world().days.seabreeze.t;
  const obs: Station[] = [];
  for (let i = 0; i < 8; i++) {
    const p = randomLand(r);
    obs.push(makeStation(truth, p.x, p.y, i < 4 ? 'official' : 'home', r));
  }
  gp.setObs(obs);
  const m = new Float32Array(coarse.n), s = new Float32Array(coarse.n);
  gp.meanGrid(0, m);
  gp.sdGrid(0, s);
  let sum = 0, sum2 = 0, count = 0;
  const probe = [...Array(coarse.n).keys()].filter((k) => coarse.land[k]).filter((_, i) => i % 97 === 0);
  const acc = probe.map(() => ({ s: 0, s2: 0 }));
  // Independent dreamers (different seeds) at a few times each.
  for (let d = 0; d < 60; d++) {
    const dreamer = new Dreamer(gp, 0, rng(100 + d), 150);
    const out = new Float32Array(coarse.n);
    dreamer.sample(d * 3.7, out);
    probe.forEach((k, i) => {
      acc[i].s += out[k];
      acc[i].s2 += out[k] * out[k];
    });
  }
  let errMean = 0, ratio = 0;
  probe.forEach((k, i) => {
    const mu = acc[i].s / 60, v = acc[i].s2 / 60 - mu * mu;
    errMean += Math.abs(mu - m[k]) / Math.max(s[k], 0.2);
    ratio += Math.sqrt(Math.max(v, 0)) / Math.max(s[k], 1e-3);
    sum += mu; sum2 += v; count++;
  });
  errMean /= count;
  ratio /= count;
  console.log(`dreams: mean off by ${fmt(errMean)} sd, spread ratio ${fmt(ratio)} (want ~0, ~1)`);
  assert.ok(errMean < 0.35, 'dream samples average to the posterior mean');
  assert.ok(ratio > 0.75 && ratio < 1.25, 'dream samples spread like the posterior');
}

{
  // Bias: the model learns the home stations' warm offset.
  const truth = world().days.newyear.t;
  const r = rng(9);
  const obs: Station[] = [];
  for (let i = 0; i < 84; i++) {
    const p = randomLand(r, i >= 30);
    obs.push(makeStation(truth, p.x, p.y, i < 30 ? 'official' : 'home', r));
  }
  const gp = new GP(HYPER.newyear, [world().half]);
  gp.setObs(obs);
  const b = gp.biasEstimate();
  console.log(`bias learned from 54 home + 30 official: ${fmt(b)} °C (true 1.5)`);
  assert.ok(b > 1 && b < 2.2, 'learns the warm bias');
}

// --- timing -----------------------------------------------------------------

{
  const { half, coarse } = world();
  const truth = world().days.heatwave.t;
  const m = new Float32Array(half.n), s = new Float32Array(coarse.n), d = new Float32Array(coarse.n);
  for (const n of [20, 60, 150]) {
    const r = rng(n);
    const obs: Station[] = [];
    for (let i = 0; i < n; i++) {
      const p = randomLand(r, true);
      obs.push(makeStation(truth, p.x, p.y, i % 3 ? 'home' : 'official', r));
    }
    const gp = new GP(HYPER.heatwave, [half, coarse]);
    gp.setObs(obs);
    const dreamer = new Dreamer(gp, 1, rng(1));
    const t0 = performance.now();
    obs[0] = { ...obs[0], x: obs[0].x + 1 };
    gp.setObs(obs);
    const t1 = performance.now();
    gp.meanGrid(0, m);
    const t2 = performance.now();
    gp.sdGrid(1, s, coarse.land);
    const t3 = performance.now();
    dreamer.sample(1, d);
    const t4 = performance.now();
    console.log(`N=${n}: refit after a move ${fmt(t1 - t0)} ms, mean ${fmt(t2 - t1)} ms, spread ${fmt(t3 - t2)} ms, dream ${fmt(t4 - t3)} ms`);
  }
}

// --- case 1: the hottest place ------------------------------------------------

const SEEDS = [...Array(24).keys()].map((i) => i + 1);
{
  const def = CASES[0];
  const random: number[] = [], computer: number[] = [], gaps: number[] = [], domeIsMax: number[] = [];
  for (const seed of SEEDS) {
    const { truth, dome } = caseTruth(def, seed);
    const r = rng(seed * 101);
    const rand: Station[] = [];
    for (let i = 0; i < HOTTEST_THERMOMETERS; i++) {
      const p = randomLand(r);
      rand.push(makeStation(truth, p.x, p.y, 'official', r));
    }
    random.push(hottestPoints(truth, rand).points);
    const cpu = hottestPoints(truth, computerHottest(def, truth, seed));
    computer.push(cpu.points);
    gaps.push(cpu.max - cpu.best);
    const st = landStats(truth);
    const { half } = world();
    domeIsMax.push(Math.hypot(half.x[st.maxAt] - dome!.x, half.y[st.maxAt] - dome!.y) < 25 ? 1 : 0);
  }
  console.log(`hottest: random ${fmt(mean(random))} pts, computer ${fmt(mean(computer))} pts (gap ${fmt(mean(gaps))} °C), max inside the dome in ${fmt(100 * mean(domeIsMax))} % of games`);
  assert.ok(mean(domeIsMax) > 0.75, 'the heat dome is usually the hottest place');
  assert.ok(mean(computer) > mean(random) + 15, 'Bayesian optimisation beats random');
  assert.ok(mean(computer) < 92, 'the computer can be beaten');
}

// --- case 2: the weather map ---------------------------------------------------

{
  const def = CASES[1];
  const results: Record<string, number[]> = { clump: [], random: [], spread: [], computer: [] };
  for (const seed of SEEDS) {
    const { truth } = caseTruth(def, seed);
    const r = rng(seed * 7);
    const score = (stations: Station[]) => {
      const gp = newGP(def);
      gp.setObs(stations);
      const { mae, flat } = mapError(truth, mapGuess(gp));
      return mapPoints(mae, flat);
    };
    const clump: Station[] = [];
    const c0 = randomLand(r);
    for (let i = 0; i < MAP_THERMOMETERS; i++) clump.push(makeStation(truth, c0.x + 10 * (r() - 0.5), c0.y + 10 * (r() - 0.5), 'official', r));
    results.clump.push(score(clump));
    const rand: Station[] = [];
    for (let i = 0; i < MAP_THERMOMETERS; i++) {
      const p = randomLand(r);
      rand.push(makeStation(truth, p.x, p.y, 'official', r));
    }
    results.random.push(score(rand));
    // How a thoughtful kid might spread them: one per region of the country.
    const spread = SPREAD.map(([lon, lat]) => {
      const p = lonLatToKm(lon, lat);
      return makeStation(truth, p.x, p.y, 'official', r);
    });
    results.spread.push(score(spread));
    results.computer.push(score(computerMap(def, truth, seed)));
  }
  console.log('map points:', Object.entries(results).map(([k, v]) => `${k} ${fmt(mean(v))}`).join(', '));
  assert.ok(mean(results.spread) > mean(results.clump) + 20, 'spreading out beats a clump');
  assert.ok(mean(results.computer) > mean(results.random), 'the computer beats random');
  assert.ok(mean(results.computer) < 90, 'the computer can be beaten');
}

// --- case 3: the lying stations --------------------------------------------------

{
  const def = CASES[2];
  const caught: number[] = [], wrong: number[] = [], points: number[] = [];
  for (const seed of SEEDS) {
    const { truth } = caseTruth(def, seed);
    const stations = liarStations(truth, seed);
    assert.equal(stations.filter((s) => s.liar).length, LIARS);
    const judged = computerLiars(def, stations);
    const p = liarPoints(judged);
    caught.push(p.caught);
    wrong.push(p.wrong);
    points.push(p.points);
    assert.ok(judged.filter((s) => s.ignored).length <= ACCUSATIONS);
  }
  console.log(`liars: computer catches ${fmt(mean(caught))}/${LIARS}, wrongly accuses ${fmt(mean(wrong))}, ${fmt(mean(points))} pts`);
  assert.ok(mean(caught) > 4, 'the leave-one-out check finds most liars');
}

console.log('detective: all checks passed');
