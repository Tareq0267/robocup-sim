import { useState, useRef, useEffect } from 'react'
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

const MIN_WIDTH     = 180
const MAX_WIDTH     = 560
const DEFAULT_WIDTH = 288  // matches old w-72

export default function RightPanel({ simState, onFocusChange }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [tab,       setTab]       = useState<Tab>('team')
  const [width,     setWidth]     = useState(DEFAULT_WIDTH)

  const isResizing  = useRef(false)
  const dragStartX  = useRef(0)
  const dragStartW  = useRef(DEFAULT_WIDTH)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      // Dragging left from the left edge makes the panel wider
      const delta = e.clientX - dragStartX.current
      setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, dragStartW.current - delta)))
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
          className="w-full py-2 flex justify-center text-[#6b7280] hover:text-[#94a3b8] hover:bg-[#161616] transition-colors text-sm"
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

  const contentZoom  = Math.max(0.8, Math.min(1.5, width / DEFAULT_WIDTH))
  const contentStyle = { zoom: contentZoom, height: `calc(100% / ${contentZoom})` } as React.CSSProperties

  return (
    <div
      style={{ width }}
      className="flex-shrink-0 flex flex-col bg-[#0d0d0d] border-l border-[#1e1e1e] relative"
    >
      {/* Resize handle — left edge */}
      <div
        onMouseDown={onHandleDown}
        className="absolute top-0 left-0 h-full w-2 cursor-col-resize z-10 group"
        title="Drag to resize"
      >
        <div className="absolute inset-y-0 left-0 w-px bg-[#1e1e1e] group-hover:bg-[#3b82f6] group-active:bg-[#3b82f6] transition-colors" />
      </div>

      <div className="flex items-stretch border-b border-[#1e1e1e] flex-shrink-0">
        <button
          onClick={() => setCollapsed(true)}
          className="px-3 text-[#64748b] hover:text-[#64748b] hover:bg-[#161616] transition-colors text-xs"
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
                : 'text-[#6b7280] hover:text-[#94a3b8]'
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

      {/* Content — text scales with panel width */}
      <div className="flex-1 overflow-hidden" style={contentStyle}>
        {tab === 'team' && <TeamTab       simState={simState} />}
        {tab === 'p1'   && <StateTab      simState={simState} robotIndex={0} />}
        {tab === 'p2'   && <StateTab      simState={simState} robotIndex={1} />}
        {tab === 'gk'   && <GoalkeeperTab simState={simState} />}
      </div>
    </div>
  )
}
