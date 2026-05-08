// ================================================================
// GOALKEEPER STATE MACHINE
// Mirrors GoalieDecide::tick() in brain_tree.cpp
// Priority order (0 = highest):
//   0. FIND_BALL    — ball not visible, spin until found
//   1. RETREAT      — return to goal-line blocking position (tracks ball Y)
//                     triggered when ball outside penalty OR robot outside goal area
//   2. ADJUST_BLOCK — position on goal→ball line; constrained to goal area when
//                     ball is outside penalty (long-range mode)
//   3. CHASE        — close in on ball (medium range: chaseThreshold–retreatChaseThreshold)
//   4. KICK         — ball close and GK aligned, clear it
// ================================================================

import { GoalkeeperState, type GoalkeeperRobot, type Ball, type FieldZone } from './types'
import { sub, angOf, dist } from './math'

function wrapAngle(a: number): number {
  while (a >  Math.PI) a -= 2 * Math.PI
  while (a < -Math.PI) a += 2 * Math.PI
  return a
}

export function gkCanSeeBall(gk: GoalkeeperRobot, ball: Ball): boolean {
  const angleTowardBall = angOf(sub(ball.pos, gk.pos))
  const angDiff = Math.abs(wrapAngle(angleTowardBall - gk.orientation))
  return angDiff <= gk.params.fieldOfView / 2
}

export function gkFovError(gk: GoalkeeperRobot, ball: Ball): number {
  const angleTowardBall = angOf(sub(ball.pos, gk.pos))
  return wrapAngle(angleTowardBall - gk.orientation)
}

export function gkAlignmentError(gk: GoalkeeperRobot, ball: Ball): number {
  const angleTowardBall = angOf(sub(ball.pos, gk.pos))
  return Math.abs(wrapAngle(angleTowardBall - gk.orientation))
}

export function ballInZone(ball: Ball, zone: FieldZone): boolean {
  return ball.pos.x >= zone.minX && ball.pos.x <= zone.maxX &&
         ball.pos.y >= zone.minY && ball.pos.y <= zone.maxY
}

// ── GoalieDecide ──────────────────────────────────────────────
// Mirrors GoalieDecide::tick() in brain_tree.cpp — pure function, no side effects
export function goalieDecide(
  gk:          GoalkeeperRobot,
  ball:        Ball,
  penaltyArea: FieldZone,
  goalArea:    FieldZone,
): { state: GoalkeeperState; reason: string } {
  const { chaseThreshold, retreatChaseThreshold, alignThreshold } = gk.params

  if (!gkCanSeeBall(gk, ball)) {
    return { state: GoalkeeperState.FIND_BALL, reason: 'Ball outside FOV — searching' }
  }

  const ballInPenalty = ballInZone(ball, penaltyArea)
  const robotInGoal   = gk.pos.x >= goalArea.minX && gk.pos.x <= goalArea.maxX &&
                        gk.pos.y >= goalArea.minY && gk.pos.y <= goalArea.maxY
  const d = dist(gk.pos, ball.pos)

  // Ball outside penalty area
  if (!ballInPenalty) {
    if (robotInGoal) {
      // Already in goal area — stay and track ball in long-range blocking mode
      return { state: GoalkeeperState.ADJUST_BLOCK, reason: 'Ball outside penalty — long-range block from goal area' }
    }
    // Outside goal area — retreat back to goal-line position
    return { state: GoalkeeperState.RETREAT, reason: 'Ball outside penalty, not in goal area — retreating' }
  }

  // Ball IS in penalty area from here on

  // Ball far in penalty area
  if (d > retreatChaseThreshold) {
    if (!robotInGoal) {
      return { state: GoalkeeperState.RETREAT, reason: `Ball ${d.toFixed(2)}m away, not in goal area — retreating to close gap` }
    }
    // Already in goal area — stay and block rather than chasing into a gap
    return { state: GoalkeeperState.ADJUST_BLOCK, reason: `Ball ${d.toFixed(2)}m away, in goal area — holding block position` }
  }

  // Medium range (chaseThreshold < d <= retreatChaseThreshold): chase to close in
  if (d > chaseThreshold) {
    return { state: GoalkeeperState.CHASE, reason: `Ball at ${d.toFixed(2)}m (medium range) — chasing` }
  }

  // Close range (d <= chaseThreshold): adjust into kick position or kick
  const alignErr = gkAlignmentError(gk, ball)
  if (alignErr <= alignThreshold) {
    return { state: GoalkeeperState.KICK, reason: `Aligned (${(alignErr * 180 / Math.PI).toFixed(1)}°) — kicking` }
  }
  return { state: GoalkeeperState.ADJUST_BLOCK, reason: `Ball close (${d.toFixed(2)}m), adjusting to align for kick` }
}
