// Phase 1: the fluid playground (toy mode). Phase 2 adds the wind-farm game
// mode on top of this solver, hence the directory name.
import type { ArcadeGame, GameHost, GameInstance } from '../../shell/types';
import { FluidSolver, type Obstacle } from './fluid';

const SPLAT_FORCE = 6000; // uv-space pointer delta -> velocity (cells/sec)
const DYE_RADIUS = 0.0025;
const OBSTACLE_RADIUS = 0.07; // fraction of screen height
const MAX_PLACED_OBSTACLES = 12;
const WIND_SPEED = 60; // cells/sec; sim is 256 cells wide
const STREAK_COUNT = 6;

type Mode = 'stir' | 'blocks';

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

class FluidInstance implements GameInstance {
  private solver: FluidSolver | null = null;
  private mode: Mode = 'stir';
  private windOn = false;
  private obstacles: Obstacle[] = [];
  private hue = Math.random();
  private time = 0;
  private frameEma = 16;
  private warmup = 0;
  private downgraded = false;
  private pointerDown = false;
  private last = { x: 0, y: 0 };
  private buttons: Partial<Record<Mode | 'wind', HTMLButtonElement>> = {};

  private onContextMenu = (e: Event) => e.preventDefault();
  private onPointerDown = (e: PointerEvent) => {
    const { x, y } = this.toUv(e);
    if (e.button === 2 || this.mode === 'blocks') {
      this.toggleObstacle(x, y);
      return;
    }
    this.pointerDown = true;
    this.last = { x, y };
  };
  private onPointerMove = (e: PointerEvent) => {
    if (!this.pointerDown || !this.solver) return;
    const { x, y } = this.toUv(e);
    let dx = x - this.last.x;
    let dy = y - this.last.y;
    this.last = { x, y };
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return;
    // Clamp per-event deltas so fast flicks don't inject absurd velocities.
    if (dist > 0.06) {
      dx *= 0.06 / dist;
      dy *= 0.06 / dist;
    }
    this.hue = (this.hue + dist * 0.6) % 1;
    const [r, g, b] = hsvToRgb(this.hue, 0.85, 1);
    this.solver.splatVelocity(x, y, dx * SPLAT_FORCE, dy * SPLAT_FORCE);
    this.solver.splatDye(x, y, r * 0.22, g * 0.22, b * 0.22, DYE_RADIUS);
  };
  private onPointerUp = () => {
    this.pointerDown = false;
  };

  constructor(private host: GameHost) {}

  start(): void {
    const solver = new FluidSolver(this.host.canvas);
    if (!solver.ok) {
      const message = document.createElement('p');
      message.className = 'game-message';
      message.textContent = 'Sorry — this computer cannot run the fluid simulation.';
      this.host.overlay.appendChild(message);
      return;
    }
    this.solver = solver;
    this.buildToolbar();
    const canvas = this.host.canvas;
    canvas.addEventListener('contextmenu', this.onContextMenu);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    // An opening puff so the screen is alive before the first touch.
    for (let i = 0; i < 5; i++) {
      const [r, g, b] = hsvToRgb((this.hue + i * 0.13) % 1, 0.85, 1);
      const angle = (i / 5) * Math.PI * 2;
      this.solver.splatVelocity(0.5, 0.5, Math.cos(angle) * 250, Math.sin(angle) * 250, 0.006);
      this.solver.splatDye(0.5, 0.5, r * 0.25, g * 0.25, b * 0.25, 0.006);
    }
  }

  frame(dt: number): void {
    const solver = this.solver;
    if (!solver) return;
    this.time += dt;

    solver.wind = this.windOn ? WIND_SPEED : 0;
    if (this.windOn) this.injectStreaks(dt);
    solver.step(dt);
    solver.render();

    // One-time quality reduction if this machine can't hold ~50 fps.
    this.frameEma = 0.95 * this.frameEma + 0.05 * dt * 1000;
    if (++this.warmup > 120 && !this.downgraded && this.frameEma > 24) {
      this.downgraded = true;
      solver.reduceQuality();
    }
  }

  destroy(): void {
    const canvas = this.host.canvas;
    canvas.removeEventListener('contextmenu', this.onContextMenu);
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.solver?.destroy();
    this.solver = null;
  }

  /** Colored ribbons entering with the wind, so the flow field is visible. */
  private injectStreaks(dt: number): void {
    for (let i = 0; i < STREAK_COUNT; i++) {
      const y = 0.12 + (0.76 * i) / (STREAK_COUNT - 1);
      const [r, g, b] = hsvToRgb((i / STREAK_COUNT + this.time * 0.02) % 1, 0.7, 1);
      const gain = 4 * dt;
      this.solver!.splatDye(0.01, y, r * gain, g * gain, b * gain, 0.0004);
    }
  }

  private toggleObstacle(x: number, y: number): void {
    const aspect = this.host.canvas.clientWidth / Math.max(1, this.host.canvas.clientHeight);
    const hit = this.obstacles.findIndex(
      (o) => Math.hypot((x - o.x) * aspect, y - o.y) < o.r,
    );
    if (hit >= 0) {
      this.obstacles.splice(hit, 1);
    } else {
      if (this.obstacles.length >= MAX_PLACED_OBSTACLES) this.obstacles.shift();
      this.obstacles.push({ x, y, r: OBSTACLE_RADIUS });
    }
    this.solver!.setObstacles(this.obstacles);
  }

  private toUv(e: PointerEvent): { x: number; y: number } {
    const rect = this.host.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: 1 - (e.clientY - rect.top) / rect.height,
    };
  }

  private buildToolbar(): void {
    const toolbar = document.createElement('div');
    toolbar.className = 'game-toolbar';

    const add = (emoji: string, label: string, onClick: () => void): HTMLButtonElement => {
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
      toolbar.appendChild(button);
      return button;
    };

    this.buttons.stir = add('🌀', 'Stir', () => this.setMode('stir'));
    this.buttons.blocks = add('🪨', 'Blocks', () => this.setMode('blocks'));
    this.buttons.wind = add('🌬️', 'Wind', () => {
      this.windOn = !this.windOn;
      this.buttons.wind!.classList.toggle('active', this.windOn);
    });
    add('🧹', 'Clear', () => {
      this.obstacles = [];
      this.solver!.setObstacles(this.obstacles);
      this.solver!.reset();
    });

    this.setMode('stir');
    this.host.overlay.appendChild(toolbar);
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    this.buttons.stir?.classList.toggle('active', mode === 'stir');
    this.buttons.blocks?.classList.toggle('active', mode === 'blocks');
  }
}

export const windfarm: ArcadeGame = {
  id: 'windfarm',
  title: 'Swirl Lab',
  scienceLine:
    'This smoke follows the Navier–Stokes equations — the same ones we solve to design wind farms and forecast the weather.',
  tileEmoji: '🌀',
  create: (host) => new FluidInstance(host),
};
