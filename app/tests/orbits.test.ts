import { World, forecast, KINDS, SUN_R, TICK, type Kind } from '../src/games/orbits/physics.ts';
import { Defense, DEFENSE } from '../src/games/orbits/defense.ts';
import { ZoneSim, ZONE, CPU_ZONE } from '../src/games/orbits/zone.ts';
import { SlingSim, SLING, candidates, bestRoute, CPU_SLING } from '../src/games/orbits/sling.ts';
import { gravitySheet } from '../src/games/orbits/scene.ts';
import { preset, PRESET_ORDER } from '../src/games/orbits/presets.ts';
import assert from 'node:assert/strict';

// ---- the toy's N-body world, on a 1280×720 screen like the game's ----
const W = 1280, H = 720, M = 720, u = 1, GM = 25 * M * M;
function system(kinds: [Kind, number, number][] = [['pebble', 0.11, 0.3], ['planet', 0.2, 2.1], ['giant', 0.44, 4.4]]): World {
  const w = new World(W / 2, H / 2, u, GM);
  w.reach = 3 * W;
  w.add({ kind: 'star', sun: true, x: W / 2, y: H / 2, vx: 0, vy: 0, gm: GM, r: SUN_R, hue: 45 });
  for (const [kind, f, angle] of kinds) {
    const r = f * M, v = Math.sqrt(GM / r);
    w.add({ kind, x: W / 2 + r * Math.cos(angle), y: H / 2 + r * Math.sin(angle), vx: -v * Math.sin(angle), vy: v * Math.cos(angle), gm: KINDS[kind].mass * GM, r: KINDS[kind].r * u, hue: 0 });
  }
  return w;
}
const run = (w: World, seconds: number) => { for (let i = 0; i < Math.round(seconds / TICK); i++) w.step(); };

// The game's opening system lives on: nobody merges or leaves for a minute.
{
  const w = system();
  run(w, 180);
  assert.equal(w.bodies.length, 4, 'the seeded planets all survive three minutes');
  const far = Math.max(...w.bodies.map((b) => Math.hypot(b.x - W / 2, b.y - H / 2)));
  assert.ok(far < 0.5 * H, `seeded system stays on screen (farthest ${far.toFixed(0)} px)`);
  console.log(`PASS: seeded system of ${w.bodies.length} bodies runs three minutes on screen (farthest ${far.toFixed(0)} px from centre).`);
}

// The forecast is exact: throwing the forecast body gives the very same path.
{
  const w = system();
  run(w, 1);
  const throwIt = { kind: 'planet' as Kind, x: 300, y: 200, vx: 180, vy: -240, gm: KINDS.planet.mass * GM, r: KINDS.planet.r, hue: 0 };
  const copy = w.clone();
  const fb = copy.add({ ...throwIt, id: -1 });
  const steps = 1440;
  const f = forecast(copy, fb.id, steps, 1, 2 * W);
  const real = w.add(throwIt);
  let worst = 0;
  for (let i = 1; i < f.pts.length; i++) {
    w.step();
    const b = w.bodies.find((x) => x.id === real.id);
    if (!b) break;
    worst = Math.max(worst, Math.hypot(b.x - f.pts[i].x, b.y - f.pts[i].y));
  }
  assert.equal(worst, 0, `forecast and real throw differ by ${worst} px`);
  // A throw straight at a planet: the forecast names the planet and its path to the meeting.
  {
    const w2 = system([['planet', 0.2, 0]]);
    const target = w2.bodies[1];
    const c = w2.clone();
    const b = c.add({ id: -1, kind: 'pebble', x: target.x + 60, y: target.y, vx: target.vx - 400, vy: target.vy, gm: KINDS.pebble.mass * GM, r: KINDS.pebble.r, hue: 0 });
    const f = forecast(c, b.id, 480, 6, 2 * W);
    assert.equal(f.outcome, 'merge', 'thrown at a planet, it merges');
    assert.equal(f.partner?.id, target.id, 'the forecast names who it hits');
    assert.ok((f.partner?.pts.length ?? 0) > 1, 'with that planet\'s path to the meeting');
  }
  console.log(`PASS: the forecast is the real future (${f.pts.length - 1} steps, 0 px apart; outcome ${f.outcome}).`);
}

