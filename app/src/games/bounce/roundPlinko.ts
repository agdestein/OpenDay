// Round 1, Plinko: drag bumpers to steer a Galton board's bell curve into the
// gold bucket. Before the pour, two twin balls a thousandth of a pixel apart
// part ways: one ball is luck, three hundred are predictable.
import { sound } from '../../lib/sound';
import { fmtNumber, pick, type Localized } from '../../lib/i18n';
import { clamp, randRange } from '../../lib/util';
import { BallWorld, type Ball, type Box, type Circle } from './physics';
import { PLINKO, bucketOf, plinkoLayout, plinkoTally, type PlinkoLayout } from './plinko';
import { drawBalls, drawFrame } from './draw';
import { setLabel, type Round, type RoundHost } from './rounds';

const TEXT: Localized<{
  drop: string;
  dropsIn: (s: number) => string;
  hudBalls: (n: number) => string;
  hintPlace: string;
  hintTwins: string;
  twinsApart: (n: number) => string;
  twinsSame: string;
  hintPour: string;
  summary: (gold: number) => string;
}> = {
  en: {
    drop: 'Drop!',
    dropsIn: (s) => `Drop! (${s})`,
    hudBalls: (n) => `⚪ ${n} to go`,
    hintPlace: 'Drag the white bumpers onto the board to steer the balls into the 🥇 gold bucket!',
    hintTwins: 'Two twin balls, dropped a thousandth of a pixel apart…',
    twinsApart: (n) => `…and they land ${n} buckets apart! One ball is luck. Now watch what 300 do.`,
    twinsSame: '…one ball is luck. Now watch what 300 do.',
    hintPour: 'Keep steering: you can drag the bumpers while the balls fall.',
    summary: (gold) =>
      `${fmtNumber(gold)} balls in the gold bucket. Nobody can say where one ball lands, but 300 balls make the same bell curve every time: that is how weather forecasts use many runs at once.`,
  },
  nl: {
    drop: 'Los!',
    dropsIn: (s) => `Los! (${s})`,
    hudBalls: (n) => `⚪ nog ${n}`,
    hintPlace: 'Sleep de witte stuiters op het bord en stuur de ballen naar het 🥇 gouden bakje!',
    hintTwins: 'Twee tweelingballen, een duizendste pixel uit elkaar losgelaten…',
    twinsApart: (n) => `…en ze landen ${n} bakjes uit elkaar! Eén bal is geluk. Kijk nu wat 300 ballen doen.`,
    twinsSame: '…één bal is geluk. Kijk nu wat 300 ballen doen.',
    hintPour: 'Blijf sturen: je mag de stuiters verslepen terwijl de ballen vallen.',
    summary: (gold) =>
      `${fmtNumber(gold)} ballen in het gouden bakje. Niemand weet waar één bal landt, maar 300 ballen maken elke keer dezelfde klokvorm: zo gebruiken weersverwachtingen veel berekeningen tegelijk.`,
  },
  no: {
    drop: 'Slipp!',
    dropsIn: (s) => `Slipp! (${s})`,
    hudBalls: (n) => `⚪ ${n} igjen`,
    hintPlace: 'Dra de hvite støtfangerne inn på brettet og styr ballene til den 🥇 gylne bøtta!',
    hintTwins: 'To tvillingballer, sluppet en tusendels piksel fra hverandre…',
    twinsApart: (n) => `…og de lander ${n} bøtter fra hverandre! Én ball er flaks. Se nå hva 300 gjør.`,
    twinsSame: '…én ball er flaks. Se nå hva 300 gjør.',
    hintPour: 'Fortsett å styre: du kan dra støtfangerne mens ballene faller.',
    summary: (gold) =>
      `${fmtNumber(gold)} baller i den gylne bøtta. Ingen kan si hvor én ball lander, men 300 baller lager den samme klokkekurven hver gang: slik bruker værvarsler mange beregninger samtidig.`,
  },
};

type Phase = 'place' | 'twins' | 'pour' | 'settle' | 'done';
const TICK = 1 / 60;

export class PlinkoRound implements Round {
  readonly title = '🎯 Plinko';
  score = 0;
  private layout: PlinkoLayout;
  private box: Box;
  private world: BallWorld;
  private bumpers: Circle[];
  private phase: Phase = 'place';
  private timer = PLINKO.placeTime;
  private dropped = 0;
  private acc = 0;
  private twins: Ball[] = [];
  private trails: { x: number; y: number }[][] = [[], []];
  private twinsTold = false;
  private counted = new WeakSet<Ball>();
  /** Time of the last points popup per bucket, so they don't pile up. */
  private popped = new Array<number>(PLINKO.buckets).fill(-1);
  private counts = new Array<number>(PLINKO.buckets).fill(0);
  private dragging: Circle | null = null;
  private dropButton: HTMLButtonElement;
  private hintTimer = 0;
  private clock = 0;

