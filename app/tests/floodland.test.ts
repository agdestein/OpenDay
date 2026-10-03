import { LiveRecording, RECORD_FPS } from '../src/games/floodland/recording.ts';
import { FloodSim, GRID_W as W, GRID_H as H } from '../src/games/floodland/water.ts';
import {
  makeScene, resetWater, placeSand, seaLevelAt, stormStrength, floodedHomes, countBits, spillLevel, homeSpillLevels, CALM_SEA,
  HOMES, BUDGET, POOL, PUMP, SAND_RATE, SILL, ROAD, ROUND, ROUND_LENGTH, STORM_LENGTH, TIME_SCALE, type Point,
} from '../src/games/floodland/scene.ts';
import assert from 'node:assert/strict';

// Closed basin with varying bed: hydrostatic equilibrium and conservation.
const lake = new FloodSim(16,12); lake.ocean = false;
for (let i=0;i<lake.water.length;i++) {lake.terrain[i]=Math.sin(i)*.4; lake.water[i]=2-lake.terrain[i];}
const volume=lake.volume(), original=lake.water.slice(); lake.advance(60);
assert.ok(Math.abs(lake.volume()-volume)<1e-6);
assert.ok(lake.water.every((h,i)=>Math.abs(h-original[i])<1e-10));
assert.ok(lake.mx.every(q=>Math.abs(q)<1e-10));
// Wet/dry dam break must spread without negative depths or water loss.
const dam = new FloodSim(32,12); dam.ocean=false;
for(let y=0;y<12;y++) for(let x=0;x<8;x++) dam.water[y*32+x]=2;
const v=dam.volume(); dam.advance(40);
assert.ok(dam.water.every(h=>Number.isFinite(h)&&h>=0));
assert.ok(dam.water[6*32+18]>.01);
assert.ok(Math.abs(dam.volume()-v)<1e-6);
console.log('PASS: lake at rest, closed-basin volume, wet/dry dam break.');

// Erosion: still water never erodes; a dam break over erodible ground keeps its
// water volume, never cuts below the floor, and wears loose sand before old ground.
function erodible(sim: FloodSim, oldCritical: number) {
  const n = sim.terrain.length;
  sim.erosion = {
    floor: new Float64Array(n).fill(-1), hardTop: sim.terrain.slice(),
    sand: { critical: 1, rate: .01 }, critical: new Float32Array(n).fill(oldCritical), rate: new Float32Array(n).fill(.01),
    slump: { height: 1, rate: .01 },
  };
}
const still = new FloodSim(16,12); still.ocean=false;
for (let i=0;i<still.water.length;i++) {still.terrain[i]=Math.sin(i)*.4; still.water[i]=2-still.terrain[i];}
erodible(still, .1); const stillBed=still.terrain.slice(); still.advance(60);
assert.deepEqual(still.terrain, stillBed, 'Water at rest does not erode');
const scour = new FloodSim(32,12); scour.ocean=false;
for(let y=0;y<12;y++) for(let x=0;x<32;x++) scour.terrain[y*32+x] = x>=12&&x<=14 ? .5 : 0;
erodible(scour, 100);
for(let y=0;y<12;y++) { for(let x=12;x<=14;x++) scour.terrain[y*32+x] += .6; for(let x=0;x<8;x++) scour.water[y*32+x]=3; }
const scourVolume = scour.volume(); scour.advance(120);
assert.ok(Math.abs(scour.volume()-scourVolume)<1e-6, 'Erosion conserves water');
assert.ok(scour.terrain.every((z,i)=>z>=scour.erosion!.floor[i]));
assert.ok(scour.terrain.some((z,i)=>z<scour.erosion!.hardTop[i]+.6-1e-3), 'Fast water wears the sand');
assert.ok(scour.terrain.every((z,i)=>z>=scour.erosion!.hardTop[i]-1e-12), 'Sturdy old ground under the sand holds');
console.log('PASS: no erosion at rest, volume conserved, floor and layer respected.');

