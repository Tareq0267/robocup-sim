import { useState } from 'react'
import type { SimState, OverlaySettings, RobotParams, TeamConfig } from '../simulation/types'
import ParameterPanel from './ParameterPanel'
import OverlayPanel   from './OverlayPanel'

type Tab = 'params' | 'overlays'

interface Props {
  simState:      SimState
  setParam:      <K extends keyof RobotParams>(key: K, value: RobotParams[K]) => void
  setTeamConfig: <K extends keyof TeamConfig>(key: K, value: TeamConfig[K]) => void
  setOverlay:    <K extends keyof OverlaySettings>(key: K, value: boolean) => void
  setBallStatic: (v: boolean) => void
}

export default function LeftPanel({ simState, setParam, setTeamConfig, setOverlay, setBallStatic }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [tab, setTab] = useState<Tab>('params')

  if (collapsed) {
    return (
      <div className="w-9 flex-shrink-0 flex flex-col items-center bg-[#0d0d0d] border-r border-[#1e1e1e]">
        <button
          onClick={() => setCollapsed(false)}
          className="w-full py-2 flex justify-center text-[#475569] hover:text-[#94a3b8] hover:bg-[#161616] transition-colors text-sm"
          title="Expand"
        >
          ▶
        </button>
        <div className="flex-1 flex items-center justify-center">
          <span className="-rotate-90 text-[10px] text-[#2a2a2a] uppercase tracking-widest whitespace-nowrap select-none">
            {tab}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-72 flex-shrink-0 flex flex-col bg-[#0d0d0d] border-r border-[#1e1e1e]">
      <div className="flex items-stretch border-b border-[#1e1e1e] flex-shrink-0">
        {(['params', 'overlays'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-mono capitalize transition-colors ${
              tab === t
                ? 'text-[#e2e8f0] border-b-2 border-[#3b82f6] bg-[#111]'
                : 'text-[#475569] hover:text-[#94a3b8]'
            }`}
          >
            {t}
          </button>
        ))}
        <button
          onClick={() => setCollapsed(true)}
          className="px-3 text-[#2d3748] hover:text-[#64748b] hover:bg-[#161616] transition-colors text-xs"
          title="Collapse"
        >
          ◀
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === 'params'   && <ParameterPanel params={simState.robots[0].params} team={simState.team} setParam={setParam} setTeamConfig={setTeamConfig} />}
        {tab === 'overlays' && <OverlayPanel   simState={simState} setOverlay={setOverlay} setBallStatic={setBallStatic} />}
      </div>
    </div>
  )
}
