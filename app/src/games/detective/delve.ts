// "How does this work?" for Weather Detective: six chapters in the shared
// card (shell/delve.ts), each with a live demo drawn on the game canvas to
// the right of the card.
import type { DelveChapter } from '../../shell/delve';
import { fmtNumber, pick, type Localized } from '../../lib/i18n';
import { Dreamer, GP, type Hyper } from './gp';
import { listened, makeStation, mapError, mapGuess, randomLand, type Station } from './cases';
import { EUROPE, EUROPE_HOME, EUROPE_OFFICIAL } from './data';
import { FINE_NX, FINE_NY, HEIGHT_KM, HYPER, KNMI_STATIONS, WIDTH_KM, landCanvas, lonLatToKm, onLand, rng, world, type Grid } from './world';
import { drawHouse, drawTag, drawThermometer, paintField, tempColor, type Scale } from './render';
import { MapGL } from './mapgl';

interface ChapterText {
  title: string;
  paragraphs: string[];
  formula?: string;
}

interface Labels {
  addRandom: string;
  clear: string;
  showTruth: string;
  hideTruth: string;
  walk: [string, string];
  reach: (km: number) => string;
  choose: string;
  testError: string;
  mapOn: string;
  mapOff: string;
  error: (e: number) => string;
  biasOn: string;
  biasOff: string;
  homesOn: string;
  homesOff: string;
  biasLine: (b: number) => string;
  stations: string;
  pairs: string;
  plain: string;
  tricks: string;
  time: (seconds: number) => string;
  europeLegend: [string, string];
}

