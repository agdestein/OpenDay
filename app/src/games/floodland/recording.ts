import { FloodSim } from './water';
import { HOMES, resetWater, STORM_DURATION, surge } from './scene';

export const RECORD_FPS = 30;
/** Fixed-size recording (~37 MiB): depth and both momenta, never terrain copies.
 * Rendering interpolates these snapshots; scrubbing never integrates backwards.
 */
export class FloodRecording {
  readonly frames = Math.round(STORM_DURATION * RECORD_FPS) + 1;
  readonly values: Float32Array;
  private flooded: Uint16Array;
  private readonly cells: number;
  constructor(terrain: Float64Array, width: number, height: number) {
    const sim = new FloodSim(width, height);
    sim.terrain.set(terrain);
    resetWater(sim);
    this.cells = terrain.length;
    this.values = new Float32Array(this.frames * this.cells * 3);
    this.flooded = new Uint16Array(this.frames);
    let mask = 0;
    for (let frame = 0; frame < this.frames; frame++) {
      if (frame) {
        sim.seaLevel = surge(frame / RECORD_FPS);
        sim.advance(24 / RECORD_FPS);
      }
      const offset = frame * this.cells * 3;
      this.values.set(sim.water, offset);
      this.values.set(sim.mx, offset + this.cells);
      this.values.set(sim.my, offset + this.cells * 2);
      HOMES.forEach(([x, y], k) => { if (sim.water[y * width + x] > .3) mask |= 1 << k; });
      this.flooded[frame] = mask;
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
    sim.seaLevel = surge(position / RECORD_FPS);
    return this.flooded[frame];
  }
  maximumThrough(time: number): Float64Array {
    const result = new Float64Array(this.cells);
    const last = Math.min(this.frames - 1, Math.max(0, Math.floor(time * RECORD_FPS)));
    for (let f = 0; f <= last; f++) for (let i = 0; i < this.cells; i++) {
      result[i] = Math.max(result[i], this.values[f * this.cells * 3 + i]);
    }
    return result;
  }
}
