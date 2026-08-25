// Phase 3: Outbreak! — agent-based SIR epidemic in a mini-city (Canvas 2D).
// Toy mode: click to infect, watch it spread, curve draws itself.
// Game mode: action budget vs escalating diseases, score = people saved.
import type { ArcadeGame, GameHost, GameInstance } from '../../shell/types';
import { scoreFlow, type ScoreFlowHandle } from '../../shell/scoreflow';
import {
  AGENT_COUNT,
  CITY_H,
  CITY_W,
  COLOR,
  INFECTION_RADIUS,
  OutbreakSim,
} from './sim';
import { createDelve, type DelveHandle } from './delve';

interface Round {
  name: string;
  stars: string;
  rate: number;
  vaccines: number;
  soaps: number;
}

// Rates calibrated by headless sweeps (docs in the Phase 3 commit): with 2
// vaccines + soap + school closure, round 1 saves ~460/500 vs ~230 doing
// nothing; round 3 sweeps almost everyone without smart play.
const ROUNDS: Round[] = [
  { name: 'The Sniffles 🤧', stars: '★☆☆', rate: 0.2, vaccines: 2, soaps: 1 },
  { name: 'Flash Flu 🥵', stars: '★★☆', rate: 0.35, vaccines: 2, soaps: 1 },
  { name: 'Mega Measles 🔴', stars: '★★★', rate: 0.55, vaccines: 1, soaps: 1 },
];

/** Toy-mode contagiousness: showy for the 30-second crowd. */
const TOY_RATE = 0.3;
const PATIENT_ZERO_AT = 1.5;
const ROUND_TIME_CAP = 65;
const CURVE_SAMPLE_INTERVAL = 0.25;

type Tool = 'infect' | 'vaccine' | 'soap';
type GamePhase = 'intro' | 'running' | 'summary';

interface Ripple {
  x: number;
  y: number;
  t: number;
  color: string;
}

class OutbreakInstance implements GameInstance {
  private sim = new OutbreakSim();
  private ctx!: CanvasRenderingContext2D;
  private mode: 'toy' | 'game' = 'toy';
  private tool: Tool = 'infect';
  private time = 0;
  private history: { i: number; r: number }[] = [];
  private sinceSample = 0;
  private ripples: Ripple[] = [];

  private phase: GamePhase = 'intro';
  private round = 0;
  private roundTime = 0;
  private patientZeroDone = false;
  private totalSaved = 0;
  private vaccinesLeft = 0;
  private soapsLeft = 0;
  private schoolActionUsed = false;
  private summaryTimer = 0;

  private toyBar!: HTMLElement;
  private gameBar!: HTMLElement;
  private hud!: HTMLElement;
  private hudCounts!: HTMLElement;
  private hudGame!: HTMLElement;
  private hint!: HTMLElement;
  private card: HTMLElement | null = null;
  private flow: ScoreFlowHandle | null = null;
  private delve!: DelveHandle;
  private buttons: Record<string, HTMLButtonElement> = {};

  private onPointerDown = (e: PointerEvent) => {
    const { x, y } = this.toVirtual(e);
    if (this.mode === 'toy') this.toyClick(x, y);
    else if (this.phase === 'running') this.gameClick(x, y);
  };

  constructor(private host: GameHost) {}

  start(): void {
    this.ctx = this.host.canvas.getContext('2d')!;
    this.buildUi();
    this.host.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.setTool('infect');
    this.hint.textContent = 'Click anywhere to start an outbreak! 🦠';
  }

  frame(dt: number): void {
    this.time += dt;
    this.sim.step(dt);
    this.stepRipples(dt);
    if (this.mode === 'game') this.stepGame(dt);

    const tracking = this.mode === 'toy' || this.phase === 'running';
    if (tracking) {
      this.sinceSample += dt;
      if (this.sinceSample >= CURVE_SAMPLE_INTERVAL) {
        this.sinceSample = 0;
        this.history.push({ i: this.sim.counts.i, r: this.sim.counts.r });
        if (this.history.length > 600) this.history.shift();
      }
    }
    this.updateHud();
    this.delve.update();
    this.draw();
  }

  destroy(): void {
    this.host.canvas.removeEventListener('pointerdown', this.onPointerDown);
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
    this.toyBar.classList.add('hidden');
    this.gameBar.classList.remove('hidden');
    this.delve.setMode('game');
    this.showIntro();
  }

