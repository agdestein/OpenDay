# CWI Science Arcade

An arcade of small, playable simulation games for the **CWI Science Day**, showcasing
the [Scientific Computing group](https://www.cwi.nl/en/research/scientific-computing/).

Kids walk up to a stand, pick a game on the screen, and play with a real-time
simulation — stirring turbulence, building dikes against a storm surge, stopping an
epidemic, teaching a creature to walk. Every game is powered by the same kind of
mathematics our group works on every day.

## The event

- **What:** [CWI Science Day](https://www.cwi.nl/en/events/opendaycwi/) — kids (with
  parents) visit the institute; every research group has its own stand.
- **When:** Saturday 3 October 2026.
- **Our stand:** one to three computers (keyboard, mouse, monitor) running this app.
- **Visitors:** spend anywhere from 30 seconds to 15 minutes per stand. Kids are the
  primary audience; parents are an important secondary audience.

## What we want to communicate

> **Scientific computing can simulate anything.**
> The same mathematics that predicts the weather also designs wind farms, fights
> epidemics, protects the Netherlands from the sea, and teaches AI to move.
> We are the group that makes computers do that.

See [docs/message.md](docs/message.md) for the full formulation of our goals and the
per-audience message, and [docs/ideas.md](docs/ideas.md) for the catalog of game ideas.

## The app

One self-contained web app (the "arcade"): a launcher menu where each game is a tile.
Games are independent modules sharing a small common shell (fullscreen kiosk mode,
idle-reset back to the menu, local high scores). Runs offline in a browser on any
laptop — nothing to break on the day.

The menu's "🔬 How does this work?" button opens a card layer with the big picture —
how nature becomes equations, what scientific computing is, why computers were built
in the first place (the Mathematisch Centrum built the Netherlands' first), and who
CWI and our group are. The same button inside each game opens that game's own
science explainer.

Planned first games (see [docs/plan.md](docs/plan.md) for the full implementation plan):

1. **Fluid playground / wind farm challenge** — real-time 2D flow you can stir; place
   turbines, harvest power, beat the daily record.
2. **Outbreak!** — stop a simulated epidemic in a mini-city (our group has actually
   worked on epidemic simulation).
3. **Save the Netherlands** — build dikes against a storm surge, on a budget.
4. **Creature Lab** — build a stick creature and watch evolution teach it to walk;
   race your champion against the reigning champ of the day.

## Running the app

Requires Node.js.

```sh
cd app
npm install
npm run dev       # development server with live reload
npm run build     # static production build in app/dist
npm run preview   # serve the production build
```

Useful at the stand:

- Add `?games=bounce,orbits` (comma-separated game ids) to the URL to limit which
  games a machine shows, so each computer showcases a different subset.
- Add `?lang=nl` (or `en`, `no`) to set a machine's default language; visitors can
  switch with the flag buttons on the menu. English is the development/source
  language, Dutch is the event language, Norwegian exists for playtesting.
  Translations live next to the code that uses them as typed `Localized<...>`
  dictionaries (see `app/src/lib/i18n.ts`) — a missing translation is a compile
  error, so the three languages cannot silently drift apart.
- Press `F` (or the corner button) for fullscreen; `Esc` returns to the menu.
- A game with no input for 90 seconds resets to the menu automatically.

## Credits

The real-time fluid solver behind the wind-farm game
(`app/src/games/windfarm/`) is adapted from
[WebGL-Fluid-Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation)
by Pavel Dobryakov (MIT License), itself based on the stable-fluids method of
[GPU Gems ch. 38](https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-38-fast-fluid-dynamics-simulation-gpu).
Our version is a TypeScript/WebGL2 rewrite of the solver core, with added wind
inflow, obstacles, turbine drag disks, velocity probes, and the wake view.

## Repository layout

- `README.md` — this file, the entry point.
- `docs/message.md` — goals: what the stand should achieve and communicate.
- `docs/ideas.md` — catalog of game ideas (built, planned, and future).
- `docs/plan.md` — architecture and phased implementation plan.
- `app/` — the arcade web app (Vite + TypeScript; games live in `app/src/games/`).
