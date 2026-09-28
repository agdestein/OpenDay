// Print the stand's paper: node tools/promo/cdp.mjs ../print/print.mjs
// (from the repository root). Writes promo/print/*.pdf (git-ignored, like the
// other promo output): the staff's stand sheet (A4 landscape, English + Dutch),
// the kids' stamp cards (4 × A6 on A4) and the "play at home" QR poster (A4,
// scales to A3).
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const here = import.meta.dirname;
const out = `${here}/../../promo/print`;
const pages = ['stand-sheet', 'stamp-card', 'qr-poster'];

export default async (h) => {
  mkdirSync(out, { recursive: true });
  await h.send('Page.enable');
  for (const name of pages) {
    await h.send('Page.navigate', { url: pathToFileURL(`${here}/${name}.html`).href });
    await h.sleep(1200);
    await h.eval_('document.fonts.ready.then(() => true)');
    const { data } = await h.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true });
    writeFileSync(`${out}/${name}.pdf`, Buffer.from(data, 'base64'));
    console.log(`wrote promo/print/${name}.pdf`);
  }
};
