import { open, hideUi, circle } from './common.mjs';
export default async (h) => {
  await open(h, 'windfarm');
  console.log(await h.eval_(`(()=>{const g=document.querySelector('canvas').getContext('webgl2');const e=g&&g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):'?'})()`));
  // swirl stirring
  await h.drag(circle(700, 540, 250, 40, 2), 16);
  await h.drag(circle(1250, 500, 200, 40, 2, 1).reverse(), 16);
  await h.drag(Array.from({length:60},(_,i)=>[300+i*22, 540+200*Math.sin(i/6)]), 16);
  await h.sleep(800);
  await hideUi(h);
  await h.shot('wind_stir');
  // vortex street: wind + blocks
  let bs = await h.eval_(`[...document.querySelectorAll('button')].map(b=>b.textContent.trim())`);
  const btn = (t) => h.eval_(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('${t}')).click()`);
  await h.eval_(`document.getElementById('hideui').remove()`);
  await btn('Wissen'); await btn('Wind'); await btn('Blokken');
  await h.click(560, 400); await h.click(560, 700); await h.click(1000, 550);
  await h.sleep(14000);
  await hideUi(h);
  await h.shot('wind_street');
};
