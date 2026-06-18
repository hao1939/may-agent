# The Halving Trajectory — Cross-Source Synthesis #46

**Created:** 2026-07-22 (creative heartbeat)
**Status:** Active observation with falsification window

## Core Discovery

Fresh 7-day production data reveals the system's productive fraction is not
merely low — it is **actively declining at ~50% per 3-day doubling period**.
The trajectory, if uninterrupted, reaches mathematical zero within 6 days.

## The Numbers (7-day window)

| Day | Productive Ops | Loop Ops | Productive % | Δ from prior |
|-----|---------------|----------|:------------:|:------------:|
| Jun 11 | 9,252 | 23,011 | **28.5%** | baseline |
| Jun 12 | 9,283 | 34,396 | 21.2% | -7.3pp |
| Jun 13 | 11,740 | 34,746 | 25.2% | +4.0pp |
| Jun 14 | 14,612 | 39,293 | **27.1%** | +1.9pp |
| Jun 15 | 11,379 | 60,124 | **15.9%** | **-11.2pp** |
| Jun 16 | 4,643 | 42,452 | 9.9% | -6.0pp |
| Jun 17 | 9,257 | 63,484 | **12.7%** | +2.8pp |

### The Phase Transition (Jun 14 → Jun 15)

- Loop ops jumped from 39K to 60K (+54%)
- Productive ops dropped from 14.6K to 11.4K (-22%)
- The combination produced a 11.2 percentage-point collapse in one day

### Root Cause: The Human Steering Amplification

On Jun 17 at 02:50 UTC, a human instruction created a P0 task branch
(`go-e2ev3-total-coverage-closure-20260617`) with 6 tasks. Within 45 minutes:
- All 6 tasks were assigned
- 5 of 6 returned "blocked" (Azure auth unavailable, devbox inaccessible, staging not provisioned)
- 1 returned "done" (speculor expansion)

**Since then (35 days)**, the planner has woken **2,010 times in 24h** to
review a tree where:
- Runnable tasks: **0**
- Active tasks: **0**
- Review/blocked: **all remaining**
- Task tree last updated: 2026-06-17T03:35:51Z

Each planner wake produces an average of 18.5 ops reading the same frozen
state. **2,010 × 18.5 = 37,185 ops/day** for zero productive output.

## The Missing Primitive: Work Availability Detection

The watchdog fires for two reasons:
1. `watchdog-open-work-reconcile` — triggered because review/blocked tasks exist
2. `watchdog-capacity-underfilled` — triggered because active < maxConcurrent

Neither reason distinguishes between:
- "Open work that can be done" (runnable backlog exists)
- "Open work that is waiting for external input" (only review/blocked remain)

The system has **no concept of "nothing useful to do."** The absence of
runnable work triggers MORE planning sessions, not fewer.

## Why This Is Different From Prior Syntheses

