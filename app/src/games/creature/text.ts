// Creature Lab's words for the park, the editor, teaching, the race and the
// challenge frame (the rounds and the delve keep their own).
import { fmtNumber, type Localized } from '../../lib/i18n';
import type { Reward } from './evolve';

export interface CreatureText {
  park: {
    hint: string;
    selectedHint: (name: string) => string;
    draw: string;
    teach: string;
    race: string;
    challenge: string;
    raceFirst: string;
    you: string;
    mine: string;
  };
  editor: {
    hint: { draw: string; move: string; type: string; erase: string };
    draw: string;
    move: string;
    boneMuscle: string;
    erase: string;
    undo: string;
    clear: string;
    done: string;
    needsMuscle: string;
    doneHint: string;
  };
  teach: {
    hint: string;
    rewardHint: Record<Reward, string>;
    reward: Record<Reward, string>;
    speed: (s: 'x1' | 'x3' | 'turbo') => string;
    done: string;
    race: string;
    hud: (gen: number, best: string, secs: number) => string;
    clock: (practice: string, tries: number) => string;
    clockReal: (real: string) => string;
    robot: (practice: string) => string;
    picked: string;
    pickHere: string;
    turbo: string;
    chart: Record<Reward, string>;
    doneHint: string;
    record: string;
  };
  race: {
    hint: string;
    soloHint: string;
    go: string;
    winHeading: string;
    firstHeading: string;
    loseHeading: string;
    scoreLabel: (you: number, champ: number | null) => string;
    trainMore: string;
    toPark: string;
    you: string;
    champ: (name: string) => string;
    hud: (t: number, you: number, champ: number | null) => string;
  };
  challenge: {
    heading: string;
    round: (i: number, n: number) => string;
    roundPoints: (n: number) => string;
    nextRound: string;
    finalScore: string;
    playAgain: string;
    freePlay: string;
    stop: string;
    points: (n: number) => string;
  };
}

const m = (x: number) => `${fmtNumber(x, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} m`;

