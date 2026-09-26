// Delve chapters for Creature Lab, in the shared chaptered style
// (shell/delve.ts): text in the card on the left, one live illustration per
// chapter drawn by demos.ts. One arc, from dots to our group: a creature is
// physics; its brain is a rhythm (and chaotic); learning is searching a
// landscape; it learns exactly what you reward; it finds every flaw in the
// world (our old muscles, a flat practice floor); brains that feel (senses and
// a tiny neural network, trained with shoves); and robots — and our models of
// the wind — learn inside simulations.
import type { DelveChapter } from '../../shell/delve';
import { pick, type Localized } from '../../lib/i18n';
import type { CreatureDemos } from './demos';

export interface CreatureDelveApi {
  demos: CreatureDemos;
  hasGame(id: string): boolean;
  openGame(id: string): void;
}

interface ChapterText {
  title: string;
  paragraphs: string[];
  formula?: string;
}

const HEADING: Localized<string> = {
  en: '🔬 The science of Creature Lab',
  nl: '🔬 De wetenschap van het Beestenlab',
  no: '🔬 Vitenskapen bak Skapningslab',
};

const CHAPTERS: Localized<ChapterText[]> = {
  en: [
    {
      title: 'A creature is dots and springs',
      paragraphs: [
        'Everything here is simulated physics. Each dot is a little mass that feels gravity and friction. Grey sticks are bones that keep their length; red sticks are muscles that stretch and squeeze.',
        'Nothing about standing, tripping or tumbling is programmed anywhere: it all follows from Newton’s laws, recomputed 120 times a second. The same trick moves cloth, hair and ragdolls in films and games.',
        '👉 This Doggo’s muscles are switched off. Grab it and throw it.',
      ],
    },
    {
      title: 'The brain is a rhythm',
      paragraphs: [
        'A creature’s brain holds no walking instructions, only a beat. Each muscle stretches and squeezes like a wave, with its own strength (A) and its own moment (φ) in a shared beat (f):',
      ],
      formula: 'length(t) = rest × (1 + A · sin(2π f t + φ))',
    },
    {
      title: 'Learning is searching a landscape',
      paragraphs: [
        'Let the brain change just two numbers — when the back leg and when the front leg swing — and every pair is one pixel on this map: bright walks far, dark goes nowhere. The computer paints it by trying every one.',
        'Smooth hills are gaits that keep working when you nudge them. The TV static is chaos, where a hair decides between walking and a faceplant.',
        'Evolution never sees the map. Its crowd just keeps what works and tries something nearby, like the six climbers. Training an AI is the same climb, with millions of numbers instead of two.',
      ],
    },
    {
      title: 'It does exactly what you reward',
      paragraphs: [
        'Evolution gets one number per try: the reward. These two worms were trained by the same computer for the same time. The top one was rewarded for distance; the bottom one for distance with a foot on the ground.',
        'Nobody told the top one not to hop, so it hops: every red stretch is flying. It did exactly what it was asked, not what we meant.',
        'AI researchers call this “specification gaming”. A famous case: an AI playing a boat-racing game found it scored more by circling round a few bonus targets than by finishing the race.',
      ],
    },
    {
      title: 'It finds every flaw in the world',
      paragraphs: [
        'The first version of this game had a flaw: muscles could move as fast as they liked. Evolution found it within minutes. Stick-men learned to cartwheel and a worm learned to leap five metres, its head at 100 km/h. Real muscles have a speed limit, so now ours do too.',
        'A learner is the toughest tester a simulation can have: if the physics is wrong, the robot learns the wrong thing. And a Doggo that only ever practised on a flat floor trips over the first bump, while one that practised on ever-changing bumps crosses them.',
        'So the simulation has to be right, and varied. Getting it right is our craft: the same kind of flaw makes energy out of nothing in Gravity Doodle.',
      ],
    },
    {
      title: 'Brains that feel',
      paragraphs: [
        'A rhythm brain is blind: it keeps its beat whatever happens, so a shove can tip it over. Real robots feel. They sense how they tilt, how fast they go and which feet touch the ground, and turn that into corrections.',
        'So give the Doggo senses — seven numbers about its body, plus its feet — and a tiny neural network of four neurons between the senses and the muscles, added to the beat. It starts silent; practice teaches it when to push.',
        'All three Doggos get the same shoves. In a test of 20 shoved runs, the one that practised on calm ground ends up on its back 13 times, the one that practised with shoves 4 times, and the one with senses too only twice. Rough practice matters most; senses help on top. Every walking robot works like this: a rhythm, corrected by what it feels.',
        'A brain that feels can’t save a body that can’t stand. Our stick-man has no feet and weak knees: in our tests, with or without senses, it falls within a second. Real robots have feet and strong, fast motors.',
      ],
    },
    {
      title: 'Robots go to school in simulations',
      paragraphs: [
        'Real legged robots learn to walk this way now: thousands of copies practise at once in a simulation on one computer chip, falling millions of times, and then the brain is copied into real legs. Years of falling take a few hours.',
        'Their brains are neural networks and the method is called reinforcement learning: a close cousin of the evolution you watched, not the same thing.',
        'Our group puts learning inside simulations too, for the wind rather than robots: a small neural network learns to correct a cheap, coarse simulation of turbulence so that it behaves like an expensive, fine one — trained, like these creatures, on what the whole simulation does.',
        'These four bodies were all trained by the same code. It knew nothing about legs, worms or frogs.',
      ],
    },
  ],
  nl: [
    {
      title: 'Een beestje is stippen en veren',
      paragraphs: [
        'Alles wat je hier ziet is gesimuleerde natuurkunde. Elke stip is een klein gewicht dat zwaartekracht en wrijving voelt. Grijze stokken zijn botten die hun lengte houden; rode stokken zijn spieren die uitrekken en samentrekken.',
        'Nergens is geprogrammeerd hoe iets staat, struikelt of tuimelt: het volgt allemaal uit de wetten van Newton, 120 keer per seconde opnieuw berekend. Met dezelfde truc bewegen stof, haar en ragdolls in films en games.',
        '👉 De spieren van dit hondje staan uit. Pak het en gooi het.',
      ],
    },
    {
      title: 'Het brein is een ritme',
      paragraphs: [
        'Het brein van een beestje bevat geen loopinstructies, alleen een ritme. Elke spier rekt en trekt als een golf, met een eigen kracht (A) en een eigen moment (φ) in een gedeeld ritme (f):',
      ],
      formula: 'lengte(t) = rust × (1 + A · sin(2π f t + φ))',
    },
    {
      title: 'Leren is zoeken in een landschap',
      paragraphs: [
        'Laat het brein maar twee getallen veranderen — wanneer de achterpoot en wanneer de voorpoot zwaait — en elk paar is één pixel op deze kaart: helder loopt ver, donker komt nergens. De computer schildert de kaart door ze allemaal te proberen.',
        'Gladde heuvels zijn manieren van lopen die blijven werken als je ze een zetje geeft. De sneeuw op de tv is chaos: daar beslist een haartje tussen lopen en op je snuit vallen.',
        'Evolutie ziet de kaart nooit. De groep houdt gewoon wat werkt en probeert iets in de buurt, zoals de zes klimmers. Een AI trainen is dezelfde klim, met miljoenen getallen in plaats van twee.',
      ],
    },
    {
      title: 'Hij doet precies wat je beloont',
      paragraphs: [
        'Evolutie krijgt per poging één getal: de beloning. Deze twee wormen zijn door dezelfde computer even lang getraind. De bovenste werd beloond voor afstand; de onderste voor afstand met een voet op de grond.',
        'Niemand vertelde de bovenste dat hij niet mocht huppelen, dus huppelt hij: elk rood stuk is vliegen. Hij deed precies wat er gevraagd werd, niet wat we bedoelden.',
        'AI-onderzoekers noemen dit “specification gaming”. Een bekend geval: een AI die een bootracespel speelde, scoorde meer door rondjes te draaien langs een paar bonusdoelen dan door de race uit te varen.',
      ],
    },
    {
      title: 'Hij vindt elke fout in de wereld',
      paragraphs: [
        'De eerste versie van dit spel had een fout: spieren konden zo snel bewegen als ze wilden. Evolutie vond dat binnen een paar minuten. Stokmannetjes leerden radslagen maken en een worm leerde vijf meter hoog springen, met zijn kop op 100 km/u. Echte spieren hebben een snelheidslimiet, dus die van ons nu ook.',
        'Wie leert, is de strengste tester die een simulatie kan hebben: klopt de natuurkunde niet, dan leert de robot het verkeerde. En een hondje dat alleen op een vlakke vloer oefende, struikelt over de eerste hobbel, terwijl een hondje dat op steeds andere hobbels oefende er gewoon overheen loopt.',
        'De simulatie moet dus kloppen, en gevarieerd zijn. Dat goed krijgen is ons vak: hetzelfde soort fout maakt energie uit het niets in Zwaartekracht-doodle.',
      ],
    },
    {
      title: 'Breinen die voelen',
      paragraphs: [
        'Een ritmebrein is blind: het houdt zijn ritme wat er ook gebeurt, dus een duw kan het omgooien. Echte robots voelen. Ze merken hoe scheef ze staan, hoe snel ze gaan en welke voeten de grond raken, en maken daar correcties van.',
        'Geef het hondje dus zintuigen — zeven getallen over zijn lijf, plus zijn voeten — en een piepklein neuraal netwerk van vier neuronen tussen de zintuigen en de spieren, bovenop het ritme. Het begint stil; oefenen leert het wanneer het moet duwen.',
        'Alle drie de hondjes krijgen dezelfde duwen. In een test van 20 keer duwen belandt het hondje dat op rustige grond oefende 13 keer op zijn rug, het hondje dat met duwtjes oefende 4 keer, en het hondje met zintuigen maar twee keer. Ruw oefenen helpt het meest; zintuigen helpen daarbovenop. Elke lopende robot werkt zo: een ritme, bijgestuurd door wat hij voelt.',
        'Een brein dat voelt kan een lijf dat niet kan staan niet redden. Ons stokmannetje heeft geen voeten en slappe knieën: in onze tests valt het, met of zonder zintuigen, binnen een seconde om. Echte robots hebben voeten en sterke, snelle motoren.',
      ],
    },
    {
      title: 'Robots gaan naar school in simulaties',
      paragraphs: [
        'Echte robots met poten leren nu zo lopen: duizenden kopieën oefenen tegelijk in een simulatie op één computerchip, vallen miljoenen keren, en daarna wordt het brein in echte poten gezet. Jaren vallen kosten een paar uur.',
        'Hun brein is een neuraal netwerk en de methode heet reinforcement learning: een naaste neef van de evolutie die je zag, niet hetzelfde.',
        'Onze groep stopt ook leren in simulaties, voor de wind in plaats van robots: een klein neuraal netwerk leert een goedkope, grove simulatie van turbulentie te verbeteren, zodat die zich gedraagt als een dure, fijne — en net als deze beestjes wordt het getraind op wat de hele simulatie doet.',
        'Deze vier lichamen zijn allemaal door dezelfde code getraind. Die wist niets van poten, wormen of kikkers.',
      ],
    },
  ],
  no: [
    {
      title: 'En skapning er prikker og fjærer',
      paragraphs: [
        'Alt du ser her er simulert fysikk. Hver prikk er en liten masse som kjenner tyngdekraft og friksjon. Grå pinner er bein som holder lengden sin; røde pinner er muskler som strekker seg og trekker seg sammen.',
        'Ingenting om å stå, snuble eller rulle er programmert noe sted: alt følger av Newtons lover, regnet ut på nytt 120 ganger i sekundet. Det samme trikset beveger stoff, hår og ragdoll-figurer i filmer og spill.',
        '👉 Musklene til denne vovsen er slått av. Grip den og kast den.',
      ],
    },
    {
      title: 'Hjernen er en rytme',
      paragraphs: [
        'Hjernen til en skapning har ingen gå-instruksjoner, bare en takt. Hver muskel strekker seg og trekker seg sammen som en bølge, med sin egen styrke (A) og sitt eget øyeblikk (φ) i en felles takt (f):',
      ],
      formula: 'lengde(t) = hvile × (1 + A · sin(2π f t + φ))',
    },
    {
      title: 'Å lære er å lete i et landskap',
      paragraphs: [
        'La hjernen endre bare to tall — når bakbeinet og når forbeinet svinger — så er hvert par én piksel på dette kartet: lyst går langt, mørkt kommer ingen vei. Datamaskinen maler kartet ved å prøve alle.',
        'Glatte åser er ganger som fortsetter å virke når du dytter litt i dem. Snøen på TV-en er kaos: der avgjør et hårstrå mellom å gå og å gå på trynet.',
        'Evolusjonen ser aldri kartet. Flokken beholder bare det som virker og prøver noe i nærheten, som de seks klatrerne. Å trene en AI er den samme klatringen, med millioner av tall i stedet for to.',
      ],
    },
    {
      title: 'Den gjør akkurat det du belønner',
      paragraphs: [
        'Evolusjonen får ett tall per forsøk: belønningen. Disse to markene ble trent av samme datamaskin like lenge. Den øverste ble belønnet for avstand; den nederste for avstand med en fot i bakken.',
        'Ingen sa til den øverste at den ikke fikk hoppe, så den hopper: hver røde strekning er flyging. Den gjorde akkurat det den ble bedt om, ikke det vi mente.',
        'AI-forskere kaller dette «specification gaming». Et kjent eksempel: en AI som spilte et båtløpspill, fikk flere poeng ved å kjøre i ring rundt noen bonusmål enn ved å fullføre løpet.',
      ],
    },
    {
      title: 'Den finner hver feil i verden',
      paragraphs: [
        'Den første versjonen av dette spillet hadde en feil: musklene kunne bevege seg så fort de ville. Evolusjonen fant den i løpet av minutter. Pinnemenn lærte å hjule og en mark lærte å hoppe fem meter, med hodet i 100 km/t. Ekte muskler har en fartsgrense, så nå har våre det også.',
        'Den som lærer, er den strengeste testeren en simulering kan få: er fysikken feil, lærer roboten feil. Og en vovse som bare har øvd på flatt gulv, snubler i første hump, mens en som øvde på humper som stadig skiftet, går rett over.',
        'Simuleringen må altså være riktig, og variert. Å få den riktig er faget vårt: samme slags feil lager energi av ingenting i Tyngdekraft-doodle.',
      ],
    },
    {
      title: 'Hjerner som kjenner',
      paragraphs: [
        'En rytmehjerne er blind: den holder takten uansett hva som skjer, så et dytt kan velte den. Ekte roboter kjenner. De merker hvor skjeve de står, hvor fort de går og hvilke føtter som er i bakken, og gjør det om til korreksjoner.',
        'Gi derfor vovsen sanser — sju tall om kroppen, pluss føttene — og et bitte lite nevralt nettverk med fire nevroner mellom sansene og musklene, lagt oppå takten. Det starter stille; øving lærer det når det skal dytte.',
        'Alle tre vovsene får de samme dyttene. I en test med 20 dyttede løp havner vovsen som øvde på rolig bakke på ryggen 13 ganger, den som øvde med dytt 4 ganger, og den med sanser bare to ganger. Røff øving betyr mest; sansene hjelper i tillegg. Alle gående roboter virker slik: en rytme, justert av det den kjenner.',
        'En hjerne som kjenner kan ikke redde en kropp som ikke kan stå. Pinnemannen vår har ingen føtter og svake knær: i testene våre faller den, med eller uten sanser, innen et sekund. Ekte roboter har føtter og sterke, raske motorer.',
      ],
    },
    {
      title: 'Roboter går på skole i simuleringer',
      paragraphs: [
        'Ekte roboter med bein lærer å gå slik nå: tusenvis av kopier øver samtidig i en simulering på én databrikke, faller millioner av ganger, og så kopieres hjernen over i ekte bein. År med fall tar noen timer.',
        'Hjernene deres er nevrale nettverk og metoden heter forsterkende læring: en nær slektning av evolusjonen du så, ikke det samme.',
        'Gruppen vår legger også læring inn i simuleringer, for vinden i stedet for roboter: et lite nevralt nettverk lærer å rette opp en billig, grov simulering av turbulens slik at den oppfører seg som en dyr, fin en — trent, som disse skapningene, på det hele simuleringen gjør.',
        'Disse fire kroppene ble alle trent av den samme koden. Den visste ingenting om bein, mark eller frosker.',
      ],
    },
  ],
};