  constructor(private host: RoundHost) {
    // The board stands a little higher than the pit, leaving a line for the hint.
    this.box = { ...host.box, y1: host.box.y1 - 34 };
    const side = Math.random() < 0.5 ? -1 : 1;
    this.layout = plinkoLayout(this.box, host.unit, side * 3);
    this.bumpers = this.layout.bumperStarts.map((p) => ({ x: p.x, y: p.y, r: this.layout.bumperR }));
    this.world = this.makeWorld(this.bumpers);
    const T = pick(TEXT);
    [this.dropButton] = host.buttons([
      { emoji: '▶️', label: T.drop, onClick: () => this.phase === 'place' && this.drop() },
    ]);
    host.hint(T.hintPlace);
  }

  dispose(): void {
    window.clearTimeout(this.hintTimer);
  }

  hud(): string {
    return pick(TEXT).hudBalls(PLINKO.balls - this.dropped);
  }

  private makeWorld(bumpers: Circle[]): BallWorld {
    const bh = this.host.box.y1 - this.host.box.y0;
    const world = new BallWorld(this.box, (1800 / 620) * bh, this.layout.ballR, 0);
    world.pegRestitution = PLINKO.pegBounce;
    // Air in the board: without it balls skate sideways and the bell turns flat.
    world.sideDrag = PLINKO.air;
    world.dragLine = this.layout.bucketTop;
    world.pegs = [...this.layout.pegs, ...bumpers];
    world.segments = this.layout.segments;
    return world;
  }

  // ---- input: drag the bumpers ----

  down(x: number, y: number): void {
    const reach = 14 * this.host.unit;
    this.dragging = this.bumpers.find((b) => Math.hypot(b.x - x, b.y - y) < b.r + reach) ?? null;
    if (this.dragging) sound.play('click');
  }

  move(x: number, y: number): void {
    const d = this.dragging;
    if (!d) return;
    const a = this.layout.dragArea;
    d.x = clamp(x, a.x0, a.x1);
    d.y = clamp(y, a.y0, a.y1);
  }

  up(): void {
    this.dragging = null;
  }

  // ---- the round ----

  private drop(): void {
    this.phase = 'twins';
    this.timer = 0;
    this.dropButton.disabled = true;
    setLabel(this.dropButton, pick(TEXT).drop);
    this.host.hint(pick(TEXT).hintTwins);
    // Try a few twin pairs on a scratch copy of the board and show one that
    // parts ways: every pair really starts a thousandth of a pixel apart.
    let best = 0;
    let bestGap = -1;
    for (let k = 0; k < 8 && bestGap < 2; k++) {
      const offset = randRange(-0.8, 0.8) * this.host.unit;
      const scratch = this.makeWorld(this.bumpers.map((b) => ({ ...b })));
      const [a, b] = this.addTwins(scratch, offset);
      for (let t = 0; t < 6 && !(a.y > this.layout.countLine && b.y > this.layout.countLine); t += TICK) scratch.step(TICK);
      const gap = Math.abs(bucketOf(this.layout, a.x) - bucketOf(this.layout, b.x));
      if (gap > bestGap) {
        bestGap = gap;
        best = offset;
      }
    }
    this.twins = this.addTwins(this.world, best);
    sound.play('click');
  }

  private addTwins(world: BallWorld, offset: number): Ball[] {
    const { spout, ballR } = this.layout;
    return [0, PLINKO.twinGap].map((gap, i) =>
      world.add({ x: spout.x + offset + gap, y: spout.y, vx: 0, vy: 0, r: ballR, twin: i + 1, hue: 0 }),
    );
  }

