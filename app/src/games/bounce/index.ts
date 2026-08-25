// Phase-0 placeholder game: proves the ArcadeGame interface and the shell's
// launch/idle/cleanup cycle. Replaced by real games in later phases.
import type { ArcadeGame, GameHost, GameInstance } from '../../shell/types';
import { pointerPos, randRange } from '../../lib/util';
import { pick, type Localized } from '../../lib/i18n';

const TEXT: Localized<{
  clickToDrop: string;
  ballCount: (n: number) => string;
  collisions: string;
  wallFriction: string;
  heatLoss: string;
}> = {
  en: {
    clickToDrop: 'Click anywhere to drop balls!',
    ballCount: (n) => `${n} balls simulated, 60 times per second`,
    collisions: 'Ball collisions',
    wallFriction: 'Wall friction',
    heatLoss: 'Heat loss',
  },
  nl: {
    clickToDrop: 'Klik ergens om ballen te laten vallen!',
    ballCount: (n) => `${n} ballen gesimuleerd, 60 keer per seconde`,
    collisions: 'Botsingen',
    wallFriction: 'Wrijving',
    heatLoss: 'Warmteverlies',
  },
  no: {
    clickToDrop: 'Klikk hvor som helst for å slippe baller!',
    ballCount: (n) => `${n} baller simulert, 60 ganger i sekundet`,
    collisions: 'Kollisjoner',
    wallFriction: 'Friksjon',
    heatLoss: 'Varmetap',
  },
};

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
}

const GRAVITY = 1800; // px/s^2
const BOUNCE_DAMPING = 0.82; // wall restitution when energy dissipates into heat
const BALL_DAMPING = 0.9; // ball-ball restitution when energy dissipates into heat
const WALL_FRICTION = 0.96; // tangential velocity kept per wall contact with friction on
const ROLL_FRICTION = 1.6; // per-second decay of rolling speed on the floor with friction on
const MAX_BALLS = 400;
const BALLS_PER_CLICK = 5;

class BounceInstance implements GameInstance {
  private ctx: CanvasRenderingContext2D;
  private balls: Ball[] = [];
  private ballCollisions = true;
  private wallFriction = true;
  private dissipate = true;
  private toolbar: HTMLElement | null = null;
  private onDown = (e: PointerEvent) => {
    const { x, y } = pointerPos(this.host.canvas, e);
    this.spawn(x, y, BALLS_PER_CLICK);
  };

  constructor(private host: GameHost) {
    this.ctx = host.canvas.getContext('2d')!;
  }

  start(): void {
    this.host.canvas.addEventListener('pointerdown', this.onDown);
    this.buildToolbar();
  }

  frame(dt: number): void {
    const { canvas, dpr } = this.host;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    for (const b of this.balls) {
      b.vy += GRAVITY * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    if (this.ballCollisions) this.collideBalls();

    const restitution = this.dissipate ? BOUNCE_DAMPING : 1;
    const tangential = this.wallFriction ? WALL_FRICTION : 1;
    for (const b of this.balls) {
      if (b.x < b.r) {
        b.x = b.r;
        b.vx = Math.abs(b.vx) * restitution;
        b.vy *= tangential;
      } else if (b.x > w - b.r) {
        b.x = w - b.r;
        b.vx = -Math.abs(b.vx) * restitution;
        b.vy *= tangential;
      }
      if (b.y > h - b.r) {
        b.y = h - b.r;
        b.vy = -Math.abs(b.vy) * restitution;
        b.vx *= tangential;
        if (this.wallFriction) {
          b.vx *= Math.max(0, 1 - ROLL_FRICTION * dt);
        }
      }
    }

    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, w, h);
    for (const b of this.balls) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${b.hue}, 85%, 65%)`;
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(238, 242, 255, 0.85)';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const T = pick(TEXT);
    const label = this.balls.length === 0 ? T.clickToDrop : T.ballCount(this.balls.length);
    ctx.fillText(label, w / 2, 40);
  }

  destroy(): void {
    this.host.canvas.removeEventListener('pointerdown', this.onDown);
  }

  /** Impulse-based pairwise collisions; mass scales with area (r^2). */
  private collideBalls(): void {
    const balls = this.balls;
    const e = this.dissipate ? BALL_DAMPING : 1;
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minD = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        const ma = a.r * a.r;
        const mb = b.r * b.r;
        const push = (minD - d) / (ma + mb);
        a.x -= nx * push * mb;
        a.y -= ny * push * mb;
        b.x += nx * push * ma;
        b.y += ny * push * ma;
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn >= 0) continue;
        const imp = (-(1 + e) * vn) / (1 / ma + 1 / mb);
        a.vx -= (imp * nx) / ma;
        a.vy -= (imp * ny) / ma;
        b.vx += (imp * nx) / mb;
        b.vy += (imp * ny) / mb;
      }
    }
  }

  private buildToolbar(): void {
    const T = pick(TEXT);
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'game-toolbar';
    const toggle = (
      emoji: string,
      label: string,
      get: () => boolean,
      flip: () => void,
    ): void => {
      const button = document.createElement('button');
      button.className = 'tool-button';
      button.classList.toggle('active', get());
      const icon = document.createElement('span');
      icon.className = 'tool-emoji';
      icon.textContent = emoji;
      const text = document.createElement('span');
      text.className = 'tool-label';
      text.textContent = label;
      button.append(icon, text);
      button.addEventListener('click', () => {
        flip();
        button.classList.toggle('active', get());
      });
      this.toolbar!.appendChild(button);
    };
    toggle(
      '🎱',
      T.collisions,
      () => this.ballCollisions,
      () => {
        this.ballCollisions = !this.ballCollisions;
      },
    );
    toggle(
      '🧤',
      T.wallFriction,
      () => this.wallFriction,
      () => {
        this.wallFriction = !this.wallFriction;
      },
    );
    toggle(
      '🔥',
      T.heatLoss,
      () => this.dissipate,
      () => {
        this.dissipate = !this.dissipate;
      },
    );
    this.host.overlay.appendChild(this.toolbar);
  }

  private spawn(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      this.balls.push({
        x,
        y,
        vx: randRange(-350, 350),
        vy: randRange(-500, 100),
        r: randRange(8, 22),
        hue: randRange(0, 360),
      });
    }
    if (this.balls.length > MAX_BALLS) {
      this.balls.splice(0, this.balls.length - MAX_BALLS);
    }
  }
}

export const bounce: ArcadeGame = {
  id: 'bounce',
  title: { en: 'Bouncy Balls', nl: 'Stuiterballen', no: 'Spretteballer' },
  scienceLine: {
    en: 'Even a bouncing ball is a simulation: position, velocity, gravity — recomputed 60 times per second.',
    nl: 'Zelfs een stuiterende bal is een simulatie: positie, snelheid, zwaartekracht — 60 keer per seconde opnieuw berekend.',
    no: 'Selv en sprettende ball er en simulering: posisjon, fart, tyngdekraft — beregnet på nytt 60 ganger i sekundet.',
  },
  tileEmoji: '🏀',
  create: (host) => new BounceInstance(host),
};
