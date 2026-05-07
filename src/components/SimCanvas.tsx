import { useEffect, useRef, useCallback } from 'react'
import type { SimState, Vec2 } from '../simulation/types'
import { render } from '../rendering/renderer'

interface Props {
  simState:        SimState
  focusedRobot:    number | null
  dragBall:        (pos: Vec2) => void
  dragRobot:       (pos: Vec2, index: 0 | 1) => void
  dragGoalkeeper:  (pos: Vec2) => void
}

type DragTarget =
  | { kind: 'ball' }
  | { kind: 'robot'; index: 0 | 1 }
  | { kind: 'goalkeeper' }
  | null

export default function SimCanvas({ simState, focusedRobot, dragBall, dragRobot, dragGoalkeeper }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragging  = useRef<DragTarget>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    render(ctx, simState, canvas.width, canvas.height, focusedRobot)
  }, [simState, focusedRobot])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    })
    ro.observe(canvas)
    canvas.width  = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    return () => ro.disconnect()
  }, [])

  const canvasToSim = useCallback((cx: number, cy: number): Vec2 => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const sc   = Math.min(canvas.width / simState.court.width, canvas.height / simState.court.height)
    return {
      x:  (cx - rect.left  - canvas.width  / 2) / sc,
      y: -(cy - rect.top   - canvas.height / 2) / sc,
    }
  }, [simState.court])

  const hitTest = useCallback((p: Vec2): DragTarget => {
    const { ball, robots, goalkeeper } = simState
    const d = (ax: number, ay: number, bx: number, by: number) =>
      Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2)

    if (d(p.x, p.y, ball.pos.x, ball.pos.y) < ball.radius + 0.2) return { kind: 'ball' }
    for (let i = 0; i < 2; i++) {
      const r = robots[i]
      if (d(p.x, p.y, r.pos.x, r.pos.y) < r.radius + 0.2)
        return { kind: 'robot', index: i as 0 | 1 }
    }
    if (d(p.x, p.y, goalkeeper.pos.x, goalkeeper.pos.y) < goalkeeper.radius + 0.2)
      return { kind: 'goalkeeper' }
    return null
  }, [simState])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = hitTest(canvasToSim(e.clientX, e.clientY))
  }, [canvasToSim, hitTest])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const t = dragging.current
    if (!t) return
    const pos = canvasToSim(e.clientX, e.clientY)
    if (t.kind === 'ball')       dragBall(pos)
    if (t.kind === 'robot')      dragRobot(pos, t.index)
    if (t.kind === 'goalkeeper') dragGoalkeeper(pos)
  }, [canvasToSim, dragBall, dragRobot, dragGoalkeeper])

  const onMouseUp = useCallback(() => { dragging.current = null }, [])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-crosshair select-none"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    />
  )
}
