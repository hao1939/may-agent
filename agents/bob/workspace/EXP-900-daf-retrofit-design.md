# EXP-900: DAF Retrofit — Per-Dimension Threshold Enforcement

**Status**: DESIGNED
**Date**: 2029-09-15
**Hypothesis**: H-096 P-096c — Applying DimensionAwareFilter (per-dimension threshold ≥ 2/5, any below → flag) to existing multi-dimensional evaluation scores will reclassify ≥10% of current "pass" sessions as having critical dimension failures.
**Priority**: P1 (lowest-effort test of the strongest hypothesis)

## Motivation

H-096 has the strongest external validation of any hypothesis (6 papers, CR-336). EXP-143 partially validated checkpoint decomposition (+32.1pp FM-3.3 detection). But Phase 1 — the simplest test — hasn't been run yet.

Current evaluation aggregates dimension scores into a single verdict. A session scoring 5/5 on code quality but 1/5 on test coverage gets an aggregate PASS. This dimensional masking is hypothesized to explain a significant portion of the 14.6% "confident failure" rate (KE-112).

## Design

### Method
1. Query the evaluator DB for all sessions with multi-dimensional scores that received PASS verdicts (last 200+ sessions)
2. Apply DAF: for each session, check if ANY dimension scored < 2/5 (or equivalent threshold on whatever scale is used)
3. Flag sessions where aggregate = PASS but any single dimension is critically low
4. Calculate reclassification rate: flagged / total PASS sessions

### Success Criteria
- **Strong signal**: ≥10% reclassification rate → H-096 Phase 1 validated, proceed to Phase 2
- **Weak signal**: 5-10% → Suggestive but not conclusive, may need threshold tuning
- **Null**: <5% → P-096c falsified, dimensional masking is not a significant issue

### Implementation
```
# Pseudocode for DAF analysis
SELECT session_id, dimensions, aggregate_verdict 
FROM evaluations 
WHERE aggregate_verdict = 'PASS' 
  AND dimensions IS NOT NULL
LIMIT 200;

for each session:
  for each dimension_score in session.dimensions:
    if dimension_score < THRESHOLD:
      flag(session, dimension, score)

reclassification_rate = flagged_count / total_count
```

### Prerequisites
- Access to evaluator DB with multi-dimensional scores
- Understanding of current dimension schema (what dimensions exist, what scale)

### Effort
~1 session to query DB and analyze. No infrastructure changes needed.

## Risks
- Evaluator may not store per-dimension scores (only aggregates) → need to check DB schema first
- Scale may not be 1-5 → threshold needs adjustment
- Low N of multi-dimensional evaluations → insufficient statistical power

## Next Steps
1. Check evaluator DB schema for dimension storage
2. If dimensions exist: run the analysis
3. If not: this experiment becomes "add per-dimension scoring to evaluator" (larger effort)

## Relationship
- Tests: H-096 P-096c
- Depends on: evaluator DB schema
- Blocks: EXP-900 Phase 2 (state-diff pilot)
- Related: KE-112 (Verdicts Lie), KE-113 (Recovery Not Prevention)
