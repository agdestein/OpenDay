// Delve chapters for Ball Pit, in the shared chaptered style
// (shell/delve.ts): text in the card on the left, one live illustration per
// chapter drawn by the game on its canvas (demos.ts). One arc, from one ball
// to the rest of the arcade: a ball is numbers and a rule; collisions cost the
// most; lost bounce is heat, and our 0.82 stands in for the floor's atoms
// (a closure); crowds have laws of their own; tiny differences grow; and there
// are far too many balls to count, so we compute the crowd — which is what the
// fluid games do. The labs in chapters 2 and 3 switch the model, both in the
// demo beside them and in the ball pit itself.
import type { DelveChapter } from '../../shell/delve';
import { pick, type Localized } from '../../lib/i18n';

export type SwitchName = 'collisions' | 'friction' | 'dissipate';

export interface BounceDelveApi {
  getSwitch(name: SwitchName): boolean;
  setSwitch(name: SwitchName, value: boolean): void;
  hasGame(id: string): boolean;
  openGame(id: string): void;
}

/** Chapter 6 ends with doors into the fluid games it talks about. */
const LINKS: Localized<{ title: string; games: { id: string; label: string }[] }> = {
  en: {
    title: '🔭 The same idea, zoomed out:',
    games: [
      { id: 'windfarm', label: '🌀 Play Swirl Lab' },
      { id: 'floodland', label: '🌊 Play Save the Netherlands' },
    ],
  },
  nl: {
    title: '🔭 Hetzelfde idee, uitgezoomd:',
    games: [
      { id: 'windfarm', label: '🌀 Speel Wervel-lab' },
      { id: 'floodland', label: '🌊 Speel Red Nederland' },
    ],
  },
  no: {
    title: '🔭 Samme idé, zoomet ut:',
    games: [
      { id: 'windfarm', label: '🌀 Spill Virvellab' },
      { id: 'floodland', label: '🌊 Spill Redd Nederland' },
    ],
  },
};

function linkExtras(api: BounceDelveApi): ((host: HTMLElement) => void) | undefined {
  const links = pick(LINKS);
  const games = links.games.filter((g) => api.hasGame(g.id));
  if (games.length === 0) return undefined;
  return (host) => {
    const box = document.createElement('div');
    box.className = 'delve-lab';
    const title = document.createElement('div');
    title.className = 'delve-lab-title';
    title.textContent = links.title;
    box.appendChild(title);
    for (const g of games) {
      const button = document.createElement('button');
      button.className = 'arcade-button';
      button.style.cssText = 'display:block;width:100%;margin-top:0.45rem;';
      button.textContent = g.label;
      button.addEventListener('click', () => api.openGame(g.id));
      box.appendChild(button);
    }
    host.appendChild(box);
  };
}

interface ChapterText {
  title: string;
  paragraphs: string[];
  formula?: string;
}

