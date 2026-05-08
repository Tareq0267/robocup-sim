import { useState } from 'react'

const COLLAPSED_H = 28   // px — header strip only
const EXPANDED_H  = 160  // px — header + content

interface Props {
  onKickoff: (side: 'ours' | 'theirs') => void
}

export default function BottomBar({ onKickoff }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="flex-shrink-0 bg-[#0d0d0d] border-t border-[#1e1e1e] overflow-hidden transition-[height] duration-200 ease-in-out"
      style={{ height: open ? EXPANDED_H : COLLAPSED_H }}
    >
      {/* ── Header / toggle strip ───────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full px-4 bg-[#0d0d0d] hover:bg-[#111] transition-colors"
        style={{ height: COLLAPSED_H }}
      >
        <span className="text-[#475569] text-[9px]">{open ? '▼' : '▲'}</span>
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#475569]">
          Game Controller
        </span>
        <span className="ml-auto text-[10px] font-mono text-[#2d3748]">
          {open ? 'collapse' : 'expand'}
        </span>
      </button>

      {/* ── Content area ────────────────────────────────────── */}
      <div className="px-4 py-3 flex items-start gap-8 text-xs font-mono">

        {/* Match Phase */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-[#475569] mb-1">Match Phase</span>
          <div className="flex gap-1">
            <button
              onClick={() => onKickoff('ours')}
              className="px-2 py-1 rounded text-[11px] bg-[#0f1f0f] text-[#4ade80] border border-[#1a3a1a] hover:bg-[#1a3a1a] transition-colors"
            >
              Our Kickoff
            </button>
            <button
              onClick={() => onKickoff('theirs')}
              className="px-2 py-1 rounded text-[11px] bg-[#1a1008] text-[#fb923c] border border-[#3a2010] hover:bg-[#3a2010] transition-colors"
            >
              Their Kickoff
            </button>
            {(['Playing', 'Free Kick', 'Half Time'] as const).map(phase => (
              <button
                key={phase}
                disabled
                className="px-2 py-1 rounded text-[11px] bg-[#111] text-[#2d3748] border border-[#1e1e1e] cursor-not-allowed"
              >
                {phase}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-[#475569] mb-1">Robots</span>
          <div className="flex gap-1">
            {(['P1', 'P2', 'GK'] as const).map(r => (
              <button
                key={r}
                disabled
                className="px-2 py-1 rounded text-[11px] bg-[#111] text-[#2d3748] border border-[#1e1e1e] cursor-not-allowed"
              >
                {r} ON
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-[#475569] mb-1">Match Timer</span>
          <span className="text-[#2d3748] text-[11px]">00:00 — not implemented</span>
        </div>

        <div className="ml-auto self-center text-[10px] text-[#1e293b] italic">
          Full game controller coming soon
        </div>
      </div>
    </div>
  )
}
