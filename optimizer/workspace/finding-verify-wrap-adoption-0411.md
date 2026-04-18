# Finding: verify-wrap Adoption & Effectiveness Check (post-deployment)

**Date**: 2026-04-11T16:24Z  
**Author**: Optimizer (Mode D: Workflow Health)  
**Period**: Last 24 hours  
**Method**: may.db session queries — workflow vs raw fork comparison

---

## Executive Summary

**verify-wrap has 0% production adoption.** It was designed (EXP-138, 11:54), deployment attempted (EXP-139, 14:54), but hit a fundamental blocker: the target agent (scout) doesn't fork work sessions. Coach retargeted to optimizer at 15:24 but no actual deployment occurred. Meanwhile, bob's existing D-o-R workflow (different from verify-wrap) has 75% adoption and 100% completion rate. The other 3 agents dispatching work sessions (optimizer, coach, tech-lead) use raw `agents.fork()` exclusively.

---

## 1. Adoption Numbers (24h)

| Agent | Workflow Runs | Raw Forks | Total | Adoption |
|-------|-------------|-----------|-------|----------|
| bob | 27 (D-o-R) | 9 | 36 | **75.0%** |
| optimizer | 1 (this session) | 40 | 41 | **2.4%** |
| coach | 0 | 34 | 34 | **0.0%** |
| tech-lead | 0 | 24 | 24 | **0.0%** |
| **Total** | **28** | **107** | **135** | **20.7%** |

**Key**: Bob's 75% adoption is his pre-existing `deliver-or-report` workflow, not verify-wrap. The actual verify-wrap workflow (`agents/shared/workflows/verify-wrap.ts`) has **zero production usage**.

---

## 2. verify-wrap Deployment Timeline

| Time | Event |
|------|-------|
| 11:54 | Coach designs verify-wrap prototype (EXP-138, 87 ops) |
| 12:24 | Tech-lead reviews: "DO NOT wire in as proposed" — scout doesn't fork |
| 13:54 | Coach designs EXP-139: production pilot on scout |
| 14:54 | Coach attempts deployment, discovers scout has no fork dispatch point |
| 14:55 | Bob analyzes blocker, confirms scout does everything inline |
| 15:24 | Coach retargets EXP-139 from scout → optimizer |
| 16:24 | This measurement session — still no actual deployment |

**Root cause of non-adoption**: verify-wrap was designed for agents that don't actually fork work sessions. The deployment attempt surfaced a **mismatched mental model** — coach assumed all agents fork like bob does.

---

## 3. Bob's D-o-R Workflow Effectiveness (the workflow that IS adopted)

Bob's `deliver-or-report` is the only workflow seeing active work-session use. In 24h:

- **27 completed workflow runs** (25 D-o-R, 2 parallel-research)
- **100% completion rate** (54/54 phases done, 0 interrupted)
- **Average 38.0 ops/run** (median 27, range 3–106)
- **11 verification phases** (Phase 3: VERIFY) executed
- **0 Phase 2b (fix) phases** — verify never triggered a rework

### D-o-R vs Raw Fork (bob only)

| Metric | D-o-R (27 runs) | Raw Fork (9 sessions) |
|--------|------------------|-----------------------|
| Avg ops | 38.0 | 53.1 |
| Median ops | 27 | 54 |
| Completion rate | 100% | 100% |
| Has verification step | Yes (41% of runs) | No |

Bob's raw fork sessions are notably higher-op (53 avg vs 38 avg). The D-o-R runs tend to be more disciplined — the Phase 1 budget cap (15 ops) appears to help.

---

## 4. The 80% That's Still Raw Fork

**107 of 135 work sessions (79.3%) used raw `agents.fork()`** — no workflow structure, no verification phase.

| Agent | Raw Forks | Avg Ops | Interrupted | 
|-------|-----------|---------|-------------|
| optimizer | 40 | 35.5 | 0 (0%) |
| coach | 34 | 45.5 | 7 (20.6%) |
| tech-lead | 24 | 29.1 | 1 (4.2%) |
| bob | 9 | 53.1 | 0 (0%) |

Coach has the highest interrupt rate (20.6%) — mostly gym experiment sessions that run out of time. These are the sessions that could most benefit from budget-capping Phase 1 planning.

---

## 5. verify-wrap vs D-o-R: Why One Adopted, One Didn't

**D-o-R adopted because**: It was built INTO bob's dispatch flow by may. Bob's heartbeat dispatches work through `workflow.run('deliver-or-report', ...)` automatically. No opt-in required.

**verify-wrap not adopted because**:
1. Targeted the wrong agent (scout doesn't fork)
2. Requires manual wiring into each agent's heartbeat dispatcher
3. No may-level integration exists — it's a shared workflow file with no dispatch hook
4. Only 2 hours old — retargeting to optimizer just happened at 15:24

---

## 6. Recommendations

1. **Don't measure verify-wrap adoption yet** — it hasn't been deployed. The EXP-139 retargeting just happened.
2. **Focus on wiring** — verify-wrap needs may-level dispatch integration (like D-o-R has for bob) to achieve real adoption.
3. **Target optimizer first** — 40 raw-fork sessions in 24h, 0% interrupt rate, structured finding outputs. Good test case.
4. **Coach second** — 34 raw forks with 20.6% interrupts. The gym-experiment pattern may not fit verify-wrap's 2-phase structure.
5. **Next measurement**: Check again in 12-24h after optimizer wiring is complete.
