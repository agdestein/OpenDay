// 👑 The race: your creature against today's champion of the same kind of body,
// 12 seconds, on one track with one camera, so the lead is plain to see (the
// champion runs as a golden ghost). Crowns are per kind (a frog never has to
// beat a dog; "own design" is a kind of its own) and per day, and carry the
// winner's initials. Before any kid has raced a preset today, its built-in
// champion (ROBO-PUP, ...) wears the crown; the first own design races alone.
import { Creature, FIXED_DT, type BodyPlan, type Genome } from './physics';
import { PRESETS, ROBO_NAMES, type BodyKind, type PresetId } from './presets';
import { TRAINED } from './brains';
import { pick } from '../../lib/i18n';
import { sound } from '../../lib/sound';
import { TEXT } from './text';
import { COLOR, drawCreature, drawGround, label, sx, type View } from './view';

export const RACE_TIME = 12;
const COUNTDOWN = 3;

export interface Crown {
  initials: string;
  dist: number;
  plan: BodyPlan;
  genome: Genome;
}

const key = () => `creature-crowns:${new Date().toISOString().slice(0, 10)}`;

export function loadCrowns(): Partial<Record<BodyKind, Crown>> {
  try {
    const raw = localStorage.getItem(key());
    if (!raw) return {};
    const crowns = JSON.parse(raw) as Partial<Record<BodyKind, Crown>>;
    for (const [kind, crown] of Object.entries(crowns)) {
      if (!crown?.plan?.nodes?.length || !crown.genome?.muscles) delete crowns[kind as BodyKind];
    }
    return crowns;
  } catch {
    return {};
  }
}

export function saveCrown(kind: BodyKind, crown: Crown): void {
  try {
    const crowns = loadCrowns();
    crowns[kind] = crown;
    localStorage.setItem(key(), JSON.stringify(crowns));
  } catch {
    // Storage blocked or full: the race still happened.
  }
}

export interface Champion {
  name: string;
  plan: BodyPlan;
  genome: Genome;
}

/** Who wears the crown for this kind today (null: nobody yet, for own designs). */
export function championFor(kind: BodyKind): Champion | null {
  const crown = loadCrowns()[kind];
  if (crown) return { name: crown.initials, plan: crown.plan, genome: crown.genome };
  if (kind === 'Own') return null;
  const p = PRESETS.find((x) => x.id === kind)!;
  return { name: ROBO_NAMES[kind as PresetId], plan: p.plan, genome: TRAINED[kind as PresetId] };
}

export class Race {
  readonly you: Creature;
  readonly champ: Creature | null;
  /** Seconds since GO (negative during the countdown). */
  elapsed = -COUNTDOWN;
  over = false;
  private acc = 0;
  private camX = 1;
  private zoom = 1;
  private lastBeep = COUNTDOWN + 1;

  constructor(
    plan: BodyPlan,
    genome: Genome,
    readonly champion: Champion | null,
  ) {
    this.you = new Creature(plan, genome);
    this.champ = champion ? new Creature(champion.plan, champion.genome) : null;
  }

  /** Returns true on the frame the race ends. */
  step(dt: number): boolean {
    if (this.over) return false;
    this.elapsed += dt;
    if (this.elapsed < 0) {
      const n = Math.ceil(-this.elapsed);
      if (n < this.lastBeep) {
        this.lastBeep = n;
        sound.play('tick');
      }
    } else {
      if (this.lastBeep > 0) {
        this.lastBeep = 0;
        sound.play('horn');
      }
      this.acc += Math.min(dt, this.elapsed);
      let steps = Math.min(60, Math.floor(this.acc / FIXED_DT));
      this.acc -= steps * FIXED_DT;
      const total = Math.round(RACE_TIME / FIXED_DT);
      while (steps-- > 0 && this.you.steps < total) {
        this.you.step();
        this.champ?.step();
      }
      if (this.you.steps >= total) {
        this.over = true;
        return true;
      }
    }
    const a = this.you.dist();
    const b = this.champ ? this.champ.dist() : a;
    this.camX += ((a + b) / 2 - this.camX) * Math.min(1, dt * 2.5);
    this.zoom += (1 / Math.max(1, Math.abs(a - b) / 7) - this.zoom) * Math.min(1, dt * 2);
    return false;
  }

  won(): boolean {
    return !this.champ || this.you.dist() > this.champ.dist();
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const T = pick(TEXT).race;
    const base = Math.max(40, Math.min(140, 0.19 * Math.min(w, h)));
    const v: View = { camX: Math.max(2, this.camX), scale: base * this.zoom, centerX: w / 2, groundY: h * 0.68, top: 0, height: h };
    drawGround(ctx, v, w, { metres: true, flag: true });
    if (this.champ) {
      drawCreature(ctx, v, this.champ, { alpha: 0.55, tint: COLOR.champ });
      tag(ctx, v, this.champ, T.champ(this.champion!.name), COLOR.champ);
    }
    drawCreature(ctx, v, this.you, { head: COLOR.you, glow: COLOR.you });
    tag(ctx, v, this.you, T.you, COLOR.you);
    if (this.elapsed < 0.8 && !this.over) {
      const text = this.elapsed < 0 ? `${Math.ceil(-this.elapsed)}` : T.go;
      label(ctx, text, w / 2, h * 0.42, 120, COLOR.text, 'center', 900);
    }
  }
}

function tag(ctx: CanvasRenderingContext2D, v: View, c: Creature, text: string, color: string): void {
  let top = Infinity;
  for (const p of c.pts) top = Math.min(top, v.groundY - p.y * v.scale);
  label(ctx, text, sx(v, c.comX()), top - 18, 20, color);
}
