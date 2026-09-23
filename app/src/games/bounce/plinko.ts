// Round 1, Plinko: a Galton board. One ball bouncing down the pegs is pure
// luck; three hundred of them pile up into the same bell curve every time.
// The player drags a few bumpers onto the board to push that curve into the
// gold bucket. Layout and scoring only — DOM-free, tested in node.
import type { Ball, Box, Circle, Segment } from './physics';

export const PLINKO = {
  balls: 300,
  /** Balls per second from the spout. */
  rate: 25,
  buckets: 13,
  bumpers: 5,
  goldPoints: 10,
  silverPoints: 3,
  /** Seconds to place bumpers before the balls drop by themselves. */
  placeTime: 25,
  /** Twins fall alone this long before the pour starts. */
  twinTime: 2.6,
  /** Horizontal distance between the twins at the spout (px). */
  twinGap: 0.001,
};

export interface PlinkoLayout {
  pegs: Circle[];
  segments: Segment[];
  /** Bucket edges, left to right (buckets + 1 values). */
  edges: number[];
  /** Top of the bucket dividers. */
  bucketTop: number;
  /** Balls below this line count for the bucket they are over. */
  countLine: number;
  spout: { x: number; y: number };
  ballR: number;
  bumperR: number;
  /** Parking spots for the bumpers, beside the board. */
  bumperStarts: { x: number; y: number }[];
  /** Region bumpers may be dragged in. */
  dragArea: Box;
  gold: number;
  silver: number[];
  /** Peg spacing. */
  spacing: number;
}

/**
 * `goldOffset` is how many buckets the gold one sits from the middle
 * (negative = left); the natural bell curve mostly misses it.
 */
export function plinkoLayout(box: Box, unit: number, goldOffset: number): PlinkoLayout {
  const bw = box.x1 - box.x0;
  const bh = box.y1 - box.y0;
  const n = PLINKO.buckets;
  const S = Math.min(bw / (n + 4), bh * 0.085);
  const cx = (box.x0 + box.x1) / 2;
  const bx0 = cx - (n / 2) * S;
  const bx1 = cx + (n / 2) * S;
  const bucketTop = box.y1 - bh * 0.3;
  const pegTop = box.y0 + bh * 0.17;
  const rowGap = S * 0.87;
  const pegR = S * 0.1;

  const pegs: Circle[] = [];
  let row = 0;
  for (let y = pegTop; y < bucketTop - S * 0.55; y += rowGap, row++) {
    const shift = row % 2 === 0 ? 0 : S / 2;
    for (let x = cx - Math.floor(n / 2) * S - shift; x <= bx1 - S * 0.3; x += S) {
      if (x < bx0 + S * 0.3) continue;
      pegs.push({ x, y, r: pegR });
    }
  }
  const lastRow = pegs[pegs.length - 1].y;

  const segments: Segment[] = [];
  const edges: number[] = [];
  for (let i = 0; i <= n; i++) {
    const x = bx0 + i * S;
    edges.push(x);
    // Outer edges run up the whole board; inner dividers make the buckets.
    const top = i === 0 || i === n ? box.y0 + bh * 0.08 : bucketTop;
    segments.push({ x1: x, y1: top, x2: x, y2: box.y1 });
  }

  const mid = Math.floor(n / 2);
  const gold = Math.max(0, Math.min(n - 1, mid + goldOffset));
  const silver = [gold - 1, gold + 1].filter((i) => i >= 0 && i < n);

  const bumperR = S * 0.42;
  // Park the bumpers in the empty space beside the board, both sides.
  const bumperStarts: { x: number; y: number }[] = [];
  const leftX = (box.x0 + bx0) / 2;
  const rightX = (bx1 + box.x1) / 2;
  for (let k = 0; k < PLINKO.bumpers; k++) {
    const left = k % 2 === 0;
    const slot = Math.floor(k / 2);
    bumperStarts.push({ x: left ? leftX : rightX, y: pegTop + slot * bumperR * 3 });
  }

  return {
    pegs,
    segments,
    edges,
    bucketTop,
    countLine: (lastRow + bucketTop) / 2,
    spout: { x: cx, y: box.y0 + bh * 0.08 },
    ballR: Math.max(3, Math.min(S * 0.14, 6 * unit)),
    bumperR,
    bumperStarts,
    dragArea: { x0: box.x0 + bumperR, y0: pegTop - S * 0.3, x1: box.x1 - bumperR, y1: bucketTop - bumperR },
    gold,
    silver,
    spacing: S,
  };
}

/** Index of the bucket under x, or -1 beside the board. */
export function bucketOf(layout: PlinkoLayout, x: number): number {
  const { edges } = layout;
  if (x < edges[0] || x >= edges[edges.length - 1]) return -1;
  return Math.min(edges.length - 2, Math.floor((x - edges[0]) / layout.spacing));
}

export interface PlinkoTally {
  counts: number[];
  score: number;
}

/** Counts balls by bucket (twins included — they are balls too) and scores them. */
export function plinkoTally(layout: PlinkoLayout, balls: Ball[]): PlinkoTally {
  const counts = new Array<number>(layout.edges.length - 1).fill(0);
  for (const b of balls) {
    if (b.y < layout.countLine) continue;
    const i = bucketOf(layout, b.x);
    if (i >= 0) counts[i]++;
  }
  let score = counts[layout.gold] * PLINKO.goldPoints;
  for (const s of layout.silver) score += counts[s] * PLINKO.silverPoints;
  return { counts, score };
}
