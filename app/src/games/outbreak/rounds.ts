// The challenge: three fictional diseases with realistic profiles, and the
// tools the player gets against each. Shared by the game and the headless
// calibration test (tests/outbreak.test.ts), which checks that every tool
// helps and that the do-nothing death toll lands where the game expects.
import type { Age, Agent, Disease, OutbreakSim } from './sim';

export type RoundId = 'flu' | 'fever' | 'unknown';

export interface Round {
  id: RoundId;
  disease: Disease;
  /** How many people arrive sick, and on which day. */
  seedCases: number;
  seedDay: number;
  /** After that, one more case arrives from outside every this many days. */
  importEvery: number;
  /** Days on which a vaccine batch becomes available. */
  batches: number[];
  /** Venue-days of closure: closing the school and the market burns two a day. */
  closureDays: number;
  /** Round ends at the latest on this day. */
  lastDay: number;
  /** Isolation tests: one more every `every` days, at most `max` saved up. */
  tests: { every: number; max: number };
  /** A new disease: its numbers are only roughly known (forecasts say so). */
  uncertain?: boolean;
}

/** People protected by one vaccine batch. */
export const BATCH_DOSES = 40;

export const ROUNDS: Round[] = [
  {
    // Lesson: protect the vulnerable. Serious almost only for grandparents.
    id: 'flu',
    disease: {
      beta: 0.95,
      daysSick: 8,
      serious: { kid: 0.01, adult: 0.05, elder: 0.4 },
      dieInBed: { kid: 0, adult: 0.05, elder: 0.2 },
      dieNoBed: { kid: 0.1, adult: 0.3, elder: 0.6 },
      hiddenDays: 1,
    },
    seedCases: 3,
    seedDay: 3,
    importEvery: 6,
    tests: { every: 1, max: 3 },
    batches: [0, 20],
    closureDays: 24,
    lastDay: 80,
  },
  {
    // Lesson: flatten the curve. Races through town and floods the hospital.
    id: 'fever',
    disease: {
      beta: 1.5,
      daysSick: 7,
      serious: { kid: 0.01, adult: 0.08, elder: 0.35 },
      dieInBed: { kid: 0, adult: 0.05, elder: 0.2 },
      dieNoBed: { kid: 0.1, adult: 0.35, elder: 0.6 },
      hiddenDays: 1.5,
    },
    seedCases: 3,
    seedDay: 3,
    importEvery: 6,
    tests: { every: 1, max: 3 },
    batches: [0],
    closureDays: 60,
    lastDay: 80,
  },
  {
    // Lesson: buy time. Serious for everyone; the vaccine is still being made.
    id: 'unknown',
    disease: {
      beta: 0.8,
      daysSick: 10,
      serious: { kid: 0.03, adult: 0.12, elder: 0.45 },
      dieInBed: { kid: 0.02, adult: 0.1, elder: 0.3 },
      dieNoBed: { kid: 0.2, adult: 0.5, elder: 0.75 },
      hiddenDays: 3,
    },
    seedCases: 3,
    seedDay: 3,
    importEvery: 6,
    tests: { every: 1, max: 3 },
    uncertain: true,
    batches: [25, 25],
    closureDays: 30,
    lastDay: 90,
  },
];

export const VACCINE_GROUPS: Age[] = ['elder', 'adult', 'kid'];

/**
 * One round being played out: the outbreak arriving, cases imported from
 * outside, vaccine batches arriving, and the closure budget. The live game,
 * the do-nothing futures and the calibration test all drive a round this way,
 * so they follow exactly the same rules.
 */
export class RoundRun implements Stepper {
  /** Vaccine batches arrived but not yet given. */
  batchesReady = 0;
  /** Batches that have arrived so far (given or not). */
  batchesArrived = 0;
  closureLeft: number;
  /** Isolation tests ready to use. */
  testsReady = 0;
  private nextTest: number;
  private nextImport = Infinity;
  private seeded = false;
  /** Stop early (forecasts look a limited number of days ahead). */
  stopAt = Infinity;

  constructor(
    readonly round: Round,
    readonly sim: OutbreakSim,
  ) {
    this.closureLeft = round.closureDays;
    this.nextTest = round.seedDay;
    this.receiveBatches(); // day-0 batches are ready before the first step
  }

  /** The same round from this moment, on an independent copy of the town. */
  clone(seed: number): RoundRun {
    const copy = new RoundRun(this.round, this.sim.clone(seed));
    copy.batchesReady = this.batchesReady;
    copy.batchesArrived = this.batchesArrived;
    copy.closureLeft = this.closureLeft;
    copy.testsReady = this.testsReady;
    copy.nextTest = this.nextTest;
    copy.nextImport = this.nextImport;
    copy.seeded = this.seeded;
    return copy;
  }

  get finished(): boolean {
    return this.sim.day >= Math.min(this.round.lastDay, this.stopAt);
  }

  /** Day the next batch arrives, or null when no more are coming. */
  get nextBatchDay(): number | null {
    return this.round.batches[this.batchesArrived] ?? null;
  }

