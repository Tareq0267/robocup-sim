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

// IDLE — inactive robot: hold position, face ball (rotation handled by engine)
export function idleBehavior(): Vec2 {
  return { x: 0, y: 0 }
}

// CHASING — run straight toward the ball
export function chaseBehavior(robot: Robot, ball: Ball): Vec2 {
  const dir = normalize(sub(ball.pos, robot.pos))
  return scale(dir, robot.params.chaseSpeed)
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
