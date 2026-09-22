// Phase 2: the wind-farm challenge, layered on the Phase 1 fluid toy.
// Place turbines in the wind, harvest energy for 60 seconds; wakes starve
// turbines downstream. A greedy "computer's turn" mode probes the live flow
// field and places its own farm for comparison.
import type { GameHost } from '../../shell/types';
import { scoreFlow, type ScoreFlowHandle } from '../../shell/scoreflow';
import { clamp, randRange } from '../../lib/util';
import { fmtNumber, pick, type Localized } from '../../lib/i18n';
import type { FluidSolver } from './fluid';

const TEXT: Localized<{
  hintComputer: string;
  hintHuman: string;
  windTurning: (seconds: number) => string;
  windTurned: string;
  legendFull: string;
  legendWake: string;
  headingComputerDone: string;
  headingTimeUp: string;
  yourTurn: string;
  cpuAgain: string;
  freePlay: string;
  playAgain: string;
  computersTurn: string;
}> = {
  en: {
    hintComputer:
      '🤖 The computer is planning its farm for all three wind directions at once — watch where the wakes go when the wind turns…',
    hintHuman:
      'Click to place turbines — orange wakes steal wind from turbines behind! The wind will turn twice, so plan ahead. Click a turbine to take it back.',
    windTurning: (n) => `🌬️ The wind turns in ${n}…`,
    windTurned: '🌬️ The wind has turned! Are your turbines in each other’s wakes now?',
    legendFull: 'full wind',
    legendWake: 'wake (slow)',
    headingComputerDone: '🤖 The computer is done!',
    headingTimeUp: "⏱ Time's up!",
    yourTurn: '🙋 Your turn',
    cpuAgain: '🤖 Again',
    freePlay: '🌀 Free play',
    playAgain: '🔁 Play again',
    computersTurn: '🤖 Computer’s turn',
  },
  nl: {
    hintComputer:
      '🤖 De computer plant zijn park voor alle drie de windrichtingen tegelijk — kijk waar het zog heen gaat als de wind draait…',
    hintHuman:
      'Klik om turbines te plaatsen — oranje zog steelt wind van turbines erachter! De wind draait twee keer, dus denk vooruit. Klik op een turbine om hem terug te pakken.',
    windTurning: (n) => `🌬️ De wind draait over ${n}…`,
    windTurned: '🌬️ De wind is gedraaid! Staan je turbines nu in elkaars zog?',
    legendFull: 'volle wind',
    legendWake: 'zog (langzaam)',
    headingComputerDone: '🤖 De computer is klaar!',
    headingTimeUp: '⏱ Tijd is om!',
    yourTurn: '🙋 Jouw beurt',
    cpuAgain: '🤖 Nog een keer',
    freePlay: '🌀 Vrij spelen',
    playAgain: '🔁 Opnieuw spelen',
    computersTurn: '🤖 Beurt van de computer',
  },
  no: {
    hintComputer:
      '🤖 Datamaskinen planlegger vindparken for alle tre vindretningene samtidig — se hvor kjølvannet går når vinden snur…',
    hintHuman:
      'Klikk for å plassere turbiner — oransje kjølvann stjeler vind fra turbinene bak! Vinden snur to ganger, så tenk fremover. Klikk på en turbin for å ta den tilbake.',
    windTurning: (n) => `🌬️ Vinden snur om ${n}…`,
    windTurned: '🌬️ Vinden har snudd! Står turbinene dine i kjølvannet til hverandre nå?',
    legendFull: 'full vind',
    legendWake: 'kjølvann (sakte)',
    headingComputerDone: '🤖 Datamaskinen er ferdig!',
    headingTimeUp: '⏱ Tiden er ute!',
    yourTurn: '🙋 Din tur',
    cpuAgain: '🤖 En gang til',
    freePlay: '🌀 Fri lek',
    playAgain: '🔁 Spill igjen',
    computersTurn: '🤖 Datamaskinens tur',
  },
};

