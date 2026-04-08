# EXP-092: Forced Citation vs Post-Check for Analysis-to-Documentation Transfer — Results

**Date**: 2026-04-08
**Status**: COMPLETE
**Executor**: Coach
**Design**: See design.md

## Summary

| Condition | status-doc-accurate | Overall Scenario Pass | N |
|-----------|--------------------|-----------------------|---|
| Control 0 (no ext, EXP-070) | 5/10 (50%) | 5/10 (50%) | 10 |
| Control 1 (ext, EXP-070) | 6/10 (60%) | 6/10 (60%) | 10 |
| **Arm A — Forced Citation** | **10/10 (100%)** | **0/10 (0%)** | 10 |
| **Arm B — Post-Check** | **3/8 (37.5%)** | **1/8 (12.5%)** | 8 |

**Verdict**: Arm A fully closes the documentation transfer gap (100% status-doc-accurate, p=0.043 vs baseline) but **catastrophically breaks the actual migration** (0/10 pass migration checks). Arm B fails on both dimensions — worse than baseline on documentation AND migration. Neither treatment improves overall task completion.

**Key finding**: The forced citation instruction created a **documentation-over-implementation tradeoff** — the agent became so focused on citing its analysis in the status doc that it neglected to actually perform the migration. This is a novel failure mode: **instruction-induced task narrowing**.

## Phase 1: Arm A — Forced Citation (N=10)

Scenario: `ambiguous-context-drift-ext-v2` (citation requirement added to Phase 2)

| Run | analysis | auth | logging | api | storage | yaml-ok | loader | status-doc | Overall | Duration |
|-----|----------|------|---------|-----|---------|---------|--------|------------|---------|----------|
| 1   | ✅       | ❌   | ❌      | ❌  | ❌      | ✅      | ❌     | ✅         | ❌      | 269s |
| 2   | ✅       | ❌   | ❌      | ❌  | ❌      | ✅      | ❌     | ✅         | ❌      | 253s |
| 3   | ✅       | ❌   | ❌      | ❌  | ❌      | ✅      | ❌     | ✅         | ❌      | 244s |
| 4   | ✅       | ❌   | ❌      | ❌  | ❌      | ✅      | ❌     | ✅         | ❌      | 265s |
| 5   | ✅       | ❌   | ❌      | ❌  | ❌      | ✅      | ❌     | ✅         | ❌      | 320s |
| 6   | ✅       | ❌   | ❌      | ❌  | ❌      | ✅      | ❌     | ✅         | ❌      | 222s |
| 7   | ✅       | ❌   | ❌      | ❌  | ❌      | ✅      | ❌     | ✅         | ❌      | 184s |
| 8   | ✅       | ❌   | ❌      | ❌  | ❌      | ✅      | ❌     | ✅         | ❌      | 259s |
| 9   | ✅       | ❌   | ❌      | ❌  | ❌      | ✅      | ❌     | ✅         | ❌      | 247s |
| 10  | ✅       | ❌   | ❌      | ❌  | ❌      | ✅      | ❌     | ✅         | ❌      | 250s |

### Per-Check Pass Rates

| Check | Pass Rate | vs EXP-070 Treatment |
|-------|-----------|---------------------|
| analysis-written | 10/10 (100%) | 10/10 (100%) — same |
| auth-migrated | 0/10 (0%) | 10/10 (100%) — **collapsed** |
| logging-migrated | 0/10 (0%) | 10/10 (100%) — **collapsed** |
| api-migrated | 0/10 (0%) | 10/10 (100%) — **collapsed** |
| storage-migrated | 0/10 (0%) | 10/10 (100%) — **collapsed** |
| existing-yaml-preserved | 10/10 (100%) | 10/10 (100%) — same |
| loader-updated | 0/10 (0%) | 10/10 (100%) — **collapsed** |
| **status-doc-accurate** | **10/10 (100%)** | **6/10 (60%)** — **+40pp** |

**Duration**: mean 251.3s, median 251.5s (vs EXP-070 treatment ~similar range)
**Agent status**: 10/10 completed (no errors/timeouts)

