# The arcade as a whole: assessment and proposal

An assessment of the whole arcade as it was on 28 September 2026 (Monday; the event is
Saturday 3 October) against [message.md](message.md). The earlier assessments looked
at one game each. This one looks at what a visitor meets when moving between games and
machines: the menu, the shared controls, the pacing, the science thread, the Dutch,
and whether the stand survives a day unattended.

It is based on playing every game headlessly at 1920×1080 and at 1366×768 in Dutch,
code reading, and four parallel reviews:
- controls and UI;
- science, teaching and Dutch;
- kiosk robustness;
- mechanics and fun.

Those reviews measured with scratch scripts that are not committed: memory over 300
menu visits, frame cost per game, the games' own scoring code, and the delve chapters'
fit per screen size. Numbers from those scripts are marked *(measured)*.

One fact from the programme form (`2026-wetenschapsdag-CWI-scientific-computing.docx`)
changes the priorities:
- **The stand has one big screen for the "main game", watched by the queue, plus 2–3
  laptops.**
- Laptops mean 1366×768 or 1536×864 (1920×1080 at 125 % scaling) is likely.
- The form also promises a **poster with a QR code** to the game.

## Verdict

The games are the strong part. Each has a real simulation, a hook that works without
reading, a shared explainer (the "delve") with live demos, and a multi-round challenge.
Seven different games, all visibly simulations, deliver "scientific computing can
simulate anything" better than the original five-game plan would have.

The weak parts sit between and around the games:

1. **The stand would probably not survive the day.**
   - The menu leaks a full-screen canvas on every visit *(measured: 1.6 → 3.5 GB after
     300 menu visits)*.
   - One exception in any frame freezes that game for good.
   - Right-click opens the browser menu, including "Inspect".
   - Idle reset is off.
   - The planned kiosk launch script, staff reset and attract mode were never built.
2. **The front door does not sell the games or the message.**
   - From two metres the menu shows seven emoji and seven names. The tile text is
     12.8 px, 5–8 lines of science per tile, and useless to a child.
   - The one-line message, the group, today's records and the QR code are not on
     screen.
   - At 1366×768 the second row of tiles runs off the bottom.
3. **The shared frame around each game is inconsistent** (the question that prompted
   this review; see section 3).
   - The ⌂ button, the 🔬 pill, the title card and the score board are consistent.
   - The bottom toolbar is not: six kinds of button all look identical, the challenge
     button has five names and icons, and there are three ways to leave a challenge.
   - Button labels are 11 px.
4. **Challenges are long and uneven for a stand.**
   - Seeing every challenge takes about 27 minutes.
   - Some rounds are mostly luck or a known two-way choice, and in some rounds doing
     nothing scores well.
5. **Some science text needs fixing before an official CWI event.** One claim the
   team's own notes call unconfirmed is still on the menu's about page.

Sections 1–6 below are ordered by what to do first. Section 7 is a day-by-day plan
for this week, and section 8 lists what should wait until after Saturday.

---

## 1. Stand-breaking: fix before anything else (≈ ½ day, all in the shell)

The games themselves are clean. Over 35 game switches, DOM nodes, listeners, canvases
and WebGL contexts stayed flat *(measured)*. The problems are in the shell:

