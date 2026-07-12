import { useState } from 'react'
import type { GameControllerState, GcFreeKickType, GcGameState, GcSubState } from '../simulation/types'

const COLLAPSED_H = 36
const EXPANDED_H  = 292

interface Props {
  gc:               GameControllerState
  isPlaying:        boolean
  time:             number
  score:            { ours: number; theirs: number }
  autoGoal:         boolean
  kickoffCountdown: number
  penalties:        boolean[]
  updateGc:         <K extends keyof GameControllerState>(key: K, value: GameControllerState[K]) => void
  scoreGoal:        (side: 'ours' | 'theirs') => void
  setAutoGoal:      (v: boolean) => void
  triggerSetPiece:  (type: GcFreeKickType, side: 'ours' | 'theirs') => void
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
      className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-colors whitespace-nowrap
        ${active
          ? activeClass
          : 'bg-[#0d0d0d] text-[#64748b] border-[#1e1e1e] hover:text-[#9ca3af] hover:border-[#4b5563]'}
        ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
        ${className}`}
    >
      {label}
    </button>
  )
}

const GS_ACTIVE: Record<GcGameState, string> = {
  INITIAL: 'bg-[#0e0e1f] text-[#818cf8] border-[#3730a3]',
  READY:   'bg-[#1c1600] text-[#fbbf24] border-[#78350f]',
  SET:     'bg-[#1c0e00] text-[#fb923c] border-[#7c2d12]',
  PLAY:    'bg-[#0a1a0a] text-[#4ade80] border-[#166534]',
  END:     'bg-[#1a0a0a] text-[#f87171] border-[#7f1d1d]',
}

const GAME_STATES: { state: GcGameState; label: string }[] = [
  { state: 'INITIAL', label: 'Initial' },
  { state: 'READY',   label: 'Ready'   },
  { state: 'SET',     label: 'Set'     },
  { state: 'PLAY',    label: '▶ Play'  },
  { state: 'END',     label: 'End'     },
]

const FK_SUB: { state: GcSubState; label: string; active: string }[] = [
  { state: 'STOP',      label: '■ Stop',      active: 'bg-[#1a0a0a] text-[#f87171] border-[#7f1d1d]' },
  { state: 'GET_READY', label: '→ Get Ready', active: 'bg-[#1c1600] text-[#fbbf24] border-[#78350f]' },
  { state: 'SET',       label: '● Set',       active: 'bg-[#0a1a0a] text-[#4ade80] border-[#166534]' },
]

const SET_PIECES: { type: GcFreeKickType; label: string }[] = [
  { type: 'THROW_IN',  label: 'Throw-In'    },
  { type: 'CORNER',    label: 'Corner'      },
  { type: 'GOAL_KICK', label: 'Goal Kick'   },
  { type: 'DIRECT',    label: 'Direct FK'   },
  { type: 'INDIRECT',  label: 'Indirect FK' },
  { type: 'PENALTY',   label: 'Penalty'     },
]

export default function BottomBar({
  gc, isPlaying, time, score, autoGoal, kickoffCountdown, penalties,
  updateGc, scoreGoal, setAutoGoal, triggerSetPiece,
}: Props) {
  const [open, setOpen] = useState(false)
  const isFk = gc.subStateType === 'FREE_KICK'

  function togglePenalty(i: number) {
    const next = [...penalties]
    next[i] = !next[i]
    updateGc('penalties', next)
  }

  function handleStateClick(state: GcGameState) {
    updateGc('gameState', state)
    if (isFk && state !== 'PLAY') updateGc('subStateType', 'NONE')
  }

  const isCountdown = kickoffCountdown > 0
  const stateBadgeClass = isCountdown
    ? 'bg-[#1c1600] text-[#fbbf24] border-[#78350f]'
    : isPlaying
    ? 'bg-[#0a1a0a] text-[#4ade80] border-[#166534]'
    : isFk
    ? 'bg-[#0e0e1f] text-[#a78bfa] border-[#3730a3]'
    : 'bg-[#0d0d0d] text-[#64748b] border-[#1e1e1e]'

  const showKickoff = gc.gameState === 'READY' || gc.gameState === 'INITIAL'

  return (
    <div
      className="flex-shrink-0 bg-[#0a0a0a] border-t border-[#1e1e1e] overflow-hidden transition-[height] duration-200 ease-in-out"
      style={{ height: open ? EXPANDED_H : COLLAPSED_H }}
    >
      {/* ── Collapsed header ─────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center w-full px-4 gap-3 hover:bg-[#111] transition-colors"
        style={{ height: COLLAPSED_H }}
      >
        <span className="text-[10px] text-[#64748b]">{open ? '▼' : '▲'}</span>

        <span className="text-[11px] font-mono uppercase tracking-widest text-[#64748b]">
          Game Controller
        </span>

        <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${stateBadgeClass}`}>
          {isCountdown ? `▶ ${Math.ceil(kickoffCountdown)}s` : isPlaying ? '▶ PLAYING' : isFk ? `FK · ${gc.freeKickType.replace('_', ' ')}` : gc.gameState}
        </span>

        <span className="text-sm font-mono font-bold text-[#4ade80] tabular-nums">{score.ours}</span>
        <span className="text-[10px] font-mono text-[#1e1e1e]">—</span>
        <span className="text-sm font-mono font-bold text-[#f87171] tabular-nums">{score.theirs}</span>

        <span className="text-[11px] font-mono text-[#64748b] tabular-nums">{formatTime(time)}</span>

        <span className="ml-auto text-[10px] font-mono text-[#1e1e1e]">{open ? 'collapse' : 'expand'}</span>
      </button>

      {/* ── Expanded ─────────────────────────────────────────── */}
      <div className="flex w-full" style={{ height: EXPANDED_H - COLLAPSED_H }}>

        {/* LEFT — Our Team */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 border-r border-[#1e1e1e] px-5">
          <span className="text-xs font-mono uppercase tracking-widest text-[#4ade80] font-semibold">
            Our Team
          </span>

          <button
            onClick={() => scoreGoal('ours')}
            className="w-full max-w-[140px] py-2.5 rounded text-sm font-mono font-bold border
              bg-[#0a1a0a] text-[#4ade80] border-[#166534] hover:bg-[#122212] transition-colors"
          >
            + Goal
          </button>

          <div className="flex flex-col gap-1.5 w-full max-w-[150px] opacity-25 pointer-events-none select-none">
            <span className="text-[10px] font-mono text-[#64748b] uppercase tracking-widest">Penalties</span>
            <div className="flex gap-1.5">
              {(['P1', 'P2', 'GK'] as const).map((label, i) => (
                <button
                  key={label}
                  onClick={() => togglePenalty(i as 0 | 1 | 2)}
                  className={`flex-1 py-1.5 rounded text-[11px] font-mono border transition-colors ${
                    penalties[i]
                      ? 'bg-[#1a0a0a] text-[#f87171] border-[#7f1d1d] hover:bg-[#220e0e]'
                      : 'bg-[#0d0d0d] text-[#64748b] border-[#1e1e1e] hover:text-[#9ca3af] hover:border-[#4b5563]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER — Match controls */}
        <div className="flex-[2.2] flex flex-col items-center justify-center gap-2 px-6">

          {/* Auto goal toggle */}
          <button
            onClick={() => setAutoGoal(!autoGoal)}
            className={`px-3 py-1 rounded text-[11px] font-mono border transition-colors ${
              autoGoal
                ? 'bg-[#0a1a0a] text-[#4ade80] border-[#166534]'
                : 'bg-[#0d0d0d] text-[#64748b] border-[#1e1e1e] hover:text-[#9ca3af] hover:border-[#4b5563]'
            }`}
          >
            {autoGoal ? '⬤ Auto Goal On' : '○ Auto Goal Off'}
          </button>

          {/* Score + timer */}
          <div className="flex items-baseline gap-6">
            <span className="text-3xl font-mono font-bold text-[#4ade80] tabular-nums">{score.ours}</span>
            <span className="text-sm font-mono text-[#64748b] tabular-nums">{formatTime(time)}</span>
            <span className="text-3xl font-mono font-bold text-[#f87171] tabular-nums">{score.theirs}</span>
          </div>

          {/* Game controls — greyed out pending full GC integration */}
          <div className="opacity-25 pointer-events-none select-none flex flex-col items-center gap-2">

            {/* Game state buttons */}
            <div className="flex gap-1">
              {GAME_STATES.map(({ state, label }) => (
                <Btn
                  key={state} label={label}
                  active={gc.gameState === state}
                  activeClass={GS_ACTIVE[state]}
                  onClick={() => handleStateClick(state)}
                />
              ))}
            </div>

            {/* Kickoff side — shown in INITIAL / READY */}
            {showKickoff && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-[#64748b] uppercase tracking-widest">Kickoff</span>
                {(['ours', 'theirs'] as const).map(side => (
                  <Btn
                    key={side}
                    label={side === 'ours' ? 'Ours ↑' : '↓ Theirs'}
                    active={gc.kickoffSide === side}
                    activeClass={
                      side === 'ours'
                        ? 'bg-[#0a1a0a] text-[#4ade80] border-[#166534]'
                        : 'bg-[#1a0a0a] text-[#f87171] border-[#7f1d1d]'
                    }
                    onClick={() => updateGc('kickoffSide', side)}
                  />
                ))}
              </div>
            )}

            {/* FK sub-state — shown when FREE_KICK is active */}
            {isFk && (
              <div className="flex gap-1">
                {FK_SUB.map(({ state, label, active: ac }) => (
                  <Btn
                    key={state} label={label}
                    active={gc.subState === state}
                    activeClass={ac}
                    onClick={() => updateGc('subState', state)}
                  />
                ))}
              </div>
            )}

            {/* Set pieces */}
            <div className="flex items-center gap-0.5 flex-wrap justify-center">
              {SET_PIECES.map(({ type, label }) => (
                <div key={type} className="flex">
                  <Btn
                    label={`${label} ↑`}
                    active={isFk && gc.freeKickType === type && gc.freeKickSide === 'ours'}
                    activeClass="bg-[#0a1a0a] text-[#4ade80] border-[#166534]"
                    className="rounded-r-none border-r-0 !text-[10px] !px-2"
                    onClick={() => triggerSetPiece(type, 'ours')}
                  />
                  <Btn
                    label="↓"
                    active={isFk && gc.freeKickType === type && gc.freeKickSide === 'theirs'}
                    activeClass="bg-[#1a0a0a] text-[#f87171] border-[#7f1d1d]"
                    className="rounded-l-none !text-[10px] !px-2"
                    onClick={() => triggerSetPiece(type, 'theirs')}
                  />
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* RIGHT — Their Team */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 border-l border-[#1e1e1e] px-5">
          <span className="text-xs font-mono uppercase tracking-widest text-[#f87171] font-semibold">
            Their Team
          </span>

          <button
            onClick={() => scoreGoal('theirs')}
            className="w-full max-w-[140px] py-2.5 rounded text-sm font-mono font-bold border
              bg-[#1a0a0a] text-[#f87171] border-[#7f1d1d] hover:bg-[#22100e] transition-colors"
          >
            + Goal
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-[#64748b] uppercase tracking-widest">Half</span>
            <Btn
              label={gc.firstHalf ? '1st ▸' : '2nd ▸'}
              active={false} activeClass=""
              onClick={() => updateGc('firstHalf', !gc.firstHalf)}
            />
          </div>
        </div>

      </div>
    </div>
  )
}
