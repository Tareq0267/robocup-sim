// ================================================================
// ASSIST STRATEGY — ball-to-goal blocking slots
// Direct TypeScript port of Robotedge-5v5-RCAP2026
//   src/brain/include/assist_strategy_policy.h  (commit bf0a463)
//   src/brain/src/brain.cpp  — slotsForAssistCount /
//                              calculateAssistSlotTarget /
//                              calculateAssistAssignments /
//                              estimateAssistWalkingTime
//
// Non-lead strikers are assigned a blocking slot. Each slot's target sits
// on the line between the ball and a goal anchor (left post, right post,
// goal centre) at a configurable fraction of the anchor→ball distance, then
// clamped back onto the legal assist region. The leader picks a permutation
// of slots that minimises walking cost + switch/lane/path penalties.
// ================================================================

import { AssistSlot, type Vec2 } from './types'

export interface AssistField {
  length:           number // field x length (m)
  width:            number // field y width (m)
  penaltyAreaLength: number // depth of the defending penalty area (m)
  goalAreaLength:    number // depth of the defending goal area (m)
  goalWidth:         number // goal mouth width (m)
}

// Pose carries a body orientation (rad) used by walking-time estimation.
export interface Pose {
  x: number
  y: number
  theta: number
}

export interface AssistPenalties {
  normalSwitch: number // ordinary slot-change cost
  anchorSwitch: number // higher cost for leaving/joining the defensive anchor
  laneCross:    number // cost for crossing the leader-to-ball lane
  pathCross:    number // cost when two assist paths intersect
}

// Numeric order matches the C++ enum (NONE=0, BLOCK_LEFT_CLOSE=1, ...).
export function slotIndex(slot: AssistSlot): number {
  switch (slot) {
    case AssistSlot.BLOCK_LEFT_CLOSE:  return 1
    case AssistSlot.BLOCK_RIGHT_CLOSE: return 2
    case AssistSlot.CENTER_SWEEP:      return 3
    case AssistSlot.BLOCK_LEFT_FAR:    return 4
    case AssistSlot.BLOCK_RIGHT_FAR:   return 5
    default:                           return 0
  }
}

export function assistSlotName(slot: AssistSlot): string {
  switch (slot) {
    case AssistSlot.BLOCK_LEFT_CLOSE:  return 'block_left_close'
    case AssistSlot.BLOCK_RIGHT_CLOSE: return 'block_right_close'
    case AssistSlot.CENTER_SWEEP:      return 'center_sweep'
    case AssistSlot.BLOCK_LEFT_FAR:    return 'block_left_far'
    case AssistSlot.BLOCK_RIGHT_FAR:   return 'block_right_far'
    default:                           return 'none'
  }
}

export function isUsableAssistSlot(slot: AssistSlot): boolean {
  return slotIndex(slot) >= 1 && slotIndex(slot) <= 5
}

// Slots activated for a given number of assistants (mirrors brain.cpp).
export function slotsForAssistCount(count: number): AssistSlot[] {
  if (count === 0) return []
  if (count === 1) return [AssistSlot.CENTER_SWEEP]
  if (count === 2) {
    return [AssistSlot.BLOCK_LEFT_CLOSE, AssistSlot.BLOCK_RIGHT_CLOSE]
  }
  if (count === 3) {
    return [
      AssistSlot.BLOCK_LEFT_CLOSE,
      AssistSlot.BLOCK_RIGHT_CLOSE,
      AssistSlot.CENTER_SWEEP,
    ]
  }
  return [
    AssistSlot.BLOCK_LEFT_CLOSE,
    AssistSlot.BLOCK_RIGHT_CLOSE,
    AssistSlot.BLOCK_LEFT_FAR,
    AssistSlot.BLOCK_RIGHT_FAR,
  ]
}

// ----------------------------------------------------------------
// Vector helpers
// ----------------------------------------------------------------
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export function norm(p: Vec2): number {
  return Math.hypot(p.x, p.y)
}

