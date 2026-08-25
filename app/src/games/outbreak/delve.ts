// Delve chapters for Outbreak!, in the shared chaptered style (shell/delve.ts):
// text in the card on the left, one live illustration per chapter drawn by the
// game on its canvas (index.ts drawDelve). The R0 lab sliders still hook
// straight into the running simulation.
import type { DelveChapter } from '../../shell/delve';
import type { OutbreakSim } from './sim';

export interface OutbreakDelve {
  chapters: DelveChapter[];
  /** Per-frame: keep the lab sliders in sync with outside sim changes. */
  update(): void;
}

export function outbreakDelve(sim: OutbreakSim): OutbreakDelve {
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
      title: 'Every dot is a person',
      paragraphs: [
        'Every dot in the city is one simulated person, and its color is its state — the four groups scientists actually track during an epidemic.',
        'The classic version is the SIR model — Susceptible → Infected → Recovered — written down in 1927 and still the backbone of disease modeling today. Vaccination is the shortcut straight to safety, without ever being sick.',
        'The counts on the right are live: your city, right now.',
      ],
    },
    {
      title: 'A tiny simulated city',
      paragraphs: [
        'This is an agent-based model: 500 simulated people with homes, a school and a market. Each follows a simple daily routine, and when a sick person stands close to a healthy one there is a small chance per second that the disease jumps over. After being sick a while, a person recovers and becomes immune.',
        'Nobody in the model “knows” there is an epidemic. The wave you see — and the curve it draws in the plaza — emerges from thousands of tiny encounters.',
        '👆 The little city is live: click inside it to infect someone and watch the wave start while you read.',
      ],
    },
    {
      title: 'The magic number R₀',
      paragraphs: [
        'R₀ (“R-nought”) is how many people one sick person infects on average. Above 1, every case causes more cases and the epidemic explodes; below 1, it fizzles out. Seasonal flu is around 1.3; measles a terrifying 12–18.',
        'The tree on the right shows your current settings: drag the sliders and push the epidemic from explosion to fizzle. Every pandemic press conference you have ever seen was, at heart, about pushing R below 1.',
      ],
      extras: (host: HTMLElement) => {
        const lab = document.createElement('div');
        lab.className = 'delve-lab';
        const title = document.createElement('div');
        title.className = 'delve-lab-title';
        title.textContent = '🧪 Try it live — wired into the city';
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

        const rate = row('🦠 contagiousness β', 0.05, 0.7, 0.01, sim.infectionRate, (v) => {
          sim.infectionRate = v;
        });
        const sick = row('⏱ time sick (1/γ)', 3, 14, 0.5, sim.recoverTime, (v) => {
          sim.recoverTime = v;
        });
        rateSlider = rate.input;
        rateOut = rate.output;
        sickSlider = sick.input;
        sickOut = sick.output;

        const note = document.createElement('p');
        note.className = 'delve-lab-note';
        note.textContent =
          '“Spreading power” = β × time sick — a rough stand-in for R₀ in this toy city. Now close the science, infect someone and watch!';
        lab.appendChild(note);
        host.appendChild(lab);
        refreshLab();
      },
    },
    {
      title: 'Flatten the curve',
      paragraphs: [
        'For a whole country you can skip the individuals and track just the three group sizes with calculus:',
      ],
      formula: 'S′ = −β·S·I/N\nI′ = β·S·I/N − γ·I\nR′ = γ·I',
      extras: (host: HTMLElement) => {
        // Prose that belongs after the formula: insert before the extras row.
        for (const text of [
          'β is how contagious the disease is, γ how fast people recover, N is everyone. Your game tools are three ways of dragging R below 1: 💉 vaccination moves people out of S before they are ever sick (herd immunity), 🧼 soap lowers β, and closing the 🏫 school cuts how many contacts each person has per day.',
          'The two curves on the right show the difference. When the world said “flatten the curve” in 2020, this exact picture is what it meant.',
        ]) {
          const p = document.createElement('p');
          p.textContent = text;
          host.parentElement?.insertBefore(p, host);
        }
      },
    },
    {
      title: 'Where this is used for real',
      paragraphs: [
        'Models like this — with millions of agents, real commuting data and real hospital numbers — advised governments through COVID-19 (in the Netherlands: the RIVM), guide vaccination campaigns, and are used against measles, malaria and animal diseases.',
        'Researchers in CWI’s Scientific Computing group have worked on simulating real epidemics — including the hard part: how uncertainty in the inputs (how contagious is a new variant, really?) changes what a model can honestly tell a decision-maker.',
        'The big curve on the right is your city’s own epidemic so far — the same picture, drawn by 500 little lives.',
      ],
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
