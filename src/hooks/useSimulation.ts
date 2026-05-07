import { useState, useEffect, useRef, useCallback } from 'react'
import type { SimState, RobotParams, OverlaySettings, Vec2, TeamConfig } from '../simulation/types'
import { DEFAULT_ROBOT_1, DEFAULT_ROBOT_2, DEFAULT_BALL, DEFAULT_GOAL, DEFAULT_OWN_GOAL, DEFAULT_FIELD_LAYOUT, DEFAULT_COURT, DEFAULT_OVERLAYS, DEFAULT_TEAM } from '../simulation/config'
import { tick } from '../simulation/engine'

const EMPTY_DEBUG = {
  distanceToBall:       0,
  alignmentError:       0,
  orientationError:     0,
  fovError:             0,
  canSeeBall:           true,
  isAligned:            false,
  isOnCorrectSide:      false,
  isAtShootDistance:    false,
  isOrientationAligned: false,
  tangentialDir:        null,
  radialDir:            null,
  targetOrientation:    null,
  stateHistory:         [],
}

function makeInitialState(): SimState {
  return {
    robots:      [{ ...DEFAULT_ROBOT_1, params: { ...DEFAULT_ROBOT_1.params } },
                  { ...DEFAULT_ROBOT_2, params: { ...DEFAULT_ROBOT_2.params } }],
    activeIndex: 0,
    swapTimer:   0,
    team:        { ...DEFAULT_TEAM },
    ball:        { ...DEFAULT_BALL },
    goal:        { ...DEFAULT_GOAL },
    ownGoal:     { ...DEFAULT_OWN_GOAL },
    fieldLayout: { ...DEFAULT_FIELD_LAYOUT },
    court:       { ...DEFAULT_COURT },
    time:        0,
    isPlaying:   false,
    speed:       1,
    debugs:      [{ ...EMPTY_DEBUG, stateHistory: [] }, { ...EMPTY_DEBUG, stateHistory: [] }],
    overlays:    { ...DEFAULT_OVERLAYS },
  }
}

export function useSimulation() {
  const [simState, setSimState] = useState<SimState>(makeInitialState)
  const stateRef    = useRef<SimState>(simState)
  const rafRef      = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)

  useEffect(() => { stateRef.current = simState }, [simState])

  useEffect(() => {
    if (!simState.isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastTimeRef.current = null
      return
    }
    function loop(now: number) {
      if (lastTimeRef.current === null) lastTimeRef.current = now
      const rawDt = (now - lastTimeRef.current) / 1000
      lastTimeRef.current = now
      const dt = Math.min(rawDt, 0.05) * stateRef.current.speed
      setSimState(prev => tick(prev, dt))
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [simState.isPlaying])

  const play  = useCallback(() => setSimState(s => ({ ...s, isPlaying: true })), [])
  const pause = useCallback(() => setSimState(s => ({ ...s, isPlaying: false })), [])
  const step  = useCallback(() => {
    setSimState(prev => prev.isPlaying ? prev : tick(prev, (1 / 60) * prev.speed))
  }, [])
  const reset    = useCallback(() => setSimState(makeInitialState()), [])
  const setSpeed = useCallback((speed: number) => setSimState(s => ({ ...s, speed })), [])

  // Params are shared — update both robots
  const setParam = useCallback(<K extends keyof RobotParams>(key: K, value: RobotParams[K]) =>
    setSimState(s => ({
      ...s,
      robots: [
        { ...s.robots[0], params: { ...s.robots[0].params, [key]: value } },
        { ...s.robots[1], params: { ...s.robots[1].params, [key]: value } },
      ],
    })), [])

  const setTeamConfig = useCallback(<K extends keyof TeamConfig>(key: K, value: TeamConfig[K]) =>
    setSimState(s => ({ ...s, team: { ...s.team, [key]: value } })), [])

  const setOverlay = useCallback(<K extends keyof OverlaySettings>(key: K, value: boolean) =>
    setSimState(s => ({ ...s, overlays: { ...s.overlays, [key]: value } })), [])

  const setBallStatic = useCallback((isStatic: boolean) =>
    setSimState(s => ({ ...s, ball: { ...s.ball, isStatic } })), [])

  const dragBall = useCallback((pos: Vec2) =>
    setSimState(s => ({ ...s, ball: { ...s.ball, pos, velocity: { x: 0, y: 0 } } })), [])

  const dragRobot = useCallback((pos: Vec2, index: 0 | 1) =>
    setSimState(s => {
      const robots: [typeof s.robots[0], typeof s.robots[1]] = [...s.robots] as [typeof s.robots[0], typeof s.robots[1]]
      robots[index] = { ...robots[index], pos }
      return { ...s, robots }
    }), [])

  return {
    simState,
    play, pause, step, reset,
    setSpeed, setParam, setTeamConfig, setOverlay,
    setBallStatic, dragBall, dragRobot,
  }
}
