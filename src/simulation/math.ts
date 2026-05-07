// ================================================================
// VECTOR MATH UTILITIES
// ================================================================
import type { Vec2 } from './types'

export const v       = (x: number, y: number): Vec2 => ({ x, y })
export const add     = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
export const sub     = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
export const scale   = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s })
export const len     = (a: Vec2): number => Math.sqrt(a.x * a.x + a.y * a.y)
export const dist    = (a: Vec2, b: Vec2): number => len(sub(a, b))
export const dot     = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y
export const cross2d = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x
export const angOf   = (a: Vec2): number => Math.atan2(a.y, a.x)
export const fromAng = (a: number): Vec2 => ({ x: Math.cos(a), y: Math.sin(a) })
export const perpCCW = (a: Vec2): Vec2 => ({ x: -a.y, y: a.x })   // rotate 90° CCW
export const perpCW  = (a: Vec2): Vec2 => ({ x: a.y, y: -a.x })   // rotate 90° CW

export const normalize = (a: Vec2): Vec2 => {
  const l = len(a)
  return l < 1e-9 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l }
}

// Clamp angle to [-π, π]
export const wrapAngle = (a: number): number => {
  while (a >  Math.PI) a -= 2 * Math.PI
  while (a < -Math.PI) a += 2 * Math.PI
  return a
}

// Smoothly rotate 'current' toward 'target' at given speed (rad/s)
export const rotateToward = (current: number, target: number, speed: number, dt: number): number => {
  const diff = wrapAngle(target - current)
  const step = speed * dt
  if (Math.abs(diff) <= step) return target
  return current + Math.sign(diff) * step
}
