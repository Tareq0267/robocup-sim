import { useState } from 'react'
import type { SimState, OverlaySettings, RobotParams, TeamConfig, GoalkeeperParams, EnemyMode } from '../simulation/types'
import ParameterPanel from './ParameterPanel'
import OverlayPanel   from './OverlayPanel'

type Tab = 'params' | 'overlays' | 'enemy'

interface Props {
  simState:        SimState
  setParam:        <K extends keyof RobotParams>(key: K, value: RobotParams[K]) => void
  setTeamConfig:   <K extends keyof TeamConfig>(key: K, value: TeamConfig[K]) => void
  setGKParam:      <K extends keyof GoalkeeperParams>(key: K, value: GoalkeeperParams[K]) => void
  setOverlay:      <K extends keyof OverlaySettings>(key: K, value: boolean) => void
  setBallStatic:   (v: boolean) => void
  setEnemyMode:    (mode: EnemyMode) => void
  setEnemyParam:   <K extends keyof RobotParams>(key: K, value: RobotParams[K]) => void
  setEnemyGKParam: <K extends keyof GoalkeeperParams>(key: K, value: GoalkeeperParams[K]) => void
}

const ENEMY_MODE_CYCLE: Record<EnemyMode, EnemyMode> = { off: 'static', static: 'active', active: 'off' }
const ENEMY_MODE_LABEL: Record<EnemyMode, string>    = { off: 'Off', static: 'Static', active: 'Active' }
const ENEMY_MODE_COLOR: Record<EnemyMode, string>    = {
  off:    'text-[#475569] border-[#2a2a2a]',
  static: 'text-[#f59e0b] border-[#f59e0b44]',
  active: 'text-[#ef4444] border-[#ef444444]',
}

export default function LeftPanel({
  simState, setParam, setTeamConfig, setGKParam, setOverlay, setBallStatic,
  setEnemyMode, setEnemyParam, setEnemyGKParam,
}: Props) {
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

  const enemyGkParams = (simState.enemyRobots.find(r => r.role === 'goalkeeper') ?? simState.enemyRobots[2]).gkParams
  const enemyParams   = simState.enemyRobots[0].params

  return (
    <div className="w-72 flex-shrink-0 flex flex-col bg-[#0d0d0d] border-r border-[#1e1e1e]">
      <div className="flex items-stretch border-b border-[#1e1e1e] flex-shrink-0">
        {(['params', 'overlays', 'enemy'] as Tab[]).map(t => (
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
        {tab === 'params'   && <ParameterPanel params={simState.robots[0].params} team={simState.team} gkParams={(simState.robots.find(r => r.role === 'goalkeeper') ?? simState.robots[2]).gkParams} setParam={setParam} setTeamConfig={setTeamConfig} setGKParam={setGKParam} />}
        {tab === 'overlays' && <OverlayPanel   simState={simState} setOverlay={setOverlay} setBallStatic={setBallStatic} />}
        {tab === 'enemy'    && (
          <div className="flex flex-col h-full">
            {/* Mode toggle */}
            <div className="flex items-center gap-3 px-3 py-3 border-b border-[#1e1e1e] flex-shrink-0">
              <span className="text-[10px] text-[#475569] uppercase tracking-widest">Enemy Team</span>
              <button
                onClick={() => setEnemyMode(ENEMY_MODE_CYCLE[simState.enemyMode])}
                className={`ml-auto px-3 py-1 rounded border text-xs font-mono font-semibold transition-colors ${ENEMY_MODE_COLOR[simState.enemyMode]}`}
              >
                {ENEMY_MODE_LABEL[simState.enemyMode]}
              </button>
            </div>
            {simState.enemyMode === 'off' ? (
              <div className="flex-1 flex items-center justify-center text-[#2d3748] text-xs font-mono text-center px-4">
                Enemy team disabled.<br />Click the toggle to enable.
              </div>
            ) : (
              <div className="flex-1 overflow-hidden">
                <ParameterPanel
                  params={enemyParams}
                  gkParams={enemyGkParams}
                  setParam={setEnemyParam}
                  setGKParam={setEnemyGKParam}
                  hideTeamConfig
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
