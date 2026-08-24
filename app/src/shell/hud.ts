import type { ArcadeGame } from './types';

/** Full-screen overlay shown when a game opens; one tap dismisses it and starts play. */
export function titleCard(game: ArcadeGame, onStart: () => void): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'title-card';

  const emoji = document.createElement('div');
  emoji.className = 'title-card-emoji';
  emoji.textContent = game.tileEmoji;
  const heading = document.createElement('h2');
  heading.textContent = game.title;
  const science = document.createElement('p');
  science.className = 'science-line';
  science.textContent = game.scienceLine;
  const hint = document.createElement('p');
  hint.className = 'start-hint';
  hint.textContent = 'Click to play!';

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
  button.title = 'Back to menu (Esc)';
  button.textContent = '⌂';
  button.addEventListener('pointerdown', (e) => e.stopPropagation());
  button.addEventListener('click', onExit);
  return button;
}
