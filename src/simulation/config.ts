// ================================================================
// DEFAULT VALUES — change these to set starting conditions
// ================================================================
import { RobotState, GoalkeeperState, type Robot, type Ball, type Goal, type Court, type OverlaySettings, type RobotParams, type TeamConfig, type FieldLayout, type GoalkeeperParams, type GoalkeeperRobot, type GoalkeeperDebugData } from './types'

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
  chaseDistance:       2.5,
  chaseSpeed:          3.0,
  tangentialSpeed:     2.0,
  shootAngle:          0.15,   // ≈ 8.6°
  radialSpeedDistance: 1.0,
  radialSpeedFar:      2.5,
  radialSpeedNear:     1.0,
  shootingSpeed:       4.0,
  rotationSpeed:       4.0,
  fieldOfView:         2.094,  // 120° = 2π/3
}

// Booster T1: 47cm wide × 23cm deep footprint, radius ≈ half-diagonal
export const DEFAULT_ROBOT_1: Robot = {
  pos:         { x: -3.5, y:  0.8 },
  orientation: 0,
  state:       RobotState.CHASING,
  radius:      0.26,
  params:      { ...DEFAULT_PARAMS },
}

export const DEFAULT_ROBOT_2: Robot = {
  pos:         { x: -3.5, y: -0.8 },
  orientation: 0,
  state:       RobotState.IDLE,
  radius:      0.26,
  params:      { ...DEFAULT_PARAMS },
}

export const DEFAULT_TEAM: TeamConfig = {
  roleSwapDelay: 1.0,  // seconds
}

export const DEFAULT_GK_PARAMS: GoalkeeperParams = {
  chaseThreshold:        1.0,
  retreatChaseThreshold: 2.0,
  alignThreshold:        0.035,  // ≈ 2°
  chaseSpeed:            0.6,
  retreatSpeed:          0.8,
  blockSpeedFar:         0.9,
  blockSpeedNear:        0.2,
  blockNearThreshold:    0.8,
  kickSpeed:             1.5,
  rotationSpeed:         4.0,
  fieldOfView:           2.094,  // 120°
  goalLineOffset:        0.5,
  blockRange:            0.6,
}

export const DEFAULT_GOALKEEPER: GoalkeeperRobot = {
  pos:         { x: -6.5, y: 0 },
  orientation: 0,
  state:       GoalkeeperState.RETREAT,
  radius:      0.26,
  params:      { ...DEFAULT_GK_PARAMS },
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

export const GK_PARAM_META: GKParamMeta[] = [
  { key: 'chaseThreshold',        label: 'Chase Threshold',         unit: 'm',     min: 0.1, max: 3,   step: 0.1,  desc: 'Switch from chase to block when ball is within this distance' },
  { key: 'retreatChaseThreshold', label: 'Retreat-Chase Threshold', unit: 'm',     min: 0.5, max: 5,   step: 0.1,  desc: 'Retreat first if ball is deeper than this in penalty area' },
  { key: 'alignThreshold',        label: 'Kick Align Tolerance',    unit: 'deg',   min: 0.5, max: 15,  step: 0.5,  desc: 'Max body angle error allowed before kicking' },
  { key: 'chaseSpeed',            label: 'Chase Speed',             unit: 'm/s',   min: 0.1, max: 3,   step: 0.1,  desc: 'Speed while chasing ball' },
  { key: 'retreatSpeed',          label: 'Retreat Speed',           unit: 'm/s',   min: 0.1, max: 3,   step: 0.1,  desc: 'Speed while retreating to goal line' },
  { key: 'blockSpeedFar',         label: 'Block Speed (Far)',       unit: 'm/s',   min: 0.1, max: 3,   step: 0.1,  desc: 'Tangential blocking speed when ball is far' },
  { key: 'blockSpeedNear',        label: 'Block Speed (Near)',      unit: 'm/s',   min: 0.1, max: 2,   step: 0.05, desc: 'Tangential blocking speed when ball is close' },
  { key: 'blockNearThreshold',    label: 'Block Near Threshold',    unit: 'm',     min: 0.1, max: 2,   step: 0.1,  desc: 'Distance that switches far→near block speed' },
  { key: 'kickSpeed',             label: 'Kick Speed',              unit: 'm/s',   min: 0.1, max: 5,   step: 0.1,  desc: 'Ball push speed when clearing' },
  { key: 'rotationSpeed',         label: 'Rotation Speed',          unit: 'rad/s', min: 0.5, max: 10,  step: 0.1,  desc: 'Body rotation speed' },
  { key: 'fieldOfView',           label: 'Field of View',           unit: 'deg',   min: 10,  max: 360, step: 1,    desc: 'Vision cone — ball outside triggers FIND_BALL' },
  { key: 'goalLineOffset',        label: 'Goal Line Offset',        unit: 'm',     min: 0.1, max: 2,   step: 0.05, desc: 'How far in front of goal line the GK stands' },
  { key: 'blockRange',            label: 'Block Range',             unit: 'm',     min: 0.1, max: 2,   step: 0.05, desc: 'Target distance from ball when blocking' },
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
  { key: 'chaseDistance',       label: 'Chase Distance',        unit: 'm',     min: 0.5, max: 6,   step: 0.1,  desc: 'Ball farther than this → robot runs straight to it' },
  { key: 'chaseSpeed',          label: 'Chase Speed',           unit: 'm/s',   min: 0.5, max: 8,   step: 0.1,  desc: 'Movement speed while chasing' },
  { key: 'tangentialSpeed',     label: 'Tangential Speed',      unit: 'm/s',   min: 0.1, max: 6,   step: 0.1,  desc: 'Orbital speed while repositioning behind the ball' },
  { key: 'shootAngle',          label: 'Shoot Angle Tolerance', unit: 'deg',   min: 1,   max: 45,  step: 0.5,  desc: 'Max alignment error to be considered in shooting position' },
  { key: 'radialSpeedDistance', label: 'Radial Speed Threshold',unit: 'm',     min: 0.1, max: 3,   step: 0.1,  desc: 'Distance threshold: switches far→near radial speed' },
  { key: 'radialSpeedFar',      label: 'Radial Speed (Far)',    unit: 'm/s',   min: 0.1, max: 6,   step: 0.1,  desc: 'Closing speed when dist > threshold' },
  { key: 'radialSpeedNear',     label: 'Radial Speed (Near)',   unit: 'm/s',   min: 0.1, max: 4,   step: 0.05, desc: 'Closing speed when dist ≤ threshold (precision)' },
  { key: 'shootingSpeed',       label: 'Shooting Speed',        unit: 'm/s',   min: 0.5, max: 10,  step: 0.1,  desc: 'Forward push speed when shooting' },
  { key: 'rotationSpeed',       label: 'Rotation Speed',        unit: 'rad/s', min: 0.5, max: 10,  step: 0.1,  desc: 'How fast robot rotates to face target' },
  { key: 'fieldOfView',         label: 'Field of View',         unit: 'deg',   min: 10,  max: 360, step: 1,    desc: 'Vision cone — ball outside this triggers SEARCHING' },
]
