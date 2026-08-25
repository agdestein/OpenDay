// Phase 5: Creature Lab — teach a stick creature to walk with evolution.
// Build mode: draw a body from dots, bones and muscles (or pick a preset).
// Train mode: a whole generation flails on screen at once; the best walkers
// breed, and the learning curve draws itself. Race mode: your champion vs the
// reigning champ of the day, distance in 12 s -> leaderboard.
import type { ArcadeGame, GameHost, GameInstance } from '../../shell/types';
import { scoreFlow, type ScoreFlowHandle } from '../../shell/scoreflow';
import {
  Creature,
  FIXED_DT,
  NODE_R,
  muscleCount,
  type BodyPlan,
  type Genome,
} from './physics';
import { POPULATION, nextGeneration, randomGenome } from './evolve';
import { clonePlan, FALLBACK_CHAMP, PRESETS } from './presets';

/** Sim-seconds each generation gets to walk. */
const EVAL_TIME = 7;
const RACE_TIME = 12;
const COUNTDOWN = 3;
const SPEEDS = [1, 3, 10];
const MAX_NODES = 12;
const MAX_STICKS = 18;
const CHAMP_KEY = 'creature-champ-v1';

const COLOR = {
  node: '#eef2ff',
  bone: '#94a3b8',
  muscle: '#fb5f75',
  you: '#7dd3fc',
  champ: '#fbbf24',
  ground: 'rgba(255, 255, 255, 0.25)',
  groundFill: 'rgba(255, 255, 255, 0.05)',
};

type Mode = 'build' | 'train' | 'race';
type Tool = 'draw' | 'move' | 'type' | 'erase';

interface StoredChamp {
  name: string;
  score: number;
  plan: BodyPlan;
  genome: Genome;
}

/** A camera-defined horizontal band of the canvas with its own ground line. */
interface View {
  camX: number;
  scale: number;
  top: number;
  height: number;
  groundY: number;
}

interface Racer {
  creature: Creature;
  label: string;
  color: string;
  camX: number;
}

class CreatureInstance implements GameInstance {
  private ctx!: CanvasRenderingContext2D;
  private mode: Mode = 'build';
  private time = 0;

  // Build state.
  private plan: BodyPlan = clonePlan(PRESETS[0].plan);
  private tool: Tool = 'draw';
  private drag: { node: number; moved: boolean; x: number; y: number } | null = null;

  // Train state.
  private genomes: Genome[] = [];
  private creatures: Creature[] = [];
  private generation = 1;
  private genElapsed = 0;
  private speedIdx = 1;
  private stepAccum = 0;
  private bestEver: { fitness: number; dist: number; genome: Genome } | null = null;
  private history: number[] = [];
  private trainCamX = 0;

  // Race state.
  private racers: Racer[] = [];
  private raceElapsed = 0;
  private raceOver = false;

  private presetBar!: HTMLElement;
  private buildBar!: HTMLElement;
  private trainBar!: HTMLElement;
  private hud!: HTMLElement;
  private hint!: HTMLElement;
  private buttons: Record<string, HTMLButtonElement> = {};
  private flow: ScoreFlowHandle | null = null;

