// Delve chapters for Save the Netherlands, in the shared chaptered style
// (shell/delve.ts). The running flood map IS the live illustration — the card
// covers the sea on the left while the land stays visible and interactive,
// and the chapter-3 lab toggles the toy storm in the real simulation.
import type { DelveChapter } from '../../shell/delve';
import { pick, type Localized } from '../../lib/i18n';

export interface FloodDelveApi {
  getStorm(): boolean;
  setStorm(on: boolean): void;
}

interface ChapterText {
  title: string;
  paragraphs: string[];
  formula?: string;
}

const CHAPTERS: Localized<ChapterText[]> = {
  en: [
    {
      title: 'A sea made of numbers',
      paragraphs: [
        'This map is a grid of 160 × 90 cells. Each cell stores two numbers: how high the land is, and how deep the water on top of it is. Ninety times per second, water flows between neighboring cells — downhill, faster where it is deep.',
        'That one rule is the shallow-water equations, the same mathematics behind real storm-surge forecasts and tsunami warnings. The waves, the surge piling up against your dikes, the flood pouring through a gap: none of it is scripted. It all just follows.',
        '👆 The card covers the sea, but the land still works — you can keep building and digging while you read.',
      ],
      formula: '∂h/∂t + ∇·(h·u) = 0',
    },
    {
      title: '1953: the night the sea won',
      paragraphs: [
        'In the night of 31 January 1953, a storm surge drove the North Sea over and through the dikes of Zeeland. 1,836 people drowned. The Netherlands swore: never again.',
        'But how high must a dike be for “never again”? That was a mathematics question — how high can the sea get, and how rare is each height? Dutch mathematicians computed storm surges to design the Delta Works, and part of that pioneering work was done at the Mathematisch Centrum, CWI’s predecessor, home of some of the first computers in the country.',
        'The third storm in the ⛈️ challenge is this game’s little nod to that night.',
      ],
    },
    {
      title: 'Where to build? Ask probability',
      paragraphs: [
        'You never have enough sand — and a real country never has enough budget. Reinforcing every dike against everything is impossible, so the real question is: where is failure most likely, and how bad would it be?',
        'The red stripes in the game are a genuine computed risk map: the simulation asks “if the sea stood this high, which cells would get wet?” and paints the answer. Real engineers compute the refined version — a failure probability for every stretch of dike, so the money goes where the danger is. Our group has worked on exactly that with Deltares, the Dutch institute for applied water research.',
      ],
    },
    {
      title: 'From this toy to the real forecast',
      paragraphs: [
        'The grown-up versions of these equations run every day: storm-surge forecasts for the Dutch coast, river-flood models, tsunami warnings. Same mathematics — but with real seabed maps, millions of cells, and supercomputers.',
        'This game pushes 14,400 cells ninety times per second on a laptop. A forecast model pushes millions, and has to be right on time, every time, with a known margin of error. Making simulations that fast and that trustworthy is the field called scientific computing.',
        'And with sea levels rising, this mathematics matters a little more every year. Someone has to do it — maybe you?',
      ],
    },
  ],
  nl: [
    {
      title: 'Een zee van getallen',
      paragraphs: [
        'Deze kaart is een raster van 160 × 90 cellen. Elke cel onthoudt twee getallen: hoe hoog het land daar is, en hoe diep het water erbovenop staat. Negentig keer per seconde stroomt water tussen buurcellen — bergafwaarts, sneller waar het diep is.',
        'Die ene regel vormt de ondiepwater-vergelijkingen, dezelfde wiskunde achter echte stormvloedverwachtingen en tsunamiwaarschuwingen. De golven, de vloed die zich tegen je dijken opstuwt, het water dat door een gat naar binnen gutst: niets is geprogrammeerd als script. Het volgt er gewoon uit.',
        '👆 De kaart bedekt de zee, maar het land werkt gewoon — je kunt blijven bouwen en graven terwijl je leest.',
      ],
      formula: '∂h/∂t + ∇·(h·u) = 0',
    },
    {
      title: '1953: de nacht dat de zee won',
      paragraphs: [
        'In de nacht van 31 januari 1953 joeg een stormvloed de Noordzee over en door de dijken van Zeeland. 1.836 mensen verdronken. Nederland zwoer: nooit meer.',
        'Maar hoe hoog moet een dijk zijn voor “nooit meer”? Dat was een wiskundevraag — hoe hoog kan de zee komen, en hoe zeldzaam is elke hoogte? Nederlandse wiskundigen berekenden stormvloeden om de Deltawerken te ontwerpen, en een deel van dat pionierswerk gebeurde op het Mathematisch Centrum, de voorloper van het CWI, waar een paar van de eerste computers van het land stonden.',
        'De derde storm in de ⛈️-uitdaging is de kleine knipoog van dit spel naar die nacht.',
      ],
    },
    {
      title: 'Waar bouw je? Vraag het de kansrekening',
      paragraphs: [
        'Je hebt nooit genoeg zand — en een echt land heeft nooit genoeg budget. Elke dijk tegen alles versterken kan niet, dus de echte vraag is: waar is falen het meest waarschijnlijk, en hoe erg zou het zijn?',
        'De rode strepen in het spel zijn een echte berekende risicokaart: de simulatie vraagt “als de zee zó hoog stond, welke cellen worden dan nat?” en kleurt het antwoord in. Echte ingenieurs rekenen de verfijnde versie uit — een faalkans voor elk stuk dijk, zodat het geld naar het gevaar gaat. Onze groep heeft daar precies aan gewerkt met Deltares, het Nederlandse instituut voor toegepast wateronderzoek.',
      ],
    },
    {
      title: 'Van dit speeltje naar de echte verwachting',
      paragraphs: [
        'De volwassen versies van deze vergelijkingen draaien elke dag: stormvloedverwachtingen voor de Nederlandse kust, riviermodellen, tsunamiwaarschuwingen. Dezelfde wiskunde — maar met echte bodemkaarten, miljoenen cellen en supercomputers.',
        'Dit spel duwt 14.400 cellen negentig keer per seconde vooruit op een laptop. Een verwachtingsmodel duwt er miljoenen, en moet op tijd goed zitten, elke keer, met een bekende foutmarge. Simulaties zó snel en zó betrouwbaar maken, dat is het vak scientific computing.',
        'En nu de zeespiegel stijgt, doet deze wiskunde er elk jaar iets meer toe. Iemand moet het doen — jij misschien?',
      ],
    },
  ],
  no: [
    {
      title: 'Et hav av tall',
      paragraphs: [
        'Dette kartet er et rutenett på 160 × 90 celler. Hver celle husker to tall: hvor høyt landet er der, og hvor dypt vannet oppå er. Nitti ganger i sekundet strømmer vann mellom naboceller — nedoverbakke, raskere der det er dypt.',
        'Den ene regelen er gruntvannsligningene, den samme matematikken bak ekte stormflovarsler og tsunamivarsler. Bølgene, stormfloen som presser seg mot dikene dine, vannet som fosser inn gjennom et hull: ingenting er et ferdig manus. Alt bare følger.',
        '👆 Kortet dekker havet, men landet virker fortsatt — du kan bygge og grave videre mens du leser.',
      ],
      formula: '∂h/∂t + ∇·(h·u) = 0',
    },
    {
      title: '1953: natten havet vant',
      paragraphs: [
        'Natt til 1. februar 1953 drev en stormflo Nordsjøen over og gjennom dikene i Zeeland. 1 836 mennesker druknet. Nederland sverget: aldri igjen.',
        'Men hvor høyt må et dike være for «aldri igjen»? Det var et matematikkspørsmål — hvor høyt kan havet nå, og hvor sjelden er hver høyde? Nederlandske matematikere beregnet stormfloer for å designe Deltaverkene, og en del av det pionerarbeidet ble gjort ved Mathematisch Centrum, CWIs forgjenger, hjemmet til noen av landets første datamaskiner.',
        'Den tredje stormen i ⛈️-utfordringen er dette spillets lille nikk til den natten.',
      ],
    },
    {
      title: 'Hvor bygger du? Spør sannsynligheten',
      paragraphs: [
        'Du har aldri nok sand — og et ekte land har aldri nok budsjett. Å forsterke hvert dike mot alt er umulig, så det egentlige spørsmålet er: hvor er svikt mest sannsynlig, og hvor ille ville det vært?',
        'De røde stripene i spillet er et ekte beregnet risikokart: simuleringen spør «hvis havet sto så høyt, hvilke celler blir våte?» og maler svaret. Ekte ingeniører regner ut den raffinerte versjonen — en sviktsannsynlighet for hver strekning med dike, slik at pengene går dit faren er. Gruppen vår har jobbet med akkurat det sammen med Deltares, det nederlandske instituttet for anvendt vannforskning.',
      ],
    },
    {
      title: 'Fra dette leketøyet til det ekte varselet',
      paragraphs: [
        'Voksenversjonene av disse ligningene kjører hver dag: stormflovarsler for den nederlandske kysten, elveflommodeller, tsunamivarsler. Samme matematikk — men med ekte bunnkart, millioner av celler og superdatamaskiner.',
        'Dette spillet dytter 14 400 celler nitti ganger i sekundet på en bærbar PC. En varslingsmodell dytter millioner, og må treffe i tide, hver gang, med en kjent feilmargin. Å gjøre simuleringer så raske og så pålitelige er faget scientific computing.',
        'Og når havet stiger, betyr denne matematikken litt mer for hvert år. Noen må gjøre det — kanskje du?',
      ],
    },
  ],
};

