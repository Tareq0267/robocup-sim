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
- [x] Two-robot team with role swap (closer robot becomes active)
- [x] Role swap hysteresis (`roleSwapDelay` timer)
- [x] Focused overlay filtering (Team tab = all robots, P1/P2/GK tab = that robot only)

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

### UI
- [x] Parameter panel with sliders for all striker and GK params
- [x] Right panel: Team tab, P1 tab, P2 tab, GK tab
- [x] State transition log per robot
- [x] Debug data (FOV error, alignment error, distance to ball, etc.)
- [x] Visual overlays: FOV cone, orientation arrow, chase circle, alignment line, shoot cone, tangent/radial vectors, ball velocity, assist target marker
- [x] Drag-to-reposition: ball, both strikers, goalkeeper
- [x] Play/pause, speed control, simulation reset

### Parameter Alignment
- [x] All striker parameters matched to `subtree_striker_play.xml`
- [x] All goalkeeper parameters matched to `subtree_goal_keeper_play.xml`
- [x] All speed values verified against `config.yaml`

---

## What Still Needs to Be Done

### Strategy Sim (Step 1)

- [ ] **Goal detection + scoring** — detect when ball crosses goal line, show score, reset ball to centre
- [ ] **Cross kick** — `decision=='cross'`, `speed_limit=0.4` low-power pass to teammate instead of full shot
- [ ] **Cost-based role switching** — replace pure-distance swap with composite cost matching `updateCostToKick()` (distance + angle to goal + obstacle penalty)
- [ ] **Ball out of bounds** — detect ball leaving field, reset per rules (throw-in / goal kick / corner)
- [ ] **Opponent robots** — add 3 passive or simple opponent robots to test defensive scenarios
- [ ] **Free kick logic** — positioning, wall distance, kickoff side handling from `subtree_striker_freekick.xml`
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