export function normalizedOr(p: Vec2, fallback: Vec2 = { x: 1, y: 0 }): Vec2 {
  const length = norm(p)
  if (length < 1e-9 || !Number.isFinite(length)) return fallback
  return { x: p.x / length, y: p.y / length }
}

function toPInPI(a: number): number {
  while (a >  Math.PI) a -= 2 * Math.PI
  while (a < -Math.PI) a += 2 * Math.PI
  return a
}

// ----------------------------------------------------------------
// Field geometry (mirrors the C++ inline helpers)
// ----------------------------------------------------------------
export function ownGoalCenter(field: AssistField): Vec2 {
  return { x: -field.length / 2, y: 0 }
}

export function leftPost(field: AssistField): Vec2 {
  return { x: -field.length / 2, y: -field.goalWidth / 2 }
}

export function rightPost(field: AssistField): Vec2 {
  return { x: -field.length / 2, y: field.goalWidth / 2 }
}

export function fieldXMin(field: AssistField): number {
  return -field.length / 2 + field.goalAreaLength + 0.3
}

export function fieldXMax(field: AssistField): number {
  return field.length / 2 - field.penaltyAreaLength - 0.3
}

export function fieldYMax(field: AssistField): number {
  return field.width / 2 - 0.7
}

export function clampToAssistField(point: Vec2, field: AssistField): Vec2 {
  return {
    x: clamp(point.x, fieldXMin(field), fieldXMax(field)),
    y: clamp(point.y, -fieldYMax(field), fieldYMax(field)),
  }
}

export function minimumSlotSpacing(field: AssistField): number {
  // 1.5 m on the 22 m RoboLeague field, scaled down conservatively.
  return clamp(1.5 * field.length / 22.0, 0.8, 1.6)
}

// Clamp a point on the ray from `anchor` through `toward` back onto the ray.
// The spot sits at `fraction` of the anchor-to-ball distance; only when that
// point would leave the field is it pulled back along the same ray to the
// nearest boundary (lateral line or the far penalty-area front). Points in
// the near goal area stay where they are; the blocking line between the goal
// and the ball must not collapse onto the goal-area edge.
export function clampOnRay(
  point: Vec2, anchor: Vec2, toward: Vec2, field: AssistField,
): Vec2 {
  const dir = normalizedOr(subVec(toward, anchor))
  const delta = subVec(point, anchor)
  const along = Math.max(
    0.0, delta.x * dir.x + delta.y * dir.y,
  )

  const xMax = fieldXMax(field)
  const yMax = fieldYMax(field)
  let limit = along
  const applyBoundary = (boundary: number, xAxis: boolean) => {
    const b = xAxis ? (boundary - anchor.x) / dir.x
                    : (boundary - anchor.y) / dir.y
    if (Number.isFinite(b) && b >= 0.0 && b < limit) limit = b
  }
  applyBoundary(xMax, true)
  applyBoundary(yMax, false)
  applyBoundary(-yMax, false)
  return addVec(anchor, { x: dir.x * limit, y: dir.y * limit })
}

// Blocking spot on the line between the ball and a goal anchor (post or goal
// center). The spot sits at `fraction` of the anchor-to-ball distance; when
// that fraction point would leave the field it is pulled back along the same
// ray to the nearest field boundary.
export function blockPoint(
  ball: Vec2, anchor: Vec2, fraction: number, field: AssistField,
): Vec2 {
  const safeFraction = Number.isFinite(fraction)
    ? clamp(fraction, 0.0, 1.0)
    : 0.5
  const base = addVec(
    anchor,
    scaleVec(subVec(ball, anchor), safeFraction),
  )
  return clampOnRay(base, anchor, ball, field)
}

