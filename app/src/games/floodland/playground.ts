// Free play: a water table. A spring in the hills feeds a river through a pond to
// a beach, where waves roll in from the sea. The player pours and pushes water,
// piles up sand, digs, drops rubber ducks and sends a big wave; there is nothing to
// win or lose. Pure functions and data, so the tests can run it headless.
import { FloodSim, GRID_W as W, GRID_H as H, DX } from './water';

/** Physical seconds per displayed second (as in the challenge). */
export const PLAY_TIME_SCALE = 24;
/** The spring on the hill (m³/s), spread over a few cells. */
export const SPRING = { x: 55, y: 8, rate: 16 };
/** The river's course, from the spring down to the sea (cells). */
const COURSE: readonly [number, number][] = [
  [56, 8.5], [53, 9], [49, 12], [45, 13], [41, 15], [38, 17], [35, 19], [32, 22], [28, 23], [24, 22], [20, 24], [16, 26], [10, 27],
];
export const POND = { x: 38, y: 17, r: 3.4 };
export const ISLAND = { x: 6.5, y: 9.5 };
/** Trees and the windmill stand on dry land, away from the river. */
export const TREES: readonly [number, number][] = [[46, 6], [50, 20], [44, 24], [30, 31], [55, 33], [36, 9], [60, 22], [27, 13], [41, 34], [53, 27]];
export const MILL = { x: 50, y: 4 };
export const LIGHTHOUSE = { x: 6, y: 9 };

/** Brushes: sand and digging change the ground this fast at the centre (m per
 * displayed second); pouring raises the water this fast. */
export const BRUSH = { radius: 1.5, sand: 1.8, dig: 1.8, pour: .9, top: 5.5, bottom: -3 };
/** The hand pushes water towards the pointer's speed, at most this fast (m/s). */
export const PUSH = { radius: 2.2, maxSpeed: 3.2, grip: 9 };
export const MAX_DUCKS = 36;
/** A duck comes down from the spring this often, while there are few. */
export const SPRING_DUCKS = { every: 5.5, upTo: 8 };

/** Shoreline: where the land meets the sea, wavy, with a bay at the river mouth. */
function shore(y: number): number {
  return 18 + 2.2 * Math.sin(.21 * y + .6) + 1.2 * Math.sin(.53 * y + 2);
}
const bump = (x: number, y: number, cx: number, cy: number, s2: number) => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / s2);

/** Distance from a point to the river's course, and how far along it (cells). */
function onCourse(x: number, y: number): { d: number; s: number } {
  let best = Infinity, along = 0, run = 0;
  for (let k = 0; k + 1 < COURSE.length; k++) {
    const [ax, ay] = COURSE[k], [bx, by] = COURSE[k + 1];
    const len = Math.hypot(bx - ax, by - ay);
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (len * len)));
    const d = Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay));
    if (d < best) { best = d; along = run + t * len; }
    run += len;
  }
  return { d: best, s: along };
}
function pointOnCourse(s: number): [number, number] {
  for (let k = 0; k + 1 < COURSE.length; k++) {
    const [ax, ay] = COURSE[k], [bx, by] = COURSE[k + 1];
    const len = Math.hypot(bx - ax, by - ay);
    if (s <= len) return [ax + (bx - ax) * s / len, ay + (by - ay) * s / len];
    s -= len;
  }
  return COURSE[COURSE.length - 1];
}

/** Dune height (m) at a distance `d` (cells) from the waterline. */
function dune(x: number, y: number, d: number): number {
  const along = .75 + .3 * Math.sin(.55 * y + .3) + .2 * Math.sin(1.3 * y + x * .2);
  return Math.max(0, 1.5 * along * Math.exp(-(((d - 7.5) / 1.8) ** 2)));
}
/** What the ground is, for its colour: sea floor, beach, dune, grass or rock. */
export const Ground = { Floor: 0, Beach: 1, Dune: 2, Grass: 3, Rock: 4 } as const;
export function groundKinds(terrain: Float64Array): Uint8Array {
  const kinds = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, z = terrain[i], d = x + .5 - shore(y + .5);
    kinds[i] = Math.hypot(x + .5 - ISLAND.x, y + .5 - ISLAND.y) < 3.2 && z > -.3 ? (z > .5 ? Ground.Rock : Ground.Beach)
      : z < -.3 ? Ground.Floor : d < 5 ? Ground.Beach : dune(x, y, d) > .4 ? Ground.Dune : z < .75 ? Ground.Beach : Ground.Grass;
  }
  return kinds;
}

