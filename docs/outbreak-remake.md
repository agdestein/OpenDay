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

An agent-based **SIRD** model with ages, a hospital and hidden infections. One
simulated second is one day.

- **Three ages in mixed households.** 500 people in 80 houses of about six
  (30 % kids, 50 % parents, 20 % grandparents). Kids go to school, parents
  and grandparents to the market; grandparents go out far less often. The town
  starts mid-routine (some people already out), not with everyone at home.
- **Where infection happens.** Proximity-based, weighted by setting (`WEIGHTS`
  in `sim.ts`): school 2, home 0.5, market 0.35, street 0.12. About a third of
  infections happen at home, a quarter each at school and market, and roughly a
  tenth on the street. Soap at a venue damps it there.
- **Closed venues keep the rhythm.** Someone who finds their venue closed skips
  the outing but waits as long as the outing would have taken, so reopening does
  not send the whole town out at once. (Without this, forecasts showed a false
  rebound after every closure.)
- **Hidden infections.** A new case is contagious for 1–3 days (per disease)
  before it shows. In the challenge those cases look healthy and cannot be
  isolated; free play marks them with a dashed red ring.
- **Isolation.** An isolated sick person stays home until better and infects
  their household at 30 % strength.
- **Serious illness and the hospital.** Each infection is serious with an
  age-dependent chance; it worsens after 30 % of the illness (never while still
  hidden). Serious cases go to hospital (8 beds) if a bed is free and stop
  infecting others there. If the hospital is full they wait at home, sick and
  still contagious, and their chance of dying rises with every day they spend
  without a bed. Mild cases always recover. So deaths depend on the *peak*, not
  only on how many get sick — flattening the curve pays off inside the game.
- **Honest exaggeration.** Death rates are far above real flu so a 500-person
  town can show anything at all. The explainer says so.
- **Seeded random numbers and cloning,** so the game can rerun the same town
  from the same moment and tests are repeatable.
- **Who infected whom** is recorded. The explainer's R₀ lab measures R₀ from
  40 single-case experiments per setting (R₀ is far from proportional to
  β × days sick, because household contacts saturate). The dashboard shows a
  live R: people infected per recent case (caught 2–10 days ago), with those
  still sick weighted by how far into their illness they are — lagged, like
  every real R estimate.

## The challenge *(built)*

Three rounds (`rounds.ts`), each a different fictional disease with its own
lesson. Three sick travellers arrive on day 3 and one more every 6 days, so an
early lockdown can delay the epidemic but not end it. A round lasts 80–90 days
(one day per second; quiet spells run three times faster). The score is **lives
saved**: the mean deaths of 8 do-nothing futures minus deaths in the player's
town, summed over rounds (a round never scores below zero). The dashboard shows
only known cases.

Calibration (`npm run test:outbreak`, mean deaths over 24 seeds):

| Round | Lesson | Nothing | Vaccinate grandparents | Isolate | Close at 10 / 40 / 90 sick | Vaccinate + close early / late |
|---|---|---|---|---|---|---|
| Winter flu | protect the vulnerable | 7.7 | 2.4 | 4.1 | 8.5 / 7.5 / — | — |
| Racing fever | close before the wave is big | 11.6 | 7.0 | 9.0 | 8.8 / 6.8 / 9.9 | — |
| Unknown virus | buy time for the vaccine | 26.8 | 17.5 | 18.6 | 24.5 / 19.7 / — | 5.4 / 12.5 |

Closing barely helps against the flu: households keep spreading it and a short
closure mostly delays the wave. The game does not hide that; the forecast shows
it. Vaccinating kids instead of grandparents was tried as a herd-immunity
lesson, even with kids as the main spreaders; direct protection always won, as
it did for COVID-19.

Tools:

- **💉 Vaccine batches** of 40 doses, one button per group: grandparents,
  parents, kids. Flu: one now, one on day 20. Fever: one now. Unknown virus:
  two on day 25. Doses only go to people who have not had it.
- **🏠 Isolate:** click a visibly sick person. One test a day, at most three
  saved up.
- **🏫 School and 🛒 market** can each be closed and reopened. Both draw on one
  budget of closure days (flu 24, fever 60, unknown 30; two a day with both
  closed); when it runs out, everything reopens.
- **🔮 Forecast** pauses the round and runs 8 futures of the next 30 days as
  things are, against 8 with the school and market closed now (or reopened, if
  something is closed). The card draws both bundles of curves after the town's
  own curve and lists, per scenario, how many more people get sick and die.
  For the unknown virus every future draws its own contagiousness and
  seriousness (log-normal, spread 0.45/√(1 + cases seen/15)), so the forecast
  is wide early and narrows as the epidemic reveals the virus. The forecast
  knows about hidden cases; real modellers have to estimate them.
- Soap stays in free play only; in the challenge it was a free, always-correct
  click.

While the round's intro card is up, the computer simulates the same town
8 times with nobody intervening (about 5 ms per frame, done in ~2 s). The end
card shows "Without you: about 14 people died (7–23 in 8 simulated futures).
With you: 5 died", the player's sick curve over the do-nothing curves, and the
round's tip.

## Free play *(built)*

Click to start an outbreak; vaccinate a district, put soap at a venue, isolate
the sick, close the school or market freely. Nobody dies by default: serious
cases still go to hospital, but everyone recovers. Add `?deaths` to the URL to
make free play use the full model. When an outbreak dies out by chance, a hint
says so.

## Look *(built)*

- The city on the left; on the right a dashboard like a health agency's:
  day, live R, counts, the stacked S/I/R/D curve, and the hospital-beds chart
  with the capacity line.
- States by brightness and shape, not only hue. A person who has died stays
  at home as a still, dim grey dot. Grandparents are marked with a pale ring,
  kids are smaller, isolated people have a white box, hidden cases (free play)
  a dashed red ring.
- Tone: "died" / "overleden", plainly. No skulls, ghosts, jokes or sound on
  deaths; the audience starts at four years old.

## Explainer *(built)*

Chapters: every dot is a person (SIRD, with live counts) → the tiny town
(live and clickable; hidden spread) → R₀, measured by experiment, with sliders
wired into the town, and the live R → flatten the curve (SIRD equations with a
hospital-dependent death chance, two ODE scenarios) → many possible futures
(8 runs of the live town; the forecast button and parameter uncertainty) →
where this is used for real, and what this model leaves out.

## Not done

- **A day/night rhythm.** At one day per second a day/night cycle would
  flicker every second; slowing the clock enough to show it would stretch a
  round to several minutes. Dropped.

## Validation

`npm run test:outbreak` runs headless sweeps and checks: reproducibility from a
seed; that clones diverge; hidden cases exist and cannot be isolated; tests are
capped; a cloned round keeps its budgets; closing mid-flu lowers the forecast
peak; free play without deaths uses the hospital but nobody dies; do-nothing
deaths per round; that vaccinating and isolating help in every round and
closing helps against the fever and the unknown virus; and each round's tip.
