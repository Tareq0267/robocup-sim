import type { GameMode } from '../simulation/types'

interface Props {
  gameMode:    GameMode
  setGameMode: (mode: GameMode) => void
}

export default function GameModeSelect({ gameMode, setGameMode }: Props) {
  return (
    <select
      value={gameMode}
      onChange={e => setGameMode(e.target.value as GameMode)}
      title="Game mode (switching resets the match)"
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 px-2.5 py-1 rounded text-xs font-mono
        bg-[#0d0d0dcc] text-[#60a5fa] border border-[#1e3a5f] hover:border-[#2563eb] transition-colors
        cursor-pointer outline-none"
    >
      <option value="3v3">3v3</option>
      <option value="5v5">5v5</option>
    </select>
  )
}
