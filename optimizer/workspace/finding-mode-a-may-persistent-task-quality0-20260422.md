# Finding: May Persistent-Task Sessions quality=0 — Evaluator False Positive

**Date**: 2026-04-22  
**Sessions**: s_1776672620921_854 (29 ops), s_1776672921499_877 (20 ops)  
**Verdict**: **Evaluator false positive** — not genuine quality failures

## Summary

Both sessions received `quality=0` because the JS heuristic evaluator **skipped** them (`skippedByJs=1, verdict="skipped", evaluatedByHeuristic=0`). Skipped sessions default to zero scores. These are measurement failures, not quality failures.

## Evidence

| Field | s_...854 | s_...877 |
|-------|----------|----------|
| agent | may | may |
| status | done | done |
| opCount | 29 | 20 |
| quality | 0 | 0 |
| verdict | skipped | skipped |
| evaluatedByHeuristic | 0 | 0 |
| skippedByJs | 1 | 1 |
| issues | [] | [] |
| failureChains | [] | [] |

Both sessions completed successfully (status=done) with reasonable op counts. The `outcome` fields show partial progress text ("Update milestones:", "Now let me update the journal with this progress:"), suggesting productive work.

## Root Cause

These are part of a **systematic evaluator bug affecting all `may` agent sessions**:

- **147 `may` sessions** have `evaluatedByHeuristic=0, skippedByJs=1, quality=0`
- **140 of 147** were written in a single bulk evaluation burst at `2026-04-20T08:22:45Z`
- The remaining 7 were evaluated individually between April 15-19

The evaluation records have the exact same shape as evaluator-agent skip rows (`quality=0, efficiency=0, verdict="skipped", result_delivered=false`), but these are `may` agent sessions, not `evaluator` sessions.

**The bug**: The evaluation-sync handler (or a previous version of it) incorrectly classified `may` agent sessions as skip-worthy. The current code at `agents/may/handlers/evaluation-sync.ts:145-155` only skips `agent === "evaluator"`, and running `computeEvaluation()` against these sessions today produces `quality=1.0`. This suggests either:

1. A previous code version had `may` in the evaluator skip list (note: `may` IS already in `SKIP_LLM_EVAL_AGENTS` at line 44), or
2. A race condition where session directories were archived to `history/` before evaluation-sync could find `meta.json`, causing the no-meta fallback path — but the no-meta path for non-evaluator done sessions gives `quality=1.0`, not `quality=0`

The most likely explanation is **(1)**: a previous code version skipped `may` sessions in the heuristic evaluator, and this was later fixed. The 147 stale false-zero records remain in the DB.

## Impact

- **147 `may` sessions** with incorrect quality=0 scores
- These drag down `may` agent quality averages (147 zeros in 4,676 total evaluations = ~3% of may evals)
- Metric dashboards showing may quality are slightly deflated
- No impact on other agents

## Recommended Fix

**Immediate**: Run a SQL correction to re-evaluate these 147 sessions:

```sql
-- Option A: Delete the false-zero rows so evaluation-sync re-evaluates them
DELETE FROM evaluations 
WHERE agent = 'may' AND evaluatedByHeuristic = 0 AND skippedByJs = 1;

-- Option B: Mark them as quality=1.0 (matching what heuristic would give today)
UPDATE evaluations 
SET quality = 1.0, efficiency = 0.8, verdict = 'good', 
    evaluatedByHeuristic = 1, skippedByJs = 0,
    overall = json_set(json_set(json_set(overall, '$.quality', 1.0), '$.efficiency', 0.8), '$.verdict', 'good')
WHERE agent = 'may' AND evaluatedByHeuristic = 0 AND skippedByJs = 1;
```

**Preventive**: Add a guard in evaluation-sync's false-zero fixer (line ~438) to also catch `may` sessions that were incorrectly skipped:

```typescript
// Also fix may sessions that were incorrectly skipped (historical bug)
const mayFalseSkips = db.prepare(
  `SELECT COUNT(*) as cnt FROM evaluations 
   WHERE agent = 'may' AND skippedByJs = 1 AND evaluatedByHeuristic = 0`
).get();
if (mayFalseSkips.cnt > 0) {
  db.prepare(
    `DELETE FROM evaluations 
     WHERE agent = 'may' AND skippedByJs = 1 AND evaluatedByHeuristic = 0`
  ).run();
  // These will be re-evaluated in the next sync cycle
}
```

## Classification

- **Type**: Evaluator false positive (measurement error)
- **Severity**: Low — scores are wrong but `verdict="skipped"` means most consumers already exclude these
- **Pattern**: Known class — similar to the "evaluator-skip false zeros" fixed at line 438-451 of evaluation-sync.ts
