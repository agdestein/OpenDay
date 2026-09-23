import type { FloodSim } from './water';

export const RECORD_FPS = 15;
const FIELDS = 4; // terrain (sand and erosion change it), depth, both momenta

/** Frames captured while the live storm runs, for scrubbing back afterwards.
 * Playback interpolates between frames; it never integrates backwards. */
export class LiveRecording {
  private readonly values: Float32Array;
  private readonly masks: Uint16Array;
  private readonly seas: Float32Array;
  private readonly capacity: number;
  private count = 0;
  constructor(private readonly cells: number, maxDuration: number) {
    this.capacity = Math.ceil(maxDuration * RECORD_FPS) + 2;
    this.values = new Float32Array(this.capacity * cells * FIELDS);
    this.masks = new Uint16Array(this.capacity);
    this.seas = new Float32Array(this.capacity);
  }
  get duration(): number { return Math.max(0, this.count - 1) / RECORD_FPS; }
  get bytes(): number { return this.values.byteLength; }
  /** Store the current state for every frame time reached by `time` (seconds). */
  capture(time: number, sim: FloodSim, flooded: number): void {
    while (this.count < this.capacity && this.count <= time * RECORD_FPS + 1e-6) {
      const offset = this.count * this.cells * FIELDS;
      this.values.set(sim.terrain, offset);
      this.values.set(sim.water, offset + this.cells);
      this.values.set(sim.mx, offset + this.cells * 2);
      this.values.set(sim.my, offset + this.cells * 3);
      this.masks[this.count] = flooded;
      this.seas[this.count] = sim.seaLevel;
      this.count++;
    }
  }
  /** Put the recorded state at `time` into `sim`; returns the homes flooded so far. */
  restore(time: number, sim: FloodSim): number {
    if (!this.count) return 0;
    const position = Math.max(0, Math.min(this.count - 1, time * RECORD_FPS));
    const frame = Math.floor(position), blend = position - frame;
    const next = Math.min(frame + 1, this.count - 1);
    const a = frame * this.cells * FIELDS, b = next * this.cells * FIELDS;
    const fields = [sim.terrain, sim.water, sim.mx, sim.my];
    for (let field = 0; field < FIELDS; field++) {
      const target = fields[field];
      for (let i = 0; i < this.cells; i++) {
        const offset = field * this.cells + i;
        const left = this.values[a + offset];
        target[i] = left + (this.values[b + offset] - left) * blend;
      }
    }
    sim.seaLevel = this.seas[frame] + (this.seas[next] - this.seas[frame]) * blend;
    sim.wear.fill(0);
    return this.masks[frame];
  }
}
