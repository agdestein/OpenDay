// 🧠 Teach it: a crowd of babies with random brains practises together;
// when their time is up the best breed (or the one the kid clicks: its babies
// pop out of it at once). The practice clock counts the simulated time, the
// point of the whole game: an hour of falling in a minute. Turbo stops drawing
// the practice and only computes.
import { Evolution, type EvolutionOptions, type Reward } from './evolve';
import type { BodyPlan } from './physics';
import type { BodyKind } from './presets';
import { pick } from '../../lib/i18n';
import { sound } from '../../lib/sound';
import { TEXT, fmtMetres } from './text';
import { COLOR, drawChart, drawCreature, drawGround, fmtDuration, label, sx, sy, toWorld, type View } from './view';

export type Speed = 'x1' | 'x3' | 'turbo';
const RATE: Record<Speed, number> = { x1: 1, x3: 3, turbo: 90 };
/** Turbo's most steps a frame (20 creatures × 180 steps ≈ 9 ms). */
const TURBO_STEPS = 180;

/** Every reward is in metres (distance, distance on the ground, jump height, distance backwards). */
export function fmtScore(score: number): string {
  return fmtMetres(Math.max(0, score));
}

export class Teacher {
  readonly evo: Evolution;
  speed: Speed = 'x3';
  view: View = { camX: 0, scale: 100, centerX: 0, groundY: 0, top: 0, height: 0 };
  /** Real seconds spent teaching. */
  real = 0;
  private camX = 1.5;
  private hover = -1;
  private family: { from: { x: number; y: number }; age: number }[] = [];
  private flash: { text: string; age: number } | null = null;
  private lastRecord = 0;
  private shownGeneration = 1;
  private w = 1;
  private h = 1;

  /** A fixed simulation rate instead of the speed buttons (the rounds' training). */
  rate: number | null = null;
  /** Whether a click picks a parent (off in the rounds). */
  picking = true;

  constructor(
    readonly plan: BodyPlan,
    readonly kind: BodyKind,
    opts: EvolutionOptions = {},
  ) {
    this.evo = new Evolution(plan, opts);
  }

  layout(w: number, h: number): void {
    this.w = w;
    this.h = h;
    const scale = Math.max(45, Math.min(150, 0.2 * Math.min(w, h)));
    this.view = { camX: this.camX, scale, centerX: w * 0.45, groundY: h * 0.66, top: 0, height: h };
  }

  step(dt: number): void {
    this.real += dt;
    const evo = this.evo;
    const rate = this.rate ?? RATE[this.speed];
    const ended = evo.advance(dt * rate, rate > 10 ? TURBO_STEPS : 240);
    if (ended > 0 && rate <= 10) sound.play('pop', { pitch: 0.9 });
    if (evo.best && evo.best.score > this.lastRecord + 0.05 && evo.history.length > 1) {
      if ((this.rate ?? RATE[this.speed]) <= 10) {
        this.flash = { text: `🏆 ${pick(TEXT).teach.record}`, age: 0 };
        sound.play('ding');
      }
    }
    if (evo.best) this.lastRecord = Math.max(this.lastRecord, evo.best.score);
    // Follow the leader (backwards walkers too), but keep the start in view early on.
    let lead = 0;
    for (const c of evo.creatures) {
      const d = c.dist();
      if (evo.reward === 'back' ? d < lead : d > lead) lead = d;
    }
    const target = evo.reward === 'back' ? Math.min(-1, lead) - 0.5 : Math.max(1.5, lead) + 0.5;
    // A new generation starts at the flag: cut straight back to it.
    if (evo.generation !== this.shownGeneration) {
      this.shownGeneration = evo.generation;
      this.camX = target;
    }
    this.camX += (target - this.camX) * Math.min(1, dt * 3);
    this.view.camX = this.camX;
    for (const f of this.family) f.age += dt;
    this.family = this.family.filter((f) => f.age < 1.2);
    if (this.flash) {
      this.flash.age += dt;
      if (this.flash.age > 1.5) this.flash = null;
    }
  }

  setReward(reward: Reward): void {
    this.evo.setReward(reward);
    this.lastRecord = 0;
  }

  /** A click on a creature makes it the parent of the next generation, now. */
  down(px: number, py: number): boolean {
    if (!this.picking) return false;
    const i = this.creatureAt(px, py);
    if (i < 0) return false;
    const head = this.evo.creatures[i].pts[0];
    this.family = this.evo.creatures.map(() => ({ from: { x: head.x, y: head.y }, age: 0 }));
    this.evo.endGeneration(i);
    this.flash = { text: pick(TEXT).teach.picked, age: 0 };
    sound.play('pop', { pitch: 1.4 });
    sound.play('boing', { pitch: 1.3, volume: 0.6 });
    this.hover = -1;
    return true;
  }

  move(px: number, py: number): void {
    this.hover = this.speed === 'turbo' || !this.picking ? -1 : this.creatureAt(px, py);
  }

  leave(): void {
    this.hover = -1;
  }

