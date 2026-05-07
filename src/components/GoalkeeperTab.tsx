import type { SimState } from '../simulation/types'

const GK_STATE_COLORS: Record<string, string> = {
  FIND_BALL:    '#a855f7',
  RETREAT:      '#64748b',
  ADJUST_BLOCK: '#22d3ee',
  CHASE:        '#f97316',
  KICK:         '#ef4444',
}

const GK_COLOR = '#f97316'

interface Props { simState: SimState }

function Row({ label, value, unit = '', color = '' }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-0.5 border-b border-[#1e1e1e]">
      <span className="text-[#64748b] text-xs">{label}</span>
      <span className={`text-xs font-mono ${color || 'text-[#e2e8f0]'}`}>
        {typeof value === 'number' ? value.toFixed(3) : value}
        {unit && <span className="text-[#475569] ml-1">{unit}</span>}
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
      <div className="text-[10px] text-[#475569] uppercase tracking-widest mb-1 mt-2">{title}</div>
      {children}
    </div>
  )
}

export default function GoalkeeperTab({ simState }: Props) {
  const { goalkeeper: gk, goalkeeperDebug: debug, ball, time } = simState
  const color = GK_STATE_COLORS[gk.state] ?? GK_COLOR

  return (
    <div className="p-3 overflow-y-auto h-full text-xs font-mono">

      {/* State badge */}
      <div
        className="rounded px-3 py-2 mb-1 text-center font-bold text-sm"
        style={{ backgroundColor: color + '22', border: `1px solid ${color}55`, color }}
      >
        {gk.state}
      </div>

      <div className="rounded px-2 py-1 mb-3 text-center text-[10px] uppercase tracking-widest bg-[#1a1a1a] border border-[#2a2a2a]"
        style={{ color: GK_COLOR }}>
        ● GOALKEEPER
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
        <Row label="FOV half-limit" value={(gk.params.fieldOfView / 2 * 180 / Math.PI).toFixed(1)} unit="°" />
        <Bool label="Can see ball" value={debug.canSeeBall} />
      </Section>

      <Section title="Ball">
        <Row label="Distance" value={debug.distanceToBall} unit="m" />
        <Row label="pos x"    value={ball.pos.x} unit="m" />
        <Row label="pos y"    value={ball.pos.y} unit="m" />
        <Bool label="In penalty area" value={debug.ballInPenaltyArea} />
      </Section>

      <Section title="Alignment">
        <Row
          label="Body error" value={(debug.alignmentError * 180 / Math.PI).toFixed(2)} unit="°"
          color={debug.alignmentError <= gk.params.alignThreshold ? 'text-[#22c55e]' : 'text-[#f97316]'}
        />
        <Row label="Kick tolerance" value={(gk.params.alignThreshold * 180 / Math.PI).toFixed(2)} unit="°" />
      </Section>

      <Section title="Position">
        <Row label="pos x"       value={gk.pos.x} unit="m" />
        <Row label="pos y"       value={gk.pos.y} unit="m" />
        <Row label="orientation" value={(gk.orientation * 180 / Math.PI).toFixed(1)} unit="°" />
      </Section>

      {/* Transition log */}
      <div className="text-[10px] text-[#475569] uppercase tracking-widest mb-1 mt-3">Transition Log</div>
      <div className="space-y-1">
        {debug.stateHistory.length === 0 && (
          <div className="text-[#334155] text-xs italic">no transitions yet</div>
        )}
        {debug.stateHistory.map((t, i) => (
          <div key={i} className="bg-[#0f1117] rounded p-1.5">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[#475569]">{t.time.toFixed(2)}s</span>
              <span style={{ color: GK_STATE_COLORS[t.from] ?? '#60a5fa' }}>{t.from}</span>
              <span className="text-[#334155]">→</span>
              <span style={{ color: GK_STATE_COLORS[t.to] ?? '#60a5fa' }}>{t.to}</span>
            </div>
            <div className="text-[#475569] text-[10px] leading-snug">{t.reason}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
