// Delve chapters for Bouncy Balls, in the shared chaptered style
// (shell/delve.ts): text in the card on the left, one live illustration per
// chapter drawn by the game on its canvas (index.ts drawDelve). The chapter-5
// lab drives the very same physics switches as the game toolbar.
import type { DelveChapter } from '../../shell/delve';
import { pick, type Localized } from '../../lib/i18n';

export type SwitchName = 'collisions' | 'friction' | 'dissipate';

export interface BounceDelveApi {
  getSwitch(name: SwitchName): boolean;
  setSwitch(name: SwitchName, value: boolean): void;
}

interface ChapterText {
  title: string;
  paragraphs: string[];
  formula?: string;
}

const CHAPTERS: Localized<ChapterText[]> = {
  en: [
    {
      title: 'A ball is just five numbers',
      paragraphs: [
        'Before a computer can simulate anything, you must decide what matters — that step is called modeling. For a bouncing ball, surprisingly little does: where it is (x, y), how fast it moves horizontally and vertically (vx, vy), and its radius. Five numbers, and that is the whole ball.',
        'The computer keeps such a little table for every single ball — hundreds of balls, hundreds of tables — and updates them all 60 times per second. On the right, a ball drifts around while its numbers tick along in the corner.',
        'Modeling is the quiet art of simulation: keep exactly the numbers that decide the future, throw away everything else. This model has no spin and no air resistance — a bowling ball and a ping-pong ball would fall exactly alike. Good enough for a game, and honestly quite close to Galileo’s ramp experiments.',
      ],
      formula: 'ball ⇄ ( x , y , vx , vy , r )',
    },
    {
      title: 'Gravity: one rule, repeated 60 times a second',
      paragraphs: [
        'A computer cannot let a ball fall smoothly — it can only take snapshots. Every tick it asks two questions: where am I? how fast am I going? Then it applies gravity’s single rule: every second, downward speed grows by a fixed amount.',
        'First add gravity × tick to the speed, then hop: position += speed × tick. Two lines of code, 60 times per second — and out come perfect parabolas, the same curve Galileo drew for cannonballs four centuries ago.',
        'On the right the ticks are slowed down about ten times so you can see them: every hop is perfectly straight, and only between hops does the arrow bend downward. Smaller ticks trace smoother arcs — how finely you chop up time is always a real choice in a simulation.',
      ],
      formula: 'v ← v + g·dt\nx ← x + v·dt',
    },
    {
      title: 'Collisions: push apart along the line of centers',
      paragraphs: [
        'Two balls touch — now what? Real balls squash, thud, maybe squeak. Our model throws all that away and keeps one rule: push them apart along the line joining their centers, never sideways. That single rule is enough for believable glancing hits, pile-ups and stacks.',
        'The pushes are equal and opposite (Newton’s third law), but the kicks are not: acceleration = force ÷ mass. Mass here grows with area, so the big ball barely notices the little one ricocheting off it.',
        'Press the 🎱 button to switch collisions off, and balls sail through each other like ghosts. Nothing in a simulation happens “by itself” — every rule was written down by someone.',
      ],
      formula: 'F₁ = −F₂   (Newton III)\nm ∝ r²',
    },
    {
      title: 'Friction: every slide pays a toll',
      paragraphs: [
        'Wherever a ball rubs along floor or wall, roughness shaves a slice off its sliding speed at every touch. Watch the arcs shrink on the right: each bounce lands a bit shorter, until the ball stops travelling and simply plops straight down.',
        'While it rolls, millions of microscopic bumps keep braking it — wait long enough and even rolling grinds to a halt. That is why the ball pile settles into calm instead of shivering forever.',
        'Nobody simulates those billions of microscopic bumps one by one. They are compressed into a single honest shortcut: multiply sliding speed by 0.96 at every wall touch. Choosing which shortcuts to take is half of modeling.',
      ],
      formula: 'slide ← 0.96 × slide\n(at every wall touch)',
    },
    {
      title: 'Energy never vanishes — it changes costume',
      paragraphs: [
        'Energy cannot be created or destroyed, only moved around. A falling ball trades height energy for speed energy; each bounce converts a slice of speed into heat; friction skims a bit more off every slide.',
        'The bars on the right keep the books: speed + height + heat always sums to the same total — even as the motion visibly dies out. The “lost” energy warmed the ball and floor by an unmeasurable whisper of a degree. Nature’s accountancy always balances.',
        'Try the switches below: they do not change the total, only how fast motion drains into heat. Switch every loss off and the box becomes a perpetual motion machine — nothing ever settles. Real physics always leaks; that is why real things come to rest.',
      ],
      formula: 'E_speed + E_height + E_heat = constant',
    },
  ],
  nl: [
    {
      title: 'Een bal is maar vijf getallen',
      paragraphs: [
        'Voordat een computer iets kan simuleren, moet je beslissen wat ertoe doet — die stap heet modelleren. Voor een stuiterende bal is dat verbazingwekkend weinig: waar hij is (x, y), hoe snel hij horizontaal en verticaal gaat (vx, vy), en zijn straal. Vijf getallen, en dat is de hele bal.',
        'De computer houdt zo’n tabelletje voor élke bal bij — honderden ballen, honderden tabelletjes — en werkt ze allemaal 60 keer per seconde bij. Rechts drijft een bal rond terwijl zijn getallen in de hoek meelopen.',
        'Modelleren is de stille kunst van het simuleren: bewaar precies de getallen die de toekomst bepalen en gooi de rest weg. Dit model heeft geen draai en geen luchtweerstand — een kegelbal en een tafeltennisbal zouden exact hetzelfde vallen. Goed genoeg voor een spel, en eerlijk gezegd verrassend dicht bij Galileï’s hellingproeven.',
      ],
      formula: 'bal ⇄ ( x , y , vx , vy , r )',
    },
    {
      title: 'Zwaartekracht: één regel, 60 keer per seconde herhaald',
      paragraphs: [
        'Een computer kan een bal niet vloeiend laten vallen — hij kan alleen momentopnames maken. Elke tik stelt hij twee vragen: waar ben ik? hoe snel ga ik? Daarna past hij de enige regel van de zwaartekracht toe: elke seconde groeit de neerwaartse snelheid met een vast bedrag.',
        'Eerst tel je zwaartekracht × tik bij de snelheid op, dan volgt de sprong: positie += snelheid × tik. Twee regels code, 60 keer per seconde — en daar komen perfecte parabolen uit, dezelfde kromme die Galileï vier eeuwen geleden al voor kanonskogels tekende.',
        'Rechts zijn de tikken ongeveer tien keer vertraagd zodat je ze kunt zien: elke sprong is kaarsrecht, en alleen tussen de sprongen door buigt het pijltje naar beneden. Kleinere tikken geven gladdere bogen — hoe fijn je de tijd hakt is altijd een echte keuze in een simulatie.',
      ],
      formula: 'v ← v + g·dt\nx ← x + v·dt',
    },
    {
      title: 'Botsingen: duwen langs de middellijn',
      paragraphs: [
        'Twee ballen raken elkaar — en nu? Echte ballen vervormen, ploffen, piepen misschien. Ons model gooit dat allemaal weg en houdt één regel over: duw ze uit elkaar langs de lijn die hun middelpunten verbindt, nooit zijwaarts. Die ene regel is genoeg voor geloofwaardige raketslagen, stapels en botsingen.',
        'De duwkrachten zijn even groot en tegengesteld (de derde wet van Newton), maar de schoppen niet: versnelling = kracht ÷ massa. Massa groeit hier met de oppervlakte, dus de grote bal merkt de kleine die ervanaf kaatst nauwelijks op.',
        'Druk op de 🎱-knop om botsingen uit te zetten, en ballen varen als geesten door elkaar heen. Niets in een simulatie gebeurt “zomaar” — iedere regel is ooit door iemand opgeschreven.',
      ],
      formula: 'F₁ = −F₂   (Newton III)\nm ∝ r²',
    },
    {
      title: 'Wrijving: elke glijbeweging betaalt tol',
      paragraphs: [
        'Waar een bal over de vloer of langs een wand schuurt, snapt de ruwheid bij elk contact een hapje uit zijn glijdende snelheid. Kijk hoe de bogen rechts krimpen: elke stuiter landt weer wat korter, tot de bal niet meer vooruit komt en er gewoon recht onderin plonst.',
        'Terwijl hij rolt, remmen miljoenen microscopische bobbeltjes hem voortdurend af — wacht lang genoeg en zelfs het rollen sputtert stil. Daarom zakt de ballenberg in rust in plaats van eeuwig te rillen.',
        'Niemand simuleert die miljarden microscopische bobbeltjes apart. Ze worden samengeperst tot één eerlijke snelkoppeling: glij-snelheid × 0,96 bij elke wandaanraking. Kiezen welke snelkoppelingen je neemt is de helft van modelleren.',
      ],
      formula: 'glij ← 0,96 × glij\n(bij elke wandaanraking)',
    },
    {
      title: 'Energie verdwijnt nooit — hij verkleedt zich',
      paragraphs: [
        'Energie kan niet worden gemaakt of vernietigd, alleen verplaatst. Een vallende bal ruilt hoogte-energie voor bewegingsenergie; elke botsing slaat een plakje beweging om in warmte; wrijving schaapt nog wat meer weg van elke glijbeweging.',
        'De balken rechts houden de boeken bij: beweging + hoogte + warmte telt altijd op tot hetzelfde totaal — ook als de beweging zichtbaar uitsterft. De “verloren” energie verwarmde bal en vloer met een onmeetbaar zuchtje van een graad. De boekhouding van de natuur gaat altijd op.',
        'Probeer de schakelaars hieronder: ze veranderen niet het totaal, alleen hoe snel de beweging naar warmte wegsijpelt. Zet áll verlies uit en de doos wordt een perpetuum mobile — niets komt ooit tot rust. Echte natuur lekt altijd; daarom komen echte dingen tot rust.',
      ],
      formula: 'E_beweging + E_hoogte + E_warmte = constant',
    },
  ],
  no: [
    {
      title: 'En ball er bare fem tall',
      paragraphs: [
        'Før en datamaskin kan simulere noe som helst, må du bestemme hva som betyr noe — det steget heter å modellere. For en sprettende ball er det forbløffende lite: hvor den er (x, y), hvor fort den beveger seg vannrett og loddrett (vx, vy), og radiusen sin. Fem tall, og det er hele ballen.',
        'Datamaskinen fører et slikt lite skjema for hver eneste ball — hundrevis av baller, hundrevis av skjemaer — og oppdaterer alle sammen 60 ganger i sekundet. Til høyre driver en ball rundt mens tallene i hjørnet tikker med.',
        'Å modellere er simuleringens stille kunst: ta vare på nøyaktig tallene som bestemmer fremtiden, og kast resten. Denne modellen har ingen spinn og ingen luftmotstand — en bowlingkule og et bordtennisball ville falt nøyaktig likt. Godt nok til et spill, og ærlig talt overraskende nært Galileis rampeforsøk.',
      ],
      formula: 'ball ⇄ ( x , y , vx , vy , r )',
    },
    {
      title: 'Tyngdekraft: én regel, gjentatt 60 ganger i sekundet',
      paragraphs: [
        'En datamaskin kan ikke la en ball falle glatt — den kan bare ta øyeblikksbilder. Hvert tikk stiller den to spørsmål: hvor er jeg? hvor fort går jeg? Så bruker den tyngdekraftens eneste regel: hvert sekund vokser farten nedover med et fast beløp.',
        'Først legger du tyngdekraft × tikk til farten, så kommer hoppet: posisjon += fart × tikk. To linjer kode, 60 ganger i sekundet — og ut kommer perfekte parabler, samme kurve som Galilei tegnet for kanonkuler for fire århundrer siden.',
        'Til høyre er tikkingen bremsa ned omtrent ti ganger så du kan se den: hvert hopp er knivskarpt rett, og bare mellom hoppene bøyer pilen seg nedover. Mindre tikker gir glattere buer — hvor fint du hoger opp tiden er alltid et ekte valg i en simulering.',
      ],
      formula: 'v ← v + g·dt\nx ← x + v·dt',
    },
    {
      title: 'Kollisjoner: dytt fra hverandre langs senterlinjen',
      paragraphs: [
        'To baller treffer hverandre — og så? Ekte baller trykkes sammen, dultes, kanskje de piper. Modellen vår kaster alt dét bort og beholder én regel: dytt dem fra hverandre langs linjen mellom sentrene deres, aldri sidelengs. Den eneste regelen strekker til for troverdige skrå treff, hauger og kollisjoner.',
        'Dyttene er like store og motsatte (Newtons tredje lov), men sparkene er ikke det: akselerasjon = kraft ÷ masse. Massen vokser her med flaten, så den store ballen merker knapt den lille som rikosjetterer avgårde.',
        'Trykk på 🎱-knappen for å slå av kollisjoner, og ballene seiler gjennom hverandre som ånder. Ingenting i en simulering skjer “av seg selv” — hver regel er skrevet ned av noen.',
      ],
      formula: 'F₁ = −F₂   (Newton III)\nm ∝ r²',
    },
    {
      title: 'Friksjon: hver glid betaler toll',
      paragraphs: [
        'Der ballen gnir mot gulvet eller en vegg, stjeler ruheten en skive av glidefarten ved hvert kontakt. Se hvordan buene til høyre krymper: hvert sprett lander litt kortere, helt til ballen ikke reiser lenger, men bare plopper rett ned.',
        'Mens den ruller, bremser millioner av mikroskopiske ujevnheter den hele tiden — vent lenge nok, og selv rulling går bort til seg. Derfor synker ballhaugen til ro i stedet for å skjelve i evighet.',
        'Ingen simulerer de milliardene av mikroskopiske ujevnheter én for én. De presses sammen til én ærlig snarvei: multipliser glidefarten med 0,96 ved hver veggtouch. Å velge hvilke snarveier man tar er halve modelleringsjobben.',
      ],
      formula: 'glid ← 0,96 × glid\n(ved hver veggtouch)',
    },
    {
      title: 'Energi forsvinner aldri — den bare kler seg ut',
      paragraphs: [
        'Energi kan ikke skapes eller ødelegges, bare flyttes. En fallende ball bytter høydeenergi mot bevegelsesenergi; hvert sprett gjør en skive av farten om til varme; friksjonen skaver litt mer av hvert glid.',
        'Søylene til høyre fører boken: fart + høyde + varme summerer seg alltid til samme total — selv om bevegelsen åpenbart dør ut. Den “tapte” energien varmet opp ball og gulv med en umålig hvisken av en grad. Naturens regnskap går alltid opp.',
        'Prøv bryterne nedenfor: de endrer ikke totalen, bare hvor raskt bevegelsen siver over i varme. Slå av alt tap, og boksen blir en perpetuum mobile — ingenting kommer noensinne til ro. Ekte fysikk lekker alltid; derfor kommer ekte ting til ro.',
      ],
      formula: 'E_fart + E_høyde + E_varme = konstant',
    },
  ],
};