  private showIntro(): void {
    const config = ROUNDS[this.round];
    this.sim.reset();
    this.sim.infectionRate = config.rate;
    this.history = [];
    this.ripples = [];
    this.phase = 'intro';
    this.patientZeroDone = false;
    this.roundTime = 0;
    this.vaccinesLeft = config.vaccines;
    this.soapsLeft = config.soaps;
    this.schoolActionUsed = false;
    this.tool = 'vaccine';
    this.updateGameButtons();
    this.hint.textContent = '';

    this.showCard((card) => {
      const heading = document.createElement('h2');
      heading.textContent = `Round ${this.round + 1} of ${ROUNDS.length}`;
      const name = document.createElement('div');
      name.className = 'score-flow-score';
      name.textContent = config.name;
      const blurb = document.createElement('p');
      blurb.className = 'score-flow-prompt';
      blurb.textContent = `Contagiousness: ${config.stars}. Your tools: ${'💉'.repeat(config.vaccines)} vaccine${config.vaccines > 1 ? 's' : ''} for a neighborhood, ${'🧼'.repeat(config.soaps)} soap station, and you may close the school 🏫. Save as many people as you can!`;
      const actions = document.createElement('div');
      actions.className = 'score-flow-actions';
      const go = document.createElement('button');
      go.className = 'arcade-button';
      go.textContent = '▶ GO!';
      go.addEventListener('click', () => {
        this.card?.remove();
        this.card = null;
        this.phase = 'running';
        this.hint.textContent =
          'Someone is about to get sick — act fast! Click a neighborhood to vaccinate it.';
      });
      actions.appendChild(go);
      card.append(heading, name, blurb, actions);
    });
  }

  private stepGame(dt: number): void {
    if (this.phase === 'running') {
      this.roundTime += dt;
      if (!this.patientZeroDone && this.roundTime >= PATIENT_ZERO_AT) {
        this.patientZeroDone = true;
        const agent = this.sim.infectPatientZero();
        if (agent) this.ripples.push({ x: agent.x, y: agent.y, t: 0, color: COLOR.i });
      }
      const burntOut =
        this.patientZeroDone && this.sim.counts.i === 0 && this.roundTime > PATIENT_ZERO_AT + 3;
      if (burntOut || this.roundTime > ROUND_TIME_CAP) this.endRound();
    } else if (this.phase === 'summary' && this.card) {
      this.summaryTimer -= dt;
      if (this.summaryTimer <= 0) this.nextRound();
    }
  }

