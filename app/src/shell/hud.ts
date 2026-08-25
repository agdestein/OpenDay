import type { ArcadeGame } from './types';
import { pick, type Localized } from '../lib/i18n';

const TEXT: Localized<{ clickToPlay: string; backToMenu: string }> = {
  en: { clickToPlay: 'Click to play!', backToMenu: 'Back to menu (Esc)' },
  nl: { clickToPlay: 'Klik om te spelen!', backToMenu: 'Terug naar het menu (Esc)' },
  no: { clickToPlay: 'Klikk for å spille!', backToMenu: 'Tilbake til menyen (Esc)' },
};

/** Full-screen overlay shown when a game opens; one tap dismisses it and starts play. */
export function titleCard(game: ArcadeGame, onStart: () => void): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'title-card';

  const emoji = document.createElement('div');
  emoji.className = 'title-card-emoji';
  emoji.textContent = game.tileEmoji;
  const heading = document.createElement('h2');
  heading.textContent = pick(game.title);
  const science = document.createElement('p');
  science.className = 'science-line';
  science.textContent = pick(game.scienceLine);
  const hint = document.createElement('p');
  hint.className = 'start-hint';
  hint.textContent = pick(TEXT).clickToPlay;

  overlay.append(emoji, heading, science, hint);
  overlay.addEventListener(
    'pointerdown',
    () => {
      overlay.remove();
      onStart();
    },
    { once: true },
  );
  return overlay;
}

/** Small home button in the top-left corner of a game screen. */
export function backButton(onExit: () => void): HTMLElement {
  const button = document.createElement('button');
  button.className = 'corner-button back-button';
  button.title = pick(TEXT).backToMenu;
  button.textContent = '⌂';
  button.addEventListener('pointerdown', (e) => e.stopPropagation());
  button.addEventListener('click', onExit);
  return button;
}