| # | Problem | Fix | Effort |
|---|---|---|---|
| 1 | **Menu leak.** `soundButton` subscribes to mute changes, and the subscription only removes itself on the next mute toggle (`shell/hud.ts:62`). Every menu render keeps the old menu alive, with its full-screen background canvas. `Esc` on the menu re-renders it (`shell/shell.ts:27`). *(Measured: 1 → 301 live canvases, 1.6 → 3.5 GB after 300 renders; toggling mute frees it all.)* | Return a dispose from `soundButton` and call it in the menu's dispose; shrink the background canvas to 0×0 there; make `Esc` do nothing on the menu. | 15 min |
| 2 | **One throw freezes a game.** `instance.frame(dt)` is unguarded (`shell.ts:100`). The idle check runs inside that same loop, so it dies too *(verified with an injected throw)*. A throwing `destroy()` breaks `setScreen`, and then `Esc` stops working. | try/catch around `frame`, with back to the menu after 3 errors; window `error`/`unhandledrejection` handlers; try/finally in `setScreen`. | 30 min |
| 3 | **GPU reset.** There is no `webglcontextlost` handler; Swirl Lab stays black *(verified)*. | Listen on the game canvas and go back to the menu (ignore the loss that `destroy` itself causes). | 15 min |
| 4 | **Browser escape hatches.** Right-click opens the browser menu in 5 games; Ctrl+wheel and Ctrl± zoom persist in the profile for the rest of the day. | Block `contextmenu` on the game screen, Ctrl+wheel and Ctrl+±/0 in the shell. | 10 min |
| 5 | **Idle reset** is off by default and lives in the game loop, so it never fires on the menu or title card, or after a freeze. | A shell timer independent of the game. At the stand, `?idle=180`, with a 10 s "Still playing? 👆" countdown before resetting. The reset reloads the page, which clears any stuck state and restores the machine's language and sound (a kid's 🇳🇴 or 🔇 currently sticks for every later visitor). | 45 min |
| 6 | **Kiosk launch.** There is no `npm run kiosk` or script (planned in plan.md). `file://` does not work (module scripts). | `kiosk.sh` + `kiosk.bat`: serve `dist` locally, open Chromium `--kiosk` with a persistent profile (not incognito, because scores live in localStorage) and the flags from the robustness review, relaunching in a loop. Add a README section. | 1 h |
| 7 | **Scores.** Staff test runs on Saturday morning land on the day's board, and nothing clears it short of DevTools. Any three letters are accepted, on a board parents read from two metres. | `?reset-scores` (or Ctrl+Shift+Backspace) clears today's boards. A blocklist of about 25 initials (KUT, LUL, PIK, SEX, FUK, NSB, KKK, SS…, CPU…). | 30 min |
| 8 | **Sleep and scaling.** Borrowed laptops may dim or lock the screen. `cappedDpr` = min(dpr, 2) renders a 4K big screen at 3840×2160 in every game. | Screen Wake Lock on first click; cap the canvas by pixel count (~2 MP) with a `?dpr=` override. | 25 min |
| 9 | **Flaky test.** `npm run test:bounce` failed 1 run in 6 (unseeded `Math.random`). The failure is real game behaviour: in the Silo round, knocking sometimes scores lower than not knocking. | Seed the test; see §4 for the round itself. | 30 min |

Also: `Esc` during initials entry leaves without saving the score (`scoreflow.ts:173`).
Consume it there.

Flag emoji do not render on Windows, so the language buttons would show "GB NL NO".
That is harmless, but if the laptops run Windows, pinning `?lang=nl` and hiding the
switcher (a new `?langs=off`) is cleaner.

## 2. The front door and the message (≈ ½ day)

The menu is the most-seen screen of the day and the big screen is seen by the whole
queue, but neither says what the stand is about. `message.md` asks for "big visuals,
readable from two meters", "Today's record: Emma, 4.2 MW", and one science sentence
*per game*, ignorable by kids. The menu currently does the reverse: small visuals and
a lot of science text.

- **Tiles: a picture and a verb.** Replace the tile's science line with a hook of eight
  words or fewer at ~1.1 rem, saying what you *do*. The science line stays on the title
  card, where it is actually read. The programme blurb already has the verbs:
  - 🌀 *Roer in de wind, bouw een windpark*
  - 🦠 *Stop een epidemie in een mini-stad*
  - 🌊 *Houd de zee tegen met zand*
  - 🌡️ *Vind de warmste plek van Nederland*
  - 🦿 *Leer een beestje lopen*
  - 🏀 *Kook een bak vol ballen*
  - 🪐 *Gooi planeten rond de zon*
  
  If there is time, give each tile a still from `promo/los_tegel-*.jpg`, which are
  already cut, instead of the emoji. A picture of the game is what a child chooses by.
