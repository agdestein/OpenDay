import type { ArcadeGame } from './types';
import { pick, type Localized } from '../lib/i18n';
import { sound } from '../lib/sound';

const TEXT: Localized<{ clickToPlay: string; backToMenu: string; soundOn: string; soundOff: string }> = {
  en: { clickToPlay: 'Click to play!', backToMenu: 'Back to menu (Esc)', soundOn: 'Sound on', soundOff: 'Sound off' },
  nl: { clickToPlay: 'Klik om te spelen!', backToMenu: 'Terug naar het menu (Esc)', soundOn: 'Geluid aan', soundOff: 'Geluid uit' },
  no: { clickToPlay: 'Klikk for å spille!', backToMenu: 'Tilbake til menyen (Esc)', soundOn: 'Lyd på', soundOff: 'Lyd av' },
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

/** Mute toggle for the whole arcade; `extraClass` places it. */
export function soundButton(extraClass: string): HTMLElement {
  const button = document.createElement('button');
  button.className = `corner-button sound-button ${extraClass}`;
  const show = (muted: boolean) => {
    button.textContent = muted ? '🔇' : '🔊';
    button.title = muted ? pick(TEXT).soundOff : pick(TEXT).soundOn;
    button.setAttribute('aria-pressed', String(!muted));
  };
  show(sound.muted);
  // Screens are thrown away whole: a detached button drops its listener.
  const stop = sound.onChange((muted) => (button.isConnected ? show(muted) : stop()));
  button.addEventListener('pointerdown', (e) => e.stopPropagation());
  button.addEventListener('click', () => { sound.setMuted(!sound.muted); sound.play('click'); });
  return button;
}
