// Phase 4: Save the Netherlands — shallow-water flooding over a stylized
// Dutch coast (Canvas 2D). Toy mode: terraform and splash. Game mode: build
// dikes on a sand budget against three escalating storm surges.
import type { ArcadeGame, GameHost, GameInstance } from '../../shell/types';
import { scoreFlow, type ScoreFlowHandle } from '../../shell/scoreflow';
import { FloodSim, GRID_H, GRID_W } from './water';

/** Virtual canvas pixels per grid cell (world is 1600x900). */
const CELL = 10;
const VIRT_W = GRID_W * CELL;
const VIRT_H = GRID_H * CELL;
const SIM_DT = 1 / 90;

interface Storm {
  name: string;
  blurb: string;
  surge: number;
  wave: number;
  sand: number;
}

// Surges calibrated against the map's dike crests (headless playtests in the
// Phase 4 commit): each storm breaks exactly one more line of defense.
const STORMS: Storm[] = [
  {
    name: 'Herfststorm 🍂',
    blurb: 'A storm surge is heading for Zeeland! Protect Oma 👵 and the islands in the south.',
    surge: 1.8,
    wave: 0.35,
    sand: 160,
  },
  {
    name: 'Noordwester ⛈️',
    blurb: 'A serious one: the low northern dunes and the river mouths will not hold this.',
    surge: 2.6,
    wave: 0.4,
    sand: 250,
  },
  {
    name: 'Watersnood! 🌊',
    blurb: 'The big one — like 1953. Every weak spot in the coast is about to break.',
    surge: 3.2,
    wave: 0.5,
    sand: 200,
  },
];

const BUILD_TIME = 18;
const RAMP = 8;
const HOLD = 16;
const FALL = 10;
/** Terrain raised per brush pass while painting a dike. */
const BUILD_AMOUNT = 0.6;
const CALM_WAVE = 0.06;

type Tool = 'build' | 'dig' | 'splash';
type GamePhase = 'intro' | 'build' | 'storm' | 'summary';

class FloodInstance implements GameInstance {
  private sim = new FloodSim();
  private ctx!: CanvasRenderingContext2D;
  private off = document.createElement('canvas');
  private offCtx!: CanvasRenderingContext2D;
  private img!: ImageData;

  private mode: 'toy' | 'game' = 'toy';
  private tool: Tool = 'build';
  private toyStorm = false;
  private dragging = false;
  private cursor: { x: number; y: number } | null = null;
  private lastCell = { x: 0, y: 0 };
  private time = 0;

  private phase: GamePhase = 'intro';
  private round = 0;
  private phaseTime = 0;
  private sand = 0;
  private totalSaved = 0;
  private summaryTimer = 0;

  private toyBar!: HTMLElement;
  private gameBar!: HTMLElement;
  private hudLeft!: HTMLElement;
  private hudRight!: HTMLElement;
  private hint!: HTMLElement;
  private card: HTMLElement | null = null;
  private flow: ScoreFlowHandle | null = null;
  private buttons: Record<string, HTMLButtonElement> = {};

  private onPointerDown = (e: PointerEvent) => {
    const c = this.toCell(e);
    this.dragging = true;
    this.lastCell = c;
    this.applyTool(c.x, c.y);
  };
  private onPointerMove = (e: PointerEvent) => {
    const c = this.toCell(e);
    this.cursor = c;
    if (!this.dragging) return;
    // Apply along the drag path so fast swipes leave no gaps.
    const dist = Math.hypot(c.x - this.lastCell.x, c.y - this.lastCell.y);
    const steps = Math.max(1, Math.ceil(dist / 0.8));
    for (let k = 1; k <= steps; k++) {
      this.applyTool(
        this.lastCell.x + ((c.x - this.lastCell.x) * k) / steps,
        this.lastCell.y + ((c.y - this.lastCell.y) * k) / steps,
      );
    }
    this.lastCell = c;
  };
  private onPointerUp = () => {
    this.dragging = false;
  };

  constructor(private host: GameHost) {}

