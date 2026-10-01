// "How does this work?" layer on the menu: cards that explain the big picture
// behind the whole arcade — nature becomes equations, equations become
// simulations — plus who we are and why CWI is the place where this happens.
// The per-game delve panels dig into each game's specific science; this layer
// carries the one message the stand exists for.

import { pick, type Localized } from '../lib/i18n';

interface AboutCard {
  emoji: string;
  title: string;
  paragraphs: string[];
}

const HEADING: Localized<string> = {
  en: 'The science behind the arcade',
  nl: 'De wetenschap achter de arcade',
  no: 'Vitenskapen bak arkaden',
};

const CARDS: Localized<AboutCard[]> = {
  en: [
    {
      emoji: '🍎',
      title: 'Nature speaks mathematics',
      paragraphs: [
        'How a ball falls, how water flows, how a disease spreads — nature follows rules, and those rules can be written down as mathematical equations.',
        "Once you have the equations, you can predict things that haven't happened yet: tomorrow's weather, the next high tide, the path of a spacecraft.",
      ],
    },
    {
      emoji: '🧮',
      title: 'What is scientific computing?',
      paragraphs: [
        'Real-world equations are usually far too hard to solve with pen and paper — nobody can work out the swirls of the wind by hand.',
        'The trick: chop space into tiny pieces and time into tiny steps, so the computer only ever solves easy little problems — billions of them per second. The result is a simulation. Inventing ways to do this fast and accurately is the field called scientific computing.',
      ],
    },
    {
      emoji: '🖥️',
      title: 'Why computers were built',
      paragraphs: [
        "Scientific calculation was one of the main reasons to build computers at all — before the machines, 'computer' was a job title: a person calculating by hand.",
        "CWI's predecessor, the Mathematisch Centrum, built the first computer in the Netherlands (the ARRA, 1952). After the 1953 flood, one of its founders, David van Dantzig, worked out how high the dikes must be — his way of calculating is still used today.",
      ],
    },
    {
      emoji: '🔬',
      title: 'CWI and our group',
      paragraphs: [
        'CWI is the Dutch national research institute for mathematics and computer science, at Amsterdam Science Park. Our Scientific Computing group develops the mathematics that makes simulations faster and more trustworthy.',
        "The same craft applies everywhere: we have worked on turbulence and wind energy, epidemics, dike safety, weather maps with KNMI, AI that speeds up simulations, and uncertainty in climate models.",
      ],
    },
    {
      emoji: '🎮',
      title: 'And these games?',
      paragraphs: [
        'Every game in this arcade runs a genuine simulation — a miniature version of what runs on supercomputers: wind, water, an epidemic, the weather, walking creatures, a pit of balls and a sky full of planets.',
        "Curious? Open any game and press '🔬 How does this work?' to look under the hood.",
      ],
    },
    {
      emoji: '🍳',
      title: 'One recipe for everything',
      paragraphs: [
        '📜 a rule of nature → 🔲 chop the world into squares or balls → ⏱ take tiny steps in time → 🎲 run many possible futures.',
        'Every game here follows that recipe, from the wind to the planets. One run is luck; many runs are science. Doing this well is our job.',
      ],
    },
  ],
  nl: [
    {
      emoji: '🍎',
      title: 'De natuur spreekt wiskunde',
      paragraphs: [
        'Hoe een bal valt, hoe water stroomt, hoe een ziekte zich verspreidt — de natuur volgt regels, en die regels kun je opschrijven als wiskundige vergelijkingen.',
        'Heb je de vergelijkingen eenmaal, dan kun je voorspellen wat nog niet gebeurd is: het weer van morgen, het volgende hoogwater, de baan van een ruimtesonde.',
      ],
    },
    {
      emoji: '🧮',
      title: 'Wat is scientific computing?',
      paragraphs: [
        'Vergelijkingen uit de echte wereld zijn meestal veel te moeilijk om met pen en papier op te lossen — niemand kan de wervels van de wind met de hand uitrekenen.',
        'De truc: hak de ruimte in kleine stukjes en de tijd in kleine stapjes, zodat de computer alleen maar makkelijke mini-sommetjes hoeft op te lossen — wel miljarden per seconde. Het resultaat is een simulatie. Manieren bedenken om dat snel en nauwkeurig te doen, dát is scientific computing.',
      ],
    },
    {
      emoji: '🖥️',
      title: 'Waarom computers zijn gebouwd',
      paragraphs: [
        "Wetenschappelijk rekenwerk was een van de belangrijkste redenen om computers te bouwen — vóór de machines was 'computer' een beroep: iemand die met de hand rekende.",
        'De voorloper van het CWI, het Mathematisch Centrum, bouwde de eerste computer van Nederland (de ARRA, 1952). Na de watersnoodramp van 1953 berekende een van de oprichters, David van Dantzig, hoe hoog de dijken moeten zijn — zijn manier van rekenen wordt nog steeds gebruikt.',
      ],
    },
    {
      emoji: '🔬',
      title: 'CWI en onze groep',
      paragraphs: [
        'Het CWI is het nationale onderzoeksinstituut voor wiskunde en informatica, op het Amsterdam Science Park. Onze Scientific Computing-groep ontwikkelt de wiskunde die simulaties sneller en betrouwbaarder maakt.',
        'Hetzelfde vak duikt overal op: we werkten aan turbulentie en windenergie, epidemieën, dijkveiligheid, weerkaarten met het KNMI, AI die simulaties versnelt en onzekerheid in klimaatmodellen.',
      ],
    },
    {
      emoji: '🎮',
      title: 'En deze spellen?',
      paragraphs: [
        'Elk spel in deze arcade draait een echte simulatie — een minivariant van wat op supercomputers draait: wind, water, een epidemie, het weer, lopende beestjes, een bak vol ballen en een hemel vol planeten.',
        "Nieuwsgierig? Open een spel en druk op '🔬 Hoe werkt dit?' om onder de motorkap te kijken.",
      ],
    },
    {
      emoji: '🍳',
      title: 'Eén recept voor alles',
      paragraphs: [
        '📜 een regel uit de natuur → 🔲 hak de wereld in vakjes of balletjes → ⏱ zet kleine stapjes in de tijd → 🎲 reken veel mogelijke toekomsten door.',
        'Elk spel hier volgt dat recept, van de wind tot de planeten. Eén keer rekenen is geluk; heel vaak rekenen is wetenschap. Dat goed doen is ons vak.',
      ],
    },
  ],
  no: [
    {
      emoji: '🍎',
      title: 'Naturen snakker matematikk',
      paragraphs: [
        'Hvordan en ball faller, hvordan vann strømmer, hvordan en sykdom sprer seg — naturen følger regler, og reglene kan skrives ned som matematiske ligninger.',
        'Har du først ligningene, kan du forutsi ting som ikke har skjedd ennå: morgendagens vær, neste springflo, banen til en romsonde.',
      ],
    },
    {
      emoji: '🧮',
      title: 'Hva er scientific computing?',
      paragraphs: [
        'Ligninger fra den virkelige verden er som regel altfor vanskelige å løse med penn og papir — ingen kan regne ut vindens virvler for hånd.',
        'Trikset: del rommet i små biter og tiden i små steg, slik at datamaskinen bare trenger å løse enkle småstykker — riktignok milliarder av dem i sekundet. Resultatet er en simulering. Å finne opp måter å gjøre dette raskt og nøyaktig på, dét er scientific computing.',
      ],
    },
    {
      emoji: '🖥️',
      title: 'Derfor ble datamaskinen bygget',
      paragraphs: [
        "Vitenskapelige beregninger var en av hovedgrunnene til å bygge datamaskiner — før maskinene var 'computer' en jobbtittel: et menneske som regnet for hånd.",
        'CWIs forgjenger, Mathematisch Centrum, bygde Nederlands første datamaskin (ARRA, 1952). Etter stormflommen i 1953 regnet en av grunnleggerne, David van Dantzig, ut hvor høye dikene må være — hans måte å regne på brukes fortsatt.',
      ],
    },
    {
      emoji: '🔬',
      title: 'CWI og gruppen vår',
      paragraphs: [
        'CWI er Nederlands nasjonale forskningsinstitutt for matematikk og informatikk, på Amsterdam Science Park. Scientific Computing-gruppen vår utvikler matematikken som gjør simuleringer raskere og mer pålitelige.',
        'Det samme håndverket dukker opp overalt: vi har jobbet med turbulens og vindkraft, epidemier, dikesikkerhet, værkart med KNMI, KI som gjør simuleringer raskere, og usikkerhet i klimamodeller.',
      ],
    },
    {
      emoji: '🎮',
      title: 'Og disse spillene?',
      paragraphs: [
        'Hvert spill i denne arkaden kjører en ekte simulering — en miniversjon av det som kjører på superdatamaskiner: vind, vann, en epidemi, været, gående skapninger, en binge full av baller og en himmel full av planeter.',
        "Nysgjerrig? Åpne et spill og trykk på '🔬 Hvordan virker dette?' for å se under panseret.",
      ],
    },
    {
      emoji: '🍳',
      title: 'Én oppskrift for alt',
      paragraphs: [
        '📜 en regel fra naturen → 🔲 del verden opp i ruter eller baller → ⏱ ta små steg i tiden → 🎲 regn gjennom mange mulige fremtider.',
        'Hvert spill her følger den oppskriften, fra vinden til planetene. Én kjøring er flaks; mange kjøringer er vitenskap. Å gjøre dette godt er jobben vår.',
      ],
    },
  ],
};

/** Full-screen card layer over the menu; the caller owns showing/removing it. */
export function renderAbout(): HTMLElement {
  const layer = document.createElement('div');
  layer.className = 'about-layer';

  const content = document.createElement('div');
  content.className = 'about-content';
  layer.appendChild(content);

  const heading = document.createElement('h2');
  heading.textContent = pick(HEADING);
  content.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'about-cards';
  for (const card of pick(CARDS)) {
    const el = document.createElement('div');
    el.className = 'about-card';
    const emoji = document.createElement('span');
    emoji.className = 'about-card-emoji';
    emoji.textContent = card.emoji;
    const title = document.createElement('h3');
    title.textContent = card.title;
    el.append(emoji, title);
    for (const text of card.paragraphs) {
      const p = document.createElement('p');
      p.textContent = text;
      el.appendChild(p);
    }
    grid.appendChild(el);
  }
  content.appendChild(grid);

  return layer;
}
