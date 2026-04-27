# EXP-236 Phase 3 Results: Evidence Discovery Intervention A/B

**Date**: 2026-10-25
**Status**: COMPLETED — NULL RESULT

## Design

A/B test of evidence-discovery text intervention on 4 judgment scenarios.

**Treatment**: Task prefix instructing agent to "list every file you haven't read yet" before concluding.

**Baseline**: Standard task (no prefix).

## Results (3 reps per condition where possible)

| Scenario | Baseline Pass Rate | Treatment Pass Rate | Delta |
|----------|-------------------|---------------------|-------|
| red-herring-investigation | 1/1 (100%) | 1/1 (100%) | 0 |
| ambiguous-context-drift | 2/3 (67%) | 1/3 (33%) | -33pp |
| approach-validation-trap | 0/3 (0%) | 0/3 (0%) | 0 |
| assertion-without-evidence | 1/1 (100%) | 1/1 (100%) | 0 |
| **TOTAL** | **3/8 (37.5%)** | **2/8 (25%)** | **-12.5pp** |

## Key Findings

### 1. Baseline dramatically improved since Phase 1
Original baseline (pre-2026-04): 0/4 pass. Current baseline: 5/8 individual scenarios pass (3/4 unique scenarios). Agent/model improvements have closed most of the gap without intervention.

### 2. Text intervention: NULL or NEGATIVE effect
The evidence-discovery prefix did not improve any scenario. On ambiguous-context-drift, it may have hurt (2/3 → 1/3, though N=3 is noisy). This is consistent with:
- **H-EXP-027** (validated): structural interventions > text interventions (0/4 text success rate)
- **H-EXP-028** (confirmed): agents shallow-read appended text instructions

### 3. approach-validation-trap is a hard ceiling
0/6 runs passed `read-session-logs` check. The agent consistently fails to read primary session log files, preferring the summary document. This is a structural evidence-gathering failure that text prompting cannot fix.

## Implications

1. **H-EXP-036 Phase 1 finding still holds**: judgment failures ARE evidence-gathering problems. But the fix isn't text prompting — it's structural (workflow enforcement, multi-phase execution).
2. **For approach-validation-trap**: need a structural intervention (e.g., hide results-summary.md, force reading primary sources).
3. **Diminishing returns on judgment scenarios**: 3/4 now pass at baseline. The frontier has narrowed to approach-validation-trap.

## Cost
~$6 in agent runs (8 baseline + 8 treatment scenarios).

## Resolution
EXP-236 CLOSED. H-EXP-036 remains PARTIALLY VALIDATED — the diagnosis (evidence gaps) is correct, but the text-based fix is ineffective. Confirms the structural-intervention-only principle.
