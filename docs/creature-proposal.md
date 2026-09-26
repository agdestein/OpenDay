# Creature Lab: assessment and proposal

An assessment of Creature Lab (the "learn to walk" game) as it was on 26 September 2026
against [message.md](message.md), and a proposal for what it should become. The event
is on 3 October 2026, so the proposal is phased like the
[Gravity Doodle proposal](orbits-proposal.md): **A** makes the game meet the goals,
**B** adds depth, **C** can wait.

The numbers below were measured headlessly with the game's own `physics.ts` and
`evolve.ts` (scratch scripts, not committed; medians over repeated runs, since
evolution is random), and by playing it at 1280×720.

**Phases A and B are built** (26 September 2026); phase C is not. `npm run
test:creature` checks the numbers quoted here. Where the build differs from the plan:

- **Muscles.** Each muscle may move its ends at most 2.4 m/s (a cap on its correction
  per constraint iteration); `oldMuscles` keeps the limitless ones for the delve's 🐞
  switch. Every stored brain is re-trained by `npm run train:creature`
  (`tools/creature/train.ts`, seeded, about 90 s), which writes `brains.ts`. Each brain
  is rounded, then checked rounded, and must keep 85 % of its distance with every
  phase nudged by up to ±1e-4 rad. The park's walkers and built-in champions are the
  median of eight 40-generation runs, not the best, so kids who train can win:
  Doggo 20.1 m in 12 s, Wiggler 23.7, Hopper 18.6, stick-man 12.1.
- **No Tumbler.** With the cap the stick-man no longer cartwheels (0.1 turns in 12 s
  against 24 with the old muscles) and learns to scoot, so it stays in the park as
  🧍 Stick-man. Cartwheels and the 5 m worm now live only in delve chapter 5, where
  the 🐞 switch turns the old muscles on and off for the same two brains. For the
  same reason the crown race needs no "upside down is out" rule.
- **Rewards.** "Far" is plain distance (the old contact discount is gone), "race-walk"
  is distance while some dot touches the ground, "jump" the lowest dot's best
  clearance, "backwards" distance to the left. With the cap, jump rewards reach
  0.7–1 m.
- **Round 2 uses the Wiggler.** Under the cap the Hopper's gap shrank (48 % against
  34 % airborne), while the Wiggler's is plain: rewarded for distance it flies 58 % of
  the time (8.9 m counted), with a foot on the ground 15 % (14.9 m); the delve's two
  pre-trained worms fly 60 % and 0 %. 25 generations at 40× (about 4 s), then a judged
  12 s run; two tries, the best counts, 50 points a metre.
- **Round 3 uses the Doggo, 40 generations,** on bumps up to 0.2 m, and the brain that
  goes out is the one of the last generation's best five that does best on three
  fresh practice worlds (flat floors, or new bumps; never the course). Without that
  check a quarter of bump-trained Doggos also tripped. Measured over 16 runs on the
  course: flat-trained median 0.2 m (14 below 3 m), bump-trained 7.8 m (none below 3 m).
  60 points a metre.
- **Round 1** takes a pick any time after the pens have walked a second (they freeze at
  four), so a kid is never ignored. Picking the farthest takes Doggo from 1.7 to
  4.1 m in ten picks; picking at random from 1.7 to 1.0 m. The computer's 300 picks
  follow at ~7 ms each, spread over frames, 100 points a metre.
- **Crowns** are stored per kind of body (the four presets and "own design") and per
  day, as `creature-crowns:<date>`. A win is crowned at once as "???" and renamed when
  the initials come, and the new champion walks in the park with its crown. Each kind
  has its own board (`creature-race-<kind>`, distances in metres). A crown holder
  can't race itself, and teaching a kid's own creature carries on from its brain.
- **Editor.** Drags start from the nearest dot within 0.3 m, and anything not joined to
  the head is shown faded and dropped at Done, so drawn limbs stay attached. Undo and
  "start over" are there.
- **Delve.** As planned, with two changes. The brain chapter's nudge makes a twin of
  the brain on show: the champion's twin stays with it (a good gait shrugs off a
  0.01 rad nudge; 0 of 20 parted), and for a scrambled brain it quietly tries up to a
  dozen and shows one whose twin parts (only about a third do within 10 s). The
  landscape is 40 × 40 Doggo brains of 5 s each (the two leg-swing timings), painted
  at 8 ms a frame and kept between visits; pointing at a pixel walks that brain.