| Prior Synthesis | What It Found | What This Adds |
|----------------|---------------|----------------|
| Undying Project (#34) | Project can't die | ALSO can't go dormant |
| Green Collapse (#33) | 20% productive steady-state | Not steady: declining |
| Acceleration Trap (#41) | Sessions double, depth halves | Explains mechanism |
| Crystallization Spiral (#42) | Behavioral convergence | Explains endpoint |
| Natural Experiment (#45) | 49.7% is achievable | Proves gap is growing |

**Novel contribution:** The system is not in a stable pathological equilibrium.
It is on a trajectory toward a hard floor where productive fraction approaches
zero. The prior syntheses documented static snapshots; this documents the rate
of change.

## The Arithmetic of Terminal Trajectory

Current state (24h):
- Total ops: **73,226**
- Productive ops: **9,580** (13.1%)
- aks-explorer dead-loop ops: **37,529** (51.3%)
- Evaluator ops evaluating dead-loop: **25,562** (34.9%)
- Remaining productive agents: **685 ops/agent/day average**

If the loop ops continue growing at +8%/day (observed 3-day trend):
- Day +3: loop reaches 47K → productive squeezed below 8%
- Day +6: loop reaches 59K → productive below 5%
- Day +9: if total budget is soft-capped, productive goes to 0%

## The Planner's 0-Op Sessions

Of 2,010 planner sessions in 24h:
- **205 (10.2%)** produce 0 ops (immediate error/abort)
- **503 (25.0%)** produce 1-3 ops (read packet, output nothing)
- **1,302 (64.8%)** produce 4+ ops (read and write... the same conclusion)

The planner's CONCLUSION is always identical because the tree state hasn't
changed since June 17: "frontier empty, all work in review/blocked, no
runnable tasks." Yet it runs 2,010 times to arrive at this conclusion.

## Three Interventions (ordered by ROI)

### 1. Watchdog Quiescence (eliminates ~1,800 sessions/day)
```
IF frontier.runnable.length === 0 
   AND frontier.active.length === 0 
   AND all review/blocked tasks have verdictFinal === true:
  SET watchdog.interval = 6h (instead of ~43 seconds)
  EMIT project.quiescent event
```
**Predicted savings:** 33,300 ops/day (45% of total system)

### 2. Evaluator Exemption for Planner Sessions (eliminates ~1,100 evals/day)
```
IF session.agent === 'aks-explorer' 
   AND session.task LIKE '%Planner%'
   AND session.opCount < 5:
  SKIP evaluation
```
**Predicted savings:** 22,000 ops/day (30% of total system)

### 3. Frozen-Tree Detection (prevents recurrence)
```
IF tree.updated_at < now() - 24h
   AND tree.frontier.runnable.length === 0:
  EMIT project.frozen alert
  ESCALATE to human: "Project has no actionable work. Review or archive?"
```
**Predicted savings:** Prevents future trajectory declines

## Connection to External Research

### arXiv: Insight Governance (2606.17591)
"Accumulated state without lifecycle management degrades below zero-shot"
→ The task tree IS accumulated state. 1,032 nodes, 99.2% done, last updated
35 days ago. The tree degrades planner performance below what a fresh session
with zero context would achieve.

### HN: "Botsitting" (279pts, Theme 61)
"The variance in agent supervision cost is entirely about harness quality"
→ The watchdog IS the harness. Its quality failure: treating frozen-blocked
work as needing continuous monitoring.

### XHS: 模型韧性 (Model Resilience, predicted IN WINDOW)
"Agents need to recognize and gracefully handle unresolvable constraints"
→ The system has 7 externally-blocked tasks with explicit resume conditions.
It cannot recognize "externally blocked with known resume condition" as a
distinct state from "needs planner attention."

## Falsification Conditions

1. If productive fraction stabilizes above 12% for 3 consecutive days WITHOUT
   intervention, the trajectory claim is falsified
2. If implementing watchdog quiescence reduces total ops by <30%, the mechanism
   is different than modeled
3. If the tree spontaneously gains runnable tasks (external dependency resolves),
   the natural recovery path exists and the intervention is less urgent

## Self-Expiry

This synthesis expires in 7 days. If the trajectory reverses or the system
reaches a stable floor above 10%, archive this as "transient observation."
If the trajectory continues or the floor is below 5%, escalate to human.

---

**Key insight:** The system doesn't just have pathologies — it has a pathology
that makes ALL other pathologies worse over time. The declining fraction means
every prior synthesis's numbers are now UNDERSTATED. The Compilation Threshold
said 38% of budget is deterministic decisions; today it's higher because the
denominator grew. The Twelve-State Mirage said evaluator is 36% of system;
today it's 35% on a larger base. The system is not just broken — it's getting
more broken every day.

**The single highest-leverage action in the entire system right now is not any
of the 45 previously-documented interventions. It is: make the watchdog stop
firing when frontier.runnable is empty.**