const CHAPTERS: Localized<ChapterText[]> = {
  en: [
    {
      title: 'Guessing between thermometers',
      paragraphs: [
        'On the right: a walk from the beach to the east of the country, with the temperature along the way. The computer only knows what your thermometers say. Drag them; click the strip to add one.',
        'The thick line is its best guess. The shaded band is how unsure it is: thin at a thermometer, wide far away. The thin wobbly lines are its dreams: weather curves that all agree with your thermometers. The band is simply where the dreams disagree.',
        'This way of guessing is called a Gaussian process. The dreams on the big map are exactly these, in two dimensions.',
      ],
    },
    {
      title: 'How far does one thermometer reach?',
      paragraphs: [
        'The computer has to know how far one thermometer’s knowledge reaches. Slide the reach: too short and the guess snaps back to “average” right next to each thermometer; too long and it draws stiff lines that miss the bumps.',
        'How does it choose? It plays a game against itself: hide one thermometer, guess it from the others, see how wrong it was. Repeat for every thermometer. The chart below the strip shows that test error for every reach; the lowest point wins.',
        'This trick is called cross-validation. In our research, the same kind of test helped choose the settings for the weather map of all of Europe.',
      ],
    },
    {
      title: 'The computer also knows the map',
      paragraphs: [
        'Cities are warmer than the countryside, and on a summer day the sea keeps the coast cool. The computer can use that: it knows how much city and water there is around every spot.',
        'Same thermometers, map knowledge on or off: watch the coast and the cities appear. It is not told how much warmer a city is; it learns that from the thermometers, too.',
        'In our research the computer also knows the height of the land, the slope, which way it faces, and how much forest and grass there is.',
      ],
    },
    {
      title: 'Home weather stations: cheap but wobbly',
      paragraphs: [
        'Official KNMI stations are few (about 30 in the Netherlands) but very accurate: in an open field, on grass, in the shade. Home weather stations are many, but hang on a sunny wall or near a warm house, so they read too warm and wobble.',
        'Switch the home stations on: the map gets far more detail. Switch the correction off, and the map turns too warm. With the correction, the computer works out by itself how much too warm home stations read, and subtracts it.',
        'Combining a few accurate measurements with many rough ones is called multi-fidelity. The real map in this game was made by KNMI from 31 official and 729 home stations.',
      ],
    },
    {
      title: 'Too many thermometers',
      paragraphs: [
        'Here is a summer day in Europe: white dots are official stations, coloured dots home stations (only 1 in 5 is shown). There are more than 100,000 of them.',
        'To guess well, the computer compares every station with every other one. The number of pairs grows much faster than the number of stations. Slide the number of stations and watch what happens to the computing time of the simple method.',
        'Our tricks: a thermometer only talks to its neighbours (far-away pairs count as exactly zero, so we can skip them), and the stations are summarised by about 1000 landmark points. That turns days of computing into a few minutes on one computer.',
      ],
      formula: 'pairs = N × (N − 1) / 2',
    },
    {
      title: 'Where this is used',
      paragraphs: [
        'Weather maps like this help KNMI see the weather between its stations: the hot streets of a city, the cold hollows on a frosty night.',
        'They help plan for heatwaves (where do people need shade and water?), check weather and climate models, and feed the new AI weather forecasts with data from places where there are no official stations.',
        'This is research of CWI’s Scientific Computing group together with KNMI. Next up: wind and rain. Maybe your own weather station helps too!',
      ],
    },
  ],
  nl: [
    {
      title: 'Raden tussen thermometers',
      paragraphs: [
        'Rechts: een wandeling van het strand naar het oosten van het land, met de temperatuur onderweg. De computer weet alleen wat jouw thermometers zeggen. Sleep ze; klik op de strook om er een toe te voegen.',
        'De dikke lijn is zijn beste gok. De gekleurde band laat zien hoe onzeker hij is: smal bij een thermometer, breed ver weg. De dunne wiebelige lijnen zijn zijn dromen: weercurves die allemaal kloppen met jouw thermometers. De band is gewoon waar de dromen het oneens zijn.',
        'Deze manier van raden heet een Gaussisch proces. De dromen op de grote kaart zijn precies dit, maar dan in twee dimensies.',
      ],
    },
    {
      title: 'Hoe ver reikt één thermometer?',
      paragraphs: [
        'De computer moet weten hoe ver de kennis van één thermometer reikt. Schuif het bereik: te kort en de gok springt vlak naast elke thermometer terug naar “gemiddeld”; te lang en hij tekent stijve lijnen die de bulten missen.',
        'Hoe kiest hij? Hij speelt een spel tegen zichzelf: verstop één thermometer, raad hem met de andere, kijk hoe fout dat was. Herhaal dat voor elke thermometer. De grafiek onder de strook toont die testfout voor elk bereik; het laagste punt wint.',
        'Deze truc heet kruisvalidatie. In ons onderzoek hielp dezelfde soort test de instellingen kiezen voor de weerkaart van heel Europa.',
      ],
    },
    {
      title: 'De computer kent ook de kaart',
      paragraphs: [
        'Steden zijn warmer dan het platteland, en op een zomerdag houdt de zee de kust koel. Dat kan de computer gebruiken: hij weet hoeveel stad en water er rond elke plek is.',
        'Dezelfde thermometers, kaartkennis aan of uit: kijk hoe de kust en de steden verschijnen. Hij krijgt niet te horen hoeveel warmer een stad is; ook dat leert hij van de thermometers.',
        'In ons onderzoek kent de computer ook de hoogte van het land, de helling, welke kant het op kijkt en hoeveel bos en gras er is.',
      ],
    },
    {
      title: 'Thuisweerstations: goedkoop maar wiebelig',
      paragraphs: [
        'Officiële KNMI-stations zijn er weinig (zo’n 30 in Nederland), maar ze zijn heel precies: in een open veld, op gras, in de schaduw. Thuisweerstations zijn er veel, maar hangen aan een zonnige muur of dicht bij een warm huis. Ze meten te warm en wiebelen.',
        'Zet de thuisstations aan: de kaart krijgt veel meer detail. Zet de correctie uit, en de kaart wordt te warm. Met de correctie rekent de computer zelf uit hoeveel te warm thuisstations meten, en trekt dat eraf.',
        'Een paar precieze metingen combineren met veel ruwe heet multi-fidelity. De echte kaart in dit spel maakte het KNMI van 31 officiële en 729 thuisstations.',
      ],
    },
    {
      title: 'Te veel thermometers',
      paragraphs: [
        'Hier is een zomerdag in Europa: witte stippen zijn officiële stations, gekleurde stippen thuisstations (maar 1 op de 5 is getekend). Het zijn er meer dan 100.000.',
        'Om goed te raden, vergelijkt de computer elk station met elk ander. Het aantal paren groeit veel sneller dan het aantal stations. Schuif het aantal stations en zie wat er gebeurt met de rekentijd van de simpele methode.',
        'Onze trucs: een thermometer praat alleen met zijn buren (verre paren tellen precies nul, die slaan we over), en de stations worden samengevat door zo’n 1000 ijkpunten. Zo worden dagen rekenen een paar minuten op één computer.',
      ],
      formula: 'paren = N × (N − 1) / 2',
    },
    {
      title: 'Waar wordt dit gebruikt?',
      paragraphs: [
        'Zulke weerkaarten helpen het KNMI het weer tússen zijn stations te zien: de hete straten van een stad, de koude kuilen in een vriesnacht.',
        'Ze helpen bij het voorbereiden op hittegolven (waar hebben mensen schaduw en water nodig?), bij het controleren van weer- en klimaatmodellen, en ze voeden de nieuwe AI-weerverwachtingen met gegevens van plekken zonder officieel station.',
        'Dit is onderzoek van de groep Scientific Computing van het CWI, samen met het KNMI. Hierna: wind en regen. Misschien helpt jouw eigen weerstation ook mee!',
      ],
    },
  ],
  no: [
    {
      title: 'Å gjette mellom termometre',
      paragraphs: [
        'Til høyre: en tur fra stranda til øst i landet, med temperaturen underveis. Datamaskinen vet bare det termometrene dine sier. Dra dem; klikk på stripa for å legge til et.',
        'Den tykke linja er den beste gjetningen. Det skyggelagte båndet viser hvor usikker den er: smalt ved et termometer, bredt langt unna. De tynne, vinglete linjene er drømmene: værkurver som alle stemmer med termometrene dine. Båndet er rett og slett der drømmene er uenige.',
        'Denne måten å gjette på heter en gaussisk prosess. Drømmene på det store kartet er akkurat dette, bare i to dimensjoner.',
      ],
    },
    {
      title: 'Hvor langt rekker ett termometer?',
      paragraphs: [
        'Datamaskinen må vite hvor langt kunnskapen fra ett termometer rekker. Skyv på rekkevidden: for kort, og gjetningen spretter tilbake til «gjennomsnitt» rett ved siden av hvert termometer; for lang, og den tegner stive linjer som bommer på humpene.',
        'Hvordan velger den? Den spiller et spill mot seg selv: skjul ett termometer, gjett det fra de andre, se hvor feil det ble. Gjenta for hvert termometer. Grafen under stripa viser testfeilen for hver rekkevidde; det laveste punktet vinner.',
        'Dette trikset heter kryssvalidering. I forskningen vår hjalp samme slags test med å velge innstillingene for værkartet over hele Europa.',
      ],
    },
    {
      title: 'Datamaskinen kjenner også kartet',
      paragraphs: [
        'Byer er varmere enn landsbygda, og en sommerdag holder havet kysten kjølig. Det kan datamaskinen bruke: den vet hvor mye by og vann det er rundt hvert sted.',
        'Samme termometre, kartkunnskap av eller på: se kysten og byene dukke opp. Den får ikke vite hvor mye varmere en by er; det lærer den også av termometrene.',
        'I forskningen vår kjenner datamaskinen også høyden på landet, hellingen, hvilken vei det vender, og hvor mye skog og gress det er.',
      ],
    },
    {
      title: 'Hjemmestasjoner: billige, men vinglete',
      paragraphs: [
        'Offisielle KNMI-stasjoner er få (rundt 30 i Nederland), men svært nøyaktige: på et åpent jorde, på gress, i skyggen. Hjemmestasjoner er mange, men henger på en solvegg eller nær et varmt hus, så de måler for varmt og vingler.',
        'Slå på hjemmestasjonene: kartet får mye mer detalj. Slå av korreksjonen, og kartet blir for varmt. Med korreksjonen finner datamaskinen selv ut hvor mye for varmt hjemmestasjonene måler, og trekker det fra.',
        'Å kombinere noen få nøyaktige målinger med mange grove kalles multi-fidelity. Det ekte kartet i spillet ble laget av KNMI fra 31 offisielle stasjoner og 729 hjemmestasjoner.',
      ],
    },
    {
      title: 'For mange termometre',
      paragraphs: [
        'Her er en sommerdag i Europa: hvite prikker er offisielle stasjoner, fargede prikker hjemmestasjoner (bare 1 av 5 er tegnet). Det er over 100 000 av dem.',
        'For å gjette godt sammenligner datamaskinen hver stasjon med hver annen. Antall par vokser mye raskere enn antall stasjoner. Skyv på antall stasjoner og se hva som skjer med regnetiden for den enkle metoden.',
        'Triksene våre: et termometer snakker bare med naboene sine (par langt fra hverandre teller nøyaktig null, så dem hopper vi over), og stasjonene oppsummeres med rundt 1000 landemerkepunkter. Da blir dager med regning til noen få minutter på én datamaskin.',
      ],
      formula: 'par = N × (N − 1) / 2',
    },
    {
      title: 'Hvor dette brukes',
      paragraphs: [
        'Værkart som dette hjelper KNMI å se været mellom stasjonene sine: de varme gatene i en by, de kalde forsenkningene en frostnatt.',
        'De hjelper med å planlegge for hetebølger (hvor trenger folk skygge og vann?), med å sjekke vær- og klimamodeller, og de gir de nye KI-værvarslene data fra steder uten offisielle stasjoner.',
        'Dette er forskning fra Scientific Computing-gruppen ved CWI sammen med KNMI. Neste steg: vind og regn. Kanskje din egen værstasjon hjelper til også!',
      ],
    },
  ],
};

