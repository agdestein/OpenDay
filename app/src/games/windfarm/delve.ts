// Delve chapters for Swirl Lab, in the shared chaptered style (shell/delve.ts).
// Unlike bounce/orbits there are no separate demo worlds: the running fluid
// simulation IS the live illustration — the card covers only part of the
// screen and the toy stays fully interactive while you read.
import type { DelveChapter } from '../../shell/delve';
import { pick, type Localized } from '../../lib/i18n';

export interface WindfarmDelveApi {
  /** Drop an obstacle into the wind stream (turns the wind on if needed). */
  dropBlock(): void;
}

interface ChapterText {
  title: string;
  paragraphs: string[];
  formula?: string;
}

const CHAPTERS: Localized<ChapterText[]> = {
  en: [
    {
      title: 'A wind tunnel made of numbers',
      paragraphs: [
        'Everything on this screen is a live flow simulation. The screen is chopped into a grid about 256 cells across, and each cell stores two numbers: which way the air moves there, and how fast.',
        'Sixty times per second, every cell trades pushes with its neighbors, and the colored dye just rides along — that is why the colors fold and swirl like cream in coffee. Nothing is a recorded video: stir, and the numbers change.',
        '👆 The card only covers part of the screen — keep stirring on the other side while you read!',
      ],
    },
    {
      title: 'The million-dollar equations',
      paragraphs: [
        'Flowing air and water obey the Navier–Stokes equations, written down about 200 years ago. They fit on one line — yet nobody has ever managed to solve them with pen and paper, except for a few very simple flows.',
        'It is literally a million-dollar problem: the Clay Mathematics Institute offers a $1,000,000 prize just for proving that well-behaved solutions always exist.',
        'So the computer does the next best thing: chop space into cells and time into steps, and update the whole grid every frame — carefully, so the simulation stays stable and believable. That craft is numerical mathematics, and it is exactly what our group does.',
      ],
      formula: '∂u/∂t + (u·∇)u = −∇p/ρ + ν∇²u',
    },
    {
      title: 'Turbulence: swirls inside swirls',
      paragraphs: [
        'Stir hard and the flow turns turbulent: big swirls break into smaller swirls, and those into even smaller ones, until the tiniest vanish as a whiff of heat. This cascade is why turbulence is often called the last great unsolved problem of classical physics.',
        'To capture every swirl above a real wind farm, a computer would have to track eddies from kilometres down to millimetres — more computing power than exists on the planet. So real simulations compute only the big swirls and use clever mathematical models for the effect of the small ones. Inventing and improving those models is a living research field — and one of our group’s specialties.',
      ],
    },
    {
      title: 'Wakes are money',
      paragraphs: [
        'A turbine takes its power out of the wind by slowing it down — so behind every turbine hangs a wake of slow, tangled air. A turbine parked in a neighbor’s wake can lose a large slice of its power.',
        'Worse: power grows with the cube of wind speed. Twice as slow means eight times less power, so every bite a wake takes hurts triple. Over a wind farm’s lifetime, wake losses are worth millions of euros.',
        'That is why the ⚡ challenge is a placement puzzle. And the 🤖 computer opponent doesn’t guess: it probes the simulated wind at dozens of spots and greedily takes the fastest one, dodging wakes automatically. Real wind-farm designers do the same with far bigger simulations — simulating wind for wind energy is part of our group’s daily work.',
      ],
      formula: 'power ∝ (wind speed)³',
    },
  ],
  nl: [
    {
      title: 'Een windtunnel van getallen',
      paragraphs: [
        'Alles op dit scherm is een live stromingssimulatie. Het scherm is opgehakt in een raster van zo’n 256 cellen breed, en elke cel onthoudt twee getallen: welke kant de lucht daar op beweegt, en hoe snel.',
        'Zestig keer per seconde geeft elke cel duwtjes door aan zijn buren, en de gekleurde inkt lift gewoon mee — daarom vouwen en wervelen de kleuren als melk in koffie. Niets is een opgenomen filmpje: roer, en de getallen veranderen.',
        '👆 De kaart bedekt maar een deel van het scherm — blijf gerust roeren aan de andere kant terwijl je leest!',
      ],
    },
    {
      title: 'De vergelijkingen van een miljoen',
      paragraphs: [
        'Stromende lucht en water gehoorzamen de Navier–Stokes-vergelijkingen, zo’n 200 jaar geleden opgeschreven. Ze passen op één regel — en toch is het nog nooit iemand gelukt ze met pen en papier op te lossen, op een paar heel simpele stromingen na.',
        'Het is letterlijk een miljoenenprobleem: het Clay Mathematics Institute looft $1.000.000 uit voor alleen al het bewijs dat er altijd nette oplossingen bestaan.',
        'Dus doet de computer het op-één-na-beste: hak de ruimte in cellen en de tijd in stapjes, en werk het hele raster elk frame bij — zorgvuldig, zodat de simulatie stabiel en geloofwaardig blijft. Dat vak heet numerieke wiskunde, en het is precies wat onze groep doet.',
      ],
      formula: '∂u/∂t + (u·∇)u = −∇p/ρ + ν∇²u',
    },
    {
      title: 'Turbulentie: wervels in wervels',
      paragraphs: [
        'Roer hard en de stroming wordt turbulent: grote wervels breken op in kleinere wervels, en die weer in nog kleinere, tot de allerkleinsten verdwijnen als een zuchtje warmte. Door deze cascade wordt turbulentie vaak het laatste grote onopgeloste probleem van de klassieke natuurkunde genoemd.',
        'Om elke wervel boven een echt windmolenpark te vangen zou een computer wervels van kilometers tot millimeters moeten bijhouden — meer rekenkracht dan er op aarde bestaat. Echte simulaties rekenen daarom alleen de grote wervels uit en gebruiken slimme wiskundige modellen voor het effect van de kleine. Die modellen bedenken en verbeteren is een levend onderzoeksveld — en een van de specialiteiten van onze groep.',
      ],
    },
    {
      title: 'Zog is geld',
      paragraphs: [
        'Een turbine haalt zijn vermogen uit de wind door hem af te remmen — achter elke turbine hangt dus een zog van langzame, verwarde lucht. Een turbine die in het zog van zijn buurman staat, kan een flink deel van zijn vermogen verliezen.',
        'Erger nog: vermogen groeit met de derde macht van de windsnelheid. Twee keer zo langzaam betekent acht keer minder vermogen, dus elke hap die het zog neemt doet driedubbel pijn. Over de levensduur van een windmolenpark zijn zogverliezen miljoenen euro’s waard.',
        'Daarom is de ⚡-uitdaging een plaatsingspuzzel. En de 🤖 computertegenstander gokt niet: hij peilt de gesimuleerde wind op tientallen plekken en pakt gretig de snelste, waardoor hij zog vanzelf ontwijkt. Echte windparkontwerpers doen hetzelfde met veel grotere simulaties — wind simuleren voor windenergie is het dagelijkse werk van onze groep.',
      ],
      formula: 'vermogen ∝ (windsnelheid)³',
    },
  ],
  no: [
    {
      title: 'En vindtunnel av tall',
      paragraphs: [
        'Alt på denne skjermen er en levende strømningssimulering. Skjermen er delt opp i et rutenett omtrent 256 celler bredt, og hver celle husker to tall: hvilken vei luften beveger seg der, og hvor fort.',
        'Seksti ganger i sekundet utveksler hver celle dytt med naboene sine, og det fargede blekket bare blir med på lasset — derfor folder og virvler fargene seg som fløte i kaffe. Ingenting er en filmsnutt: rør, og tallene endrer seg.',
        '👆 Kortet dekker bare en del av skjermen — bare fortsett å røre på den andre siden mens du leser!',
      ],
    },
    {
      title: 'Millionligningene',
      paragraphs: [
        'Strømmende luft og vann følger Navier–Stokes-ligningene, skrevet ned for rundt 200 år siden. De får plass på én linje — men ingen har noensinne klart å løse dem med penn og papir, bortsett fra for noen få veldig enkle strømninger.',
        'Det er bokstavelig talt et millionproblem: Clay Mathematics Institute har utlovet $1 000 000 bare for et bevis på at det alltid finnes pene løsninger.',
        'Så datamaskinen gjør det nest beste: del rommet i celler og tiden i steg, og oppdater hele rutenettet hvert bilde — forsiktig, slik at simuleringen forblir stabil og troverdig. Det håndverket heter numerisk matematikk, og det er akkurat det gruppen vår driver med.',
      ],
      formula: '∂u/∂t + (u·∇)u = −∇p/ρ + ν∇²u',
    },
    {
      title: 'Turbulens: virvler i virvler',
      paragraphs: [
        'Rør hardt, og strømningen blir turbulent: store virvler brytes opp i mindre virvler, og de igjen i enda mindre, helt til de aller minste forsvinner som et pust av varme. Denne kaskaden er grunnen til at turbulens ofte kalles det siste store uløste problemet i klassisk fysikk.',
        'For å fange hver virvel over en ekte vindpark måtte en datamaskin fulgt virvler fra kilometer ned til millimeter — mer regnekraft enn det finnes på kloden. Ekte simuleringer regner derfor bare ut de store virvlene og bruker smarte matematiske modeller for effekten av de små. Å finne opp og forbedre de modellene er et levende forskningsfelt — og en av spesialitetene til gruppen vår.',
      ],
    },
    {
      title: 'Kjølvann er penger',
      paragraphs: [
        'En turbin henter kraften sin ut av vinden ved å bremse den — bak hver turbin henger det derfor et kjølvann av langsom, sammenfiltret luft. En turbin som står i naboens kjølvann, kan miste en stor del av kraften sin.',
        'Verre: kraften vokser med tredje potens av vindfarten. Halvparten så fort betyr åtte ganger mindre kraft, så hver bit kjølvannet tar, svir trippelt. Over en vindparks levetid er kjølvannstap verdt millioner av euro.',
        'Derfor er ⚡-utfordringen et plasseringspuslespill. Og 🤖-datamotstanderen gjetter ikke: den måler den simulerte vinden på titalls steder og tar grådig den raskeste, så den unngår kjølvann helt av seg selv. Ekte vindparkdesignere gjør det samme med langt større simuleringer — å simulere vind for vindkraft er en del av gruppens daglige arbeid.',
      ],
      formula: 'kraft ∝ (vindfart)³',
    },
  ],
};

