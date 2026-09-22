// Outbreak! — agent-based SIRD epidemic in a mini-city (Canvas 2D).
// Free play: click to start an outbreak, try the tools, watch the curve and
// the hospital. Nobody dies unless the URL has ?deaths.
// Challenge: three diseases; the score is lives saved compared with several
// do-nothing futures of the same town, simulated while the round's card is up.
import type { ArcadeGame, GameHost, GameInstance } from '../../shell/types';
import { scoreFlow, type ScoreFlowHandle } from '../../shell/scoreflow';
import { AGES, CITY_H, CITY_W, COLOR, MAP_W, OutbreakSim, TOY_DISEASE, type Age } from './sim';
import { BATCH_DOSES, Futures, ROUNDS, RoundRun, type RoundId } from './rounds';
import { drawScene, drawSickLines, type Ripple } from './render';
import {
  delvePanel,
  delveToggle,
  type DelveHandle,
  type DelveToggleHandle,
} from '../../shell/delve';
import { outbreakDelve, type OutbreakDelve } from './delve';
import { pick, fmtNumber, type Localized } from '../../lib/i18n';
import './style.css';

/** Free play uses the full model (people can die) only with ?deaths in the URL. */
const TOY_DEATHS = new URLSearchParams(location.search).has('deaths');
/** Do-nothing futures simulated per challenge round. */
const FUTURES = 8;
/** Milliseconds per frame spent simulating futures. */
const FUTURES_BUDGET_MS = 5;
/** Quiet spells (few sick people) run this many times faster. */
const QUIET_SPEEDUP = 3;
const QUIET_BELOW = 6;

/** Contagious and serious ratings per round, out of three. */
const RATINGS: Record<RoundId, [number, number]> = {
  flu: [2, 2],
  fever: [3, 2],
  unknown: [2, 3],
};