/** The land before the river is cut into it. */
function land(x: number, y: number): number {
  const d = x + .5 - shore(y + .5);
  let z = d < 0 ? Math.max(-2, .25 * d) : d < 5 ? .12 * d : .6 + .055 * (d - 5);
  // A row of dunes behind the beach, higher and lower along the coast.
  z += dune(x, y, d);
  if (d > 3) {
    z += 2.2 * bump(x, y, 60, 6, 50) + 1.1 * bump(x, y, 50, 33, 60) + .6 * bump(x, y, 33, 34, 25) + .5 * bump(x, y, 45, 3, 30);
    z += .18 * Math.sin(.45 * x + .2 * y) * Math.cos(.31 * y - .2 * x) * Math.min(1, (d - 3) / 4);
  }
  // A rocky island, and a rock that a big wave washes over.
  z = Math.max(z, 1.5 - .24 * ((x - ISLAND.x) ** 2 + (y - ISLAND.y) ** 2));
  z = Math.max(z, .4 - .7 * ((x - 10.5) ** 2 + (y - 31.5) ** 2));
  return z;
}

/** Whether a cell belongs to the river: its bed, the pond or the spring's hollow. */
function inRiver(x: number, y: number): boolean {
  return onCourse(x + .5, y + .5).d < 2.6 || Math.hypot(x - POND.x, y - POND.y) < POND.r + .5
    || Math.hypot(x - SPRING.x - .5, y - SPRING.y - .5) < 2.2;
}

/** The ground of the water table: the land, with a river bed cut from the spring to
 * the sea that only ever runs downhill, and a pond on the way. */
export function playTerrain(): Float64Array {
  const terrain = new Float64Array(W * H);
  // The bed along the course: below the land, never rising downstream.
  const total = onCourse(...COURSE[COURSE.length - 1]).s, samples: number[] = [];
  let low = Infinity;
  for (let k = 0; k <= 200; k++) {
    const s = total * k / 200, [x, y] = pointOnCourse(s);
    low = Math.min(low, land(x, y) - (s < 12 ? .9 : .6));
    samples.push(low);
  }
  const bed = (s: number) => samples[Math.max(0, Math.min(200, Math.round(s / total * 200)))];
  const pondBed = bed(onCourse(POND.x + .5, POND.y + .5).s);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let z = land(x, y);
    const { d, s } = onCourse(x + .5, y + .5);
    if (d < 2.6) z = Math.min(z, bed(s) + .55 * (d / 1.7) ** 2);
    // Natural levees keep the river in its bed where the land beside it is low.
    else if (d < 4.5 && z > 0) z = Math.max(z, bed(s) + 1.1);
    const p = Math.hypot(x + .5 - POND.x - .5, y + .5 - POND.y - .5) / POND.r;
    if (p < 1) z = Math.min(z, pondBed - .9 * (1 - p * p));
    else if (p < 1.7 && d >= 2.6) z = Math.max(z, pondBed + 1.1);
    // The spring wells up in a small hollow at the head of the river.
    const q = Math.hypot(x - SPRING.x - .5, y - SPRING.y - .5) / 2.2;
    if (q < 1) z = Math.min(z, bed(0) + .1 + .5 * q * q);
    terrain[y * W + x] = z;
  }
  return terrain;
}

/** The sea level at the open edge: a slow tide, a swell that comes in sets, and a
 * big wave `wave` seconds after it was sent. */
export function playSeaLevel(t: number, waveStart: number | null): number {
  const tide = .18 * Math.sin(2 * Math.PI * t / 47);
  const swell = .55 * (.7 + .3 * Math.sin(2 * Math.PI * t / 12)) * Math.sin(2 * Math.PI * t / 1.4);
  const big = waveStart === null ? 0 : BIG_WAVE.height * Math.exp(-(((t - waveStart - 1) / BIG_WAVE.width) ** 2));
  return tide + swell + big;
}
/** The player's sand washes away where water runs faster than `critical` (m/s):
 * loose enough that an overtopped dam bursts and the surf takes a sandcastle. */
