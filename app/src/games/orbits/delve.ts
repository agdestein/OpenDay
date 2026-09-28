// Delve chapters for Gravity Doodle, in the shared chaptered style
// (shell/delve.ts): text in the card on the left, one live illustration per
// chapter drawn by the game on its canvas (demos.ts). One arc, from one orbit
// to "we cannot know one future": speed decides the shape; everything pulls
// on everything; the computer steps (and can cheat on energy); three bodies
// have no formula; the free return to the Moon; and clouds of possible
// asteroids. The step lab switches the demo and the toy; the last chapter and
// the step chapter end with doors into the arcade's other games.
import type { DelveChapter } from '../../shell/delve';
import { pick, type Localized } from '../../lib/i18n';
import type { ThreeBody } from './demos';

export type Integrator = 'euler' | 'symplectic';

export interface OrbitsDelveApi {
  getIntegrator(): Integrator;
  setIntegrator(kind: Integrator): void;
  getThreeBody(): ThreeBody;
  setThreeBody(mode: ThreeBody): void;
  hasGame(id: string): boolean;
  openGame(id: string): void;
}

interface ChapterText {
  title: string;
  paragraphs: string[];
  formula?: string;
}

/** The six chapters' text, per language; the labs' labels follow below. */
const CHAPTERS: Localized<ChapterText[]> = {
  en: [
    {
      title: 'One speed decides the orbit',
      paragraphs: [
        'Gravity always pulls your planet straight toward the Sun — harder when it is close, weaker when it is far. The shape of the path is decided by one thing only: how fast you throw.',
        'Too slow and the planet falls into the Sun. At exactly the right speed it flies a perfect circle. A bit faster stretches the circle into an ellipse. And past the escape speed, gravity can never win: the planet leaves forever on a hyperbola.',
        'On the right, four planets are launched from the same spot, only their speed differs. The escape speed is always √2 (about 141%) of the circle speed — a fact Newton could already compute.',
        '👆 This is what the dashed 🔮 forecast in the game shows while you aim: green means it will orbit, yellow a huge orbit, orange gone for good, and red a crash.',
      ],
      formula: 'v_escape = √2 × v_circle',
    },
    {
      title: 'Everything pulls on everything',
      paragraphs: [
        'Newton’s law of gravity says the force grows with both masses and fades with distance squared. And his third law says the pull is mutual: the star pulls the planet, and the planet pulls back on the star with exactly the same force — look at the two orange arrows, always equal and opposite.',
        'So why does the heavy one barely move? Newton’s second law: acceleration = force ÷ mass. The same force gives the light body a big acceleration and the heavy body a tiny one. Both actually orbit their shared balance point (the little cross).',
        'That tiny wobble of the big star is real science: it is how astronomers discovered many of the first planets around other stars — not by seeing the planet, but by seeing the star wobble.',
        'In the game every body pulls on every other one too: throw a giant and watch the Sun wobble, and switch on 🕸 Gravity to see each mass press its own dent into space.',
      ],
      formula: 'F = G · m₁ · m₂ / r²',
    },
    {
      title: 'Nothing is lost — unless the computer cheats',
      paragraphs: [
        'A planet on a stretched orbit is like a skateboarder in a half-pipe: close to the Sun it races, far away it climbs and slows. Speed energy and height energy trade places, but their sum never changes — one of the sharpest tests of whether a simulation tells the truth.',
        'A computer cannot fly a smooth curve. It plays a flip-book: where am I, which way does gravity pull? Take a small straight step, and repeat — about 150 a second. On the right the steps are made huge.',
        'The simplest recipe (Euler’s, from 1768) lands every step a little outside the curve: the orbit spirals outward and the energy climbs — the computer invents energy. Smarter, symplectic recipes keep the trade fair, and the orbit stays closed. Designing such recipes for wind and turbulence is part of our group’s research.',
      ],
      formula: 'E = ½·m·v² − G·M·m/r = constant',
    },
    {
      title: 'Three is too many for a formula',
      paragraphs: [
        'For one planet and a sun, Newton could write the whole future down as a formula: the ellipse. Add a third body and no such formula exists. In 1889 Henri Poincaré won a king’s prize for work on whether the solar system is stable — then found a mistake, and in fixing it discovered chaos.',
        'On the right, two copies of the same three stars; in the second (the rings) one star starts a millionth to the side. For a while they dance in step, then they part completely. Tiny differences grow — the reason weather forecasts stop after about ten days.',
        'This puzzle (Burrau, 1913) was only solved by computer, in 1967: two stars pair up and the third is thrown out. With three or more bodies the only way to know the future is to compute it, step by step — that is what scientific computing is for.',
        'Not every dance is wild: in the figure-8, found by computer in 1993, the twins stay together much longer.',
      ],
    },
    {
      title: 'To the Moon and back',
      paragraphs: [
        'This is not a drawing: it is this simulation flying a spacecraft, with the same little steps. The arrows show gravity’s pull; inside the glowing disk the Moon’s pull takes over.',
        'The ghost ship has the Moon’s gravity switched off: it falls back short of the disk. The real ship is pulled in by the Moon, whipped around it and thrown home — a figure-8, the famous free-return path.',
        'If the engine fails on this path, gravity still brings you home. When Apollo 13’s oxygen tank exploded, the crew fired the lunar lander’s engine to get back onto it. In April 2026 Artemis II flew the same figure-8.',
        'Miss the launch speed by a fraction of a percent and the 8 falls apart — so space agencies simulate millions of paths first, with the same two ingredients as this game: Newton’s gravity and small steps.',
      ],
    },
    {
      title: 'Will it hit us?',
      paragraphs: [
        'Telescopes never measure an asteroid perfectly, so nobody knows its exact orbit. So we don’t compute one future — we compute hundreds: a cloud of possible asteroids, each flown by the same simulation. The share of the cloud that hits Earth is the chance of impact.',
        'Every new look through a telescope shrinks the cloud — and the chance can go up before it goes down. In early 2025 the asteroid 2024 YR4 briefly had a 3 % chance of hitting Earth in 2032, the highest ever measured for one its size. More looks brought it to practically zero.',
        'And if one is coming? In 2022 NASA’s DART spacecraft crashed into the little asteroid Dimorphos and changed its orbit by about half an hour: proof that we can push. ESA’s Hera arrives there at the end of 2026 to measure exactly what the push did. The earlier you push, the smaller the push needs to be.',
        'Many futures instead of one is how our group works too: the chance that a dike breaks, how sure a weather map is, where a crowd of balls lands. Try them:',
      ],
    },
  ],
  nl: [
    {
      title: 'Eén snelheid bepaalt de baan',
      paragraphs: [
        'Zwaartekracht trekt je planeet altijd recht naar de Zon toe — harder als hij dichtbij is, zwakker als hij ver weg is. De vorm van de baan wordt maar door één ding bepaald: hoe hard je gooit.',
        'Te langzaam en de planeet valt in de Zon. Bij precies de juiste snelheid vliegt hij een perfecte cirkel. Iets sneller rekt de cirkel uit tot een ellips. En voorbij de ontsnappingssnelheid kan de zwaartekracht nooit meer winnen: de planeet vertrekt voorgoed op een hyperbool.',
        'Rechts worden vier planeten vanaf dezelfde plek gelanceerd, alleen hun snelheid verschilt. De ontsnappingssnelheid is altijd √2 (ongeveer 141%) van de cirkelsnelheid — iets wat Newton al kon uitrekenen.',
        '👆 Dit is wat de gestippelde 🔮 voorspelling in het spel laat zien terwijl je mikt: groen betekent een baan, geel een enorme baan, oranje voorgoed weg, en rood een botsing.',
      ],
      formula: 'v_ontsnapping = √2 × v_cirkel',
    },
    {
      title: 'Alles trekt aan alles',
      paragraphs: [
        'De zwaartekrachtwet van Newton zegt dat de kracht groeit met beide massa’s en afneemt met het kwadraat van de afstand. En zijn derde wet zegt dat de trekkracht wederzijds is: de ster trekt aan de planeet, en de planeet trekt met precies dezelfde kracht terug aan de ster — kijk naar de twee oranje pijlen, altijd gelijk en tegengesteld.',
        'Waarom beweegt de zware ster dan bijna niet? Newtons tweede wet: versnelling = kracht ÷ massa. Dezelfde kracht geeft het lichte lichaam een grote versnelling en het zware lichaam een piepkleine. Ze draaien allebei eigenlijk om hun gedeelde zwaartepunt (het kleine kruisje).',
        'Die kleine wiebel van de grote ster is echte wetenschap: zo hebben astronomen veel van de eerste planeten rond andere sterren ontdekt — niet door de planeet te zien, maar door de ster te zien wiebelen.',
        'In het spel trekt ook elk hemellichaam aan elk ander: gooi een reus en kijk hoe de Zon wiebelt, en zet 🕸 Zwaartekracht aan om te zien hoe elke massa zijn eigen deuk in de ruimte drukt.',
      ],
      formula: 'F = G · m₁ · m₂ / r²',
    },
    {
      title: 'Niets gaat verloren — tenzij de computer vals speelt',
      paragraphs: [
        'Een planeet in een uitgerekte baan is als een skateboarder in een halfpipe: dicht bij de Zon racet hij, ver weg klimt hij en vertraagt. Bewegingsenergie en hoogte-energie ruilen van plaats, maar hun som verandert nooit — een van de scherpste manieren om na te gaan of een simulatie de waarheid vertelt.',
        'Een computer kan geen vloeiende kromme vliegen. Hij speelt een flipboekje: waar ben ik, welke kant trekt de zwaartekracht op? Zet een klein recht stapje, en herhaal — zo’n 150 per seconde. Rechts zijn de stappen reusachtig gemaakt.',
        'Het simpelste recept (dat van Euler, uit 1768) komt bij elke stap net buiten de kromme uit: de baan draait in een spiraal naar buiten en de energie klimt — de computer verzint energie. Slimmere, symplectische recepten houden de ruil eerlijk, en de baan blijft gesloten. Zulke recepten ontwerpen voor wind en turbulentie is deel van het onderzoek van onze groep.',
      ],
      formula: 'E = ½·m·v² − G·M·m/r = constant',
    },
    {
      title: 'Drie is te veel voor een formule',
      paragraphs: [
        'Voor één planeet en een zon kon Newton de hele toekomst als formule opschrijven: de ellips. Voeg een derde hemellichaam toe en zo’n formule bestaat niet. In 1889 won Henri Poincaré een koninklijke prijs voor werk aan de vraag of het zonnestelsel stabiel is — vond toen een fout, en ontdekte bij het herstellen de chaos.',
        'Rechts staan twee kopieën van dezelfde drie sterren; in de tweede (de ringen) begint één ster een miljoenste opzij. Een tijdje dansen ze gelijk op, dan gaan ze helemaal uit elkaar. Piepkleine verschillen groeien — daarom stoppen weersverwachtingen na ongeveer tien dagen.',
        'Deze puzzel (Burrau, 1913) werd pas in 1967 door een computer opgelost: twee sterren vormen een paar en de derde wordt weggeslingerd. Met drie of meer hemellichamen kun je de toekomst alleen kennen door hem uit te rekenen, stap voor stap — daar is scientific computing voor.',
        'Niet elke dans is wild: bij de 8, in 1993 door een computer gevonden, blijven de tweelingen veel langer samen.',
      ],
    },
    {
      title: 'Naar de Maan en terug',
      paragraphs: [
        'Dit is geen tekening: het is deze simulatie die een ruimteschip laat vliegen, met dezelfde kleine stapjes. De pijltjes tonen de trekkracht van de zwaartekracht; binnen de gloeiende schijf neemt de Maan het over.',
        'Bij het spookschip staat de zwaartekracht van de Maan uit: het valt vóór de schijf terug. Het echte schip wordt door de Maan binnengetrokken, eromheen geslingerd en naar huis gegooid — een 8, de beroemde ‘gratis terugweg’ (free return).',
        'Valt op deze baan de motor uit, dan brengt de zwaartekracht je toch thuis. Toen de zuurstoftank van Apollo 13 ontplofte, gaf de bemanning gas met de motor van de maanlander om er weer op te komen. In april 2026 vloog Artemis II dezelfde 8.',
        'Zit je een fractie van een procent naast de juiste lanceersnelheid, dan valt de 8 uit elkaar — daarom simuleren ruimtevaartorganisaties eerst miljoenen banen, met dezelfde twee ingrediënten als dit spel: de zwaartekracht van Newton en kleine stapjes.',
      ],
    },
    {
      title: 'Raakt hij ons?',
      paragraphs: [
        'Telescopen meten een planetoïde nooit perfect, dus niemand kent zijn precieze baan. Daarom rekenen we niet één toekomst uit maar honderden: een wolk van mogelijke planetoïden, allemaal gevlogen door dezelfde simulatie. Het deel van de wolk dat de Aarde raakt, is de kans op inslag.',
        'Elke nieuwe blik door een telescoop maakt de wolk kleiner — en de kans kan eerst stijgen voordat hij daalt. Begin 2025 had planetoïde 2024 YR4 even 3 % kans om de Aarde te raken in 2032, de hoogste ooit gemeten voor een planetoïde van die grootte. Meer metingen brachten hem terug tot vrijwel nul.',
        'En als er echt een aankomt? In 2022 knalde NASA’s ruimtesonde DART op de kleine planetoïde Dimorphos en veranderde zijn baan met ongeveer een half uur: het bewijs dat we kunnen duwen. ESA’s Hera komt daar eind 2026 aan om precies te meten wat de duw deed. Hoe eerder je duwt, hoe kleiner de duw hoeft te zijn.',
        'Veel toekomsten in plaats van één: zo werkt onze groep ook — de kans dat een dijk doorbreekt, hoe zeker een weerkaart is, waar een menigte ballen landt. Probeer ze:',
      ],
    },
  ],
  no: [
    {
      title: 'Én fart avgjør banen',
      paragraphs: [
        'Tyngdekraften trekker alltid planeten din rett mot Solen — hardere når den er nær, svakere når den er langt unna. Formen på banen avgjøres av bare én ting: hvor fort du kaster.',
        'For sakte, og planeten faller i Solen. Med akkurat riktig fart flyr den en perfekt sirkel. Litt fortere strekker sirkelen seg til en ellipse. Og forbi unnslipningshastigheten kan tyngdekraften aldri vinne: planeten forlater for godt på en hyperbel.',
        'Til høyre skytes fire planeter opp fra samme sted, bare farten er ulik. Unnslipningshastigheten er alltid √2 (omtrent 141 %) av sirkelfarten — noe Newton allerede kunne regne ut.',
        '👆 Dette er det den stiplede 🔮 spådommen i spillet viser mens du sikter: grønt betyr bane, gult en enorm bane, oransje borte for godt, og rødt en kollisjon.',
      ],
      formula: 'v_unnslip = √2 × v_sirkel',
    },
    {
      title: 'Alt trekker i alt',
      paragraphs: [
        'Newtons gravitasjonslov sier at kraften vokser med begge massene og avtar med avstanden i annen. Og hans tredje lov sier at draget er gjensidig: stjernen trekker i planeten, og planeten trekker like hardt tilbake i stjernen — se på de to oransje pilene, alltid like store og motsatt rettet.',
        'Hvorfor beveger den tunge seg da nesten ikke? Newtons andre lov: akselerasjon = kraft ÷ masse. Samme kraft gir det lette legemet stor akselerasjon og det tunge en veldig liten. Begge går faktisk i bane rundt sitt felles tyngdepunkt (det lille krysset).',
        'Den lille vaklingen til den store stjernen er ekte vitenskap: slik oppdaget astronomer mange av de første planetene rundt andre stjerner — ikke ved å se planeten, men ved å se stjernen vakle.',
        'I spillet trekker også hvert legeme i alle de andre: kast en kjempe og se Solen vakle, og slå på 🕸 Tyngdekraft for å se hver masse trykke sin egen bulk i rommet.',
      ],
      formula: 'F = G · m₁ · m₂ / r²',
    },
    {
      title: 'Ingenting går tapt — med mindre datamaskinen jukser',
      paragraphs: [
        'En planet i en strukket bane er som en skateboarder i en halfpipe: nær Solen suser den, langt unna klatrer den og bremser opp. Bevegelsesenergi og høydeenergi bytter plass, men summen endrer seg aldri — en av de skarpeste testene på om en simulering snakker sant.',
        'En datamaskin kan ikke fly en jevn kurve. Den spiller en tegneseriebok: hvor er jeg, hvilken vei trekker tyngdekraften? Ta et lite rett steg, og gjenta — rundt 150 i sekundet. Til høyre er stegene gjort enorme.',
        'Den enkleste oppskriften (Eulers, fra 1768) lander hvert steg litt utenfor kurven: banen spiraler utover og energien klatrer — datamaskinen finner opp energi. Smartere, symplektiske oppskrifter holder byttet rettferdig, og banen holder seg lukket. Å lage slike oppskrifter for vind og turbulens er en del av forskningen i gruppen vår.',
      ],
      formula: 'E = ½·m·v² − G·M·m/r = konstant',
    },
    {
      title: 'Tre er for mange for en formel',
      paragraphs: [
        'For én planet og en sol kunne Newton skrive hele fremtiden som en formel: ellipsen. Legg til et tredje legeme, og en slik formel finnes ikke. I 1889 vant Henri Poincaré en kongelig pris for arbeid med spørsmålet om solsystemet er stabilt — fant så en feil, og oppdaget kaos da han rettet den.',
        'Til høyre er to kopier av de samme tre stjernene; i den andre (ringene) starter én stjerne en milliondel til siden. En stund danser de i takt, så går de helt hver sin vei. Bittesmå forskjeller vokser — derfor stopper værmeldinger etter omtrent ti dager.',
        'Dette puslespillet (Burrau, 1913) ble først løst av en datamaskin, i 1967: to stjerner danner et par, og den tredje kastes ut. Med tre eller flere legemer er den eneste måten å kjenne fremtiden på å regne den ut, steg for steg — det er det scientific computing er til for.',
        'Ikke alle danser er ville: i 8-tallet, funnet av en datamaskin i 1993, holder tvillingene sammen mye lenger.',
      ],
    },
    {
      title: 'Til Månen og hjem igjen',
      paragraphs: [
        'Dette er ikke en tegning: det er denne simuleringen som flyr et romfartøy, med de samme små stegene. Pilene viser tyngdekraftens drag; inne i den glødende skiven tar Månen over.',
        'Spøkelsesskipet har Månens tyngdekraft slått av: det faller tilbake før skiven. Det ekte skipet blir dratt inn av Månen, svingt rundt den og kastet hjem — et 8-tall, den berømte free-return-banen.',
        'Svikter motoren på denne banen, bringer tyngdekraften deg likevel hjem. Da oksygentanken på Apollo 13 eksploderte, fyrte mannskapet av månelandingsfartøyets motor for å komme inn på den igjen. I april 2026 fløy Artemis II det samme 8-tallet.',
        'Bommer du på oppskytingsfarten med en brøkdel av en prosent, faller 8-tallet fra hverandre — derfor simulerer romfartsorganisasjoner millioner av baner først, med de samme to ingrediensene som i dette spillet: Newtons tyngdekraft og små steg.',
      ],
    },
    {
      title: 'Treffer den oss?',
      paragraphs: [
        'Teleskoper måler aldri en asteroide perfekt, så ingen kjenner den nøyaktige banen. Derfor regner vi ikke ut én fremtid, men hundrevis: en sky av mulige asteroider, alle fløyet av den samme simuleringen. Andelen av skyen som treffer Jorden, er sjansen for nedslag.',
        'Hver ny titt gjennom et teleskop krymper skyen — og sjansen kan gå opp før den går ned. Tidlig i 2025 hadde asteroiden 2024 YR4 en kort stund 3 % sjanse for å treffe Jorden i 2032, den høyeste noensinne målt for en asteroide på den størrelsen. Flere målinger brakte den ned til praktisk talt null.',
        'Og hvis en faktisk kommer? I 2022 krasjet NASAs romsonde DART inn i den lille asteroiden Dimorphos og endret banen med omtrent en halvtime: beviset på at vi kan dytte. ESAs Hera kommer fram dit i slutten av 2026 for å måle nøyaktig hva dyttet gjorde. Jo tidligere du dytter, jo mindre dytt trengs.',
        'Mange fremtider i stedet for én: slik jobber gruppen vår også — sjansen for at et dike brister, hvor sikkert et værkart er, hvor en mengde baller lander. Prøv dem:',
      ],
    },
  ],
};

