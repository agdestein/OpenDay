# Goals and message

What the Scientific Computing stand should achieve at the CWI Science Day, and what
every design decision in the arcade should serve.

## The one-line message

> **Scientific computing can simulate anything.**

Weather, wind farms, epidemics, floods, galaxies, walking robots — behind all of them
is the same craft: turning the laws of nature into mathematics, and mathematics into
fast programs. That craft is what our group does.

The *variety* of the arcade **is** the message. A single polished demo says "this group
simulates fluids". A menu of five wildly different games, all clearly simulations, says
"this group's field applies to everything" — which is both true and far more
impressive.

## Per-audience goals

### Kids (primary)

- **Feel:** "I made that happen." Every game must react to their input within a frame —
  stir the fluid and it swirls *now*, place a dike and the water piles up against it
  *now*. Agency is the hook; realism is optional, responsiveness is not.
- **Take home:** simulations are toys you can play with, and the people who make them
  play with them for a living. Math and programming are how you get to build worlds.
- **No reading required:** a five-year-old who grabs the mouse and wiggles it must get
  a satisfying result before understanding anything.

### Parents (secondary, high-leverage)

- **Take home:** scientific computing is one field with enormous reach — the same group
  works on energy, health, climate, and AI. CWI is where this happens in the
  Netherlands.
- **Talking points at the stand** (for whoever staffs it, and as one-liners inside the
  games):
  - Wind farm game → wake losses are a real, expensive problem; simulating turbulence
    is our daily work.
  - Epidemic game → our group has actually worked on simulating epidemic spread.
  - Dike game → the storm-surge computations after the 1953 flood were pioneered at
    the Mathematisch Centrum, CWI's predecessor. *(Verify the exact historical wording
    before printing it.)*
- Parents who are engaged re-explain the demo to their kids on the way home and tell
  other parents. Design for the over-the-shoulder viewer too: big visuals, readable
  from two meters.

### Us

- A stand that runs itself: no crashes, no setup, no network dependency, resets itself
  when a kid walks away mid-game.
- Reusable: the arcade should be easy to extend with new games for next year's event,
  lab visits, and school outreach.

## Design principles (derived from the goals)

1. **30-second wow, 15-minute depth.** Every game opens in "toy mode" (pure
   cause-and-effect fun, zero instructions) and offers an optional goal/score mode for
   kids who stay.
2. **Looks accurate beats is accurate.** Video-game fidelity: plausible motion, juicy
   feedback, 60 fps. No solver correctness requirements beyond "doesn't explode".
3. **Variety on display.** With two or three machines, run *different* games on each so
   the stand itself broadcasts the breadth of the field.
4. **Competition creates gravity.** Local high-score boards ("Today's record: Emma,
   4.2 MW") make kids return and queue.
5. **Robust by construction.** Static web app, offline, fullscreen kiosk, idle timeout
   back to the menu, every game recoverable by one click.
6. **Each game carries one science sentence.** A single line on the game's start
   screen connecting it to real research — for the parents, ignorable by the kids.
