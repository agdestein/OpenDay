import { FloodRecording, RECORD_FPS } from '../src/games/floodland/recording.ts';
import { FloodSim, GRID_W as W, GRID_H as H } from '../src/games/floodland/water.ts';
import { makeScene, resetWater, dikePlan, surge, STORM_DURATION, HOMES, BUDGET } from '../src/games/floodland/scene.ts';
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
 assert.ok(Math.abs(s.volume()-initial-s.boundaryVolume)<1e-5);
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
assert.ok(recording.values.byteLength < 40 * 1024 * 1024);
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
assert.equal(recording.frames, STORM_DURATION*RECORD_FPS+1);
console.log('PASS: recording memory bound, full-run agreement, backward/forward seeking, momentum, historical damage and flood extent.');