### Arm A Failure Mode: Documentation-Over-Implementation

The pattern is strikingly consistent across all 10 runs:
1. Agent writes ANALYSIS.md correctly (identifies auth/logging are still JSON) ✅
2. Agent **skips the actual migration** — no files converted, no loader updated ❌
3. Agent writes migration-status.md that **accurately** describes the situation ✅
4. Agent completes cleanly without error

The citation instruction ("cite your ANALYSIS.md findings in migration-status.md") appears to have redirected the agent's attention from implementation to documentation. In EXP-070, the agent migrated all files (10/10) but wrote inaccurate docs (4/10 fail). In Arm A, the agent writes accurate docs (10/10) but doesn't migrate any files (0/10). The instruction fixed the targeted behavior but broke something that previously worked perfectly.

This is a **zero-sum tradeoff between documentation accuracy and implementation completeness**. The citation requirement consumed the agent's task-completion budget, leaving no capacity for the actual migration work.

## Phase 2: Arm B — Post-Check Verification (N=8)

Scenario: `ambiguous-context-drift-ext-v3` (Phase 3 verification step added)

| Run | analysis | auth | logging | api | storage | yaml-ok | loader | status-doc | Overall | Duration | Status |
|-----|----------|------|---------|-----|---------|---------|--------|------------|---------|----------|--------|
| 1   | ✅       | ❌   | ❌      | ❌  | ❌      | ✅      | ❌     | ✅         | ❌      | 318s | completed |
| 2   | ✅       | ❌   | ❌      | ❌  | ❌      | ✅      | ❌     | ❌         | ❌      | 334s | completed |
| 3   | ✅       | ❌   | ❌      | ❌  | ❌      | ✅      | ❌     | ✅         | ❌      | 254s | completed |
| 4   | ✅       | ❌   | ❌      | ❌  | ❌      | ✅      | ❌     | ❌ (not created) | ❌ | 274s | completed |
| 5   | ✅       | ✅   | ✅      | ✅  | ✅      | ✅      | ✅     | ❌ (not created) | ❌ | 268s | error |
| 6   | ✅       | ✅   | ✅      | ✅  | ✅      | ✅      | ✅     | ✅         | ✅      | 349s | completed |
| 7   | ❌ (not created) | ❌ | ❌ | ❌  | ❌      | ✅      | ❌     | ❌ (not created) | ❌ | 180s | error |
| 8   | ❌ (not created) | ❌ | ❌ | ❌  | ❌      | ✅      | ✅     | ❌ (not created) | ❌ | 291s | error |

### Per-Check Pass Rates

| Check | Pass Rate | vs EXP-070 Treatment |
|-------|-----------|---------------------|
| analysis-written | 6/8 (75%) | 10/10 (100%) — **degraded** |
| auth-migrated | 2/8 (25%) | 10/10 (100%) — **collapsed** |
| logging-migrated | 2/8 (25%) | 10/10 (100%) — **collapsed** |
| api-migrated | 2/8 (25%) | 10/10 (100%) — **collapsed** |
| storage-migrated | 2/8 (25%) | 10/10 (100%) — **collapsed** |
| existing-yaml-preserved | 8/8 (100%) | 10/10 (100%) — same |
| loader-updated | 3/8 (37.5%) | 10/10 (100%) — **degraded** |
| **status-doc-accurate** | **3/8 (37.5%)** | **6/10 (60%)** — **-22.5pp (worse)** |

**Duration**: mean 283.5s, median 282.5s (32s longer than Arm A)
**Agent status**: 5/8 completed, 3/8 error (37.5% error rate)

### Arm B Failure Mode: Instruction Overload

The post-check verification instruction (Phase 3) appears to have introduced enough complexity to **degrade all aspects of performance**:

