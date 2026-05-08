// ================================================================
// GOALKEEPER BEHAVIORS — one function per state, returns velocity
// ================================================================

import type { GoalkeeperRobot, Ball, Goal, FieldZone, Vec2 } from './types'
import { sub, normalize, scale, dist, angOf } from './math'

// FIND_BALL: spin in place (no translation)
export function gkFindBallBehavior(): Vec2 {
  return { x: 0, y: 0 }
}

// RETREAT: move to goal-line blocking position, tracking the ball's lateral position.
// Mirrors GoToGoalBlockingPosition::tick() in brain_tree.cpp:
//   targetX = goalLine + distToGoalline  (fixed depth)
//   targetY = ball.y * distToGoalline / (ball.x - goalLineX)  (proportional lateral tracking)
//   targetY clamped to ±penaltyAreaWidth/2
export function gkRetreatBehavior(gk: GoalkeeperRobot, ball: Ball, ownGoal: Goal, penaltyArea: FieldZone): Vec2 {
  const goalLineX      = ownGoal.center.x           // = -7.0
  const distToGoalLine = gk.params.goalLineOffset    // = 0.5 m
  const targetX        = goalLineX + distToGoalLine  // = -6.5

  const ballDistFromLine = ball.pos.x - goalLineX    // ball.pos.x + 7.0 (always > 0 in normal play)
  const penaltyHalfW     = (penaltyArea.maxY - penaltyArea.minY) / 2  // = 3.0

  let targetY: number
  if (ballDistFromLine <= distToGoalLine) {
    // Ball is at or behind the goal line — lean slightly toward ball's side
    targetY = ball.pos.y > 0 ? ownGoal.width / 4 : -ownGoal.width / 4
  } else {
    // Project goal-centre→ball line to our fixed X depth
    targetY = (ball.pos.y * distToGoalLine) / ballDistFromLine
    targetY = Math.max(-penaltyHalfW, Math.min(penaltyHalfW, targetY))
  }

  const target = { x: targetX, y: targetY }
  const diff   = sub(target, gk.pos)
  const d      = dist(target, gk.pos)
  if (d < 0.05) return { x: 0, y: 0 }
  return scale(normalize(diff), gk.params.retreatSpeed)
}

// ADJUST_BLOCK: position on the goal→ball line at blockRange from ball.
// Long-range mode (ball outside penalty, GK in goal area): constrain movement
// to stay within goal area boundaries — mirrors AdjustBlock long-range mode
// in brain_tree.cpp lines 1397-1433.
export function gkAdjustBlockBehavior(
  gk: GoalkeeperRobot, ball: Ball, ownGoal: Goal,
  ballInPenalty: boolean, goalArea: FieldZone,
): Vec2 {
  const { blockRange, blockSpeedFar, blockSpeedNear, blockNearThreshold } = gk.params
  const d = dist(gk.pos, ball.pos)

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
  let vel = scale(normalize(toTarget), speed)

  // Long-range mode: constrain so GK stays inside the goal area
  if (!ballInPenalty) {
    const margin = 0.1
    const nx = gk.pos.x + vel.x * 0.1
    const ny = gk.pos.y + vel.y * 0.1
    if (nx < goalArea.minX)            vel = { ...vel, x: Math.max(vel.x, 0) }
    if (nx > goalArea.maxX - margin)   vel = { ...vel, x: Math.min(vel.x, 0) }
    if (ny < goalArea.minY + margin)   vel = { ...vel, y: Math.max(vel.y, 0) }
    if (ny > goalArea.maxY - margin)   vel = { ...vel, y: Math.min(vel.y, 0) }
  }

  return vel
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
