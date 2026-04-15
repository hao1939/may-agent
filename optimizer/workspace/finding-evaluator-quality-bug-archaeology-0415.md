# Finding: Evaluator quality=0.00 Bug Archaeology (IT-28)

**Date**: 2026-04-15  
**Session analyzed**: `s_1776277963790_29` (tech-lead, 108 ops, status: done)  
**Secondary**: `s_1776273705363_54` (coach, 80 ops, status: interrupted)

---

## Executive Summary

The tech-lead 108-op session successfully identified and fixed a real systemic bug where evaluator agent sessions were scored quality=0.00, dragging `quality.system` from ~0.91 to ~0.68. The fix was deployed and metric recovered from **0.68 → 0.87** within 2 hours. The 108 ops were justified — this was a multi-file investigation+fix across 3 codebases (DB, evaluation-sync handler, evaluator.ts library).

The coach 80-op "interrupted" session was **NOT** doing the task described in its task field (Promoted Skill Regression Check). It was actually running EXP-165 gym trials when it hit a timeout. The actual regression check was completed later in a separate 32-op session.

---

## Part 1: Tech-Lead 108-Op Session (IT-28 Fix)

### Root Cause Found
Evaluator agent sessions were getting `quality=0, efficiency=0, verdict="skipped"` in the evaluations table. When `quality.system` metric averaged all evaluations, these 2,311 zero-quality rows dragged the average from 0.91 to 0.68.

### The Bug Chain
1. `evaluation-sync.ts` had an explicit `agent === "evaluator"` check that returned `{quality: 0, verdict: "skipped"}`
2. These rows were still **inserted** into the evaluations table (not actually skipped from insertion)
3. The `quality.system` metric query (`SELECT round(avg(quality), 2) FROM evaluations WHERE createdAt > ...`) averaged ALL rows including these zeros
4. No filter on `skippedByJs` or `verdict="skipped"` existed in the metric query

### Three-Part Fix Applied
1. **evaluation-sync.ts** (agents/ repo): Added `AND agent != 'evaluator'` to the session query, so evaluator sessions are never processed for evaluation. Removed dead `isEvaluator` branches.
2. **DB metric query**: Updated `quality.system` source_query to `WHERE skippedByJs = 0`
3. **evaluator.ts** (src/ main repo): Added `if (ev.verdict === "skipped") continue;` in `getAgentScoreSummary` to filter skipped evals from averages
4. **DB cleanup**: Deleted 2,311 historical evaluator `skippedByJs=1` rows

### Deployment Status
| Component | Location | Status |
|-----------|----------|--------|
| evaluation-sync.ts | agents/ repo (disk) | ✅ Applied, committed to agents/ |
| evaluator.ts | src/ (review branch) | ⚠️ Review branch `review/fix-eval-zero-quality` was created but **no longer exists** on main. Fix may be lost. |
| DB metric query | .state/may.db | ✅ Applied directly |
| DB cleanup | .state/may.db | ✅ 2,311 rows deleted |

### Metric Recovery Evidence
```
2026-04-15T15:06  quality.system = 0.67  (before fix)
2026-04-15T16:06  quality.system = 0.67
2026-04-15T17:06  quality.system = 0.68
2026-04-15T18:06  quality.system = 0.68  (fix deployed ~18:49)
2026-04-15T19:06  quality.system = 0.84  (after fix)
2026-04-15T20:06  quality.system = 0.87
2026-04-15T21:06  quality.system = 0.87
```

### Was 108 Ops Justified?
**Yes, mostly.** Breakdown of the 55 assistant turns:
- Ops 1-12: Searching for metric definitions, understanding the system (13 ops, reasonable for unfamiliar codebase)
- Ops 13-20: Reading evaluation-sync.ts, implementing 3 edits + DB fix (8 ops, efficient)
- Ops 21-26: Checking metrics.ts CLI + validating other metric queries (6 ops, thoroughness)
- Ops 27-43: Running tests, dealing with pre-existing test failures, verifying compilation (17 ops — some waste from test failures)
- Ops 44-55: Git operations — stash confusion, review branch creation, agents/ commit, 3 finish() attempts (12 ops — waste from git confusion and FM-3.3 verification issues)