// Everything pulls on everything: momentum is kept, merges keep mass and momentum,
// and a giant makes the Sun wobble.
{
  const w = system([['giant', 0.3, 0], ['planet', 0.2, 1]]);
  const sun = w.bodies[0];
  let wobble = 0;
  for (let i = 0; i < 240 * 10; i++) { w.step(); wobble = Math.max(wobble, Math.hypot(sun.x - W / 2, sun.y - H / 2)); }
  assert.ok(wobble > 3, `a giant wobbles the Sun (${wobble.toFixed(1)} px)`);
  // Two planets touching: one body, with mass and momentum kept (re-centring off).
  const v = new World(W / 2, H / 2, u, GM);
  v.reach = -1;
  v.add({ kind: 'planet', x: 100, y: 100, vx: 50, vy: 0, gm: 10, r: 10, hue: 0 });
  v.add({ kind: 'giant', x: 120, y: 100, vx: -20, vy: 5, gm: 30, r: 15, hue: 0 });
  const px = 10 * 50 + 30 * -20, py = 30 * 5;
  v.step();
  assert.equal(v.bodies.length, 1, 'touching bodies merge');
  const b = v.bodies[0];
  assert.ok(Math.abs(b.gm - 40) < 1e-9, 'mass kept');
  assert.ok(Math.abs(b.gm * b.vx - px) < 1e-6 && Math.abs(b.gm * b.vy - py) < 1e-6, 'momentum kept');
  assert.ok(b.r >= 15 && b.r < 26, `merged radius ${b.r}`);
  // Two massless probes that touch meet halfway (no 0/0).
  const q = new World(W / 2, H / 2, u, GM);
  q.reach = -1;
  q.add({ kind: 'pebble', x: 100, y: 100, vx: 10, vy: 0, gm: 0, r: 3, hue: 0 });
  q.add({ kind: 'pebble', x: 104, y: 100, vx: -10, vy: 0, gm: 0, r: 3, hue: 0 });
  q.step();
  assert.ok(q.bodies.length === 1 && q.bodies.every((p) => Number.isFinite(p.x + p.y + p.vx + p.vy)), 'massless merge stays finite');
  console.log(`PASS: a giant wobbles the Sun by ${wobble.toFixed(1)} px; touching planets merge with mass and momentum kept.`);
}

// A second star turns the system wild but the guards keep it finite.
{
  const w = system();
  w.add({ kind: 'star', x: W / 2 + 250, y: H / 2, vx: 0, vy: 300, gm: KINDS.star.mass * GM, r: KINDS.star.r, hue: 205 });
  run(w, 30);
  assert.ok(w.bodies.every((b) => Number.isFinite(b.x + b.y + b.vx + b.vy)), 'binary system stays finite');
  console.log(`PASS: a second star: after 30 s, ${w.bodies.length} bodies left, all finite.`);
}

// The forecast is affordable with a full screen of bodies.
{
  const kinds: [Kind, number, number][] = [];
  for (let i = 0; i < 22; i++) kinds.push([i % 5 === 0 ? 'giant' : 'pebble', 0.12 + 0.015 * i, i * 2.4]);
  const w = system(kinds);
  const t0 = performance.now();
  for (let k = 0; k < 5; k++) { const c = w.clone(); const b = c.add({ kind: 'planet', x: 200, y: 200, vx: 100, vy: 0, gm: KINDS.planet.mass * GM, r: KINDS.planet.r, hue: 0, id: -1 }); forecast(c, b.id, 2400, 6, 2 * W); }
  const ms = (performance.now() - t0) / 5;
  assert.ok(ms < 20, `forecast with 24 bodies takes ${ms.toFixed(1)} ms`);
  console.log(`PASS: a 10 s forecast with 24 bodies (the most the toy keeps) takes ${ms.toFixed(1)} ms.`);
}

