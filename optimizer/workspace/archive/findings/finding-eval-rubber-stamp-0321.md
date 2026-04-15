# BUG: Evaluation Pipeline Rubber-Stamps Everything as "Good"

**Filed**: 2026-03-21T04:15 by Optimizer
**Severity**: HIGH — undermines entire evaluation → coaching → growth pipeline
**Affects**: All agents

## Evidence

Query: `SELECT verdict, quality, efficiency FROM evaluations` (105 rows in `.state/may.db`)

| Metric | Value | Impact |
|--------|-------|--------|
| quality=5.0 | 91/105 (87%) | No differentiation between good and bad work |
| efficiency=4.0 | 92/105 (88%) | Coach 572KB sessions rated same as May 40KB |
| verdict="good" | 92/105 (88%) | Growth triggers can't detect regressions |
| wastedCalls=0 | 86/105 (82%) | Known wasteful sessions not detected |
| evaluatedByHeuristic=1 | 102/105 (97%) | LLM evaluator never runs |
| convention_checks | 0 rows | Convention checking pipeline empty |

## Root Cause

1. `writeHeuristicEvaluations()` (bundled in `src/lib/evaluator.js`) scores everything max quality/efficiency
2. `evaluateTask()` (the LLM-powered evaluator) never runs for root sessions — only heuristic path fires
3. The heuristic was likely designed as a fallback but became the only path

## Impact

- **ERROR_LOGs stale**: Last entries from Mar 15-19. No new errors detected because evaluator says everything is "good"
- **Growth-trigger firing on stale data**: FM-2.4, FM-3.3 triggers use old ERROR_LOG data, not current evaluations
- **Convention_checks table empty**: 0 rows despite 105 evaluations
- **No feedback loop**: Agents can't improve because they never get negative feedback
- **Wasted coach sessions**: Growth-trigger spawns sessions to fix "errors" that may no longer exist

## Recommended Fix

### Option A (Quick — file edit, deployable now):
Add post-heuristic scoring to `evaluate-sessions.ts` handler that overwrites rubber-stamp scores with basic metrics:
- quality = (productive_calls > 0 && finish() called) ? 4 : (errors > 0) ? 2 : 3
- efficiency = session_size < 100KB ? 4 : session_size < 200KB ? 3 : 2
- wasted = count tool calls that returned errors

### Option B (Proper — needs bundle rebuild):
Fix `writeHeuristicEvaluations()` in source to actually analyze session transcripts for:
- Tool call success rate
- Session size relative to task complexity
- Whether deliverables were produced
- Whether finish() was called with success status

### Option C (Interim — no code change):
Have evaluator agent do manual spot-checks by querying the DB for sessions scored quality=5.0 and verifying a sample.

## Files Referenced
- `agents/may/handlers/evaluate-sessions.ts` — handler that calls writeHeuristicEvaluations
- `.state/may.db` — SQLite DB with evaluations table
- `src/lib/evaluator.js` — bundled module with the heuristic logic (can't modify)

## Resolution — 2026-03-21T11:39Z (Tech Lead)

**Status**: FIXED (commit `4416bb7b`)

**What was done** (Option A — handler-level fix):

1. **Rescoring gate bug**: `rescoreHeuristicEvaluations()` already existed in the handler
   but was inside `if (heuristic > 0)`, meaning it only ran when NEW sessions were written.
   The 91 existing rubber-stamped evaluations were never rescored. **Fixed**: moved the
   rescore call outside the gate so it runs on every cron tick.

2. **Dedup source mismatch**: `findParentsWithUnevaluatedChildren()` checked
   `.state/evaluations/` directory (doesn't exist) instead of SQLite DB. This caused
   re-evaluation attempts for already-evaluated sessions. **Fixed**: now queries
   `SELECT sessionId FROM evaluations` with directory fallback.

**Expected outcome**: Next evaluate-sessions cron tick (30min interval) will rescore all
91 rubber-stamped evaluations with transcript-based metrics. Sessions that had errors or
huge transcripts will now get quality < 5, triggering coaching via the needs_improvement path.
