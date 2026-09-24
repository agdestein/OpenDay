// Live illustrations for Gravity Doodle's delve chapters, drawn beside the
// chaptered panel (shell/delve.ts): four speeds from one spot, the two-body
// dance, Euler against symplectic steps (with their energy), chaos twins in
// a three-body system, the Apollo free-return figure-8, and a cloud of
// possible asteroids. Each chapter's demo lives in fixed world coordinates
// fitted to the free canvas area.
import { fmtNumber, pick, type Localized } from '../../lib/i18n';
import type { Integrator } from './delve';
import { Defense, DEFENSE } from './defense';
import { drawEarth } from './draw';

export type ThreeBody = 'wild' | 'dance';

interface Pt {
  x: number;
  y: number;
}

const TEXT: Localized<{
  shapesLabels: [string, string, string, string];
  shapesCaption: string;
  balancePoint: string;
  samePull: string;
  heavyWobble: string;
  lightBig: string;
  stepsTitleEuler: string;
  stepsTitleSymplectic: string;
  trueOrbit: string;
  stepsEnergyEuler: string;
  stepsEnergySymplectic: string;
  trueEnergy: string;
  moonGrip: string;
  ghostFallsShort: string;
  earth: string;
  moon: string;
  splashdown: string;
  slingshot: string;
  stepsCost: (n: string) => string;
  twins: string;
  twinsDiff: (d: string) => string;
  danceTitle: string;
  wildTitle: string;
  chance: (p: string) => string;
  looked: string;
  cloudCaption: string;
  impactDay: string;
  endHit: string;
  endMiss: string;
}> = {
  en: {
    shapesLabels: [
      '35% of circle speed — falls into the Sun 💥',
      '100% — a perfect circle',
      '120% — an ellipse',
      '150% (more than √2) — escapes forever 🚀',
    ],
    shapesCaption: 'same spot, different speed',
    balancePoint: 'balance point',
    samePull: 'same pull, both ways!',
    heavyWobble: '4× the mass → small wobble',
    lightBig: 'light → big orbit, high speed',
    stepsTitleEuler: '📐 simple steps (Euler, 1768) — watch it drift!',
    stepsTitleSymplectic: '🪄 smart steps (symplectic) — it stays!',
    trueOrbit: 'true orbit',
    stepsEnergyEuler: 'energy the computer thinks it has — growing out of nothing!',
    stepsEnergySymplectic: 'energy — wobbles, but never drifts away',
    trueEnergy: 'true energy –',
    moonGrip: "the Moon's grip",
    ghostFallsShort: '👻 without the Moon: falls short!',
    earth: '🌍 Earth',
    moon: '🌕 Moon',
    splashdown: '🌊 splashdown — home for free!',
    slingshot: 'gravity slingshot!',
    stepsCost: (n) => `Smart steps: 40 per orbit. Simple steps need about ${n} for the same accuracy over five orbits.`,
    twins: 'filled: the stars · rings: their twins, one star moved by a millionth',
    twinsDiff: (d) => `biggest difference between the twins: ${d}`,
    danceTitle: '✨ three stars on one figure-8 (Moore 1993)',
    wildTitle: '🌪 three stars let go from rest (Burrau 1913)',
    chance: (p) => `☄️ chance of impact: ${p}`,
    looked: '🔭 a closer look!',
    cloudCaption: 'every dot is an asteroid it could be; red ones hit Earth',
    impactDay: 'impact day?',
    endHit: '💥 a hit — that one needed a push, years early',
    endMiss: '😅 a near miss: Earth is safe',
  },
  nl: {
    shapesLabels: [
      '35% van de cirkelsnelheid — valt in de Zon 💥',
      '100% — een perfecte cirkel',
      '120% — een ellips',
      '150% (meer dan √2) — ontsnapt voorgoed 🚀',
    ],
    shapesCaption: 'zelfde plek, andere snelheid',
    balancePoint: 'zwaartepunt',
    samePull: 'zelfde trekkracht, twee kanten op!',
    heavyWobble: '4× de massa → kleine wiebel',
    lightBig: 'licht → grote baan, hoge snelheid',
    stepsTitleEuler: '📐 simpele stappen (Euler, 1768) — kijk hem wegdrijven!',
    stepsTitleSymplectic: '🪄 slimme stappen (symplectisch) — hij blijft!',
    trueOrbit: 'echte baan',
    stepsEnergyEuler: 'energie die de computer denkt te hebben — groeit uit het niets!',
    stepsEnergySymplectic: 'energie — wiebelt, maar drijft nooit weg',
    trueEnergy: 'echte energie –',
    moonGrip: 'de greep van de Maan',
    ghostFallsShort: '👻 zonder de Maan: komt tekort!',
    earth: '🌍 Aarde',
    moon: '🌕 Maan',
    splashdown: '🌊 landing op zee — gratis naar huis!',
    slingshot: 'zwaartekracht-slingerschot!',
    stepsCost: (n) => `Slimme stappen: 40 per rondje. Simpele stappen hebben er ongeveer ${n} nodig om vijf rondjes even nauwkeurig te blijven.`,
    twins: 'gevuld: de sterren · ringen: hun tweelingen, één ster een miljoenste verschoven',
    twinsDiff: (d) => `grootste verschil tussen de tweelingen: ${d}`,
    danceTitle: '✨ drie sterren op één 8 (Moore 1993)',
    wildTitle: '🌪 drie sterren losgelaten vanuit stilstand (Burrau 1913)',
    chance: (p) => `☄️ kans op inslag: ${p}`,
    looked: '🔭 beter gekeken!',
    cloudCaption: 'elke stip is een planetoïde die het zou kunnen zijn; de rode raken de Aarde',
    impactDay: 'inslagdag?',
    endHit: '💥 raak — die had jaren eerder een duw nodig',
    endMiss: '😅 net mis: de Aarde is veilig',
  },
  no: {
    shapesLabels: [
      '35 % av sirkelfarten — faller i Solen 💥',
      '100 % — en perfekt sirkel',
      '120 % — en ellipse',
      '150 % (mer enn √2) — unnslipper for godt 🚀',
    ],
    shapesCaption: 'samme sted, ulik fart',
    balancePoint: 'tyngdepunkt',
    samePull: 'samme drag, begge veier!',
    heavyWobble: '4× massen → liten vakling',
    lightBig: 'lett → stor bane, høy fart',
    stepsTitleEuler: '📐 enkle steg (Euler, 1768) — se den drive utover!',
    stepsTitleSymplectic: '🪄 smarte steg (symplektisk) — den blir værende!',
    trueOrbit: 'ekte bane',
    stepsEnergyEuler: 'energien datamaskinen tror den har — vokser ut av ingenting!',
    stepsEnergySymplectic: 'energi — vakler, men driver aldri bort',
    trueEnergy: 'ekte energi –',
    moonGrip: 'Månens grep',
    ghostFallsShort: '👻 uten Månen: kommer for kort!',
    earth: '🌍 Jorden',
    moon: '🌕 Månen',
    splashdown: '🌊 landing i havet — gratis hjem!',
    slingshot: 'tyngdekraft-slyngeskudd!',
    stepsCost: (n) => `Smarte steg: 40 per runde. Enkle steg trenger omtrent ${n} for å holde seg like nøyaktige i fem runder.`,
    twins: 'fylte: stjernene · ringer: tvillingene deres, én stjerne flyttet en milliondel',
    twinsDiff: (d) => `største forskjell mellom tvillingene: ${d}`,
    danceTitle: '✨ tre stjerner på ett 8-tall (Moore 1993)',
    wildTitle: '🌪 tre stjerner sluppet fra ro (Burrau 1913)',
    chance: (p) => `☄️ sjanse for nedslag: ${p}`,
    looked: '🔭 en nærmere titt!',
    cloudCaption: 'hver prikk er en asteroide den kan være; de røde treffer Jorden',
    impactDay: 'nedslagsdagen?',
    endHit: '💥 treff — den trengte et dytt, flere år i forveien',
    endMiss: '😅 så vidt bom: Jorden er trygg',
  },
};

