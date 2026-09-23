import { BallWorld, type Box } from '../src/games/bounce/physics.ts';
import { PLINKO, plinkoLayout, plinkoTally } from '../src/games/bounce/plinko.ts';
import { SILO, knock, makeSilo, recycle } from '../src/games/bounce/silo.ts';
import { STEAM, makeSteam } from '../src/games/bounce/steam.ts';
import { FLOOR, FloorSim } from '../src/games/bounce/floorsim.ts';
import assert from 'node:assert/strict';

// A pit like the game's on a 1280×720 screen: 620 px tall, so unit = 1.
const box: Box = { x0: 10, y0: 10, x1: 1270, y1: 630 };
const bh = box.y1 - box.y0;
const g = 1800;
let seed = 1;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function pit(): BallWorld {
  const w = new BallWorld(box, g, 20, 1.4 * Math.sqrt(2 * g * bh));
  for (let y = box.y1 - 20; y > box.y1 - 0.4 * bh; y -= 40)
    for (let x = box.x0 + 20; x < box.x1 - 20; x += 40)
      w.add({ x: x + rand() * 4 - 2, y, vx: 0, vy: 0, r: 9 + 11 * rand() });
  return w;
}
const run = (w: BallWorld, seconds: number) => { for (let t = 0; t < seconds; t += 1 / 60) w.step(1 / 60); };
const speeds = (w: BallWorld) => w.balls.map((b) => Math.hypot(b.vx, b.vy));
function overlaps(w: BallWorld) {
  let sum = 0, n = 0, worst = 0;
  const B = w.balls;
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
    const a = B[i], b = B[j];
    const ov = (a.r + b.r - Math.hypot(a.x - b.x, a.y - b.y)) / Math.min(a.r, b.r);
    if (ov > 0) { sum += ov; n++; worst = Math.max(worst, ov); }
  }
  return { mean: sum / n, worst };
}
const inside = (w: BallWorld) => w.balls.every((b) =>
  Number.isFinite(b.x + b.y + b.vx + b.vy) && b.x >= box.x0 + b.r - 1 && b.x <= box.x1 - b.r + 1 && b.y >= box.y0 + b.r - 1 && b.y <= box.y1 - b.r + 1);

// A resting pile really rests, and balls don't sink into each other.
const w = pit();
run(w, 4);
const ov = overlaps(w);
assert.ok(ov.mean < 0.02, `mean overlap ${ov.mean}`);
assert.ok(ov.worst < 0.15, `worst overlap ${ov.worst}`);
assert.ok(Math.max(...speeds(w)) < 5, `resting pile moves at ${Math.max(...speeds(w))} px/s`);
// The grid checks far fewer pairs than all of them.
const n = w.balls.length;
assert.ok(w.pairChecks < (n * (n - 1)) / 2 / 5, `pair checks ${w.pairChecks}`);
console.log(`PASS: pile of ${n} rests (mean overlap ${(100 * ov.mean).toFixed(1)} %), grid checks ${Math.round(w.pairChecks)} of ${(n * (n - 1)) / 2} pairs.`);

// Heat boils the pile into a gas that stays in the box; cooling settles it again.
w.heat = 1;
run(w, 5);
assert.ok(inside(w), 'heated balls stay finite and inside');
const top = Math.min(...w.balls.map((b) => b.y));
assert.ok(box.y1 - top > 0.6 * bh, 'heat lifts balls high up the pit');
w.heat = 0;
w.cool = 1;
run(w, 3);
w.cool = 0;
run(w, 2); // the hot plate's kicks are random, so give stragglers time
const cooled = speeds(w).sort((a, b) => a - b);
assert.ok(cooled[cooled.length >> 1] < 5 && cooled[cooled.length - 1] < 60, `cooling brings the pile to rest: median ${cooled[cooled.length >> 1]}, max ${cooled[cooled.length - 1]}`);
assert.ok(inside(w));
console.log('PASS: heat makes a gas, cooling brings it back to rest.');

// Without collisions balls sail through each other down to the floor.
const ghosts = pit();
ghosts.collisions = false;
run(ghosts, 8);
assert.ok(ghosts.balls.every((b) => b.y > box.y1 - 2 * b.r), 'ghost balls all end on the floor');
// Without losses, motion never dies out.
const perpetual = pit();
perpetual.dissipate = false;
perpetual.friction = false;
perpetual.heat = 1;
run(perpetual, 2);
perpetual.heat = 0;
run(perpetual, 5);
assert.ok(speeds(perpetual).reduce((a, b) => a + b) / perpetual.balls.length > 100, 'no losses, no rest');
assert.ok(inside(perpetual));
console.log('PASS: model switches (collisions off, losses off).');

// A big heavy ball and a hand shoving through the pile keep everything sane.
const shove = pit();
shove.add({ x: 640, y: 60, vx: 0, vy: 0, r: 48, gold: true });
shove.hand = { x: 100, y: box.y1 - 60, vx: 3000, vy: 0, r: 40, active: true };
for (let t = 0; t < 2; t += 1 / 60) { shove.hand.x = 100 + 3000 * t % 1000; shove.step(1 / 60); }
assert.ok(inside(shove), 'hand and golden ball keep balls finite and inside');
console.log('PASS: golden ball and hand.');

