# System Waste Analysis — 2026-04-04

## Executive Summary

**34% of all sessions in the past 7 days produced ZERO operations** — 360 out of 1074 sessions. This represents the system's single largest efficiency problem.

## Key Metrics (Last 7 Days)

| Agent | Total | Done | Interrupted | Error | Stuck | Success% | Avg Ops (done) |
|-------|-------|------|-------------|-------|-------|----------|----------------|
| May | 175 | 161 | 4 | 0 | 1 | 92% | 3.8 |
| Coach | 168 | 113 | 48 | 0 | 1 | 67% | 25.5 |
| Bob | 162 | 114 | 32 | 0 | 2 | 70% | 33.6 |
| Optimizer | 141 | 91 | 40 | 0 | 1 | 64% | 23.1 |
| QA | 136 | 117 | 11 | 0 | 0 | 86% | 3.8 |
| Amy-Kimi | 88 | 81 | 3 | 0 | 1 | 92% | 14.5 |
| Tech-Lead | 68 | 35 | 11 | 0 | 0 | 52% | 10.2 |
| Evaluator | 57 | 57 | 0 | 0 | 0 | 100% | 12.2 |
| Scout | 54 | 36 | 11 | 0 | 0 | 67% | 6.0 |
| Coder | 18 | 10 | 0 | 0 | 8 | 56% | 15.0 |
| **TOTAL** | **1074** | **822** | **160** | **0** | **14** | **77%** | — |

## Waste Categories

### 1. Request Aborted — 90 sessions, 0 ops (25% of all waste)
Agents: Optimizer (33), Coach (30), Bob (27)
- Cause: Platform-level "request was aborted" errors — sessions created but terminated before doing any work
- Average time before abort: Optimizer 463s, Coach 1316s, Bob 435s
- Coach sessions waste the most time — average 22min before abort with no output
- **This is a platform/infrastructure issue, not agent behavior**

### 2. Tech-Lead Startup Failures — 20 sessions, 0 ops
- Every tech-lead heartbeat since Mar 29 that hits an error has 0 ops
- Consistent with schema change errors (the `meta` column removal broke queries)
- **Resolution: These errors should now stop since schema was fixed**

### 3. Zombie Coder Sessions — 8 sessions still "running" with 0 ops
- All from Apr 2-3, gym runner spawning sessions that never complete
- These are **gym runs**, not production code — the gym runner doesn't clean up properly
- **Resolution: Gym runner needs session cleanup/timeout**

### 4. Idle Heartbeats — ~45 May + 37 Evaluator + 35 Amy + 25 QA = 142 sessions
- These correctly complete with 0 ops (skipIfIdle working as designed)
- Not technically waste — they CHECK for work then exit cheaply
- **No action needed — this is the desired behavior**

### 5. Productive Zero-Op — ~35 more sessions
- Mix of early-exit patterns, no-work-found scenarios
- Proper behavior but inflates the total count

## Adjusted Waste (excludes idle-by-design)

True waste (sessions that should have produced work but didn't):
- **Request aborted**: 90 sessions
- **Tech-lead startup failures**: 20 sessions  
- **Zombie sessions**: 8 sessions
- **Other errors/interrupts**: ~22 sessions
- **Total true waste**: ~140 sessions / 1074 = **13% true waste rate**

## Workflow Usage Collapse

| Week | Workflow Sessions | Standalone Sessions | WF% |
|------|------------------|---------------------|-----|
| W12 (Mar 25-31) | 187 | 1039 | 15.2% |
| W13 (Apr 1+) | 12 | 785 | 1.5% |
| Last 3 days | 0 | ~400 | 0% |

### Root Cause
**Workflows haven't "collapsed" — there's simply no production code work happening:**
1. Tech-lead has been idle since Mar 29 (no new tasks/hypotheses to implement)
2. Coach's training-sprint workflow keeps getting interrupted (3/5 failed in last 5 days)
3. The coder sessions appearing in data are gym runs (not production code), which correctly don't use workflows

### The Real Issue
The system has no work to do. Tech-lead does "early exit" on every heartbeat since Mar 31 because:
- No pending tasks injected
- No new commits to review
- No new bulletin items
- Implementation plan already COMPLETE

## Recommendations

### P0: Fix Coach Training Sprint Reliability
- 3/5 sprint attempts in last 5 days were interrupted
- The planning step exhausts turn budget (avg 1316s = 22min for 0-op interrupts)
- **Recommendation**: Break sprint planning into smaller phases OR increase maxTurns for training-sprint workflow

### P1: Address Request Aborted Problem
- 90 sessions lost to platform-level aborts
- This is an infrastructure issue, not agent behavior
- **Recommendation**: Implement checkpoint/resume for long-running sessions so work isn't lost on abort
- **Recommendation**: Add `maxTurns: 40` to all agent handlerConfigs (already escalated)

### P2: Gym Runner Session Cleanup
- 8 zombie coder sessions from gym runs
- **Recommendation**: Add timeout/cleanup to gym runner to mark sessions as failed after inactivity

### P3: Reactivate Productive Workflows
- Tech-lead needs new work to drive code-review-loop usage
- **Recommendation**: This is a task pipeline issue, not a workflow issue. When Hao assigns new implementation work, workflow usage will naturally recover.

## Cost Estimate

Assuming ~$0.50 per wasted session (avg):
- True waste (140 sessions/week): ~$70/week
- If request-aborted is fixed: saves $45/week (90 sessions)
- If training sprint is fixed: saves $15/week (coach reliability)
- Total potential savings: ~$60/week

## Methodology
- Data source: `.state/may.db` sessions table
- Time range: Last 7 days (2026-03-28 to 2026-04-04)
- Zero-op defined as `opCount = 0`
- "True waste" excludes sessions that correctly exit with 0 ops (skipIfIdle, early-exit patterns)
