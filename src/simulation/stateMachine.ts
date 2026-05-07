// ================================================================
// ROBOT STATE MACHINE
// ================================================================
//
// This file owns ALL state transition logic.
// To change when a state activates, edit the conditions below.
//
// TRANSITION PRIORITY (checked top-to-bottom each frame):
//
//   1. CHASING       dist(robot, ball) > chaseDistance
//                    → robot is too far away, run straight to ball
//
//   2. REPOSITIONING robot is on wrong side of ball
//                    OR positional alignment error > shootAngle
//                    → orbit ball tangentially until behind it
//
//   3. RADIAL_ADJUST robot is aligned but not yet at contact range
//                    → close the gap using radial speed (far or near)
//
//   4. READY         robot is at contact range + position aligned
//                    but body is still rotating to face the ball
//                    → hold position, spin in place, wait
//
//   5. SHOOTING      position aligned + body orientation aligned
//                    → push ball forward
//
// ================================================================

import { RobotState, type Robot, type Ball, type Goal } from './types'
import { sub, dist, angOf, dot, normalize, wrapAngle } from './math'

// ----------------------------------------------------------------
// INACTIVE ROBOT STATE
// Called when this robot is not the active (ball-chasing) robot.
// It can only IDLE (hold position, face ball) or SEARCH (spin).
// ----------------------------------------------------------------
export function getInactiveState(robot: Robot, ball: Ball): { state: RobotState; reason: string } {
  if (!canSeeBall(robot, ball)) {
    const errDeg = (computeFovError(robot, ball) * 180 / Math.PI).toFixed(1)
    const limDeg = (robot.params.fieldOfView / 2 * 180 / Math.PI).toFixed(1)
    return { state: RobotState.SEARCHING, reason: `Inactive + ball out of FOV (${errDeg}° > ±${limDeg}°)` }
  }
  return { state: RobotState.IDLE, reason: 'Inactive — holding position' }
}

// Can the robot see the ball? (ball must be within the FOV cone)
// FOV is centred on robot.orientation; half-angle = fieldOfView / 2
export function canSeeBall(robot: Robot, ball: Ball): boolean {
  const angleTowardBall = angOf(sub(ball.pos, robot.pos))
  const angDiff = Math.abs(wrapAngle(angleTowardBall - robot.orientation))
  return angDiff <= robot.params.fieldOfView / 2
}

export function computeFovError(robot: Robot, ball: Ball): number {
  const angleTowardBall = angOf(sub(ball.pos, robot.pos))
  return Math.abs(wrapAngle(angleTowardBall - robot.orientation))
}

// Is the robot's body orientation aligned with the ball?
// Robot must be facing the ball within shootAngle tolerance before shooting.
export function isOrientationAligned(robot: Robot, ball: Ball): boolean {
  const targetOrientation = angOf(sub(ball.pos, robot.pos))
  return Math.abs(wrapAngle(targetOrientation - robot.orientation)) <= robot.params.shootAngle
}

export function computeOrientationError(robot: Robot, ball: Ball): number {
  const targetOrientation = angOf(sub(ball.pos, robot.pos))
  return Math.abs(wrapAngle(targetOrientation - robot.orientation))
}

// ----------------------------------------------------------------
// CONDITION FUNCTIONS — each answers one yes/no question
// ----------------------------------------------------------------

// Is the robot far enough from the ball to be in chase mode?
export function shouldChase(robot: Robot, ball: Ball): boolean {
  return dist(robot.pos, ball.pos) > robot.params.chaseDistance
}

// Is the robot on the correct side of the ball?
// Correct = robot is on the OPPOSITE side of the ball from the goal
// (so when it pushes, the ball goes toward the goal)
export function isOnCorrectSide(robot: Robot, ball: Ball, goal: Goal): boolean {
  const ballToGoal   = normalize(sub(goal.center, ball.pos))
  const ballToRobot  = sub(robot.pos, ball.pos)
  // dot < 0 means robot and goal are on opposite sides of ball → correct
  return dot(ballToGoal, ballToRobot) < 0
}

