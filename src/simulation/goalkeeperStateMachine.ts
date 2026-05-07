// ================================================================
// GOALKEEPER STATE MACHINE
// Priority order (0 = highest):
//   0. FIND_BALL    — ball not visible, spin until found
//   1. RETREAT      — ball outside penalty area, return to goal line
//   2. ADJUST_BLOCK — ball in penalty area, position to block
//   3. CHASE        — ball in penalty area and far, close distance
//   4. KICK         — ball close and aligned, clear it
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
// Mirrors the BT GoalieDecide node — pure function, no side effects
export function goalieDecide(
  gk:          GoalkeeperRobot,
  ball:        Ball,
  penaltyArea: FieldZone,
): { state: GoalkeeperState; reason: string } {
  const { chaseThreshold, retreatChaseThreshold, alignThreshold } = gk.params

  // Priority 0: can't see ball → spin
  if (!gkCanSeeBall(gk, ball)) {
    return { state: GoalkeeperState.FIND_BALL, reason: 'Ball outside FOV — searching' }
  }

  const ballInPenalty = ballInZone(ball, penaltyArea)
  const d             = dist(gk.pos, ball.pos)

  // Priority 1: ball outside penalty area → retreat to goal line
  if (!ballInPenalty) {
    return { state: GoalkeeperState.RETREAT, reason: 'Ball outside penalty area — retreating to goal line' }
  }

  // Ball IS in penalty area from here on

  // Priority 2: ball deep in penalty area but GK is far → retreat first to close goal gap
  if (d > retreatChaseThreshold) {
    return { state: GoalkeeperState.RETREAT, reason: `Ball ${d.toFixed(2)}m away (> retreat threshold ${retreatChaseThreshold}m) — retreating` }
  }

  // Priority 3: ball at mid-range → adjust blocking position
  if (d > chaseThreshold) {
    return { state: GoalkeeperState.ADJUST_BLOCK, reason: `Ball at ${d.toFixed(2)}m — adjusting block position` }
  }

  // Priority 4: ball very close → check alignment for kick
  const alignErr = gkAlignmentError(gk, ball)
  if (alignErr <= alignThreshold) {
    return { state: GoalkeeperState.KICK, reason: `Aligned (${(alignErr * 180 / Math.PI).toFixed(1)}°) — kicking` }
  }

  // Close but not aligned → chase to close further and get aligned
  return { state: GoalkeeperState.CHASE, reason: `Ball close (${d.toFixed(2)}m) but not aligned — chasing` }
}