// The storm and the sea boundary.
assert.equal(stormStrength(-1),0); assert.equal(stormStrength(STORM_LENGTH+1),0); assert.equal(stormStrength(15),1);
for (let t=0;t<30;t+=.1) assert.ok(Math.abs(seaLevelAt(t,null))<=.1+1e-12, 'Calm sea is a gentle swell');
const calm=makeScene(), calmInitial=calm.volume();
assert.ok(POOL.every(i=>calm.water[i]>0));
for (let t=0;t<150;t+=1/30) { calm.seaLevel=seaLevelAt(t,null); calm.advance(TIME_SCALE/30); }
assert.ok(calm.pumpedVolume>100,'Automatic pump runs without a storm');
assert.ok(POOL.every(i=>Math.abs(calm.terrain[i]+calm.water[i]-PUMP.targetLevel)<.03),'...and holds the pond at its target level');
assert.ok(POOL.every(i=>calm.water[i]>.4),'Pump retains the pond');
assert.ok(HOMES.every(([x,y])=>calm.water[y*W+x]<.001),'The swell stays outside');
assert.ok(Math.abs(calm.volume()-calmInitial-calm.boundaryVolume)<1e-5,'Boundary accounts for all water');
assert.ok(calm.terrain.every((z,i)=>Math.abs(z-makeScene().terrain[i])<1e-12),'The swell does not erode the dike');
console.log('PASS: storm profile, calm swell, pump regulation, boundary accounting, no calm erosion.');

// The challenge, played headlessly at 60 frames per second.
const crestOf = (s: FloodSim, r: {y0:number;y1:number}) => {
  let m = Infinity; for (let y=r.y0;y<=r.y1;y++) { let c=-Infinity; for(let x=20;x<=24;x++) c=Math.max(c,s.terrain[y*W+x]); m=Math.min(m,c); } return m;
};
function raise(s: FloodSim, r: {y0:number;y1:number}, crest: number) {
  const points: Point[] = []; for (let y=r.y0-1;y<=r.y1+1;y+=.25) points.push({x:22.5,y});
  let used = 0; for (let k=0;k<400 && crestOf(s,r)<crest;k++) used += placeSand(s,points,.02,Infinity);
  return used;
}
function play(prepare: (s: FloodSim)=>number, hold: (t: number)=>Point|null = () => null) {
  const s = makeScene(); let budget = BUDGET - prepare(s), mask = 0, worst = 0;
  for (let f=1; f<=ROUND_LENGTH*60; f++) {
    const t = f/60, p = hold(t);
    if (p) budget -= placeSand(s,[p],SAND_RATE/60,budget);
    s.seaLevel = seaLevelAt(t, ROUND.warning);
    const start = performance.now(); s.advance(TIME_SCALE/60); worst = Math.max(worst, performance.now()-start);
    mask |= floodedHomes(s);
    assert.ok(s.water.every(h=>Number.isFinite(h)&&h>=0));
  }
  // As in the game: homes behind a breach cut below the calm sea are lost too.
  homeSpillLevels(s.terrain).forEach((level, k) => { if (level < CALM_SEA) mask |= 1 << k; });
  return { flooded: countBits(mask), budget, sill: crestOf(s,SILL), road: crestOf(s,ROAD), worst };
}
const nothing = play(() => 0);
assert.ok(nothing.flooded>=6, `Undefended: ${nothing.flooded} homes flood`);
assert.ok(nothing.sill<0, 'The overtopped sill breaches');
const sillOnly = play(s => raise(s,SILL,3.1));
assert.ok(sillOnly.flooded>0 && sillOnly.road<.5, 'Water finds the next low spot: the road breaches');
const both = play(s => raise(s,SILL,2.9)+raise(s,ROAD,2.9));
assert.equal(both.flooded,0,'Closing both gaps keeps every home dry');
assert.ok(both.budget>BUDGET/3,'...with sand to spare');
const sweep = (y0:number,y1:number,t:number) => { const u=(t*2)%1; return {x:22.5,y:y0+(y1-y0)*(u<.5?2*u:2-2*u)}; };
const rescue = play(() => 0, t => t>12&&t<18 ? sweep(16,23,t) : t>22&&t<26 ? sweep(5,9,t) : null);
assert.equal(rescue.flooded,0,'Sandbagging during the storm, in time, saves everyone');
console.log(`PASS: challenge outcomes. Flooded: nothing ${nothing.flooded}, sill only ${sillOnly.flooded}, both ${both.flooded} (sand left ${both.budget.toFixed(0)}), live rescue ${rescue.flooded}. Worst solver frame ${Math.max(nothing.worst,both.worst).toFixed(1)} ms.`);

