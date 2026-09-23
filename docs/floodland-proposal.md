# Save the Netherlands: assessment and proposal

An assessment of the current game ([floodland-remake.md](floodland-remake.md)) against
[message.md](message.md), and a proposal for the next version. Nothing here is built
yet. The event is on 3 October 2026, so the proposal is phased: **A** is what makes the
game meet the goals, **B** adds depth for kids who stay and the talking points for
parents, **C** can wait until after the event.

## Assessment

The solver is good: well-balanced, positivity-preserving, conservative, tested. The
diorama is handsome. The problems are the game built on top of it.

Measured on a laptop (`FloodRecording` in node, same in the browser):

| | |
|---|---|
| Wait between "Storm surge" and the first moving water | 2.5 s (in the browser), ~2 s in node |
| Round length after that, not interactive | 42 s storm + 60 s drainage (15 s at ×4) |
| Sand needed to keep all 8 homes dry in the surge | ~60 of 210 (one straight line across the gap, 1 m above the sill) |
| Real-time headroom of the solver at 64×40 | ~50× (102 display seconds computed in 2 s) |

Against the goals:

1. **No agency during the flood.** Message.md's own example — "place a dike and the
   water piles up against it *now*" — does not happen. You build on a calm, still
   landscape; then the flood is precomputed and played back like a video, and building
   is locked. The only thing that reacts within a frame is the sand.
2. **No toy mode, no 30-second wow.** A five-year-old wiggling the mouse gets small sand
   bumps on a landscape where nothing moves. The flood only starts after reading a modal
   with two paragraph-long choices, then waiting 2.5 s.
3. **The challenge is a single decision.** There is one gap in the coast. Filling it with
   a third of the budget wins; everyone who wins ties at 8/8. No trade-off, no score to
   beat, and — unlike every other game in the arcade — **no scoreboard**.
4. **The budget trade-off in the talking points isn't in the game.** Message.md's
   Deltares line is "you only reinforce where failure is actually possible". Here
   there is nothing that can fail: dikes never breach, they only overflow, and there is
   only one place to build.
5. **No delve layer.** The other five games use the shared 🔬 explainer; this one has a
   "More" drawer with a paragraph, and a cross-section that only appears in the overhead
   view, with "More" open, on screens wider than 850 px. The numerical grid view is a
   good idea hidden behind a button labelled "From above".
6. **Too much reading, too little legible at 2 m.** Paragraph hints, a modal chooser, a
   "Kept dry 8/8 · Sand 210" line in small type in the corner. The diorama uses about
   half the screen; homes are ~15 px. A flooded home just changes colour.
7. **Effort went into things nobody sees.** The pump's momentum accounting, the
   background seepage source, the 60 s drainage phase and the three-waves scenario are
   careful work that the player cannot act on. Drainage is the longest phase of the
   round and has no decisions in it.

## Proposal

### The core change: a live sea

Run the solver live, every frame, at ~24 physical seconds per display second (as now).
It costs ~0.2 ms per frame on average (measured over the whole surge; worst frame 4.5 ms, during JIT warm-up). The storm happens *while* you build, the water piles up
against sand the moment it lands, and you can race to plug a leak. Keep recording
frames as it runs (cheap), so the end card can still offer the timeline to scrub back
to "where it went wrong". Building during a flood is also the real thing: sandbagging
a weak dike during high water.

Delete: the precomputation wait, the storm modal, the drainage phase, the three-waves
scenario, the "More" drawer. Keep the pond and pump as quiet scenery (they already run
live); drop the seepage source.

Guard the live solver for the kiosk: on a thrown error or a NaN, reset the water (not the
sand) and carry on.

### Add the missing physics: dikes break

Overtopping should not just spill; it should erode. That is how most dikes fail, it
is what the Deltares work is about, and it is the most dramatic thing the game could
show.

- Each dike cell gets a **strength** (erosion resistance). Where water flows over it
  faster than a critical speed, the ground lowers at a rate ∝ (speed − critical)².
- A breach then feeds itself: lower crest → more flow → faster erosion. Watching a
  small overflow turn into a gap is the "oh no" moment; rushing sand into it is the
  "I saved it" moment.
- Player-built sand is weak (fresh sand); the old dike is strong except at hidden weak
  spots. Terrain changes under water are fine for this scheme (depth is kept, the
  surface drops with the bed).

### Layered reveal: toy → rounds → delve

Each layer introduces exactly one new idea.

**Layer 0 — toy (no reading).** The game opens live, with a gentle tide and small
waves moving. Click/hold on land: sand rises. Click on water: a splash ring spreads
from the cursor (a Gaussian bump in the surface — instant proof this is a real fluid).
One big button: **🌊 Storm!** raises the sea for 30 s. Homes that get wet show water
up to the windows and a small 🆘; dry homes glow when the storm passes. Nothing to lose.

**Round 1 — Hold the line** *(idea: water finds the lowest spot)*. The current
landscape, live. The storm starts 5 s after the round begins; you build during it. The
sill overtops, erodes and breaches unless you raise it — or plug it after it breaks.
Score = homes kept dry × 100 + sand left.

