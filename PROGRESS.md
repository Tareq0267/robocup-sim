# RoboCup Sim — Progress & Roadmap

## What This Is

A **2D web-based strategy simulator** for Malaysia's RoboCup humanoid soccer team competing in the **Adult Size 3v3** category using **Booster T1** robots.

This is **Step 1 of a multi-step project**:

| Step | Goal | Status |
|------|------|--------|
| **1 — Strategy Sim** | Visualise and tune robot behaviour in-browser before touching hardware | 🔨 In progress |
| **2 — Sim → Robot Translator** | Convert sim world-frame velocities → `setVelocity(vx, vy, vtheta)` robot-local commands that run directly on the real robots | Not started |
| **3 — Live Feedback Loop** | Run sim alongside a real match, compare predicted vs actual robot behaviour | Not started |

---

## Real Robot Repository

**Local path:** `C:\Users\Asus\Work\Robotedge-RoboCup-Soccer`

Key files used as ground truth for this sim:

| File | What it defines |
|------|----------------|
| `robotedge_3v3/src/brain/config/config.yaml` | Hardware speed caps, FOV, robot geometry |
| `robotedge_3v3/src/brain/behavior_trees/subtrees/subtree_striker_play.xml` | Striker state machine & all BT node parameters |
| `robotedge_3v3/src/brain/behavior_trees/subtrees/subtree_goal_keeper_play.xml` | Goalkeeper state machine & all BT node parameters |
| `robotedge_3v3/src/brain/src/brain_tree.cpp` | C++ implementation of every BT node (`StrikerDecide`, `Assist`, `Adjust`, `GoalieDecide`, etc.) |
| `robotedge_3v3/src/brain/src/brain.cpp` | `handleCooperation()`, `updateCostToKick()` — role switching logic |
| `robotedge_3v3/src/brain/include/types.h` | `TMStatus`, `Pose2D`, field dimension constants |

---

## Parameter Comparison: Sim vs Repo

### Striker (`DEFAULT_PARAMS` / `subtree_striker_play.xml` + `config.yaml`)

| Sim parameter | Sim value | Repo source | Repo value | Match |
|---|---|---|---|---|
| `chaseDistance` | 0.7 m | `StrikerDecide chase_threshold` | 0.7 | ✅ |
| `chaseSpeed` | 1.2 m/s | `Chase vx_limit` | 1.2 | ✅ |
| `tangentialSpeed` | 1.2 m/s | `Adjust tangential_speed_far` | 1.2 | ✅ |
| `radialSpeedDistance` | 0.5 m | `Adjust near_threshold` | 0.5 | ✅ |
| `radialSpeedFar` | 0.5 m/s | `Adjust vx_limit` | 0.5 | ✅ |
| `radialSpeedNear` | 0.2 m/s | `Adjust tangential_speed_near` | 0.2 | ✅ |
| `shootingSpeed` | 1.5 m/s | `Kick speed_limit` | 1.5 | ✅ |
| `rotationSpeed` | 1.2 rad/s | `config.yaml vtheta_limit` | 1.2 | ✅ |
| `fieldOfView` | π/2 rad (90°) | `config.yaml cam_fov_x` | 90° | ✅ |
| Assist speed (hardcoded) | 0.2 m/s | `Assist vx_limit` | 0.2 | ✅ |
| Hardware vx cap | — (not enforced) | `config.yaml vx_limit` | 2.0 | ⚠️ sim has no hard cap |
| Hardware vy cap | — (not enforced) | `config.yaml vy_limit` | 0.4 | ⚠️ sim has no hard cap |

### Goalkeeper (`DEFAULT_GK_PARAMS` / `subtree_goal_keeper_play.xml`)

| Sim parameter | Sim value | Repo source | Repo value | Match |
|---|---|---|---|---|
| `chaseThreshold` | 1.0 m | `GoalieDecide chase_threshold` | 1.0 | ✅ |
| `retreatChaseThreshold` | 1.6 m | `GoalieDecide retreat_chase_threshold` | 1.6 | ✅ |
| `alignThreshold` | 0.035 rad (2°) | `GoalieDecide align_threshold_deg` | 2.0° | ✅ |
| `chaseSpeed` | 0.6 m/s | `Chase vx_limit` | 0.6 | ✅ |
| `retreatSpeed` | 0.8 m/s | `GoToGoalBlockingPosition vx_limit` | 0.8 | ✅ |
| `blockSpeedFar` | 0.9 m/s | `AdjustBlock tangential_speed_far` | 0.9 | ✅ |
| `blockSpeedNear` | 0.2 m/s | `AdjustBlock tangential_speed_near` | 0.2 | ✅ |
| `blockNearThreshold` | 0.8 m | `AdjustBlock near_threshold` | 0.8 | ✅ |
| `kickSpeed` | 1.5 m/s | `Kick speed_limit` | 1.5 | ✅ |
| `rotationSpeed` | 1.2 rad/s | `config.yaml vtheta_limit` | 1.2 | ✅ |
| `fieldOfView` | π/2 rad (90°) | `config.yaml cam_fov_x` | 90° | ✅ |
| `goalLineOffset` | 0.5 m | `GoToGoalBlockingPosition dist_to_goalline` | 0.5 | ✅ |
| `blockRange` | 0.6 m | `AdjustBlock range` | 0.6 | ✅ |

