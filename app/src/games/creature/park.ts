// The creature park, Creature Lab's toy: creatures on trained brains stroll
// across the screen and wrap round at the edges. Press on one to pick it up
// (one dot pinned to the pointer, the rest dangles and keeps pumping), let go
// to fling it; a click on empty ground startles everyone nearby into a hop.
// Their googly eyes follow the pointer.
import { Creature, FIXED_DT, type BodyPlan, type Genome } from './physics';
import type { BodyKind } from './presets';
import { COLOR, drawCreature, drawGround, label, sx, sy, toWorld, type View } from './view';
import { sound } from '../../lib/sound';

export interface Walker {
  c: Creature;
  plan: BodyPlan;
  genome: Genome;
  kind: BodyKind;
  /** A name tag: today's crown holder or a built-in champion. */
  tag?: string;
  /** Trained by a kid here (it may race for a crown). */
  mine: boolean;
  air: number;
  lastY: number;
}

const MAX_WALKERS = 7;
/** How near (m) a press must be to a dot to pick the creature up. */
const GRAB_REACH = 0.4;
const STARTLE_REACH = 2.6;

export class Park {
  walkers: Walker[] = [];
  selected: Walker | null = null;
  view: View = { camX: 0, scale: 100, centerX: 0, groundY: 0, top: 0, height: 0 };
  /** World width in metres. */
  width = 10;
  /** Someone has picked up a creature (the hint can go). */
  grabbed = false;
  private pointer: { x: number; y: number } | null = null;
  private held: { w: Walker; vx: number; vy: number; t: number } | null = null;
  private acc = 0;
  private rings: { x: number; y: number; age: number }[] = [];

  layout(w: number, h: number): void {
    const scale = Math.max(55, Math.min(190, h * 0.19));
    this.width = w / scale;
    this.view = { camX: this.width / 2, scale, centerX: w / 2, groundY: h * 0.72, top: 0, height: h };
  }

  add(
    plan: BodyPlan,
    genome: Genome,
    kind: BodyKind,
    opts: { tag?: string; mine?: boolean; x?: number; drop?: boolean; select?: boolean } = {},
  ): Walker {
    if (this.walkers.length >= MAX_WALKERS) {
      const spare = this.walkers.find((w) => w !== this.selected && !w.tag && !w.mine) ?? this.walkers.find((w) => w !== this.selected && !w.tag);
      if (spare) this.remove(spare);
    }
    const x = opts.x ?? 0.8 + Math.random() * Math.max(0.1, this.width - 1.6);
    const c = new Creature(plan, genome, { x, lift: opts.drop ? 1.2 : 0 });
    const walker: Walker = { c, plan, genome, kind, tag: opts.tag, mine: opts.mine ?? false, air: 0, lastY: c.comY() };
    this.walkers.push(walker);
    if (opts.select) this.selected = walker;
    return walker;
  }

  remove(walker: Walker): void {
    this.walkers = this.walkers.filter((w) => w !== walker);
    if (this.selected === walker) this.selected = null;
    if (this.held?.w === walker) this.held = null;
  }

  /** Swap a walker's brain (and body) for a new one, where it stands. */
  replace(walker: Walker, plan: BodyPlan, genome: Genome, kind: BodyKind, mine: boolean): Walker {
    const next = this.add(plan, genome, kind, { x: walker.c.comX(), drop: true, mine });
    this.remove(walker);
    return next;
  }

  step(dt: number): void {
    this.acc += dt;
    let steps = Math.min(12, Math.floor(this.acc / FIXED_DT));
    this.acc -= steps * FIXED_DT;
    if (this.acc > 0.2) this.acc = 0;
    while (steps-- > 0) for (const w of this.walkers) w.c.step();

    const span = this.width + 2.4;
    for (const w of [...this.walkers]) {
      const c = w.c;
      if (!c.finite() || c.comY() > 40 || Math.abs(c.comX() - this.width / 2) > 3 * span) {
        const fresh = this.add(w.plan, w.genome, w.kind, { tag: w.tag, mine: w.mine, drop: true });
        if (this.selected === w) this.selected = fresh;
        this.remove(w);
        continue;
      }
      if (this.held?.w !== w) {
        if (c.comX() > this.width + 1.2) c.shift(-span);
        else if (c.comX() < -1.2) c.shift(span);
      }
      // A thud when something that was flying lands.
      const y = c.comY();
      const vy = (y - w.lastY) / Math.max(dt, 1e-3);
      w.lastY = y;
      if (!c.touching) w.air += dt;
      else {
        if (w.air > 0.25 && vy < -1.5 && this.held?.w !== w) sound.play('thud', { volume: Math.min(1.4, -vy / 6) });
        w.air = 0;
      }
    }
    for (const r of this.rings) r.age += dt;
    this.rings = this.rings.filter((r) => r.age < 0.6);
  }

