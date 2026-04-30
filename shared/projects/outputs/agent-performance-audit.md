# Agent Performance Audit — Last 7 Days

**Generated:** Iteration 40 | **Source:** `.state/may.db` (sessions + evaluations tables)

## Executive Summary

**Worst performer: `coach`** — avg quality 0.45/1.0, 46% of sessions rated "low quality" (≤0.3), 13.4% wasted call ratio. The dominant failure pattern is **zero deliverables produced** despite explicit write-first constraints.

**Best performer: `amy`** — avg quality 0.80, 89% high-quality sessions.

## Agent Rankings (by avg quality, ascending = worst first)

| Agent | Sessions | Evals | Avg Quality | Q=0 | Low (≤0.3) | Mid (0.3-0.7) | High (>0.7) | Waste Ratio |
|-------|----------|-------|-------------|-----|------------|----------------|-------------|-------------|
| **coach** | 450 | 254 | **0.45** | 2 | 115 (45%) | 76 (30%) | 61 (24%) | 13.4% |
| optimizer | 410 | 225 | 0.55 | 0 | 48 (21%) | 115 (51%) | 62 (28%) | 0% |
| may | 31 | 20 | 0.64 | 0 | 3 (15%) | 9 (45%) | 8 (40%) | 0% |
| bob | 25 | 22 | 0.67 | 0 | 2 (9%) | 8 (36%) | 12 (55%) | 0% |
| tech-lead | 2 | 2 | 0.68 | 0 | 0 | 1 (50%) | 1 (50%) | 0% |
| qa | 18 | 14 | 0.71 | 0 | 0 | 5 (36%) | 9 (64%) | 0% |
| scout | 18 | 14 | 0.74 | 0 | 0 | 4 (29%) | 10 (71%) | 0% |
| **amy** | 22 | 18 | **0.80** | 0 | 0 | 2 (11%) | 16 (89%) | 0% |

## Top Failure Patterns (from coach's low-quality sessions)

1. **Zero deliverables produced** — Agent calls `finish(success)` without creating any files. Most common issue across Q=0 and Q≤0.1 sessions.
2. **WRITE-FIRST constraint violated** — First tool call is `finish()` or `read()` instead of `write()`. Agent skips directly to completion.
3. **No verification performed** — Agent asserts success without `read()` or `bash(ls)` evidence.
4. **Outputs directory ignored** — Files not placed in required `/app/agents/shared/projects/outputs`.

## Recommendations

### 1. Coach (Priority: CRITICAL)
- **Problem:** 45% of evaluated sessions are low quality. The agent frequently produces no output.
- **Root cause:** Coach runs 450 sessions/week (highest volume), many are heartbeats that may not require deliverables but get evaluated as if they should.
- **Fix:** Either (a) exclude heartbeat sessions from deliverable-required evaluation, or (b) ensure coach heartbeats produce at least a status file.

### 2. Optimizer (Priority: HIGH) 
- **Problem:** 21% low-quality sessions, avg 0.55.
- **Root cause:** Similar to coach — high-volume heartbeat agent (410 sessions/week). Many sessions are monitoring/analysis that don't produce files.
- **Fix:** Same as coach — differentiate heartbeat evals from task evals.

### 3. All agents — iteration-log adoption
- **Current state:** 50 iterations logged in `.state/iteration-log.json`, all from this project's master-worker workflow.
- **Gap:** No other agent workflows use `recordIteration()` yet.
- **Fix:** This is expected — the integration was just added. Monitor over next week.

## Key Insight

The quality scores are heavily influenced by **evaluator expectations vs. session type**. Heartbeat sessions (coach: 450, optimizer: 410) are evaluated against deliverable-production criteria, but heartbeats are inherently monitoring/coordination work that may not produce files. The "worst performer" label may be an **evaluation bias** rather than an agent quality problem.

**Recommended next step:** Investigate whether the evaluator differentiates session types (heartbeat vs. task vs. workflow) and adjusts expectations accordingly.
