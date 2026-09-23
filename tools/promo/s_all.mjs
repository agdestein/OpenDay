const ids = ['windfarm','outbreak','floodland','detective','creature','bounce','orbits'];
export default async ({ setup, nav, shot, sleep, eval_, click }) => {
  await setup(1920, 1080, 1);
  for (const id of ids) {
    await nav('http://localhost:5199/?lang=nl&games=' + id);
    await sleep(1500);
    await eval_(`document.querySelector('.tile').click()`);
    await sleep(1500);
    await click(960, 700);
    await sleep(5000);
    await shot('g_' + id);
    console.log(id, await eval_(`[...document.querySelectorAll('button')].filter(b=>b.offsetParent).map(b=>b.textContent.trim().slice(0,25)+'@'+Math.round(b.getBoundingClientRect().x)+','+Math.round(b.getBoundingClientRect().y)).join(' | ')`));
  }
};
