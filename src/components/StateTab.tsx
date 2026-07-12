import type { SimState } from '../simulation/types'

const STATE_COLORS: Record<string, string> = {
  SEARCHING:     '#a855f7',
  IDLE:          '#64748b',
  ASSIST:        '#60a5fa',
  CHASING:       '#f97316',
  REPOSITIONING: '#eab308',
  RADIAL_ADJUST: '#22d3ee',
  READY:         '#22c55e',
  SHOOTING:      '#ef4444',
}

const GK_STATE_COLORS: Record<string, string> = {
  FIND_BALL: '#a855f7', RETREAT: '#64748b', ADJUST_BLOCK: '#22d3ee', CHASE: '#f97316', KICK: '#ef4444',
}

interface Props { simState: SimState; robotIndex: number }

function Row({ label, value, unit = '', color = '' }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-0.5 border-b border-[#1e1e1e]">
      <span className="text-[#64748b] text-xs">{label}</span>
      <span className={`text-xs font-mono ${color || 'text-[#e2e8f0]'}`}>
        {typeof value === 'number' ? value.toFixed(3) : value}
        {unit && <span className="text-[#6b7280] ml-1">{unit}</span>}
      </span>
    </div>
  )
}

function Bool({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex justify-between items-center py-0.5 border-b border-[#1e1e1e]">
      <span className="text-[#64748b] text-xs">{label}</span>
      <span className={`text-xs font-mono ${value ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
        {value ? '✓ yes' : '✗ no'}
      </span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-[10px] text-[#6b7280] uppercase tracking-widest mb-1 mt-2">{title}</div>
      {children}
    </div>
  )
}

export default function StateTab({ simState, robotIndex }: Props) {
  const robot    = simState.robots[robotIndex]
  const debug    = simState.debugs[robotIndex]
  const { time } = simState
  const isGK     = robot.role === 'goalkeeper'
  const color    = isGK
    ? (GK_STATE_COLORS[robot.gkState] ?? '#f97316')
    : (STATE_COLORS[robot.state] ?? '#60a5fa')
  const displayState = isGK ? robot.gkState : robot.state
  const errDeg   = debug.alignmentError  * 180 / Math.PI
  const limitDeg = robot.params.shootAngle * 180 / Math.PI
  const isActive = !isGK && simState.activeIndex === robotIndex

  return (
    <div className="p-3 overflow-y-auto h-full text-xs font-mono">

      {/* State badge */}
      <div
        className="rounded px-3 py-2 mb-1 text-center font-bold text-sm"
        style={{ backgroundColor: color + '22', border: `1px solid ${color}55`, color }}
      >
        {displayState}
      </div>

      {/* Role badge */}
      <div className={`rounded px-2 py-1 mb-3 text-center text-[10px] uppercase tracking-widest ${
        isGK
          ? 'bg-[#431407] border border-[#f9731633] text-[#f97316]'
          : isActive
            ? 'bg-[#1e3a5f] border border-[#2563eb55] text-[#60a5fa]'
            : 'bg-[#1a1a1a] border border-[#2a2a2a] text-[#6b7280]'
      }`}>
        {isGK ? '● GOALKEEPER' : isActive ? '● ACTIVE' : '○ IDLE'}
      </div>

      <Section title="Time">
        <Row label="Simulation time" value={time.toFixed(3)} unit="s" />
      </Section>

      <Section title="Vision">
        <Row
          label="FOV error"
          value={(debug.fovError * 180 / Math.PI).toFixed(2)} unit="°"
          color={debug.canSeeBall ? 'text-[#22c55e]' : 'text-[#a855f7]'}
        />
        <Row label="FOV half-limit" value={(robot.params.fieldOfView / 2 * 180 / Math.PI).toFixed(1)} unit="°" />
        <Bool label="Can see ball"  value={debug.canSeeBall} />
      </Section>

      <Section title="Distances">
        <Row label="Ball distance"         value={debug.distanceToBall}             unit="m" />
        <Row label="Chase range"           value={robot.params.chaseDistance}       unit="m" color="text-[#f97316]" />
        <Row label="Radial spd threshold"  value={robot.params.radialSpeedDistance} unit="m" color="text-[#22d3ee]" />
      </Section>

      <Section title="Position Alignment">
        <Row
          label="Position error" value={errDeg.toFixed(2)} unit="°"
          color={debug.isAligned ? 'text-[#22c55e]' : 'text-[#f97316]'}
        />
        <Row label="Shoot angle limit" value={limitDeg.toFixed(2)} unit="°" />
        <Bool label="Correct side"     value={debug.isOnCorrectSide} />
        <Bool label="Position aligned" value={debug.isAligned} />
        <Bool label="At contact range" value={debug.isAtShootDistance} />
      </Section>

      <Section title="Body Orientation">
        <Row
          label="Rotation error" value={(debug.orientationError * 180 / Math.PI).toFixed(2)} unit="°"
          color={debug.isOrientationAligned ? 'text-[#22c55e]' : 'text-[#a78bfa]'}
        />
        <Row label="Tolerance"            value={limitDeg.toFixed(2)} unit="°" />
        <Bool label="Orientation aligned" value={debug.isOrientationAligned} />
      </Section>

      <Section title="Robot">
        <Row label="pos x"       value={robot.pos.x} unit="m" />
        <Row label="pos y"       value={robot.pos.y} unit="m" />
        <Row label="orientation" value={(robot.orientation * 180 / Math.PI).toFixed(1)} unit="°" />
      </Section>

      <Section title="Ball">
        <Row label="pos x"    value={simState.ball.pos.x}      unit="m" />
        <Row label="pos y"    value={simState.ball.pos.y}      unit="m" />
        <Row label="speed"    value={Math.sqrt(simState.ball.velocity.x ** 2 + simState.ball.velocity.y ** 2)} unit="m/s" />
        <Bool label="Static"  value={simState.ball.isStatic} />
      </Section>

      {/* Transition log */}
      <div className="text-[10px] text-[#6b7280] uppercase tracking-widest mb-1 mt-3">Transition Log</div>
      <div className="space-y-1">
        {debug.stateHistory.length === 0 && (
          <div className="text-[#334155] text-xs italic">no transitions yet</div>
        )}
        {debug.stateHistory.map((t, i) => (
          <div key={i} className="bg-[#0f1117] rounded p-1.5">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[#6b7280]">{t.time.toFixed(2)}s</span>
              <span style={{ color: STATE_COLORS[t.from] }}>{t.from}</span>
              <span className="text-[#334155]">→</span>
              <span style={{ color: STATE_COLORS[t.to] }}>{t.to}</span>
            </div>
            <div className="text-[#6b7280] text-[10px] leading-snug">{t.reason}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
