import { FloodRecording, RECORD_FPS } from '../src/games/floodland/recording.ts';
import { FloodSim, GRID_W as W, GRID_H as H } from '../src/games/floodland/water.ts';
import { makeScene, resetWater, dikePlan, surge, STORM_DURATION, HOMES, BUDGET, totalDuration, scenarioBudget, POOL, PUMP, placeSand, SAND_RATE } from '../src/games/floodland/scene.ts';
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
function run(crest?:number) {
 const s=makeScene();
 if(crest!==undefined) {
  const p=dikePlan(s,[{x:22.5,y:15},{x:22.5,y:25}],crest);
  const cost=[...p.values()].reduce((a,b)=>a+b,0); assert.ok(cost<BUDGET);
  for(const [i,dh] of p) s.terrain[i]+=dh;
  resetWater(s);
 }
 const initial=s.volume(); const flooded=new Set<number>();
 for(let k=1;k<=STORM_DURATION*30;k++) {
  s.seaLevel=surge(k/30); s.advance(24/30);
  HOMES.forEach(([x,y],j)=>{if(s.water[y*W+x]>.3)flooded.add(j);});
 }
 assert.ok(s.water.every(h=>Number.isFinite(h)&&h>=0));
 assert.ok(Math.abs(s.volume()-initial-s.boundaryVolume-s.sourceVolume)<1e-5);
 return {flooded:flooded.size,water:s.water};
}
const open=run(), high=run(2.4), low=run(1);
assert.ok(open.flooded>=6, `Open gap floods ${open.flooded}`);
assert.equal(high.flooded,0,'High dike protects every home');
assert.ok(low.flooded>0,'Low dike overtops');
const replay=run(2.4); assert.deepEqual(replay.water,high.water);
assert.equal(makeScene().terrain.length,W*H);
console.log(`PASS: lake at rest; closed-basin volume; wet/dry dam break; boundary accounting; replay. Homes flooded: open ${open.flooded}, low ${low.flooded}, high ${high.flooded}.`);

// The timeline restores all dynamic fields and historical damage, not just water.
const recordingScene = makeScene();
const recording = new FloodRecording(recordingScene.terrain, W, H);
assert.ok(recording.values.byteLength < 64 * 1024 * 1024);
assert.equal(recording.restore(STORM_DURATION, recordingScene), 255);
assert.ok(recordingScene.water.every((h,i)=>Math.abs(h-open.water[i])<1e-6));
recording.restore(18.123, recordingScene);
const middle = [recordingScene.water.slice(),recordingScene.mx.slice(),recordingScene.my.slice()];
assert.equal(recording.restore(0, recordingScene), 0);
assert.equal(recordingScene.seaLevel,0);
assert.equal(recordingScene.water[20*W+40],0);
assert.ok(recording.maximumThrough(0)[20*W+40]===0);
recording.restore(18.123, recordingScene);
assert.deepEqual(recordingScene.water,middle[0]);
assert.deepEqual(recordingScene.mx,middle[1]);
assert.deepEqual(recordingScene.my,middle[2]);
assert.equal(recording.frames, totalDuration('surge')*RECORD_FPS+1);
console.log('PASS: recording memory bound, full-run agreement, backward/forward seeking, momentum, historical damage and flood extent.');

// Pump capacity, availability, momentum removal and explicit outlet accounting.
const pump = new FloodSim(8,8); pump.ocean=false;pump.water[10]=.5;pump.mx[10]=1;
const pumpVolume=pump.volume();
assert.equal(pump.pump([10],20,10,2),20);
assert.equal(pump.water[10],.3);assert.equal(pump.mx[10],.6);assert.equal(pump.water[20],.2);
assert.equal(pump.pump([10],20,100,2),30);assert.equal(pump.water[10],0);
assert.equal(pump.pump([10],20,100,2),0);assert.ok(Math.abs(pump.volume()-pumpVolume)<1e-9);
function polderVolume(sim: FloodSim) {
 let volume=0;for(let y=0;y<H;y++)for(let x=25;x<W;x++)volume+=sim.water[y*W+x]*100;return volume;
}
recording.restore(STORM_DURATION,recordingScene);const startRecovery=polderVolume(recordingScene);
recording.restore(recording.duration,recordingScene);const cleared=polderVolume(recordingScene);
assert.ok(cleared < startRecovery*.08, `Recovery remaining ${cleared/startRecovery}`);
assert.ok(recording.pumpedAt(recording.duration)>startRecovery-cleared,'Pump removes the retained floodwater');
assert.ok(recording.pumpedAt(2)>0,'Pump operates before the flood arrives');
assert.ok(recording.pumpRates.every(rate=>rate>=0&&rate<=35.00001));
const initialVolume=makeScene().volume();
assert.ok(Math.abs(recordingScene.volume()-initialVolume-recording.boundary.at(-1)!-recording.sources.at(-1)!)<.1,'Pump transfer preserves total volume');

