// The challenge is three rounds, each its own module behind this interface;
// index.ts runs them in order, keeps the running total and shows the cards
// between them.
import type { Box } from './physics';

export interface ButtonDef {
  emoji: string;
  label: string;
  onClick?: () => void;
  /** A held button: called with true on press and false on release. */
  hold?: (on: boolean) => void;
}

/** What a round may ask of the game around it. */
export interface RoundHost {
  readonly box: Box;
  readonly unit: number;
  hint(text: string): void;
  popup(x: number, y: number, text: string, color: string): void;
  /** Replaces the round's toolbar buttons (a Stop button always follows). */
  buttons(defs: ButtonDef[]): HTMLButtonElement[];
  /** The round is over: its score and one sentence on what it showed. */
  finish(score: number, summary: string): void;
}

export interface Round {
  /** Emoji and name, for the HUD and the cards. */
  readonly title: string;
  /** Round score so far. */
  readonly score: number;
  /** The round's own HUD parts (time, tools left…). */
  hud(): string;
  step(dt: number): void;
  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void;
  down(x: number, y: number): void;
  move(x: number, y: number): void;
  up(): void;
  dispose(): void;
}

export function toolButton(emoji: string, label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'tool-button';
  const icon = document.createElement('span');
  icon.className = 'tool-emoji';
  icon.textContent = emoji;
  const text = document.createElement('span');
  text.className = 'tool-label';
  text.textContent = label;
  button.append(icon, text);
  return button;
}

export function setLabel(button: HTMLButtonElement, text: string): void {
  const label = button.querySelector('.tool-label')!;
  if (label.textContent !== text) label.textContent = text;
}

/** Held buttons: a press starts it, releasing (or losing the pointer) ends it. */
export function makeHold(button: HTMLButtonElement, set: (on: boolean) => void): void {
  button.addEventListener('pointerdown', (e) => {
    try {
      button.setPointerCapture(e.pointerId);
    } catch {
      // No live pointer to capture: pointerup still ends the hold.
    }
    button.classList.add('active');
    set(true);
  });
  const off = () => {
    if (!button.classList.contains('active')) return;
    button.classList.remove('active');
    set(false);
  };
  button.addEventListener('pointerup', off);
  button.addEventListener('pointercancel', off);
  button.addEventListener('lostpointercapture', off);
}
