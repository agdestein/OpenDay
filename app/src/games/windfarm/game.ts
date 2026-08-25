// Phase 2: the wind-farm challenge, layered on the Phase 1 fluid toy.
// Place turbines in the wind, harvest energy for 60 seconds; wakes starve
// turbines downstream. A greedy "computer's turn" mode probes the live flow
// field and places its own farm for comparison.
import type { GameHost } from '../../shell/types';
import { scoreFlow, type ScoreFlowHandle } from '../../shell/scoreflow';
import { clamp, randRange } from '../../lib/util';
import type { FluidSolver } from './fluid';

export const TURBINE_BUDGET = 8;
export const ROUND_SECONDS = 60;
/** Rotor radius as a fraction of the screen height (drag disk and sprite). */
const TURBINE_R = 0.045;
/** Free-stream wind, must match WIND_SPEED in index.ts (grid cells/sec). */
const FREE_WIND = 60;
/** kW per turbine in undisturbed wind; power scales with (speed/FREE_WIND)^3. */
const P_MAX = 100;
/** Sample the incoming wind this far upstream of the rotor (uv units). */
const PROBE_UPSTREAM = 0.03;
/** Sim-seconds between GPU wind-speed readbacks. */
const SAMPLE_INTERVAL = 0.05;
const MARGIN = { x0: 0.05, x1: 0.9, y0: 0.08, y1: 0.92 };
const MIN_SPACING = TURBINE_R * 2.1;
const CPU_PLACE_INTERVAL = 1.5;

/** What the player chose on the results panel. */
export type ChallengeNext = 'human' | 'cpu' | 'toy';

interface Turbine {
  x: number;
  y: number;
  el: HTMLElement;
  rotor: SVGGElement;
  label: HTMLElement;
  angle: number;
  /** Local wind speed at the rotor's inflow, cells/sec (last sample). */
  speed: number;
  /** Current power in kW (last sample). */
  power: number;
  shedIn: number;
  shedSign: number;
}

const TURBINE_SVG = `
<svg viewBox="-50 -50 100 100">
  <circle class="turbine-ring" r="47"/>
  <g class="turbine-rotor">
    <path class="turbine-blade" d="M0 0 C 7 -14, 5 -34, 0 -45 C -5 -34, -7 -14, 0 0 Z"/>
    <path class="turbine-blade" d="M0 0 C 7 -14, 5 -34, 0 -45 C -5 -34, -7 -14, 0 0 Z" transform="rotate(120)"/>
    <path class="turbine-blade" d="M0 0 C 7 -14, 5 -34, 0 -45 C -5 -34, -7 -14, 0 0 Z" transform="rotate(240)"/>
    <circle class="turbine-hub" r="6"/>
  </g>
</svg>`;

export class Challenge {
  private turbines: Turbine[] = [];
  private timeLeft = ROUND_SECONDS;
  private energy = 0; // kJ (kW * s)
  private over = false;
  private left = false;
  private sinceSample = SAMPLE_INTERVAL;
  private cpuNextPlace = 0.5;
  private layer: HTMLElement;
  private hudTime!: HTMLElement;
  private hudEnergy!: HTMLElement;
  private hudLeft!: HTMLElement;
  private flow: ScoreFlowHandle | null = null;

  constructor(
    private host: GameHost,
    private solver: FluidSolver,
    readonly computer: boolean,
    private onDone: (next: ChallengeNext) => void,
  ) {
    this.layer = document.createElement('div');
    this.layer.className = 'challenge-layer';

    const hud = document.createElement('div');
    hud.className = 'challenge-hud';
    this.hudTime = document.createElement('span');
    this.hudTime.className = 'hud-time';
    this.hudEnergy = document.createElement('span');
    this.hudLeft = document.createElement('span');
    hud.append(this.hudTime, this.hudEnergy, this.hudLeft);

    const hint = document.createElement('p');
    hint.className = 'challenge-hint';
    hint.textContent = computer
      ? '🤖 The computer is placing turbines — watch it dodge the orange wakes…'
      : 'Click to place turbines — orange wakes steal wind from turbines behind! Click one to take it back.';

    const legend = document.createElement('div');
    legend.className = 'wake-legend';
    legend.innerHTML =
      '<span class="wake-swatch wake-swatch-full"></span> full wind' +
      '<span class="wake-swatch wake-swatch-wake"></span> wake (slow)';

    this.layer.append(hud, hint, legend);
    host.overlay.appendChild(this.layer);
    this.updateHud(0);
  }

