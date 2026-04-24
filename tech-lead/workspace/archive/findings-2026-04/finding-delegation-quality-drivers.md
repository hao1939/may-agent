# Finding: Delegation Quality Drivers (0.80 vs 0.85 target)

**Date:** 2026-04-18  
**Lens:** A (System Architecture)  
**Metric:** `tech-lead.delegation-quality` = 0.80, target 0.85

## How the Metric is Computed

Source query from `metrics` table (`id: tech-lead.delegation-quality`, `source: auto`):
```sql
SELECT ROUND(AVG(e.quality), 2) FROM evaluations e 
JOIN sessions s ON e.sessionId = s.sessionId 
WHERE s.agent='coder' AND s.startedAt > (strftime('%s','now')*1000 - 604800000) 
AND e.quality IS NOT NULL AND e.skippedByJs = 0
```
It averages `evaluations.quality` for all coder sessions in the last 7 days. The `metrics.source_query` field stores this (`metrics` table, row `id='tech-lead.delegation-quality'`).

## Root Cause: Heuristic vs LLM Eval Scoring Gap

The single biggest driver is the **massive gap between heuristic and LLM evaluations**:

| Evaluator | Avg Quality | Count | Share |
|-----------|-------------|-------|-------|
| Heuristic (`evaluatedByHeuristic=1`) | **0.997** | 84 | 44% |
| LLM (`evaluatedByHeuristic=0`) | **0.647** | 105 | 56% |
| **Blended** | **0.80** | 189 | 100% |

The heuristic evaluator (`evaluations.evaluatedByHeuristic` column) almost always gives ~1.0 quality. LLM evals average 0.647. The metric blends both, landing at 0.80.

**If only LLM evals counted, the metric would be 0.647** — far worse than it appears.  
**If only heuristic evals counted, it would be 0.997** — near perfect.

## Contributing Patterns in Low Scores

Among 65 sessions scoring < 0.80 (all from LLM evals):

1. **Few-shot reference tasks** — 42 sessions with "Reference: How a similar task was handled" prefix, avg 0.778. These are gym scenarios with injected examples. Per KE-133, few-shot examples harm discovery tasks.

2. **Retry/fix-required sessions** — 13 sessions with "Fix Required (attempt 2/2)", scoring 0.10–0.35. These are workflow retry loops where coder failed verification twice. By definition low quality.

3. **Persistent task late iterations** — 9 sessions scoring poorly on later iterations of multi-step tasks. Context bloat and unclear remaining scope likely contribute.

## Severity

**Medium.** The metric is not red but is structurally misleading — heuristic evals inflate it. The "real" delegation quality (LLM-assessed) is 0.647, well below the 0.85 target.

## Recommended Actions (do NOT implement now)

1. **Split the metric** into heuristic-only and LLM-only variants, or weight them differently. The blended average obscures signal.
2. **Investigate heuristic scoring** — 0.997 average suggests the heuristic is too generous. It may need recalibration to align with LLM standards.
3. **Reduce few-shot injection** in gym scenarios — KE-133 already documented this as harmful (-67pp). 42/189 sessions (22%) carry this pattern.
