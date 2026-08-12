// ================================================================
// SIMULATION ENGINE — one tick per frame
// ================================================================

import { RobotState, GoalkeeperState, AssistSlot, type Robot, type Ball, type Goal, type Court, type SimState, type DebugData, type StateTransition, type GoalkeeperRobot, type GoalkeeperDebugData, type GcGameState, type GcSubState, type GcSubStateType } from './types'
import { getNextState, getInactiveState, computeAlignmentError, computeOrientationError, computeFovError, isOnCorrectSide, isAligned, isAtContactRange, isOrientationAligned, canSeeBall } from './stateMachine'
import { searchBehavior, idleBehavior, assistBehavior, chaseBehavior, repositionBehavior, radialAdjustBehavior, readyBehavior, shootBehavior, getTargetOrientation, moveToPointBehavior } from './behaviors'
import { goalieDecide, gkCanSeeBall, gkFovError, gkAlignmentError, ballInZone } from './goalkeeperStateMachine'
import { gkFindBallBehavior, gkRetreatBehavior, gkAdjustBlockBehavior, gkChaseBehavior, gkKickBehavior, gkTargetOrientation } from './goalkeeperBehaviors'
import { stepBall, applyContact, resolveOverlap, separateCircles } from './physics'
import { add, scale, dist, rotateToward, normalize, sub, angOf } from './math'
import { calculateAssistAssignments, calculateAssistSlotTarget, segmentDistance, type AssistField, type AssistPenalties, type Pose } from './assistStrategy'
import { assistFieldFromSim, DEFAULT_ASSIST_PENALTIES } from './config'

const MAX_HISTORY = 50

// How far outside the field boundary robots are allowed to walk (to reach corner/sideline balls)
const ROBOT_FIELD_PADDING = 1.0

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

// Kickoff positions for N strikers. First two use the tunable primary/secondary
// Y sliders exactly as before (reproduces 3v3 kickoff formation exactly when
// n===2); any additional assist slots (5v5) spread further back, symmetric
// about y=0, at a small X offset behind the primary/secondary line.
function strikerKickoffPositions(
  n: number, kx: number, primaryY: number, secondaryY: number, backSign: 1 | -1,
): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = []
  if (n >= 1) positions.push({ x: kx, y: primaryY })
  if (n >= 2) positions.push({ x: kx, y: secondaryY })
  const extra = n - 2
  if (extra > 0) {
    const SPACING = 1.6
    const EXTRA_X_OFFSET = 1.5
    for (let i = 0; i < extra; i++) {
      const offset = i - (extra - 1) / 2
      positions.push({ x: kx + backSign * EXTRA_X_OFFSET, y: offset * SPACING })
    }
  }
  return positions
}

// Reset to kickoff positions after a goal is manually scored.
// kickoffSide: 'ours' = we kick off (we conceded), 'theirs' = opponent kicks off (we scored).
export function makeKickoffState(
  state:       SimState,
  score:       { ours: number; theirs: number },
  kickoffSide: 'ours' | 'theirs',
): SimState {
  const gkIdx = state.robots.findIndex(r => r.role === 'goalkeeper')
  const strikerIdxs = state.robots.map((_, i) => i).filter(i => i !== gkIdx)
  if (gkIdx < 0 || strikerIdxs.length < 1) return state

  const { ourKickoffX, ourPrimaryY, ourSecondaryY, theirKickoffX, theirPrimaryY, theirSecondaryY } = state.team
  const kx  = kickoffSide === 'ours' ? ourKickoffX   : theirKickoffX
  const kpy = kickoffSide === 'ours' ? ourPrimaryY   : theirPrimaryY
  const ksy = kickoffSide === 'ours' ? ourSecondaryY : theirSecondaryY
  const gkPos = { x: state.fieldLayout.ownGoalArea.maxX, y: 0 }

  const strikerPositions = strikerKickoffPositions(strikerIdxs.length, kx, kpy, ksy, -1)
  const newRobots = [...state.robots]

  strikerIdxs.forEach((idx, rank) => {
    newRobots[idx] = {
      ...state.robots[idx],
      pos:         { ...strikerPositions[rank] },
      orientation: 0,
      state:       rank === 0 && kickoffSide === 'ours' ? RobotState.CHASING : RobotState.SEARCHING,
    }
  })
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
    activeIndex:    strikerIdxs[0],
    swapTimer:      0,
    gkSwapCooldown: 0,
    debugs: state.robots.map(() => ({ ...EMPTY_STRIKER_DEBUG, stateHistory: [] })),
  }
}