// ---- Save the Earth: calibration over many asteroids ----
const spy = DEFENSE.stepsPerYear;
const runTo = (d: Defense, years: number) => { while (d.step < Math.round(years * spy)) d.advance(); };
function alongTrack(r: { vx: number; vy: number }, dv: number): [number, number] { const v = Math.hypot(r.vx, r.vy); return [dv * r.vx / v, dv * r.vy / v]; }
const DVS = [0.0002, 0.0004, 0.0007, 0.001, 0.0015, 0.002, 0.003, 0.005, 0.008, 0.012];
/** Smallest along-track push that makes the real asteroid miss, pushed `at` years in. */
function needTruth(seed: number, at: number): number {
  const d = new Defense(seed); runTo(d, at);
  for (const dv of DVS) for (const s of [1, -1]) { const [x, y] = alongTrack(d.truth, s * dv); if (!d.forecast(x, y, [d.truth])[0]) return dv; }
  return Infinity;
}
/** Smallest along-track push that clears the whole cloud (what the player sees). */
function needCloud(d: Defense): number {
  const probe = d.cloud.filter((_, i) => i % 3 === 0);
  for (const dv of DVS) for (const s of [1, -1]) { const [x, y] = alongTrack(d.truth, s * dv); if (d.forecast(x, y, probe).every((h) => !h)) return dv; }
  return Infinity;
}

const SEEDS = 16;
let rising = 0, blindClears = 0, informedCheap = 0, maxAph = 0;
const rows: string[] = [];
for (let seed = 1; seed <= SEEDS; seed++) {
  const d = new Defense(seed);
  const t = d.truth; const r = Math.hypot(t.x, t.y); const E = (t.vx ** 2 + t.vy ** 2) / 2 - 1 / r; const a = -1 / (2 * E);
  const h = t.x * t.vy - t.y * t.vx; const e = Math.sqrt(Math.max(0, 1 + 2 * E * h * h));
  maxAph = Math.max(maxAph, a * (1 + e));
  const c0 = d.chance;
  { const e = new Defense(seed); let near = Infinity; while (e.step < e.impactStep - spy / 2) { e.advance(); near = Math.min(near, e.truthMin); } assert.ok(near > DEFENSE.clearance * 0.9, `seed ${seed}: no early close pass (${near.toFixed(2)})`); }
  assert.ok(c0 > 0.02 && c0 < 0.45, `seed ${seed}: opening chance ${c0}`);
  if (needCloud(d) <= DEFENSE.dvMax) blindClears++;
  for (let k = 0; k < 3; k++) { runTo(d, k * DEFENSE.lookCooldown); assert.ok(d.look(), 'can look'); }
  if (d.chance >= 0.5) rising++;
  const informed = needCloud(d);
  if (informed <= 0.25 * DEFENSE.dvMax) informedCheap++;
  const early = needTruth(seed, 0), late = needTruth(seed, DEFENSE.years - 0.5);
  assert.ok(early <= 0.0015, `seed ${seed}: an early push of ${early} is enough`);
  assert.ok(late >= 5 * early, `seed ${seed}: late push ${late} vs early ${early}`);
  rows.push(`${seed}: ${(100 * c0).toFixed(0)}%→${(100 * d.chance).toFixed(0)}% early ${early} late ${late}`);
}
assert.ok(maxAph < 2.05, `asteroid orbits fit the view (aphelion ${maxAph.toFixed(2)})`);
assert.ok(rising >= 0.75 * SEEDS, `three looks raise the chance past 50 % in ${rising}/${SEEDS}`);
assert.ok(blindClears <= 0.25 * SEEDS, `a blind push clears the whole cloud in ${blindClears}/${SEEDS}`);
assert.ok(informedCheap >= 0.75 * SEEDS, `after looking, a quarter-power push clears the cloud in ${informedCheap}/${SEEDS}`);
console.log(`PASS: Save the Earth over ${SEEDS} asteroids: the chance rises past 50 % after three looks in ${rising}, a blind push can clear the cloud in ${blindClears}, an informed quarter-power push in ${informedCheap}; late pushes cost ≥5× early ones; aphelion ≤ ${maxAph.toFixed(2)}.`);
console.log('   ' + rows.join('\n   '));

