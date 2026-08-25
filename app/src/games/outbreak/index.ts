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
import {
  delvePanel,
  delveToggle,
  type DelveHandle,
  type DelveToggleHandle,
} from '../../shell/delve';
import { outbreakDelve, type OutbreakDelve } from './delve';
import { pick, fmtNumber, type Localized } from '../../lib/i18n';

type RoundId = 'sniffles' | 'flashFlu' | 'megaMeasles';

interface Round {
  id: RoundId;
  stars: string;
  rate: number;
  vaccines: number;
  soaps: number;
}

// Rates calibrated by headless sweeps (docs in the Phase 3 commit): with 2
// vaccines + soap + school closure, round 1 saves ~460/500 vs ~230 doing
// nothing; round 3 sweeps almost everyone without smart play.
const ROUNDS: Round[] = [
  { id: 'sniffles', stars: '★☆☆', rate: 0.2, vaccines: 2, soaps: 1 },
  { id: 'flashFlu', stars: '★★☆', rate: 0.35, vaccines: 2, soaps: 1 },
  { id: 'megaMeasles', stars: '★★★', rate: 0.55, vaccines: 1, soaps: 1 },
];

const TEXT: Localized<{
  clickToStart: string;
  vaccinateHint: string;
  roundOf: (round: number, total: number) => string;
  hudRound: (round: number, total: number, saved: number) => string;
  roundNames: Record<RoundId, string>;
  roundBlurb: (stars: string, vaccines: number, soaps: number) => string;
  go: string;
  roundOver: (name: string) => string;
  savedOf: (saved: number, total: number) => string;
  greatContainment: string;
  ouchContainment: string;
  nextRound: string;
  allRoundsSurvived: string;
  peopleSaved: (n: number) => string;
  playAgain: string;
  freePlay: string;
  toolInfect: string;
  toolVaccinate: string;
  toolSoap: string;
  closeSchool: string;
  openSchool: string;
  reset: string;
  challenge: string;
  stop: string;
  vaccinateCount: (n: number) => string;
  soapCount: (n: number) => string;
  schoolClosed: string;
  scienceHeading: string;
  stateSusceptible: string;
  stateSusceptibleDesc: string;
  stateInfected: string;
  stateInfectedDesc: string;
  stateRecovered: string;
  stateRecoveredDesc: string;
  stateVaccinated: string;
  stateVaccinatedDesc: string;
  meetsSick: string;
  chanceBeta: string;
  getsBetter: string;
  rateGamma: string;
  liveClickToInfect: string;
  patientZero: string;
  generation: (k: number) => string;
  fizzlesZero: string;
  spreadTakesOff: string;
  spreadFizzles: string;
  spreadKnifeEdge: string;
  spreadingPower: (power: string, verdict: string) => string;
  hospitalCapacity: string;
  doNothing: string;
  soapClosedVaccines: string;
  sickOverTime: string;
  noOutbreakYet: string;
  closeScienceInfect: string;
  cityEpidemicLive: string;
  epidemicCurveLine1: string;
  epidemicCurveLine2: string;
}> = {
  en: {
    clickToStart: 'Click anywhere to start an outbreak! 🦠',
    vaccinateHint: 'Someone is about to get sick — act fast! Click a neighborhood to vaccinate it.',
    roundOf: (round, total) => `Round ${round} of ${total}`,
    hudRound: (round, total, saved) => `  |  Round ${round}/${total} · saved so far: ${saved}`,
    roundNames: {
      sniffles: 'The Sniffles 🤧',
      flashFlu: 'Flash Flu 🥵',
      megaMeasles: 'Mega Measles 🔴',
    },
    roundBlurb: (stars, vaccines, soaps) =>
      `Contagiousness: ${stars}. Your tools: ${'💉'.repeat(vaccines)} vaccine${vaccines > 1 ? 's' : ''} for a neighborhood, ${'🧼'.repeat(soaps)} soap station, and you may close the school 🏫. Save as many people as you can!`,
    go: '▶ GO!',
    roundOver: (name) => `${name} is over!`,
    savedOf: (saved, total) => `You saved ${saved} of ${total}`,
    greatContainment: 'Great containment! The next disease spreads faster…',
    ouchContainment: 'Ouch — the next one spreads faster. Vaccinate early!',
    nextRound: '▶ Next round',
    allRoundsSurvived: '🏆 All rounds survived!',
    peopleSaved: (n) => `${fmtNumber(n)} people saved`,
    playAgain: '🔁 Play again',
    freePlay: '🦠 Free play',
    toolInfect: 'Infect',
    toolVaccinate: 'Vaccinate',
    toolSoap: 'Soap',
    closeSchool: 'Close school',
    openSchool: 'Open school',
    reset: 'Reset',
    challenge: 'Challenge',
    stop: 'Stop',
    vaccinateCount: (n) => `Vaccinate ×${n}`,
    soapCount: (n) => `Soap ×${n}`,
    schoolClosed: 'School closed',
    scienceHeading: '🔬 The science of Outbreak!',
    stateSusceptible: 'Susceptible',
    stateSusceptibleDesc: 'healthy — could still catch it',
    stateInfected: 'Infected',
    stateInfectedDesc: 'sick and contagious',
    stateRecovered: 'Recovered',
    stateRecoveredDesc: 'had it, now immune',
    stateVaccinated: 'Vaccinated',
    stateVaccinatedDesc: 'protected without getting sick',
    meetsSick: 'meets someone sick',
    chanceBeta: '(chance β)',
    getsBetter: 'gets better',
    rateGamma: '(rate γ)',
    liveClickToInfect: '👆 live — click inside to infect someone',
    patientZero: 'patient zero',
    generation: (k) => `generation ${k}`,
    fizzlesZero: '0 💨',
    spreadTakesOff: '🔥 this one takes off',
    spreadFizzles: '💨 this one fizzles out',
    spreadKnifeEdge: '⚖️ on a knife’s edge',
    spreadingPower: (power, verdict) => `spreading power ≈ ${power} — ${verdict}`,
    hospitalCapacity: '🏥 what hospitals can handle',
    doNothing: 'do nothing',
    soapClosedVaccines: 'soap + closed school + vaccines',
    sickOverTime: 'sick people over time →',
    noOutbreakYet: 'no outbreak yet —',
    closeScienceInfect: 'close the science and infect someone!',
    cityEpidemicLive: 'your city’s epidemic curve — live',
    epidemicCurveLine1: 'the epidemic curve',
    epidemicCurveLine2: 'will draw itself here',
  },
  nl: {
    clickToStart: 'Klik ergens om een uitbraak te starten! 🦠',
    vaccinateHint: 'Er wordt zo iemand ziek — snel! Klik op een wijk om die te vaccineren.',
    roundOf: (round, total) => `Ronde ${round} van ${total}`,
    hudRound: (round, total, saved) => `  |  Ronde ${round}/${total} · tot nu toe gered: ${saved}`,
    roundNames: {
      sniffles: 'De Snotneus 🤧',
      flashFlu: 'Flitsgriep 🥵',
      megaMeasles: 'Mega Mazelen 🔴',
    },
    roundBlurb: (stars, vaccines, soaps) =>
      `Besmettelijkheid: ${stars}. Jouw hulpmiddelen: ${'💉'.repeat(vaccines)} vaccin${vaccines > 1 ? 's' : ''} voor een wijk, ${'🧼'.repeat(soaps)} zeepstation, en je mag de school 🏫 sluiten. Red zoveel mogelijk mensen!`,
    go: '▶ START!',
    roundOver: (name) => `${name} is voorbij!`,
    savedOf: (saved, total) => `Je hebt ${saved} van de ${total} gered`,
    greatContainment: 'Geweldig ingedamd! De volgende ziekte verspreidt zich sneller…',
    ouchContainment: 'Au — de volgende verspreidt zich sneller. Vaccineer op tijd!',
    nextRound: '▶ Volgende ronde',
    allRoundsSurvived: '🏆 Alle rondes overleefd!',
    peopleSaved: (n) => `${fmtNumber(n)} mensen gered`,
    playAgain: '🔁 Opnieuw spelen',
    freePlay: '🦠 Vrij spelen',
    toolInfect: 'Besmetten',
    toolVaccinate: 'Vaccineren',
    toolSoap: 'Zeep',
    closeSchool: 'School sluiten',
    openSchool: 'School openen',
    reset: 'Reset',
    challenge: 'Uitdaging',
    stop: 'Stop',
    vaccinateCount: (n) => `Vaccineren ×${n}`,
    soapCount: (n) => `Zeep ×${n}`,
    schoolClosed: 'School gesloten',
    scienceHeading: '🔬 De wetenschap van Uitbraak!',
    stateSusceptible: 'Vatbaar',
    stateSusceptibleDesc: 'gezond — kan het nog krijgen',
    stateInfected: 'Besmet',
    stateInfectedDesc: 'ziek en besmettelijk',
    stateRecovered: 'Hersteld',
    stateRecoveredDesc: 'heeft het gehad, nu immuun',
    stateVaccinated: 'Gevaccineerd',
    stateVaccinatedDesc: 'beschermd zonder ziek te worden',
    meetsSick: 'ontmoet iemand die ziek is',
    chanceBeta: '(kans β)',
    getsBetter: 'wordt beter',
    rateGamma: '(snelheid γ)',
    liveClickToInfect: '👆 live — klik erin om iemand te besmetten',
    patientZero: 'patiënt nul',
    generation: (k) => `generatie ${k}`,
    fizzlesZero: '0 💨',
    spreadTakesOff: '🔥 deze slaat aan',
    spreadFizzles: '💨 deze dooft vanzelf uit',
    spreadKnifeEdge: '⚖️ op het scherp van de snede',
    spreadingPower: (power, verdict) => `verspreidingskracht ≈ ${power} — ${verdict}`,
    hospitalCapacity: '🏥 wat ziekenhuizen aankunnen',
    doNothing: 'niets doen',
    soapClosedVaccines: 'zeep + gesloten school + vaccins',
    sickOverTime: 'zieke mensen door de tijd →',
    noOutbreakYet: 'nog geen uitbraak —',
    closeScienceInfect: 'sluit de wetenschap en besmet iemand!',
    cityEpidemicLive: 'de epidemiecurve van jouw stad — live',
    epidemicCurveLine1: 'de epidemiecurve',
    epidemicCurveLine2: 'tekent zichzelf hier',
  },
  no: {
    clickToStart: 'Klikk hvor som helst for å starte et utbrudd! 🦠',
    vaccinateHint: 'Snart blir noen syke — vær rask! Klikk på et nabolag for å vaksinere det.',
    roundOf: (round, total) => `Runde ${round} av ${total}`,
    hudRound: (round, total, saved) => `  |  Runde ${round}/${total} · reddet så langt: ${saved}`,
    roundNames: {
      sniffles: 'Snørrsnue 🤧',
      flashFlu: 'Lynrask influensa 🥵',
      megaMeasles: 'Mega Meslinger 🔴',
    },
    roundBlurb: (stars, vaccines, soaps) =>
      `Smittsomhet: ${stars}. Verktøyene dine: ${'💉'.repeat(vaccines)} vaksine${vaccines > 1 ? 'r' : ''} til et nabolag, ${'🧼'.repeat(soaps)} såpestasjon, og du kan stenge skolen 🏫. Redd så mange du kan!`,
    go: '▶ KJØR!',
    roundOver: (name) => `${name} er over!`,
    savedOf: (saved, total) => `Du reddet ${saved} av ${total}`,
    greatContainment: 'Strålende innsats! Neste sykdom sprer seg raskere…',
    ouchContainment: 'Au — den neste sprer seg raskere. Vaksiner tidlig!',
    nextRound: '▶ Neste runde',
    allRoundsSurvived: '🏆 Alle rundene overlevd!',
    peopleSaved: (n) => `${fmtNumber(n)} personer reddet`,
    playAgain: '🔁 Spill igjen',
    freePlay: '🦠 Fri lek',
    toolInfect: 'Smitt',
    toolVaccinate: 'Vaksiner',
    toolSoap: 'Såpe',
    closeSchool: 'Steng skolen',
    openSchool: 'Åpne skolen',
    reset: 'Nullstill',
    challenge: 'Utfordring',
    stop: 'Stopp',
    vaccinateCount: (n) => `Vaksiner ×${n}`,
    soapCount: (n) => `Såpe ×${n}`,
    schoolClosed: 'Skolen stengt',
    scienceHeading: '🔬 Vitenskapen bak Utbrudd!',
    stateSusceptible: 'Mottakelig',
    stateSusceptibleDesc: 'frisk — kan fortsatt bli smittet',
    stateInfected: 'Smittet',
    stateInfectedDesc: 'syk og smittsom',
    stateRecovered: 'Immun',
    stateRecoveredDesc: 'har hatt sykdommen, nå immun',
    stateVaccinated: 'Vaksinert',
    stateVaccinatedDesc: 'beskyttet uten å bli syk',
    meetsSick: 'møter noen som er syk',
    chanceBeta: '(sjanse β)',
    getsBetter: 'blir frisk',
    rateGamma: '(hastighet γ)',
    liveClickToInfect: '👆 live — klikk inni for å smitte noen',
    patientZero: 'pasient null',
    generation: (k) => `generasjon ${k}`,
    fizzlesZero: '0 💨',
    spreadTakesOff: '🔥 denne tar av',
    spreadFizzles: '💨 denne dør ut av seg selv',
    spreadKnifeEdge: '⚖️ på vippepunktet',
    spreadingPower: (power, verdict) => `spredningskraft ≈ ${power} — ${verdict}`,
    hospitalCapacity: '🏥 det sykehusene tåler',
    doNothing: 'gjøre ingenting',
    soapClosedVaccines: 'såpe + stengt skole + vaksiner',
    sickOverTime: 'syke mennesker over tid →',
    noOutbreakYet: 'ingen utbrudd ennå —',
    closeScienceInfect: 'lukk vitenskapen og smitt noen!',
    cityEpidemicLive: 'byens epidemikurve — live',
    epidemicCurveLine1: 'epidemikurven',
    epidemicCurveLine2: 'tegner seg selv her',
  },
};

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
  private delve: DelveHandle | null = null;
  private delveContent: OutbreakDelve | null = null;
  private toggle!: DelveToggleHandle;
  /** Transform of the mini city drawn in delve chapter 2, for click-to-infect. */
  private delveCity: { scale: number; ox: number; oy: number } | null = null;
  private buttons: Record<string, HTMLButtonElement> = {};

  private onPointerDown = (e: PointerEvent) => {
    if (this.delve) {
      if (this.delve.chapter === 1) this.delveCityClick(e);
      return;
    }
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
    this.hint.textContent = pick(TEXT).clickToStart;
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
    this.delveContent?.update();
    this.draw();
  }

  destroy(): void {
    this.host.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.flow?.dispose();
    this.delve?.dispose();
    this.card?.remove();
  }

  // ---- delve layer ----

  private openDelve(): void {
    if (this.delve) return;
    this.delveContent = outbreakDelve(this.sim);
    this.delve = delvePanel({
      heading: pick(TEXT).scienceHeading,
      chapters: this.delveContent.chapters,
      onChapter: () => {},
      onExit: () => this.closeDelve(),
    });
    this.host.overlay.appendChild(this.delve.element);
    this.toggle.setOpen(true);
    this.toyBar.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.hint.classList.add('hidden');
  }

  private closeDelve(): void {
    if (!this.delve) return;
    this.delve.dispose();
    this.delve = null;
    this.delveContent = null;
    this.delveCity = null;
    this.toggle.setOpen(false);
    this.toyBar.classList.remove('hidden');
    this.hud.classList.remove('hidden');
    this.hint.classList.remove('hidden');
  }

  /** Clicks on the live mini city in delve chapter 2 infect, like in toy mode. */
  private delveCityClick(e: PointerEvent): void {
    if (!this.delveCity) return;
    const rect = this.host.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.delveCity.ox) / this.delveCity.scale;
    const y = (e.clientY - rect.top - this.delveCity.oy) / this.delveCity.scale;
    if (x < 0 || x > CITY_W || y < 0 || y > CITY_H) return;
    const agent = this.sim.infectNearest(x, y);
    if (agent) this.ripples.push({ x: agent.x, y: agent.y, t: 0, color: COLOR.i });
  }

  // ---- game flow ----

  private startGame(): void {
    this.flow?.dispose();
    this.flow = null;
    this.mode = 'game';
    this.round = 0;
    this.totalSaved = 0;
    this.closeDelve();
    this.toyBar.classList.add('hidden');
    this.gameBar.classList.remove('hidden');
    this.toggle.element.classList.add('hidden');
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
      const T = pick(TEXT);
      const heading = document.createElement('h2');
      heading.textContent = T.roundOf(this.round + 1, ROUNDS.length);
      const name = document.createElement('div');
      name.className = 'score-flow-score';
      name.textContent = T.roundNames[config.id];
      const blurb = document.createElement('p');
      blurb.className = 'score-flow-prompt';
      blurb.textContent = T.roundBlurb(config.stars, config.vaccines, config.soaps);
      const actions = document.createElement('div');
      actions.className = 'score-flow-actions';
      const go = document.createElement('button');
      go.className = 'arcade-button';
      go.textContent = T.go;
      go.addEventListener('click', () => {
        this.card?.remove();
        this.card = null;
        this.phase = 'running';
        this.hint.textContent = pick(TEXT).vaccinateHint;
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
      const T = pick(TEXT);
      const heading = document.createElement('h2');
      heading.textContent = T.roundOver(T.roundNames[ROUNDS[this.round].id]);
      const score = document.createElement('div');
      score.className = 'score-flow-score';
      score.textContent = T.savedOf(saved, AGENT_COUNT);
      const note = document.createElement('p');
      note.className = 'score-flow-prompt';
      note.textContent = saved > AGENT_COUNT * 0.7 ? T.greatContainment : T.ouchContainment;
      const actions = document.createElement('div');
      actions.className = 'score-flow-actions';
      const next = document.createElement('button');
      next.className = 'arcade-button';
      next.textContent = T.nextRound;
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
      gameId: 'outbreak',
      heading: T.allRoundsSurvived,
      score: this.totalSaved,
      scoreLabel: T.peopleSaved(this.totalSaved),
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
    this.sim.reset();
    this.sim.infectionRate = TOY_RATE;
    this.history = [];
    this.ripples = [];
    this.gameBar.classList.add('hidden');
    this.toyBar.classList.remove('hidden');
    this.toggle.element.classList.remove('hidden');
    this.setTool('infect');
    this.syncToySchoolButton();
    this.hint.textContent = pick(TEXT).clickToStart;
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

    const T = pick(TEXT);
    this.toyBar = document.createElement('div');
    this.toyBar.className = 'game-toolbar';
    add(this.toyBar, 'infect', '🦠', T.toolInfect, () => this.setTool('infect'));
    add(this.toyBar, 'toyVaccine', '💉', T.toolVaccinate, () => this.setTool('vaccine'));
    add(this.toyBar, 'toySoap', '🧼', T.toolSoap, () => this.setTool('soap'));
    add(this.toyBar, 'school', '🏫', T.closeSchool, () => {
      if (this.sim.schoolOpen) this.sim.closeSchool();
      else this.sim.schoolOpen = true;
      this.syncToySchoolButton();
    });
    add(this.toyBar, 'reset', '🧹', T.reset, () => {
      this.sim.reset();
      this.sim.infectionRate = TOY_RATE;
      this.history = [];
      this.ripples = [];
      this.syncToySchoolButton();
    });
    add(this.toyBar, 'challenge', '😷', T.challenge, () => this.startGame());

    this.gameBar = document.createElement('div');
    this.gameBar.className = 'game-toolbar hidden';
    add(this.gameBar, 'gameVaccine', '💉', T.toolVaccinate, () => this.setTool('vaccine'));
    add(this.gameBar, 'gameSoap', '🧼', T.toolSoap, () => this.setTool('soap'));
    add(this.gameBar, 'gameSchool', '🏫', T.closeSchool, () => {
      if (!this.schoolActionUsed && this.phase === 'running') {
        this.schoolActionUsed = true;
        this.sim.closeSchool();
        this.updateGameButtons();
      }
    });
    add(this.gameBar, 'stop', '⏹', T.stop, () => this.exitToToy());

    this.hud = document.createElement('div');
    this.hud.className = 'challenge-hud';
    this.hudCounts = document.createElement('span');
    this.hudGame = document.createElement('span');
    this.hud.append(this.hudCounts, this.hudGame);

    this.hint = document.createElement('p');
    this.hint.className = 'challenge-hint';

    this.toggle = delveToggle(() => (this.delve ? this.closeDelve() : this.openDelve()));
    this.host.overlay.append(this.toyBar, this.gameBar, this.hud, this.hint, this.toggle.element);
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
    const T = pick(TEXT);
    const label = this.buttons.school.querySelector('.tool-label')!;
    label.textContent = this.sim.schoolOpen ? T.closeSchool : T.openSchool;
    this.buttons.school.classList.toggle('active', !this.sim.schoolOpen);
  }

  private updateGameButtons(): void {
    const T = pick(TEXT);
    const vaccine = this.buttons.gameVaccine;
    vaccine.querySelector('.tool-label')!.textContent = T.vaccinateCount(this.vaccinesLeft);
    vaccine.disabled = this.vaccinesLeft === 0;
    const soap = this.buttons.gameSoap;
    soap.querySelector('.tool-label')!.textContent = T.soapCount(this.soapsLeft);
    soap.disabled = this.soapsLeft === 0;
    const school = this.buttons.gameSchool;
    school.querySelector('.tool-label')!.textContent = this.schoolActionUsed
      ? T.schoolClosed
      : T.closeSchool;
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
        ? pick(TEXT).hudRound(this.round + 1, ROUNDS.length, this.totalSaved)
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

    if (this.delve) {
      this.drawDelve(ctx, w, h);
      return;
    }

    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    this.drawCity(ctx);
    this.drawAgents(ctx);
    this.drawRipples(ctx);
    this.drawCurve(ctx);
  }

  // ---- delve illustrations (one per chapter, beside the shared panel) ----

  private drawDelve(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const panelW = Math.min(500, w * 0.46);
    const x0 = panelW + 30;
    const x1 = w - 30;
    this.delveCity = null;
    const chapter = this.delve?.chapter ?? 0;
    if (chapter === 0) this.drawDelveStates(ctx, x0, x1, h);
    else if (chapter === 1) this.drawDelveMiniCity(ctx, x0, x1, h);
    else if (chapter === 2) this.drawDelveTree(ctx, x0, x1, h);
    else if (chapter === 3) this.drawDelveCurves(ctx, x0, x1, h);
    else this.drawDelveHistory(ctx, x0, x1, h);
  }

  /** Chapter 1: the four SIR states as big labeled dots with live counts. */
  private drawDelveStates(ctx: CanvasRenderingContext2D, x0: number, x1: number, h: number): void {
    const T = pick(TEXT);
    const c = this.sim.counts;
    const rows: { key: string; color: string; name: string; desc: string; count: number }[] = [
      { key: 's', color: COLOR.s, name: T.stateSusceptible, desc: T.stateSusceptibleDesc, count: c.s },
      { key: 'i', color: COLOR.i, name: T.stateInfected, desc: T.stateInfectedDesc, count: c.i },
      { key: 'r', color: COLOR.r, name: T.stateRecovered, desc: T.stateRecoveredDesc, count: c.r },
      {
        key: 'v',
        color: COLOR.v,
        name: T.stateVaccinated,
        desc: T.stateVaccinatedDesc,
        count: c.vaccinated,
      },
    ];
    const rowH = 86;
    const top = h / 2 - rowH * 2.4;
    rows.forEach((row, i) => {
      const y = top + i * rowH + rowH / 2;
      if (row.key === 'i') {
        ctx.fillStyle = 'rgba(251, 95, 117, 0.12)';
        ctx.beginPath();
        ctx.arc(x0 + 44, y, 30 * (1 + 0.18 * Math.sin(this.time * 4)), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = row.color;
      ctx.beginPath();
      ctx.arc(x0 + 44, y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(238, 242, 255, 0.95)';
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(row.name, x0 + 88, y - 4);
      ctx.fillStyle = 'rgba(238, 242, 255, 0.6)';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText(row.desc, x0 + 88, y + 20);
      ctx.fillStyle = row.color;
      ctx.font = 'bold 38px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(String(row.count), x1 - 16, y + 12);
    });

    // S -> I -> R flow underneath.
    const flowY = top + rows.length * rowH + 64;
    const cx = (x0 + x1) / 2;
    const chips: { color: string; letter: string }[] = [
      { color: COLOR.s, letter: 'S' },
      { color: COLOR.i, letter: 'I' },
      { color: COLOR.r, letter: 'R' },
    ];
    const gap = 150;
    chips.forEach((chip, i) => {
      const x = cx + (i - 1) * gap;
      ctx.fillStyle = chip.color;
      ctx.beginPath();
      ctx.arc(x, flowY, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0b1020';
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(chip.letter, x, flowY + 1);
      ctx.textBaseline = 'alphabetic';
    });
    ctx.fillStyle = 'rgba(238, 242, 255, 0.7)';
    ctx.font = '22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('→', cx - gap / 2, flowY + 7);
    ctx.fillText('→', cx + gap / 2, flowY + 7);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(238, 242, 255, 0.55)';
    ctx.fillText(T.meetsSick, cx - gap / 2, flowY + 40);
    ctx.fillText(T.chanceBeta, cx - gap / 2, flowY + 56);
    ctx.fillText(T.getsBetter, cx + gap / 2, flowY + 40);
    ctx.fillText(T.rateGamma, cx + gap / 2, flowY + 56);
  }

  /** Chapter 2: the real city, live and clickable, scaled into the demo area. */
  private drawDelveMiniCity(
    ctx: CanvasRenderingContext2D,
    x0: number,
    x1: number,
    h: number,
  ): void {
    const dpr = this.host.dpr;
    const availW = x1 - x0;
    const availH = h - 150;
    const scale = Math.min(availW / CITY_W, availH / CITY_H);
    const ox = x0 + (availW - CITY_W * scale) / 2;
    const oy = 50 + (availH - CITY_H * scale) / 2;
    this.delveCity = { scale, ox, oy };

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ox - 8, oy - 8, CITY_W * scale + 16, CITY_H * scale + 16);

    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    this.drawCity(ctx);
    this.drawAgents(ctx);
    this.drawRipples(ctx);
    this.drawCurve(ctx);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = 'rgba(238, 242, 255, 0.75)';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pick(TEXT).liveClickToInfect, (x0 + x1) / 2, h - 56);
  }

  /** Chapter 3: the R0 infection tree for the current slider settings. */
  private drawDelveTree(ctx: CanvasRenderingContext2D, x0: number, x1: number, h: number): void {
    const T = pick(TEXT);
    const power = this.sim.infectionRate * this.sim.recoverTime;
    const R = Math.max(0, Math.min(4, power));
    const gens: number[] = [1];
    for (let k = 1; k <= 3; k++) gens.push(Math.min(36, Math.round(R ** k)));
    const colX = (k: number) => x0 + 70 + ((x1 - x0 - 140) * k) / 3;
    const cy = h * 0.42;
    const spread = h * 0.52;
    const dotY = (k: number, j: number): number => {
      const n = gens[k];
      return n <= 1 ? cy : cy - spread / 2 + (spread * j) / (n - 1);
    };

    // Links first, then dots on top.
    ctx.strokeStyle = 'rgba(251, 95, 117, 0.22)';
    ctx.lineWidth = 1.5;
    for (let k = 1; k <= 3; k++) {
      if (gens[k] === 0 || gens[k - 1] === 0) break;
      ctx.beginPath();
      for (let j = 0; j < gens[k]; j++) {
        const parent = Math.min(gens[k - 1] - 1, Math.floor((j * gens[k - 1]) / gens[k]));
        ctx.moveTo(colX(k - 1), dotY(k - 1, parent));
        ctx.lineTo(colX(k), dotY(k, j));
      }
      ctx.stroke();
    }
    const active = Math.floor(this.time * 1.4) % 4;
    for (let k = 0; k <= 3; k++) {
      const x = colX(k);
      for (let j = 0; j < gens[k]; j++) {
        const y = dotY(k, j);
        if (k === active) {
          ctx.fillStyle = 'rgba(251, 95, 117, 0.18)';
          ctx.beginPath();
          ctx.arc(x, y, 15, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = COLOR.i;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(238, 242, 255, 0.8)';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const capped = k > 0 && Math.round(R ** k) > 36;
      ctx.fillText(
        gens[k] === 0 ? T.fizzlesZero : `${capped ? '≈' : ''}${Math.round(R ** k)}`,
        x,
        cy + spread / 2 + 52,
      );
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(238, 242, 255, 0.5)';
      ctx.fillText(k === 0 ? T.patientZero : T.generation(k), x, cy + spread / 2 + 76);
    }

    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(238, 242, 255, 0.9)';
    ctx.textAlign = 'center';
    const verdict =
      power >= 1.3 ? T.spreadTakesOff : power <= 0.8 ? T.spreadFizzles : T.spreadKnifeEdge;
    ctx.fillText(T.spreadingPower(power.toFixed(1), verdict), (x0 + x1) / 2, 54);
  }

  /** Chapter 4: two live-computed SIR curves — do nothing vs use your tools. */
  private drawDelveCurves(ctx: CanvasRenderingContext2D, x0: number, x1: number, h: number): void {
    const T = pick(TEXT);
    const solve = (beta: number, gamma: number, s0: number): number[] => {
      let s = s0 * AGENT_COUNT;
      let i = 3;
      const out: number[] = [];
      for (let t = 0; t < 400; t++) {
        const inf = (beta * s * i) / AGENT_COUNT;
        s -= inf * 0.2;
        i += (inf - gamma * i) * 0.2;
        out.push(i);
      }
      return out;
    };
    const wild = solve(0.55, 1 / 7, 1);
    const tamed = solve(0.26, 1 / 7, 0.75);
    const peak = Math.max(...wild);
    const plotY0 = h * 0.2;
    const plotY1 = h * 0.78;
    const plotH = plotY1 - plotY0;
    const xAt = (t: number) => x0 + ((x1 - x0) * t) / 399;
    const yAt = (i: number) => plotY1 - (plotH * i) / peak;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, plotY1);
    ctx.lineTo(x1, plotY1);
    ctx.stroke();

    const band = (curve: number[], fill: string, stroke: string) => {
      ctx.beginPath();
      ctx.moveTo(x0, plotY1);
      curve.forEach((i, t) => ctx.lineTo(xAt(t), yAt(i)));
      ctx.lineTo(x1, plotY1);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      curve.forEach((i, t) => (t === 0 ? ctx.moveTo(xAt(t), yAt(i)) : ctx.lineTo(xAt(t), yAt(i))));
      ctx.stroke();
    };
    band(wild, 'rgba(251, 95, 117, 0.25)', COLOR.i);
    band(tamed, 'rgba(87, 217, 138, 0.25)', COLOR.v);

    // Hospital capacity line.
    const capY = yAt(peak * 0.42);
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.5)';
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, capY);
    ctx.lineTo(x1, capY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(238, 242, 255, 0.7)';
    ctx.font = '15px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(T.hospitalCapacity, x0 + 8, capY - 8);

    const wildPeakT = wild.indexOf(peak);
    ctx.fillStyle = COLOR.i;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(T.doNothing, xAt(wildPeakT), yAt(peak) - 14);
    const tamedPeak = Math.max(...tamed);
    ctx.fillStyle = COLOR.v;
    ctx.fillText(T.soapClosedVaccines, xAt(tamed.indexOf(tamedPeak)), yAt(tamedPeak) - 14);

    ctx.fillStyle = 'rgba(238, 242, 255, 0.6)';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(T.sickOverTime, (x0 + x1) / 2, plotY1 + 34);
  }

  /** Chapter 5: the city's own epidemic curve so far, drawn big. */
  private drawDelveHistory(ctx: CanvasRenderingContext2D, x0: number, x1: number, h: number): void {
    const y0 = h * 0.22;
    const y1 = h * 0.75;
    ctx.fillStyle = 'rgba(5, 8, 20, 0.5)';
    ctx.beginPath();
    ctx.roundRect(x0 - 16, y0 - 16, x1 - x0 + 32, y1 - y0 + 32, 16);
    ctx.fill();
    const T = pick(TEXT);
    const n = this.history.length;
    ctx.textAlign = 'center';
    if (n < 2) {
      ctx.fillStyle = 'rgba(238, 242, 255, 0.5)';
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillText(T.noOutbreakYet, (x0 + x1) / 2, (y0 + y1) / 2 - 16);
      ctx.fillText(T.closeScienceInfect, (x0 + x1) / 2, (y0 + y1) / 2 + 16);
      return;
    }
    const H = y1 - y0;
    const xAt = (k: number) => x0 + ((x1 - x0) * k) / (n - 1);
    const iTop = this.history.map((s) => y1 - (H * s.i) / AGENT_COUNT);
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
    band(() => y1, iTop, 'rgba(251, 95, 117, 0.85)');
    band((k) => iTop[k], rTop, 'rgba(141, 128, 184, 0.7)');
    band((k) => rTop[k], new Array<number>(n).fill(y0), 'rgba(157, 184, 216, 0.25)');
    ctx.fillStyle = 'rgba(238, 242, 255, 0.75)';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(T.cityEpidemicLive, (x0 + x1) / 2, y0 - 32);
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
      const T = pick(TEXT);
      ctx.fillStyle = 'rgba(238, 242, 255, 0.45)';
      ctx.font = '24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(T.epidemicCurveLine1, (X0 + X1) / 2, (Y0 + Y1) / 2 - 18);
      ctx.fillText(T.epidemicCurveLine2, (X0 + X1) / 2, (Y0 + Y1) / 2 + 18);
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
  title: { en: 'Outbreak!', nl: 'Uitbraak!', no: 'Utbrudd!' },
  scienceLine: {
    en: 'Our group has worked on simulating real epidemics — models like this (much bigger) help decide vaccinations and school closures in actual health policy.',
    nl: 'Onze groep werkt aan het simuleren van echte epidemieën — modellen zoals dit (veel groter) helpen bij besluiten over vaccinaties en schoolsluitingen in het echte gezondheidsbeleid.',
    no: 'Gruppen vår har jobbet med å simulere ekte epidemier — modeller som denne (mye større) hjelper med å bestemme vaksinering og skolestenging i ekte helsepolitikk.',
  },
  tileEmoji: '🦠',
  create: (host) => new OutbreakInstance(host),
};