const TEXT: Localized<{
  clickToStart: string;
  fizzled: string;
  outbreakOver: string;
  toolInfect: string;
  toolVaccinate: string;
  toolSoap: string;
  closeSchool: string;
  openSchool: string;
  closeMarket: string;
  openMarket: string;
  reset: string;
  challenge: string;
  stop: string;
  groups: Record<Age, string>;
  roundOf: (round: number, total: number) => string;
  roundNames: Record<RoundId, string>;
  roundBlurbs: Record<RoundId, string>;
  contagious: string;
  serious: string;
  toolsIntro: string;
  vaccineNow: (n: number, doses: number) => string;
  vaccineLater: (day: number, doses: number) => string;
  closing: (days: number) => string;
  futuresRunning: (done: number, total: number) => string;
  futuresReady: (total: number) => string;
  go: string;
  hintArrived: string;
  hintImported: string;
  hintBatch: string;
  hintNoClosure: string;
  hintVaccinated: (n: number, group: string) => string;
  hudRound: (round: number, total: number, name: string) => string;
  hudClosure: (days: number) => string;
  hudSaved: (n: number) => string;
  hudQuiet: string;
  roundOver: (name: string) => string;
  withoutYou: (mean: number, lo: number, hi: number, runs: number) => string;
  withYou: (n: number) => string;
  saved: (n: number) => string;
  notSaved: string;
  chartCaption: string;
  tips: Record<RoundId, string>;
  nextRound: string;
  seeScore: string;
  finalHeading: string;
  livesSaved: (n: number) => string;
  playAgain: string;
  freePlay: string;
  scienceHeading: string;
}> = {
  en: {
    clickToStart: 'Click anywhere in town to start an outbreak! 🦠',
    fizzled: '💨 It died out by chance — that happens with real outbreaks too. Click to try again!',
    outbreakOver: 'The outbreak is over. Try the tools, or 🧹 reset for a fresh town.',
    toolInfect: 'Infect',
    toolVaccinate: 'Vaccinate',
    toolSoap: 'Soap',
    closeSchool: 'Close school',
    openSchool: 'Open school',
    closeMarket: 'Close market',
    openMarket: 'Open market',
    reset: 'Reset',
    challenge: 'Challenge',
    stop: 'Stop',
    groups: { elder: 'Grandparents', adult: 'Parents', kid: 'Kids' },
    roundOf: (round, total) => `Round ${round} of ${total}`,
    roundNames: {
      flu: 'Winter flu 🤧',
      fever: 'Racing fever 🥵',
      unknown: 'Unknown virus ❓',
    },
    roundBlurbs: {
      flu: 'It spreads steadily. Most people are better in a week, but for grandparents it can be dangerous.',
      fever: 'Very contagious: it races through town and can fill the hospital fast.',
      unknown: 'A new virus, serious for everyone. Scientists are still making a vaccine.',
    },
    contagious: 'Contagious',
    serious: 'Serious',
    toolsIntro: 'Your tools:',
    vaccineNow: (n, doses) =>
      `💉 ${n > 1 ? `${n} vaccine batches (${doses} people each)` : `a vaccine batch (${doses} people)`}, ready now`,
    vaccineLater: (day, doses) => `💉 a vaccine batch (${doses} people) on day ${day}`,
    closing: (days) =>
      `🏫🛒 ${days} days of closing the school or the market (closing both uses two a day)`,
    futuresRunning: (done, total) =>
      `💻 Simulating this town ${total} times without you… ${done}/${total}`,
    futuresReady: (total) => `💻 ${total} futures without you: ready to compare.`,
    go: '▶ GO!',
    hintArrived: 'Sick travellers have arrived in town…',
    hintImported: 'Another sick traveller arrived.',
    hintBatch: '💉 A vaccine batch has arrived — who should get it?',
    hintNoClosure: 'No closing days left — everything is open again.',
    hintVaccinated: (n, group) => `💉 ${n} ${group.toLowerCase()} are now protected.`,
    hudRound: (round, total, name) => `Round ${round}/${total} · ${name}`,
    hudClosure: (days) => `🔒 ${days} closing days left`,
    hudSaved: (n) => `saved so far: ${n}`,
    hudQuiet: '⏩',
    roundOver: (name) => `${name} is over`,
    withoutYou: (mean, lo, hi, runs) =>
      `Without you: about ${mean} people died (${lo}–${hi} in ${runs} simulated futures)`,
    withYou: (n) => `With you: ${n} died`,
    saved: (n) => `You saved about ${n} ${n === 1 ? 'life' : 'lives'}`,
    notSaved: 'This time it went no better than doing nothing. Try another plan!',
    chartCaption: 'Sick people, day by day — grey: the town without you; red: your town',
    tips: {
      flu: 'Tip: this flu is mostly dangerous for grandparents. Protecting them directly saves the most lives.',
      fever: 'Tip: closing when the wave is building up — not at the very first case — keeps the hospital from overflowing.',
      unknown: 'Tip: closing early buys time until the vaccine arrives.',
    },
    nextRound: '▶ Next round',
    seeScore: '🏁 Your score',
    finalHeading: '🏁 Challenge complete!',
    livesSaved: (n) => `${fmtNumber(n)} ${n === 1 ? 'life' : 'lives'} saved`,
    playAgain: '🔁 Play again',
    freePlay: '🦠 Free play',
    scienceHeading: '🔬 The science of Outbreak!',
  },
  nl: {
    clickToStart: 'Klik ergens in de stad om een uitbraak te starten! 🦠',
    fizzled: '💨 Toevallig uitgedoofd — dat gebeurt bij echte uitbraken ook. Klik om het nog eens te proberen!',
    outbreakOver: 'De uitbraak is voorbij. Probeer de hulpmiddelen, of 🧹 begin opnieuw met een frisse stad.',
    toolInfect: 'Besmetten',
    toolVaccinate: 'Vaccineren',
    toolSoap: 'Zeep',
    closeSchool: 'School dicht',
    openSchool: 'School open',
    closeMarket: 'Markt dicht',
    openMarket: 'Markt open',
    reset: 'Opnieuw',
    challenge: 'Uitdaging',
    stop: 'Stop',
    groups: { elder: 'Opa’s & oma’s', adult: 'Ouders', kid: 'Kinderen' },
    roundOf: (round, total) => `Ronde ${round} van ${total}`,
    roundNames: {
      flu: 'Wintergriep 🤧',
      fever: 'Razende koorts 🥵',
      unknown: 'Onbekend virus ❓',
    },
    roundBlurbs: {
      flu: 'Verspreidt zich gestaag. De meeste mensen zijn binnen een week beter, maar voor opa’s en oma’s kan het gevaarlijk zijn.',
      fever: 'Heel besmettelijk: raast door de stad en kan het ziekenhuis snel vullen.',
      unknown: 'Een nieuw virus, ernstig voor iedereen. Wetenschappers maken nog een vaccin.',
    },
    contagious: 'Besmettelijk',
    serious: 'Ernstig',
    toolsIntro: 'Jouw hulpmiddelen:',
    vaccineNow: (n, doses) =>
      `💉 ${n > 1 ? `${n} partijen vaccin (${doses} mensen per partij)` : `een partij vaccin (${doses} mensen)`}, nu klaar`,
    vaccineLater: (day, doses) => `💉 een partij vaccin (${doses} mensen) op dag ${day}`,
    closing: (days) =>
      `🏫🛒 ${days} dagen om de school of de markt te sluiten (allebei dicht kost twee per dag)`,
    futuresRunning: (done, total) =>
      `💻 De computer simuleert deze stad ${total} keer zonder jou… ${done}/${total}`,
    futuresReady: (total) => `💻 ${total} toekomsten zonder jou: klaar om te vergelijken.`,
    go: '▶ START!',
    hintArrived: 'Er zijn zieke reizigers in de stad aangekomen…',
    hintImported: 'Er is weer een zieke reiziger aangekomen.',
    hintBatch: '💉 Er is een partij vaccin aangekomen — wie krijgt het?',
    hintNoClosure: 'Geen sluitingsdagen meer — alles is weer open.',
    hintVaccinated: (n, group) => `💉 ${n} ${group.toLowerCase()} zijn nu beschermd.`,
    hudRound: (round, total, name) => `Ronde ${round}/${total} · ${name}`,
    hudClosure: (days) => `🔒 nog ${days} sluitingsdagen`,
    hudSaved: (n) => `tot nu toe gered: ${n}`,
    hudQuiet: '⏩',
    roundOver: (name) => `${name} is voorbij`,
    withoutYou: (mean, lo, hi, runs) =>
      `Zonder jou: ongeveer ${mean} mensen overleden (${lo}–${hi} in ${runs} gesimuleerde toekomsten)`,
    withYou: (n) => `Met jou: ${n} overleden`,
    saved: (n) => `Je hebt ongeveer ${n} ${n === 1 ? 'leven' : 'levens'} gered`,
    notSaved: 'Deze keer ging het niet beter dan niets doen. Probeer een ander plan!',
    chartCaption: 'Zieke mensen, dag na dag — grijs: de stad zonder jou; rood: jouw stad',
    tips: {
      flu: 'Tip: deze griep is vooral gevaarlijk voor opa’s en oma’s. Hen direct beschermen redt de meeste levens.',
      fever: 'Tip: sluiten als de golf aan het opbouwen is — niet al bij het allereerste geval — houdt het ziekenhuis uit de problemen.',
      unknown: 'Tip: vroeg sluiten koopt tijd tot het vaccin er is.',
    },
    nextRound: '▶ Volgende ronde',
    seeScore: '🏁 Jouw score',
    finalHeading: '🏁 Uitdaging voltooid!',
    livesSaved: (n) => `${fmtNumber(n)} ${n === 1 ? 'leven' : 'levens'} gered`,
    playAgain: '🔁 Nog een keer',
    freePlay: '🦠 Vrij spelen',
    scienceHeading: '🔬 De wetenschap achter Uitbraak!',
  },
  no: {
    clickToStart: 'Klikk hvor som helst i byen for å starte et utbrudd! 🦠',
    fizzled: '💨 Det døde ut av seg selv — det skjer med ekte utbrudd også. Klikk for å prøve igjen!',
    outbreakOver: 'Utbruddet er over. Prøv verktøyene, eller 🧹 nullstill for en ny by.',
    toolInfect: 'Smitt',
    toolVaccinate: 'Vaksiner',
    toolSoap: 'Såpe',
    closeSchool: 'Steng skolen',
    openSchool: 'Åpne skolen',
    closeMarket: 'Steng torget',
    openMarket: 'Åpne torget',
    reset: 'Nullstill',
    challenge: 'Utfordring',
    stop: 'Stopp',
    groups: { elder: 'Besteforeldre', adult: 'Foreldre', kid: 'Barn' },
    roundOf: (round, total) => `Runde ${round} av ${total}`,
    roundNames: {
      flu: 'Vinterinfluensa 🤧',
      fever: 'Rasende feber 🥵',
      unknown: 'Ukjent virus ❓',
    },
    roundBlurbs: {
      flu: 'Sprer seg jevnt og trutt. De fleste er friske igjen etter en uke, men for besteforeldre kan den være farlig.',
      fever: 'Svært smittsom: den raser gjennom byen og kan fylle sykehuset fort.',
      unknown: 'Et nytt virus, alvorlig for alle. Forskerne holder fortsatt på å lage en vaksine.',
    },
    contagious: 'Smittsom',
    serious: 'Alvorlig',
    toolsIntro: 'Verktøyene dine:',
    vaccineNow: (n, doses) =>
      `💉 ${n > 1 ? `${n} vaksineleveranser (${doses} personer hver)` : `én vaksineleveranse (${doses} personer)`}, klar nå`,
    vaccineLater: (day, doses) => `💉 én vaksineleveranse (${doses} personer) på dag ${day}`,
    closing: (days) =>
      `🏫🛒 ${days} dager med stengt skole eller torg (begge stengt bruker to per dag)`,
    futuresRunning: (done, total) =>
      `💻 Datamaskinen simulerer byen ${total} ganger uten deg… ${done}/${total}`,
    futuresReady: (total) => `💻 ${total} fremtider uten deg: klare til å sammenligne.`,
    go: '▶ KJØR!',
    hintArrived: 'Syke reisende har kommet til byen…',
    hintImported: 'Enda en syk reisende har kommet.',
    hintBatch: '💉 En vaksineleveranse har kommet — hvem skal få den?',
    hintNoClosure: 'Ingen stengedager igjen — alt er åpent igjen.',
    hintVaccinated: (n, group) => `💉 ${n} ${group.toLowerCase()} er nå beskyttet.`,
    hudRound: (round, total, name) => `Runde ${round}/${total} · ${name}`,
    hudClosure: (days) => `🔒 ${days} stengedager igjen`,
    hudSaved: (n) => `reddet så langt: ${n}`,
    hudQuiet: '⏩',
    roundOver: (name) => `${name} er over`,
    withoutYou: (mean, lo, hi, runs) =>
      `Uten deg: omtrent ${mean} døde (${lo}–${hi} i ${runs} simulerte fremtider)`,
    withYou: (n) => `Med deg: ${n} døde`,
    saved: (n) => `Du reddet omtrent ${n} liv`,
    notSaved: 'Denne gangen gikk det ikke bedre enn å gjøre ingenting. Prøv en annen plan!',
    chartCaption: 'Syke, dag for dag — grått: byen uten deg; rødt: byen din',
    tips: {
      flu: 'Tips: denne influensaen er mest farlig for besteforeldre. Å beskytte dem direkte redder flest liv.',
      fever: 'Tips: å stenge mens bølgen bygger seg opp — ikke allerede ved det aller første tilfellet — hindrer at sykehuset renner over.',
      unknown: 'Tips: å stenge tidlig kjøper tid til vaksinen kommer.',
    },
    nextRound: '▶ Neste runde',
    seeScore: '🏁 Poengsummen din',
    finalHeading: '🏁 Utfordringen er fullført!',
    livesSaved: (n) => `${fmtNumber(n)} liv reddet`,
    playAgain: '🔁 Spill igjen',
    freePlay: '🦠 Fri lek',
    scienceHeading: '🔬 Vitenskapen bak Utbrudd!',
  },
};