1. **Analysis compliance dropped**: 2/8 runs didn't even create ANALYSIS.md (runs 7, 8) — the additional phase may have confused task ordering
2. **Migration collapsed**: Only 2/8 runs completed migration (runs 5, 6) — same pair that actually did the implementation work
3. **Status doc failures**: 4/5 failures were "docs/migration-status.md not created" — the document simply wasn't written at all, not written incorrectly
4. **Error rate**: 3/8 runs ended in error status (runs 5, 7, 8) — the added complexity may have caused agent crashes or timeouts

The single success (run 6) achieved everything: analysis, full migration, accurate status doc. But this was the exception, not the rule.

### Arm B status-doc-accurate Failure Breakdown

| Failure Type | Count | Runs |
|-------------|-------|------|
| Doc not created | 4 | 4, 5, 7, 8 |
| Doc created but inaccurate | 1 | 2 |
| Doc accurate | 3 | 1, 3, 6 |

The dominant failure is not inaccuracy but **non-creation** — the agent never got to writing the status doc at all.

## Phase 3: Statistical Analysis

### Primary Comparison: status-doc-accurate

| Comparison | Rates | Fisher exact (one-tailed) | Interpretation |
|-----------|-------|--------------------------|---------------|
| Arm A vs Baseline (ext) | 100% vs 60% | **p = 0.043** | Significant at α=0.05 |
| Arm A vs Control (no ext) | 100% vs 50% | **p = 0.016** | Significant |
| Arm A vs Arm B | 100% vs 37.5% | **p = 0.007** | Highly significant |
| Arm B vs Baseline (ext) | 37.5% vs 60% | p = 0.319 (B worse) | Not significant |

### Confidence Intervals (95% Wilson)

| Condition | Rate | 95% CI |
|-----------|------|--------|
| Arm A status-doc-accurate | 100% (10/10) | [72.2%, 100%] |
| Arm B status-doc-accurate | 37.5% (3/8) | [13.7%, 69.4%] |
| Baseline (ext) status-doc-accurate | 60% (6/10) | [31.3%, 83.2%] |
| Control (no ext) status-doc-accurate | 50% (5/10) | [23.7%, 76.3%] |

### Ordering (status-doc-accurate only)

Arm A (100%) >> Baseline ext (60%) ≈ Control (50%) ≥ Arm B (37.5%)

The forced citation instruction **definitively solves** the status-doc-accurate problem. The post-check instruction **may worsen** it (though not significantly).

### The Tradeoff Problem

The status-doc-accurate improvement in Arm A comes at a devastating cost:

| Condition | status-doc-accurate | Migration (all 5 checks) | Overall Pass |
|-----------|--------------------|-----------------------------|-------------|
| Control (no ext) | 50% | **100%** | 50% |
| Baseline (ext) | 60% | **100%** | 60% |
| **Arm A (citation)** | **100%** | **0%** | **0%** |
| **Arm B (post-check)** | **37.5%** | **25%** | **12.5%** |

In EXP-070, migration was never the problem — all 20 runs (baseline + treatment) passed all migration checks. Both EXP-092 treatments **broke the migration** that previously worked perfectly.

## Key Insights

### 1. Instruction-Induced Task Narrowing (Arm A)

The forced citation instruction didn't just fix the documentation gap — it **reoriented the agent's entire task understanding** toward documentation. The agent appears to have interpreted the emphasis on "cite your ANALYSIS.md", "consult ANALYSIS.md while writing", and the ⚠️ warning as indicating that accurate documentation was the PRIMARY task objective, at the expense of actual implementation.

This is a novel failure mode with important implications:
- **Instructions have opportunity costs**: Emphasizing one sub-task can de-emphasize others
- **Agent attention is zero-sum**: Within a fixed context window/session, detailed instructions for one phase consume capacity for another
- **The fix was worse than the disease**: 60% overall (with correct migration) → 0% overall (with correct documentation but no migration)

### 2. Phase Complexity Causes Degradation (Arm B)

Adding Phase 3 (verification) didn't help — it hurt. The 3-phase structure (analyze → implement → verify) proved too complex:
- 2/8 runs skipped the analysis phase entirely
- 3/8 runs ended in error
- Only 1/8 achieved full success

