import { useState } from 'react'
import type { GameControllerState, GcFreeKickType, GcGameState, GcSubState } from '../simulation/types'

const COLLAPSED_H = 36
const EXPANDED_H  = 264

interface Props {
  gc:              GameControllerState
  isPlaying:       boolean
  time:            number
  score:           { ours: number; theirs: number }
  penalties:       [boolean, boolean, boolean]
  updateGc:        <K extends keyof GameControllerState>(key: K, value: GameControllerState[K]) => void
  scoreGoal:       (side: 'ours' | 'theirs') => void
  triggerSetPiece: (type: GcFreeKickType, side: 'ours' | 'theirs') => void
}

function formatTime(t: number): string {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function Btn({
  label, onClick, active = false, activeClass = '', className = '', disabled = false,
}: {
  label: string; onClick: () => void
  active?: boolean; activeClass?: string; className?: string; disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors whitespace-nowrap
        ${active
          ? activeClass
          : 'bg-[#111] text-[#6b7280] border-[#262626] hover:text-[#9ca3af] hover:border-[#374151]'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        ${className}`}
    >
      {label}
    </button>
  )
}

const GS_ACTIVE: Record<GcGameState, string> = {
  INITIAL: 'bg-[#12122a] text-[#818cf8] border-[#3d3d7e]',
  READY:   'bg-[#1c1800] text-[#fbbf24] border-[#4a3d00]',
  SET:     'bg-[#1c0e00] text-[#fb923c] border-[#4a2a00]',
  PLAY:    'bg-[#0f1f0f] text-[#4ade80] border-[#1e4d1e]',
  END:     'bg-[#1f0f0f] text-[#f87171] border-[#4d1e1e]',
}

const GAME_STATES: { state: GcGameState; label: string }[] = [
  { state: 'INITIAL', label: 'Initial'  },
  { state: 'READY',   label: 'Ready'    },
  { state: 'SET',     label: 'Set'      },
  { state: 'PLAY',    label: '▶  Play'  },
  { state: 'END',     label: 'End'      },
]

const FK_SUB: { state: GcSubState; label: string; active: string }[] = [
  { state: 'STOP',      label: '■  Stop',      active: 'bg-[#1f0f0f] text-[#f87171] border-[#4d1e1e]' },
  { state: 'GET_READY', label: '→  Get Ready',  active: 'bg-[#1c1800] text-[#fbbf24] border-[#4a3d00]' },
  { state: 'SET',       label: '●  Set',        active: 'bg-[#0f1f0f] text-[#4ade80] border-[#1e4d1e]' },
]

export default function BottomBar({
  gc, isPlaying, time, score, penalties,
  updateGc, scoreGoal, triggerSetPiece,
}: Props) {
  const [open, setOpen] = useState(false)
  const isFk = gc.subStateType === 'FREE_KICK'

  function togglePenalty(i: 0 | 1 | 2) {
    const next: [boolean, boolean, boolean] = [...penalties] as [boolean, boolean, boolean]
    next[i] = !next[i]
    updateGc('penalties', next)
  }

  function handleStateClick(state: GcGameState) {
    updateGc('gameState', state)
    if (isFk && state !== 'PLAY') updateGc('subStateType', 'NONE')
  }

  const stateBadgeClass = isPlaying
    ? 'bg-[#0f1f0f] text-[#4ade80] border-[#1e4d1e]'
    : isFk
    ? 'bg-[#0e1020] text-[#a78bfa] border-[#2d2060]'
    : 'bg-[#111] text-[#6b7280] border-[#262626]'

  return (
    <div
      className="flex-shrink-0 bg-[#0d0d0d] border-t border-[#1e1e1e] overflow-hidden transition-[height] duration-200 ease-in-out"
      style={{ height: open ? EXPANDED_H : COLLAPSED_H }}
    >
      {/* ── Collapsed header ────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center w-full px-4 gap-3 hover:bg-[#111] transition-colors"
        style={{ height: COLLAPSED_H }}
      >
        {/* Toggle arrow */}
        <span className="text-[#374151] text-[10px]">{open ? '▼' : '▲'}</span>

        {/* Label */}
        <span className="text-[11px] font-mono uppercase tracking-widest text-[#4b5563]">
          Game Controller
        </span>

        {/* State badge */}
        <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${stateBadgeClass}`}>
          {isPlaying ? '▶ PLAYING' : isFk ? `FK · ${gc.freeKickType.replace('_',' ')}` : gc.gameState}
        </span>

        {/* Score summary */}
        <div className="flex items-center gap-2 ml-1">
          <span className="text-sm font-mono font-bold text-[#4ade80]">{score.ours}</span>
          <span className="text-[10px] font-mono text-[#374151]">—</span>
          <span className="text-sm font-mono font-bold text-[#f87171]">{score.theirs}</span>
        </div>

        {/* Timer */}
        <span className="text-[11px] font-mono text-[#4b5563] tabular-nums">
          {formatTime(time)}
        </span>

        <span className="ml-auto text-[10px] font-mono text-[#262626]">
          {open ? 'collapse' : 'expand'}
        </span>
      </button>

      {/* ── Expanded — 3-column GC layout ───────────────────────── */}
      <div className="flex w-full" style={{ height: EXPANDED_H - COLLAPSED_H }}>

        {/* ── LEFT — Our Team ─────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 border-r border-[#1e1e1e] px-6">
          <span className="text-[11px] font-mono uppercase tracking-widest text-[#4ade80] font-semibold">
            Our Team
          </span>

          <button
            onClick={() => scoreGoal('ours')}
            className="w-full max-w-[120px] py-2 rounded text-sm font-mono font-semibold border cursor-pointer
              bg-[#0f1a0f] text-[#4ade80] border-[#1e4d1e] hover:bg-[#1a3a1a] transition-colors"
          >
            + Goal
          </button>

          <div className="flex flex-col gap-1.5 w-full max-w-[160px] opacity-40 pointer-events-none select-none">
            <span className="text-[10px] font-mono text-[#374151] uppercase tracking-widest">Penalties</span>
            <div className="flex gap-2">
              {(['P1', 'P2', 'GK'] as const).map((label, i) => (
                <button
                  key={label}
                  disabled
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs font-mono border cursor-not-allowed transition-colors ${
                    penalties[i]
                      ? 'bg-[#1f0a0a] text-[#f87171] border-[#4d1010]'
                      : 'bg-[#111] text-[#6b7280] border-[#262626]'
                  }`}
                >
                  <span className={`text-[8px] ${penalties[i] ? 'text-[#f87171]' : 'text-[#374151]'}`}>●</span>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── CENTER — Match controls ──────────────────────────── */}
        <div className="flex-[2] flex flex-col items-center justify-center gap-3 px-8">

          {/* Score + Timer */}
          <div className="flex items-center gap-8">
            <span className="text-4xl font-mono font-bold text-[#4ade80]">{score.ours}</span>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-2xl font-mono text-[#9ca3af] tabular-nums font-semibold">
                {formatTime(time)}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#4b5563]">
                {gc.firstHalf ? '1st Half' : '2nd Half'}
              </span>
            </div>
            <span className="text-4xl font-mono font-bold text-[#f87171]">{score.theirs}</span>
          </div>

          {/* Greyed-out controls — full match control coming in a future update */}
          <div className="flex flex-col items-center gap-3 opacity-30 pointer-events-none select-none">

            {/* Game state row */}
            <div className="flex gap-1.5">
              {GAME_STATES.map(({ state, label }) => (
                <Btn
                  key={state} label={label}
                  active={false}
                  activeClass=""
                  onClick={() => {}}
                />
              ))}
            </div>

            {/* Set pieces */}
            <div className="flex items-center gap-1 flex-wrap justify-center">
              {([
                { type: 'THROW_IN'  as GcFreeKickType, label: 'Throw-In'   },
                { type: 'CORNER'    as GcFreeKickType, label: 'Corner'      },
                { type: 'GOAL_KICK' as GcFreeKickType, label: 'Goal Kick'   },
                { type: 'DIRECT'    as GcFreeKickType, label: 'Direct FK'   },
                { type: 'INDIRECT'  as GcFreeKickType, label: 'Indirect FK' },
                { type: 'PENALTY'   as GcFreeKickType, label: 'Penalty'     },
              ]).map(({ type, label }) => (
                <div key={type} className="flex">
                  <Btn label={`${label} ↑`} active={false} activeClass="" className="rounded-r-none border-r-0" onClick={() => {}} />
                  <Btn label="↓"            active={false} activeClass="" className="rounded-l-none"            onClick={() => {}} />
                </div>
              ))}
            </div>

          </div>

          {/* Coming soon note */}
          <span className="text-[10px] font-mono text-[#374151] tracking-wide">
            Full match controls available in a future update
          </span>
        </div>

        {/* ── RIGHT — Their Team ───────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 border-l border-[#1e1e1e] px-6">
          <span className="text-[11px] font-mono uppercase tracking-widest text-[#f87171] font-semibold">
            Their Team
          </span>

          <button
            onClick={() => scoreGoal('theirs')}
            className="w-full max-w-[120px] py-2 rounded text-sm font-mono font-semibold border cursor-pointer
              bg-[#1a0f0f] text-[#f87171] border-[#4d1e1e] hover:bg-[#3a1a1a] transition-colors"
          >
            + Goal
          </button>

          <div className="text-[10px] font-mono text-[#262626] text-center leading-relaxed">
            Opponent controlled<br />externally
          </div>
        </div>

      </div>
    </div>
  )
}
