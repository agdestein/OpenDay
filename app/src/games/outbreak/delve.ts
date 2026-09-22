// Delve chapters for Outbreak!, in the shared chaptered style (shell/delve.ts):
// text in the card on the left, one live illustration per chapter on the
// game's canvas. Two chapters run real experiments on the live city: the R₀
// lab measures R₀ by simulating one sick person in a healthy town many times,
// and the futures chapter runs the city eight times.
import type { DelveChapter } from '../../shell/delve';
import {
  AGE_SHARE,
  AGES,
  AGENT_COUNT,
  BEDS,
  CITY_H,
  CITY_W,
  COLOR,
  MAP_W,
  OutbreakSim,
  TOY_DISEASE,
} from './sim';
import { Futures, HEADLESS_DT, Horizon } from './rounds';
import {
  dayRange,
  drawHospitalChart,
  drawScene,
  drawSickLines,
  drawStackedChart,
  type Ripple,
} from './render';
import { pick, type Localized } from '../../lib/i18n';

export interface OutbreakDelve {
  chapters: DelveChapter[];
  /** Per-frame: keep the lab sliders in sync with outside sim changes. */
  update(): void;
  /** Draw the current chapter's illustration beside the panel. */
  draw(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dpr: number,
    chapter: number,
    time: number,
  ): void;
  pointerDown(e: PointerEvent, rect: DOMRect): void;
  dispose(): void;
}

const R0_RUNS = 40;
const FUTURE_RUNS = 8;
const FUTURE_DAYS = 60;
const WORK_MS = 6;

