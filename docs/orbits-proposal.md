# Gravity Doodle: assessment and proposal

An assessment of Gravity Doodle as it was on 24 September 2026 against
[message.md](message.md), and a proposal for what it should become. The event is on
3 October 2026, so the proposal is phased like the
[Ball Pit proposal](bounce-proposal.md): **A** makes the game meet the goals, **B** adds
depth, **C** can wait.

**Phases A and B are built** (24 September 2026). Where the build differs from this
plan, phase A:

- **Lighter toy masses.** Pebble 0.1 %, planet 0.5 %, giant 3 %, star 60 % of the Sun.
  With 1 % planets and 5 % giants no opening layout survived three minutes (bodies a
  few Hill radii apart scatter within seconds). The opening system is a pebble, a
  planet and a ringed giant at 11, 20 and 44 % of the screen height: 12 of 12 random
  starts survive three minutes. A giant still wobbles the Sun by ~7 px, and close
  passes still bend paths and merge.
- **Exact forecast.** Velocity Verlet in fixed 1/240 s ticks; the forecast copies the
  world, adds the throw and runs the same steps (6 s, ~3 ms with 33 bodies). A test
  throws the forecast body for real: 0 px apart after 1 440 steps. The scene is kept
  centred by a gentle uniform shift of every body, inside the step, so the forecast
  includes it. The outcome gained a fifth colour: pink, "it will smash into a planet".
- **Save the Earth** (now round 3): impact is 5.5 "years" out (8 s each, ~46 s in all), not 6, so Earth starts
  across the Sun from the "impact day" mark; asteroids that would pass Earth before the
  last half year are drawn again. After a look, the new cloud is sampled 0.4 years back
  and flown to now, so it shows as a short arc rather than a single dot. While
  dragging a push, the preview flies every third asteroid every third frame (~3 ms).
- **Calibration, measured** over 16 asteroids (`npm run test:orbits`): the opening
  chance of impact is 3–16 %; after three looks it is above 50 % for all 16 (54–100 %).
  A blind full push clears the whole cloud for only 2 of 16, while after three looks a
  quarter-power push clears it for all 16. A push at the start needs 0.0004–0.0007; one
  half a year before impact needs 0.008 or cannot save Earth at all. Scores: doing
  nothing 50, a blind full push 400, looking three times then a small push ~965.

Phase B:

- **Goldilocks scores the life that is alive.** The ring (30–58 % of the scene's
  half-height) is narrow, and physics decides how many planets it holds: with the toy's
  masses and sizes even two planets merged or were thrown out within seconds (a few
  Hill radii apart). The round uses its own lighter, smaller worlds (planets 0.1 %,
  7 px; the giant outside the ring 0.5 %), six planets and 50 s. Life grows with time
  in the zone (🌱 8 s, 🌿 16 s, 🌳 24 s, 🦕 32 s, worth 25/75/150/250), and the score is
  the life on the planets still alive, so a crash takes points away ("💥 life melted
  −75"). Scoring every stage once reached instead let a crowd of six at one radius win
  (850 against ~500 for two calm planets); now, measured over 16 bot games each: one
  planet 250, two calm 455, three calm 459, six crowded 358, six at random 292.
- **Slingshot has no mid-course fuel.** Five probes and 60 s; the launch is capped at
  0.16 × Earth's orbital speed (relative to Earth), where no direct shot reaches the
  golden ring (tested); with the giant (5 %, on the middle orbit) 0–21 % of launch
  directions and speeds arrive, depending on where the giant is, and after at most a
  quarter of a second of waiting some do. The forecast flies the whole 14 s trip, so
  the search ("wiggle until the line turns green") is the game; a probe that falls
  short shows only its first 4 s. Scores: 200 per arrival, 50 per photo of the giant
  (passing within four of its radii).
- **The step lens** is a slider (240 down to 7.5 steps a second) with a 🪄 smart /
  📐 simple chip in the toolbar; the forecast uses the same steps, and big steps are
  drawn as dots. Measured on a circular orbit: at 7.5 steps a second smart steps stay
  within 2 % and simple ones drift 364 % in 20 s; even at 240 a second simple steps drift
  62 % in a minute (smart 0.15 %). The delve's step lab switches the demo and the toy.
- **The delve cost figure is measured:** matching 40 smart steps per orbit over five
  orbits takes about 4 200 simple ones (104×; 22× over one orbit). The chapter says
  "about a hundred times" and the demo prints the computed number.
- **Chapter 4** shows Burrau's Pythagorean problem (masses 3, 4, 5 at rest on a 3-4-5
  triangle) as chaos twins, one star nudged by 10⁻⁶: they part after ~15 s. The lab
  switches to the figure-8 choreography, whose twins stay within 10⁻⁴. **Chapter 6**
  runs the asteroid model with three automatic looks; every other run the real
  asteroid alone is nudged so it just misses, and the chance climbs, then falls to
  zero, as 2024 YR4's did. The energy/skateboard demo is gone (merged into chapter 3).
