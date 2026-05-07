import { useState, useEffect, useRef, useCallback } from 'react'
import type { SimState, RobotParams, OverlaySettings, Vec2, TeamConfig, GoalkeeperParams, Robot } from '../simulation/types'
import { DEFAULT_ROBOT_1, DEFAULT_ROBOT_2, DEFAULT_ROBOT_GK, DEFAULT_BALL, DEFAULT_GOAL, DEFAULT_OWN_GOAL, DEFAULT_FIELD_LAYOUT, DEFAULT_COURT, DEFAULT_OVERLAYS, DEFAULT_TEAM, EMPTY_GK_DEBUG } from '../simulation/config'
import { tick, makeKickoffState } from '../simulation/engine'

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
    robots: [
      { ...DEFAULT_ROBOT_1, params: { ...DEFAULT_ROBOT_1.params }, gkParams: { ...DEFAULT_ROBOT_1.gkParams } },
      { ...DEFAULT_ROBOT_2, params: { ...DEFAULT_ROBOT_2.params }, gkParams: { ...DEFAULT_ROBOT_2.gkParams } },
      { ...DEFAULT_ROBOT_GK, params: { ...DEFAULT_ROBOT_GK.params }, gkParams: { ...DEFAULT_ROBOT_GK.gkParams } },
    ],
    activeIndex:    0,
    swapTimer:      0,
    gkSwapCooldown: 0,
    team:        { ...DEFAULT_TEAM },
    goalkeeperDebug: { ...EMPTY_GK_DEBUG, stateHistory: [] },
    ball:        { ...DEFAULT_BALL },
    goal:        { ...DEFAULT_GOAL },
    ownGoal:     { ...DEFAULT_OWN_GOAL },
    fieldLayout: { ...DEFAULT_FIELD_LAYOUT },
    court:       { ...DEFAULT_COURT },
    time:        0,
    isPlaying:   false,
    speed:       1,
    score:       { ours: 0, theirs: 0 },
    debugs: [
      { ...EMPTY_DEBUG, stateHistory: [] },
      { ...EMPTY_DEBUG, stateHistory: [] },
      { ...EMPTY_DEBUG, stateHistory: [] },
    ],
    overlays: { ...DEFAULT_OVERLAYS },
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

  // Manually score a goal and reset to kickoff positions.
  // side='ours': we scored → opponent kicks off. side='theirs': they scored → we kick off.
  const scoreGoal = useCallback((side: 'ours' | 'theirs') =>
    setSimState(s => makeKickoffState(
      s,
      side === 'ours'
        ? { ours: s.score.ours + 1, theirs: s.score.theirs }
        : { ours: s.score.ours, theirs: s.score.theirs + 1 },
      side === 'ours' ? 'theirs' : 'ours',
    )), [])
  const setSpeed = useCallback((speed: number) => setSimState(s => ({ ...s, speed })), [])

  // Striker params are shared — update all robots (any can become striker)
  const setParam = useCallback(<K extends keyof RobotParams>(key: K, value: RobotParams[K]) =>
    setSimState(s => ({
      ...s,
      robots: s.robots.map(r => ({ ...r, params: { ...r.params, [key]: value } })) as [Robot, Robot, Robot],
    })), [])

  const setTeamConfig = useCallback(<K extends keyof TeamConfig>(key: K, value: TeamConfig[K]) =>
    setSimState(s => ({ ...s, team: { ...s.team, [key]: value } })), [])

  const setOverlay = useCallback(<K extends keyof OverlaySettings>(key: K, value: boolean) =>
    setSimState(s => ({ ...s, overlays: { ...s.overlays, [key]: value } })), [])

  const setBallStatic = useCallback((isStatic: boolean) =>
    setSimState(s => ({ ...s, ball: { ...s.ball, isStatic } })), [])

  const dragBall = useCallback((pos: Vec2) =>
    setSimState(s => ({ ...s, ball: { ...s.ball, pos, velocity: { x: 0, y: 0 } } })), [])

  // Drag any of the 3 robots (0=P1, 1=P2, 2=GK slot)
  const dragRobot = useCallback((pos: Vec2, index: 0 | 1 | 2) =>
    setSimState(s => {
      const robots = [...s.robots] as [Robot, Robot, Robot]
      robots[index] = { ...robots[index], pos }
      return { ...s, robots }
    }), [])

  // GK params update — find whichever robot currently has goalkeeper role
  const setGKParam = useCallback(<K extends keyof GoalkeeperParams>(key: K, value: GoalkeeperParams[K]) =>
    setSimState(s => {
      const gkIdx = s.robots.findIndex(r => r.role === 'goalkeeper')
      if (gkIdx === -1) return s
      const robots = [...s.robots] as [Robot, Robot, Robot]
      robots[gkIdx] = { ...robots[gkIdx], gkParams: { ...robots[gkIdx].gkParams, [key]: value } }
      return { ...s, robots }
    }), [])

  return {
    simState,
    play, pause, step, reset, scoreGoal,
    setSpeed, setParam, setTeamConfig, setGKParam, setOverlay,
    setBallStatic, dragBall, dragRobot,
  }
}