// ---- delve demo worlds (fixed world coordinates, fitted to the canvas) ----

interface ShapeBody {
  f: number;
  color: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: Pt[];
  alive: boolean;
  respawn: number;
}

type Demo =
  | { kind: 'shapes'; bodies: ShapeBody[] }
  | {
      kind: 'newton';
      b1: { x: number; y: number; vx: number; vy: number; trail: Pt[] };
      b2: { x: number; y: number; vx: number; vy: number; trail: Pt[] };
    }
  | {
      kind: 'steps';
      x: number;
      y: number;
      vx: number;
      vy: number;
      path: Pt[];
      energies: number[];
      timer: number;
    }
  | {
      kind: 'moon';
      path: { x: number; y: number; vx: number; vy: number }[];
      /** Same launch with the Moon's gravity switched off: falls short. */
      ghost: { x: number; y: number; vx: number; vy: number }[];
      idx: number;
      hold: number;
    }
  | {
      kind: 'chaos';
      mode: ThreeBody;
      /** Two copies of the same three stars; the second has one star nudged. */
      a: Star3[];
      b: Star3[];
      t: number;
      worst: number;
    }
  | { kind: 'asteroid'; model: Defense; acc: number; hold: number; flash: number; miss: boolean };

interface Star3 {
  x: number;
  y: number;
  vx: number;
  vy: number;
  m: number;
  trail: Pt[];
}

const SHAPES = { gm: 1.44e6, R: 170, sunR: 14 };
const NEWTON = { s: 190, m1: 4, m2: 1, period: 9 };
/** Three bodies: G = 1, fixed small steps, a little softening for the close passes. */
const THREE = { h: 0.0005, soft2: 0.002, speed: 1.6, nudge: 1e-6, wildEnd: 30, danceEnd: 40 };
/** The asteroid demo: years per second, and when it looks through the telescope. */
const CLOUD = { yearsPerSecond: 0.45, looks: [0.8, 1.6, 2.4] };

/** How many simple (Euler) steps per orbit match 40 smart ones over five orbits. */
let eulerCost: number | null = null;
function stepsForEuler(): number {
  if (eulerCost !== null) return eulerCost;
  const run = (euler: boolean, n: number) => {
    let x = 1, y = 0, vx = 0, vy = 1, worst = 0;
    const h = (2 * Math.PI) / n;
    for (let i = 0; i < 5 * n; i++) {
      const r3 = Math.hypot(x, y) ** 3;
      const ax = -x / r3, ay = -y / r3;
      if (euler) { x += h * vx; y += h * vy; vx += h * ax; vy += h * ay; }
      else { vx += h * ax; vy += h * ay; x += h * vx; y += h * vy; }
      worst = Math.max(worst, Math.abs(Math.hypot(x, y) - 1));
    }
    return worst;
  };
  const target = run(false, STEPS.perOrbit);
  let n = STEPS.perOrbit;
  while (run(true, n) > target && n < 1e5) n = Math.ceil(n * 1.05);
  return (eulerCost = n);
}
const STEPS = { gm: 2e6, R: 150, perOrbit: 40, maxSteps: 78, every: 0.24 };
// f and the Moon's mass are tuned by hand so that, with this integrator and
// dt, the path is the iconic self-crossing figure-8: out on one side, a full
// loop around the Moon, and home on the other side in ~10 s. The Moon is
// heavier than the real one (1/20 of Earth instead of 1/81) so the loop is
// big enough to read from across a room. The same launch with the Moon's
// gravity switched off turns back 4 units short of the Moon's "grip" circle.
const MOON = { D: 420, gmE: 4e6, gmM: 4e6 / 20, r0: 45, f: 1.326, dt: 0.02 };