- **Today's record on each tile:** "👑 EMA · 4,2 MW", from `topScores()`, which
  already exists. Also show a "🏆 to beat" in every challenge's top bar. This is
  principle 4 ("competition creates gravity"), currently invisible until *after* a
  challenge.
- **The message on screen.** Match the booklet in Dutch: title **"Simulatie-arcade"**,
  subtitle **"Kun jij de wereld nabootsen?"** (programme: *De simulatie-arcade – kun jij
  de wereld nabootsen?*). The footer currently says "CWI Open Dag" in Dutch; the event
  is the **Wetenschapsdag**. Turn the footer into a readable line with the message and
  the group, e.g. *"Met wiskunde en computers kun je alles simuleren. Dat is ons vak. —
  Scientific Computing, CWI"*.
- **QR code** ("speel thuis verder") on the menu and on the about layer, pointing to
  the GitHub Pages build (`.github/workflows/pages.yml` already deploys it). This is
  the parents' take-home, and it matches the poster the form promises. Generate the QR
  code as an inline SVG at build time, so the app stays offline.
- **Fit at 1366×768.** Tiles need a height-based size (or a 4+3 grid that shrinks with
  `vh`); now the lowest tile ends at 779 px and the footer and flags overlap tiles.
- **The title card over a live world.** At the moment the title card is opaque and
  the game only starts after the click. Start the game behind a translucent card
  instead, so the first thing anyone sees is the simulation moving: the swirl already
  turning, creatures walking, dots commuting. Also brighten "Click to play!", which is
  now dim grey-blue.
- **Idle into a live game, not the menu** (S–M, if time): `?home=floodland` makes a
  machine idle back to that game's free play under the translucent title card. The
  three screens at the stand then show three different live simulations from a
  distance. That is "variety on display" (principle 3) at no cost in content.

  **The big screen** should idle into Swirl Lab. It has the fastest hook, the
  shortest challenge, the most beautiful image, and it is the group's core identity.
  A stretch goal for Thursday: after a minute of idle it runs the 🤖 computer's turn by
  itself in a loop.

## 3. One control grammar: is the button use confusing?

**Yes, in specific places.**

What each toolbar contains *should* differ. Stirring, infecting and piling sand are
different verbs, and a child does not carry toolbar habits from one game to the next.
What confuses is the *frame* around the tools:
- **the thing you look for** (where is the challenge, how do I get out);
- **telling button kinds apart** within one game;
- **reading the labels** at all.

Parents helping at several machines feel the inconsistencies most.

**The six kinds of button** all look the same (`.tool-button`; `.active` means four
different things):

| Kind | Examples |
|---|---|
| Pick-one tool (radio) | Stir/Blocks; Infect/Vaccinate/Soap/Isolate; Pebble/Planet/Giant/Star |
| On/off switch | 🌬️ Wind, 🏫 Close school (its `.active` means "closed"), 🔍 X-ray, 👯 Twins, 🕸 Gravity |
| Hold | 🔥 Heat and ❄️ Cool, 👁 Peek |
| One-shot action | 🌊 Storm!, 🟡 Big ball, 🧹 |
| Slider | 🔭 zoom, 🧮 step size (neither has a text label) |
| Mode switch | the challenge button, 🤖 Computer, 🧠 Teach, ⛰️ Design |

Outbreak's 🏠 is a tool in free play and a counter in the challenge. Creature Lab's
left column spawns bodies in the park and picks a reward in teach mode.

**The challenge, which is the one thing every game shares, differs every time.**