const TEXT: Localized<{
  chapterTitles: string[];
  chapterParagraphs: string[][];
  labTitle: string;
  contagiousness: string;
  timeSick: string;
  labNote: string;
  flattenExtras: string[];
  runAgain: string;
  states: { name: string; desc: string }[];
  meetsSick: string;
  getsBetter: string;
  dies: string;
  vaccine: string;
  liveClickToInfect: string;
  patientZero: string;
  generation: (k: number) => string;
  fizzlesZero: string;
  takesOff: string;
  fizzles: string;
  knifeEdge: string;
  measured: (r: string, verdict: string) => string;
  measuring: (done: number, total: number) => string;
  doNothing: string;
  fewerContacts: string;
  hospitalLine: string;
  died: (n: number) => string;
  sickOverTime: string;
  futuresRunning: (done: number, total: number) => string;
  futuresDied: (lo: number, hi: number) => string;
  futuresPeak: (lo: number, hi: number) => string;
  now: string;
  liveCurve: string;
  hospital: string;
}> = {
  en: {
    chapterTitles: [
      'Every dot is a person',
      'A tiny simulated town',
      'The magic number R₀',
      'Flatten the curve',
      'Many possible futures',
      'Where this is used for real',
    ],
    chapterParagraphs: [
      [
        'Every dot in the town is one simulated person, and its color is its state. Small dots are kids; dots with a pale ring are grandparents.',
        'This is the SIRD model: Susceptible → Infected → Recovered, or Died. The first version (SIR) was written down in 1927 and is still the backbone of disease modeling. Vaccination is the shortcut straight to safety, without ever being sick.',
        'The counts on the right are live: your town, right now.',
      ],
      [
        'This is an agent-based model: 500 simulated people living in families of kids, parents and grandparents. Kids go to school, parents to the market, grandparents mostly stay home. When a sick person is close to a healthy one, there is a small chance per day that the disease jumps over — more indoors, much less passing on the street.',
        'Some illnesses turn serious, mostly for grandparents. Serious cases need a hospital bed. The hospital has 8. When it is full, people wait at home, and without care more of them die.',
        'Nobody in the model “knows” there is an epidemic. The wave you see emerges from thousands of tiny encounters.',
        '👆 The town is live: click it to infect someone and watch the wave start while you read.',
      ],
      [
        'R₀ (“R-nought”) is how many people one sick person infects, on average, in a town where nobody is immune yet. Above 1, every case causes more cases and the epidemic explodes; below 1, it fizzles out. Seasonal flu is around 1.3; measles a terrifying 12–18.',
        'You cannot read R₀ off the model’s settings: it depends on how people live and meet. So we measure it, like a scientist would — by running an experiment many times: one sick person in a healthy town, counting how many they infect. Move a slider and the computer runs the experiment again.',
      ],
      [
        'For a whole country you can skip the individuals and track just the sizes of the groups with calculus:',
      ],
      [
        'Run the same town again and you get a different epidemic: who meets whom, and who catches it, is partly chance. So one simulation proves little.',
        'Scientists therefore run a model many times — an ensemble — and look at the spread of outcomes, just like a weather forecast. Right now the computer is running your town 8 times: from this moment if an epidemic is going on, otherwise from a fresh start with three sick travellers. The spread of the lines is the uncertainty.',
        'The challenge uses exactly this trick: while you read a round’s card, the computer simulates your town 8 times without you. Afterwards you see how many lives your choices saved compared with those futures.',
      ],
      [
        'Models like this — with millions of agents, real travel data and real hospital numbers — advised governments through COVID-19 (in the Netherlands: the RIVM), guide vaccination campaigns, and are used against measles, malaria and animal diseases.',
        'Researchers in CWI’s Scientific Computing group have worked on simulating real epidemics — including the hard part: how uncertainty in the inputs (how contagious is a new variant, really?) changes what a model can honestly tell a decision-maker.',
        'What this toy leaves out: real towns are much bigger; people are contagious before they feel sick; immunity fades; and our diseases are far deadlier than flu, on purpose, so a 500-person town can show the effect at all. Every model is a simplification — the craft is knowing which simplifications you can afford.',
      ],
    ],
    labTitle: '🧪 Experiment — wired into the town',
    contagiousness: '🦠 contagiousness β',
    timeSick: '⏱ days sick',
    labNote:
      'The sliders change the disease in the town, too. Close the science, infect someone and see if the measured R₀ was right!',
    flattenExtras: [
      'β is how contagious the disease is, γ how fast people get better (1/γ is the days sick), N is everyone, and f is the chance a case ends in death. f jumps up when more people need a hospital bed than there are beds — that is why the height of the curve matters, not just its size.',
      'Your tools are ways of pulling R below 1: 💉 vaccination moves people out of S before they are ever sick, 🧼 soap lowers β, and closing the 🏫 school or 🛒 market cuts how many people each person meets. When the world said “flatten the curve” in 2020, this is the picture it meant.',
    ],
    runAgain: '🔁 Run the futures again',
    states: [
      { name: 'Susceptible', desc: 'healthy — could still catch it' },
      { name: 'Vaccinated', desc: 'protected without getting sick' },
      { name: 'Infected', desc: 'sick and contagious' },
      { name: 'Recovered', desc: 'had it, now immune' },
      { name: 'Died', desc: 'did not survive the disease' },
    ],
    meetsSick: 'meets someone sick',
    getsBetter: 'gets better',
    dies: 'some serious cases',
    vaccine: 'vaccine',
    liveClickToInfect: '👆 live — click the town to infect someone',
    patientZero: 'patient zero',
    generation: (k) => `generation ${k}`,
    fizzlesZero: '0 💨',
    takesOff: '🔥 this one takes off',
    fizzles: '💨 this one fizzles out',
    knifeEdge: '⚖️ on a knife’s edge',
    measured: (r, verdict) => `measured R₀ ≈ ${r} — ${verdict}`,
    measuring: (done, total) => `🧪 running the experiment: ${done}/${total}`,
    doNothing: 'everyone meets as usual',
    fewerContacts: 'fewer contacts',
    hospitalLine: '🏥 more sick than the hospital can handle',
    died: (n) => `≈ ${n} died`,
    sickOverTime: 'sick people, day by day →',
    futuresRunning: (done, total) => `💻 running your town ${total} times: ${done}/${total}`,
    futuresDied: (lo, hi) => `died in these futures: ${lo} to ${hi}`,
    futuresPeak: (lo, hi) => `most sick at once: ${lo} to ${hi}`,
    now: 'now',
    liveCurve: 'your town’s epidemic — live',
    hospital: '🏥 hospital beds',
  },
  nl: {
    chapterTitles: [
      'Elke stip is een persoon',
      'Een piepkleine gesimuleerde stad',
      'Het magische getal R₀',
      'De curve afvlakken',
      'Veel mogelijke toekomsten',
      'Waar dit echt wordt gebruikt',
    ],
    chapterParagraphs: [
      [
        'Elke stip in de stad is één gesimuleerde persoon, en de kleur laat de status zien. Kleine stippen zijn kinderen; stippen met een lichte ring zijn opa’s en oma’s.',
        'Dit is het SIRD-model: Vatbaar → Besmet → Hersteld, of Overleden (Susceptible, Infected, Recovered, Died). De eerste versie (SIR) werd in 1927 opgeschreven en is nog steeds de basis van ziektemodellen. Vaccinatie is de snelweg direct naar veiligheid, zonder ooit ziek te worden.',
        'De aantallen rechts zijn live: jouw stad, op dit moment.',
      ],
      [
        'Dit is een agent-gebaseerd model: 500 gesimuleerde mensen in gezinnen met kinderen, ouders en opa’s en oma’s. Kinderen gaan naar school, ouders naar de markt, opa’s en oma’s blijven meestal thuis. Als een ziek persoon dicht bij een gezond persoon is, is er elke dag een kleine kans dat de ziekte overspringt — binnen meer, en veel minder als je elkaar op straat passeert.',
        'Soms wordt de ziekte ernstig, vooral voor opa’s en oma’s. Ernstig zieken hebben een ziekenhuisbed nodig. Het ziekenhuis heeft er 8. Als het vol is, wachten mensen thuis, en zonder zorg overlijden er meer.',
        'Niemand in het model “weet” dat er een epidemie is. De golf die je ziet ontstaat uit duizenden kleine ontmoetingen.',
        '👆 De stad is live: klik erin om iemand te besmetten en zie de golf beginnen terwijl je leest.',
      ],
      [
        'R₀ (“R-nul”) is hoeveel mensen één ziek persoon gemiddeld besmet, in een stad waar nog niemand immuun is. Boven de 1 zorgt elk geval voor nog meer gevallen en explodeert de epidemie; onder de 1 dooft hij uit. Seizoensgriep zit rond de 1,3; mazelen op een angstaanjagende 12–18.',
        'Je kunt R₀ niet zomaar aflezen uit de instellingen van het model: het hangt af van hoe mensen leven en elkaar ontmoeten. Dus meten we het, zoals een wetenschapper dat doet — door een experiment vaak te herhalen: één ziek persoon in een gezonde stad, en tellen hoeveel mensen die besmet. Verschuif een schuifje en de computer doet het experiment opnieuw.',
      ],
      [
        'Voor een heel land kun je de individuen overslaan en met calculus alleen de grootte van de groepen bijhouden:',
      ],
      [
        'Speel dezelfde stad nog een keer en je krijgt een andere epidemie: wie wie ontmoet, en wie de ziekte krijgt, is deels toeval. Eén simulatie bewijst dus weinig.',
        'Daarom draaien wetenschappers een model vaak — een ensemble — en kijken ze naar de spreiding van de uitkomsten, net als bij een weersverwachting. Nu draait de computer jouw stad 8 keer: vanaf dit moment als er een epidemie bezig is, en anders vanaf het begin met drie zieke reizigers. De spreiding van de lijnen is de onzekerheid.',
        'De uitdaging gebruikt precies deze truc: terwijl jij de kaart van een ronde leest, simuleert de computer je stad 8 keer zonder jou. Daarna zie je hoeveel levens jouw keuzes hebben gered vergeleken met die toekomsten.',
      ],
      [
        'Modellen zoals dit — met miljoenen agents, echte reisgegevens en echte ziekenhuiscijfers — adviseerden overheden tijdens COVID-19 (in Nederland: het RIVM), sturen vaccinatiecampagnes, en worden gebruikt tegen mazelen, malaria en dierziekten.',
        'Onderzoekers van de Scientific Computing-groep van het CWI werken aan het simuleren van echte epidemieën — inclusief het lastige deel: hoe onzekerheid in de invoer (hoe besmettelijk is een nieuwe variant, écht?) verandert wat een model een beleidsmaker eerlijk kan vertellen.',
        'Wat dit speelgoedmodel weglaat: echte steden zijn veel groter; mensen zijn al besmettelijk voordat ze zich ziek voelen; immuniteit neemt af; en onze ziektes zijn met opzet veel dodelijker dan griep, zodat een stadje van 500 mensen het effect überhaupt kan laten zien. Elk model is een vereenvoudiging — het vak is weten welke vereenvoudigingen je je kunt veroorloven.',
      ],
    ],
    labTitle: '🧪 Experiment — direct gekoppeld aan de stad',
    contagiousness: '🦠 besmettelijkheid β',
    timeSick: '⏱ dagen ziek',
    labNote:
      'De schuifjes veranderen ook de ziekte in de stad. Sluit de wetenschap, besmet iemand en kijk of de gemeten R₀ klopte!',
    flattenExtras: [
      'β is hoe besmettelijk de ziekte is, γ hoe snel mensen beter worden (1/γ is het aantal dagen ziek), N is iedereen, en f is de kans dat iemand overlijdt. f springt omhoog als meer mensen een ziekenhuisbed nodig hebben dan er bedden zijn — daarom telt de hoogte van de curve, niet alleen de grootte.',
      'Jouw hulpmiddelen zijn manieren om R onder de 1 te krijgen: 💉 vaccinatie haalt mensen uit S voordat ze ziek worden, 🧼 zeep verlaagt β, en het sluiten van de 🏫 school of de 🛒 markt vermindert hoeveel mensen iedereen ontmoet. Toen de wereld het in 2020 had over “de curve afvlakken”, was dit precies het plaatje.',
    ],
    runAgain: '🔁 Draai de toekomsten opnieuw',
    states: [
      { name: 'Vatbaar', desc: 'gezond — kan het nog krijgen' },
      { name: 'Gevaccineerd', desc: 'beschermd zonder ziek te worden' },
      { name: 'Besmet', desc: 'ziek en besmettelijk' },
      { name: 'Hersteld', desc: 'heeft het gehad, nu immuun' },
      { name: 'Overleden', desc: 'heeft de ziekte niet overleefd' },
    ],
    meetsSick: 'ontmoet iemand die ziek is',
    getsBetter: 'wordt beter',
    dies: 'sommige ernstige gevallen',
    vaccine: 'vaccin',
    liveClickToInfect: '👆 live — klik op de stad om iemand te besmetten',
    patientZero: 'patiënt nul',
    generation: (k) => `generatie ${k}`,
    fizzlesZero: '0 💨',
    takesOff: '🔥 deze gaat los',
    fizzles: '💨 deze dooft uit',
    knifeEdge: '⚖️ op het randje',
    measured: (r, verdict) => `gemeten R₀ ≈ ${r} — ${verdict}`,
    measuring: (done, total) => `🧪 het experiment loopt: ${done}/${total}`,
    doNothing: 'iedereen ontmoet elkaar zoals altijd',
    fewerContacts: 'minder contacten',
    hospitalLine: '🏥 meer zieken dan het ziekenhuis aankan',
    died: (n) => `≈ ${n} overleden`,
    sickOverTime: 'zieke mensen, dag na dag →',
    futuresRunning: (done, total) => `💻 je stad ${total} keer draaien: ${done}/${total}`,
    futuresDied: (lo, hi) => `overleden in deze toekomsten: ${lo} tot ${hi}`,
    futuresPeak: (lo, hi) => `de meeste zieken tegelijk: ${lo} tot ${hi}`,
    now: 'nu',
    liveCurve: 'de epidemie van jouw stad — live',
    hospital: '🏥 ziekenhuisbedden',
  },
  no: {
    chapterTitles: [
      'Hvert punkt er en person',
      'En liten simulert by',
      'Det magiske tallet R₀',
      'Flate ut kurven',
      'Mange mulige fremtider',
      'Hvor dette brukes i virkeligheten',
    ],
    chapterParagraphs: [
      [
        'Hvert punkt i byen er én simulert person, og fargen viser status. Små punkter er barn; punkter med en lys ring er besteforeldre.',
        'Dette er SIRD-modellen: Mottakelig → Smittet → Frisk igjen, eller Død (Susceptible, Infected, Recovered, Died). Den første versjonen (SIR) ble skrevet ned i 1927 og er fortsatt selve grunnmuren i sykdomsmodellering. Vaksinasjon er snarveien rett til trygghet, uten å noensinne bli syk.',
        'Tallene til høyre er live: byen din, akkurat nå.',
      ],
      [
        'Dette er en agentbasert modell: 500 simulerte mennesker i familier med barn, foreldre og besteforeldre. Barna går på skolen, foreldrene på torget, besteforeldrene er stort sett hjemme. Når en syk person er nær en frisk person, er det hver dag en liten sjanse for at sykdommen hopper over — mer innendørs, mye mindre når man passerer hverandre på gaten.',
        'Noen blir alvorlig syke, mest besteforeldre. De alvorlig syke trenger en sykehusseng. Sykehuset har 8. Når det er fullt, venter folk hjemme, og uten behandling dør flere.',
        'Ingen i modellen “vet” at det er en epidemi. Bølgen du ser oppstår fra tusenvis av små møter.',
        '👆 Byen er live: klikk i den for å smitte noen og se bølgen starte mens du leser.',
      ],
      [
        'R₀ (“R-null”) er hvor mange én syk person smitter i gjennomsnitt, i en by der ingen er immune ennå. Over 1 fører hvert tilfelle til enda flere, og epidemien eksploderer; under 1 dør den ut. Sesonginfluensa ligger rundt 1,3; meslinger på skremmende 12–18.',
        'Du kan ikke lese R₀ rett ut av modellens innstillinger: den avhenger av hvordan folk lever og møtes. Så vi måler den, slik en forsker ville gjort — ved å kjøre et eksperiment mange ganger: én syk person i en frisk by, og telle hvor mange den smitter. Flytt en glidebryter, og datamaskinen kjører eksperimentet på nytt.',
      ],
      [
        'For et helt land kan du hoppe over enkeltpersonene og bare følge størrelsen på gruppene med matematisk analyse:',
      ],
      [
        'Kjør den samme byen en gang til, og du får en annen epidemi: hvem som møter hvem, og hvem som blir smittet, er delvis tilfeldig. Én simulering beviser derfor lite.',
        'Derfor kjører forskere en modell mange ganger — et ensemble — og ser på spredningen i utfallene, akkurat som en værmelding. Akkurat nå kjører datamaskinen byen din 8 ganger: fra dette øyeblikket hvis en epidemi pågår, ellers fra start med tre syke reisende. Spredningen i linjene er usikkerheten.',
        'Utfordringen bruker nettopp dette trikset: mens du leser kortet for en runde, simulerer datamaskinen byen din 8 ganger uten deg. Etterpå ser du hvor mange liv valgene dine reddet sammenlignet med de fremtidene.',
      ],
      [
        'Modeller som denne — med millioner av agenter, ekte reisedata og ekte sykehustall — ga myndighetene råd gjennom covid-19 (i Nederland: RIVM), styrer vaksinasjonskampanjer, og brukes mot meslinger, malaria og dyresykdommer.',
        'Forskere i CWIs Scientific Computing-gruppe har jobbet med å simulere ekte epidemier — inkludert den vanskelige delen: hvordan usikkerhet i inndataene (hvor smittsom er egentlig en ny variant?) endrer hva en modell ærlig kan fortelle en beslutningstaker.',
        'Hva denne lekemodellen utelater: ekte byer er mye større; folk smitter før de føler seg syke; immunitet avtar; og sykdommene våre er med vilje mye dødeligere enn influensa, slik at en by med 500 mennesker i det hele tatt kan vise effekten. Enhver modell er en forenkling — håndverket er å vite hvilke forenklinger man har råd til.',
      ],
    ],
    labTitle: '🧪 Eksperiment — koblet rett til byen',
    contagiousness: '🦠 smittsomhet β',
    timeSick: '⏱ dager syk',
    labNote:
      'Glidebryterne endrer også sykdommen i byen. Lukk vitenskapen, smitt noen og se om den målte R₀ stemte!',
    flattenExtras: [
      'β er hvor smittsom sykdommen er, γ hvor fort folk blir friske (1/γ er antall dager syk), N er alle sammen, og f er sjansen for at et tilfelle ender med døden. f hopper opp når flere trenger en sykehusseng enn det finnes senger — derfor teller høyden på kurven, ikke bare størrelsen.',
      'Verktøyene dine er måter å dra R under 1 på: 💉 vaksinasjon flytter folk ut av S før de blir syke, 🧼 såpe senker β, og å stenge 🏫 skolen eller 🛒 torget kutter hvor mange hver person møter. Da verden snakket om å “flate ut kurven” i 2020, var det dette bildet det handlet om.',
    ],
    runAgain: '🔁 Kjør fremtidene på nytt',
    states: [
      { name: 'Mottakelig', desc: 'frisk — kan fortsatt bli smittet' },
      { name: 'Vaksinert', desc: 'beskyttet uten å bli syk' },
      { name: 'Smittet', desc: 'syk og smittsom' },
      { name: 'Frisk igjen', desc: 'har hatt det, nå immun' },
      { name: 'Død', desc: 'overlevde ikke sykdommen' },
    ],
    meetsSick: 'møter en som er syk',
    getsBetter: 'blir frisk',
    dies: 'noen alvorlige tilfeller',
    vaccine: 'vaksine',
    liveClickToInfect: '👆 live — klikk på byen for å smitte noen',
    patientZero: 'pasient null',
    generation: (k) => `generasjon ${k}`,
    fizzlesZero: '0 💨',
    takesOff: '🔥 denne tar av',
    fizzles: '💨 denne dør ut',
    knifeEdge: '⚖️ på knivseggen',
    measured: (r, verdict) => `målt R₀ ≈ ${r} — ${verdict}`,
    measuring: (done, total) => `🧪 eksperimentet kjører: ${done}/${total}`,
    doNothing: 'alle møtes som vanlig',
    fewerContacts: 'færre kontakter',
    hospitalLine: '🏥 flere syke enn sykehuset klarer',
    died: (n) => `≈ ${n} døde`,
    sickOverTime: 'syke, dag for dag →',
    futuresRunning: (done, total) => `💻 kjører byen din ${total} ganger: ${done}/${total}`,
    futuresDied: (lo, hi) => `døde i disse fremtidene: ${lo} til ${hi}`,
    futuresPeak: (lo, hi) => `flest syke samtidig: ${lo} til ${hi}`,
    now: 'nå',
    liveCurve: 'byens epidemi — live',
    hospital: '🏥 sykehussenger',
  },
};