- **Title and tile.** The title stays Creature Lab (Beestenlab); the tile is now 🦿.
- **Facts to verify before the day:** the boat-race AI (OpenAI's CoastRunners post,
  2016), "thousands of copies practise at once on one chip … years of falling take
  a few hours" (e.g. Rudin et al., 2021), and **agree the wording** of chapter 6's
  group sentence about learning inside turbulence simulations.

## Assessment

Creature Lab is still the Phase-5 build from August, plus a delve and translations. It
opens in a body editor with Doggo loaded. TRAIN runs a genetic algorithm (20 creatures,
7 s per try, the farthest breed), drawn as a crowd of ghosts with the leader
highlighted and a learning-curve chart. "Race the champ" pits the best brain against
the champion for 12 s and posts the distance to the board. It is the one game that has
not been reworked since its first build.

### What works (keep)

- **The engine is sound and cheap.** Verlet sticks and sine-wave muscles in fixed
  1/120 s steps, about 2 µs per creature per step. Nothing blew up: 64 random kid-style
  bodies (Doggo with extra limbs, random scribbles of muscles and bones) × 20
  generations gave no non-finite value, and their median distance grew ×2–5.
- **Learning is real and visible within a minute.** At the default ×3 a generation
  takes 2.3 s, and most of the gain comes in the first 10–20 generations (25–45 s).