// ----------------------------------------------------------------
// Kickoff walk targets — returns the destination for each robot index.
// Called every frame during gc.gameState === 'READY'.
// ----------------------------------------------------------------
function calcKickoffTargets(state: SimState): { x: number; y: number }[] {
  const gkIdx       = state.robots.findIndex(r => r.role === 'goalkeeper')
  const strikerIdxs = state.robots.map((_, i) => i).filter(i => i !== gkIdx)
  const { kickoffSide } = state.gc
  const { ourKickoffX, ourPrimaryY, ourSecondaryY, theirKickoffX, theirPrimaryY, theirSecondaryY } = state.team
  const kx  = kickoffSide === 'ours' ? ourKickoffX  : theirKickoffX
  const kpy = kickoffSide === 'ours' ? ourPrimaryY  : theirPrimaryY
  const ksy = kickoffSide === 'ours' ? ourSecondaryY : theirSecondaryY

  const targets: { x: number; y: number }[] = state.robots.map(() => ({ x: 0, y: 0 }))
  if (gkIdx >= 0) targets[gkIdx] = { x: state.fieldLayout.ownGoalArea.maxX, y: 0 }
  const strikerPositions = strikerKickoffPositions(strikerIdxs.length, kx, kpy, ksy, -1)
  strikerIdxs.forEach((idx, rank) => { targets[idx] = strikerPositions[rank] })
  return targets
}

// ----------------------------------------------------------------
// Enemy kickoff walk targets — X-mirror of our team's kickoff positions.
// ----------------------------------------------------------------
function calcEnemyKickoffTargets(state: SimState): { x: number; y: number }[] {
  const gkIdx       = state.enemyRobots.findIndex(r => r.role === 'goalkeeper')
  const strikerIdxs = state.enemyRobots.map((_, i) => i).filter(i => i !== gkIdx)
  const { kickoffSide } = state.gc
  const { ourKickoffX, ourPrimaryY, ourSecondaryY, theirKickoffX, theirPrimaryY, theirSecondaryY } = state.team
  // Mirror X: when enemy kicks off ('theirs'), they position like we do for 'ours'
  const kx  = kickoffSide === 'theirs' ? -ourKickoffX   : -theirKickoffX
  const kpy = kickoffSide === 'theirs' ? ourPrimaryY    : theirPrimaryY
  const ksy = kickoffSide === 'theirs' ? ourSecondaryY  : theirSecondaryY

  const targets: { x: number; y: number }[] = state.enemyRobots.map(() => ({ x: 0, y: 0 }))
  if (gkIdx >= 0) targets[gkIdx] = { x: state.fieldLayout.opponentGoalArea.minX, y: 0 }  // mirror of ownGoalArea.maxX
  const strikerPositions = strikerKickoffPositions(strikerIdxs.length, kx, kpy, ksy, 1)
  strikerIdxs.forEach((idx, rank) => { targets[idx] = strikerPositions[rank] })
  return targets
}

// ----------------------------------------------------------------
// Freekick target positions — mirrors GoToFreekickPosition::onRunning()
// Returns [primaryTarget, ...secondaryTargets] — index 0 (primary/active
// striker) is unused by callers today but kept for clarity; indices 1..N are
// the non-active strikers, spread symmetrically around the original
// secondary spot so 3v3 (exactly 1 non-active striker) is reproduced exactly.
// ----------------------------------------------------------------
function calcFreekickTargets(
  ball:           Ball,
  goal:           Goal,
  ownGoal:        Goal,
  freeKickSide:   'ours' | 'theirs',
  nonActiveCount: number,
): { x: number; y: number }[] {
  const ATTACK_DIST  = 0.7
  const DEFENSE_DIST = 1.9
  const fieldHalfLen = Math.abs(ownGoal.center.x)

  let primary:   { x: number; y: number }
  let secondary: { x: number; y: number }

  if (freeKickSide === 'ours') {
    // Attack: 0.7m behind ball toward opponent goal; secondary 1.5m further back at y=0
    const kickDir = Math.atan2(goal.center.y - ball.pos.y, goal.center.x - ball.pos.x)
    const px = ball.pos.x - ATTACK_DIST * Math.cos(kickDir)
    const py = ball.pos.y - ATTACK_DIST * Math.sin(kickDir)
    primary   = { x: px, y: py }
    secondary = { x: Math.max(ownGoal.center.x + 1.3, px - 1.5), y: 0 }
  } else {
    // Defense: 1.9m from ball on the goal→ball line; secondary spreads ±1m on Y
    const defDir = Math.atan2(ball.pos.y, ball.pos.x + fieldHalfLen)
    const px = ball.pos.x - DEFENSE_DIST * Math.cos(defDir)
    const py = ball.pos.y - DEFENSE_DIST * Math.sin(defDir)
    primary   = { x: px, y: py }
    secondary = { x: px, y: py > 0 ? py - 1.0 : py + 1.0 }
  }

  const targets: { x: number; y: number }[] = [primary]
  for (let i = 0; i < nonActiveCount; i++) {
    if (i === 0) { targets.push(secondary); continue }
    const extra = i - 1
    const side  = extra % 2 === 0 ? 1 : -1
    const step  = Math.floor(extra / 2) + 1
    targets.push({ x: secondary.x, y: secondary.y + side * step * 1.0 })
  }
  return targets
}

