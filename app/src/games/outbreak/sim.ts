// Agent-based SIR epidemic in a stylized mini-city: four neighborhoods of
// households, a school and a market. Agents commute on simple schedules;
// infection spreads by proximity. Tuned for legibility, not epidemiology.
import { randRange } from '../../lib/util';

/** Virtual-canvas size; scaled to fit the screen with letterboxing. */
export const CITY_W = 1600;
export const CITY_H = 900;

export const AGENT_COUNT = 500;
export const INFECTION_RADIUS = 22;

/** Display colors for the SIR states (+ vaccinated), shared by the canvas renderer and the delve panel. */
export const COLOR = {
  s: '#9db8d8',
  i: '#fb5f75',
  r: '#8d80b8',
  v: '#57d98a',
};
const KID_FRACTION = 0.35;
const HOUSEHOLD_SPREAD = 14;
/** How strongly a hand-wash station damps transmission at its venue. */
const SOAP_FACTOR = 0.25;

export type SirState = 'S' | 'I' | 'R';

export interface Venue {
  x: number;
  y: number;
  r: number;
  kind: 'school' | 'market';
  soap: boolean;
}

export interface District {
  x: number;
  y: number;
  w: number;
  h: number;
  houses: { x: number; y: number }[];
}

type Phase = 'home' | 'out' | 'visit' | 'back';

export interface Agent {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  hood: number;
  kid: boolean;
  state: SirState;
  vaccinated: boolean;
  phase: Phase;
  targetX: number;
  targetY: number;
  venue: number;
  timer: number;
  speed: number;
  recoverIn: number;
}

export class OutbreakSim {
  districts: District[] = [];
  venues: Venue[] = [];
  agents: Agent[] = [];
  schoolOpen = true;
  /** Chance per second of passing the disease on at zero distance. */
  infectionRate = 0.3;
  /** How long an agent stays sick, seconds (randomized ±30% per agent). */
  recoverTime = 7;
  counts = { s: 0, i: 0, r: 0, vaccinated: 0 };

  private grid = new Map<number, Agent[]>();

