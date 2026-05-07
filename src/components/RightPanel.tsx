import { useState } from 'react'
import type { SimState } from '../simulation/types'
import TeamTab       from './TeamTab'
import StateTab      from './StateTab'
import GoalkeeperTab from './GoalkeeperTab'

type Tab = 'team' | 'p1' | 'p2' | 'gk'

interface Props {
  simState:      SimState
  onFocusChange: (robot: number | null) => void
}

const PLAYER_COLORS = ['#3b82f6', '#14b8a6']

export default function RightPanel({ simState, onFocusChange }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [tab, setTab] = useState<Tab>('team')

  function changeTab(t: Tab) {
    setTab(t)
    if (t === 'team')     onFocusChange(null)
    else if (t === 'p1')  onFocusChange(0)
    else if (t === 'p2')  onFocusChange(1)
    else /* gk */         onFocusChange(simState.robots.findIndex(r => r.role === 'goalkeeper'))
  }

  if (collapsed) {
    return (
      <div className="w-9 flex-shrink-0 flex flex-col items-center bg-[#0d0d0d] border-l border-[#1e1e1e]">
        <button
          onClick={() => setCollapsed(false)}
          className="w-full py-2 flex justify-center text-[#475569] hover:text-[#94a3b8] hover:bg-[#161616] transition-colors text-sm"
          title="Expand"
        >
          ◀
        </button>
        <div className="flex-1 flex items-center justify-center">
          <span className="rotate-90 text-[10px] text-[#2a2a2a] uppercase tracking-widest whitespace-nowrap select-none">
            state
          </span>
        </div>
      </div>
    )
  }

  const tabs: { id: Tab; label: string; color?: string }[] = [
    { id: 'team', label: 'Team' },
    { id: 'p1',   label: 'P1',  color: PLAYER_COLORS[0] },
    { id: 'p2',   label: 'P2',  color: PLAYER_COLORS[1] },
    { id: 'gk',   label: 'GK',  color: '#f97316' },
  ]

  return (
    <div className="w-72 flex-shrink-0 flex flex-col bg-[#0d0d0d] border-l border-[#1e1e1e]">
      <div className="flex items-stretch border-b border-[#1e1e1e] flex-shrink-0">
        <button
          onClick={() => setCollapsed(true)}
          className="px-3 text-[#2d3748] hover:text-[#64748b] hover:bg-[#161616] transition-colors text-xs"
          title="Collapse"
        >
          ▶
        </button>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => changeTab(t.id)}
            className={`flex-1 py-2 text-xs font-mono transition-colors ${
              tab === t.id
                ? 'bg-[#111] border-b-2'
                : 'text-[#475569] hover:text-[#94a3b8]'
            }`}
            style={tab === t.id ? {
              color:       t.color ?? '#e2e8f0',
              borderColor: t.color ?? '#3b82f6',
            } : { color: t.color ? t.color + '99' : undefined }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === 'team' && <TeamTab       simState={simState} />}
        {tab === 'p1'   && <StateTab      simState={simState} robotIndex={0} />}
        {tab === 'p2'   && <StateTab      simState={simState} robotIndex={1} />}
        {tab === 'gk'   && <GoalkeeperTab simState={simState} />}
      </div>
    </div>
  )
}