  start(): void {
    this.ctx = this.host.canvas.getContext('2d')!;
    this.off.width = GRID_W;
    this.off.height = GRID_H;
    this.offCtx = this.off.getContext('2d')!;
    this.img = this.offCtx.createImageData(GRID_W, GRID_H);
    this.buildUi();
    const canvas = this.host.canvas;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.setTool('build');
    this.hint.textContent =
      'Drag to build dikes and dunes — then try the 🌩️ Storm button and hold back the sea!';
  }

  frame(dt: number): void {
    this.time += dt;
    if (this.mode === 'game') this.stepGame(dt);
    else this.stepToy(dt);

    const n = Math.max(1, Math.min(4, Math.round(dt / SIM_DT)));
    for (let i = 0; i < n; i++) this.sim.step(dt / n);
    if (this.mode === 'toy' || this.phase === 'storm') this.sim.updateFlooding();

    this.updateHud();
    this.draw();
  }

  destroy(): void {
    const canvas = this.host.canvas;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.flow?.dispose();
    this.card?.remove();
  }

  // ---- game flow ----

  private startGame(): void {
    this.flow?.dispose();
    this.flow = null;
    this.mode = 'game';
    this.round = 0;
    this.totalSaved = 0;
    this.sand = 0;
    this.toyStorm = false;
    this.sim.resetAll();
    this.toyBar.classList.add('hidden');
    this.gameBar.classList.remove('hidden');
    this.setTool('build');
    this.showIntro();
  }

  private showIntro(): void {
    const storm = STORMS[this.round];
    this.sim.resetWater();
    this.sim.seaLevel = 0;
    this.sim.waveAmp = CALM_WAVE;
    this.phase = 'intro';
    this.sand += storm.sand;
    this.hint.textContent = '';

    this.showCard((card) => {
      const heading = document.createElement('h2');
      heading.textContent = `Storm ${this.round + 1} of ${STORMS.length}`;
      const name = document.createElement('div');
      name.className = 'score-flow-score';
      name.textContent = storm.name;
      const blurb = document.createElement('p');
      blurb.className = 'score-flow-prompt';
      blurb.textContent = `${storm.blurb} Expected surge: +${storm.surge.toFixed(1)} m. You get 🏖️ ${storm.sand} sand — drag to build dikes where the water will come in. Dikes you built before are still standing!`;
      const actions = document.createElement('div');
      actions.className = 'score-flow-actions';
      const go = document.createElement('button');
      go.className = 'arcade-button';
      go.textContent = '▶ To work!';
      go.addEventListener('click', () => {
        this.card?.remove();
        this.card = null;
        this.phase = 'build';
        this.phaseTime = 0;
        this.hint.textContent = 'Build now — you can keep building during the storm, but hurry!';
      });
      actions.appendChild(go);
      card.append(heading, name, blurb, actions);
    });
  }

  private stepGame(dt: number): void {
    const storm = STORMS[this.round];
    if (this.phase === 'build') {
      this.phaseTime += dt;
      this.sim.seaLevel = 0;
      this.sim.waveAmp = CALM_WAVE;
      if (this.phaseTime >= BUILD_TIME) {
        this.phase = 'storm';
        this.phaseTime = 0;
        this.hint.textContent = 'Here it comes! 🌊 Emergency repairs are still allowed.';
      }
    } else if (this.phase === 'storm') {
      this.phaseTime += dt;
      const t = this.phaseTime;
      const env =
        t < RAMP ? t / RAMP : t < RAMP + HOLD ? 1 : Math.max(0, 1 - (t - RAMP - HOLD) / FALL);
      this.sim.seaLevel = storm.surge * env;
      this.sim.waveAmp = CALM_WAVE + storm.wave * env;
      if (t >= RAMP + HOLD + FALL) this.endRound();
    } else if (this.phase === 'summary' && this.card) {
      this.summaryTimer -= dt;
      if (this.summaryTimer <= 0) this.nextRound();
    }
  }

