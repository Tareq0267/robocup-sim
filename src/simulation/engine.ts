// ================================================================
// SIMULATION ENGINE — one tick per frame
// ================================================================

import { RobotState, GoalkeeperState, type Robot, type Ball, type Goal, type Court, type SimState, type DebugData, type StateTransition, type GoalkeeperRobot, type GoalkeeperDebugData } from './types'
import { getNextState, getInactiveState, computeAlignmentError, computeOrientationError, computeFovError, isOnCorrectSide, isAligned, isAtContactRange, isOrientationAligned, canSeeBall } from './stateMachine'
import { searchBehavior, idleBehavior, assistBehavior, chaseBehavior, repositionBehavior, radialAdjustBehavior, readyBehavior, shootBehavior, getTargetOrientation } from './behaviors'
import { goalieDecide, gkCanSeeBall, gkFovError, gkAlignmentError, ballInZone } from './goalkeeperStateMachine'
import { gkFindBallBehavior, gkRetreatBehavior, gkAdjustBlockBehavior, gkChaseBehavior, gkKickBehavior, gkTargetOrientation } from './goalkeeperBehaviors'
import { stepBall, applyContact, resolveOverlap, separateCircles } from './physics'
import { add, scale, dist, rotateToward } from './math'

const MAX_HISTORY = 50

// ----------------------------------------------------------------
// Kickoff reset positions — from brain_tree.cpp GoToReadyPosition::tick()
// Real robot: our kickoff tx=-max(circleRadius,2.0)=-2.0  ty=0 (both strikers)
//             opp kickoff  tx=-circleRadius=-1.53          ty=0 (both strikers)
//             GK           tx=-length/2+goalAreaLength=-5.76 → sim equiv: -7+1=-6.0
// ----------------------------------------------------------------
const OUR_KICKOFF = [
  { x: -2.0, y: 0 },   // striker (both stand here; collision resolution separates them)
  { x: -2.0, y: 0 },
  { x: -6.0, y: 0 },   // GK — goal line offset into goal area (-7+1)
] as const

const OPP_KICKOFF = [
  { x: -1.53, y: 0 },  // strikers wait at circle edge
  { x: -1.53, y: 0 },
  { x: -6.0,  y: 0 },  // GK
] as const

const EMPTY_STRIKER_DEBUG: DebugData = {
  distanceToBall:       0,
  alignmentError:       0,
  orientationError:     0,
  fovError:             0,
  canSeeBall:           false,
  isAligned:            false,
  isOnCorrectSide:      false,
  isAtShootDistance:    false,
  isOrientationAligned: false,
  tangentialDir:        null,
  radialDir:            null,
  targetOrientation:    null,
  stateHistory:         [],
}

// ----------------------------------------------------------------
// Adapters — convert between unified Robot and GoalkeeperRobot
// ----------------------------------------------------------------
function toGKRobot(r: Robot): GoalkeeperRobot {
  return { pos: r.pos, orientation: r.orientation, state: r.gkState, radius: r.radius, params: r.gkParams }
}

function fromGKRobot(r: Robot, gk: GoalkeeperRobot): Robot {
  return { ...r, pos: gk.pos, orientation: gk.orientation, gkState: gk.state }
}

// Reset to kickoff positions after a goal is manually scored.
// kickoffSide: 'ours' = we kick off (we conceded), 'theirs' = opponent kicks off (we scored).
export function makeKickoffState(
  state:       SimState,
  score:       { ours: number; theirs: number },
  kickoffSide: 'ours' | 'theirs',
): SimState {
  const gkIdx = state.robots.findIndex(r => r.role === 'goalkeeper')
  const strikerIdxs = ([0, 1, 2] as const).filter((i): i is 0 | 1 | 2 => i !== gkIdx)
  if (gkIdx < 0 || strikerIdxs.length < 2) return state

  const positions = kickoffSide === 'ours' ? OUR_KICKOFF : OPP_KICKOFF
  const [sPos0, sPos1, gkPos] = positions
  const [sa, sb] = strikerIdxs

  const newRobots = [...state.robots] as [Robot, Robot, Robot]

  newRobots[sa] = {
    ...state.robots[sa],
    pos:         { ...sPos0 },
    orientation: 0,
    state:       kickoffSide === 'ours' ? RobotState.CHASING : RobotState.SEARCHING,
  }
  newRobots[sb] = {
    ...state.robots[sb],
    pos:         { ...sPos1 },
    orientation: 0,
    state:       RobotState.SEARCHING,
  }
  newRobots[gkIdx] = {
    ...state.robots[gkIdx],
    pos:         { ...gkPos },
    orientation: 0,
    gkState:     GoalkeeperState.RETREAT,
  }

  return {
    ...state,
    score,
    robots:         newRobots,
    ball:           { ...state.ball, pos: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } },
    activeIndex:    sa,
    swapTimer:      0,
    gkSwapCooldown: 0,
    debugs: [
      { ...EMPTY_STRIKER_DEBUG, stateHistory: [] },
      { ...EMPTY_STRIKER_DEBUG, stateHistory: [] },
      { ...EMPTY_STRIKER_DEBUG, stateHistory: [] },
    ],
  }
}