const CHAPTERS: Localized<ChapterText[]> = {
  en: [
    {
      title: 'A ball is five numbers and one rule',
      paragraphs: [
        'Before a computer can simulate anything, someone decides what matters. For a ball that is surprisingly little: where it is (x, y), how fast it moves sideways and up or down (vx, vy), and how big it is. Five numbers, and that is the whole ball. The pit keeps such a list for every ball.',
        'Then one rule, over and over. Every tick, gravity adds a little to the downward speed, and the ball hops a little way along its speed. The pit does this 240 times a second for every ball, and out come the same curves Galileo drew for cannonballs.',
        'What we leave out matters just as much: no spin, no air, no squash. Choosing what to keep is called modelling. (Gravity Doodle shows how the ticks themselves can go wrong.)',
      ],
      formula: 'ball = ( x , y , vx , vy , r )\nv ← v + g·dt\nx ← x + v·dt',
    },
    {
      title: 'Collisions are the expensive part',
      paragraphs: [
        'Moving a ball is two sums. The hard part is finding out who touches whom. The simple way is to check every pair of balls. Four hundred balls make 79 800 pairs, and the pit must check them 240 times a second.',
        'Double the balls and the pairs grow four times. The trick: sort the balls into a grid of squares and only check balls in neighbouring squares. Now twice the balls is only twice the work. On the right the white ball checks every other ball, then only its neighbours.',
        'Doing the same sum smarter, so that it fits in a computer at all, is half of scientific computing. Switch 🎱 collisions off below: no checks at all, and the balls sail through each other like ghosts.',
      ],
      formula: 'every pair:  N × (N − 1) ÷ 2 checks\nwith a grid:  about 10 × N',
    },
    {
      title: 'Where does the bounce go?',
      paragraphs: [
        'A dropped ball never bounces back quite as high. The motion is not lost: the floor is made of atoms, held together like balls on springs. Every landing sets them shaking, and shaking atoms are what heat is.',
        'On the left the floor is drawn atom by atom. The bars keep the books: the ball’s energy flows into the floor’s jiggle, and the total stays the same. Nature’s accounts always balance.',
        'The pit cannot afford to simulate the floor’s atoms. It takes a shortcut: every bounce keeps 82 % of the speed, like the ball on the right, and it bounces much like the real one. A rule that stands in for everything too small to simulate is called a closure model. Switch the bounce loss off below: that ball bounces forever, and so does the pit.',
      ],
      formula: 'bounce speed ← 0.82 × landing speed\n(the floor’s atoms, in one number)',
    },
    {
      title: 'Crowds obey laws no ball knows',
      paragraphs: [
        'No ball knows what temperature is. But the faster the balls jiggle, the hotter the crowd: temperature is the average jiggle. Pressure is how hard and how often they hit the wall. On the right the burner turns up and down, and thermometer and pressure gauge rise and fall together.',
        'From laws like these come steam engines, weather and the air in your lungs, and nobody had to program them. They come out of the crowd, the way the bell curve came out of Plinko.',
        'Some of the very first computer simulations were balls like these. In 1953 one of the first computers simulated hard discs, and in 1957 Berni Alder and Tom Wainwright found that hard balls, with no stickiness at all, freeze into a crystal when you squeeze them. One of the first discoveries ever made by simulation.',
      ],
      formula: 'temperature  ∝  average speed²\npressure  =  pushes on the wall per second',
    },
    {
      title: 'Tiny differences grow',
      paragraphs: [
        'Two boxes on the right: the same balls with the same speeds. In the right box one ball starts a thousandth of a pixel to the side. Watch the colours: blue means the twin balls are still together, red means they have parted.',
        'Every collision makes the difference bigger, until the two boxes have nothing to do with each other. This is chaos, the butterfly effect, and it is why a weather forecast cannot look more than about ten days ahead.',
        'So forecasters don’t compute one future but dozens, each nudged a little, and look at how they spread. You did the same in Plinko: one ball is luck, three hundred make a curve you can count on.',
      ],
      formula: '0.001 px → doubles, and doubles… → the whole box',
    },
    {
      title: 'Too many balls: equations for the crowd',
      paragraphs: [
        'A glass of water holds about 10²⁵ molecules: a 1 with 25 zeros. Computing it ball by ball, even the fastest supercomputer would need centuries for one femtosecond, a millionth of a billionth of a second.',
        'So we zoom out. On the right, thousands of small balls burst through a dam, and from far away they flow like water. For every small square we then keep only how full it is, how fast the stuff moves and how hot it is. That gives the equations of fluids, the ones inside Swirl Lab and Save the Netherlands. The 🔭 slider in the pit does the same.',
        'But averages forget what the small stuff does: tiny whirls, atoms in the floor. Rules that bring it back are closure models, like the 0.82 of chapter 3. Finding better ones, lately also with machine learning, is part of our group’s research. Now go and stir Swirl Lab: it is this pit, zoomed out.',
      ],
      formula: '10²⁵ molecules  →  millions of squares\n(how full, how fast, how hot)',
    },
  ],
  nl: [
    {
      title: 'Een bal is vijf getallen en één regel',
      paragraphs: [
        'Voordat een computer iets kan simuleren, beslist iemand wat ertoe doet. Voor een bal is dat verrassend weinig: waar hij is (x, y), hoe snel hij opzij en omhoog of omlaag gaat (vx, vy), en hoe groot hij is. Vijf getallen, en dat is de hele bal. De bak houdt zo’n lijstje bij voor elke bal.',
        'Dan één regel, steeds opnieuw. Elke tik telt de zwaartekracht een beetje bij de snelheid omlaag op, en springt de bal een stukje verder langs zijn snelheid. De bak doet dat 240 keer per seconde voor elke bal, en er komen dezelfde bogen uit die Galileï voor kanonskogels tekende.',
        'Wat we weglaten doet er net zo veel toe: geen draai, geen lucht, geen indeuken. Kiezen wat je houdt heet modelleren. (Zwaartekracht-doodle laat zien hoe de tikken zelf mis kunnen gaan.)',
      ],
      formula: 'bal = ( x , y , vx , vy , r )\nv ← v + g·dt\nx ← x + v·dt',
    },
    {
      title: 'Botsingen zijn het dure deel',
      paragraphs: [
        'Een bal verplaatsen is twee sommetjes. Het moeilijke is uitzoeken wie wie raakt. De simpele manier is elk paar ballen controleren. Vierhonderd ballen geven 79 800 paren, en die moet de bak 240 keer per seconde controleren.',
        'Verdubbel de ballen en de paren worden vier keer zoveel. De truc: sorteer de ballen in een rooster van vakjes en controleer alleen ballen in buurvakjes. Nu is twee keer zoveel ballen maar twee keer zoveel werk. Rechts controleert de witte bal eerst alle andere ballen, daarna alleen zijn buren.',
        'Dezelfde som slimmer uitrekenen, zodat hij überhaupt in een computer past, is de helft van rekenwetenschap. Zet hieronder 🎱 botsingen uit: geen controles meer, en de ballen varen als geesten door elkaar heen.',
      ],
      formula: 'elk paar:  N × (N − 1) ÷ 2 controles\nmet een rooster:  ongeveer 10 × N',
    },
    {
      title: 'Waar blijft de stuiter?',
      paragraphs: [
        'Een bal die je laat vallen, stuitert nooit helemaal even hoog terug. De beweging is niet weg: de vloer bestaat uit atomen, aan elkaar vast als balletjes aan veertjes. Elke landing zet ze aan het trillen, en trillende atomen, dat is warmte.',
        'Links is de vloer atoom voor atoom getekend. De balken houden de boekhouding bij: de energie van de bal stroomt naar het trillen van de vloer, en het totaal blijft gelijk. De boekhouding van de natuur klopt altijd.',
        'De bak kan het niet betalen om de atomen van de vloer te simuleren. Hij neemt een kortere weg: elke stuiter houdt 82 % van de snelheid over, zoals de bal rechts, en die stuitert bijna net als de echte. Een regel die in de plaats komt van alles wat te klein is om te simuleren, heet een sluitingsmodel. Zet hieronder het stuiterverlies uit: die bal stuitert eeuwig door, en de bak ook.',
      ],
      formula: 'stuitersnelheid ← 0,82 × landingssnelheid\n(de atomen van de vloer, in één getal)',
    },
    {
      title: 'Menigten volgen wetten die geen bal kent',
      paragraphs: [
        'Geen enkele bal weet wat temperatuur is. Maar hoe sneller de ballen trillen, hoe heter de menigte: temperatuur is het gemiddelde trillen. Druk is hoe hard en hoe vaak ze tegen de wand botsen. Rechts gaat de brander hoger en lager, en thermometer en drukmeter stijgen en dalen samen.',
        'Uit zulke wetten komen stoommachines, het weer en de lucht in je longen, en niemand hoefde ze te programmeren. Ze komen uit de menigte, zoals de klokvorm uit Plinko kwam.',
        'Een paar van de allereerste computersimulaties waren ballen zoals deze. In 1953 simuleerde een van de eerste computers harde schijfjes, en in 1957 ontdekten Berni Alder en Tom Wainwright dat harde ballen, zonder enige plakkerigheid, bevriezen tot een kristal als je ze samenperst. Een van de eerste ontdekkingen ooit gedaan door te simuleren.',
      ],
      formula: 'temperatuur  ∝  gemiddelde snelheid²\ndruk  =  duwtjes tegen de wand per seconde',
    },
    {
      title: 'Kleine verschillen groeien',
      paragraphs: [
        'Rechts twee bakken: dezelfde ballen met dezelfde snelheden. In de rechterbak begint één bal een duizendste pixel opzij. Let op de kleuren: blauw betekent dat de tweelingballen nog samen zijn, rood dat ze uit elkaar zijn gegaan.',
        'Elke botsing maakt het verschil groter, tot de twee bakken niets meer met elkaar te maken hebben. Dit is chaos, het vlindereffect, en het is de reden dat een weersverwachting niet verder dan zo’n tien dagen vooruit kan kijken.',
        'Daarom rekenen weermensen niet één toekomst uit maar tientallen, elk een tikje anders, en kijken ze hoe die uiteenlopen. Jij deed hetzelfde in Plinko: één bal is geluk, driehonderd maken een kromme waar je op kunt rekenen.',
      ],
      formula: '0,001 px → verdubbelt, en verdubbelt… → de hele bak',
    },
    {
      title: 'Te veel ballen: vergelijkingen voor de menigte',
      paragraphs: [
        'Een glas water bevat ongeveer 10²⁵ moleculen: een 1 met 25 nullen. Als je dat bal voor bal uitrekent, heeft zelfs de snelste supercomputer eeuwen nodig voor één femtoseconde, een miljoenste van een miljardste seconde.',
        'Dus zoomen we uit. Rechts breken duizenden kleine ballen door een dam, en van ver weg stromen ze als water. Voor elk klein vakje houden we dan alleen bij hoe vol het is, hoe snel het spul beweegt en hoe heet het is. Dat geeft de vergelijkingen van stromingen, die in Wervel-lab en Red Nederland zitten. De 🔭-schuif in de bak doet hetzelfde.',
        'Maar gemiddelden vergeten wat het kleine spul doet: piepkleine wervels, atomen in de vloer. Regels die dat terugbrengen zijn sluitingsmodellen, zoals de 0,82 uit hoofdstuk 3. Betere vinden, tegenwoordig ook met machine learning, is een deel van het onderzoek van onze groep. Ga nu maar roeren in Wervel-lab: dat is deze bak, uitgezoomd.',
      ],
      formula: '10²⁵ moleculen  →  miljoenen vakjes\n(hoe vol, hoe snel, hoe heet)',
    },
  ],
  no: [
    {
      title: 'En ball er fem tall og én regel',
      paragraphs: [
        'Før en datamaskin kan simulere noe, bestemmer noen hva som betyr noe. For en ball er det overraskende lite: hvor den er (x, y), hvor fort den går sidelengs og opp eller ned (vx, vy), og hvor stor den er. Fem tall, og det er hele ballen. Binga fører en slik liste for hver ball.',
        'Så én regel, om og om igjen. Hvert tikk legger tyngdekraften litt til farten nedover, og ballen hopper et lite stykke langs farten sin. Binga gjør dette 240 ganger i sekundet for hver ball, og ut kommer de samme buene Galilei tegnet for kanonkuler.',
        'Det vi utelater betyr like mye: ikke noe spinn, ingen luft, ingen bulker. Å velge hva man beholder kalles å modellere. (Tyngdekraft-doodle viser hvordan selve tikkene kan gå galt.)',
      ],
      formula: 'ball = ( x , y , vx , vy , r )\nv ← v + g·dt\nx ← x + v·dt',
    },
    {
      title: 'Kollisjoner er den dyre delen',
      paragraphs: [
        'Å flytte en ball er to regnestykker. Det vanskelige er å finne ut hvem som treffer hvem. Den enkle måten er å sjekke hvert par av baller. Fire hundre baller gir 79 800 par, og binga må sjekke dem 240 ganger i sekundet.',
        'Doble ballene, og parene blir fire ganger så mange. Trikset: sorter ballene i et rutenett og sjekk bare baller i naboruter. Nå er dobbelt så mange baller bare dobbelt så mye arbeid. Til høyre sjekker den hvite ballen først alle andre baller, så bare naboene sine.',
        'Å regne ut det samme smartere, så det i det hele tatt får plass i en datamaskin, er halve beregningsvitenskapen. Slå av 🎱 kollisjoner her under: ingen sjekker i det hele tatt, og ballene seiler gjennom hverandre som gjenferd.',
      ],
      formula: 'hvert par:  N × (N − 1) ÷ 2 sjekker\nmed rutenett:  omtrent 10 × N',
    },
    {
      title: 'Hvor blir det av spretten?',
      paragraphs: [
        'En ball du slipper, spretter aldri helt like høyt tilbake. Bevegelsen er ikke borte: gulvet er laget av atomer, holdt sammen som kuler på fjærer. Hver landing får dem til å riste, og ristende atomer, det er varme.',
        'Til venstre er gulvet tegnet atom for atom. Søylene fører regnskapet: ballens energi strømmer over i gulvets risting, og summen holder seg lik. Naturens regnskap går alltid opp.',
        'Binga har ikke råd til å simulere gulvets atomer. Den tar en snarvei: hvert sprett beholder 82 % av farten, som ballen til høyre, og den spretter nesten som den ekte. En regel som står i stedet for alt som er for lite til å simulere, kalles en lukningsmodell. Slå av sprett-tapet her under: den ballen spretter for alltid, og binga også.',
      ],
      formula: 'sprettfart ← 0,82 × landingsfart\n(gulvets atomer, i ett tall)',
    },
    {
      title: 'Mengder følger lover ingen ball kjenner',
      paragraphs: [
        'Ingen ball vet hva temperatur er. Men jo fortere ballene rister, jo varmere er mengden: temperatur er gjennomsnittlig risting. Trykk er hvor hardt og hvor ofte de treffer veggen. Til høyre skrus brenneren opp og ned, og termometer og trykkmåler stiger og synker sammen.',
        'Fra slike lover kommer dampmaskiner, vær og lufta i lungene dine, og ingen måtte programmere dem. De kommer ut av mengden, slik klokkekurven kom ut av Plinko.',
        'Noen av de aller første datasimuleringene var baller som disse. I 1953 simulerte en av de første datamaskinene harde skiver, og i 1957 fant Berni Alder og Tom Wainwright ut at harde baller, helt uten klebrighet, fryser til en krystall når man klemmer dem sammen. En av de første oppdagelsene som noen gang ble gjort ved simulering.',
      ],
      formula: 'temperatur  ∝  gjennomsnittlig fart²\ntrykk  =  dytt mot veggen per sekund',
    },
    {
      title: 'Små forskjeller vokser',
      paragraphs: [
        'To bokser til høyre: de samme ballene med de samme fartene. I den høyre boksen starter én ball en tusendels piksel til siden. Se på fargene: blått betyr at tvillingballene fortsatt er sammen, rødt at de har skilt lag.',
        'Hver kollisjon gjør forskjellen større, til de to boksene ikke har noe med hverandre å gjøre. Dette er kaos, sommerfugleffekten, og det er grunnen til at et værvarsel ikke kan se mer enn rundt ti dager fram.',
        'Derfor regner meteorologer ikke ut én framtid, men dusinvis, hver litt dyttet, og ser hvordan de sprer seg. Du gjorde det samme i Plinko: én ball er flaks, tre hundre lager en kurve du kan stole på.',
      ],
      formula: '0,001 px → dobles, og dobles… → hele boksen',
    },
    {
      title: 'For mange baller: likninger for mengden',
      paragraphs: [
        'Et glass vann inneholder omtrent 10²⁵ molekyler: et ett-tall med 25 nuller. Regnet ball for ball ville selv den raskeste superdatamaskinen trenge hundrevis av år for ett femtosekund, en milliondel av en milliardtedel av et sekund.',
        'Så vi zoomer ut. Til høyre bryter tusenvis av små baller gjennom en demning, og langt unna renner de som vann. For hver lille rute tar vi så bare vare på hvor full den er, hvor fort stoffet beveger seg og hvor varmt det er. Det gir likningene for strømning, de som er inni Virvellab og Redd Nederland. 🔭-glideren i binga gjør det samme.',
        'Men gjennomsnitt glemmer hva det lille gjør: bittesmå virvler, atomer i gulvet. Regler som henter det tilbake er lukningsmodeller, som 0,82 i kapittel 3. Å finne bedre, nå også med maskinlæring, er en del av forskningen i gruppen vår. Gå og rør i Virvellab nå: det er denne binga, zoomet ut.',
      ],
      formula: '10²⁵ molekyler  →  millioner av ruter\n(hvor fullt, hvor fort, hvor varmt)',
    },
  ],
};

