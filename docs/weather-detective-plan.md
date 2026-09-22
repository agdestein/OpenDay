# Weather Detective — plan

A new arcade game loosely based on our KNMI project: *Leveraging crowdsourced
weather data across Europe with scalable multi-fidelity Gaussian Process
regression* (Klein, Mücke, Hoekstra, Agdestein, …, Crommelin, Garcia-Marti;
paper draft in `~/Projects/KNMI/Paper/main.tex`). Last year's Science Day game
about the same project,
[CWI_gp_temp_scienceday](https://github.com/rik-stra/CWI_gp_temp_scienceday),
is its starting point.

Status: **plan**. Nothing is built yet.

## Why this game, and why in this arcade

Every game in the arcade is a *forward* simulation: set up the world, run the
physics, watch what happens. None of them asks the question that comes first in
real work: **how do we know what the world looks like right now?** A model is
only as good as its measurements, and there are never enough of them.

Weather Detective turns that around. The real weather map is hidden. You get a
few thermometers. The computer guesses the temperature everywhere else and also
shows **how sure it is**. That fills gaps the arcade has now:

| | Existing games | Weather Detective |
|---|---|---|
| Domain | energy, health, water, AI, physics, space | **weather** (the first word of our message line: "the same mathematics that predicts the weather…"; the chaos-twins idea that would cover it is unbuilt) |
| Method | PDEs, agent-based models, evolution, ODEs | **statistics / machine learning from data**: interpolation with uncertainty |
| Data | all synthetic | **real KNMI maps** of real days in the Netherlands |
| Partner story | Deltares (dikes), epidemics | **KNMI**, plus citizens: "Do you have a weather station in your garden? Stations like yours make these maps." |
| Uncertainty | Outbreak's forecast fan | uncertainty is the **main mechanic**: you play against the fog |

It is also the quietest game on the stand: a calm, thinking game next to
Swirl Lab and Creature Lab. Parents can play it together with older kids.

## What last year's game did, and what to change

Last year's game was Streamlit + folium + GPyTorch. You clicked to place a
thermometer on a map of the Netherlands, a GP was retrained (50 Adam steps), the
map redrew, and the score was the mean error against the KNMI map, plotted
against the number of thermometers. It also had a "KNMI stations" mode that
placed the 33 real station locations.

Keep: real KNMI maps of four days (the data files are small and public in that
repo, and in `~/Projects/KNMI/toy_GP/data/`), click to place a thermometer,
error against the real map, the error-versus-thermometers curve.

Change:

- **Slow.** Each click took a server round-trip and a GP retrain. Here the GP
  runs in the browser with fixed per-day hyperparameters, so the map updates in
  one frame and you can *drag* a thermometer and watch the map follow. That is
  the arcade's rule: react within a frame.
- **The error was visible all the time**, so the game became hot-and-cold with
  the answer on the screen. In the challenge the error is hidden until the
  reveal. What you see is the model's own uncertainty. Deciding where to measure
  when you don't know the answer is exactly the real problem.
- **Uncertainty was a separate tab.** Here it is fog over the map, always on
  and impossible to miss.
- **Only one kind of thermometer.** The paper's point is *multi-fidelity*:
  a few accurate official stations plus many cheap, noisy, biased home
  stations. That becomes the game's main choice.
- No kiosk robustness, no i18n, no explainer. Here it plugs into the arcade
  shell like the other games.

## The game

### Look

A map of the Netherlands (coastline, IJsselmeer, a handful of city names),
first covered in soft grey **fog**. Where the computer has a guess, the fog
lifts and shows the familiar blue → yellow → red weather-map colours. Fog
opacity is the posterior standard deviation relative to the prior (fully foggy
= "no idea", clear = "sure"). Thermometers are big icons with their reading
(`24.3°`) readable from two metres. Official stations are white/orange (KNMI
style), garden stations are small green house-shaped dots.

### Free play (toy mode, zero reading)

- **Click** anywhere: a thermometer drops in with a little bounce and shows
  its reading. Colour spreads out around it and the fog lifts in a circle about
  one length scale wide.
- **Drag** a thermometer and the whole map moves with it, live. This is the
  30-second wow.
- **Right-click / drag off the map** removes one. **Clear** resets.
- **🏡 Garden stations:** sprinkle ~150 citizen stations into the towns (placed
  by urban fraction). Suddenly the map has city detail, but it runs a bit too
  warm and a few stations are wildly off. That is the multi-fidelity story in
  one button.
- **👁 Peek:** hold to see the real map through the fog and compare.
- **Day picker:** the four KNMI moments (hot July afternoon, early July,
  frosty New Year's night, February morning). Each one looks clearly different:
  sea-breeze coast, cities warmer at night, and so on.

Only these five controls. The advanced switches (bias correction, map
knowledge, reach) live in the explainer's live demos, not on the toy screen.

### Challenge: "Beat the weather computer"

Three rounds, each a different real day with its own lesson. Each round has a
**budget of coins**. An official station costs 5, a garden station costs 1. You
place measurements, watching only the fog and the colours, then press
**Make the map**.

1. **Heatwave afternoon** (14 July 2025): officials only, 8 of them. The lesson:
   spread out, and the coast is different (sea breeze). Clumping thermometers
   in one spot leaves the rest of the country in fog.
2. **New Year's night** (1 January 2025): 20 coins, garden stations available.
   Cities are warmer at night and garden stations sit in cities. The lesson:
   many cheap stations beat a few good ones *if the computer knows they read
   warm*. The model corrects the bias automatically in this round, and the end
   card shows what the map would have looked like without the correction.
3. **Broken stations** (18 February 2025) *(stretch)*: many garden stations are
   already on the map and a few are broken (in the sun, indoors). The model
   rings stations that disagree with their neighbours. Tap the ones you think
   are broken to ignore them. That is quality control, a whole section of the
   paper.

**Reveal.** The true map wipes across the fog. Then comes an error view, with
red where the guess was wrong, and a verdict: "Your map was off by 0.9 °C on
average." **Score** per round = points from mean absolute error over land
(e.g. `round(100 · 2 / (1 + MAE))`, tuned so a good round gives about 100);
the three rounds are summed for the daily leaderboard (existing
`scores.ts` / `scoreflow.ts`).

**The computer's map.** During the intro card the computer spends the same
budget with a standard strategy: always put the next thermometer where the fog
is thickest (greedy maximum-variance design, a real sensor-placement method).
The end card shows the two maps and errors side by side ("You 0.9° — Computer
1.1°"), like Swirl Lab's computer player and Outbreak's do-nothing futures. The
greedy design only looks at the fog, never at the readings. A kid who notices
"the coast is cooler, the cities are warmer" can beat it. That is the point:
the model plus human judgement beats either alone. The headless sweep below
checks that it is beatable but not trivially.

### Explainer ("How does this work?")

Chapters, each with a small live demo, in the style of the other games'
explainers:

1. **Guessing between thermometers.** A 1D strip with two or three draggable
   thermometers, the computer's guess curve and a shaded band that pinches at
   each thermometer. A "What might it be?" button draws a few random curves that
   all pass through the thermometers (GP posterior samples): "the computer
   imagines many possible weathers that agree with your thermometers and shows
   you the average and the spread." This links to Outbreak's many futures and
   to the E-OBS 100-member ensemble.
2. **How far does one thermometer reach?** A length-scale slider on the real
   map: too short gives polka dots, too long gives a blur. The computer picks the
   reach by testing itself: hide one thermometer, guess it, and see how wrong it
   was (cross-validation, as in the paper's hyperparameter tuning).
3. **The computer also knows the map.** A toggle adds covariates (sea, city,
   green fractions) to the mean. With the same thermometers the coastline and
   cities appear at once. The paper uses elevation, slope, aspect and land-use
   fractions the same way.
4. **Cheap but wobbly: garden stations.** Official vs. home stations: accuracy,
   placement (cities, sunny walls), the warm bias. A toggle for bias correction
   shows the map too warm, then fixed. Real numbers from the paper: Netatmo
   reads about 1.3 °C warm on average, with ~1.6 °C scatter vs ~0.1 °C for
   official stations. Across Europe there are 20× more home stations than
   official ones.
5. **Too many thermometers.** Every thermometer has to be compared with every
   other. An animation draws the pair lines: 10 stations → 45 pairs, 100 → 4,950,
   100,000 (Netatmo in Europe) → 5 billion. The paper's two tricks: only compare
   with neighbours (the compactly supported Wendland kernel, which makes the
   matrix mostly zeros) and summarise with ~1000 landmark points (Nyström).
   Result: a map of all of Europe on one workstation.
6. **Where this is used.** KNMI weather maps, heat stress in cities (urban
   heat islands), feeding data to AI weather forecasting. CWI + KNMI.
   "Next: wind and rain."

**Science line (tile / title card):** "Together with KNMI we turn thousands of
official and home weather stations into one weather map of all of Europe, and
the maths tells us how sure we are."

## Technical design

Module: `app/src/games/detective/`, registered in `registry.ts`.

```
detective/
  index.ts     # ArcadeGame: toy mode, challenge, UI
  gp.ts        # kernel, Cholesky, GLS mean, predict mean/var on a grid
  data.ts      # load a day: temperature, mask, covariates, hyperparameters
  stations.ts  # garden-station simulator (placement, noise, bias, broken)
  render.ts    # colour map, fog, coastline, thermometer sprites, reveal wipe
  rounds.ts    # challenge rounds, budgets, computer opponent
  delve.ts     # explainer chapters
  text.ts      # en / nl / no strings
```

### Data

- A one-off Python script (`tools/weather_prep.py`, not shipped) reads the
  four KNMI NetCDF files (386×280 grid over the Netherlands with temperature,
  land mask, water/urban/vegetation fractions and distance to coast; the
  temperature is itself KNMI's fusion of 31 official and ~730 WOW citizen
  stations) and writes one small binary per day to `app/public/detective/`:
  temperature as Uint16 (0.01 °C steps), mask and three covariates as Uint8,
  at full or half resolution. That is about 100–300 KB per day, bundled, so it
  works offline.
- The same script fits fixed hyperparameters per day (length scale, amplitude,
  noise σ_H and σ_L, covariate coefficients) against the true field and stores
  them in the file header. The game never trains during play.
- A coastline path for the outline is drawn from the land mask.
- Honesty note for the explainer: the "real map" is KNMI's best estimate from
  hundreds of stations, not the truth itself. Kids reconstruct it from a
  handful.

### The GP in the browser

- Exact GP, Matérn 5/2 or squared-exponential kernel in (lon, lat·scale), with
  explicit basis functions (intercept + optional covariates + the
  garden-station indicator for bias) solved by generalised least squares.
  Per-observation noise: σ_H for official, σ_L for garden stations. This is
  the paper's model at small N, without the scalability tricks. Those are
  explained, not needed.
- **Cost.** N ≤ ~200 observations. Cholesky of N³/3 ≈ 3M flops takes about a
  millisecond. Mean on the grid is `h(x)ᵀβ + Σ αᵢ k(x, xᵢ)`: G × N, so fine at
  full resolution. Variance needs a triangular solve per grid point (G × N²/2),
  so it is computed on a coarse grid (~100×70) and upscaled with smoothing.
  Soft fog is a feature. While dragging, mean and variance use the coarse grid;
  on release, the fine one. Target: < 16 ms per update at N = 150 on the stand
  laptops. Fallback if too slow: move the grid prediction into a Web Worker, or
  use a compactly supported kernel (the paper's trick, which makes a good
  explainer tie-in).
- Seeded RNG for garden stations and broken stations, so rounds are
  repeatable and testable.

### Garden-station simulator

Positions sampled ∝ urban fraction (plus a small uniform share). Reading =
true temperature + bias (≈ +1.3 °C, more at night in cities) + N(0, σ_L) with
σ_L ≈ 1.5 °C; ~3 % broken (+5 to +12 °C, or a flat 20 °C "indoors"). Real
Netatmo data can't be redistributed, so these are simulated, and the explainer
says so.

### Validation (`npm run test:detective`)

Like `test:outbreak`: a headless sweep per round over seeds and strategies:
random, clumped, uniform grid, greedy max-variance (the computer), and
greedy-with-hindsight (an upper bound). It checks that spreading out clearly
beats clumping, the computer is beaten by the hindsight strategy by a
reachable margin, bias correction clearly helps in round 2, ignoring broken
stations clearly helps in round 3, and the GP reproduces a small hand-computed
case. It also times the update at N = 50/150/200.

## Schedule

The event is Saturday 3 October, 11 days from now, and other games are still
being polished. So the game is scoped to be **shippable after day 3** and
everything after that is optional.

| Day | Deliverable | Playable? |
|---|---|---|
| 1 | Data prep script + one day bundled; `gp.ts` with test; free play: place / drag / remove thermometers, colour + fog, peek | yes, toy mode |
| 2 | Garden stations + bias; day picker; coastline and city labels; tile, title card, en/nl/no | yes, full free play |
| 3 | Challenge rounds 1–2, reveal wipe, computer opponent, score + leaderboard; headless sweep and tuning | **shippable** |
| 4 | Explainer chapters 1, 2, 4 (the core story) | |
| 5+ | Round 3 (broken stations), explainer 3, 5, 6; polish after a playtest | stretch |

Freeze by 30 September, like the rest of the arcade.

## Open questions

1. **Netherlands or Europe?** The plan uses the Netherlands. The data is
   there and public, kids recognise it ("where do you live?"), and the grid is
   small. Europe appears in the explainer as pictures from the paper. Is it OK
   to show figures from the unpublished paper at a public event? (Check with
   the co-authors / KNMI.)
2. **Reusing last year's data and idea:** check with Rik and credit the
   original game in the README.
3. **Name.** "Weather Detective" (NL *Weerdetective*, NO *Værdetektiv*). Other
   options: "Clear the Fog", "Thermometer Hunt".
4. **Also temperature only?** The files also have wind speed and humidity. A
   "wind day" is an easy later addition, and it matches the paper's future
   work (wind and rain).
