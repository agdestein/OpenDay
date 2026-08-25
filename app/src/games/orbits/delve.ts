// Delve chapters for Gravity Doodle, in the shared chaptered style
// (shell/delve.ts): text in the card on the left, one live illustration per
// chapter drawn by the game on its canvas (index.ts drawDelve).
import type { DelveChapter } from '../../shell/delve';
import { pick, type Localized } from '../../lib/i18n';

export type Integrator = 'euler' | 'symplectic';

export interface OrbitsDelveApi {
  getIntegrator(): Integrator;
  setIntegrator(kind: Integrator): void;
}

interface ChapterText {
  title: string;
  paragraphs: string[];
  formula?: string;
}

/** The five delve chapters' text, per language. The "try it live" lab in
 * chapter 4 has its own labels below, built into a single DOM tree. */
const CHAPTERS: Localized<ChapterText[]> = {
  en: [
    {
      title: 'One speed decides the orbit',
      paragraphs: [
        'Gravity always pulls your planet straight toward the Sun — harder when it is close, weaker when it is far. The shape of the path is decided by one thing only: how fast you throw.',
        'Too slow and the planet falls into the Sun. At exactly the right speed it flies a perfect circle. A bit faster stretches the circle into an ellipse. And past the escape speed, gravity can never win: the planet leaves forever on a hyperbola.',
        'On the right, four planets are launched from the same spot, only their speed differs. The escape speed is always √2 (about 141%) of the circle speed — a fact Newton could already compute.',
        '👆 This is what the dashed preview line in the game shows while you aim: blue-green means it will orbit, orange means it is gone for good.',
      ],
      formula: 'v_escape = √2 × v_circle',
    },
    {
      title: 'Gravity pulls both ways',
      paragraphs: [
        'Newton’s law of gravity says the force grows with both masses and fades with distance squared. And his third law says the pull is mutual: the star pulls the planet, and the planet pulls back on the star with exactly the same force — look at the two orange arrows, always equal and opposite.',
        'So why does the heavy one barely move? Newton’s second law: acceleration = force ÷ mass. The same force gives the light body a big acceleration and the heavy body a tiny one. Both actually orbit their shared balance point (the little cross).',
        'That tiny wobble of the big star is real science: it is how astronomers discovered many of the first planets around other stars — not by seeing the planet, but by seeing the star wobble.',
      ],
      formula: 'F = G · m₁ · m₂ / r²',
    },
    {
      title: 'Nothing is ever lost',
      paragraphs: [
        'A planet on a stretched orbit is like a skateboarder in a half-pipe. Close to the Sun it races (lots of speed energy); far away it climbs and slows down (the speed energy is traded for height energy). That is why real comets sprint past the Sun and then crawl through the outer solar system for decades.',
        'Nothing is ever lost in the trade: the graphs below the orbit show the two energies live, and their sum is a perfectly flat line. Physicists call this conservation of energy, and it is one of the sharpest tools we have for checking whether a simulation is telling the truth.',
        'Remember that flat line — in the next chapter the computer will accidentally break it.',
      ],
      formula: 'E = ½·m·v² − G·M·m/r = constant',
    },
    {
      title: 'How the computer actually does it',
      paragraphs: [
        'A computer cannot fly a smooth curve. It plays a flip-book: where am I? Which way does gravity pull? Take a small straight step. Repeat, thousands of times per second. On the right the steps are made huge and slow so you can watch each one.',
        'The simplest recipe (Euler’s method, from 1768) has a bug you can see: each straight step jumps slightly outside the true curve, so the orbit spirals outward. The energy graph gives it away — the computer is inventing energy out of nothing!',
        'Smarter step recipes, called symplectic methods, take the step in a way that respects the energy trade. Same step size, and the orbit stays closed. Choosing clever step recipes is a real research field — it is exactly the kind of mathematics our Scientific Computing group works on.',
      ],
    },
    {
      title: 'To the Moon and back',
      paragraphs: [
        'This is not a drawing — it is this simulation flying a spacecraft with the same little steps you just watched. The little arrows show gravity’s pull at every point: almost everywhere it points to Earth, but inside the glowing disk the Moon’s own pull takes over.',
        'Watch the ghost ship: same launch, but with the Moon’s gravity switched off, it runs out of climb just short of that disk and falls back — it would never reach the Moon at all. The real ship is pulled that last stretch by the Moon itself, whipped once around it, and thrown home. The path draws a perfect figure-8: the famous free-return trajectory.',
        'Apollo astronauts flew this shape to the Moon because it has a built-in safety net: if the engine fails, you touch nothing and gravity still delivers you back to Earth — the free ride home that saved the crew of Apollo 13. Half a century later, NASA’s Artemis II, the first crewed Moon mission since 1972, was designed around the very same figure-8.',
        'Get the launch speed wrong by a fraction of a percent and the 8 falls apart. That is why space agencies simulate millions of trajectories before anyone climbs into a rocket — with the same two ingredients as this game: Newton’s gravity, plus numerical integration.',
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
        '👆 Dit is wat de gestippelde voorbeeldlijn in het spel laat zien terwijl je mikt: blauwgroen betekent dat hij in een baan komt, oranje betekent dat hij voorgoed weg is.',
      ],
      formula: 'v_ontsnapping = √2 × v_cirkel',
    },
    {
      title: 'Zwaartekracht trekt naar twee kanten',
      paragraphs: [
        'De zwaartekrachtwet van Newton zegt dat de kracht groeit met beide massa’s en afneemt met het kwadraat van de afstand. En zijn derde wet zegt dat de trekkracht wederzijds is: de ster trekt aan de planeet, en de planeet trekt met precies dezelfde kracht terug aan de ster — kijk naar de twee oranje pijlen, altijd gelijk en tegengesteld.',
        'Waarom beweegt de zware ster dan bijna niet? Newtons tweede wet: versnelling = kracht ÷ massa. Dezelfde kracht geeft het lichte lichaam een grote versnelling en het zware lichaam een piepkleine. Ze draaien allebei eigenlijk om hun gedeelde zwaartepunt (het kleine kruisje).',
        'Die kleine wiebel van de grote ster is echte wetenschap: zo hebben astronomen veel van de eerste planeten rond andere sterren ontdekt — niet door de planeet te zien, maar door de ster te zien wiebelen.',
      ],
      formula: 'F = G · m₁ · m₂ / r²',
    },
    {
      title: 'Niets gaat ooit verloren',
      paragraphs: [
        'Een planeet in een uitgerekte baan is als een skateboarder in een halfpipe. Dicht bij de Zon race hij (veel bewegingsenergie); ver weg klimt hij en vertraagt (de bewegingsenergie wordt omgezet in hoogte-energie). Daarom scheren echte kometen rakelings langs de Zon en kruipen ze daarna decennialang door het buitenste zonnestelsel.',
        'Bij die ruil gaat niets verloren: de grafieken onder de baan tonen de twee energieën live, en hun som is een volkomen vlakke lijn. Natuurkundigen noemen dit behoud van energie, en het is een van de scherpste manieren om te checken of een simulatie de waarheid vertelt.',
        'Onthoud die vlakke lijn — in het volgende hoofdstuk breekt de computer hem per ongeluk.',
      ],
      formula: 'E = ½·m·v² − G·M·m/r = constant',
    },
    {
      title: 'Hoe de computer het écht doet',
      paragraphs: [
        'Een computer kan geen vloeiende kromme vliegen. Hij speelt een flipboekje: waar ben ik? Welke kant trekt de zwaartekracht op? Zet een klein recht stapje. Herhaal dat duizenden keren per seconde. Rechts worden de stappen groot en langzaam gemaakt zodat je ze een voor een kunt zien.',
        'Het simpelste recept (de methode van Euler, uit 1768) heeft een bug die je kunt zien: elke rechte stap springt net iets buiten de echte kromme, waardoor de baan naar buiten spiraliseert. De energiegrafiek verraadt het: de computer verzint energie uit het niets!',
        'Slimmere stapmethodes, symplectische methodes genoemd, zetten de stap op een manier die de energieruil respecteert. Dezelfde stapgrootte, en de baan blijft gesloten. Het kiezen van slimme stapmethodes is een echt onderzoeksveld — precies het soort wiskunde waar onze groep Scientific Computing aan werkt.',
      ],
    },
    {
      title: 'Naar de Maan en terug',
      paragraphs: [
        'Dit is geen tekening — dit is dezelfde simulatie die een ruimteschip laat vliegen met dezelfde kleine stapjes die je net zag. De kleine pijltjes laten de trekkracht van de zwaartekracht op elk punt zien: bijna overal wijzen ze naar de Aarde, maar binnen de gloeiende schijf neemt de eigen trekkracht van de Maan het over.',
        'Kijk naar het spookschip: dezelfde lancering, maar met de zwaartekracht van de Maan uitgeschakeld komt het net te kort voor die schijf en valt het terug — het zou de Maan nooit halen. Het echte schip wordt dat laatste stukje wél door de Maan zelf getrokken, er één keer omheen geslingerd, en naar huis gestuurd. Het pad tekent een perfecte 8: de beroemde free-returnbaan.',
        'Apollo-astronauten vlogen deze vorm naar de Maan omdat er een ingebouwd vangnet in zit: als de motor uitvalt, hoef je niets aan te raken en brengt de zwaartekracht je alsnog terug naar de Aarde — de gratis rit naar huis die de bemanning van Apollo 13 redde. Een halve eeuw later werd NASA’s Artemis II, de eerste bemande maanmissie sinds 1972, ontworpen rond diezelfde 8.',
        'Zit je een fractie van een procent naast de juiste lanceersnelheid, dan valt de 8 uit elkaar. Daarom simuleren ruimtevaartorganisaties miljoenen banen voordat iemand in een raket stapt — met dezelfde twee ingrediënten als dit spel: de zwaartekracht van Newton, plus numerieke integratie.',
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
        '👆 Dette er det den stiplede forhåndsvisningslinjen i spillet viser mens du sikter: blågrønt betyr at den kommer i bane, oransje betyr at den er tapt for godt.',
      ],
      formula: 'v_unnslip = √2 × v_sirkel',
    },
    {
      title: 'Tyngdekraften trekker begge veier',
      paragraphs: [
        'Newtons gravitasjonslov sier at kraften vokser med begge massene og avtar med avstanden i annen. Og hans tredje lov sier at draget er gjensidig: stjernen trekker i planeten, og planeten trekker like hardt tilbake i stjernen — se på de to oransje pilene, alltid like store og motsatt rettet.',
        'Hvorfor beveger den tunge seg da nesten ikke? Newtons andre lov: akselerasjon = kraft ÷ masse. Samme kraft gir det lette legemet stor akselerasjon og det tunge en veldig liten. Begge går faktisk i bane rundt sitt felles tyngdepunkt (det lille krysset).',
        'Den lille vaklingen til den store stjernen er ekte vitenskap: slik oppdaget astronomer mange av de første planetene rundt andre stjerner — ikke ved å se planeten, men ved å se stjernen vakle.',
      ],
      formula: 'F = G · m₁ · m₂ / r²',
    },
    {
      title: 'Ingenting går noensinne tapt',
      paragraphs: [
        'En planet i en strukket bane er som en skateboarder i en halfpipe. Nær Solen suser den av gårde (mye bevegelsesenergi); langt unna klatrer den og bremser opp (bevegelsesenergien byttes mot høydeenergi). Derfor suser ekte kometer forbi Solen for så å krype gjennom det ytre solsystemet i tiår.',
        'Ingenting går tapt i byttet: grafene under banen viser de to energiene live, og summen deres er en helt flat linje. Fysikere kaller dette bevaring av energi, og det er et av de skarpeste verktøyene vi har for å sjekke om en simulering snakker sant.',
        'Husk den flate linjen — i neste kapittel kommer datamaskinen til å ødelegge den ved et uhell.',
      ],
      formula: 'E = ½·m·v² − G·M·m/r = konstant',
    },
    {
      title: 'Hvordan datamaskinen faktisk gjør det',
      paragraphs: [
        'En datamaskin kan ikke fly en jevn kurve. Den spiller en tegneseriebok: hvor er jeg? Hvilken vei trekker tyngdekraften? Ta et lite rett steg. Gjenta, tusenvis av ganger i sekundet. Til høyre er stegene gjort store og trege så du kan se hvert eneste ett.',
        'Den enkleste oppskriften (Eulers metode, fra 1768) har en feil du kan se: hvert rette steg hopper litt utenfor den ekte kurven, så banen spiraler utover. Energigrafen avslører det — datamaskinen finner opp energi ut av ingenting!',
        'Smartere stegoppskrifter, kalt symplektiske metoder, tar steget på en måte som respekterer energibyttet. Samme stegstørrelse, men banen holder seg lukket. Å velge smarte stegoppskrifter er et ekte forskningsfelt — nøyaktig den typen matematikk vår Scientific Computing-gruppe jobber med.',
      ],
    },
    {
      title: 'Til Månen og hjem igjen',
      paragraphs: [
        'Dette er ikke en tegning — det er denne simuleringen som flyr et romfartøy med de samme små stegene du nettopp så. De små pilene viser tyngdekraftens drag i hvert punkt: nesten overalt peker de mot Jorden, men inne i den glødende skiven tar Månens eget drag over.',
        'Følg med på spøkelsesskipet: samme oppskyting, men med Månens tyngdekraft slått av, går det tomt for fart rett før den skiven og faller tilbake — det ville aldri nådd Månen. Det ekte skipet blir dratt det siste stykket av Månen selv, svingt én gang rundt den, og sendt hjem. Banen tegner et perfekt 8-tall: den berømte free-return-banen.',
        'Apollo-astronautene fløy denne formen til Månen fordi den har et innebygd sikkerhetsnett: hvis motoren svikter, trenger du ikke røre noe, og tyngdekraften bringer deg likevel hjem til Jorden — den gratis hjemturen som reddet mannskapet på Apollo 13. Et halvt århundre senere ble NASAs Artemis II, det første bemannede måneoppdraget siden 1972, designet rundt akkurat det samme 8-tallet.',
        'Bommer du på oppskytingsfarten med en brøkdel av en prosent, faller 8-tallet fra hverandre. Derfor simulerer romfartsorganisasjoner millioner av baner før noen klatrer inn i en rakett — med de samme to ingrediensene som i dette spillet: Newtons tyngdekraft, pluss numerisk integrasjon.',
      ],
    },
  ],
};

