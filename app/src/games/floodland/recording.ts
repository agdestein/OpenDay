import { FloodSim } from './water';
import { HOMES, INTAKES, PUMP, physicalRate, resetWater, seaLevelAt, setRecoveryGate, stormDuration, totalDuration, type Scenario } from './scene';

export const RECORD_FPS = 15;
/** Bounded recording: depth and momenta only, with interpolation for playback. */
export class FloodRecording {
  readonly frames: number;
  readonly duration: number;
  readonly values: Float32Array;
  readonly pumped: Float64Array;
  readonly pumpRates: Float32Array;
  readonly boundary: Float64Array;
  private flooded: Uint16Array;
  private readonly cells: number;
  constructor(terrain: Float64Array, width: number, height: number, readonly scenario: Scenario = 'surge', pumpEnabled = true, deferred = false) {
    this.duration = totalDuration(scenario);
    this.frames = Math.round(this.duration * RECORD_FPS) + 1;
    this.cells = terrain.length;
    this.values = new Float32Array(this.frames * this.cells * 3);
    this.flooded = new Uint16Array(this.frames);
    this.pumped = new Float64Array(this.frames);
    this.pumpRates = new Float32Array(this.frames);
    this.boundary = new Float64Array(this.frames);
    if (!deferred) for (const _frame of this.compute(terrain, width, height, pumpEnabled)) { /* synchronous numerical tests */ }
  }
  /** Yield regularly while calculating so kiosk controls and cancellation work. */
  static async create(terrain: Float64Array, width: number, height: number, scenario: Scenario, signal: AbortSignal): Promise<FloodRecording | null> {
    if (signal.aborted) return null;
    const recording = new FloodRecording(terrain, width, height, scenario, true, true);
    for (const frame of recording.compute(terrain, width, height, true)) {
      if (signal.aborted) return null;
      if (frame % 20 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    return signal.aborted ? null : recording;
  }
  private *compute(terrain: Float64Array, width: number, height: number, pumpEnabled: boolean): Generator<number> {
    const scenario = this.scenario;
    const sim = new FloodSim(width, height);
    sim.friction = scenario === 'waves' ? .002 : .018;
    sim.waveBoundary = scenario === 'waves';
    sim.terrain.set(terrain);
    resetWater(sim);
    let mask = 0;
    const pumpConfig = { intakes: INTAKES, outlet: PUMP.outletY * width + PUMP.outletX, capacity: PUMP.capacity };
    for (let frame = 0; frame < this.frames; frame++) {
      const time = frame / RECORD_FPS;
      if (frame) {
        const dt = physicalRate((frame - .5) / RECORD_FPS, scenario) / RECORD_FPS;
        sim.seaLevel = seaLevelAt(time, scenario);
        setRecoveryGate(sim, (frame - .5) / RECORD_FPS, scenario);
        const previousPumped = sim.pumpedVolume;
        sim.pumpConfig = pumpEnabled && time > stormDuration(scenario) ? pumpConfig : null;
        // Keep the existing 30 Hz forcing cadence for surge comparisons.
        for (let half = 0; half < 2; half++) {
          sim.seaLevel = seaLevelAt((frame - .5 + half * .5) / RECORD_FPS, scenario);
          sim.advance(dt / 2);
          HOMES.forEach(([x, y], k) => { if (sim.water[y * width + x] > .3) mask |= 1 << k; });
        }
        sim.seaLevel = seaLevelAt(time, scenario);
        this.pumpRates[frame] = (sim.pumpedVolume - previousPumped) / dt;
      }
      const offset = frame * this.cells * 3;
      this.values.set(sim.water, offset);
      this.values.set(sim.mx, offset + this.cells);
      this.values.set(sim.my, offset + this.cells * 2);
      this.pumped[frame] = sim.pumpedVolume;
      this.boundary[frame] = sim.boundaryVolume;
      HOMES.forEach(([x, y], k) => { if (sim.water[y * width + x] > .3) mask |= 1 << k; });
      this.flooded[frame] = mask;
      yield frame;
    }
  }
  restore(time: number, sim: FloodSim): number {
    const position = Math.max(0, Math.min(this.frames - 1, time * RECORD_FPS));
    const frame = Math.floor(position), blend = position - frame;
    const a = frame * this.cells * 3;
    const b = Math.min(frame + 1, this.frames - 1) * this.cells * 3;
    const fields = [sim.water, sim.mx, sim.my];
    for (let field = 0; field < 3; field++) for (let i = 0; i < this.cells; i++) {
      const offset = field * this.cells + i;
      const left = this.values[a + offset];
      fields[field][i] = left + (this.values[b + offset] - left) * blend;
    }
    sim.seaLevel = seaLevelAt(position / RECORD_FPS, this.scenario);
    setRecoveryGate(sim, position / RECORD_FPS, this.scenario);
    return this.flooded[frame];
  }
  pumpedAt(time: number): number { return this.pumped[this.frameAt(time)]; }
  pumpRateAt(time: number): number { return this.pumpRates[this.frameAt(time)]; }
  private frameAt(time: number): number { return Math.max(0, Math.min(this.frames - 1, Math.floor(time * RECORD_FPS))); }
  maximumThrough(time: number): Float64Array {
    const result = new Float64Array(this.cells);
    const last = this.frameAt(time);
    for (let f = 0; f <= last; f++) for (let i = 0; i < this.cells; i++) {
      result[i] = Math.max(result[i], this.values[f * this.cells * 3 + i]);
    }
    return result;
  }
}