export const TURBINE_BUDGET = 8;
export const ROUND_SECONDS = 60;
/** Rotor radius as a fraction of the screen height (drag disk and sprite). */
const TURBINE_R = 0.045;
/** Free-stream wind, must match WIND_SPEED in index.ts (reference cells/sec). */
const FREE_WIND = 60;
/**
 * Inflow speed a lone turbine measures in undisturbed wind, as a fraction of
 * FREE_WIND: the probe sits in the rotor's own slow-down zone just upstream.
 * Calibrated so a turbine in clean wind reads P_MAX.
 */
const LONE_INFLOW = 0.845;
/** kW per turbine in undisturbed wind; power scales with (speed / inflow)^3. */
const P_MAX = 100;
/** Sample the incoming wind this far upstream of the rotor (screen heights). */
const PROBE_UPSTREAM = 0.053;
/**
 * The wind turns twice per round: from each phase's start time (seconds into
 * the round) it swings to the phase's direction (degrees, 0 = blowing left to
 * right, positive = blowing upward) over TURN_SECONDS. A layout that only
 * dodges the first wind's wakes gets caught by the others — the real reason
 * wind-farm layout is hard.
 */
export const WIND_PHASES = [
  { at: 0, deg: 0 },
  { at: 20, deg: 40 },
  { at: 40, deg: -40 },
];
const TURN_SECONDS = 3;
/** Warn this many seconds before the wind turns. */
const TURN_WARNING = 5;
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

// ---- turbine machinery shared by the challenge and the delve wake demo ----

/** Build a turbine sprite in the layer and return its live struct. */
function createTurbine(layer: HTMLElement, x: number, y: number): Turbine {
  const el = document.createElement('div');
  el.className = 'turbine';
  el.style.left = `${x * 100}%`;
  el.style.top = `${(1 - y) * 100}%`;
  el.innerHTML = TURBINE_SVG;
  const label = document.createElement('div');
  label.className = 'turbine-power';
  label.textContent = '0 kW';
  el.appendChild(label);
  layer.appendChild(el);
  return {
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
  };
}

function canvasAspect(host: GameHost): number {
  return host.canvas.clientWidth / Math.max(1, host.canvas.clientHeight);
}

/** Wind direction (radians) at time `elapsed` seconds into a round. */
export function windAngleAt(elapsed: number): number {
  let angle = 0;
  let prev = 0;
  for (const phase of WIND_PHASES) {
    if (elapsed < phase.at) break;
    const k = clamp((elapsed - phase.at) / TURN_SECONDS, 0, 1);
    const eased = k * k * (3 - 2 * k);
    angle = prev + (phase.deg - prev) * eased;
    prev = phase.deg;
  }
  return (angle * Math.PI) / 180;
}

/** Probe each turbine's inflow and update its speed, power, and kW label. */
function sampleTurbinePowers(solver: FluidSolver, turbines: Turbine[], aspect: number): void {
  // Probe upstream along the current wind direction.
  const ux = (Math.cos(solver.windAngle) * PROBE_UPSTREAM) / aspect;
  const uy = Math.sin(solver.windAngle) * PROBE_UPSTREAM;
  const v = solver.sampleVelocities(
    turbines.map((t) => ({ x: clamp(t.x - ux, 0.005, 0.995), y: clamp(t.y - uy, 0.005, 0.995) })),
  );
  turbines.forEach((t, i) => {
    t.speed = Math.hypot(v[i * 2], v[i * 2 + 1]);
    const frac = clamp(t.speed / (LONE_INFLOW * FREE_WIND), 0, 1);
    t.power = P_MAX * frac * frac * frac;
    t.label.textContent = `${Math.round(t.power)} kW`;
    t.el.style.opacity = String(0.4 + 0.6 * clamp(t.power / P_MAX, 0, 1));
  });
}

