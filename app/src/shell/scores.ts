/** Arcade-style high scores, per game, per day, in localStorage (best effort). */

export interface ScoreEntry {
  initials: string;
  score: number;
}

const MAX_STORED = 100;

const key = (gameId: string) =>
  `arcade-scores:${gameId}:${new Date().toISOString().slice(0, 10)}`;

export function topScores(gameId: string, n = 5): ScoreEntry[] {
  return allScores(gameId).slice(0, n);
}

/**
 * Returns the updated (sorted) list, so callers can show the player's rank.
 * With bestOnly, these initials keep a single entry — their best score — so a
 * repeat player (the computer, say) can't crowd everyone else off the board.
 */
export function addScore(
  gameId: string,
  initials: string,
  score: number,
  bestOnly = false,
): ScoreEntry[] {
  let list = [...allScores(gameId), { initials, score }].sort((a, b) => b.score - a.score);
  if (bestOnly) {
    // Sorted best first, so the first entry with these initials survives.
    let kept = false;
    list = list.filter((e) => {
      if (e.initials !== initials) return true;
      if (kept) return false;
      kept = true;
      return true;
    });
  }
  list = list.slice(0, MAX_STORED);
  try {
    localStorage.setItem(key(gameId), JSON.stringify(list));
  } catch {
    // Storage blocked or full: scores are a nicety, never an error.
  }
  return list;
}

function allScores(gameId: string): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(key(gameId));
    return raw ? (JSON.parse(raw) as ScoreEntry[]) : [];
  } catch {
    return [];
  }
}
