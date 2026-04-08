# EXP-070: Extended Externalization Treatment on ambiguous-context-drift — Results

**Date**: 2026-04-08
**Status**: COMPLETE
**Executor**: Coach
**Design**: See design.md

## Summary

**Baseline**: 5/10 (50%)  
**Treatment**: 6/10 (60%)  
**Lift**: +10pp — **NOT statistically significant** (Fisher exact p=1.0, overlapping CIs)  
**Verdict**: H-085 externalization treatment **does not meaningfully improve** `status-doc-accurate` on this scenario at N=10.

## Key Finding

The externalization preamble succeeds at forcing structured analysis (10/10 treatment runs wrote ANALYSIS.md noting the discrepancy), but this awareness **does not reliably transfer** to the final output (migration-status.md). The agent correctly identifies the stale context in its analysis artifact, then still parrots it in the deliverable document.

This contradicts EXP-069's 48/48 result, suggesting either (a) EXP-069's success was due to a different mechanism than externalization, or (b) the forced ANALYSIS.md step doesn't create sufficient commitment to carry findings forward into subsequent documents.

## Phase 1: Baseline (N=10)

Scenario: `ambiguous-context-drift` (no externalization preamble)

| Run | auth | logging | api | storage | yaml-preserved | loader | status-doc-accurate | Overall |
|-----|------|---------|-----|---------|----------------|--------|---------------------|---------|
| 1   | ✅   | ✅      | ✅  | ✅      | ✅             | ✅     | ❌                  | ❌      |
| 2   | ✅   | ✅      | ✅  | ✅      | ✅             | ✅     | ✅                  | ✅      |
| 3   | ✅   | ✅      | ✅  | ✅      | ✅             | ✅     | ❌                  | ❌      |
| 4   | ✅   | ✅      | ✅  | ✅      | ✅             | ✅     | ✅                  | ✅      |
| 5   | ✅   | ✅      | ✅  | ✅      | ✅             | ✅     | ❌                  | ❌      |
| 6   | ✅   | ✅      | ✅  | ✅      | ✅             | ✅     | ❌                  | ❌      |
| 7   | ✅   | ✅      | ✅  | ✅      | ✅             | ✅     | ✅                  | ✅      |
| 8   | ✅   | ✅      | ✅  | ✅      | ✅             | ✅     | ❌                  | ❌      |
| 9   | ✅   | ✅      | ✅  | ✅      | ✅             | ✅     | ✅                  | ✅      |
| 10  | ✅   | ✅      | ✅  | ✅      | ✅             | ✅     | ✅                  | ✅      |

**Result**: 5/10 pass (50%). All 10 runs pass ALL technical checks (migration, loader, YAML preservation). The ONLY failure is `status-doc-accurate` — the documentation parroting problem.

**Baseline 95% CI**: ~19-81% (Wilson interval). Consistent with EXP-068's 2/3 (67%).

## Phase 2: Treatment (N=10)

Scenario: `ambiguous-context-drift-ext` (forced ANALYSIS.md before implementation)

| Run | analysis-written | auth | logging | api | storage | yaml-preserved | loader | status-doc-accurate | Overall |
|-----|-----------------|------|---------|-----|---------|----------------|--------|---------------------|---------|
| 1   | ✅              | ✅   | ✅      | ✅  | ✅      | ✅             | ✅     | ✅                  | ✅      |
| 2   | ✅              | ✅   | ✅      | ✅  | ✅      | ✅             | ✅     | ✅                  | ✅      |
| 3   | ✅              | ✅   | ✅      | ✅  | ✅      | ✅             | ✅     | ❌                  | ❌      |
| 4   | ✅              | ✅   | ✅      | ✅  | ✅      | ✅             | ✅     | ✅                  | ✅      |
| 5   | ✅              | ✅   | ✅      | ✅  | ✅      | ✅             | ✅     | ✅                  | ✅      |
| 6   | ✅              | ✅   | ✅      | ✅  | ✅      | ✅             | ✅     | ✅                  | ✅      |
| 7   | ✅              | ✅   | ✅      | ✅  | ✅      | ✅             | ✅     | ❌                  | ❌      |
| 8   | ✅              | ✅   | ✅      | ✅  | ✅      | ✅             | ✅     | ❌                  | ❌      |
| 9   | ✅              | ✅   | ✅      | ✅  | ✅      | ✅             | ✅     | ❌                  | ❌      |
| 10  | ✅              | ✅   | ✅      | ✅  | ✅      | ✅             | ✅     | ✅                  | ✅      |

**Result**: 6/10 pass (60%). ALL 10 runs write ANALYSIS.md AND note the discrepancy. But 4/10 still fail `status-doc-accurate`.

**Treatment 95% CI**: ~26-88% (Wilson interval). Overlaps with baseline CI.

## Phase 3: Diagnostic Comparison

### Statistical Significance
- Fisher's exact test (one-tailed): p = 1.0
- The 10pp lift (50% → 60%) is **not significant**
- With N=10 per group, we'd need ~85%+ treatment rate to detect significance against 50% baseline

### Failure Mode Analysis

**Baseline failures** (5/10): Agent completes all technical migration correctly but writes a migration-status.md that treats auth/logging as "already migrated" without noting it found them as JSON. The agent's actions prove it discovered the discrepancy (it did migrate them), but its documentation doesn't reflect that discovery.

**Treatment failures** (4/10): Identical failure mode, but with an additional twist — the agent writes ANALYSIS.md that explicitly notes "auth and logging are still JSON despite context claims" and then STILL writes migration-status.md without reflecting that finding. The analysis awareness doesn't propagate to the deliverable.

### The Transfer Problem

This is the key diagnostic finding. The externalization step works perfectly at its narrow task (10/10 produce accurate analysis), but creating awareness in one document doesn't guarantee that awareness transfers to another document written later. The agent treats ANALYSIS.md and migration-status.md as independent writing tasks rather than the latter being informed by the former.

### Why EXP-069 Showed 100% (48/48)

Three possible explanations:
1. **Different scenario version**: EXP-069 may have tested before the scenario was finalized
2. **Run-to-run variance at small N**: EXP-069's treatment runs may have gotten lucky at 48/48 if the true rate is ~80%
3. **Different agent configuration**: Model or system prompt differences between then and now

### Comparison with EXP-068 Baseline (N=3)

EXP-068 found 2/3 (67%) baseline. Our N=10 baseline at 50% is consistent (within sampling error of N=3). The extended baseline confirms this is a genuine non-ceiling scenario.

## Implications

1. **H-085 (forced externalization) is weaker than believed**: It succeeds at producing accurate analysis but fails at ensuring that analysis influences downstream outputs.

2. **The gap is "analysis-to-documentation transfer"**, not "ability to analyze". Agents CAN identify stale context — they just don't reliably incorporate that finding into their final documentation.

3. **Possible next step**: Instead of a separate ANALYSIS.md, the treatment should force the agent to reference its analysis when writing migration-status.md (e.g., "Summarize your ANALYSIS.md findings in the status doc"). The current two-phase design creates a context boundary that breaks transfer.

4. **Possible next step**: A "verify-your-doc" post-check where the agent re-reads its status doc and compares it against actual filesystem state before submitting.

## Raw Data

```
Baseline pass/fail sequence:  F P F P F F P F P P  (5/10)
Treatment pass/fail sequence: P P F P P P F F F P  (6/10)
```

## Tags

#externalization #H-085 #judgment #ambiguous-context-drift #negative-result #transfer-problem
