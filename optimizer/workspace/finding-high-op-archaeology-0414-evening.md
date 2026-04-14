# Finding: High-Op Session Archaeology — Apr 14 Evening

**Date**: 2026-04-14  
**Author**: Optimizer (session archaeology)  
**Status**: Confirmed root causes, actionable recommendations

---

## Sessions Investigated

### 1. Tech-Lead 86-op Session (s_1776172958751_129)
- **Ops**: 86 | **Duration**: 16.5 min | **Status**: done
- **Kind**: call | **Source**: callAgent (from may heartbeat)
- **Task**: P0 DIRECTIVE FROM HAO — STOP removing workflow.run() from heartbeats on k3s

**Root Cause**: Legitimately complex P0 task requiring:
1. Making workflow.run() gracefully skip missing workflows (not error)
2. Merging the verify-wrap fix from a review branch
3. Fixing commit guard scope to cover agents/shared/, agents/.lab/, etc.
4. Verifying tests pass

This was 3-4 distinct implementation subtasks bundled into one directive. At 86 ops / 16.5 min, the efficiency was reasonable (~5.2 ops/min) — roughly comparable to other complex implementation sessions. The session completed successfully.

**Verdict**: ✅ Justified complexity. No guard failure — this wasn't a heartbeat (budget=8) but a child call session with no budget.

---

### 2. Coach 73-op Session (s_1776174784898_152)
- **Ops**: 73 | **Duration**: 7.5 min | **Status**: done
- **Kind**: call | **Source**: workflow (from coach heartbeat)
- **Parent**: s_1776174699397_142 (coach heartbeat, 9 ops)
- **Task**: EXP-157 Hard Gate Production Deployment — Phase 2+3 Execution

**Root Cause**: Task prompt contained `⚠️ TURN BUDGET: MAX 25 TOOL CALLS` but the session used 73 ops — nearly 3× the stated budget. This happened because:

1. The **prompt-level budget is text only** — not programmatically enforced
2. The parent heartbeat got `maxTurns: 8` from `TURN_BUDGET_TIERS.heartbeat`
3. When the heartbeat spawned a child via `workflow`, **no `maxTurns` was passed** — child defaulted to `maxTurns: 0` (unlimited)
4. The cost-limit guard (`cost-limit-guard.ts`) exists but is **not wired into compose-guards** — it's imported only in tests

**Verdict**: ⚠️ Budget enforcement gap. The tiered budget system only constrains the top-level heartbeat, not its child sessions. Children inherit no budget.

---

## Systemic Analysis

### Budget Enforcement Architecture Gap

The tiered turn budget system has a structural blind spot:

```
Cron triggers heartbeat → maxTurns: 8 (enforced ✅)
  └── heartbeat calls workflow/callAgent → maxTurns: 0 (UNLIMITED ❌)
       └── workflow spawns child sessions → maxTurns: 0 (UNLIMITED ❌)
```

This means the budget only limits how many turns the heartbeat itself uses — typically 5-9 turns for reading config, dispatching work, and calling finish(). The actual expensive work happens in child sessions that have no budget.

**Evidence from last 24h**: Of 24 sessions >50 ops, only **0** were direct heartbeats. All were child sessions (kind=call or job) spawned from heartbeats via callAgent, workflow, or agents.fork.

### Cost-Limit Guard Wiring Gap

Commit `d903d58a` was supposed to "wire cost-limit guard into compose-guards chain" but the guard's `createCostLimitGuard()` function is only imported in the test file. Production sessions don't have it. The guard defaults (warn at 30, block at 50) would have caught the coach 73-op session.

### Why the Coach Session Used 73 Ops

The task was running gym trials (EXP-157), which involves:
- Reading scenario files and checking baselines
- Running `gym-batch.sh` (6 baseline + 6 treatment trials = 12 trials)
- Analyzing results with statistical tests
- Writing results file

At 73 ops / 7.5 min, this was actually efficient (~9.7 ops/min). The task itself was appropriately complex for ~50-60 ops. But the 25-tool-call budget in the prompt should have limited it.

---

## Recommendations

### R1: Wire cost-limit guard into production (P1)
The guard code exists. It needs to be imported and added to the compose-guards chain so it actually runs. Default thresholds (warn@30, block@50) are reasonable for most sessions.

**Impact**: Would have caught the coach 73-op session and all 24 sessions >50 ops in last 24h.  
**Risk**: May prematurely terminate legitimate complex tasks (merges, multi-step implementations). Needs per-session or per-kind configuration.

### R2: Propagate maxTurns to child sessions (P2)
When a heartbeat spawns children via callAgent/workflow, consider propagating a budget. Options:
- Pass `maxTurns: TURN_BUDGET_TIERS.implementation` (25) to all children
- Let the workflow definition specify per-step budgets
- Use the task-level "TURN BUDGET" text as a parsed parameter

**Caution**: This needs design thought. Some child tasks (gym runs, code reviews, multi-file merges) legitimately need 50+ ops. A blanket limit would cause partial completions.

### R3: No action needed for the specific sessions (P3)
Both sessions completed successfully with useful output. The 86-op P0 fix and 73-op experiment run were both productive. The issue is the gap between stated budgets and enforced budgets — it's a systemic concern, not an acute problem.

---

## Historical Comparison

| Metric | Tech-Lead (24h) | Coach (24h) |
|--------|-----------------|-------------|
| Sessions | 82 | 69 |
| Mean ops | ~12 | ~14 |
| Sessions >50 ops | 8 (10%) | 4 (6%) |
| Max ops | 272 | 133 |

The 86-op tech-lead session is not an outlier (8 sessions >50 ops in 24h). The 73-op coach session is slightly above normal but within the tail distribution. Neither represents a regression — they're the expected outcome of complex tasks hitting unlimited-budget child sessions.

---

## Files Referenced
- `src/lib/manager-utils.ts:163-168` — TURN_BUDGET_TIERS definition (heartbeat=8, research=15, implementation=25)
- `src/app/cron.ts:747` — Only place maxTurns is applied (heartbeat jobs)
- `src/lib/workflow-tool.ts:293` — workflow callAgent passes no maxTurns
- `src/lib/tools/cost-limit-guard.ts` — Guard exists but not wired
- `src/lib/manager.ts:290-312` — Turn budget enforcement logic (only fires when maxTurns > 0)
