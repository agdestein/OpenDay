# Outbreak! remake: plan

Outbreak! was the quickest game to build and it shows. This note records what
was wrong with it, what the remake changes, and in which order. Sections marked
*(first batch)* are being built before the 3 October event; the rest comes later.

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

## The model *(first batch)*

An agent-based **SIRD** model with ages and a hospital. One simulated second is
one day.

- **Three ages in mixed households.** Kids go to school, parents go to the
  market, grandparents mostly stay home and sometimes shop. Nobody scripts it,
  but the classic pattern appears: kids spread, grandparents die.
- **Where infection happens.** Proximity-based, with a per-setting weight:
  indoors (homes, school, market) counts fully, passing someone on the street
  counts for little. Soap at a venue damps it there.
- **Serious illness and the hospital.** Each infection is serious with an
  age-dependent chance. Serious cases go to hospital if a bed is free and stop
  infecting others there. If the hospital is full they wait at home, sick and
  still contagious, and their chance of dying rises with every day they spend
  without a bed. At the end of the illness a serious case recovers or dies;
  mild cases always recover. So deaths depend on the *peak*, not only on how
  many get sick — flattening the curve pays off inside the game.
- **Honest exaggeration.** Death rates are far above real flu so a 500-person
  town can show anything at all. The explainer says so.
- **Seeded random numbers and cloning,** so the game can rerun the same town
  from the same moment (the "without you" futures) and tests are repeatable.
- **Who infected whom** is recorded, so R can be measured from the city itself.

## The challenge *(first batch)*

Three rounds, each a different fictional disease with a realistic profile.
The score is **lives saved**: deaths in the do-nothing futures minus deaths in
the player's town.

1. **Winter flu** — moderately contagious, serious mainly for grandparents.
2. **Racing fever** — very contagious, spreads through the school.
3. **Unknown virus** — serious for everyone; no vaccine until it is developed.

Tools:

- **💉 Vaccine batches**, one button per group: grandparents, parents, kids.
  A batch protects a fixed number of people in that group. Batches can arrive
  later in the round. Choosing whom to protect directly (grandparents) or whom to
  stop spreading it (kids) is a real vaccination-strategy question.
- **🏫 Closing the school** is a toggle that uses up a limited number of
  closure days, then the school reopens by itself. Timing matters.
- Soap stays in free play only; in the challenge it was a free, always-correct
  click.

While the round's intro card is up, the computer simulates the same town
several times with nobody intervening. The end card shows
"Without you: ~31 deaths (22–40). With you: 9 — you saved ~22 lives", with
your curve drawn over the do-nothing curves and the hospital line.

## Free play *(first batch)*

Click to start an outbreak; vaccinate, soap and close the school freely.
Nobody dies by default: serious cases still go to hospital, but everyone
recovers. Add `?deaths` to the URL to make free play use the full model.

## Look *(first batch)*

- The city on the left; on the right a dashboard like a health agency's:
  day, counts, the stacked S/I/R/D curve, and the hospital-beds chart with the
  capacity line.
- States by brightness and shape, not only hue. A person who has died stays
  at home as a still, dim grey dot. Grandparents are marked with a pale ring,
  kids are smaller.
- Tone: "died" / "overleden", plainly. No skulls, ghosts, jokes or sound on
  deaths; the audience starts at four years old.

## Explainer *(first batch)*

Chapters: every dot is a person (now SIRD) → the tiny city (ages, hospital)
→ R₀, measured from this city → flatten the curve (SIRD equations with
hospital capacity) → many possible futures (the do-nothing ensemble) → where
this is used for real, and what this model leaves out.

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
