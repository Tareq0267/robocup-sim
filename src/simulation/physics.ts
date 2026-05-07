// ================================================================
// BALL PHYSICS
// ================================================================

import type { Ball, Robot, Court, Vec2 } from './types'
import { add, scale, sub, len, normalize, dist } from './math'

// Separate two overlapping circles — returns corrected positions (generic, works for any robot type)
export function separateCircles(
  posA: Vec2, radA: number,
  posB: Vec2, radB: number,
  court: Court,
): [Vec2, Vec2] {
  const d       = dist(posA, posB)
  const minDist = radA + radB
  if (d >= minDist) return [posA, posB]

  const dir  = d < 1e-9 ? { x: 1, y: 0 } : normalize(sub(posB, posA))
  const push = (minDist - d) / 2 + 0.001

  const clamp = (pos: Vec2, rad: number): Vec2 => {
    const hw = court.width  / 2 - rad
    const hh = court.height / 2 - rad
    return {
      x: Math.max(-hw, Math.min(hw, pos.x)),
      y: Math.max(-hh, Math.min(hh, pos.y)),
    }
  }

  return [
    clamp(sub(posA, scale(dir, push)), radA),
    clamp(add(posB, scale(dir, push)), radB),
  ]
}

// Separate two overlapping robots — splits overlap equally, re-clamps to court
export function resolveRobotCollision(a: Robot, b: Robot, court: Court): [Robot, Robot] {
  const [posA, posB] = separateCircles(a.pos, a.radius, b.pos, b.radius, court)
  return [{ ...a, pos: posA }, { ...b, pos: posB }]
}

const FRICTION = 1.8   // m/s² deceleration
const RESTITUTION = 0.6 // bounciness off walls

// Apply robot→ball contact force (called when robot overlaps ball)
export function applyContact(ball: Ball, robot: Robot, robotVelocity: Vec2): Ball {
  if (ball.isStatic) return ball

  const overlap = (robot.radius + ball.radius) - dist(robot.pos, ball.pos)
  if (overlap <= 0) return ball

  // Push ball in direction of robot movement (simplified impulse)
  const pushDir = len(robotVelocity) > 0.01
    ? normalize(robotVelocity)
    : normalize(sub(ball.pos, robot.pos))

  const impulse = len(robotVelocity) * 1.5  // amplify slightly

  return {
    ...ball,
    velocity: scale(pushDir, impulse),
  }
}

// Separate overlapping robot and ball
export function resolveOverlap(ball: Ball, robot: Robot): Ball {
  if (ball.isStatic) return ball

  const d = dist(robot.pos, ball.pos)
  const minDist = robot.radius + ball.radius

  if (d >= minDist) return ball

  const dir = d < 1e-9
    ? { x: 1, y: 0 }
    : normalize(sub(ball.pos, robot.pos))

  return {
    ...ball,
    pos: add(robot.pos, scale(dir, minDist + 0.001)),
  }
}

// Step ball forward by dt seconds
export function stepBall(ball: Ball, court: Court, dt: number): Ball {
  if (ball.isStatic) return ball

  // Apply friction
  const speed = len(ball.velocity)
  const newSpeed = Math.max(0, speed - FRICTION * dt)
  const velocity: Vec2 = speed > 0
    ? scale(normalize(ball.velocity), newSpeed)
    : { x: 0, y: 0 }

  // Move
  let pos: Vec2 = add(ball.pos, scale(velocity, dt))

  // Wall collisions (bounce)
  const hw = court.width  / 2 - ball.radius
  const hh = court.height / 2 - ball.radius

  let vx = velocity.x
  let vy = velocity.y

  if (pos.x < -hw) { pos = { ...pos, x: -hw }; vx = Math.abs(vx) * RESTITUTION }
  if (pos.x >  hw) { pos = { ...pos, x:  hw }; vx = -Math.abs(vx) * RESTITUTION }
  if (pos.y < -hh) { pos = { ...pos, y: -hh }; vy = Math.abs(vy) * RESTITUTION }
  if (pos.y >  hh) { pos = { ...pos, y:  hh }; vy = -Math.abs(vy) * RESTITUTION }

  return { ...ball, pos, velocity: { x: vx, y: vy } }
}