/** Small alternating cross-wind puffs just downstream: wakes meander. */
function shedTurbulence(solver: FluidSolver, turbines: Turbine[], dt: number, aspect: number): void {
  const cos = Math.cos(solver.windAngle);
  const sin = Math.sin(solver.windAngle);
  for (const t of turbines) {
    t.shedIn -= dt;
    if (t.shedIn > 0) continue;
    t.shedIn = randRange(0.09, 0.16);
    t.shedSign *= -1;
    if (t.speed < 8) continue;
    // 0.035 screen heights downstream, jittered across the rotor.
    const across = (Math.random() - 0.5) * TURBINE_R;
    const dx = 0.035 * cos - across * sin;
    const dy = 0.035 * sin + across * cos;
    const push = t.shedSign * t.speed * 0.4;
    solver.splatVelocity(t.x + dx / aspect, t.y + dy, -sin * push, cos * push, 0.0008);
  }
}

/** Spin each rotor at its local wind speed. */
function spinRotors(turbines: Turbine[], dt: number): void {
  for (const t of turbines) {
    t.angle = (t.angle + t.speed * 6 * dt) % 360;
    t.rotor.setAttribute('transform', `rotate(${t.angle})`);
  }
}

/**
 * Engineering wake model for the computer player: every turbine leaves a
 * Gaussian-shaped wind deficit that widens and fades downstream (a smooth
 * cousin of the classic Jensen/Park model), overlapping wakes add up in
 * squares, and power goes with the cube of the remaining wind. Returns the
 * total power of the layout, in units of lone turbines, summed over the
 * round's wind directions. Tuned by eye to match the simulated wakes.
 */
const WAKE = { depth: 0.45, length: 1.2, sigma0: 0.8 * TURBINE_R, spread: 0.05 };

function modelFarmPower(spots: { x: number; y: number }[], aspect: number): number {
  let total = 0;
  for (const phase of WIND_PHASES) {
    const c = Math.cos((phase.deg * Math.PI) / 180);
    const s = Math.sin((phase.deg * Math.PI) / 180);
    for (const target of spots) {
      let deficit2 = 0;
      for (const source of spots) {
        if (source === target) continue;
        // Offset in screen-height units, split along / across the wind.
        const dx = (target.x - source.x) * aspect;
        const dy = target.y - source.y;
        const along = dx * c + dy * s;
        if (along <= 0) continue;
        const across = -dx * s + dy * c;
        const sigma = WAKE.sigma0 + WAKE.spread * along;
        const deficit =
          WAKE.depth * Math.exp(-along / WAKE.length) * Math.exp(-(across * across) / (2 * sigma * sigma));
        deficit2 += deficit * deficit;
      }
      const wind = 1 - Math.min(0.9, Math.sqrt(deficit2));
      total += wind * wind * wind;
    }
  }
  return total;
}

/**
 * Delve demo for the "wakes are money" chapter: two live turbines, the second
 * parked straight in the first one's wake, with the usual power labels — no
 * timer, no score, just the physics behind the ⚡ challenge.
 */
export class WakeDemo {
  private layer: HTMLElement;
  private turbines: Turbine[];
  private sinceSample = SAMPLE_INTERVAL;

  constructor(
    private host: GameHost,
    private solver: FluidSolver,
  ) {
    const T = pick(TEXT);
    this.layer = document.createElement('div');
    this.layer.className = 'challenge-layer';
    // To the right of the delve card; the wake blows rightward onto turbine 2.
    const spots = [
      { x: 0.52, y: 0.5, caption: T.legendFull, color: '#7dd3fc' },
      { x: 0.7, y: 0.5, caption: T.legendWake, color: '#fb923c' },
    ];
    this.turbines = spots.map((s) => {
      const t = createTurbine(this.layer, s.x, s.y);
      const caption = document.createElement('div');
      caption.className = 'turbine-caption';
      caption.textContent = s.caption;
      caption.style.color = s.color;
      t.el.appendChild(caption);
      return t;
    });
    host.overlay.appendChild(this.layer);
    solver.setTurbines(this.turbines.map((t) => ({ x: t.x, y: t.y, r: TURBINE_R })));
  }