export class OrbitsDemos {
  private demo: Demo | null = null;
  integrator: Integrator = 'euler';
  threeBody: ThreeBody = 'wild';
  private lastMiss = true;

  reset(chapter: number): void {
    this.resetDemo(chapter);
  }

  clear(): void {
    this.demo = null;
  }

  step(dt: number): void {
    this.stepDemo(dt);
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawDelve(ctx, w, h);
  }

  private resetDemo(chapter: number): void {
    if (chapter === 0) {
      const vc = Math.sqrt(SHAPES.gm / SHAPES.R);
      const make = (f: number, color: string, label: string): ShapeBody => ({
        f,
        color,
        label,
        x: -SHAPES.R,
        y: 0,
        vx: 0,
        vy: f * vc,
        trail: [],
        alive: true,
        respawn: 0,
      });
      const labels = pick(TEXT).shapesLabels;
      this.demo = {
        kind: 'shapes',
        bodies: [
          make(0.35, '#f87171', labels[0]),
          make(1.0, '#4ade80', labels[1]),
          make(1.2, '#7dd3fc', labels[2]),
          make(1.5, '#fb923c', labels[3]),
        ],
      };
    } else if (chapter === 1) {
      const { s, m1, m2, period } = NEWTON;
      const omega = (2 * Math.PI) / period;
      const r1 = (s * m2) / (m1 + m2);
      const r2 = (s * m1) / (m1 + m2);
      this.demo = {
        kind: 'newton',
        b1: { x: -r1, y: 0, vx: 0, vy: -omega * r1, trail: [] },
        b2: { x: r2, y: 0, vx: 0, vy: omega * r2, trail: [] },
      };
    } else if (chapter === 2) {
      this.demo = {
        kind: 'steps',
        x: STEPS.R,
        y: 0,
        vx: 0,
        vy: Math.sqrt(STEPS.gm / STEPS.R),
        path: [{ x: STEPS.R, y: 0 }],
        energies: [this.orbitEnergy(STEPS.gm, STEPS.R, 0, 0, Math.sqrt(STEPS.gm / STEPS.R))],
        timer: 0,
      };
    } else if (chapter === 3) {
      const a = this.threeStars(this.threeBody);
      const b = this.threeStars(this.threeBody);
      b[0].x += THREE.nudge;
      this.demo = { kind: 'chaos', mode: this.threeBody, a, b, t: 0, worst: 0 };
    } else if (chapter === 4) {
      this.demo = {
        kind: 'moon',
        path: this.computeMoonPath(true),
        ghost: this.computeMoonPath(false),
        idx: 0,
        hold: 0,
      };
    } else {
      // Every other run the real asteroid is nudged (it alone, not the cloud) so it
      // just misses: looking then brings the chance down to zero, as with 2024 YR4.
      const model = new Defense(Math.floor(Math.random() * 1e9));
      const miss = !this.lastMiss;
      this.lastMiss = miss;
      if (miss) {
        for (const k of [0.0015, 0.003, 0.006]) {
          const t = { ...model.truth, vx: model.truth.vx * (1 + k), vy: model.truth.vy * (1 + k) };
          if (!model.forecast(0, 0, [t])[0]) {
            model.truth = t;
            break;
          }
        }
      }
      this.demo = { kind: 'asteroid', model, acc: 0, hold: 0, flash: 0, miss };
    }
  }

  /** Burrau's Pythagorean problem (masses 3, 4, 5 at rest on a 3-4-5 triangle), or the figure-8 choreography. */
  private threeStars(mode: ThreeBody): Star3[] {
    if (mode === 'wild') {
      return [
        { x: 1, y: 3, vx: 0, vy: 0, m: 3, trail: [] },
        { x: -2, y: -1, vx: 0, vy: 0, m: 4, trail: [] },
        { x: 1, y: -1, vx: 0, vy: 0, m: 5, trail: [] },
      ];
    }
    const x1 = 0.97000436, y1 = -0.24308753, vx3 = -0.93240737, vy3 = -0.86473146;
    return [
      { x: x1, y: y1, vx: -vx3 / 2, vy: -vy3 / 2, m: 1, trail: [] },
      { x: -x1, y: -y1, vx: -vx3 / 2, vy: -vy3 / 2, m: 1, trail: [] },
      { x: 0, y: 0, vx: vx3, vy: vy3, m: 1, trail: [] },
    ];
  }

  /** One velocity-Verlet step for three stars (G = 1, softened). */
  private step3(S: Star3[], h: number): void {
    const acc = () =>
      S.map((a, i) => {
        let ax = 0, ay = 0;
        S.forEach((b, j) => {
          if (i === j) return;
          const dx = b.x - a.x, dy = b.y - a.y;
          const d2 = dx * dx + dy * dy + THREE.soft2;
          const inv = b.m / (d2 * Math.sqrt(d2));
          ax += dx * inv;
          ay += dy * inv;
        });
        return [ax, ay];
      });
    let A = acc();
    S.forEach((s, i) => {
      s.vx += 0.5 * h * A[i][0];
      s.vy += 0.5 * h * A[i][1];
      s.x += h * s.vx;
      s.y += h * s.vy;
    });
    A = acc();
    S.forEach((s, i) => {
      s.vx += 0.5 * h * A[i][0];
      s.vy += 0.5 * h * A[i][1];
    });
  }

  private orbitEnergy(gm: number, x: number, y: number, vx: number, vy: number): number {
    return (vx * vx + vy * vy) / 2 - gm / Math.hypot(x, y);
  }

  /** Semi-implicit Euler substep for a point mass around a sun at the origin. */
  private substep(
    gm: number,
    b: { x: number; y: number; vx: number; vy: number },
    step: number,
  ): void {
    const r2 = Math.max(b.x * b.x + b.y * b.y, 25);
    const a = -gm / (r2 * Math.sqrt(r2));
    b.vx += a * b.x * step;
    b.vy += a * b.y * step;
    b.x += b.vx * step;
    b.y += b.vy * step;
  }

