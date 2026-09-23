# Save the Netherlands

A live shallow-water diorama of a Dutch polder behind an old coastal dike. The
storm happens while you build: water piles up against sand the moment it lands,
overtopped dikes wear away and breach, and a breach can be plugged if you are
quick. [floodland-proposal.md](floodland-proposal.md) explains why the game was
rebuilt this way (phases A, B and C of that proposal are what is described here).

## Free play

The game opens live, with a gentle swell on the sea.

- **Hold on land** to pile up sand (1.4 m per second of holding, up to 4 m). A tap
  adds a thin layer; dragging builds a ridge. Pointing near the old dike snaps to
  its crest. The sides of the dike and of sand piles are clickable too.
- **Click the sea** to drop a splash: a bump of water that spreads as a ring (with
  a foam ring drawn at the shallow-water wave speed √(g·depth)).
- **🌊 Storm!** sends one storm (below). Sand is unlimited; nothing is scored.
- **🔍 X-ray** (or hold Space) turns the pointer into a magnifying glass (3.4×)
  that shows what the computer keeps for each square: water depth (or ground
  height where it is dry) and a flow arrow. It works in every round.
- **🧹 Start over** restores the landscape.

## Challenge: four rounds

Each round opens with a card: one sentence for the player and a 🔬 science line for
parents. The four scores add up on the shared daily scoreboard. Storm rounds can
be watched again (recorded at 15 fps, terrain included, ~28 MB) before moving on.

### Round 1: Hold the line *(water finds the lowest spot)*

About 43 s: 5 s warning, the storm (10 s rising, 14 s at its height, 10 s falling),
then 4 s of calm. 150 sand; building goes on during the storm. Score = dry homes ×
100 + sand left. A home counts as flooded once more than 0.3 m of water stands in
it, and stays counted. When the round ends, homes still reachable by the calm sea
(a breach cut below +0.1 m) also count as lost: a polder below sea level keeps
flooding through an open hole, as in 1953. The calm phase asks you to close it.

The landscape has two low places in the old dike (3.2 m crest): a harbour sill
(0.8 m, six cells long) and a road over the dike (1.9 m, three cells, built on
loose sand). The storm peaks at 2.5 m with ±0.4 m waves. Calibration
(`npm run test:floodland`, headless at 60 fps):

| Play | Homes flooded | Sand left |
|---|---|---|
| Nothing | 8 (sill breaches ~10 s into the storm) | 150 |
| Sill raised to 3.1 m only | 8 (the road breaches later) | — |
| Sill and road raised to 2.9 m before the storm | 0 | 83 |
| Nothing built, then sandbagging the sill (12–18 s) and road (22–26 s) | 0 | — |

### Round 2: Weak spots *(you can only reinforce where it can fail; Deltares)*

A 2.8 m dike that looks the same everywhere. Three of its seven four-row sections
are rotten inside (critical speed 0.9 m/s instead of 2.2 m/s), chosen at random
each round. 45 sand: enough for the three weak sections (~31), not for all seven
(~72). Before the storm, up to three **test storms** run on a copy of the current
landscape (sand included), each a different guess between 2.4 and 3.2 m. A small
panel shows the copy from above as it runs, then lists the result; red marks on
the dike show where a test broke it (stronger with more tests agreeing), blue
dots where water only came over. Test storms below ~2.6 m show nothing, so one
test can mislead. Then the real storm (3.0 m) comes and building is locked:
decide first, as engineers must. Score as round 1.

Tested: a 2.4 m test breaks nothing; a 3.2 m test breaks exactly the weak
sections; undefended, the real storm floods the village; reinforcing the weak
sections keeps everyone dry, reinforcing three others does not.

### Round 3: How high? *(storms are random; van Dantzig)*

