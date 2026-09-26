// The body editor ("✏️ Draw your own"): dots, bones and muscles on a bench.
// Drag from a dot to grow a limb (a muscle), click a stick to flip it between
// bone and muscle, erase, undo. Done hands the cleaned body to the park.
import { NODE_R, muscleCount, type BodyPlan } from './physics';
import { clonePlan } from './presets';
import { COLOR, drawGround, drawPlan, sx, sy, toWorld, type View } from './view';
import { sound } from '../../lib/sound';

export type Tool = 'draw' | 'move' | 'type' | 'erase';

const MAX_NODES = 12;
const MAX_STICKS = 20;

export class Editor {
  plan: BodyPlan;
  tool: Tool = 'draw';
  view: View = { camX: 0.55, scale: 200, centerX: 0, groundY: 0, top: 0, height: 0 };
  private drag: { node: number; moved: boolean; x: number; y: number; fresh: boolean } | null = null;
  private history: BodyPlan[] = [];
  private topY = 3;

  constructor(
    plan: BodyPlan,
    private onChange: () => void,
  ) {
    this.plan = clonePlan(plan);
  }

  layout(w: number, h: number): void {
    const scale = 0.3 * Math.min(w, h);
    this.view = { camX: 0.55, scale, centerX: w / 2, groundY: h * 0.74, top: 0, height: h };
    this.topY = Math.max(1, (h * 0.74 - 90) / scale);
  }

  load(plan: BodyPlan): void {
    this.remember();
    this.plan = clonePlan(plan);
    this.onChange();
  }

  /** A blank bench: a head and one dot, joined by a muscle. */
  clear(): void {
    this.remember();
    this.plan = { kind: 'Own', nodes: [{ x: 0.9, y: 0.5 }, { x: 0.2, y: 0.07 }], sticks: [{ a: 0, b: 1, muscle: true }] };
    this.onChange();
  }

  undo(): void {
    const last = this.history.pop();
    if (!last) return;
    this.plan = last;
    this.onChange();
  }

  canUndo(): boolean {
    return this.history.length > 0;
  }

  valid(): boolean {
    return muscleCount(this.result()) > 0;
  }