/**
 * Measures R₀ the way the definition says: one sick adult in an otherwise
 * healthy town, counting how many people they infect, repeated many times.
 */
class R0Lab {
  results: number[] = [];
  private run: { sim: OutbreakSim; index: number } | null = null;
  private key = '';

  constructor(private sim: OutbreakSim) {}

  get done(): boolean {
    return this.results.length >= R0_RUNS;
  }

  get mean(): number {
    return this.results.length
      ? this.results.reduce((a, b) => a + b, 0) / this.results.length
      : 0;
  }

  work(budgetMs: number): void {
    const { beta, daysSick } = this.sim.disease;
    const key = `${beta}|${daysSick}`;
    if (key !== this.key) {
      this.key = key;
      this.results = [];
      this.run = null;
    }
    const until = performance.now() + budgetMs;
    while (!this.done && performance.now() < until) {
      if (!this.run) {
        const sim = new OutbreakSim(1234 + this.results.length * 7919, this.sim.disease);
        sim.deaths = false;
        for (let k = 0; k < 60; k++) sim.step(HEADLESS_DT); // let people spread out
        const [index] = sim.seedCases(1);
        this.run = { sim, index: index.id };
      }
      const { sim, index } = this.run;
      for (let k = 0; k < 20; k++) sim.step(HEADLESS_DT);
      const a = sim.agents[index];
      if (a.state !== 'I') {
        this.results.push(a.caused);
        this.run = null;
      }
    }
  }
}