  /** The Apollo-style free-return figure-8 around a static Earth and Moon. */
  private computeMoonPath(moonOn: boolean): { x: number; y: number; vx: number; vy: number }[] {
    const { D, gmE, gmM, r0, f, dt } = MOON;
    let x = -r0;
    let y = 0;
    let vx = 0;
    let vy = -f * Math.sqrt(gmE / r0);
    const path = [{ x, y, vx, vy }];
    for (let t = 0; t < 25; t += dt) {
      const dE = Math.hypot(x, y);
      const dM = Math.hypot(x - D, y);
      const aE = -gmE / (dE * dE * dE);
      const aM = moonOn ? -gmM / (dM * dM * dM) : 0;
      vx += (aE * x + aM * (x - D)) * dt;
      vy += (aE * y + aM * y) * dt;
      x += vx * dt;
      y += vy * dt;
      path.push({ x, y, vx, vy });
      if (t > 2 && dE < r0 + 25) break;
    }
    return path;
  }

  private stepDemo(dt: number): void {
    const demo = this.demo;
    if (!demo) return;
    const h = 1 / 240;

    if (demo.kind === 'shapes') {
      const vc = Math.sqrt(SHAPES.gm / SHAPES.R);
      for (const b of demo.bodies) {
        if (!b.alive) {
          b.respawn -= dt;
          if (b.respawn <= 0) {
            b.x = -SHAPES.R;
            b.y = 0;
            b.vx = 0;
            b.vy = b.f * vc;
            b.trail = [];
            b.alive = true;
          }
          continue;
        }
        for (let t = 0; t < dt; t += h) this.substep(SHAPES.gm, b, h);
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 720) b.trail.shift();
        const r = Math.hypot(b.x, b.y);
        if (r < SHAPES.sunR || r > 900) {
          b.alive = false;
          b.respawn = 1.4;
        }
      }
    } else if (demo.kind === 'newton') {
      const { m1, m2, s, period } = NEWTON;
      const omega = (2 * Math.PI) / period;
      const mu = omega * omega * s * s * s; // G(m1+m2)
      const g1 = (mu * m1) / (m1 + m2); // G·m1
      const g2 = (mu * m2) / (m1 + m2); // G·m2
      for (let t = 0; t < dt; t += h) {
        const dx = demo.b2.x - demo.b1.x;
        const dy = demo.b2.y - demo.b1.y;
        const r2 = dx * dx + dy * dy;
        const r = Math.sqrt(r2);
        // b1 is pulled toward b2 by G·m2, and vice versa (equal, opposite force).
        demo.b1.vx += ((g2 / r2) * dx) / r * h;
        demo.b1.vy += ((g2 / r2) * dy) / r * h;
        demo.b2.vx -= ((g1 / r2) * dx) / r * h;
        demo.b2.vy -= ((g1 / r2) * dy) / r * h;
        demo.b1.x += demo.b1.vx * h;
        demo.b1.y += demo.b1.vy * h;
        demo.b2.x += demo.b2.vx * h;
        demo.b2.y += demo.b2.vy * h;
      }
      demo.b1.trail.push({ x: demo.b1.x, y: demo.b1.y });
      demo.b2.trail.push({ x: demo.b2.x, y: demo.b2.y });
      if (demo.b1.trail.length > 400) demo.b1.trail.shift();
      if (demo.b2.trail.length > 400) demo.b2.trail.shift();
    } else if (demo.kind === 'chaos') {
      const span = dt * THREE.speed;
      for (let t = 0; t < span; t += THREE.h) {
        this.step3(demo.a, THREE.h);
        this.step3(demo.b, THREE.h);
      }
      demo.t += span;
      for (const S of [demo.a, demo.b]) {
        for (const st of S) {
          st.trail.push({ x: st.x, y: st.y });
          if (st.trail.length > 260) st.trail.shift();
        }
      }
      demo.worst = Math.max(...demo.a.map((s, i) => Math.hypot(s.x - demo.b[i].x, s.y - demo.b[i].y)));
      const gone = demo.a.some((s) => Math.hypot(s.x, s.y) > 12);
      if (demo.t > (demo.mode === 'wild' ? THREE.wildEnd : THREE.danceEnd) || gone) this.resetDemo(3);
    } else if (demo.kind === 'asteroid') {
      const m = demo.model;
      demo.flash = Math.max(0, demo.flash - dt);
      if (m.over) {
        demo.hold += dt;
        if (demo.hold > 2) this.resetDemo(5);
        return;
      }
      demo.acc += dt * CLOUD.yearsPerSecond * DEFENSE.stepsPerYear;
      while (demo.acc >= 1 && !m.over) {
        demo.acc -= 1;
        m.advance();
        if (CLOUD.looks[m.looks] !== undefined && m.years >= CLOUD.looks[m.looks] && m.look()) demo.flash = 1.2;
      }
    } else if (demo.kind === 'steps') {
      demo.timer += dt;
      if (demo.timer >= STEPS.every) {
        demo.timer = 0;
        const T = 2 * Math.PI * Math.sqrt(STEPS.R ** 3 / STEPS.gm);
        const big = T / STEPS.perOrbit;
        const ox = demo.x;
        const oy = demo.y;
        const r2 = Math.max(ox * ox + oy * oy, 25);
        const a = -STEPS.gm / (r2 * Math.sqrt(r2));
        if (this.integrator === 'euler') {
          // Forward Euler: move along the OLD velocity, then update it with
          // the pull at the OLD position.
          demo.x += demo.vx * big;
          demo.y += demo.vy * big;
          demo.vx += a * ox * big;
          demo.vy += a * oy * big;
        } else {
          // Symplectic Euler: update the velocity first, step with the new one.
          demo.vx += a * demo.x * big;
          demo.vy += a * demo.y * big;
          demo.x += demo.vx * big;
          demo.y += demo.vy * big;
        }
        demo.path.push({ x: demo.x, y: demo.y });
        demo.energies.push(this.orbitEnergy(STEPS.gm, demo.x, demo.y, demo.vx, demo.vy));
        const gone = Math.hypot(demo.x, demo.y) > STEPS.R * 3.4;
        if (demo.path.length > STEPS.maxSteps || gone) this.resetDemo(2);
      }
    } else if (demo.kind === 'moon') {
      if (demo.idx >= demo.path.length - 1) {
        demo.hold += dt;
        if (demo.hold > 1.6) this.resetDemo(4);
        return;
      }
      demo.idx = Math.min(demo.path.length - 1, demo.idx + dt / MOON.dt);
    }
  }

  // ---- delve rendering (one live illustration per chapter, beside the panel) ----

  private drawDelve(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const panelW = Math.min(500, w * 0.46);
    const area = { x0: panelW + 30, y0: 72, x1: w - 30, y1: h - 24 }; // below the corner pill
    const demo = this.demo;
    if (!demo) return;
    if (demo.kind === 'shapes') this.drawShapes(ctx, area, demo);
    else if (demo.kind === 'newton') this.drawNewton(ctx, area, demo);
    else if (demo.kind === 'chaos') this.drawChaos(ctx, area, demo);
    else if (demo.kind === 'asteroid') this.drawAsteroid(ctx, area, demo);
    else if (demo.kind === 'steps') this.drawSteps(ctx, area, demo);
    else this.drawMoon(ctx, area, demo);
  }

  /** World bbox -> screen transform, aspect-preserving, centered in a rect. */
  private fit(
    area: { x0: number; y0: number; x1: number; y1: number },
    bbox: { x0: number; y0: number; x1: number; y1: number },
  ): { s: number; ox: number; oy: number } {
    const s = Math.min(
      (area.x1 - area.x0) / (bbox.x1 - bbox.x0),
      (area.y1 - area.y0) / (bbox.y1 - bbox.y0),
    );
    return {
      s,
      ox: (area.x0 + area.x1) / 2 - (s * (bbox.x0 + bbox.x1)) / 2,
      oy: (area.y0 + area.y1) / 2 - (s * (bbox.y0 + bbox.y1)) / 2,
    };
  }

  private arrow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    dx: number,
    dy: number,
    color: string,
    width = 3,
  ): void {
    const len = Math.hypot(dx, dy);
    if (len < 4) return;
    const ux = dx / len;
    const uy = dy / len;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx - ux * 8, y + dy - uy * 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + dx, y + dy);
    ctx.lineTo(x + dx - ux * 10 - uy * 5, y + dy - uy * 10 + ux * 5);
    ctx.lineTo(x + dx - ux * 10 + uy * 5, y + dy - uy * 10 - ux * 5);
    ctx.closePath();
    ctx.fill();
  }

  private caption(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
    ctx.fillStyle = 'rgba(238, 242, 255, 0.75)';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
  }

  /** Chapter 1: same launch spot, four speeds, four fates. */
  private drawShapes(
    ctx: CanvasRenderingContext2D,
    area: { x0: number; y0: number; x1: number; y1: number },
    demo: Extract<Demo, { kind: 'shapes' }>,
  ): void {
    const legendH = 118;
    const view = { ...area, y0: area.y0 + legendH };
    const { s, ox, oy } = this.fit(view, { x0: -260, y0: -300, x1: 500, y1: 300 });
    const X = (x: number) => ox + s * x;
    const Y = (y: number) => oy + s * y;

    this.drawSun(ctx, X(0), Y(0), SHAPES.sunR * s);

    // Launch point marker.
    ctx.fillStyle = 'rgba(238, 242, 255, 0.9)';
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🚀', X(-SHAPES.R), Y(0) + 6);
    this.caption(ctx, pick(TEXT).shapesCaption, X(-SHAPES.R), Y(0) + 28);

    for (const b of demo.bodies) {
      if (b.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(X(b.trail[0].x), Y(b.trail[0].y));
        for (const t of b.trail) ctx.lineTo(X(t.x), Y(t.y));
        ctx.strokeStyle = b.color + 'aa';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (b.alive) {
        ctx.beginPath();
        ctx.arc(X(b.x), Y(b.y), 7, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
      }
    }

    // Legend at the top of the demo area.
    ctx.textAlign = 'left';
    ctx.font = '600 15px system-ui, sans-serif';
    demo.bodies.forEach((b, i) => {
      const y = area.y0 + 18 + i * 26;
      ctx.beginPath();
      ctx.arc(area.x0 + 12, y - 5, 6, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.fillStyle = 'rgba(238, 242, 255, 0.85)';
      ctx.fillText(b.label, area.x0 + 26, y);
    });
  }

  /** Chapter 2: two-body dance with equal-and-opposite force arrows. */
  private drawNewton(
    ctx: CanvasRenderingContext2D,
    area: { x0: number; y0: number; x1: number; y1: number },
    demo: Extract<Demo, { kind: 'newton' }>,
  ): void {
    const { s, ox, oy } = this.fit(area, { x0: -240, y0: -240, x1: 240, y1: 240 });
    const X = (x: number) => ox + s * x;
    const Y = (y: number) => oy + s * y;
    const { b1, b2 } = demo;

    for (const [b, color] of [
      [b1, 'rgba(251, 191, 36, 0.5)'],
      [b2, 'rgba(125, 211, 252, 0.5)'],
    ] as const) {
      if (b.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(X(b.trail[0].x), Y(b.trail[0].y));
        for (const t of b.trail) ctx.lineTo(X(t.x), Y(t.y));
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Balance point (barycenter) at the world origin.
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X(0) - 8, Y(0));
    ctx.lineTo(X(0) + 8, Y(0));
    ctx.moveTo(X(0), Y(0) - 8);
    ctx.lineTo(X(0), Y(0) + 8);
    ctx.stroke();
    this.caption(ctx, pick(TEXT).balancePoint, X(0), Y(0) - 14);

    // Bodies: heavy star and light planet.
    ctx.beginPath();
    ctx.arc(X(b1.x), Y(b1.y), 26, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(X(b2.x), Y(b2.y), 11, 0, Math.PI * 2);
    ctx.fillStyle = '#7dd3fc';
    ctx.fill();

    // Equal and opposite gravity arrows (deliberately the same length).
    const dx = X(b2.x) - X(b1.x);
    const dy = Y(b2.y) - Y(b1.y);
    const d = Math.hypot(dx, dy);
    const L = 52;
    this.arrow(ctx, X(b1.x) + (dx / d) * 30, Y(b1.y) + (dy / d) * 30, (dx / d) * L, (dy / d) * L, '#fb923c', 4);
    this.arrow(ctx, X(b2.x) - (dx / d) * 15, Y(b2.y) - (dy / d) * 15, (-dx / d) * L, (-dy / d) * L, '#fb923c', 4);
    this.caption(ctx, pick(TEXT).samePull, X((b1.x + b2.x) / 2), Y((b1.y + b2.y) / 2) - 16);

    // Velocity arrows: the light one visibly faster.
    const vScale = 1.1 * s;
    this.arrow(ctx, X(b1.x), Y(b1.y), b1.vx * vScale, b1.vy * vScale, '#4ade80', 3);
    this.arrow(ctx, X(b2.x), Y(b2.y), b2.vx * vScale, b2.vy * vScale, '#4ade80', 3);

    ctx.font = '700 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(pick(TEXT).heavyWobble, X(b1.x), Y(b1.y) + 48);
    ctx.fillStyle = '#7dd3fc';
    ctx.fillText(pick(TEXT).lightBig, X(b2.x), Y(b2.y) - 26);
  }

  /** Chapter 3: giant visible integration steps, Euler vs symplectic, and what accuracy costs. */
  private drawSteps(
    ctx: CanvasRenderingContext2D,
    area: { x0: number; y0: number; x1: number; y1: number },
    demo: Extract<Demo, { kind: 'steps' }>,
  ): void {
    const plotH = Math.min(180, (area.y1 - area.y0) * 0.3);
    const orbitArea = { ...area, y0: area.y0 + 34, y1: area.y1 - plotH - 30 };
    const euler = this.integrator === 'euler';
    const span = euler ? 500 : 260;
    const { s, ox, oy } = this.fit(orbitArea, { x0: -span, y0: -span, x1: span, y1: span });
    const X = (x: number) => ox + s * x;
    const Y = (y: number) => oy + s * y;

    const t = pick(TEXT);
    ctx.fillStyle = euler ? '#fb923c' : '#4ade80';
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      euler ? t.stepsTitleEuler : t.stepsTitleSymplectic,
      (area.x0 + area.x1) / 2,
      area.y0 + 12,
    );

    this.drawSun(ctx, X(0), Y(0), 12 * s);
    // The true orbit, for reference.
    ctx.beginPath();
    ctx.arc(X(0), Y(0), STEPS.R * s, 0, Math.PI * 2);
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
    this.caption(ctx, t.trueOrbit, X(0), Y(0) - STEPS.R * s - 8);

    // The step polygon: straight hops with a dot at every step.
    const color = euler ? '#fb923c' : '#4ade80';
    if (demo.path.length > 1) {
      ctx.beginPath();
      ctx.moveTo(X(demo.path[0].x), Y(demo.path[0].y));
      for (const p of demo.path) ctx.lineTo(X(p.x), Y(p.y));
      ctx.strokeStyle = color + 'cc';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    for (const p of demo.path) {
      ctx.beginPath();
      ctx.arc(X(p.x), Y(p.y), 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(X(demo.x), Y(demo.y), 8, 0, Math.PI * 2);
    ctx.fillStyle = '#eef2ff';
    ctx.fill();

    // Where the next straight hop will land.
    const T = 2 * Math.PI * Math.sqrt(STEPS.R ** 3 / STEPS.gm);
    const big = T / STEPS.perOrbit;
    this.arrow(ctx, X(demo.x), Y(demo.y), demo.vx * big * s, demo.vy * big * s, 'rgba(238, 242, 255, 0.6)', 2);

    // Energy per step, relative to the true value.
    const e0 = demo.energies[0];
    const px0 = area.x0 + 46;
    const px1 = area.x1 - 12;
    const py1 = area.y1 - 22;
    const py0 = py1 - plotH;
    const rel = demo.energies.map((e) => (e - e0) / Math.abs(e0));
    const range = Math.max(0.5, ...rel.map((r) => Math.abs(r) * 1.2));
    const yOf = (r: number) => py1 - ((r + range) / (2 * range)) * plotH;
    const xOf = (i: number) => px0 + (i / (STEPS.maxSteps - 1)) * (px1 - px0);

    ctx.strokeStyle = 'rgba(238, 242, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px0, py0, px1 - px0, py1 - py0);
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(px0, yOf(0));
    ctx.lineTo(px1, yOf(0));
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.5)';
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    rel.forEach((r, i) => {
      const x = xOf(i);
      const y = yOf(r);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(238, 242, 255, 0.75)';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      euler ? t.stepsEnergyEuler : t.stepsEnergySymplectic,
      px0 + 10,
      py0 - 8,
    );
    ctx.textAlign = 'right';
    ctx.fillText(t.trueEnergy, px0 - 4, yOf(0) + 4);
    // What accuracy costs: the same closeness with simple steps takes ~100× the work.
    this.caption(ctx, t.stepsCost(fmtNumber(stepsForEuler())), (area.x0 + area.x1) / 2, area.y0 + 34);
  }

  /** Chapter 4: two copies of three stars, one nudged by a millionth; filled vs ringed. */
  private drawChaos(
    ctx: CanvasRenderingContext2D,
    area: { x0: number; y0: number; x1: number; y1: number },
    demo: Extract<Demo, { kind: 'chaos' }>,
  ): void {
    const t = pick(TEXT);
    const box = demo.mode === 'wild' ? 4.2 : 1.4;
    const view = { ...area, y0: area.y0 + 56, y1: area.y1 - 30 };
    const { s, ox, oy } = this.fit(view, { x0: -box, y0: -box, x1: box, y1: box });
    const X = (x: number) => ox + s * x;
    const Y = (y: number) => oy + s * y;
    const hues = [200, 45, 330];
    ctx.fillStyle = demo.mode === 'wild' ? '#fdba74' : '#86efac';
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(demo.mode === 'wild' ? t.wildTitle : t.danceTitle, (area.x0 + area.x1) / 2, area.y0 + 12);
    this.caption(ctx, t.twins, (area.x0 + area.x1) / 2, area.y0 + 36);

    const drawSet = (S: Star3[], twin: boolean) => {
      S.forEach((st, i) => {
        if (st.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(X(st.trail[0].x), Y(st.trail[0].y));
          for (const p of st.trail) ctx.lineTo(X(p.x), Y(p.y));
          if (twin) ctx.setLineDash([3, 5]);
          ctx.strokeStyle = `hsla(${hues[i]}, 90%, 70%, ${twin ? 0.6 : 0.45})`;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.setLineDash([]);
        }
        const r = 5 + 2.2 * Math.sqrt(st.m);
        ctx.beginPath();
        ctx.arc(X(st.x), Y(st.y), twin ? r + 4 : r, 0, Math.PI * 2);
        if (twin) {
          ctx.strokeStyle = `hsl(${hues[i]}, 90%, 75%)`;
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.fillStyle = `hsl(${hues[i]}, 95%, 65%)`;
          ctx.fill();
        }
      });
    };
    drawSet(demo.a, false);
    drawSet(demo.b, true);
    const d = demo.worst;
    const txt = d < 1e-3 ? d.toExponential(0).replace('e', '×10^') : fmtNumber(d, { maximumFractionDigits: 2 });
    ctx.fillStyle = d > 0.3 ? '#fca5a5' : 'rgba(238, 242, 255, 0.8)';
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t.twinsDiff(txt), (area.x0 + area.x1) / 2, area.y1 - 6);
  }

  /** Chapter 6: a cloud of possible asteroids, looked at three times; the chance of impact moves. */
  private drawAsteroid(
    ctx: CanvasRenderingContext2D,
    area: { x0: number; y0: number; x1: number; y1: number },
    demo: Extract<Demo, { kind: 'asteroid' }>,
  ): void {
    const t = pick(TEXT);
    const m = demo.model;
    const view = { ...area, y0: area.y0 + 60, y1: area.y1 - 20 };
    const { s, ox, oy } = this.fit(view, { x0: -2.05, y0: -2.05, x1: 2.05, y1: 2.05 });
    const X = (x: number) => ox + s * x;
    const Y = (y: number) => oy + s * y;
    const chance = fmtNumber(Math.round(100 * m.chance)) + ' %';
    ctx.fillStyle = m.chance > 0.5 ? '#fca5a5' : '#fde68a';
    ctx.font = '800 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t.chance(chance), (area.x0 + area.x1) / 2, area.y0 + 18);
    this.caption(ctx, t.cloudCaption, (area.x0 + area.x1) / 2, area.y0 + 42);
    if (demo.flash > 0) {
      ctx.globalAlpha = Math.min(1, demo.flash);
      ctx.fillStyle = '#7dd3fc';
      ctx.font = '800 18px system-ui, sans-serif';
      ctx.fillText(t.looked, (area.x0 + area.x1) / 2, Y(-1.75));
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.arc(X(0), Y(0), s, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    this.drawSun(ctx, X(0), Y(0), 0.13 * s);
    if (m.step < m.impactStep) {
      const [ix, iy] = m.earthAt((m.impactStep * 2 * Math.PI) / DEFENSE.stepsPerYear);
      ctx.beginPath();
      ctx.arc(X(ix), Y(iy), 10, 0, Math.PI * 2);
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = 'rgba(248, 113, 113, 0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      this.caption(ctx, t.impactDay, X(ix), Y(iy) - 16);
    }
    const [ex, ey] = m.earthAt(m.t);
    drawEarth(ctx, X(ex), Y(ey), 8);
    if (m.over) {
      ctx.fillStyle = m.truthHit ? '#fca5a5' : '#86efac';
      ctx.font = '800 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.truthHit ? t.endHit : t.endMiss, (area.x0 + area.x1) / 2, Y(1.75));
    }
    m.cloud.forEach((c, i) => {
      ctx.fillStyle = m.hits[i] ? '#f87171' : 'rgba(203, 213, 225, 0.75)';
      ctx.beginPath();
      ctx.arc(X(c.x), Y(c.y), 2.4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /** Chapter 5: the free-return figure-8 around the Moon, flown live. */
  private drawMoon(
    ctx: CanvasRenderingContext2D,
    area: { x0: number; y0: number; x1: number; y1: number },
    demo: Extract<Demo, { kind: 'moon' }>,
  ): void {
    const { D, gmE, gmM } = MOON;
    const { s, ox, oy } = this.fit(area, { x0: -120, y0: -150, x1: 525, y1: 175 });
    const X = (x: number) => ox + s * x;
    const Y = (y: number) => oy + s * y;

    // Gravity field: one small arrow per grid point, pointing where gravity
    // pulls. Length is proportional to the true field strength — so it decays
    // with 1/r² away from each body — capped only right next to them. Arrows
    // inside the Moon's grip (where its pull beats Earth's) are brighter, so
    // the Moon's little kingdom stands out.
    // The Moon's grip: inside this disk its pull is stronger than Earth's.
    // A soft fill (under the arrows), so it cannot be mistaken for an orbit.
    const gripR = D / (1 + Math.sqrt(gmE / gmM));
    const grip = ctx.createRadialGradient(X(D), Y(0), 0, X(D), Y(0), gripR * s);
    grip.addColorStop(0, 'rgba(148, 163, 184, 0.16)');
    grip.addColorStop(1, 'rgba(148, 163, 184, 0.04)');
    ctx.fillStyle = grip;
    ctx.beginPath();
    ctx.arc(X(D), Y(0), gripR * s, 0, Math.PI * 2);
    ctx.fill();
    this.caption(ctx, pick(TEXT).moonGrip, X(D), Y(-gripR) - 10);

    for (let wx = -100; wx <= 515; wx += 22) {
      for (let wy = -145; wy <= 170; wy += 22) {
        const dE = Math.hypot(wx, wy);
        const dM = Math.hypot(wx - D, wy);
        if (dE < 40 || dM < 14) continue;
        const gx = (-gmE * wx) / dE ** 3 + (-gmM * (wx - D)) / dM ** 3;
        const gy = (-gmE * wy) / dE ** 3 + (-gmM * wy) / dM ** 3;
        const g = Math.hypot(gx, gy);
        const len = Math.min(9, 0.085 * g) * s;
        if (len < 2.5) continue;
        const ux = gx / g;
        const uy = gy / g;
        const head = Math.min(3.5, 1.8 + len * 0.1);
        const moonWins = gmM / (dM * dM) > gmE / (dE * dE);
        ctx.strokeStyle = moonWins ? 'rgba(203, 213, 225, 0.6)' : 'rgba(148, 163, 184, 0.3)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(X(wx), Y(wy));
        ctx.lineTo(X(wx) + ux * len, Y(wy) + uy * len);
        // Small chevron head, scaled with the arrow.
        ctx.moveTo(X(wx) + ux * len - (ux + uy * 0.6) * head, Y(wy) + uy * len - (uy - ux * 0.6) * head);
        ctx.lineTo(X(wx) + ux * len, Y(wy) + uy * len);
        ctx.lineTo(X(wx) + ux * len - (ux - uy * 0.6) * head, Y(wy) + uy * len - (uy + ux * 0.6) * head);
        ctx.stroke();
      }
    }

    // Ghost mission: same launch, Moon's gravity switched off. It noses up to
    // the edge of the grip circle, falls short, and swings back — no Moon.
    const idx = Math.floor(demo.idx);
    const gIdx = Math.min(idx, demo.ghost.length - 1);
    const ghostDone = idx >= demo.ghost.length - 1;
    ctx.beginPath();
    ctx.moveTo(X(demo.ghost[0].x), Y(demo.ghost[0].y));
    for (let i = 1; i <= gIdx; i++) ctx.lineTo(X(demo.ghost[i].x), Y(demo.ghost[i].y));
    ctx.setLineDash([2, 6]);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
    if (!ghostDone) {
      const g = demo.ghost[gIdx];
      ctx.beginPath();
      ctx.arc(X(g.x), Y(g.y), 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Label the ghost only once the two ships have visibly parted ways.
      const real = demo.path[Math.min(idx, demo.path.length - 1)];
      if (Math.hypot(real.x - g.x, real.y - g.y) > 30) {
        ctx.fillStyle = 'rgba(203, 213, 225, 0.75)';
        ctx.font = '600 14px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(pick(TEXT).ghostFallsShort, X(g.x) + 12, Y(g.y) - 10);
      }
    }

    // Full planned figure-8, faint and dashed.
    ctx.beginPath();
    ctx.moveTo(X(demo.path[0].x), Y(demo.path[0].y));
    for (const p of demo.path) ctx.lineTo(X(p.x), Y(p.y));
    ctx.setLineDash([3, 7]);
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.28)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);

    // Earth and Moon.
    const earthR = Math.max(14, 16 * s);
    ctx.beginPath();
    ctx.arc(X(0), Y(0), earthR, 0, Math.PI * 2);
    ctx.fillStyle = '#3b82f6';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(X(0) - earthR * 0.25, Y(0) - earthR * 0.2, earthR * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#4ade80';
    ctx.fill();
    const moonR = Math.max(8, 9 * s);
    ctx.beginPath();
    ctx.arc(X(MOON.D), Y(0), moonR, 0, Math.PI * 2);
    ctx.fillStyle = '#cbd5e1';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(X(MOON.D) + moonR * 0.3, Y(0) - moonR * 0.2, moonR * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = '#94a3b8';
    ctx.fill();
    this.caption(ctx, pick(TEXT).earth, X(0), Y(0) + earthR + 20);
    this.caption(ctx, pick(TEXT).moon, X(MOON.D), Y(0) + moonR + 20);

    // Flown part of the trajectory, bright.
    ctx.beginPath();
    ctx.moveTo(X(demo.path[0].x), Y(demo.path[0].y));
    for (let i = 1; i <= idx; i++) ctx.lineTo(X(demo.path[i].x), Y(demo.path[i].y));
    ctx.strokeStyle = 'rgba(110, 231, 183, 0.8)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // The spacecraft: a small triangle pointing along its velocity.
    const p = demo.path[idx];
    const ang = Math.atan2(p.vy, p.vx);
    ctx.save();
    ctx.translate(X(p.x), Y(p.y));
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-7, -6);
    ctx.lineTo(-7, 6);
    ctx.closePath();
    ctx.fillStyle = '#eef2ff';
    ctx.fill();
    ctx.restore();

    if (demo.idx >= demo.path.length - 1) {
      ctx.font = '700 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#6ee7b7';
      ctx.fillText(pick(TEXT).splashdown, (area.x0 + area.x1) / 2, area.y0 + 30);
    } else if (Math.hypot(p.x - MOON.D, p.y) < 120) {
      this.caption(ctx, pick(TEXT).slingshot, X(p.x), Y(p.y) - 18);
    }
  }

  private drawSun(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
    const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, radius * 2.5);
    glow.addColorStop(0, '#fff3b0');
    glow.addColorStop(0.4, '#ffb703');
    glow.addColorStop(1, 'rgba(255, 183, 3, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