export const SAND = { critical: .45, rate: .05, slide: .02 };
/** The big wave at the sea's edge: height (m) and duration (displayed s). */
export const BIG_WAVE = { height: 1.7, width: .45 };
/** How long the big wave button rests after a wave (displayed seconds). */
export const WAVE_REST = 3.5;

let settled: { terrain: Float64Array; water: Float64Array; mx: Float64Array; my: Float64Array } | null = null;
/** Land above the sea that was dry once the river had settled. */
let dryLand: Uint8Array | null = null;

/** A fresh water table with the river already running (computed once, then copied). */
export function makePlayground(): FloodSim {
  const s = new FloodSim();
  s.waveBoundary = true;
  s.friction = .002;
  s.manning = .025;
  const n = W * H;
  if (!settled) {
    s.terrain.set(playTerrain());
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, z = s.terrain[i];
      if (x + .5 < shore(y + .5) + 2) s.water[i] = Math.max(0, -z);
      // Water in the river bed and the pond to start with.
      else if (onCourse(x + .5, y + .5).d < 1.6 || Math.hypot(x - POND.x, y - POND.y) < POND.r) {
        const around = Math.min(...[-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => s.terrain[Math.min(H - 1, Math.max(0, y + dy)) * W + Math.min(W - 1, Math.max(0, x + dx))])));
        s.water[i] = Math.max(0, around + .3 - z);
      }
    }
    s.sources = springCells();
    // Let the river settle on its way to the sea first (cheaply: first order, calm sea).
    for (let t = 0; t < 240; t += 10) s.advance(10);
    settled = { terrain: s.terrain.slice(), water: s.water.slice(), mx: s.mx.slice(), my: s.my.slice() };
    dryLand = new Uint8Array(n);
    for (let i = 0; i < n; i++) dryLand[i] = s.terrain[i] > 0 && !inRiver(i % W, Math.floor(i / W)) ? 1 : 0;
  }
  s.terrain.set(settled.terrain); s.water.set(settled.water); s.mx.set(settled.mx); s.my.set(settled.my);
  s.sources = springCells();
  s.secondOrder = true;
  // Only the player's sand washes away: the land itself is the floor.
  s.erosion = {
    // The solver's own erosion is off here (wash() moves the sand instead).
    floor: s.terrain.slice(), hardTop: s.terrain.slice(), sand: { critical: 99, rate: 0 },
    critical: new Float32Array(n).fill(99), rate: new Float32Array(n), slump: { height: 99, rate: 0 },
  };
  return s;
}
/** Kiosk safety after a numerical failure: the water as it was at the start, over
 * the ground as it is now. The river refills from the spring. */
export function resetPlayWater(sim: FloodSim): void {
  sim.mx.fill(0); sim.my.fill(0);
  if (!settled) { sim.water.fill(0); return; }
  for (let i = 0; i < sim.water.length; i++) {
    const level = settled.terrain[i] + settled.water[i];
    sim.water[i] = settled.water[i] > 0 ? Math.max(0, level - sim.terrain[i]) : 0;
  }
}
/** Water on land that was dry at the start soaks away (m per physical second): a
 * thin film fast, so poured puddles and a big wave's wash dry up, standing water ten
 * times slower, so a lake behind a dam still fills. The river, the pond and the sea
 * are untouched. */
export function soak(sim: FloodSim, seconds: number, rate = 4e-4): void {
  const { water, mx, my } = sim;
  if (!dryLand) return;
  for (let i = 0; i < water.length; i++) {
    const h = water[i];
    if (h <= 0 || !dryLand[i]) continue;
    const next = Math.max(0, h - (h < .06 ? rate : rate / 10) * seconds);
    const keep = next / h;
    water[i] = next; mx[i] *= keep; my[i] *= keep;
  }
}
/** The water's mean current (m/s), averaged over about a displayed second: waves
 * slosh back and forth and average out, a river or an overtopping flow does not. */
