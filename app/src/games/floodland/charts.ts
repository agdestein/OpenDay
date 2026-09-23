// Small canvas drawings shared by the challenge cards and the explainer: a
// top-down map of a simulation, a century of storms, and the curves behind
// "how high should the dike be?".
import { GRID_W as W, GRID_H as H, type FloodSim } from './water';
import { DIKE_X, HOMES, HOME_FLOOD_DEPTH } from './scene';
import { HEIGHT, dikeCost, gumbelDensity, type Fragility } from './rounds';

const INK = '#dbe8e4', MUTED = '#8fb0ad', SAND = '#e5c579', WATER = '#5ec2d4', DANGER = '#ff8f7a';

/** A top-down map of a simulation: water by depth, the dike, the homes. */
export function drawMiniMap(c: CanvasRenderingContext2D, sim: FloodSim, x0: number, y0: number, w: number, h: number): void {
  const cw = w / W, ch = h / H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, d = sim.water[i], z = sim.terrain[i];
    let color: string;
    if (d > .02) {
      const deep = Math.min(1, d / 3);
      color = `rgb(${Math.round(80 - 50 * deep)},${Math.round(180 - 70 * deep)},${Math.round(195 - 50 * deep)})`;
    } else color = x >= DIKE_X[0] && x <= DIKE_X[1] && z > .2 ? '#9fb571' : z > 1 ? '#7d9460' : '#5d7652';
    c.fillStyle = color;
    c.fillRect(x0 + x * cw, y0 + y * ch, cw + .5, ch + .5);
  }
  for (const [hx, hy] of HOMES) {
    c.fillStyle = sim.water[hy * W + hx] > HOME_FLOOD_DEPTH ? DANGER : '#f5ecd2';
    c.fillRect(x0 + (hx - .5) * cw, y0 + (hy - .5) * ch, cw * 2, ch * 2);
  }
}

function axes(c: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, xLabel: string, yLabel: string): void {
  c.strokeStyle = '#4d6b72'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0, y0 + h); c.lineTo(x0 + w, y0 + h); c.stroke();
  c.fillStyle = MUTED; c.font = '600 11px system-ui';
  c.textAlign = 'right'; c.fillText(xLabel, x0 + w, y0 + h + 26);
  c.save(); c.translate(x0 - 30, y0); c.rotate(-Math.PI / 2); c.textAlign = 'right'; c.fillText(yLabel, 0, 0); c.restore();
}

/** One bar per year: the year's highest storm against the dike; flooded years red. */
export function drawCentury(c: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number,
  peaks: number[], flooded: number[], shown: number, crest: number, labels: { years: string; storm: string; dike: string }): void {
  const top = 4.5, yOf = (z: number) => y0 + h - Math.max(0, z) / top * h, bw = w / peaks.length;
  axes(c, x0, y0, w, h, labels.years, labels.storm);
  c.fillStyle = MUTED; c.font = '600 10px system-ui'; c.textAlign = 'right';
  for (let m = 0; m <= 4; m++) c.fillText(`${m} m`, x0 - 4, yOf(m) + 3);
  for (let k = 0; k < Math.min(shown, peaks.length); k++) {
    c.fillStyle = flooded[k] > 0 ? DANGER : WATER;
    c.fillRect(x0 + k * bw + .5, yOf(peaks[k]), Math.max(1, bw - 1), y0 + h - yOf(peaks[k]));
  }
  c.strokeStyle = SAND; c.lineWidth = 2; c.setLineDash([6, 4]);
  c.beginPath(); c.moveTo(x0, yOf(crest)); c.lineTo(x0 + w, yOf(crest)); c.stroke(); c.setLineDash([]);
  c.fillStyle = SAND; c.textAlign = 'left'; c.font = '700 11px system-ui'; c.fillText(labels.dike, x0 + 6, yOf(crest) - 6);
}

