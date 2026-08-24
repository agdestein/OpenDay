// Phase-0 placeholder game (second one, to prove game switching). Doubles as a
// first sketch of the future gravity-sandbox game from docs/ideas.md.
import type { ArcadeGame, GameHost, GameInstance } from '../../shell/types';
import { pointerPos, randRange } from '../../lib/util';

interface Planet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
  trail: { x: number; y: number }[];
}

const TRAIL_LENGTH = 90;
const SUN_RADIUS = 26;
const LAUNCH_SPEED = 3; // drag pixels -> px/s
const MAX_PLANETS = 60;

class OrbitsInstance implements GameInstance {
  private ctx: CanvasRenderingContext2D;
  private planets: Planet[] = [];
  private drag: { x: number; y: number } | null = null;
  private pointer = { x: 0, y: 0 };

  private onDown = (e: PointerEvent) => {
    this.drag = pointerPos(this.host.canvas, e);
    this.pointer = { ...this.drag };
  };
  private onMove = (e: PointerEvent) => {
    this.pointer = pointerPos(this.host.canvas, e);
  };
  private onUp = (e: PointerEvent) => {
    if (!this.drag) return;
    const p = pointerPos(this.host.canvas, e);
    this.launch(this.drag.x, this.drag.y, (p.x - this.drag.x) * LAUNCH_SPEED, (p.y - this.drag.y) * LAUNCH_SPEED);
    this.drag = null;
  };

  constructor(private host: GameHost) {
    this.ctx = host.canvas.getContext('2d')!;
  }

  start(): void {
    const { canvas } = this.host;
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    // Seed two planets on roughly circular orbits so the screen is alive immediately.
    const { w, h } = this.size();
    for (const radius of [Math.min(w, h) * 0.22, Math.min(w, h) * 0.38]) {
      const angle = randRange(0, Math.PI * 2);
      const speed = Math.sqrt(this.gm() / radius);
      this.launch(
        w / 2 + radius * Math.cos(angle),
        h / 2 + radius * Math.sin(angle),
        -speed * Math.sin(angle),
        speed * Math.cos(angle),
      );
    }
  }

  frame(dt: number): void {
    const { dpr } = this.host;
    const { w, h } = this.size();
    const cx = w / 2;
    const cy = h / 2;
    const gm = this.gm();

    for (const p of this.planets) {
      const dx = cx - p.x;
      const dy = cy - p.y;
      const r2 = Math.max(dx * dx + dy * dy, 900);
      const r = Math.sqrt(r2);
      const a = gm / r2;
      p.vx += (a * dx) / r * dt;
      p.vy += (a * dy) / r * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > TRAIL_LENGTH) p.trail.shift();
    }
    // Planets that hit the sun or fly far away disappear.
    const limit = Math.max(w, h) * 2;
    this.planets = this.planets.filter((p) => {
      const dist = Math.hypot(p.x - cx, p.y - cy);
      return dist > SUN_RADIUS + p.r && dist < limit;
    });

    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#05081a';
    ctx.fillRect(0, 0, w, h);

    // Sun.
    const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, SUN_RADIUS * 2.5);
    glow.addColorStop(0, '#fff3b0');
    glow.addColorStop(0.4, '#ffb703');
    glow.addColorStop(1, 'rgba(255, 183, 3, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, SUN_RADIUS * 2.5, 0, Math.PI * 2);
    ctx.fill();

    for (const p of this.planets) {
      if (p.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(p.trail[0].x, p.trail[0].y);
        for (const t of p.trail) ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = `hsla(${p.hue}, 80%, 70%, 0.35)`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${p.hue}, 80%, 65%)`;
      ctx.fill();
    }

    // Launch preview while dragging.
    if (this.drag) {
      ctx.beginPath();
      ctx.moveTo(this.drag.x, this.drag.y);
      ctx.lineTo(this.pointer.x, this.pointer.y);
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(238, 242, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = 'rgba(238, 242, 255, 0.85)';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Drag and release to launch a planet!', w / 2, 40);
  }

  destroy(): void {
    const { canvas } = this.host;
    canvas.removeEventListener('pointerdown', this.onDown);
    canvas.removeEventListener('pointermove', this.onMove);
    canvas.removeEventListener('pointerup', this.onUp);
  }

  private size(): { w: number; h: number } {
    return {
      w: this.host.canvas.width / this.host.dpr,
      h: this.host.canvas.height / this.host.dpr,
    };
  }

  /** Gravitational parameter tuned so nice orbits fit the screen. */
  private gm(): number {
    const { w, h } = this.size();
    return 25 * Math.min(w, h) ** 2;
  }

  private launch(x: number, y: number, vx: number, vy: number): void {
    this.planets.push({ x, y, vx, vy, r: randRange(5, 12), hue: randRange(0, 360), trail: [] });
    if (this.planets.length > MAX_PLANETS) this.planets.shift();
  }
}

export const orbits: ArcadeGame = {
  id: 'orbits',
  title: 'Gravity Doodle',
  scienceLine:
    'The same math that flings these planets around plans real space missions.',
  tileEmoji: '🪐',
  create: (host) => new OrbitsInstance(host),
};