// Strategies score as they should: nothing < blind full push < look, then a small early push.
{
  const idle = new Defense(3); while (!idle.over) idle.advance();
  assert.ok(idle.truthHit, 'left alone, the asteroid hits');
  const blind = new Defense(3); { const [x, y] = alongTrack(blind.truth, DEFENSE.dvMax); blind.push(x, y); } while (!blind.over) blind.advance();
  const smart = new Defense(3); for (let k = 0; k < 3; k++) { runTo(smart, k * DEFENSE.lookCooldown); smart.look(); }
  const dv = needCloud(smart); { const [x, y] = alongTrack(smart.truth, dv); smart.push(x, y); } while (!smart.over) smart.advance();
  assert.ok(!blind.truthHit && !smart.truthHit, 'both pushes save Earth');
  assert.ok(idle.score() < blind.score() && blind.score() < smart.score(), `scores ${idle.score()} < ${blind.score()} < ${smart.score()}`);
  console.log(`PASS: scores — do nothing ${idle.score()}, blind full push ${blind.score()}, look then push ${smart.score()}.`);
}

// The live push preview (a third of the cloud) is quick enough to run every few frames.
{
  const d = new Defense(5);
  const t0 = performance.now();
  d.forecast(0.001, 0, d.cloud.filter((_, i) => i % 3 === 0));
  const ms = performance.now() - t0;
  assert.ok(ms < 12, `preview takes ${ms.toFixed(1)} ms`);
  console.log(`PASS: the push preview flies 100 asteroids to the end in ${ms.toFixed(1)} ms.`);
}

// ---- the step lens: big steps show the difference between the recipes ----
{
  const orbit = (h: number, method: 'smart' | 'simple', seconds: number) => {
    const w = new World(W / 2, H / 2, u, GM);
    w.reach = -1; // no re-centring: compare the pure recipes
    w.h = h;
    w.method = method;
    w.add({ kind: 'star', sun: true, x: W / 2, y: H / 2, vx: 0, vy: 0, gm: GM, r: 1, hue: 45 });
    const r = 0.25 * M, v = Math.sqrt(GM / r);
    const p = w.add({ kind: 'pebble', x: W / 2 + r, y: H / 2, vx: 0, vy: v, gm: 0, r: 1, hue: 0 });
    let worst = 0;
    for (let i = 0; i < Math.round(seconds / h); i++) { w.step(); worst = Math.max(worst, Math.abs(Math.hypot(p.x - w.bodies[0].x, p.y - w.bodies[0].y) / r - 1)); }
    return worst;
  };
  const bigSmart = orbit(32 * TICK, 'smart', 20), bigSimple = orbit(32 * TICK, 'simple', 20), tinySimple = orbit(TICK, 'simple', 60), tinySmart = orbit(TICK, 'smart', 60);
  assert.ok(bigSmart < 0.05, `big smart steps keep the orbit (${bigSmart})`);
  assert.ok(bigSimple > 0.5, `big simple steps spiral out (${bigSimple})`);
  assert.ok(tinySimple > 0.05 && tinySmart < 0.005, `even tiny simple steps drift in a minute (${tinySimple} vs ${tinySmart})`);
  console.log(`PASS: step lens — at 7.5 steps/s smart steps stay within ${(100 * bigSmart).toFixed(1)} % of the circle, simple ones drift ${(100 * bigSimple).toFixed(0)} %; at 240 steps/s simple steps still drift ${(100 * tinySimple).toFixed(0)} % in a minute (smart: ${(100 * tinySmart).toFixed(2)} %).`);
}

