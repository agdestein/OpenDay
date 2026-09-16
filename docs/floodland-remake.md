# Save the Netherlands: playable diorama

A fixed isometric Dutch landscape replaces the national heat map.
The numerical model remains two-dimensional; visible height is exaggerated.
English, Dutch and Norwegian controls are provided.

## Playing and reading the water

Draw dikes in either view; hovering previews a single click's footprint, height and cost.
Drawing near the existing ridge snaps to its centreline.
An unaffordable stroke is rejected as a whole; undo restores terrain and budget.
Choose the challenge before building; changing it starts a fresh landscape.
Construction is paused during a run so comparisons remain repeatable.

All water surfaces have fine cell outlines, including flooded land in the 3D view.
Shallow films are translucent so nearly drained land reads differently from deep water.
Two village level posts measure depth above the local ground, with metre ticks.
A desktop cross-section shows ground, crest, water surface and the zero datum.
Pointing at a cell shows ground elevation, depth and flow speed in either view.
The overhead model view exposes the numerical grid.
Velocity arrows are drawn last so neighbouring water tiles cannot hide them.

The score is homes **kept dry**, a historical measure: pumping does not erase damage.
The homes are fictional and the landscape is illustrative, not a Dutch hazard forecast.

## Challenges

**Storm surge** retains the opening in the coastal dike and a budget of 210 sand.
The sea rises to 2.2 m and retreats over 42 display seconds.
A 2.4 m defense across the opening protects the village; a 1.0 m defense overtops.
One display second represents 24 physical seconds during the surge.

**Three waves** starts with an intact low dike, including a 1.2 m crest along the
vulnerable stretch, and a smaller budget of 85 sand.
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
90-second unattended timeout; slow motion, pause and scrubbing remain available.

In the surge scene, a visible emergency gate closes the opening before pumping.
Otherwise the below-sea-level polder would continue admitting seawater.
The gate blocks flux through grid faces without changing terrain or deleting water.
In the wave scene the intact dike already isolates the polder from the calm sea.

A canal leads to a local intake basin and a pump with a maximum capacity of 35 m³/s.
The pump removes only available intake water and transfers the same volume to a
visible sea outlet; extraction removes the corresponding local momentum.
It operates on each stable solver step, avoiding large artificial discharge bursts.
The pipe's moving dashes point toward the sea; pump flow and cumulative volume
are shown during recovery and restored correctly when scrubbing.
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
Additional small arrays store historical house flooding, pump discharge and boundary accounting.
Playback linearly interpolates fields; it never integrates backwards.
Pause and One step advance one recorded frame, not one solver substep.
Rewind, reset and leaving the game cancel calculations and release recordings.
The previous-flood overlay covers the recording through the selected rewind time.

## Validation

Run `npm run test:floodland` and `npm run build` from `app/`.
The numerical suite covers:

- Lake-at-rest balance over uneven terrain and closed-basin conservation.
- Wet/dry dam-break spreading, stable depths and ocean boundary accounting.
- Open, low and high defenses against the reference surge.
- Deterministic recording, depth/momentum seeking and historical damage restoration.
- Gate isolation without water loss; pump capacity, water availability and momentum removal.
- Recovery with and without pumping, including conservation across the sea outlet.
- Three separate overtopping pulses, a passing inland wave and affordable wave protection.
- Bounded recording storage and gate state restoration across recovery.

Browser verification covers hover/click agreement, overhead drawing, undo, scenario
switching, a drawn wave defense, calculation cancellation, timeline dragging, pause,
fast playback, numerical view, pump recovery, and mobile overflow.
Hardware performance and child playtests at the stand remain necessary.

## References and scope

- Audusse et al., *A Fast and Stable Well-Balanced Scheme with Hydrostatic
  Reconstruction for Shallow Water Flows*, SIAM J. Sci. Comput. 25 (2004).
- https://www.clawpack.org/v5.9.x/riemann/Shallow_water_Riemann_solvers.html
- https://www.rijnland.net/over-rijnland/wat-doet-rijnland/in-uw-buurt/poldergemalen/
- https://www.deltares.nl/expertise/publicaties/infragravity-waves-in-dutch-tidal-basins-and-estuaries-implications-for-flood-risk-assessment

The gate and pump are fixed recovery infrastructure, not yet player-placeable tools.
Additional landscapes, dedicated storage-area controls, selectable grid resolution,
structural dike failure and a leaderboard remain future extensions.
