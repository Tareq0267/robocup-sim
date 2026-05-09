import type { SimState } from '../simulation/types'

const STATE_COLORS: Record<string, string> = {
  SEARCHING: '#a855f7', IDLE: '#64748b', ASSIST: '#60a5fa', CHASING: '#f97316',
  REPOSITIONING: '#eab308', RADIAL_ADJUST: '#22d3ee',
  READY: '#22c55e', SHOOTING: '#ef4444',
  // GK states
  FIND_BALL: '#a855f7', RETREAT: '#64748b', ADJUST_BLOCK: '#22d3ee', KICK: '#ef4444',
}

const PLAYER_COLORS = ['#3b82f6', '#14b8a6', '#a78bfa']
const GK_COLOR      = '#f97316'

interface Props { simState: SimState }

function Row({ label, value, unit = '' }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="flex justify-between py-0.5 border-b border-[#1a1a1a]">
      <span className="text-[#64748b] text-xs">{label}</span>
      <span className="text-[#e2e8f0] text-xs font-mono">
        {typeof value === 'number' ? value.toFixed(2) : value}
        {unit && <span className="text-[#6b7280] ml-1">{unit}</span>}
      </span>
    </div>
  )
}

export default function TeamTab({ simState }: Props) {
  const { robots, debugs, activeIndex, swapTimer, team, ball, time, gkSwapCooldown } = simState
  const swapPct    = Math.min(swapTimer / team.roleSwapDelay, 1) * 100
  const pendingSwap = swapTimer > 0
  const gkIdx      = robots.findIndex(r => r.role === 'goalkeeper')

  return (
    <div className="p-3 overflow-y-auto h-full text-xs font-mono space-y-3">

      {/* Time */}
      <div className="text-[#6b7280] text-[10px]">t = {time.toFixed(2)}s</div>

      {/* Role assignment */}
      <div className="bg-[#0f1117] rounded p-2">
        <div className="text-[10px] text-[#6b7280] uppercase tracking-widest mb-2">Role Assignment</div>
        <div className="flex gap-1.5 mb-2">
          {robots.map((r, i) => {
            const isActive = activeIndex === i
            const isGK     = r.role === 'goalkeeper'
            const color    = isGK ? GK_COLOR : PLAYER_COLORS[i]
            const badge    = isGK ? 'GK' : isActive ? 'ACTIVE' : 'IDLE'
            return (
              <div
                key={i}
                className="flex-1 rounded px-1.5 py-1.5 text-center"
                style={{
                  border:     `1px solid ${color}${(isActive || isGK) ? 'aa' : '33'}`,
                  background: (isActive || isGK) ? color + '15' : 'transparent',
                }}
              >
                <div className="font-bold text-[11px]" style={{ color: (isActive || isGK) ? color : color + '66' }}>
                  P{i + 1}
                </div>
                <div className="text-[9px] mt-0.5" style={{ color: (isActive || isGK) ? '#e2e8f0' : '#475569' }}>
                  {badge}
                </div>
              </div>
            )
          })}
        </div>

        {pendingSwap ? (
          <>
            <div className="text-[10px] text-[#eab308] mb-1">
              swap pending — {(team.roleSwapDelay - swapTimer).toFixed(1)}s remaining
            </div>
            <div className="w-full h-1.5 bg-[#1e1e1e] rounded-full overflow-hidden">
              <div className="h-full bg-[#eab308] transition-all" style={{ width: `${swapPct}%` }} />
            </div>
          </>
        ) : (
          <div className="text-[10px] text-[#334155]">no swap pending</div>
        )}
        <Row label="Swap delay" value={team.roleSwapDelay} unit="s" />
        {gkSwapCooldown > 0 && (
          <div className="text-[10px] text-[#f97316] mt-1">
            GK swap cooldown — {gkSwapCooldown.toFixed(1)}s
          </div>
        )}
      </div>

      {/* Per-robot summary */}
      {robots.map((robot, i) => {
        const debug    = debugs[i]
        const isActive = activeIndex === i
        const isGK     = robot.role === 'goalkeeper'
        const sColor   = isGK
          ? ({ FIND_BALL: '#a855f7', RETREAT: '#64748b', ADJUST_BLOCK: '#22d3ee', CHASE: '#f97316', KICK: '#ef4444' }[robot.gkState] ?? GK_COLOR)
          : (STATE_COLORS[robot.state] ?? '#60a5fa')
        const pColor     = isGK ? GK_COLOR : PLAYER_COLORS[i]
        const dBall      = isGK ? simState.goalkeeperDebug.distanceToBall : debug.distanceToBall
        const displayState = isGK ? robot.gkState : robot.state

        return (
          <div key={i} className="bg-[#0f1117] rounded p-2"
            style={{ borderLeft: `2px solid ${pColor}` }}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold" style={{ color: pColor }}>
                P{i + 1}{isGK ? ' (GK)' : ''}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: sColor + '22', color: sColor, border: `1px solid ${sColor}44` }}>
                {displayState}
              </span>
            </div>

            <Row label="Distance to ball" value={dBall} unit="m" />
            <Row label="Pos" value={`(${robot.pos.x.toFixed(2)}, ${robot.pos.y.toFixed(2)})`} />

            <div className="flex gap-2 mt-1.5">
              <div className={`flex-1 text-center text-[10px] py-0.5 rounded ${
                isGK
                  ? 'bg-[#431407] text-[#f97316]'
                  : simState.goalkeeperDebug && i === gkIdx
                    ? 'bg-[#14532d22] text-[#22c55e]'
                    : debug.canSeeBall ? 'bg-[#14532d22] text-[#22c55e]' : 'bg-[#2e1065] text-[#a855f7]'
              }`}>
                {isGK ? '● goalkeeper' : debug.canSeeBall ? '● sees ball' : '● searching'}
              </div>
              {isActive && !isGK && (
                <div className="flex-1 text-center text-[10px] py-0.5 rounded bg-[#1e3a5f] text-[#60a5fa]">
                  ● active
                </div>
              )}
            </div>

            {isActive && !isGK && (
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-[#6b7280] mb-0.5">
                  <span>alignment</span>
                  <span>{(debug.alignmentError * 180 / Math.PI).toFixed(1)}°</span>
                </div>
                <div className="w-full h-1 bg-[#1e1e1e] rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${Math.max(0, 100 - (debug.alignmentError / Math.PI * 100))}%`,
                      background: debug.isAligned ? '#22c55e' : '#f97316',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Ball summary */}
      <div className="bg-[#0f1117] rounded p-2">
        <div className="text-[10px] text-[#6b7280] uppercase tracking-widest mb-1">Ball</div>
        <Row label="pos" value={`(${ball.pos.x.toFixed(2)}, ${ball.pos.y.toFixed(2)})`} />
        <Row label="speed" value={Math.sqrt(ball.velocity.x ** 2 + ball.velocity.y ** 2)} unit="m/s" />
      </div>
    </div>
  )
}
