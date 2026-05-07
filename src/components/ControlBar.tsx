import type { SimState } from '../simulation/types'

interface Props {
  simState:   SimState
  play:       () => void
  pause:      () => void
  step:       () => void
  reset:      () => void
  setSpeed:   (s: number) => void
  scoreGoal:  (side: 'ours' | 'theirs') => void
}

const SPEEDS = [0.25, 0.5, 1, 2, 4]

export default function ControlBar({ simState, play, pause, step, reset, setSpeed, scoreGoal }: Props) {
  const { isPlaying, speed, time, score } = simState

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[#111] border-b border-[#222] text-sm font-mono">
      {/* Time */}
      <span className="text-[#4ade80] min-w-[70px]">t = {time.toFixed(2)}s</span>

      <div className="w-px h-5 bg-[#333]" />

      {/* Score */}
      <div className="flex items-center gap-1">
        <span className="text-[#60a5fa] text-xs">US</span>
        <button
          onClick={() => scoreGoal('ours')}
          title="Score for us (+1) and reset to kickoff"
          className="px-1 text-[#60a5fa] hover:text-white text-xs leading-none"
        >+</button>
        <span className="text-white text-base font-bold tabular-nums w-4 text-center">{score.ours}</span>
        <span className="text-[#475569] mx-1">—</span>
        <span className="text-white text-base font-bold tabular-nums w-4 text-center">{score.theirs}</span>
        <button
          onClick={() => scoreGoal('theirs')}
          title="Score for them (+1) and reset to kickoff"
          className="px-1 text-[#f87171] hover:text-white text-xs leading-none"
        >+</button>
        <span className="text-[#f87171] text-xs">THEM</span>
      </div>

      <div className="w-px h-5 bg-[#333]" />

      {/* Play / Pause */}
      <button
        onClick={isPlaying ? pause : play}
        className="px-3 py-1 rounded bg-[#1e3a5f] hover:bg-[#2563eb] text-white transition-colors"
      >
        {isPlaying ? '⏸ Pause' : '▶ Play'}
      </button>

      {/* Step */}
      <button
        onClick={step}
        disabled={isPlaying}
        className="px-3 py-1 rounded bg-[#1a1a1a] hover:bg-[#2a2a2a] text-[#94a3b8] disabled:opacity-40 transition-colors"
      >
        → Step
      </button>

      {/* Reset */}
      <button
        onClick={reset}
        className="px-3 py-1 rounded bg-[#1a1a1a] hover:bg-[#2a2a2a] text-[#94a3b8] transition-colors"
      >
        ↺ Reset
      </button>

      <div className="w-px h-5 bg-[#333]" />

      {/* Speed */}
      <span className="text-[#64748b]">Speed:</span>
      <div className="flex gap-1">
        {SPEEDS.map(s => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={`px-2 py-0.5 rounded text-xs transition-colors ${
              speed === s
                ? 'bg-[#2563eb] text-white'
                : 'bg-[#1a1a1a] hover:bg-[#2a2a2a] text-[#94a3b8]'
            }`}
          >
            {s}×
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2 text-[#64748b]">
        <span className="text-xs">drag ball or robot to reposition</span>
      </div>
    </div>
  )
}
