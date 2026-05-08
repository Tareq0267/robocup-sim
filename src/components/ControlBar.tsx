import type { SimState } from '../simulation/types'

interface Props {
  simState: SimState
  play:     () => void
  pause:    () => void
  step:     () => void
  reset:    () => void
  setSpeed: (s: number) => void
}

const SPEEDS = [0.25, 0.5, 1, 2, 4]

export default function ControlBar({ simState, play, pause, step, reset, setSpeed }: Props) {
  const { isPlaying, speed, gc } = simState

  const stateColor =
    isPlaying                ? '#4ade80' :
    gc.gameState === 'READY' ? '#fbbf24' :
    gc.gameState === 'SET'   ? '#fb923c' :
    gc.gameState === 'END'   ? '#f87171' : '#4b5563'

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0d0d0d] border-b border-[#1e1e1e] select-none flex-shrink-0">

      {/* Transport */}
      <button
        onClick={isPlaying ? pause : play}
        className={`px-3 py-1.5 rounded text-xs font-mono font-semibold border transition-colors ${
          isPlaying
            ? 'bg-[#111827] text-[#60a5fa] border-[#1e3a5f] hover:bg-[#1a2e4a]'
            : 'bg-[#0f1a0f] text-[#4ade80] border-[#1e4d1e] hover:bg-[#162916]'
        }`}
      >
        {isPlaying ? '⏸ Pause' : '▶ Play'}
      </button>

      <button
        onClick={step}
        disabled={isPlaying}
        className="px-3 py-1.5 rounded text-xs font-mono border border-[#1e1e1e] text-[#4b5563] hover:text-[#94a3b8] hover:border-[#374151] disabled:opacity-25 transition-colors"
      >
        → Step
      </button>

      <button
        onClick={reset}
        className="px-3 py-1.5 rounded text-xs font-mono border border-[#1e1e1e] text-[#4b5563] hover:text-[#94a3b8] hover:border-[#374151] transition-colors"
      >
        ↺ Reset
      </button>

      <div className="w-px h-5 bg-[#1e1e1e] mx-0.5" />

      {/* Speed */}
      <span className="text-[10px] font-mono text-[#2d3748] uppercase tracking-widest">Speed</span>
      <div className="flex gap-0.5">
        {SPEEDS.map(s => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={`px-2 py-1 rounded text-xs font-mono border transition-colors ${
              speed === s
                ? 'bg-[#111827] text-[#60a5fa] border-[#1e3a5f]'
                : 'text-[#2d3748] border-[#181818] hover:text-[#94a3b8] hover:border-[#2d3748]'
            }`}
          >
            {s}×
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-[#1e1e1e] mx-0.5" />

      {/* Game-state badge */}
      <span
        className="px-2 py-0.5 rounded text-[10px] font-mono border"
        style={{ color: stateColor, borderColor: stateColor + '2a', backgroundColor: stateColor + '10' }}
      >
        {isPlaying
          ? '▶ PLAYING'
          : gc.subStateType === 'FREE_KICK'
            ? `FK · ${gc.freeKickType.replace('_', ' ')}`
            : gc.gameState}
      </span>

      <span className="ml-auto text-[10px] font-mono text-[#1a1f2e]">
        scroll → zoom · drag field → pan · dbl-click → reset view
      </span>
    </div>
  )
}
