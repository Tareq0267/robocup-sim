import { useState, useRef, useEffect } from 'react'
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

const MIN_WIDTH     = 180
const MAX_WIDTH     = 560
const DEFAULT_WIDTH = 288

export default function LeftPanel({
  simState, setParam, setTeamConfig, setGKParam, setOverlay, setBallStatic,
  setEnemyMode, setEnemyParam, setEnemyGKParam,
}: Props) {
  const [collapsed,   setCollapsed]   = useState(false)
  const [tab,         setTab]         = useState<Tab>('params')
  const [width,       setWidth]       = useState(DEFAULT_WIDTH)
  const [showTuning,  setShowTuning]  = useState(false)
  const [tuningText,  setTuningText]  = useState('')
  const [tuningError, setTuningError] = useState('')
  const [copied,      setCopied]      = useState(false)

  const isResizing = useRef(false)
  const dragStartX = useRef(0)
  const dragStartW = useRef(DEFAULT_WIDTH)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const delta = e.clientX - dragStartX.current
      setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, dragStartW.current + delta)))
    }
    const onUp = () => { isResizing.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [])

  const onHandleDown = (e: React.MouseEvent) => {
    isResizing.current = true
    dragStartX.current = e.clientX
    dragStartW.current = width
    e.preventDefault()
  }

  function buildSnapshot() {
    return {
      params:   simState.robots[0].params,
      gkParams: (simState.robots.find(r => r.role === 'goalkeeper') ?? simState.robots[2]).gkParams,
      team:     simState.team,
    }
  }

  function openTuning() {
    setTuningText(JSON.stringify(buildSnapshot(), null, 2))
    setTuningError('')
    setShowTuning(true)
  }

  function copyToClipboard() {
    const text = JSON.stringify(buildSnapshot(), null, 2)
    setTuningText(text)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  function applyTuning() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const snap: any = JSON.parse(tuningText)
      if (snap.params && typeof snap.params === 'object') {
        for (const k of Object.keys(snap.params) as (keyof RobotParams)[])
          setParam(k, snap.params[k])
      }
      if (snap.gkParams && typeof snap.gkParams === 'object') {
        for (const k of Object.keys(snap.gkParams) as (keyof GoalkeeperParams)[])
          setGKParam(k, snap.gkParams[k])
      }
      if (snap.team && typeof snap.team === 'object') {
        for (const k of Object.keys(snap.team) as (keyof TeamConfig)[])
          setTeamConfig(k, snap.team[k])
      }
      setTuningError('')
      setShowTuning(false)
    } catch {
      setTuningError('Invalid JSON — check the format and try again.')
    }
  }

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
  const contentZoom   = Math.max(0.8, Math.min(1.5, width / DEFAULT_WIDTH))
  const contentStyle  = { zoom: contentZoom, height: `calc(100% / ${contentZoom})` } as React.CSSProperties

  return (
    <div
      style={{ width }}
      className="flex-shrink-0 flex flex-col bg-[#0d0d0d] border-r border-[#1e1e1e] relative"
    >
      {/* Tab bar */}
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

      {/* Content — text scales with panel width */}
      <div className="flex-1 overflow-hidden" style={contentStyle}>
        {tab === 'params' && (
          <div className="flex flex-col h-full overflow-hidden">

            {/* Export / Import strip */}
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[#1e1e1e] flex-shrink-0">
              <span className="text-[10px] text-[#2d3748] uppercase tracking-widest font-mono">Tuning</span>
              <div className="ml-auto flex gap-1">
                <button
                  onClick={copyToClipboard}
                  className="px-2 py-0.5 text-[10px] font-mono rounded border border-[#1e3a5f] text-[#60a5fa] hover:bg-[#1e293b] transition-colors"
                  title="Copy current params as JSON"
                >
                  {copied ? '✓ copied' : '⬆ export'}
                </button>
                <button
                  onClick={() => showTuning ? setShowTuning(false) : openTuning()}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors ${
                    showTuning
                      ? 'border-[#334155] text-[#475569] hover:bg-[#161616]'
                      : 'border-[#1a3a1a] text-[#4ade80] hover:bg-[#1a2e1a]'
                  }`}
                  title="Paste JSON to import params"
                >
                  {showTuning ? '✕ cancel' : '⬇ import'}
                </button>
              </div>
            </div>

            {/* Import panel */}
            {showTuning && (
              <div className="flex flex-col gap-1.5 p-2 border-b border-[#1e1e1e] flex-shrink-0 bg-[#080808]">
                <textarea
                  value={tuningText}
                  onChange={e => { setTuningText(e.target.value); setTuningError('') }}
                  className="w-full h-36 text-[10px] font-mono bg-[#0d0d0d] text-[#94a3b8] border border-[#2a2a2a] rounded p-1.5 resize-none focus:outline-none focus:border-[#4ade8044] leading-relaxed"
                  placeholder="Paste exported JSON here…"
                  spellCheck={false}
                />
                {tuningError && (
                  <span className="text-[10px] font-mono text-[#ef4444]">{tuningError}</span>
                )}
                <button
                  onClick={applyTuning}
                  className="w-full py-1 text-[10px] font-mono rounded border border-[#4ade8033] text-[#4ade80] bg-[#0d1a0d] hover:bg-[#1a2e1a] transition-colors"
                >
                  Apply
                </button>
              </div>
            )}

            <div className="flex-1 overflow-hidden">
              <ParameterPanel
                params={simState.robots[0].params}
                team={simState.team}
                gkParams={(simState.robots.find(r => r.role === 'goalkeeper') ?? simState.robots[2]).gkParams}
                setParam={setParam}
                setTeamConfig={setTeamConfig}
                setGKParam={setGKParam}
              />
            </div>
          </div>
        )}

        {tab === 'overlays' && <OverlayPanel simState={simState} setOverlay={setOverlay} setBallStatic={setBallStatic} />}

        {tab === 'enemy' && (
          <div className="flex flex-col h-full">
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

      {/* Resize handle — right edge */}
      <div
        onMouseDown={onHandleDown}
        className="absolute top-0 right-0 h-full w-2 cursor-col-resize z-10 group"
        title="Drag to resize"
      >
        <div className="absolute inset-y-0 right-0 w-px bg-[#1e1e1e] group-hover:bg-[#3b82f6] group-active:bg-[#3b82f6] transition-colors" />
      </div>
    </div>
  )
}
