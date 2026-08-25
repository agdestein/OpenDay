// Phase 4: Save the Netherlands — shallow-water flooding over a stylized
// Dutch coast (Canvas 2D). Toy mode: terraform and splash. Game mode: build
// dikes on a sand budget against three escalating storm surges.
import type { ArcadeGame, GameHost, GameInstance } from '../../shell/types';
import { scoreFlow, type ScoreFlowHandle } from '../../shell/scoreflow';
import { fmtNumber, pick, type Localized } from '../../lib/i18n';
import { FloodSim, GRID_H, GRID_W } from './water';

/** Virtual canvas pixels per grid cell (world is 1600x900). */
const CELL = 10;
const VIRT_W = GRID_W * CELL;
const VIRT_H = GRID_H * CELL;
const SIM_DT = 1 / 90;
/**
 * Supersampling factor for the terrain/water raster. Colors are computed at
 * SS× grid resolution from bilinearly interpolated height fields, so slopes,
 * coastlines and dikes render as smooth shapes instead of blurred grid pixels.
 */
const SS = 4;
const REND_W = GRID_W * SS;
const REND_H = GRID_H * SS;

interface Storm {
  // Storm names are Dutch flavor text (like real named storms) and stay the
  // same across languages.
  name: string;
  blurb: Localized<string>;
  surge: number;
  wave: number;
  sand: number;
}

// Surges calibrated against the map's dike crests (headless playtests in the
// Phase 4 commit): each storm breaks exactly one more line of defense.
const STORMS: Storm[] = [
  {
    name: 'Herfststorm 🍂',
    blurb: {
      en: 'A storm surge is heading for Zeeland! Protect Oma 👵 and the islands in the south.',
      nl: 'Er komt een stormvloed aan voor Zeeland! Bescherm Oma 👵 en de eilanden in het zuiden.',
      no: 'En stormflo er på vei mot Zeeland! Beskytt Oma 👵 og øyene i sør.',
    },
    surge: 1.8,
    wave: 0.35,
    sand: 360,
  },
  {
    name: 'Noordwester ⛈️',
    blurb: {
      en: 'A serious one: the low northern dunes and the river mouths will not hold this.',
      nl: 'Een serieuze: de lage duinen in het noorden en de riviermondingen houden dit niet tegen.',
      no: 'En alvorlig en: de lave dynene i nord og elvemunningene holder ikke denne.',
    },
    surge: 2.6,
    wave: 0.4,
    sand: 440,
  },
  {
    name: 'Watersnood! 🌊',
    blurb: {
      en: 'The big one — like 1953. Every weak spot in the coast is about to break.',
      nl: 'De grote — net als in 1953. Elke zwakke plek in de kust dreigt te breken.',
      no: 'Den store — som i 1953. Hvert svake punkt i kysten er i ferd med å briste.',
    },
    surge: 3.2,
    wave: 0.5,
    sand: 360,
  },
];