export function outbreakDelve(
  sim: OutbreakSim,
  opts: {
    addRipple: (r: Ripple) => void;
    ripples: () => Ripple[];
    showDeaths: () => boolean;
  },
): OutbreakDelve {
  const T = pick(TEXT);
  const lab = new R0Lab(sim);
  let futures: Futures<Horizon> | null = null;
  let futuresFrom = 0;
  /** Where the live town was drawn in chapter 2 (for clicks). */
  let townBox: { scale: number; ox: number; oy: number } | null = null;

  let rateSlider: HTMLInputElement | null = null;
  let sickSlider: HTMLInputElement | null = null;
  let rateOut: HTMLElement | null = null;
  let sickOut: HTMLElement | null = null;

  const refreshLab = () => {
    if (rateOut) rateOut.textContent = sim.disease.beta.toFixed(2);
    if (sickOut) sickOut.textContent = sim.disease.daysSick.toFixed(1);
  };

  const startFutures = () => {
    // Mid-epidemic, run on from now; otherwise the same town from day 0, with
    // the same disease and three sick travellers arriving.
    const fromNow = sim.counts.i >= 20;
    futuresFrom = fromNow ? sim.day : 0;
    futures = new Futures(
      Array.from({ length: FUTURE_RUNS }, (_, k) => {
        const seed = ((Math.random() * 2 ** 32) >>> 0) + k;
        let copy: OutbreakSim;
        if (fromNow) copy = sim.clone(seed);
        else {
          copy = new OutbreakSim(seed, sim.disease);
          copy.deaths = sim.deaths;
          copy.seedCases(3);
        }
        return new Horizon(copy, futuresFrom + FUTURE_DAYS);
      }),
    );
  };

  const chapters: DelveChapter[] = T.chapterTitles.map((title, k) => ({
    title,
    paragraphs: T.chapterParagraphs[k],
  }));

  chapters[2].extras = (host: HTMLElement) => {
    const box = document.createElement('div');
    box.className = 'delve-lab';
    const heading = document.createElement('div');
    heading.className = 'delve-lab-title';
    heading.textContent = T.labTitle;
    box.appendChild(heading);
    const row = (
      label: string,
      min: number,
      max: number,
      step: number,
      value: number,
      onInput: (v: number) => void,
    ): { input: HTMLInputElement; output: HTMLElement } => {
      const div = document.createElement('div');
      div.className = 'delve-slider-row';
      div.append(label);
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(value);
      const output = document.createElement('output');
      input.addEventListener('input', () => {
        onInput(parseFloat(input.value));
        refreshLab();
      });
      div.append(input, output);
      box.appendChild(div);
      return { input, output };
    };
    const rate = row(T.contagiousness, 0.1, 1.6, 0.05, sim.disease.beta, (v) => {
      sim.disease.beta = v;
    });
    const sick = row(T.timeSick, 3, 14, 0.5, sim.disease.daysSick, (v) => {
      sim.disease.daysSick = v;
    });
    rateSlider = rate.input;
    rateOut = rate.output;
    sickSlider = sick.input;
    sickOut = sick.output;
    const note = document.createElement('p');
    note.className = 'delve-lab-note';
    note.textContent = T.labNote;
    box.appendChild(note);
    host.appendChild(box);
    refreshLab();
  };

  chapters[3].formula = 'S′ = −β·S·I/N\nI′ = β·S·I/N − γ·I\nR′ = (1 − f)·γ·I\nD′ = f·γ·I';
  chapters[3].extras = (host: HTMLElement) => {
    for (const text of T.flattenExtras) {
      const p = document.createElement('p');
      p.textContent = text;
      host.parentElement?.insertBefore(p, host);
    }
  };

  chapters[4].extras = (host: HTMLElement) => {
    const again = document.createElement('button');
    again.className = 'arcade-button';
    again.textContent = T.runAgain;
    again.addEventListener('click', startFutures);
    host.appendChild(again);
  };

  // ---- illustrations ----

  const text = (
    ctx: CanvasRenderingContext2D,
    s: string,
    x: number,
    y: number,
    font: string,
    color: string,
    align: CanvasTextAlign = 'center',
  ) => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
  };

  /** Chapter 1: the five states as big labeled dots with live counts, and the flow. */
  const drawStates = (ctx: CanvasRenderingContext2D, x0: number, x1: number, h: number, time: number) => {
    const c = sim.counts;
    const counts = [c.s, c.v, c.i, c.r, c.d];
    const colors = [COLOR.s, COLOR.v, COLOR.i, COLOR.r, COLOR.d];
    const rowH = 74;
    const top = h / 2 - rowH * 3.3;
    T.states.forEach((state, k) => {
      const y = top + k * rowH + rowH / 2;
      if (k === 2) {
        ctx.fillStyle = 'rgba(255, 90, 110, 0.12)';
        ctx.beginPath();
        ctx.arc(x0 + 44, y, 28 * (1 + 0.18 * Math.sin(time * 4)), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = colors[k];
      ctx.beginPath();
      ctx.arc(x0 + 44, y, 18, 0, Math.PI * 2);
      ctx.fill();
      text(ctx, state.name, x0 + 88, y - 4, 'bold 23px system-ui, sans-serif', 'rgba(238, 242, 255, 0.95)', 'left');
      text(ctx, state.desc, x0 + 88, y + 19, '16px system-ui, sans-serif', 'rgba(238, 242, 255, 0.6)', 'left');
      text(
        ctx,
        String(counts[k]),
        x1 - 16,
        y + 12,
        'bold 36px system-ui, sans-serif',
        k === 4 ? 'rgba(210, 215, 228, 0.95)' : colors[k],
        'right',
      );
    });

    // S → I → R, with I → D below and the vaccine shortcut S → V above.
    const flowY = top + 5 * rowH + 80;
    const cx = (x0 + x1) / 2;
    const gap = 170;
    const chip = (x: number, y: number, color: string, letter: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.textBaseline = 'middle';
      text(ctx, letter, x, y + 1, 'bold 22px system-ui, sans-serif', '#0b1020');
      ctx.textBaseline = 'alphabetic';
    };
    const arrow = (xa: number, ya: number, xb: number, yb: number) => {
      ctx.strokeStyle = 'rgba(238, 242, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xa, ya);
      ctx.lineTo(xb, yb);
      ctx.stroke();
      const ang = Math.atan2(yb - ya, xb - xa);
      ctx.beginPath();
      ctx.moveTo(xb, yb);
      ctx.lineTo(xb - 10 * Math.cos(ang - 0.4), yb - 10 * Math.sin(ang - 0.4));
      ctx.lineTo(xb - 10 * Math.cos(ang + 0.4), yb - 10 * Math.sin(ang + 0.4));
      ctx.closePath();
      ctx.fillStyle = 'rgba(238, 242, 255, 0.6)';
      ctx.fill();
    };
    const sx = cx - gap;
    const ix = cx;
    const rx = cx + gap;
    chip(sx, flowY, COLOR.s, 'S');
    chip(ix, flowY, COLOR.i, 'I');
    chip(rx, flowY, COLOR.r, 'R');
    chip(ix, flowY + 90, COLOR.d, 'D');
    chip(sx, flowY - 80, COLOR.v, 'V');
    arrow(sx + 26, flowY, ix - 28, flowY);
    arrow(ix + 26, flowY, rx - 28, flowY);
    arrow(ix, flowY + 26, ix, flowY + 62);
    arrow(sx, flowY - 26, sx, flowY - 54);
    const small = '14px system-ui, sans-serif';
    const dim = 'rgba(238, 242, 255, 0.6)';
    text(ctx, T.meetsSick, (sx + ix) / 2, flowY + 36, small, dim);
    text(ctx, T.getsBetter, (ix + rx) / 2, flowY + 36, small, dim);
    text(ctx, T.dies, ix + 34, flowY + 95, small, dim, 'left');
    text(ctx, T.vaccine, sx + 30, flowY - 36, small, dim, 'left');
  };

  /** Chapter 2: the whole live scene, scaled into the demo area; clickable. */
  const drawTown = (ctx: CanvasRenderingContext2D, x0: number, x1: number, h: number, dpr: number, time: number) => {
    const availW = x1 - x0;
    const availH = h - 140;
    const scale = Math.min(availW / CITY_W, availH / CITY_H);
    const ox = x0 + (availW - CITY_W * scale) / 2;
    const oy = 40 + (availH - CITY_H * scale) / 2;
    townBox = { scale, ox, oy };
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    drawScene(ctx, sim, opts.ripples(), {
      time,
      highlightHoods: false,
      highlightVenues: false,
      showDeaths: opts.showDeaths(),
    });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    text(ctx, T.liveClickToInfect, (x0 + x1) / 2, h - 60, 'bold 20px system-ui, sans-serif', 'rgba(238, 242, 255, 0.75)');
  };

  /** Chapter 3: the infection tree for the measured R₀. */
  const drawTree = (ctx: CanvasRenderingContext2D, x0: number, x1: number, h: number, time: number) => {
    lab.work(WORK_MS);
    const R = lab.mean;
    const shown = Math.min(4, R);
    const gens: number[] = [1];
    for (let k = 1; k <= 3; k++) gens.push(Math.min(36, Math.round(shown ** k)));
    const colX = (k: number) => x0 + 70 + ((x1 - x0 - 140) * k) / 3;
    const cy = h * 0.45;
    const spread = h * 0.5;
    const dotY = (k: number, j: number): number => {
      const n = gens[k];
      return n <= 1 ? cy : cy - spread / 2 + (spread * j) / (n - 1);
    };
    const alpha = lab.done ? 1 : 0.45;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(255, 90, 110, 0.22)';
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
    const active = Math.floor(time * 1.4) % 4;
    for (let k = 0; k <= 3; k++) {
      const x = colX(k);
      for (let j = 0; j < gens[k]; j++) {
        const y = dotY(k, j);
        if (k === active) {
          ctx.fillStyle = 'rgba(255, 90, 110, 0.18)';
          ctx.beginPath();
          ctx.arc(x, y, 15, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = COLOR.i;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      const n = Math.round(shown ** k);
      text(
        ctx,
        gens[k] === 0 ? T.fizzlesZero : `${n > 36 ? '≈' : ''}${n}`,
        x,
        cy + spread / 2 + 52,
        'bold 22px system-ui, sans-serif',
        'rgba(238, 242, 255, 0.8)',
      );
      text(
        ctx,
        k === 0 ? T.patientZero : T.generation(k),
        x,
        cy + spread / 2 + 76,
        '14px system-ui, sans-serif',
        'rgba(238, 242, 255, 0.5)',
      );
    }
    ctx.globalAlpha = 1;
    const verdict = R >= 1.2 ? T.takesOff : R <= 0.85 ? T.fizzles : T.knifeEdge;
    text(
      ctx,
      lab.done ? T.measured(R.toFixed(1), verdict) : T.measuring(lab.results.length, R0_RUNS),
      (x0 + x1) / 2,
      60,
      'bold 22px system-ui, sans-serif',
      'rgba(238, 242, 255, 0.9)',
    );
  };

  /** Chapter 4: SIRD equations with a hospital, two scenarios side by side. */
  const flatten = (() => {
    // Averages over ages, from the free-play disease.
    const dz = TOY_DISEASE;
    const pSerious = AGES.reduce((a, age) => a + AGE_SHARE[age] * dz.serious[age], 0);
    const weight = (age: (typeof AGES)[number]) => (AGE_SHARE[age] * dz.serious[age]) / pSerious;
    const dieInBed = AGES.reduce((a, age) => a + weight(age) * dz.dieInBed[age], 0);
    const dieNoBed = AGES.reduce((a, age) => a + weight(age) * dz.dieNoBed[age], 0);
    const gamma = 1 / dz.daysSick;
    // Serious cases need a bed for most of their illness.
    const capacity = BEDS / (0.7 * pSerious);
    const solve = (r0: number) => {
      const beta = r0 * gamma;
      let s = AGENT_COUNT - 3;
      let i = 3;
      let d = 0;
      const out: number[] = [];
      const dt = 0.1;
      for (let t = 0; t < 1200; t++) {
        const inf = (beta * s * i) / AGENT_COUNT;
        const bedShare = i > capacity ? capacity / i : 1;
        const f = pSerious * (dieInBed * bedShare + dieNoBed * (1 - bedShare));
        s -= inf * dt;
        d += f * gamma * i * dt;
        i += (inf - gamma * i) * dt;
        if (t % 5 === 0) out.push(i);
      }
      return { curve: out, died: Math.round(d) };
    };
    return { wild: solve(3), tamed: solve(1.5), capacity };
  })();

  const drawFlatten = (ctx: CanvasRenderingContext2D, x0: number, x1: number, h: number) => {
    const { wild, tamed, capacity } = flatten;
    const n = wild.curve.length;
    const peak = Math.max(...wild.curve);
    const plotY0 = h * 0.18;
    const plotY1 = h * 0.76;
    const plotH = plotY1 - plotY0;
    const xAt = (t: number) => x0 + ((x1 - x0) * t) / (n - 1);
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
    band(wild.curve, 'rgba(255, 90, 110, 0.25)', COLOR.i);
    band(tamed.curve, 'rgba(79, 208, 138, 0.25)', COLOR.v);
    const capY = yAt(capacity);
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.6)';
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, capY);
    ctx.lineTo(x1, capY);
    ctx.stroke();
    ctx.setLineDash([]);
    text(ctx, T.hospitalLine, x1 - 8, capY - 8, '17px system-ui, sans-serif', 'rgba(238, 242, 255, 0.75)', 'right');
    const label = (curve: number[], color: string, name: string, died: number) => {
      const p = Math.max(...curve);
      const x = xAt(curve.indexOf(p));
      text(ctx, name, x, yAt(p) - 40, 'bold 20px system-ui, sans-serif', color);
      text(ctx, T.died(died), x, yAt(p) - 14, 'bold 18px system-ui, sans-serif', color);
    };
    label(wild.curve, COLOR.i, T.doNothing, wild.died);
    label(tamed.curve, COLOR.v, T.fewerContacts, tamed.died);
    text(ctx, T.sickOverTime, (x0 + x1) / 2, plotY1 + 34, '16px system-ui, sans-serif', 'rgba(238, 242, 255, 0.6)');
  };

  /** Chapter 5: the live town run eight times (from now, or from a fresh start). */
  const drawFutures = (ctx: CanvasRenderingContext2D, x0: number, x1: number, h: number) => {
    if (!futures) startFutures();
    const f = futures!;
    f.work(WORK_MS);
    const box = { x: x0, y: h * 0.18, w: x1 - x0, h: h * 0.5 };
    const range: [number, number] = [Math.max(0, futuresFrom - 20), futuresFrom + FUTURE_DAYS];
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.fillRect(box.x, box.y, box.w, box.h);
    drawSickLines(ctx, box, range, f.runs.map((r) => r.sim.history));
    if (futuresFrom > 0) {
      const nowX = box.x + (box.w * (futuresFrom - range[0])) / (range[1] - range[0]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(nowX, box.y);
      ctx.lineTo(nowX, box.y + box.h);
      ctx.stroke();
      ctx.setLineDash([]);
      text(ctx, T.now, nowX, box.y - 10, 'bold 16px system-ui, sans-serif', 'rgba(238, 242, 255, 0.8)');
    }
    const y = box.y + box.h + 60;
    if (!f.complete) {
      text(ctx, T.futuresRunning(f.done, FUTURE_RUNS), (x0 + x1) / 2, y, 'bold 20px system-ui, sans-serif', 'rgba(238, 242, 255, 0.8)');
      return;
    }
    const sims = f.runs.map((r) => r.sim);
    const line = opts.showDeaths()
      ? T.futuresDied(Math.min(...sims.map((s) => s.counts.d)), Math.max(...sims.map((s) => s.counts.d)))
      : (() => {
          const peaks = sims.map((s) => Math.max(...s.history.filter((p) => p.day >= futuresFrom).map((p) => p.i)));
          return T.futuresPeak(Math.min(...peaks), Math.max(...peaks));
        })();
    text(ctx, line, (x0 + x1) / 2, y, 'bold 20px system-ui, sans-serif', 'rgba(238, 242, 255, 0.85)');
  };

  /** Chapter 6: the town's own epidemic so far, drawn big. */
  const drawLive = (ctx: CanvasRenderingContext2D, x0: number, x1: number, h: number) => {
    const range = dayRange(sim);
    text(ctx, T.liveCurve, (x0 + x1) / 2, h * 0.14, 'bold 20px system-ui, sans-serif', 'rgba(238, 242, 255, 0.75)');
    drawStackedChart(ctx, sim.history, { x: x0, y: h * 0.18, w: x1 - x0, h: h * 0.42 }, range, sim.day);
    text(ctx, T.hospital, x0, h * 0.67, 'bold 18px system-ui, sans-serif', 'rgba(238, 242, 255, 0.6)', 'left');
    drawHospitalChart(ctx, sim.history, { x: x0, y: h * 0.69, w: x1 - x0, h: h * 0.2 }, range);
  };

  return {
    chapters,
    update() {
      // Follow outside changes to the sim (reset button) without fighting a
      // slider the reader is currently dragging.
      if (rateSlider && document.activeElement !== rateSlider) {
        rateSlider.value = String(sim.disease.beta);
      }
      if (sickSlider && document.activeElement !== sickSlider) {
        sickSlider.value = String(sim.disease.daysSick);
      }
      refreshLab();
    },
    draw(ctx, w, h, dpr, chapter, time) {
      const panelW = Math.min(500, w * 0.46);
      const x0 = panelW + 30;
      const x1 = w - 30;
      townBox = null;
      if (chapter === 0) drawStates(ctx, x0, x1, h, time);
      else if (chapter === 1) drawTown(ctx, x0, x1, h, dpr, time);
      else if (chapter === 2) drawTree(ctx, x0, x1, h, time);
      else if (chapter === 3) drawFlatten(ctx, x0, x1, h);
      else if (chapter === 4) drawFutures(ctx, x0, x1, h);
      else drawLive(ctx, x0, x1, h);
    },
    pointerDown(e, rect) {
      if (!townBox) return;
      const x = (e.clientX - rect.left - townBox.ox) / townBox.scale;
      const y = (e.clientY - rect.top - townBox.oy) / townBox.scale;
      if (x < 0 || x > MAP_W || y < 0 || y > CITY_H) return;
      const agent = sim.infectNearest(x, y);
      if (agent) opts.addRipple({ x: agent.x, y: agent.y, t: 0, color: COLOR.i });
    },
    dispose() {
      futures = null;
    },
  };
}
