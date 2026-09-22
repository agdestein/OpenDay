// Delve chapters for Swirl Lab, in the shared chaptered style (shell/delve.ts).
// The card holds the words and small diagrams; the running fluid simulation
// next to it is the live illustration of every chapter (delvestage.ts):
// arrows, cells, pressure and swirl fields, magnifier lenses, turbine wakes.
// The fluid stays stirrable while you read.
import type { DelveChapter } from '../../shell/delve';
import { fmtNumber, pick, type Localized } from '../../lib/i18n';
import type { FieldView } from './fluid';
import { CELL_STEPS } from './delvestage';

export interface WindfarmDelveApi {
  /** Cells chapter: current slider stop (index into CELL_STEPS) and setter. */
  cellStep(): number;
  setCellStep(step: number): void;
  /** Cells chapter: the real grid's size, for the finest slider stop. */
  gridSize(): [number, number];
  /** Cells for a given across count (square cells on this screen). */
  cellsDown(across: number): number;
  /** Rules chapter: the field on show, and setter. */
  rulesView(): FieldView;
  setRulesView(view: FieldView): void;
}

interface Rule {
  view: FieldView;
  /** The matching term of the Navier–Stokes equation. */
  term: string;
  name: string;
  text: string;
}

interface Texts {
  arrows: { title: string; paragraphs: string[]; formula: string };
  cells: { title: string; paragraphs: string[]; formula: string; slider: string; cells: string; realGrid: string };
  rules: { title: string; intro: string; rules: Rule[]; hint: string; outro: string };
  turbulence: {
    title: string;
    paragraphs: string[];
    quote: string;
    quoteBy: string;
    ladder: { computed: string; modelled: string; marks: [number, string][] };
  };
  wakes: { title: string; paragraphs: string[]; formula: string; wind: string; power: string };
}

