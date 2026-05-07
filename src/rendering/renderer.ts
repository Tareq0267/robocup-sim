// ================================================================
// CANVAS RENDERER
// Simulation coords: (0,0) = field centre, y-up
// Canvas coords:     (0,0) = top-left, y-down
// ================================================================

import type { SimState, Robot, DebugData, GoalkeeperRobot } from '../simulation/types'
import { GoalkeeperState } from '../simulation/types'
import { angOf } from '../simulation/math'

const STATE_COLORS: Record<string, string> = {
  SEARCHING:     '#a855f7',  // purple
  IDLE:          '#64748b',  // slate
  CHASING:       '#f97316',  // orange
  REPOSITIONING: '#eab308',  // yellow
  RADIAL_ADJUST: '#22d3ee',  // cyan
  READY:         '#22c55e',  // green
  SHOOTING:      '#ef4444',  // red
}

const GK_STATE_COLORS: Record<string, string> = {
  FIND_BALL:    '#a855f7',  // purple
  RETREAT:      '#64748b',  // slate
  ADJUST_BLOCK: '#22d3ee',  // cyan
  CHASE:        '#f97316',  // orange
  KICK:         '#ef4444',  // red
}

const GK_COLOR = '#f97316'  // orange accent for goalkeeper

// Player accent colours (ring around robot to tell P1 from P2)
const PLAYER_COLORS = ['#3b82f6', '#14b8a6']  // blue, teal

const BODY_DEPTH = 0.23   // Booster T1: 23cm front-to-back
const BODY_WIDTH = 0.47   // Booster T1: 47cm shoulder-to-shoulder

function toCanvas(x: number, y: number, cw: number, ch: number, sc: number): [number, number] {
  return [cw / 2 + x * sc, ch / 2 - y * sc]
}

export function render(ctx: CanvasRenderingContext2D, state: SimState, cw: number, ch: number, focusedRobot: number | null = null) {
  const sc = Math.min(cw / state.court.width, ch / state.court.height)
  const tc = (x: number, y: number) => toCanvas(x, y, cw, ch, sc)

  ctx.clearRect(0, 0, cw, ch)
  drawCourt(ctx, state, cw, ch, sc, tc)
  drawFieldMarkings(ctx, state, sc, tc)
  drawOwnGoal(ctx, state, sc, tc)
  drawGoal(ctx, state, sc, tc)

  // Per-robot overlays (drawn under robots)
  state.robots.forEach((robot, i) => {
    const debug    = state.debugs[i]
    const isActive = state.activeIndex === i
    const focused  = focusedRobot === null || focusedRobot === i
    if (!focused) return
    if (state.overlays.showFOVCone)             drawFOVCone(ctx, robot, debug, sc, tc)
    if (state.overlays.showChaseDistanceCircle && isActive) drawChaseCircle(ctx, robot, state.ball, sc, tc)
    if (state.overlays.showAlignmentLine && isActive)       drawAlignmentLine(ctx, robot, state.ball, state.goal, sc, tc)
    if (state.overlays.showShootAngleCone && isActive)      drawShootCone(ctx, robot, state.ball, state.goal, sc, tc)
    if (state.overlays.showContactRange)        drawContactRange(ctx, robot, state.ball, sc, tc)
    if (state.overlays.showTangentVector && debug.tangentialDir)
      drawVector(ctx, robot.pos, debug.tangentialDir, sc, tc, '#eab308', 'tangent')
    if (state.overlays.showRadialVector && debug.radialDir)
      drawVector(ctx, robot.pos, debug.radialDir, sc, tc, '#22d3ee', 'radial')
  })

  if (state.overlays.showBallVelocity) drawBallVelocity(ctx, state, sc, tc)
  drawBall(ctx, state, sc, tc)

  // Draw robots
  state.robots.forEach((robot, i) => {
    const debug    = state.debugs[i]
    const isActive = state.activeIndex === i
    drawRobot(ctx, robot, i, isActive, state.overlays.showOrientationArrow, debug, sc, tc)
    if (state.overlays.showStateLabel) drawStateLabel(ctx, robot, i, isActive, sc, tc)
  })

  // Draw goalkeeper (overlays shown when Team tab or GK tab focused)
  const showGKOverlays = focusedRobot === null || focusedRobot === 2
  if (showGKOverlays && state.overlays.showFOVCone) {
    const gk = state.goalkeeper
    const [rx, ry] = tc(gk.pos.x, gk.pos.y)
    const halfFOV = gk.params.fieldOfView / 2
    const range   = 2.8 * sc
    const start   = -(gk.orientation + halfFOV)
    const end     = -(gk.orientation - halfFOV)
    ctx.beginPath(); ctx.moveTo(rx, ry); ctx.arc(rx, ry, range, start, end); ctx.closePath()
    if (state.goalkeeperDebug.canSeeBall) {
      ctx.fillStyle = 'rgba(249,115,22,0.07)'; ctx.strokeStyle = 'rgba(249,115,22,0.35)'
    } else {
      ctx.fillStyle = 'rgba(168,85,247,0.10)'; ctx.strokeStyle = 'rgba(168,85,247,0.45)'
    }
    ctx.lineWidth = 1; ctx.fill(); ctx.stroke()
  }
  drawGoalkeeper(ctx, state.goalkeeper, state.overlays.showOrientationArrow, sc, tc)
  if (state.overlays.showStateLabel) drawGoalkeeperLabel(ctx, state.goalkeeper, sc, tc)
}