export function rawSlotTarget(
  slot: AssistSlot, ball: Vec2,
  nearFraction: number, farFraction: number, centerFraction: number,
  field: AssistField,
): Vec2 {
  switch (slot) {
    case AssistSlot.BLOCK_LEFT_CLOSE:
      return blockPoint(ball, leftPost(field), nearFraction, field)
    case AssistSlot.BLOCK_RIGHT_CLOSE:
      return blockPoint(ball, rightPost(field), nearFraction, field)
    case AssistSlot.BLOCK_LEFT_FAR:
      return blockPoint(ball, leftPost(field), farFraction, field)
    case AssistSlot.BLOCK_RIGHT_FAR:
      return blockPoint(ball, rightPost(field), farFraction, field)
    case AssistSlot.CENTER_SWEEP:
    default:
      return blockPoint(
        ball, ownGoalCenter(field), centerFraction, field,
      )
  }
}

function clearsPlacedTargets(
  candidate: Vec2, placed: Vec2[], placedCount: number, spacing: number,
): boolean {
  for (let i = 0; i < placedCount; i++) {
    if (norm(subVec(candidate, placed[i])) + 1e-6 < spacing) return false
  }
  return true
}

export function nearestSeparatedTarget(
  desired: Vec2, placed: Vec2[], placedCount: number,
  spacing: number, field: AssistField,
): Vec2 {
  const clampedDesired = clampToAssistField(desired, field)
  if (clearsPlacedTargets(clampedDesired, placed, placedCount, spacing)) {
    return clampedDesired
  }

  let best = clampedDesired
  let bestScore = Infinity
  const consider = (candidateIn: Vec2) => {
    const candidate = clampToAssistField(candidateIn, field)
    if (!clearsPlacedTargets(candidate, placed, placedCount, spacing)) return
    const score = norm(subVec(candidate, clampedDesired))
    if (score + 1e-9 < bestScore) {
      best = candidate
      bestScore = score
    }
  }

  const angleSamples = 64
  const radialStep = spacing / 8.0
  for (let radius = radialStep; radius <= spacing * 4.0 + 1e-9; radius += radialStep) {
    for (let i = 0; i < angleSamples; i++) {
      const angle = 2.0 * Math.PI * i / angleSamples
      consider({
        x: clampedDesired.x + radius * Math.cos(angle),
        y: clampedDesired.y + radius * Math.sin(angle),
      })
    }
    if (Number.isFinite(bestScore)) break
  }

  if (Number.isFinite(bestScore)) return best

  // Bounded deterministic fallback for overlapping circles near a boundary.
  const xMin = fieldXMin(field)
  const xMax = fieldXMax(field)
  const yMax = fieldYMax(field)
  const gridStep = spacing / 2.0
  for (let x = xMin; x <= xMax + 1e-9; x += gridStep) {
    for (let y = -yMax; y <= yMax + 1e-9; y += gridStep) {
      consider({ x, y })
    }
  }
  return best
}

export function calculateTargets(
  assistCount: number, ball: Vec2,
  nearFraction: number, farFraction: number, centerFraction: number,
  field: AssistField,
): Record<AssistSlot, Vec2> {
  const targets = {} as Record<AssistSlot, Vec2>
  targets[AssistSlot.BLOCK_LEFT_CLOSE] = rawSlotTarget(
    AssistSlot.BLOCK_LEFT_CLOSE, ball, nearFraction, farFraction, centerFraction, field)
  targets[AssistSlot.BLOCK_RIGHT_CLOSE] = rawSlotTarget(
    AssistSlot.BLOCK_RIGHT_CLOSE, ball, nearFraction, farFraction, centerFraction, field)
  targets[AssistSlot.CENTER_SWEEP] = rawSlotTarget(
    AssistSlot.CENTER_SWEEP, ball, nearFraction, farFraction, centerFraction, field)
  targets[AssistSlot.BLOCK_LEFT_FAR] = rawSlotTarget(
    AssistSlot.BLOCK_LEFT_FAR, ball, nearFraction, farFraction, centerFraction, field)
  targets[AssistSlot.BLOCK_RIGHT_FAR] = rawSlotTarget(
    AssistSlot.BLOCK_RIGHT_FAR, ball, nearFraction, farFraction, centerFraction, field)

  if (assistCount === 0) return targets

  const placed: Vec2[] = []
  const spacing = minimumSlotSpacing(field)
  const place = (slot: AssistSlot) => {
    targets[slot] = nearestSeparatedTarget(
      targets[slot], placed, placed.length, spacing, field,
    )
    placed.push(targets[slot])
  }

  if (assistCount >= 4) {
    place(AssistSlot.BLOCK_LEFT_FAR)
    place(AssistSlot.BLOCK_RIGHT_FAR)
  }
  if (assistCount >= 3) place(AssistSlot.CENTER_SWEEP)
  if (assistCount >= 2) {
    place(AssistSlot.BLOCK_LEFT_CLOSE)
    place(AssistSlot.BLOCK_RIGHT_CLOSE)
  } else {
    place(AssistSlot.CENTER_SWEEP)
  }
  return targets
}

