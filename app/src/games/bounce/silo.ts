// Round 2's grain silo, DOM-free so node tests can run it: a hopper with a
// two-ball exit, balls that fall out come back in at the top, and a knock
// that shakes the balls just above the exit to break an arch.
import { randRange } from '../../lib/util';
import { BallWorld } from './physics';

export const SILO = {
  count: 4,
  balls: 140,
  seconds: 25,
  knocks: 10,
  /** Silo geometry in its own units (px on a 620-tall reference). */
  width: 420,
  wallEnd: 250,
  outlet: 450,
  /**
   * Exit width in ball diameters. Tuned in node: at 1.85 every silo jams
   * (the first jam after ~4 s), about 3–4 times a round when knocked loose,
   * and knocking triples what comes out. At 2 jams are rare and erratic.
   */
  exit: 1.85,
  rMin: 10,
  rMax: 12.5,
  friction: 0.3,
  /** No ball out for this long = jammed. */
  jamAfter: 1,
  knockSpeed: 600,
  /** Knocks shake balls this many diameters above the exit. */
  knockReach: 6,
  /** Top of the drawn silo and of the refill (silo units). */
  top: -330,
};

/** One silo's world, filled behind a closed gate and settled. DOM-free (tested in node). */
export function makeSilo(): BallWorld {
  const { width: W, wallEnd, outlet, rMin, rMax } = SILO;
  const cx = W / 2;
  const half = (SILO.exit * (rMin + rMax)) / 2;
  const world = new BallWorld({ x0: 0, y0: SILO.top - 200, x1: W, y1: 5000 }, 1800, rMax, 0);
  world.ballFriction = SILO.friction;
  world.pegRestitution = 0.5;
  world.segments = [
    { x1: 0, y1: SILO.top - 200, x2: 0, y2: wallEnd },
    { x1: W, y1: SILO.top - 200, x2: W, y2: wallEnd },
    { x1: 0, y1: wallEnd, x2: cx - half, y2: outlet },
    { x1: W, y1: wallEnd, x2: cx + half, y2: outlet },
    { x1: cx - half - 5, y1: outlet, x2: cx + half + 5, y2: outlet },
  ];
  for (let i = 0; i < SILO.balls; i++) {
    world.add({ x: randRange(20, W - 20), y: wallEnd - 40 - i * 5, vx: 0, vy: 0, r: randRange(rMin, rMax), hue: randRange(20, 60) });
  }
  for (let k = 0; k < 150; k++) world.step(1 / 60);
  world.segments.pop(); // open the gate
  return world;
}

/** Moves balls that fell out back to the top; returns how many fell out. */
export function recycle(world: BallWorld): number {
  let out = 0;
  for (const b of world.balls) {
    if (b.y < SILO.outlet + 60) continue;
    out++;
    b.x = randRange(40, SILO.width - 40);
    b.y = SILO.top + randRange(0, 40);
    b.vx = 0;
    b.vy = 0;
  }
  return out;
}

/** Shakes the balls just above the exit, which breaks most arches. */
export function knock(world: BallWorld): void {
  const d = SILO.rMin + SILO.rMax;
  const k = SILO.knockSpeed;
  for (const b of world.balls) {
    if (b.y > SILO.outlet - SILO.knockReach * d && b.y < SILO.outlet + d) {
      b.vy -= k * (1 + Math.random());
      b.vx += (Math.random() - 0.5) * k;
    }
  }
}
