import { open, circle } from './common.mjs';
const btn = (h, t) => h.eval_(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('${t}')).click()`);
const style = (h, css) => h.eval_(`(()=>{let s=document.getElementById('cap');if(!s){s=document.createElement('style');s.id='cap';document.head.appendChild(s)}s.textContent=${JSON.stringify(css)}})()`);
const CANVAS_ONLY = 'body *{visibility:hidden!important} canvas{visibility:visible!important}';
const shapes = { L: [1920, 1080, 3], P: [1240, 1754, 3] };
export default async (h) => {
  for (const [k, [w, hh, s]] of Object.entries(shapes)) {
    await open(h, 'windfarm', s, w, hh);
    await btn(h, 'Computer');
    for (let i = 0; i < 4; i++) { await h.sleep(5000); await style(h, 'button,.game-toolbar{visibility:hidden!important}'); await h.shot(`h_farm_${k}${i}`); await style(h, ''); }
    await open(h, 'floodland', s, w, hh);
    await btn(h, 'Storm!');
    await style(h, CANVAS_ONLY);
    await h.sleep(13000);
    for (let i = 0; i < 5; i++) { await h.shot(`h_flood_${k}${i}`); await h.sleep(1500); }
    await open(h, 'windfarm', s, w, hh);
    await btn(h, 'Wind'); await btn(h, 'Blokken');
    if (k === 'L') { await h.click(560, 400); await h.click(560, 700); await h.click(1000, 550); }
    else { await h.click(400, 500); await h.click(700, 800); await h.click(400, 1100); await h.click(750, 1350); }
    await h.sleep(15000);
    await style(h, CANVAS_ONLY); await h.shot(`h_street_${k}`);
  }
};
