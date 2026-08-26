// The fluid playground (Phase 1 toy mode) plus the wind-farm challenge
// (Phase 2 game mode) on top of the same solver.
import type { ArcadeGame, GameHost, GameInstance } from '../../shell/types';
import { FluidSolver, type Obstacle } from './fluid';
import { Challenge, WakeDemo, type ChallengeNext } from './game';
import {
  delvePanel,
  delveToggle,
  type DelveHandle,
  type DelveToggleHandle,
} from '../../shell/delve';
import { windfarmDelve } from './delve';
import { randRange } from '../../lib/util';
import { pick, type Localized } from '../../lib/i18n';

const TEXT: Localized<{
  noWebgl: string;
  stir: string;
  blocks: string;
  wind: string;
  clear: string;
  windFarm: string;
  computer: string;
  stop: string;
  delveHeading: string;
}> = {
  en: {
    noWebgl: 'Sorry — this computer cannot run the fluid simulation.',
    stir: 'Stir',
    blocks: 'Blocks',
    wind: 'Wind',
    clear: 'Clear',
    windFarm: 'Wind farm',
    computer: 'Computer',
    stop: 'Stop',
    delveHeading: '🔬 The science of Swirl Lab',
  },
  nl: {
    noWebgl: 'Sorry — deze computer kan de vloeistofsimulatie niet draaien.',
    stir: 'Roeren',
    blocks: 'Blokken',
    wind: 'Wind',
    clear: 'Wissen',
    windFarm: 'Windmolenpark',
    computer: 'Computer',
    stop: 'Stop',
    delveHeading: '🔬 De wetenschap van het Wervel-lab',
  },
  no: {
    noWebgl: 'Beklager — denne datamaskinen kan ikke kjøre væskesimuleringen.',
    stir: 'Rør',
    blocks: 'Blokker',
    wind: 'Vind',
    clear: 'Tøm',
    windFarm: 'Vindpark',
    computer: 'Datamaskin',
    stop: 'Stopp',
    delveHeading: '🔬 Vitenskapen bak Virvellab',
  },
};

