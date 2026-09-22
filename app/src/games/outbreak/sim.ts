// Agent-based SIRD epidemic in a stylized mini-city: four neighborhoods of
// mixed-age households, a school, a market and a small hospital. Agents
// commute on simple schedules; infection spreads by proximity, weighted by
// setting (indoors counts, passing on the street barely does). Serious cases
// need a hospital bed; without one their chance of dying rises. One simulated
// second is one day. Death rates are exaggerated on purpose so a 500-person
// town can show anything at all (the explainer says so).

/** Virtual-canvas size; scaled to fit the screen with letterboxing. */
export const CITY_W = 1600;
export const CITY_H = 900;
/** Width of the map part of the canvas; the dashboard fills the rest. */
export const MAP_W = 1100;

export const AGENT_COUNT = 500;
export const INFECTION_RADIUS = 22;
export const BEDS = 8;

/**
 * Display colors per state, shared by the canvas renderer, the dashboard and
 * the delve panel. Separated by brightness as well as hue.
 */
export const COLOR = {
  s: '#d3e2f4',
  i: '#ff5a6e',
  r: '#8a7cc0',
  v: '#4fd08a',
  d: '#5a6273',
  /** Serious case waiting at home for a bed. */
  wait: '#ffb347',
};

export type Age = 'kid' | 'adult' | 'elder';
export const AGES: Age[] = ['kid', 'adult', 'elder'];
/** Household mix: share of each age in every house. */
export const AGE_SHARE: Record<Age, number> = { kid: 0.3, adult: 0.5, elder: 0.2 };

export type SirState = 'S' | 'I' | 'R' | 'D';

/** One disease: how it spreads and how hard it hits each age. */
export interface Disease {
  /** Chance per day of passing it on at zero distance, indoors. */
  beta: number;
  /** Mean days sick (±30 % per person). */
  daysSick: number;
  /** How easily each age catches it (multiplies beta; default 1). */
  catches?: Record<Age, number>;
  /** Days a new case is contagious before it shows (looks healthy); default 0. */
  hiddenDays?: number;
  /** Chance an infection turns serious, per age. */
  serious: Record<Age, number>;
  /** Chance a serious case dies if it had a hospital bed the whole time. */
  dieInBed: Record<Age, number>;
  /** Chance a serious case dies if it never got a bed. */
  dieNoBed: Record<Age, number>;
}

/** Free play: a flu-like disease, a little faster than the challenge's first round. */
export const TOY_DISEASE: Disease = {
  beta: 1.2,
  daysSick: 8,
  hiddenDays: 1,
  serious: { kid: 0.01, adult: 0.05, elder: 0.4 },
  dieInBed: { kid: 0, adult: 0.05, elder: 0.2 },
  dieNoBed: { kid: 0.1, adult: 0.3, elder: 0.6 },
};

/** Transmission weight by setting (multiplies beta). */
export const WEIGHTS = { home: 0.5, school: 2, market: 0.35, street: 0.12 };
/** How strongly a hand-wash station damps transmission at its venue. */
const SOAP_FACTOR = 0.25;
/** Serious cases worsen after this share of their illness (and not while hidden). */
const SERIOUS_ONSET = 0.3;
/** Isolated people still infect their household, but much less. */
const ISOLATION_FACTOR = 0.3;
const HOUSEHOLD_SPREAD = 9;
/** Mean days per outing and at home between outings, per age (see visitStay/homeStay). */
const ROUTINE: Record<Age, [number, number]> = {
  kid: [6, 7],
  adult: [4.5, 11],
  elder: [4.5, 29],
};
/** Samples per simulated day in `history`. */
const SAMPLES_PER_DAY = 4;

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

export interface Hospital {
  x: number;
  y: number;
  w: number;
  h: number;
  beds: { x: number; y: number }[];
}

type Phase = 'home' | 'out' | 'visit' | 'back' | 'toHospital' | 'inBed' | 'still';