const LAB: Localized<{
  title: string;
  scramble: string;
  champion: string;
  nudge: string;
  brainNote: string;
  bug: (on: boolean) => string;
  bugNote: string;
  shove: string;
  shoveNote: string;
  links: string;
  games: Record<'orbits' | 'windfarm', string>;
}> = {
  en: {
    title: '🧪 Lab',
    scramble: '🎲 Scramble the brain',
    champion: '👑 Champion brain',
    nudge: '🤏 Nudge a number by a hair',
    brainNote: 'That is the whole brain: Doggo’s is 9 numbers. Scramble them and the walk falls apart. Nudge them by a hair and a twin runs beside it: a good walk shrugs the nudge off, but a flailing brain is chaotic and the twins part ways, like the weather. Try both.',
    bug: (on) => `🐞 Old muscles, no speed limit: ${on ? 'ON' : 'OFF'}`,
    bugNote: 'The top two brains were trained on the old muscles. Switch them off and the same brains flop.',
    shove: '💨 Shove them!',
    shoveNote: 'The dashed ring round the bottom Doggo’s head means it feels. Below is its brain, live: watch the tilt light up after a shove.',
    links: '🔭 The same craft, elsewhere in the arcade:',
    games: { orbits: '🪐 Gravity Doodle: energy out of nothing', windfarm: '🌀 Swirl Lab: the wind we simulate' },
  },
  nl: {
    title: '🧪 Lab',
    scramble: '🎲 Brein husselen',
    champion: '👑 Kampioensbrein',
    nudge: '🤏 Een getal een haartje verschuiven',
    brainNote: 'Dat is het hele brein: dat van het hondje is 9 getallen. Hussel ze en het lopen valt uit elkaar. Verschuif ze een haartje en er loopt een tweeling naast: een goede loop trekt zich er niets van aan, maar een fladderend brein is chaotisch en de tweelingen gaan uit elkaar, net als het weer. Probeer beide.',
    bug: (on) => `🐞 Oude spieren, zonder snelheidslimiet: ${on ? 'AAN' : 'UIT'}`,
    bugNote: 'De bovenste twee breinen zijn getraind met de oude spieren. Zet ze uit en dezelfde breinen floppen.',
    shove: '💨 Geef ze een duw!',
    shoveNote: 'De stippellijn rond de kop van het onderste hondje betekent: het voelt. Hieronder zie je zijn brein, live: kijk hoe “scheef” oplicht na een duw.',
    links: '🔭 Hetzelfde vak, elders in de arcade:',
    games: { orbits: '🪐 Zwaartekracht-doodle: energie uit het niets', windfarm: '🌀 Wervel-lab: de wind die we simuleren' },
  },
  no: {
    title: '🧪 Lab',
    scramble: '🎲 Rot til hjernen',
    champion: '👑 Mesterhjerne',
    nudge: '🤏 Flytt et tall et hårstrå',
    brainNote: 'Det er hele hjernen: vovsens er 9 tall. Rot dem til og gangen faller fra hverandre. Flytt dem et hårstrå, så går en tvilling ved siden av: en god gange bryr seg ikke, men en sprellende hjerne er kaotisk og tvillingene skilles, akkurat som i været. Prøv begge.',
    bug: (on) => `🐞 Gamle muskler, uten fartsgrense: ${on ? 'PÅ' : 'AV'}`,
    bugNote: 'De to øverste hjernene ble trent med de gamle musklene. Slå dem av, og de samme hjernene floppar.',
    shove: '💨 Dytt dem!',
    shoveNote: 'Den stiplede ringen rundt hodet til den nederste vovsen betyr at den kjenner. Under ser du hjernen dens, live: se «skjev» lyse opp etter et dytt.',
    links: '🔭 Samme fag, andre steder i arkaden:',
    games: { orbits: '🪐 Tyngdekraft-doodle: energi av ingenting', windfarm: '🌀 Virvellab: vinden vi simulerer' },
  },
};