/** Labels for the labs: the step switch (chapter 3), the three-body switch (chapter 4), and the doors. */
const LAB: Localized<{
  title: string;
  toSymplectic: string;
  toEuler: string;
  note: string;
  wild: string;
  dance: string;
  sameIdea: string;
  manyFutures: string;
  games: Record<string, string>;
}> = {
  en: {
    title: '🧪 Try it live',
    toSymplectic: '🪄 Switch to smart (symplectic) steps',
    toEuler: '↩ Back to simple (Euler) steps',
    note: 'Simple steps drift outward and gain energy; smart steps wobble but never drift away. The switch works in the game too (the 🧮 slider).',
    wild: '🌪 Three stars let go',
    dance: '✨ The figure-8 dance',
    sameIdea: '🌀 The same care for energy, in wind:',
    manyFutures: '🎲 Many futures, in our other games:',
    games: { windfarm: '🌀 Play Swirl Lab', floodland: '🌊 Play Save the Netherlands', detective: '🌡️ Play Weather Detective', bounce: '🏀 Play Ball Pit' },
  },
  nl: {
    title: '🧪 Probeer het zelf',
    toSymplectic: '🪄 Schakel over naar slimme (symplectische) stappen',
    toEuler: '↩ Terug naar simpele (Euler-)stappen',
    note: 'Simpele stappen drijven naar buiten en winnen energie; slimme stappen wiebelen maar drijven nooit weg. De schakelaar werkt ook in het spel (de 🧮-schuif).',
    wild: '🌪 Drie sterren losgelaten',
    dance: '✨ De 8-dans',
    sameIdea: '🌀 Dezelfde zorg voor energie, in wind:',
    manyFutures: '🎲 Veel toekomsten, in onze andere spellen:',
    games: { windfarm: '🌀 Speel Wervel-lab', floodland: '🌊 Speel Red Nederland', detective: '🌡️ Speel Weerdetective', bounce: '🏀 Speel Ballenbak' },
  },
  no: {
    title: '🧪 Prøv det live',
    toSymplectic: '🪄 Bytt til smarte (symplektiske) steg',
    toEuler: '↩ Tilbake til enkle (Euler-)steg',
    note: 'Enkle steg driver utover og vinner energi; smarte steg vakler, men driver aldri bort. Bryteren virker i spillet også (🧮-glideren).',
    wild: '🌪 Tre stjerner sluppet',
    dance: '✨ 8-tallsdansen',
    sameIdea: '🌀 Den samme omtanken for energi, i vind:',
    manyFutures: '🎲 Mange fremtider, i de andre spillene våre:',
    games: { windfarm: '🌀 Spill Virvellab', floodland: '🌊 Spill Redd Nederland', detective: '🌡️ Spill Værdetektiv', bounce: '🏀 Spill Ballbinge' },
  },
};