// ── Court ─────────────────────────────────────────────────────
function drawCourt(
  ctx: CanvasRenderingContext2D, state: SimState,
  cw: number, ch: number, sc: number,
  tc: (x: number, y: number) => [number, number],
) {
  const [fx, fy] = tc(-state.court.width / 2, state.court.height / 2)
  const fw = state.court.width * sc
  const fh = state.court.height * sc

  ctx.fillStyle = '#14532d'
  ctx.fillRect(fx, fy, fw, fh)

  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.lineWidth = 1
  const [cx0, cy0] = tc(0, -state.court.height / 2)
  const [cx1, cy1] = tc(0,  state.court.height / 2)
  ctx.beginPath(); ctx.moveTo(cx0, cy0); ctx.lineTo(cx1, cy1); ctx.stroke()

  const [ccx, ccy] = tc(0, 0)
  ctx.beginPath(); ctx.arc(ccx, ccy, state.fieldLayout.centreCircleRadius * sc, 0, Math.PI * 2); ctx.stroke()

  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 2
  ctx.strokeRect(fx, fy, fw, fh)
}

// ── Field markings: penalty areas, goal areas, penalty marks ─
function drawFieldMarkings(
  ctx: CanvasRenderingContext2D, state: SimState,
  sc: number, tc: (x: number, y: number) => [number, number],
) {
  const { ownPenaltyArea, ownGoalArea, opponentPenaltyArea, opponentGoalArea, penaltyMarkDist } = state.fieldLayout
  const lineColor = 'rgba(255,255,255,0.35)'
  const areaColor = 'rgba(255,255,255,0.20)'

  function drawZone(zone: typeof ownPenaltyArea, fill: string, stroke: string, dash: number[]) {
    const [x1, y1] = tc(zone.minX, zone.maxY)
    const [x2, y2] = tc(zone.maxX, zone.minY)
    ctx.setLineDash(dash)
    ctx.fillStyle = fill
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1)
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
    ctx.setLineDash([])
  }

  // Penalty areas
  drawZone(ownPenaltyArea,      'rgba(59,130,246,0.05)', lineColor, [])
  drawZone(opponentPenaltyArea, 'rgba(250,204,21,0.05)', lineColor, [])

  // Goal areas (inner boxes)
  drawZone(ownGoalArea,      'rgba(59,130,246,0.08)', areaColor, [4, 4])
  drawZone(opponentGoalArea, 'rgba(250,204,21,0.08)', areaColor, [4, 4])

  // Penalty marks
  function drawMark(x: number, y: number) {
    const [px, py] = tc(x, y)
    const r = 3
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2)
    ctx.fillStyle = lineColor; ctx.fill()
  }
  drawMark(-7.0 + penaltyMarkDist, 0)
  drawMark( 7.0 - penaltyMarkDist, 0)

  // Centre spot
  const [cx, cy] = tc(0, 0)
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2)
  ctx.fillStyle = lineColor; ctx.fill()
}