// ----------------------------------------------------------------
// Traffic / yield policy (mirrors the C++ helpers)
// ----------------------------------------------------------------
export function yieldTimeoutMsecs(
  routeDistance: number, maxSpeed: number, configuredTimeoutMsecs: number,
): number {
  const safeSpeed = Math.max(maxSpeed, 0.05)
  const travelMsecs = Math.max(routeDistance, 0.0) / safeSpeed * 1000.0
  return Math.max(configuredTimeoutMsecs, travelMsecs + 1000.0)
}

export function trafficPriority(slot: AssistSlot, yielding: boolean): number {
  if (yielding) return 0
  switch (slot) {
    case AssistSlot.BLOCK_LEFT_FAR:  return 4
    case AssistSlot.BLOCK_RIGHT_FAR: return 4
    case AssistSlot.BLOCK_LEFT_CLOSE:  return 3
    case AssistSlot.BLOCK_RIGHT_CLOSE: return 3
    case AssistSlot.CENTER_SWEEP: return 2
    default: return -1
  }
}

export function teammateHasRightOfWay(
  mySlot: AssistSlot, myYielding: boolean, myId: number,
  teammateSlot: AssistSlot, teammateYielding: boolean, teammateId: number,
): boolean {
  const myPriority = trafficPriority(mySlot, myYielding)
  const teammatePriority = trafficPriority(teammateSlot, teammateYielding)
  if (teammatePriority < 0) return false
  return teammatePriority > myPriority ||
         (teammatePriority === myPriority && teammateId < myId)
}

// ----------------------------------------------------------------
// Assignment — which assistant takes which blocking slot
// ----------------------------------------------------------------
export function calculateAssistSlotTarget(
  slot: AssistSlot, ball: Vec2, assistCount: number,
  nearFraction: number, farFraction: number, centerFraction: number,
  field: AssistField,
): Pose {
  const targets = calculateTargets(
    assistCount, ball, nearFraction, farFraction, centerFraction, field,
  )
  const target = targets[slot]
  return {
    x: target.x,
    y: target.y,
    theta: Math.atan2(ball.y - target.y, ball.x - target.x),
  }
}

export function estimateAssistWalkingTime(robot: Pose, target: Pose): number {
  const dxField = target.x - robot.x
  const dyField = target.y - robot.y
  const dx = Math.cos(robot.theta) * dxField +
             Math.sin(robot.theta) * dyField
  const dy = -Math.sin(robot.theta) * dxField +
              Math.cos(robot.theta) * dyField
  const deltaAngle = toPInPI(target.theta - robot.theta)

  const FORWARD_SPEED = 1.0
  const BACKWARD_SPEED = 0.25
  const STRAFE_SPEED = 0.6
  const TURN_SPEED = 1.5
  const longitudinalTime = dx >= 0.0
    ? dx / FORWARD_SPEED
    : -dx / BACKWARD_SPEED
  const omniTime = Math.sqrt(
    longitudinalTime * longitudinalTime +
    Math.pow(dy / STRAFE_SPEED, 2.0) +
    Math.pow(deltaAngle / TURN_SPEED, 2.0),
  )

  const travelDirection = Math.atan2(dy, dx)
  const distance = Math.hypot(dx, dy)
  const turnWalkTurnTime =
    Math.abs(travelDirection) / TURN_SPEED +
    distance / FORWARD_SPEED +
    Math.abs(toPInPI(deltaAngle - travelDirection)) / TURN_SPEED
  const blend = clamp((distance - 0.4) / 0.4, 0.0, 1.0)
  return omniTime * (1.0 - blend) + turnWalkTurnTime * blend
}