// ---- Goldilocks: calm beats crowded ----
{
  const R = 245;
  const play = (radii: number[], seed: number, noise: number) => {
    let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const z = new ZoneSim(640, 300, R, 1, rnd() * 6.28);
    let next = 0.5, i = 0;
    while (!z.over) {
      if (z.time >= next && i < radii.length) {
        const r = radii[i++] * R, a = rnd() * 6.28, v = Math.sqrt(z.world.refGm / r) * (1 + noise * (rnd() - 0.5));
        const sun = z.sun;
        z.throw(sun.x + r * Math.cos(a), sun.y + r * Math.sin(a), -v * Math.sin(a), v * Math.cos(a));
        next += 2;
      }
      z.step(1 / 60);
    }
    return z.score;
  };
  const mean = (radii: (sd: number) => number[]) => {
    let sum = 0, n = 0;
    for (const noise of [0.03, 0.1]) for (let sd = 1; sd <= 8; sd++) { sum += play(radii(sd), sd * 7919, noise); n++; }
    return sum / n;
  };
  const rr = (k: number, seed: number) => { let q = seed * 31; return Array.from({ length: k }, () => 0.32 + 0.24 * ((q = (q * 16807) % 2147483647) / 2147483647)); };
  const one = mean(() => [0.44]), two = mean(() => [0.36, 0.5]), three = mean(() => [0.34, 0.44, 0.54]);
  const crowd = mean(() => Array(ZONE.planets).fill(0.44)), random = mean((sd) => rr(ZONE.planets, sd));
  assert.equal(one, ZONE.worth[3], 'one calm planet grows all the way to 🦕');
  assert.ok(Math.min(two, three) > Math.max(crowd, random), `calm (${two.toFixed(0)}, ${three.toFixed(0)}) beats crowded (${crowd.toFixed(0)}, ${random.toFixed(0)})`);
  console.log(`PASS: Goldilocks — one planet ${one}, two calm ${two.toFixed(0)}, three calm ${three.toFixed(0)}, six crowded ${crowd.toFixed(0)}, six at random ${random.toFixed(0)}.`);
}

// ---- Slingshot: impossible alone, possible with the giant, whenever you launch ----
{
  const R = 245;
  const tries = (sim: SlingSim) => {
    let ok = 0, n = 0;
    for (let a = 0; a < 36; a++) for (const f of [0.7, 1]) {
      n++;
      const ang = (a / 36) * 2 * Math.PI;
      if (sim.forecast(f * sim.dvMax * Math.cos(ang), f * sim.dvMax * Math.sin(ang)).outcome === 'arrive') ok++;
    }
    return ok / n;
  };
  // Earth and the giant are on rails: a whole round later, Earth is still on its orbit.
  const calm = new SlingSim(640, 300, R, 1, 0.5, 2);
  while (calm.time < SLING.seconds) calm.step(1 / 60);
  const e = calm.earth!, sun = calm.sun;
  assert.ok(Math.abs(Math.hypot(e.x - sun.x, e.y - sun.y) - SLING.earthAt * R) < 1e-6, 'Earth stays on its orbit through the round');
  const alone = new SlingSim(640, 300, R, 1, 0, 0);
  alone.world.remove(alone.giant!);
  assert.equal(tries(alone), 0, 'no probe reaches the ring without the giant');
  // Any moment of the round: some launch works within a couple of seconds of waiting.
  let worstWait = 0;
  const rates: string[] = [];
  for (let k = 0; k < 8; k++) {
    const sim = new SlingSim(640, 300, R, 1, 0.3 * k, 2.1 * k);
    let waited = 0, rate = tries(sim);
    rates.push(`${(100 * rate).toFixed(0)}%`);
    while (rate === 0 && waited < 5) { for (let i = 0; i < 15; i++) sim.step(1 / 60); waited += 0.25; rate = tries(sim); }
    assert.ok(rate > 0, `setup ${k}: some launch arrives within 5 s of waiting`);
    worstWait = Math.max(worstWait, waited);
  }
  // A probe launched along its forecast really arrives, and scores.
  const sim = new SlingSim(640, 300, R, 1, 0.3, 2.1);
  let best: [number, number] | null = null;
  for (let a = 0; a < 72 && !best; a++) for (const f of [1, 0.85, 0.7]) { const ang = (a / 72) * 2 * Math.PI; const v: [number, number] = [f * sim.dvMax * Math.cos(ang), f * sim.dvMax * Math.sin(ang)]; if (sim.forecast(...v).outcome === 'arrive') { best = v; break; } }
  if (!best) { for (let i = 0; i < 120; i++) sim.step(1 / 60); }
  assert.ok(best, 'found a launch that arrives');
  sim.launch(...best!);
  while (sim.probes.size > 0) sim.step(1 / 60);
  assert.equal(sim.arrived, 1, 'the forecast arrival really arrives');
  // A probe still flying when time is up gets to finish its trip.
  const late = new SlingSim(640, 300, R, 1, 0.3, 2.1);
  while (late.time < SLING.seconds - 0.05) late.step(1 / 60);
  let lateShot: [number, number] | null = null;
  for (let a = 0; a < 144 && !lateShot; a++) for (const f of [1, 0.85, 0.7]) { const ang = (a / 144) * 2 * Math.PI; const v: [number, number] = [f * late.dvMax * Math.cos(ang), f * late.dvMax * Math.sin(ang)]; if (late.forecast(...v).outcome === 'arrive') { lateShot = v; break; } }
  assert.ok(lateShot, 'found a last-second launch that arrives');
  assert.ok(late.launch(...lateShot!), 'a last-second launch');
  while (!late.over) late.step(1 / 60);
  assert.equal(late.arrived, 1, 'a probe in flight at the buzzer still arrives');
  console.log(`PASS: Slingshot — no direct shot reaches the ring; with the giant ${rates.join(' ')} of launches arrive (longest wait ${worstWait.toFixed(2)} s); a forecast arrival arrives (${sim.score} points), also when launched at the buzzer.`);
}