export interface Currents { u: Float32Array; v: Float32Array }
export function currents(): Currents { return { u: new Float32Array(W * H), v: new Float32Array(W * H) }; }
export function averageFlow(sim: FloodSim, mean: Currents, dt: number, memory = 1): void {
  const k = Math.min(1, dt / memory), { water, mx, my } = sim;
  for (let i = 0; i < water.length; i++) {
    const h = water[i];
    const u = h > .02 ? mx[i] / h : 0, v = h > .02 ? my[i] / h : 0;
    mean.u[i] += k * (u - mean.u[i]); mean.v[i] += k * (v - mean.v[i]);
  }
}

/** The player's sand under a steady current: where the mean current is faster than
 * SAND.critical the sand is carried one cell downstream (and settles where the
 * current slows), and sand standing more than `step` (m) above a wet neighbour
 * downstream slides onto it, as does sand beside fast water. An overtopped dam
 * bursts and its breach widens, sand in the river moves on to the sea, and an island
 * in the swell stays. Sand is conserved. */
export function wash(sim: FloodSim, mean: Currents, seconds: number, step = .35): void {
  const { terrain, water, erosion, wear } = sim;
  if (!erosion) return;
  const hard = erosion.hardTop;
  wear.fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, z = terrain[i];
    if (z <= hard[i] + 1e-3) continue;
    // The wall of a breach collapses into the fast water beside it, so the gap widens.
    let side = -1;
    for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
      if (n >= 0 && water[n] > .02 && terrain[n] < z - step && Math.hypot(mean.u[n], mean.v[n]) > SAND.critical) side = n;
    }
    if (side >= 0) {
      const move = Math.min((z - terrain[side] - step) / 2, SAND.slide * seconds, z - hard[i]);
      terrain[i] -= move; terrain[side] += move;
      wear[i] += move / seconds;
      continue;
    }
    if (water[i] < .02) continue;
    const u = mean.u[i], v = mean.v[i], speed = Math.hypot(u, v);
    if (speed < .1) continue;
    // The neighbour downstream, along the stronger component of the current.
    const j = Math.abs(u) > Math.abs(v) ? (u > 0 ? (x < W - 1 ? i + 1 : -1) : (x > 0 ? i - 1 : -1))
      : (v > 0 ? (y < H - 1 ? i + W : -1) : (y > 0 ? i - W : -1));
    if (j < 0) continue;
    let move = speed > SAND.critical ? SAND.rate * (speed - SAND.critical) ** 2 * seconds : 0;
    if (water[j] > .02 && terrain[j] < z - step) move = Math.max(move, Math.min((z - terrain[j] - step) / 2, SAND.slide * seconds));
    move = Math.min(move, z - hard[i]);
    if (move <= 0) continue;
    terrain[i] -= move; terrain[j] += move;
    wear[i] += move / seconds;
  }
}

function springCells(): { index: number; rate: number }[] {
  const cells = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => (SPRING.y + dy) * W + SPRING.x + dx);
  return cells.map(index => ({ index, rate: SPRING.rate / cells.length }));
}

/** Pile up sand (rise > 0) or dig (rise < 0) with a round brush, `rise` metres at the
 * centre. Water depth is kept, so sand pushes the water up and away, and a hole
 * lowers the water surface so water runs in. */
export function shapeGround(sim: FloodSim, cx: number, cy: number, rise: number): number {
  const r = BRUSH.radius, reach = Math.ceil(r * 2), e = sim.erosion;
  let moved = 0;
  for (let y = Math.max(0, Math.floor(cy) - reach); y <= Math.min(H - 1, Math.floor(cy) + reach); y++) {
    for (let x = Math.max(1, Math.floor(cx) - reach); x <= Math.min(W - 1, Math.floor(cx) + reach); x++) {
      const i = y * W + x, w = Math.exp(-((x + .5 - cx) ** 2 + (y + .5 - cy) ** 2) / (r * r));
      if (w < .05) continue;
      const z = sim.terrain[i];
      const next = Math.max(BRUSH.bottom, Math.min(BRUSH.top, z + rise * w));
      if (next === z) continue;
      sim.terrain[i] = next;
      moved += Math.abs(next - z);
      // A dug hole is the new floor; sand never erodes below where it was put.
      if (e && next < e.floor[i]) { e.floor[i] = next; e.hardTop[i] = next; }
    }
  }
  return moved;
}