export const TEXT: Localized<CreatureText> = {
  en: {
    park: {
      hint: 'Grab a creature and throw it! 👆  Pick one and teach it to walk 🧠',
      selectedHint: (name) => `⭐ ${name} is picked. Teach it to walk, or draw your own creature ✏️`,
      draw: 'Draw your own',
      teach: 'Teach it!',
      race: 'Race',
      challenge: 'Challenge',
      raceFirst: 'Teach it first',
      you: '⭐',
      mine: '⭐ yours',
    },
    editor: {
      hint: {
        draw: 'Drag from a dot to grow arms, legs and tails. Then press Done ✓',
        move: 'Drag the dots to reshape your creature.',
        type: 'Click a stick to flip it: gray bones are stiff, red muscles push and pull.',
        erase: 'Click a dot or stick to remove it.',
      },
      draw: 'Draw',
      move: 'Move',
      boneMuscle: 'Bone/muscle',
      erase: 'Erase',
      undo: 'Undo',
      clear: 'Start over',
      done: 'Done',
      needsMuscle: 'Needs a muscle!',
      doneHint: 'Your creature is in the park, with a brain that knows nothing yet. Teach it to walk! 🧠',
    },
    teach: {
      hint: 'Every baby has its own random brain. The farthest walkers get babies — or click the one YOU like ❤️',
      rewardHint: {
        far: 'Reward: distance. The only thing they are told is how far they got.',
        ground: 'Reward: race-walking. Distance only counts while a foot touches the ground.',
        high: 'Reward: jumping. The higher all feet leave the ground, the better.',
        back: 'Reward: backwards! The farther to the left, the better.',
      },
      reward: { far: 'Far', ground: 'Race-walk', high: 'Jump', back: 'Backwards' },
      speed: (s) => (s === 'x1' ? 'Speed ×1' : s === 'x3' ? 'Speed ×3' : 'Turbo'),
      done: 'Done',
      race: 'Race!',
      hud: (gen, best, secs) => `🧬 Generation ${gen}   🏆 ${best}   ⏱ ${secs}s`,
      clock: (practice, tries) => `🕐 ${practice} of practice · ${fmtNumber(tries)} tries`,
      clockReal: (real) => `in ${real} of real time`,
      robot: (practice) => `A real robot would have needed ${practice} — and new knees.`,
      picked: '❤️ You picked it!',
      pickHere: '❤️ click to pick',
      turbo: '⚡ TURBO: the computer stops drawing and only computes',
      chart: {
        far: 'best distance per generation',
        ground: 'best race-walk per generation',
        high: 'best jump per generation',
        back: 'best backwards walk per generation',
      },
      doneHint: 'Your creature is in the park! Race it for today’s crown 👑',
      record: 'New record!',
    },
    race: {
      hint: 'Farthest in 12 seconds wins the crown! 🏁',
      soloHint: 'Nobody has raced this kind of creature today: set the first record! 🏁',
      go: 'GO!',
      winHeading: '👑 You took the crown!',
      firstHeading: '👑 The first crown of the day!',
      loseHeading: '🏁 The champion keeps the crown!',
      scoreLabel: (you, champ) => (champ === null ? `You: ${m(you)}` : `You: ${m(you)} — Champion: ${m(champ)}`),
      trainMore: '🧠 Train more',
      toPark: '🌳 Back to the park',
      you: '⭐ YOU',
      champ: (name) => `👑 ${name}`,
      hud: (t, you, champ) => `⏱ ${t.toFixed(1)}s   ⭐ ${m(you)}${champ === null ? '' : `   👑 ${m(champ)}`}`,
    },
    challenge: {
      heading: '🧬 Creature Lab challenge',
      round: (i, n) => `Round ${i}/${n}`,
      roundPoints: (n) => `+${fmtNumber(n)} points`,
      nextRound: 'Next round ▶',
      finalScore: 'Final score ▶',
      playAgain: '🔁 Play again',
      freePlay: '🌳 Back to the park',
      stop: 'Stop',
      points: (n) => `${fmtNumber(n)} points`,
    },
  },
  nl: {
    park: {
      hint: 'Pak een beestje en gooi het! 👆  Kies er een en leer het lopen 🧠',
      selectedHint: (name) => `⭐ ${name} is gekozen. Leer het lopen, of teken je eigen beestje ✏️`,
      draw: 'Teken je eigen',
      teach: 'Leer het lopen!',
      race: 'Race',
      challenge: 'Uitdaging',
      raceFirst: 'Eerst trainen',
      you: '⭐',
      mine: '⭐ van jou',
    },
    editor: {
      hint: {
        draw: 'Sleep vanaf een stip om armen, benen en staarten te laten groeien. Druk dan op Klaar ✓',
        move: 'Sleep de stippen om je beestje een nieuwe vorm te geven.',
        type: 'Klik op een stok om hem om te draaien: grijze botten zijn stijf, rode spieren duwen en trekken.',
        erase: 'Klik op een stip of stok om hem te verwijderen.',
      },
      draw: 'Tekenen',
      move: 'Verplaatsen',
      boneMuscle: 'Bot/spier',
      erase: 'Wissen',
      undo: 'Terug',
      clear: 'Opnieuw',
      done: 'Klaar',
      needsMuscle: 'Heeft een spier nodig!',
      doneHint: 'Je beestje staat in het park, met een brein dat nog niks weet. Leer het lopen! 🧠',
    },
    teach: {
      hint: 'Elke baby heeft een eigen willekeurig brein. De verste lopers krijgen baby’s — of klik op degene die JIJ leuk vindt ❤️',
      rewardHint: {
        far: 'Beloning: afstand. Het enige wat ze horen is hoe ver ze kwamen.',
        ground: 'Beloning: snelwandelen. Afstand telt alleen als er een voet op de grond staat.',
        high: 'Beloning: springen. Hoe hoger alle voeten van de grond komen, hoe beter.',
        back: 'Beloning: achteruit! Hoe verder naar links, hoe beter.',
      },
      reward: { far: 'Ver', ground: 'Snelwandelen', high: 'Springen', back: 'Achteruit' },
      speed: (s) => (s === 'x1' ? 'Snelheid ×1' : s === 'x3' ? 'Snelheid ×3' : 'Turbo'),
      done: 'Klaar',
      race: 'Race!',
      hud: (gen, best, secs) => `🧬 Generatie ${gen}   🏆 ${best}   ⏱ ${secs}s`,
      clock: (practice, tries) => `🕐 ${practice} geoefend · ${fmtNumber(tries)} pogingen`,
      clockReal: (real) => `in ${real} echte tijd`,
      robot: (practice) => `Een echte robot had ${practice} nodig gehad — en nieuwe knieën.`,
      picked: '❤️ Jij koos deze!',
      pickHere: '❤️ klik om te kiezen',
      turbo: '⚡ TURBO: de computer tekent niet meer en rekent alleen',
      chart: {
        far: 'beste afstand per generatie',
        ground: 'beste snelwandeling per generatie',
        high: 'beste sprong per generatie',
        back: 'beste achteruitwandeling per generatie',
      },
      doneHint: 'Je beestje staat in het park! Race om de kroon van vandaag 👑',
      record: 'Nieuw record!',
    },
    race: {
      hint: 'Wie in 12 seconden het verst komt, wint de kroon! 🏁',
      soloHint: 'Niemand heeft vandaag met zo’n beestje geracet: zet het eerste record! 🏁',
      go: 'AF!',
      winHeading: '👑 Jij hebt de kroon veroverd!',
      firstHeading: '👑 De eerste kroon van vandaag!',
      loseHeading: '🏁 De kampioen houdt de kroon!',
      scoreLabel: (you, champ) => (champ === null ? `Jij: ${m(you)}` : `Jij: ${m(you)} — Kampioen: ${m(champ)}`),
      trainMore: '🧠 Meer trainen',
      toPark: '🌳 Terug naar het park',
      you: '⭐ JIJ',
      champ: (name) => `👑 ${name}`,
      hud: (t, you, champ) => `⏱ ${t.toFixed(1)}s   ⭐ ${m(you)}${champ === null ? '' : `   👑 ${m(champ)}`}`,
    },
    challenge: {
      heading: '🧬 Beestenlab-uitdaging',
      round: (i, n) => `Ronde ${i}/${n}`,
      roundPoints: (n) => `+${fmtNumber(n)} punten`,
      nextRound: 'Volgende ronde ▶',
      finalScore: 'Eindscore ▶',
      playAgain: '🔁 Nog een keer',
      freePlay: '🌳 Terug naar het park',
      stop: 'Stop',
      points: (n) => `${fmtNumber(n)} punten`,
    },
  },
  no: {
    park: {
      hint: 'Grip en skapning og kast den! 👆  Velg en og lær den å gå 🧠',
      selectedHint: (name) => `⭐ ${name} er valgt. Lær den å gå, eller tegn din egen skapning ✏️`,
      draw: 'Tegn din egen',
      teach: 'Lær den å gå!',
      race: 'Løp',
      challenge: 'Utfordring',
      raceFirst: 'Tren først',
      you: '⭐',
      mine: '⭐ din',
    },
    editor: {
      hint: {
        draw: 'Dra fra en prikk for å la armer, bein og haler vokse. Trykk så på Ferdig ✓',
        move: 'Dra i prikkene for å forme skapningen din på nytt.',
        type: 'Klikk på en pinne for å bytte type: grå bein er stive, røde muskler skyver og drar.',
        erase: 'Klikk på en prikk eller pinne for å fjerne den.',
      },
      draw: 'Tegn',
      move: 'Flytt',
      boneMuscle: 'Bein/muskel',
      erase: 'Slett',
      undo: 'Angre',
      clear: 'Begynn på nytt',
      done: 'Ferdig',
      needsMuscle: 'Trenger en muskel!',
      doneHint: 'Skapningen din er i parken, med en hjerne som ikke kan noe ennå. Lær den å gå! 🧠',
    },
    teach: {
      hint: 'Hver baby har sin egen tilfeldige hjerne. De som går lengst får babyer — eller klikk på den DU liker ❤️',
      rewardHint: {
        far: 'Belønning: avstand. Det eneste de får vite er hvor langt de kom.',
        ground: 'Belønning: kappgang. Avstanden teller bare mens en fot er i bakken.',
        high: 'Belønning: hopp. Jo høyere alle føttene kommer fra bakken, jo bedre.',
        back: 'Belønning: baklengs! Jo lenger til venstre, jo bedre.',
      },
      reward: { far: 'Langt', ground: 'Kappgang', high: 'Hopp', back: 'Baklengs' },
      speed: (s) => (s === 'x1' ? 'Fart ×1' : s === 'x3' ? 'Fart ×3' : 'Turbo'),
      done: 'Ferdig',
      race: 'Løp!',
      hud: (gen, best, secs) => `🧬 Generasjon ${gen}   🏆 ${best}   ⏱ ${secs}s`,
      clock: (practice, tries) => `🕐 ${practice} øving · ${fmtNumber(tries)} forsøk`,
      clockReal: (real) => `på ${real} ekte tid`,
      robot: (practice) => `En ekte robot hadde trengt ${practice} — og nye knær.`,
      picked: '❤️ Du valgte denne!',
      pickHere: '❤️ klikk for å velge',
      turbo: '⚡ TURBO: datamaskinen slutter å tegne og bare regner',
      chart: {
        far: 'beste avstand per generasjon',
        ground: 'beste kappgang per generasjon',
        high: 'beste hopp per generasjon',
        back: 'beste baklengstur per generasjon',
      },
      doneHint: 'Skapningen din er i parken! Løp om dagens krone 👑',
      record: 'Ny rekord!',
    },
    race: {
      hint: 'Den som kommer lengst på 12 sekunder, vinner kronen! 🏁',
      soloHint: 'Ingen har løpt med en slik skapning i dag: sett den første rekorden! 🏁',
      go: 'KJØR!',
      winHeading: '👑 Du tok kronen!',
      firstHeading: '👑 Dagens første krone!',
      loseHeading: '🏁 Mesteren beholder kronen!',
      scoreLabel: (you, champ) => (champ === null ? `Du: ${m(you)}` : `Du: ${m(you)} — Mester: ${m(champ)}`),
      trainMore: '🧠 Tren mer',
      toPark: '🌳 Tilbake til parken',
      you: '⭐ DU',
      champ: (name) => `👑 ${name}`,
      hud: (t, you, champ) => `⏱ ${t.toFixed(1)}s   ⭐ ${m(you)}${champ === null ? '' : `   👑 ${m(champ)}`}`,
    },
    challenge: {
      heading: '🧬 Skapningslab-utfordring',
      round: (i, n) => `Runde ${i}/${n}`,
      roundPoints: (n) => `+${fmtNumber(n)} poeng`,
      nextRound: 'Neste runde ▶',
      finalScore: 'Sluttpoeng ▶',
      playAgain: '🔁 Spill igjen',
      freePlay: '🌳 Tilbake til parken',
      stop: 'Stopp',
      points: (n) => `${fmtNumber(n)} poeng`,
    },
  },
};

export { m as fmtMetres };
