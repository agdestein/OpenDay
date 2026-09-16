# Save the Netherlands: first playable remake

A fixed isometric Dutch diorama, drawn in Canvas 2D, replaces the national heat map.
The numerical model remains two-dimensional; the visible land has exaggerated height.
One village and one clear opening keep the cause and effect readable.

## Playing

Draw across the opening in either view and release to commit the preview.
Hovering shows the footprint, height and cost of a single click before placing sand.
Drawing near the existing ridge snaps to its centreline.
The preview shows cost; an unaffordable stroke is rejected as a whole.
Choose a low or high crest, undo strokes, and start the storm when ready.
Construction is paused during storms so the comparison remains repeatable.
Rewind restores the same dry initial polder and sea, retaining construction.
A dotted peach overlay marks cells deeper than 0.3 m in the previous run.
The score counts homes that stayed below 0.3 m for the entire storm.
These are fictional buildings and an illustrative landscape, not a Dutch hazard forecast.

The model button switches to an overhead grid with computed velocity arrows.
Point at a cell to see bed elevation, depth, and speed.
Drag the timeline in either direction to inspect any point in the storm.
Scrubbing pauses playback; Continue resumes from the selected time.
Water, momentum, sea level and the homes flooded by that time are restored together.
Pause and advance one recorded frame, or run in slow motion.
Arrows are drawn after the landscape so water tiles cannot occlude them.
A desktop cross-section at the opening shows the ground, crest, water and zero datum.
English, Dutch and Norwegian controls are provided.

## Model

The model evolves depth and both depth-integrated momentum components.
It uses first-order finite volumes with local Lax–Friedrichs (Rusanov) fluxes,
hydrostatic reconstruction and matching bed-source corrections.
Time steps obey a conservative two-dimensional CFL bound.
Small depths lose momentum; linear friction dissipates flow momentum.
All boundaries reflect flow except the western prescribed sea-level boundary.
Inflow volume is accounted for at that boundary, rather than resetting sea cells.

Cells are 10 m wide; the 42-second display compresses 1008 seconds of physical time.
The surge rises to 2.2 m, holds and retreats.
The polder starts dry with an opening, so even calm water could eventually enter.
The initial state is intentionally not a steady state.
The high crest is 2.4 m; the low crest is 1.0 m.
Water and momentum are restored between attempts; numerical replay is deterministic
for the same time steps and geometry.
At storm start, the full run is computed at 30 recorded frames per display second.
The 1261 frames store depth and both momenta as Float32 arrays (38,737,920 bytes,
about 37 MiB), plus a small cumulative house-flooding mask.
The solver itself still uses Float64 arithmetic; only playback snapshots are reduced.
Playback linearly interpolates fields between frames and never integrates backwards.
Rewind, reset and leaving the game release the recording.
The previous-flood overlay covers the recording through the selected rewind time.
Interactive construction happens only before a run, avoiding artificial water removal.

Method references:
- Audusse et al., *A Fast and Stable Well-Balanced Scheme with Hydrostatic
  Reconstruction for Shallow Water Flows*, SIAM J. Sci. Comput. 25 (2004).
- https://www.clawpack.org/v5.9.x/riemann/Shallow_water_Riemann_solvers.html

## Checks

Run `npm run test:floodland` and `npm run build` from `app/`.
The numerical suite checks lake-at-rest balance over uneven terrain, closed-basin
water conservation, wet/dry dam-break spreading, boundary water accounting,
open/low/high defense outcomes, and identical numerical replay.
The reference storm floods 8/8 homes with no defense or a low dike and 0/8 with
an affordable high dike across the opening.

Browser verification covered a full storm after drawing through the real interface,
undo, pause/resume, numerical view and stepping, rewind, and mobile overflow.
The drawn high dike protected all eight homes, with no browser runtime errors.
Follow-up checks cover overhead drawing, hover/click agreement, bidirectional range
dragging and keyboard control, historical score restoration, playback continuation,
and recording cleanup.
The numerical suite also checks recording memory bounds, agreement with the reference
run, repeated seeking of depth and momentum, and historical flood extent.

## Scope

This is the first complete scene from the remake proposal.
Gates, pumps, storage areas, further scenarios, computed forecasts, selectable grid
resolution, and a leaderboard are future extensions.
The current model view shows depth through colour, cell inspection and a cross-section;
it does not render individually extruded water columns.
There is no structural dike failure model or short-wave breaking simulation.
Browser checks do not replace a playtest with children or a run on the stand hardware.