// ---- the gravity view never folds: the sheet's local stretch stays positive ----
{
  const configs: [string, [Kind, number, number][], boolean][] = [
    ['Sun and three planets', [['pebble', 0.11, 0.3], ['planet', 0.2, 2.1], ['giant', 0.44, 4.4]], false],
    ['two giants side by side', [['giant', 0.3, 0], ['giant', 0.33, 0.12]], false],
    ['a second star next to the Sun', [['planet', 0.2, 1]], true],
  ];
  const kinds: [Kind, number, number][] = [];
  for (let i = 0; i < 23; i++) kinds.push([(['pebble', 'planet', 'giant'] as Kind[])[i % 3], 0.1 + 0.015 * i, i * 2.4]);
  configs.push(['a full sky of 24 bodies', kinds, false]);
  for (const [name, bodies, star] of configs) {
    const w = system(bodies);
    if (star) w.add({ kind: 'star', x: W / 2 + 60, y: H / 2 + 10, vx: 0, vy: 0, gm: KINDS.star.mass * GM, r: KINDS.star.r, hue: 205 });
    const at = gravitySheet(w, u);
    let worst = Infinity;
    const e = 0.5;
    for (let y = 0; y <= H; y += 3) for (let x = 0; x <= W; x += 3) {
      const [ax, ay] = at(x, y), [bx, by] = at(x + e, y), [cx, cy] = at(x, y + e);
      worst = Math.min(worst, ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / (e * e));
    }
    assert.ok(worst > 0, `${name}: the sheet folds (stretch ${worst})`);
    console.log(`PASS: gravity view, ${name}: never folds (tightest squeeze ${worst.toFixed(2)} of the flat sheet's area).`);
  }
  const w = system(kinds);
  const at = gravitySheet(w, u);
  const t0 = performance.now();
  let n = 0;
  for (let y = 0; y <= H; y += 26) for (let x = 0; x <= W; x += 6) { at(x, y); n++; }
  for (let x = 0; x <= W; x += 26) for (let y = 0; y <= H; y += 6) { at(x, y); n++; }
  const ms = performance.now() - t0;
  assert.ok(ms < 8, `gravity view takes ${ms.toFixed(1)} ms`);
  console.log(`PASS: gravity view with 24 bodies: ${n} sheet points in ${ms.toFixed(1)} ms.`);
}

