import { useState } from 'react'
import { useSimulation } from './hooks/useSimulation'
import SimCanvas  from './components/SimCanvas'
import ControlBar from './components/ControlBar'
import LeftPanel  from './components/LeftPanel'
import RightPanel from './components/RightPanel'
import BottomBar  from './components/BottomBar'

export default function App() {
  const {
    simState,
    play, pause, step, reset, scoreGoal, updateGc, triggerSetPiece,
    setSpeed, setAutoGoal, setParam, setTeamConfig, setGKParam, setOverlay,
    setBallStatic, dragBall, dragRobot, dragEnemyRobot,
    setEnemyMode, setEnemyParam, setEnemyGKParam,
  } = useSimulation()

  const [focusedRobot, setFocusedRobot] = useState<number | null>(null)
  const [lightMode, setLightMode] = useState(true)

  return (
    <div
      data-theme={lightMode ? 'light' : 'dark'}
      className="flex flex-col w-screen h-screen bg-[#0a0a0a] overflow-hidden"
    >
      <ControlBar
        simState={simState}
        play={play} pause={pause} step={step} reset={reset}
        setSpeed={setSpeed}
        lightMode={lightMode}
        toggleTheme={() => setLightMode(m => !m)}
      />
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel
          simState={simState}
          setParam={setParam}
          setTeamConfig={setTeamConfig}
          setGKParam={setGKParam}
          setOverlay={setOverlay}
          setBallStatic={setBallStatic}
          setEnemyMode={setEnemyMode}
          setEnemyParam={setEnemyParam}
          setEnemyGKParam={setEnemyGKParam}
        />
        <div className="flex-1 overflow-hidden">
          <SimCanvas simState={simState} focusedRobot={focusedRobot} dragBall={dragBall} dragRobot={dragRobot} dragEnemyRobot={dragEnemyRobot} />
        </div>
        <RightPanel simState={simState} onFocusChange={setFocusedRobot} />
      </div>
      <BottomBar
        gc={simState.gc}
        isPlaying={simState.isPlaying}
        time={simState.time}
        score={simState.score}
        autoGoal={simState.autoGoal}
        kickoffCountdown={simState.kickoffCountdown}
        penalties={simState.gc.penalties}
        updateGc={updateGc}
        scoreGoal={scoreGoal}
        setAutoGoal={setAutoGoal}
        triggerSetPiece={triggerSetPiece}
      />
    </div>
  )
}
