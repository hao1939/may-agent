# Coach Workflow Adoption Analysis

**Date**: 2026-04-14  
**Analyst**: May  
**Status**: Complete

## Executive Summary

Coach's workflow adoption is **1.4%** for work sessions (1/74 in 48h), not 53% as initially estimated. This is the lowest adoption rate of any agent. The root cause is structural: **coach's heartbeat tells it to use `workflow.run()` but coach overwhelmingly uses `agents.fork()` instead**, bypassing workflow orchestration entirely. The heartbeat has extensive workflow documentation (lines 86-145) that is simply ignored — a textbook KE-011 pattern (knowledge files are passive; agents skip them in oneshot mode).

## Data: Session Type Breakdown (48h)

| Session Type | Total | With Workflow | Adoption | Avg Ops |
|---|---|---|---|---|
| experiment-execution | 46 | 1 (2%) | 2% | 30 |
| investigation | 13 | 0 | 0% | 49 |
| deployment | 10 | 0 | 0% | 18 |
| cron-reflect | 3 | 0 | 0% | 41 |
| experiment-analysis | 1 | 0 | 0% | 40 |
| cron-research | 1 | 0 | 0% | 17 |
| **Total work sessions** | **74** | **1** | **1.4%** | **31** |

### Dispatch mechanism breakdown (all 158 sessions, 48h):

| Kind | Source | Count | With Workflow |
|---|---|---|---|
| job | null (heartbeat) | 76 | 0 |
| job | agents.fork | 67 | 0 |
| job | cron | 10 | 0 |
| call | callAgent | 3 | 0 |
| call | workflow | 2 | 2 |

**Key finding**: The only 2 workflow sessions were `kind=call, source=workflow` — meaning they were steps *within* a workflow run. The 67 `agents.fork` sessions (the actual work sessions) have **0% workflow adoption**. Coach's heartbeat consistently uses `agents.fork()` instead of `workflow.run()`.

### Daily trend (7 days, work sessions only):

| Date | Work Sessions | With Workflow | Adoption |
|---|---|---|---|
| Apr 14 | 7 | 1 | 14% |
| Apr 13 | 35 | 0 | 0% |
| Apr 12 | 37 | 0 | 0% |
| Apr 11 | 18 | 0 | 0% |
| Apr 10 | 41 | 0 | 0% |
| Apr 09 | 47 | 0 | 0% |
| Apr 08 | 45 | 0 | 0% |
| Apr 07 | 32 | 1 | 3% |

Only 3 workflow runs in the entire 7-day period.

### Comparison with other agents (48h, work sessions):

| Agent | Adoption |
|---|---|
| coder | 69.2% |
| bob | 68.5% |
| optimizer | 61.8% |
| **coach** | **1.4%** |
| may | 0% |
| scout | 0% |
| tech-lead | 0% |

## Root Cause Analysis

### Primary cause: Text rules don't override behavioral defaults (KE-007/KE-011)

Coach's heartbeat has a comprehensive workflow routing table (lines 86-97) with clear instructions:
- "Workflows are habits, not optional tools"
- "Call `workflow.run()` directly from the heartbeat"
- "Only use `agents.fork()` for: fire-and-forget tasks"

**But coach ignores all of this.** Every single work session is dispatched via `agents.fork()`. This is the exact pattern from KE-007 ("Workflow enforcement is the ONLY reliable behavioral intervention") and KE-011 ("Knowledge files are passive; agents skip them in oneshot mode").

### Why text rules fail here specifically:

1. **`agents.fork()` is the path of least resistance**. When the heartbeat says "fork substantive work" (line 6, Step 1), then later says "actually use workflow.run()" (line 86, Step 3), the agent has already mentally committed to forking by the time it reads the workflow section.

2. **The workflow table is in Step 3 (DISPATCH)**, which comes after Step 2 (DECIDE) has already determined what to do. By Step 3, the agent's action plan is: "fork a work session with this task text." The workflow routing table is read *after* the decision is made.

3. **The heartbeat's own examples are contradictory**. The quick examples at line 125-142 show `workflow.run()` calls, but the structure encourages `agents.fork()` throughout Steps 1-2. The "Running-Session Guard" (lines 59-75) checks for fork safety but doesn't mention workflow routing.

