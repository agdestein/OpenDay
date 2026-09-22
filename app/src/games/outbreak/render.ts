// Canvas drawing for Outbreak!, shared by the game, its end-of-round card and
// the delve chapters: the city map, the people, and the dashboard beside it
// (day, counts, the stacked epidemic curve and the hospital-beds chart).
import { BEDS, COLOR, INFECTION_RADIUS, MAP_W, type OutbreakSim, type Sample } from './sim';
import { pick, type Localized } from '../../lib/i18n';

const TEXT: Localized<{
  day: (n: number) => string;
  healthy: string;
  vaccinated: string;
  sick: string;
  recovered: string;
  died: string;
  everyone: string;
  hospital: (used: number, beds: number) => string;
  inBed: string;
  waiting: string;
  full: string;
  capacity: string;
  curveLine1: string;
  curveLine2: string;
  days: string;
}> = {
  en: {
    day: (n) => `Day ${n}`,
    healthy: 'Healthy',
    vaccinated: 'Vaccinated',
    sick: 'Sick',
    recovered: 'Recovered',
    died: 'Died',
    everyone: 'Everyone, day by day',
    hospital: (used, beds) => `🏥 Hospital: ${used} of ${beds} beds`,
    inBed: 'in a bed',
    waiting: 'waiting for a bed',
    full: 'FULL',
    capacity: 'beds',
    curveLine1: 'the epidemic curve',
    curveLine2: 'will draw itself here',
    days: 'days →',
  },
  nl: {
    day: (n) => `Dag ${n}`,
    healthy: 'Gezond',
    vaccinated: 'Gevaccineerd',
    sick: 'Ziek',
    recovered: 'Hersteld',
    died: 'Overleden',
    everyone: 'Iedereen, dag na dag',
    hospital: (used, beds) => `🏥 Ziekenhuis: ${used} van ${beds} bedden`,
    inBed: 'in een bed',
    waiting: 'wacht op een bed',
    full: 'VOL',
    capacity: 'bedden',
    curveLine1: 'de epidemiecurve',
    curveLine2: 'tekent zichzelf hier',
    days: 'dagen →',
  },
  no: {
    day: (n) => `Dag ${n}`,
    healthy: 'Frisk',
    vaccinated: 'Vaksinert',
    sick: 'Syk',
    recovered: 'Frisk igjen',
    died: 'Døde',
    everyone: 'Alle sammen, dag for dag',
    hospital: (used, beds) => `🏥 Sykehus: ${used} av ${beds} senger`,
    inBed: 'i en seng',
    waiting: 'venter på seng',
    full: 'FULLT',
    capacity: 'senger',
    curveLine1: 'epidemikurven',
    curveLine2: 'tegner seg selv her',
    days: 'dager →',
  },
};

export interface Ripple {
  x: number;
  y: number;
  t: number;
  color: string;
  /** Radius the ring grows to. */
  size?: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const INK = 'rgba(238, 242, 255, 0.92)';
const INK_DIM = 'rgba(238, 242, 255, 0.55)';

/** Left edge of the dashboard in virtual coordinates. */
export const DASH_X = MAP_W + 40;

// ---- the map ----

export function drawCity(
  ctx: CanvasRenderingContext2D,
  sim: OutbreakSim,
  opts: { highlightHoods: boolean; highlightVenues: boolean; time: number },
): void {
  const hosp = sim.hospital;
  // Roads from each neighborhood to the school, the market and the hospital.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const d of sim.districts) {
    for (const p of [...sim.venues, hosp]) {
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(p.x, p.y);
    }
  }
  ctx.stroke();

  for (const d of sim.districts) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.beginPath();
    ctx.roundRect(d.x - d.w / 2, d.y - d.h / 2, d.w, d.h, 26);
    ctx.fill();
    if (opts.highlightHoods) {
      ctx.strokeStyle = 'rgba(79, 208, 138, 0.5)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    for (const house of d.houses) ctx.roundRect(house.x - 18, house.y - 14, 36, 28, 6);
    ctx.fill();
  }

