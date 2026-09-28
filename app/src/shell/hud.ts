import type { ArcadeGame } from './types';
import { pick, type Localized } from '../lib/i18n';
import { sound } from '../lib/sound';

const TEXT: Localized<{ clickToPlay: string; backToMenu: string; sure: string; soundOn: string; soundOff: string }> = {
  en: { clickToPlay: 'Click to play!', backToMenu: 'Back to menu (Esc)', sure: '⌂ Menu?', soundOn: 'Sound on', soundOff: 'Sound off' },
  nl: { clickToPlay: 'Klik om te spelen!', backToMenu: 'Terug naar het menu (Esc)', sure: '⌂ Naar het menu?', soundOn: 'Geluid aan', soundOff: 'Geluid uit' },
  no: { clickToPlay: 'Klikk for å spille!', backToMenu: 'Tilbake til menyen (Esc)', sure: '⌂ Til menyen?', soundOn: 'Lyd på', soundOff: 'Lyd av' },
};

/** How long the home button waits for its second tap. */
const CONFIRM_MS = 3000;

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

/**
 * Small home button in the top-left corner of a game screen. In a game it asks
 * first ("⌂ Menu?", a second tap within 3 s leaves), so a stray tap doesn't
 * throw away a challenge; on the title card one tap is enough. Esc always
 * leaves at once.
 */
export function backButton(onExit: () => void): HTMLElement {
  const button = document.createElement('button');
  button.className = 'corner-button back-button';
  button.title = pick(TEXT).backToMenu;
  button.textContent = '⌂';
  let timer = 0;
  const calm = () => {
    clearTimeout(timer);
    button.classList.remove('confirm');
    button.textContent = '⌂';
  };
  button.addEventListener('pointerdown', (e) => e.stopPropagation());
  button.addEventListener('click', () => {
    const onTitleCard = !!button.parentElement?.querySelector('.title-card');
    if (onTitleCard || button.classList.contains('confirm')) {
      calm();
      onExit();
      return;
    }
    button.classList.add('confirm');
    button.textContent = pick(TEXT).sure;
    timer = window.setTimeout(calm, CONFIRM_MS);
  });
  return button;
}

/**
 * Mute toggle for the whole arcade; `extraClass` places it. Call `dispose`
 * with its screen: the mute subscription would otherwise keep the whole
 * detached screen (and its full-screen canvas) alive.
 */
export function soundButton(extraClass: string): { element: HTMLElement; dispose: () => void } {
  const button = document.createElement('button');
  button.className = `corner-button sound-button ${extraClass}`;
  const show = (muted: boolean) => {
    button.textContent = muted ? '🔇' : '🔊';
    button.title = muted ? pick(TEXT).soundOff : pick(TEXT).soundOn;
    button.setAttribute('aria-pressed', String(!muted));
  };
  show(sound.muted);
  const dispose = sound.onChange(show);
  button.addEventListener('pointerdown', (e) => e.stopPropagation());
  button.addEventListener('click', () => { sound.setMuted(!sound.muted); sound.play('click'); });
  return { element: button, dispose };
}

/** A short message floating at the top of the screen for a few seconds. */
export function toast(text: string): void {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}