export interface Agent {
  id: number;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  hood: number;
  age: Age;
  state: SirState;
  vaccinated: boolean;
  phase: Phase;
  targetX: number;
  targetY: number;
  venue: number;
  timer: number;
  speed: number;
  /** Days of illness left. */
  sickLeft: number;
  /** Total days of this illness. */
  sickTotal: number;
  serious: boolean;
  /** Told to stay home until better (the isolate tool). */
  isolated: boolean;
  /** Bed index while in hospital, else -1. */
  bed: number;
  /** Days spent seriously ill without a bed. */
  daysNoBed: number;
  /** Id of whoever infected this agent (-1: seeded or never). */
  infectedBy: number;
  /** How many others this agent infected. */
  caused: number;
  /** Day of infection, death, etc. — used for small animations. */
  changedAt: number;
}

export interface Counts {
  /** Susceptible, not vaccinated. */
  s: number;
  /** Susceptible but vaccinated: protected. */
  v: number;
  i: number;
  /** Of the sick: not showing it yet. */
  hidden: number;
  /** Of the sick: isolating at home. */
  isolated: number;
  r: number;
  d: number;
  /** Beds in use. */
  beds: number;
  /** Serious cases waiting at home for a bed. */
  waiting: number;
  /** Deaths per age. */
  dByAge: Record<Age, number>;
}

export interface Sample extends Counts {
  day: number;
}

