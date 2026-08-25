// Delve chapters for Outbreak!, in the shared chaptered style (shell/delve.ts):
// text in the card on the left, one live illustration per chapter drawn by the
// game on its canvas (index.ts drawDelve). The R0 lab sliders still hook
// straight into the running simulation.
import type { DelveChapter } from '../../shell/delve';
import type { OutbreakSim } from './sim';
import { pick, type Localized } from '../../lib/i18n';

export interface OutbreakDelve {
  chapters: DelveChapter[];
  /** Per-frame: keep the lab sliders in sync with outside sim changes. */
  update(): void;
}

const TEXT: Localized<{
  chapter1Title: string;
  chapter1Paragraphs: string[];
  chapter2Title: string;
  chapter2Paragraphs: string[];
  chapter3Title: string;
  chapter3Paragraphs: string[];
  labTitle: string;
  contagiousness: string;
  timeSick: string;
  labNote: string;
  chapter4Title: string;
  chapter4Paragraphs: string[];
  chapter4Extras: string[];
  chapter5Title: string;
  chapter5Paragraphs: string[];
}> = {
  en: {
    chapter1Title: 'Every dot is a person',
    chapter1Paragraphs: [
      'Every dot in the city is one simulated person, and its color is its state — the four groups scientists actually track during an epidemic.',
      'The classic version is the SIR model — Susceptible → Infected → Recovered — written down in 1927 and still the backbone of disease modeling today. Vaccination is the shortcut straight to safety, without ever being sick.',
      'The counts on the right are live: your city, right now.',
    ],
    chapter2Title: 'A tiny simulated city',
    chapter2Paragraphs: [
      'This is an agent-based model: 500 simulated people with homes, a school and a market. Each follows a simple daily routine, and when a sick person stands close to a healthy one there is a small chance per second that the disease jumps over. After being sick a while, a person recovers and becomes immune.',
      'Nobody in the model “knows” there is an epidemic. The wave you see — and the curve it draws in the plaza — emerges from thousands of tiny encounters.',
      '👆 The little city is live: click inside it to infect someone and watch the wave start while you read.',
    ],
    chapter3Title: 'The magic number R₀',
    chapter3Paragraphs: [
      'R₀ (“R-nought”) is how many people one sick person infects on average. Above 1, every case causes more cases and the epidemic explodes; below 1, it fizzles out. Seasonal flu is around 1.3; measles a terrifying 12–18.',
      'The tree on the right shows your current settings: drag the sliders and push the epidemic from explosion to fizzle. Every pandemic press conference you have ever seen was, at heart, about pushing R below 1.',
    ],
    labTitle: '🧪 Try it live — wired into the city',
    contagiousness: '🦠 contagiousness β',
    timeSick: '⏱ time sick (1/γ)',
    labNote:
      '“Spreading power” = β × time sick — a rough stand-in for R₀ in this toy city. Now close the science, infect someone and watch!',
    chapter4Title: 'Flatten the curve',
    chapter4Paragraphs: [
      'For a whole country you can skip the individuals and track just the three group sizes with calculus:',
    ],
    chapter4Extras: [
      'β is how contagious the disease is, γ how fast people recover, N is everyone. Your game tools are three ways of dragging R below 1: 💉 vaccination moves people out of S before they are ever sick (herd immunity), 🧼 soap lowers β, and closing the 🏫 school cuts how many contacts each person has per day.',
      'The two curves on the right show the difference. When the world said “flatten the curve” in 2020, this exact picture is what it meant.',
    ],
    chapter5Title: 'Where this is used for real',
    chapter5Paragraphs: [
      'Models like this — with millions of agents, real commuting data and real hospital numbers — advised governments through COVID-19 (in the Netherlands: the RIVM), guide vaccination campaigns, and are used against measles, malaria and animal diseases.',
      'Researchers in CWI’s Scientific Computing group have worked on simulating real epidemics — including the hard part: how uncertainty in the inputs (how contagious is a new variant, really?) changes what a model can honestly tell a decision-maker.',
      'The big curve on the right is your city’s own epidemic so far — the same picture, drawn by 500 little lives.',
    ],
  },
  nl: {
    chapter1Title: 'Elke stip is een persoon',
    chapter1Paragraphs: [
      'Elke stip in de stad is één gesimuleerde persoon, en de kleur laat de status zien — de vier groepen die wetenschappers écht bijhouden tijdens een epidemie.',
      'De klassieke versie is het SIR-model — Vatbaar → Besmet → Hersteld (Susceptible → Infected → Recovered) — opgeschreven in 1927 en nog steeds de basis van ziektemodellen vandaag de dag. Vaccinatie is de snelweg direct naar veiligheid, zonder ooit ziek te worden.',
      'De aantallen rechts zijn live: jouw stad, op dit moment.',
    ],
    chapter2Title: 'Een piepkleine gesimuleerde stad',
    chapter2Paragraphs: [
      'Dit is een agent-gebaseerd model: 500 gesimuleerde mensen met huizen, een school en een markt. Iedereen volgt een simpele dagelijkse routine, en als een ziek persoon dicht bij een gezond persoon staat, is er elke seconde een kleine kans dat de ziekte overspringt. Na een tijdje ziek te zijn geweest, herstelt iemand en wordt immuun.',
      'Niemand in het model “weet” dat er een epidemie is. De golf die je ziet — en de curve die hij tekent op het plein — ontstaat uit duizenden kleine ontmoetingen.',
      '👆 De kleine stad is live: klik erin om iemand te besmetten en zie de golf beginnen terwijl je leest.',
    ],
    chapter3Title: 'Het magische getal R₀',
    chapter3Paragraphs: [
      'R₀ (“R-nul”) is hoeveel mensen één ziek persoon gemiddeld besmet. Boven de 1 zorgt elk geval voor nog meer gevallen en explodeert de epidemie; onder de 1 dooft hij vanzelf uit. Seizoensgriep zit rond de 1,3; mazelen op een angstaanjagende 12–18.',
      'De boom rechts laat jouw huidige instellingen zien: sleep de schuifjes en duw de epidemie van explosie naar uitdoving. Elke persconferentie over een pandemie die je ooit hebt gezien, ging in de kern over het onder de 1 duwen van R.',
    ],
    labTitle: '🧪 Probeer het live — direct gekoppeld aan de stad',
    contagiousness: '🦠 besmettelijkheid β',
    timeSick: '⏱ tijd ziek (1/γ)',
    labNote:
      '“Verspreidingskracht” = β × tijd ziek — een ruwe vervanger voor R₀ in dit speelstadje. Sluit nu de wetenschap, besmet iemand en kijk wat er gebeurt!',
    chapter4Title: 'De curve afvlakken',
    chapter4Paragraphs: [
      'Voor een heel land kun je de individuen overslaan en met calculus gewoon de grootte van de drie groepen bijhouden:',
    ],
    chapter4Extras: [
      'β is hoe besmettelijk de ziekte is, γ hoe snel mensen herstellen, N is iedereen. Jouw hulpmiddelen in het spel zijn drie manieren om R onder de 1 te krijgen: 💉 vaccinatie haalt mensen uit groep S voordat ze ooit ziek worden (groepsimmuniteit), 🧼 zeep verlaagt β, en het sluiten van de 🏫 school vermindert hoeveel contacten iedereen per dag heeft.',
      'De twee curves rechts laten het verschil zien. Toen de wereld het in 2020 had over “flatten the curve” (de curve afvlakken), was dit precies het plaatje dat ermee werd bedoeld.',
    ],
    chapter5Title: 'Waar dit echt wordt gebruikt',
    chapter5Paragraphs: [
      'Modellen zoals dit — met miljoenen agents, echte forensendata en echte ziekenhuiscijfers — adviseerden overheden tijdens COVID-19 (in Nederland: het RIVM), sturen vaccinatiecampagnes, en worden gebruikt tegen mazelen, malaria en dierziekten.',
      'Onderzoekers van de Scientific Computing-groep van het CWI werken aan het simuleren van echte epidemieën — inclusief het lastige deel: hoe onzekerheid in de invoer (hoe besmettelijk is een nieuwe variant, écht?) verandert wat een model een beleidsmaker eerlijk kan vertellen.',
      'De grote curve rechts is de epidemie van jouw eigen stad tot nu toe — hetzelfde plaatje, getekend door 500 kleine levens.',
    ],
  },
  no: {
    chapter1Title: 'Hvert punkt er en person',
    chapter1Paragraphs: [
      'Hvert punkt i byen er én simulert person, og fargen viser status — de fire gruppene forskere faktisk følger med på under en epidemi.',
      'Den klassiske versjonen er SIR-modellen — Mottakelig → Smittet → Immun (Susceptible → Infected → Recovered) — skrevet ned i 1927 og fortsatt selve grunnmuren i sykdomsmodellering i dag. Vaksinasjon er snarveien rett til trygghet, uten å noensinne bli syk.',
      'Tallene til høyre er live: byen din, akkurat nå.',
    ],
    chapter2Title: 'En liten simulert by',
    chapter2Paragraphs: [
      'Dette er en agentbasert modell: 500 simulerte mennesker med hjem, en skole og et marked. Alle følger en enkel daglig rutine, og når en syk person står nær en frisk person, er det hvert sekund en liten sjanse for at sykdommen hopper over. Etter en stund blir personen frisk igjen og immun.',
      'Ingen i modellen “vet” at det er en epidemi. Bølgen du ser — og kurven den tegner på plassen — oppstår fra tusenvis av små møter.',
      '👆 Den lille byen er live: klikk inni den for å smitte noen og se bølgen starte mens du leser.',
    ],
    chapter3Title: 'Det magiske tallet R₀',
    chapter3Paragraphs: [
      'R₀ (“R-null”) er hvor mange personer én syk person smitter i gjennomsnitt. Over 1 fører hvert tilfelle til enda flere tilfeller, og epidemien eksploderer; under 1 dør den ut av seg selv. Sesonginfluensa ligger på rundt 1,3; meslinger på et skremmende 12–18.',
      'Treet til høyre viser dine nåværende innstillinger: dra i glidebryterne og skyv epidemien fra eksplosjon til utdøing. Enhver pandemi-pressekonferanse du noensinne har sett, handlet i bunn og grunn om å presse R under 1.',
    ],
    labTitle: '🧪 Prøv det live — koblet rett til byen',
    contagiousness: '🦠 smittsomhet β',
    timeSick: '⏱ tid syk (1/γ)',
    labNote:
      '“Spredningskraft” = β × tid syk — en grov erstatning for R₀ i denne lekebyen. Lukk nå vitenskapen, smitt noen og se hva som skjer!',
    chapter4Title: 'Flate ut kurven',
    chapter4Paragraphs: [
      'For et helt land kan du hoppe over enkeltpersonene og bare følge størrelsen på de tre gruppene med matematisk analyse (kalkulus):',
    ],
    chapter4Extras: [
      'β er hvor smittsom sykdommen er, γ er hvor fort folk blir friske, N er alle sammen. Verktøyene dine i spillet er tre måter å dra R under 1 på: 💉 vaksinasjon flytter folk ut av S før de noensinne blir syke (flokkimmunitet), 🧼 såpe senker β, og å stenge 🏫 skolen kutter hvor mange kontakter hver person har per dag.',
      'De to kurvene til høyre viser forskjellen. Da hele verden snakket om å “flate ut kurven” i 2020, var det nettopp dette bildet det handlet om.',
    ],
    chapter5Title: 'Hvor dette brukes i virkeligheten',
    chapter5Paragraphs: [
      'Modeller som denne — med millioner av agenter, ekte pendlerdata og ekte sykehustall — ga myndighetene råd gjennom covid-19 (i Nederland: RIVM), styrer vaksinasjonskampanjer, og brukes mot meslinger, malaria og dyresykdommer.',
      'Forskere i CWIs Scientific Computing-gruppe har jobbet med å simulere ekte epidemier — inkludert den vanskelige delen: hvordan usikkerhet i inndataene (hvor smittsom er egentlig en ny variant?) endrer hva en modell ærlig kan fortelle en beslutningstaker.',
      'Den store kurven til høyre er byens egen epidemi så langt — det samme bildet, tegnet av 500 små liv.',
    ],
  },
};