  private onPointerDown = (e: PointerEvent) => {
    if (this.mode !== 'build') return;
    const p = this.toWorld(e);
    const node = this.nodeAt(p.x, p.y);
    if (this.tool === 'draw') {
      if (node >= 0) {
        this.drag = { node, moved: false, x: p.x, y: p.y };
      } else if (this.plan.nodes.length < MAX_NODES) {
        this.plan.nodes.push({ x: p.x, y: Math.max(p.y, NODE_R) });
        this.drag = { node: this.plan.nodes.length - 1, moved: false, x: p.x, y: p.y };
        this.refreshBuildUi();
      }
    } else if (this.tool === 'move') {
      if (node >= 0) this.drag = { node, moved: false, x: p.x, y: p.y };
    } else if (this.tool === 'type') {
      const stick = this.stickAt(p.x, p.y);
      if (stick >= 0) {
        this.plan.sticks[stick].muscle = !this.plan.sticks[stick].muscle;
        this.refreshBuildUi();
      }
    } else if (this.tool === 'erase') {
      if (node >= 0) this.eraseNode(node);
      else {
        const stick = this.stickAt(p.x, p.y);
        if (stick >= 0) this.plan.sticks.splice(stick, 1);
      }
      this.refreshBuildUi();
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.drag) return;
    const p = this.toWorld(e);
    if (Math.hypot(p.x - this.drag.x, p.y - this.drag.y) > 0.04) this.drag.moved = true;
    this.drag.x = p.x;
    this.drag.y = p.y;
    if (this.tool === 'move') {
      const n = this.plan.nodes[this.drag.node];
      n.x = Math.min(2.5, Math.max(-2.5, p.x));
      n.y = Math.min(3, Math.max(NODE_R, p.y));
    }
  };

  private onPointerUp = () => {
    const drag = this.drag;
    this.drag = null;
    if (!drag || this.tool !== 'draw' || !drag.moved) return;
    if (this.plan.sticks.length >= MAX_STICKS) return;
    let target = this.nodeAt(drag.x, drag.y, drag.node);
    if (target < 0) {
      if (this.plan.nodes.length >= MAX_NODES) return;
      this.plan.nodes.push({ x: drag.x, y: Math.max(drag.y, NODE_R) });
      target = this.plan.nodes.length - 1;
    }
    const exists = this.plan.sticks.some(
      (s) =>
        (s.a === drag.node && s.b === target) || (s.a === target && s.b === drag.node),
    );
    if (!exists) this.plan.sticks.push({ a: drag.node, b: target, muscle: true });
    this.refreshBuildUi();
  };

  constructor(private host: GameHost) {}

  start(): void {
    this.ctx = this.host.canvas.getContext('2d')!;
    this.buildUi();
    const c = this.host.canvas;
    c.addEventListener('pointerdown', this.onPointerDown);
    c.addEventListener('pointermove', this.onPointerMove);
    c.addEventListener('pointerup', this.onPointerUp);
    this.enterBuild();
  }

  frame(dt: number): void {
    this.time += dt;
    if (this.mode === 'train') this.stepTrain(dt);
    else if (this.mode === 'race') this.stepRace(dt);
    this.updateHud();
    this.draw();
  }

  destroy(): void {
    const c = this.host.canvas;
    c.removeEventListener('pointerdown', this.onPointerDown);
    c.removeEventListener('pointermove', this.onPointerMove);
    c.removeEventListener('pointerup', this.onPointerUp);
    this.flow?.dispose();
  }

  // ---- mode switching ----

  private enterBuild(): void {
    this.mode = 'build';
    this.flow?.dispose();
    this.flow = null;
    this.presetBar.classList.remove('hidden');
    this.buildBar.classList.remove('hidden');
    this.trainBar.classList.add('hidden');
    this.setTool('draw');
    this.refreshBuildUi();
  }

  private enterTrain(fresh: boolean): void {
    if (fresh) {
      this.genomes = Array.from({ length: POPULATION }, () => randomGenome(this.plan));
      this.generation = 1;
      this.bestEver = null;
      this.history = [];
    }
    this.mode = 'train';
    this.flow?.dispose();
    this.flow = null;
    this.presetBar.classList.add('hidden');
    this.buildBar.classList.add('hidden');
    this.trainBar.classList.remove('hidden');
    if (fresh) this.spawnGeneration();
    this.trainCamX = 0;
    this.hint.textContent =
      'Every creature has different muscle wiring — the farthest walkers get babies with small mutations. Nobody tells them HOW to walk!';
  }

  private spawnGeneration(): void {
    this.creatures = this.genomes.map((g) => new Creature(this.plan, g));
    this.genElapsed = 0;
    this.stepAccum = 0;
  }

