# Outbreak! remake

Outbreak! was the quickest game to build and it shows. This note records what
was wrong with it, what the remake changed, and what comes next. Sections
marked *(built)* describe the game as it is; **Later** is still plan.

## Why a remake

Headless sweeps of the original game (40 runs per setting, 500 agents):

- **The challenge was decided in the first second.** Patient zero appeared at a
  random spot 1.5 s into the round. The best play was to spend every tool before
  then, blind. Tools cost nothing, so the school was always closed. After ~4
  clicks there was nothing left to decide.
- **The epidemic was too fast to react to.** Peak at ~16 s with 40–66 % of the
  town sick at once, all over by ~40 s.
- **The score was bookkeeping and luck.** "Saved" = still susceptible, which
  counted the ~187 people vaccinated by the two clicks themselves and counted
  recovered people as not saved. In 10–25 % of well-played rounds the disease
  died out by chance, swinging the score.
- **Closing the school did almost nothing** (default rate: do nothing 158
  saved, school only 152; all tools 400 with the school closed vs 394 with it
  open), because only 10–20 % of infections happened at school while 19–35 %
  happened *walking on the street*.
- **No stakes.** Pure SIR: nobody died, nobody got seriously ill, no ages, no
  hospital. The explainer said "flatten the curve" but flattening gave no
  benefit in the game; the hospital-capacity line was decoration.
- **The explainer was disconnected from the game.** The R₀ tree used
  "β × time sick", which is not what the city does; the ODE curves were fixed;
  the player never saw what their actions changed.
- Healthy and recovered dots were too alike at 2 m; vaccinated green next to
  infected red failed for colour-blind visitors.

## The model *(built)*

An agent-based **SIRD** model with ages and a hospital. One simulated second is
one day.

- **Three ages in mixed households.** 500 people in 80 houses of about six
  (30 % kids, 50 % parents, 20 % grandparents). Kids go to school, parents
  and grandparents to the market; grandparents go out far less often.
- **Where infection happens.** Proximity-based, weighted by setting (`WEIGHTS`
  in `sim.ts`): school 2, home 0.5, market 0.35, street 0.12. With these, about
  a third of infections happen at home, a third at school, a quarter at the
  market and a few percent on the street, so closing a venue matters. Soap at a
  venue damps it there.
- **Serious illness and the hospital.** Each infection is serious with an
  age-dependent chance; it worsens after 30 % of the illness. Serious cases go
  to hospital (8 beds) if a bed is free and stop infecting others there. If the hospital is full they wait at home, sick and
  still contagious, and their chance of dying rises with every day they spend
  without a bed. At the end of the illness a serious case recovers or dies;
  mild cases always recover. So deaths depend on the *peak*, not only on how
  many get sick — flattening the curve pays off inside the game.
- **Honest exaggeration.** Death rates are far above real flu so a 500-person
  town can show anything at all. The explainer says so.
- **Seeded random numbers and cloning,** so the game can rerun the same town
  from the same moment (the "without you" futures) and tests are repeatable.
- **Who infected whom** is recorded, so R can be measured from the city itself.
  The explainer's R₀ lab does exactly that (40 single-case experiments per
  setting); R₀ is far from proportional to β × days sick, because household
  contacts saturate.

## The challenge *(built)*

Three rounds (`rounds.ts`), each a different fictional disease with its own
lesson. Three sick travellers arrive on day 3 and one more every 6 days, so an
early lockdown can delay the epidemic but not end it. A round lasts 80–90 days
(one day per second; quiet spells run three times faster). The score is **lives
saved**: the mean deaths of 8 do-nothing futures minus deaths in the player's
town, summed over rounds (a round never scores below zero).

Calibration (`npm run test:outbreak`, mean deaths over 16 seeds):

| Round | Lesson | Nothing | Vaccinate grandparents | Close at 10 sick | Close at 40 sick | Vaccinate + close early |
|---|---|---|---|---|---|---|
| Winter flu | protect the vulnerable | 13 | 4.6 | 6.9 | 8.2 | — |
| Racing fever | flatten the curve: timing | 16 | 10.4 | 10.4 | 7.3 | — |
| Unknown virus | buy time for the vaccine | 26 | 22 | 17 | 18.5 | 4.8 |

Vaccinating kids instead of grandparents was tried as a herd-immunity lesson,
even with kids as the main spreaders; direct protection always won, as it did
for COVID-19. The game does not pretend otherwise.

Tools:

- **💉 Vaccine batches** of 40 doses, one button per group: grandparents,
  parents, kids. Flu: one now, one on day 20. Fever: one now. Unknown virus:
  two on day 25. Doses only go to people who have not had it.
- **🏫 School and 🛒 market** can each be closed and reopened. Both draw on one
  budget of closure days (24 or 30; two a day with both closed); when it runs
  out, everything reopens.
- Soap stays in free play only; in the challenge it was a free, always-correct
  click.

While the round's intro card is up, the computer simulates the same town
8 times with nobody intervening (about 5 ms per frame, done in ~2 s). The end
card shows "Without you: about 14 people died (7–23 in 8 simulated futures).
With you: 5 died", the player's sick curve over the do-nothing curves, and the
round's tip.

## Free play *(built)*

Click to start an outbreak; vaccinate a district, put soap at a venue, close
the school or market freely. Nobody dies by default: serious cases still go to
hospital, but everyone recovers. Add `?deaths` to the URL to make free play use
the full model. When an outbreak dies out by chance, a hint says so.

## Look *(built)*

- The city on the left; on the right a dashboard like a health agency's:
  day, counts, the stacked S/I/R/D curve, and the hospital-beds chart with the
  capacity line.
- States by brightness and shape, not only hue. A person who has died stays
  at home as a still, dim grey dot. Grandparents are marked with a pale ring,
  kids are smaller.
- Tone: "died" / "overleden", plainly. No skulls, ghosts, jokes or sound on
  deaths; the audience starts at four years old.

## Explainer *(built)*

Chapters: every dot is a person (SIRD, with live counts) → the tiny town
(live and clickable) → R₀, measured by experiment, with sliders wired into
the town → flatten the curve (SIRD equations with a hospital-dependent death
chance, two ODE scenarios) → many possible futures (8 runs of the live town,
from now or from a fresh start) → where this is used for real, and what this
model leaves out.

## Later

In rough priority order:

1. **🏠 Isolate:** click a sick person to send them home; a cooldown stands
   for testing capacity. Works early, fails once growth takes off.
2. **Live R** in the dashboard, from the recorded infection tree.
3. **🔮 Ask the model:** clone the current city and run ~10 futures over a
   few frames ("…and if the school closes now?"). Same machinery as the
   do-nothing ensemble.
4. **Hidden infections:** cases only show once symptomatic; an unknown-
   parameter round.
5. A day/night rhythm.

## Validation

`npm run test:outbreak` runs headless sweeps and checks the calibration:
deaths per round without intervention, that each tool helps, that closing the
school matters, and that runs are reproducible from a seed.