// ----------------------------------------------------------------
// Assist blocking-slot formation — assigns each non-lead striker a slot on
// the ball→goal-anchor blocking lines (RCAP2026 assist_strategy_policy) and
// tracks the live target + yield state on the robot.
// ----------------------------------------------------------------
function computeAssistFormation(
  robots: Robot[],
  strikerIdxs: number[],
  activeIndex: number,
  previousActiveIndex: number,
  ball: Ball,
  attackGoal: Goal,
  field: AssistField,
  penalties: AssistPenalties,
  time: number,
): Robot[] {
  const result = [...robots]
  const assistCount = strikerIdxs.length - 1
  if (assistCount <= 0) {
    for (const idx of strikerIdxs) {
      if (idx !== activeIndex) result[idx] = { ...result[idx], assistSlot: AssistSlot.NONE }
    }
    return result
  }

  const assistantIds = strikerIdxs.filter(i => i !== activeIndex)
  const poses: Record<number, Pose> = {}
  for (const idx of strikerIdxs) {
    const r = result[idx]
    poses[idx] = { x: r.pos.x, y: r.pos.y, theta: r.orientation }
  }
  const leaderPose = poses[activeIndex]
  const leaderKickDir = angOf(sub(attackGoal.center, ball.pos))

  const previousAssignments: Record<number, AssistSlot> = {}
  for (const idx of strikerIdxs) previousAssignments[idx] = result[idx].assistSlot

  const params = result[strikerIdxs[0]].params
  const near   = params.assistNearFraction
  const far    = params.assistFarFraction
  const center = params.assistCenterFraction

  const assignments = calculateAssistAssignments(
    assistantIds, previousAssignments, previousActiveIndex, activeIndex,
    poses, ball.pos, leaderPose, leaderKickDir,
    near, far, center, field, penalties,
  )

  for (const idx of assistantIds) {
    const slot   = assignments[idx] ?? AssistSlot.NONE
    const target = calculateAssistSlotTarget(
      slot, ball.pos, assistCount, near, far, center, field)
    const robot  = result[idx]

    // NOTE: the C++ YIELD_LANE phase (former leader after losing ownership)
    // is deliberately NOT modeled: it only makes the robot stand still while
    // its lanes are protected, and the sim has no lane routing to protect.
    // Assistants always advance to their live slot target immediately.

    result[idx] = {
      ...robot,
      assistSlot:   slot,
      assistTarget: { x: target.x, y: target.y },
    }
  }

  const leader = result[activeIndex]
  if (leader && leader.assistSlot !== AssistSlot.NONE) {
    result[activeIndex] = {
      ...leader,
      assistSlot: AssistSlot.NONE,
    }
  }
  return result
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
  fkOverride?: { frozen: boolean; target?: { x: number; y: number } },
): { robot: Robot; debug: DebugData } {

  const history = [...prevHistory]

  // ── Freekick override ──────────────────────────────────────
  if (fkOverride) {
    const velocity = fkOverride.frozen || !fkOverride.target
      ? { x: 0, y: 0 }
      : moveToPointBehavior(robot, fkOverride.target, robot.params.chaseSpeed)
    const state = fkOverride.frozen ? RobotState.IDLE : RobotState.ASSIST
    const overRobot = { ...robot, state }
    const rawPos = add(robot.pos, scale(velocity, dt))
    const hw = court.width / 2 - robot.radius + ROBOT_FIELD_PADDING
    const hh = court.height / 2 - robot.radius + ROBOT_FIELD_PADDING
    const pos = { x: Math.max(-hw, Math.min(hw, rawPos.x)), y: Math.max(-hh, Math.min(hh, rawPos.y)) }
    const targetOri = getTargetOrientation(overRobot, ball, goal)
    const orientation = targetOri === null
      ? robot.orientation + robot.params.rotationSpeed * dt
      : rotateToward(robot.orientation, targetOri, robot.params.rotationSpeed, dt)
    return {
      robot: { ...overRobot, pos, orientation },
      debug: { ...EMPTY_STRIKER_DEBUG, stateHistory: history },
    }
  }

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
    case RobotState.ASSIST:       velocity = assistBehavior(updatedRobot, updatedRobot.assistTarget);            break
    case RobotState.CHASING:      velocity = chaseBehavior(updatedRobot, ball);                        break
    case RobotState.REPOSITIONING:velocity = repositionBehavior(updatedRobot, ball, goal);             break
    case RobotState.RADIAL_ADJUST:velocity = radialAdjustBehavior(updatedRobot, ball);                 break
    case RobotState.READY:        velocity = readyBehavior();                                          break
    case RobotState.SHOOTING:     velocity = shootBehavior(updatedRobot);                              break
  }

  // ── 3. Update position ─────────────────────────────────────
  const hw = court.width  / 2 - robot.radius + ROBOT_FIELD_PADDING
  const hh = court.height / 2 - robot.radius + ROBOT_FIELD_PADDING
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
  fkOverride?: { frozen: boolean; target?: { x: number; y: number } },
): { gk: GoalkeeperRobot; debug: GoalkeeperDebugData } {
  const history = [...prevHistory]

  // ── Freekick / penalty override ───────────────────────────
  // Mirrors GoalKeeperFreekick BT: GoToGoalBlockingPosition (frozen in STOP/SET)
  if (fkOverride) {
    const velocity = fkOverride.frozen || !fkOverride.target
      ? { x: 0, y: 0 }
      : (() => {
          const d = dist(gk.pos, fkOverride.target!)
          if (d < 0.05) return { x: 0, y: 0 }
          return scale(normalize(sub(fkOverride.target!, gk.pos)), Math.min(0.1, d * 3))
        })()
    const hw = court.width  / 2 - gk.radius + ROBOT_FIELD_PADDING
    const hh = court.height / 2 - gk.radius + ROBOT_FIELD_PADDING
    const rawPos = add(gk.pos, scale(velocity, dt))
    const pos = { x: Math.max(-hw, Math.min(hw, rawPos.x)), y: Math.max(-hh, Math.min(hh, rawPos.y)) }
    const targetOri = gkTargetOrientation(gk, ball)
    const orientation = targetOri === null
      ? gk.orientation + gk.params.rotationSpeed * dt
      : rotateToward(gk.orientation, targetOri, gk.params.rotationSpeed, dt)
    const finalGk = { ...gk, pos, orientation }
    return {
      gk: finalGk,
      debug: {
        distanceToBall:    dist(finalGk.pos, ball.pos),
        canSeeBall:        gkCanSeeBall(finalGk, ball),
        fovError:          gkFovError(finalGk, ball),
        ballInPenaltyArea: ballInZone(ball, state.fieldLayout.ownPenaltyArea),
        alignmentError:    gkAlignmentError(finalGk, ball),
        stateHistory:      history,
      },
    }
  }

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
  const hw = court.width  / 2 - gk.radius + ROBOT_FIELD_PADDING
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
  // ── Kickoff countdown (auto-play after goal when autoGoal is on) ──
  if (state.kickoffCountdown > 0) {
    const remaining = state.kickoffCountdown - dt
    if (remaining <= 0) {
      return {
        ...state,
        kickoffCountdown: 0,
        isPlaying:        true,
        ball:             { ...state.ball, isStatic: false },
        gc:               { ...state.gc, gameState: 'PLAY' as GcGameState },
      }
    }
    return { ...state, kickoffCountdown: remaining }
  }

  const { ball, goal, court, team, time, ownGoal } = state
  let robots: Robot[] = [...state.robots]

  // ── GK role swap (2 s cooldown) ───────────────────────────
  // Trigger: GK is farther from own goal than ALL strikers
  // Action: closest striker to own goal becomes the new GK
  let newGkSwapCooldown = Math.max(0, state.gkSwapCooldown - dt)

  if (newGkSwapCooldown <= 0) {
    const gkIdx = robots.findIndex(r => r.role === 'goalkeeper')
    const strikerIdxs = robots.map((_, i) => i).filter(i => i !== gkIdx)

    if (gkIdx >= 0 && strikerIdxs.length >= 1) {
      const gkDistToGoal = dist(robots[gkIdx].pos, ownGoal.center)
      const strikerDists = strikerIdxs.map(si => ({ idx: si, d: dist(robots[si].pos, ownGoal.center) }))
      const allStrikersCloser = strikerDists.every(sd => sd.d < gkDistToGoal)

      if (allStrikersCloser) {
        const newGk = strikerDists.reduce((best, sd) => sd.d < best.d ? sd : best)
        robots = [...robots]
        robots[gkIdx]      = { ...robots[gkIdx],      role: 'striker',    state: RobotState.SEARCHING }
        robots[newGk.idx]  = { ...robots[newGk.idx],  role: 'goalkeeper', state: RobotState.IDLE, gkState: GoalkeeperState.RETREAT }
        newGkSwapCooldown = 2.0
      }
    }
  }

  // ── Striker lead swap with hysteresis ─────────────────────
  const gkIdxNow       = robots.findIndex(r => r.role === 'goalkeeper')
  const strikerIdxsNow = robots.map((_, i) => i).filter(i => i !== gkIdxNow)

  const strikerDistsToBall = strikerIdxsNow.map(si => ({ idx: si, d: dist(robots[si].pos, ball.pos) }))
  const closerStrikerIdx   = strikerDistsToBall.reduce((best, sd) => sd.d < best.d ? sd : best).idx

  let newSwapTimer   = state.swapTimer
  let newActiveIndex = state.activeIndex
  // Ensure activeIndex points to a striker after a role swap
  if (robots[newActiveIndex]?.role !== 'striker') newActiveIndex = strikerIdxsNow[0]

  if (closerStrikerIdx !== newActiveIndex) {
    newSwapTimer += dt
    if (newSwapTimer >= team.roleSwapDelay) {
      newActiveIndex = closerStrikerIdx
      newSwapTimer   = 0
    }
  } else {
    newSwapTimer = 0
  }

  // Rank each non-active striker (0 = active, 1..N = the rest, in index order) —
  // used to pick a spread-out free-kick support target per robot.
  const strikerRankByIndex = new Map<number, number>()
  let nonActiveRank = 1
  for (const idx of strikerIdxsNow) {
    strikerRankByIndex.set(idx, idx === newActiveIndex ? 0 : nonActiveRank++)
  }

  // ── Assist blocking-slot formation (RCAP2026 assist strategy) ──
  // Assigns each non-lead striker a ball→goal blocking slot and stamps the
  // live target + yield state onto the robot before it is ticked.
  const assistRobots = computeAssistFormation(
    robots, strikerIdxsNow, newActiveIndex, state.activeIndex, ball, goal,
    assistFieldFromSim(ownGoal, court, state.fieldLayout),
    DEFAULT_ASSIST_PENALTIES, time,
  )

  // ── Kickoff walk (READY state) ───────────────────────────
  const isKickoffReady  = state.gc.gameState === 'READY'
  const kickoffTargets  = isKickoffReady ? calcKickoffTargets(state) : null

  // ── Freekick state ────────────────────────────────────────
  const fkActive = state.gc.subStateType === 'FREE_KICK'
  const fkFrozen = fkActive && (state.gc.subState === 'STOP' || state.gc.subState === 'SET')
  const fkMove   = fkActive && state.gc.subState === 'GET_READY'
  const fkTargets = fkMove
    ? calcFreekickTargets(ball, goal, ownGoal, state.gc.freeKickSide, strikerIdxsNow.length - 1)
    : null
  // GK goal-blocking target during GET_READY: 0.9m from goal line, centred
  // Mirrors GoToGoalBlockingPosition dist_to_goalline=0.9 (robotedge)
  const GK_FK_DIST = 0.9
  const gkFkTarget = fkMove ? { x: ownGoal.center.x + GK_FK_DIST, y: 0 } : undefined

  // ── Tick each robot ────────────────────────────────────────
  const tickedRobots: Robot[]           = new Array(assistRobots.length)
  const newDebugs:    DebugData[]       = new Array(assistRobots.length)
  let   newGkDebug:   GoalkeeperDebugData = state.goalkeeperDebug

  for (let i = 0; i < assistRobots.length; i++) {
    const penalized = state.gc.penalties[i] ?? false
    if (assistRobots[i].role === 'goalkeeper') {
      const gkFkOvr = penalized
        ? { frozen: true }
        : kickoffTargets ? { frozen: false, target: kickoffTargets[i] }
        : fkActive ? { frozen: fkFrozen, target: gkFkTarget } : undefined
      const gkResult = tickGoalkeeper(
        toGKRobot(assistRobots[i]), ball, ownGoal, court, state, dt, time,
        state.goalkeeperDebug.stateHistory,
        gkFkOvr,
      )
      tickedRobots[i] = fromGKRobot(assistRobots[i], gkResult.gk)
      newDebugs[i]    = { ...EMPTY_STRIKER_DEBUG, stateHistory: state.debugs[i]?.stateHistory ?? [] }
      newGkDebug      = gkResult.debug
    } else {
      const isActive = newActiveIndex === i
      const strikerRank = strikerRankByIndex.get(i) ?? 0
      // During GET_READY the active striker (rank 0) plays normally so it can kick.
      // Non-active strikers (rank > 0) are sent to a spread-out support target.
      const fkOverride = penalized
        ? { frozen: true }
        : kickoffTargets ? { frozen: false, target: kickoffTargets[i] }
        : fkActive && (fkFrozen || strikerRank > 0)
          ? { frozen: fkFrozen, target: fkTargets?.[strikerRank] }
          : undefined
      const r = tickRobot(assistRobots[i], ball, goal, court, isActive, dt, time, state.debugs[i]?.stateHistory ?? [], fkOverride)
      tickedRobots[i] = r.robot
      newDebugs[i]    = r.debug
    }
  }

  // ── Collision resolution (every pair) ─────────────────────
  const resolvedPositions = tickedRobots.map(r => r.pos)
  for (let a = 0; a < tickedRobots.length; a++) {
    for (let b = a + 1; b < tickedRobots.length; b++) {
      const [pa, pb] = separateCircles(resolvedPositions[a], tickedRobots[a].radius, resolvedPositions[b], tickedRobots[b].radius, court)
      resolvedPositions[a] = pa
      resolvedPositions[b] = pb
    }
  }

  const finalRobots: Robot[] = tickedRobots.map((r, i) => ({ ...r, pos: resolvedPositions[i] }))

  const KICKOFF_ARRIVAL = 0.25

  // ── Enemy team ────────────────────────────────────────────
  // Enemy attacks our ownGoal (left, -7); defends goal (right, +7).
  // Swap own/opponent penalty areas so GK state machine uses correct zones.
  let finalEnemyRobots: Robot[] = [...state.enemyRobots]
  let newEnemyActiveIndex    = state.enemyActiveIndex
  let newEnemySwapTimer      = state.enemySwapTimer
  let newEnemyGkSwapCooldown = state.enemyGkSwapCooldown
  let newEnemyDebugs: DebugData[]          = state.enemyDebugs
  let newEnemyGkDebug: GoalkeeperDebugData = state.enemyGoalkeeperDebug

  if (state.enemyMode === 'active') {
    const enemyFieldState: SimState = {
      ...state,
      fieldLayout: {
        ...state.fieldLayout,
        ownPenaltyArea:      state.fieldLayout.opponentPenaltyArea,
        ownGoalArea:         state.fieldLayout.opponentGoalArea,
        opponentPenaltyArea: state.fieldLayout.ownPenaltyArea,
        opponentGoalArea:    state.fieldLayout.ownGoalArea,
      },
    }
    const enemyDefenseGoal = goal     // right goal (+7) — enemy GK defends this
    const enemyAttackGoal  = ownGoal  // left goal  (-7) — enemy shoots at this

    // GK swap (same logic, measuring distance to enemy's defence goal)
    let eGkCooldown = Math.max(0, state.enemyGkSwapCooldown - dt)
    let eRobots: Robot[] = [...state.enemyRobots]
    if (eGkCooldown <= 0) {
      const egkIdx = eRobots.findIndex(r => r.role === 'goalkeeper')
      const eSIdxs = eRobots.map((_, i) => i).filter(i => i !== egkIdx)
      if (egkIdx >= 0 && eSIdxs.length >= 1) {
        const gkD = dist(eRobots[egkIdx].pos, enemyDefenseGoal.center)
        const eStrikerDists = eSIdxs.map(si => ({ idx: si, d: dist(eRobots[si].pos, enemyDefenseGoal.center) }))
        if (eStrikerDists.every(sd => sd.d < gkD)) {
          const newGk = eStrikerDists.reduce((best, sd) => sd.d < best.d ? sd : best)
          eRobots = [...eRobots]
          eRobots[egkIdx]     = { ...eRobots[egkIdx],     role: 'striker',    state: RobotState.SEARCHING }
          eRobots[newGk.idx]  = { ...eRobots[newGk.idx], role: 'goalkeeper', state: RobotState.IDLE, gkState: GoalkeeperState.RETREAT }
          eGkCooldown = 2.0
        }
      }
    }
    newEnemyGkSwapCooldown = eGkCooldown

    // Striker swap
    const egkNow = eRobots.findIndex(r => r.role === 'goalkeeper')
    const eSNow  = eRobots.map((_, i) => i).filter(i => i !== egkNow)
    const eDistsToBall = eSNow.map(si => ({ idx: si, d: dist(eRobots[si].pos, ball.pos) }))
    const eCloser = eDistsToBall.reduce((best, sd) => sd.d < best.d ? sd : best).idx
    if (eRobots[newEnemyActiveIndex]?.role !== 'striker') newEnemyActiveIndex = eSNow[0]
    if (eCloser !== newEnemyActiveIndex) {
      newEnemySwapTimer += dt
      if (newEnemySwapTimer >= team.roleSwapDelay) { newEnemyActiveIndex = eCloser; newEnemySwapTimer = 0 }
    } else { newEnemySwapTimer = 0 }

    // Enemy assist blocking-slot formation — mirrored so enemy assistants block
    // relative to their own goal (their defense goal = the sim's right goal).
    const enemyAssistRobots = computeAssistFormation(
      eRobots, eSNow, newEnemyActiveIndex, state.enemyActiveIndex, ball, enemyAttackGoal,
      assistFieldFromSim(enemyDefenseGoal, court, enemyFieldState.fieldLayout),
      DEFAULT_ASSIST_PENALTIES, time,
    )

    // Kickoff walk targets for enemy
    const eKickoffTargets = isKickoffReady ? calcEnemyKickoffTargets(state) : null

    // Tick each enemy robot
    const tickedE: Robot[]     = new Array(enemyAssistRobots.length)
    const eDbgs:   DebugData[] = new Array(enemyAssistRobots.length)
    for (let i = 0; i < enemyAssistRobots.length; i++) {
      if (enemyAssistRobots[i].role === 'goalkeeper') {
        const eGkOvr = eKickoffTargets
          ? { frozen: false, target: eKickoffTargets[i] }
          : undefined
        const res = tickGoalkeeper(
          toGKRobot(enemyAssistRobots[i]), ball, enemyDefenseGoal, court,
          enemyFieldState, dt, time,
          state.enemyGoalkeeperDebug.stateHistory,
          eGkOvr,
        )
        tickedE[i]       = fromGKRobot(enemyAssistRobots[i], res.gk)
        eDbgs[i]         = { ...EMPTY_STRIKER_DEBUG, stateHistory: state.enemyDebugs[i]?.stateHistory ?? [] }
        newEnemyGkDebug  = res.debug
      } else {
        const isEActive   = newEnemyActiveIndex === i
        const eFkOverride = eKickoffTargets
          ? { frozen: false, target: eKickoffTargets[i] }
          : undefined
        const res = tickRobot(
          enemyAssistRobots[i], ball, enemyAttackGoal, court,
          isEActive, dt, time,
          state.enemyDebugs[i]?.stateHistory ?? [],
          eFkOverride,
        )
        tickedE[i] = res.robot
        eDbgs[i]   = res.debug
      }
    }

    // Intra-enemy collision (every pair)
    const eResolvedPositions = tickedE.map(r => r.pos)
    for (let a = 0; a < tickedE.length; a++) {
      for (let b = a + 1; b < tickedE.length; b++) {
        const [pa, pb] = separateCircles(eResolvedPositions[a], tickedE[a].radius, eResolvedPositions[b], tickedE[b].radius, court)
        eResolvedPositions[a] = pa
        eResolvedPositions[b] = pb
      }
    }
    finalEnemyRobots = tickedE.map((r, i) => ({ ...r, pos: eResolvedPositions[i] }))
    newEnemyDebugs = eDbgs
  }

  // Cross-team collision (our finalRobots vs enemy — only when enemy is present)
  let crossOur   = [...finalRobots]
  let crossEnemy = [...finalEnemyRobots]
  if (state.enemyMode !== 'off') {
    for (let oi = 0; oi < crossOur.length; oi++) {
      for (let ei = 0; ei < crossEnemy.length; ei++) {
        const [np, ne] = separateCircles(crossOur[oi].pos, crossOur[oi].radius, crossEnemy[ei].pos, crossEnemy[ei].radius, court)
        crossOur[oi]   = { ...crossOur[oi],   pos: np }
        crossEnemy[ei] = { ...crossEnemy[ei], pos: ne }
      }
    }
    finalEnemyRobots = crossEnemy
  }
  const trueFinalRobots = crossOur

  // ── Ball physics ──────────────────────────────────────────
  const activeRobot  = trueFinalRobots[newActiveIndex]
  const gkFinalRobot = trueFinalRobots.find(r => r.role === 'goalkeeper')!
  const activeVel    = activeRobot.state === RobotState.SHOOTING ? shootBehavior(activeRobot) : { x: 0, y: 0 }
  const gkVel        = gkFinalRobot.gkState === GoalkeeperState.KICK
    ? gkKickBehavior(toGKRobot(gkFinalRobot))
    : { x: 0, y: 0 }

  let newBall = ball
  if (activeRobot.state === RobotState.SHOOTING)       newBall = applyContact(newBall, activeRobot, activeVel)
  if (gkFinalRobot.gkState === GoalkeeperState.KICK)   newBall = applyContact(newBall, gkFinalRobot, gkVel)
  for (const fr of trueFinalRobots) newBall = resolveOverlap(newBall, fr)

  if (state.enemyMode === 'active') {
    const eActive = finalEnemyRobots[newEnemyActiveIndex]
    const eGk     = finalEnemyRobots.find(r => r.role === 'goalkeeper')
    if (eActive.state === RobotState.SHOOTING)        newBall = applyContact(newBall, eActive, shootBehavior(eActive))
    if (eGk && eGk.gkState === GoalkeeperState.KICK) newBall = applyContact(newBall, eGk, gkKickBehavior(toGKRobot(eGk)))
  }
  if (state.enemyMode !== 'off') {
    for (const er of finalEnemyRobots) newBall = resolveOverlap(newBall, er)
  }

  // Auto goal detection — check if ball would cross a goal line this frame
  if (state.autoGoal && !newBall.isStatic) {
    const halfLen = court.width / 2
    const goalHW  = state.goal.width / 2
    const px = newBall.pos.x + newBall.velocity.x * dt
    const py = newBall.pos.y + newBall.velocity.y * dt
    let goalScored: 'ours' | 'theirs' | null = null
    if (px >= halfLen  && Math.abs(py) <= goalHW) goalScored = 'ours'
    if (px <= -halfLen && Math.abs(py) <= goalHW) goalScored = 'theirs'
    if (goalScored) {
      const newScore = goalScored === 'ours'
        ? { ours: state.score.ours + 1, theirs: state.score.theirs }
        : { ours: state.score.ours,     theirs: state.score.theirs + 1 }
      const kickoffSide: 'ours' | 'theirs' = goalScored === 'ours' ? 'theirs' : 'ours'
      return {
        ...state,
        score:     newScore,
        isPlaying: true,
        ball:      { ...state.ball, pos: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, isStatic: true },
        gc: {
          ...state.gc,
          gameState:    'READY'     as GcGameState,
          kickoffSide,
          subStateType: 'NONE'      as GcSubStateType,
          subState:     'STOP'      as GcSubState,
        },
      }
    }
  }

  newBall = stepBall(newBall, court, dt, state.goal.width / 2, state.goal.depth)

  // Auto-pause once all robots (and enemy team when active) reach kickoff positions
  const enemyKickoffDone = state.enemyMode !== 'active' || !isKickoffReady || (() => {
    const t = calcEnemyKickoffTargets(state)
    return finalEnemyRobots.every((r, i) => dist(r.pos, t[i]) < KICKOFF_ARRIVAL)
  })()
  const kickoffDone = kickoffTargets !== null &&
    trueFinalRobots.every((r, i) => dist(r.pos, kickoffTargets[i]) < KICKOFF_ARRIVAL) &&
    enemyKickoffDone

  return {
    ...state,
    robots:               trueFinalRobots,
    debugs:               newDebugs,
    goalkeeperDebug:      newGkDebug,
    activeIndex:          newActiveIndex,
    swapTimer:            newSwapTimer,
    gkSwapCooldown:       newGkSwapCooldown,
    ball:                 newBall,
    time:                 time + dt,
    isPlaying:            kickoffDone && !state.autoGoal ? false : state.isPlaying,
    kickoffCountdown:     kickoffDone && state.autoGoal ? 5 : state.kickoffCountdown,
    enemyRobots:          finalEnemyRobots,
    enemyDebugs:          newEnemyDebugs,
    enemyGoalkeeperDebug: newEnemyGkDebug,
    enemyActiveIndex:     newEnemyActiveIndex,
    enemySwapTimer:       newEnemySwapTimer,
    enemyGkSwapCooldown:  newEnemyGkSwapCooldown,
  }
}