// ----------------------------------------------------------------
// Single-robot update — called once per striker robot per frame
// ----------------------------------------------------------------
function tickRobot(
  robot:       Robot,
  ball:        Ball,
  goal:        Goal,
  court:       Court,
  isActive:    boolean,
  dt:          number,
  time:        number,
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
    case RobotState.SEARCHING:    velocity = searchBehavior();                                         break
    case RobotState.IDLE:         velocity = idleBehavior();                                           break
    case RobotState.ASSIST:       velocity = assistBehavior(updatedRobot, ball, court.width / 2);      break
    case RobotState.CHASING:      velocity = chaseBehavior(updatedRobot, ball);                        break
    case RobotState.REPOSITIONING:velocity = repositionBehavior(updatedRobot, ball, goal);             break
    case RobotState.RADIAL_ADJUST:velocity = radialAdjustBehavior(updatedRobot, ball);                 break
    case RobotState.READY:        velocity = readyBehavior();                                          break
    case RobotState.SHOOTING:     velocity = shootBehavior(updatedRobot);                              break
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
  const { state: nextState, reason } = goalieDecide(gk, ball, state.fieldLayout.ownPenaltyArea, state.fieldLayout.ownGoalArea)

  if (nextState !== gk.state) {
    history.unshift({ time, from: gk.state as string, to: nextState as string, reason } as StateTransition)
    if (history.length > 50) history.pop()
  }

  const updatedGk = { ...gk, state: nextState }

  // ── 2. Compute velocity ────────────────────────────────────
  let velocity: { x: number; y: number } = { x: 0, y: 0 }
  switch (nextState) {
    case GoalkeeperState.FIND_BALL:    velocity = gkFindBallBehavior();                          break
    case GoalkeeperState.RETREAT:      velocity = gkRetreatBehavior(updatedGk, ball, ownGoal, state.fieldLayout.ownPenaltyArea); break
    case GoalkeeperState.ADJUST_BLOCK: velocity = gkAdjustBlockBehavior(updatedGk, ball, ownGoal, ballInZone(ball, state.fieldLayout.ownPenaltyArea), state.fieldLayout.ownGoalArea); break
    case GoalkeeperState.CHASE:        velocity = gkChaseBehavior(updatedGk, ball);              break
    case GoalkeeperState.KICK:         velocity = gkKickBehavior(updatedGk);                     break
  }

  // ── 3. Update position ─────────────────────────────────────
  const hw = court.width  / 2 - gk.radius
  const hh = court.height / 2 - gk.radius
  const rawPos = add(updatedGk.pos, scale(velocity, dt))
  const clampedPos = {
    x: Math.max(-hw, Math.min(hw, rawPos.x)),
    y: Math.max(-hh, Math.min(hh, rawPos.y)),
  }

  // ── 4. Update orientation ──────────────────────────────────
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
// Main tick — updates all three robots + ball + coordination
// ----------------------------------------------------------------
export function tick(state: SimState, dt: number): SimState {
  const { ball, goal, court, team, time, ownGoal } = state
  let robots: [Robot, Robot, Robot] = [...state.robots] as [Robot, Robot, Robot]

  // ── GK role swap (2 s cooldown) ───────────────────────────
  // Trigger: GK is farther from own goal than ALL strikers
  // Action: closest striker to own goal becomes the new GK
  let newGkSwapCooldown = Math.max(0, state.gkSwapCooldown - dt)

  if (newGkSwapCooldown <= 0) {
    const gkIdx = robots.findIndex(r => r.role === 'goalkeeper')
    const strikerIdxs = ([0, 1, 2] as const).filter(i => i !== gkIdx)

    if (gkIdx >= 0 && strikerIdxs.length === 2) {
      const gkDistToGoal = dist(robots[gkIdx].pos, ownGoal.center)
      const allStrikersCloser = strikerIdxs.every(
        si => dist(robots[si].pos, ownGoal.center) < gkDistToGoal
      )

      if (allStrikersCloser) {
        const [sa, sb] = strikerIdxs
        const newGkIdx = dist(robots[sa].pos, ownGoal.center) <= dist(robots[sb].pos, ownGoal.center)
          ? sa : sb
        robots = [...robots] as [Robot, Robot, Robot]
        robots[gkIdx]    = { ...robots[gkIdx],    role: 'striker',    state: RobotState.SEARCHING }
        robots[newGkIdx] = { ...robots[newGkIdx], role: 'goalkeeper', state: RobotState.IDLE, gkState: GoalkeeperState.RETREAT }
        newGkSwapCooldown = 2.0
      }
    }
  }

  // ── Striker lead swap with hysteresis ─────────────────────
  const gkIdxNow      = robots.findIndex(r => r.role === 'goalkeeper')
  const strikerIdxsNow = ([0, 1, 2] as const).filter(i => i !== gkIdxNow)
  const [sa, sb]       = strikerIdxsNow

  const da = dist(robots[sa].pos, ball.pos)
  const db = dist(robots[sb].pos, ball.pos)
  const closerStrikerIdx = da <= db ? sa : sb

  let newSwapTimer   = state.swapTimer
  let newActiveIndex = state.activeIndex
  // Ensure activeIndex points to a striker after a role swap
  if (robots[newActiveIndex]?.role !== 'striker') newActiveIndex = sa

  if (closerStrikerIdx !== newActiveIndex) {
    newSwapTimer += dt
    if (newSwapTimer >= team.roleSwapDelay) {
      newActiveIndex = closerStrikerIdx
      newSwapTimer   = 0
    }
  } else {
    newSwapTimer = 0
  }

  // ── Tick each robot ────────────────────────────────────────
  const tickedRobots: Robot[]           = new Array(3)
  const newDebugs:    DebugData[]       = new Array(3)
  let   newGkDebug:   GoalkeeperDebugData = state.goalkeeperDebug

  for (let i = 0; i < 3; i++) {
    if (robots[i].role === 'goalkeeper') {
      const gkResult = tickGoalkeeper(
        toGKRobot(robots[i]), ball, ownGoal, court, state, dt, time,
        state.goalkeeperDebug.stateHistory,
      )
      tickedRobots[i] = fromGKRobot(robots[i], gkResult.gk)
      newDebugs[i]    = { ...EMPTY_STRIKER_DEBUG, stateHistory: state.debugs[i].stateHistory }
      newGkDebug      = gkResult.debug
    } else {
      const isActive = newActiveIndex === i
      const r = tickRobot(robots[i], ball, goal, court, isActive, dt, time, state.debugs[i].stateHistory)
      tickedRobots[i] = r.robot
      newDebugs[i]    = r.debug
    }
  }

  // ── Collision resolution (all 3 pairs) ────────────────────
  let p0 = tickedRobots[0].pos
  let p1 = tickedRobots[1].pos
  let p2 = tickedRobots[2].pos
  ;[p0, p1] = separateCircles(p0, tickedRobots[0].radius, p1, tickedRobots[1].radius, court)
  ;[p0, p2] = separateCircles(p0, tickedRobots[0].radius, p2, tickedRobots[2].radius, court)
  ;[p1, p2] = separateCircles(p1, tickedRobots[1].radius, p2, tickedRobots[2].radius, court)

  const finalRobots: [Robot, Robot, Robot] = [
    { ...tickedRobots[0], pos: p0 },
    { ...tickedRobots[1], pos: p1 },
    { ...tickedRobots[2], pos: p2 },
  ]

  // ── Ball physics ──────────────────────────────────────────
  const activeRobot  = finalRobots[newActiveIndex]
  const gkFinalRobot = finalRobots.find(r => r.role === 'goalkeeper')!
  const activeVel    = activeRobot.state === RobotState.SHOOTING ? shootBehavior(activeRobot) : { x: 0, y: 0 }
  const gkVel        = gkFinalRobot.gkState === GoalkeeperState.KICK
    ? gkKickBehavior(toGKRobot(gkFinalRobot))
    : { x: 0, y: 0 }

  let newBall = ball
  if (activeRobot.state === RobotState.SHOOTING)       newBall = applyContact(newBall, activeRobot, activeVel)
  if (gkFinalRobot.gkState === GoalkeeperState.KICK)   newBall = applyContact(newBall, gkFinalRobot, gkVel)
  for (const fr of finalRobots) newBall = resolveOverlap(newBall, fr)
  newBall = stepBall(newBall, court, dt)

  return {
    ...state,
    robots:          finalRobots,
    debugs:          newDebugs as [DebugData, DebugData, DebugData],
    goalkeeperDebug: newGkDebug,
    activeIndex:     newActiveIndex,
    swapTimer:       newSwapTimer,
    gkSwapCooldown:  newGkSwapCooldown,
    ball:            newBall,
    time:            time + dt,
  }
}
