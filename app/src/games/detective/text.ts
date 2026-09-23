import { fmtNumber, pick, type Localized } from '../../lib/i18n';
import type { CaseId } from './cases';
import type { DayId } from './world';

const deg = (t: number, digits = 1) => `${fmtNumber(t, { minimumFractionDigits: digits, maximumFractionDigits: digits })}°`;

interface CaseText {
  title: string;
  story: string;
  tip: string;
}

interface Text {
  eyebrow: string;
  freePlay: string;
  caseOf: (i: number, n: number) => string;
  hintEmpty: string;
  hintDream: string;
  hintGuess: string;
  hintPeek: string;
  dreams: string;
  guess: string;
  homesAdd: string;
  homesRemove: string;
  knmi: string;
  peek: string;
  clear: string;
  cases: string;
  days: Record<DayId, { name: string; emoji: string; when: string }>;
  guessTag: (mean: number, sd: number) => string;
  homeBias: (b: number) => string;
  stationsLine: (official: number, home: number) => string;
  aboutFree: string;
  caseText: Record<CaseId, CaseText>;
  start: string;
  thermometersLeft: (n: number) => string;
  accusationsLeft: (n: number) => string;
  makeMap: string;
  done: string;
  hottestResult: (best: number, max: number, cpu: number) => string[];
  mapResult: (mae: number, cpu: number) => string[];
  liarsResult: (caught: number, liars: number, wrong: number, cpuCaught: number, cpuWrong: number) => string[];
  points: (p: number) => string;
  hottestHere: (t: number) => string;
  computer: string;
  views: { guess: string; truth: string; computer: string; error: string };
  next: string;
  finish: string;
  totalHeading: string;
  totalLabel: (p: number) => string;
  playAgain: string;
  backToFree: string;
  looTag: (reads: number, others: number) => string;
  deg: (t: number, digits?: number) => string;
  delveHeading: string;
}

const en: Text = {
  eyebrow: 'WEATHER DETECTIVE',
  freePlay: 'Free play: place thermometers, drag them around',
  caseOf: (i, n) => `Case ${i} of ${n}`,
  hintEmpty: '👆 Click the map to place a thermometer',
  hintDream: '💭 The computer imagines the weather. Where you measure, it knows.',
  hintGuess: 'Colours: the computer’s best guess · Grey with ❓: where it is not sure',
  hintPeek: '👁 The real weather',
  dreams: '💭 Dreams',
  guess: '🔍 Best guess',
  homesAdd: '🏡 Home stations',
  homesRemove: '🏡 Remove home stations',
  knmi: '🏛 KNMI’s stations',
  peek: '👁 Peek',
  clear: '🧹 Clear',
  cases: '🕵️ Solve the cases!',
  days: {
    heatwave: { name: 'Heatwave', emoji: '🔥', when: '1 July 2025, 16:20' },
    seabreeze: { name: 'Sea breeze', emoji: '🌊', when: '14 July 2025, 11:50' },
    newyear: { name: 'New Year’s night', emoji: '🎆', when: '1 January 2025, 00:10' },
    frost: { name: 'Frosty morning', emoji: '❄️', when: '18 February 2025, 08:10' },
  },
  guessTag: (m, s) => `≈ ${deg(m)} ± ${deg(s)}`,
  homeBias: (b) => `Home stations read about 1.5° too warm (a sunny wall, close to the house). The computer worked out +${deg(b)} by itself and subtracts it.`,
  stationsLine: (o, h) => `${o} thermometer${o === 1 ? '' : 's'}${h ? ` · ${h} home stations` : ''}`,
  aboutFree: 'A real KNMI weather map is hidden here. Every thermometer tells the computer the temperature in one spot, and it has to guess everything in between. Where it is unsure, the map turns grey with question marks.',
  caseText: {
    hottest: {
      title: 'The hottest place',
      story: 'Heatwave! Somewhere in the Netherlands it is hottest of all. Find it with 8 thermometers. The colours show where it is probably warm; the grey question marks show where nobody knows yet.',
      tip: 'The computer played this with Bayesian optimisation: measure where it looks warm, or where nobody knows yet. Scientists use it to find the best with few, expensive tries.',
    },
    map: {
      title: 'The weather map',
      story: 'New Year’s night. The news needs tonight’s temperature map, and you have 6 thermometers. Place them wisely, then make the map. We compare it with the real one.',
      tip: 'Spreading out wins: each thermometer only knows its own neighbourhood. The computer put every thermometer where it was most unsure (the most question marks).',
    },
    liars: {
      title: 'The lying stations',
      story: 'A frosty morning, and 60 home weather stations report in. But 6 of them hang against a warm house wall and read much too warm! Click a station to accuse it (8 accusations). Hover to see what the others say.',
      tip: 'The computer’s trick: predict every station from all the others. One that disagrees a lot is suspicious. Real home-station data is checked the same way.',
    },
  },
  start: 'Start ▶',
  thermometersLeft: (n) => `🌡 × ${n} left`,
  accusationsLeft: (n) => `☝️ ${n} accusation${n === 1 ? '' : 's'} left`,
  makeMap: '📺 Make the map',
  done: 'Done ✓',
  hottestResult: (best, max, cpu) => [`Your hottest reading: ${deg(best)}`, `The hottest place: ${deg(max)}`, `🤖 Computer: ${deg(cpu)}`],
  mapResult: (mae, cpu) => [`Your map was off by ${deg(mae, 2)} on average`, `🤖 Computer’s map: off by ${deg(cpu, 2)}`],
  liarsResult: (caught, liars, wrong, cc, cw) => [
    `You caught ${caught} of ${liars} liars${wrong ? `, and blamed ${wrong} honest station${wrong === 1 ? '' : 's'}` : ''}`,
    `🤖 Computer: ${cc} caught${cw ? `, ${cw} blamed wrongly` : ''}`,
  ],
  points: (p) => `+${p} points`,
  hottestHere: (t) => `🔥 Hottest: ${deg(t)}`,
  computer: '🤖',
  views: { guess: 'Your map', truth: 'Real map', computer: '🤖 Computer’s map', error: 'Where you were off' },
  next: 'Next case ▶',
  finish: 'Your detective score ▶',
  totalHeading: 'Case closed!',
  totalLabel: (p) => `${p} points`,
  playAgain: '🕵️ Play again',
  backToFree: 'Free play',
  looTag: (r, o) => `reads ${deg(r)} · the others say ${deg(o)}`,
  deg,
  delveHeading: '🔬 The science of Weather Detective',
};