// Spill level: the lowest sea level that can reach a home.
const spillScene = makeScene();
assert.equal(spillLevel(spillScene.terrain), SILL.profile[2]);
raise(spillScene,SILL,3.1); assert.equal(spillLevel(spillScene.terrain), ROAD.profile[2]);
raise(spillScene,ROAD,3.1); assert.ok(Math.abs(spillLevel(spillScene.terrain)-3.1)<.05);

// Live recording: bounded memory, exact at frame times, interpolated between.
const rec = new LiveRecording(W*H, ROUND_LENGTH+1);
assert.ok(rec.bytes < 64*1024*1024);
const live = makeScene(), frames: Float64Array[][] = [];
for (let f=0; f<=96; f++) {
  const t = f/60;
  if (f) { live.seaLevel = seaLevelAt(t, 0); live.advance(TIME_SCALE/60); placeSand(live,[{x:30.5,y:10.5}],SAND_RATE/60,Infinity); }
  rec.capture(t, live, f>45 ? 3 : 0);
  if (f % 4 === 0) frames.push([live.terrain.slice(), live.water.slice()]);
}
assert.ok(Math.abs(rec.duration-1.6)<1e-9);
const view = makeScene();
assert.equal(rec.restore(1.6, view), 3);
assert.ok(view.terrain.every((z,i)=>Math.abs(z-live.terrain[i])<1e-5),'Terrain (sand) is recorded');
assert.ok(view.water.every((h,i)=>Math.abs(h-live.water[i])<1e-5));
assert.equal(rec.restore(0, view), 0);
assert.ok(view.water.every((h,i)=>Math.abs(h-frames[0][1][i])<1e-6));
rec.restore(.1, view); const a = view.water.slice();
rec.restore(.1, view); assert.deepEqual(view.water, a, 'Seeking is repeatable');
assert.equal(RECORD_FPS, 15);
console.log('PASS: spill level, recording bounds, sand in recordings, seeking.');

// Splash: a bump only where water already is, spreading as a wave.
const pond = makeScene(), dry = pond.water.slice();
pond.splash(8, 20, .9, 1.6); pond.splash(40, 20, .9, 1.6);
assert.ok(pond.water[20*W+8] > dry[20*W+8] + .5);
assert.equal(pond.water[20*W+40], 0, 'No splash on dry land');
pond.advance(10); assert.ok(Math.hypot(pond.mx[20*W+11], pond.my[20*W+11]) > .01, 'The bump spreads');
console.log('PASS: splash.');

// Pump capacity, availability, momentum removal and explicit outlet accounting.
const pump = new FloodSim(8,8); pump.ocean=false;pump.water[10]=.5;pump.mx[10]=1;
const pumpVolume=pump.volume();
assert.equal(pump.pump([10],20,10,2),20);
assert.equal(pump.water[10],.3);assert.equal(pump.mx[10],.6);assert.equal(pump.water[20],.2);
assert.equal(pump.pump([10],20,100,2),30);assert.equal(pump.water[10],0);
assert.equal(pump.pump([10],20,100,2),0);assert.ok(Math.abs(pump.volume()-pumpVolume)<1e-9);
const regulated=new FloodSim(8,8);regulated.terrain[10]=-2;regulated.water[10]=1.5;
assert.equal(regulated.pump([10],20,100,10,-1),50);
assert.equal(regulated.water[10],1);
assert.equal(PUMP.capacity, 35);