| Game | Challenge button | Round intro | How to leave mid-way |
|---|---|---|---|
| Swirl Lab | ⚡ Wind farm (+ 🤖 Computer beside it) | none, the clock just starts | ⏹ Stop |
| Outbreak! | 😷 Challenge | card, "▶ GO!" | ⏹ Stop |
| Save the Netherlands | 🏆 Challenge | card, "Go!" | ⏹ Stop (hidden during cards) |
| Weather Detective | 🕵️ Solve the cases! (gold, different button style) | card, "Start ▶" | **none**: only ⌂ to the menu |
| Creature Lab | 🏆 Challenge (3rd of 4, followed by ⛰️ Design) | none, hint line | ⏹ Stop (hidden during cards); editor and teach mode have no way back except ✅ Done |
| Ball Pit | 🎯 Challenge! | none, hint line | ⏹ Stop |
| Gravity Doodle | 🎯 Challenge! | none, hint line | ⏹ Stop |

"Next round" is spelled four ways, and the end-of-board buttons have four different
"back to free play" labels. The ⌂ button leaves immediately, with no confirmation,
throwing away a challenge in progress. It sits where a child looks for "back". Hints
sit at the bottom, at the top, in the map corner, or nowhere: Swirl Lab and Ball Pit
have no free-play hint at all. Button labels are 0.7 rem, i.e. **11 px, about 3 mm on
a 24″ screen**: readable at arm's length, not from two metres
(`style.css:293`).

### The grammar

Fixed zones on every game screen:

```
 ⌂ menu                     [ Round 2/3 · … · 🏆 to beat: EMA 4.2 MW ]              🔬 science
 ┌────────┐
 │ what to│
 │ play   │                        the world
 │ with   │
 └────────┘
                       one hint line, same style and size in every mode
        [ pick-one tools ] [ switches ] [ actions ]  🧹          ‖   🏆 Challenge!   ← gold, always last
                                                                     ⏹ Stop         ← same slot in a challenge
```

- **Bottom-right slot = the mode switch.** In free play it is a gold **🏆 Challenge!**:
  the same icon, word, colour and place in every game (Weather Detective's gold
  `.wd-primary` is the model). During a challenge the same slot holds **⏹ Stop**,
  always visible, including during round cards and in Weather Detective. Other scored
  modes (Swirl Lab's 🤖 Computer, Creature Lab's ⛰️ Design) go to the left of it.
- **Button kinds look different:**

  | Kind | Look |
  |---|---|
  | Pick-one tools | grouped in one segmented pill, blue fill when selected |
  | Switches | a small on/off dot, not the blue fill |
  | Hold buttons | glow while held |
  | Actions | plain |

  A `.tool-sep` gap separates the groups.
- **Labels ~0.95 rem, emoji ~2 rem.** The widest bar (Outbreak's challenge bar, now
  797 px) still fits 1366 px.
- **⌂ asks once** during a challenge: the first tap expands it to "⌂ Menu?", and a
  second tap within 3 s leaves.
- **One round-card component** and one wording: "Round 2 of 3", title, at most ~25
  words, one gold "Go! ▶" button. It is the same for Outbreak, Save the Netherlands and
  Weather Detective, and games without cards can use it too. The end board always
  offers 🔁 Play again · 🤖 Computer's turn (where it exists) · 🎈 Free play.

**For this week, CSS and one-line changes only:**

| Change | Effort |
|---|---|
| Same 🏆 button, label and gold class everywhere, last in the bar | 1 h |
| Bigger labels | 1 h, including checks at 1366 px |
| Stop in Weather Detective's cases (reuse `backToFree`), and Stop visible during round cards | 1 h |
| ⌂ confirm | 1 h |
| Free-play hint lines for Swirl Lab ("Drag to stir the air 👆") and Ball Pit ("Tap for a handful, hold to pour 👆") | 30 min |
| A way back in Creature Lab's editor and teach mode | 30 min |
| Text labels on the 🔭 and 🧮 sliders | 15 min |
| One wording for Next / Go / Play again | 30 min |
| Kind classes (tag each button in the six toolbar builders) | ½ day; do it if the rest is done by Wednesday |

**After the event:** a shared `shell/toolbar.ts` (`toolButton(emoji, label, kind)`) and
`shell/roundCard.ts` to replace the six toolbar builders and the three near-identical
`roundOver`s. Refactoring seven games four days out is not worth the risk.