  /** Computer rounds run the sim at 2x so the queue at the stand keeps moving. */
  get fastForward(): boolean {
    return this.computer && !this.over;
  }

  /** Player clicked the canvas at uv (x, y): place a turbine, or remove one. */
  onPointerDown(x: number, y: number): void {
    if (this.over || this.computer) return;
    const hit = this.turbines.findIndex((t) => this.distance(x, y, t.x, t.y) < TURBINE_R);
    if (hit >= 0) {
      this.turbines[hit].el.remove();
      this.turbines.splice(hit, 1);
      this.syncSolver();
      return;
    }
    this.place(x, y);
  }

  /** Called once per sim substep, right after solver.step(dt). */
  tick(dt: number): void {
    if (!this.over) {
      this.sinceSample += dt;
      if (this.sinceSample >= SAMPLE_INTERVAL && this.turbines.length > 0) {
        this.sinceSample = 0;
        this.samplePowers();
      }
      let total = 0;
      for (const t of this.turbines) total += t.power;
      this.energy += total * dt;
      this.timeLeft -= dt;
      this.shedTurbulence(dt);
      if (this.computer) this.cpuTick(dt);
      this.updateHud(total);
      if (this.timeLeft <= 0) this.finish();
    }
    for (const t of this.turbines) {
      t.angle = (t.angle + t.speed * 6 * dt) % 360;
      t.rotor.setAttribute('transform', `rotate(${t.angle})`);
    }
  }

  /** Leave without a score (the Stop button). */
  abort(): void {
    if (!this.left) {
      this.left = true;
      this.onDone('toy');
    }
  }

  destroy(): void {
    this.flow?.dispose();
    this.flow = null;
    this.layer.remove();
    this.turbines = [];
    this.solver.setTurbines([]);
  }

  // ---- internals ----

  private aspect(): number {
    return this.host.canvas.clientWidth / Math.max(1, this.host.canvas.clientHeight);
  }

  /** Distance in screen-height units, so radii mean the same in x and y. */
  private distance(x0: number, y0: number, x1: number, y1: number): number {
    return Math.hypot((x0 - x1) * this.aspect(), y0 - y1);
  }

  private place(x: number, y: number): boolean {
    if (this.turbines.length >= TURBINE_BUDGET) return false;
    x = clamp(x, MARGIN.x0, MARGIN.x1);
    y = clamp(y, MARGIN.y0, MARGIN.y1);
    if (this.turbines.some((t) => this.distance(x, y, t.x, t.y) < MIN_SPACING)) return false;

    const el = document.createElement('div');
    el.className = 'turbine';
    el.style.left = `${x * 100}%`;
    el.style.top = `${(1 - y) * 100}%`;
    el.innerHTML = TURBINE_SVG;
    const label = document.createElement('div');
    label.className = 'turbine-power';
    label.textContent = '0 kW';
    el.appendChild(label);
    this.layer.appendChild(el);

    this.turbines.push({
      x,
      y,
      el,
      rotor: el.querySelector('.turbine-rotor')!,
      label,
      angle: Math.random() * 360,
      speed: 0,
      power: 0,
      shedIn: randRange(0.05, 0.15),
      shedSign: Math.random() < 0.5 ? 1 : -1,
    });
    this.syncSolver();
    this.updateHud(0);
    return true;
  }

  private syncSolver(): void {
    this.solver.setTurbines(this.turbines.map((t) => ({ x: t.x, y: t.y, r: TURBINE_R })));
  }

  private samplePowers(): void {
    const v = this.solver.sampleVelocities(
      this.turbines.map((t) => ({ x: Math.max(0.005, t.x - PROBE_UPSTREAM), y: t.y })),
    );
    this.turbines.forEach((t, i) => {
      t.speed = Math.hypot(v[i * 2], v[i * 2 + 1]);
      const frac = clamp(t.speed / FREE_WIND, 0, 1.1);
      t.power = P_MAX * frac * frac * frac;
      t.label.textContent = `${Math.round(t.power)} kW`;
      t.el.style.opacity = String(0.4 + 0.6 * clamp(t.power / P_MAX, 0, 1));
    });
  }