  private endRound(): void {
    const saved = this.sim.counts.s;
    this.totalSaved += saved;
    this.phase = 'summary';
    if (this.round >= ROUNDS.length - 1) {
      this.finishGame();
      return;
    }
    this.summaryTimer = 4.5;
    this.showCard((card) => {
      const heading = document.createElement('h2');
      heading.textContent = `${ROUNDS[this.round].name} is over!`;
      const score = document.createElement('div');
      score.className = 'score-flow-score';
      score.textContent = `You saved ${saved} of ${AGENT_COUNT}`;
      const note = document.createElement('p');
      note.className = 'score-flow-prompt';
      note.textContent =
        saved > AGENT_COUNT * 0.7
          ? 'Great containment! The next disease spreads faster…'
          : 'Ouch — the next one spreads faster. Vaccinate early!';
      const actions = document.createElement('div');
      actions.className = 'score-flow-actions';
      const next = document.createElement('button');
      next.className = 'arcade-button';
      next.textContent = '▶ Next round';
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
      gameId: 'outbreak',
      heading: '🏆 All rounds survived!',
      score: this.totalSaved,
      scoreLabel: `${this.totalSaved.toLocaleString()} people saved`,
      actions: [
        { label: '🔁 Play again', onClick: () => this.startGame() },
        { label: '🦠 Free play', onClick: () => this.exitToToy() },
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
    this.sim.reset();
    this.sim.infectionRate = TOY_RATE;
    this.history = [];
    this.ripples = [];
    this.gameBar.classList.add('hidden');
    this.toyBar.classList.remove('hidden');
    this.delve.setMode('toy');
    this.setTool('infect');
    this.syncToySchoolButton();
    this.hint.textContent = 'Click anywhere to start an outbreak! 🦠';
  }

  // ---- input ----

  private toyClick(x: number, y: number): void {
    if (this.tool === 'infect') {
      const agent = this.sim.infectNearest(x, y);
      if (agent) this.ripples.push({ x: agent.x, y: agent.y, t: 0, color: COLOR.i });
    } else if (this.tool === 'vaccine') {
      const hood = this.sim.districtAt(x, y);
      if (hood >= 0) {
        this.sim.vaccinateDistrict(hood);
        const d = this.sim.districts[hood];
        this.ripples.push({ x: d.x, y: d.y, t: 0, color: COLOR.v });
      }
    } else if (this.tool === 'soap') {
      const venue = this.sim.venueAt(x, y);
      if (venue >= 0) this.sim.venues[venue].soap = !this.sim.venues[venue].soap;
    }
  }

  private gameClick(x: number, y: number): void {
    if (this.tool === 'vaccine' && this.vaccinesLeft > 0) {
      const hood = this.sim.districtAt(x, y);
      if (hood >= 0) {
        this.vaccinesLeft--;
        this.sim.vaccinateDistrict(hood);
        const d = this.sim.districts[hood];
        this.ripples.push({ x: d.x, y: d.y, t: 0, color: COLOR.v });
        this.updateGameButtons();
      }
    } else if (this.tool === 'soap' && this.soapsLeft > 0) {
      const venue = this.sim.venueAt(x, y);
      if (venue >= 0 && !this.sim.venues[venue].soap) {
        this.soapsLeft--;
        this.sim.venues[venue].soap = true;
        this.updateGameButtons();
      }
    }
  }

  private toVirtual(e: PointerEvent): { x: number; y: number } {
    const rect = this.host.canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / CITY_W, rect.height / CITY_H);
    const ox = (rect.width - CITY_W * scale) / 2;
    const oy = (rect.height - CITY_H * scale) / 2;
    return {
      x: (e.clientX - rect.left - ox) / scale,
      y: (e.clientY - rect.top - oy) / scale,
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
    add(this.toyBar, 'infect', '🦠', 'Infect', () => this.setTool('infect'));
    add(this.toyBar, 'toyVaccine', '💉', 'Vaccinate', () => this.setTool('vaccine'));
    add(this.toyBar, 'toySoap', '🧼', 'Soap', () => this.setTool('soap'));
    add(this.toyBar, 'school', '🏫', 'Close school', () => {
      if (this.sim.schoolOpen) this.sim.closeSchool();
      else this.sim.schoolOpen = true;
      this.syncToySchoolButton();
    });
    add(this.toyBar, 'reset', '🧹', 'Reset', () => {
      this.sim.reset();
      this.sim.infectionRate = TOY_RATE;
      this.history = [];
      this.ripples = [];
      this.syncToySchoolButton();
    });
    add(this.toyBar, 'challenge', '😷', 'Challenge', () => this.startGame());

    this.gameBar = document.createElement('div');
    this.gameBar.className = 'game-toolbar hidden';
    add(this.gameBar, 'gameVaccine', '💉', 'Vaccinate', () => this.setTool('vaccine'));
    add(this.gameBar, 'gameSoap', '🧼', 'Soap', () => this.setTool('soap'));
    add(this.gameBar, 'gameSchool', '🏫', 'Close school', () => {
      if (!this.schoolActionUsed && this.phase === 'running') {
        this.schoolActionUsed = true;
        this.sim.closeSchool();
        this.updateGameButtons();
      }
    });
    add(this.gameBar, 'stop', '⏹', 'Stop', () => this.exitToToy());

    this.hud = document.createElement('div');
    this.hud.className = 'challenge-hud';
    this.hudCounts = document.createElement('span');
    this.hudGame = document.createElement('span');
    this.hud.append(this.hudCounts, this.hudGame);

    this.hint = document.createElement('p');
    this.hint.className = 'challenge-hint';

    this.delve = createDelve(this.sim);
    this.host.overlay.append(
      this.toyBar,
      this.gameBar,
      this.hud,
      this.hint,
      this.delve.toggle,
      this.delve.panel,
    );
  }

  private setTool(tool: Tool): void {
    this.tool = tool;
    this.buttons.infect?.classList.toggle('active', tool === 'infect');
    this.buttons.toyVaccine?.classList.toggle('active', tool === 'vaccine');
    this.buttons.toySoap?.classList.toggle('active', tool === 'soap');
    this.buttons.gameVaccine?.classList.toggle('active', tool === 'vaccine');
    this.buttons.gameSoap?.classList.toggle('active', tool === 'soap');
  }

  private syncToySchoolButton(): void {
    const label = this.buttons.school.querySelector('.tool-label')!;
    label.textContent = this.sim.schoolOpen ? 'Close school' : 'Open school';
    this.buttons.school.classList.toggle('active', !this.sim.schoolOpen);
  }

  private updateGameButtons(): void {
    const vaccine = this.buttons.gameVaccine;
    vaccine.querySelector('.tool-label')!.textContent = `Vaccinate ×${this.vaccinesLeft}`;
    vaccine.disabled = this.vaccinesLeft === 0;
    const soap = this.buttons.gameSoap;
    soap.querySelector('.tool-label')!.textContent = `Soap ×${this.soapsLeft}`;
    soap.disabled = this.soapsLeft === 0;
    const school = this.buttons.gameSchool;
    school.querySelector('.tool-label')!.textContent = this.schoolActionUsed
      ? 'School closed'
      : 'Close school';
    school.disabled = this.schoolActionUsed;
    this.setTool(this.tool === 'soap' && this.soapsLeft > 0 ? 'soap' : 'vaccine');
  }

  private showCard(build: (card: HTMLElement) => void): void {
    this.card?.remove();
    this.card = document.createElement('div');
    this.card.className = 'score-flow';
    build(this.card);
    this.host.overlay.appendChild(this.card);
  }

  private updateHud(): void {
    const c = this.sim.counts;
    this.hudCounts.textContent = `🙂 ${c.s}   🤒 ${c.i}   💪 ${c.r}${c.vaccinated ? `   💉 ${c.vaccinated}` : ''}`;
    this.hudGame.textContent =
      this.mode === 'game'
        ? `  |  Round ${this.round + 1}/${ROUNDS.length} · saved so far: ${this.totalSaved}`
        : '';
  }

  private stepRipples(dt: number): void {
    for (const r of this.ripples) r.t += dt;
    this.ripples = this.ripples.filter((r) => r.t < 1);
  }

  // ---- rendering ----

  private draw(): void {
    const ctx = this.ctx;
    const canvas = this.host.canvas;
    const dpr = this.host.dpr;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const scale = Math.min(w / CITY_W, h / CITY_H);
    const ox = (w - CITY_W * scale) / 2;
    const oy = (h - CITY_H * scale) / 2;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, w, h);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);

    this.drawCity(ctx);
    this.drawAgents(ctx);
    this.drawRipples(ctx);
    this.drawCurve(ctx);
  }

  private drawCity(ctx: CanvasRenderingContext2D): void {
    // Roads from each neighborhood to both venues.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const d of this.sim.districts) {
      for (const v of this.sim.venues) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(v.x, v.y);
      }
    }
    ctx.stroke();

