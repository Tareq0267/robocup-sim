import type { SimState } from '../simulation/types'

const STATE_COLORS: Record<string, string> = {
  SEARCHING: '#a855f7', IDLE: '#64748b', CHASING: '#f97316',
  REPOSITIONING: '#eab308', RADIAL_ADJUST: '#22d3ee',
  READY: '#22c55e', SHOOTING: '#ef4444',
}
const PLAYER_COLORS = ['#3b82f6', '#14b8a6']

interface Props { simState: SimState }

function Row({ label, value, unit = '' }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="flex justify-between py-0.5 border-b border-[#1a1a1a]">
      <span className="text-[#64748b] text-xs">{label}</span>
      <span className="text-[#e2e8f0] text-xs font-mono">
        {typeof value === 'number' ? value.toFixed(2) : value}
        {unit && <span className="text-[#475569] ml-1">{unit}</span>}
      </span>
    </div>
  )
}

export default function TeamTab({ simState }: Props) {
  const { robots, debugs, activeIndex, swapTimer, team, ball, time } = simState
  const swapPct = Math.min(swapTimer / team.roleSwapDelay, 1) * 100
  const pendingSwap = swapTimer > 0

  return (
    <div className="p-3 overflow-y-auto h-full text-xs font-mono space-y-3">

      {/* Time */}
      <div className="text-[#475569] text-[10px]">t = {time.toFixed(2)}s</div>

      {/* Role swap status */}
      <div className="bg-[#0f1117] rounded p-2">
        <div className="text-[10px] text-[#475569] uppercase tracking-widest mb-2">Role Assignment</div>
        <div className="flex gap-2 mb-2">
          {robots.map((r, i) => {
            const isActive = activeIndex === i
            const color = PLAYER_COLORS[i]
            return (
              <div
                key={i}
                className="flex-1 rounded px-2 py-1.5 text-center"
                style={{
                  border: `1px solid ${color}${isActive ? 'aa' : '33'}`,
                  background: isActive ? color + '15' : 'transparent',
                }}
              >
                <div className="font-bold" style={{ color: isActive ? color : color + '66' }}>
                  P{i + 1}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: isActive ? '#e2e8f0' : '#475569' }}>
                  {isActive ? '● ACTIVE' : '○ IDLE'}
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
              <div
                className="h-full bg-[#eab308] transition-all"
                style={{ width: `${swapPct}%` }}
              />
            </div>
          </>
        ) : (
          <div className="text-[10px] text-[#334155]">no swap pending</div>
        )}
        <Row label="Swap delay" value={team.roleSwapDelay} unit="s" />
      </div>

      {/* Per-player summary cards */}
      {robots.map((robot, i) => {
        const debug    = debugs[i]
        const isActive = activeIndex === i
        const sColor   = STATE_COLORS[robot.state] ?? '#60a5fa'
        const pColor   = PLAYER_COLORS[i]
        const dBall    = debug.distanceToBall

        return (
          <div key={i} className="bg-[#0f1117] rounded p-2"
            style={{ borderLeft: `2px solid ${pColor}` }}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold" style={{ color: pColor }}>Player {i + 1}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: sColor + '22', color: sColor, border: `1px solid ${sColor}44` }}>
                {robot.state}
              </span>
            </div>

            <Row label="Distance to ball" value={dBall} unit="m" />
            <Row label="Pos" value={`(${robot.pos.x.toFixed(2)}, ${robot.pos.y.toFixed(2)})`} />

            <div className="flex gap-2 mt-1.5">
              <div className={`flex-1 text-center text-[10px] py-0.5 rounded ${
                debug.canSeeBall ? 'bg-[#14532d22] text-[#22c55e]' : 'bg-[#2e1065] text-[#a855f7]'
              }`}>
                {debug.canSeeBall ? '● sees ball' : '● searching'}
              </div>
              {isActive && (
                <div className="flex-1 text-center text-[10px] py-0.5 rounded bg-[#1e3a5f] text-[#60a5fa]">
                  ● active
                </div>
              )}
            </div>

            {/* Compact alignment bar */}
            {isActive && (
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-[#475569] mb-0.5">
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
        <div className="text-[10px] text-[#475569] uppercase tracking-widest mb-1">Ball</div>
        <Row label="pos" value={`(${ball.pos.x.toFixed(2)}, ${ball.pos.y.toFixed(2)})`} />
        <Row label="speed" value={Math.sqrt(ball.velocity.x ** 2 + ball.velocity.y ** 2)} unit="m/s" />
      </div>
    </div>
  )
}
