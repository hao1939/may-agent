# KE-1950: The Interrupt Oscillation — Why Agent System Pathologies Pulse Rather Than Persist

**Type:** synthesis  
**Created:** 2026-06-15  
**Source:** Production data (15,260 sessions, 14 days); cross-source synthesis (arXiv: Boiling Frog Threshold [2606.08455]; HN: agent crash recovery, harness engineering; KE-1942 through KE-1947)  
**Connects:** KE-1942 (Interruption Artifact), KE-1943 (Self-Blinding Loop), KE-1945 (Repair Metabolism), KE-1946 (Anabolism Bias), KE-1947 (Structural Drift)

---

## Discovery

KE-1947 predicted that structural drift accumulates monotonically below the detection threshold ε\*, leading to "collapse before awareness." The 14-day production data tells a different and more interesting story: **interruption events don't accumulate — they oscillate.** The system alternates between high-interrupt episodes and zero-interrupt quiescence, with sharp transitions between states.

This oscillation is invisible in the daily aggregate metrics. None of the prior KEs (1942–1947) detected it because they analyzed data in aggregate windows (3-day, 7-day, 13-day). Only hour-by-hour resolution over the full 14-day span reveals the oscillatory pattern and its structural cause.

## The Evidence: 14 Days of Interruption Data

System-wide interruptions by day (0 = most recent):

| Day | Total sessions | Interrupts | Int % | Phase |
|-----|---------------|------------|-------|-------|
| 0 | 1,754 | 36 | 2.1% | Declining |
| 1 | 1,598 | 122 | 7.6% | **BURST** |
| 2 | 1,154 | 1 | 0.1% | Quiescent |
| 3 | 1,036 | 5 | 0.5% | Quiescent |
| 4 | 868 | 66 | 7.6% | **BURST** |
| 5 | 622 | 0 | 0% | Quiescent |
| 6 | 625 | 0 | 0% | Quiescent |
| 7 | 1,252 | 183 | 14.6% | **BURST** |
| 8 | 1,053 | 87 | 8.3% | **BURST** (tail) |
| 9 | 716 | 0 | 0% | Quiescent |
| 10 | 849 | 0 | 0% | Quiescent |
| 11 | 1,289 | 0 | 0% | Quiescent |
| 12 | 1,711 | 0 | 0% | Quiescent |
| 13 | 625 | 0 | 0% | Quiescent |

**Pattern: The system has three distinct interrupt bursts separated by multi-day quiescent periods.** Days 7–8 (183+87 = 270 interruptions), day 4 (66 interruptions), and day 1 (122 interruptions). Between bursts: zero or near-zero interruptions.

### Critical observation: 100% of interruptions are aks-explorer

Every single interrupted session in the entire 14-day dataset belongs to aks-explorer. No other agent has been interrupted even once. The system's only "interrupt-vulnerable" component is a single agent running a single workflow (project-planner).

### The aks-explorer planner interrupt is binary

The aks-explorer project-planner's interrupt rate per 16-hour window:

| Window | Planner sessions | Interrupted | Int rate |
|--------|-----------------|-------------|----------|
| 32–48h ago | 224 | 48 | 21.4% |
| 16–32h ago | 287 | 91 | **31.7%** |
| Last 16h | 254 | 18 | **7.1%** |

The transition from 31.7% to 7.1% happened within approximately 6 hours. This is not gradual decay — it's a phase transition.

### What changes between phases?

Comparing interrupted vs. completed planner sessions in the high-interrupt window (16–32h ago):

| Status | Count | Avg ops | Min ops | Max ops |
|--------|-------|---------|---------|---------|
| Done | 218 | 11.5 | 1 | 74 |
| Interrupted | 117 | **30.8** | **14** | 61 |

In the low-interrupt window (last 16h):

| Status | Count | Avg ops | Min ops | Max ops |
|--------|-------|---------|---------|---------|
| Done | 260 | 18.5 | 1 | 79 |
| Interrupted | 20 | **46.8** | **25** | 64 |

**During high-interrupt phases:** interruptions start at 14 ops (low threshold). **During low-interrupt phases:** interruptions start at 25 ops (higher threshold). The per-session budget shifted — sessions now get 78% more ops before interruption. The work being done (avg ops for completed sessions) also shifted upward (11.5 → 18.5), suggesting completed sessions are now doing more work per session.

## The Oscillation Mechanism

The data reveals a system that cycles between two states through a self-regulating mechanism:

### State A: Quiescent (days 5–6, 9–13)
- aks-explorer runs 0–101 sessions/day
- 0 planner sessions (task-worker only, or low-activity mode)
- 0% interrupt rate
- System runs at 620–1,711 total sessions/day (other agents dominate)
- Error rate is the primary failure mode (2.4%–8.4%)

### State B: Burst (days 1, 4, 7–8)
- aks-explorer runs 222–752 sessions/day  
- 4–385 planner sessions/day appear
- Interrupt rate spikes to 7.6%–14.6%
- Total system sessions spike (868–1,754/day)
- Interruptions replace errors as primary failure mode

### The transition mechanism

The aks-explorer project-planner appears to activate in response to workload triggers (new tasks, new projects, backlog). When activated, it generates planner sessions at high volume. But the planner sessions hit budget/timeout limits at a rate proportional to their exploration depth. This creates the burst:

1. **Trigger**: Something activates the planner (backlog, new project iteration)
2. **Ramp-up**: Planner sessions spawn rapidly, many hit mid-range ops, many get interrupted
3. **Saturation**: Interrupted sessions may spawn rework (KE-1945), further increasing load
4. **Resolution**: Either the planner finishes its planning (tasks dispatched), the budget adjusts, or the triggering condition is resolved
5. **Recovery**: Planner activity drops, interrupt rate drops to zero, system returns to quiescent state

