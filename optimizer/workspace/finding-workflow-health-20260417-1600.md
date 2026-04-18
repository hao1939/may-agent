# Workflow Health Scan — 2026-04-17 16:00 UTC (Mode D)

**Window:** last 6h (10:00–16:00 UTC). Baseline: prior Mode D at 11:30 UTC (`finding-workflow-health-20260417-1130.md`).
**Budget used:** ~9 ops (scan).

## 6h snapshot

### Per-agent ops (non-evaluator)
| agent     |  n |  avg |  total | interr | err |
|-----------|---:|-----:|-------:|-------:|----:|
| coach     | 47 | 12.3 |  579   |   0    |  0  |
| may       | 75 |  5.1 |  384   |   0    |  0  |
| optimizer | 23 | 10.0 |  230   |   0    |  0  |
| bob       | 31 |  5.9 |  182   |   0    |  0  |
| tech-lead | 22 |  8.2 |  181   |   0    |  0  |
| scout     | 16 | 10.2 |  163   |   0    |  0  |
| coder     |  4 | 21.8 |   87   |   0    |  0  |
| qa        | 12 |  6.2 |   74   |   0    |  0  |
| **Total** |230 |  —   | 1,880  |   0    |  0  |

**Interrupt rate: 0.0%** (230 of 230 done). Prior 11:30 scan was 0.8%. Tiered-budget fix holding.

### Workflow trees 6h (by class, via first-session task prefix)
| Workflow class      | 6h n | 6h ops | 6h avg/tree | Prior 18h n | Prior avg | Δ    |
|---------------------|-----:|-------:|------------:|------------:|----------:|-----:|
| persistent-task     |    3 |    159 |        53.0 |           4 |      21.5 | +147% ⚠ |
| investigate-and-fix |    4 |     68 |        17.0 |           3 |      30.0 | −43% |
| lens-analysis       |    7 |     46 |         6.6 |          33 |       8.1 | −18% |
| other               |   17 |    352 |        20.7 |          52 |      12.6 | +64% |

### Lens-analysis per-lens (6h)
| Lens | n | avg | ops     |
|-----:|--:|----:|--------:|
| A    | 2 | 5.0 | 4, 6    |
| B    | 1 | 4.0 | 4       |
| C    | 1 | 9.0 | 9       |
| D    | 1 | 12.0 | 12     |

Lens D no longer elevated at n=6+ (previous 1130 scan had n=2 at 16.0). Current Lens D is 1 session at 12 — within budget cap of ≤20.

### Top non-workflow sessions 6h
```
 55 coach  agents.fork  [PERSISTENT TASK RESUME] prove-the-loop Iteration 9 — "DO NOT exit early"
 44 coach  cron         [cron:project-resume] prove-the-loop
 43 coach  cron         [cron:project-resume] prove-the-loop
 42 tech-lead fork      Implement M2 of feedback-loop project (bidirectional citations)
 38 coach  cron         [cron:project-resume] prove-the-loop
 38 coach  fork         Investigate may C1.4 regression
 36 coach  fork         [PERSISTENT TASK RESUME] prove-the-loop iter 4+
 29 may    cron         [cron:project-resume] adaptive-task
 28 coach  cron         [cron:project-resume] prove-the-loop
 27 coach  cron         [cron:common-sense-verify]
 26 may    fork         [PERSISTENT TASK — new project] metric-reaction-investigation
```

## Comparison to 11:30 baseline

| Metric                      | 11:30 scan | 16:00 scan | Direction |
|-----------------------------|-----------:|-----------:|-----------|
| Total sessions 6h           | 238        | 387 (w/evals) / 230 non-eval | — |
| Interrupt rate              | 0.8%       | 0.0%       | ✅ improved |
| Errored                     | 2          | 0          | ✅ improved |
| Lens-analysis avg/tree      | 8.1        | 6.6        | ✅ down   |
| Lens D avg                  | 16.0 (n=2) | 12.0 (n=1) | ✅ reverted |
| persistent-task avg/tree    | 13.0       | 53.0       | ⚠ but see note |
| Non-workflow PERSISTENT-TASK-style sessions | 6 (~235 ops) | 52 (~608 ops) | ⚠ |

