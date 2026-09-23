# Save the Netherlands

A live shallow-water diorama of a Dutch polder behind an old coastal dike. The
storm happens while you build: water piles up against sand the moment it lands,
overtopped dikes wear away and breach, and a breach can be plugged if you are
quick. [floodland-proposal.md](floodland-proposal.md) explains why the game was
rebuilt this way (phase A of that proposal is what is described here).

## Free play

The game opens live, with a gentle swell on the sea.

- **Hold on land** to pile up sand (1.4 m per second of holding, up to 4 m). A tap
  adds a thin layer; dragging builds a ridge. Pointing near the old dike snaps to
  its crest. The sides of the dike and of sand piles are clickable too.
- **Click the sea** to drop a splash: a bump of water that spreads as a ring (with
  a foam ring drawn at the shallow-water wave speed √(g·depth)).
- **🌊 Storm!** sends one storm (below). Sand is unlimited; nothing is scored.
- **🔢 Computer view** shows the grid from above with flow arrows and a readout
  of ground, water depth and flow speed under the pointer.
- **🧹 Start over** restores the landscape.

## Challenge: Hold the line

One round of about 43 s: 5 s warning, the storm (10 s rising, 14 s at its
height, 10 s falling), then 4 s of calm. 150 sand. Score = dry homes × 100 + sand
left, on the shared daily scoreboard. A home counts as flooded once more than
0.3 m of water stands in it, and stays counted. When the round ends, homes still
reachable by the calm sea (a breach cut below +0.1 m) also count as lost: a
polder below sea level keeps flooding through an open hole, as in 1953. The calm
phase asks you to close the hole. The round is recorded (15 fps, terrain included,
~28 MB) so *Watch again* can scrub back through it.

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
- **Kiosk safety.** A numerical failure (negative or NaN depth) resets the water,
  keeping the landscape.

This is a depth-averaged long-wave model, not a resolved surf or soil-mechanics
simulation. The homes and landscape are fictional.

## Validation

`npm run test:floodland` (and `npm run build`) cover lake at rest, closed-basin
conservation, the wet/dry dam break, erosion (none at rest, conservation, floor
and layers), the calm swell (no overtopping, no erosion, pump regulation,
boundary accounting), the four calibration plays above, the spill level, the
recording (bounds, terrain, seeking), splashes, the pump, and the sand brush
(frame-rate independence, cap, budget, protected pond).

Hardware frame rate on the stand machines and child playtests remain to be done.

## References

- Audusse et al., *A Fast and Stable Well-Balanced Scheme with Hydrostatic
  Reconstruction for Shallow Water Flows*, SIAM J. Sci. Comput. 25 (2004).
- https://www.clawpack.org/v5.9.x/riemann/Shallow_water_Riemann_solvers.html