type Tool = 'infect' | 'vaccine' | 'soap';
type GamePhase = 'intro' | 'running' | 'summary';

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

class OutbreakInstance implements GameInstance {
  private sim = new OutbreakSim();
  private ctx!: CanvasRenderingContext2D;
  private mode: 'toy' | 'game' = 'toy';
  private tool: Tool = 'infect';
  private time = 0;
  private ripples: Ripple[] = [];

  private phase: GamePhase = 'intro';
  private round = 0;
  private run: RoundRun | null = null;
  private futures: Futures | null = null;
  private totalSaved = 0;
  private quiet = false;
  /** A free-play outbreak is under way (for the "it's over" hints). */
  private toyOutbreak = false;

  private toyBar!: HTMLElement;
  private gameBar!: HTMLElement;
  private hud!: HTMLElement;
  private hint!: HTMLElement;
  private card: HTMLElement | null = null;
  private futuresLine: HTMLElement | null = null;
  private flow: ScoreFlowHandle | null = null;
  private delve: DelveHandle | null = null;
  private delveContent: OutbreakDelve | null = null;
  private toggle!: DelveToggleHandle;
  private buttons: Record<string, HTMLButtonElement> = {};

  private onPointerDown = (e: PointerEvent) => {
    if (this.delve) {
      this.delveContent?.pointerDown(e, this.host.canvas.getBoundingClientRect());
      return;
    }
    const { x, y } = this.toVirtual(e);
    if (this.mode === 'toy') this.toyClick(x, y);
  };