// Is the robot aligned behind the ball? (within shootAngle tolerance)
// Alignment = the direction robot→ball matches the direction ball→goal
export function isAligned(robot: Robot, ball: Ball, goal: Goal): boolean {
  return computeAlignmentError(robot, ball, goal) <= robot.params.shootAngle
}

// How many radians off is the robot from perfect alignment?
// 0 rad = perfectly behind the ball on the goal line
export function computeAlignmentError(robot: Robot, ball: Ball, goal: Goal): number {
  const angleBallToGoal  = angOf(sub(goal.center, ball.pos))
  const angleRobotToBall = angOf(sub(ball.pos, robot.pos))
  return Math.abs(wrapAngle(angleBallToGoal - angleRobotToBall))
}

// Is the robot close enough to make contact and shoot?
// Contact range = sum of radii + small buffer
export function isAtContactRange(robot: Robot, ball: Ball): boolean {
  const contactRange = robot.radius + ball.radius + 0.1   // 10 cm buffer
  return dist(robot.pos, ball.pos) <= contactRange
}

// ----------------------------------------------------------------
// MAIN TRANSITION FUNCTION
// Call every frame to get the next state.
// Returns both the state and a human-readable reason for the debug log.
// ----------------------------------------------------------------
export function getNextState(
  robot: Robot,
  ball:  Ball,
  goal:  Goal,
): { state: RobotState; reason: string } {
  const d         = dist(robot.pos, ball.pos)
  const aligned   = isAligned(robot, ball, goal)
  const rightSide = isOnCorrectSide(robot, ball, goal)
  const atContact = isAtContactRange(robot, ball)
  const errDeg    = (computeAlignmentError(robot, ball, goal) * 180 / Math.PI).toFixed(1)
  const limDeg    = (robot.params.shootAngle * 180 / Math.PI).toFixed(1)
  const fovErrDeg = (computeFovError(robot, ball) * 180 / Math.PI).toFixed(1)
  const fovLimDeg = (robot.params.fieldOfView / 2 * 180 / Math.PI).toFixed(1)

  // ── Priority 0: Can't see ball → search ─────────────────────
  if (!canSeeBall(robot, ball)) {
    return {
      state:  RobotState.SEARCHING,
      reason: `Ball at ${fovErrDeg}° off-centre, FOV limit is ±${fovLimDeg}°`,
    }
  }

  // ── Priority 1 ──────────────────────────────────────────────
  if (shouldChase(robot, ball)) {
    return {
      state:  RobotState.CHASING,
      reason: `Ball ${d.toFixed(2)}m away, chase range is ${robot.params.chaseDistance}m`,
    }
  }

  // ── Priority 2 ──────────────────────────────────────────────
  if (!rightSide) {
    return {
      state:  RobotState.REPOSITIONING,
      reason: `Robot is in front of ball (wrong side)`,
    }
  }
  if (!aligned) {
    return {
      state:  RobotState.REPOSITIONING,
      reason: `Alignment error ${errDeg}° exceeds limit ${limDeg}°`,
    }
  }

  // ── Priority 3 ──────────────────────────────────────────────
  if (!atContact) {
    return {
      state:  RobotState.RADIAL_ADJUST,
      reason: `Aligned, closing gap — ${d.toFixed(2)}m from ball`,
    }
  }

  // ── Priority 4: In position but body still rotating ─────────
  const oriAligned = isOrientationAligned(robot, ball)
  const oriErrDeg  = (computeOrientationError(robot, ball) * 180 / Math.PI).toFixed(1)

  if (!oriAligned) {
    return {
      state:  RobotState.READY,
      reason: `In position — spinning to face ball (${oriErrDeg}° off)`,
    }
  }

  // ── Priority 5: Position + orientation both aligned → SHOOT ──
  if (robot.state === RobotState.SHOOTING) {
    return {
      state:  RobotState.SHOOTING,
      reason: `Shooting!`,
    }
  }

  return {
    state:  RobotState.SHOOTING,
    reason: `Body aligned — shooting!`,
  }
}