  private endRound(): void {
    const stats = this.sim.savedStats();
    this.totalSaved += stats.saved;
    this.phase = 'summary';
    if (this.round >= STORMS.length - 1) {
      this.finishGame();
      return;
    }
    this.summaryTimer = 5;
    this.showCard((card) => {
      const heading = document.createElement('h2');
      heading.textContent = `${STORMS[this.round].name} has passed!`;
      const score = document.createElement('div');
      score.className = 'score-flow-score';
      score.textContent = `${(stats.saved * 1000).toLocaleString()} people stayed dry`;
      const note = document.createElement('p');
      note.className = 'score-flow-prompt';
      note.textContent = `${
        stats.omaDry ? 'Oma is safe! 👵✨' : 'Oh no — Oma got wet feet! 👵💧'
      } The next storm will be worse. Your dikes stay, and more sand is coming.`;
      const actions = document.createElement('div');
      actions.className = 'score-flow-actions';
      const next = document.createElement('button');
      next.className = 'arcade-button';
      next.textContent = '▶ Next storm';
      next.addEventListener('click', () => this.nextRound());
      actions.appendChild(next);
      card.append(heading, score, note, actions);
    });
  }

  private nextRound(): void {
    if (this.phase !== 'summary') return;
    this.round++;
    this.showIntro();
  }

  private finishGame(): void {
    this.card?.remove();
    this.card = null;
    this.flow?.dispose();
    this.flow = scoreFlow({
      gameId: 'floodland',
      heading: '🏆 The storms have passed!',
      score: this.totalSaved * 1000,
      scoreLabel: `${(this.totalSaved * 1000).toLocaleString()} people saved`,
      actions: [
        { label: '🔁 Play again', onClick: () => this.startGame() },
        { label: '🏝️ Free play', onClick: () => this.exitToToy() },
      ],
    });
    this.host.overlay.appendChild(this.flow.element);
  }

  private exitToToy(): void {
    this.flow?.dispose();
    this.flow = null;
    this.card?.remove();
    this.card = null;
    this.mode = 'toy';
    this.toyStorm = false;
    this.sim.resetAll();
    this.sim.waveAmp = CALM_WAVE;
    this.gameBar.classList.add('hidden');
    this.toyBar.classList.remove('hidden');
    this.setTool('build');
    this.hint.textContent =
      'Drag to build dikes and dunes — then try the 🌩️ Storm button and hold back the sea!';
  }

  // ---- toy mode ----

  private stepToy(dt: number): void {
    const target = this.toyStorm ? 2.4 : 0;
    const diff = target - this.sim.seaLevel;
    this.sim.seaLevel += Math.sign(diff) * Math.min(Math.abs(diff), 0.45 * dt);
    this.sim.waveAmp = CALM_WAVE + (this.toyStorm ? 0.45 * Math.min(1, this.sim.seaLevel / 2) : 0);
  }

  // ---- input ----

  private applyTool(cx: number, cy: number): void {
    if (this.mode === 'game') {
      if (this.phase !== 'build' && this.phase !== 'storm') return;
      this.sand -= this.sim.raise(cx, cy, BUILD_AMOUNT, this.sand);
      return;
    }
    if (this.tool === 'build') this.sim.raise(cx, cy, BUILD_AMOUNT, Infinity);
    else if (this.tool === 'dig') this.sim.lower(cx, cy, 1);
    else this.sim.splash(cx, cy);
  }

  private toCell(e: PointerEvent): { x: number; y: number } {
    const rect = this.host.canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / VIRT_W, rect.height / VIRT_H);
    const ox = (rect.width - VIRT_W * scale) / 2;
    const oy = (rect.height - VIRT_H * scale) / 2;
    return {
      x: (e.clientX - rect.left - ox) / scale / CELL,
      y: (e.clientY - rect.top - oy) / scale / CELL,
    };
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

    this.toyBar = document.createElement('div');
    this.toyBar.className = 'game-toolbar';
    add(this.toyBar, 'build', '🏗️', 'Build', () => this.setTool('build'));
    add(this.toyBar, 'dig', '⛏️', 'Dig', () => this.setTool('dig'));
    add(this.toyBar, 'splash', '💦', 'Splash', () => this.setTool('splash'));
    add(this.toyBar, 'storm', '🌩️', 'Storm', () => {
      this.toyStorm = !this.toyStorm;
      this.buttons.storm.classList.toggle('active', this.toyStorm);
      if (!this.toyStorm) this.sim.resetWater();
    });
    add(this.toyBar, 'reset', '🧹', 'Reset', () => {
      this.toyStorm = false;
      this.buttons.storm.classList.remove('active');
      this.sim.resetAll();
      this.sim.waveAmp = CALM_WAVE;
    });
    add(this.toyBar, 'challenge', '⛈️', 'Challenge', () => this.startGame());

