// Shared "delve" layer: an in-game explainer panel that walks older kids and
// parents through the science behind a game, in short chapters. The panel owns
// the text and navigation; the game keeps rendering live illustrations on its
// own canvas next to it (and is told which chapter is showing).

export interface DelveChapter {
  title: string;
  paragraphs: string[];
  /** Optional formula, rendered in monospace between paragraphs and extras. */
  formula?: string;
  /** Optional interactive controls appended under the text. */
  extras?: (host: HTMLElement) => void;
}

export interface DelveHandle {
  element: HTMLElement;
  /** Index of the chapter currently shown. */
  readonly chapter: number;
  dispose(): void;
}

export function delvePanel(opts: {
  heading: string;
  chapters: DelveChapter[];
  /** Called for the initial chapter and on every chapter change. */
  onChapter: (index: number) => void;
  onExit: () => void;
}): DelveHandle {
  let index = 0;

  // 'delve-card', not 'delve-panel': Outbreak's game-local delve owns that name.
  const element = document.createElement('div');
  element.className = 'delve-card';

  const heading = document.createElement('p');
  heading.className = 'delve-heading';
  heading.textContent = opts.heading;

  const title = document.createElement('h2');
  const body = document.createElement('div');
  body.className = 'delve-body';

  const nav = document.createElement('div');
  nav.className = 'delve-nav';
  const prev = document.createElement('button');
  prev.className = 'arcade-button';
  prev.textContent = '◀';
  const dots = document.createElement('div');
  dots.className = 'delve-dots';
  const dotEls = opts.chapters.map((_, i) => {
    const dot = document.createElement('button');
    dot.addEventListener('click', () => show(i));
    dots.appendChild(dot);
    return dot;
  });
  const next = document.createElement('button');
  next.className = 'arcade-button';
  next.textContent = '▶';
  nav.append(prev, dots, next);

  const exit = document.createElement('button');
  exit.className = 'arcade-button delve-exit';
  exit.textContent = '✕ Back to the game';
  exit.addEventListener('click', () => opts.onExit());

  prev.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));

  const show = (i: number) => {
    index = Math.min(opts.chapters.length - 1, Math.max(0, i));
    const chapter = opts.chapters[index];
    title.textContent = chapter.title;
    body.replaceChildren();
    for (const text of chapter.paragraphs) {
      const p = document.createElement('p');
      p.textContent = text;
      body.appendChild(p);
    }
    if (chapter.formula) {
      const formula = document.createElement('p');
      formula.className = 'delve-formula';
      formula.textContent = chapter.formula;
      body.appendChild(formula);
    }
    if (chapter.extras) {
      const host = document.createElement('div');
      host.className = 'delve-extras';
      // Attach before building so extras can insert siblings (e.g. a caption).
      body.appendChild(host);
      chapter.extras(host);
    }
    prev.disabled = index === 0;
    next.disabled = index === opts.chapters.length - 1;
    dotEls.forEach((dot, k) => dot.classList.toggle('active', k === index));
    opts.onChapter(index);
  };

  element.append(heading, title, body, nav, exit);
  show(0);

  return {
    element,
    get chapter() {
      return index;
    },
    dispose: () => element.remove(),
  };
}