### Field Dimensions (`DEFAULT_COURT` / `DEFAULT_FIELD_LAYOUT` / RoboCup Adult Size rulebook)

| Sim value | Repo / Rulebook | Match |
|---|---|---|
| Field 14 × 9 m | Adult Size: 14 × 9 m | ✅ |
| Goal width 2.6 m | Adult Size: 2.6 m | ✅ |
| Goal depth 0.6 m | Adult Size: 0.6 m | ✅ |
| Penalty area 3 m deep × 6 m wide | Adult Size | ✅ |
| Goal area 1 m deep × 4 m wide | Adult Size | ✅ |
| Centre circle radius 1.5 m | Adult Size | ✅ |
| Penalty mark 2.1 m from goal line | Adult Size | ✅ |
| Robot radius 0.26 m | Booster T1: 47 cm × 23 cm footprint → half-diagonal ≈ 0.26 m | ✅ |

---

## State Machine Comparison

### Striker (sim) vs BT nodes (repo)

| Sim state | Maps to repo BT node | Notes |
|---|---|---|
| `SEARCHING` | `FindBall` subtree | Spin until ball in FOV |
| `ASSIST` | `Assist` node (`decision=='assist'`) | Non-lead robot, moves 2 m behind ball on goal→ball line |
| `CHASING` | `Chase` node (`decision=='chase'`) | Ball farther than `chase_threshold` |
| `REPOSITIONING` | `Adjust` node (`decision=='adjust'`) | Orbit ball tangentially to get behind it |
| `RADIAL_ADJUST` | `Adjust` node (radial phase) | Aligned, closing gap to contact range |
| `READY` | `Adjust` node (hold phase) | In position, rotating body to face ball |
| `SHOOTING` | `Kick` node (`decision=='kick'`) | Full-speed kick |
| — | `Kick` node (`decision=='cross'`) | ❌ Not yet implemented — low-power pass (speed_limit=0.4) |

### Goalkeeper (sim) vs BT nodes (repo)

| Sim state | Maps to repo BT node | Notes |
|---|---|---|
| `FIND_BALL` | `FindBall` subtree | Spin until ball in FOV |
| `RETREAT` | `GoToGoalBlockingPosition` | Return to goal line position |
| `ADJUST_BLOCK` | `AdjustBlock` | Block on goal→ball intercept line |
| `CHASE` | `Chase` | Chase ball in penalty area |
| `KICK` | `Kick` | Clear ball |

### Role Switching (sim) vs `handleCooperation()` (repo)

| Concept | Sim | Repo | Match |
|---|---|---|---|
| Who chases | Robot closer to ball (`activeIndex`) | Robot with lower `tmMyCost` | ⚠️ Sim uses pure distance; repo uses composite cost (distance + angle + obstacles + fall penalty) |
| Swap delay | `roleSwapDelay` timer (hysteresis) | `ball_control_cost_threshold=20.0` + cost diff check | ⚠️ Sim uses time hysteresis; repo uses cost threshold |
| Non-lead behaviour | `ASSIST` state | `decision='assist'` from `StrikerDecide` | ✅ |
| GK↔striker role swap | GK farther from own goal than ALL strikers → closest striker becomes GK, 2 s cooldown | Same condition in `handleCooperation()`, `CMD_COOLDOWN=2000 ms` | ✅ |
| Any robot can be GK | ✅ unified `Robot` type with `role` field | Each robot reads `player_role` variable at runtime | ✅ |

### Teammate Collision / Obstacle Avoidance (sim) vs repo