**Keep:**
- the shared title card, ⌂ and 🔬 positions, and the score board;
- one click sound for every button;
- 🧹 for reset everywhere;
- disabled buttons that say *why* ("Teach it first", "Needs a muscle!");
- Outbreak's pulsing `.ready` "press me now" cue, which deserves to be shared;
- Gravity Doodle's hint that fades once the kid has thrown;
- the computer's cards advancing by themselves, so the stand keeps moving unattended;
- the two ✕ exits of the delve (pill and card).

## 4. Mechanics and pacing

| Game | Hook | Challenge | Length | Reading | Main risk |
|---|---|---|---|---|---|
| Swirl Lab | < 1 s | 1 × 60 s | ~1.5 min | low | a straight column beats the computer; click speed matters |
| Outbreak! | 5–10 s | 3 rounds | 5–6 min | high | rounds 1–2 mostly luck |
| Save the Netherlands | ~2 s | 4 rounds | 5–6 min | medium-high | long; round 3 barely rewards choosing |
| Weather Detective | ~3 s | 3 cases | 3–5 min | medium-high | case 2 barely rewards skill; case 3 hard for young kids |
| Creature Lab | ~1 s | 3 rounds | ~4 min | medium | rounds 2–3 are two-way choices with a known answer |
| Ball Pit | < 1 s | 3 rounds | ~2.5 min | low | no win moment; doing nothing scores ~700 |
| Gravity Doodle | ~2 s | 3 rounds | ~4 min | medium | new controls every round; long hints |

**Quick fixes found by running each game's own scoring code** *(measured)*:

- **Swirl Lab.**
  - With the game's wake model, one straight column reaches 92 % of full power and
    the computer's layout 95 %.
  - The computer places a turbine every 1.5 s, which costs it ~4,600 of 48,000 kJ. A
    kid who clicks a column in 3 s beats it.
  - Fix: count energy from 5 s in (or give everyone a 5 s placing phase), so the
    layout decides and not click speed.
  - Also check the round's real duration on each laptop: game time is capped per
    frame, so a slow GPU stretches the minute.
- **Outbreak!**
  - Luck: doing nothing "saves" 0–11 lives (mean 4); the tools are worth ~5 lives in
    rounds 1–2 and ~21 in round 3.
  - Reading: each round opens with a ~100-word card whose tool list repeats the
    toolbar. Cut it to name, stars and one sentence.
  - Run at ~1.5 days per second.
  - Fix "a new test every 1 days" (visible in the round-1 card).
  - On a busy machine, consider playing only round 3.
- **Save the Netherlands round 3.** The height slider starts at 2.0 m, which already
  earns 77 % of the best score (592 of 772) without choosing. Start it at 1.5 m (0
  points), so the kid has to choose (`rounds.ts:90`).
- **Creature Lab.**
  - The preset bar stays visible in ⛰️ Design mode, and an unmodified Wiggler crosses
    19.5 m (`design.ts:5-8`). The board will fill with stock Wigglers. Hide the
    presets, or only post edited bodies.
  - Consider 6 picks instead of 10 in "Pick the parents".
- **Ball Pit Silo.**
  - Knocking averages 689 against 303 for not knocking, but single runs overlap
    (13–496 vs 551–796). That makes the lesson unreliable and the test flaky.
  - Add 1–3 ⭐ against fixed thresholds per round. That gives Ball Pit the win moment
    it lacks.
- **Weather Detective.**
  - It computes the computer's score every case and shows it, which is the best "vs
    the computer" presentation in the arcade, but never posts it to the board. Post
    it (as CPU, best only), so the board opens with something to beat.
  - On a busy machine, skip case 2 (random clicking 57, spread out 60, computer 65).
- **Gravity Doodle Slingshot.** Pressing "🤖 fly one" five times gives ~500–750 points
  for no play; halve its payout again, or cap it at one use.