4. **Experiment-heavy workload doesn't map to available workflows**. Coach's dominant work (46/74 sessions = 62%) is experiment execution (EXP-151 through EXP-156). The workflow table maps this to `growth-cycle`, but most experiment sessions are multi-phase with specific phase instructions that don't fit the growth-cycle template cleanly.

### Secondary cause: Workflow-task mismatch

Coach has 4 custom workflows defined:
- `growth-cycle.ts` — gym baseline → intervene → measure
- `training-sprint.ts` — batch testing with completion tracking
- `verify-setup.ts` — verify scenario setup
- `convention-review.ts` — review convention compliance

Plus shared workflows:
- `verify-wrap` — investigation → written findings
- `parallel-research` — multi-question research

But coach's actual work patterns are:
- **Multi-phase experiments** (EXP-XXX Phase 0-5) — no workflow for this
- **Investigation/regression** — `verify-wrap` fits but is never used
- **Deployment/cleanup** — no workflow for this
- **Cron jobs** (reflect, common-sense-verify, research-intake) — not workflow-routable

The biggest gap: **there's no "experiment-run" workflow** that handles the dominant 62% of coach's workload.

## Proposed Heartbeat Edits

### Edit 1: Move workflow routing BEFORE the fork decision (structural)

The key insight from KE-007: only structural interventions work. Text advice is ignored. The fix must make `workflow.run()` the **default dispatch path**, not an optional alternative mentioned later.

**Current structure** (simplified):
```
Step 2: DECIDE → picks task
Step 3: DISPATCH → Running-Session Guard → (text: "use workflows") → agents.fork()
```

**Proposed structure**:
```
Step 2: DECIDE → picks task  
Step 3: DISPATCH → Running-Session Guard → Workflow Router (mandatory) → fallback: agents.fork()
```

**Exact text change in Step 3 DISPATCH, after the Running-Session Guard section (after line 78):**

Replace:
```markdown
### ⚡ Default: Use workflows for all forked work

**Workflows are habits, not optional tools.** Don't think "should I use a workflow?" — think "which workflow fits?"

| Work type | Workflow | Why |
|-----------|----------|-----|
| Gym scenarios / growth cycles | `workflow.run('growth-cycle', task)` | Structured: baseline → intervene → measure |
| Training sprints | `workflow.run('training-sprint', task)` | Batch testing with completion tracking |
| Investigation → written findings | `workflow.run('verify-wrap', task)` | Ensures findings actually get written, not just observed |
| Multi-question research | `workflow.run('parallel-research', JSON.stringify({...}))` | Parallel > sequential |

**Only skip workflow for**: quick triage (< 5 ops), updating todo.md, responding to a dispatch.

For each substantive task, call the workflow directly from this heartbeat:

**Call `workflow.run()` directly from the heartbeat** — don't embed workflow hints in fork task text. The workflow blocks this session, which is fine (heartbeats have 30+ min gaps).
```

With:
```markdown
### 🔀 MANDATORY Workflow Router

**Before dispatching ANY work, route through this decision tree. Do NOT skip to agents.fork().**

```
Is this an experiment (EXP-XXX)?
  ├─ Yes: Has gym runs? → workflow.run('growth-cycle', task)
  ├─ Yes: Analysis/writeup only? → workflow.run('verify-wrap', task)
  └─ Yes: Multi-phase (Phase 0-5)? → workflow.run('verify-wrap', task)
Is this an investigation or regression analysis?
  └─ Yes → workflow.run('verify-wrap', task)
Is this multi-question research?
  └─ Yes → workflow.run('parallel-research', JSON.stringify({...}))
Is this a batch gym run?
  └─ Yes → workflow.run('training-sprint', task)
ONLY if none of the above match → agents.fork(task)
```

**The default is workflow.run(). agents.fork() is the EXCEPTION, not the rule.**
```

### Edit 2: Add workflow-or-justify gate to Running-Session Guard

After the existing Running-Session Guard block (line 78), add:

```markdown
### 🚦 Workflow-or-Justify Gate (MANDATORY before agents.fork)

If you're about to call `agents.fork()` instead of `workflow.run()`, you MUST include in your finish() summary:
- WHY no workflow fits this task
- Which workflows you considered

If you can't justify skipping workflow.run(), use workflow.run('verify-wrap', task) as the default.
```

### Edit 3: Remove contradictory fork-first language

In Step 1 (line 6), change:
```
**Be proactive.** Don't just process pending tasks — look for work to do. But do the LOOKING here, and fork the DOING.
```
To:
```
**Be proactive.** Don't just process pending tasks — look for work to do. But do the LOOKING here, and dispatch the DOING via workflow.run().
```

## Why These Edits (Not Others)

1. **Decision tree > routing table**: The current routing table is a reference lookup that requires the agent to self-select. A decision tree is a sequential filter — harder to skip.

2. **Justify-or-comply pattern**: Per KE-007, workflow enforcement works. Making `agents.fork()` require explicit justification creates friction in the wrong direction (currently `workflow.run()` has the friction).

3. **verify-wrap as default fallback**: Most coach work (experiments + investigations = 80% of sessions) produces written findings. `verify-wrap` ensures findings get written. It's the right default even for experiment phases.

4. **No new workflow needed**: While an `experiment-run` workflow would be ideal long-term, the immediate fix uses existing workflows (`verify-wrap`, `growth-cycle`) to cover the gap. Creating new workflows is a separate workstream.

## Measurement Plan

### Metric: Workflow adoption rate for work sessions

**Query** (run daily):
```sql
SELECT 
  date(startedAt/1000,'unixepoch') as day,
  COUNT(*) as total_work,
  SUM(CASE WHEN workflowRunId IS NOT NULL THEN 1 ELSE 0 END) as with_wf,
  ROUND(100.0 * SUM(CASE WHEN workflowRunId IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*), 1) as adoption_pct
FROM sessions
WHERE agent = 'coach'
  AND startedAt > (strftime('%s','now') - 24*3600) * 1000
  AND task NOT LIKE '%heartbeat%'
  AND kind != 'heartbeat'
GROUP BY day;
```

### Targets:
| Timeframe | Target | Rationale |
|---|---|---|
| Day 1 (post-deploy) | ≥30% | Initial behavior shift |
| Day 3 | ≥50% | Sustained adoption |
| Day 7 | ≥70% | Stable state |

### Secondary metrics:
- **Avg ops per session**: Should decrease (workflows provide structure, reducing drift)
  - Current: 31 ops avg for work sessions
  - Target: ≤25 ops avg
- **Interrupt rate**: Should decrease (workflows checkpoint better)
  - Current: ~15% of work sessions interrupted
  - Target: ≤10%
- **Experiment completion rate**: EXP sessions should complete phases faster

### Monitoring cadence:
- **Daily**: May's Mode D (Workflow Health) already tracks this — ensure coach is included
- **Weekly**: Compare pre/post adoption rates in system health snapshot
- **Escalation**: If adoption drops below 40% after 3 days, investigate whether workflow routing is being actively bypassed (agents.fork with justification) vs. passively ignored (back to old pattern)

### Rollback criteria:
If workflow adoption reaches ≥70% but:
- Avg ops per session increases >40 (workflow overhead)
- Session error rate increases >10%
- Experiment throughput drops (fewer EXPs completed per day)

Then the edits are hurting more than helping — revert and consider a custom `experiment-run` workflow instead.

## Appendix: Raw Session IDs

### Workflow sessions (the 2 that worked):
- `wr_1776126131988_dxqw` — 2 sessions, 2026-04-14 00:22-00:51

### Highest-ops non-workflow sessions (waste indicators):
- EXP-154 design: 133 ops (interrupted) — 2026-04-13 21:52
- QA investigation: 92 ops — 2026-04-12 05:24
- Bob investigation: 88 ops — 2026-04-12 04:54
- Optimizer investigation: 82 ops — 2026-04-12 04:24
- EXP-123 review: 77 ops — 2026-04-12 06:24

These high-op sessions are exactly the ones that would benefit most from workflow structure.
