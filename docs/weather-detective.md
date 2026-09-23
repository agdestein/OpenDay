# Weather Detective

A new arcade game, loosely based on our KNMI project on multi-fidelity Gaussian
process regression with crowdsourced weather stations, and on last year's
Science Day game about it,
[CWI_gp_temp_scienceday](https://github.com/rik-stra/CWI_gp_temp_scienceday)
by Rik Hoekstra. The only goals are those of [message.md](message.md). The
paper is inspiration, not a spec. The data is adapted wherever that makes the
game more fun or clearer, and no paper figures are used.

Status: **built** (`app/src/games/detective/`). Sections marked **Later** are
still plans.

## The idea

The weather is hiding in the fog. Every thermometer you place lets the
computer see a little more, and it *imagines* the rest. Where it has no
thermometers, its imagined weather keeps changing ("maybe hot here… or maybe
cold…"). Where you measured, the weather holds still.

Why it belongs in the arcade:

- **A different kind of simulation.** Every other game simulates *forward*
  (fluid, epidemic, flood, walking, gravity). This one simulates the weather
  the computer *can't see*, from a few measurements, and says how sure it is.
  It adds a new domain (weather, the first word of our message line), a new
  method (statistics and learning from data) and real data (KNMI maps of real
  days).
- **"The computer imagines many possible weathers"** is a simulation kids can
  watch, the same idea as Outbreak's many futures and the ensemble forecasts
  on TV.
- **Parent hook:** "Do you have a weather station in your garden? Stations
  like yours help make these maps." CWI + KNMI.

## What changed from last year's game

Last year's game (Streamlit + folium + GPyTorch): click to place a thermometer
on the Netherlands, wait while the GP is retrained on the server, and see the
error against the KNMI map, plotted against the number of thermometers.

Kept: real KNMI maps of four 2025 days, click to place, comparing with the
real map, the KNMI station network.

Changed:

- **Speed.** The GP runs in the browser with fixed per-day settings. The map
  updates in the same frame, and you can *drag* a thermometer and watch the map
  follow.
- **Uncertainty is the main mechanic**, not a separate tab. It shows as fog
  (the spread) and as dreams (posterior samples).
- **Hidden answers.** In the challenge you only see the model's guess and its
  fog until the reveal, which is the real problem: deciding where to measure
  without knowing the answer.
- **Home stations**, noisy and warm-biased, as in the paper's multi-fidelity
  setting.
- An arcade shell game: kiosk-safe, en/nl/no, explainer, daily board.

## The model *(built)*

A Gaussian process whose kernel is a sum of simple pieces (`gp.ts`):

    k(x, x') = c² + a_u² u(x)u(x') + a_w² w(x)w(x') + θ² m(|x − x'| / ℓ)

The terms are a constant ("how warm is today?"), random slopes for urban
fraction `u` and water fraction `w` ("the computer knows the map"), and a
Matérn-3/2 field `m` (the weather). Measurements add their own noise
(official ≈ 0.15–0.3 °C, home ≈ 1 °C). Home stations share one extra random
offset `b²·[home][home']`: the warm bias. It is learned by the same algebra
and left out of the prediction. Because everything is in the kernel, two
thermometers are already a well-posed problem. The settings per day were
read off the data (regression on the covariates, variograms of the rest) and
are fixed during play.

- **Grids.** Everything is in km. KNMI's 386×280 grid (≈ 0.7 × 1.1 km) gives
  the land mask and a crisp coastline. The half grid (193×140) holds the
  truth, the best guess and the colours. The quarter grid (97×70) holds the
  spread (fog) and the dreams.
- **Drawing** (`mapgl.ts`). A WebGL2 fragment shader samples the grids per
  screen pixel with a cubic B-spline filter, so there are no visible cells.
  It draws 1 °C isotherms as thin anti-aliased lines (from `fwidth`, fading
  under fog) and a smooth coastline from the bicubically filtered land mask.
  Uncertainty is shown as **clouds floating above the map**, not as a
  tint. They are puffy fBm clouds, lit from the top left, that cast offset
  shadows onto the map and the nearby sea and drift with the wind. Their
  coverage grows with the local uncertainty: spread divided by the prior
  spread of the local weather, leaving out the overall level, so one
  thermometer doesn't thin the clouds nationwide. They may spill a little
  over the coast, and the reveal wipe blows them away. Off-land cells are
  filled from their neighbours first, so the coast doesn't bleed in 0 °C. Without WebGL2 the older 2D-canvas path (bilinear, per-cell
  isotherms) takes over.
- **Speed.** Per-station columns of the Matérn part are cached per grid, so
  moving one thermometer recomputes one column. Measured with 150 stations
  (`npm run test:detective`): refit ≈ 1.5 ms, best guess ≈ 3–5 ms, spread
  ≈ 37 ms (throttled to 4×/s above 60 stations), one dream frame ≈ 3 ms.
- **Dreams** are posterior samples. A prior sample comes from 150 random
  Fourier features (Student-t spectrum for Matérn-3/2) whose phases turn
  slowly, so the dream drifts like weather. It is conditioned on the
  thermometers by pathwise conditioning (Matheron's rule). The test checks
  that 60 independent dreams average to the posterior mean (0.09 spreads
  off) and spread like it (ratio 1.00).
- **Free play dreams wilder.** Free play uses 1.5× the constant spread and
  1.8× the weather spread, so unmeasured places swing through the whole
  colour scale.

Lessons from tuning:

- **The squared-exponential kernel overshoots** badly between close stations
  on the real (rough) maps. Matérn-3/2 fixed it.
- **Map knowledge (city/water slopes) needs a dozen stations or more.** With
  KNMI's 31 stations it cuts the heatwave map error from 0.90 to 0.54 °C.
  With 5–6 stations spread to the edges it adds guesswork. So case 2 plays
  without it, and the explainer shows it with KNMI's network.
- **The home-station bias can't be learned with 1–2 official stations.** It is
  then indistinguishable from "that area is warmer". With 30 official stations
  it comes out at 1.48 °C (true 1.5). That is why the planned "coins: official
  vs home stations" round was dropped: its lesson flipped from game to game.
  Home stations live in free play, case 3 and the explainer instead.

## Free play *(built)*

A big map of the Netherlands, the day's weather-map colours, a few city
names, and a legend.

- **Hover:** the cursor is a thermometer reading the *real* temperature
  underneath, so the mercury moves as you wiggle.
- **Click** to plant a thermometer (it drops in with a bounce and a ripple one
  "reach" wide). **Drag** it and the whole map follows live. **Right-click**,
  or drop it on the sea, to remove it.
- **💭 Dreams / 🌫 Best guess:** posterior samples, or the mean with fog.
  Dreams are the default in free play.
- **🏡 Home stations:** 150 home stations rain into the towns (placed by
  urban fraction, reading +1.5 ± 0.4 °C warm with ±0.5 °C wobble, 3 % broken).
  The side panel shows the warm bias the computer worked out by itself.
- **🏛 KNMI's stations:** the real 33-station network.
- **👁 Peek** (hold) shows the real map. **🧹 Clear.**
- **Days:** Heatwave (1 July 2025, 16:20), Sea breeze (14 July 2025, 11:50),
  New Year's night (1 January 2025, 00:10), Frosty morning (18 February
  2025, 08:10).

## The challenge: three cases *(built)*

Each case has a different day, lesson and mechanic, worth up to 100 points.
The total goes on the daily board. Every case ends with the computer's play on
the same map (computed while the intro card is up).

| Case | Day | Mechanic | The computer | Lesson |
|---|---|---|---|---|
| 🔥 The hottest place | heatwave, smoothed and contrasts halved, plus a seeded 5 °C heat dome (22 km) somewhere inland | 8 thermometers; auto-reveal after the last. Points: 100 × (1 − gap/3 °C) between your hottest reading and the hottest place | Bayesian optimisation: next thermometer where "best guess + spread" is highest | explore vs exploit |
| 📺 The weather map | New Year's night | 6 thermometers, then **Make the map**. The real map wipes in; switch between real / yours / computer's / where you were off. Points: 100 × (1 − MAE / (1.6 × MAE of a flat map)) | Greedy maximum-variance design, ignoring the readings | spread out |
| 🕵️ The lying stations | frosty morning, with a stronger urban heat island | 60 home and 3 official stations; 6 liars read 2.5–5 °C too warm. Click to accuse (8 accusations); the map heals live. Hover a house: "reads 2.9° · the others say −1.0°" | Leave-one-out check: accuse the station furthest from what the others predict, refit, repeat while more than 3 spreads off | data can lie, and the model can tell you which to doubt |

Calibration (`npm run test:detective`, 24 seeds; case 2 with 24 seeds):

| Case | Random | Clumped | Sensible spread | Computer |
|---|---|---|---|---|
| Hottest place | 25 | — | — | 71 (0.9 °C short on average) |
| Weather map | 57 | 32 | 60 | 65 |
| Lying stations | — | — | — | 76 (4.5 of 6 caught, none wrongly) |

The hidden heat dome is the hottest place in every seeded game. The computer
is beatable in every case. In case 1 it sometimes chases the real heatwave's
hot south-east instead of the dome.

## Explainer *(built)*

The shared chaptered card, with a live demo on the canvas beside it:

1. **Guessing between thermometers.** A walk from the beach to the east:
   drag thermometers, see the best guess, the band and five dream curves.
   Optionally show the real curve.
2. **How far does one thermometer reach?** A reach slider, and "let the
   computer choose" (leave-one-out error for every reach, drawn as a curve).
3. **The computer also knows the map.** The heatwave with KNMI's network,
   map knowledge on/off, and the error.
4. **Home stations: cheap but wobbly.** The sea-breeze day, 8 KNMI and 150
   home stations. Home stations on/off, bias correction on/off, and the
   learned bias.
5. **Too many thermometers.** A dot map of Europe on 20 June 2020 (5,036
   official stations, and synthetic home stations standing in for "about
   120,000", 1 in 5 drawn). A station-count slider shows pairs, "simple
   method" time (N³/3 at 10⁹ steps/s: about a week for all of them) and
   "with our tricks" (~1000 landmarks: 2 minutes).
6. **Where this is used.** KNMI, heat in cities, AI forecasting. A dream map
   with KNMI's stations.

**Science line:** "Together with KNMI we turn thousands of official and home
weather stations into one weather map of Europe, and the maths tells us how
sure we are."

## Data *(built)*

`tools/detective/prep.jl` (Julia, run once, not shipped) reads the four KNMI
NetCDF files of last year's game and the project's European station arrays for
20 June 2020. It writes `app/src/games/detective/data.ts` (≈ 390 kB,
base64), which the game loads as its own chunk when opened:

- per day: temperature at half resolution, 2×2 block means over land,
  quantised to a byte with a per-day range;
- shared: the full-resolution land mask (bit-packed), urban and water
  fractions;
- Europe: all official stations (public ECA&D sites, jittered by ~3 km) and
  24,000 **synthetic** home stations. Each one starts from a random real
  station, moves ~5–8 km at random, gets its temperature perturbed (±1 °C),
  and is kept only if it lands at least 300 m from every real station (checked
  after quantisation). The game reports a rounded total of 120,000, so
  neither the exact count nor any real home-station location is shown.

The "real map" is KNMI's own best estimate (itself fused from 31 official
and ~730 home stations), not the truth. The explainer says so. Case maps are
adapted versions of it (see the table).

## Later

- A wind day: the KNMI files also have wind speed and humidity, which matches
  the paper's future work.
- Sound: a soft "plink" on placing, a drum roll for the reveal.
- A kiosk demo mode in which the computer places thermometers by itself when
  nobody plays.
