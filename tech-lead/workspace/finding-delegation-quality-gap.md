# Finding: Delegation Quality Gap (0.80 vs 0.85 target)

**Lens**: B (Flow Complexity) | **Date**: 2026-04-18 | **Severity**: Medium

## Summary

The `tech-lead.delegation-quality` metric is stuck at **0.80** vs a **0.85** target. Two clear drag factors account for the gap: (1) retry sessions from the verified-coder workflow score significantly lower, and (2) the metric query includes all coder sessions system-wide, not just tech-lead-delegated ones.

## Evidence

### 1. Metric Definition Mismatch

The metric's `source_query` (`metrics` table, `id='tech-lead.delegation-quality'`) is:
```sql
SELECT ROUND(AVG(e.quality), 2) FROM evaluations e JOIN sessions s 
  ON e.sessionId = s.sessionId 
  WHERE s.agent='coder' AND s.startedAt > (strftime('%s','now')*1000 - 604800000) 
  AND e.quality IS NOT NULL AND e.skippedByJs = 0
```
This averages **all** coder sessions regardless of parent, but the description says "coder sessions I delegated." Tech-lead-only coder sessions actually score **0.74**, worse than the 0.80 the metric reports.

**Citation**: `.state/may.db`, `metrics` table row `id='tech-lead.delegation-quality'` — `source_query` column.

### 2. Retry Sessions Are a Major Drag

Across 48h of data (133 delegated sessions):
- **Overall avg quality**: 0.74 (tech-lead delegated)
- **Retry sessions** (`task LIKE '%Fix Required%attempt 2%'`): avg quality **0.61** (n=14)
- **Excluding retries** (all coder sessions): avg quality **0.82**
- Retry sessions pull the average down by ~0.06-0.08 points

### 3. Agent Breakdown (48h, tech-lead as parent)

| Agent | Avg Quality | Avg Efficiency | Count |
|-------|------------|----------------|-------|
| coder | 0.71 | 0.63 | 41 |
| tech-lead (self) | 0.77 | 0.73 | 80 |
| may | 0.64 | 0.64 | 11 |

### 4. Low-Scoring Patterns

Sessions scoring below 0.60 quality (non-retry) share these patterns:
- **REVIEW ONLY sessions with 0 opCount**: e.g. `s_1776363214656_397` (may, quality=0), `s_1776343492432_157` (may, quality=0.35). Zero-op sessions get heuristic quality scores near 0.
- **High-iteration persistent tasks**: e.g. `s_1776346275613_210` (coder iteration 8, quality=0.28) — late iterations on diminishing-returns tasks.
- **Lens explorations**: Some lens sessions score 0.0-0.35 quality, dragging the self-delegated average.

## Root Causes

1. **Metric query doesn't filter by parentAgent** — it includes coder sessions spawned by may, coach, or other agents. The metric value (0.80) doesn't reflect tech-lead's actual delegation quality (0.74).

2. **Retry sessions (attempt 2+) are inherently low-quality** — they're fix-up sessions after failures. avg quality 0.61 vs 0.76 for first attempts. This is structural, not addressable by better prompts.

3. **Zero-op review sessions get near-zero scores** — when a review session completes with 0 ops (e.g. auto-approved), the evaluator gives it a low quality score, which drags the average.

## Recommended Actions

1. **Fix the metric query** to filter `s.parentSessionId IN (SELECT sessionId FROM sessions WHERE agent='tech-lead')`. This will show the true score (~0.74) and make improvements visible. `.state/may.db`, `metrics` table.

2. **Exclude retry sessions from the metric** or track them separately — they're a consequence of first-attempt failures and inflate the denominator with inherently low-quality sessions.

3. **Investigate zero-op review session scoring** — sessions with 0 ops shouldn't score 0.0 quality; they may need a scoring exemption or floor.

4. **To actually lift quality**: Focus on coder first-pass success rate. The verified-coder workflow catches failures but the retry sessions still drag the average. Better task scoping (per KE-013, KE-003) is the lever.

## Follow-ups (separate sessions)

- [ ] Fix metric source_query to filter by tech-lead parentAgent
- [ ] Investigate zero-op session scoring in evaluation pipeline
