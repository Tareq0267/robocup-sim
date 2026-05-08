import { useState, useEffect, useRef, useCallback } from 'react'
import type { SimState, Vec2 } from '../simulation/types'
import { render } from '../rendering/renderer'

interface Props {
  simState:       SimState
  focusedRobot:   number | null
  dragBall:       (pos: Vec2) => void
  dragRobot:      (pos: Vec2, index: 0 | 1 | 2) => void
  dragEnemyRobot: (pos: Vec2, index: 0 | 1 | 2) => void
}

type DragTarget =
  | { kind: 'ball' }
  | { kind: 'robot';  index: 0 | 1 | 2 }
  | { kind: 'enemy';  index: 0 | 1 | 2 }
  | { kind: 'pan' }
  | null

export default function SimCanvas({ simState, focusedRobot, dragBall, dragRobot, dragEnemyRobot }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragging  = useRef<DragTarget>(null)

  const [zoom, setZoom] = useState(1)
  const [pan,  setPan]  = useState<Vec2>({ x: 0, y: 0 })

  // Refs so ResizeObserver and non-React event handlers always see current values
  const simStateRef  = useRef(simState)
  const focusedRef   = useRef(focusedRobot)
  const zoomRef      = useRef(zoom)
  const panRef       = useRef(pan)
  const panStartRef  = useRef<{ mouseX: number; mouseY: number; panX: number; panY: number } | null>(null)

  useEffect(() => { simStateRef.current = simState },     [simState])
  useEffect(() => { focusedRef.current  = focusedRobot }, [focusedRobot])
  useEffect(() => { zoomRef.current     = zoom },         [zoom])
  useEffect(() => { panRef.current      = pan },          [pan])

  // Re-render on every state/zoom/pan change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    render(ctx, simState, canvas.width, canvas.height, focusedRobot, zoom, pan)
  }, [simState, focusedRobot, zoom, pan])

  // ResizeObserver: resize canvas buffer and immediately re-render from refs
  // (setting canvas.width clears the canvas; can't wait for the state-change re-render)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      const ctx = canvas.getContext('2d')
      if (ctx) render(ctx, simStateRef.current, canvas.width, canvas.height, focusedRef.current, zoomRef.current, panRef.current)
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
    const sc   = Math.min(canvas.width / simStateRef.current.court.width, canvas.height / simStateRef.current.court.height)
    const z    = zoomRef.current
    const p    = panRef.current
    return {
      x:  (cx - rect.left  - canvas.width  / 2) / (sc * z) + p.x,
      y: -(cy - rect.top   - canvas.height / 2) / (sc * z) + p.y,
    }
  }, [])

  const hitTest = useCallback((p: Vec2): DragTarget => {
    const { ball, robots, enemyRobots, enemyMode } = simStateRef.current
    const d = (ax: number, ay: number, bx: number, by: number) =>
      Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2)

    if (d(p.x, p.y, ball.pos.x, ball.pos.y) < ball.radius + 0.2) return { kind: 'ball' }

    for (let i = 0; i < 3; i++) {
      const r = robots[i]
      if (d(p.x, p.y, r.pos.x, r.pos.y) < r.radius + 0.2)
        return { kind: 'robot', index: i as 0 | 1 | 2 }
    }

    if (enemyMode !== 'off') {
      for (let i = 0; i < 3; i++) {
        const r = enemyRobots[i]
        if (d(p.x, p.y, r.pos.x, r.pos.y) < r.radius + 0.2)
          return { kind: 'enemy', index: i as 0 | 1 | 2 }
      }
    }

    return { kind: 'pan' }
  }, [])

  // Scroll wheel: zoom toward cursor position
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect    = canvas.getBoundingClientRect()
    const sc      = Math.min(canvas.width / simStateRef.current.court.width, canvas.height / simStateRef.current.court.height)
    const z       = zoomRef.current
    const p       = panRef.current
    const factor  = e.deltaY < 0 ? 1.15 : 1 / 1.15
    const newZoom = Math.max(1, Math.min(5, z * factor))

    if (newZoom <= 1) {
      setZoom(1); setPan({ x: 0, y: 0 }); return
    }

    // Offset from canvas centre in CSS px
    const ox = e.clientX - rect.left - canvas.width  / 2
    const oy = e.clientY - rect.top  - canvas.height / 2
    // Keep the cursor's sim-coordinate fixed as zoom changes
    setZoom(newZoom)
    setPan({
      x: ox / (sc * z) + p.x - ox / (sc * newZoom),
      y: -oy / (sc * z) + p.y + oy / (sc * newZoom),
    })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [onWheel])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const pos    = canvasToSim(e.clientX, e.clientY)
    const target = hitTest(pos)
    dragging.current = target
    if (target?.kind === 'pan') {
      panStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, panX: panRef.current.x, panY: panRef.current.y }
    }
  }, [canvasToSim, hitTest])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const t = dragging.current
    if (!t) return
    if (t.kind === 'pan') {
      const ps = panStartRef.current
      if (!ps) return
      const canvas = canvasRef.current
      if (!canvas) return
      const sc = Math.min(canvas.width / simStateRef.current.court.width, canvas.height / simStateRef.current.court.height)
      const z  = zoomRef.current
      setPan({
        x: ps.panX - (e.clientX - ps.mouseX) / (sc * z),
        y: ps.panY + (e.clientY - ps.mouseY) / (sc * z),
      })
      return
    }
    const pos = canvasToSim(e.clientX, e.clientY)
    if (t.kind === 'ball')  dragBall(pos)
    if (t.kind === 'robot') dragRobot(pos, t.index)
    if (t.kind === 'enemy') dragEnemyRobot(pos, t.index)
  }, [canvasToSim, dragBall, dragRobot, dragEnemyRobot])

  const onMouseUp = useCallback(() => {
    dragging.current    = null
    panStartRef.current = null
  }, [])

  // Double-click resets zoom and pan
  const onDoubleClick = useCallback(() => {
    setZoom(1); setPan({ x: 0, y: 0 })
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full select-none"
      style={{ cursor: zoom > 1 ? 'grab' : 'crosshair' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onDoubleClick={onDoubleClick}
    />
  )
}