const fmtTime = (s: number, units: [string, string, string, string, string, string]) => {
  const [sec, min, hr, day, yr, inst] = units;
  if (s < 0.01) return inst;
  if (s < 60) return `${fmtNumber(s, { maximumFractionDigits: s < 10 ? 1 : 0 })} ${sec}`;
  if (s < 3600) return `${fmtNumber(s / 60, { maximumFractionDigits: 0 })} ${min}`;
  if (s < 86400) return `${fmtNumber(s / 3600, { maximumFractionDigits: 0 })} ${hr}`;
  if (s < 3.15e7) return `${fmtNumber(s / 86400, { maximumFractionDigits: 0 })} ${day}`;
  return `${fmtNumber(s / 3.15e7, { maximumFractionDigits: 0 })} ${yr}`;
};

const LABELS: Localized<Labels> = {
  en: {
    addRandom: '➕ Thermometer', clear: '🧹 Clear', showTruth: '👁 Show the real curve', hideTruth: '👁 Hide the real curve',
    walk: ['🏖 beach', 'east 🌲'], reach: (km) => `Reach: ${Math.round(km)} km`, choose: '🤖 Let the computer choose', testError: 'test error',
    mapOn: '🗺 Map knowledge: ON', mapOff: '🗺 Map knowledge: OFF', error: (e) => `Off by ${fmtNumber(e, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}° on average`,
    biasOn: '🔧 Correction: ON', biasOff: '🔧 Correction: OFF', homesOn: '🏡 Home stations: ON', homesOff: '🏡 Home stations: OFF',
    biasLine: (b) => `The computer thinks home stations read ${fmtNumber(b, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}° too warm (really: 1.5°)`,
    stations: 'Stations', pairs: 'Pairs to compare', plain: 'Simple method', tricks: 'With our tricks',
    time: (s) => fmtTime(s, ['seconds', 'minutes', 'hours', 'days', 'years', 'instantly']),
    europeLegend: ['official stations', 'home stations'],
  },
  nl: {
    addRandom: '➕ Thermometer', clear: '🧹 Wissen', showTruth: '👁 Toon de echte curve', hideTruth: '👁 Verberg de echte curve',
    walk: ['🏖 strand', 'oosten 🌲'], reach: (km) => `Bereik: ${Math.round(km)} km`, choose: '🤖 Laat de computer kiezen', testError: 'testfout',
    mapOn: '🗺 Kaartkennis: AAN', mapOff: '🗺 Kaartkennis: UIT', error: (e) => `Gemiddeld ${fmtNumber(e, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}° ernaast`,
    biasOn: '🔧 Correctie: AAN', biasOff: '🔧 Correctie: UIT', homesOn: '🏡 Thuisstations: AAN', homesOff: '🏡 Thuisstations: UIT',
    biasLine: (b) => `De computer denkt dat thuisstations ${fmtNumber(b, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}° te warm meten (echt: 1,5°)`,
    stations: 'Stations', pairs: 'Paren om te vergelijken', plain: 'Simpele methode', tricks: 'Met onze trucs',
    time: (s) => fmtTime(s, ['seconden', 'minuten', 'uur', 'dagen', 'jaar', 'meteen']),
    europeLegend: ['officiële stations', 'thuisstations'],
  },
  no: {
    addRandom: '➕ Termometer', clear: '🧹 Tøm', showTruth: '👁 Vis den ekte kurven', hideTruth: '👁 Skjul den ekte kurven',
    walk: ['🏖 strand', 'øst 🌲'], reach: (km) => `Rekkevidde: ${Math.round(km)} km`, choose: '🤖 La datamaskinen velge', testError: 'testfeil',
    mapOn: '🗺 Kartkunnskap: PÅ', mapOff: '🗺 Kartkunnskap: AV', error: (e) => `Bommer med ${fmtNumber(e, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}° i snitt`,
    biasOn: '🔧 Korreksjon: PÅ', biasOff: '🔧 Korreksjon: AV', homesOn: '🏡 Hjemmestasjoner: PÅ', homesOff: '🏡 Hjemmestasjoner: AV',
    biasLine: (b) => `Datamaskinen tror hjemmestasjoner måler ${fmtNumber(b, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}° for varmt (egentlig: 1,5°)`,
    stations: 'Stasjoner', pairs: 'Par å sammenligne', plain: 'Enkel metode', tricks: 'Med triksene våre',
    time: (s) => fmtTime(s, ['sekunder', 'minutter', 'timer', 'dager', 'år', 'med en gang']),
    europeLegend: ['offisielle stasjoner', 'hjemmestasjoner'],
  },
};

