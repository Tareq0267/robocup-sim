import { useState, useEffect, useRef, useCallback } from 'react'
import type { SimState, RobotParams, OverlaySettings, Vec2, TeamConfig, GoalkeeperParams, GameControllerState, GcGameState, GcSubStateType, GcSubState, GcFreeKickType, EnemyMode, GameMode, StrategyId, StrategyParams } from '../simulation/types'
import { createTeamRobots, DEFAULT_BALL, DEFAULT_GOAL, DEFAULT_OWN_GOAL, DEFAULT_FIELD_LAYOUT, DEFAULT_COURT, DEFAULT_GOAL_5V5, DEFAULT_OWN_GOAL_5V5, DEFAULT_FIELD_LAYOUT_5V5, DEFAULT_COURT_5V5, DEFAULT_OVERLAYS, DEFAULT_TEAM, DEFAULT_STRATEGY_PARAMS, DEFAULT_GC, EMPTY_GK_DEBUG } from '../simulation/config'
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

function makeInitialState(gameMode: GameMode = '3v3'): SimState {
  const robots      = createTeamRobots(gameMode, 'ours')
  const enemyRobots = createTeamRobots(gameMode, 'enemy')
  const is5v5 = gameMode === '5v5'

  return {
    gameMode,
    robots,
    activeIndex:    0,
    swapTimer:      0,
    gkSwapCooldown: 0,
    team:        { ...DEFAULT_TEAM },
    strategy:        'none',
    strategyParams:  { ...DEFAULT_STRATEGY_PARAMS },
    activeAimTarget: { x: 0, y: 0 },
    isPassing:       false,
    goalkeeperDebug: { ...EMPTY_GK_DEBUG, stateHistory: [] },
    ball:        { ...DEFAULT_BALL },
    goal:        is5v5 ? { ...DEFAULT_GOAL_5V5 }         : { ...DEFAULT_GOAL },
    ownGoal:     is5v5 ? { ...DEFAULT_OWN_GOAL_5V5 }     : { ...DEFAULT_OWN_GOAL },
    fieldLayout: is5v5 ? { ...DEFAULT_FIELD_LAYOUT_5V5 } : { ...DEFAULT_FIELD_LAYOUT },
    court:       is5v5 ? { ...DEFAULT_COURT_5V5 }        : { ...DEFAULT_COURT },
    time:        0,
    isPlaying:   false,
    speed:       1,
    score:       { ours: 0, theirs: 0 },
    autoGoal:         false,
    kickoffCountdown: 0,
    debugs: robots.map(() => ({ ...EMPTY_DEBUG, stateHistory: [] })),
    overlays: { ...DEFAULT_OVERLAYS },
    gc: { ...DEFAULT_GC, penalties: robots.map(() => false) },
    enemyMode:           'off',
    enemyRobots,
    enemyActiveIndex:    0,
    enemySwapTimer:      0,
    enemyGkSwapCooldown: 0,
    enemyDebugs: enemyRobots.map(() => ({ ...EMPTY_DEBUG, stateHistory: [] })),
    enemyGoalkeeperDebug: { ...EMPTY_GK_DEBUG, stateHistory: [] },
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

  // During READY (post-goal kickoff walk), pressing play starts actual play.
  const play  = useCallback(() => setSimState(s => {
    if (s.gc.gameState === 'READY' || s.kickoffCountdown > 0) {
      return {
        ...s,
        isPlaying:        true,
        kickoffCountdown: 0,
        ball:             { ...s.ball, isStatic: false },
        gc:               { ...s.gc, gameState: 'PLAY' as GcGameState },
      }
    }
    return { ...s, isPlaying: true }
  }), [])
  const pause = useCallback(() => setSimState(s => ({ ...s, isPlaying: false })), [])
  const step  = useCallback(() => {
    setSimState(prev => prev.isPlaying ? prev : tick(prev, (1 / 60) * prev.speed))
  }, [])
  const reset    = useCallback(() => setSimState(s => makeInitialState(s.gameMode)), [])
  const setGameMode = useCallback((mode: GameMode) => setSimState(makeInitialState(mode)), [])

  // Manually score a goal — update score, freeze ball at centre, and let
  // robots walk to kickoff positions (READY state). Press play to start.
  const scoreGoal = useCallback((side: 'ours' | 'theirs') =>
    setSimState(s => {
      const newScore = side === 'ours'
        ? { ours: s.score.ours + 1, theirs: s.score.theirs }
        : { ours: s.score.ours, theirs: s.score.theirs + 1 }
      const kickoffSide: 'ours' | 'theirs' = side === 'ours' ? 'theirs' : 'ours'
      return {
        ...s,
        score:     newScore,
        isPlaying: true,
        ball:      { ...s.ball, pos: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, isStatic: true },
        gc:        { ...s.gc, gameState: 'READY' as GcGameState, kickoffSide, subStateType: 'NONE' as GcSubStateType, subState: 'STOP' as GcSubState },
      }
    }), [])

  // Reset robots and ball to kickoff positions without changing the score.
  const kickoff = useCallback((side: 'ours' | 'theirs') =>
    setSimState(s => makeKickoffState(s, s.score, side)), [])
  const setSpeed    = useCallback((speed: number) => setSimState(s => ({ ...s, speed })), [])
  const setAutoGoal = useCallback((v: boolean)   => setSimState(s => ({ ...s, autoGoal: v })), [])

  // Striker params are shared — update all robots (any can become striker)
  const setParam = useCallback(<K extends keyof RobotParams>(key: K, value: RobotParams[K]) =>
    setSimState(s => ({
      ...s,
      robots: s.robots.map(r => ({ ...r, params: { ...r.params, [key]: value } })),
    })), [])

  const setTeamConfig = useCallback(<K extends keyof TeamConfig>(key: K, value: TeamConfig[K]) =>
    setSimState(s => ({ ...s, team: { ...s.team, [key]: value } })), [])

  const setStrategy = useCallback((id: StrategyId) =>
    setSimState(s => ({ ...s, strategy: id })), [])

  const setStrategyParam = useCallback(<K extends keyof StrategyParams>(key: K, value: StrategyParams[K]) =>
    setSimState(s => ({ ...s, strategyParams: { ...s.strategyParams, [key]: value } })), [])

  const setOverlay = useCallback(<K extends keyof OverlaySettings>(key: K, value: boolean) =>
    setSimState(s => ({ ...s, overlays: { ...s.overlays, [key]: value } })), [])

  const setBallStatic = useCallback((isStatic: boolean) =>
    setSimState(s => ({ ...s, ball: { ...s.ball, isStatic } })), [])

  const dragBall = useCallback((pos: Vec2) =>
    setSimState(s => ({ ...s, ball: { ...s.ball, pos, velocity: { x: 0, y: 0 } } })), [])

  // Drag any robot by index (the goalkeeper is determined by role; indices are not fixed because roles can swap)
  const dragRobot = useCallback((pos: Vec2, index: number) =>
    setSimState(s => {
      const robots = [...s.robots]
      robots[index] = { ...robots[index], pos }
      return { ...s, robots }
    }), [])

  const dragEnemyRobot = useCallback((pos: Vec2, index: number) =>
    setSimState(s => {
      const enemyRobots = [...s.enemyRobots]
      enemyRobots[index] = { ...enemyRobots[index], pos }
      return { ...s, enemyRobots }
    }), [])

  const updateGc = useCallback(<K extends keyof GameControllerState>(key: K, value: GameControllerState[K]) =>
    setSimState(s => {
      const newGc: GameControllerState = { ...s.gc, [key]: value }
      let next: SimState = { ...s, gc: newGc }

      if (key === 'gameState') {
        const gs = value as GcGameState
        if (gs === 'READY') {
          next = makeKickoffState({ ...s, gc: newGc }, s.score, s.gc.kickoffSide)
          next = { ...next, gc: newGc, isPlaying: false }
        } else if (gs === 'PLAY') {
          next = { ...next, isPlaying: true }
        } else {
          next = { ...next, isPlaying: false }
        }
      }

      // GET_READY: unfreeze the ball so the kicking robot can actually play it
      if (key === 'subState' && value === 'GET_READY') {
        next = { ...next, ball: { ...next.ball, isStatic: false } }
      }

      if (key === 'kickoffSide' && s.gc.gameState === 'READY') {
        const side = value as 'ours' | 'theirs'
        next = makeKickoffState(next, next.score, side)
        next = { ...next, gc: newGc }
      }

      return next
    }), [])

  // Place ball for set piece and enter FREE_KICK STOP phase.
  // Throw-in: ball snaps to nearest sideline. Corner: ball to corner of relevant goal end.
  const triggerSetPiece = useCallback((type: GcFreeKickType, side: 'ours' | 'theirs') =>
    setSimState(s => {
      const hw = s.court.width  / 2
      const hh = s.court.height / 2
      const sy = s.ball.pos.y >= 0 ? 1 : -1
      let bx = s.ball.pos.x
      let by = s.ball.pos.y

      if (type === 'THROW_IN') {
        bx = Math.max(-hw, Math.min(hw, bx))
        by = sy * hh
      } else if (type === 'CORNER') {
        // Our corner kick → we attack from opponent's corner (right side)
        // Their corner kick → they attack from our corner (left side)
        bx = side === 'ours' ? hw : -hw
        by = sy * hh
      } else if (type === 'GOAL_KICK') {
        bx = side === 'ours' ? -hw + 1.0 : hw - 1.0
        by = 0
      } else if (type === 'PENALTY') {
        // Penalty spot: field_length/2 - penaltyMarkDist from centre, y=0
        // Matches robotedge: xSign * (fd.length/2 - fd.penaltyDist)
        bx = side === 'ours' ? hw - s.fieldLayout.penaltyMarkDist : -(hw - s.fieldLayout.penaltyMarkDist)
        by = 0
      }

      const newGc: GameControllerState = {
        ...s.gc,
        subStateType: 'FREE_KICK' as GcSubStateType,
        subState:     'STOP'      as GcSubState,
        freeKickType: type,
        freeKickSide: side,
      }
      return {
        ...s,
        gc:        newGc,
        isPlaying: false,
        ball:      { ...s.ball, pos: { x: bx, y: by }, velocity: { x: 0, y: 0 }, isStatic: true },
      }
    }), [])

  // GK params update — find whichever robot currently has goalkeeper role
  const setGKParam = useCallback(<K extends keyof GoalkeeperParams>(key: K, value: GoalkeeperParams[K]) =>
    setSimState(s => {
      const gkIdx = s.robots.findIndex(r => r.role === 'goalkeeper')
      if (gkIdx === -1) return s
      const robots = [...s.robots]
      robots[gkIdx] = { ...robots[gkIdx], gkParams: { ...robots[gkIdx].gkParams, [key]: value } }
      return { ...s, robots }
    }), [])

  const setEnemyMode = useCallback((mode: EnemyMode) =>
    setSimState(s => ({ ...s, enemyMode: mode })), [])

  const setEnemyParam = useCallback(<K extends keyof RobotParams>(key: K, value: RobotParams[K]) =>
    setSimState(s => ({
      ...s,
      enemyRobots: s.enemyRobots.map(r => ({ ...r, params: { ...r.params, [key]: value } })),
    })), [])

  const setEnemyGKParam = useCallback(<K extends keyof GoalkeeperParams>(key: K, value: GoalkeeperParams[K]) =>
    setSimState(s => {
      const gkIdx = s.enemyRobots.findIndex(r => r.role === 'goalkeeper')
      if (gkIdx === -1) return s
      const enemyRobots = [...s.enemyRobots]
      enemyRobots[gkIdx] = { ...enemyRobots[gkIdx], gkParams: { ...enemyRobots[gkIdx].gkParams, [key]: value } }
      return { ...s, enemyRobots }
    }), [])

  return {
    simState,
    play, pause, step, reset, scoreGoal, kickoff, updateGc, triggerSetPiece,
    setSpeed, setAutoGoal, setParam, setTeamConfig, setGKParam, setOverlay,
    setBallStatic, dragBall, dragRobot, dragEnemyRobot,
    setEnemyMode, setEnemyParam, setEnemyGKParam, setGameMode,
    setStrategy, setStrategyParam,
  }
}