  private endGeneration(): void {
    const scored = this.creatures.map((c, i) => ({
      genome: this.genomes[i],
      fitness: c.fitness(),
      dist: c.comX(),
    }));
    let best = scored[0];
    for (const s of scored) if (s.fitness > best.fitness) best = s;
    if (!this.bestEver || best.fitness > this.bestEver.fitness) {
      this.bestEver = { fitness: best.fitness, dist: best.dist, genome: best.genome };
    }
    this.history.push(Math.max(0, best.dist));
    this.genomes = nextGeneration(scored);
    this.generation++;
    this.spawnGeneration();
  }

  private enterRace(): void {
    const champ = this.loadChamp();
    const yourGenome = this.bestEver?.genome ?? this.leaderGenome();
    this.racers = [
      { creature: new Creature(champ.plan, champ.genome), label: `👑 ${champ.name}`, color: COLOR.champ, camX: 0 },
      { creature: new Creature(this.plan, yourGenome), label: '⭐ YOUR CREATURE', color: COLOR.you, camX: 0 },
    ];
    this.mode = 'race';
    this.raceElapsed = -COUNTDOWN;
    this.raceOver = false;
    this.stepAccum = 0;
    this.trainBar.classList.add('hidden');
    this.hint.textContent = 'Farthest in 12 seconds wins the crown! 🏁';
  }

  private leaderGenome(): Genome {
    let best = 0;
    for (let i = 1; i < this.creatures.length; i++) {
      if (this.creatures[i].fitness() > this.creatures[best].fitness()) best = i;
    }
    return this.genomes[best] ?? randomGenome(this.plan);
  }

  // ---- simulation ----

  private stepTrain(dt: number): void {
    this.stepAccum += dt * SPEEDS[this.speedIdx];
    let steps = Math.min(240, Math.floor(this.stepAccum / FIXED_DT));
    this.stepAccum -= steps * FIXED_DT;
    while (steps-- > 0) {
      for (const c of this.creatures) c.step();
      this.genElapsed += FIXED_DT;
      if (this.genElapsed >= EVAL_TIME) {
        this.endGeneration();
        break;
      }
    }
    const leader = Math.max(0, ...this.creatures.map((c) => c.comX()));
    this.trainCamX += (leader - this.trainCamX) * Math.min(1, dt * 3);
  }

  private stepRace(dt: number): void {
    if (this.raceOver) return;
    this.raceElapsed += dt;
    if (this.raceElapsed > 0) {
      this.stepAccum += Math.min(dt, this.raceElapsed);
      let steps = Math.min(240, Math.floor(this.stepAccum / FIXED_DT));
      this.stepAccum -= steps * FIXED_DT;
      while (steps-- > 0) for (const r of this.racers) r.creature.step();
    }
    for (const r of this.racers) {
      r.camX += (Math.max(0, r.creature.comX()) - r.camX) * Math.min(1, dt * 3);
    }
    if (this.raceElapsed >= RACE_TIME) this.finishRace();
  }

  private finishRace(): void {
    this.raceOver = true;
    const champDist = this.racers[0].creature.comX();
    const yourDist = this.racers[1].creature.comX();
    const won = yourDist > champDist;
    if (won) {
      this.saveChamp({
        name: 'CHAMP',
        score: yourDist,
        plan: clonePlan(this.plan),
        genome: this.racers[1].creature.genome,
      });
    }
    this.hint.textContent = '';
    this.flow?.dispose();
    this.flow = scoreFlow({
      gameId: 'creature',
      heading: won ? '👑 You took the crown!' : '🏁 The champ holds the throne!',
      score: Math.round(Math.max(0, yourDist) * 100),
      scoreLabel: `You: ${yourDist.toFixed(2)} m — Champ: ${champDist.toFixed(2)} m`,
      actions: [
        { label: '🧠 Train more', onClick: () => this.enterTrain(false) },
        { label: '🛠 New creature', onClick: () => this.enterBuild() },
      ],
    });
    this.host.overlay.appendChild(this.flow.element);
  }

