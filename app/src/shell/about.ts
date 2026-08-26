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
        "Scientific calculation was the original reason to build computers at all — before the machines, 'computer' was a job title: a person calculating by hand.",
        "CWI's predecessor, the Mathematisch Centrum, built the first computer in the Netherlands (the ARRA, 1952). After the 1953 flood it helped compute the storm surges behind the Delta Works that protect the country today.",
      ],
    },
    {
      emoji: '🔬',
      title: 'CWI and our group',
      paragraphs: [
        'CWI is the Dutch national research institute for mathematics and computer science, at Amsterdam Science Park. Our Scientific Computing group develops the mathematics that makes simulations faster and more trustworthy.',
        "The same craft applies everywhere: we have worked on turbulence and wind energy, epidemic spread, dike safety, and the uncertainty in climate-scale models.",
      ],
    },
    {
      emoji: '🎮',
      title: 'And these games?',
      paragraphs: [
        'Every game in this arcade runs a genuine simulation — a miniature version of what runs on supercomputers. The wind farm solves flow equations, the flood game moves real shallow water, the outbreak follows a true epidemic model.',
        "Curious? Open any game and press '🔬 How does this work?' to look under the hood.",
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
        "Wetenschappelijk rekenwerk was dé reden om überhaupt computers te bouwen — vóór de machines was 'computer' een beroep: iemand die met de hand rekende.",
        'De voorloper van het CWI, het Mathematisch Centrum, bouwde de eerste computer van Nederland (de ARRA, 1952). Na de watersnoodramp van 1953 hielp het de stormvloedberekeningen te maken achter de Deltawerken die het land vandaag beschermen.',
      ],
    },
    {
      emoji: '🔬',
      title: 'CWI en onze groep',
      paragraphs: [
        'Het CWI is het nationale onderzoeksinstituut voor wiskunde en informatica, op het Amsterdam Science Park. Onze Scientific Computing-groep ontwikkelt de wiskunde die simulaties sneller en betrouwbaarder maakt.',
        'Hetzelfde vak duikt overal op: we werkten aan turbulentie en windenergie, de verspreiding van epidemieën, dijkveiligheid en de onzekerheid in klimaatmodellen.',
      ],
    },
    {
      emoji: '🎮',
      title: 'En deze spellen?',
      paragraphs: [
        'Elk spel in deze arcade draait een echte simulatie — een minivariant van wat op supercomputers draait. Het windpark lost stromingsvergelijkingen op, het overstromingsspel verplaatst echt ondiep water, de uitbraak volgt een echt epidemiemodel.',
        "Nieuwsgierig? Open een spel en druk op '🔬 Hoe werkt dit?' om onder de motorkap te kijken.",
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
        "Vitenskapelige beregninger var selve grunnen til å bygge datamaskiner — før maskinene var 'computer' en jobbtittel: et menneske som regnet for hånd.",
        'CWIs forgjenger, Mathematisch Centrum, bygde Nederlands første datamaskin (ARRA, 1952). Etter stormflommen i 1953 hjalp det til med stormflo-beregningene bak Deltaverkene som beskytter landet i dag.',
      ],
    },
    {
      emoji: '🔬',
      title: 'CWI og gruppen vår',
      paragraphs: [
        'CWI er Nederlands nasjonale forskningsinstitutt for matematikk og informatikk, på Amsterdam Science Park. Scientific Computing-gruppen vår utvikler matematikken som gjør simuleringer raskere og mer pålitelige.',
        'Det samme håndverket dukker opp overalt: vi har jobbet med turbulens og vindkraft, epidemispredning, dikesikkerhet og usikkerheten i klimamodeller.',
      ],
    },
    {
      emoji: '🎮',
      title: 'Og disse spillene?',
      paragraphs: [
        'Hvert spill i denne arkaden kjører en ekte simulering — en miniversjon av det som kjører på superdatamaskiner. Vindparken løser strømningsligninger, flomspillet flytter ekte gruntvann, utbruddet følger en ekte epidemimodell.',
        "Nysgjerrig? Åpne et spill og trykk på '🔬 Hvordan virker dette?' for å se under panseret.",
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
