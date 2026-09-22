# Weather Detective — plan

A new arcade game, loosely based on our KNMI project on multi-fidelity Gaussian
process regression with crowdsourced weather stations, and on last year's
Science Day game about it,
[CWI_gp_temp_scienceday](https://github.com/rik-stra/CWI_gp_temp_scienceday)
by Rik Hoekstra. The only goals are those of [message.md](message.md); the
paper is inspiration, not a spec. Data may be adapted (and is) whenever that
makes the game more fun or clearer; no paper figures are used.

Status: **plan, being built**.

## The idea in one breath

The weather is hiding in the fog. Every thermometer you place lets the
computer see a little more, and it *imagines* the rest. Where it has no
thermometers, its imagined weather keeps changing ("maybe hot here… or maybe
cold…"). Where you measured, the weather holds still. Your job, detective:
find the hottest place, make the weather map for the evening news, and catch
the weather stations that lie.

## Why it belongs in this arcade

- **Variety is the message.** Every other game simulates *forward* (fluid,
  epidemic, flood, walking, gravity). This one simulates the weather the
  computer *can't see*, from a few measurements, and says how sure it is.
  New domain (weather, the first word of our message line), new method
  (statistics and learning from data), real data (KNMI maps of real days).
- **"The computer imagines many possible weathers"** is a simulation that kids
  can watch: an animated field of possible weathers that settles wherever a
  thermometer is placed. It is the same idea as Outbreak's many futures and
  the ensemble forecasts that parents see on TV.
- **Parent hook:** "Do you have a weather station in your garden? Stations
  like yours help make these maps." CWI + KNMI.

## Look

- A big map of the Netherlands, with land in weather-map colours (blue → green
  → yellow → red) and the sea and IJsselmeer dark. A few city names.
- **Dreams (default in free play):** the computer's imagined weather, animated.
  These are posterior samples of a Gaussian process that drift slowly through
  time. Far from thermometers the colours roll like lava-lamp weather. Near a
  thermometer they are pinned. A five-year-old who wiggles the mouse and clicks
  sees the weather *freeze* around their thermometer.
- **Best guess + fog (default in the challenge):** the posterior mean,
  covered by drifting cloud-fog whose thickness is the posterior standard
  deviation. A big button switches between the two views.
- Thermometers are big and readable from two metres, with a mercury column
  and the reading (`31.4°`). Home stations are small house icons. The cursor
  is a hovering thermometer.

## Free play (toy mode)

- **Hover:** the cursor thermometer shows the *real* temperature under it, so
  the mercury rises and falls as you wiggle.
- **Click** to plant it. The map reacts in the same frame.
- **Drag** a planted thermometer and the whole map follows live.
  **Right-click** (or drag it off the map) to remove it.
- **🏡 Home stations:** about 150 home stations rain down into the towns
  (where people live). Detail appears, but everything reads a bit too warm and
  a few are wildly off. The computer figures out the warm bias by itself (see
  the model).
- **👁 Peek:** hold to see the real map.
- **Day buttons:** four real moments, adapted. Heatwave (1 July 2025, up to
  40 °C in the cities), Sea breeze (14 July 2025, cool coast, warm inland),
  New Year's night (1 January 2025) and Frosty morning (18 February 2025, a
  frost pocket on the Veluwe).
- **🧹 Clear.**

## Challenge: three cases

Each case uses a different real day, a different lesson and a different
mechanic. Each is worth up to 100 points. The total goes on the daily board.
Each case ends by comparing you with the computer, who plays the same case.

1. **🔥 The hottest place** (heatwave). You have 6 thermometers. Find the
   hottest spot in the Netherlands. A seeded "heat dome" is hidden somewhere
   inland on top of the real heatwave, so the answer moves every game. The
   guess map and the fog help: go where it is probably hot, or check where
   nobody knows yet. Score: how close your hottest reading is to the true
   hottest place. The computer plays the same case with **Bayesian
   optimisation** (upper confidence bound: mean + 2·spread), which is the real
   method for "find the best with few expensive tries".
   Lesson: explore vs exploit.
2. **📺 The weather map** (New Year's night). Make tonight's weather map
   for the news. You have 20 coins: an official station costs 4 and is exact;
   a home station costs 1, reads too warm and wobbles. Place what you like,
   then press **Make the map**. The real map wipes in, and an error view shows
   red where you were wrong. Score: how much better your map is than guessing
   one temperature everywhere. The computer spends its coins on evenly spread
   official stations. Lesson: spread out, and many cheap stations can beat a
   few good ones if you know they read warm.
3. **🕵️ The lying stations** (frosty morning). The map already has 60 home
   stations and 3 official ones. Six home stations lie: they hang against a
   warm house wall and read much too warm. Click a station to accuse it. It
   goes grey, the computer stops listening to it, and the map heals live (a fake
   warm blob disappears). You have 8 accusations. Score: liars caught, minus
   innocents accused. The computer's pick: stations that disagree most with
   what their neighbours predict (leave-one-out check), which is real quality
   control, a section of the paper. Lesson: data can be wrong, and the model
   can tell you which data to doubt.

End of the challenge: total score → initials → daily board (shared
`scoreflow.ts`).

## Explainer ("How does this work?")

The shared chaptered card on the left, a live demo on the canvas on the right.

1. **Guessing between thermometers.** A 1D strip ("a walk from the beach to
   the city") with draggable thermometers: the best guess, the band of
   uncertainty, and dream curves. "The computer imagines every weather that
   fits your thermometers; the band shows how much they disagree."
2. **How far does one thermometer reach?** A reach slider on the same strip:
   too short gives spikes, too long gives a stiff ruler. The computer picks the
   reach by hiding one thermometer and guessing it.
3. **The computer also knows the map.** Cities are warmer, water is cooler
   (on a summer day). With the same three thermometers, turn map knowledge on
   and off on the Netherlands map.
4. **Home stations: cheap but wobbly.** A thousand home stations make the
   map sharp, but they read warm. A switch turns bias correction off (the map
   turns too red) and on again. "The real map in this game was made by KNMI
   from 31 official stations and 729 home stations."
5. **Too many thermometers.** A dot map of Europe (≈5,000 official and many
   thousands of synthetic home stations shaped like the project's data,
   coloured by temperature). Every station must be compared with every other
   station: the pair count grows as N². Our group's tricks, in words: only
   compare with neighbours, and summarise with a thousand landmark points. The
   result is a weather map of all of Europe on one computer.
6. **Where this is used.** KNMI weather maps, heat in cities, feeding data
   to AI weather forecasting. CWI + KNMI.

**Science line:** "Together with KNMI we turn thousands of official and home
weather stations into one weather map of Europe, and the maths tells us how
sure we are."

## The model (free to differ from the paper)

A Gaussian process whose kernel is a sum of simple pieces:

    k(x, x') = c² + a_u² u(x)u(x') + a_w² w(x)w(x') + θ² exp(−|x−x'|² / 2ℓ²)

The first three terms are the "map knowledge": a constant, and random slopes
for urban fraction `u` and water fraction `w`. The last is the smooth weather.
Observations add their noise σ² (official ≈ 0.1 °C, home ≈ 1 °C), and home
stations share one extra random offset `b²·[home][home']`. That offset is
the warm bias: it is learned from the data without any fitting code, and it
is left out of the prediction. Putting the covariates and the bias in the
kernel (not a separate regression) keeps everything stable with only two
thermometers. Hyperparameters are fixed per day.

- **Coordinates** in km. **Grid:** every other cell of KNMI's 386×280
  (≈ 1 km) grid for the mean and colours, and a quarter-resolution grid for
  the spread, fog and dreams (both are soft by nature).
- **Dreams:** random Fourier features give a prior sample of the smooth part,
  with slowly rotating phases so it drifts in time. It is conditioned on the
  thermometers by pathwise conditioning (Matheron's rule). Per frame this is a
  few million multiply-adds.
- **Cost:** N ≤ ~200. The Cholesky is cheap. Kernel columns to the grid are
  cached per station, so dragging one thermometer recomputes one column.
- **Truth:** the KNMI field (half resolution) plus per-case seeded features
  (heat dome, liars). The colour scale is per day.

## Data

`tools/detective/prep.jl` (Julia, run once, not shipped) reads the four KNMI
NetCDF files from last year's game and the project's European station arrays.
It writes `app/src/games/detective/data.ts`, loaded by dynamic import (its own
chunk, offline):

- per day: temperature at half resolution (193×140), quantised to Uint8 with
  a per-day offset and scale;
- shared: land mask, urban and water fractions (Uint8);
- Europe: ~5k official station positions (jittered by a few km) and ~20k
  synthetic home stations, with temperatures, for the explainer.

## Validation

`npm run test:detective` (like `test:outbreak`):

- the GP reproduces a hand-computed 2-point case, and posterior samples match
  the mean and variance;
- **case 1:** Bayesian optimisation beats random by a clear margin and is
  beatable;
- **case 2:** an even spread beats a clump; bias correction lowers the error
  with home stations;
- **case 3:** the leave-one-out check finds most liars;
- timing of an update at N = 20/60/150.

## Build order

1. Data prep + GP core + tests.
2. Free play: map, dreams/fog, thermometers (hover, place, drag, remove), days,
   peek, home stations.
3. Challenge: the three cases, reveal, computer player, score flow.
4. Explainer chapters.
5. README (credit Rik Hoekstra's 2025 game and KNMI), i18n en/nl/no
   throughout, remake-style notes.