- **The ghost crowd, the highlighted leader, the 🏆 record line and the bars** read as
  "a population, the best one, progress" without words. The genre (carykh's videos,
  Keiwan's *Evolution*) is familiar to older kids.
- **The delve** has a live demo per chapter: a ragdoll to poke, the brain as coloured
  waves with a scramble button, a mini evolution, a zoo of trained bodies. The waves
  chapter is the arcade's clearest picture of "a brain is just numbers".
- **Presets** give a working creature in one click; the editor lets a kid make anything.

### Measured

Learning (20 creatures, 7 s per try, median of 8 runs). ROBO-PUP, the built-in
champion, goes 17.0 m in the 12 s race:

| Body | Random brain | Best, gen 1 | Gen 10 | Gen 20 | Gen 40 | Beats ROBO-PUP by gen 5 / 20 / 40 |
|---|---|---|---|---|---|---|
| Doggo | 0.3 m | 4.8 m | 7.9 m | 9.4 m | 10.9 m | 0/8, 2/8, 6/8 |
| Wiggler | 0.0 m | 2.9 m | 8.8 m | 10.0 m | 11.2 m | 0/8, 4/8, 7/8 |
| Hopper | 1.0 m | 8.9 m | 18.6 m | 19.1 m | 21.5 m | 8/8, 8/8, 8/8 |
| Walker | 0.1 m | 3.8 m | 16.5 m | 20.0 m | 31.8 m | 2/8, 6/8, 5/8 |

(Distances in 7 s; the last column races the best brain for 12 s.)

What the winners actually do after 30 generations (12 s, 6 runs each):

| Body | Gait | Airborne | Full turns in 12 s |
|---|---|---|---|
| Doggo | trot | 3–16 % | 0 (one run 0.5) |
| Wiggler | crawl | 0–27 % | 0 |
| Hopper | hops | 51–62 % | 0–0.2 |
| Walker | **cartwheels**, 5 runs of 6 | 29–72 % | **4–15** |

- **The Walker never walks.** With its muscles relaxed it falls over in 0.3 s (a version
  with feet does too): there is no standing pose to learn from, and a sine-wave brain
  cannot balance. Evolution turns it into a wheel, upside down 95 % of the time. The
  trained Walker in the delve's zoo cartwheels too (10.6 turns in 12 s). The contact
  discount in `fitness()` doesn't catch it, since a wheel always touches the ground.
- **Super-muscles.** Rewarded for height instead of distance, the 1.4 m Wiggler learns
  to clear 4–5 m, its head leaving the ground at 27 m/s (≈ 100 km/h); Doggo clears
  1.3–1.7 m. The muscles are position constraints with no limit on force or speed.
  **Capping each muscle's correction at 2.4 m/s** brings the jumps down to 0.7–1 m,
  **ends the cartwheels** (the Walker then makes 0–0.3 turns in 12 s and goes 6.5–12 m)
  and barely changes walking (Doggo 19.7 → 17.3 m in 12 s, Hopper 29 → 25 m). But
  ROBO-PUP, tuned on the old muscles, drops from 17.0 to 8.3 m, so every stored brain
  must be re-trained after the fix. (The ground contact is not the culprit: making it
  energy-neutral changed the jumps by under 20 %.)
- **Chaos.** Nudging each of ROBO-PUP's phases by up to ±0.001 rad leaves it at 17 m,
  except one in 30 that falls on its face (−0.8 m). At ±0.01 rad: median 14.2 m,
  range −0.9 to 17.4 m.

### Against the goals

1. **No toy, and nothing moves at the start.** The game opens on a static drawing of a
   dog in an editor. A five-year-old who wiggles the mouse gets nothing. Clicking empty
   space adds loose dots, which then sit on the floor and dilute the measured distance
   (it is the average of all dots). The first motion needs reading "TRAIN" and pressing
   it, so principle 1 and "no reading required" are missed at second zero.
2. **After TRAIN, the mouse does nothing.** Training and the race are for watching, not
   playing. "I made that happen" rests entirely on having chosen a body, and most kids
   pick a preset.
3. **The body wins, not the kid.** A Hopper beats ROBO-PUP within 5 generations (12 s)
   in 8 runs of 8. After that the crown sits at 30–40 m (a Hopper) or 40–65 m (a lucky
   cartwheeling Walker). Doggo tops out around 19–22 m, and hand-drawn bodies mostly
   reach 5–10 m in 7 s (the best of 16 scribbles got 23 m). The rewarded skill
   is "pick the frog or the stick-man, and wait". Body design, the one creative act,
   is not rewarded.
4. **The race is hard to read.** Each lane has its own camera following its creature, so
   both are always centred and nobody can see who is ahead; only the HUD numbers tell.
   The ROBO-PUP label sits under the ⌂ button, and the hint runs across the lower lane.
5. **The crown doesn't change hands properly.** The champion is stored without a date
   (the scoreboard resets every day, the crown never), and a new champion is always
   called "CHAMP", not by the winner's initials. A developer's test run the evening
   before would be the champion on the day.
6. **The message is about evolution, not simulation.** The science line ("they learn by
   evolution … the same trial-and-error math trains real robots") and the 🧬 tile both
   say "biology". What makes this game belong in *our* arcade is that the learning
   happens inside a simulation, thousands of tries a minute, and is only as good as
   that simulation. That appears in one sentence of the delve's last chapter, and the
   group link there ("Simulating the world well enough that a computer can learn from
   it …") is vague.
7. **The best science is hidden or mislabelled.** Evolution exploiting a flaw in the
   physics is exactly what researchers fight in simulation-trained AI. Here the
   workaround sits silently in `fitness()`, `presets.ts` calls the Walker "hardest to
   train", and the zoo shows a cartwheeling Walker next to "it knew nothing about legs,
   worms or frogs".
8. **Low juice.** There is no sound of its own. Ghosts at 16 % opacity make a grey fog.
   At 1280×720 the learning-curve chart overlaps the hint and the ground, and canvas
   text at 14–22 px is hard to read from 2 m.

### What only this game can do

In every other tile the computer works out what nature does: wind, water, epidemics,
orbits, weather, balls. This is the only one where the computer **learns**, and the
only one about AI and robots, a topic parents will ask about. Its point at our stand is
not "evolution works" but:

- **Learning needs a world to practise in.** Nobody can write down how to walk. So we
  build the world in a computer and let the creature fall thousands of times, for free
  and faster than real time. Before a real robot takes one step, it has fallen
  thousands of times in a simulation. That is the one-line message with a sequel:
  *scientific computing can simulate anything, and then a computer can learn in it.*
- **A learner does exactly what you ask, and uses every flaw in your world.** Ours
  found that our muscles had no speed limit within minutes (the cartwheels, the 5 m
  worm). So the reward must say what we mean, and the simulation must be right. The
  second half is our craft, and it rhymes with Gravity Doodle's "energy out of nothing"
  chapter.
- **A creature is only as good as the world it practised in.** Measured below: trained
  on a flat floor, a Doggo gets stuck at the first bump; trained on changing bumps, it
  crosses them.

Ball Pit became the arcade's microscope and Gravity Doodle its crystal ball. This one
should become its **gym**: where the computer practises, and where kids find out that
practice is only as good as the world you practise in.

## Proposal

### The core idea, revealed layer by layer

> **Nobody knows how to program a walk. So we build a world in the computer and let the
> creature practise: an hour of falling every minute. It learns exactly what we reward —
> and if our world has a flaw, it will find it.**

| Layer | What the kid does | Idea |
|---|---|---|
| Toy | grab, fling and trip creatures that keep on walking | a creature is physics, computed live |
| Toy: 🧠 Teach it | click the flailer you like; its babies move like it | picking the best, again and again, is learning |
| Round 1 | pick the parents by hand | selection |
| Round 2 | choose what to reward | it learns what you ask, not what you mean |
| Round 3 | choose where it practises | a learner is only as good as its world |
| Delve | a map of brains; cheats and bugs; real robots; our group | search, rewards, honest simulations |

### Layer 0: toy (no reading, a result within a frame)

Replace the editor as the opening screen with a **creature park**:

- **Creatures already walking.** Today's champions (👑, with initials) and a couple of
  presets on trained brains stroll across the screen, wrapping round at the edges so
  none is lost. Their googly eyes follow the cursor, so the first wiggle of the mouse
  gets a reaction.
- **Grab and fling.** Press on any dot and the creature hangs from the cursor, legs still
  pumping; let go and it flies, tumbles, lands and (usually) scrambles on. This is the
  delve's poke promoted to the toy; in Verlet it is one point pinned to the cursor. Cap
  the throw speed; respawn anything that leaves the screen.
- **Drop in more.** The body buttons add a creature (up to ~6). ✏️ *Draw your own* opens
  today's editor as a panel, and a finished drawing drops into the park on a random
  brain, flailing, which is the cue for the next button.
- **🧠 Teach it** (on the creature you last touched) is today's training, in the park's
  style, with three changes:
  - **Click to pick.** Clicking a ghost ends the generation at once with that one as
    the parent, and its babies pop out of it. When nobody clicks, the computer picks.
  - **The practice clock**, big: "🕐 1 h 10 min of practice · 600 tries — in 70
    seconds". This single number carries the stand's message.
  - **⚡ Turbo** replaces ×10: stop drawing and run ~25 generations a second (20
    creatures × 7 s costs ~34 ms), so the clock jumps by hours and the curve shoots up.
  - ✓ *Done* puts the trained creature back in the park.
- **Juice.** Synthesized sounds: a boing on landing, a squeak on grab, a rising chirp
  for a new record, an "ooh" for each new generation. Fewer, clearer ghosts (the best
  five bright, the rest faint), bigger canvas text, and the chart in its own corner.
- **Toolbar:** the bodies, ✏️ Draw, 🧠 Teach it, 👑 Race, 🏆 Challenge.

**👑 Race** stays in free play, with three fixes:

- **One track, one camera.** The champion runs as a golden ghost, like a racing game's
  ghost car, so the lead is visible.
- **A crown per body per day:** today's fastest Doggo, Hopper, Wiggler, stick-man and
  own design, each with the holder's initials. A frog then never has to beat a dog,
  and "best own design" rewards building.
- **A fresh crown each morning:** the first race of the day is against re-trained
  built-in champions.

### Layer 1: challenge (three rounds, one idea each, one total score)

Each round takes about a minute, and the three add up to one score for `scoreFlow`, as
in the other games. The body is fixed per round, so the kid's decisions decide the
score, not the choice of a frog. All numbers here are with the **muscle cap**, which
phase A installs.

**Round 1: Pick the parents.** *Idea: picking the best, again and again, is learning.*
Six pens, each with a Doggo on a random brain. After four seconds the pens freeze and
you click the one you want as parent. It gets five babies with small mutations, plus
a copy of itself. Ten picks; score = how far the best of the last six walks.
Measured (median of 16): picking the farthest takes Doggo from 2.2 m to 4.5 m in ten
picks (the Wiggler, more visibly, from 0.9 to 4.2 m). **Picking at random learns
nothing** (Doggo 1.3 → 0.8 m): without selection, mutation only breaks things. The
round ends with the computer doing the same thing at turbo speed, its curve drawn over
yours: one pick costs ~7 ms, and 300 picks reach 7.2 m (measured before the cap).

**Round 2: Race-walk.** *Idea: it learns exactly what you reward, not what you meant.* In
race-walking one foot must always touch the ground. The Wiggler has to race-walk.
Before training you pick a reward card: 🏁 *as far as you can* or 🏁👣 *as far as you
can, with a foot on the ground*. A few seconds of turbo training follow, then the
judged race: only distance covered while touching counts, and every hop flashes a red
"🚫 flying!". You may switch cards and train once more. Measured (25 generations,
median of 8, judged over 12 s):

- Distance alone gives a worm that flies 55 % of the time and scores 10.4 m (8.1–14.3).
- Distance on the ground gives 2 % flying and 13.9 m (11.6–17.2).

The red flashes make the difference obvious; tune the scoring so the score gap is as
clear. The punchline: "it didn't know the rule, because you didn't put it in the reward."
(Before the cap, the Hopper flew 65 % of the time and showed it best; after the cap
its gap is small.)

**Round 3: Into the wild.** *Idea: a learner is only as good as the world it practised in.*
Your creature will cross bumpy ground it has never seen. You choose where it
practises: 🟫 *a flat floor* or ⛰ *bumps, new ones every generation*. Practice looks
better on the flat floor (it walks farther there), and that is the trap. Then the test:
12 s across an unseen course. Measured (30 generations; median over 20 unseen courses
with 0.2 m bumps):

| Body | Trained on flat: on flat / on course | Trained on bumps: on flat / on course |
|---|---|---|
| Doggo | 18.9 m / **0.7 m**, stuck at the first bump | 10.1 m / **4.2 m** |
| Wiggler | 19.4 m / **1.7 m** | 18.0 m / **15.3 m** |

Doggo gives the funnier failure, the Wiggler the bigger numbers; pick after a look.
Real link: robots are trained in thousands of varied simulated worlds, so that the
real one is just one more.

This round needs terrain in the physics: a ground height g(x), with points pushed up
to it as they are pushed up to the flat floor now. The spike used Gaussian bumps
0.25–0.85 m wide and up to 0.2 m high, every 0.8–2.4 m, and nothing misbehaved.

### Layer 2: in-play reveals

- **🕐 The practice clock** (above), always on while teaching, and after a run: "a real
  robot would have needed 1 h 10 min — and new knees".
- **🧠 Brain lens.** The delve's coloured waves under whichever creature you click in the
  park: one beat, and two numbers per muscle (strength and timing), is the whole brain.
- **Family lines.** When you pick a parent, lines from it to its babies for a second.
- **🎯 Reward cards in free play** (phase B): round 2's cards as a toy on 🧠 Teach it:
  🏁 far, 👣 on the ground, 🦘 high, ⬅️ backwards. The population re-adapts within a few
  generations, and kids breed jumpers and backward walkers. Measured: height and
  backwards rewards both learn on every preset.

### Layer 3: delve, one arc from dots to our group

Six chapters in the shared panel. Chapters 1 and 2 carry over, 3 is rewritten, 4–6 are
new (today's chapter 4 becomes part of 6).

1. **A creature is dots and springs.** As now, with the toy's grab-and-fling in place of
   the poke.
2. **The brain is a rhythm.** As now, plus the count ("Doggo's whole brain is 9
   numbers") and a 🤏 *nudge one number by a hair* button that sometimes makes the
   champion trip (chaos, measured above).
3. **Learning is searching a landscape.** The mini evolution, plus a map. Give the brain
   only two free numbers and colour every pair by how far it walks. The computer paints
   the map live (64 × 64 brains take ~8 s on one core, so paint it row by row). It
   shows smooth hills (reliable gaits) beside patches of TV static (chaos: a tiny change
   decides walk or faceplant). Then six dots climb the hills without seeing the map:
   "training an AI is the same climb, with millions of numbers instead of two."
4. **It does exactly what you reward.** The race-walk lab: a switch between the two
   rewards on a live population, and the hops appear or vanish. Real examples: a
   boat-racing AI that learned to circle for points instead of finishing (OpenAI,
   2016), and DeepMind's collection of "specification gaming" cases. *(Verify.)*
5. **It finds every flaw in the world.** Before we fixed them, our muscles had no speed
   limit, and evolution found out within minutes: the stick-man cartwheeled and a 1.4 m
   worm leapt 5 m, its head at ~100 km/h. A 🐞 *old muscles* switch brings both back.
   Then the flat-versus-bumps demo from round 3. The point: "a learner is the toughest
   tester a simulation can have. If the physics is wrong, the robot learns the wrong
   thing, so the simulation has to be right. Making it right is our craft." Add
   buttons into Gravity Doodle's energy chapter (the same kind of flaw) and Swirl Lab.
   The classic anthology: Lehman et al., *The Surprising Creativity of Digital
   Evolution* (2020), including Karl Sims' creatures (1994). *(Verify.)*
6. **Robots go to school in simulations.** Legged robots now learn to walk in simulation
   first, thousands of copies at once on one graphics card, then move to real legs
   (e.g. ETH Zürich's ANYmal, Rudin et al. 2021: minutes of computer time; *verify*). They use
   neural networks and reinforcement learning, not sine waves and evolution: a close
   cousin of what you watched, not "exactly like this". Then our group: *we put
   learning inside simulations too, for turbulence rather than robots. A small neural
   network learns to correct a cheap, coarse flow simulation so that it behaves like
   an expensive fine one, trained, like these creatures, on what the whole simulation
   does.* *(Agree the wording.)* Keep the zoo, re-trained.

### Science lines

- **Tile / title card:** "Nobody can program a walk. So these creatures practise in a
  simulated world — an hour of falling every minute — and keep what works. Real robots
  learn to walk in simulations first, too."
- **Stand talking point:** "Before a robot takes one real step, it has fallen thousands
  of times in a simulation. That simulation has to be right: if it has a flaw, the
  learner will find it. Ours did — ask about the flying worm. Making simulations fast
  and trustworthy, and putting learning inside them, is our group's work." *(Agree the
  wording.)*
- **Title and tile.** 🧬 reads as biology. Consider 🦿 and a title with the verb in it
  (the working name "Learn to walk" / "Leer lopen" does that). Keep the id `creature`
  so `?games=` and today's scores keep working.

### Physics and robustness

- **Muscle speed cap:** limit each muscle's correction per iteration (2.4 m/s above),
  then **re-train every stored brain** (`TRAINED`, ROBO-PUP), because gaits are chaotic
  and the old ones break. Keep the old muscles behind the delve's 🐞 switch. Re-check
  `fitness()`'s flying discount afterwards; it may no longer be needed.
- **Terrain:** a ground height g(x) for round 3 and the delve; the park stays flat.
- **Crowns:** key them by date like the scoreboard, one per body, with initials.
- **Grab:** pin one point to the cursor and clamp the release speed. Respawn anything
  off screen or non-finite; none appeared in the tests, but the kiosk shouldn't rely
  on that.
- **Idle:** with `?idle`, a kid watching training without touching the mouse is sent to
  the menu after 90 s. Count training as activity, or keep teaching sessions shorter.
- **Cost:** ~2 µs per creature per step; the park (≤ 6 creatures), six pens and turbo
  all fit easily in a frame.
- **The stick-man stays, honestly named.** Even with feet, a biped on a sine-wave brain
  cannot stand. After the cap it learns to scoot along the floor. Don't call it
  "Walker" and promise a walk; its failure to stand is the hook for phase C.

## Phases

**A: meets the goals (≈ 2 days).**

- The creature park as the opening screen: walking creatures, grab and fling, eyes
  that follow the cursor, wrap-round edges.
- 🧠 Teach it with click-to-pick, the practice clock and turbo.
- The muscle cap and re-trained brains.
- The race on one track with a ghost, and crowns per body, per day, with initials.
- Sound, the new science line, the layout fixes.

**B: depth (≈ 2 days).**

- The three rounds with `scoreFlow` (round 3 needs terrain), each after a short
  tuning pass.
- Reward cards in free play; the brain lens and family lines.
- Delve chapters 3–6, with the landscape and the 🐞 switch.
- Everything in en/nl/no.

**C: after the event.**

- **Brains that feel:** sensors (foot contact, body tilt) feeding a tiny neural network
  instead of pure sine waves, so the stick-man might learn to balance. It is the step
  from this toy to what robots actually use.
- A computer coach that plays the three rounds.
- Body design as a scored challenge, e.g. "build a body that crosses bumps without
  bump practice". The worm results suggest that is possible.

**If A doesn't fit before 3 October: A-lite (≈ half a day).**

- Open on a live, trained creature you can grab and fling, instead of the static
  editor.
- The muscle cap and re-trained brains; the Walker renamed.
- The crown per day, with initials, raced on one camera.
- The practice clock and the new science line.

That fixes the first seconds and the unfair crown, and puts the simulation message on
screen.

## Smaller issues noticed

- A click on empty space in the editor adds a loose dot, and loose dots count in the
  measured distance.
- The draw tool makes every new stick a muscle; bones need a second tool. There is no
  undo or clear.
- In training, the highlighted leader is the farthest creature, while "best walk" and
  the brain that races are chosen by fitness (distance discounted for flying). They
  can differ.
- A lost race also posts to the board, which shows distance × 100 without a unit.
- The delve's last chapter says real robots learn to walk "exactly like this",
  and that four-legged inspection robots learned their gaits "this way". They used
  reinforcement learning with neural networks. The NASA antenna and medicine claims
  are right in spirit but should be checked before the day.
- The zoo's trained Walker cartwheels; `presets.ts` calls the Walker "hardest to train",
  but it is the easiest to score with.
