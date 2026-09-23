// Round 3, Steam engine: a heavy lid rests on a gas of balls in a cylinder.
// Hold the burner and the balls speed up, drum on the lid and lift it; let go
// and they cool, and the lid sinks within a couple of seconds. Keep the lid
// above the flag as long as you can on one tank of fuel. Temperature is how
// fast the balls jiggle; pressure is how hard they hit.
import { sound } from '../../lib/sound';
import { fmtNumber, pick, type Localized } from '../../lib/i18n';
import type { Box } from './physics';
import { STEAM, makeSteam } from './steam';
import { drawBalls, drawFloor, drawFrame, label } from './draw';
import type { Round, RoundHost } from './rounds';

const TEXT: Localized<{
  burner: string;
  hint: string;
  hudTime: (s: number) => string;
  hudFuel: (pct: number) => string;
  empty: string;
  summary: (s: string) => string;
  weight: string;
}> = {
  en: {
    burner: 'Hold to heat',
    hint: 'Hold 🔥 to heat the balls: fast balls push the lid up. Keep it above the 🚩 flag, but save fuel!',
    hudTime: (s) => `⏱ ${s} s`,
    hudFuel: (p) => `⛽ ${p} %`,
    empty: 'Out of fuel!',
    summary: (s) =>
      `The lid stayed above the flag for ${s} seconds. Hot balls move faster and hit the lid harder: that is all temperature and pressure are. A steam engine works just like this.`,
    weight: '100 kg',
  },
  nl: {
    burner: 'Houd vast',
    hint: 'Houd 🔥 ingedrukt om de ballen te verwarmen: snelle ballen duwen het deksel omhoog. Houd het boven de 🚩 vlag, maar spaar je brandstof!',
    hudTime: (s) => `⏱ ${s} s`,
    hudFuel: (p) => `⛽ ${p} %`,
    empty: 'Brandstof op!',
    summary: (s) =>
      `Het deksel bleef ${s} seconden boven de vlag. Hete ballen bewegen sneller en botsen harder tegen het deksel: meer is temperatuur en druk niet. Een stoommachine werkt precies zo.`,
    weight: '100 kg',
  },
  no: {
    burner: 'Hold inne',
    hint: 'Hold 🔥 inne for å varme ballene: raske baller dytter lokket opp. Hold det over 🚩 flagget, men spar på drivstoffet!',
    hudTime: (s) => `⏱ ${s} s`,
    hudFuel: (p) => `⛽ ${p} %`,
    empty: 'Tomt for drivstoff!',
    summary: (s) =>
      `Lokket holdt seg over flagget i ${s} sekunder. Varme baller beveger seg fortere og treffer lokket hardere: mer er ikke temperatur og trykk. En dampmaskin virker akkurat slik.`,
    weight: '100 kg',
  },
};

export class SteamRound implements Round {
  get title(): string {
    return pick({ en: '🚂 Steam engine', nl: '🚂 Stoommachine', no: '🚂 Dampmaskin' });
  }
  score = 0;
  private world = makeSteam();
  private time = 0;
  private above = 0;
  private fuel = STEAM.fuel;
  private heating = false;
  private heat = 0;
  private done = false;
  private box: Box;
  private burner: HTMLButtonElement;

  constructor(private host: RoundHost) {
    this.box = { ...host.box, y1: host.box.y1 - 34 };
    [this.burner] = host.buttons([
      {
        emoji: '🔥',
        label: pick(TEXT).burner,
        hold: (on) => {
          this.heating = on && this.fuel > 0;
          if (this.heating) this.heat = Math.max(this.heat, 0.3);
        },
      },
    ]);
    host.hint(pick(TEXT).hint);
  }

  dispose(): void {}

  hud(): string {
    const T = pick(TEXT);
    return `${T.hudTime(Math.max(0, Math.ceil(STEAM.seconds - this.time)))}   ·   ${T.hudFuel(Math.round((100 * this.fuel) / STEAM.fuel))}`;
  }

  down(): void {}
  move(): void {}
  up(): void {}

  /** Lid height above the floor, as a fraction of the cylinder. */
  private lidHeight(): number {
    return 1 - this.world.piston.y / STEAM.height;
  }

