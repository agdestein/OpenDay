// Creature Lab — nobody can program a walk, so creatures practise in a
// simulated world, an hour of falling every minute, and keep what works.
//
// The toy is a park (park.ts): creatures on trained brains stroll about, and
// you grab, fling and startle them. ✏️ opens the body editor (editor.ts).
// 🧠 Teach it (teach.ts) evolves brains for the picked body, the kid can pick
// parents by hand, and the practice clock counts the simulated time. 👑 Race
// (race.ts) runs a trained creature against today's champion of its kind. The
// challenge is three rounds, one idea each (round*.ts); the delve explains it
// all in six chapters (delve.ts, demos.ts). Physics in physics.ts, evolution in
// evolve.ts, the pre-trained brains in brains.ts (tools/creature/train.ts).
//
// The design follows the evolve-a-walker lineage — Karl Sims' Evolved Virtual
// Creatures (1994), carykh's Evolution Simulator, Keiwan Donyagard's
// Evolution — reimplemented from scratch (see README credits).
import type { ArcadeGame, GameHost, GameInstance } from '../../shell/types';
import { scoreFlow, type ScoreFlowHandle } from '../../shell/scoreflow';
import { delvePanel, delveToggle, type DelveHandle, type DelveToggleHandle } from '../../shell/delve';
import { pick } from '../../lib/i18n';
import { sound } from '../../lib/sound';
import { pointerPos } from '../../lib/util';
import type { BodyPlan, Genome } from './physics';
import { randomGenome, type Reward } from './evolve';
import { KIND_EMOJI, KIND_NAMES, PRESETS, clonePlan, kindOf, type BodyKind } from './presets';
import { TRAINED } from './brains';
import { Park, type Walker } from './park';
import { Editor, type Tool } from './editor';
import { Teacher, type Speed } from './teach';
import { Race, RACE_TIME, championFor, loadCrowns, saveCrown } from './race';
import { TEXT, fmtMetres } from './text';
import { COLOR } from './view';
import { setLabel, toolButton, type ButtonDef, type Round, type RoundHost } from './rounds';
import { PickRound } from './roundPick';
import { WalkRound } from './roundWalk';
import { WildRound } from './roundWild';
import { creatureDelve } from './delve';
import { DESIGN_TEXT, DesignRun } from './design';
import { topScores } from '../../shell/scores';
import { CreatureDemos } from './demos';

type Mode = 'park' | 'editor' | 'teach' | 'race' | 'design';

const REWARDS: { id: Reward; emoji: string }[] = [
  { id: 'far', emoji: '🏁' },
  { id: 'ground', emoji: '👣' },
  { id: 'high', emoji: '🦘' },
  { id: 'back', emoji: '⬅️' },
];
const SPEEDS: Speed[] = ['x1', 'x3', 'turbo'];
const SPEED_EMOJI: Record<Speed, string> = { x1: '▶️', x3: '⏩', turbo: '⚡' };

const ROUNDS: ((host: RoundHost) => Round)[] = [
  (host) => new PickRound(host),
  (host) => new WalkRound(host),
  (host) => new WildRound(host),
];

interface Challenge {
  index: number;
  total: number;
  round: Round;
  card: HTMLElement | null;
  /** The computer's turn: it plays every round itself, at CPU_SPEED. */
  cpu: boolean;
  /** How long the current round card has been up (the computer moves on by itself). */
  cardAge: number;
  /** All rounds done: the total is final (the score flow is up). */
  done: boolean;
}

/** The computer plays at double speed, so the queue at the stand keeps moving. */
const CPU_SPEED = 2;
/** Seconds a round card stays up in the computer's turn. */
const CPU_CARD_SECONDS = 4;

class CreatureInstance implements GameInstance {
  private ctx!: CanvasRenderingContext2D;
  private mode: Mode = 'park';
  private time = 0;
  private w = 1;
  private h = 1;

  private park = new Park();
  private editor = new Editor(PRESETS[0].plan, () => this.refreshEditor());
  private teacher: Teacher | null = null;
  private race: Race | null = null;
  private raceFrom: 'teach' | 'park' = 'park';
  private raceWalker: Walker | null = null;
  private challenge: Challenge | null = null;
  private flow: ScoreFlowHandle | null = null;
  /** The design challenge: the editor's Done tests the body; a run practises and crosses the course. */
  private designing = false;
  private designRun: DesignRun | null = null;

