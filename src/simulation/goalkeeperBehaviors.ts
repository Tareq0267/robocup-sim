// ================================================================
// GOALKEEPER BEHAVIORS — one function per state, returns velocity
// ================================================================

import type { GoalkeeperRobot, Ball, Goal, Vec2 } from './types'
import { sub, normalize, scale, dist, angOf } from './math'

// FIND_BALL: spin in place (no translation)
export function gkFindBallBehavior(): Vec2 {
  return { x: 0, y: 0 }
}

// RETREAT: move to goal line offset position, clamp y to goal half-width
export function gkRetreatBehavior(gk: GoalkeeperRobot, ownGoal: Goal): Vec2 {
  const targetX = ownGoal.center.x + gk.params.goalLineOffset  // step in front of line
  const halfGoal = ownGoal.width / 2
  const targetY = Math.max(-halfGoal, Math.min(halfGoal, gk.pos.y))
  const target: Vec2 = { x: targetX, y: targetY }
  const diff = sub(target, gk.pos)
  const d    = dist(target, gk.pos)
  if (d < 0.05) return { x: 0, y: 0 }
  return scale(normalize(diff), gk.params.retreatSpeed)
}

// ADJUST_BLOCK: move along the goal→ball line to maintain blockRange distance
// Long-range: constrain inside penalty area
// Short-range (ball < blockNearThreshold): free tangential adjustment
export function gkAdjustBlockBehavior(gk: GoalkeeperRobot, ball: Ball, ownGoal: Goal): Vec2 {
  const { blockRange, blockSpeedFar, blockSpeedNear, blockNearThreshold } = gk.params
  const d = dist(gk.pos, ball.pos)

  // Target: stand on the goal→ball line at blockRange from ball
  const goalToBall = sub(ball.pos, ownGoal.center)
  const dir        = dist({ x: 0, y: 0 }, goalToBall) < 1e-9
    ? { x: 1, y: 0 }
    : normalize(goalToBall)
  const target: Vec2 = {
    x: ball.pos.x - dir.x * blockRange,
    y: ball.pos.y - dir.y * blockRange,
  }

  const toTarget = sub(target, gk.pos)
  const gap      = dist(target, gk.pos)
  if (gap < 0.05) return { x: 0, y: 0 }

  const speed = d < blockNearThreshold ? blockSpeedNear : blockSpeedFar
  return scale(normalize(toTarget), speed)
}

// CHASE: run straight toward the ball
export function gkChaseBehavior(gk: GoalkeeperRobot, ball: Ball): Vec2 {
  const diff = sub(ball.pos, gk.pos)
  const d    = dist(ball.pos, gk.pos)
  if (d < 0.1) return { x: 0, y: 0 }
  return scale(normalize(diff), gk.params.chaseSpeed)
}

// KICK: push forward in the direction the GK is facing
export function gkKickBehavior(gk: GoalkeeperRobot): Vec2 {
  return {
    x: Math.cos(gk.orientation) * gk.params.kickSpeed,
    y: Math.sin(gk.orientation) * gk.params.kickSpeed,
  }
}

// Target orientation: always face the ball (used for all states except FIND_BALL)
export function gkTargetOrientation(gk: GoalkeeperRobot, ball: Ball): number {
  return angOf(sub(ball.pos, gk.pos))
}