- **Units on every board.** Without a formatter, boards print bare numbers
  (`scoreflow.ts:96`), so Swirl Lab's and Outbreak's show no unit.

**Across the arcade:**

- **Throughput.** A 6-minute challenge serves about 10 kids per hour per machine;
  Swirl Lab about 40. If queues form, the cheapest lever is staff steering: "the
  challenge is for kids who stay; try the others first". The code lever is a
  **quick mode** (`?quick`): one round with its own board. The best single rounds are:
  - Save the Netherlands round 1 (43 s, "All 8 homes dry!");
  - Detective case 1;
  - Outbreak round 3;
  - Goldilocks, Pick the parents, Plinko.
  
  M effort; do it only if Thursday's dry run shows queues are likely.
- **"You vs the computer" should be the arcade's recurring beat.** It already works
  the same way in Swirl Lab, Creature Lab and Gravity Doodle, is half there in
  Weather Detective, and is missing in the rest. On Saturday morning, staff run each
  computer's turn once, so every board opens with 🤖 CPU to beat. "You beat the
  computer! 🎉" on the result screen is the moment kids tell their parents about.
- **A paper passport.** A card with the seven game icons, stamped by staff when a kid
  shows a score screen. It pulls kids across machines, gives staff a natural moment to
  talk to parents, and needs no code. Print it with the stand sheet (§5).

## 5. Science content and the thread

**Fix before Saturday** (30 min, text only):

| Where | Now | Fix |
|---|---|---|
| `shell/about.ts:44/86` | "After the 1953 flood it helped compute the storm surges behind the Delta Works." `floodland-remake.md:158` says this could not be confirmed. Placed after "ARRA, 1952", it also implies the ARRA did it. | Use the confirmed van Dantzig wording: "…and one of its founders, David van Dantzig, worked out how high the dikes must be." |
| `orbits/delve.ts:77` | Apollo 13 rode "the free ride home" | Apollo 13 had left that path; it fired the lunar module's engine to get back onto it, and gravity brought them home. |
| `outbreak/delve.ts:124` | agent models like this are used "in the Netherlands: the RIVM" | RIVM's COVID model was compartmental. Name an agent-based example instead (e.g. CovidSim), and the group's own CovidSim uncertainty study if that is the project meant. **Check with the researcher.** |
| `orbits/delve.ts:66` | Oscar II's prize for "proving the solar system is stable" | Announced 1885, awarded 1889, for work on whether it is stable. |
| `outbreak/index.ts:1171`, `delve.ts:209` (nl) | "werkt aan" | "heeft … gewerkt aan", as in the English |
| `floodland/text.ts:120,191` (nl) | "rekende dat samen met Deltares uit" | "werkte met Deltares aan methoden om … te berekenen" |
| `about.ts:43` | "*the* original reason to build computers" | "one of the main reasons" |
| `detective/text.ts:81` | home stations read "about 1.5° too warm" | say "in this game"; it is the game's setting |

