// ================================================================
// DEFAULT VALUES — change these to set starting conditions
// ================================================================
import { RobotState, GoalkeeperState, AssistSlot, type Robot, type Ball, type Goal, type Court, type OverlaySettings, type RobotParams, type TeamConfig, type FieldLayout, type GoalkeeperParams, type GoalkeeperDebugData, type GameControllerState, type GameMode } from './types'
import type { AssistField } from './assistStrategy'

// Adult Size field: 14m × 9m
export const DEFAULT_COURT: Court = {
  width:  14,
  height: 9,
}

// Opponent goal — right side, x = +7.0
export const DEFAULT_GOAL: Goal = {
  center: { x: 7.0, y: 0 },
  width:  2.6,
  depth:  0.6,
}

// Our goal — left side, x = -7.0
export const DEFAULT_OWN_GOAL: Goal = {
  center: { x: -7.0, y: 0 },
  width:  2.6,
  depth:  0.6,
}

// Adult Size field zones
export const DEFAULT_FIELD_LAYOUT: FieldLayout = {
  ownPenaltyArea:      { minX: -7.0, maxX: -4.0, minY: -3.0, maxY: 3.0 },
  ownGoalArea:         { minX: -7.0, maxX: -6.0, minY: -2.0, maxY: 2.0 },
  opponentPenaltyArea: { minX:  4.0, maxX:  7.0, minY: -3.0, maxY: 3.0 },
  opponentGoalArea:    { minX:  6.0, maxX:  7.0, minY: -2.0, maxY: 2.0 },
  centreCircleRadius:  1.5,
  penaltyMarkDist:     2.1,
}

// ----------------------------------------------------------------
// 5v5 FIELD — HSL 2026 draft "L-Field": 22m × 14m
// Zones scaled from Adult-Size by the field's growth ratio
// (length ×22/14≈1.571, width ×14/9≈1.556) to keep goal/penalty-area
// proportions consistent with 3v3.
// ----------------------------------------------------------------
const LEN_RATIO = 22 / 14   // ≈ 1.571
const WID_RATIO = 14 / 9    // ≈ 1.556

export const DEFAULT_COURT_5V5: Court = {
  width:  22,
  height: 14,
}

export const DEFAULT_GOAL_5V5: Goal = {
  center: { x: 11.0, y: 0 },
  width:  DEFAULT_GOAL.width  * WID_RATIO,
  depth:  DEFAULT_GOAL.depth  * LEN_RATIO,
}

export const DEFAULT_OWN_GOAL_5V5: Goal = {
  center: { x: -11.0, y: 0 },
  width:  DEFAULT_OWN_GOAL.width * WID_RATIO,
  depth:  DEFAULT_OWN_GOAL.depth * LEN_RATIO,
}

export const DEFAULT_FIELD_LAYOUT_5V5: FieldLayout = {
  ownPenaltyArea:      { minX: -11.0, maxX: -11.0 + 3.0 * LEN_RATIO, minY: -3.0 * WID_RATIO, maxY: 3.0 * WID_RATIO },
  ownGoalArea:         { minX: -11.0, maxX: -11.0 + 1.0 * LEN_RATIO, minY: -2.0 * WID_RATIO, maxY: 2.0 * WID_RATIO },
  opponentPenaltyArea: { minX:  11.0 - 3.0 * LEN_RATIO, maxX:  11.0, minY: -3.0 * WID_RATIO, maxY: 3.0 * WID_RATIO },
  opponentGoalArea:    { minX:  11.0 - 1.0 * LEN_RATIO, maxX:  11.0, minY: -2.0 * WID_RATIO, maxY: 2.0 * WID_RATIO },
  centreCircleRadius:  1.5 * WID_RATIO,
  penaltyMarkDist:     2.1 * LEN_RATIO,
}

// ----------------------------------------------------------------
// ASSIST STRATEGY — field_type dimensions (mirrors RCAP2026 types.h)
// ----------------------------------------------------------------
// The real robot builds the assist-strategy Field straight from the configured
// game.field_type (brain_config.cpp: FD_KIDSIZE / FD_ADULTSIZE / FD_ROBOLEAGUE
// defined in src/brain/include/types.h). Mirror those exact values here so the
// sim's block slots always land where the robot's do, regardless of how the
// sim's own court/goal are drawn.
export type FieldType = 'kid_size' | 'adult_size' | 'robo_league'