  step(dt: number): void {
    if (this.done) return;
    this.time += dt;
    if (this.heating) {
      this.fuel = Math.max(0, this.fuel - dt);
      if (this.fuel === 0) {
        this.heating = false;
        this.burner.disabled = true;
        this.host.popup(this.host.box.x0 + (this.host.box.x1 - this.host.box.x0) / 2, this.box.y1 - 60, pick(TEXT).empty, '#fca5a5');
        sound.play('thud');
      }
    }
    // A snappy burner, so pulsing near the flag beats just holding it
    // (in node: ~19 s above the flag against ~14.5 s).
    this.heat = this.heating ? Math.min(1, this.heat + 1.5 * dt) : Math.max(0, this.heat - 1.5 * dt);
    this.world.heat = this.heat;
    this.world.step(dt);
    this.world.loudest = 0;
    if (this.lidHeight() > STEAM.flag) {
      const before = Math.floor(this.above);
      this.above += dt;
      if (Math.floor(this.above) > before) sound.play('ding');
    }
    this.score = Math.round(this.above * STEAM.points);
    if (this.time >= STEAM.seconds) {
      this.done = true;
      this.host.finish(this.score, pick(TEXT).summary(fmtNumber(Math.round(this.above))));
    }
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const { x0, y0, x1, y1 } = this.box;
    const u = this.host.unit;
    drawFrame(ctx, this.box, w, h);
    const s = (y1 - y0 - 20) / STEAM.height;
    const ox = (x0 + x1) / 2 - (STEAM.width * s) / 2;
    const oy = y1 - STEAM.height * s;
    const X = (x: number) => ox + x * s;
    const Y = (y: number) => oy + y * s;
    const pis = this.world.piston;
    const up = this.lidHeight() > STEAM.flag;

    // Flag band.
    const flagY = Y(STEAM.height * (1 - STEAM.flag));
    ctx.fillStyle = 'rgba(74, 222, 128, 0.08)';
    ctx.fillRect(X(-60), Y(0), (STEAM.width + 120) * s, flagY - Y(0));
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(X(-60), flagY);
    ctx.lineTo(X(STEAM.width + 60), flagY);
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, '🚩', X(STEAM.width + 60) + 16, flagY + 8, 26 * u + 6, '#4ade80');

    // Burner under the cylinder, the gas, the walls.
    drawFloor(ctx, X(0), X(STEAM.width), Y(STEAM.height), this.heat, 120 * s);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    drawBalls(ctx, this.world.balls, 1, 0.3 * this.world.kick);
    ctx.restore();
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.8)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0));
    ctx.lineTo(X(0), Y(STEAM.height));
    ctx.moveTo(X(STEAM.width), Y(0));
    ctx.lineTo(X(STEAM.width), Y(STEAM.height));
    ctx.stroke();

    // The lid and its weight.
    const lidY = Y(pis.y);
    ctx.fillStyle = up ? '#4ade80' : '#94a3b8';
    ctx.fillRect(X(0), lidY - 12 * s, STEAM.width * s, 12 * s);
    const bw = STEAM.width * 0.45 * s;
    const bh = 70 * s;
    ctx.fillStyle = '#475569';
    ctx.fillRect(X(STEAM.width / 2) - bw / 2, lidY - 12 * s - bh, bw, bh);
    label(ctx, pick(TEXT).weight, X(STEAM.width / 2), lidY - 12 * s - bh / 2 + 7 * u, 18 * u + 4, '#e2e8f0');

    // Thermometer: average jiggle speed of the balls.
    let v2 = 0;
    for (const b of this.world.balls) v2 += b.vx * b.vx + b.vy * b.vy;
    const temp = Math.min(1, Math.sqrt(v2 / this.world.balls.length) / (0.5 * this.world.kick));
    const tx = X(-110);
    const th = STEAM.height * 0.7 * s;
    const ty = Y(STEAM.height) - th;
    ctx.fillStyle = 'rgba(238, 242, 255, 0.12)';
    ctx.fillRect(tx - 10, ty, 20, th);
    ctx.fillStyle = `hsl(${230 - 230 * temp}, 90%, 58%)`;
    ctx.fillRect(tx - 10, ty + th * (1 - temp), 20, th * temp);
    label(ctx, '🌡️', tx, ty - 10, 26 * u + 4, '#fff');
  }
}