// Plinko: without bumpers every ball lands, in a bell curve, and the score adds up.
const layout = plinkoLayout(box, 1, 3);
const board = new BallWorld(box, g, layout.ballR, 0);
board.pegRestitution = PLINKO.pegBounce;
board.sideDrag = PLINKO.air;
board.dragLine = layout.bucketTop;
board.pegs = layout.pegs;
board.segments = layout.segments;
let acc = 0;
for (let dropped = 0; dropped < PLINKO.balls; ) {
  acc += PLINKO.rate / 60;
  for (; acc >= 1 && dropped < PLINKO.balls; acc--, dropped++)
    board.add({ x: layout.spout.x + rand() * 2 - 1, y: layout.spout.y, vx: 0, vy: 0, r: layout.ballR });
  board.step(1 / 60);
}
run(board, 6);
const tally = plinkoTally(layout, board.balls);
const total = tally.counts.reduce((a, b) => a + b);
assert.equal(total, PLINKO.balls, 'every ball lands in a bucket');
const mid = Math.floor(PLINKO.buckets / 2);
const middle = tally.counts[mid - 1] + tally.counts[mid] + tally.counts[mid + 1];
const edges = tally.counts[0] + tally.counts[1] + tally.counts[PLINKO.buckets - 2] + tally.counts[PLINKO.buckets - 1];
assert.ok(middle > 0.4 * total && edges < 0.08 * total, `bell curve: ${tally.counts.join(' ')}`);
assert.equal(layout.gold, mid + 3);
assert.deepEqual(layout.silver, [mid + 2, mid + 4]);
assert.equal(tally.score, tally.counts[mid + 3] * PLINKO.goldPoints + (tally.counts[mid + 2] + tally.counts[mid + 4]) * PLINKO.silverPoints);
console.log(`PASS: Plinko bell curve ${tally.counts.join(' ')}, natural score ${tally.score}.`);

// Silo: jams happen, and knocking jammed silos delivers far more balls.
function silos(knocker: boolean) {
  const all = [0, 1, 2, 3].map(() => ({ w: makeSilo(), out: 0, last: 0 }));
  let knocks = SILO.knocks;
  for (let t = 0; t < SILO.seconds; t += 1 / 60) {
    for (const s of all) {
      s.w.step(1 / 60);
      const n = recycle(s.w);
      if (n) { s.out += n; s.last = t; }
      else if (knocker && knocks > 0 && t - s.last > 1.3) { knock(s.w); knocks--; s.last = t; }
    }
  }
  return all.reduce((a, s) => a + s.out, 0);
}
const lazy = silos(false);
const busy = silos(true);
assert.ok(busy > 1.15 * lazy, `knocking pays: ${lazy} without, ${busy} with`);
console.log(`PASS: silos deliver ${lazy} balls unknocked, ${busy} when jams are knocked loose.`);

// Steam engine: no heat, no lift; pulsing near the flag beats holding the burner down.
function steam(policy: (lid: number) => boolean) {
  const w = makeSteam();
  let fuel = STEAM.fuel, heat = 0, above = 0;
  for (let t = 0; t < STEAM.seconds; t += 1 / 60) {
    const on = fuel > 0 && policy(1 - w.piston.y / STEAM.height);
    if (on) fuel -= 1 / 60;
    heat = on ? Math.min(1, heat + 1.5 / 60) : Math.max(0, heat - 1.5 / 60);
    w.heat = heat;
    w.step(1 / 60);
    if (1 - w.piston.y / STEAM.height > STEAM.flag) above += 1 / 60;
  }
  return above;
}
assert.equal(steam(() => false), 0, 'a cold gas never lifts the lid');
const hold = steam(() => true);
const pulse = steam((lid) => lid < STEAM.flag + 0.1);
assert.ok(hold > 5 && pulse > hold + 2, `holding ${hold.toFixed(1)} s, pulsing ${pulse.toFixed(1)} s`);
console.log(`PASS: steam engine lid above the flag ${hold.toFixed(1)} s when held, ${pulse.toFixed(1)} s when pulsed.`);

// Delve floor: the bounce's energy moves into the atoms, the total stays put.
const floor = new FloorSim();
const e0 = floor.ballEnergy() + floor.floorEnergy();
floor.advance(8);
const eBall = floor.ballEnergy() / e0;
assert.ok(Math.abs(floor.ballEnergy() + floor.floorEnergy() - e0) / e0 < 0.02, 'floor model conserves energy');
assert.ok(eBall < 0.85 && eBall > 0.1, `ball keeps ${eBall.toFixed(2)} of its energy after 8 s`);
assert.ok(FLOOR.dt > 0);
console.log(`PASS: floor atoms take ${(100 * (1 - eBall)).toFixed(0)} % of the bounce in 8 s, energy conserved.`);

// Delve chaos twins: identical boxes stay identical; a 0.001 px nudge grows to ball size.
function twins(nudge: number) {
  const mk = () => { const t = new BallWorld({ x0: 0, y0: 0, x1: 240, y1: 240 }, 0, 12, 0); t.dissipate = false; t.friction = false; return t; };
  const a = mk(), b = mk();
  for (let i = 0; i < 24; i++) {
    const ang = rand() * 6.28;
    const ball = { x: 40 * (0.5 + (i % 6)), y: 60 * (0.5 + Math.floor(i / 6)), vx: 60 * Math.cos(ang), vy: 60 * Math.sin(ang), r: 12 };
    a.add(ball);
    b.add(ball);
  }
  b.balls[0].x += nudge;
  for (let t = 0; t < 10; t += 1 / 60) { a.step(1 / 60); b.step(1 / 60); }
  return Math.max(...a.balls.map((p, i) => Math.hypot(p.x - b.balls[i].x, p.y - b.balls[i].y)));
}
assert.equal(twins(0), 0, 'the physics is deterministic');
assert.ok(twins(0.001) > 24, 'a thousandth of a pixel grows past a ball width');
console.log('PASS: chaos twins (deterministic, and 0.001 px grows past a ball width).');