    this.gameBar = document.createElement('div');
    this.gameBar.className = 'game-toolbar hidden';
    add(this.gameBar, 'stop', '⏹', 'Stop', () => this.exitToToy());

    const hud = document.createElement('div');
    hud.className = 'challenge-hud';
    this.hudLeft = document.createElement('span');
    this.hudRight = document.createElement('span');
    hud.append(this.hudLeft, this.hudRight);

    this.hint = document.createElement('p');
    this.hint.className = 'challenge-hint';

    this.host.overlay.append(this.toyBar, this.gameBar, hud, this.hint);
  }

  private setTool(tool: Tool): void {
    this.tool = tool;
    for (const key of ['build', 'dig', 'splash'] as const) {
      this.buttons[key]?.classList.toggle('active', tool === key);
    }
  }

  private showCard(build: (card: HTMLElement) => void): void {
    this.card?.remove();
    this.card = document.createElement('div');
    this.card.className = 'score-flow';
    build(this.card);
    this.host.overlay.appendChild(this.card);
  }

  private updateHud(): void {
    const stats = this.sim.savedStats();
    const dry = `🏠 ${(stats.saved * 1000).toLocaleString()} dry`;
    if (this.mode === 'game') {
      this.hudLeft.textContent = `🏖️ ${Math.max(0, Math.round(this.sand))} sand   ${dry}`;
      const storm = STORMS[this.round];
      let status = `Storm ${this.round + 1}/${STORMS.length}`;
      if (this.phase === 'build') {
        status += ` · 🌊 arrives in ${Math.max(0, Math.ceil(BUILD_TIME - this.phaseTime))} s`;
      } else if (this.phase === 'storm') {
        status += ` · ${storm.name} surge +${this.sim.seaLevel.toFixed(1)} m`;
      }
      this.hudRight.textContent = `  |  ${status} · saved so far: ${(this.totalSaved * 1000).toLocaleString()}`;
    } else {
      this.hudLeft.textContent = dry;
      this.hudRight.textContent =
        this.sim.seaLevel > 0.05 ? `  |  🌊 sea +${this.sim.seaLevel.toFixed(1)} m` : '';
    }
  }

  // ---- rendering ----

  private draw(): void {
    const ctx = this.ctx;
    const canvas = this.host.canvas;
    const dpr = this.host.dpr;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const scale = Math.min(w / VIRT_W, h / VIRT_H);
    const ox = (w - VIRT_W * scale) / 2;
    const oy = (h - VIRT_H * scale) / 2;

    this.paintCells();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, w, h);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.off, 0, 0, VIRT_W, VIRT_H);

    this.drawOverlays(ctx);
  }

  /** Terrain + water colors into the grid-resolution ImageData. */
  private paintCells(): void {
    const { terrain, water, built } = this.sim;
    const data = this.img.data;
    for (let i = 0; i < GRID_W * GRID_H; i++) {
      const t = terrain[i];
      let r: number;
      let g: number;
      let b: number;
      if (t < 0) {
        // Polder / sea floor greens (only visible where dry).
        const k = Math.min(1, -t / 3);
        r = 74 - 22 * k;
        g = 108 - 26 * k;
        b = 60 - 14 * k;
      } else if (t < 0.5) {
        r = 205;
        g = 187;
        b = 132; // beach sand
      } else if (t < 2.8) {
        const k = (t - 0.5) / 2.3;
        r = 118 - 20 * k;
        g = 146 - 16 * k;
        b = 82 - 8 * k; // grass
      } else {
        const k = Math.min(1, (t - 2.8) / 2.2);
        r = 120 + 34 * k;
        g = 122 + 16 * k;
        b = 86 + 16 * k; // high dunes
      }
      const bl = Math.min(1, built[i]) * 0.7;
      r += (176 - r) * bl;
      g += (158 - g) * bl;
      b += (128 - b) * bl; // sandbag tint on player dikes
      const wd = water[i];
      if (wd > 0.03) {
        const k = Math.min(1, wd / 4);
        const foam = Math.min(1, this.sim.flux(i) * 0.35) * Math.min(1, wd * 3);
        let wr = 66 - 44 * k;
        let wg = 138 - 74 * k;
        let wb = 196 - 82 * k;
        wr += (215 - wr) * foam * 0.55;
        wg += (232 - wg) * foam * 0.55;
        wb += (244 - wb) * foam * 0.55;
        const alpha = Math.min(0.93, 0.5 + wd * 0.22);
        r += (wr - r) * alpha;
        g += (wg - g) * alpha;
        b += (wb - b) * alpha;
      }
      const p = i * 4;
      data[p] = r;
      data[p + 1] = g;
      data[p + 2] = b;
      data[p + 3] = 255;
    }
    this.offCtx.putImageData(this.img, 0, 0);
  }

  private drawOverlays(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = '600 26px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(235, 243, 255, 0.35)';
    ctx.fillText('N O O R D Z E E', 130, 420);

    for (const v of this.sim.villages) {
      let dry = 0;
      for (const house of v.houses) {
        const px = house.x * CELL + CELL / 2;
        const py = house.y * CELL + CELL / 2;
        ctx.font = '15px system-ui, sans-serif';
        if (house.flooded) {
          ctx.globalAlpha = 0.55;
          ctx.fillText('🏠', px, py);
          ctx.globalAlpha = 1;
          ctx.font = '11px system-ui, sans-serif';
          ctx.fillText('💧', px + 5, py - 5);
        } else {
          dry++;
          ctx.fillText('🏠', px, py);
        }
      }
      if (v.oma) {
        ctx.font = '15px system-ui, sans-serif';
        ctx.fillText('👵', v.x * CELL + 5, v.y * CELL - 12);
      }
      const lx = v.x * CELL + 5;
      // Southern villages get their label above, clear of the toolbar.
      const ly = v.y > 74 ? v.y * CELL - (v.oma ? 40 : 26) : v.y * CELL + 32;
      ctx.font = '700 17px system-ui, sans-serif';
      ctx.fillStyle = dry === 0 ? '#fb5f75' : '#eef2ff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 5;
      ctx.fillText(v.name, lx, ly);
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.fillStyle = dry === 0 ? '#fb5f75' : 'rgba(238, 242, 255, 0.75)';
      ctx.fillText(`${v.pop}k`, lx, ly + 17);
      ctx.shadowBlur = 0;
    }

    // Storm ambience: rain streaks and a dark tint scaling with the surge.
    const intensity = Math.min(1, this.sim.seaLevel / 2.5);
    if (intensity > 0.05) {
      ctx.fillStyle = `rgba(10, 16, 38, ${0.22 * intensity})`;
      ctx.fillRect(0, 0, VIRT_W, VIRT_H);
      ctx.strokeStyle = `rgba(190, 210, 235, ${0.25 * intensity})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let k = 0; k < 70 * intensity; k++) {
        const x = ((k * 379 + this.time * 900) % (VIRT_W + 200)) - 100;
        const y = (k * 811 + this.time * 1700) % VIRT_H;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 10, y + 22);
      }
      ctx.stroke();
    }

    // Brush cursor.
    if (this.cursor && (this.mode === 'toy' || this.phase === 'build' || this.phase === 'storm')) {
      ctx.strokeStyle =
        this.tool === 'dig' ? 'rgba(251, 146, 60, 0.8)' : 'rgba(238, 242, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(this.cursor.x * CELL, this.cursor.y * CELL, 2 * CELL, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

export const floodland: ArcadeGame = {
  id: 'floodland',
  title: 'Save the Netherlands',
  scienceLine:
    'Real shallow-water equations — after the 1953 flood, Dutch mathematicians computed storm surges to design the Delta Works, and our group still works on flood-safety simulation with Deltares.',
  tileEmoji: '🌊',
  create: (host) => new FloodInstance(host),
};
