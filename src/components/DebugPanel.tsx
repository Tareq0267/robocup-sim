import { useState } from 'react'
import type { SimState, OverlaySettings, RobotParams, TeamConfig, GoalkeeperParams } from '../simulation/types'
import StateTab from './StateTab'
import ParameterPanel from './ParameterPanel'
import OverlayPanel from './OverlayPanel'

type Tab = 'state' | 'params' | 'overlays'

interface Props {
  simState:      SimState
  setParam:      <K extends keyof RobotParams>(key: K, value: RobotParams[K]) => void
  setTeamConfig: <K extends keyof TeamConfig>(key: K, value: TeamConfig[K]) => void
  setGKParam:    <K extends keyof GoalkeeperParams>(key: K, value: GoalkeeperParams[K]) => void
  setOverlay:    <K extends keyof OverlaySettings>(key: K, value: boolean) => void
  setBallStatic: (v: boolean) => void
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'state',   label: 'State' },
  { id: 'params',  label: 'Params' },
  { id: 'overlays', label: 'Overlays' },
]

export default function DebugPanel({ simState, setParam, setTeamConfig, setGKParam, setOverlay, setBallStatic }: Props) {
  const [tab, setTab] = useState<Tab>('state')
  const gkRobot = simState.robots.find(r => r.role === 'goalkeeper') ?? simState.robots[2]

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] border-l border-[#1e1e1e]">
      <div className="flex border-b border-[#1e1e1e] flex-shrink-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-xs font-mono transition-colors ${
              tab === t.id
                ? 'text-[#e2e8f0] border-b-2 border-[#3b82f6] bg-[#111]'
                : 'text-[#475569] hover:text-[#94a3b8]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === 'state'    && <StateTab      simState={simState} robotIndex={0} />}
        {tab === 'params'   && <ParameterPanel params={simState.robots[0].params} team={simState.team} gkParams={gkRobot.gkParams} setParam={setParam} setTeamConfig={setTeamConfig} setGKParam={setGKParam} />}
        {tab === 'overlays' && <OverlayPanel  simState={simState} setOverlay={setOverlay} setBallStatic={setBallStatic} />}
      </div>
    </div>
  )
}
