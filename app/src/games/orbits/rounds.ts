// The challenge is a list of rounds, each its own module behind this
// interface; index.ts runs them in order, keeps the running total and shows
// the cards between them (the same shape as Ball Pit's rounds).

export interface ButtonDef {
  emoji: string;
  label: string;
  onClick: () => void;
}

export interface Area {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** What a round may ask of the game around it. */
export interface RoundHost {
  /** The free screen area between the HUD and the toolbar. */
  area(): Area;
  unit(): number;
  hint(text: string): void;
  popup(x: number, y: number, text: string, color: string): void;
  /** Replaces the round's toolbar buttons (a Stop button always follows). */
  buttons(defs: ButtonDef[]): HTMLButtonElement[];
  /** The round is over: its score and one sentence on what it showed. */
  finish(score: number, summary: string): void;
  /** The computer is playing this round (the "computer's turn"), not a person. */
  auto(): boolean;
  /** How much faster than real time the round is being stepped (the computer's turn: 2). */
  speed(): number;
}

export interface Round {
  readonly title: string;
  /** Round score so far (0 until it is known). */
  readonly score: number;
  /** The round's own HUD parts (time, chance…). */
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
