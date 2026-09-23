import { open, hideUi, circle } from './common.mjs';
const btn = (h, t) => h.eval_(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('${t}')).click()`);
export default async (h) => {
  // outbreak
  await open(h, 'outbreak');
  await h.click(700, 400);
  await h.sleep(15000); await h.shot('ob_1');
  await h.sleep(10000); await h.shot('ob_2');
  // floodland
  await open(h, 'floodland');
  await btn(h, 'Storm!');
  for (let t of [6, 12, 20, 30]) { await h.sleep(t === 6 ? 6000 : (t === 12 ? 6000 : (t===20?8000:10000))); await h.shot('fl_' + t); }
  // detective
  await open(h, 'detective');
  for (const [x, y] of [[420,520],[560,380],[700,600],[520,760],[800,420],[640,900],[300,820]]) { await h.click(x, y); await h.sleep(400); }
  await h.sleep(2000); await h.shot('de_1');
  // orbits
  await open(h, 'orbits');
  const launches = [[[960,300],[1060,300]],[[960,800],[830,800]],[[600,540],[600,420]],[[1400,540],[1400,680]],[[960,200],[1080,200]]];
  for (const [a, b] of launches) { await h.drag([a, [(a[0]+b[0])/2,(a[1]+b[1])/2], b], 60); await h.sleep(300); }
  await h.sleep(6000); await h.shot('or_1');
  // creature
  await open(h, 'creature');
  await btn(h, 'TRAINEN');
  await h.sleep(20000); await h.shot('cr_1');
  await h.sleep(20000); await h.shot('cr_2');
};