  /** Advance `dt` days; returns agents who arrived sick, and how many batches arrived. */
  step(dt: number): { arrived: Agent[]; batches: number } {
    const { round, sim } = this;
    const batches = this.receiveBatches();
    let arrived: Agent[] = [];
    if (!this.seeded && sim.day >= round.seedDay) {
      this.seeded = true;
      arrived = sim.seedCases(round.seedCases);
      this.nextImport = round.seedDay + round.importEvery;
    } else if (sim.day >= this.nextImport) {
      arrived = sim.seedCases(1);
      this.nextImport += round.importEvery;
    }
    while (sim.day >= this.nextTest) {
      this.testsReady = Math.min(round.tests.max, this.testsReady + 1);
      this.nextTest += round.tests.every;
    }
    const closed = (sim.schoolOpen ? 0 : 1) + (sim.marketOpen ? 0 : 1);
    if (closed > 0) {
      this.closureLeft = Math.max(0, this.closureLeft - closed * dt);
      if (this.closureLeft === 0) {
        sim.setOpen(0, true);
        sim.setOpen(1, true);
      }
    }
    sim.step(dt);
    return { arrived, batches };
  }

  private receiveBatches(): number {
    const { round, sim } = this;
    let n = 0;
    while (this.batchesArrived < round.batches.length && sim.day >= round.batches[this.batchesArrived]) {
      this.batchesArrived++;
      this.batchesReady++;
      n++;
    }
    return n;
  }

  /** Use a test to isolate a visibly sick person; true on success. */
  isolate(a: Agent): boolean {
    if (this.testsReady <= 0 || !this.sim.isolate(a)) return false;
    this.testsReady--;
    return true;
  }

  /** Give one ready batch to an age group; returns who got it, or null. */
  vaccinate(age: Age): Agent[] | null {
    if (this.batchesReady <= 0) return null;
    this.batchesReady--;
    return this.sim.vaccinateAge(age, BATCH_DOSES);
  }

  /** Toggle a venue (0 school, 1 market); returns false when out of closure days. */
  toggle(venue: number): boolean {
    const open = this.sim.isOpen(venue);
    if (open && this.closureLeft <= 0) return false;
    this.sim.setOpen(venue, !open);
    return true;
  }
}

/** Fixed step for headless runs (days). The live game steps with the frame time. */
export const HEADLESS_DT = 1 / 30;

/** Anything that advances a simulation until it is finished. */
export interface Stepper {
  readonly sim: OutbreakSim;
  readonly finished: boolean;
  step(dt: number): unknown;
}

/** A plain simulation run up to a given day. */
export class Horizon implements Stepper {
  constructor(
    readonly sim: OutbreakSim,
    readonly until: number,
  ) {}

  get finished(): boolean {
    return this.sim.day >= this.until;
  }

  step(dt: number): void {
    this.sim.step(dt);
  }
}

/**
 * Several runs advanced a slice at a time within a per-frame time budget, so
 * the game can simulate "futures" without dropping frames.
 */
export class Futures<R extends Stepper = RoundRun> {
  readonly runs: R[];
  constructor(runs: R[]) {
    this.runs = runs;
  }

  get done(): number {
    return this.runs.filter((r) => r.finished).length;
  }

  get complete(): boolean {
    return this.runs.every((r) => r.finished);
  }

  /** Step unfinished runs for about `budgetMs` milliseconds. */
  work(budgetMs: number): void {
    const until = performance.now() + budgetMs;
    for (const run of this.runs) {
      while (!run.finished) {
        for (let k = 0; k < 15 && !run.finished; k++) run.step(HEADLESS_DT);
        if (performance.now() > until) return;
      }
    }
  }

  /** Deaths per run (only meaningful once complete). */
  deaths(): number[] {
    return this.runs.map((r) => r.sim.counts.d);
  }
}

/** What a forecast compares against carrying on as now. */
export type Scenario = 'same' | 'close' | 'open';

/** Forecast horizon in days. */
export const FORECAST_DAYS = 30;

/**
 * "Ask the model": `n` futures of this run from right now, with the school
 * and market closed, reopened or left as they are. For a new (uncertain)
 * disease every future also draws its own contagiousness and seriousness,
 * with a spread that narrows as more cases have run their course — the more
 * you have seen of a virus, the better you know it.
 */
export function forecast(run: RoundRun, scenario: Scenario, n: number): Futures {
  const spread = run.round.uncertain ? uncertainty(run.sim) : 0;
  const runs = Array.from({ length: n }, (_, k) => {
    const future = run.clone(((Math.random() * 2 ** 32) >>> 0) + k);
    future.stopAt = run.sim.day + FORECAST_DAYS;
    if (spread > 0) {
      const dz = future.sim.disease;
      dz.beta *= Math.exp(spread * gaussian());
      const f = Math.exp(spread * gaussian());
      dz.serious = { ...dz.serious };
      for (const age of Object.keys(dz.serious) as Age[]) {
        dz.serious[age] = Math.min(1, dz.serious[age] * f);
      }
    }
    if (scenario === 'close') {
      for (const v of [0, 1]) if (future.sim.isOpen(v)) future.toggle(v);
    } else if (scenario === 'open') {
      for (const v of [0, 1]) if (!future.sim.isOpen(v)) future.toggle(v);
    }
    return future;
  });
  return new Futures(runs);
}

/** Log-scale spread of a new disease's numbers, given the cases seen through. */
export function uncertainty(sim: OutbreakSim): number {
  const seen = sim.counts.r + sim.counts.d;
  return 0.45 / Math.sqrt(1 + seen / 15);
}

function gaussian(): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
