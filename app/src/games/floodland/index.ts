import type { ArcadeGame, GameHost, GameInstance } from '../../shell/types';
import { pick } from '../../lib/i18n';
import { GRID_W as W, GRID_H as H } from './water';
import { BUDGET, HOMES, PUMP, stormDuration, totalDuration, sandPlan, placeSand, SAND_RATE, makeScene, resetWater, type Scenario, type Point } from './scene';
import { FloodRecording } from './recording';
import { text } from './text';
import './style.css';

class FloodInstance implements GameInstance {
  private scenario: Scenario = 'surge';
  private sim = makeScene();
  private get duration(): number { return totalDuration(this.scenario); }
  private get recovering(): boolean { return this.elapsed >= stormDuration(this.scenario); }
  private base = this.sim.terrain.slice();
  private ctx!: CanvasRenderingContext2D;
  private ui!: HTMLDivElement;
  private phase: 'build' | 'calculating' | 'storm' | 'end' = 'build';
  private elapsed = 0;
  private paused = false;
  private fast = false;
  private model = false;
  private budget = BUDGET;
  private strokeStart: { terrain: Float64Array; budget: number } | null = null;
  private livePumpRate = 0;
  private more!: HTMLDetailsElement;
  private playback!: HTMLElement;
  private stormDialog!: HTMLDialogElement;
  private strokes: { terrain: Float64Array; budget: number }[] = [];
  private path: Point[] = [];
  private plan = new Map<number, number>();
  private pointer: Point | null = null;
  private flooded = new Set<number>();
  private recording: FloodRecording | null = null;
  private recordingJob: AbortController | null = null;
  private error = '';
  private transform = { scale: 1, ox: 0, oy: 0 };
  private buttons: Record<string, HTMLButtonElement> = {};
  private status!: HTMLElement;
  private stats!: HTMLElement;
  private timebar!: HTMLElement;
  private timeline!: HTMLInputElement;
  private inspection!: HTMLElement;
  private down = (e: PointerEvent) => {
    if (!e.isPrimary || e.button !== 0 || this.strokeStart) return;
    const p = this.hit(e);
    if (!p) return;
    this.pointer = p;
    if (this.phase !== 'build') return;
    this.more.open = false;
    this.host.canvas.setPointerCapture(e.pointerId);
    this.strokeStart = { terrain: this.sim.terrain.slice(), budget: this.budget };
    this.path = [p]; this.error = '';
    this.budget -= placeSand(this.sim, this.path, .06, this.budget);
    this.preview();
  };
  private move = (e: PointerEvent) => {
    if (!e.isPrimary) return;
    const p = this.hit(e); this.pointer = p;
    if (this.strokeStart && p) this.path.push(p);
    this.preview();
  };
  private finishStroke(): void {
    if (this.strokeStart && this.budget < this.strokeStart.budget) this.strokes.push(this.strokeStart);
    this.strokeStart = null; this.path = [];
  }
  private up = () => { this.finishStroke(); this.preview(); };
  private cancel = () => { this.finishStroke(); this.plan.clear(); this.pointer = null; };
  private leave = () => { if (!this.strokeStart) this.cancel(); };
  constructor(private host: GameHost) {}
  start(): void {
    this.ctx = this.host.canvas.getContext('2d')!;
    this.host.canvas.style.touchAction = 'none';
    this.host.canvas.setAttribute('aria-label', pick(floodland.title));
    this.ui = document.createElement('div'); this.ui.className = 'delta-ui';
    const header = document.createElement('header'); header.className = 'delta-header';
    const title = document.createElement('div');
    const eyebrow = document.createElement('small'); eyebrow.textContent = text().subtitle;
    const heading = document.createElement('h1'); heading.textContent = pick(floodland.title);
    title.append(eyebrow, heading);
    this.stats = document.createElement('div'); this.stats.className = 'delta-stats';
    header.append(title, this.stats);
    const tools = document.createElement('div'); tools.className = 'delta-tools';
    this.more = document.createElement('details'); this.more.className = 'delta-more';
    const summary = document.createElement('summary'); summary.textContent = text().more;
    const extras = document.createElement('div'); extras.className = 'delta-extra-controls';
    const explanation = document.createElement('p'); explanation.textContent = text().systemHint;
    const panel = document.createElement('div'); panel.className = 'delta-more-panel'; panel.append(explanation, extras);
    this.more.append(summary, panel);
    this.more.addEventListener('keydown', e => { if (e.key === 'Escape') { this.more.open = false; summary.focus(); } });
    const button = (key: string, label: string, fn: () => void, parent: HTMLElement = tools) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.addEventListener('click', () => { this.cancel(); fn(); this.updateUI(); });
      parent.appendChild(b); this.buttons[key] = b; return b;
    };
    button('storm', text().storm, () => { this.more.open = false; this.stormDialog.showModal(); });
    button('rewind', text().rewind, () => this.rewind());
    button('undo', text().undo, () => { const s = this.strokes.pop(); if (s) { this.sim.terrain.set(s.terrain); this.budget = s.budget; resetWater(this.sim); } });
    this.playback = document.createElement('div'); this.playback.className = 'delta-playback delta-tools';
    this.playback.setAttribute('role', 'group'); this.playback.setAttribute('aria-label', text().playback);
    const icon = (key: string, symbol: string, label: string, fn: () => void) => {
      const b = button(key, symbol, fn, this.playback); b.setAttribute('aria-label', label); b.title = label;
    };
    icon('back', '↶', text().back, () => { this.paused = true; this.seek(this.elapsed - 5); });
    icon('pause', 'Ⅱ', text().pause, () => { if (this.phase === 'end') { this.seek(0); this.paused = false; } else this.paused = !this.paused; });
    icon('forward', '↷', text().forward, () => { this.paused = true; this.seek(this.elapsed + 5); });
    icon('fast', '» ×4', text().fast, () => { this.fast = !this.fast; });
    this.stormDialog = document.createElement('dialog'); this.stormDialog.className = 'delta-storm-dialog';
    this.stormDialog.setAttribute('aria-labelledby', 'delta-storm-title');
    this.stormDialog.addEventListener('keydown', e => { if (e.key === 'Escape') e.stopPropagation(); });
    const dialogTitle = document.createElement('h2'); dialogTitle.id = 'delta-storm-title'; dialogTitle.textContent = text().scenario;
    this.stormDialog.append(dialogTitle);
    const choices = document.createElement('div'); choices.className = 'delta-storm-choices'; this.stormDialog.append(choices);
    for (const [value, label] of [['surge', text().surgeMode], ['waves', text().wavesMode]] as const) {
      const choice = button(value, label, () => {
        this.scenario = value; this.timeline.max = String(this.duration);
        this.stormDialog.close(); void this.startStorm();
      }, choices);
      choice.setAttribute('aria-label', label);
      const name = document.createElement('strong'); name.textContent = label;
      const description = document.createElement('span'); description.textContent = value === 'surge' ? text().surgeDescription : text().wavesDescription;
      description.id = `delta-${value}-description`; choice.setAttribute('aria-describedby', description.id);
      choice.replaceChildren(name, description);
    }
    button('cancelStorm', text().cancel, () => this.stormDialog.close(), this.stormDialog);
    button('model', text().model, () => { this.model = !this.model; });
    button('reset', text().reset, () => { this.more.open = false; this.newScene(); }, extras);
    tools.appendChild(this.more);
    const footer = document.createElement('footer'); footer.className = 'delta-footer';
    this.status = document.createElement('div'); this.status.className = 'delta-status'; this.status.setAttribute('role', 'status');
    this.timebar = document.createElement('div'); this.timebar.className = 'delta-timeline';
    this.timeline = document.createElement('input');
    this.timeline.type = 'range'; this.timeline.min = '0'; this.timeline.max = String(this.duration);
    this.timeline.step = '0.01'; this.timeline.value = '0'; this.timeline.className = 'delta-scrubber';
    this.timeline.setAttribute('aria-label', text().scrub);
    this.timeline.addEventListener('input', () => { this.paused = true; this.seek(Number(this.timeline.value)); this.updateUI(); });
    this.inspection = document.createElement('div'); this.inspection.className = 'delta-inspection';
    footer.append(this.timebar, this.timeline, this.playback, this.status, this.inspection, tools);
    this.ui.append(header, footer, this.stormDialog); this.host.overlay.appendChild(this.ui);
    window.addEventListener('blur', this.cancel);
    this.host.canvas.addEventListener('pointerdown', this.down);
    this.host.canvas.addEventListener('pointermove', this.move);
    this.host.canvas.addEventListener('pointerup', this.up);
    this.host.canvas.addEventListener('pointerleave', this.leave);
    this.host.canvas.addEventListener('pointercancel', this.cancel);
    this.host.canvas.addEventListener('lostpointercapture', this.cancel);
    this.updateUI();
  }
  private async startStorm(): Promise<void> {
    this.more.open = false;
    this.recordingJob?.abort();
    const controller = new AbortController(); this.recordingJob = controller;
    this.fast = false; this.phase = 'calculating'; this.elapsed = 0; this.paused = false; this.flooded.clear(); this.error = '';
    resetWater(this.sim); this.recording = null;
    this.updateUI();
    try {
      const recording = await FloodRecording.create(this.sim.terrain.slice(), W, H, this.scenario, controller.signal);
      if (!recording || controller.signal.aborted) return;
      this.recording = recording; this.seek(0);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error(error); this.phase = 'build'; this.error = text().calculationFailed;
    }
    this.updateUI();
  }
  private newScene(): void {
    this.recordingJob?.abort();
    this.cancel(); this.recording = null; this.sim = makeScene(); this.base = this.sim.terrain.slice();
    this.budget = BUDGET; this.strokes = [];
    this.phase = 'build'; this.flooded.clear(); this.elapsed = 0; this.error = ''; this.paused = false; this.fast = false;
    this.timeline.max = String(this.duration);
  }
  private rewind(): void {
    this.recordingJob?.abort();
    this.recording = null;
    this.phase = 'build'; this.elapsed = 0; this.flooded.clear(); this.paused = false; this.fast = false;
    resetWater(this.sim); this.error = '';
  }
  private cost(): number { let c = 0; for (const d of this.plan.values()) c += d; return c; }
  private preview(): void {
    this.plan = this.phase === 'build' && this.pointer ? sandPlan(this.sim, [this.pointer], .2) : new Map();
  }
  private seek(time: number): void {
    if (!this.recording) return;
    this.elapsed = Math.max(0, Math.min(this.duration, time));
    const mask = this.recording.restore(this.elapsed, this.sim);
    this.flooded.clear();
    HOMES.forEach((_, k) => { if (mask & (1 << k)) this.flooded.add(k); });
    this.phase = this.elapsed >= this.duration ? 'end' : 'storm';
  }
  private tick(dt: number): void {
    if (this.phase !== 'storm') return;
    const wasRecovering = this.recovering;
    this.seek(this.elapsed + dt);
    // Finish an unattended round within the kiosk idle window; visitors can slow it down.
    if (!wasRecovering && this.recovering && !this.paused) this.fast = true;
  }
  frame(dt: number): void {
    if (this.phase === 'build') {
      if (this.strokeStart && this.pointer) {
        this.budget -= placeSand(this.sim, this.path.length ? this.path : [this.pointer], SAND_RATE * Math.min(dt, .05), this.budget);
        this.path = [this.pointer];
        this.preview();
      }
      const before = this.sim.pumpedVolume, duration = Math.min(dt, .05) * 4;
      this.sim.advance(duration);
      this.livePumpRate = duration > 0 ? (this.sim.pumpedVolume - before) / duration : 0;
    }
    if (!this.paused) this.tick(Math.min(dt, .05) * (this.fast ? 4 : 1));
    this.updateUI(); this.draw();
  }
  private updateUI(): void {
    const t = text();
    this.stats.textContent = `${t.homes}  ${HOMES.length - this.flooded.size}/${HOMES.length}    ·    ${t.budget}  ${Math.floor(this.budget)}`;
    this.status.textContent = this.phase === 'calculating' ? t.calculating : this.error || (this.phase === 'build' ? t.draw : this.phase === 'end' ? (this.flooded.size ? t.ended : t.safe) : this.recovering ? t.recoveryHint : t.running);
    this.buttons.storm.hidden = this.phase !== 'build';
    this.buttons.rewind.hidden = this.phase === 'build';
    this.buttons.undo.hidden = this.phase !== 'build';
    this.buttons.undo.disabled = !this.strokes.length;
    this.buttons.reset.hidden = this.phase !== 'build';
    this.playback.hidden = !this.recording;
    const playing = !this.paused && this.phase === 'storm';
    this.buttons.pause.textContent = playing ? 'Ⅱ' : '▶';
    this.buttons.pause.setAttribute('aria-label', playing ? t.pause : t.resume);
    this.buttons.pause.title = playing ? t.pause : t.resume;
    this.buttons.back.disabled = this.elapsed <= 0;
    this.buttons.forward.disabled = this.elapsed >= this.duration;
    this.buttons.fast.setAttribute('aria-pressed', String(this.fast));
    this.buttons.model.textContent = this.model ? t.landscape : t.model;
    this.buttons.model.setAttribute('aria-pressed', String(this.model));
    this.timeline.style.setProperty('--progress', `${100 * this.elapsed / this.duration}%`);
    this.timebar.textContent = this.phase === 'calculating' ? t.calculating : this.phase === 'build' ? t.ready : `${this.recovering ? t.recovery : this.scenario === 'waves' ? t.wavesMode : t.stormTime}   ${this.elapsed.toFixed(0)} / ${this.duration} s`;
    this.timeline.hidden = !this.recording;
    this.timeline.value = String(this.elapsed);
    this.timeline.setAttribute('aria-valuetext', `${this.elapsed.toFixed(2)} s`);
    const p = this.pointer;
    if (p) {
      const i = Math.floor(p.y) * W + Math.floor(p.x), h = this.sim.water[i];
      this.inspection.textContent = `${t.ground}: ${this.sim.terrain[i].toFixed(1)} m · ${t.depth}: ${h.toFixed(2)} m · ${t.speed}: ${(h > 1e-5 ? Math.hypot(this.sim.mx[i], this.sim.my[i]) / h : 0).toFixed(2)} m/s`;
    } else this.inspection.textContent = this.more.open ? `${t.pumpRate}: ${(this.recording?.pumpRateAt(this.elapsed) ?? this.livePumpRate).toFixed(1)} m³/s` : '';
  }
  private project(x: number, y: number, z = 0): Point {
    return this.model ? { x: x * 13, y: y * 13 } : { x: x * 12 - y * 8, y: x * 3.4 + y * 7 - z * 11 };
  }
  private hit(e: PointerEvent): Point | null {
    const r = this.host.canvas.getBoundingClientRect(), {scale, ox, oy} = this.transform;
    const px = (e.clientX - r.left - ox) / scale, py = (e.clientY - r.top - oy) / scale;
    if (this.model) {
      const x = px / 13, y = py / 13;
      return x >= 0 && x < W && y >= 0 && y < H ? { x, y } : null;
    }
    // Match the visible top face, including raised terrain, in reverse draw order.
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      const z = this.sim.terrain[y * W + x];
      const yy = py + z * 11;
      const wx = (7 * px + 8 * yy) / 111.2, wy = (12 * yy - 3.4 * px) / 111.2;
      if (wx >= x && wx < x + 1 && wy >= y && wy < y + 1) return { x: wx >= 20.5 && wx <= 24.5 ? 22.5 : wx, y: wy };
    }
    return null;
  }
  private poly(points: Point[], fill: string, stroke?: string): void {
    const c = this.ctx; c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p.x,p.y) : c.moveTo(p.x,p.y)); c.closePath(); c.fillStyle = fill; c.fill();
    { c.strokeStyle = stroke || fill; c.lineWidth = .5; c.stroke(); }
  }
  private tile(x: number,y: number,z: number,fill: string,stroke?: string): void {
    this.poly([this.project(x,y,z),this.project(x+1,y,z),this.project(x+1,y+1,z),this.project(x,y+1,z)], fill, stroke);
  }
  private house(x: number,y: number,wet: boolean, school: boolean): void {
    const z = this.sim.terrain[y * W + x], p = this.project(x+.5,y+.5,z), c = this.ctx;
    if (this.model) { c.strokeStyle = wet ? '#ffb58f' : '#f9eed2'; c.lineWidth = 2; c.strokeRect(p.x-5,p.y-5,10,10); return; }
    const w = school ? 13 : 9, h = school ? 20 : 15;
    const depth = this.sim.water[y * W + x];
    c.save();
    c.beginPath(); c.rect(p.x-30,p.y-70,60,75-depth*11); c.clip();
    this.poly([{x:p.x-w,y:p.y-h},{x:p.x,y:p.y-h+5},{x:p.x,y:p.y+5},{x:p.x-w,y:p.y}],wet?'#8ca3a4':'#eee1c3');
    this.poly([{x:p.x,y:p.y-h+5},{x:p.x+w,y:p.y-h},{x:p.x+w,y:p.y},{x:p.x,y:p.y+5}],wet?'#64858b':'#bcbaaa');
    this.poly([{x:p.x-w-2,y:p.y-h},{x:p.x-1,y:p.y-h-9},{x:p.x+w+2,y:p.y-h},{x:p.x,y:p.y-h+6}],wet?'#a16c57':'#c46e4e');
    c.fillStyle = wet ? '#74c8df' : '#fff3b4'; c.fillRect(p.x+3,p.y-h+7,3,5);
    c.restore();
    if (wet && depth > .05) { c.strokeStyle = '#9ce7f4'; c.beginPath(); c.ellipse(p.x,p.y+3-depth*11,14,5,0,0,Math.PI*2); c.stroke(); }
  }
  private draw(): void {
    const c = this.ctx, dpr = this.host.dpr;
    const width = this.host.canvas.width / dpr, height = this.host.canvas.height / dpr;
    c.setTransform(dpr,0,0,dpr,0,0);
    const bg = c.createLinearGradient(0,0,0,height); bg.addColorStop(0,'#15333e'); bg.addColorStop(1,'#091c28'); c.fillStyle = bg; c.fillRect(0,0,width,height);
    const footer = this.ui.querySelector('footer')!.getBoundingClientRect().height;
    const top = this.ui.querySelector('header')!.getBoundingClientRect().height + 30;
    const bottom = height - footer - 22;
    const worldW = this.model ? W * 13 : W * 12 + H * 8;
    const worldH = this.model ? H * 13 : W * 3.4 + H * 7 + 100;
    const scale = Math.max(.15, Math.min((width - 60) / worldW, (bottom - top) / worldH));
    const ox = (width - worldW * scale)/2 + (this.model ? 0 : H * 8 * scale);
    const oy = top + Math.max(0, (bottom - top - worldH * scale) / 2) + (this.model ? 0 : 45 * scale);
    this.transform = {scale,ox,oy}; c.translate(ox,oy); c.scale(scale,scale);
    // The exposed earth makes the below-sea-level polder legible.
    if (!this.model) {
      for (let x = 0; x < W; x++) this.poly([this.project(x,H,this.sim.terrain[(H-1)*W+x]),this.project(x+1,H,this.sim.terrain[(H-1)*W+x]),this.project(x+1,H,-5),this.project(x,H,-5)], x%3?'#80694d':'#8d7555');
      for (let y = 0; y < H; y++) this.poly([this.project(W,y,this.sim.terrain[y*W+W-1]),this.project(W,y+1,this.sim.terrain[y*W+W-1]),this.project(W,y+1,-5),this.project(W,y,-5)], '#554e3b');
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y*W+x, z = this.sim.terrain[i], h = this.sim.water[i];
      const built = z > this.base[i] + .01;
      const field = (Math.floor(x/6)+Math.floor(y/5))%3;
      let land = z < -1 ? '#b8b18a' : z > 1 ? '#91aa67' : ['#78935d','#889f65','#718c58'][field];
      if (built) land = '#d2b16d';
      if (this.model) land = built ? '#b8a76c' : z > 1 ? '#62715e' : '#354d45';
      if (!this.model) {
        const front = y < H-1 ? this.sim.terrain[i+W] : z;
        const right = x < W-1 ? this.sim.terrain[i+1] : z;
        if (z > front) this.poly([this.project(x,y+1,z),this.project(x+1,y+1,z),this.project(x+1,y+1,front),this.project(x,y+1,front)],built?'#a48b50':'#667d49');
        if (z > right) this.poly([this.project(x+1,y,z),this.project(x+1,y+1,z),this.project(x+1,y+1,right),this.project(x+1,y,right)],built?'#b29858':'#819358');
      }
      this.tile(x,y,z,land,this.model?'#ffffff25':undefined);
      if (h > .012) {
        const deep = Math.min(1,h/3);
        const opacity = Math.min(1, h / .18);
        const waterColor = `rgba(${Math.round(64-35*deep)},${Math.round(167-64*deep)},${Math.round(178-43*deep)},${opacity})`;
        if (!this.model) {
          // Join unequal neighbouring surfaces so a moving front has no cracks.
          const front = y < H-1 ? Math.max(z, this.sim.terrain[i+W]+this.sim.water[i+W]) : z;
          const right = x < W-1 ? Math.max(z, this.sim.terrain[i+1]+this.sim.water[i+1]) : z;
          if (z+h > front) this.poly([this.project(x,y+1,z+h),this.project(x+1,y+1,z+h),this.project(x+1,y+1,front),this.project(x,y+1,front)],waterColor);
          if (z+h > right) this.poly([this.project(x+1,y,z+h),this.project(x+1,y+1,z+h),this.project(x+1,y+1,right),this.project(x+1,y,right)],waterColor);
        }
        this.tile(x,y,z+h,waterColor,`rgba(180,241,243,${.29 * opacity})`);
        if ((x*7+y*11)%19===0 && !this.model) {
          const p = this.project(x+.2,y+.5,z+h); c.strokeStyle = '#b9eeef60'; c.lineWidth = .7; c.beginPath(); c.moveTo(p.x,p.y); c.lineTo(p.x+7,p.y+1); c.stroke();
        }
      }

    }
    if (!this.model) {
      // Small lanes and trees give the polder a human scale without hiding flow.
      c.strokeStyle='#c4bfa18a'; c.lineWidth=2;
      c.beginPath();
      for (let x=30;x<=51;x++) { const p=this.project(x,20,this.sim.terrain[20*W+x]+.03); if(x===30)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y); }
      c.stroke();
      for (const [x,y] of [[30,12],[47,12],[52,31],[31,29],[55,8],[54,34]]) {
        const i=y*W+x; if(this.sim.water[i]>.1)continue;
        const p=this.project(x,y,this.sim.terrain[i]);c.fillStyle='#6c6347';c.fillRect(p.x-1,p.y-8,2,9);
        c.fillStyle='#416952';c.beginPath();c.ellipse(p.x,p.y-13,5,8,0,0,Math.PI*2);c.fill();
      }
    }
    HOMES.forEach(([x,y],k) => this.house(x,y,this.flooded.has(k),k===6));
    this.drawDrainage();
    if (!this.model) this.drawLevelPosts();
    if (!this.model) {
      // A tiny windmill on high ground.
      const p = this.project(58,10,1), t = this.elapsed*.3;
      c.fillStyle = '#e2d6b8'; c.fillRect(p.x-4,p.y-23,8,25); c.strokeStyle = '#eee6cd'; c.lineWidth = 3;
      for (let k=0;k<4;k++) { const a=t+k*Math.PI/2; c.beginPath(); c.moveTo(p.x,p.y-20); c.lineTo(p.x+Math.cos(a)*17,p.y-20+Math.sin(a)*17); c.stroke(); }
    }
    if (this.pointer && this.model) {
      const {x,y} = this.pointer; this.tile(Math.floor(x),Math.floor(y),0,'#ffffff22','#fff');
    }
    const ghostColor = this.cost() <= this.budget ? '#ffdc8480' : '#ff736eaa';
    for (const [i, rise] of this.plan) {
      if (rise <= 0) continue;
      const x = i % W, y = Math.floor(i / W), z = this.sim.terrain[i];
      if (!this.model) {
        this.poly([this.project(x,y+1,z+rise),this.project(x+1,y+1,z+rise),this.project(x+1,y+1,z),this.project(x,y+1,z)],ghostColor);
        this.poly([this.project(x+1,y,z+rise),this.project(x+1,y+1,z+rise),this.project(x+1,y+1,z),this.project(x+1,y,z)],ghostColor);
      }
      this.tile(x,y,z+rise,ghostColor,'#fff1bd');
    }
    // Final overlay pass: neighbouring water tiles and buildings cannot cover arrows.
    for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) {
      const i = y * W + x, z = this.sim.terrain[i], h = this.sim.water[i];
      if (h > .035 && x%4===0 && y%4===0) {
        const u = this.sim.mx[i]/h, v = this.sim.my[i]/h, speed = Math.hypot(u,v);
        if (speed > .025) {
          const len = Math.min(1.8, .6 + speed), p = this.project(x+.5,y+.5,z+h+.05), q = this.project(x+.5+u/speed*len,y+.5+v/speed*len,z+h+.05);
          const angle = Math.atan2(q.y-p.y,q.x-p.x);
          c.strokeStyle = '#efffff'; c.lineWidth = this.model?1.6:1.2; c.beginPath(); c.moveTo(p.x,p.y); c.lineTo(q.x,q.y); c.lineTo(q.x-4*Math.cos(angle-.5),q.y-4*Math.sin(angle-.5)); c.moveTo(q.x,q.y); c.lineTo(q.x-4*Math.cos(angle+.5),q.y-4*Math.sin(angle+.5)); c.stroke();
        }
      }
    }
    c.setTransform(dpr,0,0,dpr,0,0);
    if (this.model && this.more.open && width > 850) this.section(width-270,top+15);
  }
  private drawLevelPosts(): void {
    const c = this.ctx;
    for (const [x,y] of [[35,25],[48,16]]) {
      const i = y * W + x, z = this.sim.terrain[i], h = this.sim.water[i];
      const foot = this.project(x,y,z), top = this.project(x,y,z+3);
      c.strokeStyle = '#f8eed1'; c.lineWidth = 2; c.beginPath(); c.moveTo(foot.x,foot.y); c.lineTo(top.x,top.y); c.stroke();
      for (let level=0;level<=3;level++) {
        const p = this.project(x,y,z+level); c.beginPath(); c.moveTo(p.x-3,p.y); c.lineTo(p.x+3,p.y); c.stroke();
      }
      const surface = this.project(x,y,z+h);
      c.strokeStyle = '#ffd585'; c.lineWidth = 3; c.beginPath(); c.moveTo(surface.x-6,surface.y); c.lineTo(surface.x+6,surface.y); c.stroke();
    }
  }
  private drawDrainage(): void {
    const c = this.ctx, rate = this.recording?.pumpRateAt(this.elapsed) ?? this.livePumpRate;
    const pumped = this.recording?.pumpedAt(this.elapsed) ?? this.sim.pumpedVolume;
    // Exposed pipe route explains the transfer across the dike to the sea.
    c.strokeStyle = '#d8d4b5'; c.lineWidth = 2.5; c.setLineDash([5,4]);
    c.lineDashOffset = rate > 0 ? -pumped / 25 : 0;
    c.beginPath();
    for (let x=PUMP.x;x>=PUMP.outletX;x--) {
      const i=PUMP.y*W+x, p=this.project(x+.5,PUMP.y+.5,Math.max(this.sim.terrain[i]+.15,this.sim.terrain[i]+this.sim.water[i]+.1));
      if(x===PUMP.x)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y);
    }
    c.stroke(); c.setLineDash([]); c.lineDashOffset=0;
    const i=PUMP.y*W+PUMP.x, p=this.project(PUMP.x+.5,PUMP.y+.5,Math.max(0,this.sim.terrain[i]+this.sim.water[i]));
    c.fillStyle='#1a4556';c.fillRect(p.x-10,p.y-17,20,19);c.strokeStyle='#cfe7dd';c.lineWidth=1.5;c.strokeRect(p.x-10,p.y-17,20,19);
    c.beginPath();c.arc(p.x,p.y-7,6,0,Math.PI*2);c.stroke();
    const angle = pumped / 5;
    c.beginPath();c.moveTo(p.x-5*Math.cos(angle),p.y-7-5*Math.sin(angle));c.lineTo(p.x+5*Math.cos(angle),p.y-7+5*Math.sin(angle));c.stroke();
  }

  private section(left: number,top: number): void {
    const c=this.ctx, t=text(), w=240, h=100;
    c.fillStyle='#0b202bea'; c.fillRect(left-12,top-24,w+24,h+48);
    c.fillStyle='#dbe8dc'; c.font='600 9px system-ui'; c.textAlign='left'; c.fillText(t.slice,left,top-8,w);
    for (let x=0;x<W;x++) {
      const i=20*W+x, z=this.sim.terrain[i], depth=this.sim.water[i], xx=left+x*w/W;
      c.fillStyle='#a6ac76'; c.fillRect(xx,top+60-z*12,w/W+.3,40+z*12);
      c.fillStyle='#50b6c9'; c.fillRect(xx,top+60-(z+depth)*12,w/W+.3,depth*12);
    }
    c.strokeStyle='#f1dfb9'; c.setLineDash([3,3]); c.beginPath(); c.moveTo(left,top+60); c.lineTo(left+w,top+60); c.stroke(); c.setLineDash([]);
    c.fillStyle='#f1dfb9'; c.fillText('0 m',left+3,top+56);
  }
  destroy(): void {
    window.removeEventListener('blur', this.cancel);
    const c=this.host.canvas;
    c.removeEventListener('pointerleave',this.leave);
    c.removeEventListener('pointerdown',this.down); c.removeEventListener('pointermove',this.move); c.removeEventListener('pointerup',this.up); c.removeEventListener('pointercancel',this.cancel); c.removeEventListener('lostpointercapture',this.cancel);
    this.recordingJob?.abort();
    this.recording = null;
    this.ui?.remove();
  }
}
export const floodland: ArcadeGame = {
 id:'floodland', title:{en:'Save the Netherlands',nl:'Red Nederland',no:'Redd Nederland'},
 scienceLine:{en:'Build a dike, test a storm, and reveal the shallow-water calculations beneath the landscape.',nl:'Bouw een dijk, test een storm en ontdek de ondiepwaterberekeningen onder het landschap.',no:'Bygg et dike, test en storm og se gruntvannsberegningene under landskapet.'},
 tileEmoji:'🌊',create:host=>new FloodInstance(host)
};