const unpumpedScene=makeScene();const unpumped=new FloodRecording(unpumpedScene.terrain,W,H,'surge',false);
unpumped.restore(unpumped.duration,unpumpedScene);
assert.ok(polderVolume(unpumpedScene)>cleared*5,'Recovery is caused by the pump, not a hidden sink');
const waveScene=makeScene('waves');const waves=new FloodRecording(waveScene.terrain,W,H,'waves');
assert.ok(waves.values.byteLength<64*1024*1024);
const amounts:number[]=[];
for(const time of [0,25,42,62]){waves.restore(time,waveScene);amounts.push(polderVolume(waveScene));}
for(let i=1;i<amounts.length;i++)assert.ok(amounts[i]-amounts[i-1]>3000,`Wave ${i} overtopping adds water`);
assert.ok(amounts[3]<startRecovery*.7,'Pulses deliver limited flood volume');
waves.restore(20,waveScene);const arrival=waveScene.water[20*W+40];waves.restore(30,waveScene);
assert.ok(arrival-waveScene.water[20*W+40]>.1,'A pulse passes the village rather than simply filling it');
waves.restore(waves.duration,waveScene);assert.ok(polderVolume(waveScene)<amounts[3]*.2);
assert.ok(Math.abs(waveScene.volume()-makeScene('waves').volume()-waves.boundary.at(-1)!-waves.sources.at(-1)!)<.1,'Wave boundary and recovery account for all water');
const defense=dikePlan(waveScene,[{x:22.5,y:11},{x:22.5,y:29}],2.4);
assert.ok([...defense.values()].reduce((a,b)=>a+b,0)<=scenarioBudget('waves'));
for(const[i,rise]of defense)waveScene.terrain[i]+=rise;
const defendedWaves=new FloodRecording(waveScene.terrain,W,H,'waves');
assert.equal(defendedWaves.restore(defendedWaves.duration,waveScene),0,'Affordable defense protects against all three waves');
console.log('PASS: conservative regulated pump; capacity and availability; recovery versus pump-off; three overtopping pulses; traveling front; affordable wave defense; recovery seek and bounded storage.');

// The permanent sill separates the calm sea from a wet, regulated drainage system.
const calm=makeScene(), calmInitial=calm.volume();
assert.ok(calm.terrain[20*W+22]>0);
assert.ok(POOL.every(i=>calm.water[i]>0));
calm.advance(3600);
assert.ok(calm.pumpedVolume>1000,'Automatic pump runs before any storm');
assert.ok(POOL.every(i=>calm.water[i]>.4),'Pump retains the pond');
assert.ok(POOL.every(i=>Math.abs(calm.terrain[i]+calm.water[i]-PUMP.targetLevel)<.03));
assert.ok(HOMES.every(([x,y])=>calm.water[y*W+x]<.001));
assert.ok(Math.abs(calm.volume()-calmInitial-calm.boundaryVolume-calm.sourceVolume)<1e-5);
const regulated=new FloodSim(8,8);regulated.terrain[10]=-2;regulated.water[10]=1.5;
assert.equal(regulated.pump([10],20,100,10,-1),50);
assert.equal(regulated.water[10],1);
// Hold duration controls height, with a hard height cap and a partial final layer.
const brushPoint=[{x:22.5,y:20.5}];
function paint(fps:number){const sim=makeScene();let budget=210;for(let k=0;k<fps;k++)budget-=placeSand(sim,brushPoint,SAND_RATE/fps,budget);return {sim,budget};}
const brush30=paint(30),brush120=paint(120);
assert.ok(brush30.sim.terrain.every((h,i)=>Math.abs(h-brush120.sim.terrain[i])<1e-12));
assert.ok(Math.abs(brush30.budget-brush120.budget)<1e-10);
assert.ok(Math.abs(brush30.sim.terrain[20*W+22]-(.7+SAND_RATE))<1e-10);
const limited=makeScene();assert.equal(placeSand(limited,brushPoint,10,.5),.5);
const before=limited.terrain.slice();assert.equal(placeSand(limited,brushPoint,10,0),0);assert.deepEqual(limited.terrain,before);
placeSand(limited,brushPoint,100,1000);assert.equal(limited.terrain[20*W+22],4);
const pond=limited.terrain.slice();placeSand(limited,[{x:51.5,y:31.5}],10,1000);assert.ok(POOL.every(i=>limited.terrain[i]===pond[i]));
console.log('PASS: calm isolated polder, permanent pond, automatic level control, source accounting, progressive sand, frame-rate independence, height cap and limited budget.');