export function outbreakDelve(sim: OutbreakSim): OutbreakDelve {
  const T = pick(TEXT);
  let rateSlider: HTMLInputElement | null = null;
  let sickSlider: HTMLInputElement | null = null;
  let rateOut: HTMLElement | null = null;
  let sickOut: HTMLElement | null = null;

  const refreshLab = () => {
    if (rateOut) rateOut.textContent = sim.infectionRate.toFixed(2);
    if (sickOut) sickOut.textContent = sim.recoverTime.toFixed(1);
  };

  const chapters: DelveChapter[] = [
    {
      title: T.chapter1Title,
      paragraphs: T.chapter1Paragraphs,
    },
    {
      title: T.chapter2Title,
      paragraphs: T.chapter2Paragraphs,
    },
    {
      title: T.chapter3Title,
      paragraphs: T.chapter3Paragraphs,
      extras: (host: HTMLElement) => {
        const lab = document.createElement('div');
        lab.className = 'delve-lab';
        const title = document.createElement('div');
        title.className = 'delve-lab-title';
        title.textContent = T.labTitle;
        lab.appendChild(title);

        const row = (
          label: string,
          min: number,
          max: number,
          step: number,
          value: number,
          onInput: (v: number) => void,
        ): { input: HTMLInputElement; output: HTMLElement } => {
          const div = document.createElement('div');
          div.className = 'delve-slider-row';
          div.append(label);
          const input = document.createElement('input');
          input.type = 'range';
          input.min = String(min);
          input.max = String(max);
          input.step = String(step);
          input.value = String(value);
          const output = document.createElement('output');
          input.addEventListener('input', () => {
            onInput(parseFloat(input.value));
            refreshLab();
          });
          div.append(input, output);
          lab.appendChild(div);
          return { input, output };
        };

        const rate = row(T.contagiousness, 0.05, 0.7, 0.01, sim.infectionRate, (v) => {
          sim.infectionRate = v;
        });
        const sick = row(T.timeSick, 3, 14, 0.5, sim.recoverTime, (v) => {
          sim.recoverTime = v;
        });
        rateSlider = rate.input;
        rateOut = rate.output;
        sickSlider = sick.input;
        sickOut = sick.output;

        const note = document.createElement('p');
        note.className = 'delve-lab-note';
        note.textContent = T.labNote;
        lab.appendChild(note);
        host.appendChild(lab);
        refreshLab();
      },
    },
    {
      title: T.chapter4Title,
      paragraphs: T.chapter4Paragraphs,
      formula: 'S′ = −β·S·I/N\nI′ = β·S·I/N − γ·I\nR′ = γ·I',
      extras: (host: HTMLElement) => {
        // Prose that belongs after the formula: insert before the extras row.
        for (const text of T.chapter4Extras) {
          const p = document.createElement('p');
          p.textContent = text;
          host.parentElement?.insertBefore(p, host);
        }
      },
    },
    {
      title: T.chapter5Title,
      paragraphs: T.chapter5Paragraphs,
    },
  ];

  return {
    chapters,
    update() {
      // Follow outside changes to the sim (reset button) without fighting a
      // slider the reader is currently dragging.
      if (rateSlider && document.activeElement !== rateSlider) {
        rateSlider.value = String(sim.infectionRate);
      }
      if (sickSlider && document.activeElement !== sickSlider) {
        sickSlider.value = String(sim.recoverTime);
      }
      refreshLab();
    },
  };
}