/** Labels for chapter 3's switch lab. */
const LAB: Localized<{
  title: string;
  on: string;
  off: string;
  collisions: string;
  friction: string;
  dissipate: string;
  note: string;
}> = {
  en: {
    title: '🧪 Try it in the pit',
    on: 'ON',
    off: 'OFF',
    collisions: '🎱 Ball collisions',
    friction: '🧤 Friction',
    dissipate: '🔥 Bounce loss (0.82)',
    note: 'This changes the demo on the right and the ball pit you return to.',
  },
  nl: {
    title: '🧪 Probeer het in de bak',
    on: 'AAN',
    off: 'UIT',
    collisions: '🎱 Botsingen',
    friction: '🧤 Wrijving',
    dissipate: '🔥 Stuiterverlies (0,82)',
    note: 'Dit verandert de demo rechts en de ballenbak waar je naar terugkeert.',
  },
  no: {
    title: '🧪 Prøv det i binga',
    on: 'PÅ',
    off: 'AV',
    collisions: '🎱 Kollisjoner',
    friction: '🧤 Friksjon',
    dissipate: '🔥 Sprett-tap (0,82)',
    note: 'Dette endrer demoen til høyre og ballbinga du kommer tilbake til.',
  },
};

/** Short captions drawn onto the canvas next to the demos. */
export const DELVE_CAPTIONS: Localized<{
  allPairs: (n: string) => string;
  gridPairs: (n: string) => string;
  noCollisions: string;
  atoms: string;
  shortcut: (e: string) => string;
  barBall: string;
  barFloor: string;
  barTotal: string;
  thermometer: string;
  pressure: string;
  difference: (px: string) => string;
  zoomIn: string;
  zooming: string;
  zoomOut: string;
  squares: string;
}> = {
  en: {
    allPairs: (n) => `every pair: ${n} checks`,
    gridPairs: (n) => `grid: ${n} checks`,
    noCollisions: 'collisions off: 0 checks',
    atoms: 'real floor: atoms on springs',
    shortcut: (e) => `the pit’s shortcut: × ${e}`,
    barBall: '⚽ ball',
    barFloor: '🔥 floor jiggle',
    barTotal: 'total — never changes!',
    thermometer: '🌡️ temperature',
    pressure: '💨 pressure',
    difference: (px) => `biggest difference: ${px} px`,
    zoomIn: 'zoomed in: balls',
    zooming: 'zooming out…',
    zoomOut: 'zoomed out: it flows like water',
    squares: 'the computer keeps only the squares',
  },
  nl: {
    allPairs: (n) => `elk paar: ${n} controles`,
    gridPairs: (n) => `rooster: ${n} controles`,
    noCollisions: 'botsingen uit: 0 controles',
    atoms: 'echte vloer: atomen aan veertjes',
    shortcut: (e) => `kortere weg van de bak: × ${e}`,
    barBall: '⚽ bal',
    barFloor: '🔥 trillende vloer',
    barTotal: 'totaal — verandert nooit!',
    thermometer: '🌡️ temperatuur',
    pressure: '💨 druk',
    difference: (px) => `grootste verschil: ${px} px`,
    zoomIn: 'ingezoomd: ballen',
    zooming: 'uitzoomen…',
    zoomOut: 'uitgezoomd: het stroomt als water',
    squares: 'de computer onthoudt alleen de vakjes',
  },
  no: {
    allPairs: (n) => `hvert par: ${n} sjekker`,
    gridPairs: (n) => `rutenett: ${n} sjekker`,
    noCollisions: 'kollisjoner av: 0 sjekker',
    atoms: 'ekte gulv: atomer på fjærer',
    shortcut: (e) => `bingas snarvei: × ${e}`,
    barBall: '⚽ ball',
    barFloor: '🔥 gulvristing',
    barTotal: 'totalt — endres aldri!',
    thermometer: '🌡️ temperatur',
    pressure: '💨 trykk',
    difference: (px) => `største forskjell: ${px} px`,
    zoomIn: 'zoomet inn: baller',
    zooming: 'zoomer ut…',
    zoomOut: 'zoomet ut: det renner som vann',
    squares: 'datamaskinen husker bare rutene',
  },
};