// FieldDimensions layout in types.h:
//   {length, width, penaltyDist, goalWidth, circleRadius,
//    penaltyAreaLength, penaltyAreaWidth, goalAreaLength, goalAreaWidth}
// (brain.cpp:297-303) keeps {length, width, penaltyAreaLength,
// goalAreaLength, goalWidth} for the assist policy.
export const FIELD_TYPE_ASSIST: Record<FieldType, AssistField> = {
  kid_size:    { length: 9,      width: 6,      penaltyAreaLength: 2,     goalAreaLength: 1,      goalWidth: 2.6 },
  adult_size:  { length: 14.16,  width: 9.22,   penaltyAreaLength: 3.24,  goalAreaLength: 1.345,  goalWidth: 2.6 },
  robo_league: { length: 22.003, width: 14.126, penaltyAreaLength: 5.221, goalAreaLength: 2.307,  goalWidth: 2.6 },
}

// Map the sim's game mode onto the C++ game.field_type the robot runs with:
// '3v3' ↔ adult_size (14m RoboLeague), '5v5' ↔ robo_league (22m RoboLeague).
export function assistFieldForGameMode(gameMode: GameMode): AssistField {
  return gameMode === '5v5'
    ? FIELD_TYPE_ASSIST.robo_league
    : FIELD_TYPE_ASSIST.adult_size
}

// Assignment cost weights — matches config.yaml strategy.cooperation.*
export const DEFAULT_ASSIST_PENALTIES = {
  normalSwitch: 4.0,  // assist_slot_switch_penalty
  anchorSwitch: 9.0,  // assist_anchor_switch_penalty (applied to CENTER_SWEEP)
  laneCross:    16.0, // assist_lane_cross_penalty
  pathCross:    9.0,  // assist_path_cross_penalty
} as const

export const DEFAULT_PARAMS: RobotParams = {
  // Aligned to real robot (config.yaml + subtree_striker_play.xml)
  chaseDistance:       0.7,    // StrikerDecide chase_threshold="0.7" — switch to adjust within 0.7m
  chaseSpeed:          1.2,    // Chase vx_limit="1.2" (config.yaml vx_limit=2.0 is the hardware cap)
  tangentialSpeed:     1.2,    // Adjust tangential_speed_far="1.2"
  shootAngle:          0.15,   // ≈ 8.6° (kick_threshold in AdjustForKickoff is 5°, conservative)
  radialSpeedDistance: 0.5,    // Adjust near_threshold="0.5"
  radialSpeedFar:      0.5,    // Adjust vx_limit="0.5" (radial closing speed)
  radialSpeedNear:     0.2,    // Adjust tangential_speed_near="0.2"
  shootingSpeed:       1.5,    // Kick speed_limit="1.5"
  rotationSpeed:       1.2,    // vtheta_limit: 1.2 rad/s
  fieldOfView:         1.571,  // cam_fov_x: 90° = π/2
  // Assist
  assistSpeed:         1.2,   // Support movement — real Assist vx_limit=0.2 is config-tunable; sim uses full speed for a responsive barricade
  // Blocking-slot fractions (RCAP2026 assist_strategy_policy defaults)
  assistNearFraction:   0.35,  // close block spots sit 35% of the way to the ball
  assistFarFraction:    0.60,  // far block spots sit 60% of the way to the ball
  assistCenterFraction: 0.50,  // centre sweep sits 50% of the way to the ball
}

export const DEFAULT_TEAM: TeamConfig = {
  roleSwapDelay:   1.0,
  ourKickoffX:    -2.0,
  ourPrimaryY:     2.0,
  ourSecondaryY:  -1.5,
  theirKickoffX:  -1.53,
  theirPrimaryY:   2.0,
  theirSecondaryY: -1.5,
}

export const DEFAULT_GK_PARAMS: GoalkeeperParams = {
  // Aligned to real robot (subtree_goal_keeper_play.xml + config.yaml)
  chaseThreshold:        1.0,    // GoalieDecide chase_threshold="1.0"
  retreatChaseThreshold: 1.6,    // GoalieDecide retreat_chase_threshold="1.6"
  alignThreshold:        0.035,  // GoalieDecide align_threshold_deg="2.0" → 0.035 rad
  chaseSpeed:            0.6,    // Chase vx_limit="0.6"
  retreatSpeed:          0.8,    // GoToGoalBlockingPosition vx_limit="0.8"
  blockSpeedFar:         0.9,    // AdjustBlock tangential_speed_far="0.9"
  blockSpeedNear:        0.2,    // AdjustBlock tangential_speed_near="0.2"
  blockNearThreshold:    0.8,    // AdjustBlock near_threshold="0.8"
  kickSpeed:             1.5,    // Kick speed_limit="1.5"
  rotationSpeed:         1.2,    // vtheta_limit: 1.2 rad/s
  fieldOfView:           1.571,  // cam_fov_x: 90° = π/2
  goalLineOffset:        0.5,    // GoToGoalBlockingPosition dist_to_goalline="0.5"
  blockRange:            0.6,    // AdjustBlock range="0.6"
}