/** Pour water around a point (m at the centre). */
export function pour(sim: FloodSim, cx: number, cy: number, depth: number): void {
  const r = 1.3, reach = 3;
  for (let y = Math.max(0, Math.floor(cy) - reach); y <= Math.min(H - 1, Math.floor(cy) + reach); y++) {
    for (let x = Math.max(0, Math.floor(cx) - reach); x <= Math.min(W - 1, Math.floor(cx) + reach); x++) {
      sim.water[y * W + x] += depth * Math.exp(-((x + .5 - cx) ** 2 + (y + .5 - cy) ** 2) / (r * r));
    }
  }
}

/** Push the water near a point towards a velocity (m/s), as a hand through a bath
 * does: a bow wave in front, a dip and a wake behind. */
export function push(sim: FloodSim, cx: number, cy: number, u: number, v: number, dt: number): void {
  const speed = Math.hypot(u, v);
  if (speed > PUSH.maxSpeed) { u *= PUSH.maxSpeed / speed; v *= PUSH.maxSpeed / speed; }
  const r = PUSH.radius, reach = Math.ceil(r * 2), grip = Math.min(1, PUSH.grip * dt);
  for (let y = Math.max(0, Math.floor(cy) - reach); y <= Math.min(H - 1, Math.floor(cy) + reach); y++) {
    for (let x = Math.max(0, Math.floor(cx) - reach); x <= Math.min(W - 1, Math.floor(cx) + reach); x++) {
      const i = y * W + x, h = sim.water[i];
      if (h < .05) continue;
      const w = grip * Math.exp(-((x + .5 - cx) ** 2 + (y + .5 - cy) ** 2) / (r * r));
      sim.mx[i] += w * (h * u - sim.mx[i]);
      sim.my[i] += w * (h * v - sim.my[i]);
    }
  }
}

const VELOCITY: [number, number] = [0, 0];
/** Water velocity (m/s) at a point between cell centres; zero where it is dry.
 * The returned pair is reused by the next call. */
export function velocityAt(sim: FloodSim, x: number, y: number): [number, number] {
  const fx = Math.max(0, Math.min(W - 1.001, x - .5)), fy = Math.max(0, Math.min(H - 1.001, y - .5));
  const x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
  let u = 0, v = 0;
  for (let k = 0; k < 4; k++) {
    const dx = k & 1, dy = k >> 1, w = (dx ? ax : 1 - ax) * (dy ? ay : 1 - ay);
    const i = (y0 + dy) * W + x0 + dx, h = sim.water[i];
    if (h > .02) { u += w * sim.mx[i] / h; v += w * sim.my[i] / h; }
  }
  VELOCITY[0] = u; VELOCITY[1] = v;
  return VELOCITY;
}

/** A rubber duck: it floats with the water, bobs on the waves and is left on the
 * sand when the water goes. */
export interface Duck {
  x: number; y: number; vx: number; vy: number; facing: number; age: number; fromSpring: boolean; afloat: boolean;
  /** Height above the surface while it drops in (m). */
  fall: number;
}

export function newDuck(x: number, y: number, fromSpring = false): Duck {
  return { x, y, vx: 0, vy: 0, facing: Math.random() < .5 ? 1 : -1, age: 0, fromSpring, afloat: false, fall: fromSpring ? 0 : 2.5 };
}

