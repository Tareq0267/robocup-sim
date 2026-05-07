// ================================================================
// SIMULATION ENGINE — one tick per frame
// ================================================================

import { RobotState, GoalkeeperState, type Robot, type Ball, type Goal, type Court, type SimState, type DebugData, type StateTransition, type GoalkeeperRobot, type GoalkeeperDebugData } from './types'
import { getNextState, getInactiveState, computeAlignmentError, computeOrientationError, computeFovError, isOnCorrectSide, isAligned, isAtContactRange, isOrientationAligned, canSeeBall } from './stateMachine'
import { searchBehavior, idleBehavior, chaseBehavior, repositionBehavior, radialAdjustBehavior, readyBehavior, shootBehavior, getTargetOrientation } from './behaviors'
import { goalieDecide, gkCanSeeBall, gkFovError, gkAlignmentError, ballInZone } from './goalkeeperStateMachine'
import { gkFindBallBehavior, gkRetreatBehavior, gkAdjustBlockBehavior, gkChaseBehavior, gkKickBehavior, gkTargetOrientation } from './goalkeeperBehaviors'
import { stepBall, applyContact, resolveOverlap, resolveRobotCollision, separateCircles } from './physics'
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
// Goalkeeper tick — independent from striker logic
// ----------------------------------------------------------------
function tickGoalkeeper(
  gk:          GoalkeeperRobot,
  ball:        Ball,
  ownGoal:     Goal,
  court:       Court,
  state:       SimState,
  dt:          number,
  time:        number,
  prevHistory: StateTransition[],
): { gk: GoalkeeperRobot; debug: GoalkeeperDebugData } {
  const history = [...prevHistory]

  // ── 1. Decide next state ───────────────────────────────────
  const { state: nextState, reason } = goalieDecide(gk, ball, state.fieldLayout.ownPenaltyArea)

  if (nextState !== gk.state) {
    history.unshift({ time, from: gk.state as string, to: nextState as string, reason } as StateTransition)
    if (history.length > 50) history.pop()
  }

  const updatedGk = { ...gk, state: nextState }

  // ── 2. Compute velocity ────────────────────────────────────
  let velocity: { x: number; y: number } = { x: 0, y: 0 }
  switch (nextState) {
    case GoalkeeperState.FIND_BALL:    velocity = gkFindBallBehavior();                          break
    case GoalkeeperState.RETREAT:      velocity = gkRetreatBehavior(updatedGk, ownGoal);         break
    case GoalkeeperState.ADJUST_BLOCK: velocity = gkAdjustBlockBehavior(updatedGk, ball, ownGoal); break
    case GoalkeeperState.CHASE:        velocity = gkChaseBehavior(updatedGk, ball);              break
    case GoalkeeperState.KICK:         velocity = gkKickBehavior(updatedGk);                     break
  }

  // ── 3. Update position (clamp to court) ───────────────────
  const hw = court.width  / 2 - gk.radius
  const hh = court.height / 2 - gk.radius
  const rawPos = add(updatedGk.pos, scale(velocity, dt))
  const clampedPos = {
    x: Math.max(-hw, Math.min(hw, rawPos.x)),
    y: Math.max(-hh, Math.min(hh, rawPos.y)),
  }

  // ── 4. Update orientation ──────────────────────────────────
  // FIND_BALL: spin continuously; all others: face ball
  const targetOri = nextState === GoalkeeperState.FIND_BALL
    ? null
    : gkTargetOrientation(updatedGk, ball)

  const newOri = targetOri === null
    ? updatedGk.orientation + gk.params.rotationSpeed * dt
    : rotateToward(updatedGk.orientation, targetOri, gk.params.rotationSpeed, dt)

  const finalGk = { ...updatedGk, pos: clampedPos, orientation: newOri }

  // ── 5. Debug ───────────────────────────────────────────────
  const debug: GoalkeeperDebugData = {
    distanceToBall:    dist(finalGk.pos, ball.pos),
    canSeeBall:        gkCanSeeBall(finalGk, ball),
    fovError:          gkFovError(finalGk, ball),
    ballInPenaltyArea: ballInZone(ball, state.fieldLayout.ownPenaltyArea),
    alignmentError:    gkAlignmentError(finalGk, ball),
    stateHistory:      history,
  }

  return { gk: finalGk, debug }
}

// ----------------------------------------------------------------
// Main tick — updates both robots + ball + team coordination
// ----------------------------------------------------------------
export function tick(state: SimState, dt: number): SimState {
  const { robots, ball, goal, court, team, time, goalkeeper, ownGoal } = state

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
  const gkResult = tickGoalkeeper(goalkeeper, ball, ownGoal, court, state, dt, time, state.goalkeeperDebug.stateHistory)

  // ── Collisions: strikers vs strikers, each striker vs GK ──
  let [robot0, robot1] = resolveRobotCollision(r0.robot, r1.robot, court)
  let gkPos = gkResult.gk.pos
  let pos0: typeof gkPos, pos1: typeof gkPos
  ;[pos0, gkPos] = separateCircles(robot0.pos, robot0.radius, gkPos, gkResult.gk.radius, court)
  robot0 = { ...robot0, pos: pos0 }
  ;[pos1, gkPos] = separateCircles(robot1.pos, robot1.radius, gkPos, gkResult.gk.radius, court)
  robot1 = { ...robot1, pos: pos1 }
  const newGk = { ...gkResult.gk, pos: gkPos }

  // ── Ball physics (active striker and GK can push ball) ────
  const activeRobot = newActiveIndex === 0 ? robot0 : robot1
  const activeVel   = newActiveIndex === 0
    ? (robot0.state === RobotState.SHOOTING ? shootBehavior(robot0) : { x: 0, y: 0 })
    : (robot1.state === RobotState.SHOOTING ? shootBehavior(robot1) : { x: 0, y: 0 })
  const gkVel = newGk.state === GoalkeeperState.KICK ? gkKickBehavior(newGk) : { x: 0, y: 0 }

  let newBall = ball
  if (activeRobot.state === RobotState.SHOOTING) newBall = applyContact(newBall, activeRobot, activeVel)
  if (newGk.state === GoalkeeperState.KICK)       newBall = applyContact(newBall, newGk, gkVel)
  newBall = resolveOverlap(newBall, robot0)
  newBall = resolveOverlap(newBall, robot1)
  newBall = resolveOverlap(newBall, newGk)
  newBall = stepBall(newBall, court, dt)

  return {
    ...state,
    robots:          [robot0, robot1],
    debugs:          [r0.debug, r1.debug],
    goalkeeper:      newGk,
    goalkeeperDebug: gkResult.debug,
    activeIndex: newActiveIndex,
    swapTimer:   newSwapTimer,
    ball:        newBall,
    time:        time + dt,
  }
}