function labBox(host: HTMLElement, titleText: string): HTMLElement {
  const box = document.createElement('div');
  box.className = 'delve-lab';
  const title = document.createElement('div');
  title.className = 'delve-lab-title';
  title.textContent = titleText;
  box.appendChild(title);
  host.appendChild(box);
  return box;
}

function labButton(box: HTMLElement, text: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'arcade-button';
  button.style.cssText = 'display:block;width:100%;margin-top:0.45rem;';
  button.textContent = text;
  button.addEventListener('click', onClick);
  box.appendChild(button);
  return button;
}

/** Doors into other games (only those on this machine's menu). */
function doors(api: OrbitsDelveApi, title: string, ids: string[]): ((host: HTMLElement) => void) | null {
  const lab = pick(LAB);
  const games = ids.filter((id) => api.hasGame(id));
  if (games.length === 0) return null;
  return (host) => {
    const box = labBox(host, title);
    for (const id of games) labButton(box, lab.games[id], () => api.openGame(id));
  };
}

export function orbitsDelve(api: OrbitsDelveApi): DelveChapter[] {
  const chapters = pick(CHAPTERS);
  const lab = pick(LAB);

  // Chapter 3: switch the step recipe (the demo beside it and the toy behind it), then a door to Swirl Lab.
  const stepLab = (host: HTMLElement) => {
    const box = labBox(host, lab.title);
    const button = labButton(box, '', () => {
      api.setIntegrator(api.getIntegrator() === 'euler' ? 'symplectic' : 'euler');
      sync();
    });
    const sync = () => (button.textContent = api.getIntegrator() === 'euler' ? lab.toSymplectic : lab.toEuler);
    sync();
    const note = document.createElement('p');
    note.className = 'delve-lab-note';
    note.textContent = lab.note;
    box.appendChild(note);
    doors(api, lab.sameIdea, ['windfarm'])?.(host);
  };

  // Chapter 4: wild three or the figure-8 dance.
  const threeLab = (host: HTMLElement) => {
    const box = labBox(host, lab.title);
    const buttons: [HTMLButtonElement, ThreeBody][] = [];
    const sync = () => buttons.forEach(([b, m]) => b.classList.toggle('active', api.getThreeBody() === m));
    for (const [text, mode] of [[lab.wild, 'wild'], [lab.dance, 'dance']] as const) {
      buttons.push([labButton(box, text, () => { api.setThreeBody(mode); sync(); }), mode]);
    }
    sync();
  };

  const extras: (((host: HTMLElement) => void) | null)[] = [
    null,
    null,
    stepLab,
    threeLab,
    null,
    doors(api, lab.manyFutures, ['floodland', 'detective', 'bounce']),
  ];
  return chapters.map((chapter, i) => ({
    title: chapter.title,
    paragraphs: chapter.paragraphs,
    formula: chapter.formula,
    extras: extras[i] ?? undefined,
  }));
}