  tick(dt: number): void {
    this.sinceSample += dt;
    if (this.sinceSample >= SAMPLE_INTERVAL) {
      this.sinceSample = 0;
      sampleTurbinePowers(this.solver, this.turbines, canvasAspect(this.host));
    }
    shedTurbulence(this.solver, this.turbines, dt, canvasAspect(this.host));
    spinRotors(this.turbines, dt);
  }

  destroy(): void {
    this.layer.remove();
    this.solver.setTurbines([]);
  }
}

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
  private hudArrow!: SVGElement;
  private hint!: HTMLElement;
  private baseHint: string;
  private flow: ScoreFlowHandle | null = null;

  constructor(
    private host: GameHost,
    private solver: FluidSolver,
    readonly computer: boolean,
    private onDone: (next: ChallengeNext) => void,
  ) {
    const T = pick(TEXT);

    this.layer = document.createElement('div');
    this.layer.className = 'challenge-layer';

    const hud = document.createElement('div');
    hud.className = 'challenge-hud';
    this.hudTime = document.createElement('span');
    this.hudTime.className = 'hud-time';
    this.hudEnergy = document.createElement('span');
    this.hudLeft = document.createElement('span');
    // Wind-direction arrow; rotates as the wind turns.
    const wind = document.createElement('span');
    wind.className = 'hud-wind';
    wind.innerHTML =
      '🌬️<svg viewBox="-12 -12 24 24"><path d="M-9 0H7M1-6l7 6-7 6"/></svg>';
    this.hudArrow = wind.querySelector('svg')!;
    hud.append(this.hudTime, wind, this.hudEnergy, this.hudLeft);

    this.baseHint = computer ? T.hintComputer : T.hintHuman;
    this.hint = document.createElement('p');
    this.hint.className = 'challenge-hint';
    this.hint.textContent = this.baseHint;

    const legend = document.createElement('div');
    legend.className = 'wake-legend';
    legend.innerHTML =
      `<span class="wake-swatch wake-swatch-full"></span> ${T.legendFull}` +
      `<span class="wake-swatch wake-swatch-wake"></span> ${T.legendWake}`;

    this.layer.append(hud, this.hint, legend);
    host.overlay.appendChild(this.layer);
    this.updateHud(0);
  }

  /** Current wind direction (radians) on the round's schedule. */
  get windAngle(): number {
    return windAngleAt(ROUND_SECONDS - this.timeLeft);
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
        sampleTurbinePowers(this.solver, this.turbines, this.aspect());
      }
      let total = 0;
      for (const t of this.turbines) total += t.power;
      this.energy += total * dt;
      this.timeLeft -= dt;
      shedTurbulence(this.solver, this.turbines, dt, this.aspect());
      if (this.computer) this.cpuTick(dt);
      this.updateHud(total);
      this.updateHint();
      if (this.timeLeft <= 0) this.finish();
    }
    spinRotors(this.turbines, dt);
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

    this.turbines.push(createTurbine(this.layer, x, y));
    this.syncSolver();
    this.updateHud(0);
    return true;
  }

  private syncSolver(): void {
    this.solver.setTurbines(this.turbines.map((t) => ({ x: t.x, y: t.y, r: TURBINE_R })));
  }

  private cpuTick(dt: number): void {
    if (this.turbines.length >= TURBINE_BUDGET) return;
    this.cpuNextPlace -= dt;
    if (this.cpuNextPlace > 0) return;
    this.cpuNextPlace = CPU_PLACE_INTERVAL;
    this.placeBest();
  }

  /**
   * Greedy optimizer: try every legal spot on a coarse grid and keep the one
   * that gives the most total farm power, averaged over all wind directions
   * of the round. The live simulation can only show today's wind, so the
   * computer plans with a quick engineering wake formula instead — the same
   * trick real wind-farm designers use for a first layout, before checking
   * it with big simulations. (Here the simulation does the checking: the
   * score comes from the simulated wind, not from the formula.)
   */
  private placeBest(): void {
    const aspect = this.aspect();
    const farm = this.turbines.map((t) => ({ x: t.x, y: t.y }));
    let best: { x: number; y: number } | null = null;
    let bestPower = -Infinity;
    for (let i = 0; i < 14; i++) {
      for (let j = 0; j < 9; j++) {
        const x = MARGIN.x0 + ((MARGIN.x1 - MARGIN.x0) * i) / 13;
        const y = MARGIN.y0 + ((MARGIN.y1 - MARGIN.y0) * j) / 8;
        if (this.turbines.some((t) => this.distance(x, y, t.x, t.y) < MIN_SPACING)) continue;
        // Tiny jitter so ties (e.g. the very first turbine) vary between rounds.
        const power = modelFarmPower([...farm, { x, y }], aspect) + Math.random() * 1e-3;
        if (power > bestPower) {
          bestPower = power;
          best = { x, y };
        }
      }
    }
    if (best) this.place(best.x, best.y);
  }

  /** Swap the hint for a countdown before each wind turn, and a note after. */
  private updateHint(): void {
    const T = pick(TEXT);
    const elapsed = ROUND_SECONDS - this.timeLeft;
    let text = this.baseHint;
    for (const phase of WIND_PHASES) {
      if (phase.at === 0) continue;
      const until = phase.at - elapsed;
      if (until > 0 && until <= TURN_WARNING) text = T.windTurning(Math.ceil(until));
      else if (until <= 0 && until > -TURN_SECONDS - 3) text = T.windTurned;
    }
    if (this.hint.textContent !== text) this.hint.textContent = text;
  }

  private updateHud(totalPower: number): void {
    this.hudTime.textContent = `⏱ ${Math.max(0, Math.ceil(this.timeLeft))}`;
    this.hudTime.classList.toggle('urgent', this.timeLeft <= 10 && !this.over);
    this.hudEnergy.textContent = `⚡ ${fmtNumber(Math.round(this.energy))} kJ (${fmtNumber(Math.round(totalPower))} kW)`;
    this.hudLeft.textContent = `🌀 ×${TURBINE_BUDGET - this.turbines.length}`;
    // Screen y points down, so an upward (positive) wind angle is a
    // counterclockwise, i.e. negative, CSS rotation.
    const deg = (-this.windAngle * 180) / Math.PI;
    this.hudArrow.style.transform = `rotate(${deg.toFixed(1)}deg)`;
  }

  private finish(): void {
    this.over = true;
    this.timeLeft = 0;
    const score = Math.round(this.energy);
    const T = pick(TEXT);
    const next = (choice: ChallengeNext) => () => {
      if (!this.left) {
        this.left = true;
        this.onDone(choice);
      }
    };
    this.flow = scoreFlow({
      gameId: 'windfarm',
      heading: this.computer ? T.headingComputerDone : T.headingTimeUp,
      score,
      scoreLabel: `⚡ ${fmtNumber(score)} kJ`,
      presetInitials: this.computer ? 'CPU' : undefined,
      actions: this.computer
        ? [
            { label: T.yourTurn, onClick: next('human') },
            { label: T.cpuAgain, onClick: next('cpu') },
            { label: T.freePlay, onClick: next('toy') },
          ]
        : [
            { label: T.playAgain, onClick: next('human') },
            { label: T.computersTurn, onClick: next('cpu') },
            { label: T.freePlay, onClick: next('toy') },
          ],
    });
    this.layer.appendChild(this.flow.element);
  }
}