// Ladder marks: [meters, label]. The shared axis runs 1 mm to 10 km.
const TEXTS: Localized<Texts> = {
  en: {
    arrows: {
      title: 'Wind is a field of arrows',
      paragraphs: [
        'To a computer, wind is not a thing you can hold — it is a field: at every spot there is an arrow saying which way the air moves there, and how fast. Long arrow: fast. Short arrow: slow.',
        '👉 Stir on the right and watch the arrows swing around. The colored smoke doesn’t push anything — it just rides along on the arrows, like leaves on a river.',
      ],
      formula: 'at every spot:  arrow = (speed →, speed ↑)',
    },
    cells: {
      title: 'Chop the sky into cells',
      paragraphs: [
        'The air has infinitely many spots, and no computer can store infinitely many arrows. So we chop space into a grid of cells and keep one arrow per cell. This trick is called discretization — it is where numerical mathematics begins.',
        '👉 Drag the slider. With big cells, every swirl smaller than a cell is lost. Point at a cell to see the two numbers it stores.',
        'Finer cells cost more: halve the cell size and you need four times as many cells — and twice as many time steps, because the wind may not skip over a cell in one step. Eight times the work!',
      ],
      formula: '½ × cell size  →  4 × cells × 2 × steps = 8 × work',
      slider: 'Cell size',
      cells: 'cells',
      realGrid: 'the real grid',
    },
    rules: {
      title: 'Three rules for every cell',
      intro:
        'Sixty times a second, every cell updates its arrow using the Navier–Stokes equations, written down 200 years ago. They look scary, but they say three simple things:',
      rules: [
        { view: 'dye', term: '(u·∇)u', name: '🚚 Carry', text: 'Air carries itself along: every arrow drifts with the flow — and so does the smoke.' },
        { view: 'pressure', term: '−∇p', name: '💨 Push', text: 'Air hates being squeezed. Where it piles up, pressure rises (red) and pushes it away; where it thins out, pressure drops (blue).' },
        { view: 'swirl', term: 'ν∇²u', name: '🌀 Rub', text: 'Fast air rubs past slow air and starts to spin. Swirls: orange one way round, blue the other.' },
      ],
      hint: '👉 Tap a rule to see its field on the right.',
      outro:
        'Nobody can solve these equations with pen and paper. There is even a $1,000,000 prize just for proving they always have well-behaved solutions. So the computer does it cell by cell — that craft is numerical mathematics, and it is what our group does.',
    },
    turbulence: {
      title: 'Turbulence: swirls inside swirls',
      paragraphs: [
        'Stir hard and the flow turns turbulent: big swirls break into smaller swirls, which break into even smaller ones, until the tiniest fade away as a whiff of heat.',
        '👉 Point anywhere to aim the magnifiers. They zoom in 4× and 16×, and there are swirls inside the swirls. At 16× you reach the computer’s cells — anything smaller cannot exist in this simulation.',
        'Around a real wind farm, swirls range from kilometres down to millimetres. Computing all of them would take about 10²⁰ cells; the biggest supercomputers manage around 10¹². So real simulations compute the big swirls and use a clever mathematical model for the small ones. Inventing such models is one of our group’s specialties.',
      ],
      quote:
        '“Big whirls have little whirls that feed on their velocity, and little whirls have lesser whirls, and so on to viscosity.”',
      quoteBy: '— Lewis Fry Richardson, 1922',
      ladder: {
        computed: 'computed',
        modelled: 'modelled',
        marks: [
          [10000, 'wind farm'],
          [150, 'turbine'],
          [1.5, 'you'],
          [0.001, 'tiniest swirl'],
        ],
      },
    },
    wakes: {
      title: 'Wakes are money',
      paragraphs: [
        'A turbine takes its power out of the wind by slowing it down — so behind every turbine hangs a wake of slow air. 👉 On the right, the second turbine stands in the first one’s wake: see how the streaks get shorter where the air is slow.',
        'Power grows with the cube of the wind speed: at ¾ of the wind speed you get less than half the power (¾ × ¾ × ¾ ≈ 0.42). The bars under each turbine show it live — a small dip in wind is a big dip in power.',
        'That is why wind-farm layout is a puzzle — and the wind turns, too. The 🤖 computer opponent tests every spot for all wind directions with a quick wake formula. Real designers start the same way, then check with big simulations like this one: simulating wind for wind energy is part of our group’s daily work.',
      ],
      formula: 'power ∝ (wind speed)³',
      wind: 'wind',
      power: 'power',
    },
  },
  nl: {
    arrows: {
      title: 'Wind is een veld vol pijlen',
      paragraphs: [
        'Voor een computer is wind geen ding dat je vast kunt pakken, maar een veld: op elke plek staat een pijl die zegt welke kant de lucht daar op gaat, en hoe snel. Lange pijl: snel. Korte pijl: langzaam.',
        '👉 Roer rechts en kijk hoe de pijlen meedraaien. De gekleurde rook duwt nergens tegen — hij lift gewoon mee op de pijlen, zoals blaadjes op een rivier.',
      ],
      formula: 'op elke plek:  pijl = (snelheid →, snelheid ↑)',
    },
    cells: {
      title: 'Hak de lucht in cellen',
      paragraphs: [
        'De lucht heeft oneindig veel plekken, en geen computer kan oneindig veel pijlen onthouden. Dus hakken we de ruimte in een raster van cellen en bewaren we één pijl per cel. Die truc heet discretisatie — daar begint de numerieke wiskunde.',
        '👉 Sleep de schuif. Met grote cellen gaat elke wervel die kleiner is dan een cel verloren. Wijs een cel aan om de twee getallen te zien die hij onthoudt.',
        'Fijnere cellen kosten meer: maak de cellen half zo groot en je hebt vier keer zoveel cellen nodig — en twee keer zoveel tijdstapjes, want de wind mag in één stap niet over een cel heen springen. Acht keer zoveel werk!',
      ],
      formula: '½ × celgrootte  →  4 × cellen × 2 × stappen = 8 × werk',
      slider: 'Celgrootte',
      cells: 'cellen',
      realGrid: 'het echte raster',
    },
    rules: {
      title: 'Drie regels voor elke cel',
      intro:
        'Zestig keer per seconde werkt elke cel zijn pijl bij met de Navier–Stokes-vergelijkingen, 200 jaar geleden opgeschreven. Ze zien er eng uit, maar ze zeggen drie simpele dingen:',
      rules: [
        { view: 'dye', term: '(u·∇)u', name: '🚚 Meevoeren', text: 'Lucht voert zichzelf mee: elke pijl drijft mee met de stroming — en de rook ook.' },
        { view: 'pressure', term: '−∇p', name: '💨 Duwen', text: 'Lucht laat zich niet graag samenpersen. Waar hij zich ophoopt stijgt de druk (rood) en duwt hem weg; waar hij dun wordt daalt de druk (blauw).' },
        { view: 'swirl', term: 'ν∇²u', name: '🌀 Wrijven', text: 'Snelle lucht schuurt langs langzame lucht en gaat draaien. Wervels: oranje de ene kant op, blauw de andere.' },
      ],
      hint: '👉 Tik op een regel om zijn veld rechts te zien.',
      outro:
        'Niemand kan deze vergelijkingen met pen en papier oplossen. Er is zelfs een prijs van $1.000.000 voor alleen al het bewijs dat ze altijd nette oplossingen hebben. Dus doet de computer het cel voor cel — dat vak heet numerieke wiskunde, en het is wat onze groep doet.',
    },
    turbulence: {
      title: 'Turbulentie: wervels in wervels',
      paragraphs: [
        'Roer hard en de stroming wordt turbulent: grote wervels breken op in kleinere wervels, die weer in nog kleinere, tot de allerkleinsten verdwijnen als een zuchtje warmte.',
        '👉 Wijs ergens naar om de vergrootglazen te richten. Ze zoomen 4× en 16× in, en in de wervels zitten weer wervels. Bij 16× kom je bij de cellen van de computer — kleiner dan dat kan in deze simulatie niet bestaan.',
        'Rond een echt windpark gaan wervels van kilometers tot millimeters. Ze allemaal uitrekenen zou zo’n 10²⁰ cellen kosten; de grootste supercomputers halen er zo’n 10¹². Echte simulaties rekenen daarom de grote wervels uit en gebruiken een slim wiskundig model voor de kleine. Zulke modellen bedenken is een van de specialiteiten van onze groep.',
      ],
      quote:
        '„Grote wervels hebben kleine wervels, die zich voeden met hun vaart; en kleine wervels kleinere, tot de stroperigheid ze stopt.”',
      quoteBy: '— vrij naar Lewis Fry Richardson, 1922',
      ladder: {
        computed: 'uitgerekend',
        modelled: 'gemodelleerd',
        marks: [
          [10000, 'windpark'],
          [150, 'turbine'],
          [1.5, 'jij'],
          [0.001, 'kleinste wervel'],
        ],
      },
    },
    wakes: {
      title: 'Zog is geld',
      paragraphs: [
        'Een turbine haalt zijn vermogen uit de wind door hem af te remmen — achter elke turbine hangt dus een zog van langzame lucht. 👉 Rechts staat de tweede turbine in het zog van de eerste: zie hoe de streepjes korter worden waar de lucht langzaam is.',
        'Vermogen groeit met de derde macht van de windsnelheid: bij ¾ van de windsnelheid krijg je minder dan de helft van het vermogen (¾ × ¾ × ¾ ≈ 0,42). De balkjes onder elke turbine laten het live zien — een klein dipje in de wind is een grote dip in vermogen.',
        'Daarom is een windpark ontwerpen een puzzel — en de wind draait ook nog. De 🤖 computertegenstander test met een snelle zog-formule elke plek voor alle windrichtingen. Echte ontwerpers beginnen net zo, en controleren daarna met grote simulaties zoals deze: wind simuleren voor windenergie is het dagelijkse werk van onze groep.',
      ],
      formula: 'vermogen ∝ (windsnelheid)³',
      wind: 'wind',
      power: 'vermogen',
    },
  },
  no: {
    arrows: {
      title: 'Vind er et felt av piler',
      paragraphs: [
        'For en datamaskin er ikke vind en ting du kan holde i — det er et felt: på hvert sted står det en pil som sier hvilken vei luften beveger seg der, og hvor fort. Lang pil: fort. Kort pil: sakte.',
        '👉 Rør til høyre og se pilene svinge rundt. Den fargede røyken dytter ikke på noe — den blir bare med pilene, som blader på en elv.',
      ],
      formula: 'på hvert sted:  pil = (fart →, fart ↑)',
    },
    cells: {
      title: 'Del lufta opp i celler',
      paragraphs: [
        'Lufta har uendelig mange steder, og ingen datamaskin kan huske uendelig mange piler. Så vi deler rommet opp i et rutenett av celler og beholder én pil per celle. Det trikset heter diskretisering — det er der numerisk matematikk begynner.',
        '👉 Dra i glidebryteren. Med store celler forsvinner hver virvel som er mindre enn en celle. Pek på en celle for å se de to tallene den husker.',
        'Finere celler koster mer: halver cellestørrelsen, og du trenger fire ganger så mange celler — og dobbelt så mange tidssteg, fordi vinden ikke får hoppe over en celle i ett steg. Åtte ganger så mye arbeid!',
      ],
      formula: '½ × cellestørrelse  →  4 × celler × 2 × steg = 8 × arbeid',
      slider: 'Cellestørrelse',
      cells: 'celler',
      realGrid: 'det ekte rutenettet',
    },
    rules: {
      title: 'Tre regler for hver celle',
      intro:
        'Seksti ganger i sekundet oppdaterer hver celle pilen sin med Navier–Stokes-ligningene, skrevet ned for 200 år siden. De ser skumle ut, men de sier tre enkle ting:',
      rules: [
        { view: 'dye', term: '(u·∇)u', name: '🚚 Bære', text: 'Luften bærer seg selv med seg: hver pil driver med strømmen — og det gjør røyken også.' },
        { view: 'pressure', term: '−∇p', name: '💨 Dytte', text: 'Luft liker ikke å bli klemt. Der den hoper seg opp, stiger trykket (rødt) og dytter den unna; der den tynnes ut, synker trykket (blått).' },
        { view: 'swirl', term: 'ν∇²u', name: '🌀 Gni', text: 'Rask luft gnir mot langsom luft og begynner å snurre. Virvler: oransje den ene veien rundt, blå den andre.' },
      ],
      hint: '👉 Trykk på en regel for å se feltet dens til høyre.',
      outro:
        'Ingen kan løse disse ligningene med penn og papir. Det finnes til og med en pris på $1 000 000 bare for å bevise at de alltid har pene løsninger. Så datamaskinen gjør det celle for celle — det håndverket heter numerisk matematikk, og det er det gruppen vår driver med.',
    },
    turbulence: {
      title: 'Turbulens: virvler i virvler',
      paragraphs: [
        'Rør hardt, og strømningen blir turbulent: store virvler brytes opp i mindre virvler, og de igjen i enda mindre, helt til de aller minste forsvinner som et pust av varme.',
        '👉 Pek hvor som helst for å sikte med forstørrelsesglassene. De zoomer inn 4× og 16×, og inni virvlene er det nye virvler. Ved 16× kommer du ned til datamaskinens celler — noe mindre kan ikke finnes i denne simuleringen.',
        'Rundt en ekte vindpark går virvlene fra kilometer ned til millimeter. Å regne ut alle ville kreve rundt 10²⁰ celler; de største superdatamaskinene klarer rundt 10¹². Ekte simuleringer regner derfor ut de store virvlene og bruker en smart matematisk modell for de små. Å finne opp slike modeller er en av gruppens spesialiteter.',
      ],
      quote:
        '«Store virvler har små virvler som lever av farten deres, og små virvler mindre virvler, helt ned til seigheten stopper dem.»',
      quoteBy: '— fritt etter Lewis Fry Richardson, 1922',
      ladder: {
        computed: 'regnet ut',
        modelled: 'modellert',
        marks: [
          [10000, 'vindpark'],
          [150, 'turbin'],
          [1.5, 'du'],
          [0.001, 'minste virvel'],
        ],
      },
    },
    wakes: {
      title: 'Kjølvann er penger',
      paragraphs: [
        'En turbin henter kraften sin ut av vinden ved å bremse den — bak hver turbin henger det derfor et kjølvann av langsom luft. 👉 Til høyre står den andre turbinen i kjølvannet til den første: se hvordan strekene blir kortere der luften er langsom.',
        'Kraften vokser med tredje potens av vindfarten: ved ¾ av vindfarten får du mindre enn halvparten av kraften (¾ × ¾ × ¾ ≈ 0,42). Stolpene under hver turbin viser det live — en liten dupp i vinden er en stor dupp i kraft.',
        'Derfor er det et puslespill å planlegge en vindpark — og vinden snur i tillegg. 🤖-datamotstanderen tester hver plass for alle vindretningene med en rask kjølvannsformel. Ekte designere begynner på samme måte, og sjekker så med store simuleringer som denne: å simulere vind for vindkraft er en del av gruppens daglige arbeid.',
      ],
      formula: 'kraft ∝ (vindfart)³',
      wind: 'vind',
      power: 'kraft',
    },
  },
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Cells chapter: the cell-size slider with a live cell count. */
function cellsSlider(host: HTMLElement, T: Texts['cells'], api: WindfarmDelveApi): void {
  const box = el('div', 'delve-lab');
  const row = el('label', 'delve-slider-row');
  const name = el('span', undefined, T.slider);
  const input = el('input');
  input.type = 'range';
  input.min = '0';
  input.max = String(CELL_STEPS.length - 1);
  input.step = '1';
  // The slider runs from big cells (left) to small cells (right).
  input.value = String(api.cellStep());
  const out = el('output');
  row.append(name, input);
  const readout = el('p', 'delve-cells-readout');
  readout.appendChild(out);
  const update = () => {
    const step = Number(input.value);
    api.setCellStep(step);
    const across = CELL_STEPS[step];
    const [w, h] = across > 0 ? [across, api.cellsDown(across)] : api.gridSize();
    out.textContent = `${w} × ${h} = ${fmtNumber(w * h)} ${T.cells}${across > 0 ? '' : ` (${T.realGrid})`}`;
  };
  input.addEventListener('input', update);
  update();
  box.append(row, readout);
  host.appendChild(box);
}

/** Rules chapter: the equation with color-coded terms, and one button per rule. */
function rulesLab(host: HTMLElement, T: Texts['rules'], api: WindfarmDelveApi): void {
  const box = el('div', 'delve-rules');
  const formula = el('p', 'delve-formula ns-formula');
  const terms = new Map<FieldView, HTMLElement>();
  const part = (text: string, view?: FieldView) => {
    const span = el('span', view ? `ns-term ns-${view}` : undefined, text);
    if (view) terms.set(view, span);
    formula.appendChild(span);
  };
  part('∂u/∂t + ');
  part(T.rules[0].term, 'dye');
  part(' = ');
  part(T.rules[1].term, 'pressure');
  part(' + ');
  part(T.rules[2].term, 'swirl');

  const buttons = T.rules.map((rule) => {
    const button = el('button', `delve-rule ns-${rule.view}`);
    button.append(el('strong', undefined, rule.name), el('span', undefined, rule.text));
    button.addEventListener('click', () => select(rule.view));
    return { rule, button };
  });
  const select = (view: FieldView) => {
    api.setRulesView(view);
    for (const { rule, button } of buttons) button.classList.toggle('active', rule.view === view);
    for (const [v, span] of terms) span.classList.toggle('active', v === view);
  };
  box.append(formula, ...buttons.map((b) => b.button), el('p', 'delve-lab-note', T.hint));
  host.appendChild(box);
  select(api.rulesView());
}

/**
 * Turbulence chapter: a log-scale ladder from 1 mm to 10 km with familiar
 * sizes, and which part a simulation computes versus models.
 */
function scaleLadder(host: HTMLElement, T: Texts['turbulence']): void {
  const box = el('div', 'delve-ladder');
  const quote = el('blockquote', 'delve-quote', T.quote);
  quote.appendChild(el('cite', undefined, T.quoteBy));
  // Axis from 1e-3 m to 1e4 m: position = (log10(m) + 3) / 7, largest on the left.
  const pos = (m: number) => 100 - ((Math.log10(m) + 3) / 7) * 100;
  const axis = el('div', 'ladder-axis');
  T.ladder.marks.forEach(([m, label], i) => {
    const mark = el('div', 'ladder-mark');
    mark.style.left = `${pos(m)}%`;
    const text = el('span', undefined, label);
    // Labels near the ends hang inward instead of spilling off the card.
    const p = pos(m);
    text.style.transform = p < 12 ? 'none' : p > 88 ? 'translateX(-100%)' : 'translateX(-50%)';
    // Alternate rows, so neighbouring labels never collide.
    text.style.top = i % 2 ? '1.1rem' : '0';
    mark.appendChild(text);
    axis.appendChild(mark);
  });
  const ticks = el('div', 'ladder-ticks');
  for (const [m, label] of [
    [10000, '10 km'],
    [1000, '1 km'],
    [100, '100 m'],
    [10, '10 m'],
    [1, '1 m'],
    [0.1, '10 cm'],
    [0.01, '1 cm'],
    [0.001, '1 mm'],
  ] as [number, string][]) {
    const tick = el('span', undefined, label);
    tick.style.left = `${pos(m)}%`;
    ticks.appendChild(tick);
  }
  // A 10^12-cell supercomputer run spans ~10^4 per direction: 10 km down to 1 m.
  const bars = el('div', 'ladder-bars');
  const computed = el('span', 'ladder-computed', T.ladder.computed);
  computed.style.width = `${pos(1)}%`;
  const modelled = el('span', 'ladder-modelled', T.ladder.modelled);
  modelled.style.width = `${100 - pos(1)}%`;
  bars.append(computed, modelled);
  box.append(quote, axis, bars, ticks);
  host.appendChild(box);
}

/** Wakes chapter: the cube law as three pairs of bars. */
function cubeChart(host: HTMLElement, T: Texts['wakes']): void {
  const box = el('div', 'delve-cube');
  for (const wind of [1, 0.75, 0.5]) {
    const col = el('div', 'cube-col');
    const pair = el('div', 'cube-pair');
    const w = el('span', 'cube-bar bar-wind');
    w.style.height = `${wind * 100}%`;
    const p = el('span', 'cube-bar bar-power');
    p.style.height = `${wind ** 3 * 100}%`;
    pair.append(w, p);
    col.append(
      pair,
      el('span', 'cube-label', `${T.wind} ${Math.round(wind * 100)}%`),
      el('span', 'cube-label cube-power', `${T.power} ${Math.round(wind ** 3 * 100)}%`),
    );
    box.appendChild(col);
  }
  host.appendChild(box);
}

export function windfarmDelve(api: WindfarmDelveApi): DelveChapter[] {
  const T = pick(TEXTS);
  return [
    { title: T.arrows.title, paragraphs: T.arrows.paragraphs, formula: T.arrows.formula },
    {
      title: T.cells.title,
      paragraphs: T.cells.paragraphs,
      formula: T.cells.formula,
      extras: (host) => cellsSlider(host, T.cells, api),
    },
    {
      title: T.rules.title,
      paragraphs: [T.rules.intro],
      extras: (host) => {
        rulesLab(host, T.rules, api);
        host.appendChild(el('p', 'delve-lab-note delve-outro', T.rules.outro));
      },
    },
    {
      title: T.turbulence.title,
      paragraphs: T.turbulence.paragraphs,
      extras: (host) => scaleLadder(host, T.turbulence),
    },
    {
      title: T.wakes.title,
      paragraphs: T.wakes.paragraphs,
      formula: T.wakes.formula,
      extras: (host) => cubeChart(host, T.wakes),
    },
  ];
}
