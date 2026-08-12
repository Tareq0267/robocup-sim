// ================================================================
// TEAM POLICY — who presses aggressively vs who holds assist cover
// Mirrors assist_strategy_policy.h/.cpp in the real robot repo:
//   aggressiveStrikerCountFor(strikerCount, fraction=0.75) is the
//   round-half-up fraction of the outfield players that act as
//   aggressive pressing strikers (leader always included, at least 1);
//   the remainder stay back on defensive ASSIST cover.
// ================================================================

import type { Ball, Robot } from './types'
import { dist } from './math'

// Round-half-up on the striker count × fraction, clamped to [1, strikerCount].
// strikerCount === 0 → 0. Mirrors the C++ aggressiveStrikerCountFor().
export function aggressiveStrikerCountFor(strikerCount: number, fraction = 0.75): number {
  if (strikerCount <= 0) return 0
  const safeFraction = Number.isFinite(fraction)
    ? Math.min(1, Math.max(0, fraction))
    : 0.75
  const count = Math.round(strikerCount * safeFraction)
  return Math.min(strikerCount, Math.max(1, count))
}

// Striker indices ranked by distance to the ball (rank 0 = closest = lead).
export function rankedStrikerIndices(robots: Robot[], ball: Ball, gkIdx: number): number[] {
  return robots
    .map((r, i) => ({ i, d: i === gkIdx ? Infinity : dist(r.pos, ball.pos) }))
    .filter(x => x.i !== gkIdx)
    .sort((a, b) => a.d - b.d)
    .map(x => x.i)
}

// Set of striker indices in the aggressive pressing group for the given ball.
export function aggressiveStrikerSet(
  robots: Robot[],
  ball:   Ball,
  gkIdx:  number,
  fraction: number,
): Set<number> {
  const ranked = rankedStrikerIndices(robots, ball, gkIdx)
  return new Set(ranked.slice(0, aggressiveStrikerCountFor(ranked.length, fraction)))
}