  constructor(private host: GameHost) {
    this.sim.deaths = TOY_DEATHS;
  }

  start(): void {
    this.ctx = this.host.canvas.getContext('2d')!;
    this.buildUi();
    this.host.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.setTool('infect');
    this.syncToyVenueButtons();
    this.hint.textContent = pick(TEXT).clickToStart;
  }

  frame(dt: number): void {
    this.time += dt;
    for (const r of this.ripples) r.t += dt;
    this.ripples = this.ripples.filter((r) => r.t < 1);

    if (this.mode === 'toy') {
      this.sim.step(dt);
      if (this.toyOutbreak && this.sim.counts.i === 0) {
        this.toyOutbreak = false;
        const c = this.sim.counts;
        const everSick = c.r + c.d;
        this.hint.textContent = everSick < 10 ? pick(TEXT).fizzled : pick(TEXT).outbreakOver;
      }
    } else if (this.phase === 'running') this.stepRound(dt);
    if (this.futures && !this.futures.complete) {
      this.futures.work(FUTURES_BUDGET_MS);
      this.updateFuturesLine();
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
    this.delveContent = outbreakDelve(this.sim, {
      addRipple: (r) => this.ripples.push(r),
      ripples: () => this.ripples,
      showDeaths: () => this.sim.deaths,
    });
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
    this.delveContent?.dispose();
    this.delve = null;
    this.delveContent = null;
    this.toggle.setOpen(false);
    this.toyBar.classList.remove('hidden');
    this.hint.classList.remove('hidden');
    this.syncToyVenueButtons();
  }

  // ---- challenge flow ----

  private startGame(): void {
    this.flow?.dispose();
    this.flow = null;
    this.closeDelve();
    this.mode = 'game';
    this.round = 0;
    this.totalSaved = 0;
    this.toyBar.classList.add('hidden');
    this.gameBar.classList.remove('hidden');
    this.toggle.element.classList.add('hidden');
    this.showIntro();
  }

  private showIntro(): void {
    const round = ROUNDS[this.round];
    const seed = (Math.random() * 2 ** 32) >>> 0;
    this.sim = new OutbreakSim(seed, round.disease);
    this.run = new RoundRun(round, this.sim);
    // The same town, from the same starting point, with nobody intervening.
    this.futures = new Futures(
      Array.from(
        { length: FUTURES },
        (_, k) => new RoundRun(round, this.sim.clone((seed ^ 0x9e3779b9) + k * 7919)),
      ),
    );
    this.ripples = [];
    this.phase = 'intro';
    this.tool = 'vaccine';
    this.hint.textContent = '';
    this.updateGameButtons();

    const T = pick(TEXT);
    this.showCard((card) => {
      const heading = document.createElement('h2');
      heading.textContent = T.roundOf(this.round + 1, ROUNDS.length);
      const name = document.createElement('div');
      name.className = 'score-flow-score';
      name.textContent = T.roundNames[round.id];
      const [contagious, serious] = RATINGS[round.id];
      const rating = document.createElement('p');
      rating.className = 'outbreak-rating';
      rating.textContent = `${T.contagious} ${stars(contagious)}   ·   ${T.serious} ${stars(serious)}`;
      const blurb = document.createElement('p');
      blurb.className = 'score-flow-prompt';
      blurb.textContent = T.roundBlurbs[round.id];
      const tools = document.createElement('ul');
      tools.className = 'outbreak-tools';
      const now = round.batches.filter((d) => d === 0).length;
      const lines: string[] = [];
      if (now > 0) lines.push(T.vaccineNow(now, BATCH_DOSES));
      for (const day of round.batches.filter((d) => d > 0)) lines.push(T.vaccineLater(day, BATCH_DOSES));
      lines.push(T.closing(round.closureDays));
      for (const text of lines) {
        const li = document.createElement('li');
        li.textContent = text;
        tools.appendChild(li);
      }
      const toolsIntro = document.createElement('p');
      toolsIntro.className = 'outbreak-tools-intro';
      toolsIntro.textContent = T.toolsIntro;
      this.futuresLine = document.createElement('p');
      this.futuresLine.className = 'outbreak-futures';
      this.updateFuturesLine();
      const actions = document.createElement('div');
      actions.className = 'score-flow-actions';
      const go = document.createElement('button');
      go.className = 'arcade-button';
      go.textContent = T.go;
      go.addEventListener('click', () => {
        this.card?.remove();
        this.card = null;
        this.futuresLine = null;
        this.phase = 'running';
        this.updateGameButtons();
      });
      actions.appendChild(go);
      card.append(heading, name, rating, blurb, toolsIntro, tools, this.futuresLine, actions);
    });
  }

  private updateFuturesLine(): void {
    if (!this.futuresLine || !this.futures) return;
    const T = pick(TEXT);
    this.futuresLine.textContent = this.futures.complete
      ? T.futuresReady(FUTURES)
      : T.futuresRunning(this.futures.done, FUTURES);
  }

  private stepRound(dt: number): void {
    const run = this.run!;
    const T = pick(TEXT);
    const c = this.sim.counts;
    this.quiet = c.i + c.waiting < QUIET_BELOW;
    const steps = this.quiet ? QUIET_SPEEDUP : 1;
    for (let k = 0; k < steps && !run.finished; k++) {
      const hadClosure = run.closureLeft > 0;
      const { arrived, batches } = run.step(dt);
      if (arrived.length > 0) {
        for (const a of arrived) {
          this.ripples.push({ x: a.x, y: a.y, t: 0, color: COLOR.i });
        }
        this.hint.textContent = arrived.length > 1 ? T.hintArrived : T.hintImported;
      }
      if (batches > 0) {
        this.hint.textContent = T.hintBatch;
        this.updateGameButtons();
      }
      if (hadClosure && run.closureLeft === 0) {
        this.hint.textContent = T.hintNoClosure;
        this.updateGameButtons();
      }
    }
    if (run.finished) this.endRound();
  }

  private giveVaccine(age: Age): void {
    if (this.phase !== 'running' || !this.run) return;
    const got = this.run.vaccinate(age);
    if (!got) return;
    for (const a of got) this.ripples.push({ x: a.x, y: a.y, t: 0, color: COLOR.v, size: 26 });
    this.hint.textContent = pick(TEXT).hintVaccinated(got.length, pick(TEXT).groups[age]);
    this.updateGameButtons();
  }

  private toggleVenue(venue: number): void {
    if (this.mode === 'toy') {
      this.sim.setOpen(venue, !this.sim.isOpen(venue));
      this.syncToyVenueButtons();
      return;
    }
    if (this.phase !== 'running' || !this.run) return;
    this.run.toggle(venue);
    this.updateGameButtons();
  }

  private endRound(): void {
    const futures = this.futures!;
    if (!futures.complete) futures.work(Infinity);
    const round = ROUNDS[this.round];
    const baseline = futures.deaths();
    const mean = baseline.reduce((a, b) => a + b, 0) / baseline.length;
    const yours = this.sim.counts.d;
    const saved = Math.round(mean - yours);
    this.totalSaved += Math.max(0, saved);
    this.phase = 'summary';
    this.hint.textContent = '';
    this.updateGameButtons();

    const T = pick(TEXT);
    this.showCard((card) => {
      card.classList.add('outbreak-summary');
      const heading = document.createElement('h2');
      heading.textContent = T.roundOver(T.roundNames[round.id]);
      const score = document.createElement('div');
      score.className = 'score-flow-score';
      score.textContent = saved > 0 ? T.saved(saved) : '—';
      const lines = document.createElement('p');
      lines.className = 'score-flow-prompt';
      lines.append(
        T.withoutYou(
          Math.round(mean),
          Math.min(...baseline),
          Math.max(...baseline),
          baseline.length,
        ),
        document.createElement('br'),
        T.withYou(yours),
      );
      if (saved <= 0) {
        lines.append(document.createElement('br'), T.notSaved);
      }
      const chart = this.summaryChart(futures, round.lastDay);
      const caption = document.createElement('p');
      caption.className = 'outbreak-caption';
      caption.textContent = T.chartCaption;
      const tip = document.createElement('p');
      tip.className = 'outbreak-tip';
      tip.textContent = T.tips[round.id];
      const actions = document.createElement('div');
      actions.className = 'score-flow-actions';
      const next = document.createElement('button');
      next.className = 'arcade-button';
      const last = this.round >= ROUNDS.length - 1;
      next.textContent = last ? T.seeScore : T.nextRound;
      next.addEventListener('click', () => {
        if (last) this.finishGame();
        else {
          this.round++;
          this.showIntro();
        }
      });
      actions.appendChild(next);
      card.append(heading, score, lines, chart, caption, tip, actions);
    });
  }

  /** The player's sick curve over the do-nothing futures, as a small canvas. */
  private summaryChart(futures: Futures, lastDay: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.className = 'outbreak-chart';
    const w = 520;
    const h = 170;
    const dpr = this.host.dpr;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    drawSickLines(
      ctx,
      { x: 6, y: 8, w: w - 12, h: h - 34 },
      [0, lastDay],
      futures.runs.map((r) => r.sim.history),
      this.sim.history,
    );
    return canvas;
  }

  private finishGame(): void {
    this.card?.remove();
    this.card = null;
    this.flow?.dispose();
    const T = pick(TEXT);
    this.flow = scoreFlow({
      gameId: 'outbreak',
      heading: T.finalHeading,
      score: this.totalSaved,
      scoreLabel: T.livesSaved(this.totalSaved),
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
    this.run = null;
    this.futures = null;
    this.sim = new OutbreakSim();
    this.sim.deaths = TOY_DEATHS;
    this.ripples = [];
    this.gameBar.classList.add('hidden');
    this.toyBar.classList.remove('hidden');
    this.toggle.element.classList.remove('hidden');
    this.setTool('infect');
    this.syncToyVenueButtons();
    this.hint.textContent = pick(TEXT).clickToStart;
  }

  // ---- input ----

  private toyClick(x: number, y: number): void {
    if (x > MAP_W) return;
    if (this.tool === 'infect') {
      const agent = this.sim.infectNearest(x, y);
      if (agent) {
        this.ripples.push({ x: agent.x, y: agent.y, t: 0, color: COLOR.i });
        this.hint.textContent = '';
        this.toyOutbreak = true;
      }
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
    add(this.toyBar, 'toySchool', '🏫', T.closeSchool, () => this.toggleVenue(0));
    add(this.toyBar, 'toyMarket', '🛒', T.closeMarket, () => this.toggleVenue(1));
    add(this.toyBar, 'reset', '🧹', T.reset, () => {
      this.sim.disease = { ...TOY_DISEASE };
      this.sim.reset();
      this.ripples = [];
      this.toyOutbreak = false;
      this.syncToyVenueButtons();
      this.hint.textContent = pick(TEXT).clickToStart;
    });
    add(this.toyBar, 'challenge', '😷', T.challenge, () => this.startGame());

    this.gameBar = document.createElement('div');
    this.gameBar.className = 'game-toolbar hidden';
    const ageEmoji: Record<Age, string> = { elder: '👵', adult: '🧑', kid: '🧒' };
    for (const age of [...AGES].reverse()) {
      add(this.gameBar, `vac-${age}`, ageEmoji[age], `💉 ${T.groups[age]}`, () =>
        this.giveVaccine(age),
      );
    }
    add(this.gameBar, 'gameSchool', '🏫', T.closeSchool, () => this.toggleVenue(0));
    add(this.gameBar, 'gameMarket', '🛒', T.closeMarket, () => this.toggleVenue(1));
    add(this.gameBar, 'stop', '⏹', T.stop, () => this.exitToToy());

    this.hud = document.createElement('div');
    this.hud.className = 'challenge-hud hidden';

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
  }

  private setLabel(button: HTMLButtonElement, text: string): void {
    button.querySelector('.tool-label')!.textContent = text;
  }

  private syncToyVenueButtons(): void {
    const T = pick(TEXT);
    const school = this.buttons.toySchool;
    const market = this.buttons.toyMarket;
    this.setLabel(school, this.sim.schoolOpen ? T.closeSchool : T.openSchool);
    school.classList.toggle('active', !this.sim.schoolOpen);
    this.setLabel(market, this.sim.marketOpen ? T.closeMarket : T.openMarket);
    market.classList.toggle('active', !this.sim.marketOpen);
  }

  private updateGameButtons(): void {
    const run = this.run;
    if (!run) return;
    const T = pick(TEXT);
    const running = this.phase === 'running';
    for (const age of AGES) {
      const b = this.buttons[`vac-${age}`];
      const ready = run.batchesReady;
      this.setLabel(b, `💉 ${T.groups[age]}${ready > 1 ? ` ×${ready}` : ''}`);
      b.disabled = !running || ready === 0;
      b.classList.toggle('ready', running && ready > 0);
    }
    const venues: [string, number, string, string][] = [
      ['gameSchool', 0, T.closeSchool, T.openSchool],
      ['gameMarket', 1, T.closeMarket, T.openMarket],
    ];
    for (const [key, venue, close, open] of venues) {
      const b = this.buttons[key];
      const isOpen = this.sim.isOpen(venue);
      this.setLabel(b, isOpen ? close : open);
      b.classList.toggle('active', !isOpen);
      b.disabled = !running || (isOpen && run.closureLeft <= 0);
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
    const inGame = this.mode === 'game' && !this.delve;
    this.hud.classList.toggle('hidden', !inGame);
    if (!inGame || !this.run) return;
    const T = pick(TEXT);
    const round = ROUNDS[this.round];
    const parts = [
      T.hudRound(this.round + 1, ROUNDS.length, T.roundNames[round.id]),
      T.hudClosure(Math.ceil(this.run.closureLeft)),
      T.hudSaved(this.totalSaved),
    ];
    if (this.phase === 'running' && this.quiet) parts.push(T.hudQuiet);
    const text = parts.join('   ·   ');
    if (this.hud.textContent !== text) this.hud.textContent = text;
  }

  // ---- rendering ----

  private draw(): void {
    const ctx = this.ctx;
    const canvas = this.host.canvas;
    const dpr = this.host.dpr;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, w, h);

    if (this.delve && this.delveContent) {
      this.delveContent.draw(ctx, w, h, dpr, this.delve.chapter, this.time);
      return;
    }

    const scale = Math.min(w / CITY_W, h / CITY_H);
    const ox = (w - CITY_W * scale) / 2;
    const oy = (h - CITY_H * scale) / 2;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    const toy = this.mode === 'toy';
    drawScene(ctx, this.sim, this.ripples, {
      time: this.time,
      highlightHoods: toy && this.tool === 'vaccine',
      highlightVenues: toy && this.tool === 'soap',
      showDeaths: this.sim.deaths,
      lastDay: toy ? undefined : ROUNDS[this.round].lastDay,
    });
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