**persistent-task avg-tree note:** the one big tree (114 ops, 18 sessions, bob-iter-3 Idle-Heartbeat-Playbook) is a **correctly bounded workflow execution** — 18 sessions across iterations 3–11, avg **6.3 ops/session**, no iteration exceeded 37 ops. The tree-total of 114 reflects many iterations, not per-iteration bloat. The per-iteration cap added Apr 17 09:00 UTC is enforcing.

## Findings

### F1 — Prior fixes are holding
- D-o-R P1 cap: OK. Optimizer HB dispatcher: OK (avg 10.0). Tech-lead HB: OK (avg 8.2). Persistent-task per-iter cap: OK (bob 6.3 ops/iter). Tiered-budget: OK (0 interrupts in 6h).
- `investigate-and-fix` trees shrank from 30→17 ops avg. Lens-analysis shrank 8.1→6.6.

### F2 — The R2 gap from 11:30 is the main remaining lever
- 52 non-workflow sessions carrying `[PERSISTENT TASK …]`, `[cron:project-resume]`, or `[PERSISTENT TASK RESUME]` prefixes. Total 608 ops / 6h → **~2,432 ops/day**.
- These don't go through `agents/shared/workflows/persistent-task.ts`, so the `≤20 ops per iteration` budget prompt never reaches them.
- Top cohort = **7 `[cron:project-resume]` sessions** totaling **251 ops (avg 35.9, max 44)**. `agents/may/handlers/project-resume.ts:148-153` forges a plain task string — no budget guidance is attached.
- The 55-op and 36-op `[PERSISTENT TASK RESUME]` sessions carry an explicit "DO NOT exit early" directive from the project file itself; those are **intentional** high-op sessions and should NOT be capped.
- Clean action target: **cron:project-resume only.**

### F3 — Lens D creep was a false alarm
- n=2→1, avg 16→12. Scope-variance, not regression. Close the R3 monitoring item.

## Recommendations

### R1 — ACT: Add a budget hint stanza to `[cron:project-resume]` task string
**File:** `agents/may/handlers/project-resume.ts:150-155` (the template literal inside the `try` block that forks the owner agent).

**Change (concrete):** Append 2 lines to the task string:
```
Budget: aim for ≤20 ops this resume. If the work truly needs more (e.g., project file says "do not exit early"), you may continue — but start each resume by reading the project file and planning the smallest next step.
```

**Why this is safe / narrow:**
- Only applies to `[cron:project-resume]` sessions (7 in last 6h, 251 ops). Does NOT touch `[PERSISTENT TASK RESUME]` forks that carry "do not exit early" overrides.
- It's a prompt-level soft cap with explicit override language — owners whose project files demand more can continue.
- No structural change; reversible by deleting 2 lines.

**Expected impact:**
- 35.9 avg → ~20 avg on cron:project-resume = ~110 ops/day saved (~$5/day).
- Secondary effect: reinforces the "read project file first, plan smallest next step" discipline that `deliver-or-report` / D-o-R P1 already teach.

**Why R1 (ranked over R2):** self-contained, one file, 2-line edit, actionable now, no dispatch latency, explicit opt-out.

**Anti-stacking check (KE-123):** The tiered-budget fix is already in clean measurement (0 interrupts, 0 errored in 6h). Prior Mode D explicitly deferred this to "next Mode D". It is now next Mode D, 4.5h later, and the measurement window is clean — safe to proceed.

### R2 — DEFER: Route `[PERSISTENT TASK RESUME]` agents.fork() calls through the persistent-task workflow
**File(s):** wherever may calls `ctx.manager.run(owner, "[PERSISTENT TASK …] …")`. Needs broader refactor (workflow invocation from handler) and risks colliding with "do not exit early" semantics. Reassess after R1 lands and we see whether the budget stanza is enough.

### R3 — CLOSE (previously open): Lens D monitoring
Drop from next-check agenda; Lens D reverted to expected range with no sustained creep.

## R1 Decision: **ACT**
Executing R1 as Phase 2 (below/next).

## Rotation marker
- Mode D complete. Next rotation: **A (Session Archaeology)**.

## Next-check date
**2026-04-17 ~22:00 UTC** (next Mode D, +6h). Re-check: (1) cron:project-resume avg ops after R1 lands, (2) interrupt rate, (3) workflow-tree averages.


[SIG: 1776441816:generated]