| Concept | Sim | Repo | Match |
|---|---|---|---|
| Explicit "don't crash" rule | No — physics `separateCircles` handles it | No explicit BT rule | ✅ |
| Why robots don't both chase | Cost-based lead + ASSIST state (only 1 is active) | Same: `StrikerDecide decision=='assist'` for non-lead | ✅ |
| GK as physical obstacle | `separateCircles` for all 3 robot pairs | Depth camera sees teammates as obstacles (height < 35 cm filtered out); `chase_ao_safe_dist=3.5 m` | ⚠️ Sim: elastic separation; repo: BT navigation avoidance |

---

## What Has Been Done

### Simulation Core
- [x] React + Vite + TypeScript + Tailwind project scaffolding
- [x] HTML5 Canvas 2D renderer (sim coords y-up, canvas y-down)
- [x] Field with correct Adult Size dimensions (14 × 9 m)
- [x] Field markings: penalty areas, goal areas, penalty marks, centre circle, halfway line
- [x] Both goals with depth (opponent = right, own = left)
- [x] Ball physics: friction, wall bounce, static lock toggle

### Striker State Machine
- [x] `SEARCHING` — spin until ball in FOV
- [x] `CHASING` — run straight to ball
- [x] `REPOSITIONING` — orbit ball tangentially to get behind it
- [x] `RADIAL_ADJUST` — close gap on aligned approach
- [x] `READY` — hold position, rotate body
- [x] `SHOOTING` — push ball forward
- [x] `ASSIST` — non-lead robot moves to support position (2 m behind ball on goal→ball line)

### Team Coordination
- [x] Two-striker role swap with hysteresis (`roleSwapDelay` timer)
- [x] **GK role switch** — any robot can be GK or striker at runtime; GK swaps to closest striker when GK drifts farthest from own goal; 2 s cooldown matches real `CMD_COOLDOWN=2000 ms`
- [x] Focused overlay filtering (Team tab = all robots, P1/P2/GK tab = that robot only)
- [x] Unified `Robot` type with `role`, `gkState`, `gkParams` — no separate `GoalkeeperRobot` in sim state
- [x] Three-robot collision resolution (all 3 pairs via `separateCircles`)

### Goalkeeper State Machine
- [x] `FIND_BALL` — spin until ball visible
- [x] `RETREAT` — return to goal line blocking position
- [x] `ADJUST_BLOCK` — slide laterally on goal→ball intercept line
- [x] `CHASE` — chase ball inside penalty area
- [x] `KICK` — clear ball

### Physics
- [x] Robot-robot collision (striker vs striker)
- [x] Striker vs goalkeeper collision
- [x] Ball-robot contact and push
- [x] Court boundary clamping

### Opponent Robots
- [x] Enemy team (3 robots) with configurable mode: Idle, Chase, Defend
- [x] Enemy GK mode — mirrors our GK state machine (RETREAT / ADJUST_BLOCK / CHASE / KICK)
- [x] Cross-team collision resolution (our robots vs enemy robots)
- [x] Enemy team rendered in red; drag-to-reposition enemy robots
- [x] Enemy params tab in LeftPanel (mode, speed, GK params)

### UI
- [x] Parameter panel with sliders for all striker and GK params
- [x] Right panel: Team tab, P1 tab, P2 tab, GK tab — resizable (180–560 px, drag left edge)
- [x] Left panel resizable (180–560 px, drag right edge); content scales proportionally with panel width
- [x] State transition log per robot
- [x] Debug data (FOV error, alignment error, distance to ball, etc.)
- [x] Visual overlays: FOV cone, orientation arrow, chase circle, alignment line, shoot cone, tangent/radial vectors, ball velocity, assist target marker
- [x] Drag-to-reposition: ball, both strikers, goalkeeper
- [x] Play/pause, speed control, simulation reset
- [x] **Canvas zoom/pan** — scroll wheel zooms 1–5× toward cursor; drag empty field to pan; double-click resets view
- [x] **Minimap** — bottom-left overlay when zoom > 1×; shows all robots + ball + blue viewport rectangle
- [x] **Canvas score HUD** — floating score/timer/state panel drawn directly on the canvas at top-centre
- [x] **Export / import params** — JSON copy-paste strip in params tab; copy current params to clipboard, paste and apply any snapshot
- [x] **ControlBar redesign** — play/pause, step, reset, speed multipliers, game-state badge; score/timer moved to canvas HUD
- [x] **Light mode** — toggle in ControlBar; `data-theme="light"` CSS overrides all Tailwind arbitrary-value colours without component refactoring

