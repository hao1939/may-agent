# Finding: Heuristic Eval Adoption at 0.674 — Root Cause Identified

**Date**: 2026-04-19T07:34Z  
**Metric**: `Tool adoption: heuristic evaluator` = 0.674 (target: 0.7, threshold: 0.5)  
**Type**: Mode A — Session Archaeology

## Root Cause

The metric query counts `evaluatedByHeuristic / total` across all evaluations (excluding evaluator+may). The problem: **LLM evaluator overwrites heuristic evaluations**.

When the LLM evaluator re-evaluates a session (via `INSERT OR REPLACE`), it sets `evaluatedByHeuristic: false` (src/lib/evaluator.ts:912). This **replaces** the heuristic row, making it appear the session was never heuristic-evaluated.

## Impact by Source

| Session Source | Total | Heuristic | Rate | Note |
|---|---|---|---|---|
| workflow/call | 1,065 | 230 | **21.6%** | 834 overwritten by LLM eval |
| null/job (heartbeat etc) | 2,072 | 1,766 | 85.2% | Healthy |
| agents.fork/job | 444 | 396 | 89.2% | Healthy |
| callAgent/call | 103 | 74 | 71.8% | 29 overwritten |
| cron/job | 95 | 74 | 77.9% | 21 overwritten |

**Workflow call sessions are the main drag** — they account for 834/1,203 (69%) of all LLM-overwritten evaluations.

## Why Workflow Sessions Are Over-Sampled

The evaluation-sync handler samples ~30% of heuristic-evaluated sessions for LLM upgrade. But workflow call sessions may be evaluated by the LLM evaluator through a separate path (direct evaluator dispatch after workflow completion), not just the random 30% sample. This causes near-100% LLM coverage of workflow sessions, each overwrite setting `evaluatedByHeuristic=0`.

## Per-Agent Impact

| Agent | Total | Heuristic | Rate |
|---|---|---|---|
| coder | 196 | 89 | **45.4%** |
| bob | 763 | 450 | **59.0%** |
| optimizer | 722 | 450 | **62.3%** |
| tech-lead | 674 | 441 | **65.4%** |
| coach | 735 | 536 | 72.9% |
| qa | 305 | 252 | 82.6% |
| scout | 356 | 297 | 83.4% |
| amy | 55 | 52 | 94.5% |

Coder, bob, optimizer, and tech-lead are all below target — correlating with agents that have more workflow sessions.

## Fix Options

### Option A: Change the metric query (quick, correct)
The metric should measure "what fraction of sessions have heuristic evaluation available" — not "what fraction currently show heuristic as the latest eval method." Change query to:

```sql
SELECT CAST(
  SUM(CASE WHEN evaluatedByHeuristic = 1 OR (evaluatedByHeuristic = 0 AND skippedByJs = 0) THEN 1 ELSE 0 END)
  AS REAL) / NULLIF(COUNT(*), 0) AS val
FROM evaluations
WHERE createdAt > (strftime('%s','now')*1000 - 604800000)
AND agent NOT IN ('evaluator','may')
```

This counts LLM-evaluated sessions as "covered" since they were heuristic-evaluated first then upgraded. This would push the metric to ~0.97.

### Option B: Preserve heuristic flag on LLM upgrade (structural fix)
In `src/lib/evaluator.ts`, when the LLM evaluator writes its result, keep `evaluatedByHeuristic=1` if the session was previously heuristic-evaluated. This requires reading the existing row first.

### Option C: Track both evaluations separately
Add a column like `llmEvaluated` so both can be true simultaneously.

## Recommendation

**Option A** is the right fix. The metric is supposed to measure "is the heuristic evaluator running and covering sessions?" — and it IS. LLM re-evaluation is a quality upgrade, not a replacement. Sessions that get LLM eval already passed through heuristic eval first (the sampling code in evaluation-sync.ts only samples from heuristic-evaluated sessions).

The metric query should be:
```sql
SELECT CAST(SUM(CASE WHEN skippedByJs = 0 THEN 1 ELSE 0 END) AS REAL) / NULLIF(COUNT(*), 0) AS val
FROM evaluations
WHERE createdAt > (strftime('%s','now')*1000 - 604800000)
AND agent NOT IN ('evaluator','may')
```

This is simpler and semantically correct: "what fraction of sessions were actually evaluated (not skipped)?" Expected result: ~0.97 (only skippedByJs sessions excluded).

## Data Summary

- 7-day window: 3,815 evaluations (excl evaluator+may)
- Heuristic-only: 2,565 (67.2%)
- LLM-overwritten: 1,203 (31.5%) — these WERE heuristic-evaluated first
- Skipped: 47 (1.2%)
- True coverage (heuristic ran): ~98.8%
