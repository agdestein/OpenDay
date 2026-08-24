# Game ideas catalog

The candidate games for the arcade. Each entry lists the instant hook (what happens in
the first 30 seconds), the optional depth (what keeps a kid for 15 minutes), the
science message (the one sentence for parents), and a rough effort estimate.

Simulations only need to *look* right (video-game fidelity), not be right.

Status legend: **planned** (in the current implementation plan), **candidate** (write
later if time permits), **stretch** (nice-to-have / hardware-dependent).

---

## 1. Fluid playground / Wind farm challenge — **planned**

Real-time 2D fluid simulation (stable fluids or lattice-Boltzmann on the GPU).

- **Hook:** stir colorful smoke/dye with the mouse; it swirls instantly. Drop obstacles
  and watch vortex streets form.
- **Depth (game mode):** wind blows across the domain; place up to N turbines. Turbines
  produce power from the local wind speed but cast turbulent wakes that starve turbines
  downstream. Live power meter + daily high-score board. "Let the AI try" button runs a
  simple optimizer for comparison.
- **Science line:** "Turbine wakes lose wind farms real money — simulating turbulence
  to fight this is our group's daily work."
- **Effort:** medium-high (the WebGL solver is well-trodden territory; the game layer
  is the work). Highest priority: it is our group's core identity and doubles as the
  attract-mode eye candy for the whole stand.

## 2. Outbreak! (epidemic simulator) — **planned**

Agent-based SIR-style simulation: hundreds of dots living in a mini-city (homes,
school, market), commuting and mingling.

- **Hook:** click a dot to infect it; watch the outbreak bloom through the city in
  seconds. Color-coded healthy/infected/recovered, live curve plot growing at the
  bottom of the screen ("flatten the curve" emerges by itself).
- **Depth (game mode):** limited action budget — vaccinate a neighborhood, close the
  school, add a hand-washing station — then score = people saved. Multiple rounds with
  faster diseases.
- **Science line:** "Our group has worked on simulating real epidemic spread — models
  like this (much bigger) inform actual health policy."
- **Effort:** low-medium (plain canvas, simple agents). Great effort-to-impact ratio
  and a true "our group did this" story.

## 3. Save the Netherlands (dike builder) — **planned**

Shallow-water equations on a stylized map of the Dutch coast.

- **Hook:** a storm surge rolls in; water floods the polders. Draw dikes with the mouse
  and the water piles up against them immediately.
- **Depth (game mode):** limited sand budget, escalating storms, score = dry land ×
  people protected. Real place names make it personal ("protect grandma in Zeeland").
- **Science line:** "After the 1953 flood, CWI's predecessor helped compute the storm
  surges behind the Delta Works." *(Verify wording before use.)*
- **Effort:** medium (height-field shallow-water solver is simple and stable; needs map
  art). The strongest story hook of the list, very Dutch.

## 4. Train a creature to walk (reinforcement learning) — **candidate**

2D physics ragdoll + neuroevolution or simple policy search, learning live.

- **Hook:** the creature flails hilariously. Failure is the entertainment.
- **Depth:** kids design the body (leg lengths, joints, tail), hit "train", and watch
  generations improve from flopping to hobbling to running; race your creature against
  the previous kid's champion.
- **Science line:** "Nobody programmed it to walk — it learned. This is how scientific
  AI works."
- **Effort:** medium (2D physics engine off-the-shelf; evolution loop is easy; tuning
  "learns visibly within ~2 minutes" is the real work). The cleanest AI message.

## 5. Butterfly effect (chaos twins) — **candidate**

Two identical simulations side by side (double pendulum swarm, or reuse the fluid
solver from game 1).

- **Hook:** poke one of the twins ever so slightly; watch identical worlds drift apart
  and become completely different within 30 seconds.
- **Depth:** limited — this is a short-loop demo, ideal for the 30-second crowd and as
  a conversation starter about why weather forecasts stop at ~10 days.
- **Science line:** "Tiny uncertainty grows — that's why we compute *ensembles* of
  forecasts, not just one."
- **Effort:** low if it reuses the fluid solver; trivially low as a double-pendulum
  swarm. Cheap filler with a genuinely deep message.

## 6. Gravity sandbox — **candidate**

N-body toy: fling planets around a sun with drag-and-release.

- **Hook:** orbits, collisions, slingshots, trails. Endlessly replayable.
- **Depth:** mission mode — reach Mars with the fewest fuel clicks (gravity assists!).
- **Science line:** "Same tool, different equations: this is how space agencies plan
  real trajectories."
- **Effort:** low. Proven kid-pleaser; weakest link to our group specifically, which is
  fine — it stretches the "we simulate anything" claim.

## 7. AI-enhance turbulence (super-resolution) — **stretch**

Split screen: coarse blocky simulation vs. the same flow sharpened live by a small
neural network; "which one is the real high-resolution sim?" guessing game.

- **Science line:** the most faithful to our actual research (closure modeling /
  scientific ML), but the thinnest interaction — best as a second panel inside game 1,
  not a standalone game.
- **Effort:** high (needs a trained model exported to the browser).

## 8. Webcam in the flow — **stretch**

The kid's silhouette (webcam) becomes an obstacle in the live fluid simulation — wave
your arms, shed vortices.

- Zero instructions needed; the strongest pure crowd-puller. Composes with game 1
  (same solver, extra input). Needs a webcam and decent lighting at the stand; build
  only after game 1 is solid.
- **Effort:** medium on top of game 1 (background subtraction or simple motion mask).

---

## How these cover the field

| Game | Domain shown | Method shown |
|---|---|---|
| Wind farm | energy / engineering | PDEs, turbulence, optimization |
| Outbreak! | health / policy | agent-based models, stochastics |
| Save the NL | climate / water safety | PDEs (shallow water), history of Dutch computing |
| Creature walk | robotics / AI | reinforcement learning |
| Butterfly effect | weather / forecasting | chaos, uncertainty quantification |
| Gravity sandbox | astronomy / space | ODEs, numerical integration |

Three planned games already span energy, health, and climate with three different
mathematical methods — the "we can simulate anything" message in miniature. Each later
addition widens the spread.
