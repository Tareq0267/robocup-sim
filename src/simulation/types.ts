// ================================================================
// ALL DATA TYPES USED IN THE SIMULATION
// ================================================================

export interface Vec2 { x: number; y: number }

// ----------------------------------------------------------------
// ROBOT STATE MACHINE
// Active robot priority order (0 = highest):
//   0. SEARCHING     — ball outside FOV, spin until visible
//   1. CHASING       — ball visible and far, run straight to it
//   2. REPOSITIONING — ball close, orbit to get behind it
//   3. RADIAL_ADJUST — aligned, close the gap to contact range
//   4. READY         — in position, body still rotating
//   5. SHOOTING      — position + orientation aligned, push ball
//
// Inactive robot:
//   SEARCHING        — ball outside FOV, spin
//   IDLE             — ball visible, hold position and face ball
// ----------------------------------------------------------------
export const RobotState = {
  SEARCHING:     'SEARCHING',
  IDLE:          'IDLE',
  CHASING:       'CHASING',
  REPOSITIONING: 'REPOSITIONING',
  RADIAL_ADJUST: 'RADIAL_ADJUST',
  READY:         'READY',
  SHOOTING:      'SHOOTING',
} as const
export type RobotState = typeof RobotState[keyof typeof RobotState]

// ----------------------------------------------------------------
// ROBOT PARAMETERS — shared between both robots, tunable in UI
// ----------------------------------------------------------------
export interface RobotParams {
  chaseDistance:       number  // (m)     Ball farther than this → CHASING
  chaseSpeed:          number  // (m/s)   Speed while chasing
  tangentialSpeed:     number  // (m/s)   Orbital speed while repositioning
  shootAngle:          number  // (rad)   Max alignment error to be considered aligned
  radialSpeedDistance: number  // (m)     Threshold: switch far→near radial speed
  radialSpeedFar:      number  // (m/s)   Closing speed when far
  radialSpeedNear:     number  // (m/s)   Closing speed when near (precision)
  shootingSpeed:       number  // (m/s)   Forward push speed
  rotationSpeed:       number  // (rad/s) How fast robot rotates to face target
  fieldOfView:         number  // (rad)   Total FOV angle (120° default)
}

// ----------------------------------------------------------------
// TEAM CONFIG — coordination settings between robots
// ----------------------------------------------------------------
export interface TeamConfig {
  roleSwapDelay: number  // (s) How long the closer robot must stay closer before roles swap
                         //     Resets to 0 if distances flip back before delay completes
}

export interface Robot {
  pos:         Vec2
  orientation: number      // (rad) 0=right, π/2=up
  state:       RobotState
  radius:      number      // (m)
  params:      RobotParams
}

export interface Ball {
  pos:      Vec2
  velocity: Vec2
  radius:   number
  isStatic: boolean
}

export interface Goal {
  center: Vec2
  width:  number
  depth:  number
}

export interface Court {
  width:  number
  height: number
}

// Axis-aligned rectangular zone on the field (sim coords)
export interface FieldZone {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface FieldLayout {
  ownPenaltyArea:      FieldZone  // J=3m deep, K=6m wide (Adult Size)
  ownGoalArea:         FieldZone  // E=1m deep, F=4m wide (Adult Size)
  opponentPenaltyArea: FieldZone
  opponentGoalArea:    FieldZone
  centreCircleRadius:  number     // H/2 = 1.5m (Adult Size)
  penaltyMarkDist:     number     // G = 2.1m from goal line (Adult Size)
}

// ----------------------------------------------------------------
// DEBUG
// ----------------------------------------------------------------
export interface StateTransition {
  time:   number
  from:   RobotState
  to:     RobotState
  reason: string
}

export interface DebugData {
  distanceToBall:       number
  alignmentError:       number   // (rad) positional
  orientationError:     number   // (rad) body rotation
  fovError:             number   // (rad) angle from orientation to ball
  canSeeBall:           boolean
  isAligned:            boolean
  isOnCorrectSide:      boolean
  isAtShootDistance:    boolean
  isOrientationAligned: boolean
  tangentialDir:        Vec2 | null
  radialDir:            Vec2 | null
  targetOrientation:    number | null
  stateHistory:         StateTransition[]
}

// ----------------------------------------------------------------
// OVERLAY TOGGLES
// ----------------------------------------------------------------
export interface OverlaySettings {
  showFOVCone:             boolean
  showOrientationArrow:    boolean
  showChaseDistanceCircle: boolean
  showAlignmentLine:       boolean
  showShootAngleCone:      boolean
  showTangentVector:       boolean
  showRadialVector:        boolean
  showBallVelocity:        boolean
  showStateLabel:          boolean
  showContactRange:        boolean
}

// ----------------------------------------------------------------
// FULL SIMULATION STATE
// ----------------------------------------------------------------
export interface SimState {
  robots:      [Robot, Robot]
  activeIndex: number          // 0 or 1 — which robot is currently active
  swapTimer:   number          // seconds the wrong robot has been closer (hysteresis)
  team:        TeamConfig
  ball:        Ball
  goal:        Goal            // opponent's goal (right side) — robots shoot at this
  ownGoal:     Goal            // our goal (left side) — goalkeeper defends this
  fieldLayout: FieldLayout
  court:       Court
  time:        number
  isPlaying:   boolean
  speed:       number
  debugs:      [DebugData, DebugData]
  overlays:    OverlaySettings
}
