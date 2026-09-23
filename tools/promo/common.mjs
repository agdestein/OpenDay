export async function open(h, id, scale = 2, w = 1920, hh = 1080) {
  await h.setup(w, hh, scale);
  await h.nav('http://localhost:5199/?lang=nl&games=' + id);
  await h.sleep(1200);
  await h.eval_(`document.querySelector('.tile').click()`);
  await h.sleep(1200);
  await h.click(w / 2, hh * 0.65);
  await h.sleep(2000);
}
export const hideUi = (h) => h.eval_(`(()=>{const s=document.createElement('style');s.id='hideui';s.textContent='button{visibility:hidden!important}';document.head.appendChild(s)})()`);
export const circle = (cx, cy, r, n = 40, turns = 1, phase = 0) => Array.from({ length: n * turns + 1 }, (_, i) => [cx + r * Math.cos(phase + 2 * Math.PI * i / n), cy + r * Math.sin(phase + 2 * Math.PI * i / n)]);