// Segment helpers used by the assignment cost function
function orientation(a0: Vec2, a1: Vec2, b: Vec2): number {
  return (a1.x - a0.x) * (b.y - a0.y) - (a1.y - a0.y) * (b.x - a0.x)
}

function pointSegmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = subVec(b, a)
  const ap = subVec(p, a)
  const l2 = ab.x * ab.x + ab.y * ab.y
  if (l2 < 1e-12) return norm(ap)
  const t = clamp((ap.x * ab.x + ap.y * ab.y) / l2, 0.0, 1.0)
  const proj = addVec(a, scaleVec(ab, t))
  return norm(subVec(p, proj))
}

function segmentsIntersect(a0: Vec2, a1: Vec2, b0: Vec2, b1: Vec2): boolean {
  const o1 = orientation(a0, a1, b0)
  const o2 = orientation(a0, a1, b1)
  const o3 = orientation(b0, b1, a0)
  const o4 = orientation(b0, b1, a1)
  if (o1 !== o2 && o3 !== o4) return true
  if (o1 === 0 && pointSegmentDistance(b0, a0, a1) < 1e-6) return true
  if (o2 === 0 && pointSegmentDistance(b1, a0, a1) < 1e-6) return true
  if (o3 === 0 && pointSegmentDistance(a0, b0, b1) < 1e-6) return true
  if (o4 === 0 && pointSegmentDistance(a1, b0, b1) < 1e-6) return true
  return false
}

export function segmentDistance(a0: Vec2, a1: Vec2, b0: Vec2, b1: Vec2): number {
  if (segmentsIntersect(a0, a1, b0, b1)) return 0.0
  return Math.min(
    pointSegmentDistance(a0, b0, b1),
    pointSegmentDistance(a1, b0, b1),
    pointSegmentDistance(b0, a0, a1),
    pointSegmentDistance(b1, a0, a1),
  )
}

function nextPermutation<T>(arr: T[], less: (a: T, b: T) => boolean): boolean {
  let i = arr.length - 2
  while (i >= 0 && !less(arr[i], arr[i + 1])) i--
  if (i < 0) return false
  let j = arr.length - 1
  while (!less(arr[i], arr[j])) j--
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  let lo = i + 1
  let hi = arr.length - 1
  while (lo < hi) {
    ;[arr[lo], arr[hi]] = [arr[hi], arr[lo]]
    lo++
    hi--
  }
  return true
}