### Scoring & Kickoff
- [x] Goal detection — ball centre touches goal line within goal mouth → score increments
- [x] Score display in control bar and bottom bar
- [x] Kickoff reset — ball to centre, robots to repo-matched positions (verified against humanoid repo `brain_tree.cpp`)
- [x] **Kickoff walk** — after +Goal, robots animate to kickoff positions (`gc.gameState=READY`); sim auto-pauses once all arrive; ▶ transitions to PLAY and unfreezes ball

### Game Controller
- [x] `GameControllerState` type model mirroring the RoboCup GC UDP protocol (`gameState`, `kickoffSide`, `subStateType`, `subState`, `freeKickType`, `freeKickSide`, `penalties`, `firstHalf`)
- [x] Bottom bar UI — 3-column layout: Our Team (+Goal), Centre (score/timer/half), Their Team (+Goal); match controls greyed out pending full GC integration
- [x] `updateGc` hook — generic GC state updater wired to READY/PLAY/SET transitions
- [x] **Free kick engine** — `calcFreekickTargets` mirrors `GoToFreekickPosition::onRunning()` from robotedge (attack: 0.7 m behind ball toward goal; defense: 1.9 m on own-goal→ball line)
- [x] FK phases — STOP/SET: all robots freeze; GET_READY: strikers move to FK targets, active striker plays normally to allow kick; GK retreats to goal
- [x] Ball placement per type — THROW_IN (nearest sideline), CORNER (field corner), GOAL_KICK (1 m from goal line), PENALTY (penaltyMarkDist from goal line); DIRECT/INDIRECT leave ball in place per real GC protocol
- [x] **GK goal blocking during FK** — GK moves to 0.9 m in front of goal line, centred (mirrors `GoToGoalBlockingPosition dist_to_goalline=0.9` from `subtree_goal_keeper_freekick.xml`)
- [x] **Penalty card freeze** — `gc.penalties[i]=true` freezes the corresponding robot (zero velocity), mirroring `gc_is_under_penalty → SetVelocity(0)` from robotedge `brain.cpp`

### Parameter Alignment
- [x] All striker parameters matched to `subtree_striker_play.xml`
- [x] All goalkeeper parameters matched to `subtree_goal_keeper_play.xml`
- [x] All speed values verified against `config.yaml`

---

## What Still Needs to Be Done

### Strategy Sim (Step 1)

- [x] **Goal detection + scoring** — ball crosses goal line → score increments; robots animate to kickoff positions (READY state); ▶ starts play
- [x] **Free kick engine** — robot positioning + ball placement for THROW_IN, CORNER, GOAL_KICK, PENALTY, DIRECT, INDIRECT; GK goal blocking; FK phase flow (STOP → GET_READY → SET); penalty card freeze
- [ ] **Full game controller UI** — match controls (game state buttons, set piece triggers, FK phases, penalty toggles) are currently greyed out; wiring to engine exists but UI interaction disabled pending full GC integration
- [ ] **Ball out of bounds detection** — automatic detection when ball leaves field, auto-triggering the correct set piece (throw-in / goal kick / corner); currently set pieces are triggered manually only
- [ ] **Cross kick** — `decision=='cross'`, `speed_limit=0.4` low-power pass to teammate instead of full shot
- [ ] **Cost-based role switching** — replace pure-distance swap with composite cost matching `updateCostToKick()` (distance + angle to goal + obstacle penalty)
- [ ] **Hardware speed caps** — enforce `vx_limit=2.0` and `vy_limit=0.4` as hard caps on all velocities (currently uncapped)
- [ ] **`crabWalk` velocity model** — real robot applies `vx_factor=0.5` to forward component and caps lateral to `vy_limit=0.4`; sim uses raw world-frame velocities

### Sim → Robot Translator (Step 2)

- [ ] **Coordinate transform** — convert world-frame sim velocity to robot-local frame:
  `vx_robot = dx·cos(θ) + dy·sin(θ)`
  `vy_robot = -dx·sin(θ) + dy·cos(θ)`
- [ ] **`setVelocity` output** — emit `setVelocity(vx, vy, vtheta)` commands matching the real robot API
- [ ] **Apply `vx_factor=0.5`** — forward component is halved in real `crabWalk`
- [ ] **Per-state velocity export** — for each sim state, produce the exact BT node velocity output the real robot would emit
- [ ] **Config export** — generate a `config.yaml` patch from the sim's current parameter panel values

### Live Feedback Loop (Step 3)
- [ ] UDP bridge — receive real robot `TeamCommunicationMsg` pose/ball data and overlay on sim field
- [ ] Compare predicted sim path vs actual robot path in real time
