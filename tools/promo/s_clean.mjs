import { open, circle } from './common.mjs';
const btn = (h, t) => h.eval_(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('${t}')).click()`);
const style = (h, css) => h.eval_(`(()=>{let s=document.getElementById('cap');if(!s){s=document.createElement('style');s.id='cap';document.head.appendChild(s)}s.textContent=${JSON.stringify(css)}})()`);
const CANVAS_ONLY = 'body *{visibility:hidden!important} canvas{visibility:visible!important}';
const NO_BUTTONS = 'button{visibility:hidden!important}';
export default async (h) => {
  const only = process.argv[3]?.split(',');
  const want = (k) => !only || only.includes(k);
  if (want('stir')) {
    await open(h, 'windfarm');
    await h.drag(circle(760, 560, 230, 24, 1), 30);
    await h.drag(circle(1180, 520, 200, 24, 1, 2).reverse(), 30);
    await h.drag(Array.from({length:30},(_,i)=>[250+i*48, 560+220*Math.sin(i/4)]), 30);
    await h.sleep(1500);
    await style(h, CANVAS_ONLY); await h.shot('c_stir');
  }
  if (want('farm')) {
    await open(h, 'windfarm');
    await btn(h, 'Computer');
    for (let i = 0; i < 4; i++) { await h.sleep(6000); await style(h, 'button,.game-toolbar{visibility:hidden!important}'); await h.shot('c_farm' + i); }
  }
  if (want('outbreak')) {
    await open(h, 'outbreak');
    await h.click(700, 400);
    await h.sleep(14000);
    await style(h, NO_BUTTONS + ' .game-hint,.hint{visibility:hidden!important}'); await h.shot('c_outbreak');
  }
  if (want('flood')) {
    await open(h, 'floodland');
    await btn(h, 'Start de storm'); await h.sleep(500); await btn(h, 'Drie golven');
    await style(h, CANVAS_ONLY);
    for (const t of [13500, 1500, 1500, 1500, 3000]) { await h.sleep(t); await h.shot('c_flood_' + Date.now() % 100000); }
  }
  if (want('detective')) {
    await open(h, 'detective');
    for (const [x, y] of [[700,300],[900,280],[620,500],[850,560],[700,700],[950,800],[800,950],[1050,450],[520,640]]) { await h.click(x, y); await h.sleep(500); }
    await h.sleep(2500);
    await h.shot('c_det_ui');
    await style(h, NO_BUTTONS); await h.shot('c_det');
  }
  if (want('creature')) {
    await open(h, 'creature');
    await btn(h, 'TRAINEN');
    await h.sleep(22000);
    await style(h, CANVAS_ONLY); await h.shot('c_creature');
  }
};