/** Build cost, average flood damage and their sum against the dike height. */
export function drawCostCurve(c: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number,
  fragility: Fragility, crest: number | null, labels: { height: string; points: string; build: string; damage: string; total: string; best: string }): void {
  const n = 60, hs = Array.from({ length: n + 1 }, (_, k) => HEIGHT.min + (HEIGHT.max - HEIGHT.min) * k / n);
  const build = hs.map(dikeCost), damage = hs.map(z => fragility.expectedDamage(z)), total = hs.map((_, k) => build[k] + damage[k]);
  const top = 700, xOf = (z: number) => x0 + (z - HEIGHT.min) / (HEIGHT.max - HEIGHT.min) * w, yOf = (v: number) => y0 + h - Math.min(top, v) / top * h;
  axes(c, x0, y0, w, h, labels.height, labels.points);
  c.fillStyle = MUTED; c.font = '600 10px system-ui'; c.textAlign = 'center';
  for (let z = 1.5; z <= 4; z += .5) c.fillText(`${z} m`, xOf(z), y0 + h + 13);
  const line = (vs: number[], color: string, width: number) => {
    c.strokeStyle = color; c.lineWidth = width; c.beginPath();
    vs.forEach((v, k) => k ? c.lineTo(xOf(hs[k]), yOf(v)) : c.moveTo(xOf(hs[k]), yOf(v))); c.stroke();
  };
  line(build, SAND, 2); line(damage, WATER, 2); line(total, INK, 3.5);
  let best = 0; total.forEach((v, k) => { if (v < total[best]) best = k; });
  c.fillStyle = INK; c.beginPath(); c.arc(xOf(hs[best]), yOf(total[best]), 5, 0, Math.PI * 2); c.fill();
  c.font = '700 11px system-ui'; c.textAlign = 'center'; c.fillText(labels.best, xOf(hs[best]), yOf(total[best]) + 20);
  if (crest !== null) {
    const v = dikeCost(crest) + fragility.expectedDamage(crest);
    c.strokeStyle = DANGER; c.lineWidth = 3; c.beginPath(); c.arc(xOf(crest), yOf(v), 8, 0, Math.PI * 2); c.stroke();
  }
  c.textAlign = 'left'; c.font = '700 11px system-ui';
  [[labels.total, INK], [labels.build, SAND], [labels.damage, WATER]].forEach(([text, color], k) => {
    c.fillStyle = color; c.fillRect(x0 + w - 120, y0 + 4 + k * 16, 10, 10); c.fillStyle = INK; c.fillText(text, x0 + w - 104, y0 + 13 + k * 16);
  });
}

/** How often each storm height comes (bars) and how many homes it floods (line). */
export function drawStormOdds(c: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number,
  fragility: Fragility, crest: number, labels: { storm: string; often: string; homes: string; dike: string }): void {
  const lo = 0, hi = 4.5, xOf = (z: number) => x0 + (z - lo) / (hi - lo) * w;
  axes(c, x0, y0, w, h, labels.storm, labels.often);
  c.fillStyle = MUTED; c.font = '600 10px system-ui'; c.textAlign = 'center';
  for (let z = 0; z <= 4; z++) c.fillText(`${z} m`, xOf(z), y0 + h + 13);
  const bins = 45, peak = gumbelDensity(1.2);
  for (let k = 0; k < bins; k++) {
    const z = lo + (k + .5) * (hi - lo) / bins, v = gumbelDensity(z) / peak;
    const floods = fragility.at(z, crest) > 0;
    c.fillStyle = floods ? DANGER : WATER;
    // Rare storms still get a visible bar: they are the ones that matter.
    const bh = Math.max(v * h * .9, floods ? 5 : v > 1e-4 ? 1.5 : 0);
    c.fillRect(xOf(z - (hi - lo) / bins / 2) + 1, y0 + h - bh, w / bins - 2, bh);
  }
  c.strokeStyle = INK; c.lineWidth = 3; c.beginPath();
  for (let k = 0; k <= 200; k++) {
    const z = lo + (hi - lo) * k / 200, y = y0 + h - fragility.at(z, crest) / HOMES.length * h * .9;
    if (k) c.lineTo(xOf(z), y); else c.moveTo(xOf(z), y);
  }
  c.stroke();
  c.fillStyle = INK; c.textAlign = 'right'; c.font = '700 11px system-ui'; c.fillText(labels.homes, x0 + w, y0 + 12);
  c.strokeStyle = SAND; c.lineWidth = 2; c.setLineDash([6, 4]);
  c.beginPath(); c.moveTo(xOf(crest), y0); c.lineTo(xOf(crest), y0 + h); c.stroke(); c.setLineDash([]);
  c.fillStyle = SAND; c.textAlign = 'left'; c.fillText(labels.dike, xOf(crest) + 5, y0 + 28);
}