  private creatureAt(px: number, py: number): number {
    const p = toWorld(this.view, px, py);
    let best = -1;
    let bestD = 0.45;
    this.evo.creatures.forEach((c, i) => {
      for (const q of c.pts) {
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    });
    return best;
  }

  /** The practice clock's two lines. */
  clock(): [string, string] {
    const T = pick(TEXT).teach;
    const evo = this.evo;
    const practice = evo.practice + evo.creatures.length * evo.genElapsed;
    const tries = evo.tries + evo.creatures.length;
    return [T.clock(fmtDuration(practice), tries), practice > 600 ? T.robot(fmtDuration(practice)) : T.clockReal(fmtDuration(this.real))];
  }

  hud(): string {
    const evo = this.evo;
    const best = evo.best ? fmtScore(evo.best.score) : '—';
    return pick(TEXT).teach.hud(evo.generation, best, Math.max(0, Math.ceil(evo.evalTime - evo.genElapsed)));
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { w, h } = this;
    const v = this.view;
    const evo = this.evo;
    const T = pick(TEXT).teach;
    drawGround(ctx, v, w, { ground: evo.ground(), metres: true, flag: true });

    const leader = evo.leader();
    // Ghosts: the best five of this moment brighter, the rest faint.
    const order = evo.creatures.map((_, i) => i).sort((a, b) => evo.score(b) - evo.score(a));
    const rank = new Map(order.map((i, r) => [i, r]));
    evo.creatures.forEach((c, i) => {
      if (i === leader || i === this.hover) return;
      const r = rank.get(i)!;
      drawCreature(ctx, v, c, { alpha: r < 5 ? 0.38 : 0.13, tint: r < 5 ? undefined : COLOR.node });
    });
    for (const f of this.family) {
      const a = 1 - f.age / 1.2;
      ctx.strokeStyle = `rgba(244, 114, 182, ${0.7 * a})`;
      ctx.lineWidth = 3;
      for (const c of evo.creatures) {
        const head = c.pts[0];
        ctx.beginPath();
        ctx.moveTo(sx(v, f.from.x), sy(v, f.from.y));
        ctx.lineTo(sx(v, head.x), sy(v, head.y));
        ctx.stroke();
      }
    }
    const lead = evo.creatures[leader];
    if (lead) {
      drawCreature(ctx, v, lead, { head: COLOR.you });
      let top = Infinity;
      for (const p of lead.pts) top = Math.min(top, sy(v, p.y));
      label(ctx, fmtScore(evo.score(leader)), sx(v, lead.comX()), top - 16, 22);
    }
    if (this.hover >= 0 && this.hover !== leader) {
      const c = evo.creatures[this.hover];
      drawCreature(ctx, v, c, { glow: '#f472b6', head: '#f472b6' });
      let top = Infinity;
      for (const p of c.pts) top = Math.min(top, sy(v, p.y));
      label(ctx, T.pickHere, sx(v, c.comX()), top - 14, 17, '#f9a8d4');
    } else if (this.hover === leader && lead) {
      let top = Infinity;
      for (const p of lead.pts) top = Math.min(top, sy(v, p.y));
      label(ctx, T.pickHere, sx(v, lead.comX()), top - 42, 17, '#f9a8d4');
    }
    // The record line.
    if (evo.best && evo.reward !== 'high' && Math.abs(evo.best.dist) > 0.5) {
      const x = sx(v, evo.best.dist);
      if (x > -40 && x < w + 40) {
        const top = Math.max(200, v.groundY - v.scale * 2.2);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
        ctx.setLineDash([10, 10]);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, v.groundY);
        ctx.stroke();
        ctx.setLineDash([]);
        label(ctx, '🏆', x, top - 8, 30);
      }
    }

    // The practice clock, big: the one number that carries the message.
    const [clock, sub] = this.clock();
    const big = Math.max(20, Math.min(34, w / 38));
    const cx = Math.min(w / 2, (w - Math.min(320, w * 0.27) - 20) / 2 + 60);
    label(ctx, clock, cx, 112, big, COLOR.text, 'center', 800);
    label(ctx, sub, cx, 112 + big * 1.1, big * 0.6, COLOR.dim, 'center', 600);
    if (this.speed === 'turbo' && this.rate === null) label(ctx, T.turbo, w / 2, v.groundY + 70, 20, COLOR.champ);

    if (this.flash) {
      const a = Math.min(1, 3 * (1.5 - this.flash.age));
      ctx.globalAlpha = Math.max(0, a);
      label(ctx, this.flash.text, w / 2, h * 0.34, 34, '#f9a8d4', 'center', 800);
      ctx.globalAlpha = 1;
    }

    // The learning curve, in its own corner (top right, under the delve pill).
    const cw = Math.min(320, w * 0.27);
    const ch = 130;
    drawChart(ctx, w - cw - 20, 76, cw, ch, T.chart[evo.reward], [
      { values: evo.history.map((s) => Math.max(0, s)), color: COLOR.you, picked: evo.picked },
    ]);
  }
}
