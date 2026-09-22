# Save the Netherlands: playable diorama

A fixed isometric Dutch landscape replaces the national heat map.
The numerical model remains two-dimensional; visible height is exaggerated.
English, Dutch and Norwegian controls are provided.

## Playing and reading the water

Hold to add sand in either view: height increases at 1.4 m per second, up to 4 m.
A tap adds a small layer; slow dragging builds a higher ridge. Hovering previews the next layer.
Drawing near the existing ridge snaps to its centreline.
The final layer uses the remaining budget proportionally; undo restores the entire stroke.
The pond and homes are protected from sand placement.
Send the storm opens a modal chooser. Both storm forcings use the current landscape
and preserve the player’s sand placement and remaining budget.
Construction is paused during a run so comparisons remain repeatable.

All water surfaces have fine cell outlines, including flooded land in the 3D view.
Shallow films are translucent so nearly drained land reads differently from deep water.
Two village level posts measure depth above the local ground, with metre ticks.
Opening More in the overhead desktop view reveals a cross-section with ground, crest,
water surface and the zero datum. Floating scene labels are omitted; inspection stays in
the footer. More holds the system explanation and, while building, Reset.
Playback has one progress slider and a grouped set of symbol controls: back five seconds,
play/pause, forward five seconds and toggle four-times speed.
Exit simulation returns to building with defenses intact.
Pointing at a cell shows ground elevation, depth and flow speed in either view.
The overhead model view exposes the numerical grid.
Velocity arrows are drawn last so neighbouring water tiles cannot hide them.

The score is homes **kept dry**, a historical measure: pumping does not erase damage.
The homes are fictional and the landscape is illustrative, not a Dutch hazard forecast.

## Challenges

**Storm surge** starts with a permanent low sill (0.7 m crest) and a budget of 210 sand.
The sill stands above the calm sea but overtops during the storm.
The sea rises to 2.2 m and retreats over 42 display seconds.
A 2.4 m defense across the opening protects the village; a 1.0 m defense overtops.
One display second represents 24 physical seconds during the surge.

**Three waves** applies three finite pulses to the same player-built landscape.
The numerical regression suite also retains a dedicated wave fixture with a 1.2 m crest
and an 85-sand defense budget; the interactive game uses the common 210-sand landscape.
Three smooth long-wave pulses start at display times 0, 17 and 34 seconds.
Each is a 10-second sine-squared pulse with an incident amplitude of 1.8 m.
One display second represents four physical seconds so travel and overtopping are visible.
The 62-second wave phase includes time for the third pulse to propagate inland.
The pulses bring limited volumes inland, and the local depth rises and falls as a wave passes.
An affordable raised defense keeps all eight homes dry in the reference test.

## Recovery

Both challenges include 60 recorded seconds of recovery after the forcing retreats.
Recovery represents 120 physical seconds per recorded second.
Normal playback switches to Fast ×4 on entering recovery to finish within the kiosk's
90-second unattended timeout; normal speed, pause and scrubbing remain available.

The defenses, wet drainage canal, storage pond and automatic pump form one permanent
system. No structure appears or closes after a flood. The low sill keeps the calm sea
out while still allowing overtopping and outward flow when water levels permit it.

The pond begins at -0.9 m and the pump regulates it toward -0.95 m. It operates during
building and throughout the recorded run, removing only water above its target level.
A small explicit background inflow of 0.3 m³/s represents ongoing drainage/seepage.
The pump has a maximum capacity of 35 m³/s: useful for normal drainage but unable to
keep up with the reference flood. It transfers extracted water and its proportional
momentum out of the intake cells, adding the same water volume at the sea outlet.
Both pumping and background inflow run on each stable solver step and have cumulative
volume accounting. Moving pipe dashes and the rotor show pumping; its rate is available
in the More inspection footer. The pond remains wet after recovery.
No infiltration or evaporation sink is used.
Water isolated from the canal by a player's defenses can remain trapped.
The final residual films and wet canals are not promised to be perfectly dry.

## Numerical model and playback

Depth and both depth-integrated momentum components evolve with first-order finite
volumes, local Lax–Friedrichs (Rusanov) fluxes, hydrostatic reconstruction and matching
bed-source corrections, with a conservative two-dimensional CFL bound.
Cells are 10 m wide; small depths lose momentum and linear friction dissipates flow.
The wave scenario uses lower friction and an incoming-characteristic ocean boundary
that allows outgoing reflected waves to leave.
The surge uses a prescribed sea-level boundary.
All other exterior boundaries reflect flow.
This is a depth-averaged long-wave model, not a resolved breaking-surf simulation.

The full run is computed in cancellable batches before playback.
A status message remains visible and the controls remain responsive during calculation.
The solver uses Float64 arithmetic; recordings store depth and both momenta as Float32.
At 15 recorded frames per second, the surge plus recovery uses about 45 MiB of field
storage and the wave scenario about 54 MiB, both below the tested 64 MiB bound.
Additional small arrays store historical house flooding, pump discharge, external inflow
and boundary accounting.
Playback linearly interpolates fields; it never integrates backwards.
The backward and forward controls seek five display seconds and pause playback.
Rewind, reset and leaving the game cancel calculations and release recordings.
There is no previous-flood overlay.

## Validation

Run `npm run test:floodland` and `npm run build` from `app/`.
The numerical suite covers:

- Lake-at-rest balance over uneven terrain and closed-basin conservation.
- Wet/dry dam-break spreading, stable depths and ocean boundary accounting.
- Open, low and high defenses against the reference surge.
- Deterministic recording, depth/momentum seeking and historical damage restoration.
- Calm-sea isolation, a retained pond, automatic level regulation and background inflow.
- Pump capacity, water availability and momentum removal.
- Recovery with and without pumping, including conservation across the sea outlet.
- Three separate overtopping pulses, a passing inland wave and affordable wave protection.
- Bounded recording storage and progressive brush height, budget, cap and frame-rate independence.

Browser verification covers hover/click agreement, overhead drawing, undo, scenario
switching, storm selection, calculation cancellation, timeline dragging, pause,
fast playback, numerical view, pump recovery, and mobile overflow.
Hardware performance and child playtests at the stand remain necessary.

## References and scope

- Audusse et al., *A Fast and Stable Well-Balanced Scheme with Hydrostatic
  Reconstruction for Shallow Water Flows*, SIAM J. Sci. Comput. 25 (2004).
- https://www.clawpack.org/v5.9.x/riemann/Shallow_water_Riemann_solvers.html
- https://www.rijnland.net/over-rijnland/wat-doet-rijnland/in-uw-buurt/poldergemalen/
- https://www.deltares.nl/expertise/publicaties/infragravity-waves-in-dutch-tidal-basins-and-estuaries-implications-for-flood-risk-assessment

The pond and pump are fixed infrastructure, not player-placeable tools.
Additional landscapes, dedicated storage-area controls, selectable grid resolution,
structural dike failure and a leaderboard remain future extensions.