    const highlightHoods = this.tool === 'vaccine' && this.canAct();
    for (const d of this.sim.districts) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.beginPath();
      ctx.roundRect(d.x - d.w / 2, d.y - d.h / 2, d.w, d.h, 26);
      ctx.fill();
      if (highlightHoods) {
        ctx.strokeStyle = 'rgba(87, 217, 138, 0.5)';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
      for (const house of d.houses) {
        ctx.beginPath();
        ctx.roundRect(house.x - 21, house.y - 16, 42, 32, 7);
        ctx.fill();
      }
    }

    const highlightVenues = this.tool === 'soap' && this.canAct();
    for (const v of this.sim.venues) {
      ctx.fillStyle =
        v.kind === 'school' ? 'rgba(125, 211, 252, 0.10)' : 'rgba(251, 191, 36, 0.09)';
      ctx.beginPath();
      ctx.arc(v.x, v.y, v.r, 0, Math.PI * 2);
      ctx.fill();
      if (highlightVenues && !v.soap) {
        ctx.strokeStyle = 'rgba(125, 211, 252, 0.55)';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '42px system-ui, sans-serif';
      ctx.globalAlpha = 0.9;
      ctx.fillText(v.kind === 'school' ? '🏫' : '🛒', v.x, v.y - v.r - 30);
      ctx.globalAlpha = 1;
      if (v.soap) {
        ctx.font = '34px system-ui, sans-serif';
        ctx.fillText('🧼', v.x + v.r - 6, v.y - v.r + 6);
      }
      if (v.kind === 'school' && !this.sim.schoolOpen) {
        ctx.fillStyle = 'rgba(11, 16, 32, 0.55)';
        ctx.beginPath();
        ctx.arc(v.x, v.y, v.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '44px system-ui, sans-serif';
        ctx.fillText('🚫', v.x, v.y);
      }
    }
  }

  private drawAgents(ctx: CanvasRenderingContext2D): void {
    const recovered = new Path2D();
    const healthy = new Path2D();
    const vaccinated = new Path2D();
    const infected = new Path2D();
    const halos = new Path2D();
    let infectedIndex = 0;
    for (const a of this.sim.agents) {
      if (a.state === 'R') {
        recovered.moveTo(a.x + 5, a.y);
        recovered.arc(a.x, a.y, 5, 0, Math.PI * 2);
      } else if (a.state === 'I') {
        const r = INFECTION_RADIUS * (1 + 0.12 * Math.sin(this.time * 4 + infectedIndex++));
        halos.moveTo(a.x + r, a.y);
        halos.arc(a.x, a.y, r, 0, Math.PI * 2);
        infected.moveTo(a.x + 6, a.y);
        infected.arc(a.x, a.y, 6, 0, Math.PI * 2);
      } else if (a.vaccinated) {
        vaccinated.moveTo(a.x + 5, a.y);
        vaccinated.arc(a.x, a.y, 5, 0, Math.PI * 2);
      } else {
        healthy.moveTo(a.x + 5, a.y);
        healthy.arc(a.x, a.y, 5, 0, Math.PI * 2);
      }
    }
    ctx.fillStyle = COLOR.r;
    ctx.fill(recovered);
    ctx.fillStyle = COLOR.s;
    ctx.fill(healthy);
    ctx.fillStyle = COLOR.v;
    ctx.fill(vaccinated);
    ctx.fillStyle = 'rgba(251, 95, 117, 0.10)';
    ctx.fill(halos);
    ctx.fillStyle = COLOR.i;
    ctx.fill(infected);
  }

  private drawRipples(ctx: CanvasRenderingContext2D): void {
    for (const r of this.ripples) {
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = 1 - r.t;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 14 + r.t * 90, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Stacked epidemic curve (sick, recovered, healthy) on a panel in the empty
   * plaza between the school and the market, clear of the toolbar and HUD.
   */
  private drawCurve(ctx: CanvasRenderingContext2D): void {
    const X0 = 590;
    const X1 = 1010;
    const Y0 = 316;
    const Y1 = 448;
    ctx.fillStyle = 'rgba(5, 8, 20, 0.5)';
    ctx.beginPath();
    ctx.roundRect(X0 - 16, Y0 - 14, X1 - X0 + 32, Y1 - Y0 + 28, 16);
    ctx.fill();

    const n = this.history.length;
    if (n < 2) {
      ctx.fillStyle = 'rgba(238, 242, 255, 0.45)';
      ctx.font = '24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('the epidemic curve', (X0 + X1) / 2, (Y0 + Y1) / 2 - 18);
      ctx.fillText('will draw itself here', (X0 + X1) / 2, (Y0 + Y1) / 2 + 18);
      return;
    }
    const H = Y1 - Y0;
    const xAt = (k: number) => X0 + ((X1 - X0) * k) / (n - 1);
    const iTop = this.history.map((s) => Y1 - (H * s.i) / AGENT_COUNT);
    const rTop = this.history.map((s, k) => iTop[k] - (H * s.r) / AGENT_COUNT);
    const band = (lower: (k: number) => number, upper: number[], color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(xAt(0), lower(0));
      for (let k = 1; k < n; k++) ctx.lineTo(xAt(k), lower(k));
      for (let k = n - 1; k >= 0; k--) ctx.lineTo(xAt(k), upper[k]);
      ctx.closePath();
      ctx.fill();
    };
    band(() => Y1, iTop, 'rgba(251, 95, 117, 0.85)');
    band((k) => iTop[k], rTop, 'rgba(141, 128, 184, 0.7)');
    band((k) => rTop[k], new Array<number>(n).fill(Y0), 'rgba(157, 184, 216, 0.25)');
  }

  private canAct(): boolean {
    if (this.mode === 'toy') return true;
    if (this.phase !== 'running') return false;
    return this.tool === 'vaccine' ? this.vaccinesLeft > 0 : this.soapsLeft > 0;
  }
}

export const outbreak: ArcadeGame = {
  id: 'outbreak',
  title: 'Outbreak!',
  scienceLine:
    'Our group has worked on simulating real epidemics — models like this (much bigger) help decide vaccinations and school closures in actual health policy.',
  tileEmoji: '🦠',
  create: (host) => new OutbreakInstance(host),
};