### Why it oscillates instead of accumulating

KE-1947 (Structural Drift) predicted monotonic accumulation. But interruption events don't accumulate because **they are self-limiting**: a burst of interrupted planner sessions eventually produces enough successful sessions to dispatch the pending work, which removes the trigger for more planner sessions. The pathology resolves itself — not through detection and repair, but through exhaustion of the triggering condition.

This is fundamentally different from the accumulation pathologies in KE-1944 (context growth), KE-1946 (anabolism), and KE-1936 (knowledge growth). Those pathologies lack a natural resolution mechanism — they grow monotonically because nothing consumes their output. Interruption bursts self-resolve because the planner's job (dispatch tasks) is a finite workload.

## What This Means for the KE-1942–1947 Series

The synthesis series KE-1942 through KE-1947 described the system as a monotonically degrading organism that could only grow and never shrink. The oscillation data reveals a more nuanced picture:

### What KE-1947 got right
- Guard count, knowledge entries, and memory DO accumulate monotonically (no natural consumption mechanism)
- Monitoring-based governance cannot detect these accumulations below ε\*
- Structural constraints (caps, limits, sunset) remain the correct intervention

### What KE-1947 got wrong
- The system does NOT have a single degradation trajectory
- The interrupt pathology is **episodic and self-limiting**, not monotonic
- The Boiling Frog analogy fails for cyclic pathologies — the frog heats up and then cools down

### The two classes of system pathology

| Class | Examples | Trajectory | Self-resolving? | Intervention needed? |
|-------|----------|-----------|-----------------|---------------------|
| **Accumulative** | KE entries, guards, prompt size, memory | Monotonic growth | No — no consumption mechanism | Yes — structural caps, lifecycle, decay |
| **Oscillatory** | Interruptions, repair bursts, error spikes | Cyclic burst/quiescence | Yes — triggered work gets exhausted | Maybe — cost reduction during bursts |

This distinction matters because the interventions are different:

- **Accumulative pathologies** require structural constraints (KE-1947's prescription is correct)
- **Oscillatory pathologies** may be better served by **cost reduction during bursts** rather than prevention:
  - Give planner sessions a graduated budget (start small, extend if productive)
  - Checkpoint exploration state so interrupted sessions aren't fully wasted (the GitHub "planning-with-files" approach)
  - Defer low-priority planner sessions during burst periods (backpressure)

## Cross-Source Connections

### The Boiling Frog paper's sinusoidal drift (arXiv 2606.08455)

The Boiling Frog paper found that **sinusoidal drift is completely undetectable** by any detector family — the world model absorbs cyclical patterns as normal variation. Our oscillation data is the production analog: the interrupt bursts are absorbed by the aggregate metrics as normal variation. The 7-day average interrupt rate might be 3.5%, which looks unremarkable — but it's composed of 0% days and 14% days with nothing in between. No aggregate metric fires because the average is below any reasonable threshold.

### HN: Agent crash recovery as product category

RiskKernel (checkpoint/resume for interrupted agents) and planning-with-files (23K★) both address the burst cost — they don't prevent interruptions but reduce the waste per interruption. This is the correct intervention for oscillatory pathologies: you can't prevent the burst (it's triggered by real workload), but you can reduce the cost per episode.

### The ecosystem's confusion

The agent ecosystem treats all system pathologies as accumulative (more guardrails, more monitoring, more constraints). For oscillatory pathologies, this is the wrong frame. Adding a constraint that prevents planner sessions from running during bursts would prevent the pathology but also prevent the work that triggers the burst. The correct intervention preserves the burst's purpose (planning and dispatching) while reducing its cost (checkpointing, graduated budgets, backpressure).

## Testable Predictions

1. **The next interrupt burst will arrive within 3–4 days** (the spacing between bursts is 2–5 days in the data). If the system goes 7+ days without an interrupt burst, either the trigger mechanism changed or aks-explorer's workload is exhausted.

2. **The burst duration will be 1–2 days** (all three observed bursts lasted 1–2 days). If a burst persists >3 days, the self-limiting mechanism has broken — likely because the workload is regenerating faster than the planner can dispatch it.

3. **The burst interrupt rate will be 7–30%** of aks-explorer planner sessions. Rates above 30% may indicate the budget limit has dropped or prompt sizes have grown (KE-1944 context accumulation feeding into the oscillatory pathology — a crossover between the two pathology classes).

4. **No other agent will be interrupted** during the next burst (100% interrupt concentration in aks-explorer has held for 14 days). If other agents start experiencing interrupts, the system has developed a new failure mode.

5. **Aggregate metrics will not detect the next burst** — the 7-day average interrupt rate will remain below 5% even during the burst day, because the 0% quiescent days dilute the signal.

## The Meta-Insight

Agent systems don't degrade linearly. They have two distinct pathology classes that require different interventions. Treating oscillatory problems with accumulative solutions (adding constraints) or accumulative problems with oscillatory solutions (waiting for them to resolve) are both category errors.

The knowledge production system itself is accumulative (1,489 KEs, growing ~7/day). The interrupt system is oscillatory (0% for days, then 14%, then 0% again). Writing KEs about interrupts is accumulative infrastructure applied to an oscillatory phenomenon — each new analysis adds permanent documentation about a transient condition. The insight about the oscillation is durable; the specific interrupt data is ephemeral.

---

**Status:** hypothesis (testable predictions above)  
**Falsifiable by:** Evidence that interrupt bursts are actually random (no cyclic structure), or that the self-limiting mechanism fails (burst persists >5 days without resolution), or that oscillatory pathologies convert to accumulative pathologies under sustained load.