  /** A press: pick up the nearest creature, or startle everyone near an empty spot. */
  down(px: number, py: number): void {
    const p = toWorld(this.view, px, py);
    this.pointer = p;
    let best: { w: Walker; i: number; d: number } | null = null;
    for (const w of this.walkers) {
      for (let i = 0; i < w.c.pts.length; i++) {
        const q = w.c.pts[i];
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < GRAB_REACH && (!best || d < best.d)) best = { w, i, d };
      }
    }
    if (best) {
      const { w, i } = best;
      w.c.pin = { i, x: p.x, y: p.y };
      this.held = { w, vx: 0, vy: 0, t: performance.now() };
      this.selected = w;
      this.grabbed = true;
      sound.play('squeak');
      return;
    }
    let startled = false;
    for (const w of this.walkers) {
      const d = w.c.comX() - p.x;
      if (Math.abs(d) > STARTLE_REACH) continue;
      const f = 1 - Math.abs(d) / STARTLE_REACH;
      w.c.kick(Math.sign(d || 1) * 2.5 * f, 3 + 4 * f);
      startled = true;
    }
    this.rings.push({ x: px, y: py, age: 0 });
    sound.play(startled ? 'boing' : 'pop');
  }

  move(px: number, py: number): void {
    const p = toWorld(this.view, px, py);
    const held = this.held;
    if (held?.w.c.pin) {
      const now = performance.now();
      const dt = Math.max(1 / 240, (now - held.t) / 1000);
      const k = Math.min(1, dt * 20);
      held.vx += ((p.x - held.w.c.pin.x) / dt - held.vx) * k;
      held.vy += ((p.y - held.w.c.pin.y) / dt - held.vy) * k;
      held.t = now;
      held.w.c.pin.x = p.x;
      held.w.c.pin.y = p.y;
    }
    this.pointer = p;
  }

  up(): void {
    const held = this.held;
    if (!held) return;
    // A hand that stopped moving a moment ago throws nothing.
    const still = performance.now() - held.t > 80;
    const vx = still ? 0 : held.vx;
    const vy = still ? 0 : held.vy;
    held.w.c.release(vx, vy);
    if (Math.hypot(vx, vy) > 3) sound.play('whoosh', { pitch: Math.min(1.6, 0.7 + Math.hypot(vx, vy) / 15) });
    this.held = null;
  }

  leave(): void {
    if (!this.held) this.pointer = null;
  }

  isHolding(): boolean {
    return this.held !== null;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, names: (walker: Walker) => string | null): void {
    const v = { ...this.view, height: h };
    drawGround(ctx, v, w);
    for (const walker of this.walkers) {
      const selected = walker === this.selected;
      drawCreature(ctx, v, walker.c, {
        look: this.pointer,
        glow: selected ? COLOR.you : walker.tag ? COLOR.champ : undefined,
        head: walker.tag ? COLOR.champ : walker.mine ? COLOR.you : '#c4b5fd',
      });
      const name = names(walker);
      if (name) {
        let top = Infinity;
        for (const p of walker.c.pts) top = Math.min(top, sy(v, p.y));
        label(ctx, name, sx(v, walker.c.comX()), top - 18, Math.max(15, v.scale * 0.13), walker.tag ? COLOR.champ : selected ? COLOR.you : COLOR.dim);
      }
    }
    for (const r of this.rings) {
      ctx.strokeStyle = `rgba(238, 242, 255, ${0.6 * (1 - r.age / 0.6)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 10 + 120 * r.age, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