// Hold duration controls height, with a hard height cap and a partial final layer.
const brushPoint=[{x:22.5,y:20.5}];
function paint(fps:number){const sim=makeScene();let budget=210;for(let k=0;k<fps;k++)budget-=placeSand(sim,brushPoint,SAND_RATE/fps,budget);return {sim,budget};}
const brush30=paint(30),brush120=paint(120);
assert.ok(brush30.sim.terrain.every((h,i)=>Math.abs(h-brush120.sim.terrain[i])<1e-12));
assert.ok(Math.abs(brush30.budget-brush120.budget)<1e-10);
assert.ok(Math.abs(brush30.sim.terrain[20*W+22]-(SILL.profile[2]+SAND_RATE))<1e-10);
const limited=makeScene();assert.equal(placeSand(limited,brushPoint,10,.5),.5);
const before=limited.terrain.slice();assert.equal(placeSand(limited,brushPoint,10,0),0);assert.deepEqual(limited.terrain,before);
placeSand(limited,brushPoint,100,1000);assert.equal(limited.terrain[20*W+22],4);
const pondBed=limited.terrain.slice();placeSand(limited,[{x:51.5,y:31.5}],10,1000);assert.ok(POOL.every(i=>limited.terrain[i]===pondBed[i]));
const reset = makeScene(); reset.water.fill(9); resetWater(reset); assert.ok(HOMES.every(([x,y])=>reset.water[y*W+x]===0));
assert.equal(makeScene().terrain.length, W*H);
console.log('PASS: pump, progressive sand, frame-rate independence, height cap, limited budget, protected pond, water reset.');

// Round 2: hidden weak spots, found by test storms.
import { chooseWeakSections, weakDike, stormRun, finish, random, SECTIONS, WEAK_STORM, WEAK_BUDGET, TEST_STORMS,
  fragilityRun, uniformDike, heightScore, century, dikeCost, exceedance, HEIGHT } from '../src/games/floodland/rounds.ts';
{
  const sections = new Set<string>();
  for (let seed = 1; seed <= 20; seed++) { const w = chooseWeakSections(random(seed)); assert.equal(new Set(w).size, 3); sections.add(w.join()); }
  assert.ok(sections.size > 8, 'Weak spots differ from round to round');
  const weak = chooseWeakSections(random(4)), dike = weakDike(weak), scene = makeScene(dike);
  const brokeIn = (r: { eroded: Float64Array }) => SECTIONS.map((s, k) => { for (let y = s.y0; y <= s.y1; y++) if (r.eroded[y] > .15) return k; return -1; }).filter(k => k >= 0);
  const small = finish(stormRun(scene.terrain, dike, TEST_STORMS.min));
  assert.deepEqual(brokeIn(small), [], 'A small test storm shows nothing: one test can mislead');
  const big = finish(stormRun(scene.terrain, dike, TEST_STORMS.max));
  assert.deepEqual(brokeIn(big), weak, 'A big test storm breaks exactly the weak sections');
  assert.ok(countBits(finish(stormRun(scene.terrain, dike, WEAK_STORM)).flooded) >= 6, 'Undefended, the real storm floods the village');
  const reinforce = (ks: number[]) => {
    const s = makeScene(dike); let used = 0;
    for (const k of ks) { const pts: Point[] = []; for (let y = SECTIONS[k].y0 - .5; y <= SECTIONS[k].y1 + .5; y += .25) pts.push({ x: 22.5, y }); for (let n = 0; n < 300 && crestOf(s, SECTIONS[k]) < 3.4; n++) used += placeSand(s, pts, .02, Infinity); }
    return { used, flooded: countBits(finish(stormRun(s.terrain, dike, WEAK_STORM)).flooded) };
  };
  const right = reinforce(weak), wrong = reinforce(SECTIONS.map((_, k) => k).filter(k => !weak.includes(k)).slice(0, 3));
  assert.equal(right.flooded, 0, 'Reinforcing the weak sections keeps everyone dry');
  assert.ok(right.used < WEAK_BUDGET, '...within the budget');
  assert.ok(wrong.flooded > 0, 'Reinforcing the wrong sections does not');
  assert.ok(reinforce(SECTIONS.map((_, k) => k)).used > WEAK_BUDGET, 'There is not enough sand for every section');
  console.log(`PASS: round 2. Weak ${weak}; right sections ${right.used.toFixed(0)} sand, 0 flooded; wrong sections ${wrong.flooded} flooded.`);
}