  private delve: DelveHandle | null = null;
  private toggle!: DelveToggleHandle;
  private demos = new CreatureDemos();

  private bodyBar!: HTMLElement;
  private parkBar!: HTMLElement;
  private editPresets!: HTMLElement;
  private editBar!: HTMLElement;
  private rewardBar!: HTMLElement;
  private practiceBar!: HTMLElement;
  private teachBar!: HTMLElement;
  private roundBar!: HTMLElement;
  private designBar!: HTMLElement;
  private hud!: HTMLElement;
  private hint!: HTMLElement;
  private buttons: Record<string, HTMLButtonElement> = {};
  private hintTimer = 0;

  constructor(private host: GameHost) {}

  start(): void {
    this.ctx = this.host.canvas.getContext('2d')!;
    this.buildUi();
    const c = this.host.canvas;
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onUp);
    c.addEventListener('pointerleave', this.onLeave);
    this.measure();
    this.fillPark();
    this.enterPark();
  }

  destroy(): void {
    const c = this.host.canvas;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('pointercancel', this.onUp);
    c.removeEventListener('pointerleave', this.onLeave);
    this.flow?.dispose();
    this.delve?.dispose();
    this.challenge?.round.dispose();
  }

  // ---- frame ----

  private measure(): void {
    const { canvas, dpr } = this.host;
    this.w = canvas.width / dpr;
    this.h = canvas.height / dpr;
    this.park.layout(this.w, this.h);
    this.editor.layout(this.w, this.h);
    this.teacher?.layout(this.w, this.h);
  }

  frame(dt: number): void {
    this.time += dt;
    this.measure();
    const { w, h } = this;
    const ctx = this.ctx;
    ctx.setTransform(this.host.dpr, 0, 0, this.host.dpr, 0, 0);
    ctx.fillStyle = COLOR.background;
    ctx.fillRect(0, 0, w, h);

    if (this.delve) {
      this.demos.step(dt);
      this.demos.draw(ctx, w, h);
      return;
    }
    const ch = this.challenge;
    if (ch) {
      ch.round.step(ch.cpu ? dt * CPU_SPEED : dt);
      ch.round.draw(ctx, w, h);
      if (ch.cpu && ch.card) {
        ch.cardAge += dt;
        if (ch.cardAge > CPU_CARD_SECONDS) (ch.index === ROUNDS.length - 1 ? this.finishChallenge() : this.nextRound());
      }
      const T = pick(TEXT).challenge;
      this.setHud(
        [ch.cpu ? T.cpuPlaying : T.round(ch.index + 1, ROUNDS.length), ch.round.title, ch.round.hud(), `⭐ ${ch.total + (ch.card || ch.done ? 0 : ch.round.score)}`]
          .filter(Boolean)
          .join('   ·   '),
      );
      return;
    }
    if (this.mode === 'park') {
      this.park.step(dt);
      this.park.draw(ctx, w, h, (walker) => this.walkerName(walker));
      if (this.park.grabbed && this.hintTimer === 0) this.hintTimer = 0.01;
      if (this.hintTimer > 0) {
        this.hintTimer += dt;
        if (this.hintTimer > 4) this.parkHint();
      }
    } else if (this.mode === 'editor') {
      this.editor.draw(ctx, w, this.time);
      const n = this.editor.counts();
      this.setHud(`🦴 ${n.bones}  💪 ${n.muscles}  ⚪ ${n.nodes}/${n.maxNodes}`);
    } else if (this.mode === 'teach' && this.teacher) {
      this.teacher.step(dt);
      this.teacher.draw(ctx);
      this.setHud(this.teacher.hud());
    } else if (this.mode === 'design' && this.designRun) {
      const run = this.designRun;
      const wasDone = run.phase === 'done';
      run.step(dt);
      run.draw(ctx, w, h);
      if (!wasDone && run.phase === 'done') this.designBar.classList.remove('hidden');
      this.setHud(pick(DESIGN_TEXT).hud(this.designBest()));
    } else if (this.mode === 'race' && this.race) {
      if (this.race.step(dt)) this.finishRace();
      this.race.draw(ctx, w, h);
      const r = this.race;
      this.setHud(pick(TEXT).race.hud(Math.max(0, Math.min(RACE_TIME, RACE_TIME - r.elapsed)), r.you.dist(), r.champ ? r.champ.dist() : null));
    }
  }

  private setHud(text: string): void {
    if (this.hud.textContent !== text) this.hud.textContent = text;
  }

  private walkerName(walker: Walker): string | null {
    const T = pick(TEXT).park;
    if (walker.tag) return `👑 ${walker.tag}`;
    if (walker === this.park.selected) return walker.mine ? T.mine : T.you;
    return null;
  }

  // ---- input ----

  private blocked(): boolean {
    return this.flow !== null || this.challenge?.card != null;
  }

  private onDown = (e: PointerEvent) => {
    if (this.blocked()) return;
    const p = pointerPos(this.host.canvas, e);
    try {
      this.host.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic or already-gone pointer: moves over the canvas still arrive.
    }
    if (this.delve) {
      this.demos.down(p.x, p.y);
      return;
    }
    if (this.challenge) {
      this.challenge.round.down(p.x, p.y);
      return;
    }
    if (this.mode === 'park') {
      this.park.down(p.x, p.y);
      this.refreshPark();
    } else if (this.mode === 'editor') this.editor.down(p.x, p.y);
    else if (this.mode === 'teach') this.teacher?.down(p.x, p.y);
  };

  private onMove = (e: PointerEvent) => {
    const p = pointerPos(this.host.canvas, e);
    if (this.delve) {
      this.demos.move(p.x, p.y);
      return;
    }
    if (this.challenge) {
      this.challenge.round.move(p.x, p.y);
      return;
    }
    if (this.mode === 'park') this.park.move(p.x, p.y);
    else if (this.mode === 'editor') this.editor.move(p.x, p.y);
    else if (this.mode === 'teach') this.teacher?.move(p.x, p.y);
  };

  private onUp = () => {
    if (this.delve) this.demos.up();
    else if (this.challenge) this.challenge.round.up();
    else if (this.mode === 'park') this.park.up();
    else if (this.mode === 'editor') this.editor.up();
  };

  private onLeave = () => {
    this.park.leave();
    this.teacher?.leave();
  };

  // ---- the park ----

  /** The four presets on their trained brains; today's champions wear their crowns. */
  private fillPark(): void {
    const crowns = loadCrowns();
    PRESETS.forEach((p, i) => {
      const crown = crowns[p.id];
      const x = this.park.width * (0.15 + 0.22 * i);
      const walker = crown
        ? this.park.add(crown.plan, crown.genome, p.id, { tag: crown.initials, x })
        : this.park.add(p.plan, TRAINED[p.id], p.id, { x });
      if (i === 0) this.park.selected = walker;
    });
    const own = crowns.Own;
    if (own) this.park.add(own.plan, own.genome, 'Own', { tag: own.initials, drop: true });
  }

  private hidePanels(): void {
    for (const el of [this.bodyBar, this.parkBar, this.editPresets, this.editBar, this.rewardBar, this.practiceBar, this.teachBar, this.roundBar, this.designBar]) {
      el.classList.add('hidden');
    }
  }

  private enterPark(hint?: string): void {
    this.mode = 'park';
    this.teacher = null;
    this.race = null;
    this.designing = false;
    this.designRun = null;
    this.refreshEditor();
    this.hidePanels();
    this.bodyBar.classList.remove('hidden');
    this.parkBar.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.toggle.element.classList.remove('hidden');
    this.refreshPark();
    if (hint) {
      this.hint.textContent = hint;
      this.hintTimer = 0.01;
    } else {
      this.hintTimer = 0;
      this.hint.textContent = pick(TEXT).park.hint;
    }
  }

  private parkHint(): void {
    this.hintTimer = -1;
    const sel = this.park.selected;
    this.hint.textContent = sel ? pick(TEXT).park.selectedHint(this.kindName(sel.kind)) : pick(TEXT).park.hint;
  }

  private kindName(kind: BodyKind): string {
    return `${KIND_EMOJI[kind]} ${pick(KIND_NAMES)[kind]}`;
  }

  private refreshPark(): void {
    const sel = this.park.selected;
    const race = this.buttons.race;
    // A crown holder would only race itself.
    race.disabled = !sel?.mine || !!sel.tag;
    setLabel(race, sel?.tag ? pick(TEXT).park.crowned : sel?.mine ? pick(TEXT).park.race : pick(TEXT).park.raceFirst);
    this.buttons.teach.disabled = !sel;
    if (this.hintTimer < 0) this.parkHint();
  }

  private addPreset(index: number): void {
    const p = PRESETS[index];
    this.park.add(p.plan, TRAINED[p.id], p.id, { drop: true, select: true });
    sound.play('boing');
    this.hintTimer = -1;
    this.refreshPark();
  }

  // ---- the editor ----

  private enterEditor(plan?: BodyPlan): void {
    this.mode = 'editor';
    this.hidePanels();
    const sel = this.park.selected;
    this.editor.load(plan ?? (sel ? sel.plan : PRESETS[0].plan));
    this.toggle.element.classList.remove('hidden');
    this.editPresets.classList.remove('hidden');
    this.editBar.classList.remove('hidden');
    this.hud.classList.remove('hidden');
    this.setTool('draw');
  }

  private setTool(tool: Tool): void {
    this.editor.tool = tool;
    for (const key of ['draw', 'move', 'type', 'erase'] as const) this.buttons[key].classList.toggle('active', key === tool);
    const hint = pick(TEXT).editor.hint;
    this.hint.textContent = { draw: hint.draw, move: hint.move, type: hint.type, erase: hint.erase }[tool];
  }

  private refreshEditor(): void {
    const done = this.buttons.editDone;
    if (!done) return;
    const T = pick(TEXT).editor;
    done.disabled = !this.editor.valid();
    setLabel(done, done.disabled ? T.needsMuscle : this.designing ? pick(DESIGN_TEXT).test : T.done);
    done.querySelector('.tool-emoji')!.textContent = this.designing ? '⛰️' : '✅';
    this.buttons.undo.disabled = !this.editor.canUndo();
  }

  private finishEditor(): void {
    if (!this.editor.valid()) return;
    const plan = this.editor.result();
    if (this.designing) {
      this.startDesignRun(plan);
      return;
    }
    const kind = kindOf(plan);
    this.park.add(plan, randomGenome(plan), kind, { drop: true, select: true });
    sound.play('boing');
    this.enterPark(pick(TEXT).editor.doneHint);
  }

  // ---- the design challenge ----

  /** Build a body that crosses the bumps, practising only on a flat floor. It starts from the Doggo, which trips. */
  private startDesign(plan: BodyPlan = PRESETS[0].plan): void {
    this.enterEditor(plan);
    this.designing = true;
    this.refreshEditor();
    this.hint.textContent = pick(DESIGN_TEXT).brief;
  }

  private startDesignRun(plan: BodyPlan): void {
    this.mode = 'design';
    this.hidePanels();
    this.hud.classList.remove('hidden');
    this.toggle.element.classList.add('hidden');
    this.designRun = new DesignRun(plan, (text) => (this.hint.textContent = text));
  }

  private designBest(): string {
    const top = topScores('creature-design', 1)[0];
    return top ? `${top.initials} ${fmtMetres(top.score)}` : '—';
  }

  /** The tried design walks in the park with its brain, as the kid's own. */
  private designToPark(): void {
    const run = this.designRun;
    if (run?.genome) this.park.add(run.plan, run.genome, kindOf(run.plan), { drop: true, select: true, mine: true });
    this.toggle.element.classList.remove('hidden');
    this.enterPark();
  }

  private designToBoard(): void {
    const run = this.designRun;
    if (!run) return;
    const T = pick(DESIGN_TEXT);
    this.designBar.classList.add('hidden');
    this.flow?.dispose();
    this.flow = scoreFlow({
      gameId: 'creature-design',
      heading: T.heading,
      score: run.dist,
      scoreLabel: fmtMetres(run.dist),
      formatScore: (sc) => fmtMetres(sc),
      actions: [
        { label: `✏️ ${T.change}`, onClick: () => this.closeFlow(() => this.startDesign(run.plan)) },
        { label: `🌳 ${T.park}`, onClick: () => this.closeFlow(() => this.designToPark()) },
      ],
    });
    this.host.overlay.appendChild(this.flow.element);
  }

  // ---- teaching ----

  private enterTeach(teacher?: Teacher): void {
    const sel = this.park.selected;
    let hint = pick(TEXT).teach.hint;
    if (!teacher) {
      if (!sel) return;
      const plan = clonePlan(sel.plan);
      // A kid's own creature carries on from its brain; everyone else starts from scratch.
      teacher = new Teacher(plan, kindOf(plan), sel.mine ? { start: sel.genome } : {});
      if (sel.mine) hint = pick(TEXT).teach.carryOn;
    }
    this.teacher = teacher;
    teacher.layout(this.w, this.h);
    this.mode = 'teach';
    this.hidePanels();
    this.rewardBar.classList.remove('hidden');
    this.practiceBar.classList.remove('hidden');
    this.teachBar.classList.remove('hidden');
    this.hud.classList.remove('hidden');
    this.toggle.element.classList.remove('hidden');
    this.hint.textContent = hint;
    this.refreshTeach();
  }

  private refreshTeach(): void {
    const t = this.teacher;
    if (!t) return;
    const T = pick(TEXT).teach;
    for (const r of REWARDS) this.buttons[`reward-${r.id}`].classList.toggle('active', r.id === t.evo.reward);
    this.buttons.senses.classList.toggle('active', t.evo.brain() === 'feel');
    this.buttons.shoves.classList.toggle('active', t.evo.shoving);
    const speed = this.buttons.speed;
    speed.querySelector('.tool-emoji')!.textContent = SPEED_EMOJI[t.speed];
    setLabel(speed, T.speed(t.speed));
    speed.classList.toggle('active', t.speed === 'turbo');
  }

  private setReward(reward: Reward): void {
    if (!this.teacher) return;
    this.teacher.setReward(reward);
    this.hint.textContent = pick(TEXT).teach.rewardHint[reward];
    sound.play('click');
    this.refreshTeach();
  }

  private toggleSenses(): void {
    const t = this.teacher;
    if (!t) return;
    const on = t.evo.brain() !== 'feel';
    t.setBrain(on ? 'feel' : 'rhythm');
    this.hint.textContent = pick(TEXT).teach.sensesHint(on);
    sound.play(on ? 'ding' : 'click');
    this.refreshTeach();
  }

  private toggleShoves(): void {
    const t = this.teacher;
    if (!t) return;
    const on = !t.evo.shoving;
    t.evo.setShoves(on);
    this.hint.textContent = pick(TEXT).teach.shovesHint(on);
    sound.play(on ? 'whoosh' : 'click');
    this.refreshTeach();
  }

  private cycleSpeed(): void {
    const t = this.teacher;
    if (!t) return;
    t.speed = SPEEDS[(SPEEDS.indexOf(t.speed) + 1) % SPEEDS.length];
    sound.play(t.speed === 'turbo' ? 'whoosh' : 'click');
    this.refreshTeach();
  }

  /** The trained brain: the best so far, or this moment's leader. */
  private taught(): { plan: BodyPlan; genome: Genome } | null {
    const t = this.teacher;
    if (!t) return null;
    const genome = t.evo.best?.genome ?? t.evo.genomes[t.evo.leader()];
    return { plan: t.plan, genome };
  }

  /** Back to the park with the trained creature: it takes the picked one's place. */
  private finishTeach(): void {
    const taught = this.taught();
    if (!taught) return;
    const kind = kindOf(taught.plan);
    const sel = this.park.selected;
    const walker =
      sel && !sel.tag
        ? this.park.replace(sel, taught.plan, taught.genome, kind, true)
        : this.park.add(taught.plan, taught.genome, kind, { drop: true, mine: true });
    this.park.selected = walker;
    this.enterPark(pick(TEXT).teach.doneHint);
  }

  // ---- the race ----

  private startRace(from: 'teach' | 'park'): void {
    let plan: BodyPlan;
    let genome: Genome;
    if (from === 'teach') {
      const taught = this.taught();
      if (!taught) return;
      ({ plan, genome } = taught);
      this.raceWalker = null;
    } else {
      const sel = this.park.selected;
      if (!sel?.mine) return;
      ({ plan, genome } = sel);
      this.raceWalker = sel;
    }
    const kind = kindOf(plan);
    const champion = championFor(kind);
    this.race = new Race(plan, genome, champion);
    this.raceFrom = from;
    this.mode = 'race';
    this.hidePanels();
    this.hud.classList.remove('hidden');
    this.toggle.element.classList.add('hidden');
    this.hint.textContent = champion ? pick(TEXT).race.hint : pick(TEXT).race.soloHint;
  }

  private finishRace(): void {
    const race = this.race;
    if (!race) return;
    const T = pick(TEXT).race;
    const kind = kindOf(race.you.plan);
    const you = race.you.dist();
    const champ = race.champ ? race.champ.dist() : null;
    const won = race.won();
    const crown = { dist: you, plan: clonePlan(race.you.plan), genome: race.you.genome };
    // Crowned at once (a kid may walk away before typing a name), named when the initials come.
    if (won) saveCrown(kind, { initials: '???', ...crown });
    this.hint.textContent = '';
    this.flow?.dispose();
    this.flow = scoreFlow({
      gameId: `creature-race-${kind}`,
      heading: won ? (race.champion ? T.winHeading : T.firstHeading) : T.loseHeading,
      score: Math.max(0, you),
      scoreLabel: T.scoreLabel(you, champ),
      formatScore: (s) => `${KIND_EMOJI[kind]} ${fmtMetres(s)}`,
      onInitials: (initials) => {
        if (won) {
          saveCrown(kind, { initials, ...crown });
          this.crownInPark(kind, initials, crown.plan, crown.genome);
        }
      },
      actions: [
        ...(this.raceFrom === 'teach' && this.teacher
          ? [{ label: T.trainMore, onClick: () => this.closeFlow(() => this.enterTeach(this.teacher!)) }]
          : []),
        {
          label: T.toPark,
          onClick: () =>
            this.closeFlow(() => {
              // A winner is already in the park with its crown; a loser comes home as the kid's own.
              if (this.raceFrom === 'teach' && !won) this.finishTeach();
              else this.enterPark();
            }),
        },
      ],
    });
    this.host.overlay.appendChild(this.flow.element);
  }

  /** The new champion walks in the park with its crown (replacing the old champion). */
  private crownInPark(kind: BodyKind, initials: string, plan: BodyPlan, genome: Genome): void {
    for (const w of [...this.park.walkers]) if (w.kind === kind && w.tag) this.park.remove(w);
    if (this.raceWalker && this.park.walkers.includes(this.raceWalker)) this.park.remove(this.raceWalker);
    const walker = this.park.add(plan, genome, kind, { tag: initials, mine: true, drop: true });
    this.park.selected = walker;
  }

  private closeFlow(then: () => void): void {
    this.flow?.dispose();
    this.flow = null;
    this.race = null;
    then();
  }

  // ---- challenge ----

  private roundHost(): RoundHost {
    return {
      hint: (text) => (this.hint.textContent = text),
      buttons: (defs) => this.roundButtons(defs),
      finish: (score, summary) => this.roundOver(score, summary),
      auto: () => this.challenge?.cpu ?? false,
    };
  }

  private startChallenge(cpu = false): void {
    this.closeDelve();
    this.flow?.dispose();
    this.flow = null;
    this.challenge?.round.dispose();
    this.challenge?.card?.remove();
    this.hidePanels();
    this.toggle.element.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.roundBar.classList.remove('hidden');
    this.challenge = { index: 0, total: 0, round: ROUNDS[0](this.roundHost()), card: null, cpu, cardAge: 0, done: false };
  }

  private nextRound(): void {
    const ch = this.challenge;
    if (!ch) return;
    ch.card?.remove();
    ch.card = null;
    ch.cardAge = 0;
    ch.round.dispose();
    ch.index++;
    this.roundBar.classList.remove('hidden');
    ch.round = ROUNDS[ch.index](this.roundHost());
  }

  private roundOver(score: number, summary: string): void {
    const ch = this.challenge;
    if (!ch || ch.card) return;
    ch.total += score;
    const T = pick(TEXT).challenge;
    this.roundBar.classList.add('hidden');
    this.hint.textContent = '';
    const last = ch.index === ROUNDS.length - 1;
    const card = document.createElement('div');
    card.className = 'score-flow';
    const heading = document.createElement('h2');
    heading.textContent = ch.round.title;
    const points = document.createElement('div');
    points.className = 'score-flow-score';
    points.textContent = T.roundPoints(score);
    const text = document.createElement('p');
    text.className = 'score-flow-prompt';
    text.style.maxWidth = '32rem';
    text.textContent = summary;
    const actions = document.createElement('div');
    actions.className = 'score-flow-actions';
    const next = document.createElement('button');
    next.className = 'arcade-button';
    next.textContent = last ? T.finalScore : T.nextRound;
    next.addEventListener('click', () => (last ? this.finishChallenge() : this.nextRound()));
    actions.appendChild(next);
    card.append(heading, points, text, actions);
    ch.card = card;
    this.host.overlay.appendChild(card);
    sound.play('cheer');
  }

  private finishChallenge(): void {
    const ch = this.challenge;
    if (!ch) return;
    ch.card?.remove();
    ch.card = null;
    ch.done = true;
    const T = pick(TEXT).challenge;
    this.flow = scoreFlow({
      gameId: 'creature',
      heading: ch.cpu ? T.cpuDone : T.heading,
      score: ch.total,
      scoreLabel: T.points(ch.total),
      // The computer posts under CPU and keeps only its best, as in the other games.
      presetInitials: ch.cpu ? 'CPU' : undefined,
      actions: [
        { label: T.playAgain, onClick: () => this.startChallenge(false) },
        ch.cpu
          ? { label: T.cpuAgain, onClick: () => this.startChallenge(true) }
          : { label: T.computersTurn, onClick: () => this.startChallenge(true) },
        { label: T.freePlay, onClick: () => this.exitChallenge() },
      ],
    });
    this.host.overlay.appendChild(this.flow.element);
  }

  private exitChallenge(): void {
    this.flow?.dispose();
    this.flow = null;
    const ch = this.challenge;
    if (ch) {
      ch.card?.remove();
      ch.round.dispose();
    }
    this.challenge = null;
    this.enterPark();
  }

  /** The round's buttons, then Stop. */
  private roundButtons(defs: ButtonDef[]): HTMLButtonElement[] {
    this.roundBar.replaceChildren();
    const buttons = defs.map((def) => this.makeButton(this.roundBar, def));
    this.makeButton(this.roundBar, { emoji: '⏹', label: pick(TEXT).challenge.stop, onClick: () => this.exitChallenge() });
    return buttons;
  }

  // ---- delve ----

  private openDelve(): void {
    if (this.delve || this.challenge || this.mode === 'race') return;
    this.park.up();
    this.hidePanels();
    this.hud.classList.add('hidden');
    this.hint.textContent = '';
    const best = this.teacher?.evo.best;
    this.demos.setOwnBrain(best && this.teacher ? { plan: this.teacher.plan, genome: best.genome } : null);
    this.delve = delvePanel({
      heading: creatureDelve.heading(),
      chapters: creatureDelve.chapters({
        demos: this.demos,
        hasGame: (id) => this.host.hasGame(id),
        openGame: (id) => this.host.openGame(id),
      }),
      onChapter: (i) => this.demos.reset(i),
      onExit: () => this.closeDelve(),
    });
    this.host.overlay.appendChild(this.delve.element);
    this.toggle.setOpen(true);
  }

  private closeDelve(): void {
    if (!this.delve) return;
    this.delve.dispose();
    this.delve = null;
    this.demos.clear();
    this.toggle.setOpen(false);
    if (this.mode === 'teach' && this.teacher) this.enterTeach(this.teacher);
    else if (this.mode === 'editor') {
      this.enterEditor(this.editor.plan);
      if (this.designing) this.hint.textContent = pick(DESIGN_TEXT).brief;
    } else this.enterPark();
  }

  // ---- UI ----

  private makeButton(bar: HTMLElement, def: ButtonDef, key?: string): HTMLButtonElement {
    const button = toolButton(def.emoji, def.label);
    if (def.onClick) button.addEventListener('click', def.onClick);
    bar.appendChild(button);
    if (key) this.buttons[key] = button;
    return button;
  }

  private buildUi(): void {
    const T = pick(TEXT);
    const bar = (className: string) => {
      const el = document.createElement('div');
      el.className = className;
      return el;
    };

    this.bodyBar = bar('game-toolbar creature-presets');
    PRESETS.forEach((p, i) =>
      this.makeButton(this.bodyBar, { emoji: p.emoji, label: pick(KIND_NAMES)[p.id], onClick: () => this.addPreset(i) }),
    );
    this.makeButton(this.bodyBar, { emoji: '✏️', label: T.park.draw, onClick: () => this.enterEditor() });

    this.parkBar = bar('game-toolbar');
    this.makeButton(this.parkBar, { emoji: '🧠', label: T.park.teach, onClick: () => this.enterTeach() }, 'teach');
    this.makeButton(this.parkBar, { emoji: '👑', label: T.park.race, onClick: () => this.startRace('park') }, 'race');
    this.makeButton(this.parkBar, { emoji: '🏆', label: T.park.challenge, onClick: () => this.startChallenge(false) });
    this.makeButton(this.parkBar, { emoji: '⛰️', label: pick(DESIGN_TEXT).button, onClick: () => this.startDesign() });

    this.editPresets = bar('game-toolbar creature-presets hidden');
    for (const p of PRESETS) {
      this.makeButton(this.editPresets, { emoji: p.emoji, label: pick(KIND_NAMES)[p.id], onClick: () => this.editor.load(p.plan) });
    }
    this.editBar = bar('game-toolbar hidden');
    this.makeButton(this.editBar, { emoji: '✏️', label: T.editor.draw, onClick: () => this.setTool('draw') }, 'draw');
    this.makeButton(this.editBar, { emoji: '✋', label: T.editor.move, onClick: () => this.setTool('move') }, 'move');
    this.makeButton(this.editBar, { emoji: '💪', label: T.editor.boneMuscle, onClick: () => this.setTool('type') }, 'type');
    this.makeButton(this.editBar, { emoji: '🧽', label: T.editor.erase, onClick: () => this.setTool('erase') }, 'erase');
    this.makeButton(this.editBar, { emoji: '↩️', label: T.editor.undo, onClick: () => this.editor.undo() }, 'undo');
    this.makeButton(this.editBar, { emoji: '🗑️', label: T.editor.clear, onClick: () => this.editor.clear() });
    this.makeButton(this.editBar, { emoji: '✅', label: T.editor.done, onClick: () => this.finishEditor() }, 'editDone');

    this.rewardBar = bar('game-toolbar creature-presets hidden');
    for (const r of REWARDS) {
      this.makeButton(this.rewardBar, { emoji: r.emoji, label: T.teach.reward[r.id], onClick: () => this.setReward(r.id) }, `reward-${r.id}`);
    }
    // Brains that feel, and rough practice (phase C).
    this.practiceBar = bar('game-toolbar creature-practice hidden');
    this.makeButton(this.practiceBar, { emoji: '👁', label: T.teach.senses, onClick: () => this.toggleSenses() }, 'senses');
    this.makeButton(this.practiceBar, { emoji: '💨', label: T.teach.shoves, onClick: () => this.toggleShoves() }, 'shoves');
    this.teachBar = bar('game-toolbar hidden');
    this.makeButton(this.teachBar, { emoji: '⏩', label: T.teach.speed('x3'), onClick: () => this.cycleSpeed() }, 'speed');
    this.makeButton(this.teachBar, { emoji: '✅', label: T.teach.done, onClick: () => this.finishTeach() });
    this.makeButton(this.teachBar, { emoji: '👑', label: T.teach.race, onClick: () => this.startRace('teach') });

    this.roundBar = bar('game-toolbar hidden');

    const D = pick(DESIGN_TEXT);
    this.designBar = bar('game-toolbar hidden');
    this.makeButton(this.designBar, { emoji: '✏️', label: D.change, onClick: () => this.designRun && this.startDesign(this.designRun.plan) });
    this.makeButton(this.designBar, { emoji: '🏆', label: D.board, onClick: () => this.designToBoard() });
    this.makeButton(this.designBar, { emoji: '🌳', label: D.park, onClick: () => this.designToPark() });

    this.hud = bar('challenge-hud hidden');
    this.hint = document.createElement('p');
    this.hint.className = 'challenge-hint';
    this.toggle = delveToggle(() => (this.delve ? this.closeDelve() : this.openDelve()));
    this.host.overlay.append(
      this.bodyBar,
      this.parkBar,
      this.editPresets,
      this.editBar,
      this.rewardBar,
      this.practiceBar,
      this.teachBar,
      this.roundBar,
      this.designBar,
      this.hud,
      this.hint,
      this.toggle.element,
    );
    this.refreshEditor();
  }
}

export const creature: ArcadeGame = {
  id: 'creature',
  title: { en: 'Creature Lab', nl: 'Beestenlab', no: 'Skapningslab' },
  scienceLine: {
    en: 'Nobody can program a walk. So these creatures practise in a simulated world — an hour of falling every minute — and keep what works. Real robots learn to walk in simulations first, too.',
    nl: 'Niemand kan lopen programmeren. Daarom oefenen deze beestjes in een gesimuleerde wereld — een uur vallen per minuut — en houden ze wat werkt. Echte robots leren ook eerst lopen in een simulatie.',
    no: 'Ingen kan programmere det å gå. Derfor øver disse skapningene i en simulert verden — en time med fall hvert minutt — og beholder det som virker. Ekte roboter lærer også å gå i simuleringer først.',
  },
  tileEmoji: '🦿',
  create: (host) => new CreatureInstance(host),
};
