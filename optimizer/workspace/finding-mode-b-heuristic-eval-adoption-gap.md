# Finding: Heuristic Evaluator Adoption Gap is a Measurement Bug

**Date**: 2026-04-18  
**Mode**: B (Tool Gap Analysis)  
**Metric**: `optimizer.tool-adoption` — 0.672 (target 0.70)

## Summary

The 3% gap is **not a real adoption gap** — it's a metric definition bug. The heuristic evaluator runs on ~99% of sessions. The metric undercounts because LLM evaluations overwrite the `evaluatedByHeuristic` flag.

## Root Cause

The metric query:
```sql
SELECT CAST(SUM(evaluatedByHeuristic) AS REAL) / NULLIF(COUNT(*),0)
FROM evaluations WHERE ...
```

The evaluation pipeline:
1. `evaluation-sync.ts` runs first → writes `evaluatedByHeuristic=1, skippedByJs=0`
2. `evaluator.ts` (LLM evaluator) runs later → `INSERT OR REPLACE` overwrites with `evaluatedByHeuristic=0, skippedByJs=0`

So every LLM-evaluated session **loses** its heuristic flag. The metric measures "fraction that are heuristic-ONLY" not "fraction that were heuristic-evaluated."

## Evidence

| Category | Count | % of Total |
|----------|-------|------------|
| Heuristic-only (`h=1, s=0`) | 2,557 | 66.8% |
| LLM-upgraded (`h=0, s=0`) | 1,231 | 32.2% |
| Skipped by JS (`s=1`) | 40 | 1.0% |
| **Total** | **3,828** | |

**True adoption** (heuristic ran): 99.0% (3,788/3,828)  
**Reported adoption** (heuristic flag survived): 66.8%

Per-agent breakdown (current metric, deflated by LLM upgrades):
| Agent | Heuristic | Total | Rate |
|-------|-----------|-------|------|
| coder | 90 | 204 | 0.441 |
| bob | 447 | 763 | 0.586 |
| optimizer | 449 | 726 | 0.618 |
| tech-lead | 433 | 678 | 0.639 |
| coach | 534 | 735 | 0.727 |
| qa | 251 | 304 | 0.826 |
| scout | 296 | 355 | 0.834 |

Low-rate agents (coder, bob, optimizer, tech-lead) are exactly the ones getting the most LLM evaluations — confirming the overwrite theory.

## Fix

Change the metric query to measure what it intends: "was the heuristic evaluator used?" = "not skipped by JS."

**Current query** (in `refine-metrics-2026-04-18.ts` and `may.db`):
```sql
SELECT CAST(SUM(evaluatedByHeuristic) AS REAL) / NULLIF(COUNT(*),0) AS val
FROM evaluations WHERE createdAt > (strftime('%s','now')*1000 - 604800000)
AND agent NOT IN ('evaluator','may')
```

**Fixed query**:
```sql
SELECT CAST(SUM(CASE WHEN skippedByJs = 0 THEN 1 ELSE 0 END) AS REAL) / NULLIF(COUNT(*),0) AS val
FROM evaluations e JOIN sessions s ON e.sessionId = s.sessionId
WHERE e.createdAt > (strftime('%s','now')*1000 - 604800000)
AND s.agent NOT IN ('evaluator','may')
```

This would report ~0.99 — well above the 0.70 target. Consider either:
1. **Apply fix + lower target** to something meaningful (e.g., 0.95) to catch real regressions
2. **Redefine the metric** to measure something harder, like "fraction of sessions with quality score > 0" (measures evaluation coverage, not just heuristic adoption)

## Dispatch

**P2** — metric fix only, no behavioral change needed. The heuristic evaluator is fully adopted.

Update `source_query` in `may.db` metrics table and in `refine-metrics-2026-04-18.ts`.
