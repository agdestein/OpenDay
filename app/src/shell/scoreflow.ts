// Arcade end-of-round flow, reusable by any game: big score -> three-initials
// entry (mouse letter grid + physical keyboard) -> today's top-5 board with the
// player's row highlighted -> caller-provided action buttons.
import { addScore, type ScoreEntry } from './scores';
import { fmtNumber, pick, type Localized } from '../lib/i18n';

const TEXT: Localized<{ todaysBest: string; initialsPrompt: string }> = {
  en: {
    todaysBest: "Today's best",
    initialsPrompt: 'Your name on the scoreboard — pick three letters!',
  },
  nl: {
    todaysBest: 'De beste van vandaag',
    initialsPrompt: 'Jouw naam op het scorebord — kies drie letters!',
  },
  no: {
    todaysBest: 'Dagens beste',
    initialsPrompt: 'Navnet ditt på poengtavla — velg tre bokstaver!',
  },
};

export interface ScoreFlowAction {
  label: string;
  onClick: () => void;
}

export interface ScoreFlowHandle {
  element: HTMLElement;
  /** Removes the panel and its window listeners; safe to call twice. */
  dispose: () => void;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function scoreFlow(opts: {
  gameId: string;
  heading: string;
  score: number;
  /** Formatted score with units, e.g. "12 345 kJ". */
  scoreLabel: string;
  /** When set (e.g. "CPU"), skips the initials entry and posts directly. */
  presetInitials?: string;
  actions: ScoreFlowAction[];
}): ScoreFlowHandle {
  const element = document.createElement('div');
  element.className = 'score-flow';

  const heading = document.createElement('h2');
  heading.textContent = opts.heading;
  const scoreEl = document.createElement('div');
  scoreEl.className = 'score-flow-score';
  scoreEl.textContent = opts.scoreLabel;
  const body = document.createElement('div');
  element.append(heading, scoreEl, body);

  let removeKeys = () => {};
  const dispose = () => {
    removeKeys();
    element.remove();
  };

  const showBoard = (initials: string) => {
    removeKeys();
    const list = addScore(opts.gameId, initials, opts.score);
    const rank = list.findIndex((e) => e.initials === initials && e.score === opts.score);

    const title = document.createElement('p');
    title.className = 'score-board-title';
    title.textContent = pick(TEXT).todaysBest;
    const board = document.createElement('ol');
    board.className = 'score-board';
    const row = (entry: ScoreEntry, index: number) => {
      const li = document.createElement('li');
      if (index === rank) li.className = 'me';
      const place = document.createElement('span');
      place.textContent = MEDALS[index] ?? `${index + 1}.`;
      const name = document.createElement('span');
      name.textContent = entry.initials;
      const points = document.createElement('span');
      points.textContent = fmtNumber(Math.round(entry.score));
      li.append(place, name, points);
      return li;
    };
    list.slice(0, 5).forEach((entry, i) => board.appendChild(row(entry, i)));
    if (rank >= 5) board.appendChild(row(list[rank], rank));

    const actions = document.createElement('div');
    actions.className = 'score-flow-actions';
    for (const action of opts.actions) {
      const button = document.createElement('button');
      button.className = 'arcade-button';
      button.textContent = action.label;
      button.addEventListener('click', action.onClick);
      actions.appendChild(button);
    }
    body.replaceChildren(title, board, actions);
  };

  if (opts.presetInitials) {
    showBoard(opts.presetInitials);
    return { element, dispose };
  }

  // --- initials entry ---
  let letters = '';
  const prompt = document.createElement('p');
  prompt.className = 'score-flow-prompt';
  prompt.textContent = pick(TEXT).initialsPrompt;
  const slots = document.createElement('div');
  slots.className = 'initial-slots';
  const slotEls = [0, 1, 2].map(() => {
    const s = document.createElement('span');
    slots.appendChild(s);
    return s;
  });
  const grid = document.createElement('div');
  grid.className = 'letter-grid';

  let okButton: HTMLButtonElement;
  const refresh = () => {
    slotEls.forEach((s, i) => (s.textContent = letters[i] ?? '·'));
    okButton.disabled = letters.length < 3;
  };
  const push = (ch: string) => {
    if (letters.length < 3) letters += ch;
    refresh();
  };
  const pop = () => {
    letters = letters.slice(0, -1);
    refresh();
  };
  const submit = () => {
    if (letters.length === 3) showBoard(letters);
  };

  for (let i = 0; i < 26; i++) {
    const ch = String.fromCharCode(65 + i);
    const button = document.createElement('button');
    button.textContent = ch;
    button.addEventListener('click', () => push(ch));
    grid.appendChild(button);
  }
  const back = document.createElement('button');
  back.textContent = '⌫';
  back.addEventListener('click', pop);
  okButton = document.createElement('button');
  okButton.className = 'ok';
  okButton.textContent = 'OK';
  okButton.addEventListener('click', submit);
  grid.append(back, okButton);
  body.append(prompt, slots, grid);
  refresh();

  // Physical keyboard too (the stand has one). Capture phase + stopPropagation
  // so consumed keys don't reach the shell's shortcuts (e.g. F = fullscreen).
  const onKey = (e: KeyboardEvent) => {
    if (/^[a-zA-Z]$/.test(e.key)) push(e.key.toUpperCase());
    else if (e.key === 'Backspace') pop();
    else if (e.key === 'Enter') submit();
    else return;
    e.stopPropagation();
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey, true);
  removeKeys = () => window.removeEventListener('keydown', onKey, true);

  return { element, dispose };
}