// ── Opponent goal (right, yellow) ────────────────────────────
function drawGoal(
  ctx: CanvasRenderingContext2D, state: SimState,
  sc: number, tc: (x: number, y: number) => [number, number],
) {
  const { center, width, depth } = state.goal
  const hw = width / 2
  const [gx, gy]   = tc(center.x,         center.y + hw)
  const [gx2, gy2] = tc(center.x + depth,  center.y - hw)
  ctx.fillStyle = 'rgba(250,204,21,0.15)'
  ctx.fillRect(gx, gy, gx2 - gx, gy2 - gy)
  ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2
  ctx.strokeRect(gx, gy, gx2 - gx, gy2 - gy)
  const [mlx, mly] = tc(center.x, center.y + hw)
  const [mrx, mry] = tc(center.x, center.y - hw)
  ctx.beginPath(); ctx.moveTo(mlx, mly); ctx.lineTo(mrx, mry)
  ctx.strokeStyle = '#facc15'; ctx.lineWidth = 3; ctx.stroke()
}

// ── Our goal (left, blue) ─────────────────────────────────────
function drawOwnGoal(
  ctx: CanvasRenderingContext2D, state: SimState,
  sc: number, tc: (x: number, y: number) => [number, number],
) {
  const { center, width, depth } = state.ownGoal
  const hw = width / 2
  // Net depth extends left (negative x) for the left-side goal
  const [gx, gy]   = tc(center.x,         center.y + hw)
  const [gx2, gy2] = tc(center.x - depth,  center.y - hw)
  ctx.fillStyle = 'rgba(59,130,246,0.15)'
  ctx.fillRect(gx2, gy, gx - gx2, gy2 - gy)
  ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2
  ctx.strokeRect(gx2, gy, gx - gx2, gy2 - gy)
  const [mlx, mly] = tc(center.x, center.y + hw)
  const [mrx, mry] = tc(center.x, center.y - hw)
  ctx.beginPath(); ctx.moveTo(mlx, mly); ctx.lineTo(mrx, mry)
  ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 3; ctx.stroke()
}

// ── FOV cone ──────────────────────────────────────────────────
function drawFOVCone(
  ctx: CanvasRenderingContext2D,
  robot: Robot, debug: DebugData,
  sc: number, tc: (x: number, y: number) => [number, number],
) {
  const [rx, ry] = tc(robot.pos.x, robot.pos.y)
  const halfFOV  = robot.params.fieldOfView / 2
  const range    = 2.8 * sc
  const start    = -(robot.orientation + halfFOV)
  const end      = -(robot.orientation - halfFOV)

  ctx.beginPath(); ctx.moveTo(rx, ry); ctx.arc(rx, ry, range, start, end); ctx.closePath()
  if (debug.canSeeBall) {
    ctx.fillStyle = 'rgba(34,197,94,0.07)'; ctx.strokeStyle = 'rgba(34,197,94,0.35)'
  } else {
    ctx.fillStyle = 'rgba(168,85,247,0.10)'; ctx.strokeStyle = 'rgba(168,85,247,0.45)'
  }
  ctx.lineWidth = 1; ctx.fill(); ctx.stroke()
}

