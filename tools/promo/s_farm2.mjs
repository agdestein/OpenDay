import { open } from './common.mjs';
const btn = (h, t) => h.eval_(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('${t}')).click()`);
const style = (h, css) => h.eval_(`(()=>{let s=document.getElementById('cap');if(!s){s=document.createElement('style');s.id='cap';document.head.appendChild(s)}s.textContent=${JSON.stringify(css)}})()`);
export default async (h) => {
  for (const [k, w, hh] of [['L', 1920, 1080], ['P', 1240, 1754]]) {
    await open(h, 'windfarm', 3, w, hh);
    await btn(h, 'Computer');
    await style(h, 'button,.game-toolbar,.challenge-hud,.challenge-hint,.wake-legend,.turbine-power,.delve-toggle{visibility:hidden!important}');
    for (let i = 0; i < 5; i++) { await h.sleep(4500); await h.shot(`f_${k}${i}`); }
  }
};