  constructor() {
    const centers = [
      { x: 280, y: 195 },
      { x: 1320, y: 195 },
      { x: 280, y: 575 },
      { x: 1320, y: 575 },
    ];
    for (const c of centers) {
      const houses: { x: number; y: number }[] = [];
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 3; j++) {
          if ((i === 0 || i === 3) && j === 1) continue; // leave side gaps
          houses.push({ x: c.x - 135 + i * 90, y: c.y - 90 + j * 90 });
        }
      }
      this.districts.push({ x: c.x, y: c.y, w: 380, h: 300, houses });
    }
    this.venues = [
      { x: 800, y: 180, r: 78, kind: 'school', soap: false },
      { x: 800, y: 590, r: 78, kind: 'market', soap: false },
    ];
    this.reset();
  }

  /** Fresh population: everyone home, healthy, unvaccinated; venues clean. */
  reset(): void {
    this.agents = [];
    this.schoolOpen = true;
    for (const v of this.venues) v.soap = false;
    for (let hood = 0; hood < this.districts.length; hood++) {
      const d = this.districts[hood];
      for (let i = 0; i < AGENT_COUNT / this.districts.length; i++) {
        const house = d.houses[i % d.houses.length];
        const homeX = house.x + randRange(-HOUSEHOLD_SPREAD, HOUSEHOLD_SPREAD);
        const homeY = house.y + randRange(-HOUSEHOLD_SPREAD, HOUSEHOLD_SPREAD);
        this.agents.push({
          x: homeX,
          y: homeY,
          homeX,
          homeY,
          hood,
          kid: Math.random() < KID_FRACTION,
          state: 'S',
          vaccinated: false,
          phase: 'home',
          targetX: homeX,
          targetY: homeY,
          venue: -1,
          timer: randRange(0.5, 10),
          speed: randRange(95, 145),
          recoverIn: 0,
        });
      }
    }
    this.updateCounts();
  }

  step(dt: number): void {
    for (const a of this.agents) this.move(a, dt);
    this.spread(dt);
    this.updateCounts();
  }

  /** Infect the susceptible agent nearest to (x, y); returns it, or null. */
  infectNearest(x: number, y: number): Agent | null {
    let best: Agent | null = null;
    let bestDist = Infinity;
    for (const a of this.agents) {
      if (a.state !== 'S' || a.vaccinated) continue;
      const d = Math.hypot(a.x - x, a.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = a;
      }
    }
    if (best) this.infect(best);
    return best;
  }

  /** A random unvaccinated agent gets sick (the round's patient zero). */
  infectPatientZero(): Agent | null {
    const pool = this.agents.filter((a) => a.state === 'S' && !a.vaccinated);
    if (pool.length === 0) return null;
    const agent = pool[Math.floor(Math.random() * pool.length)];
    this.infect(agent);
    return agent;
  }

  /** Vaccinate a share of a district's residents; returns how many. */
  vaccinateDistrict(hood: number, fraction = 0.75): number {
    let n = 0;
    for (const a of this.agents) {
      if (a.hood === hood && a.state === 'S' && !a.vaccinated && Math.random() < fraction) {
        a.vaccinated = true;
        n++;
      }
    }
    this.updateCounts();
    return n;
  }

  closeSchool(): void {
    this.schoolOpen = false;
    // Kids at or heading to school turn around and go home.
    for (const a of this.agents) {
      if (a.venue === 0 && (a.phase === 'out' || a.phase === 'visit')) this.sendHome(a);
    }
  }

  districtAt(x: number, y: number): number {
    return this.districts.findIndex(
      (d) => Math.abs(x - d.x) < d.w / 2 + 20 && Math.abs(y - d.y) < d.h / 2 + 20,
    );
  }

  venueAt(x: number, y: number): number {
    return this.venues.findIndex((v) => Math.hypot(x - v.x, y - v.y) < v.r + 20);
  }

  // ---- internals ----

  private infect(a: Agent): void {
    a.state = 'I';
    a.recoverIn = this.recoverTime * randRange(0.7, 1.3);
    this.counts.i++;
    this.counts.s--;
  }

  private sendHome(a: Agent): void {
    a.phase = 'back';
    a.venue = -1;
    a.targetX = a.homeX;
    a.targetY = a.homeY;
  }

  private move(a: Agent, dt: number): void {
    switch (a.phase) {
      case 'home':
        a.timer -= dt;
        if (a.timer <= 0) {
          const venue = a.kid ? (this.schoolOpen ? 0 : -1) : 1;
          if (venue === -1) {
            a.timer = randRange(3, 8); // school closed: stay home, check later
            return;
          }
          const v = this.venues[venue];
          const angle = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * (v.r - 12);
          a.venue = venue;
          a.targetX = v.x + Math.cos(angle) * r;
          a.targetY = v.y + Math.sin(angle) * r;
          a.phase = 'out';
        }
        break;
      case 'out':
      case 'back':
        if (this.walk(a, dt)) {
          if (a.phase === 'out') {
            a.phase = 'visit';
            a.timer = a.kid ? randRange(4, 8) : randRange(3, 6);
          } else {
            a.phase = 'home';
            a.timer = a.kid ? randRange(4, 10) : randRange(6, 16);
          }
        }
        break;
      case 'visit': {
        // Mingle: small random walk inside the venue.
        const v = this.venues[a.venue];
        a.x += randRange(-1, 1) * 40 * dt;
        a.y += randRange(-1, 1) * 40 * dt;
        const d = Math.hypot(a.x - v.x, a.y - v.y);
        if (d > v.r - 10) {
          a.x = v.x + ((a.x - v.x) / d) * (v.r - 10);
          a.y = v.y + ((a.y - v.y) / d) * (v.r - 10);
        }
        a.timer -= dt;
        if (a.timer <= 0 || (a.venue === 0 && !this.schoolOpen)) this.sendHome(a);
        break;
      }
    }
  }

  /** Straight-line step toward the target; true when arrived. */
  private walk(a: Agent, dt: number): boolean {
    const dx = a.targetX - a.x;
    const dy = a.targetY - a.y;
    const d = Math.hypot(dx, dy);
    const step = a.speed * dt;
    if (d <= step) {
      a.x = a.targetX;
      a.y = a.targetY;
      return true;
    }
    a.x += (dx / d) * step;
    a.y += (dy / d) * step;
    return false;
  }

  private spread(dt: number): void {
    // Spatial hash so each infected agent only checks its neighborhood.
    const cell = INFECTION_RADIUS;
    this.grid.clear();
    for (const a of this.agents) {
      if (a.state !== 'S' || a.vaccinated) continue;
      const key = Math.floor(a.x / cell) * 4096 + Math.floor(a.y / cell);
      const bucket = this.grid.get(key);
      if (bucket) bucket.push(a);
      else this.grid.set(key, [a]);
    }
    for (const a of this.agents) {
      if (a.state !== 'I') continue;
      a.recoverIn -= dt;
      if (a.recoverIn <= 0) {
        a.state = 'R';
        continue;
      }
      const cx = Math.floor(a.x / cell);
      const cy = Math.floor(a.y / cell);
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const bucket = this.grid.get(gx * 4096 + gy);
          if (!bucket) continue;
          for (const b of bucket) {
            if (b.state !== 'S') continue;
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d >= INFECTION_RADIUS) continue;
            let p = this.infectionRate * dt * (1 - d / INFECTION_RADIUS);
            const v = b.phase === 'visit' && b.venue >= 0 ? this.venues[b.venue] : null;
            if (v?.soap) p *= SOAP_FACTOR;
            if (Math.random() < p) this.infect(b);
          }
        }
      }
    }
  }

  private updateCounts(): void {
    const c = { s: 0, i: 0, r: 0, vaccinated: 0 };
    for (const a of this.agents) {
      if (a.state === 'S') c.s++;
      else if (a.state === 'I') c.i++;
      else c.r++;
      if (a.vaccinated) c.vaccinated++;
    }
    this.counts = c;
  }
}