/** Labels for the chapter-4 "try it live" integrator-switch lab. */
const LAB: Localized<{ title: string; toSymplectic: string; toEuler: string; note: string }> = {
  en: {
    title: '🧪 Try it live',
    toSymplectic: '🪄 Switch to smart (symplectic) steps',
    toEuler: '↩ Back to simple (Euler) steps',
    note: 'Watch the orbit and the energy line: simple steps drift outward and gain energy; smart steps wobble a little but never drift away.',
  },
  nl: {
    title: '🧪 Probeer het zelf',
    toSymplectic: '🪄 Schakel over naar slimme (symplectische) stappen',
    toEuler: '↩ Terug naar simpele (Euler-)stappen',
    note: 'Let op de baan en de energielijn: simpele stappen drijven naar buiten en winnen energie; slimme stappen wiebelen een beetje maar drijven nooit weg.',
  },
  no: {
    title: '🧪 Prøv det live',
    toSymplectic: '🪄 Bytt til smarte (symplektiske) steg',
    toEuler: '↩ Tilbake til enkle (Euler-)steg',
    note: 'Følg med på banen og energilinjen: enkle steg driver utover og vinner energi; smarte steg vakler litt, men driver aldri bort.',
  },
};

export function orbitsDelve(api: OrbitsDelveApi): DelveChapter[] {
  const chapters = pick(CHAPTERS);
  const lab = pick(LAB);
  return chapters.map((chapter, i) => ({
    title: chapter.title,
    paragraphs: chapter.paragraphs,
    formula: chapter.formula,
    // Only chapter 4 (index 3) has an interactive lab; the DOM-building logic
    // lives here once and just pulls its labels from `lab`.
    extras:
      i === 3
        ? (host: HTMLElement) => {
            const labEl = document.createElement('div');
            labEl.className = 'delve-lab';
            const title = document.createElement('div');
            title.className = 'delve-lab-title';
            title.textContent = lab.title;
            labEl.appendChild(title);

            const button = document.createElement('button');
            button.className = 'arcade-button';
            button.style.marginTop = '0.6rem';
            const sync = () => {
              button.textContent = api.getIntegrator() === 'euler' ? lab.toSymplectic : lab.toEuler;
            };
            button.addEventListener('click', () => {
              api.setIntegrator(api.getIntegrator() === 'euler' ? 'symplectic' : 'euler');
              sync();
            });
            sync();
            labEl.appendChild(button);

            const note = document.createElement('p');
            note.className = 'delve-lab-note';
            note.textContent = lab.note;
            labEl.appendChild(note);
            host.appendChild(labEl);
          }
        : undefined,
  }));
}
