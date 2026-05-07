// ================================================================
// SIMULATION ENGINE — one tick per frame
// ================================================================

import { RobotState, type Robot, type Ball, type Goal, type Court, type SimState, type DebugData, type StateTransition } from './types'
import { getNextState, getInactiveState, computeAlignmentError, computeOrientationError, computeFovError, isOnCorrectSide, isAligned, isAtContactRange, isOrientationAligned, canSeeBall } from './stateMachine'
import { searchBehavior, idleBehavior, chaseBehavior, repositionBehavior, radialAdjustBehavior, readyBehavior, shootBehavior, getTargetOrientation } from './behaviors'
import { stepBall, applyContact, resolveOverlap, resolveRobotCollision } from './physics'
import { add, scale, dist, rotateToward } from './math'

const MAX_HISTORY = 50

// ----------------------------------------------------------------
// Single-robot update — called once per robot per frame
// ----------------------------------------------------------------
function tickRobot(
  robot:      Robot,
  ball:       Ball,
  goal:       Goal,
  court:      Court,
  isActive:   boolean,
  dt:         number,
  time:       number,
  prevHistory: StateTransition[],
): { robot: Robot; debug: DebugData } {

  const history = [...prevHistory]

  // ── 1. Determine next state ────────────────────────────────
  const { state: nextState, reason } = isActive
    ? getNextState(robot, ball, goal)
    : getInactiveState(robot, ball)

  if (nextState !== robot.state) {
    history.unshift({ time, from: robot.state, to: nextState, reason })
    if (history.length > MAX_HISTORY) history.pop()
  }

  const updatedRobot = { ...robot, state: nextState }

  // ── 2. Compute velocity ────────────────────────────────────
  let velocity = { x: 0, y: 0 }
  switch (nextState) {
    case RobotState.SEARCHING:    velocity = searchBehavior();                          break
    case RobotState.IDLE:         velocity = idleBehavior();                            break
    case RobotState.CHASING:      velocity = chaseBehavior(updatedRobot, ball);         break
    case RobotState.REPOSITIONING:velocity = repositionBehavior(updatedRobot, ball, goal); break
    case RobotState.RADIAL_ADJUST:velocity = radialAdjustBehavior(updatedRobot, ball);  break
    case RobotState.READY:        velocity = readyBehavior();                           break
    case RobotState.SHOOTING:     velocity = shootBehavior(updatedRobot);               break
  }

  // ── 3. Update position ─────────────────────────────────────
  const hw = court.width  / 2 - robot.radius
  const hh = court.height / 2 - robot.radius
  const rawPos = add(updatedRobot.pos, scale(velocity, dt))
  const clampedPos = {
    x: Math.max(-hw, Math.min(hw, rawPos.x)),
    y: Math.max(-hh, Math.min(hh, rawPos.y)),
  }

  // ── 4. Update orientation ──────────────────────────────────
  // SEARCHING: spin continuously
  // IDLE / active states: rotate toward ball
  const targetOri = nextState === RobotState.SEARCHING
    ? null
    : getTargetOrientation(updatedRobot, ball, goal)

  const newOri = targetOri === null
    ? updatedRobot.orientation + robot.params.rotationSpeed * dt
    : rotateToward(updatedRobot.orientation, targetOri, robot.params.rotationSpeed, dt)

  const finalRobot = { ...updatedRobot, pos: clampedPos, orientation: newOri }

  // ── 5. Debug data ──────────────────────────────────────────
  const debug: DebugData = {
    distanceToBall:       dist(finalRobot.pos, ball.pos),
    alignmentError:       computeAlignmentError(finalRobot, ball, goal),
    orientationError:     computeOrientationError(finalRobot, ball),
    fovError:             computeFovError(finalRobot, ball),
    canSeeBall:           canSeeBall(finalRobot, ball),
    isAligned:            isAligned(finalRobot, ball, goal),
    isOnCorrectSide:      isOnCorrectSide(finalRobot, ball, goal),
    isAtShootDistance:    isAtContactRange(finalRobot, ball),
    isOrientationAligned: isOrientationAligned(finalRobot, ball),
    tangentialDir: nextState === RobotState.REPOSITIONING
      ? scale(velocity, 1 / (finalRobot.params.tangentialSpeed || 1)) : null,
    radialDir: nextState === RobotState.RADIAL_ADJUST
      ? scale(velocity, 1 / (finalRobot.params.radialSpeedFar || 1)) : null,
    targetOrientation: targetOri,
    stateHistory:      history,
  }

  return { robot: finalRobot, debug }
}

// ----------------------------------------------------------------
// Main tick — updates both robots + ball + team coordination
// ----------------------------------------------------------------
export function tick(state: SimState, dt: number): SimState {
  const { robots, ball, goal, court, team, time } = state

  // ── Team coordination: role swap with hysteresis ───────────
  // Check which robot is closer. If it's NOT the active one,
  // count up the swap timer. Reset if they flip back.
  const d0 = dist(robots[0].pos, ball.pos)
  const d1 = dist(robots[1].pos, ball.pos)
  const closerIndex = d0 <= d1 ? 0 : 1

  let newSwapTimer   = state.swapTimer
  let newActiveIndex = state.activeIndex

  if (closerIndex !== state.activeIndex) {
    newSwapTimer += dt
    if (newSwapTimer >= team.roleSwapDelay) {
      newActiveIndex = closerIndex
      newSwapTimer   = 0
    }
  } else {
    newSwapTimer = 0   // distances reverted — reset, no swap
  }

  // ── Update each robot ──────────────────────────────────────
  const r0 = tickRobot(robots[0], ball, goal, court, newActiveIndex === 0, dt, time, state.debugs[0].stateHistory)
  const r1 = tickRobot(robots[1], ball, goal, court, newActiveIndex === 1, dt, time, state.debugs[1].stateHistory)

  // ── Robot-robot collision ──────────────────────────────────
  const [robot0, robot1] = resolveRobotCollision(r0.robot, r1.robot, court)

  // ── Ball physics (only active robot pushes) ────────────────
  const activeRobot = newActiveIndex === 0 ? robot0 : robot1
  const activeVel   = newActiveIndex === 0
    ? (robot0.state === RobotState.SHOOTING ? shootBehavior(robot0) : { x: 0, y: 0 })
    : (robot1.state === RobotState.SHOOTING ? shootBehavior(robot1) : { x: 0, y: 0 })

  let newBall = ball
  if (activeRobot.state === RobotState.SHOOTING) {
    newBall = applyContact(newBall, activeRobot, activeVel)
  }
  newBall = resolveOverlap(newBall, robot0)
  newBall = resolveOverlap(newBall, robot1)
  newBall = stepBall(newBall, court, dt)

  return {
    ...state,
    robots:      [robot0, robot1],
    debugs:      [r0.debug, r1.debug],
    activeIndex: newActiveIndex,
    swapTimer:   newSwapTimer,
    ball:        newBall,
    time:        time + dt,
  }
}