const nl: Text = {
  eyebrow: 'WEERDETECTIVE',
  freePlay: 'Vrij spel: zet thermometers neer en sleep ze rond',
  caseOf: (i, n) => `Zaak ${i} van ${n}`,
  hintEmpty: '👆 Klik op de kaart om een thermometer neer te zetten',
  hintDream: '💭 De computer verzint het weer. Waar jij meet, weet hij het.',
  hintGuess: 'Kleuren: de beste gok van de computer · Grijs met ❓: waar hij het niet zeker weet',
  hintPeek: '👁 Het echte weer',
  dreams: '💭 Dromen',
  guess: '🔍 Beste gok',
  homesAdd: '🏡 Thuisweerstations',
  homesRemove: '🏡 Thuisstations weg',
  knmi: '🏛 KNMI-stations',
  peek: '👁 Spieken',
  clear: '🧹 Wissen',
  cases: '🕵️ Los de zaken op!',
  days: {
    heatwave: { name: 'Hittegolf', emoji: '🔥', when: '1 juli 2025, 16:20' },
    seabreeze: { name: 'Zeewind', emoji: '🌊', when: '14 juli 2025, 11:50' },
    newyear: { name: 'Nieuwjaarsnacht', emoji: '🎆', when: '1 januari 2025, 00:10' },
    frost: { name: 'Vriezende ochtend', emoji: '❄️', when: '18 februari 2025, 08:10' },
  },
  guessTag: (m, s) => `≈ ${deg(m)} ± ${deg(s)}`,
  homeBias: (b) => `Thuisstations meten zo’n 1,5° te warm (een zonnige muur, dicht bij het huis). De computer vond zelf +${deg(b)} en trekt dat eraf.`,
  stationsLine: (o, h) => `${o} thermometer${o === 1 ? '' : 's'}${h ? ` · ${h} thuisstations` : ''}`,
  aboutFree: 'Hier ligt een echte weerkaart van het KNMI verstopt. Elke thermometer vertelt de computer de temperatuur op één plek, en de rest moet hij raden. Waar hij het niet zeker weet, wordt de kaart grijs met vraagtekens.',
  caseText: {
    hottest: {
      title: 'De heetste plek',
      story: 'Hittegolf! Ergens in Nederland is het het allerheetst. Vind die plek met 8 thermometers. De kleuren tonen waar het waarschijnlijk warm is; de grijze vraagtekens waar nog niemand het weet.',
      tip: 'De computer speelde dit met Bayesiaanse optimalisatie: meet waar het warm lijkt, óf waar nog niemand het weet. Zo vinden wetenschappers het beste met weinig dure pogingen.',
    },
    map: {
      title: 'De weerkaart',
      story: 'Nieuwjaarsnacht. Het journaal wil de temperatuurkaart van vannacht, en jij hebt 6 thermometers. Zet ze slim neer en maak de kaart. We vergelijken hem met de echte.',
      tip: 'Verspreiden wint: elke thermometer kent alleen zijn eigen buurt. De computer zette elke thermometer waar hij het minst zeker was (de meeste vraagtekens).',
    },
    liars: {
      title: 'De liegende stations',
      story: 'Een vriezende ochtend, en 60 thuisweerstations sturen hun meting. Maar 6 hangen tegen een warme huismuur en meten veel te warm! Klik op een station om het te beschuldigen (8 keer). Wijs aan om te zien wat de anderen zeggen.',
      tip: 'De truc van de computer: voorspel elk station uit alle andere. Wie sterk afwijkt, is verdacht. Echte thuisstations worden net zo gecontroleerd.',
    },
  },
  start: 'Start ▶',
  thermometersLeft: (n) => `🌡 × ${n} over`,
  accusationsLeft: (n) => `☝️ nog ${n} beschuldiging${n === 1 ? '' : 'en'}`,
  makeMap: '📺 Maak de kaart',
  done: 'Klaar ✓',
  hottestResult: (best, max, cpu) => [`Jouw heetste meting: ${deg(best)}`, `De heetste plek: ${deg(max)}`, `🤖 Computer: ${deg(cpu)}`],
  mapResult: (mae, cpu) => [`Jouw kaart zat er gemiddeld ${deg(mae, 2)} naast`, `🤖 Kaart van de computer: ${deg(cpu, 2)} ernaast`],
  liarsResult: (caught, liars, wrong, cc, cw) => [
    `Je ving ${caught} van de ${liars} leugenaars${wrong ? `, en beschuldigde ${wrong} eerlijk${wrong === 1 ? ' station' : 'e stations'}` : ''}`,
    `🤖 Computer: ${cc} gevangen${cw ? `, ${cw} onterecht` : ''}`,
  ],
  points: (p) => `+${p} punten`,
  hottestHere: (t) => `🔥 Heetst: ${deg(t)}`,
  computer: '🤖',
  views: { guess: 'Jouw kaart', truth: 'Echte kaart', computer: '🤖 Kaart van de computer', error: 'Waar je ernaast zat' },
  next: 'Volgende zaak ▶',
  finish: 'Jouw detectivescore ▶',
  totalHeading: 'Zaak gesloten!',
  totalLabel: (p) => `${p} punten`,
  playAgain: '🕵️ Nog een keer',
  backToFree: 'Vrij spel',
  looTag: (r, o) => `meet ${deg(r)} · de anderen zeggen ${deg(o)}`,
  deg,
  delveHeading: '🔬 De wetenschap van Weerdetective',
};