  private loadChamp(): StoredChamp {
    try {
      const raw = localStorage.getItem(CHAMP_KEY);
      if (raw) {
        const champ = JSON.parse(raw) as StoredChamp;
        if (champ.plan?.nodes?.length && champ.genome?.muscles) return champ;
      }
    } catch {
      // Fall through to the built-in champion.
    }
    return FALLBACK_CHAMP;
  }

  private saveChamp(champ: StoredChamp): void {
    try {
      localStorage.setItem(CHAMP_KEY, JSON.stringify(champ));
    } catch {
      // localStorage full or unavailable — the race still worked.
    }
  }

  // ---- editor helpers ----

  private nodeAt(x: number, y: number, ignore = -1): number {
    let best = -1;
    let bestD = 0.14;
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
    let bestD = 0.07;
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
    if (this.plan.nodes.length <= 2) return;
    this.plan.nodes.splice(node, 1);
    this.plan.sticks = this.plan.sticks
      .filter((s) => s.a !== node && s.b !== node)
      .map((s) => ({
        ...s,
        a: s.a > node ? s.a - 1 : s.a,
        b: s.b > node ? s.b - 1 : s.b,
      }));
  }

  // ---- UI ----

  private buildUi(): void {
    const add = (
      bar: HTMLElement,
      key: string,
      emoji: string,
      label: string,
      onClick: () => void,
    ): HTMLButtonElement => {
      const button = document.createElement('button');
      button.className = 'tool-button';
      const icon = document.createElement('span');
      icon.className = 'tool-emoji';
      icon.textContent = emoji;
      const text = document.createElement('span');
      text.className = 'tool-label';
      text.textContent = label;
      button.append(icon, text);
      button.addEventListener('click', onClick);
      bar.appendChild(button);
      this.buttons[key] = button;
      return button;
    };

    this.presetBar = document.createElement('div');
    this.presetBar.className = 'game-toolbar creature-presets';
    for (const preset of PRESETS) {
      add(this.presetBar, `preset-${preset.name}`, preset.emoji, preset.name, () => {
        this.plan = clonePlan(preset.plan);
        this.refreshBuildUi();
      });
    }

    this.buildBar = document.createElement('div');
    this.buildBar.className = 'game-toolbar';
    add(this.buildBar, 'draw', '✏️', 'Draw', () => this.setTool('draw'));
    add(this.buildBar, 'move', '✋', 'Move', () => this.setTool('move'));
    add(this.buildBar, 'type', '💪', 'Bone/muscle', () => this.setTool('type'));
    add(this.buildBar, 'erase', '🧽', 'Erase', () => this.setTool('erase'));
    add(this.buildBar, 'train', '🧠', 'TRAIN!', () => this.enterTrain(true));

    this.trainBar = document.createElement('div');
    this.trainBar.className = 'game-toolbar hidden';
    add(this.trainBar, 'speed', '⏩', `Speed ×${SPEEDS[this.speedIdx]}`, () => {
      this.speedIdx = (this.speedIdx + 1) % SPEEDS.length;
      this.buttons.speed.querySelector('.tool-label')!.textContent =
        `Speed ×${SPEEDS[this.speedIdx]}`;
    });
    add(this.trainBar, 'race', '🏁', 'Race the champ', () => this.enterRace());
    add(this.trainBar, 'back', '🛠', 'Body shop', () => this.enterBuild());

    this.hud = document.createElement('div');
    this.hud.className = 'challenge-hud';
    this.hint = document.createElement('p');
    this.hint.className = 'challenge-hint';

    this.host.overlay.append(this.presetBar, this.buildBar, this.trainBar, this.hud, this.hint);
  }

  private setTool(tool: Tool): void {
    this.tool = tool;
    for (const key of ['draw', 'move', 'type', 'erase'] as const) {
      this.buttons[key].classList.toggle('active', key === tool);
    }
    this.hint.textContent = {
      draw: 'Drag from a dot to grow arms, legs and tails — then hit TRAIN! 🧠',
      move: 'Drag the dots to reshape your creature.',
      type: 'Click a stick to flip it: gray bones are stiff, red muscles push and pull.',
      erase: 'Click a dot or stick to remove it.',
    }[tool];
  }

