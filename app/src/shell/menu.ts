import type { ArcadeGame, Screen } from './types';
import { delveToggle } from './delve';
import { soundButton } from './hud';
import { renderAbout } from './about';
import { fullscreenSupported, toggleFullscreen } from '../lib/fullscreen';
import { cappedDpr, randRange } from '../lib/util';
import { LANGS, fmtNumber, getLang, setLang, pick, type Localized } from '../lib/i18n';
import { topScores } from './scores';
import qrPlayUrl from './qr-play.svg';

/** Drifting glow-dots behind the menu, so the stand looks alive from a distance. */
const PARTICLE_COUNT = 70;

// The title matches the programme booklet ("De simulatie-arcade – kun jij de
// wereld nabootsen?"), so visitors find what they circled.
const TEXT: Localized<{
  title: string;
  subtitle: string;
  message: string;
  footer: string;
  fullscreen: string;
  points: string;
  noRecord: string;
  playAtHome: string;
}> = {
  en: {
    title: 'The Simulation Arcade',
    subtitle: 'Can you recreate the world? Pick one to simulate!',
    message: 'With maths and computers you can simulate anything. That is our job.',
    footer: 'Scientific Computing group · CWI Science Day',
    fullscreen: 'Fullscreen (F)',
    points: 'points',
    noRecord: 'No record yet',
    playAtHome: 'Play again at home',
  },
  nl: {
    title: 'De Simulatie-arcade',
    subtitle: 'Kun jij de wereld nabootsen? Kies er een om te simuleren!',
    message: 'Met wiskunde en computers kun je alles simuleren. Dat is ons vak.',
    footer: 'Scientific Computing-groep · Wetenschapsdag CWI',
    fullscreen: 'Volledig scherm (F)',
    points: 'punten',
    noRecord: 'Nog geen record',
    playAtHome: 'Speel thuis verder',
  },
  no: {
    title: 'Simuleringsarkaden',
    subtitle: 'Klarer du å gjenskape verden? Velg en å simulere!',
    message: 'Med matematikk og datamaskiner kan man simulere alt. Det er jobben vår.',
    footer: 'Scientific Computing-gruppen · CWIs vitenskapsdag',
    fullscreen: 'Fullskjerm (F)',
    points: 'poeng',
    noRecord: 'Ingen rekord ennå',
    playAtHome: 'Spill videre hjemme',
  },
};

/** Today's best on this machine, e.g. "👑 EMA · 4 250 kJ", or "🤖 4 250 kJ" for the computer. */
function recordLine(game: ArcadeGame): string {
  const T = pick(TEXT);
  const best = topScores(game.id, 1)[0];
  if (!best) return `👑 ${T.noRecord}`;
  const unit = game.scoreUnit ? pick(game.scoreUnit) : T.points;
  const who = best.initials === 'CPU' ? '🤖' : `👑 ${best.initials} ·`;
  return `${who} ${fmtNumber(Math.round(best.score))} ${unit}`;
}

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
  title.textContent = T.title;
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
    const hook = document.createElement('span');
    hook.className = 'tile-hook';
    hook.textContent = pick(game.tileHook);
    const record = document.createElement('span');
    record.className = 'tile-record';
    record.textContent = recordLine(game);
    tile.append(emoji, name, hook, record);
    grid.appendChild(tile);
  }
  content.appendChild(grid);

  const footer = document.createElement('div');
  footer.className = 'menu-footer';
  const message = document.createElement('p');
  message.className = 'menu-message';
  message.textContent = T.message;
  const group = document.createElement('p');
  group.textContent = T.footer;
  footer.append(message, group);
  element.appendChild(footer);

  // The parents' take-home: the same arcade on the web (GitHub Pages). Made with
  //   qrencode -t SVG --svg-path -l M -m 2 -s 1 -o qr-play.svg 'https://agdestein.github.io/OpenDay/?lang=nl'
  // then the fixed width/height swapped for shape-rendering="crispEdges".
  const qr = document.createElement('div');
  qr.className = 'menu-qr';
  const qrImage = document.createElement('img');
  qrImage.src = qrPlayUrl;
  qrImage.alt = '';
  qrImage.draggable = false;
  const qrLabel = document.createElement('span');
  qrLabel.textContent = `📱 ${T.playAtHome}`;
  qr.append(qrImage, qrLabel);
  element.appendChild(qr);

  const mute = soundButton(fullscreenSupported ? 'menu-sound' : 'menu-sound alone');
  element.appendChild(mute.element);

  if (fullscreenSupported) {
    const fullscreen = document.createElement('button');
    fullscreen.className = 'corner-button fullscreen-button';
    fullscreen.title = T.fullscreen;
    fullscreen.textContent = '⛶';
    fullscreen.addEventListener('click', toggleFullscreen);
    element.appendChild(fullscreen);
  }

  // "How does this work?" layer: same pill as the in-game delve toggles, but
  // here it opens the big-picture cards (math -> simulation, CWI, our group).
  let about: HTMLElement | null = null;
  const aboutToggle = delveToggle(() => {
    if (about) {
      about.remove();
      about = null;
    } else {
      about = renderAbout();
      element.appendChild(about);
    }
    aboutToggle.setOpen(about !== null);
  });
  element.appendChild(aboutToggle.element);

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
    const dprNow = cappedDpr();
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
    dispose: () => {
      cancelAnimationFrame(raf);
      mute.dispose();
      // A detached screen can linger until garbage collection; drop its pixels now.
      bg.width = bg.height = 0;
    },
  };
}
