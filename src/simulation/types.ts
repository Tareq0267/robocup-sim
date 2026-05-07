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
//   ASSIST           — ball visible, move to support position 2m behind ball
// ----------------------------------------------------------------
export const RobotState = {
  SEARCHING:     'SEARCHING',
  IDLE:          'IDLE',
  ASSIST:        'ASSIST',
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

export type TeamRole = 'striker' | 'goalkeeper'

export interface Robot {
  pos:         Vec2
  orientation: number      // (rad) 0=right, π/2=up
  state:       RobotState  // striker-role state (frozen when role==='goalkeeper')
  radius:      number      // (m)
  params:      RobotParams // striker-role parameters
  role:        TeamRole    // current active role
  gkState:     GoalkeeperState   // goalkeeper-role state (active when role==='goalkeeper')
  gkParams:    GoalkeeperParams  // goalkeeper-role parameters
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
// GOALKEEPER — separate types so GK logic never bleeds into striker
// ----------------------------------------------------------------
export const GoalkeeperState = {
  FIND_BALL:    'FIND_BALL',
  RETREAT:      'RETREAT',
  ADJUST_BLOCK: 'ADJUST_BLOCK',
  CHASE:        'CHASE',
  KICK:         'KICK',
} as const
export type GoalkeeperState = typeof GoalkeeperState[keyof typeof GoalkeeperState]

export interface GoalkeeperParams {
  // GoalieDecide thresholds
  chaseThreshold:        number  // (m)   stop chasing below this, switch to block
  retreatChaseThreshold: number  // (m)   retreat first if ball is deeper than this in penalty area
  alignThreshold:        number  // (rad) body must be within this to kick

  // Movement
  chaseSpeed:     number  // (m/s)   speed while chasing ball
  retreatSpeed:   number  // (m/s)   speed while retreating to goal line
  blockSpeedFar:  number  // (m/s)   tangential speed far from ball
  blockSpeedNear: number  // (m/s)   tangential speed near ball
  blockNearThreshold: number  // (m) distance at which blockSpeed switches far→near
  kickSpeed:      number  // (m/s)   push speed when kicking
  rotationSpeed:  number  // (rad/s) body rotation speed
  fieldOfView:    number  // (rad)   vision cone

  // Positioning
  goalLineOffset: number  // (m) stand this far in front of goal line
  blockRange:     number  // (m) maintain this distance from ball when blocking
}

export interface GoalkeeperRobot {
  pos:         Vec2
  orientation: number
  state:       GoalkeeperState
  radius:      number
  params:      GoalkeeperParams
}

export interface GoalkeeperDebugData {
  distanceToBall:    number
  canSeeBall:        boolean
  fovError:          number
  ballInPenaltyArea: boolean
  alignmentError:    number
  stateHistory:      StateTransition[]
}

// ----------------------------------------------------------------
// DEBUG
// ----------------------------------------------------------------
export interface StateTransition {
  time:   number
  from:   string   // string to accommodate both RobotState and GoalkeeperState names
  to:     string
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
  robots:          [Robot, Robot, Robot]  // exactly one has role==='goalkeeper'
  activeIndex:     number                 // index of lead striker (role==='striker', closest to ball)
  swapTimer:       number                 // striker lead-swap hysteresis timer
  gkSwapCooldown:  number                 // seconds remaining before next GK role swap is allowed
  team:            TeamConfig
  ball:            Ball
  goal:            Goal            // opponent's goal (right side) — robots shoot at this
  ownGoal:         Goal            // our goal (left side) — goalkeeper defends this
  fieldLayout:     FieldLayout
  court:           Court
  time:            number
  isPlaying:       boolean
  speed:           number
  score:           { ours: number; theirs: number }
  debugs:          [DebugData, DebugData, DebugData]  // index matches robots[]
  goalkeeperDebug: GoalkeeperDebugData                // GK-specific debug for the current GK robot
  overlays:        OverlaySettings
}