function button(text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'arcade-button';
  b.style.cssText = 'display:block;width:100%;margin-top:0.45rem;';
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

function box(title: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'delve-lab';
  const t = document.createElement('div');
  t.className = 'delve-lab-title';
  t.textContent = title;
  el.appendChild(t);
  return el;
}

function note(text: string): HTMLElement {
  const p = document.createElement('p');
  p.className = 'delve-lab-note';
  p.textContent = text;
  return p;
}

function links(api: CreatureDelveApi, ids: ('orbits' | 'windfarm')[]): HTMLElement | null {
  const L = pick(LAB);
  const games = ids.filter((id) => api.hasGame(id));
  if (games.length === 0) return null;
  const el = box(L.links);
  for (const id of games) el.appendChild(button(L.games[id], () => api.openGame(id)));
  return el;
}

export const creatureDelve = {
  heading: (): string => pick(HEADING),
  chapters(api: CreatureDelveApi): DelveChapter[] {
    const L = pick(LAB);
    return pick(CHAPTERS).map((chapter, i) => ({
      title: chapter.title,
      paragraphs: chapter.paragraphs,
      formula: chapter.formula,
      extras:
        i === 1
          ? (host: HTMLElement) => {
              const lab = box(L.title);
              lab.append(
                button(L.scramble, () => api.demos.setBrain(false)),
                button(L.champion, () => api.demos.setBrain(true)),
                button(L.nudge, () => api.demos.nudge()),
                note(L.brainNote),
              );
              host.appendChild(lab);
            }
          : i === 4
            ? (host: HTMLElement) => {
                const lab = box(L.title);
                const toggle = button(L.bug(api.demos.oldMuscles), () => {
                  api.demos.setOldMuscles(!api.demos.oldMuscles);
                  toggle.textContent = L.bug(api.demos.oldMuscles);
                });
                lab.append(toggle, note(L.bugNote));
                host.appendChild(lab);
                const l = links(api, ['orbits']);
                if (l) host.appendChild(l);
              }
            : i === 5
              ? (host: HTMLElement) => {
                  const lab = box(L.title);
                  lab.append(button(L.shove, () => api.demos.shoveNow()), note(L.shoveNote));
                  host.appendChild(lab);
                }
              : i === 6
                ? (host: HTMLElement) => {
                    const l = links(api, ['windfarm', 'orbits']);
                    if (l) host.appendChild(l);
                  }
                : undefined,
    }));
  },
};