  for (let k = 0; k < sim.venues.length; k++) {
    const v = sim.venues[k];
    ctx.fillStyle =
      v.kind === 'school' ? 'rgba(125, 211, 252, 0.10)' : 'rgba(251, 191, 36, 0.09)';
    ctx.beginPath();
    ctx.arc(v.x, v.y, v.r, 0, Math.PI * 2);
    ctx.fill();
    if (opts.highlightVenues && !v.soap) {
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.55)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '40px system-ui, sans-serif';
    ctx.globalAlpha = 0.9;
    // School label above, market label below: the hospital sits between them.
    const labelY = v.kind === 'school' ? v.y - v.r - 28 : v.y + v.r + 28;
    ctx.fillText(v.kind === 'school' ? '🏫' : '🛒', v.x, labelY);
    ctx.globalAlpha = 1;
    if (v.soap) {
      ctx.font = '32px system-ui, sans-serif';
      ctx.fillText('🧼', v.x + v.r - 6, v.y - v.r + 6);
    }
    if (!sim.isOpen(k)) {
      ctx.fillStyle = 'rgba(11, 16, 32, 0.55)';
      ctx.beginPath();
      ctx.arc(v.x, v.y, v.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '44px system-ui, sans-serif';
      ctx.fillText('🚫', v.x, v.y);
    }
    ctx.textBaseline = 'alphabetic';
  }

  // The hospital: a building with a row of beds, loud when it overflows.
  const full = sim.counts.waiting > 0;
  const x0 = hosp.x - hosp.w / 2;
  const y0 = hosp.y - hosp.h / 2;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.beginPath();
  ctx.roundRect(x0, y0, hosp.w, hosp.h, 14);
  ctx.fill();
  ctx.lineWidth = full ? 4 : 2;
  ctx.strokeStyle = full
    ? `rgba(255, 90, 110, ${0.55 + 0.4 * Math.sin(opts.time * 6)})`
    : 'rgba(255, 255, 255, 0.22)';
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.beginPath();
  for (const b of hosp.beds) ctx.roundRect(b.x - 16, b.y - 11, 32, 22, 5);
  ctx.fill();
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = INK_DIM;
  ctx.fillText(`🏥 ${sim.counts.beds}/${BEDS}`, x0 + 12, y0 + 24);
  if (full) {
    ctx.textAlign = 'right';
    ctx.fillStyle = COLOR.i;
    ctx.fillText(`${pick(TEXT).full} · +${sim.counts.waiting}`, x0 + hosp.w - 12, y0 + 24);
  }
}

export function drawAgents(ctx: CanvasRenderingContext2D, sim: OutbreakSim, time: number): void {
  const paths = {
    d: new Path2D(),
    r: new Path2D(),
    s: new Path2D(),
    v: new Path2D(),
    i: new Path2D(),
  };
  const halos = new Path2D();
  const elderRings = new Path2D();
  const waitRings = new Path2D();
  const fresh = new Path2D();
  let k = 0;
  for (const a of sim.agents) {
    const size = a.age === 'kid' ? 3.6 : 5;
    if (a.state === 'D') {
      paths.d.moveTo(a.x + 4, a.y);
      paths.d.arc(a.x, a.y, 4, 0, Math.PI * 2);
      const age = sim.day - a.changedAt;
      if (age < 2) {
        const r = 6 + age * 10;
        fresh.moveTo(a.x + r, a.y);
        fresh.arc(a.x, a.y, r, 0, Math.PI * 2);
      }
      continue;
    }
    let path = paths.s;
    if (a.state === 'I') {
      path = paths.i;
      if (a.bed < 0) {
        const r = INFECTION_RADIUS * (1 + 0.12 * Math.sin(time * 4 + k++));
        halos.moveTo(a.x + r, a.y);
        halos.arc(a.x, a.y, r, 0, Math.PI * 2);
      }
      if (sim.needsBed(a)) {
        const r = 9 + 1.5 * Math.sin(time * 6);
        waitRings.moveTo(a.x + r, a.y);
        waitRings.arc(a.x, a.y, r, 0, Math.PI * 2);
      }
    } else if (a.state === 'R') path = paths.r;
    else if (a.vaccinated) path = paths.v;
    path.moveTo(a.x + size, a.y);
    path.arc(a.x, a.y, size, 0, Math.PI * 2);
    if (a.age === 'elder') {
      elderRings.moveTo(a.x + size + 2.2, a.y);
      elderRings.arc(a.x, a.y, size + 2.2, 0, Math.PI * 2);
    }
  }
  ctx.fillStyle = 'rgba(255, 90, 110, 0.09)';
  ctx.fill(halos);
  ctx.fillStyle = COLOR.d;
  ctx.fill(paths.d);
  ctx.strokeStyle = 'rgba(160, 170, 190, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke(fresh);
  ctx.fillStyle = COLOR.r;
  ctx.fill(paths.r);
  ctx.fillStyle = COLOR.s;
  ctx.fill(paths.s);
  ctx.fillStyle = COLOR.v;
  ctx.fill(paths.v);
  ctx.fillStyle = COLOR.i;
  ctx.fill(paths.i);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1.4;
  ctx.stroke(elderRings);
  ctx.strokeStyle = COLOR.wait;
  ctx.lineWidth = 2.5;
  ctx.stroke(waitRings);
}

export function drawRipples(ctx: CanvasRenderingContext2D, ripples: Ripple[]): void {
  for (const r of ripples) {
    ctx.strokeStyle = r.color;
    ctx.globalAlpha = Math.max(0, 1 - r.t);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(r.x, r.y, 8 + r.t * (r.size ?? 90), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ---- the dashboard ----

/** Day range the charts show: the round's length, or a growing window in free play. */
export function dayRange(sim: OutbreakSim, lastDay?: number): [number, number] {
  if (lastDay !== undefined) return [0, lastDay];
  const end = Math.max(60, Math.ceil(sim.day / 20) * 20);
  return [Math.max(0, end - 120), end];
}

export function drawDashboard(
  ctx: CanvasRenderingContext2D,
  sim: OutbreakSim,
  opts: { range: [number, number]; showDeaths: boolean; lastDay?: number },
): void {
  const T = pick(TEXT);
  const x0 = DASH_X;
  const w = 1580 - x0;
  ctx.fillStyle = 'rgba(5, 8, 20, 0.55)';
  ctx.beginPath();
  ctx.roundRect(x0 - 20, 40, w + 40, 750, 18);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = 'bold 34px system-ui, sans-serif';
  const dayText = T.day(Math.floor(sim.day));
  ctx.fillText(opts.lastDay ? `${dayText} / ${opts.lastDay}` : dayText, x0, 92);

  const c = sim.counts;
  const rows: { color: string; label: string; n: number }[] = [
    { color: COLOR.s, label: T.healthy, n: c.s },
    { color: COLOR.v, label: T.vaccinated, n: c.v },
    { color: COLOR.i, label: T.sick, n: c.i },
    { color: COLOR.r, label: T.recovered, n: c.r },
  ];
  if (opts.showDeaths) rows.push({ color: COLOR.d, label: T.died, n: c.d });
  const colW = w / 2;
  rows.forEach((row, k) => {
    const cx = x0 + (k % 2) * colW;
    const cy = 138 + Math.floor(k / 2) * 40;
    ctx.fillStyle = row.color;
    ctx.beginPath();
    ctx.arc(cx + 9, cy - 7, 9, 0, Math.PI * 2);
    ctx.fill();
    if (row.color === COLOR.d) {
      ctx.strokeStyle = 'rgba(200, 205, 220, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillStyle = INK_DIM;
    ctx.textAlign = 'left';
    ctx.fillText(row.label, cx + 28, cy);
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillStyle = row.color === COLOR.d ? 'rgba(210, 215, 228, 0.95)' : row.color;
    ctx.textAlign = 'right';
    ctx.fillText(String(row.n), cx + colW - 18, cy + 1);
  });

  ctx.textAlign = 'left';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillStyle = INK_DIM;
  ctx.fillText(T.everyone, x0, 272);
  drawStackedChart(ctx, sim.history, { x: x0, y: 284, w, h: 250 }, opts.range, sim.day);

  ctx.textAlign = 'left';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillStyle = INK_DIM;
  ctx.fillText(T.hospital(c.beds, BEDS), x0, 580);
  drawHospitalChart(ctx, sim.history, { x: x0, y: 594, w, h: 150 }, opts.range);
  // Legend under the hospital chart.
  ctx.font = '15px system-ui, sans-serif';
  const legend: [string, string][] = [
    [COLOR.i, T.inBed],
    [COLOR.wait, T.waiting],
  ];
  let lx = x0;
  for (const [color, label] of legend) {
    ctx.fillStyle = color;
    ctx.fillRect(lx, 762, 14, 14);
    ctx.fillStyle = INK_DIM;
    ctx.textAlign = 'left';
    ctx.fillText(label, lx + 20, 775);
    lx += ctx.measureText(label).width + 48;
  }
}

/** Stacked areas, bottom to top: died, sick, recovered, vaccinated, healthy. */
export function drawStackedChart(
  ctx: CanvasRenderingContext2D,
  history: Sample[],
  box: Box,
  range: [number, number],
  today: number,
): void {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.fillRect(box.x, box.y, box.w, box.h);
  const samples = history.filter((s) => s.day >= range[0] && s.day <= range[1]);
  if (samples.length < 2 || samples[samples.length - 1].i + samples[samples.length - 1].r === 0) {
    const T = pick(TEXT);
    ctx.fillStyle = 'rgba(238, 242, 255, 0.4)';
    ctx.font = '20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(T.curveLine1, box.x + box.w / 2, box.y + box.h / 2 - 12);
    ctx.fillText(T.curveLine2, box.x + box.w / 2, box.y + box.h / 2 + 16);
    return;
  }
  const total = samples[0].s + samples[0].v + samples[0].i + samples[0].r + samples[0].d;
  const xAt = (day: number) => box.x + (box.w * (day - range[0])) / (range[1] - range[0]);
  const yAt = (n: number) => box.y + box.h - (box.h * n) / total;
  const layers: [keyof Sample, string][] = [
    ['d', 'rgba(110, 118, 136, 0.95)'],
    ['i', 'rgba(255, 90, 110, 0.9)'],
    ['r', 'rgba(138, 124, 192, 0.75)'],
    ['v', 'rgba(79, 208, 138, 0.6)'],
    ['s', 'rgba(211, 226, 244, 0.16)'],
  ];
  const base = samples.map(() => 0);
  for (const [key, color] of layers) {
    const top = samples.map((s, k) => base[k] + (s[key] as number));
    ctx.fillStyle = color;
    ctx.beginPath();
    samples.forEach((s, k) => {
      if (k === 0) ctx.moveTo(xAt(s.day), yAt(base[k]));
      else ctx.lineTo(xAt(s.day), yAt(base[k]));
    });
    for (let k = samples.length - 1; k >= 0; k--) ctx.lineTo(xAt(samples[k].day), yAt(top[k]));
    ctx.closePath();
    ctx.fill();
    top.forEach((v, k) => (base[k] = v));
  }
  // "Now" marker.
  const nowX = xAt(Math.min(today, range[1]));
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(nowX, box.y);
  ctx.lineTo(nowX, box.y + box.h);
  ctx.stroke();
}

/** Beds in use and serious cases waiting at home, against the bed count. */
export function drawHospitalChart(
  ctx: CanvasRenderingContext2D,
  history: Sample[],
  box: Box,
  range: [number, number],
): void {
  const T = pick(TEXT);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.fillRect(box.x, box.y, box.w, box.h);
  const samples = history.filter((s) => s.day >= range[0] && s.day <= range[1]);
  const top = Math.max(BEDS * 2.5, ...samples.map((s) => s.beds + s.waiting)) * 1.05;
  const xAt = (day: number) => box.x + (box.w * (day - range[0])) / (range[1] - range[0]);
  const yAt = (n: number) => box.y + box.h - (box.h * n) / top;
  if (samples.length >= 2) {
    const area = (lower: (s: Sample) => number, upper: (s: Sample) => number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      samples.forEach((s, k) => {
        if (k === 0) ctx.moveTo(xAt(s.day), yAt(lower(s)));
        else ctx.lineTo(xAt(s.day), yAt(lower(s)));
      });
      for (let k = samples.length - 1; k >= 0; k--) {
        ctx.lineTo(xAt(samples[k].day), yAt(upper(samples[k])));
      }
      ctx.closePath();
      ctx.fill();
    };
    area(() => 0, (s) => s.beds, 'rgba(255, 90, 110, 0.85)');
    area((s) => s.beds, (s) => s.beds + s.waiting, 'rgba(255, 179, 71, 0.9)');
  }
  const capY = yAt(BEDS);
  ctx.strokeStyle = 'rgba(238, 242, 255, 0.7)';
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(box.x, capY);
  ctx.lineTo(box.x + box.w, capY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = INK_DIM;
  ctx.font = '14px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${BEDS} ${T.capacity}`, box.x + box.w - 6, capY - 6);
}

/**
 * Sick-people curves of several runs as thin lines, optionally with one run
 * drawn bold on top (the player's town, against its do-nothing futures).
 */
export function drawSickLines(
  ctx: CanvasRenderingContext2D,
  box: Box,
  range: [number, number],
  runs: Sample[][],
  you?: Sample[],
): void {
  const all = [...runs, ...(you ? [you] : [])];
  const peak = Math.max(10, ...all.flatMap((h) => h.map((s) => s.i))) * 1.08;
  const xAt = (day: number) => box.x + (box.w * (day - range[0])) / (range[1] - range[0]);
  const yAt = (n: number) => box.y + box.h - (box.h * n) / peak;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(box.x, box.y + box.h);
  ctx.lineTo(box.x + box.w, box.y + box.h);
  ctx.stroke();
  const line = (h: Sample[]) => {
    ctx.beginPath();
    h.forEach((s, k) => {
      if (s.day < range[0] || s.day > range[1]) return;
      if (k === 0) ctx.moveTo(xAt(s.day), yAt(s.i));
      else ctx.lineTo(xAt(s.day), yAt(s.i));
    });
    ctx.stroke();
  };
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(190, 196, 214, 0.45)';
  for (const h of runs) line(h);
  if (you) {
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLOR.i;
    line(you);
  }
  ctx.fillStyle = INK_DIM;
  ctx.font = '14px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(pick(TEXT).days, box.x + box.w, box.y + box.h + 18);
}

/** Full scene in virtual coordinates: map on the left, dashboard on the right. */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  sim: OutbreakSim,
  ripples: Ripple[],
  opts: {
    time: number;
    highlightHoods: boolean;
    highlightVenues: boolean;
    showDeaths: boolean;
    lastDay?: number;
  },
): void {
  drawCity(ctx, sim, opts);
  drawAgents(ctx, sim, opts.time);
  drawRipples(ctx, ripples);
  drawDashboard(ctx, sim, {
    range: dayRange(sim, opts.lastDay),
    showDeaths: opts.showDeaths,
    lastDay: opts.lastDay,
  });
}