- **Bug found while playtesting:** two massless probes that touched merged into a NaN
  (0/0 mass weights), and drawing it threw and stopped the frame loop. They now meet
  halfway, and non-finite bodies are never drawn.
- **To verify before printing:** Artemis II flew the free return in April 2026; 2024
  YR4's 3 % (February 2025); DART changed Dimorphos's orbit by about half an hour;
  Hera arrives at the end of 2026; JUICE's Moon/Earth/Venus flybys; Oscar II's prize
  (1889) and Poincaré's correction; Burrau (1913) and its computer solution (1967);
  the figure-8 (Moore 1993). **Agree the wording** of chapter 3's group sentence
  ("designing step recipes that keep energy honest — for wind and turbulence rather
  than planets — is part of our group's research").

## Assessment

Gravity Doodle is still close to the Phase-5 "cheap, reliable fun" sketch from
[ideas.md](ideas.md#6-gravity-sandbox--candidate): drag and release to launch a planet
around a fixed Sun, with a dashed preview of the path coloured by its fate. It has since
gained a strong five-chapter delve. It is now the only game in the arcade without a
challenge or a scoreboard, and the only one that has not been reworked since August.

### What works (keep)

- **The first second.** Two planets already circle the Sun, and pressing the mouse
  draws a forecast line within a frame. Nobody has to read the hint.
- **The aim preview.** Coloured by outcome (orbit, huge orbit, escape, crash), it turns
  aiming into play and makes every throw a small success. It is also, without saying
  so, the most important idea in the game: *the computer shows you the future.*
- **The delve.** Five chapters with live demos: speed decides the shape (circle,
  ellipse, escape at √2), gravity pulls both ways (the wobble that finds exoplanets),
  energy is conserved, Euler versus symplectic steps (the only chapter in the arcade
  about how a computer steps time forward, and the one closest to our research), and
  the Apollo free-return figure-8 with a Moon-off ghost. Good writing, good demos.
- It looks nice: trails, the glowing Sun, the outcome colours.

### Measured

Node, same physics as `orbits/index.ts`, 1280×720 screen, planets launched from 30 %
of the screen height with a fraction of the circle speed:

| | |
|---|---|
| Integration | semi-implicit Euler with the **frame's** `dt`; the preview uses 1/120 s |
| Sun-grazing orbit, position after 7 laps, 60 fps vs 120 fps | 85–970 px apart |
| Same, 30 fps vs 120 fps | 360–7 500 px apart |
| Crash radius, preview vs game | Sun + 6 px vs Sun + planet radius (5–12 px, random) |
| Forces between planets | none: every planet feels only the Sun, and the Sun never moves |
| Full N-body forecast, 60 planets, 840 steps | ~6.5 ms per frame (fine; ~1.6 ms at 30) |

So on a slow or fast machine the preview can promise an orbit that the planet then does
not fly, and near the Sun the difference is large. Fine for a toy; not for a scored
round, which has to give the same result on every machine.

### Against the goals

1. **No goal mode, no scoreboard.** Principles 1 and 4 are missed. Every other tile
   now has rounds and a board; this one has nothing to beat and nothing to queue for.
2. **No 15-minute depth in play.** Planets ignore each other, so ten planets are ten
   independent ellipses. After the first minute there is nothing new to discover: no
   collisions, no captured moons, no slingshots, no chaos. The toy shows the one-body
   problem, which is exactly the problem that *doesn't* need a computer.
3. **The message is in the delve only.** The science line ("the same math … plans real
   space missions") has no "we" and no research. [ideas.md](ideas.md) calls this the
   weakest link to our group. That is no longer true: the delve's chapter 4 is our
   research (step recipes that keep energy honest), but nobody sees it in play, and
   nothing in the game links it to the rest of the arcade.
4. **The toy contradicts the delve.** Chapter 2 says gravity pulls both ways and the
   star wobbles; in the game the Sun is nailed to the screen centre.
5. **Low juice, low legibility.** No sound (Ball Pit and Save the Netherlands have it
   now). Planets are 5–12 px dots with 2 px trails, hard to read from 2 m. The hint
   text stays forever and planets fly through it. Planets leave the screen without a
   trace and silently vanish at twice the screen size; at 60 planets the oldest one
   disappears mid-orbit.

### What only this game can do

Every other game simulates a field (wind, water, weather) or a crowd (people, balls).
This one simulates the oldest law in physics, and it is the cleanest place in the arcade
to show two things the rest silently depend on:

- **Knowing the law is not knowing the future.** Newton wrote down gravity in 1687.
  For two bodies there is a formula. For three or more there is none (Poincaré, 1890),
  so the *only* way to know where they will be is to compute it, step by step. That is
  the one-line message ("scientific computing can simulate anything") in its purest
  form: the equations were never the hard part.
- **How you step forward matters.** A careless step recipe invents energy out of
  nothing; a clever one doesn't, at the same cost. Designing step recipes that respect
  the physics is our group's craft, for turbulence rather than planets.

Ball Pit became the arcade's microscope. This game should become its **crystal ball**:
the place where you learn what it means to *predict*, and why predictions come as a
line, then a wobbly line, then a cloud.

## Proposal

### The core idea, revealed layer by layer

> **Everything pulls on everything. There is no formula for what happens next — so the
> computer steps into the future and shows it to you. When we're not sure of the
> start, it shows many futures at once.**

The dashed preview line is the thread through every layer. Rename it on screen as the
**🔮 forecast**:

| Layer | The forecast is… | Idea |
|---|---|---|
| Toy | a perfect line | the computer can see the future |
| Round 1 | a line that bends as other planets tug | everything pulls on everything |
| Round 2 | a line through moving planets | borrow a planet's speed (slingshot) |
| Round 3 | a cloud | you can't know one future, so compute many |
| Delve | twins that part ways; a step slider | chaos; how the computer steps |

### Layer 0: toy (no reading, a result within a frame)

- **Everything pulls on everything.** Planets attract each other and the Sun, with
  masses by size. Planet masses must be a toy 0.5–3 % of the Sun's so that encounters
  are visible within seconds ("looks accurate beats is accurate"). The Sun moves too;
  draw the scene around the centre of mass so the system never drifts off screen.
  Near misses bend both paths; close passes throw planets out or capture moons.
- **Collisions merge.** Two planets that touch become one bigger planet, with a flash,
  a thud and a ring of debris. A planet that hits the Sun sizzles into it. Kids will
  build one giant planet on purpose, and that is fine.
- **Size picker** (four big buttons, the next planet shown at the cursor before you
  drag): 🪨 pebble, 🌍 planet, 🪐 giant, ⭐ star. A giant visibly wobbles the Sun
  (delve chapter 2 made real). A second **star** turns the system into a binary, and
  the planets go wild: the three-body problem, discoverable with one button.
- **Grab and re-throw.** Pressing *on* a planet picks it up (its forecast line shows)
  and releasing throws it again. Agency over what is already on screen.
- **Keep** drag-to-throw, the seeded planets, the outcome colours and the tap-to-drop
  (a planet dropped at rest falls into the Sun: a satisfying sizzle).
- **Juice:** planets 10–24 px with a lit side facing the Sun; thicker, fading trails;
  a soft whoosh on launch (pitch by speed), thud on merge, sizzle into the Sun, a small
  *ding* each time a planet completes a lap, with a lap counter on it ("3 years!").
  Arrows at the screen edge for planets out of view, so kids see a huge orbit is coming
  back. The hint fades after the first launch. When full, the oldest *escaped* or
  smallest planet goes, not a random one mid-orbit.
- **Toolbar:** size picker, 🕸 Gravity view, ↺ Clear, 🎯 Challenge. (The step slider
  of layer 2 lives in the delve lab and, optionally, in the toolbar.)

### Layer 1: challenge (three rounds, one idea each, one total score)

About 60 s per round, summed into one score for the shared `scoreFlow` board, like the
other games. The physics runs in fixed ticks (see below) so every machine gives the
same result and the forecast is exactly what will happen.

**Round 1: Goldilocks.** *Idea: an orbit needs the right speed, and planets disturb
each other.* A green ring around the Sun is the zone where water stays liquid. A giant
planet already circles outside it. Launch planets into the ring; each earns points
for every second it stays inside. Too many, too close, and they tug each other out of
the ring (or merge). Score = planet-seconds in the ring. A five-year-old lands one or
two; an older kid learns to space them out and to keep clear of the giant. Real link:
the habitable zone and the wobble method of delve chapter 2, which is how many of
those planets were found.

**Round 2: Slingshot.** *Idea: you can borrow speed from a planet.* Launch a probe
from a moving Earth to a target far out (a comet, Saturn). The launch speed is capped
below what a direct flight needs; the only way is a close flyby of a big moving
planet that throws the probe outward. A little fuel for mid-course nudges (click
towards where you want to go). The forecast includes the moving planets, so kids
search by wiggling the drag until the line bends round the giant and touches the
target: the search itself is the lesson ("space agencies try millions of these").
Three missions in 60 s; score per arrival, plus fuel left. Real link: Voyager's grand
tour; ESA's JUICE flew the first ever Moon-then-Earth double flyby in August 2024 on its
way to Jupiter; ESA's mission centre ESTEC is in Noordwijk. *(Verify before printing.)*

**Round 3: Save the Earth.** *Idea: we can't know one future, so we compute many — and
a small push early beats a big push late.* An asteroid will pass close to Earth in
six "years" (about 50 s). Nobody knows its orbit exactly, so it is drawn as a **cloud
of 300 possible asteroids**, each flown by the same simulation. Two actions:

- 🔭 **Look** (a few times): each observation shrinks the cloud around the true
  asteroid. The "chance of impact" readout jumps around — and may go *up* — until it
  settles near 0 % or 100 %.
- 🚀 **Push** (once): drag a DART-style nudge on the cloud. The earlier you push, the
  less push you need; but push before you've looked and you may push the wrong way.

Score = the share of the cloud that misses Earth at the end, with a bonus for pushing
early. It is a real decision under uncertainty (look longer, or act sooner?), the
same trade-off as the dike budget in Save the Netherlands. Real link: in early 2025 the
asteroid 2024 YR4 briefly had a 3 % chance of hitting Earth in 2032, the highest ever
measured for an asteroid that size; more observations brought it to practically zero.
NASA's DART (2022) pushed the moonlet Dimorphos; ESA's Hera reaches it about now, late
2026. *(Verify all of these before printing.)*

*Feasibility, measured* (scratch spike: Sun GM = 1, Earth on a circle of radius 1,
asteroid on an Earth-crossing orbit with semi-major axis 1.3, built backwards from an
impact after 6 years; symplectic steps of 1/400 year; capture radius 0.03):

| Uncertainty in the asteroid's speed | Share of the cloud that hits |
|---|---|
| 1 % | 9 % |
| 0.3 % | 10 % |
| 0.1 % | 14 % |
| 0.03 % | 35 % (→ 100 % as the cloud shrinks onto the truth) |

| Push applied … before impact | Smallest push that makes the true asteroid miss |
|---|---|
| 5 years | 0.0005 |
| 2 years | 0.001 |
| 1 year | 0.0015 |
| half a year | 0.005 |
| 0.2 years | 0.05 (100× more) |

So both lessons are in the physics, no faking needed: the impact chance rises as the
cloud shrinks, and an early push is a hundred times cheaper than a late one. Budget
half a day to tune the look/push costs and the cloud size so that a kid who looks twice
and pushes early saves Earth, and one who pushes blind often doesn't.

### Layer 2: in-play reveals

Like Save the Netherlands' X-ray lens and Ball Pit's zoom, two lenses on the live toy:

- **🕸 Gravity view.** A grid under the planets that sags toward every mass (the rubber
  sheet), readable from across the room. Stars make deep wells, planets small dimples,
  and a slingshot visibly rolls a probe round the rim of a well. Pure intuition, no
  equations.
- **🧮 The computer's steps** (a slider, in the delve lab and optionally the toolbar).
  Drag it up and the live toy switches to huge time steps: planets hop in visible
  straight lines, then — with simple Euler steps — spiral out or crash; flip to smart
  steps and the same big steps stay on their orbits. Breaking the solar system is fun,
  and it is the one thing the group does that no other tile shows.

### Layer 3: delve, one arc from one orbit to "we can't know one future"

Six chapters in the shared panel. Chapters 1, 2 and the Moon carry over; 3 and 4 merge;
two are new.

1. **One speed decides the orbit.** As now. Fix the text: the preview has four colours
   (green orbit, yellow huge orbit, orange escape, red crash), not two.
2. **Everything pulls on everything.** As now (equal and opposite, the wobble that finds
   exoplanets), plus one line: "in the game too — throw a giant and watch the Sun wobble."
3. **Nothing is lost — unless the computer cheats.** Chapters 3 and 4 merged: the flat
   energy line, then the step lab breaks it. Add the cost: a step counter per orbit,
   showing that simple steps need ~100× more work to match smart steps. *Doing the same
   sum smarter is our craft.* Group link: our group designs step recipes that keep
   energy honest in simulations of wind and turbulence (energy-conserving
   discretisations), with a button into Swirl Lab. *(Agree the wording.)*
4. **Three is too many for a formula.** New. Two identical three-body systems, one star
   nudged by a hair; after a few orbits they have nothing in common. The history: King
   Oscar II of Sweden and Norway offered a prize for proving the solar system stable;
   Poincaré won it in 1889, found an error in his own proof, and in fixing it discovered
   chaos. The only way to know the future of three bodies is to compute it — which is
   why the arcade exists. *(Verify.)* Optional, delightful extra: the three-star
   figure-8 dance (Moore 1993; Chenciner & Montgomery 2000), next to the next chapter's
   figure-8.
5. **To the Moon and back.** As now. Artemis II has since flown it (April 2026): change
   "was designed around" to "flew". *(Verify.)*
6. **Will it hit us?** New, the delve side of round 3: a cloud of possible asteroids,
   2024 YR4's jumping impact chance, DART and Hera. "You cannot know one future, so we
   compute a thousand" — the same idea as the dike-failure chances in Save the
   Netherlands, the dreams in Weather Detective and the Plinko bell in Ball Pit, with
   buttons into those games (as in Ball Pit's last chapter).

### Science lines

- **Tile / title card:** "Newton's law is 340 years old, but for three planets it has no
  formula: the only way to see their future is to compute it. That's how space missions
  are planned, and how we check that asteroids will miss us."
- **Stand talking point** (for parents): "The dashed line is the computer's forecast.
  The trick our group works on is making those forecasts honest: step recipes that
  don't invent energy — we use them for turbulence and wind farms — and clouds of
  forecasts when we're not sure of the start." *(Agree the exact wording of the group
  claim.)*
- **Dutch hooks** for the stand, if wanted: ESA's technical centre ESTEC is in
  Noordwijk; Jan Oort explained where comets come from (the Oort cloud); Huygens found
  Titan, and ESA's Huygens probe landed on it in 2005.

### Physics and robustness

- **Fixed ticks.** Step the physics in fixed 1/240 s substeps (velocity Verlet or
  symplectic Euler), independent of the frame rate, and compute the forecast with the
  *same* stepper and the same crash radius. Then the forecast is exact ("it's not a
  guess, it's the same simulation run ahead"), and scores are fair across machines.
  Ball Pit learned this the hard way with its Plinko twins.
- **N-body** with softening, masses by size, merging with momentum conservation;
  barycentric view; cap ~40 bodies (forecast ≈ 3 ms). The forecast integrates all
  bodies, so a new planet's line bends where others will tug it.
- **Kiosk guard:** on a NaN or a body beyond ten screens, remove it; on an empty
  system, reseed after a few seconds so the idle screen stays alive.
- The delve's step lab drives the toy's integrator too (as Ball Pit's switches do), so
  closing the delve with big Euler steps on shows the broken solar system; reset to
  smart steps when the game restarts.

## Phases

**A: meets the goals (≈ 2 days).** Fixed ticks and an exact forecast; N-body with
merging, the size picker and the barycentric view; sound and juice (bigger planets,
lap dings, edge arrows, hint fade, Clear button); round 3 (Save the Earth) after its
half-day tuning, with `scoreFlow`; new science line. Round 3 goes first because it
carries the strongest message and the clearest stakes for a kid.

**B: depth (≈ 2 days).** Rounds 1 and 2; the gravity view; the step slider in the
live toy; delve chapters 3 (merged), 4 and 6, with link buttons; all in en/nl/no.

**C: after the event.** "Let the computer try" in round 2 (a random search of launch
angles animating its attempts, posting its own score, like the wind farm's computer
player); presets (the three-star figure-8, a Tatooine binary, the inner solar system
roughly to scale).

**If A doesn't fit before 3 October:** unlike the old Bouncy Balls, the game does not
dilute the message (space is a domain no other tile covers), so keep it on the stand.
A half-day "A-lite" — fixed ticks, planets that pull on each other and merge, the size
picker with ⭐, sound, the new science line — gives the toy its 15-minute depth even
without a scoreboard.

## Smaller issues noticed

- The forecast and the game use different steps (1/120 s vs the frame's `dt`) and
  different crash radii, so the forecast can be wrong for close passes (table above).
- The planet's size (and so its crash radius) is picked at release, after the
  forecast was drawn. Pick it before, and show it at the cursor.
- The hint at the top never goes away, and planets fly through it.
- Planets leaving the screen give no sign of whether they will come back; at twice
  the screen size they are silently deleted, even on bound orbits.
- `MAX_PLANETS` trimming with `shift()` deletes the oldest planet mid-orbit.
- Delve chapter 1 says the preview is blue-green or orange; the game uses four colours.
- Delve chapter 5 speaks of Artemis II in the future-in-the-past; it flew in April 2026.
