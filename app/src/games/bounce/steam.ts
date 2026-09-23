// Round 3's cylinder, DOM-free so node tests can run it: a nearly ideal gas
// of balls under a heavy lid, heated by a hot plate. Tuned in node: the lid
// rises smoothly with heat and sinks over about two seconds once it stops.
import { BallWorld } from './physics';

/** Cylinder in its own units (px on a 620-tall reference); tuned in node. */
export const STEAM = {
  width: 300,
  height: 620,
  balls: 60,
  r: 10,
  /** Lid mass in ball masses. */
  lidMass: 15,
  /** Height of the flag above the floor, as a fraction of the cylinder. */
  flag: 0.55,
  seconds: 30,
  /** Seconds of burning in a full tank. */
  fuel: 14,
  /** Points per second above the flag. */
  points: 20,
};

/** The cylinder with its gas and lid, settled. DOM-free (tested in node). */
export function makeSteam(): BallWorld {
  const { width: W, height: H, r } = STEAM;
  const world = new BallWorld({ x0: 0, y0: 0, x1: W, y1: H }, 1800, r, 1.4 * Math.sqrt(2 * 1800 * H));
  // A nearly ideal gas: no friction, bouncy walls, so it holds its heat a while.
  world.friction = false;
  world.wallRestitution = 0.95;
  world.ballRestitution = 0.97;
  for (let i = 0; i < STEAM.balls; i++) {
    world.add({ x: 2 * r + (i % 12) * 2.2 * r, y: H - r - Math.floor(i / 12) * 2.5 * r, vx: 0, vy: 0, r, hue: 30 });
  }
  world.piston = { y: H * 0.6, vy: 0, mass: STEAM.lidMass * r * r, active: true, maxY: H * 0.88, py: 0, uy: 0 };
  for (let k = 0; k < 90; k++) world.step(1 / 60);
  return world;
}
