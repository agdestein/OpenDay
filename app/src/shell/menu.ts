import type { ArcadeGame, Screen } from './types';
import { toggleFullscreen } from '../lib/fullscreen';
import { randRange } from '../lib/util';
import { LANGS, getLang, setLang, pick, type Localized } from '../lib/i18n';

/** Drifting glow-dots behind the menu, so the stand looks alive from a distance. */
const PARTICLE_COUNT = 70;

const TEXT: Localized<{ subtitle: string; footer: string; fullscreen: string }> = {
  en: {
    subtitle: 'Pick a world to simulate!',
    footer: 'Scientific Computing group · CWI Science Day',
    fullscreen: 'Fullscreen (F)',
  },
  nl: {
    subtitle: 'Kies een wereld om te simuleren!',
    footer: 'Scientific Computing-groep · CWI Open Dag',
    fullscreen: 'Volledig scherm (F)',
  },
  no: {
    subtitle: 'Velg en verden å simulere!',
    footer: 'Scientific Computing-gruppen · CWI åpen dag',
    fullscreen: 'Fullskjerm (F)',
  },
};

const FLAGS: Localized<string> = { en: '🇬🇧', nl: '🇳🇱', no: '🇳🇴' };

export function renderMenu(
  games: ArcadeGame[],
  onPick: (game: ArcadeGame) => void,
  onLangChange: () => void,
): Screen {
  const T = pick(TEXT);
  const element = document.createElement('div');
  element.className = 'screen menu-screen';

  const bg = document.createElement('canvas');
  bg.className = 'menu-bg';
  element.appendChild(bg);

  const content = document.createElement('div');
  content.className = 'menu-content';
  element.appendChild(content);

  const title = document.createElement('h1');
  title.textContent = 'CWI Science Arcade';
  const subtitle = document.createElement('p');
  subtitle.className = 'menu-subtitle';
  subtitle.textContent = T.subtitle;
  content.append(title, subtitle);

  const grid = document.createElement('div');
  grid.className = 'tile-grid';
  for (const game of games) {
    const tile = document.createElement('button');
    tile.className = 'tile';
    tile.addEventListener('click', () => onPick(game));
    const emoji = document.createElement('span');
    emoji.className = 'tile-emoji';
    emoji.textContent = game.tileEmoji;
    const name = document.createElement('span');
    name.className = 'tile-title';
    name.textContent = pick(game.title);
    const science = document.createElement('span');
    science.className = 'tile-science';
    science.textContent = pick(game.scienceLine);
    tile.append(emoji, name, science);
    grid.appendChild(tile);
  }
  content.appendChild(grid);

  const footer = document.createElement('p');
  footer.className = 'menu-footer';
  footer.textContent = T.footer;
  element.appendChild(footer);

  const fullscreen = document.createElement('button');
  fullscreen.className = 'corner-button fullscreen-button';
  fullscreen.title = T.fullscreen;
  fullscreen.textContent = '⛶';
  fullscreen.addEventListener('click', toggleFullscreen);
  element.appendChild(fullscreen);

  const langs = document.createElement('div');
  langs.className = 'lang-switcher';
  for (const lang of LANGS) {
    const button = document.createElement('button');
    button.className = 'lang-button';
    button.classList.toggle('active', lang === getLang());
    button.textContent = FLAGS[lang];
    button.addEventListener('click', () => {
      if (lang === getLang()) return;
      setLang(lang);
      onLangChange();
    });
    langs.appendChild(button);
  }
  element.appendChild(langs);

  // Attract animation.
  const ctx = bg.getContext('2d')!;
  const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
    x: Math.random(),
    y: Math.random(),
    vx: randRange(-0.01, 0.01),
    vy: randRange(-0.01, 0.01),
    r: randRange(1.5, 4),
    hue: randRange(180, 320),
  }));
  let raf = 0;
  let last = performance.now();
  const loop = (t: number) => {
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    const dprNow = window.devicePixelRatio || 1;
    const w = element.clientWidth;
    const h = element.clientHeight;
    if (bg.width !== Math.round(w * dprNow)) bg.width = Math.max(1, Math.round(w * dprNow));
    if (bg.height !== Math.round(h * dprNow)) bg.height = Math.max(1, Math.round(h * dprNow));
    ctx.setTransform(dprNow, 0, 0, dprNow, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const p of particles) {
      p.x = (p.x + p.vx * dt + 1) % 1;
      p.y = (p.y + p.vy * dt + 1) % 1;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 80%, 70%, 0.5)`;
      ctx.fill();
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return {
    element,
    dispose: () => cancelAnimationFrame(raf),
  };
}
