// The challenge is three rounds, each its own module behind this interface;
// index.ts runs them in order, keeps the running total and shows the cards
// between them (the same shape as Ball Pit's and Gravity Doodle's rounds).

export interface ButtonDef {
  emoji: string;
  label: string;
  onClick?: () => void;
}

/** What a round may ask of the game around it. */
export interface RoundHost {
  hint(text: string): void;
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
  /** The round's own HUD part. */
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