**Waste areas**: ~29 ops on testing/git/finish overhead vs ~26 ops on actual investigation+fix. The session would ideally be ~60-70 ops. The overhead was from:
- Pre-existing test failures causing unnecessary stash/restore cycles
- `agents/` being a separate git repo causing confusion
- Multiple finish() attempts (FM-3.3 pattern)

### ⚠️ Open Risk: evaluator.ts Fix May Be Lost
The `src/lib/evaluator.ts` fix (filtering skipped verdicts in `getAgentScoreSummary`) was committed to a review branch `review/fix-eval-zero-quality` that no longer appears in the branch list. Currently `grep "verdict.*skipped" src/lib/evaluator.ts` returns nothing — **the fix is NOT on main**. This means:
- The DB-level fix and evaluation-sync.ts fix prevent new zero-quality rows
- But `getAgentScoreSummary()` still doesn't filter skipped verdicts
- If any skipped evaluations leak through, they'd still corrupt averages in code paths using that function

**Recommendation**: Re-apply the evaluator.ts fix to main.

---

## Part 2: Coach 80-Op Interrupted Session

### Task Mismatch
- **Task field says**: "Promoted Skill Regression Check (Apr 15)"
- **Actually doing**: Running EXP-165 experiment gym trials (H-161 independence retest)
- **Why**: The session was created via a workflow, and the actual work content diverged from the task label. This is a data quality issue — session tasks should reflect actual work.

### Interruption Cause
The session was aborted (`error: "Request was aborted."`) while running gym trials at 80 ops. This was a **timeout**, not a crash — the gym trials take ~96s each and the session was running 5 trials per arm across 4 arms (20 total), easily exceeding session time limits.

### Work Recovery
- **EXP-165 was completed** in a subsequent 38-op session (`s_1776273705363_54` at 18:50)
- **Promoted Skill Regression Check** was completed in a separate 32-op session at 20:23
- **No work was permanently lost** — the checkpoint saved at op 19 preserved the experiment state

### Why 80 Ops for an Interrupted Session?
The opCount=80 appears inflated. Only 21 assistant turns were recorded in the compact log. The remaining ops likely come from gym runner child processes that increment the op counter. This is a **measurement artifact** — the session was doing useful work that naturally required many tool calls (gym runs).

---

## Systemic Insights

### 1. Evaluator Self-Scoring Is a Design Flaw
The root issue: the evaluation pipeline tries to evaluate ALL sessions including meta-agents (evaluator). Meta-agents shouldn't be quality-scored because they don't produce user-facing deliverables. The fix was surgical (exclude evaluator from query), but a more robust approach would be an explicit `meta_agent` flag on sessions or a configurable exclusion list.

### 2. quality.system Metric Was Silently Degraded for Days
Coach reported IT-28 because quality.system dropped from ~0.94 to 0.68. But nobody noticed for multiple heartbeat cycles because:
- No alert threshold was configured for quality.system
- The metric degradation was gradual (more evaluator sessions = more zeros)
- Other quality metrics (quality.coder, quality.bob) were fine (agent-specific)

### 3. Review Branch Loss Is a Recurring Pattern
The tech-lead created `review/fix-eval-zero-quality` but it was apparently cleaned up or never merged. The src/ evaluator.ts fix is now missing from main. This pattern (fix on review branch → branch disappears → fix lost) should be tracked.

### 4. Session Task Labels Can Be Misleading
The coach 80-op session's task field didn't match its actual work. For archaeology/auditing purposes, this means we can't trust task fields alone — must inspect actual session content.

---

## Recommendations

1. **P1**: Re-apply the `src/lib/evaluator.ts` fix (filter `verdict === "skipped"` in `getAgentScoreSummary`)
2. **P2**: Add an alert threshold for quality.system (e.g., alert if < 0.80)
3. **P2**: Consider adding `excludeFromEvaluation` flag to session metadata for meta-agents
4. **P3**: Investigate why review branches disappear — is there an automated cleanup?
