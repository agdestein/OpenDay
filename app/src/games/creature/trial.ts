// One creature's timed run on a ground, with a camera that follows it: the
// judged runs of the challenge's rounds 2 and 3. With `judgeAir`, every hop
// is painted red on the ground and only distance on the ground counts.
import { Creature, FIXED_DT, type BodyPlan, type Genome, type Ground } from './physics';
import { COLOR, drawCreature, drawGround, label, sx, sy, type View } from './view';
import { sound } from '../../lib/sound';

export class Trial {
  readonly c: Creature;
  done = false;
  readonly marks: { from: number; to: number; color: string }[] = [];
  private acc = 0;
  private camX = 1.5;
  private airFrom: number | null = null;

  constructor(
    plan: BodyPlan,
    genome: Genome,
    readonly ground: Ground | undefined,
    readonly seconds = 12,
    readonly judgeAir = false,
  ) {
    this.c = new Creature(plan, genome, { ground });
  }

  get elapsed(): number {
    return this.c.time;
  }

  /** Returns true on the frame the run ends. */
  step(dt: number): boolean {
    if (this.done) return false;
    this.acc += dt;
    let steps = Math.min(60, Math.floor(this.acc / FIXED_DT));
    this.acc -= steps * FIXED_DT;
    const total = Math.round(this.seconds / FIXED_DT);
    while (steps-- > 0 && this.c.steps < total) {
      this.c.step();
      if (this.judgeAir) {
        if (!this.c.touching && this.airFrom === null) this.airFrom = this.c.dist();
        else if (this.c.touching && this.airFrom !== null) {
          if (Math.abs(this.c.dist() - this.airFrom) > 0.02) {
            this.marks.push({ from: this.airFrom, to: this.c.dist(), color: COLOR.bad });
            sound.play('clack', { pitch: 0.7, volume: 0.6 });
          }
          this.airFrom = null;
        }
      }
    }
    this.camX += (Math.max(1.5, this.c.dist() + 0.5) - this.camX) * Math.min(1, dt * 3);
    if (this.c.steps >= total) {
      if (this.airFrom !== null) this.marks.push({ from: this.airFrom, to: this.c.dist(), color: COLOR.bad });
      this.airFrom = null;
      this.done = true;
      return true;
    }
    return false;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, caption: string, flying: string): void {
    const scale = Math.max(45, Math.min(150, 0.2 * Math.min(w, h)));
    const v: View = { camX: this.camX, scale, centerX: w * 0.45, groundY: h * 0.64, top: 0, height: h };
    // Marks are world x; the creature starts at x = 0 (dist is measured from there).
    const start = this.c.startX;
    drawGround(ctx, v, w, {
      ground: this.ground,
      metres: true,
      flag: true,
      startX: start,
      marks: [
        ...this.marks.map((m) => ({ ...m, from: start + m.from, to: start + m.to })),
        ...(this.airFrom !== null ? [{ from: start + this.airFrom, to: start + this.c.dist(), color: COLOR.bad }] : []),
      ],
    });
    const air = this.judgeAir && !this.c.touching;
    drawCreature(ctx, v, this.c, { head: COLOR.you, glow: air ? COLOR.bad : undefined });
    let top = Infinity;
    for (const p of this.c.pts) top = Math.min(top, sy(v, p.y));
    const x = sx(v, this.c.comX());
    if (air) label(ctx, flying, x, top - 18, 26, COLOR.bad, 'center', 800);
    label(ctx, caption, w / 2, 118, Math.max(22, Math.min(34, w / 38)), COLOR.text, 'center', 800);
  }
}