const TEXT: Localized<{
  dragHint: string;
  buildPhaseHint: string;
  stormArrivesHint: string;
  stormOfTotal: (round: number, total: number) => string;
  introContinuation: (surge: number, sand: number) => string;
  toWork: string;
  stormPassed: (name: string) => string;
  stayedDry: (n: number) => string;
  roundNote: (omaDry: boolean) => string;
  nextStorm: string;
  stormsPassed: string;
  peopleSaved: (n: number) => string;
  playAgain: string;
  freePlay: string;
  toolBuild: string;
  toolDig: string;
  toolSplash: string;
  toolStorm: string;
  toolReset: string;
  toolChallenge: string;
  toolDigBack: string;
  toolStop: string;
  legendSea: string;
  legendPolder: string;
  legendLand: string;
  legendDike: string;
  legendRisk: string;
  hudSand: (n: number) => string;
  hudDry: (n: number) => string;
  hudStormRound: (round: number, total: number) => string;
  hudArrivesIn: (s: number) => string;
  hudStormSurge: (name: string, level: number) => string;
  hudSavedSoFar: (status: string, total: number) => string;
  hudSeaLevel: (level: number) => string;
  cursorNeeds: (need: number) => string;
}> = {
  en: {
    dragHint: 'Drag to build dikes and dunes — then try the 🌩️ Storm button and hold back the sea!',
    buildPhaseHint:
      '⚠️ Striped land will flood! Build dikes across the red stripes — when the stripes behind a dike vanish, it will hold. Dig back sand you regret.',
    stormArrivesHint: 'Here it comes! 🌊 Emergency repairs are still allowed.',
    stormOfTotal: (round, total) => `Storm ${round} of ${total}`,
    introContinuation: (surge, sand) =>
      `Expected surge: +${fmtNumber(surge, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m. You get 🏖️ ${fmtNumber(sand)} sand. Red stripes show where the sea will get in — build dikes until the stripes are gone! Dikes you built before are still standing.`,
    toWork: '▶ To work!',
    stormPassed: (name) => `${name} has passed!`,
    stayedDry: (n) => `${fmtNumber(n)} people stayed dry`,
    roundNote: (omaDry) =>
      `${omaDry ? 'Oma is safe! 👵✨' : 'Oh no — Oma got wet feet! 👵💧'} The next storm will be worse. Your dikes stay, and more sand is coming.`,
    nextStorm: '▶ Next storm',
    stormsPassed: '🏆 The storms have passed!',
    peopleSaved: (n) => `${fmtNumber(n)} people saved`,
    playAgain: '🔁 Play again',
    freePlay: '🏝️ Free play',
    toolBuild: 'Build',
    toolDig: 'Dig',
    toolSplash: 'Splash',
    toolStorm: 'Storm',
    toolReset: 'Reset',
    toolChallenge: 'Challenge',
    toolDigBack: 'Dig back',
    toolStop: 'Stop',
    legendSea: 'sea & water',
    legendPolder: 'polder — below sea level!',
    legendLand: 'dunes & higher land',
    legendDike: 'sand you built',
    legendRisk: 'the storm would flood this',
    hudSand: (n) => `🏖️ ${fmtNumber(n)} sand`,
    hudDry: (n) => `🏠 ${fmtNumber(n)} dry`,
    hudStormRound: (round, total) => `Storm ${round}/${total}`,
    hudArrivesIn: (s) => ` · 🌊 arrives in ${fmtNumber(s)} s`,
    hudStormSurge: (name, level) =>
      ` · ${name} surge +${fmtNumber(level, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m`,
    hudSavedSoFar: (status, total) => `  |  ${status} · saved so far: ${fmtNumber(total)}`,
    hudSeaLevel: (level) =>
      `  |  🌊 sea +${fmtNumber(level, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m`,
    cursorNeeds: (need) =>
      `/ needs ${fmtNumber(need, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m`,
  },
  nl: {
    dragHint: 'Sleep om dijken en duinen te bouwen — probeer daarna de 🌩️ Storm-knop en houd de zee tegen!',
    buildPhaseHint:
      '⚠️ Gestreept land overstroomt! Bouw dijken dwars over de rode strepen — als de strepen achter een dijk verdwijnen, houdt hij stand. Graaf zand terug als je spijt hebt.',
    stormArrivesHint: 'Daar komt-ie! 🌊 Noodreparaties mogen nog.',
    stormOfTotal: (round, total) => `Storm ${round} van ${total}`,
    introContinuation: (surge, sand) =>
      `Verwachte stormvloed: +${fmtNumber(surge, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m. Je krijgt 🏖️ ${fmtNumber(sand)} zand. Rode strepen laten zien waar de zee naar binnen komt — bouw dijken tot de strepen weg zijn! Dijken die je eerder bouwde, blijven staan.`,
    toWork: '▶ Aan de slag!',
    stormPassed: (name) => `${name} is voorbij!`,
    stayedDry: (n) => `${fmtNumber(n)} mensen bleven droog`,
    roundNote: (omaDry) =>
      `${omaDry ? 'Oma is veilig! 👵✨' : 'Oh nee — Oma kreeg natte voeten! 👵💧'} De volgende storm wordt erger. Je dijken blijven staan en er komt meer zand.`,
    nextStorm: '▶ Volgende storm',
    stormsPassed: '🏆 De stormen zijn voorbij!',
    peopleSaved: (n) => `${fmtNumber(n)} mensen gered`,
    playAgain: '🔁 Opnieuw spelen',
    freePlay: '🏝️ Vrij spelen',
    toolBuild: 'Bouwen',
    toolDig: 'Graven',
    toolSplash: 'Spetteren',
    toolStorm: 'Storm',
    toolReset: 'Resetten',
    toolChallenge: 'Uitdaging',
    toolDigBack: 'Terug graven',
    toolStop: 'Stop',
    legendSea: 'zee & water',
    legendPolder: 'polder — onder zeeniveau!',
    legendLand: 'duinen & hoger land',
    legendDike: 'zand dat je hebt gebouwd',
    legendRisk: 'dit overstroomt bij de storm',
    hudSand: (n) => `🏖️ ${fmtNumber(n)} zand`,
    hudDry: (n) => `🏠 ${fmtNumber(n)} droog`,
    hudStormRound: (round, total) => `Storm ${round}/${total}`,
    hudArrivesIn: (s) => ` · 🌊 komt over ${fmtNumber(s)} s`,
    hudStormSurge: (name, level) =>
      ` · ${name} stormvloed +${fmtNumber(level, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m`,
    hudSavedSoFar: (status, total) => `  |  ${status} · tot nu toe gered: ${fmtNumber(total)}`,
    hudSeaLevel: (level) =>
      `  |  🌊 zee +${fmtNumber(level, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m`,
    cursorNeeds: (need) =>
      `/ nodig: ${fmtNumber(need, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m`,
  },
  no: {
    dragHint: 'Dra for å bygge diker og dyner — prøv så 🌩️ Storm-knappen og hold havet tilbake!',
    buildPhaseHint:
      '⚠️ Stripete land oversvømmes! Bygg diker tvers over de røde stripene — når stripene bak et dike forsvinner, holder det. Grav tilbake sand du angrer på.',
    stormArrivesHint: 'Nå kommer den! 🌊 Nødreparasjoner er fortsatt lov.',
    stormOfTotal: (round, total) => `Storm ${round} av ${total}`,
    introContinuation: (surge, sand) =>
      `Forventet stormflo: +${fmtNumber(surge, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m. Du får 🏖️ ${fmtNumber(sand)} sand. Røde striper viser hvor havet kommer inn — bygg diker til stripene er borte! Diker du bygde tidligere, står fortsatt.`,
    toWork: '▶ Sett i gang!',
    stormPassed: (name) => `${name} har passert!`,
    stayedDry: (n) => `${fmtNumber(n)} personer holdt seg tørre`,
    roundNote: (omaDry) =>
      `${omaDry ? 'Oma er trygg! 👵✨' : 'Å nei — Oma fikk våte føtter! 👵💧'} Neste storm blir verre. Dikene dine står, og det kommer mer sand.`,
    nextStorm: '▶ Neste storm',
    stormsPassed: '🏆 Stormene har passert!',
    peopleSaved: (n) => `${fmtNumber(n)} personer reddet`,
    playAgain: '🔁 Spill igjen',
    freePlay: '🏝️ Fri lek',
    toolBuild: 'Bygg',
    toolDig: 'Grav',
    toolSplash: 'Plask',
    toolStorm: 'Storm',
    toolReset: 'Nullstill',
    toolChallenge: 'Utfordring',
    toolDigBack: 'Grav tilbake',
    toolStop: 'Stopp',
    legendSea: 'hav & vann',
    legendPolder: 'polder — under havnivå!',
    legendLand: 'dyner & høyere land',
    legendDike: 'sand du har bygd',
    legendRisk: 'dette oversvømmes av stormen',
    hudSand: (n) => `🏖️ ${fmtNumber(n)} sand`,
    hudDry: (n) => `🏠 ${fmtNumber(n)} tørre`,
    hudStormRound: (round, total) => `Storm ${round}/${total}`,
    hudArrivesIn: (s) => ` · 🌊 kommer om ${fmtNumber(s)} s`,
    hudStormSurge: (name, level) =>
      ` · ${name} stormflo +${fmtNumber(level, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m`,
    hudSavedSoFar: (status, total) => `  |  ${status} · reddet så langt: ${fmtNumber(total)}`,
    hudSeaLevel: (level) =>
      `  |  🌊 hav +${fmtNumber(level, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m`,
    cursorNeeds: (need) =>
      `/ trenger ${fmtNumber(need, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m`,
  },
};

