import type { ArcadeGame, GameHost, GameInstance } from '../../shell/types';
import { fmtNumber, pick } from '../../lib/i18n';
import { GRID_W as W, GRID_H as H } from './water';
import { BUDGET, HOMES, STORM_DURATION, dikePlan, makeScene, resetWater, surge, type Point } from './scene';
import { text } from './text';
import './style.css';

class FloodInstance implements GameInstance {
  private sim = makeScene();
  private base = this.sim.terrain.slice();
  private ctx!: CanvasRenderingContext2D;
  private ui!: HTMLDivElement;
  private phase: 'build' | 'storm' | 'end' = 'build';
  private elapsed = 0;
  private paused = false;
  private slow = false;
  private model = false;
  private budget = BUDGET;
  private crest = 2.4;
  private strokes: { terrain: Float64Array; budget: number }[] = [];
  private path: Point[] = [];
  private plan = new Map<number, number>();
  private pointer: Point | null = null;
  private flooded = new Set<number>();
  private maximum = new Float64Array(W * H);
  private previous: Float64Array | null = null;
  private showPrevious = false;
  private error = '';
  private transform = { scale: 1, ox: 0, oy: 0 };
  private buttons: Record<string, HTMLButtonElement> = {};
  private status!: HTMLElement;
  private stats!: HTMLElement;
  private timebar!: HTMLElement;
  private inspection!: HTMLElement;
  private down = (e: PointerEvent) => {
    const p = this.hit(e);
    if (!p) return;
    this.pointer = p;
    if (this.phase !== 'build' || this.model) return;
    this.host.canvas.setPointerCapture(e.pointerId);
    this.path = [p]; this.error = ''; this.preview();
  };
  private move = (e: PointerEvent) => {
    const p = this.hit(e); this.pointer = p;
    if (this.path.length && p) { this.path.push(p); this.preview(); }
  };
  private up = () => {
    if (!this.path.length) return;
    const cost = this.cost();
    if (cost > 0 && cost <= this.budget) {
      this.strokes.push({ terrain: this.sim.terrain.slice(), budget: this.budget });
      for (const [i, dh] of this.plan) this.sim.terrain[i] += dh;
      this.budget -= cost;
      resetWater(this.sim);
    } else if (cost > this.budget) this.error = text().expensive;
    this.cancel();
  };
  private cancel = () => { this.path = []; this.plan.clear(); };
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
    const button = (key: string, label: string, fn: () => void) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.addEventListener('click', () => { this.cancel(); fn(); this.updateUI(); });
      tools.appendChild(b); this.buttons[key] = b; return b;
    };
    button('storm', text().storm, () => { this.phase = 'storm'; this.elapsed = 0; this.paused = false; this.flooded.clear(); this.maximum.fill(0); resetWater(this.sim); });
    button('rewind', text().rewind, () => this.rewind());
    button('undo', text().undo, () => { const s = this.strokes.pop(); if (s) { this.sim.terrain.set(s.terrain); this.budget = s.budget; resetWater(this.sim); } });
    const label = document.createElement('label'); label.textContent = text().crest;
    const select = document.createElement('select');
    for (const [value, title] of [['2.4', text().high], ['1', text().low]]) { const o = document.createElement('option'); o.value = value; o.textContent = title; select.appendChild(o); }
    select.addEventListener('change', () => { this.crest = Number(select.value); this.preview(); }); label.appendChild(select); tools.appendChild(label);
    button('pause', text().pause, () => { this.paused = !this.paused; });
    button('step', text().step, () => this.tick(1 / 600));
    button('slow', text().slow, () => { this.slow = !this.slow; });
    button('model', text().model, () => { this.model = !this.model; });
    button('previous', text().previous, () => { this.showPrevious = !this.showPrevious; });
    button('reset', text().reset, () => { this.sim = makeScene(); this.budget = BUDGET; this.strokes = []; this.previous = null; this.showPrevious = false; this.phase = 'build'; this.flooded.clear(); this.elapsed = 0; this.error = ''; });
    const footer = document.createElement('footer'); footer.className = 'delta-footer';
    this.status = document.createElement('div'); this.status.className = 'delta-status'; this.status.setAttribute('role', 'status');
    this.timebar = document.createElement('div'); this.timebar.className = 'delta-timeline';
    this.inspection = document.createElement('div'); this.inspection.className = 'delta-inspection';
    footer.append(this.timebar, this.status, this.inspection, tools);
    this.ui.append(header, footer); this.host.overlay.appendChild(this.ui);
    this.host.canvas.addEventListener('pointerdown', this.down);
    this.host.canvas.addEventListener('pointermove', this.move);
    this.host.canvas.addEventListener('pointerup', this.up);
    this.host.canvas.addEventListener('pointercancel', this.cancel);
    this.host.canvas.addEventListener('lostpointercapture', this.cancel);
    this.updateUI();
  }
  private rewind(): void {
    this.previous = this.maximum.slice(); this.showPrevious = true;
    this.phase = 'build'; this.elapsed = 0; this.flooded.clear(); this.paused = false;
    resetWater(this.sim); this.error = '';
  }
  private cost(): number { let c = 0; for (const d of this.plan.values()) c += d; return c; }
  private preview(): void { this.plan = dikePlan(this.sim, this.path, this.crest); }
  private tick(dt: number): void {
    if (this.phase !== 'storm') return;
    this.elapsed = Math.min(STORM_DURATION, this.elapsed + dt);
    this.sim.seaLevel = surge(this.elapsed);
    this.sim.advance(dt * 24);
    for (let i = 0; i < W * H; i++) this.maximum[i] = Math.max(this.maximum[i], this.sim.water[i]);
    HOMES.forEach(([x,y], k) => { if (this.sim.water[y * W + x] > .3) this.flooded.add(k); });
    if (this.elapsed >= STORM_DURATION) this.phase = 'end';
  }
  frame(dt: number): void {
    if (!this.paused) this.tick(Math.min(dt, .05) * (this.slow ? .25 : 1));
    this.updateUI(); this.draw();
  }
  private updateUI(): void {
    const t = text();
    this.stats.textContent = `${t.homes}  ${HOMES.length - this.flooded.size}/${HOMES.length}    ·    ${t.budget}  ${Math.floor(this.budget)}    ·    ${t.sea}  +${fmtNumber(this.sim.seaLevel, { maximumFractionDigits: 1 })} m`;
    this.status.textContent = this.error || (this.path.length ? `${t.cost}: ${Math.ceil(this.cost())} / ${Math.floor(this.budget)}` : this.model ? t.modelHint : this.phase === 'build' ? t.draw : this.phase === 'end' ? (this.flooded.size ? t.ended : `${t.safe} ${t.ended}`) : this.flooded.size ? t.blocked : t.running);
    this.buttons.storm.hidden = this.phase !== 'build';
    this.buttons.rewind.hidden = this.phase === 'build';
    this.buttons.undo.disabled = this.phase !== 'build' || !this.strokes.length;
    (this.ui.querySelector('select') as HTMLSelectElement).disabled = this.phase !== 'build';
    this.buttons.pause.hidden = this.phase !== 'storm';
    this.buttons.pause.textContent = this.paused ? t.resume : t.pause;
    this.buttons.step.hidden = this.phase !== 'storm' || !this.paused;
    this.buttons.slow.hidden = this.phase === 'build';
    this.buttons.slow.setAttribute('aria-pressed', String(this.slow));
    this.buttons.model.textContent = this.model ? t.landscape : t.model;
    this.buttons.model.setAttribute('aria-pressed', String(this.model));
    this.buttons.previous.hidden = !this.previous;
    this.buttons.previous.setAttribute('aria-pressed', String(this.showPrevious));
    this.timebar.style.setProperty('--progress', `${100 * this.elapsed / STORM_DURATION}%`);
    this.timebar.textContent = this.phase === 'build' ? t.ready : `${t.stormTime}   ${this.elapsed.toFixed(0)} / ${STORM_DURATION} s`;
    const p = this.pointer;
    if (p && this.model) {
      const i = Math.floor(p.y) * W + Math.floor(p.x), h = this.sim.water[i];
      this.inspection.textContent = `${t.ground}: ${this.sim.terrain[i].toFixed(1)} m · ${t.depth}: ${h.toFixed(2)} m · ${t.speed}: ${(h > 1e-5 ? Math.hypot(this.sim.mx[i], this.sim.my[i]) / h : 0).toFixed(2)} m/s`;
    } else this.inspection.textContent = '';
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
  private label(x: number,y: number,z: number,label: string,color = '#eaf5ec', size = 12): void {
    const p = this.project(x,y,z), c = this.ctx;
    c.font = `600 ${size}px system-ui`; c.textAlign = 'center';
    const w = c.measureText(label).width;
    c.fillStyle = '#142c34e6'; c.fillRect(p.x-w/2-9,p.y-17,w+18,25);
    c.fillStyle = color; c.fillText(label,p.x,p.y);
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
    if (wet) { c.strokeStyle = '#9ce7f4'; c.beginPath(); c.ellipse(p.x,p.y+3-depth*11,14,5,0,0,Math.PI*2); c.stroke(); }
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
        this.tile(x,y,z+h,`rgb(${Math.round(64-35*deep)},${Math.round(167-64*deep)},${Math.round(178-43*deep)})`,this.model?'#b4f1f33a':undefined);
        if ((x*7+y*11)%19===0 && !this.model) {
          const p = this.project(x+.2,y+.5,z+h); c.strokeStyle = '#b9eeef60'; c.lineWidth = .7; c.beginPath(); c.moveTo(p.x,p.y); c.lineTo(p.x+7,p.y+1); c.stroke();
        }
      }
      if (this.showPrevious && this.previous && this.previous[i] > .3 && x > 24 && (x+y)%3===0) {
        const p = this.project(x+.5,y+.5,z+h+.03); c.fillStyle = '#f4c1a2'; c.fillRect(p.x-1.4,p.y-1.4,2.8,2.8);
      }
      if (this.plan.has(i)) this.tile(x,y,z+this.plan.get(i)!,this.cost()<=this.budget?'#ffdc8499':'#ff736eaa','#fff1bd');
      if (h > .035 && x%4===0 && y%4===0) {
        const u = this.sim.mx[i]/h, v = this.sim.my[i]/h, speed = Math.hypot(u,v);
        if (speed > .025) {
          const len = Math.min(1.8, .6 + speed), p = this.project(x+.5,y+.5,z+h+.05), q = this.project(x+.5+u/speed*len,y+.5+v/speed*len,z+h+.05);
          const angle = Math.atan2(q.y-p.y,q.x-p.x);
          c.strokeStyle = '#e0ffffb0'; c.lineWidth = this.model?1.5:1; c.beginPath(); c.moveTo(p.x,p.y); c.lineTo(q.x,q.y); c.lineTo(q.x-4*Math.cos(angle-.5),q.y-4*Math.sin(angle-.5)); c.moveTo(q.x,q.y); c.lineTo(q.x-4*Math.cos(angle+.5),q.y-4*Math.sin(angle+.5)); c.stroke();
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
    if (!this.model) {
      this.label(8,12,1,text().northsea,'#b9e9ed',14);
      this.label(43,10,0,text().village);
      this.label(43,33,0,text().polder,'#e8efcd',10);
      if (this.phase === 'build' && !this.strokes.length) this.label(23,19,3,text().opening,'#ffde92',15);
      // A tiny windmill on high ground.
      const p = this.project(58,10,1), t = this.elapsed*.3;
      c.fillStyle = '#e2d6b8'; c.fillRect(p.x-4,p.y-23,8,25); c.strokeStyle = '#eee6cd'; c.lineWidth = 3;
      for (let k=0;k<4;k++) { const a=t+k*Math.PI/2; c.beginPath(); c.moveTo(p.x,p.y-20); c.lineTo(p.x+Math.cos(a)*17,p.y-20+Math.sin(a)*17); c.stroke(); }
    }
    if (this.pointer && this.model) {
      const {x,y} = this.pointer; this.tile(Math.floor(x),Math.floor(y),0,'#ffffff22','#fff');
    }
    c.setTransform(dpr,0,0,dpr,0,0);
    if (this.model && width > 850) this.section(width-270,top+15);
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
    const c=this.host.canvas;
    c.removeEventListener('pointerdown',this.down); c.removeEventListener('pointermove',this.move); c.removeEventListener('pointerup',this.up); c.removeEventListener('pointercancel',this.cancel); c.removeEventListener('lostpointercapture',this.cancel);
    this.ui?.remove();
  }
}
export const floodland: ArcadeGame = {
 id:'floodland', title:{en:'Save the Netherlands',nl:'Red Nederland',no:'Redd Nederland'},
 scienceLine:{en:'Build a dike, test a storm, and reveal the shallow-water calculations beneath the landscape.',nl:'Bouw een dijk, test een storm en ontdek de ondiepwaterberekeningen onder het landschap.',no:'Bygg et dike, test en storm og se gruntvannsberegningene under landskapet.'},
 tileEmoji:'🌊',create:host=>new FloodInstance(host)
};
