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

/**
 * Every per-day record in the arcade: the boards here and Creature Lab's
 * crowns (games/creature/race.ts). A game that adds its own daily record
 * adds its key prefix here, so the staff reset clears it too.
 */
const DAILY_RECORD_PREFIXES = ['arcade-scores:', 'creature-crowns:'];

/** Staff reset: forget all boards and crowns (e.g. the morning's test runs). */
export function clearAllScores(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && DAILY_RECORD_PREFIXES.some((p) => k.startsWith(p))) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Storage blocked: there were no scores to clear.
  }
}