// Booster T1: 47cm wide × 23cm deep footprint, radius ≈ half-diagonal
const ROBOT_RADIUS = 0.26

// Evenly-spaced, symmetric-about-0 Y positions for N field players.
// n=2 → [0.8, -0.8] (matches the original 3v3 hand-picked spawn spots exactly).
// n=4 → [2.4, 0.8, -0.8, -2.4] (same 1.6m spacing, extended outward for 5v5).
function fieldPlayerYPositions(n: number): number[] {
  const SPACING = 1.6
  const ys: number[] = []
  for (let i = 0; i < n; i++) {
    const offset = i - (n - 1) / 2
    ys.push(-offset * SPACING)
  }
  return ys
}

// Builds one team's starting robots: N field players (first one active/CHASING,
// rest IDLE) + 1 goalkeeper. Positions scale with the field's half-length so
// 3v3 (halfLength=7) reproduces the original hand-placed spawn spots exactly.
export function createTeamRobots(gameMode: GameMode, side: 'ours' | 'enemy'): Robot[] {
  const fieldPlayerCount = gameMode === '5v5' ? 4 : 2
  const halfLength       = gameMode === '5v5' ? 11 : 7
  const xSign            = side === 'ours' ? -1 : 1
  const orientation       = side === 'ours' ? 0 : Math.PI

  const gkOffset = 0.5 * (halfLength / 7)  // preserves the original 0.5m goal-line offset at 3v3 scale
  const gk: Robot = {
    pos:         { x: xSign * (halfLength - gkOffset), y: 0 },
    orientation,
    state:       RobotState.IDLE,
    radius:      ROBOT_RADIUS,
    params:      { ...DEFAULT_PARAMS },
    role:        'goalkeeper',
    gkState:     GoalkeeperState.RETREAT,
    gkParams:    { ...DEFAULT_GK_PARAMS },
    assistSlot:     AssistSlot.NONE,
    assistTarget:   { x: 0, y: 0 },
  }

  const fieldX = xSign * (halfLength / 2)
  const fieldPlayers: Robot[] = fieldPlayerYPositions(fieldPlayerCount).map((y, i) => ({
    pos:         { x: fieldX, y },
    orientation,
    state:       i === 0 ? RobotState.CHASING : RobotState.IDLE,
    radius:      ROBOT_RADIUS,
    params:      { ...DEFAULT_PARAMS },
    role:        'striker' as const,
    gkState:     GoalkeeperState.RETREAT,
    gkParams:    { ...DEFAULT_GK_PARAMS },
    assistSlot:     AssistSlot.NONE,
    assistTarget:   { x: 0, y: 0 },
  }))

  return [...fieldPlayers, gk]
}

export const EMPTY_GK_DEBUG: GoalkeeperDebugData = {
  distanceToBall:    0,
  canSeeBall:        true,
  fovError:          0,
  ballInPenaltyArea: false,
  alignmentError:    0,
  stateHistory:      [],
}

// ----------------------------------------------------------------
// GOALKEEPER PARAMETER PANEL METADATA
// ----------------------------------------------------------------
export interface GKParamMeta {
  key:   keyof GoalkeeperParams
  label: string
  unit:  string
  min:   number
  max:   number
  step:  number
  desc:  string
}