**Round 2 — Weak spots** *(idea: you can't reinforce everything, so find where it
can fail; the Deltares project)*. A long existing dike, all the same height, with two
or three hidden weak sections. Sand for only about a third of it. Before the storm you
may press **🖥️ Test storm**: the computer runs the storm on a ghost copy of the
landscape in fast-forward (a few seconds, shown in the corner like Outbreak's forecast)
and marks where water came over and where the dike eroded. Each test storm draws a
slightly different storm (height, timing), so one test can mislead and three are
better. Score as round 1.

**Round 3 — How high?** *(idea: storms are random; build for the storm that comes once
in N years; van Dantzig)*. Nobody tells you which storm comes. You set the dike height
along the coast with sand that now costs money. Then the computer lives through
**100 years of storms** in about 5 s: a year counter spins, most years pass quietly,
now and then a big storm floods something and the damage adds up. Score = money left =
budget − dike cost − flood damage over the century. Too low floods often; too high
wastes money; the best answer is in between. The end card draws the U-shaped cost curve
with your dike on it.

To make 100 years fast, do what engineers do: run ~6 full simulations at increasing
storm heights (≈ 0.4 s each at full resolution, measured; in a worker so the counter keeps spinning), interpolate a damage
curve, and draw each year's storm height from a Gumbel distribution. That is a
fragility curve times a hazard curve — the delve can show it literally.

The three rounds sum to one score for the shared `scoreFlow` board, like Outbreak.

### The X-ray lens (a reveal inside play, not only in the delve)

Hold **Space** or the 🔍 button: a circle around the cursor peels back the diorama to
show what the computer sees — the grid, a number per cell (ground and water height),
and the flow arrows — with the pretty landscape outside the lens. Built from the
existing "From above" drawing. It is the fastest way to show a parent looking over a
kid's shoulder that the landscape *is* the calculation. Replaces the "From above"
button and the hidden cross-section.

### Delve chapters (shared 🔬 panel, live illustrations on the game's canvas)

1. **The land is a grid of numbers.** Every 10 m square stores ground height, water
   depth and flow. The game has 2 560 squares; a real Delta model has millions.
2. **Two rules for every square.** Water in − water out = change in depth; water speeds
   up downhill (towards a lower surface) and keeps going. Formula:
   `h_new = h + Δt/Δx · (in − out)`. Live: a one-row tank you can tip.
3. **Don't skip a square.** The time step must be short enough that water cannot jump
   over a cell (CFL). Live counter: "this second of storm took 214 tiny steps"; deep,
   fast water needs more.
4. **Why dikes break.** Overtopping erodes the back of the dike; a small overflow
   becomes a breach. Weak spots you cannot see from outside.
5. **A thousand storms.** One simulation answers "what if *this* storm comes".
   Engineers ask "how often does a dike fail", so they simulate many storms: the damage
   curve, the storm-height dice, "1 in 10 000 years".
6. **This really happened.** 1953; the Mathematisch Centrum; our group's work with
   Deltares on dike failure probabilities. What this toy leaves out: wind waves,
   tides, soil mechanics, and scale.

### Legibility and juice

- Let the diorama fill the screen: crop the empty open sea, larger houses (or a few
  cows, readable at 2 m and very Dutch).
- A big **tide gauge** at the left edge: sea level rising against a mark for the lowest
  crest of your dike. It shows the stakes before the water arrives.
- Big HUD: 🏠 8/8 and a sand bar that empties, not a line of small text.
- Feedback on every event: a thud and dust puff when sand lands, a splash at overtopping,
  a flashing outline on an eroding cell, a siren sting on a breach, a cheer when the
  storm passes. (No game in the arcade has sound yet; a shared tiny sound helper would
  serve all of them.)
- Round intro cards are one sentence and one picture; no paragraphs in the play view.

### Science lines

- Tile / title card: "After the 1953 flood, mathematicians at CWI's predecessor worked
  out how high Dutch dikes must be. We still compute dike safety today."
- Round 2 card: "Building dikes is expensive, so you only reinforce where they can
  fail. We worked with Deltares on computing exactly that."
- Round 3 card: "In 1956 David van Dantzig of the Mathematisch Centrum weighed the cost
  of higher dikes against the cost of floods. That is where the Dutch safety standard
  of 1 in 10 000 years comes from."

**To verify before printing:** van Dantzig's role (Delta Committee; *Economic Decision
Problems for Flood Prevention*, Econometrica 1956) and the 1 : 10 000 standard for
central Holland; and the existing wording in `shell/about.ts` ("helped compute the
storm surges behind the Delta Works"), which may be a loose rendering of the same
history.

## Phases

**A — meets the goals (≈ 3 days).** Live solver with recording; toy mode (sand, splash,
Storm! button); erosion and breaches; round 1; scoreFlow; big HUD and tide gauge;
delete the modal, drainage phase, waves scenario and More drawer; update tests
(erosion, live stepping, guard/reset).

**B — depth and talking points (≈ 3 days).** Round 2 with test storms; round 3 with the
fragility-curve century; X-ray lens; delve chapters 1–6; science lines in en/nl/no.

**C — after the event.** A storm-surge barrier round (close the gate on a forecast:
too early costs shipping, too late floods — surge forecasting is scientific
computing); real place names on a stylised piece of Zeeland; sound across the arcade.

## Smaller issues noticed

- `hit()` snaps every pointer on the coastal ridge band (x 20.5–24.5) to x = 22.5.
  Fine for one gap; wrong once there are several dike sections.
- `dikePlan` calls `POOL.includes` inside the per-cell loop; use a `Uint8Array` mask.
- The "Exit simulation" label is programmer language; in the live version it
  disappears anyway.