/** Move the ducks one displayed time step; ducks that float out to sea are dropped. */
export function moveDucks(sim: FloodSim, ducks: Duck[], dt: number, timeScale = PLAY_TIME_SCALE): Duck[] {
  const toCells = timeScale / DX, water = sim.water;
  const depth = (x: number, y: number) => water[Math.min(H - 1, Math.max(0, Math.floor(y))) * W + Math.min(W - 1, Math.max(0, Math.floor(x)))];
  for (const d of ducks) {
    d.age += dt;
    d.fall = Math.max(0, d.fall - 9 * dt);
    // Afloat in water over 10 cm; carried a little in thinner water, stranded on dry ground.
    const h = depth(d.x, d.y), carry = Math.max(0, Math.min(1, (h - .02) / .08));
    d.afloat = carry > .99;
    if (carry > 0) {
      const [u, v] = velocityAt(sim, d.x, d.y), k = Math.min(1, dt * 5 * carry);
      // Ducks follow the water; in the shallows by a bank they drift towards deeper water.
      const gx = depth(d.x + 1, d.y) - depth(d.x - 1, d.y), gy = depth(d.x, d.y + 1) - depth(d.x, d.y - 1);
      const g = Math.hypot(gx, gy), shallow = Math.max(0, 1 - depth(d.x, d.y) / .35);
      const pull = g > 0 ? Math.min(1, g) * 4 * shallow / g : 0;
      // Out at sea a land breeze takes them slowly away.
      const breeze = depth(d.x, d.y) > 1.2 ? -.5 : 0;
      d.vx += k * (u * toCells + gx * pull + breeze - d.vx); d.vy += k * (v * toCells + gy * pull - d.vy);
    } else {
      const k = Math.exp(-8 * dt); d.vx *= k; d.vy *= k;
    }
  }
  // Floating ducks keep a little apart, so a crowd in the pond spreads out.
  for (let a = 0; a < ducks.length; a++) for (let b = a + 1; b < ducks.length; b++) {
    const p = ducks[a], q = ducks[b];
    if (!p.afloat || !q.afloat) continue;
    const dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy;
    if (d2 > .64 || d2 < 1e-6) continue;
    const d = Math.sqrt(d2), f = (.8 - d) / d * 3 * dt;
    p.x -= dx * f; p.y -= dy * f; q.x += dx * f; q.y += dy * f;
  }
  for (const d of ducks) {
    const speed = Math.hypot(d.vx, d.vy);
    if (speed > 25) { d.vx *= 25 / speed; d.vy *= 25 / speed; }
    const nx = Math.max(.2, Math.min(W - .3, d.x + d.vx * dt)), ny = Math.max(.3, Math.min(H - .3, d.y + d.vy * dt));
    // A duck does not climb onto land by itself: at a bank it slides along it.
    const wet = (x: number, y: number) => depth(x, y) > .03;
    if (!wet(d.x, d.y) || wet(nx, ny)) { d.x = nx; d.y = ny; }
    else if (wet(nx, d.y)) { d.x = nx; d.vy = 0; }
    else if (wet(d.x, ny)) { d.y = ny; d.vx = 0; }
    else { d.vx = d.vy = 0; }
    // Facing follows the screen direction of travel (the view's x is 12·x − 8·y).
    const screen = 12 * d.vx - 8 * d.vy;
    if (Math.abs(screen) > 1.5) d.facing = Math.sign(screen);
  }
  return ducks.filter(d => d.x > .4);
}

/** A fleck of foam drifting with the water: hundreds of them show the currents. */
export interface Fleck { x: number; y: number; vx: number; vy: number; age: number; life: number }

export function moveFlecks(sim: FloodSim, flecks: Fleck[], count: number, dt: number, rng: () => number, timeScale = PLAY_TIME_SCALE): void {
  const toCells = timeScale / DX;
  for (const f of flecks) {
    f.age += dt;
    const [u, v] = velocityAt(sim, f.x, f.y);
    f.vx = u * toCells; f.vy = v * toCells;
    f.x += f.vx * dt; f.y += f.vy * dt;
    const i = Math.floor(f.y) * W + Math.floor(f.x);
    if (f.x < 0 || f.x >= W || f.y < 0 || f.y >= H || !(sim.water[i] > .04)) f.age = f.life;
  }
  for (let k = flecks.length - 1; k >= 0; k--) if (flecks[k].age >= flecks[k].life) flecks.splice(k, 1);
  // New flecks favour fast water, so the river and the hand's wake light up.
  for (let tries = 0; flecks.length < count && tries < 40; tries++) {
    const x = rng() * W, y = rng() * H, i = Math.floor(y) * W + Math.floor(x), h = sim.water[i];
    if (!(h > .06)) continue;
    const speed = Math.hypot(sim.mx[i], sim.my[i]) / h;
    if (rng() > .12 + speed) continue;
    flecks.push({ x, y, vx: 0, vy: 0, age: 0, life: 1.5 + 2.5 * rng() });
  }
}