/** Labels for the chapter-5 "try it live" switch lab. */
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
    title: '🧪 Try it live',
    on: 'ON',
    off: 'OFF',
    collisions: '🎱 Ball collisions',
    friction: '🧤 Wall friction',
    dissipate: '🔥 Heat loss',
    note: '🔥 and 🧤 act on the demo instantly; all three also change the game you return to.',
  },
  nl: {
    title: '🧪 Probeer het zelf',
    on: 'AAN',
    off: 'UIT',
    collisions: '🎱 Botsingen',
    friction: '🧤 Wrijving',
    dissipate: '🔥 Warmteverlies',
    note: '🔥 en 🧤 werken direct op de demo; alle drie veranderen ze ook het spel waarnaar je terugkeert.',
  },
  no: {
    title: '🧪 Prøv det live',
    on: 'PÅ',
    off: 'AV',
    collisions: '🎱 Kollisjoner',
    friction: '🧤 Friksjon',
    dissipate: '🔥 Varmetap',
    note: '🔥 og 🧤 virker med én gang på demoen; alle tre endrer også spillet du kommer tilbake til.',
  },
};

/** Short captions drawn onto the canvas next to the demos. */
export const DELVE_CAPTIONS: Localized<{
  tick: string;
  lineOfCenters: string;
  barSpeed: string;
  barHeight: string;
  barHeat: string;
  barTotal: string;
  allHeat: string;
}> = {
  en: {
    tick: 'each hop = one tick of the simulation (slowed down)',
    lineOfCenters: 'the line of centers',
    barSpeed: '🏎 speed',
    barHeight: '🪜 height',
    barHeat: '🔥 heat',
    barTotal: 'total — never changes!',
    allHeat: '💤 all motion has become heat',
  },
  nl: {
    tick: 'elke sprong = één simulatietik (uitgeremd)',
    lineOfCenters: 'de lijn door de middelpunten',
    barSpeed: '🏎 beweging',
    barHeight: '🪜 hoogte',
    barHeat: '🔥 warmte',
    barTotal: 'totaal — verandert nooit!',
    allHeat: '💤 alle beweging is warmte geworden',
  },
  no: {
    tick: 'hvert hopp = ett simuleringstikk (utbremset)',
    lineOfCenters: 'linjen gjennom sentrene',
    barSpeed: '🏎 fart',
    barHeight: '🪜 høyde',
    barHeat: '🔥 varme',
    barTotal: 'totalt — endres aldri!',
    allHeat: '💤 all bevegelse har blitt varme',
  },
};