**Confirm with the named people** (a few messages): the Deltares dike-failure project;
which epidemic project; the KNMI sentences ("helped choose the settings", "days into
minutes", "feed the new AI forecasts" → "could feed", "next up: wind and rain"); and
the turbulence-ML sentence in `creature/delve.ts:87` that `creature-proposal.md:98`
already flags.

**The thread is there, but only a visitor who opens the about layer sees it.** Every
game uses the same recipe:

**📜 a rule of nature → 🔲 squares or balls → ⏱ small steps → 🎲 many futures**

Almost every game also ends in the same idea: *one run is luck, many runs are
science*. Outbreak has its 8 futures, Save the Netherlands its ensemble forecast and
century, Weather Detective its dreams, Gravity Doodle its asteroid cloud, and Ball Pit
and Creature Lab their twins. This is the parents' take-home in one sentence, and it
is CWI's actual research (uncertainty quantification). To make it visible:

- **A sixth about card, "What all these games share",** with the four-step recipe
  above and all seven games placed on it. End it with "…and that is our job", and add
  AI and the KNMI work to the "CWI and our group" card (now: turbulence, epidemics,
  dikes, climate only). "And these games?" names 3 of the 7 games; name all.
- **One word per idea, in every game**, both languages. Today the grid square is
  "cell", "square" and "piece"; a time step is "tick", "flip-book" and "step"; many
  runs are "ensemble", "runs", "dreams" and "futures".

  | Idea | English | Dutch |
  |---|---|---|
  | grid square | square | vakje |
  | time step | step | stapje |
  | many runs | many futures | veel toekomsten |
  | uncertainty | how sure | hoe zeker |
  | chaos | twins | tweeling |
  | the rule for what is too small to compute | stand-in rule (the group's core research, now told three different ways) | vervangregel |
  | the craft | scientific computing (not "numerieke wiskunde" / "rekenwetenschap") | scientific computing |

- **Doors between games in every last chapter.** Ball Pit, Gravity Doodle and Creature
  Lab already link to other games (`openGame`); Swirl Lab, Outbreak, Save the
  Netherlands and Weather Detective do not.
- **One visual convention for "possible futures"** (after the event): thin grey lines
  for possible futures, a thick line for what happened, 🔮 for "ask the model".

**People and careers are missing.** `message.md` says the kids' take-home is that "the
people who make them play with them for a living". The only such line in the arcade is
Creature Lab's "choosing the reward is a big part of a robot engineer's job". A
"Who makes these?" about card would fix that: first names or photos of the group,
each with "I simulate …", plus the QR code. It is the most direct answer to "what does
our group do", and it needs no code beyond a card.

**Reading load.** The delves total ~5,800 words. Gravity Doodle alone is ~1,200 (6–8
minutes for a parent). **In Dutch, 8 of 43 chapters must scroll at 1920×1080 and 31 of
43 at 1366×768** *(measured)*; only Save the Netherlands fits everywhere, and its
delve is the model. Cut the eight that scroll at 1080p to ≤ 120 words:
- Gravity Doodle 3–5
- Outbreak 3 and 5
- Creature Lab 5 and 6
- Ball Pit 3

Check the laptops' real resolution first. If they are 768 px tall, a smaller delve
font there is cheaper than rewriting 31 chapters.

**Misconception risk.** Outbreak's "Winter flu" round kills about 8 % of the
grandparents. Only the delve says the diseases are deadlier than real flu on purpose.
Add one line to the round card, or rename the round ("Nasty flu").

## 6. Dutch

The register is consistently *je/jij*, and much of the text reads naturally ("Goudlokje",
"op je snuit vallen"). **Fix:**

| Where | Now | Fix |
|---|---|---|
| `creature/delve.ts:145` | "Jaren vallen kosten" | "kost" |
| `bounce/roundSilo.ts:40` | "wánnéér" | "wánneer" |
| `orbits/roundDefense.ts:67` | "Niet meer kijken" | "Geen kijkbeurten meer" |
| `bounce/roundPlinko.ts:39` | "stuiters" (the bumpers) | "blokjes" |
| `detective/delve.ts:134` | "ijkpunten" | "steunpunten" |
| `outbreak/delve.ts:183` | "snelweg direct naar veiligheid" | "de kortste weg" |
| `outbreak/delve.ts:199` | "met calculus" | "met wiskunde" |
| `creature/text.ts:193` | "Teken je eigen" | "Teken er zelf een" |
| `creature/text.ts:206` | "om hem om te draaien" | "om te wisselen" |
| `windfarm/game.ts:59` | "Tijd is om!" | "De tijd is om!" |
| `floodland/text.ts:191` | "op het CWI" | "bij het CWI" |
| `orbits/delve.ts` | "om te checken", "spiraliseert", "free-returnbaan" | rephrase |

**One word per button across games:**
- Reset: *Opnieuw* (not "Reset")
- Clear: *Wissen* (not "Leeg")
- Play again: *Nog een keer*
- Free play: *Vrij spelen*
- Start: *Start!* (not "START!"/"AF!")
- Buttons in the infinitive (*Besmetten, Vaccineren*), so "Voorspel", "Verwarm" and
  "Zoom uit" become *Voorspellen, Verwarmen, Uitzoomen*.
- One delve heading pattern: *De wetenschap achter …*

## 7. The stand

**Machines.** Suggested split, given one big screen plus 2–3 laptops:

| Machine | Shows | Idles into | Why |
|---|---|---|---|
| Big screen | all 7 | Swirl Lab (→ the computer's turn, if built) | the most beautiful image, the group's core, the shortest challenge; the queue watches it |
| Laptop 1 (aisle) | all 7 | Ball Pit or Creature Lab | the fastest hooks, for the 30-second crowd |
| Laptop 2 | all 7 | Save the Netherlands | the Dutch story, the most legible from a distance |
| Laptop 3 | all 7 | Outbreak or Weather Detective | data and uncertainty; better for parents who stay |

All seven games on every menu, because a kid who loves one game should not have to
wait for one machine. The variety is shown by what each machine *idles into* (needs
`?home=`, §2). Without that, use `?games=` subsets as the README describes.

**A stand sheet** (1 h, no code; `docs/stand-guide.md`, printed A4 in Dutch and
English). `message.md` has talking points for only 3 of the 7 games. Per game, one
row:
- the kids' hook;
- the parents' line;
- the group link, with a person to name;
- two "if asked" facts and the claims to avoid;
- what to point at on screen.

Below the rows: the four-step recipe, "one run is luck, many runs are science",
"who we are / you could do this job", and the operating basics:
- `Esc` = menu (this also fixes a black or frozen game);
- the script relaunches a closed browser;
- how to clear the test scores;
- Alt+F4 is staff-only.

**The day before and the morning of:**
- **On each real machine:** build `dist`. Check `chrome://gpu` shows hardware
  acceleration. Play every challenge through to the board, with Wi-Fi off.
- **Leave the machine running:** for an hour, pressing `Esc` often, and watch memory.
- **OS settings:** no sleep, lock screen or updates; timezone Europe/Amsterdam; zoom
  100 %; sound around 50 %.
- **Speed:** Save the Netherlands is the heaviest game *(22 % main thread, 46 fps in
  software rendering)*; use `?quality=low` where Swirl Lab stutters.
- **Saturday morning:** clear the test scores, then run each computer's turn once.
- **Spares:** a USB stick with `dist` and a portable browser, and a spare mouse.

## 8. After the event (reusability)

`message.md` wants the arcade easy to extend for next year, lab visits and schools.
Once Saturday is behind us:
- **Shared shell modules** (`toolbar.ts`, `roundCard.ts`, `challengeHud.ts`), replacing
  the per-game copies, with the button kinds from §3 built in.
- **A proper attract mode:** the plan's live fluid behind the menu, or a rotation of
  computer's turns.
- **Quick mode** as a first-class shell feature.
- **The "possible futures" visual convention** across the six games that have one.
- **Seeded randomness** in every test.
- **A "classroom" build** for school outreach: no scoreboard, delve open by default.

## 9. Suggested order for this week

| Day | Work |
|---|---|
| **Mon–Tue** | §1 whole (shell safety, kiosk script, score reset and blocklist) → §5 claim fixes, footer and §6 Dutch fixes → §2 tiles (hooks, records, message, QR, 768 px fit) |
| **Wed** | §3 CSS and one-line changes (🏆 slot, labels, Stop everywhere, ⌂ confirm, hints) → §4 quick fixes (Swirl Lab start, Save the Netherlands slider, Creature Lab design presets, Detective CPU on the board, units, Outbreak card and speed) |
| **Thu** | Dry run on the real machines → cut the delve chapters that scroll there → stand sheet, passport, QR poster → if time: translucent title card, `?home=`, attract loop on the big screen |
| **Fri** | Freeze. Build, copy, test offline, and pack the spares. |