// Leader-driven slot assignment. `assistantIds` are robot indices (0-based,
// matching SimState.robots[]). `poses` / `previousAssignments` are keyed by
// the same indices.
export function calculateAssistAssignments(
  assistantIds: number[],
  previousAssignments: Record<number, AssistSlot>,
  previousOwnerId: number,
  newOwnerId: number,
  poses: Record<number, Pose>,
  ball: Vec2,
  leaderPose: Pose,
  leaderKickDir: number,
  nearFraction: number,
  farFraction: number,
  centerFraction: number,
  field: AssistField,
  penalties: AssistPenalties,
): Record<number, AssistSlot> {
  const result: Record<number, AssistSlot> = {}
  if (assistantIds.length === 0) return result

  const desiredSlots = slotsForAssistCount(assistantIds.length)
  let assignedIds = [...assistantIds]
  if (assignedIds.length > desiredSlots.length) {
    assignedIds = assignedIds.slice(0, desiredSlots.length)
  }

  const byIndexLess = (lhs: AssistSlot, rhs: AssistSlot) =>
    slotIndex(lhs) < slotIndex(rhs)
  const byIndexNum = (lhs: AssistSlot, rhs: AssistSlot) =>
    slotIndex(lhs) - slotIndex(rhs)
  const permutation = [...desiredSlots].sort(byIndexNum)

  const inheritedSlot =
    newOwnerId in previousAssignments
      ? previousAssignments[newOwnerId]
      : AssistSlot.NONE

  const ballPoint: Vec2 = { x: ball.x, y: ball.y }
  const leaderPoint: Vec2 = { x: leaderPose.x, y: leaderPose.y }
  const kickEnd: Vec2 = {
    x: ball.x + 4.5 * Math.cos(leaderKickDir),
    y: ball.y + 4.5 * Math.sin(leaderKickDir),
  }

  let bestCost = Infinity
  let bestPermutation = [...permutation]

  do {
    let totalCost = 0.0
    const targets: Pose[] = []
    for (let i = 0; i < assignedIds.length; i++) {
      const playerId = assignedIds[i]
      const slot = permutation[i]
      const target = calculateAssistSlotTarget(
        slot, ball, assistantIds.length,
        nearFraction, farFraction, centerFraction, field,
      )
      targets.push(target)
      const walkingTime = estimateAssistWalkingTime(poses[playerId], target)
      totalCost += walkingTime * walkingTime

      const previous = previousAssignments[playerId] ?? AssistSlot.NONE
      if (isUsableAssistSlot(previous) && previous !== slot) {
        const previousStillExists = desiredSlots.includes(previous)
        totalCost += previousStillExists
          ? 1000.0
          : penalties.normalSwitch
        // CENTER_SWEEP is the current defensive anchor slot.
        if (previous === AssistSlot.CENTER_SWEEP ||
            slot === AssistSlot.CENTER_SWEEP) {
          totalCost += penalties.anchorSwitch
        }
      }
      if (playerId === previousOwnerId && isUsableAssistSlot(inheritedSlot) &&
          slot !== inheritedSlot) {
        totalCost += 2000.0
      }

      const start: Vec2 = { x: poses[playerId].x, y: poses[playerId].y }
      const end: Vec2 = { x: target.x, y: target.y }
      if (segmentDistance(start, end, leaderPoint, ballPoint) < 0.9 ||
          segmentDistance(start, end, ballPoint, kickEnd) < 0.85 ||
          pointSegmentDistance(ballPoint, start, end) < 1.3) {
        totalCost += penalties.laneCross
      }
    }

    for (let i = 0; i < assignedIds.length; i++) {
      const startI: Vec2 = { x: poses[assignedIds[i]].x, y: poses[assignedIds[i]].y }
      const endI: Vec2 = { x: targets[i].x, y: targets[i].y }
      for (let j = i + 1; j < assignedIds.length; j++) {
        const startJ: Vec2 = { x: poses[assignedIds[j]].x, y: poses[assignedIds[j]].y }
        const endJ: Vec2 = { x: targets[j].x, y: targets[j].y }
        if (segmentDistance(startI, endI, startJ, endJ) < 0.7) {
          totalCost += penalties.pathCross
        }
      }
    }

    if (totalCost + 1e-6 < bestCost) {
      bestCost = totalCost
      bestPermutation = [...permutation]
    }
  } while (nextPermutation(permutation, byIndexLess))

  for (let i = 0; i < assignedIds.length; i++) {
    result[assignedIds[i]] = bestPermutation[i]
  }
  return result
}

// ----------------------------------------------------------------
// Tiny local vector helpers (kept private to this module)
// ----------------------------------------------------------------
function subVec(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y }
}

function addVec(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y }
}

function scaleVec(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s }
}
