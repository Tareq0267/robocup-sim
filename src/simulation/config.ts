// ================================================================
// DEFAULT VALUES — change these to set starting conditions
// ================================================================
import { RobotState, GoalkeeperState, type Robot, type Ball, type Goal, type Court, type OverlaySettings, type RobotParams, type TeamConfig, type FieldLayout, type GoalkeeperParams, type GoalkeeperDebugData } from './types'

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
  assistSpeed:          0.2,   // Assist vx_limit="0.2"
  assistBackDist:       2.0,   // dist_to_goalline offset — place target 2m behind ball
  assistDistToGoalLine: 2.5,   // dist_to_goalline="2.5" — min clearance from own goal line
}

export const DEFAULT_TEAM: TeamConfig = {
  roleSwapDelay: 1.0,  // seconds
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
export const DEFAULT_ROBOT_1: Robot = {
  pos:         { x: -3.5, y:  0.8 },
  orientation: 0,
  state:       RobotState.CHASING,
  radius:      0.26,
  params:      { ...DEFAULT_PARAMS },
  role:        'striker',
  gkState:     GoalkeeperState.RETREAT,
  gkParams:    { ...DEFAULT_GK_PARAMS },
}

export const DEFAULT_ROBOT_2: Robot = {
  pos:         { x: -3.5, y: -0.8 },
  orientation: 0,
  state:       RobotState.IDLE,
  radius:      0.26,
  params:      { ...DEFAULT_PARAMS },
  role:        'striker',
  gkState:     GoalkeeperState.RETREAT,
  gkParams:    { ...DEFAULT_GK_PARAMS },
}

// Robot that starts as goalkeeper (can swap to striker via role switch)
export const DEFAULT_ROBOT_GK: Robot = {
  pos:         { x: -6.5, y: 0 },
  orientation: 0,
  state:       RobotState.IDLE,
  radius:      0.26,
  params:      { ...DEFAULT_PARAMS },
  role:        'goalkeeper',
  gkState:     GoalkeeperState.RETREAT,
  gkParams:    { ...DEFAULT_GK_PARAMS },
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
  { key: 'assistSpeed',          label: 'Assist Speed',          unit: 'm/s', min: 0.05, max: 1.5, step: 0.05, desc: 'Assist vx_limit="0.2" — speed while moving to support position' },
  { key: 'assistBackDist',       label: 'Back Distance',         unit: 'm',   min: 0.5,  max: 6,   step: 0.1,  desc: 'Place assist target this far behind the ball along the goal→ball line (default: 2.0m)' },
  { key: 'assistDistToGoalLine', label: 'Goal Line Clearance',   unit: 'm',   min: 0.5,  max: 6,   step: 0.1,  desc: 'Assist dist_to_goalline="2.5" — minimum clearance between assist target and own goal line' },
]