/** Labels for the chapter-3 storm-toggle lab, wired into the toy simulation. */
const LAB: Localized<{ title: string; summon: string; calm: string; note: string }> = {
  en: {
    title: '🧪 Try it live — wired into the map',
    summon: '🌩️ Summon a storm',
    calm: '🌤️ Calm the sea',
    note: 'Watch the surge rise and the red stripes update live. Build a dike across a striped gap — when the stripes behind it vanish, the math says it will hold.',
  },
  nl: {
    title: '🧪 Probeer het zelf — gekoppeld aan de kaart',
    summon: '🌩️ Roep een storm op',
    calm: '🌤️ Kalmeer de zee',
    note: 'Kijk hoe de vloed stijgt en de rode strepen live meebewegen. Bouw een dijk dwars over een gestreept gat — als de strepen erachter verdwijnen, zegt de wiskunde dat hij houdt.',
  },
  no: {
    title: '🧪 Prøv det live — koblet til kartet',
    summon: '🌩️ Mane frem en storm',
    calm: '🌤️ Ro ned havet',
    note: 'Se stormfloen stige og de røde stripene oppdatere seg live. Bygg et dike tvers over et stripete hull — når stripene bak forsvinner, sier matematikken at det holder.',
  },
};

export function floodlandDelve(api: FloodDelveApi): DelveChapter[] {
  const chapters = pick(CHAPTERS);
  const lab = pick(LAB);
  return chapters.map((chapter, i) => ({
    title: chapter.title,
    paragraphs: chapter.paragraphs,
    formula: chapter.formula,
    // Only chapter 3 (index 2, the risk chapter) has the storm lab.
    extras:
      i === 2
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
              button.textContent = api.getStorm() ? lab.calm : lab.summon;
            };
            button.addEventListener('click', () => {
              api.setStorm(!api.getStorm());
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