// Round 3: a fragility curve, storm odds and the cost of height.
{
  const f = finish(fragilityRun(2.5));
  assert.equal(f.flooded[0], 0, 'Storms below the crest flood nothing');
  assert.equal(f.flooded.at(-1), 8, 'Storms well above it flood everything');
  for (let k = 1; k < f.flooded.length; k++) assert.ok(f.flooded[k] >= f.flooded[k - 1], 'More storm, more damage');
  const g = finish(fragilityRun(3.25));
  for (let z = HEIGHT.min; z <= HEIGHT.max; z += .25) assert.ok(Math.abs(f.expectedDamage(z) - g.expectedDamage(z)) <= Math.max(5, .1 * g.expectedDamage(z)), 'Shifting the curve with the crest is a good approximation');
  const scores = [1.5, 2.75, 4].map(z => heightScore(f, z));
  assert.ok(scores[1] > scores[0] && scores[1] > scores[2], `Neither too low nor too high: ${scores}`);
  assert.equal(dikeCost(HEIGHT.min), 0);
  assert.ok(Math.abs(exceedance(10)) < 1e-9 && Math.abs(exceedance(-10) - 1) < 1e-9);
  const a = century(f, random(9)), b = century(f, random(9));
  assert.deepEqual(a, b, 'A seeded century is repeatable');
  assert.equal(a.peaks.length, 100);
  assert.deepEqual(uniformDike(3)(0).profile, uniformDike(3)(39).profile);
  console.log(`PASS: round 3. Fragility ${f.flooded.join(' ')}; scores at 1.5 / 2.75 / 4 m: ${scores.join(' / ')}.`);
}

// Round 4: the gate, the forecast.
import { harbourScene, setGate, barrierSeaLevel, barrierThreats, ensemble, forecastLevel, forecastSpread, threatStrength,
  BARRIER_LENGTH, GATE, HARBOUR, ENSEMBLE } from '../src/games/floodland/rounds.ts';
{
  const threats = [{ peak: .5, time: 16 }, { peak: 1.6, time: 34 }, { peak: 2.6, time: 52 }];
  const run = (shut: (t: number) => boolean) => {
    const s = harbourScene(); let mask = 0, g = 0;
    for (let f = 1; f <= BARRIER_LENGTH * 60; f++) {
      const t = f / 60;
      g = Math.max(0, Math.min(1, g + Math.sign((shut(t) ? 1 : 0) - g) / (GATE.seconds * 60)));
      setGate(s, g); s.seaLevel = barrierSeaLevel(t, threats); s.advance(TIME_SCALE / 60);
      mask |= floodedHomes(s);
      assert.ok(s.water.every(h => Number.isFinite(h) && h >= 0));
    }
    return countBits(mask);
  };
  const calm = harbourScene();
  assert.ok(Math.abs(calm.water[10 * W + 30] - 2.5) < 1e-9, 'The harbour is open water at sea level');
  const open = run(() => false), both = run(t => (t > 25 && t < 40) || (t > 43 && t < 58));
  const bigOnly = run(t => t > 43 && t < 58), late = run(t => (t > 25 && t < 40) || (t > 50 && t < 58));
  assert.equal(open, 8, 'An open gate floods the village');
  assert.equal(both, 0, 'Closing for both real threats keeps it dry');
  assert.ok(bigOnly > 0 && bigOnly < open, 'Skipping the medium storm costs a little');
  assert.ok(late > 0, 'Closing too late costs too');
  assert.equal(run(() => true), 0);
  const th = barrierThreats(random(3));
  assert.deepEqual(th.map(x => x.peak).sort(), [.5, 1.6, 2.6]);
  assert.equal(threatStrength(0), 1); assert.equal(threatStrength(10), 0);
  assert.ok(forecastSpread(18) > 3 * forecastSpread(2), 'Forecasts narrow as the storm nears');
  const members = ensemble(random(5), 1), one = [{ peak: 1.6, time: 30 }];
  const spreadAt = (now: number) => { const v = members.map(m => forecastLevel(30, now, one, m)); return Math.max(...v) - Math.min(...v); };
  assert.equal(members.length, ENSEMBLE);
  assert.ok(spreadAt(10) > 2 * spreadAt(27), 'The ensemble closes in on the storm');
  const mean = members.reduce((a, m) => a + forecastLevel(30, 30, one, m), 0) / ENSEMBLE;
  assert.ok(Math.abs(mean - 1.6) < .1, 'At the peak the forecasts agree with the truth');
  assert.ok(HARBOUR.quay < 1.6);
  console.log(`PASS: round 4. Flooded: gate open ${open}, closed for both ${both}, big only ${bigOnly}, late ${late}.`);
}