// General GK params (thresholds, speeds, FOV, goal line)
export const GK_PARAM_META: GKParamMeta[] = [
  { key: 'chaseThreshold',        label: 'Chase Threshold',         unit: 'm',     min: 0.1, max: 3,   step: 0.1,  desc: 'chase_threshold="1.0" — ball closer than this → adjust/kick instead of chase' },
  { key: 'retreatChaseThreshold', label: 'Retreat-Chase Threshold', unit: 'm',     min: 0.5, max: 5,   step: 0.1,  desc: 'retreat_chase_threshold="1.6" — ball farther than this inside penalty → stay in goal area instead of chasing' },
  { key: 'alignThreshold',        label: 'Kick Align Tolerance',    unit: 'deg',   min: 0.5, max: 15,  step: 0.5,  desc: 'Max body angle error allowed before kicking' },
  { key: 'chaseSpeed',            label: 'Chase Speed',             unit: 'm/s',   min: 0.1, max: 3,   step: 0.1,  desc: 'Speed while chasing ball (medium range: chaseThreshold–retreatChaseThreshold)' },
  { key: 'retreatSpeed',          label: 'Retreat Speed',           unit: 'm/s',   min: 0.1, max: 3,   step: 0.1,  desc: 'Speed while retreating to goal-line blocking position' },
  { key: 'kickSpeed',             label: 'Kick Speed',              unit: 'm/s',   min: 0.1, max: 5,   step: 0.1,  desc: 'Ball push speed when clearing' },
  { key: 'rotationSpeed',         label: 'Rotation Speed',          unit: 'rad/s', min: 0.5, max: 10,  step: 0.1,  desc: 'Body rotation speed' },
  { key: 'fieldOfView',           label: 'Field of View',           unit: 'deg',   min: 10,  max: 360, step: 1,    desc: 'Vision cone — ball outside triggers FIND_BALL' },
  { key: 'goalLineOffset',        label: 'Goal Line Offset',        unit: 'm',     min: 0.1, max: 2,   step: 0.05, desc: 'dist_to_goalline="0.5" — how far in front of goal line the GK stands during RETREAT' },
]

// ADJUST_BLOCK specific params (orbiting/blocking behaviour)
export const GK_BLOCK_PARAM_META: GKParamMeta[] = [
  { key: 'blockRange',         label: 'Block Range',         unit: 'm',   min: 0.1, max: 2,   step: 0.05, desc: 'range="0.6" — target distance from ball when on the goal→ball line' },
  { key: 'blockNearThreshold', label: 'Near Threshold',      unit: 'm',   min: 0.1, max: 2,   step: 0.1,  desc: 'near_threshold="0.8" — switches far→near block speed' },
  { key: 'blockSpeedFar',      label: 'Block Speed (Far)',   unit: 'm/s', min: 0.1, max: 3,   step: 0.1,  desc: 'tangential_speed_far="0.9" — lateral orbit speed when ball is far' },
  { key: 'blockSpeedNear',     label: 'Block Speed (Near)',  unit: 'm/s', min: 0.1, max: 2,   step: 0.05, desc: 'tangential_speed_near="0.2" — lateral orbit speed when ball is close' },
]