  private refreshBuildUi(): void {
    const muscles = muscleCount(this.plan);
    const trainButton = this.buttons.train;
    trainButton.disabled = muscles === 0 || this.plan.sticks.length === 0;
    trainButton.querySelector('.tool-label')!.textContent = trainButton.disabled
      ? 'Needs a muscle!'
      : 'TRAIN!';
  }

  private updateHud(): void {
    if (this.mode === 'build') {
      const muscles = muscleCount(this.plan);
      this.hud.textContent = `🦴 ${this.plan.sticks.length - muscles}  💪 ${muscles}  ⚪ ${this.plan.nodes.length}/${MAX_NODES}`;
    } else if (this.mode === 'train') {
      const best = this.bestEver ? `${Math.max(0, this.bestEver.dist).toFixed(1)} m` : '—';
      this.hud.textContent = `🧬 Generation ${this.generation}   🏆 Best walk: ${best}   ⏱ ${Math.ceil(EVAL_TIME - this.genElapsed)}s`;
    } else {
      const t = Math.max(0, RACE_TIME - this.raceElapsed);
      const you = this.racers[1].creature.comX();
      const champ = this.racers[0].creature.comX();
      this.hud.textContent = this.raceOver
        ? `🏁 You: ${you.toFixed(2)} m — Champ: ${champ.toFixed(2)} m`
        : `⏱ ${t.toFixed(1)}s   ⭐ ${Math.max(0, you).toFixed(1)} m   👑 ${Math.max(0, champ).toFixed(1)} m`;
    }
  }

  // ---- rendering ----

  private size(): { w: number; h: number } {
    return {
      w: this.host.canvas.width / this.host.dpr,
      h: this.host.canvas.height / this.host.dpr,
    };
  }

  private draw(): void {
    const { w, h } = this.size();
    const ctx = this.ctx;
    ctx.setTransform(this.host.dpr, 0, 0, this.host.dpr, 0, 0);
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, w, h);