  /** Dots joined to the head by sticks (the rest is dropped at Done). */
  attached(): Set<number> {
    const seen = new Set<number>([0]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const s of this.plan.sticks) {
        if (seen.has(s.a) !== seen.has(s.b)) {
          seen.add(s.a);
          seen.add(s.b);
          grew = true;
        }
      }
    }
    return seen;
  }

  /** The body to use: only what hangs together with the head (loose dots would lie on the floor and count in the distance). */
  result(): BodyPlan {
    const keep = this.attached();
    const map = new Map<number, number>();
    const nodes = this.plan.nodes.filter((_, i) => {
      if (!keep.has(i)) return false;
      map.set(i, map.size);
      return true;
    });
    return {
      kind: this.plan.kind,
      nodes: nodes.map((n) => ({ ...n })),
      sticks: this.plan.sticks
        .filter((s) => keep.has(s.a) && keep.has(s.b))
        .map((s) => ({ a: map.get(s.a)!, b: map.get(s.b)!, muscle: s.muscle })),
    };
  }

  counts(): { bones: number; muscles: number; nodes: number; maxNodes: number } {
    const muscles = muscleCount(this.plan);
    return { bones: this.plan.sticks.length - muscles, muscles, nodes: this.plan.nodes.length, maxNodes: MAX_NODES };
  }

  private remember(): void {
    this.history.push(clonePlan(this.plan));
    if (this.history.length > 40) this.history.shift();
  }

  /** Any edit makes it a body of its own. */
  private edited(): void {
    this.plan.kind = 'Own';
    this.onChange();
  }

  private clampPoint(x: number, y: number): { x: number; y: number } {
    return { x: Math.min(2.5, Math.max(-2.5, x)), y: Math.min(this.topY, Math.max(NODE_R, y)) };
  }

  down(px: number, py: number): void {
    const p = toWorld(this.view, px, py);
    // Drawing starts from the nearest dot within a generous reach, so limbs stay attached.
    const node = this.nodeAt(p.x, p.y, -1, this.tool === 'draw' ? 0.3 : 0.14);
    if (this.tool === 'draw') {
      if (node >= 0) {
        this.drag = { node, moved: false, x: p.x, y: p.y, fresh: false };
      } else if (this.plan.nodes.length < MAX_NODES) {
        // A new dot on its own: it joins the body when a stick reaches it (loose ones are dropped at Done).
        this.remember();
        this.plan.nodes.push(this.clampPoint(p.x, p.y));
        this.drag = { node: this.plan.nodes.length - 1, moved: false, x: p.x, y: p.y, fresh: true };
        sound.play('pop');
        this.edited();
      }
    } else if (this.tool === 'move') {
      if (node >= 0) {
        this.remember();
        this.drag = { node, moved: false, x: p.x, y: p.y, fresh: true };
      }
    } else if (this.tool === 'type') {
      const stick = this.stickAt(p.x, p.y);
      if (stick >= 0) {
        this.remember();
        this.plan.sticks[stick].muscle = !this.plan.sticks[stick].muscle;
        sound.play('click');
        this.edited();
      }
    } else if (this.tool === 'erase') {
      if (node >= 0 && this.plan.nodes.length > 2) {
        this.remember();
        this.eraseNode(node);
        sound.play('pop', { pitch: 0.7 });
        this.edited();
      } else {
        const stick = this.stickAt(p.x, p.y);
        if (stick >= 0) {
          this.remember();
          this.plan.sticks.splice(stick, 1);
          sound.play('pop', { pitch: 0.7 });
          this.edited();
        }
      }
    }
  }

  move(px: number, py: number): void {
    if (!this.drag) return;
    const p = toWorld(this.view, px, py);
    if (Math.hypot(p.x - this.drag.x, p.y - this.drag.y) > 0.04) this.drag.moved = true;
    this.drag.x = p.x;
    this.drag.y = p.y;
    if (this.tool === 'move') {
      Object.assign(this.plan.nodes[this.drag.node], this.clampPoint(p.x, p.y));
      this.plan.kind = 'Own';
    }
  }

  up(): void {
    const drag = this.drag;
    this.drag = null;
    if (!drag || this.tool !== 'draw' || !drag.moved) return;
    if (this.plan.sticks.length >= MAX_STICKS) return;
    let target = this.nodeAt(drag.x, drag.y, drag.node);
    if (!drag.fresh) this.remember();
    if (target < 0) {
      if (this.plan.nodes.length >= MAX_NODES) return;
      this.plan.nodes.push(this.clampPoint(drag.x, drag.y));
      target = this.plan.nodes.length - 1;
    }
    const exists = this.plan.sticks.some(
      (s) => (s.a === drag.node && s.b === target) || (s.a === target && s.b === drag.node),
    );
    if (!exists) this.plan.sticks.push({ a: drag.node, b: target, muscle: true });
    sound.play('pop', { pitch: 1.3 });
    this.edited();
  }

  draw(ctx: CanvasRenderingContext2D, w: number, time: number): void {
    const v = this.view;
    drawGround(ctx, v, w);
    drawPlan(ctx, v, this.plan, time, this.attached());
    if (this.drag && this.tool === 'draw' && this.drag.moved) {
      const from = this.plan.nodes[this.drag.node];
      ctx.strokeStyle = 'rgba(251, 95, 117, 0.6)';
      ctx.lineWidth = 0.055 * v.scale;
      ctx.lineCap = 'round';
      ctx.setLineDash([8, 12]);
      ctx.beginPath();
      ctx.moveTo(sx(v, from.x), sy(v, from.y));
      ctx.lineTo(sx(v, this.drag.x), sy(v, this.drag.y));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COLOR.node;
      ctx.beginPath();
      ctx.arc(sx(v, this.drag.x), sy(v, this.drag.y), NODE_R * v.scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private nodeAt(x: number, y: number, ignore = -1, reach = 0.14): number {
    let best = -1;
    let bestD = reach;
    this.plan.nodes.forEach((n, i) => {
      if (i === ignore) return;
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  private stickAt(x: number, y: number): number {
    let best = -1;
    let bestD = 0.08;
    this.plan.sticks.forEach((s, i) => {
      const a = this.plan.nodes[s.a];
      const b = this.plan.nodes[s.b];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy || 1e-9;
      const t = Math.min(1, Math.max(0, ((x - a.x) * dx + (y - a.y) * dy) / len2));
      const d = Math.hypot(a.x + t * dx - x, a.y + t * dy - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  private eraseNode(node: number): void {
    this.plan.nodes.splice(node, 1);
    this.plan.sticks = this.plan.sticks
      .filter((s) => s.a !== node && s.b !== node)
      .map((s) => ({ ...s, a: s.a > node ? s.a - 1 : s.a, b: s.b > node ? s.b - 1 : s.b }));
  }
}