/** Which switches each chapter's lab carries (chapter 2: collisions; chapter 3: the losses). */
const LABS: Partial<Record<number, SwitchName[]>> = { 1: ['collisions'], 2: ['dissipate', 'friction'] };

export function bounceDelve(api: BounceDelveApi): DelveChapter[] {
  const chapters = pick(CHAPTERS);
  const lab = pick(LAB);
  return chapters.map((chapter, i) => ({
    title: chapter.title,
    paragraphs: chapter.paragraphs,
    formula: chapter.formula,
    extras: i === chapters.length - 1
      ? linkExtras(api)
      : LABS[i]
        ? (host: HTMLElement) => {
            const labEl = document.createElement('div');
            labEl.className = 'delve-lab';
            const title = document.createElement('div');
            title.className = 'delve-lab-title';
            title.textContent = lab.title;
            labEl.appendChild(title);
            for (const name of LABS[i]!) {
              const row = document.createElement('button');
              row.className = 'arcade-button';
              row.style.cssText = 'display:block;width:100%;margin-top:0.45rem;';
              const sync = () => {
                row.textContent = `${lab[name]}: ${api.getSwitch(name) ? lab.on : lab.off}`;
              };
              row.addEventListener('click', () => {
                api.setSwitch(name, !api.getSwitch(name));
                sync();
              });
              sync();
              labEl.appendChild(row);
            }
            const note = document.createElement('p');
            note.className = 'delve-lab-note';
            note.textContent = lab.note;
            labEl.appendChild(note);
            host.appendChild(labEl);
          }
        : undefined,
  }));
}
