// Phase-0 placeholder game: proves the ArcadeGame interface and the shell's
// launch/idle/cleanup cycle. Replaced by real games in later phases.
import type { ArcadeGame, GameHost, GameInstance } from '../../shell/types';
import { pointerPos, randRange } from '../../lib/util';

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
}

const GRAVITY = 1800; // px/s^2
const BOUNCE_DAMPING = 0.82;
const MAX_BALLS = 400;
const BALLS_PER_CLICK = 5;

class BounceInstance implements GameInstance {
  private ctx: CanvasRenderingContext2D;
  private balls: Ball[] = [];
  private onDown = (e: PointerEvent) => {
    const { x, y } = pointerPos(this.host.canvas, e);
    this.spawn(x, y, BALLS_PER_CLICK);
  };

  constructor(private host: GameHost) {
    this.ctx = host.canvas.getContext('2d')!;
  }

  start(): void {
    this.host.canvas.addEventListener('pointerdown', this.onDown);
  }

  frame(dt: number): void {
    const { canvas, dpr } = this.host;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    for (const b of this.balls) {
      b.vy += GRAVITY * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < b.r) {
        b.x = b.r;
        b.vx = Math.abs(b.vx) * BOUNCE_DAMPING;
      } else if (b.x > w - b.r) {
        b.x = w - b.r;
        b.vx = -Math.abs(b.vx) * BOUNCE_DAMPING;
      }
      if (b.y > h - b.r) {
        b.y = h - b.r;
        b.vy = -Math.abs(b.vy) * BOUNCE_DAMPING;
        b.vx *= 0.99;
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
    const label =
      this.balls.length === 0
        ? 'Click anywhere to drop balls!'
        : `${this.balls.length} balls simulated, 60 times per second`;
    ctx.fillText(label, w / 2, 40);
  }

  destroy(): void {
    this.host.canvas.removeEventListener('pointerdown', this.onDown);
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
  title: 'Bouncy Balls',
  scienceLine:
    'Even a bouncing ball is a simulation: position, velocity, gravity — recomputed 60 times per second.',
  tileEmoji: '🏀',
  create: (host) => new BounceInstance(host),
};