export function bounceDelve(api: BounceDelveApi): DelveChapter[] {
  const chapters = pick(CHAPTERS);
  const lab = pick(LAB);
  return chapters.map((chapter, i) => ({
    title: chapter.title,
    paragraphs: chapter.paragraphs,
    formula: chapter.formula,
    // Only chapter 5 (index 4) has a lab: the three physics switches.
    extras:
      i === 4
        ? (host: HTMLElement) => {
            const labEl = document.createElement('div');
            labEl.className = 'delve-lab';
            const title = document.createElement('div');
            title.className = 'delve-lab-title';
            title.textContent = lab.title;
            labEl.appendChild(title);

            const mk = (name: SwitchName, label: string): void => {
              const row = document.createElement('button');
              row.className = 'arcade-button';
              row.style.cssText = 'display:block;width:100%;margin-top:0.45rem;';
              const sync = () => {
                row.textContent = `${label}: ${api.getSwitch(name) ? lab.on : lab.off}`;
              };
              row.addEventListener('click', () => {
                api.setSwitch(name, !api.getSwitch(name));
                sync();
              });
              sync();
              labEl.appendChild(row);
            };
            mk('collisions', lab.collisions);
            mk('friction', lab.friction);
            mk('dissipate', lab.dissipate);

            const note = document.createElement('p');
            note.className = 'delve-lab-note';
            note.textContent = lab.note;
            labEl.appendChild(note);
            host.appendChild(labEl);
          }
        : undefined,
  }));
}