export const DEFAULT_BALL: Ball = {
  pos:      { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  radius:   0.11,
  isStatic: false,
}

export const DEFAULT_OVERLAYS: OverlaySettings = {
  showFOVCone:             true,
  showOrientationArrow:    true,
  showChaseDistanceCircle: true,
  showAlignmentLine:       true,
  showShootAngleCone:      true,
  showTangentVector:       true,
  showRadialVector:        true,
  showBallVelocity:        true,
  showStateLabel:          true,
  showContactRange:        false,
}

export const DEFAULT_GC: GameControllerState = {
  gameState:    'INITIAL',
  kickoffSide:  'ours',
  subStateType: 'NONE',
  subState:     'STOP',
  freeKickType: 'DIRECT',
  freeKickSide: 'ours',
  penalties:    [false, false, false],
  firstHalf:    true,
}

// ----------------------------------------------------------------
// PARAMETER PANEL METADATA
// ----------------------------------------------------------------
export interface ParamMeta {
  key:   keyof RobotParams
  label: string
  unit:  string
  min:   number
  max:   number
  step:  number
  desc:  string
}

export const PARAM_META: ParamMeta[] = [
  { key: 'chaseDistance',       label: 'Chase Distance',        unit: 'm',     min: 0.1, max: 5,   step: 0.05, desc: 'StrikerDecide chase_threshold — switch to adjust when ball is within this distance (real: 0.7m)' },
  { key: 'chaseSpeed',          label: 'Chase Speed',           unit: 'm/s',   min: 0.1, max: 2,   step: 0.1,  desc: 'Chase vx_limit="1.2" — hardware cap is 2.0 m/s' },
  { key: 'tangentialSpeed',     label: 'Tangential Speed',      unit: 'm/s',   min: 0.1, max: 2,   step: 0.05, desc: 'Adjust tangential_speed_far — lateral orbit speed (real: 1.2 m/s, vy_limit: 0.4)' },
  { key: 'shootAngle',          label: 'Shoot Angle Tolerance', unit: 'deg',   min: 1,   max: 30,  step: 0.5,  desc: 'Max body alignment error before kicking (real kick_threshold ≈ 5°)' },
  { key: 'radialSpeedDistance', label: 'Near Threshold',        unit: 'm',     min: 0.1, max: 2,   step: 0.05, desc: 'Adjust near_threshold — switches far→near speed (real: 0.5m)' },
  { key: 'radialSpeedFar',      label: 'Radial Speed (Far)',    unit: 'm/s',   min: 0.1, max: 2,   step: 0.05, desc: 'Closing speed when far — Adjust vx_limit="0.5"' },
  { key: 'radialSpeedNear',     label: 'Radial Speed (Near)',   unit: 'm/s',   min: 0.1, max: 1,   step: 0.05, desc: 'Closing speed when near — Adjust tangential_speed_near="0.2"' },
  { key: 'shootingSpeed',       label: 'Kick Speed',            unit: 'm/s',   min: 0.1, max: 3,   step: 0.1,  desc: 'Forward push speed — Kick speed_limit="1.5"' },
  { key: 'rotationSpeed',       label: 'Rotation Speed',        unit: 'rad/s', min: 0.1, max: 3,   step: 0.05, desc: 'Body rotation rate — real robot vtheta_limit: 1.2 rad/s' },
  { key: 'fieldOfView',         label: 'Field of View',         unit: 'deg',   min: 10,  max: 180, step: 1,    desc: 'Camera FOV — real robot cam_fov_x: 90° — ball outside triggers SEARCHING' },
]

export const ASSIST_PARAM_META: ParamMeta[] = [
  { key: 'assistSpeed',          label: 'Assist Speed',          unit: 'm/s', min: 0.05, max: 2,   step: 0.05, desc: 'Support movement speed — real Assist vx_limit="0.2"; raise it on the robot to match punchy barricade tracking' },
  { key: 'assistNearFraction',   label: 'Close Block Fraction',  unit: 'x',   min: 0.05, max: 0.95, step: 0.05, desc: 'RCAP2026 near_fraction="0.35" — close block spots sit this fraction of the way from goal to ball' },
  { key: 'assistFarFraction',    label: 'Far Block Fraction',    unit: 'x',   min: 0.05, max: 0.95, step: 0.05, desc: 'RCAP2026 far_fraction="0.60" — far block spots sit this fraction of the way from goal to ball' },
  { key: 'assistCenterFraction', label: 'Centre Sweep Fraction', unit: 'x',   min: 0.05, max: 0.95, step: 0.05, desc: 'RCAP2026 center_fraction="0.50" — centre sweep sits this fraction of the way from goal to ball' },
]

export interface TeamParamMeta {
  key:   keyof TeamConfig
  label: string
  unit:  string
  min:   number
  max:   number
  step:  number
  desc:  string
}

export const KICKOFF_PARAM_META: TeamParamMeta[] = [
  { key: 'ourKickoffX',     label: 'Our Kickoff X',        unit: 'm', min: -7,  max: 0,  step: 0.05, desc: 'Striker X position when we kick off (real: -2.0)' },
  { key: 'ourPrimaryY',     label: 'Our Primary Y',        unit: 'm', min: -4,  max: 4,  step: 0.1,  desc: 'Primary striker Y when we kick off (real: +2.0)' },
  { key: 'ourSecondaryY',   label: 'Our Secondary Y',      unit: 'm', min: -4,  max: 4,  step: 0.1,  desc: 'Secondary striker Y when we kick off (real: -1.5)' },
  { key: 'theirKickoffX',   label: 'Their Kickoff X',      unit: 'm', min: -7,  max: 0,  step: 0.05, desc: 'Striker X position when they kick off (real: -1.53)' },
  { key: 'theirPrimaryY',   label: 'Their Primary Y',      unit: 'm', min: -4,  max: 4,  step: 0.1,  desc: 'Primary striker Y when they kick off (real: +2.0)' },
  { key: 'theirSecondaryY', label: 'Their Secondary Y',    unit: 'm', min: -4,  max: 4,  step: 0.1,  desc: 'Secondary striker Y when they kick off (real: -1.5)' },
]