const no: Text = {
  eyebrow: 'VÆRDETEKTIV',
  freePlay: 'Fri lek: sett ut termometre og dra dem rundt',
  caseOf: (i, n) => `Sak ${i} av ${n}`,
  hintEmpty: '👆 Klikk på kartet for å sette ut et termometer',
  hintDream: '💭 Datamaskinen forestiller seg været. Der du måler, vet den.',
  hintGuess: 'Farger: datamaskinens beste gjetning · Grått med ❓: der den er usikker',
  hintPeek: '👁 Det ekte været',
  dreams: '💭 Drømmer',
  guess: '🔍 Beste gjetning',
  homesAdd: '🏡 Hjemmestasjoner',
  homesRemove: '🏡 Fjern hjemmestasjoner',
  knmi: '🏛 KNMIs stasjoner',
  peek: '👁 Kikk',
  clear: '🧹 Tøm',
  cases: '🕵️ Løs sakene!',
  days: {
    heatwave: { name: 'Hetebølge', emoji: '🔥', when: '1. juli 2025, 16:20' },
    seabreeze: { name: 'Havbris', emoji: '🌊', when: '14. juli 2025, 11:50' },
    newyear: { name: 'Nyttårsnatt', emoji: '🎆', when: '1. januar 2025, 00:10' },
    frost: { name: 'Frostmorgen', emoji: '❄️', when: '18. februar 2025, 08:10' },
  },
  guessTag: (m, s) => `≈ ${deg(m)} ± ${deg(s)}`,
  homeBias: (b) => `Hjemmestasjoner måler rundt 1,5° for varmt (en solvegg, nær huset). Datamaskinen fant selv +${deg(b)} og trekker det fra.`,
  stationsLine: (o, h) => `${o} termometer${o === 1 ? '' : 'e'}${h ? ` · ${h} hjemmestasjoner` : ''}`,
  aboutFree: 'Her ligger et ekte værkart fra KNMI skjult. Hvert termometer forteller datamaskinen temperaturen på ett sted, og resten må den gjette. Der den er usikker, blir kartet grått med spørsmålstegn.',
  caseText: {
    hottest: {
      title: 'Det varmeste stedet',
      story: 'Hetebølge! Et sted i Nederland er det aller varmest. Finn det med 8 termometre. Fargene viser hvor det trolig er varmt; de grå spørsmålstegnene viser hvor ingen vet ennå.',
      tip: 'Datamaskinen spilte med bayesiansk optimering: mål der det ser varmt ut, eller der ingen vet ennå. Forskere bruker det for å finne det beste med få, dyre forsøk.',
    },
    map: {
      title: 'Værkartet',
      story: 'Nyttårsnatt. Nyhetene trenger nattens temperaturkart, og du har 6 termometre. Sett dem ut klokt, og lag kartet. Vi sammenligner det med det ekte.',
      tip: 'Å spre dem vinner: hvert termometer kjenner bare sitt eget nabolag. Datamaskinen satte hvert termometer der den var mest usikker (flest spørsmålstegn).',
    },
    liars: {
      title: 'De løgnaktige stasjonene',
      story: 'En frostmorgen, og 60 hjemmestasjoner melder inn. Men 6 henger mot en varm husvegg og måler altfor varmt! Klikk på en stasjon for å anklage den (8 ganger). Pek for å se hva de andre sier.',
      tip: 'Datamaskinens triks: forutsi hver stasjon fra alle de andre. En som er veldig uenig, er mistenkelig. Ekte hjemmestasjoner sjekkes på samme måte.',
    },
  },
  start: 'Start ▶',
  thermometersLeft: (n) => `🌡 × ${n} igjen`,
  accusationsLeft: (n) => `☝️ ${n} anklage${n === 1 ? '' : 'r'} igjen`,
  makeMap: '📺 Lag kartet',
  done: 'Ferdig ✓',
  hottestResult: (best, max, cpu) => [`Din varmeste måling: ${deg(best)}`, `Det varmeste stedet: ${deg(max)}`, `🤖 Datamaskinen: ${deg(cpu)}`],
  mapResult: (mae, cpu) => [`Kartet ditt bommet med ${deg(mae, 2)} i snitt`, `🤖 Datamaskinens kart: ${deg(cpu, 2)} feil`],
  liarsResult: (caught, liars, wrong, cc, cw) => [
    `Du tok ${caught} av ${liars} løgnere${wrong ? `, og anklaget ${wrong} ærlig${wrong === 1 ? ' stasjon' : 'e stasjoner'}` : ''}`,
    `🤖 Datamaskinen: ${cc} tatt${cw ? `, ${cw} feil` : ''}`,
  ],
  points: (p) => `+${p} poeng`,
  hottestHere: (t) => `🔥 Varmest: ${deg(t)}`,
  computer: '🤖',
  views: { guess: 'Ditt kart', truth: 'Ekte kart', computer: '🤖 Datamaskinens kart', error: 'Der du bommet' },
  next: 'Neste sak ▶',
  finish: 'Din detektivscore ▶',
  totalHeading: 'Saken er løst!',
  totalLabel: (p) => `${p} poeng`,
  playAgain: '🕵️ Spill igjen',
  backToFree: 'Fri lek',
  looTag: (r, o) => `måler ${deg(r)} · de andre sier ${deg(o)}`,
  deg,
  delveHeading: '🔬 Vitenskapen bak Værdetektiv',
};

const T: Localized<Text> = { en, nl, no };

export function text(): Text {
  return pick(T);
}
