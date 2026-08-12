// ================================================================
// PER-STATE MOVEMENT BEHAVIORS
// Each function returns the velocity Vec2 for the robot this frame.
// The engine applies velocity to position after calling these.
// ================================================================

import { RobotState } from './types'
import type { Robot, Ball, Goal, Vec2 } from './types'
import { sub, normalize, scale, dist, angOf, perpCCW, perpCW, fromAng, cross2d } from './math'

// SEARCHING — spin in place (body rotation handled by engine; no translation)
export function searchBehavior(): Vec2 {
  return { x: 0, y: 0 }
}

// FREEKICK MOVE — move to a target point, slow down near it
export function moveToPointBehavior(robot: Robot, target: Vec2, speed: number): Vec2 {
  const d = dist(robot.pos, target)
  if (d < 0.05) return { x: 0, y: 0 }
  return scale(normalize(sub(target, robot.pos)), Math.min(speed, d * 3))
}

// IDLE — inactive robot: hold position, face ball (rotation handled by engine)
export function idleBehavior(): Vec2 {
  return { x: 0, y: 0 }
}

// ASSIST — inactive robot: move to support position 2m behind the ball on the
// own-goal→ball line. Mirrors real Assist BT node (vx_limit=0.2, vy_limit=0.2,
// dist_to_goalline=2.5). courtHalfLength = court.width / 2 (our field is 14m wide,
// so half = 7m along the x axis).
export function assistBehavior(robot: Robot, ball: Ball, courtHalfLength: number): Vec2 {
  const { assistSpeed, assistBackDist, assistDistToGoalLine } = robot.params

  const ownGoalX = -courtHalfLength
  let tx         = ball.pos.x - assistBackDist
  tx             = Math.max(tx, ownGoalX + assistDistToGoalLine)

  // Target y: project along the own-goal-centre → ball line to get lateral coord
  const denom = ball.pos.x + courtHalfLength  // distance of ball from own goal line
  const ty    = Math.abs(denom) > 0.05
    ? ball.pos.y * (tx + courtHalfLength) / denom
    : 0

  const target   = { x: tx, y: ty }
  const toTarget = sub(target, robot.pos)
  const d        = dist(robot.pos, target)

  if (d < 0.15) return { x: 0, y: 0 }  // close enough — stop

  return scale(normalize(toTarget), Math.min(assistSpeed, d))
}

// CHASING — run straight toward the ball
// Aggressive swarm strikers pass their pressChaseSpeed (strategy.press
// chase_vx_limit); defensive robots never reach this state.
export function chaseBehavior(robot: Robot, ball: Ball, speed?: number): Vec2 {
  const dir = normalize(sub(ball.pos, robot.pos))
  return scale(dir, speed ?? robot.params.chaseSpeed)
}

// REPOSITIONING — orbit the ball tangentially until robot is directly behind it
// The robot moves along the circle of its current distance from the ball.
// Direction of orbit is chosen to take the shorter arc toward the target angle.
export function repositionBehavior(robot: Robot, ball: Ball, goal: Goal): Vec2 {
  const ballToRobot = normalize(sub(robot.pos, ball.pos))  // radial outward
  const goalToBall  = normalize(sub(ball.pos, goal.center)) // target direction (behind ball)

  // cross2d > 0 → robot needs to rotate CCW around ball to reach target
  // cross2d < 0 → robot needs to rotate CW
  const c = cross2d(ballToRobot, goalToBall)
  const tangent = c >= 0 ? perpCCW(ballToRobot) : perpCW(ballToRobot)

  return scale(tangent, robot.params.tangentialSpeed)
}

// RADIAL_ADJUST — move toward ball along the radial line (aligned approach)
// Uses two speeds: slower when close (precision), faster when far (efficiency)
export function radialAdjustBehavior(robot: Robot, ball: Ball): Vec2 {
  const d = dist(robot.pos, ball.pos)
  const speed = d > robot.params.radialSpeedDistance
    ? robot.params.radialSpeedFar
    : robot.params.radialSpeedNear

  const dir = normalize(sub(ball.pos, robot.pos))
  return scale(dir, speed)
}

// READY — hold still (no movement this state)
export function readyBehavior(): Vec2 {
  return { x: 0, y: 0 }
}

// SHOOTING — push forward in the direction the robot is facing
export function shootBehavior(robot: Robot): Vec2 {
  return scale(fromAng(robot.orientation), robot.params.shootingSpeed)
}

// ----------------------------------------------------------------
// TARGET ORIENTATION — what direction should robot face in each state?
// Used by the engine to smoothly rotate the robot each frame.
// ----------------------------------------------------------------
export function getTargetOrientation(
  robot: Robot,
  ball:  Ball,
  _goal: Goal,
): number {
  // SEARCHING: continuous spin — engine handles this separately, return dummy value
  if (robot.state === RobotState.SEARCHING) return robot.orientation

  // All other states: face the ball
  return angOf(sub(ball.pos, robot.pos))
}
