// Delve chapters for Gravity Doodle, in the shared chaptered style
// (shell/delve.ts): text in the card on the left, one live illustration per
// chapter drawn by the game on its canvas (index.ts drawDelve).
import type { DelveChapter } from '../../shell/delve';

export type Integrator = 'euler' | 'symplectic';

export interface OrbitsDelveApi {
  getIntegrator(): Integrator;
  setIntegrator(kind: Integrator): void;
}

export function orbitsDelve(api: OrbitsDelveApi): DelveChapter[] {
  return [
    {
      title: 'One speed decides the orbit',
      paragraphs: [
        'Gravity always pulls your planet straight toward the Sun — harder when it is close, weaker when it is far. The shape of the path is decided by one thing only: how fast you throw.',
        'Too slow and the planet falls into the Sun. At exactly the right speed it flies a perfect circle. A bit faster stretches the circle into an ellipse. And past the escape speed, gravity can never win: the planet leaves forever on a hyperbola.',
        'On the right, four planets are launched from the same spot, only their speed differs. The escape speed is always √2 (about 141%) of the circle speed — a fact Newton could already compute.',
        '👆 This is what the dashed preview line in the game shows while you aim: blue-green means it will orbit, orange means it is gone for good.',
      ],
      formula: 'v_escape = √2 × v_circle',
    },
    {
      title: 'Gravity pulls both ways',
      paragraphs: [
        'Newton’s law of gravity says the force grows with both masses and fades with distance squared. And his third law says the pull is mutual: the star pulls the planet, and the planet pulls back on the star with exactly the same force — look at the two orange arrows, always equal and opposite.',
        'So why does the heavy one barely move? Newton’s second law: acceleration = force ÷ mass. The same force gives the light body a big acceleration and the heavy body a tiny one. Both actually orbit their shared balance point (the little cross).',
        'That tiny wobble of the big star is real science: it is how astronomers discovered many of the first planets around other stars — not by seeing the planet, but by seeing the star wobble.',
      ],
      formula: 'F = G · m₁ · m₂ / r²',
    },
    {
      title: 'Nothing is ever lost',
      paragraphs: [
        'A planet on a stretched orbit is like a skateboarder in a half-pipe. Close to the Sun it races (lots of speed energy); far away it climbs and slows down (the speed energy is traded for height energy). That is why real comets sprint past the Sun and then crawl through the outer solar system for decades.',
        'Nothing is ever lost in the trade: the graphs below the orbit show the two energies live, and their sum is a perfectly flat line. Physicists call this conservation of energy, and it is one of the sharpest tools we have for checking whether a simulation is telling the truth.',
        'Remember that flat line — in the next chapter the computer will accidentally break it.',
      ],
      formula: 'E = ½·m·v² − G·M·m/r = constant',
    },
    {
      title: 'How the computer actually does it',
      paragraphs: [
        'A computer cannot fly a smooth curve. It plays a flip-book: where am I? Which way does gravity pull? Take a small straight step. Repeat, thousands of times per second. On the right the steps are made huge and slow so you can watch each one.',
        'The simplest recipe (Euler’s method, from 1768) has a bug you can see: each straight step jumps slightly outside the true curve, so the orbit spirals outward. The energy graph gives it away — the computer is inventing energy out of nothing!',
        'Smarter step recipes, called symplectic methods, take the step in a way that respects the energy trade. Same step size, and the orbit stays closed. Choosing clever step recipes is a real research field — it is exactly the kind of mathematics our Scientific Computing group works on.',
      ],
      extras: (host: HTMLElement) => {
        const lab = document.createElement('div');
        lab.className = 'delve-lab';
        const title = document.createElement('div');
        title.className = 'delve-lab-title';
        title.textContent = '🧪 Try it live';
        lab.appendChild(title);

        const button = document.createElement('button');
        button.className = 'arcade-button';
        button.style.marginTop = '0.6rem';
        const sync = () => {
          button.textContent =
            api.getIntegrator() === 'euler'
              ? '🪄 Switch to smart (symplectic) steps'
              : '↩ Back to simple (Euler) steps';
        };
        button.addEventListener('click', () => {
          api.setIntegrator(api.getIntegrator() === 'euler' ? 'symplectic' : 'euler');
          sync();
        });
        sync();
        lab.appendChild(button);

        const note = document.createElement('p');
        note.className = 'delve-lab-note';
        note.textContent =
          'Watch the orbit and the energy line: simple steps drift outward and gain energy; smart steps wobble a little but never drift away.';
        lab.appendChild(note);
        host.appendChild(lab);
      },
    },
    {
      title: 'To the Moon and back',
      paragraphs: [
        'This is not a drawing — it is this simulation flying a spacecraft with the same little steps you just watched. The little arrows show gravity’s pull at every point: almost everywhere it points to Earth, but inside the glowing disk the Moon’s own pull takes over.',
        'Watch the ghost ship: same launch, but with the Moon’s gravity switched off, it runs out of climb just short of that disk and falls back — it would never reach the Moon at all. The real ship is pulled that last stretch by the Moon itself, whipped once around it, and thrown home. The path draws a perfect figure-8: the famous free-return trajectory.',
        'Apollo astronauts flew this shape to the Moon because it has a built-in safety net: if the engine fails, you touch nothing and gravity still delivers you back to Earth — the free ride home that saved the crew of Apollo 13. Half a century later, NASA’s Artemis II, the first crewed Moon mission since 1972, was designed around the very same figure-8.',
        'Get the launch speed wrong by a fraction of a percent and the 8 falls apart. That is why space agencies simulate millions of trajectories before anyone climbs into a rocket — with the same two ingredients as this game: Newton’s gravity, plus numerical integration.',
      ],
    },
  ];
}