  step(dt: number): void {
    const T = pick(TEXT);
    const { layout, world } = this;
    if (this.phase === 'done') return;
    if (this.phase === 'place') {
      this.timer -= dt;
      setLabel(this.dropButton, T.dropsIn(Math.max(0, Math.ceil(this.timer))));
      if (this.timer <= 0) this.drop();
    } else if (this.phase === 'twins') {
      this.timer += dt;
      // The pour waits until both twins have landed, so nothing disturbs them.
      const landed = this.twins.every((b) => b.y > layout.countLine);
      if ((landed && this.timer >= PLINKO.twinTime) || this.timer > 6) {
        this.phase = 'pour';
        this.acc = 0;
      }
    } else if (this.phase === 'pour') {
      this.acc += PLINKO.rate * dt;
      while (this.acc >= 1 && this.dropped < PLINKO.balls) {
        this.acc -= 1;
        this.dropped++;
        const jitter = randRange(-1, 1) * this.host.unit;
        world.add({ x: layout.spout.x + jitter, y: layout.spout.y, vx: 0, vy: 0, r: layout.ballR, hue: randRange(0, 360) });
      }
      if (this.dropped >= PLINKO.balls) {
        this.phase = 'settle';
        this.timer = 0;
      }
    } else if (this.phase === 'settle') {
      this.timer += dt;
      const still = 30 * this.host.unit;
      const moving = world.balls.some((b) => b.y < layout.countLine || Math.hypot(b.vx, b.vy) > still);
      if ((this.timer > 1.5 && !moving) || this.timer > 8) {
        this.phase = 'done';
        this.host.finish(this.score, T.summary(this.counts[layout.gold]));
        return;
      }
    }

    // Fixed ticks, like the scratch run that picked the twins: the board is
    // chaotic, so a different frame rate would send them elsewhere.
    this.clock += dt;
    for (; this.clock >= TICK; this.clock -= TICK) world.step(TICK);
    world.loudest = 0;
    this.twins.forEach((b, i) => {
      const trail = this.trails[i];
      if (b.y < layout.countLine || trail.length === 0) trail.push({ x: b.x, y: b.y });
    });
    if (!this.twinsTold && this.twins.length && this.twins.every((b) => b.y > layout.countLine)) {
      this.twinsTold = true;
      const gap = Math.abs(bucketOf(layout, this.twins[0].x) - bucketOf(layout, this.twins[1].x));
      this.host.hint(gap > 0 ? T.twinsApart(gap) : T.twinsSame);
      this.hintTimer = window.setTimeout(() => {
        if (this.phase !== 'done') this.host.hint(T.hintPour);
      }, 5000);
    }

    // Points pop out of the buckets as the balls land.
    const now = performance.now() / 1000;
    for (const b of world.balls) {
      if (b.twin || b.y < layout.countLine || this.counted.has(b)) continue;
      this.counted.add(b);
      const i = bucketOf(layout, b.x);
      const gold = i === layout.gold;
      if (i < 0 || !(gold || layout.silver.includes(i)) || now - this.popped[i] < 0.45) continue;
      this.popped[i] = now;
      const x = layout.edges[i] + layout.spacing / 2;
      if (gold) {
        this.host.popup(x, layout.countLine, `+${PLINKO.goldPoints}`, '#fbbf24');
        sound.play('ding');
      } else {
        this.host.popup(x, layout.countLine, `+${PLINKO.silverPoints}`, '#cbd5e1');
        sound.play('click');
      }
    }
    const tally = plinkoTally(layout, world.balls);
    this.score = tally.score;
    this.counts = tally.counts;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const { layout } = this;
    const u = this.host.unit;
    const { y1 } = this.box;
    const S = layout.spacing;
    const edges = layout.edges;
    drawFrame(ctx, this.box, w, h);

    for (let i = 0; i < edges.length - 1; i++) {
      const gold = i === layout.gold;
      if (!gold && !layout.silver.includes(i)) continue;
      ctx.fillStyle = gold ? 'rgba(251, 191, 36, 0.2)' : 'rgba(203, 213, 225, 0.1)';
      ctx.fillRect(edges[i], layout.bucketTop, S, y1 - layout.bucketTop);
    }
    drawBalls(ctx, this.world.balls, 0, 1);
    for (let i = 0; i < edges.length - 1; i++) {
      const gold = i === layout.gold;
      if (!gold && !layout.silver.includes(i)) continue;
      ctx.fillStyle = gold ? '#fbbf24' : '#cbd5e1';
      ctx.font = `800 ${Math.round(S * 0.3)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(gold ? `🥇×${PLINKO.goldPoints}` : `×${PLINKO.silverPoints}`, edges[i] + S / 2, layout.bucketTop + S * 0.45);
    }

    // Pegs and bucket walls.
    ctx.fillStyle = 'rgba(238, 242, 255, 0.55)';
    for (const p of layout.pegs) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(238, 242, 255, 0.45)';
    ctx.lineWidth = 3;
    for (const s of layout.segments) {
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }

    // The spout.
    const { spout } = layout;
    ctx.fillStyle = 'rgba(238, 242, 255, 0.35)';
    ctx.beginPath();
    ctx.moveTo(spout.x - S * 0.5, spout.y - S * 0.6);
    ctx.lineTo(spout.x + S * 0.5, spout.y - S * 0.6);
    ctx.lineTo(spout.x + S * 0.15, spout.y - layout.ballR);
    ctx.lineTo(spout.x - S * 0.15, spout.y - layout.ballR);
    ctx.closePath();
    ctx.fill();

    // Bumpers: pulse while waiting to be placed.
    const pulse = this.phase === 'place' ? 0.5 + 0.5 * Math.sin(performance.now() / 250) : 0;
    for (const b of this.bumpers) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = b === this.dragging ? '#ffffff' : 'rgba(238, 242, 255, 0.85)';
      ctx.fill();
      ctx.strokeStyle = `rgba(125, 211, 252, ${0.4 + 0.6 * pulse})`;
      ctx.lineWidth = 3 + 3 * pulse;
      ctx.stroke();
    }

    // The twins and their paths.
    const colors = ['#f472b6', '#22d3ee'];
    this.twins.forEach((b, i) => {
      const trail = this.trails[i];
      if (trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(trail[0].x, trail[0].y);
        for (const p of trail) ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = colors[i];
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 1.6, 0, Math.PI * 2);
      ctx.fillStyle = colors[i];
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Live counts above the buckets.
    ctx.font = `700 ${Math.round(12 * u + 4)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(238, 242, 255, 0.85)';
    this.counts.forEach((n, i) => {
      if (n > 0) ctx.fillText(String(n), edges[i] + S / 2, layout.bucketTop - 6);
    });
  }
}
