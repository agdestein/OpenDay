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
        'A planet on a stretched orbit is like a skateboarder in a half-pipe: close to the Sun it races, far away it climbs and slows down. Speed energy and height energy trade places, but their sum never changes. Physicists call this conservation of energy, and it is one of the sharpest tests of whether a simulation tells the truth.',
        'A computer cannot fly a smooth curve. It plays a flip-book: where am I? Which way does gravity pull? Take a small straight step, and repeat — the game does about 150 a second. On the right the steps are made huge so you can watch each one.',
        'The simplest recipe (Euler’s method, from 1768) has a bug you can see: every straight step lands a little outside the curve, the orbit spirals outward, and the energy line climbs — the computer invents energy out of nothing. Smarter recipes, called symplectic, take the step so that the energy trade stays fair: same steps, and the orbit stays closed.',
        'Cleverness beats brute force: to stay as close to the true orbit for five laps, the simple recipe needs about a hundred times as many steps, and the longer you simulate, the worse it gets. Designing step recipes that keep energy honest — for wind and turbulence rather than planets — is part of our group’s research.',
      ],
      formula: 'E = ½·m·v² − G·M·m/r = constant',
    },
    {
      title: 'Three is too many for a formula',
      paragraphs: [
        'For one planet and a sun, Newton could write the whole future down as a formula: the ellipse. Add a third body and no such formula exists. In 1889 King Oscar II of Sweden and Norway gave a prize for proving that the solar system is stable. Henri Poincaré won it — then found a mistake in his own work, and in fixing it discovered chaos.',
        'On the right are two copies of the same three stars, let go from rest on a triangle. In the second copy (the rings) one star starts a millionth to the side. For a while they dance in step; then they part ways completely. Tiny differences grow — the same reason weather forecasts stop after about ten days.',
        'This very puzzle (Burrau, 1913) was only solved by computer, in 1967: after a long wild dance two stars pair up and the third is thrown out. With three or more bodies the only way to know the future is to compute it, step by step. That is what scientific computing is for.',
        'Not every three-body dance is wild: switch to three stars chasing each other round one figure-8, found by computer in 1993. Their twins stay together much longer.',
      ],
    },
    {
      title: 'To the Moon and back',
      paragraphs: [
        'This is not a drawing — it is this simulation flying a spacecraft with the same little steps you just watched. The little arrows show gravity’s pull at every point: almost everywhere it points to Earth, but inside the glowing disk the Moon’s own pull takes over.',
        'Watch the ghost ship: same launch, but with the Moon’s gravity switched off, it runs out of climb just short of that disk and falls back — it would never reach the Moon at all. The real ship is pulled that last stretch by the Moon itself, whipped once around it, and thrown home. The path draws a perfect figure-8: the famous free-return trajectory.',
        'Apollo astronauts flew this shape to the Moon because it has a built-in safety net: if the engine fails, you touch nothing and gravity still delivers you back to Earth — the free ride home that saved the crew of Apollo 13. Half a century later, in April 2026, NASA’s Artemis II — the first crewed Moon mission since 1972 — flew the very same figure-8.',
        'Get the launch speed wrong by a fraction of a percent and the 8 falls apart. That is why space agencies simulate millions of trajectories before anyone climbs into a rocket — with the same two ingredients as this game: Newton’s gravity, plus numerical integration.',
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
        'Een planeet in een uitgerekte baan is als een skateboarder in een halfpipe: dicht bij de Zon racet hij, ver weg klimt hij en vertraagt. Bewegingsenergie en hoogte-energie ruilen van plaats, maar hun som verandert nooit. Natuurkundigen noemen dit behoud van energie, en het is een van de scherpste manieren om te checken of een simulatie de waarheid vertelt.',
        'Een computer kan geen vloeiende kromme vliegen. Hij speelt een flipboekje: waar ben ik? Welke kant trekt de zwaartekracht op? Zet een klein recht stapje, en herhaal — het spel doet er zo’n 150 per seconde. Rechts worden de stappen reusachtig gemaakt zodat je ze een voor een kunt zien.',
        'Het simpelste recept (de methode van Euler, uit 1768) heeft een bug die je kunt zien: elke rechte stap komt net buiten de kromme uit, de baan spiraliseert naar buiten, en de energielijn klimt — de computer verzint energie uit het niets. Slimmere recepten, symplectisch genoemd, zetten de stap zo dat de energieruil eerlijk blijft: dezelfde stappen, en de baan blijft gesloten.',
        'Slim wint van hard werken: om vijf rondjes even dicht bij de echte baan te blijven heeft het simpele recept ongeveer honderd keer zoveel stappen nodig, en hoe langer je rekent, hoe erger het wordt. Stapmethodes ontwerpen die de energie eerlijk houden — voor wind en turbulentie in plaats van planeten — is deel van het onderzoek van onze groep.',
      ],
      formula: 'E = ½·m·v² − G·M·m/r = constant',
    },
    {
      title: 'Drie is te veel voor een formule',
      paragraphs: [
        'Voor één planeet en een zon kon Newton de hele toekomst als formule opschrijven: de ellips. Voeg een derde hemellichaam toe en zo’n formule bestaat niet. In 1889 loofde koning Oscar II van Zweden en Noorwegen een prijs uit voor wie kon bewijzen dat het zonnestelsel stabiel is. Henri Poincaré won hem — vond toen een fout in zijn eigen werk, en ontdekte bij het herstellen de chaos.',
        'Rechts staan twee kopieën van dezelfde drie sterren, losgelaten vanuit stilstand op een driehoek. In de tweede kopie (de ringen) begint één ster een miljoenste opzij. Een tijdje dansen ze gelijk op; dan gaan ze helemaal uit elkaar. Piepkleine verschillen groeien — daarom stoppen weersverwachtingen na ongeveer tien dagen.',
        'Precies deze puzzel (Burrau, 1913) werd pas in 1967 door een computer opgelost: na een lange wilde dans vormen twee sterren een paar en wordt de derde weggeslingerd. Met drie of meer hemellichamen kun je de toekomst alleen kennen door hem uit te rekenen, stap voor stap. Daar is scientific computing voor.',
        'Niet elke drielichamendans is wild: schakel over naar drie sterren die elkaar achternazitten over één 8, in 1993 door een computer gevonden. Hun tweelingen blijven veel langer samen.',
      ],
    },
    {
      title: 'Naar de Maan en terug',
      paragraphs: [
        'Dit is geen tekening — dit is dezelfde simulatie die een ruimteschip laat vliegen met dezelfde kleine stapjes die je net zag. De kleine pijltjes laten de trekkracht van de zwaartekracht op elk punt zien: bijna overal wijzen ze naar de Aarde, maar binnen de gloeiende schijf neemt de eigen trekkracht van de Maan het over.',
        'Kijk naar het spookschip: dezelfde lancering, maar met de zwaartekracht van de Maan uitgeschakeld komt het net te kort voor die schijf en valt het terug — het zou de Maan nooit halen. Het echte schip wordt dat laatste stukje wél door de Maan zelf getrokken, er één keer omheen geslingerd, en naar huis gestuurd. Het pad tekent een perfecte 8: de beroemde free-returnbaan.',
        'Apollo-astronauten vlogen deze vorm naar de Maan omdat er een ingebouwd vangnet in zit: als de motor uitvalt, hoef je niets aan te raken en brengt de zwaartekracht je alsnog terug naar de Aarde — de gratis rit naar huis die de bemanning van Apollo 13 redde. Een halve eeuw later, in april 2026, vloog NASA’s Artemis II — de eerste bemande maanmissie sinds 1972 — precies diezelfde 8.',
        'Zit je een fractie van een procent naast de juiste lanceersnelheid, dan valt de 8 uit elkaar. Daarom simuleren ruimtevaartorganisaties miljoenen banen voordat iemand in een raket stapt — met dezelfde twee ingrediënten als dit spel: de zwaartekracht van Newton, plus numerieke integratie.',
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
        'En planet i en strukket bane er som en skateboarder i en halfpipe: nær Solen suser den, langt unna klatrer den og bremser opp. Bevegelsesenergi og høydeenergi bytter plass, men summen endrer seg aldri. Fysikere kaller dette bevaring av energi, og det er en av de skarpeste testene på om en simulering snakker sant.',
        'En datamaskin kan ikke fly en jevn kurve. Den spiller en tegneseriebok: hvor er jeg? Hvilken vei trekker tyngdekraften? Ta et lite rett steg, og gjenta — spillet tar rundt 150 i sekundet. Til høyre er stegene gjort enorme så du kan se hvert eneste ett.',
        'Den enkleste oppskriften (Eulers metode, fra 1768) har en feil du kan se: hvert rette steg lander litt utenfor kurven, banen spiraler utover, og energilinjen klatrer — datamaskinen finner opp energi ut av ingenting. Smartere oppskrifter, kalt symplektiske, tar steget slik at energibyttet forblir rettferdig: samme steg, og banen holder seg lukket.',
        'Smart slår hardt arbeid: for å holde seg like nær den ekte banen i fem runder trenger den enkle oppskriften omtrent hundre ganger så mange steg, og jo lenger du regner, jo verre blir det. Å lage stegoppskrifter som holder energien ærlig — for vind og turbulens i stedet for planeter — er en del av forskningen i gruppen vår.',
      ],
      formula: 'E = ½·m·v² − G·M·m/r = konstant',
    },
    {
      title: 'Tre er for mange for en formel',
      paragraphs: [
        'For én planet og en sol kunne Newton skrive hele fremtiden som en formel: ellipsen. Legg til et tredje legeme, og en slik formel finnes ikke. I 1889 lyste kong Oscar II av Sverige og Norge ut en pris for å bevise at solsystemet er stabilt. Henri Poincaré vant den — fant så en feil i sitt eget arbeid, og oppdaget kaos da han rettet den.',
        'Til høyre er to kopier av de samme tre stjernene, sluppet fra ro i en trekant. I den andre kopien (ringene) starter én stjerne en milliondel til siden. En stund danser de i takt; så går de helt hver sin vei. Bittesmå forskjeller vokser — samme grunn til at værmeldinger stopper etter omtrent ti dager.',
        'Akkurat dette puslespillet (Burrau, 1913) ble først løst av en datamaskin, i 1967: etter en lang vill dans danner to stjerner et par, og den tredje kastes ut. Med tre eller flere legemer er den eneste måten å kjenne fremtiden på å regne den ut, steg for steg. Det er det scientific computing er til for.',
        'Ikke alle tre-legeme-danser er ville: bytt til tre stjerner som jager hverandre rundt ett 8-tall, funnet av en datamaskin i 1993. Tvillingene deres holder sammen mye lenger.',
      ],
    },
    {
      title: 'Til Månen og hjem igjen',
      paragraphs: [
        'Dette er ikke en tegning — det er denne simuleringen som flyr et romfartøy med de samme små stegene du nettopp så. De små pilene viser tyngdekraftens drag i hvert punkt: nesten overalt peker de mot Jorden, men inne i den glødende skiven tar Månens eget drag over.',
        'Følg med på spøkelsesskipet: samme oppskyting, men med Månens tyngdekraft slått av, går det tomt for fart rett før den skiven og faller tilbake — det ville aldri nådd Månen. Det ekte skipet blir dratt det siste stykket av Månen selv, svingt én gang rundt den, og sendt hjem. Banen tegner et perfekt 8-tall: den berømte free-return-banen.',
        'Apollo-astronautene fløy denne formen til Månen fordi den har et innebygd sikkerhetsnett: hvis motoren svikter, trenger du ikke røre noe, og tyngdekraften bringer deg likevel hjem til Jorden — den gratis hjemturen som reddet mannskapet på Apollo 13. Et halvt århundre senere, i april 2026, fløy NASAs Artemis II — det første bemannede måneoppdraget siden 1972 — akkurat det samme 8-tallet.',
        'Bommer du på oppskytingsfarten med en brøkdel av en prosent, faller 8-tallet fra hverandre. Derfor simulerer romfartsorganisasjoner millioner av baner før noen klatrer inn i en rakett — med de samme to ingrediensene som i dette spillet: Newtons tyngdekraft, pluss numerisk integrasjon.',
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
    note: 'Watch the orbit and the energy line: simple steps drift outward and gain energy; smart steps wobble a little but never drift away. The switch works in the game too — close this and drag the 🧮 slider to big steps.',
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
    note: 'Let op de baan en de energielijn: simpele stappen drijven naar buiten en winnen energie; slimme stappen wiebelen een beetje maar drijven nooit weg. De schakelaar werkt ook in het spel — sluit dit en zet de 🧮-schuif op grote stappen.',
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
    note: 'Følg med på banen og energilinjen: enkle steg driver utover og vinner energi; smarte steg vakler litt, men driver aldri bort. Bryteren virker i spillet også — lukk dette og dra 🧮-glideren til store steg.',
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