// ---------------------------------------------------------------------------
// The 1D walk (chapters 1 and 2)

const WALK_KM = 200;
/** Temperature range of the walk's chart. */
const WALK_LO = 13;
const WALK_HI = 31;
const WALK_N = 240;
const WALK_HYPER: Hyper = { mean: 22, c: 1.5, au: 0, aw: 0, theta: 2.2, ell: 30, sdOfficial: 0.12, sdHome: 1, bias: 0 };
/** The "real" temperature along the walk: cool beach, warm inland, a town and a forest. */
function walkTruth(x: number): number {
  return 18 + 6 * (1 - Math.exp(-x / 25)) + 2.2 * Math.exp(-(((x - 75) / 9) ** 2)) - 1.6 * Math.exp(-(((x - 140) / 18) ** 2)) + 0.8 * Math.sin(x / 13);
}

function lineGrid(): Grid {
  const n = WALK_N;
  const g: Grid = { nx: n, ny: 1, dx: WALK_KM / n, dy: 1, n, x: new Float32Array(n), y: new Float32Array(n), u: new Float32Array(n), w: new Float32Array(n), land: new Uint8Array(n).fill(1) };
  for (let i = 0; i < n; i++) g.x[i] = (i + 0.5) * g.dx;
  return g;
}

export class DetectiveDelve {
  private chapter = 0;
  private time = 0;
  private canvas: HTMLCanvasElement | null = null;
  private rect = { x: 0, y: 0, w: 1, h: 1 };

  // walk
  private grid = lineGrid();
  private walkGp = new GP({ ...WALK_HYPER }, [this.grid]);
  private walkDreams = [0, 1, 2, 3, 4].map((i) => new Dreamer(this.walkGp, 0, rng(50 + i), 120));
  private walkObs: Station[] = [];
  private showTruth = false;
  private reachTarget: number | null = null;
  private dragIndex = -1;
  private walkMean = new Float32Array(WALK_N);
  private walkSd = new Float32Array(WALK_N);
  private walkDream = new Float32Array(WALK_N);