// ── Chase distance circle ─────────────────────────────────────
function drawChaseCircle(
  ctx: CanvasRenderingContext2D,
  robot: Robot, ball: SimState['ball'],
  sc: number, tc: (x: number, y: number) => [number, number],
) {
  const [bx, by] = tc(ball.pos.x, ball.pos.y)
  ctx.beginPath(); ctx.arc(bx, by, robot.params.chaseDistance * sc, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(249,115,22,0.4)'; ctx.lineWidth = 1
  ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([])
}

// ── Alignment line ────────────────────────────────────────────
function drawAlignmentLine(
  ctx: CanvasRenderingContext2D,
  robot: Robot, ball: SimState['ball'], goal: SimState['goal'],
  sc: number, tc: (x: number, y: number) => [number, number],
) {
  const [rx, ry] = tc(robot.pos.x, robot.pos.y)
  const [bx, by] = tc(ball.pos.x,  ball.pos.y)
  const [gx, gy] = tc(goal.center.x, goal.center.y)
  ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(bx, by); ctx.lineTo(gx, gy)
  ctx.strokeStyle = 'rgba(34,211,238,0.5)'; ctx.lineWidth = 1
  ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([])
}

// ── Shoot angle cone ──────────────────────────────────────────
function drawShootCone(
  ctx: CanvasRenderingContext2D,
  robot: Robot, ball: SimState['ball'], goal: SimState['goal'],
  sc: number, tc: (x: number, y: number) => [number, number],
) {
  const baseAngle  = angOf({ x: goal.center.x - ball.pos.x, y: goal.center.y - ball.pos.y })
  const rearAngle  = baseAngle + Math.PI
  const halfAngle  = robot.params.shootAngle
  const r          = robot.params.chaseDistance * sc
  const [bx, by]   = tc(ball.pos.x, ball.pos.y)
  ctx.beginPath(); ctx.moveTo(bx, by)
  ctx.arc(bx, by, r, -(rearAngle + halfAngle), -(rearAngle - halfAngle))
  ctx.closePath()
  ctx.fillStyle = 'rgba(34,197,94,0.12)'; ctx.strokeStyle = 'rgba(34,197,94,0.4)'
  ctx.lineWidth = 1; ctx.fill(); ctx.stroke()
}

// ── Contact range ─────────────────────────────────────────────
function drawContactRange(
  ctx: CanvasRenderingContext2D,
  robot: Robot, ball: SimState['ball'],
  sc: number, tc: (x: number, y: number) => [number, number],
) {
  const [bx, by] = tc(ball.pos.x, ball.pos.y)
  ctx.beginPath(); ctx.arc(bx, by, (robot.radius + ball.radius + 0.1) * sc, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(34,197,94,0.3)'; ctx.lineWidth = 1; ctx.stroke()
}

// ── Generic vector arrow ──────────────────────────────────────
function drawVector(
  ctx: CanvasRenderingContext2D,
  origin: { x: number; y: number }, dir: { x: number; y: number },
  sc: number, tc: (x: number, y: number) => [number, number],
  color: string, label: string,
) {
  const [ox, oy] = tc(origin.x, origin.y)
  const end = { x: origin.x + dir.x * 0.8, y: origin.y + dir.y * 0.8 }
  const [ex, ey] = tc(end.x, end.y)
  ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey)
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke()
  const ang = Math.atan2(ey - oy, ex - ox); const al = 10
  ctx.beginPath(); ctx.moveTo(ex, ey)
  ctx.lineTo(ex - al * Math.cos(ang - 0.4), ey - al * Math.sin(ang - 0.4))
  ctx.lineTo(ex - al * Math.cos(ang + 0.4), ey - al * Math.sin(ang + 0.4))
  ctx.closePath(); ctx.fillStyle = color; ctx.fill()
  ctx.fillStyle = color; ctx.font = '10px monospace'; ctx.fillText(label, ex + 5, ey - 5)
}

// ── Ball velocity ─────────────────────────────────────────────
function drawBallVelocity(
  ctx: CanvasRenderingContext2D, state: SimState,
  sc: number, tc: (x: number, y: number) => [number, number],
) {
  const v = state.ball.velocity
  if (Math.abs(v.x) + Math.abs(v.y) < 0.05) return
  drawVector(ctx, state.ball.pos, { x: v.x / 5, y: v.y / 5 }, sc, tc, '#a78bfa', 'vel')
}

// ── Ball ──────────────────────────────────────────────────────
function drawBall(
  ctx: CanvasRenderingContext2D, state: SimState,
  sc: number, tc: (x: number, y: number) => [number, number],
) {
  const [bx, by] = tc(state.ball.pos.x, state.ball.pos.y)
  const r = state.ball.radius * sc
  ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 1
  ctx.fill(); ctx.stroke()
  if (state.ball.isStatic) {
    ctx.beginPath(); ctx.arc(bx, by, r + 3, 0, Math.PI * 2)
    ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 1.5; ctx.stroke()
  }
}

// ── Robot rectangle ───────────────────────────────────────────
function drawRobot(
  ctx: CanvasRenderingContext2D,
  robot: Robot, playerIndex: number, isActive: boolean,
  showTargetOri: boolean, debug: DebugData,
  sc: number, tc: (x: number, y: number) => [number, number],
) {
  const [rx, ry]  = tc(robot.pos.x, robot.pos.y)
  const stateColor = STATE_COLORS[robot.state] ?? '#60a5fa'
  const playerColor = PLAYER_COLORS[playerIndex]
  const bD = BODY_DEPTH * sc
  const bW = BODY_WIDTH * sc

  ctx.save()
  ctx.translate(rx, ry)
  ctx.rotate(-robot.orientation)

  // Body fill + outline
  ctx.fillStyle   = stateColor + (isActive ? '33' : '18')
  ctx.strokeStyle = isActive ? stateColor : stateColor + '88'
  ctx.lineWidth   = isActive ? 1.5 : 1
  ctx.fillRect(-bD / 2, -bW / 2, bD, bW)
  ctx.strokeRect(-bD / 2, -bW / 2, bD, bW)

  // Player colour accent line on back edge
  ctx.strokeStyle = playerColor + (isActive ? 'cc' : '55')
  ctx.lineWidth   = 2.5
  ctx.beginPath(); ctx.moveTo(-bD / 2, -bW / 2); ctx.lineTo(-bD / 2, bW / 2); ctx.stroke()

  // Front edge highlight
  ctx.strokeStyle = isActive ? stateColor : stateColor + '66'
  ctx.lineWidth   = 3
  ctx.beginPath(); ctx.moveTo(bD / 2, -bW / 2); ctx.lineTo(bD / 2, bW / 2); ctx.stroke()

  // Front arrow tip
  const tip = bW * 0.35
  ctx.fillStyle = isActive ? stateColor : stateColor + '66'
  ctx.beginPath()
  ctx.moveTo(bD / 2 + tip,  0)
  ctx.lineTo(bD / 2,       -tip * 0.55)
  ctx.lineTo(bD / 2,        tip * 0.55)
  ctx.closePath(); ctx.fill()

  ctx.restore()

  // Active indicator: small dot above robot using player colour
  if (isActive) {
    const [, labelY] = tc(robot.pos.x, robot.pos.y)
    ctx.beginPath()
    ctx.arc(rx, labelY - BODY_WIDTH * sc / 2 - 10, 3, 0, Math.PI * 2)
    ctx.fillStyle = playerColor; ctx.fill()
  }

  // Target orientation dashed line
  if (showTargetOri && debug.targetOrientation !== null) {
    const canvAng = -debug.targetOrientation
    const lineLen = (BODY_DEPTH * 0.9 + 0.3) * sc
    const ex = rx + Math.cos(canvAng) * lineLen
    const ey = ry + Math.sin(canvAng) * lineLen
    ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(ex, ey)
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1
    ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([])
  }
}

// ── Goalkeeper rectangle ──────────────────────────────────────
function drawGoalkeeper(
  ctx: CanvasRenderingContext2D,
  gk: GoalkeeperRobot,
  showTargetOri: boolean,
  sc: number, tc: (x: number, y: number) => [number, number],
) {
  const [rx, ry] = tc(gk.pos.x, gk.pos.y)
  const stateColor = GK_STATE_COLORS[gk.state] ?? GK_COLOR
  const bD = BODY_DEPTH * sc
  const bW = BODY_WIDTH * sc

  ctx.save()
  ctx.translate(rx, ry)
  ctx.rotate(-gk.orientation)

  // Body
  ctx.fillStyle   = stateColor + '33'
  ctx.strokeStyle = stateColor
  ctx.lineWidth   = 1.5
  ctx.fillRect(-bD / 2, -bW / 2, bD, bW)
  ctx.strokeRect(-bD / 2, -bW / 2, bD, bW)

  // Orange accent on back edge
  ctx.strokeStyle = GK_COLOR + 'cc'
  ctx.lineWidth   = 2.5
  ctx.beginPath(); ctx.moveTo(-bD / 2, -bW / 2); ctx.lineTo(-bD / 2, bW / 2); ctx.stroke()

  // Front edge highlight
  ctx.strokeStyle = stateColor
  ctx.lineWidth   = 3
  ctx.beginPath(); ctx.moveTo(bD / 2, -bW / 2); ctx.lineTo(bD / 2, bW / 2); ctx.stroke()

  // Front arrow tip
  const tip = bW * 0.35
  ctx.fillStyle = stateColor
  ctx.beginPath()
  ctx.moveTo(bD / 2 + tip, 0)
  ctx.lineTo(bD / 2, -tip * 0.55)
  ctx.lineTo(bD / 2,  tip * 0.55)
  ctx.closePath(); ctx.fill()

  ctx.restore()

  // GK indicator dot
  ctx.beginPath()
  ctx.arc(rx, ry - BODY_WIDTH * sc / 2 - 10, 3, 0, Math.PI * 2)
  ctx.fillStyle = GK_COLOR; ctx.fill()

  // Target orientation line
  if (showTargetOri) {
    const canvAng = -gk.orientation
    const lineLen = (BODY_DEPTH * 0.9 + 0.3) * sc
    const ex = rx + Math.cos(canvAng) * lineLen
    const ey = ry + Math.sin(canvAng) * lineLen
    ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(ex, ey)
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1
    ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([])
  }
}

// ── State + player label ──────────────────────────────────────
function drawStateLabel(
  ctx: CanvasRenderingContext2D,
  robot: Robot, playerIndex: number, isActive: boolean,
  sc: number, tc: (x: number, y: number) => [number, number],
) {
  const [rx, ry]  = tc(robot.pos.x, robot.pos.y)
  const stateColor = STATE_COLORS[robot.state] ?? '#60a5fa'
  const offset    = (BODY_WIDTH / 2) * sc + 8

  ctx.font      = `${isActive ? 'bold' : 'normal'} 10px monospace`
  ctx.fillStyle = isActive ? stateColor : stateColor + '88'
  ctx.textAlign = 'center'
  ctx.fillText(`P${playerIndex + 1} · ${robot.state}`, rx, ry - offset)
  ctx.textAlign = 'left'
}

function drawGoalkeeperLabel(
  ctx: CanvasRenderingContext2D,
  gk: GoalkeeperRobot,
  sc: number, tc: (x: number, y: number) => [number, number],
) {
  const [rx, ry] = tc(gk.pos.x, gk.pos.y)
  const stateColor = GK_STATE_COLORS[gk.state] ?? GK_COLOR
  const offset = (BODY_WIDTH / 2) * sc + 8
  ctx.font      = 'bold 10px monospace'
  ctx.fillStyle = stateColor
  ctx.textAlign = 'center'
  ctx.fillText(`GK · ${gk.state}`, rx, ry - offset)
  ctx.textAlign = 'left'
}
