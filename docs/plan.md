# Implementation plan

One self-contained web app: an **arcade launcher** plus independent game modules.
Build order goes most-interesting-first (fluid/wind farm), with the shell designed so
that adding a new game later is a one-file affair.

## Architecture

### Stack

- **Vite + TypeScript**, no UI framework. Games are canvas/WebGL programs; a framework
  would only get in the way of the render loops.
- Rendering: **WebGL2** for the fluid solver (fragment-shader simulation), plain
  **Canvas 2D** for agent/particle games (epidemic, gravity). Both are available on any
  laptop browser.
- **Zero backend, zero network.** `vite build` produces a static `dist/` that runs from
  a local file server on the demo machines. High scores live in `localStorage`.

### Layout

```
app/
  index.html
  src/
    shell/          # launcher menu, kiosk logic, shared UI
      shell.ts      # game registry, screen switching, idle watchdog
      menu.ts       # tile grid of games
      hud.ts        # shared overlays: title card, score bar, "science line"
      scores.ts     # localStorage high-score board per game
    games/
      windfarm/     # game 1 (includes the fluid toy mode)
      outbreak/     # game 2
      floodland/    # game 3
      .../          # future games drop in here
    lib/            # shared helpers (vec math, rng, easing, fullscreen)
```

### Game module interface

Every game is one directory exporting a single object; the shell knows nothing else:

```ts
interface ArcadeGame {
  id: string;
  title: string;            // shown on the menu tile
  scienceLine: string;      // one sentence for parents, shown on the title card
  tile: TileArt;            // static image or tiny live canvas preview
  create(host: GameHost): GameInstance;
}

interface GameInstance {
  start(): void;                    // begin in toy mode, no instructions needed
  frame(dt: number): void;          // called from the shell's rAF loop
  destroy(): void;                  // must leave no timers/GL state behind
}

// GameHost provides: canvas, input events, hud (scores, buttons), audio, rng.
```

Registering a game = adding one import to a list in `shell.ts`.

### Kiosk behavior (the shell's real job)

- Fullscreen on first click; cursor visible (kids use the mouse).
- **Idle watchdog:** no input for 90 s inside a game → fade back to the menu; the menu
  itself runs an attract mode (live fluid sim swirling behind the tiles).
- **Escape hatch:** a keyboard shortcut (e.g. `Ctrl+R`-equivalent button) for stand
  staff to hard-reset a game.
- Every game opens with a 1-tap title card: big "click to play", the science line in
  small print, then straight into toy mode.
- High-score entry: three-initials arcade style, per game, per day.

## Phases

### Phase 0 — Shell + walking skeleton *(small)*

Scaffold Vite app, implement shell/menu/idle-watchdog with two **placeholder** games
(bouncing balls) to prove the module interface, screen switching, and cleanup. Add
`npm run dev` / `build` and a README section on running it.

*Done when:* two fake games are playable from the menu, idle-reset works, refresh-free
switching leaks nothing (GPU memory / listeners).

### Phase 1 — Fluid playground *(the centerpiece, toy mode first)*

WebGL2 stable-fluids solver (semi-Lagrangian advection, Jacobi pressure solve, dye +
curl noise for sparkle — the classic Pavel Dobryakov-style approach, tuned for looks).

- Mouse drag injects velocity + colored dye. Right-drag (or a palette) drops circular
  obstacles; base wind flows left→right so obstacles shed vortex streets.
- Performance target: 60 fps at 512×288 sim resolution on integrated graphics;
  resolution auto-drops if frame time exceeds budget.

*Done when:* a first-time user gets satisfying swirls within 5 seconds and it runs for
an hour without artifacts.

### Phase 2 — Wind farm game mode *(on top of Phase 1)*

- Turbine entity: placeable sprite, spins with local wind speed, injects a wake
  (momentum deficit + turbulence) behind it.
- Power model: per-turbine power ∝ (local speed)³, clamped; visibly drops for waked
  turbines (dimmed sprite + smaller number).
- Game loop: budget of ~8 turbines, 60 s timer, total energy = score → initials →
  daily leaderboard. Toy mode remains one click away.
- Stretch within phase: "let the computer try" — random search / greedy optimizer
  animating its attempts for 15 s, posting its own score to the board.

*Done when:* wake interference is visible and obviously matters to the score, and the
leaderboard loop (play → score → initials → menu) is friction-free.

### Phase 3 — Outbreak! *(second machine's headliner)*

- Canvas 2D agent sim: ~500 dots with homes/school/market schedules on a stylized
  city map; SIR states with distance-based infection.
- Toy mode: click to infect, watch it spread; live epidemic curve draws itself along
  the bottom.
- Game mode: action budget (vaccinate district, close school, wash-hands station),
  score = people saved; 2–3 escalating rounds.

*Done when:* an outbreak is visually legible from two meters away and interventions
visibly change the curve.

### Phase 4 — Save the Netherlands *(third headliner)*

- Height-field shallow-water solver (2D grid, explicit scheme, heavily damped for
  stability-over-accuracy) over a stylized elevation map of the Dutch coast.
- Toy mode: raise/lower terrain with the mouse, make waves.
- Game mode: sand budget, incoming storm surge, score = dry polders. Needs map art —
  budget a little time for making the map readable and charming.

### Phase 5+ — Widen the arcade *(each independent, pick by remaining time)*

In rough priority order: butterfly-effect twins (cheap: reuse fluid solver or pendulum
swarm) → gravity sandbox (cheap, reliable fun) → creature walking (medium; needs
learning-speed tuning) → webcam-in-the-flow (hardware-dependent) → AI-enhance panel
inside the wind farm game (needs a trained model).

### Ops for the day *(do not skip)*

- One-command launch (`npm run kiosk` → build + serve + open fullscreen browser);
  documented in the README so any group member can boot a machine.
- Per-machine game selection: URL parameter (`?games=windfarm` /
  `?games=outbreak,floodland`) so each computer can showcase a different subset.
- Dry run on the actual loaner hardware at least a week before 3 October; test with a
  real kid if one is available (little siblings count).

## Milestones vs. the calendar

Today is late August; the event is 3 October 2026 — about 5 weeks.

- **Week 1:** Phase 0 + Phase 1 (fluid toy). Already demoable.
- **Week 2:** Phase 2 (wind farm game). Minimum viable stand reached.
- **Week 3:** Phase 3 (Outbreak!). Two-machine variety reached.
- **Week 4:** Phase 4 (floodland) and/or Phase 5 quick wins; ops work.
- **Week 5:** freeze features, dry run, polish, spare-laptop fallback plan.

The stand is viable from Week 2 onward; everything after that only adds variety.