// ---- presets: each ready-made sky lives on for a minute, on screen ----
for (const name of PRESET_ORDER) {
  const w = new World(W / 2, H / 2, u, GM);
  w.reach = 3 * W;
  for (const b of preset(name, W / 2, H / 2, M, u, GM)) w.add(b);
  const n = w.bodies.length;
  let far = 0;
  for (let i = 0; i < 240 * 60; i++) {
    w.step();
    for (const b of w.bodies) far = Math.max(far, Math.hypot(b.x - W / 2, b.y - H / 2));
  }
  assert.equal(w.bodies.length, n, `${name}: nobody merges or is lost in a minute`);
  assert.ok(far < 0.5 * H, `${name}: stays on screen (farthest ${far.toFixed(0)} px)`);
  console.log(`PASS: preset ${name}: all ${n} bodies live a minute, farthest ${far.toFixed(0)} px from the centre.`);
}

// ---- the computer's turn: what it scores in each round (it plays as the rounds do) ----
{
  const R = 245;
  const zone: number[] = [], sling: number[] = [], defense: number[] = [];
  let searchMs = 0, searches = 0;
  for (let seed = 1; seed <= 6; seed++) {
    // Goldilocks: two calm planets at the planned times and radii.
    const z = new ZoneSim(640, 300, R, 1, seed * 1.7);
    let next = 0;
    while (!z.over) {
      if (next < CPU_ZONE.times.length && z.time >= CPU_ZONE.times[next]) {
        const t = z.cpuThrow(CPU_ZONE.radii[next++]);
        if (t) z.throw(t.x, t.y, t.vx, t.vy);
      }
      z.step(1 / 60);
    }
    zone.push(z.score);
    // Slingshot: search, fly the gentlest arrival, wait a little, again.
    const sl = new SlingSim(640, 300, R, 1, seed * 0.9, seed * 2.3);
    let wait = 0.3;
    while (!sl.over) {
      wait -= 1 / 60;
      if (wait <= 0 && sl.left > 0 && sl.time < SLING.seconds) {
        const t0 = performance.now();
        const tried = candidates(sl, CPU_SLING.dirs, CPU_SLING.strengths);
        const best = bestRoute(tried.map((c) => sl.forecast(c.dvx, c.dvy)));
        searchMs += performance.now() - t0; searches += tried.length / 192;
        if (best) { sl.launch(best.dvx, best.dvy); wait = CPU_SLING.pause; } else wait = 0.6;
      }
      sl.step(1 / 60);
    }
    sling.push(sl.score);
    // Save the Earth: look twice, then the smallest push that clears the cloud, plus a quarter.
    const d = new Defense(seed * 101);
    const spy = DEFENSE.stepsPerYear;
    while (d.looks < 2) { while (!d.canLook) d.advance(); for (let i = 0; i < 0.1 * spy; i++) d.advance(); d.look(); }
    let push = { dvx: 0, dvy: 0 };
    for (const c of d.pushCandidates()) { push = c; if (d.forecast(c.dvx, c.dvy).every((h) => !h)) break; }
    const f = Math.min(1.25, DEFENSE.dvMax / Math.hypot(push.dvx, push.dvy));
    d.push(push.dvx * f, push.dvy * f);
    while (!d.over) d.advance();
    defense.push(d.score());
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const total = mean(zone) + mean(sling) + mean(defense);
  assert.ok(mean(zone) > 300, `computer's Goldilocks ${mean(zone)}`);
  assert.ok(mean(sling) >= 600, `computer's Slingshot ${mean(sling)}`);
  assert.ok(defense.filter((x) => x >= 400).length >= 5, `computer saves Earth: ${defense.join(' ')}`);
  const perRoute = searchMs / searches / 192;
  assert.ok(perRoute * Math.ceil(192 / 40) < 16, `the player's search would take ${(perRoute * 5).toFixed(1)} ms a frame`);
  console.log(`PASS: the computer's turn — Goldilocks ${zone.join(' ')}, Slingshot ${sling.join(' ')}, Save the Earth ${defense.join(' ')}; about ${Math.round(total)} in all (a search: ${(searchMs / searches).toFixed(0)} ms, ${perRoute.toFixed(2)} ms a route; asking the computer for help tries 5 routes a frame).`);
}
