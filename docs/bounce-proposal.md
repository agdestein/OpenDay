# Bouncy Balls: assessment and proposal

An assessment of Bouncy Balls as it was on 23 September 2026 against
[message.md](message.md), and a proposal for what it should become. The event is on
3 October 2026, so the proposal is phased like the
[Save the Netherlands proposal](floodland-proposal.md): **A** makes the game meet the
goals, **B** adds depth, **C** can wait.

**Phase A is built** (the game is now Ball Pit; its id stays `bounce`, so `?games=`
and today's scores keep working). Where the build differs from this plan:

- **No Brazil nut.** The golden ball does not rise when the pit is shaken, with the
  hot plate or with whole-pit taps (tried both in node: after 30 s of shaking it still
  sits in the lower half). The effect needs spinning, rolling balls and wall friction
  that drives convection; this model has no spin. The big ball stays as a heavy
  wrecking ball, and nothing in the game claims it rises. Drop the Brazil-nut fallback
  for round 2 as well, unless the model gets rotation.
- **History line.** "The first computer simulations of molecules (1957)" overstated it:
  Metropolis et al. (1953) had already simulated hard disks by Monte Carlo, and Alder
  and Wainwright's 1957 work was the first *molecular dynamics*. The game says "some of
  the very first computer simulations of molecules, in the 1950s, were balls just like
  these", which both support.
- **Plinko needs air.** With pegs alone the balls skate sideways and the buckets fill
  almost evenly (no bell curve). Soft pegs (restitution 0.3) plus sideways drag in the
  board give a clean bell. The gold bucket sits 3 buckets off-centre, left or right at
  random; doing nothing scores about 170–290 depending on the screen, and a first try
  with four bumpers scored 439.
- **Twins.** From a 0.01 px gap, twins land in different buckets only about 3 times
  in 4. The game quietly tries up to eight twin pairs on a copy of the board and shows
  one that parts ways; every pair shown really starts 0.01 px apart.
- **Controls.** Heat and Cool are hold buttons (a tap gives a short burst). The
  three model switches live in labs in delve chapters 3–5, next to the text about
  them. The count at the top reads "N balls, each moved 240 times per second" (four
  substeps per frame).
- Measured after the rebuild (node, 1280×720 pit): mean overlap 0.5 %, resting pile
  at zero speed, the neighbour grid checks ~3 000 of 17 000 pairs, Plinko physics
  ~1.3 ms per frame with 300 balls. `npm run test:bounce` covers these.

## Assessment

Bouncy Balls started as the Phase-0 placeholder that proved the shell works. It has since
gained three physics switches, a Reset button and a five-chapter delve layer. The delve
writing is good and the code is tidy. As a game, it is still a placeholder.

Measured (node, same physics as `bounce/index.ts`, 400 balls in 1280×720, after 10 s):

| | |
|---|---|
| Frame cost, all 79 800 pair checks | ~0.14 ms, so speed is not the problem |
| Mean overlap between touching balls | ~48 % of the smaller radius |
| Worst overlap | >200 %: small balls end up fully inside big ones |
| RMS speed of the "resting" pile | ~115 px/s: it never settles, it shivers |

Against the goals:

1. **It serves the message worst of all seven games.** "The variety *is* the message":
   each other tile is a domain (energy, health, water, weather, AI, space). Bouncy
   Balls is about nothing in particular. Its science line ("even a bouncing ball is a
   simulation") is the only one with no research, no application and no "we". A parent
   leaves with nothing to repeat on the way home.
2. **No goal mode, no scoreboard.** Principles 1 and 4 are missed: nothing to beat,
   nothing to queue for. Every other game has rounds or a challenge.
3. **The first seconds are a black screen with a sentence.** A five-year-old who wiggles
   the mouse gets nothing; only a click does anything. "No reading required" is broken
   on the very first screen.
4. **The toolbar has the modeler's switches, not the player's.** "Ball collisions",
   "Wall friction" and "Heat loss" are modeling choices. They belong in the delve (where
   they already are, too). In toy mode their effects are hard to tell apart, and none of
   them is fun.
5. **The delve teaches mechanics, and duplicates Gravity Doodle.** The five chapters (state,
   time stepping, collisions, friction, energy) explain how a physics engine works.
   Gravity Doodle already has "How the computer actually does it" (time stepping) and
   "Nothing is ever lost" (energy). None of the chapters gets to *why this matters*.
6. **Low juice, low legibility.** Flat circles, no sound (the rest of the arcade has
   sound now), a 20 px count at the top. The pile rises over the toolbar and buries
   it. At the 400-ball cap the *oldest* balls vanish. Those are the bottom of the
   pile, so the pile suddenly sags.

The game has one thing none of the others has: **it shows what is underneath all of
them.** Wind, floods and weather are made of countless tiny bouncing balls (molecules).
Swirl Lab and Save the Netherlands do not simulate those balls. They simulate the
*crowd*, because the balls are far too many to count. Why that is, and what it costs
to leave the balls out, is the heart of our group's craft (closure models). No other
game can tell that story. That is the reason to keep this one and rebuild it around it.

## Proposal

### The core change: from a ball toy to the arcade's microscope

Rename it **Ball Pit** (nl: **Ballenbak**, which every Dutch child knows; no:
**Ballbinge**). The core idea it reveals, layer by layer:

> **Every ball follows one simple rule. Together they become sand, water and air —
> and there are far too many to count, so we invent equations for the crowd.**

It is also the arcade's history hook: the first computer simulations of molecules
(Alder and Wainwright, 1957) were bouncing hard balls. They found by computation that
balls with no attraction at all still freeze into a crystal. That was one of the
first discoveries made with a computer simulation. *(Verify the wording before
printing it.)*

### Layer 0: toy (no reading, a result within a frame)

- **Open with the pit half full**, balls gently settling. Never an empty screen.
- **The mouse is a hand.** Just moving the cursor pushes balls aside (a kinematic
  disk that carries the mouse velocity). A wiggle scatters the pit without any click;
  a sweep throws a wave. **Hold** the button to pour a stream; a tap drops a handful.
- **🔥 Heat / ❄️ Cool** (one big slider or two big buttons): the floor jiggles, the
  pile boils into a gas that fills the box; cool it and it settles back, and with
  equal-sized balls it freezes into a honeycomb crystal. Colour by speed while heating
  (blue slow → red fast): temperature made visible. This transformation reads from 2 m
  away and is the single best "whoa" in the game.
- **🟡 Big ball** drops one heavy golden ball. Shake (heat) the pit and it *rises*,
  like the Brazil nut at the top of the muesli bag. Discoverable, never explained in
  play.
- **Sound:** a soft clack per collision, pitch by ball size, volume by impact,
  rate-limited (new `clack` voice in `lib/sound.ts`). A pour sounds like rain on a roof.
- **Toolbar:** Heat, Big ball, Reset, Challenge. The three model switches move to the
  delve only.
- The floor sits *above* the toolbar strip, and a lid keeps flung balls in view. When
  the pit is full, pouring stops with a small "full!" bounce instead of deleting the
  bottom of the pile.

### Layer 1: challenge (three rounds, one idea each, one total score)

Rounds are about 60 s each. They sum to one score for the shared `scoreFlow` board, like
Outbreak and Save the Netherlands.

**Round 1: Plinko.** *Idea: one ball is luck, three hundred balls are predictable.*
A Galton board, with the gold bucket placed off-centre. You get five bumpers to drag
onto the board, and you may move them while the balls pour. 300 balls drop. Score =
balls in the gold bucket ×10 + silver ×3. The bell curve piles up in the buckets by
itself. Before the pour, two "twin" balls are dropped a hair apart: they part ways
and land in different buckets. You cannot aim one ball, but you can aim a crowd. Weather
forecasts and our uncertainty work reason the same way, with ensembles.

**Round 2: Empty the silo.** *Idea: crowds jam, and the fix is counter-intuitive.*
A grain silo with a narrow exit. Balls form arches and the flow stops dead. You get
one pillar to place. The obvious move (nothing, or a pillar right on the hole) jams.
The right one, a small pillar a few ball-widths above the exit, breaks the arches.
The same thing happens in real silos (Zuriguel et al., PRL 2011) and at emergency
exits (Helbing et al., Nature 2000). Jamming is random, so after you place the pillar
the computer **runs your silo twelve times side by side** (an ensemble), and the
score is the number of balls out in 20 s over all twelve. This reuses round 1's lesson:
one run is luck, many runs are knowledge.

*Feasibility, measured* (scratch prototype: these physics plus 3 relaxation passes and
ball–ball friction 0.5; hopper outlet 2 ball diameters; 8 random fills each):

| Pillar | Silos jammed | Balls out (of 260) |
|---|---|---|
| none | 6/8 | 134 |
| small, 4 diameters above the exit | 3/8 | 204 |
| big, 5 diameters above | 7/8 | 140 |

So the effect is there and a badly placed pillar makes it worse, which is what makes
the round interesting. But the sweet spot is narrow and the numbers are noisy, and
without friction the silo hardly jams at all. **Budget half a day to tune the geometry
until the sweet spot is obvious in the twelve-silo ensemble.** If it isn't, swap this
round for "Brazil nut": get the golden ball to the top with as few shakes as possible.

**Round 3: Lift the lid.** *Idea: temperature is speed, pressure is hits.* A box of
balls closed by a heavy piston. Hold 🔥 to heat the floor from a limited fuel tank;
the balls speed up, drum on the piston and lift it. Keep the piston above the flag for
as long as you can. Heat leaks out through the walls (the old "heat loss" switch, now
part of the challenge), so you have to keep feeding it without running out. Score =
seconds above the flag. This is a steam engine built from bouncing balls, and a direct
link to the energy bookkeeping in the delve.

### Layer 2: the zoom-out slider (a reveal inside play)

This game's X-ray lens runs the other way. A **🔭 zoom slider** blurs the balls into a
smooth field of density and temperature, drawn on a coarse grid in Swirl Lab's
colours. With the pit boiling, zoomed out, it looks like the other games' fluids.
Scrubbing the slider back and forth is the particles-to-continuum idea in one gesture,
and a talking point for whoever staffs the stand. A corner counter shows the cost:
"79 800 pairs checked this frame". With the neighbour grid on (next section), it drops
to a few thousand.

### Layer 3: delve, rewritten as one arc from one ball to the other games

Six chapters in the shared 🔬 panel, each with a live illustration on the canvas. Most
of the existing demo code carries over.

1. **A ball is five numbers and one rule.** The current chapters 1 and 2, merged and
   shortened. Gravity Doodle goes deeper on time stepping, so it can point there.
2. **Collisions are the expensive part.** Every pair must be checked: 400 balls make
   79 800 pairs, 60 times a second. The trick is to sort balls into a grid and only
   check neighbours. The demo lights up the checked pairs, first everything and then
   the grid. Doing the same sum smarter is half of scientific computing.
3. **Where does the bounce go?** Zoom into the floor: it is made of tiny balls on
   springs, and the landing ball sets them shaking. That shaking *is* heat. Our model
   does not simulate them. It takes a shortcut and keeps 82 % of the bounce speed
   (`0.82`). That shortcut is a **closure model**: a rule that stands in for everything
   too small to simulate. Keep the energy bars and the switch lab here.
4. **Crowds obey laws no ball knows.** Temperature is average jiggle, pressure is
   hits on the wall, the bell curve comes from Plinko, and solid, liquid and gas are
   the same balls at different heats. Alder and Wainwright's 1957 discovery by
   computer.
5. **Tiny differences grow.** Two identical pits, with one ball nudged a thousandth
   of a pixel. After five seconds they are completely different. That is why weather
   forecasts stop at about ten days, and why we run ensembles. This covers the
   "Butterfly effect" idea (#5 in [ideas.md](ideas.md)), which no game covers yet.
6. **Too many balls → equations for the crowd.** A glass of water holds about 10²⁵
   molecules. Even the fastest supercomputer would need centuries for one femtosecond
   of it. So we average: density, speed and temperature per grid cell, which are the
   equations inside Swirl Lab and Save the Netherlands. The averages forget what the
   small stuff does, and inventing good closure models for that (lately with machine
   learning) is our group's research. The chapter ends with "Now go stir Swirl Lab:
   that is this pit, zoomed out."

### Science lines

- Tile / title card: "Every ball follows one simple rule; together they become sand,
  water and air. The first computer simulations of molecules (1957) were balls just
  like these."
- Delve chapter 6 / stand talking point: "There are far too many molecules to count, so
  we write equations for the crowd — and model what the small stuff does. That is our
  group's daily work." *(Agree the exact wording of the group claim.)*

### Physics fixes the rest depends on

- **A stable pile:** 4 substeps per frame, 3–4 position-relaxation passes, a
  sleep threshold for slow balls, and a cell grid for neighbours (needed anyway for
  the 12-silo ensemble: 12 × 260 balls). Target: overlap under 5 %, resting pile
  motionless.
- **Ball–ball and wall friction** as a tangential impulse (Coulomb-capped). The silo
  needs it to jam, and piles stand steeper with it. There is still no spin: it looks
  right, which is enough.
- **Heating** = the floor gives each contact a random extra kick, scaled by the heat
  setting. **Cooling** = restitution below 1 (the existing damping). Equal radii in
  the crystal demo.
- **Kiosk guard:** on a NaN, or a ball outside the box, respawn that ball.

## Phases

**A: meets the goals (≈ 2 days).** Stable physics with a cell grid; toy rework (starts
half full, mouse pushes, hold to pour, heat/cool with speed colours, big ball, floor
above the toolbar, lid, no deleting the pile); sound; rename; new science line; model
switches into the delve only; round 1 (Plinko) with `scoreFlow`.

**B: depth (≈ 2–3 days).** Silo tuning spike, then round 2 with the ensemble (or the
Brazil-nut fallback); round 3; zoom-out slider with pair counter; delve chapters 1–6
in en/nl/no.

**C: after the event.** Chaos twins inside play (split screen in toy mode); an
evacuation variant of round 2, where the balls are people with eyes running for a door
(the same pillar trick, the most memorable version for kids); link buttons from
delve chapter 6 straight into Swirl Lab.

**If A doesn't fit before 3 October:** hide the game on the stand machines with
`?games=`. As it is, it is the weakest tile and dilutes the message. A half-day "A-lite"
(start half full, mouse pushes, heat button, sound, new science line) at least fixes
the first 30 seconds.

## Smaller issues noticed

All fixed in phase A.

- In the delve, the "✕ Close the science" button covers the top of chapter 1's state
  table (`x = …`).
- The toolbar stays visible, and clickable, while the delve is open.
- The spawn puts five balls at the same point; the overlap push makes them burst
  apart. It looks fine, but it goes away anyway with pouring.
- `MAX_BALLS` trimming uses `splice(0, …)`, which removes the oldest balls: the
  bottom of the pile.
- Ball mass ratio goes up to (22/8)² ≈ 7.6 with a single relaxation pass, so heavy
  balls push through small ones. That is most of the overlap measured above.
