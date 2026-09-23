import { BallWorld, type Box } from '../src/games/bounce/physics.ts';
import { PLINKO, plinkoLayout, plinkoTally } from '../src/games/bounce/plinko.ts';
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
assert.ok(w.pairChecks / 4 < (n * (n - 1)) / 2 / 5, `pair checks ${w.pairChecks}`);
console.log(`PASS: pile of ${n} rests (mean overlap ${(100 * ov.mean).toFixed(1)} %), grid checks ${w.pairChecks / 4} of ${(n * (n - 1)) / 2} pairs.`);

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
run(w, 1);
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
board.pegRestitution = 0.3;
board.sideDrag = 6;
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
assert.ok(middle > 0.45 * total && edges < 0.08 * total, `bell curve: ${tally.counts.join(' ')}`);
assert.equal(layout.gold, mid + 3);
assert.deepEqual(layout.silver, [mid + 2, mid + 4]);
assert.equal(tally.score, tally.counts[mid + 3] * PLINKO.goldPoints + (tally.counts[mid + 2] + tally.counts[mid + 4]) * PLINKO.silverPoints);
console.log(`PASS: Plinko bell curve ${tally.counts.join(' ')}, natural score ${tally.score}.`);