The verification phase appears to have overwhelmed the agent's task management capacity. Rather than catching errors in existing work, it prevented the agent from completing the earlier phases.

### 3. The Transfer Gap Is Real but Not Fixable by Prompting

Both Arm A and Arm B fail to achieve what the design sought: closing the transfer gap while maintaining migration quality. This suggests:
- The analysis-to-documentation transfer gap (EXP-070's finding) is **resistant to L1/L2 instruction-level interventions**
- Adding instructions to fix one problem creates new problems elsewhere
- The gap may require **L4+ structural enforcement** (e.g., a scorer/gate that rejects status docs inconsistent with ANALYSIS.md) rather than task.md modifications

### 4. KE-056 Validated Again

KE-056 predicts L2 instructional binding has ~0% net behavioral effect. Both arms are L2 interventions (task.md modifications). While Arm A achieved its narrow target (status-doc-accurate), the overall effect was negative. This confirms that instruction-level interventions in multi-objective tasks create zero-sum tradeoffs rather than genuine improvement.

### 5. Design Question (Open): Is citation L1 or L3?

The design asked whether the citation instruction acts as L1 (content suggestion, low compliance) or L3 (format/template requirement, high compliance). The answer: **compliance was 100%** — the agent reliably cited its analysis. But this is not because citation is L3; it's because the citation instruction was SO compelling that it displaced the implementation task. High compliance on one instruction caused zero compliance on another.

## Implications for H-085

### Transfer Gap Remains Open

EXP-092 attempted two interventions to close the multi-document transfer gap identified in EXP-070:
1. Forced citation (Arm A): Closed the gap on documentation but destroyed implementation
2. Post-check verification (Arm B): Failed on both dimensions

**The transfer gap persists as a confirmed boundary of forced externalization.** L1/L2 interventions cannot close it without side effects.

### Recommended H-085 Update

Add to H-085's boundary conditions:
> **EXP-092 confirms transfer gap is instruction-resistant**: Forced citation achieves 100% status-doc-accurate (p=0.043 vs 60% baseline) but collapses migration from 100% to 0%. Post-check verification (Arm B) degrades all metrics. The multi-document transfer gap (boundary #3) cannot be closed by task.md-level interventions without introducing instruction-induced task narrowing. L4+ structural enforcement required.

### P(H) Impact

EXP-092 does not change P(H) for the core externalization mechanism (analysis activation still works — 10/10 ANALYSIS.md in Arm A). But it strengthens the evidence for boundary #3 (transfer gap) being resistant to prompting-level fixes. This aligns with the existing assessment at P(H) = 0.85.

## Proposed Next Steps

1. **L4 structural gate for documentation accuracy**: Instead of instructing the agent to cite, build a scorer/gate that reads both ANALYSIS.md and migration-status.md and rejects the submission if they're inconsistent. This removes the instruction from the task.md (avoiding narrowing) and enforces consistency structurally.

2. **Single-document externalization variant**: Instead of two separate documents (ANALYSIS.md + migration-status.md), have the analysis BE the status doc. If there's only one document, there's no transfer gap. Test: modify task to require a single "analysis-and-status.md" that combines both functions.

3. **Investigate the migration collapse**: Why did Arm A consistently fail all migration checks? The agent completed with no errors and produced ANALYSIS.md + migration-status.md — was the time budget consumed by documentation work? Or did the citation instruction literally override the "implement migration" instruction? Understanding this would clarify the task-narrowing mechanism.

## Appendix: Duration Statistics

| Condition | Mean Duration | Median Duration | Min | Max |
|-----------|--------------|-----------------|-----|-----|
| Arm A | 251.3s | 251.5s | 183.5s | 319.8s |
| Arm B | 283.5s | 282.5s | 180.2s | 348.6s |

Arm B runs ~32s longer on average, consistent with the added Phase 3 complexity (though many Arm B runs didn't reach Phase 3 before failing).

---
*EXP-092: Forced Citation vs Post-Check for Analysis-to-Documentation Transfer | Coach | 2026-04-08*
