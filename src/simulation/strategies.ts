// ================================================================
// STRATEGY DECISION LOGIC
// The only place tactic-specific decisions live. Each strategy adds a
// branch to the two functions below — nothing else needs to change to
// add a new strategy (register it in config.ts's STRATEGIES list too).
// ================================================================

import { RobotState, type Robot, type Ball, type Goal, type Vec2, type StrategyId, type StrategyParams } from './types'
import { canSeeBall, computeFovError } from './stateMachine'
import { dist } from './math'

export interface InactiveRoleResult {
  state:        RobotState
  reason:       string
  runUpTarget?: Vec2
}

// Decide what an inactive (non-active-striker) robot should do this frame.
// isDesignatedRunner is true for at most one inactive robot per team — the
// one making the attacking run under strategies that call for it. Any other
// inactive robots (5v5) always fall back to the default ASSIST behavior.
export function decideInactiveRole(
  strategy:           StrategyId,
  robot:              Robot,
  ball:               Ball,
  goal:               Goal,
  params:             StrategyParams,
  isDesignatedRunner: boolean,
): InactiveRoleResult {
  if (!canSeeBall(robot, ball)) {
    const errDeg = (computeFovError(robot, ball) * 180 / Math.PI).toFixed(1)
    const limDeg = (robot.params.fieldOfView / 2 * 180 / Math.PI).toFixed(1)
    return { state: RobotState.SEARCHING, reason: `Inactive + ball out of FOV (${errDeg}° > ±${limDeg}°)` }
  }

  if (strategy === 'runAndPass' && isDesignatedRunner) {
    const runUpTarget = { x: goal.center.x - params.runUpDepth, y: params.runUpLaneY }
    return { state: RobotState.RUN_UP, reason: 'Run & Pass — making attacking run', runUpTarget }
  }

  return { state: RobotState.ASSIST, reason: 'Inactive — moving to support position' }
}

export interface AimTargetResult {
  target:    Vec2
  isPassing: boolean
}

// Decide what point the active striker should aim at. Defaults to the goal
// centre; strategies can redirect to a qualifying teammate's position instead
// (the shooting pipeline in stateMachine.ts/behaviors.ts only ever reads
// goal.center, so "pass" is just "shoot at a point that isn't the goal").
export function decideAimTarget(
  strategy: StrategyId,
  runner:   Robot | null,
  goal:     Goal,
  params:   StrategyParams,
): AimTargetResult {
  if (strategy === 'runAndPass' && runner && runner.state === RobotState.RUN_UP) {
    if (dist(runner.pos, goal.center) <= params.passTriggerDist) {
      return { target: runner.pos, isPassing: true }
    }
  }
  return { target: goal.center, isPassing: false }
}