One height for the whole dike, 1.5–4 m in 0.25 m steps, 150 points per metre above
1.5 m. **Live 100 years** first runs six full storms against that dike (0.2 m
below the crest to 0.45 m above), shown side by side as they compute (~2–5 s):
together they are the dike's *fragility curve* (homes flooded against storm
height). Then a century plays in 5 s: each year's highest storm is drawn from a
Gumbel distribution (μ = 1.2 m, β = 0.35 m), and years whose storm floods homes
turn red. The score does not depend on that luck: it is 1000 − building cost −
the *average* flood damage over the Gumbel distribution (10 points per flooded
home). The result card shows the U-shaped total against height, with the best
height and yours; the heading says how often the dike fails ("about once every
200 years").

For the curve at other heights the fragility curve is shifted with the crest.
Every dike has the same slopes (`dikeProfile`), which makes that exact: curves
measured at 2.5 and 3.25 m agree. Scores: 0 at 1.5 m, 772 at 2.75 m (best),
624 at 4 m.

### Round 4: Close the gate *(decide on a forecast; the Maeslantkering)*

A harbour channel (six cells wide) runs through the dike to a basin behind stone
quays 0.8 m high; the village lies behind the south quay. A gate in the dike
takes 3 s to swing shut or open. Ships sail in from the sea and out from the basin,
one every 2.2 s, and score 10 points each as they pass the gate; a shut (or
shutting) gate makes them queue. Three storm threats of 0.5, 1.6 and 2.6 m
(shuffled) peak at 16, 34 and 52 s (5 s up, 5 s high, 5 s down); the round lasts
62 s. Score = dry homes × 100 + ships × 10.

A panel shows the forecast: the sea so far and 20 forecast members for the next
20 s, red where they rise over the quay, with "11 of 20 forecasts: water over the
quay!". Each member is off by its own amount, which shrinks with lead time
(0.1 + 0.07 × seconds ahead, in metres of peak height, plus a small timing error),
so the fan narrows as a storm comes. Deciding early risks a false alarm (ships
wait for nothing); waiting risks closing too late.

Tested: an open gate floods all 8 homes; closing for the two real threats keeps
all dry; closing only for the big one, or closing 2 s before its peak, floods one.
Keeping the gate shut for 15 s costs about 7 ships (70 points), less than one home.

## Place names

The map is a stylised piece of Zeeland: "Noordzee / North Sea / Nordsjøen" on the
sea, "Zeeland" on the polder and "Haven / Harbour" on round 4's harbour, painted
on the ground in perspective. The village and homes stay nameless: no real 1953
village is shown flooding.

## Sound

`app/src/lib/sound.ts` synthesizes all sounds with WebAudio (no files; works
offline) and throttles each so held buttons cannot turn it into a buzz. This game
plays sand thuds, splashes, a breach alarm, a sound when a home floods, a countdown
tick, the gate, ship horns, a ding per finished fragility storm and a sound per
flooded year in the century. The shared score flow plays a fanfare and a cheer, and
every game's `.tool-button` / `.arcade-button` clicks. The menu has the only mute
button (games have no free corner); it is remembered on the machine.

## Explainer

The shared 🔬 panel, in free play only, with the landscape (or a picture) beside it:

1. **The land is a grid of numbers** — the X-ray lens drifts over the polder.
2. **Two rules for every square** — a one-row tank you can pour into, with the
   depth of each column and arrows for the flow through each wall.
3. **Don't skip a square** — the time-step limit, with a live count of the
   solver's steps per displayed second (a storm raises it).
4. **Why dikes break** — a live slice through the harbour sill: the original
   ground dashed, eroded ground brown, eroding cells red.
5. **A thousand storms** — how often each storm height comes (bars; red where it
   floods homes) and the fragility curve, with a dike-height slider and "fails
   about once every N years".
6. **Forecasts get sharper** — a storm on a loop, its 20 forecasts closing in as
   it nears; the Maeslantkering decides by itself on a 3 m forecast.
7. **This really happened** — 1953, van Dantzig, the group's Deltares project,
   and what the game leaves out.

History sources: van Dantzig was one of the founders of the Mathematisch Centrum;
after 1953 the Delta Committee asked him to model the economically optimal dike
height (*Economic decision problems for flood prevention*, Econometrica 24, 1956);
the work led to statutory safety standards and his approach is still used in
cost-benefit analysis of flood protection
([Wikipedia](https://en.wikipedia.org/wiki/David_van_Dantzig)). His optimum for
Central Holland was about 1 in 125 000 per year; the Delta Committee set the
standard at 1 in 10 000, so the game does not claim the 10 000 came from him.
The Maeslantkering closes automatically when the forecast (the BOS computer
system) says the water will rise above 3 m NAP at Rotterdam (2.9 m at Dordrecht);
it first closed for a real storm on 8–9 November 2007
([Wikipedia](https://en.wikipedia.org/wiki/Maeslantkering),
[Rijkswaterstaat](https://www.rijkswaterstaat.nl/en/projects/iconic-structures/maeslant-barrier)).
The arcade's general explainer (`shell/about.ts`) says the Mathematisch Centrum
"helped compute the storm surges behind the Delta Works"; that is not confirmed
by these sources.

## Look and feedback

- A tide gauge at the left: the sea level against **your dike**, the lowest level
  at which the sea can reach a home (a priority flood over the terrain, so it is
  right wherever the player builds). It turns red when the sea is higher.
- HUD: 🏠 dry homes, a sand bar, time left.
- Fresh sand is yellow, washed-out ground brown; cells that are eroding pulse red.
  A banner announces each new breach. Flooded homes show 🆘; dry homes glow when
  the storm has passed.
- Water is lit by its slope, so waves and splashes show as light and dark bands.
  In the landscape view only currents faster than 0.35 m/s get arrows.

## Numerical model

Depth and both depth-integrated momentum components evolve with first-order
finite volumes, local Lax–Friedrichs (Rusanov) fluxes, hydrostatic
reconstruction and matching bed-source corrections, with a two-dimensional CFL
bound; 64 × 40 cells of 10 m, linear friction. One displayed second is 24
physical seconds. A frame costs ~0.2 ms of solver time (worst 0.7 ms headless).

- **Sea boundary.** The incoming characteristic is that of water at rest at the
  prescribed sea level, so the sea settles at that level while reflected waves
  leave. (Prescribing it as an incident wave doubled the surge at the dike.) The
  sea level is a swell of ±0.1 m, plus the storm's surge and ±0.4 m waves.
- **Erosion.** dz/dt = rate · (speed − critical)² where water runs fast over
  erodible ground. Two layers per cell: loose sand above `hardTop` (critical
  1.1 m/s), the old ground below with its own resistance per cell (dike 1.5 m/s;
  the road 1.1 m/s), nothing below `floor` (polder level under the dike). Water
  depth is kept, so volume is conserved. An undercut wall collapses: a wet cell
  more than 1 m above an eroding neighbour slumps towards it at 1 cm/s. Erosion
  starts on the landward slope and eats back to the crest, as in real overtopping
  failures. Sand placed under water keeps the water's depth, so the water is
  pushed up and flows away.
- **Pump.** The pond and pump regulate the polder toward −0.95 m (35 m³/s),
  moving water through the pipe to the sea; it cannot keep up with a breach.
- **Background runs.** Test storms and the six fragility storms are generators
  (`rounds.ts`) advanced for about 6 ms per frame, so the game never stalls.
- **Kiosk safety.** A numerical failure (negative or NaN depth) resets the water,
  keeping the landscape.

This is a depth-averaged long-wave model, not a resolved surf or soil-mechanics
simulation. The homes and landscape are fictional.

## Validation

`npm run test:floodland` (and `npm run build`) cover lake at rest, closed-basin
conservation, the wet/dry dam break, erosion (none at rest, conservation, floor
and layers), the calm swell (no overtopping, no erosion, pump regulation,
boundary accounting), the round 1 plays above, the spill level, the recording
(bounds, terrain, seeking), splashes, the pump, the sand brush (frame-rate
independence, cap, budget, protected pond), round 2 (varied weak spots, what
test storms reveal, right versus wrong reinforcement, budget), round 3
(fragility monotone and exactly shifting, U-shaped score, repeatable century) and
round 4 (open, well-timed, partial and late gates; forecasts narrowing onto the
real storm).

Hardware frame rate on the stand machines and child playtests remain to be done.

## References

- Audusse et al., *A Fast and Stable Well-Balanced Scheme with Hydrostatic
  Reconstruction for Shallow Water Flows*, SIAM J. Sci. Comput. 25 (2004).
- https://www.clawpack.org/v5.9.x/riemann/Shallow_water_Riemann_solvers.html
