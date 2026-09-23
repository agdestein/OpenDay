const SP = import.meta.dirname + '/build';
const sizes = { L: [3840, 2160], P: [3508, 4961] };
export default async (h) => {
  const designs = (process.argv[3] || 'mosaic,farm,flood,street').split(',');
  for (const d of designs) for (const s of ['L', 'P']) for (const t of ['1', '0']) {
    if (t === '0' && d !== 'mosaic') continue; // heroes without text = the raw shot
    await h.setup(...sizes[s], 1);
    await h.nav(`file://${SP}/compose.html?d=${d}&s=${s}&t=${t}`);
    for (let i = 0; i < 50 && (await h.eval_('document.title')) !== 'ready'; i++) await h.sleep(200);
    await h.shot(`../out/${d}_${s === 'L' ? 'dia-16x9' : 'A3-staand'}${t === '0' ? '_zonder-tekst' : ''}`);
  }
};