/** Labels for the chapter-3 "drop a block" vortex-street lab. */
const LAB: Localized<{ title: string; drop: string; note: string }> = {
  en: {
    title: '🧪 Try it live',
    drop: '🪨 Drop a block into the wind',
    note: 'Look behind the block: the wavy trail of alternating swirls is a vortex street — the same pattern clouds draw behind ocean islands, and the reason flags flap.',
  },
  nl: {
    title: '🧪 Probeer het zelf',
    drop: '🪨 Gooi een blok in de wind',
    note: 'Kijk achter het blok: het golvende spoor van afwisselende wervels is een wervelstraat — hetzelfde patroon dat wolken achter eilanden in de oceaan tekenen, en de reden dat vlaggen wapperen.',
  },
  no: {
    title: '🧪 Prøv det live',
    drop: '🪨 Slipp en blokk i vinden',
    note: 'Se bak blokken: det bølgende sporet av vekslende virvler er en virvelgate — det samme mønsteret skyer tegner bak øyer i havet, og grunnen til at flagg blafrer.',
  },
};

export function windfarmDelve(api: WindfarmDelveApi): DelveChapter[] {
  const chapters = pick(CHAPTERS);
  const lab = pick(LAB);
  return chapters.map((chapter, i) => ({
    title: chapter.title,
    paragraphs: chapter.paragraphs,
    formula: chapter.formula,
    // Only chapter 3 (index 2, turbulence) has the vortex-street lab.
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
            button.textContent = lab.drop;
            button.addEventListener('click', () => api.dropBlock());
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
