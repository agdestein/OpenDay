// "Delve" layer for Outbreak!: an optional panel for older kids and parents
// explaining the science behind the game — the SIR model, how the agent
// simulation works, R0, and where epidemic models are used for real.
// The live legend and the experiment sliders hook straight into the running
// simulation, so the game itself is the illustration.
import { COLOR, type OutbreakSim } from './sim';

export interface DelveHandle {
  /** The "🔬 How does this work?" pill, top-right corner. */
  toggle: HTMLElement;
  /** The slide-in panel. */
  panel: HTMLElement;
  /** Per-frame refresh of the live numbers (cheap; no-op while closed). */
  update(): void;
  /** Game mode locks the experiment sliders so rounds stay fair. */
  setMode(mode: 'toy' | 'game'): void;
}

/** Right edge of the spreading-power meter; larger products pin the needle. */
const METER_MAX = 5;
/** Rough take-off threshold for the meter's tick mark. */
const METER_TICK = 1;

export function createDelve(sim: OutbreakSim): DelveHandle {
  const panel = document.createElement('aside');
  panel.className = 'delve-panel';

  const toggle = document.createElement('button');
  toggle.className = 'delve-toggle';
  toggle.innerHTML = '🔬 <span>How does this work?</span>';
  let open = false;
  const setOpen = (value: boolean) => {
    open = value;
    panel.classList.toggle('open', open);
    toggle.classList.toggle('active', open);
    toggle.innerHTML = open ? '✕ <span>Close the science</span>' : '🔬 <span>How does this work?</span>';
  };
  toggle.addEventListener('click', () => setOpen(!open));

  const section = (title: string, html: string): HTMLElement => {
    const s = document.createElement('section');
    const h = document.createElement('h3');
    h.textContent = title;
    const body = document.createElement('div');
    body.innerHTML = html;
    s.append(h, body);
    panel.appendChild(s);
    return body;
  };

  // ---- header ----
  const heading = document.createElement('h2');
  heading.textContent = '🔬 Delve: the science of outbreaks';
  const sub = document.createElement('p');
  sub.className = 'delve-sub';
  sub.textContent = 'For curious minds — the city keeps running while you read.';
  panel.append(heading, sub);

  // ---- live legend: every dot is a person ----
  const legendBody = section(
    'Every dot is a person',
    `<div class="delve-legend"></div>
     <p>Scientists track epidemics with exactly these groups. The classic version is
     the <b>SIR model</b> — <b>S</b>usceptible → <b>I</b>nfected → <b>R</b>ecovered —
     written down in 1927 and still the backbone of disease modeling today.</p>
     <div class="delve-flow">
       <span class="delve-chip" style="background:${COLOR.s}">S</span>
       <span class="delve-arrow"><b>→</b><small>meets someone sick<br>(chance β)</small></span>
       <span class="delve-chip" style="background:${COLOR.i}">I</span>
       <span class="delve-arrow"><b>→</b><small>gets better<br>(rate γ)</small></span>
       <span class="delve-chip" style="background:${COLOR.r}">R</span>
     </div>`,
  );
  const legend = legendBody.querySelector('.delve-legend')!;
  const counts: Record<'s' | 'i' | 'r' | 'v', HTMLElement> = {} as never;
  const legendRow = (key: 's' | 'i' | 'r' | 'v', name: string, desc: string) => {
    const row = document.createElement('div');
    row.className = 'delve-legend-row';
    row.innerHTML = `<span class="delve-dot" style="background:${COLOR[key]}"></span><b>${name}</b> ${desc}<span class="delve-count"></span>`;
    counts[key] = row.querySelector('.delve-count')!;
    legend.appendChild(row);
  };
  legendRow('s', 'Susceptible', '— healthy, could still catch it');
  legendRow('i', 'Infected', '— sick and contagious');
  legendRow('r', 'Recovered', '— had it, now immune');
  legendRow('v', 'Vaccinated', '— protected without getting sick');

  // ---- how the simulation works ----
  section(
    'How this city works',
    `<p>This is an <b>agent-based model</b>: 500 simulated people with homes, a school
     and a market. Each follows a simple daily routine, and when a sick person stands
     close to a healthy one there is a small chance per second that the disease jumps
     over. After being sick a while, a person recovers and becomes immune.</p>
     <p>Nobody in the model “knows” there is an epidemic. The wave you see — and the
     curve it draws in the plaza — <b>emerges</b> from thousands of tiny encounters.</p>
     <p>For a whole country you can also skip the individuals and track just the three
     group sizes with calculus:</p>
     <div class="delve-math">
       <div><code>S′ = −β·S·I/N</code><i>healthy people get infected…</i></div>
       <div><code>I′ = +β·S·I/N − γ·I</code><i>…and the sick recover</i></div>
       <div><code>R′ = +γ·I</code></div>
     </div>
     <p>β is how contagious the disease is, γ how fast people recover, N is everyone
     (here: 500). Real national models often combine both styles — equations for
     speed, agents for detail like schools, commuting and households.</p>`,
  );

  // ---- R0 + experiment lab ----
  const labBody = section(
    'The magic number: R₀',
    `<p><b>R₀</b> (“R-nought”) is how many people one sick person infects on average.
     <b>Above 1</b>, every case causes more cases and the epidemic explodes; <b>below
     1</b>, it fizzles out. Seasonal flu is around 1.3; measles a terrifying 12–18.
     Every pandemic press conference you have ever seen was, at heart, about pushing
     R below 1.</p>
     <div class="delve-lab">
       <div class="delve-lab-title">🧪 Try it live</div>
       <div class="delve-slider-row">🦠 contagiousness β
         <input type="range" min="0.05" max="0.7" step="0.01" data-key="rate">
         <output data-out="rate"></output></div>
       <div class="delve-slider-row">⏱ time sick (1/γ)
         <input type="range" min="3" max="14" step="0.5" data-key="sick">
         <output data-out="sick"></output></div>
       <div class="delve-meter"><div class="delve-meter-tick"></div><div class="delve-meter-needle"></div></div>
       <div class="delve-meter-readout"></div>
       <p class="delve-lab-note">“Spreading power” = β × time sick — a rough stand-in
       for R₀ in this toy city. Now infect someone and watch the curve!</p>
       <p class="delve-lab-note delve-lab-locked hidden">Sliders are locked during the
       challenge — finish the round or return to free play to experiment.</p>
     </div>`,
  );
  const rateSlider = labBody.querySelector<HTMLInputElement>('[data-key=rate]')!;
  const sickSlider = labBody.querySelector<HTMLInputElement>('[data-key=sick]')!;
  const rateOut = labBody.querySelector<HTMLElement>('[data-out=rate]')!;
  const sickOut = labBody.querySelector<HTMLElement>('[data-out=sick]')!;
  const needle = labBody.querySelector<HTMLElement>('.delve-meter-needle')!;
  const tick = labBody.querySelector<HTMLElement>('.delve-meter-tick')!;
  const readout = labBody.querySelector<HTMLElement>('.delve-meter-readout')!;
  const lockedNote = labBody.querySelector<HTMLElement>('.delve-lab-locked')!;
  tick.style.left = `${(METER_TICK / METER_MAX) * 100}%`;

  let lastLab = '';
  const refreshLab = () => {
    const key = `${sim.infectionRate},${sim.recoverTime}`;
    if (key === lastLab) return;
    lastLab = key;
    rateOut.textContent = sim.infectionRate.toFixed(2);
    sickOut.textContent = sim.recoverTime.toFixed(1);
    const power = sim.infectionRate * sim.recoverTime;
    needle.style.left = `${Math.min(1, power / METER_MAX) * 100}%`;
    readout.textContent =
      power >= 1.3
        ? `Spreading power ≈ ${power.toFixed(1)} — 🔥 this one takes off`
        : power <= 0.8
          ? `Spreading power ≈ ${power.toFixed(1)} — 💨 this one fizzles out`
          : `Spreading power ≈ ${power.toFixed(1)} — ⚖️ on a knife's edge`;
  };
  rateSlider.addEventListener('input', () => {
    sim.infectionRate = parseFloat(rateSlider.value);
    refreshLab();
  });
  sickSlider.addEventListener('input', () => {
    sim.recoverTime = parseFloat(sickSlider.value);
    refreshLab();
  });

  // ---- why the tools work ----
  section(
    'Why your tools work',
    `<ul class="delve-tools">
       <li>💉 <b>Vaccinate</b> — moves people out of Susceptible without them ever
       being sick. Once enough neighbours are immune the disease cannot find new
       victims, so even the unvaccinated are safe: <b>herd immunity</b>.</li>
       <li>🧼 <b>Soap</b> — removes nobody; it lowers β, so each close encounter is
       less likely to pass the disease on.</li>
       <li>🏫 <b>Close the school</b> — removes the busiest meeting place, cutting
       how many contacts each person has per day.</li>
     </ul>
     <p>All three are just different ways of dragging R below 1. And the stacked
     graph in the plaza is the <b>epidemic curve</b> — when the world said “flatten
     the curve” in 2020, this exact picture is what it meant.</p>`,
  );

  // ---- real-world use ----
  section(
    'Where this is used for real',
    `<p>Models like this — with millions of agents, real commuting data and real
     hospital numbers — advised governments through COVID-19 (in the Netherlands: the
     RIVM), guide vaccination campaigns, and are used against measles, malaria and
     animal diseases.</p>
     <p>Researchers in CWI's Scientific Computing group have worked on simulating
     real epidemics — including the hard part: how <i>uncertainty</i> in the inputs
     (how contagious is a new variant, really?) changes what a model can honestly
     tell a decision-maker.</p>`,
  );

  const footer = document.createElement('p');
  footer.className = 'delve-footer';
  footer.textContent =
    'CWI Scientific Computing — turning the laws of nature into mathematics, and mathematics into fast programs.';
  panel.appendChild(footer);

  refreshLab();

  let lastCounts = '';
  return {
    toggle,
    panel,
    update() {
      if (!open) return;
      const c = sim.counts;
      const key = `${c.s},${c.i},${c.r},${c.vaccinated}`;
      if (key !== lastCounts) {
        lastCounts = key;
        counts.s.textContent = String(c.s);
        counts.i.textContent = String(c.i);
        counts.r.textContent = String(c.r);
        counts.v.textContent = String(c.vaccinated);
      }
      // Follow outside changes to the sim (reset button, round setup) without
      // fighting a slider the reader is currently dragging.
      if (document.activeElement !== rateSlider) rateSlider.value = String(sim.infectionRate);
      if (document.activeElement !== sickSlider) sickSlider.value = String(sim.recoverTime);
      refreshLab();
    },
    setMode(mode) {
      const locked = mode === 'game';
      rateSlider.disabled = locked;
      sickSlider.disabled = locked;
      lockedNote.classList.toggle('hidden', !locked);
    },
  };
}