  /** Small alternating cross-wind puffs just downstream: wakes meander. */
  private shedTurbulence(dt: number): void {
    for (const t of this.turbines) {
      t.shedIn -= dt;
      if (t.shedIn > 0) continue;
      t.shedIn = randRange(0.09, 0.16);
      t.shedSign *= -1;
      if (t.speed < 8) continue;
      this.solver.splatVelocity(
        t.x + 0.02,
        t.y + (Math.random() - 0.5) * TURBINE_R,
        0,
        t.shedSign * t.speed * 0.4,
        0.0008,
      );
    }
  }

  private cpuTick(dt: number): void {
    if (this.turbines.length >= TURBINE_BUDGET) return;
    this.cpuNextPlace -= dt;
    if (this.cpuNextPlace > 0) return;
    this.cpuNextPlace = CPU_PLACE_INTERVAL;
    this.placeBest();
  }

  /**
   * Greedy optimizer: probe the live wind field on a coarse grid of legal
   * spots and take the fastest one. Later placements automatically avoid the
   * wakes of earlier ones, because the probes read the simulated flow.
   */
  private placeBest(): void {
    const candidates: { x: number; y: number }[] = [];
    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 8; j++) {
        const x = MARGIN.x0 + 0.02 + (0.8 * i) / 11;
        const y = MARGIN.y0 + 0.02 + ((MARGIN.y1 - MARGIN.y0 - 0.04) * j) / 7;
        if (!this.turbines.some((t) => this.distance(x, y, t.x, t.y) < MIN_SPACING)) {
          candidates.push({ x, y });
        }
      }
    }
    let best: { x: number; y: number } | null = null;
    let bestSpeed = -1;
    for (let i = 0; i < candidates.length; i += 16) {
      const chunk = candidates.slice(i, i + 16);
      const v = this.solver.sampleVelocities(
        chunk.map((c) => ({ x: Math.max(0.005, c.x - PROBE_UPSTREAM), y: c.y })),
      );
      for (let k = 0; k < chunk.length; k++) {
        // Tiny jitter so ties (uniform free stream) don't always pick the same corner.
        const speed = Math.hypot(v[k * 2], v[k * 2 + 1]) + Math.random() * 1.5;
        if (speed > bestSpeed) {
          bestSpeed = speed;
          best = chunk[k];
        }
      }
    }
    if (best) this.place(best.x, best.y);
  }

  private updateHud(totalPower: number): void {
    this.hudTime.textContent = `⏱ ${Math.max(0, Math.ceil(this.timeLeft))}`;
    this.hudTime.classList.toggle('urgent', this.timeLeft <= 10 && !this.over);
    this.hudEnergy.textContent = `⚡ ${Math.round(this.energy).toLocaleString()} kJ (${Math.round(totalPower)} kW)`;
    this.hudLeft.textContent = `🌀 ×${TURBINE_BUDGET - this.turbines.length}`;
  }

  private finish(): void {
    this.over = true;
    this.timeLeft = 0;
    const score = Math.round(this.energy);
    const next = (choice: ChallengeNext) => () => {
      if (!this.left) {
        this.left = true;
        this.onDone(choice);
      }
    };
    this.flow = scoreFlow({
      gameId: 'windfarm',
      heading: this.computer ? '🤖 The computer is done!' : "⏱ Time's up!",
      score,
      scoreLabel: `⚡ ${score.toLocaleString()} kJ`,
      presetInitials: this.computer ? 'CPU' : undefined,
      actions: this.computer
        ? [
            { label: '🙋 Your turn', onClick: next('human') },
            { label: '🤖 Again', onClick: next('cpu') },
            { label: '🌀 Free play', onClick: next('toy') },
          ]
        : [
            { label: '🔁 Play again', onClick: next('human') },
            { label: '🤖 Computer’s turn', onClick: next('cpu') },
            { label: '🌀 Free play', onClick: next('toy') },
          ],
    });
    this.layer.appendChild(this.flow.element);
  }
}
