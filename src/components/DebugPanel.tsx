import { useState } from 'react'
import type { SimState, OverlaySettings, RobotParams } from '../simulation/types'
import StateTab from './StateTab'
import ParameterPanel from './ParameterPanel'
import OverlayPanel from './OverlayPanel'

type Tab = 'state' | 'params' | 'overlays'

interface Props {
  simState:      SimState
  setParam:      <K extends keyof RobotParams>(key: K, value: RobotParams[K]) => void
  setOverlay:    <K extends keyof OverlaySettings>(key: K, value: boolean) => void
  setBallStatic: (v: boolean) => void
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'state',   label: 'State' },
  { id: 'params',  label: 'Params' },
  { id: 'overlays', label: 'Overlays' },
]

export default function DebugPanel({ simState, setParam, setOverlay, setBallStatic }: Props) {
  const [tab, setTab] = useState<Tab>('state')

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] border-l border-[#1e1e1e]">
      {/* Tab bar */}
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

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'state'   && <StateTab      simState={simState} />}
        {tab === 'params'  && <ParameterPanel params={simState.robot.params} setParam={setParam} />}
        {tab === 'overlays' && <OverlayPanel  simState={simState} setOverlay={setOverlay} setBallStatic={setBallStatic} />}
      </div>
    </div>
  )
}