// ---- Free play: the water table, on the second-order scheme ----
import {
  BRUSH, Ground, MAX_DUCKS, PLAY_TIME_SCALE, SPRING, averageFlow, currents, groundKinds, makePlayground, moveDucks,
  moveFlecks, newDuck, playSeaLevel, pour, push, resetPlayWater, shapeGround, soak, wash, type Duck, type Fleck,
} from '../src/games/floodland/playground.ts';
{
  // Second order is still well balanced (also round a dry island) and conservative.
  const lake2 = new FloodSim(16, 12); lake2.ocean = false; lake2.secondOrder = true;
  for (let i = 0; i < lake2.water.length; i++) { lake2.terrain[i] = Math.sin(i) * .4; lake2.water[i] = 2 - lake2.terrain[i]; }
  const v2 = lake2.volume(), o2 = lake2.water.slice(); lake2.advance(60);
  assert.ok(Math.abs(lake2.volume() - v2) < 1e-6);
  assert.ok(lake2.water.every((h, i) => Math.abs(h - o2[i]) < 1e-10) && lake2.mx.every(q => Math.abs(q) < 1e-10));
  const isle = new FloodSim(20, 20); isle.ocean = false; isle.secondOrder = true;
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    const i = y * 20 + x; isle.terrain[i] = 1.5 * Math.exp(-((x - 10) ** 2 + (y - 10) ** 2) / 12) + .3 * Math.sin(x) - 1;
    isle.water[i] = Math.max(0, -isle.terrain[i]);
  }
  const o3 = isle.water.slice(); isle.advance(100);
  assert.ok(isle.water.every((h, i) => Math.abs(h - o3[i]) < 1e-10), 'Lake at rest round a dry island');
  const dam2 = new FloodSim(32, 12); dam2.ocean = false; dam2.secondOrder = true;
  for (let y = 0; y < 12; y++) for (let x = 0; x < 8; x++) dam2.water[y * 32 + x] = 2;
  const v3 = dam2.volume(); dam2.advance(40);
  assert.ok(dam2.water.every(h => Number.isFinite(h) && h >= 0) && dam2.water[6 * 32 + 18] > .01);
  assert.ok(Math.abs(dam2.volume() - v3) < 1e-6, 'Second-order dam break conserves water');
  // Short waves from the sea edge travel much further before the scheme smears them out.
  const reach = (second: boolean) => {
    const c = new FloodSim(200, 1); c.waveBoundary = true; c.friction = .004; c.secondOrder = second;
    for (let x = 0; x < 200; x++) { c.terrain[x] = -2; c.water[x] = 2; }
    let amp = 0;
    for (let t = 0; t < 12; t += 1 / 60) { c.seaLevel = .25 * Math.sin(2 * Math.PI * t / 1.2); c.advance(24 / 60); if (t > 8) amp = Math.max(amp, Math.abs(c.water[24] - 2)); }
    return amp;
  };
  const first = reach(false), second = reach(true);
  assert.ok(second > 3 * first, `A 13-cell wave keeps its height (${second.toFixed(3)} vs ${first.toFixed(3)} m after 24 cells)`);
  console.log(`PASS: second order: lake at rest, dry island, dam break; wave after 24 cells ${second.toFixed(3)} m (first order ${first.toFixed(3)} m).`);
}
{
  const frame = 1 / 60, physical = PLAY_TIME_SCALE / 60;
  const play = (s: FloodSim, mean: ReturnType<typeof currents>, t: number, wave: number | null = null) => {
    s.seaLevel = playSeaLevel(t, wave); s.advance(physical); soak(s, physical); averageFlow(s, mean, frame); wash(s, mean, physical);
  };
  // The river runs from the spring to the sea, and carries ducks there.
  const s = makePlayground(), mean = currents(), kinds = groundKinds(s.terrain), start = s.water.slice();
  assert.ok(s.secondOrder && s.sources.length > 0);
  let ducks: Duck[] = [0, 1, 2, 3].map(k => newDuck(SPRING.x + .5 + k * .3, SPRING.y + .8, true));
  const arrived = new Set<Duck>();
  for (let t = 0; t < 40; t += frame) {
    play(s, mean, t);
    ducks = moveDucks(s, ducks, frame);
    for (const d of ducks) if (d.x < 18) arrived.add(d);
  }
  assert.equal(arrived.size, 4, 'Ducks from the spring float down to the sea within 40 s');
  // The calm sea stays on the beach: the fields (three squares or more from any water
  // at the start) stay dry.
  let near = Uint8Array.from(start, h => (h > .01 ? 1 : 0));
  for (let k = 0; k < 3; k++) near = near.map((v, i) => v || near[i - 1] || near[i + 1] || near[i - W] || near[i + W] ? 1 : 0);
  const inland = [...kinds.keys()].filter(i => kinds[i] === Ground.Grass && !near[i]);
  assert.ok(inland.every(i => s.water[i] < .02), 'The swell and the river stay out of the fields');
  // A big wave runs up the beach and over low dunes, then soaks away.
  const beach = [...kinds.keys()].filter(i => kinds[i] === Ground.Beach && start[i] < .01);
  let wetBeach = 0, wetLand = 0;
  for (let t = 40; t < 70; t += frame) {
    play(s, mean, t, 40);
    if (t < 46) { wetBeach = Math.max(wetBeach, beach.filter(i => s.water[i] > .05).length); wetLand = Math.max(wetLand, inland.filter(i => s.water[i] > .02).length); }
  }
  const stillWet = inland.filter(i => s.water[i] > .02).length;
  assert.ok(wetBeach > beach.length / 3, `The big wave runs up the beach (${wetBeach} of ${beach.length} cells)`);
  assert.ok(wetLand < inland.length / 4, 'The dunes keep most of it off the fields');
  assert.ok(stillWet <= wetLand / 4, `Its wash soaks away (${stillWet} of ${wetLand} field cells still wet)`);
  console.log(`PASS: water table: ducks reach the sea, the swell stays on the beach, the big wave wets ${wetBeach} beach and ${wetLand} field cells, ${stillWet} still wet after 24 s.`);
}
{
  const frame = 1 / 60, physical = PLAY_TIME_SCALE / 60;
  const sandOf = (s: FloodSim) => { let v = 0; for (let i = 0; i < W * H; i++) v += Math.max(0, s.terrain[i] - s.erosion!.hardTop[i]); return v; };
  const run = (s: FloodSim, mean: ReturnType<typeof currents>, from: number, to: number, wave: number | null = null) => {
    for (let t = from; t < to; t += frame) { s.seaLevel = playSeaLevel(t, wave); s.advance(physical); soak(s, physical); averageFlow(s, mean, frame); wash(s, mean, physical); }
  };
  // A dam of sand across the river valley fills a lake, overtops, bursts and widens;
  // its sand is carried on, never lost.
  const s = makePlayground(), mean = currents();
  run(s, mean, 0, 5);
  for (let y = 12; y <= 34; y++) for (let k = 0; k < 4; k++) shapeGround(s, 29.5, y + .5, .12 + .02 * Math.sin(y * 3));
  const dam = Array.from({ length: 23 }, (_, k) => (12 + k) * W + 29), crest = Math.min(...dam.map(i => s.terrain[i])), sand = sandOf(s);
  run(s, mean, 5, 60);
  const low = Math.min(...dam.map(i => s.terrain[i])), breach = dam.filter(i => s.terrain[i] < crest - .3).length;
  assert.ok(low < crest - .7, `The overtopped dam bursts (lowest crest ${crest.toFixed(2)} → ${low.toFixed(2)} m)`);
  assert.ok(breach >= 3, 'and the breach widens');
  assert.ok(Math.abs(sandOf(s) - sand) < 1e-6, 'Washing moves sand, it does not lose it');
  // An island built well above the sea stays in the swell; the big wave takes a bite.
  const isle = makePlayground(), m2 = currents();
  for (let k = 0; k < 25; k++) shapeGround(isle, 8, 20, .2);
  const top = () => Math.max(...[-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => isle.terrain[(20 + dy) * W + 8 + dx])));
  const built = top();
  run(isle, m2, 0, 30);
  const calm = top();
  run(isle, m2, 30, 45, 30);
  assert.ok(built - calm < .4, `An island stays in the swell (${built.toFixed(2)} → ${calm.toFixed(2)} m)`);
  assert.ok(top() < calm - .3, 'and the big wave washes part of it away');
  console.log(`PASS: sand: the dam bursts (${crest.toFixed(2)} → ${low.toFixed(2)} m, ${breach} cells wide), sand conserved; island ${built.toFixed(2)} → ${calm.toFixed(2)} → ${top().toFixed(2)} m.`);
}
{
  // Kiosk safety: two minutes of a wild child — sand, holes, pouring, pushing and
  // splashing anywhere, ducks, and a big wave every 15 s — never breaks the water.
  const frame = 1 / 60, physical = PLAY_TIME_SCALE / 60, rng = random(11);
  const s = makePlayground(), mean = currents();
  let ducks: Duck[] = [], failures = 0, worst = 0, total = 0;
  const flecks: Fleck[] = [];
  for (let f = 0; f < 120 * 60; f++) {
    const t = f * frame, x = rng() * W, y = rng() * H, tool = Math.floor(t / 3) % 5;
    if (tool === 0) shapeGround(s, x, y, BRUSH.sand * frame * 6);
    if (tool === 1) shapeGround(s, x, y, -BRUSH.dig * frame * 6);
    if (tool === 2) pour(s, x, y, BRUSH.pour * frame * 3);
    if (tool === 3) push(s, x, y, (rng() - .5) * 20, (rng() - .5) * 20, frame);
    if (tool === 4 && f % 20 === 0) { s.splash(x, y, 1.2, 1.6); ducks.push(newDuck(x, y)); }
    s.seaLevel = playSeaLevel(t, Math.floor(t / 15) * 15);
    const a = performance.now();
    try { s.advance(physical); } catch { failures++; resetPlayWater(s); }
    const c = performance.now() - a; worst = Math.max(worst, c); total += c;
    soak(s, physical); averageFlow(s, mean, frame); wash(s, mean, physical);
    ducks = moveDucks(s, ducks, frame).slice(-MAX_DUCKS);
    moveFlecks(s, flecks, 300, frame, rng);
  }
  assert.equal(failures, 0, 'No numerical failures');
  assert.ok(s.water.every(h => Number.isFinite(h) && h >= 0) && s.mx.every(Number.isFinite) && s.my.every(Number.isFinite));
  assert.ok(s.terrain.every(z => z >= BRUSH.bottom - 1e-9 && z <= BRUSH.top + 1e-9), 'Sand and holes stay within their limits');
  assert.ok(ducks.every(d => d.x >= 0 && d.x <= W && d.y >= 0 && d.y <= H && Number.isFinite(d.vx)));
  assert.ok(flecks.every(p => Number.isFinite(p.x)) && flecks.length > 100);
  // After a numerical failure the water comes back, over the ground as it is now.
  s.water.fill(NaN); resetPlayWater(s);
  assert.ok(s.water.every(h => Number.isFinite(h) && h >= 0) && s.water[20 * W + 2] > 1);
  console.log(`PASS: two wild minutes: no failures; solver ${(total / 7200).toFixed(2)} ms per frame on average, worst ${worst.toFixed(1)} ms.`);
}