  // maps
  private land = landCanvas();
  private mapGp: GP | null = null;
  private mapTruth: Float32Array | null = null;
  private mapStations: Station[] = [];
  private mapScale: Scale = { lo: 0, hi: 1 };
  private mapField = new Float32Array(world().half.n);
  private mapDirty = true;
  private useMap = true;
  private useBias = true;
  private useHomes = true;
  private mapError = 0;
  private img: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; img: ImageData };
  private off = document.createElement('canvas');
  private offCtx = this.off.getContext('2d')!;
  private dreamer: Dreamer | null = null;
  private dreamField = new Float32Array(world().coarse.n);
  private coarseImg: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; img: ImageData };

  private gl: MapGL | null = null;

  // europe
  private stations: { official: Float32Array; home: Float32Array } | null = null;
  private europeN = 1000;

  constructor() {
    const { half, coarse } = world();
    const mk = (nx: number, ny: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = nx;
      canvas.height = ny;
      const ctx = canvas.getContext('2d')!;
      return { canvas, ctx, img: ctx.createImageData(nx, ny) };
    };
    this.img = mk(half.nx, half.ny);
    this.coarseImg = mk(coarse.nx, coarse.ny);
    this.gl = MapGL.create(world().fineLand, FINE_NX, FINE_NY, WIDTH_KM, HEIGHT_KM);
    for (const x of [30, 110, 170]) this.addWalk(x);
  }

  chapters(): DelveChapter[] {
    const L = pick(LABELS);
    const chapters = pick(CHAPTERS);
    const button = (host: HTMLElement, label: () => string, onClick: () => void) => {
      const b = document.createElement('button');
      b.className = 'arcade-button';
      b.textContent = label();
      b.addEventListener('click', () => {
        onClick();
        b.textContent = label();
      });
      host.appendChild(b);
      return b;
    };
    return chapters.map((c, i) => {
      const chapter: DelveChapter = { ...c };
      if (i === 0)
        chapter.extras = (host) => {
          button(host, () => L.addRandom, () => this.addWalk(10 + Math.random() * (WALK_KM - 20)));
          button(host, () => L.clear, () => {
            this.walkObs = [];
            this.refitWalk();
          });
          button(host, () => (this.showTruth ? L.hideTruth : L.showTruth), () => (this.showTruth = !this.showTruth));
        };
      if (i === 1)
        chapter.extras = (host) => {
          const label = document.createElement('label');
          label.className = 'wd-slider';
          const span = document.createElement('span');
          const slider = document.createElement('input');
          slider.type = 'range';
          slider.min = '4';
          slider.max = '150';
          slider.value = String(this.walkGp.hyper.ell);
          const sync = () => (span.textContent = L.reach(this.walkGp.hyper.ell));
          slider.addEventListener('input', () => {
            this.reachTarget = null;
            this.setReach(Number(slider.value));
            sync();
          });
          label.append(span, slider);
          host.appendChild(label);
          sync();
          this.onReach = () => {
            slider.value = String(this.walkGp.hyper.ell);
            sync();
          };
          button(host, () => L.choose, () => (this.reachTarget = this.bestReach()));
          button(host, () => L.addRandom, () => this.addWalk(10 + Math.random() * (WALK_KM - 20)));
        };
      if (i === 2)
        chapter.extras = (host) => {
          button(host, () => (this.useMap ? L.mapOn : L.mapOff), () => {
            this.useMap = !this.useMap;
            this.mapDirty = true;
          });
        };
      if (i === 3)
        chapter.extras = (host) => {
          button(host, () => (this.useHomes ? L.homesOn : L.homesOff), () => {
            this.useHomes = !this.useHomes;
            this.mapDirty = true;
          });
          button(host, () => (this.useBias ? L.biasOn : L.biasOff), () => {
            this.useBias = !this.useBias;
            this.mapDirty = true;
          });
        };
      if (i === 4)
        chapter.extras = (host) => {
          const label = document.createElement('label');
          label.className = 'wd-slider';
          const span = document.createElement('span');
          const slider = document.createElement('input');
          slider.type = 'range';
          slider.min = '1';
          slider.max = String(Math.log10(EUROPE.officialTotal + EUROPE.homeTotal));
          slider.step = '0.01';
          slider.value = String(Math.log10(this.europeN));
          const sync = () => (span.textContent = `${L.stations}: ${fmtNumber(this.europeN)}`);
          slider.addEventListener('input', () => {
            this.europeN = Math.min(EUROPE.officialTotal + EUROPE.homeTotal, Math.round(10 ** Number(slider.value)));
            sync();
          });
          label.append(span, slider);
          host.appendChild(label);
          sync();
        };
      return chapter;
    });
  }

  private onReach: () => void = () => {};

  setChapter(i: number): void {
    this.chapter = i;
    this.dragIndex = -1;
    // KNMI's own network as the official stations.
    if (i === 2) this.setupMap('heatwave', KNMI_STATIONS.length, false);
    if (i === 3) this.setupMap('seabreeze', 8, true);
    if (i === 5) this.setupMap('seabreeze', KNMI_STATIONS.length, false, true);
    if (i === 4 && !this.stations) this.loadEurope();
  }

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
  }

  detach(): void {
    this.canvas?.removeEventListener('pointerdown', this.onDown);
    this.canvas?.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    this.canvas = null;
    this.gl?.dispose();
    this.gl = null;
  }

  // --- walk ---

  private addWalk(x: number): void {
    if (this.walkObs.length >= 10) return;
    this.walkObs.push({ x, y: 0, value: walkTruth(x), u: 0, w: 0, home: false, kind: 'official', liar: false, ignored: false });
    this.refitWalk();
  }

  private refitWalk(): void {
    this.walkGp.setObs(this.walkObs);
    this.walkGp.meanGrid(0, this.walkMean);
    this.walkGp.sdGrid(0, this.walkSd);
  }

  private setReach(ell: number): void {
    this.walkGp.retune({ ...this.walkGp.hyper, ell });
    this.refitWalk();
  }

  /** Leave-one-out error of the walk's thermometers for a given reach. */
  private looError(ell: number): number {
    if (this.walkObs.length < 3) return NaN;
    const gp = new GP({ ...WALK_HYPER, ell }, []);
    gp.setObs(this.walkObs);
    const { mean } = gp.loo();
    let e = 0;
    this.walkObs.forEach((o, i) => (e += (mean[i] - o.value) ** 2));
    return Math.sqrt(e / this.walkObs.length);
  }

  private bestReach(): number {
    let best = this.walkGp.hyper.ell, bestE = Infinity;
    for (let ell = 4; ell <= 150; ell += 2) {
      const e = this.looError(ell);
      if (e < bestE) {
        bestE = e;
        best = ell;
      }
    }
    return best;
  }

  private walkPx(x: number): number {
    return this.rect.x + (x / WALK_KM) * this.rect.w;
  }

  private walkY(t: number, top: number, h: number): number {
    return top + h - ((t - WALK_LO) / (WALK_HI - WALK_LO)) * h;
  }

  private onDown = (e: PointerEvent) => {
    if (!this.canvas || this.chapter > 1) return;
    const r = this.canvas.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    if (px < this.rect.x || px > this.rect.x + this.rect.w || py < this.rect.y || py > this.rect.y + this.rect.h) return;
    let best = -1, bestD = 30;
    this.walkObs.forEach((o, i) => {
      const d = Math.abs(this.walkPx(o.x) - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (e.button === 2 && best >= 0) {
      this.walkObs.splice(best, 1);
      this.refitWalk();
      return;
    }
    if (best < 0) {
      this.addWalk(((px - this.rect.x) / this.rect.w) * WALK_KM);
      best = this.walkObs.length - 1;
    }
    this.dragIndex = best;
  };

  private onMove = (e: PointerEvent) => {
    if (!this.canvas || this.dragIndex < 0) return;
    const r = this.canvas.getBoundingClientRect();
    const x = Math.max(1, Math.min(WALK_KM - 1, ((e.clientX - r.left - this.rect.x) / this.rect.w) * WALK_KM));
    const o = this.walkObs[this.dragIndex];
    if (!o) return;
    o.x = x;
    o.value = walkTruth(x);
    this.refitWalk();
  };

  private onUp = () => {
    this.dragIndex = -1;
  };

  // --- maps ---

  private setupMap(day: 'seabreeze' | 'heatwave', knmi: number, homes: boolean, dream = false): void {
    const { half, coarse } = world();
    const r = rng(2026);
    this.mapTruth = world().days[day].t;
    const d = world().days[day];
    this.mapScale = { lo: d.lo - 1, hi: d.hi + 1 };
    this.mapStations = [];
    for (const [lon, lat] of KNMI_STATIONS.slice(0, knmi)) {
      const p = lonLatToKm(lon, lat);
      if (onLand(p.x, p.y)) this.mapStations.push(makeStation(this.mapTruth, p.x, p.y, 'official', r));
    }
    if (homes)
      for (let i = 0; i < 150; i++) {
        const p = randomLand(r, true);
        this.mapStations.push(makeStation(this.mapTruth, p.x, p.y, 'home', r));
      }
    this.mapGp = new GP(HYPER[day], [half, coarse]);
    this.dreamer = dream ? new Dreamer(this.mapGp, 1, rng(9)) : null;
    this.mapDirty = true;
  }

  private refitMap(): void {
    if (!this.mapGp || !this.mapTruth) return;
    this.mapGp.options = { map: this.chapter === 2 ? this.useMap : true, bias: this.chapter === 3 ? this.useBias : true };
    const obs = this.chapter === 3 && !this.useHomes ? this.mapStations.filter((s) => !s.home) : this.mapStations;
    this.mapGp.setObs(listened(obs));
    const guess = mapGuess(this.mapGp);
    this.mapField.set(guess);
    this.mapError = mapError(this.mapTruth, guess).mae;
    this.mapDirty = false;
  }

  private drawNL(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dream: boolean): { s: number; ox: number; oy: number } {
    const s = Math.min(w / WIDTH_KM, h / HEIGHT_KM);
    const mw = WIDTH_KM * s, mh = HEIGHT_KM * s;
    const ox = x + (w - mw) / 2, oy = y + (h - mh) / 2;
    const dpr = ctx.getTransform().a;
    const { half, coarse } = world();
    if (this.gl) {
      this.gl.resize(Math.ceil(mw * dpr), Math.ceil(mh * dpr));
      if (dream && this.dreamer) this.dreamer.sample(this.time, this.dreamField);
      const grid = dream && this.dreamer ? coarse : half;
      const data = dream && this.dreamer ? this.dreamField : this.mapField;
      this.gl.render({ field: { data, nx: grid.nx, ny: grid.ny, dx: grid.dx, dy: grid.dy }, mode: 'temp', scale: this.mapScale, isotherms: true, time: this.time });
      ctx.save();
      ctx.shadowColor = 'rgba(140, 200, 255, 0.5)';
      ctx.shadowBlur = 16;
      ctx.drawImage(this.gl.canvas, ox, oy, mw, mh);
      ctx.restore();
      return { s, ox, oy };
    }
    this.off.width = Math.ceil(mw * dpr);
    this.off.height = Math.ceil(mh * dpr);
    const o = this.offCtx;
    o.imageSmoothingEnabled = true;
    if (dream && this.dreamer) {
      this.dreamer.sample(this.time, this.dreamField);
      paintField(this.coarseImg.img, this.dreamField, this.mapScale, coarse.land);
      this.coarseImg.ctx.putImageData(this.coarseImg.img, 0, 0);
      o.filter = `blur(${(0.6 * s * dpr).toFixed(1)}px)`;
      o.drawImage(this.coarseImg.canvas, 0, 0, coarse.nx * coarse.dx * s * dpr, coarse.ny * coarse.dy * s * dpr);
      o.filter = 'none';
    } else {
      paintField(this.img.img, this.mapField, this.mapScale, half.land);
      this.img.ctx.putImageData(this.img.img, 0, 0);
      o.drawImage(this.img.canvas, 0, 0, this.off.width, this.off.height);
    }
    o.globalCompositeOperation = 'destination-in';
    o.drawImage(this.land, 0, 0, this.off.width, this.off.height);
    o.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.shadowColor = 'rgba(140, 200, 255, 0.5)';
    ctx.shadowBlur = 16;
    ctx.drawImage(this.off, ox, oy, mw, mh);
    ctx.restore();
    return { s, ox, oy };
  }

  private drawMapStations(ctx: CanvasRenderingContext2D, m: { s: number; ox: number; oy: number }): void {
    const showHomes = this.chapter !== 3 || this.useHomes;
    for (const st of this.mapStations) {
      const p = { x: m.ox + st.x * m.s, y: m.oy + st.y * m.s };
      if (st.home) {
        if (showHomes) drawHouse(ctx, p.x, p.y, 8, tempColor(st.value, this.mapScale));
      } else if (this.chapter === 5) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else drawThermometer(ctx, p.x, p.y, 34, (st.value - this.mapScale.lo) / (this.mapScale.hi - this.mapScale.lo), tempColor(st.value, this.mapScale));
    }
  }

  // --- europe ---

  private loadEurope(): void {
    const decode = (b64: string) => {
      const s = atob(b64);
      const n = s.length / 5;
      const out = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const b = i * 5;
        const x = s.charCodeAt(b) | (s.charCodeAt(b + 1) << 8);
        const y = s.charCodeAt(b + 2) | (s.charCodeAt(b + 3) << 8);
        out[i * 3] = EUROPE.lon0 + (x / 65535) * (EUROPE.lon1 - EUROPE.lon0);
        out[i * 3 + 1] = EUROPE.lat0 + (y / 65535) * (EUROPE.lat1 - EUROPE.lat0);
        out[i * 3 + 2] = EUROPE.tlo + (s.charCodeAt(b + 4) / 254) * (EUROPE.thi - EUROPE.tlo);
      }
      return out;
    };
    this.stations = { official: decode(EUROPE_OFFICIAL), home: decode(EUROPE_HOME) };
  }

  private drawEurope(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    if (!this.stations) return;
    const L = pick(LABELS);
    // Equirectangular with a cos(latitude) squeeze. Wide screens: the map on
    // the left, the numbers on the right; otherwise numbers below.
    const wide = w > h * 1.1;
    const midLat = 53, k = Math.cos((midLat * Math.PI) / 180);
    const spanX = (EUROPE.lon1 - EUROPE.lon0) * k, spanY = EUROPE.lat1 - EUROPE.lat0;
    const mapW = wide ? w * 0.58 : w;
    const mapH = wide ? h - 70 : h * 0.62;
    const s = Math.min(mapW / spanX, mapH / spanY);
    const ox = x + (mapW - spanX * s) / 2, oy = y;
    const P = (lon: number, lat: number) => [ox + (lon - EUROPE.lon0) * k * s, oy + (EUROPE.lat1 - lat) * s];
    const scale: Scale = { lo: 12, hi: 34 };
    const reveal = Math.min(1, this.time / 2.5);
    const home = this.stations.home;
    const nh = Math.floor((home.length / 3) * reveal);
    const dot = Math.max(1.6, s * 0.12);
    for (let i = 0; i < nh; i++) {
      const [px, py] = P(home[i * 3], home[i * 3 + 1]);
      ctx.fillStyle = tempColor(home[i * 3 + 2], scale, 0.85);
      ctx.fillRect(px - dot / 2, py - dot / 2, dot, dot);
    }
    const off = this.stations.official;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < off.length / 3; i++) {
      const [px, py] = P(off[i * 3], off[i * 3 + 1]);
      ctx.fillRect(px - 0.8, py - 0.8, 1.6, 1.6);
    }
    // Legend under the map.
    const ly = oy + spanY * s + 18;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.fillRect(ox, ly - 3, 6, 6);
    ctx.fillText(`${fmtNumber(EUROPE.officialTotal)} ${L.europeLegend[0]}`, ox + 12, ly);
    ctx.fillStyle = tempColor(26, scale);
    ctx.fillRect(ox, ly + 17, 6, 6);
    ctx.fillStyle = '#fff';
    ctx.fillText(`${fmtNumber(EUROPE.homeTotal)} ${L.europeLegend[1]}`, ox + 12, ly + 20);

    // The numbers.
    const N = this.europeN;
    const pairs = (N * (N - 1)) / 2;
    const plain = N ** 3 / 3 / 1e9; // Cholesky at a billion steps per second
    const tricks = (N * 1000 * 1000) / 1e9; // ~1000 landmarks
    const rows: [string, string, string][] = [
      [L.stations, fmtNumber(N), '#e6ecf5'],
      [L.pairs, fmtNumber(Math.round(pairs)), '#e6ecf5'],
      [`🐢 ${L.plain}`, L.time(plain), plain > 3600 ? '#ff8a7a' : '#e6ecf5'],
      [`🚀 ${L.tricks}`, L.time(N > 3000 ? tricks : plain), '#86efac'],
    ];
    const nx0 = wide ? x + mapW + 30 : x + 4;
    const nx1 = x + w - 4;
    let ry = wide ? y + h * 0.3 : ly + 60;
    for (const [label, value, color] of rows) {
      ctx.font = '600 15px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(230, 236, 245, 0.8)';
      ctx.textAlign = 'left';
      ctx.fillText(label, nx0, ry);
      ctx.font = '800 24px system-ui, sans-serif';
      ctx.fillStyle = color;
      if (wide) {
        ctx.fillText(value, nx0, ry + 26);
        ry += 70;
      } else {
        ctx.textAlign = 'right';
        ctx.fillText(value, nx1, ry);
        ry += 34;
      }
    }
    ctx.textAlign = 'left';
  }

  // --- frame ---

  frame(ctx: CanvasRenderingContext2D, W: number, H: number, dt: number): void {
    this.time += dt;
    ctx.fillStyle = '#07101f';
    ctx.fillRect(0, 0, W, H);
    const cardRight = Math.min(440, W * 0.42) + 48;
    const x = cardRight, y = 70, w = W - cardRight - 40, h = H - 110;
    const L = pick(LABELS);

    if (this.chapter <= 1) {
      if (this.reachTarget !== null) {
        const ell = this.walkGp.hyper.ell;
        const next = ell + (this.reachTarget - ell) * Math.min(1, dt * 4);
        this.setReach(Math.abs(next - this.reachTarget) < 0.3 ? this.reachTarget : next);
        if (this.walkGp.hyper.ell === this.reachTarget) this.reachTarget = null;
        this.onReach();
      }
      const stripH = this.chapter === 1 ? h * 0.55 : h * 0.75;
      this.rect = { x: x + 20, y: y + 20, w: w - 40, h: stripH };
      this.drawWalk(ctx, L);
      if (this.chapter === 1) this.drawLooChart(ctx, x + 20, y + stripH + 70, w - 40, h - stripH - 90, L);
      return;
    }
    if (this.chapter === 2 || this.chapter === 3) {
      if (this.mapDirty) this.refitMap();
      const m = this.drawNL(ctx, x, y, w, h - 60, false);
      this.drawMapStations(ctx, m);
      drawTag(ctx, L.error(this.mapError), x + w / 2, y + h - 30, 18);
      if (this.chapter === 3 && this.useHomes && this.useBias && this.mapGp) drawTag(ctx, L.biasLine(this.mapGp.biasEstimate()), x + w / 2, y + h, 15, 'rgba(40, 60, 110, 0.9)');
      return;
    }
    if (this.chapter === 4) {
      this.drawEurope(ctx, x + 10, y, w - 20, h);
      return;
    }
    if (this.mapDirty) this.refitMap();
    const m = this.drawNL(ctx, x, y, w, h, true);
    this.drawMapStations(ctx, m);
  }

  private drawWalk(ctx: CanvasRenderingContext2D, L: Labels): void {
    const { x, y, w, h } = this.rect;
    const n = WALK_N;
    const X = (i: number) => x + ((i + 0.5) / n) * w;
    const Y = (t: number) => this.walkY(t, y, h);
    // Background: ground colours along the walk.
    const bg = ctx.createLinearGradient(x, 0, x + w, 0);
    bg.addColorStop(0, 'rgba(240, 215, 150, 0.14)');
    bg.addColorStop(0.08, 'rgba(120, 180, 120, 0.1)');
    bg.addColorStop(1, 'rgba(60, 120, 70, 0.14)');
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.strokeRect(x, y, w, h);
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(230,236,245,0.75)';
    ctx.textBaseline = 'alphabetic';
    for (let t = WALK_LO + 1; t < WALK_HI; t += 2) {
      ctx.fillText(`${t}°`, x - 32, Y(t) + 4);
      ctx.fillRect(x - 4, Y(t), 4, 1);
    }
    ctx.fillText(L.walk[0], x, y + h + 20);
    ctx.textAlign = 'right';
    ctx.fillText(L.walk[1], x + w, y + h + 20);
    ctx.textAlign = 'left';

    // Band: ± 2 spreads.
    ctx.beginPath();
    for (let i = 0; i < n; i++) ctx.lineTo(X(i), Y(this.walkMean[i] + 2 * this.walkSd[i]));
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(X(i), Y(this.walkMean[i] - 2 * this.walkSd[i]));
    ctx.closePath();
    ctx.fillStyle = 'rgba(125, 211, 252, 0.18)';
    ctx.fill();
    // Dreams.
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const colors = ['#f472b6', '#facc15', '#a78bfa', '#34d399', '#fb923c'];
    this.walkDreams.forEach((d, k) => {
      d.sample(this.time * 0.6 + k * 40, this.walkDream);
      ctx.beginPath();
      for (let i = 0; i < n; i++) ctx.lineTo(X(i), Y(this.walkDream[i]));
      ctx.strokeStyle = colors[k];
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    if (this.showTruth) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) ctx.lineTo(X(i), Y(walkTruth(this.grid.x[i])));
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.beginPath();
    for (let i = 0; i < n; i++) ctx.lineTo(X(i), Y(this.walkMean[i]));
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
    // Thermometers.
    const scale: Scale = { lo: 14, hi: 28 };
    for (const o of this.walkObs) {
      const px = this.walkPx(o.x), py = Y(o.value);
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      drawThermometer(ctx, px, y + h - 4, 44, (o.value - scale.lo) / (scale.hi - scale.lo), tempColor(o.value, scale));
      drawTag(ctx, `${fmtNumber(o.value, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}°`, px, py - 18, 13);
    }
  }

  private drawLooChart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, L: Labels): void {
    const ells: number[] = [];
    const errs: number[] = [];
    for (let ell = 4; ell <= 150; ell += 4) {
      ells.push(ell);
      errs.push(this.looError(ell));
    }
    const valid = errs.filter((e) => !Number.isNaN(e));
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(230,236,245,0.75)';
    ctx.fillText(`${L.testError} ↑`, x, y - 8);
    ctx.textAlign = 'right';
    ctx.fillText(`${L.reach(150)} →`, x + w, y + h + 18);
    ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, w, h);
    if (!valid.length) return;
    const max = Math.max(...valid) * 1.1;
    const X = (ell: number) => x + ((ell - 4) / 146) * w;
    const Y = (e: number) => y + h - (e / max) * h;
    ctx.beginPath();
    ells.forEach((ell, i) => ctx.lineTo(X(ell), Y(errs[i])));
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.stroke();
    const cur = this.walkGp.hyper.ell;
    ctx.beginPath();
    ctx.moveTo(X(cur), y);
    ctx.lineTo(X(cur), y + h);
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
