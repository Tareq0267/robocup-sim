import { useState } from 'react'
import { useSimulation } from './hooks/useSimulation'
import SimCanvas  from './components/SimCanvas'
import ControlBar from './components/ControlBar'
import LeftPanel  from './components/LeftPanel'
import RightPanel from './components/RightPanel'

export default function App() {
  const {
    simState,
    play, pause, step, reset,
    setSpeed, setParam, setTeamConfig, setOverlay,
    setBallStatic, dragBall, dragRobot,
  } = useSimulation()

  const [focusedRobot, setFocusedRobot] = useState<number | null>(null)

  return (
    <div className="flex flex-col w-screen h-screen bg-[#0a0a0a] overflow-hidden">
      <ControlBar
        simState={simState}
        play={play} pause={pause} step={step} reset={reset}
        setSpeed={setSpeed}
      />
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel
          simState={simState}
          setParam={setParam}
          setTeamConfig={setTeamConfig}
          setOverlay={setOverlay}
          setBallStatic={setBallStatic}
        />
        <div className="flex-1 overflow-hidden">
          <SimCanvas simState={simState} focusedRobot={focusedRobot} dragBall={dragBall} dragRobot={dragRobot} />
        </div>
        <RightPanel simState={simState} onFocusChange={setFocusedRobot} />
      </div>
    </div>
  )
}