    if (this.mode === 'build') this.drawBuild(ctx, w, h);
    else if (this.mode === 'train') this.drawTrain(ctx, w, h);
    else this.drawRace(ctx, w, h);
  }

  private drawBuild(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const view: View = { camX: 0.55, scale: 0.3 * Math.min(w, h), top: 0, height: h, groundY: h * 0.78 };
    this.drawGround(ctx, view, w);
    this.drawPlan(ctx, view, w);
    if (this.drag && this.tool === 'draw' && this.drag.moved) {
      const from = this.plan.nodes[this.drag.node];
      ctx.strokeStyle = 'rgba(251, 95, 117, 0.6)';
      ctx.lineWidth = 6;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(this.sx(view, w, from.x), this.sy(view, from.y));
      ctx.lineTo(this.sx(view, w, this.drag.x), this.sy(view, this.drag.y));
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawTrain(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const view: View = {
      camX: Math.max(1.5, this.trainCamX) + 0.5,
      scale: 0.2 * Math.min(w, h),
      top: 0,
      height: h,
      groundY: h * 0.74,
    };
    this.drawGround(ctx, view, w);

    let leader = 0;
    for (let i = 1; i < this.creatures.length; i++) {
      if (this.creatures[i].comX() > this.creatures[leader].comX()) leader = i;
    }
    this.creatures.forEach((c, i) => {
      if (i !== leader) this.drawCreature(ctx, view, w, c, 0.16, COLOR.node);
    });
    const lead = this.creatures[leader];
    if (lead) {
      this.drawCreature(ctx, view, w, lead, 1, COLOR.you);
      const x = this.sx(view, w, lead.comX());
      ctx.fillStyle = 'rgba(238, 242, 255, 0.9)';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.max(0, lead.comX()).toFixed(1)} m`, x, this.sy(view, 0) - view.scale * 2.2);
    }

    // Record line.
    if (this.bestEver && this.bestEver.dist > 0.5) {
      const x = this.sx(view, w, this.bestEver.dist);
      if (x > -40 && x < w + 40) {
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
        ctx.setLineDash([10, 10]);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, view.groundY - view.scale * 3);
        ctx.lineTo(x, view.groundY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '34px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🏆', x, view.groundY - view.scale * 3 - 10);
      }
    }
    this.drawChart(ctx, w, h);
  }

  private drawRace(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const laneH = h / 2;
    this.racers.forEach((racer, i) => {
      const view: View = {
        camX: Math.max(1.5, racer.camX) + 1,
        scale: 0.17 * Math.min(w, h),
        top: i * laneH,
        height: laneH,
        groundY: i * laneH + laneH * 0.82,
      };
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, view.top, w, view.height);
      ctx.clip();
      this.drawGround(ctx, view, w);
      this.drawCreature(ctx, view, w, racer.creature, 1, racer.color);
      ctx.fillStyle = racer.color;
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(racer.label, 24, view.top + 42);
      ctx.restore();
    });
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, laneH);
    ctx.lineTo(w, laneH);
    ctx.stroke();

    if (this.raceElapsed < 0.8 && !this.raceOver) {
      const label = this.raceElapsed < 0 ? `${Math.ceil(-this.raceElapsed)}` : 'GO!';
      ctx.fillStyle = 'rgba(238, 242, 255, 0.95)';
      ctx.font = 'bold 120px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, w / 2, h / 2);
      ctx.textBaseline = 'alphabetic';
    }
  }

  private sx(view: View, w: number, wx: number): number {
    return w / 2 + (wx - view.camX) * view.scale;
  }

  private sy(view: View, wy: number): number {
    return view.groundY - wy * view.scale;
  }

  private drawGround(ctx: CanvasRenderingContext2D, view: View, w: number): void {
    ctx.fillStyle = COLOR.groundFill;
    ctx.fillRect(0, view.groundY, w, view.top + view.height - view.groundY);
    ctx.strokeStyle = COLOR.ground;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, view.groundY);
    ctx.lineTo(w, view.groundY);
    ctx.stroke();

    const left = Math.floor(view.camX - w / (2 * view.scale));
    const right = Math.ceil(view.camX + w / (2 * view.scale));
    ctx.fillStyle = 'rgba(238, 242, 255, 0.4)';
    ctx.font = '15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let m = left; m <= right; m++) {
      const x = this.sx(view, w, m);
      ctx.fillRect(x - 1, view.groundY, 2, 8);
      if (m > 0 && m % 1 === 0) ctx.fillText(`${m} m`, x, view.groundY + 26);
    }
    const startX = this.sx(view, w, 0);
    ctx.font = '30px system-ui, sans-serif';
    ctx.fillText('🚩', startX + 8, view.groundY - 8);
  }

  /** Draw a live creature (world positions from its Verlet points). */
  private drawCreature(
    ctx: CanvasRenderingContext2D,
    view: View,
    w: number,
    c: Creature,
    alpha: number,
    nodeColor: string,
  ): void {
    ctx.globalAlpha = alpha;
    for (const s of c.sticks) {
      const a = c.pts[s.a];
      const b = c.pts[s.b];
      if (!isFinite(a.x + a.y + b.x + b.y)) continue;
      const muscle = s.muscle >= 0;
      const strain = muscle ? c.stickStrain(s) : 0;
      ctx.strokeStyle = muscle ? COLOR.muscle : COLOR.bone;
      ctx.lineWidth = Math.max(2, (muscle ? 0.055 * (1 - strain * 1.5) : 0.045) * view.scale);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.sx(view, w, a.x), this.sy(view, a.y));
      ctx.lineTo(this.sx(view, w, b.x), this.sy(view, b.y));
      ctx.stroke();
    }
    c.pts.forEach((p, i) => {
      if (!isFinite(p.x + p.y)) return;
      const x = this.sx(view, w, p.x);
      const y = this.sy(view, p.y);
      ctx.fillStyle = i === 0 ? nodeColor : COLOR.node;
      ctx.beginPath();
      ctx.arc(x, y, (i === 0 ? NODE_R * 2 : NODE_R) * view.scale, 0, Math.PI * 2);
      ctx.fill();
      if (i === 0) this.drawEye(ctx, x, y, view.scale, p.x - p.px);
    });
    ctx.globalAlpha = 1;
  }

  /** Googly eye on the head, pupil looking in the direction of travel. */
  private drawEye(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    vx: number,
  ): void {
    const r = NODE_R * 1.1 * scale;
    const look = Math.sign(vx || 1) * r * 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b1020';
    ctx.beginPath();
    ctx.arc(x + look, y, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Draw the editable plan in build mode (static, with gently pulsing muscles). */
  private drawPlan(ctx: CanvasRenderingContext2D, view: View, w: number): void {
    this.plan.sticks.forEach((s, i) => {
      const a = this.plan.nodes[s.a];
      const b = this.plan.nodes[s.b];
      ctx.strokeStyle = s.muscle ? COLOR.muscle : COLOR.bone;
      const pulse = s.muscle ? 1 + 0.18 * Math.sin(this.time * 3 + i) : 1;
      ctx.lineWidth = (s.muscle ? 0.055 : 0.045) * view.scale * pulse;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.sx(view, w, a.x), this.sy(view, a.y));
      ctx.lineTo(this.sx(view, w, b.x), this.sy(view, b.y));
      ctx.stroke();
    });
    this.plan.nodes.forEach((n, i) => {
      const x = this.sx(view, w, n.x);
      const y = this.sy(view, n.y);
      ctx.fillStyle = COLOR.node;
      ctx.beginPath();
      ctx.arc(x, y, (i === 0 ? NODE_R * 2 : NODE_R * 1.3) * view.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(11, 16, 32, 0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (i === 0) this.drawEye(ctx, x, y, view.scale, 1);
    });
  }

  /** Learning curve: best distance per generation, bottom-left. */
  private drawChart(ctx: CanvasRenderingContext2D, _w: number, h: number): void {
    if (this.history.length === 0) return;
    const W = 320;
    const H = 120;
    const X = 24;
    const Y = h - H - 24;
    ctx.fillStyle = 'rgba(5, 8, 20, 0.6)';
    ctx.beginPath();
    ctx.roundRect(X - 10, Y - 30, W + 20, H + 44, 12);
    ctx.fill();
    ctx.fillStyle = 'rgba(238, 242, 255, 0.7)';
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('best distance per generation', X, Y - 10);
    const max = Math.max(1, ...this.history);
    const bw = Math.min(24, W / this.history.length);
    this.history.forEach((d, i) => {
      const bh = Math.max(2, (H * d) / max);
      ctx.fillStyle = i === this.history.length - 1 ? COLOR.you : 'rgba(125, 211, 252, 0.45)';
      ctx.fillRect(X + i * bw, Y + H - bh, bw - 3, bh);
    });
  }

  private toWorld(e: PointerEvent): { x: number; y: number } {
    const rect = this.host.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const view: View = { camX: 0.55, scale: 0.3 * Math.min(w, h), top: 0, height: h, groundY: h * 0.78 };
    return {
      x: (e.clientX - rect.left - w / 2) / view.scale + view.camX,
      y: (view.groundY - (e.clientY - rect.top)) / view.scale,
    };
  }
}

export const creature: ArcadeGame = {
  id: 'creature',
  title: 'Creature Lab',
  scienceLine:
    'Nobody programmed these creatures to walk — they learn by evolution: try, keep the best, mutate, repeat. The same trial-and-error math trains real robots.',
  tileEmoji: '🧬',
  create: (host) => new CreatureInstance(host),
};