const SPLAT_FORCE = 6000; // uv-space pointer delta -> velocity (cells/sec)
const DYE_RADIUS = 0.0025;
const OBSTACLE_RADIUS = 0.07; // fraction of screen height
const MAX_PLACED_OBSTACLES = 12;
const WIND_SPEED = 60; // cells/sec; sim is 256 cells wide
const TOY_STREAKS = 6;
const CHALLENGE_STREAKS = 9;

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
  private challenge: Challenge | null = null;
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
  private toyBar!: HTMLElement;
  private challengeBar!: HTMLElement;
  private delve: DelveHandle | null = null;
  private toggle: DelveToggleHandle | null = null;
  private wakeDemo: WakeDemo | null = null;

  private onContextMenu = (e: Event) => e.preventDefault();
  private onPointerDown = (e: PointerEvent) => {
    const { x, y } = this.toUv(e);
    if (this.challenge) {
      this.challenge.onPointerDown(x, y);
      return;
    }
    if (e.button === 2 || this.mode === 'blocks') {
      this.toggleObstacle(x, y);
      return;
    }
    this.pointerDown = true;
    this.last = { x, y };
  };
  private onPointerMove = (e: PointerEvent) => {
    if (!this.pointerDown || !this.solver || this.challenge) return;
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
      message.textContent = pick(TEXT).noWebgl;
      this.host.overlay.appendChild(message);
      return;
    }
    this.solver = solver;
    this.buildToolbar();
    this.toggle = delveToggle(() => (this.delve ? this.closeDelve() : this.openDelve()));
    this.host.overlay.appendChild(this.toggle.element);
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

    solver.wind = this.windOn || this.challenge ? WIND_SPEED : 0;
    const steps = this.challenge?.fastForward && !this.downgraded ? 2 : 1;
    for (let i = 0; i < steps; i++) {
      this.time += dt;
      if (solver.wind > 0) {
        this.injectStreaks(dt, this.challenge ? CHALLENGE_STREAKS : TOY_STREAKS);
      }
      solver.step(dt);
      this.challenge?.tick(dt);
      this.wakeDemo?.tick(dt);
    }
    // Wake view (wind-speed coloring) whenever turbines are on screen.
    solver.render(this.challenge !== null || this.wakeDemo !== null);

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
    this.challenge?.destroy();
    this.challenge = null;
    this.delve?.dispose();
    this.delve = null;
    this.wakeDemo?.destroy();
    this.wakeDemo = null;
    this.solver?.destroy();
    this.solver = null;
  }

  // ---- delve layer ----

  private openDelve(): void {
    if (this.delve || !this.solver) return;
    // Something to look at while reading: the wind tunnel, live.
    this.setWind(true);
    this.delve = delvePanel({
      heading: pick(TEXT).delveHeading,
      chapters: windfarmDelve({ dropBlock: () => this.dropBlock() }),
      onChapter: (i) => this.setDelveChapter(i),
      onExit: () => this.closeDelve(),
    });
    this.host.overlay.appendChild(this.delve.element);
    this.toggle?.setOpen(true);
  }

  private closeDelve(): void {
    if (!this.delve) return;
    this.delve.dispose();
    this.delve = null;
    this.wakeDemo?.destroy();
    this.wakeDemo = null;
    this.toggle?.setOpen(false);
  }

  /** The "wakes are money" chapter runs a live two-turbine wake demo. */
  private setDelveChapter(chapter: number): void {
    if (chapter === 3 && !this.wakeDemo && this.solver) {
      // Wind-farm view: clear the toy's blocks so only turbine wakes show.
      this.obstacles = [];
      this.solver.setObstacles([]);
      this.setWind(true);
      this.wakeDemo = new WakeDemo(this.host, this.solver);
    } else if (chapter !== 3 && this.wakeDemo) {
      this.wakeDemo.destroy();
      this.wakeDemo = null;
    }
  }

  /** Chapter-3 lab: an obstacle mid-stream, so a vortex street forms live. */
  private dropBlock(): void {
    this.setWind(true);
    if (this.obstacles.length >= MAX_PLACED_OBSTACLES) this.obstacles.shift();
    this.obstacles.push({ x: 0.62, y: randRange(0.3, 0.7), r: OBSTACLE_RADIUS });
    this.solver?.setObstacles(this.obstacles);
  }

  // ---- challenge mode ----

  private startChallenge(computer: boolean): void {
    if (!this.solver) return;
    this.closeDelve();
    this.challenge?.destroy();
    // A fair, clean start: no leftover obstacles, dye, or momentum.
    this.obstacles = [];
    this.solver.setObstacles([]);
    this.solver.reset();
    this.pointerDown = false;
    this.challenge = new Challenge(this.host, this.solver, computer, (next) =>
      this.endChallenge(next),
    );
    this.setChallengeUi(true);
  }

  private endChallenge(next: ChallengeNext): void {
    this.challenge?.destroy();
    this.challenge = null;
    this.setChallengeUi(false);
    if (next === 'human') this.startChallenge(false);
    else if (next === 'cpu') this.startChallenge(true);
  }

  private setChallengeUi(on: boolean): void {
    this.toyBar.classList.toggle('hidden', on);
    this.challengeBar.classList.toggle('hidden', !on);
    // No science detours in the middle of a timed round.
    this.toggle?.element.classList.toggle('hidden', on);
  }

  private setWind(on: boolean): void {
    this.windOn = on;
    this.buttons.wind?.classList.toggle('active', on);
  }

  // ---- toy mode ----

  /** Colored ribbons entering with the wind, so the flow field is visible. */
  private injectStreaks(dt: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const y = 0.12 + (0.76 * i) / (count - 1);
      const [r, g, b] = hsvToRgb((i / count + this.time * 0.02) % 1, 0.7, 1);
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
    const add = (
      toolbar: HTMLElement,
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
      toolbar.appendChild(button);
      return button;
    };

    const T = pick(TEXT);

    this.toyBar = document.createElement('div');
    this.toyBar.className = 'game-toolbar';
    this.buttons.stir = add(this.toyBar, '🌀', T.stir, () => this.setMode('stir'));
    this.buttons.blocks = add(this.toyBar, '🪨', T.blocks, () => this.setMode('blocks'));
    this.buttons.wind = add(this.toyBar, '🌬️', T.wind, () => this.setWind(!this.windOn));
    add(this.toyBar, '🧹', T.clear, () => {
      this.obstacles = [];
      this.solver!.setObstacles(this.obstacles);
      this.solver!.reset();
    });
    add(this.toyBar, '⚡', T.windFarm, () => this.startChallenge(false));
    add(this.toyBar, '🤖', T.computer, () => this.startChallenge(true));

    this.challengeBar = document.createElement('div');
    this.challengeBar.className = 'game-toolbar hidden';
    add(this.challengeBar, '⏹', T.stop, () => this.challenge?.abort());

    this.setMode('stir');
    this.host.overlay.append(this.toyBar, this.challengeBar);
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    this.buttons.stir?.classList.toggle('active', mode === 'stir');
    this.buttons.blocks?.classList.toggle('active', mode === 'blocks');
  }
}

export const windfarm: ArcadeGame = {
  id: 'windfarm',
  title: { en: 'Swirl Lab', nl: 'Wervel-lab', no: 'Virvellab' },
  scienceLine: {
    en: 'Real fluid dynamics: turbine wakes steal wind and cost wind farms real money — simulating flows like this is our group’s daily work.',
    nl: 'Echte stromingsleer: het zog van windturbines steelt wind en kost windmolenparken echt geld — het simuleren van zulke stromingen is het dagelijkse werk van onze groep.',
    no: 'Ekte strømningsmekanikk: kjølvannet fra turbiner stjeler vind og koster vindparker ekte penger — å simulere slike strømninger er gruppas daglige arbeid.',
  },
  tileEmoji: '🌀',
  create: (host) => new FluidInstance(host),
};