const BUILD_TIME = 25;
const RAMP = 8;
const HOLD = 16;
const FALL = 10;
/** Terrain raised per brush pass while painting a dike. */
const BUILD_AMOUNT = 0.9;
const CALM_WAVE = 0.06;
/**
 * Level a dike must beat for the risk preview: surge plus the full wave crest.
 * Headless playtests: building to surge + wave/2 still loses houses beside
 * deep water (the delta islands) to wave overtopping; the full crest holds.
 */
const stormCrest = (storm: Storm) => storm.surge + storm.wave;

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
  private riskTimer = 0;

  // Per-grid-cell shading, computed once per frame and bilinearly sampled by
  // the supersampled painter: terrain hillshade, water-surface shade, foam.
  private shadeT = new Float32Array(GRID_W * GRID_H);
  private shadeS = new Float32Array(GRID_W * GRID_H);
  private foamC = new Float32Array(GRID_W * GRID_H);
  private sinX = new Float32Array(REND_W);
  private sinY = new Float32Array(REND_H);
  private ripX = new Float32Array(REND_W);
  private ripY = new Float32Array(REND_H);

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
    // Dev console access for tuning/debugging the live simulation.
    (window as unknown as Record<string, unknown>).__flood = this.sim;
    this.ctx = this.host.canvas.getContext('2d')!;
    this.off.width = REND_W;
    this.off.height = REND_H;
    this.offCtx = this.off.getContext('2d')!;
    this.img = this.offCtx.createImageData(REND_W, REND_H);
    this.buildUi();
    const canvas = this.host.canvas;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.setTool('build');
    this.hint.textContent = pick(TEXT).dragHint;
  }

  frame(dt: number): void {
    this.time += dt;
    if (this.mode === 'game') this.stepGame(dt);
    else this.stepToy(dt);

    const n = Math.max(1, Math.min(4, Math.round(dt / SIM_DT)));
    for (let i = 0; i < n; i++) this.sim.step(dt / n);
    if (this.mode === 'toy' || this.phase === 'storm') this.sim.updateFlooding();

    this.riskTimer -= dt;
    if (this.riskTimer <= 0) {
      this.riskTimer = 0.3;
      const level = this.riskLevel();
      if (level > 0) this.sim.computeRisk(level);
      else this.sim.clearRisk();
    }

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
      const T = pick(TEXT);
      const heading = document.createElement('h2');
      heading.textContent = T.stormOfTotal(this.round + 1, STORMS.length);
      const name = document.createElement('div');
      name.className = 'score-flow-score';
      name.textContent = storm.name;
      const blurb = document.createElement('p');
      blurb.className = 'score-flow-prompt';
      blurb.textContent = `${pick(storm.blurb)} ${T.introContinuation(storm.surge, storm.sand)}`;
      const actions = document.createElement('div');
      actions.className = 'score-flow-actions';
      const go = document.createElement('button');
      go.className = 'arcade-button';
      go.textContent = T.toWork;
      go.addEventListener('click', () => {
        this.card?.remove();
        this.card = null;
        this.phase = 'build';
        this.phaseTime = 0;
        this.hint.textContent = pick(TEXT).buildPhaseHint;
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
        this.hint.textContent = pick(TEXT).stormArrivesHint;
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
      const T = pick(TEXT);
      const heading = document.createElement('h2');
      heading.textContent = T.stormPassed(STORMS[this.round].name);
      const score = document.createElement('div');
      score.className = 'score-flow-score';
      score.textContent = T.stayedDry(stats.saved * 1000);
      const note = document.createElement('p');
      note.className = 'score-flow-prompt';
      note.textContent = T.roundNote(stats.omaDry);
      const actions = document.createElement('div');
      actions.className = 'score-flow-actions';
      const next = document.createElement('button');
      next.className = 'arcade-button';
      next.textContent = T.nextStorm;
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
    const T = pick(TEXT);
    this.flow = scoreFlow({
      gameId: 'floodland',
      heading: T.stormsPassed,
      score: this.totalSaved * 1000,
      scoreLabel: T.peopleSaved(this.totalSaved * 1000),
      actions: [
        { label: T.playAgain, onClick: () => this.startGame() },
        { label: T.freePlay, onClick: () => this.exitToToy() },
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
    this.hint.textContent = pick(TEXT).dragHint;
  }

  // ---- toy mode ----

  private stepToy(dt: number): void {
    const target = this.toyStorm ? 2.4 : 0;
    const diff = target - this.sim.seaLevel;
    this.sim.seaLevel += Math.sign(diff) * Math.min(Math.abs(diff), 0.45 * dt);
    this.sim.waveAmp = CALM_WAVE + (this.toyStorm ? 0.45 * Math.min(1, this.sim.seaLevel / 2) : 0);
  }

  // ---- input ----

  /** Surge level to preview as flood risk right now (0 = no preview). */
  private riskLevel(): number {
    if (this.mode === 'game' && (this.phase === 'build' || this.phase === 'storm')) {
      return stormCrest(STORMS[this.round]);
    }
    if (this.mode === 'toy' && this.toyStorm) return 2.4 + 0.45;
    return 0;
  }

  private applyTool(cx: number, cy: number): void {
    if (this.mode === 'game') {
      if (this.phase !== 'build' && this.phase !== 'storm') return;
      if (this.tool === 'dig') this.sand += this.sim.lower(cx, cy, 1);
      else {
        // One stroke builds straight to a storm-proof crest; cost = deficit.
        const target = stormCrest(STORMS[this.round]) + 0.3;
        this.sand -= this.sim.raiseToward(cx, cy, target, this.sand);
      }
    } else if (this.tool === 'build') this.sim.raise(cx, cy, BUILD_AMOUNT, Infinity);
    else if (this.tool === 'dig') this.sim.lower(cx, cy, 1);
    else {
      this.sim.splash(cx, cy);
      return;
    }
    // Terrain changed: refresh the risk overlay on the next frame.
    this.riskTimer = 0;
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

    const T = pick(TEXT);

    this.toyBar = document.createElement('div');
    this.toyBar.className = 'game-toolbar';
    add(this.toyBar, 'build', '🏗️', T.toolBuild, () => this.setTool('build'));
    add(this.toyBar, 'dig', '⛏️', T.toolDig, () => this.setTool('dig'));
    add(this.toyBar, 'splash', '💦', T.toolSplash, () => this.setTool('splash'));
    add(this.toyBar, 'storm', '🌩️', T.toolStorm, () => {
      this.toyStorm = !this.toyStorm;
      this.buttons.storm.classList.toggle('active', this.toyStorm);
      if (!this.toyStorm) this.sim.resetWater();
    });
    add(this.toyBar, 'reset', '🧹', T.toolReset, () => {
      this.toyStorm = false;
      this.buttons.storm.classList.remove('active');
      this.sim.resetAll();
      this.sim.waveAmp = CALM_WAVE;
    });
    add(this.toyBar, 'challenge', '⛈️', T.toolChallenge, () => this.startGame());

    this.gameBar = document.createElement('div');
    this.gameBar.className = 'game-toolbar hidden';
    add(this.gameBar, 'gbuild', '🏗️', T.toolBuild, () => this.setTool('build'));
    add(this.gameBar, 'gdig', '⛏️', T.toolDigBack, () => this.setTool('dig'));
    add(this.gameBar, 'stop', '⏹', T.toolStop, () => this.exitToToy());

    const hud = document.createElement('div');
    hud.className = 'challenge-hud';
    this.hudLeft = document.createElement('span');
    this.hudRight = document.createElement('span');
    hud.append(this.hudLeft, this.hudRight);

    this.hint = document.createElement('p');
    this.hint.className = 'challenge-hint';

    const legend = document.createElement('div');
    legend.className = 'flood-legend';
    const row = (swatch: string, label: string) => {
      const item = document.createElement('div');
      item.className = 'flood-legend-row';
      const box = document.createElement('span');
      box.className = `flood-swatch flood-swatch-${swatch}`;
      const text = document.createElement('span');
      text.textContent = label;
      item.append(box, text);
      legend.appendChild(item);
    };
    row('sea', T.legendSea);
    row('polder', T.legendPolder);
    row('land', T.legendLand);
    row('dike', T.legendDike);
    row('risk', T.legendRisk);

    this.host.overlay.append(this.toyBar, this.gameBar, hud, this.hint, legend);
  }

  private setTool(tool: Tool): void {
    this.tool = tool;
    for (const key of ['build', 'dig', 'splash'] as const) {
      this.buttons[key]?.classList.toggle('active', tool === key);
    }
    this.buttons.gbuild?.classList.toggle('active', tool === 'build');
    this.buttons.gdig?.classList.toggle('active', tool === 'dig');
  }

  private showCard(build: (card: HTMLElement) => void): void {
    this.card?.remove();
    this.card = document.createElement('div');
    this.card.className = 'score-flow';
    build(this.card);
    this.host.overlay.appendChild(this.card);
  }

  private updateHud(): void {
    const T = pick(TEXT);
    const stats = this.sim.savedStats();
    const dry = T.hudDry(stats.saved * 1000);
    if (this.mode === 'game') {
      this.hudLeft.textContent = `${T.hudSand(Math.max(0, Math.round(this.sand)))}   ${dry}`;
      const storm = STORMS[this.round];
      let status = T.hudStormRound(this.round + 1, STORMS.length);
      if (this.phase === 'build') {
        status += T.hudArrivesIn(Math.max(0, Math.ceil(BUILD_TIME - this.phaseTime)));
      } else if (this.phase === 'storm') {
        status += T.hudStormSurge(storm.name, this.sim.seaLevel);
      }
      this.hudRight.textContent = T.hudSavedSoFar(status, this.totalSaved * 1000);
    } else {
      this.hudLeft.textContent = dry;
      this.hudRight.textContent = this.sim.seaLevel > 0.05 ? T.hudSeaLevel(this.sim.seaLevel) : '';
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

  /**
   * Terrain + water colors into the supersampled ImageData. Height fields are
   * bilinearly interpolated so slopes render smoothly; hillshading (light from
   * the north-west) makes dunes and dikes read as 3D relief, and the risk
   * overlay draws marching red stripes on land the coming surge would reach.
   */
  private paintCells(): void {
    const sim = this.sim;
    const { terrain, water, built, risk } = sim;
    const { shadeT, shadeS, foamC, sinX, sinY, ripX, ripY } = this;
    const t = this.time;

    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const i = y * GRID_W + x;
        const l = x > 0 ? i - 1 : i;
        const rr = x < GRID_W - 1 ? i + 1 : i;
        const u = y > 0 ? i - GRID_W : i;
        const d = y < GRID_H - 1 ? i + GRID_W : i;
        const st = 1 - 0.13 * (terrain[rr] - terrain[l] + terrain[d] - terrain[u]);
        shadeT[i] = st < 0.6 ? 0.6 : st > 1.4 ? 1.4 : st;
        const ss =
          1 -
          0.45 *
            (terrain[rr] + water[rr] - terrain[l] - water[l] +
              terrain[d] + water[d] - terrain[u] - water[u]);
        shadeS[i] = ss < 0.72 ? 0.72 : ss > 1.32 ? 1.32 : ss;
        foamC[i] = Math.min(1, sim.flux(i) * 0.3);
      }
    }
    // Wave/foam wobble as separable sin tables: no trig in the pixel loop.
    for (let px = 0; px < REND_W; px++) {
      sinX[px] = Math.sin(t * 3.1 + px * 0.31);
      ripX[px] = Math.sin(px * 0.23 + t * 1.9);
    }
    for (let py = 0; py < REND_H; py++) {
      sinY[py] = Math.sin(t * 1.7 + py * 0.23);
      ripY[py] = Math.sin(py * 0.19 - t * 0.8);
    }

    const data = this.img.data;
    const waveAmp = sim.waveAmp;
    const stripePhase = t * 26;
    let p = 0;
    for (let py = 0; py < REND_H; py++) {
      let gy = (py + 0.5) / SS - 0.5;
      if (gy < 0) gy = 0;
      else if (gy > GRID_H - 1) gy = GRID_H - 1;
      const y0 = gy | 0;
      const y1 = y0 < GRID_H - 1 ? y0 + 1 : y0;
      const ty = gy - y0;
      for (let px = 0; px < REND_W; px++, p += 4) {
        let gx = (px + 0.5) / SS - 0.5;
        if (gx < 0) gx = 0;
        else if (gx > GRID_W - 1) gx = GRID_W - 1;
        const x0 = gx | 0;
        const x1 = x0 < GRID_W - 1 ? x0 + 1 : x0;
        const tx = gx - x0;
        const i00 = y0 * GRID_W + x0;
        const i10 = y0 * GRID_W + x1;
        const i01 = y1 * GRID_W + x0;
        const i11 = y1 * GRID_W + x1;
        const w00 = (1 - tx) * (1 - ty);
        const w10 = tx * (1 - ty);
        const w01 = (1 - tx) * ty;
        const w11 = tx * ty;
        const T = terrain[i00] * w00 + terrain[i10] * w10 + terrain[i01] * w01 + terrain[i11] * w11;
        const Wd = water[i00] * w00 + water[i10] * w10 + water[i01] * w01 + water[i11] * w11;

        let r: number;
        let g: number;
        let b: number;
        if (T < -0.05) {
          // Polder / sea floor: below sea level (only visible where dry).
          const k = Math.min(1, -T / 3);
          r = 98 - 34 * k;
          g = 140 - 40 * k;
          b = 76 - 20 * k;
        } else if (T < 0.18) {
          r = 197;
          g = 182;
          b = 134; // narrow sand band right at sea level — the coastline ring
        } else if (T < 2.8) {
          const k = (T - 0.18) / 2.62;
          r = 132 - 24 * k;
          g = 158 - 22 * k;
          b = 90 - 12 * k; // grass
        } else {
          // High ground: muted sage-gray, so the eastern hills don't read as
          // one giant beach next to the actual sand-colored coastline.
          const k = Math.min(1, (T - 2.8) / 2.2);
          r = 108 + 44 * k;
          g = 136 + 18 * k;
          b = 78 + 40 * k;
        }
        const B = built[i00] * w00 + built[i10] * w10 + built[i01] * w01 + built[i11] * w11;
        const bl = Math.min(1, B) * 0.8;
        r += (206 - r) * bl;
        g += (182 - g) * bl;
        b += (132 - b) * bl; // sandbag tint on player dikes
        const sh = shadeT[i00] * w00 + shadeT[i10] * w10 + shadeT[i01] * w01 + shadeT[i11] * w11;
        r *= sh;
        g *= sh;
        b *= sh;

        if (Wd > 0.015) {
          // Saturate quickly with depth: the deep sea stays one calm dark tone
          // (waves show as moving shade and whitecaps, not banded color).
          const k = Math.min(1, Wd / 2.2);
          let wr = 72 - 46 * k;
          let wg = 150 - 82 * k;
          let wb = 208 - 88 * k;
          let ws = shadeS[i00] * w00 + shadeS[i10] * w10 + shadeS[i01] * w01 + shadeS[i11] * w11;
          if (Wd > 0.35) ws += 0.06 * ripX[px] * ripY[py];
          wr *= ws;
          wg *= ws;
          wb *= ws;
          const fC = foamC[i00] * w00 + foamC[i10] * w10 + foamC[i01] * w01 + foamC[i11] * w11;
          let foam = fC * Math.min(1, Wd * 2.5);
          // Shoreline foam only where the water actually moves (waves or flow),
          // so calm coasts get a thin sparkle instead of a fat white halo.
          if (Wd < 0.22) {
            const activity = Math.min(1, fC * 2.5 + waveAmp * 1.3);
            foam += (1 - Wd / 0.22) * 0.55 * activity * (0.55 + 0.45 * sinX[px] * sinY[py]);
          }
          if (T < -0.5 && waveAmp > 0.1) {
            // Whitecaps only on the steepest crest faces, broken up by noise.
            foam +=
              Math.max(0, (ws - 1) * 2.0 - 0.34) *
              Math.min(1, waveAmp * 1.8) *
              (0.55 + 0.45 * sinX[px] * sinY[py]);
          }
          if (foam > 1) foam = 1;
          wr += (235 - wr) * foam;
          wg += (243 - wg) * foam;
          wb += (248 - wb) * foam;
          const alpha = Math.min(0.94, 0.45 + Wd * 0.5);
          r += (wr - r) * alpha;
          g += (wg - g) * alpha;
          b += (wb - b) * alpha;
        }

        // Flood-risk overlay: marching diagonal stripes on threatened land.
        if (risk[(ty > 0.5 ? y1 : y0) * GRID_W + (tx > 0.5 ? x1 : x0)]) {
          if ((px + py + stripePhase) % 13 < 5.5) {
            r += (255 - r) * 0.42;
            g += (110 - g) * 0.42;
            b += (84 - b) * 0.42;
          }
        }

        data[p] = r;
        data[p + 1] = g;
        data[p + 2] = b;
        data[p + 3] = 255;
      }
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
      ctx.fillStyle = `rgba(10, 16, 38, ${0.14 * intensity})`;
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

    // Brush cursor, with a height readout: does this spot beat the surge?
    if (this.cursor && (this.mode === 'toy' || this.phase === 'build' || this.phase === 'storm')) {
      const cx = Math.min(GRID_W - 1, Math.max(0, Math.round(this.cursor.x)));
      const cy = Math.min(GRID_H - 1, Math.max(0, Math.round(this.cursor.y)));
      const height = this.sim.terrain[cy * GRID_W + cx];
      const need = this.riskLevel();
      const high = need > 0 && height >= need;
      ctx.strokeStyle =
        this.tool === 'dig'
          ? 'rgba(251, 146, 60, 0.8)'
          : high
            ? 'rgba(74, 222, 128, 0.9)'
            : 'rgba(238, 242, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(this.cursor.x * CELL, this.cursor.y * CELL, 2 * CELL, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (need > 0) {
        ctx.font = '700 15px system-ui, sans-serif';
        ctx.fillStyle = high ? '#4ade80' : '#ffd166';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 4;
        ctx.textAlign = 'left';
        const heightStr = fmtNumber(height, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        ctx.fillText(
          `${heightStr} m ${high ? '✓' : pick(TEXT).cursorNeeds(need)}`,
          this.cursor.x * CELL + 2.6 * CELL,
          this.cursor.y * CELL - 1.5 * CELL,
        );
        ctx.shadowBlur = 0;
        ctx.textAlign = 'center';
      }
    }
  }
}

export const floodland: ArcadeGame = {
  id: 'floodland',
  title: { en: 'Save the Netherlands', nl: 'Red Nederland', no: 'Redd Nederland' },
  scienceLine: {
    en: 'Real shallow-water equations — after the 1953 flood, Dutch mathematicians computed storm surges to design the Delta Works, and our group still works on flood-safety simulation with Deltares.',
    nl: 'Echte ondiepwater-vergelijkingen — na de Watersnoodramp van 1953 berekenden Nederlandse wiskundigen stormvloeden om de Deltawerken te ontwerpen, en onze groep werkt nog steeds aan overstromingsveiligheid-simulaties met Deltares.',
    no: 'Ekte gruntvanns-likninger — etter storflommen i 1953 beregnet nederlandske matematikere stormfloer for å designe Deltawerken, og gruppa vår jobber fortsatt med flomsikkerhet-simulering sammen med Deltares.',
  },
  tileEmoji: '🌊',
  create: (host) => new FloodInstance(host),
};