/** Small, fast seeded PRNG (mulberry32). */
function makeRng(seed: number): { next(): number; state: number } {
  const rng = {
    state: seed >>> 0,
    next(): number {
      rng.state = (rng.state + 0x6d2b79f5) >>> 0;
      let t = rng.state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
  return rng;
}

const emptyCounts = (): Counts => ({
  s: 0,
  v: 0,
  i: 0,
  hidden: 0,
  isolated: 0,
  r: 0,
  d: 0,
  beds: 0,
  waiting: 0,
  dByAge: { kid: 0, adult: 0, elder: 0 },
});

export class OutbreakSim {
  districts: District[] = [];
  venues: Venue[] = [];
  hospital: Hospital;
  agents: Agent[] = [];
  /** Agent id per bed, -1 when free. */
  beds: number[] = [];
  schoolOpen = true;
  marketOpen = true;
  disease: Disease;
  /** When false, serious cases always recover (free play by default). */
  deaths = true;
  /** Simulated days since reset. */
  day = 0;
  counts: Counts = emptyCounts();
  history: Sample[] = [];

  private rng: { next(): number; state: number };
  private grid = new Map<number, Agent[]>();
  private sinceSample = 0;

  constructor(seed = (Math.random() * 2 ** 32) >>> 0, disease: Disease = TOY_DISEASE) {
    this.rng = makeRng(seed);
    this.disease = { ...disease };
    const centers = [
      { x: 230, y: 200 },
      { x: 870, y: 200 },
      { x: 230, y: 630 },
      { x: 870, y: 630 },
    ];
    for (const c of centers) {
      const houses: { x: number; y: number }[] = [];
      for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 5; i++) houses.push({ x: c.x - 144 + i * 72, y: c.y - 108 + j * 72 });
      }
      this.districts.push({ x: c.x, y: c.y, w: 380, h: 300, houses });
    }
    this.venues = [
      { x: 550, y: 175, r: 78, kind: 'school', soap: false },
      { x: 550, y: 660, r: 78, kind: 'market', soap: false },
    ];
    const hw = 230;
    const hh = 104;
    const hx = 550;
    const hy = 415;
    const beds: { x: number; y: number }[] = [];
    const cols = BEDS / 2;
    for (let k = 0; k < BEDS; k++) {
      const col = k % cols;
      const row = Math.floor(k / cols);
      beds.push({ x: hx - hw / 2 + 31 + col * 42, y: hy - 12 + row * 36 });
    }
    this.hospital = { x: hx, y: hy, w: hw, h: hh, beds };
    this.reset();
  }

  /** Uniform random number in [lo, hi). */
  rand(lo = 0, hi = 1): number {
    return lo + this.rng.next() * (hi - lo);
  }

  /** Fresh population: everyone home, healthy, unvaccinated; venues clean. */
  reset(): void {
    this.agents = [];
    this.beds = new Array<number>(BEDS).fill(-1);
    this.schoolOpen = true;
    this.marketOpen = true;
    this.day = 0;
    this.history = [];
    this.sinceSample = 0;
    for (const v of this.venues) v.soap = false;
    const perHood = AGENT_COUNT / this.districts.length;
    for (let hood = 0; hood < this.districts.length; hood++) {
      const d = this.districts[hood];
      // Every house gets the same mix of ages: agents are dealt to houses in
      // turn, so an age-sorted list spreads each age evenly.
      const ages: Age[] = [];
      for (const age of AGES) {
        for (let k = 0; k < Math.round(perHood * AGE_SHARE[age]); k++) ages.push(age);
      }
      while (ages.length < perHood) ages.push('adult');
      ages.length = perHood;
      for (let i = 0; i < perHood; i++) {
        const house = d.houses[i % d.houses.length];
        const homeX = house.x + this.rand(-HOUSEHOLD_SPREAD, HOUSEHOLD_SPREAD);
        const homeY = house.y + this.rand(-HOUSEHOLD_SPREAD, HOUSEHOLD_SPREAD);
        const age = ages[i];
        const agent: Agent = {
          id: this.agents.length,
          x: homeX,
          y: homeY,
          homeX,
          homeY,
          hood,
          age,
          state: 'S',
          vaccinated: false,
          phase: 'home',
          targetX: homeX,
          targetY: homeY,
          venue: -1,
          timer: this.rand(0.5, 10),
          speed: age === 'elder' ? this.rand(70, 100) : this.rand(95, 145),
          sickLeft: 0,
          sickTotal: 0,
          serious: false,
          isolated: false,
          bed: -1,
          daysNoBed: 0,
          infectedBy: -1,
          caused: 0,
          changedAt: -99,
        };
        this.startRoutine(agent);
        this.agents.push(agent);
      }
    }
    this.updateCounts();
  }

  /**
   * Put a fresh agent somewhere in its daily routine, as if the town had been
   * living for a while: some already out at the school or market, the rest
   * part-way through their time at home. (Starting everyone at home would
   * send the whole town out together in the first days.)
   */
  private startRoutine(a: Agent): void {
    const [visit, home] = ROUTINE[a.age];
    if (this.rand() < visit / (visit + home)) {
      const venue = a.age === 'kid' ? 0 : 1;
      const v = this.venues[venue];
      const angle = this.rand() * Math.PI * 2;
      const r = Math.sqrt(this.rand()) * (v.r - 12);
      a.x = a.targetX = v.x + Math.cos(angle) * r;
      a.y = a.targetY = v.y + Math.sin(angle) * r;
      a.venue = venue;
      a.phase = 'visit';
      a.timer = this.rand() * this.visitStay(a);
    } else {
      a.timer = this.rand() * this.homeStay(a);
    }
  }

  /** Independent copy with its own random stream, for "what if" futures. */
  clone(seed: number): OutbreakSim {
    const copy = new OutbreakSim(seed, this.disease);
    copy.agents = this.agents.map((a) => ({ ...a }));
    copy.beds = [...this.beds];
    copy.schoolOpen = this.schoolOpen;
    copy.marketOpen = this.marketOpen;
    copy.deaths = this.deaths;
    copy.day = this.day;
    copy.venues = this.venues.map((v) => ({ ...v }));
    copy.history = [...this.history];
    copy.sinceSample = this.sinceSample;
    copy.updateCounts();
    return copy;
  }

  step(dt: number): void {
    this.day += dt;
    for (const a of this.agents) this.move(a, dt);
    this.spread(dt);
    this.progress(dt);
    this.admit();
    this.updateCounts();
    this.sinceSample += dt;
    if (this.sinceSample >= 1 / SAMPLES_PER_DAY || this.history.length === 0) {
      this.sinceSample = 0;
      this.history.push({ day: this.day, ...this.counts, dByAge: { ...this.counts.dByAge } });
    }
  }

  /** True once nobody is sick any more (after an outbreak started). */
  get over(): boolean {
    return this.counts.i === 0;
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
    if (best) this.infect(best, -1);
    return best;
  }

  /** `n` random unvaccinated agents get sick (the outbreak arriving in town). */
  seedCases(n: number): Agent[] {
    const pool = this.agents.filter((a) => a.state === 'S' && !a.vaccinated && a.age === 'adult');
    const out: Agent[] = [];
    for (let k = 0; k < n && pool.length > 0; k++) {
      const j = Math.floor(this.rand() * pool.length);
      const [a] = pool.splice(j, 1);
      this.infect(a, -1);
      out.push(a);
    }
    this.updateCounts();
    return out;
  }

  /** Vaccinate up to `doses` healthy, unvaccinated people of one age; returns how many. */
  vaccinateAge(age: Age, doses: number): Agent[] {
    const pool = this.agents.filter((a) => a.age === age && a.state === 'S' && !a.vaccinated);
    this.shuffle(pool);
    const done = pool.slice(0, doses);
    for (const a of done) {
      a.vaccinated = true;
      a.changedAt = this.day;
    }
    this.updateCounts();
    return done;
  }

  /** Vaccinate a share of a district's residents; returns how many. */
  vaccinateDistrict(hood: number, fraction = 0.75): number {
    let n = 0;
    for (const a of this.agents) {
      if (a.hood === hood && a.state === 'S' && !a.vaccinated && this.rand() < fraction) {
        a.vaccinated = true;
        a.changedAt = this.day;
        n++;
      }
    }
    this.updateCounts();
    return n;
  }

  /** Open or close a venue (0 school, 1 market); visitors head home on closing. */
  setOpen(venue: number, open: boolean): void {
    if (venue === 0) this.schoolOpen = open;
    else this.marketOpen = open;
    if (open) return;
    for (const a of this.agents) {
      if (a.venue === venue && (a.phase === 'out' || a.phase === 'visit')) this.sendHome(a);
    }
  }

  isOpen(venue: number): boolean {
    return venue === 0 ? this.schoolOpen : this.marketOpen;
  }

  districtAt(x: number, y: number): number {
    return this.districts.findIndex(
      (d) => Math.abs(x - d.x) < d.w / 2 + 20 && Math.abs(y - d.y) < d.h / 2 + 20,
    );
  }

  venueAt(x: number, y: number): number {
    return this.venues.findIndex((v) => Math.hypot(x - v.x, y - v.y) < v.r + 20);
  }

  /** Send a visibly sick person home to stay there until better; true on success. */
  isolate(a: Agent): boolean {
    if (a.state !== 'I' || a.bed >= 0 || a.isolated || this.isHidden(a)) return false;
    a.isolated = true;
    if (a.phase === 'out' || a.phase === 'visit') this.sendHome(a);
    this.updateCounts();
    return true;
  }

  /** The visibly sick, not yet isolated person nearest to (x, y) within `radius`. */
  sickNear(x: number, y: number, radius: number): Agent | null {
    let best: Agent | null = null;
    let bestDist = radius;
    for (const a of this.agents) {
      if (a.state !== 'I' || a.bed >= 0 || a.isolated || this.isHidden(a)) continue;
      const d = Math.hypot(a.x - x, a.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = a;
      }
    }
    return best;
  }

  /** Infected, contagious, but not showing it yet. */
  isHidden(a: Agent): boolean {
    return a.state === 'I' && a.sickTotal - a.sickLeft < this.hiddenFor(a);
  }

  /**
   * R measured from the infection tree: how many people each recent case
   * (caught in the last 2–10 days) has infected so far, scaled up for those
   * still sick by how far into their illness they are. Lags the epidemic by a
   * few days, like every real R estimate. Null while there are too few cases.
   */
  recentR(): number | null {
    let caused = 0;
    let weight = 0;
    for (const a of this.agents) {
      if (a.state === 'S' || a.sickTotal <= 0) continue;
      const sick = a.state === 'I';
      const infectedAt = sick ? a.changedAt : a.changedAt - a.sickTotal;
      if (infectedAt < this.day - 10 || infectedAt > this.day - 2) continue;
      const elapsed = sick ? a.sickTotal - a.sickLeft : a.sickTotal;
      weight += Math.min(1, elapsed / a.sickTotal);
      caused += a.caused;
    }
    return weight >= 4 ? caused / weight : null;
  }

  /** Mean number of others infected by people whose illness is over (a measured R). */
  measuredR(sinceDay = 0, untilDay = Infinity): { r: number; n: number } {
    let sum = 0;
    let n = 0;
    for (const a of this.agents) {
      if (a.state !== 'R' && a.state !== 'D') continue;
      const infectedDay = a.changedAt - a.sickTotal;
      if (infectedDay < sinceDay || infectedDay > untilDay) continue;
      sum += a.caused;
      n++;
    }
    return { r: n ? sum / n : 0, n };
  }

  // ---- internals ----

  private shuffle<T>(xs: T[]): void {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [xs[i], xs[j]] = [xs[j], xs[i]];
    }
  }

  private infect(a: Agent, by: number): void {
    a.state = 'I';
    a.sickTotal = this.disease.daysSick * this.rand(0.7, 1.3);
    a.sickLeft = a.sickTotal;
    a.serious = this.rand() < this.disease.serious[a.age];
    a.daysNoBed = 0;
    a.infectedBy = by;
    a.changedAt = this.day;
    if (by >= 0) this.agents[by].caused++;
  }

  private sendHome(a: Agent): void {
    a.phase = 'back';
    a.venue = -1;
    a.targetX = a.homeX;
    a.targetY = a.homeY;
  }

  /** Seriously ill and not (yet) in a hospital bed. */
  needsBed(a: Agent): boolean {
    return a.state === 'I' && a.serious && a.bed < 0 && a.sickTotal - a.sickLeft >= this.onset(a);
  }

  private hiddenFor(a: Agent): number {
    return Math.min(this.disease.hiddenDays ?? 0, 0.5 * a.sickTotal);
  }

  /** When a serious case starts needing a bed. */
  private onset(a: Agent): number {
    return Math.max(SERIOUS_ONSET * a.sickTotal, this.hiddenFor(a));
  }

  private move(a: Agent, dt: number): void {
    switch (a.phase) {
      case 'still':
      case 'inBed':
        break;
      case 'home':
        if (this.needsBed(a)) break; // too ill to go out
        if (a.isolated && a.state === 'I') break;
        a.timer -= dt;
        if (a.timer <= 0) {
          const venue = a.age === 'kid' ? 0 : 1;
          if (!this.isOpen(venue)) {
            // Closed: skip this outing but keep its rhythm (the visit plus the
            // stay at home after it), so reopening does not send everyone out
            // at once — a crowded venue would make a false rebound.
            a.timer = this.visitStay(a) + this.homeStay(a);
            return;
          }
          const v = this.venues[venue];
          const angle = this.rand() * Math.PI * 2;
          const r = Math.sqrt(this.rand()) * (v.r - 12);
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
            a.timer = this.visitStay(a);
          } else {
            a.phase = 'home';
            a.timer = this.homeStay(a);
          }
        }
        break;
      case 'toHospital':
        if (this.walk(a, dt)) a.phase = 'inBed';
        break;
      case 'visit': {
        // Mingle: small random walk inside the venue.
        const v = this.venues[a.venue];
        a.x += this.rand(-1, 1) * 40 * dt;
        a.y += this.rand(-1, 1) * 40 * dt;
        const d = Math.hypot(a.x - v.x, a.y - v.y);
        if (d > v.r - 10) {
          a.x = v.x + ((a.x - v.x) / d) * (v.r - 10);
          a.y = v.y + ((a.y - v.y) / d) * (v.r - 10);
        }
        a.timer -= dt;
        if (a.timer <= 0 || !this.isOpen(a.venue) || this.needsBed(a)) {
          this.sendHome(a);
        }
        break;
      }
    }
  }

  /** Days spent at the school or market per outing. */
  private visitStay(a: Agent): number {
    return a.age === 'kid' ? this.rand(4, 8) : this.rand(3, 6);
  }

  /** Days at home between outings. */
  private homeStay(a: Agent): number {
    if (a.age === 'kid') return this.rand(4, 10);
    if (a.age === 'adult') return this.rand(6, 16);
    return this.rand(18, 40);
  }

  /** Straight-line step toward the target; true when arrived. */
  private walk(a: Agent, dt: number): boolean {
    const dx = a.targetX - a.x;
    const dy = a.targetY - a.y;
    const d = Math.hypot(dx, dy);
    const step = (a.phase === 'toHospital' ? 320 : a.speed) * dt;
    if (d <= step) {
      a.x = a.targetX;
      a.y = a.targetY;
      return true;
    }
    a.x += (dx / d) * step;
    a.y += (dy / d) * step;
    return false;
  }

  /** Where an agent is, for transmission weights: -1 street, 0/1 venue, 2 home. */
  private setting(a: Agent): number {
    if (a.phase === 'visit') return a.venue;
    if (a.phase === 'home') return 2;
    return -1;
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
    const { beta, catches } = this.disease;
    for (const a of this.agents) {
      if (a.state !== 'I' || a.bed >= 0) continue; // hospital patients are isolated
      const sa = this.setting(a);
      const own = a.isolated ? ISOLATION_FACTOR : 1;
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
            const sb = this.setting(b);
            let w = WEIGHTS.home;
            if (sa < 0 || sb < 0) w = WEIGHTS.street;
            else if (sb === 0) w = WEIGHTS.school;
            else if (sb === 1) w = WEIGHTS.market;
            if (sb >= 0 && sb < 2 && this.venues[sb].soap) w *= SOAP_FACTOR;
            const p = beta * w * own * (catches?.[b.age] ?? 1) * dt * (1 - d / INFECTION_RADIUS);
            if (this.rand() < p) this.infect(b, a.id);
          }
        }
      }
    }
  }

  /** Illness clocks: serious cases without a bed, recovery and death. */
  private progress(dt: number): void {
    const dz = this.disease;
    for (const a of this.agents) {
      if (a.state !== 'I') continue;
      if (this.needsBed(a)) {
        a.daysNoBed += dt;
        // Too ill to be out: head home and stay there.
        if (a.phase === 'out' || a.phase === 'visit') this.sendHome(a);
      }
      a.sickLeft -= dt;
      if (a.sickLeft > 0) continue;
      let dies = false;
      if (a.serious && this.deaths) {
        const seriousDays = a.sickTotal - this.onset(a);
        const untreated = Math.min(1, a.daysNoBed / seriousDays);
        const p = dz.dieInBed[a.age] + (dz.dieNoBed[a.age] - dz.dieInBed[a.age]) * untreated;
        dies = this.rand() < p;
      }
      if (a.bed >= 0) this.beds[a.bed] = -1;
      a.bed = -1;
      a.isolated = false;
      a.changedAt = this.day;
      if (dies) {
        a.state = 'D';
        a.phase = 'still';
        a.x = a.homeX;
        a.y = a.homeY;
      } else {
        a.state = 'R';
        if (a.phase === 'inBed' || a.phase === 'toHospital') this.sendHome(a);
      }
    }
  }

  /** Free beds go to the serious cases that have waited longest. */
  private admit(): void {
    let free = this.beds.indexOf(-1);
    if (free < 0) return;
    const waiting = this.agents.filter((a) => this.needsBed(a));
    waiting.sort((p, q) => q.daysNoBed - p.daysNoBed);
    for (const a of waiting) {
      if (free < 0) break;
      this.beds[free] = a.id;
      a.bed = free;
      a.phase = 'toHospital';
      a.venue = -1;
      a.targetX = this.hospital.beds[free].x;
      a.targetY = this.hospital.beds[free].y;
      free = this.beds.indexOf(-1);
    }
  }

  private updateCounts(): void {
    const c = emptyCounts();
    for (const a of this.agents) {
      if (a.state === 'S') {
        if (a.vaccinated) c.v++;
        else c.s++;
      } else if (a.state === 'I') {
        c.i++;
        if (this.isHidden(a)) c.hidden++;
        if (a.isolated) c.isolated++;
        if (a.bed >= 0) c.beds++;
        else if (this.needsBed(a)) c.waiting++;
      } else if (a.state === 'R') c.r++;
      else {
        c.d++;
        c.dByAge[a.age]++;
      }
    }
    this.counts = c;
  }
}
