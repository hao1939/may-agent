# EXP-172: LLM-Generated F1 Analysis (Two-Phase Scout → Coder)

**Date**: 2026-04-16
**Status**: COMPLETE
**Predecessor**: EXP-165 (F1=100%, F2=0%, Full-gate=0%, Baseline=0%)

---

## Research Question

Can LLM-generated analysis (via a dedicated "scout" phase) replicate the effect of expert-written ROOT_CAUSE_ANALYSIS.md?

EXP-165 showed expert F1 content = 100% pass, but self-generated analysis in same task context = 0%. Two hypotheses:

- **H-172a (Quality)**: Self-generated analysis is lower quality than expert analysis. A dedicated scout with analysis-only framing might produce expert-quality analysis → high pass rate.
- **H-172b (Session Contamination)**: Even good analysis doesn't help when generated in the same cognitive context. The full-gate failed because the fixer "already explored" the code and ignores the analysis. A fresh session boundary is needed.

EXP-165's full-gate already HAD a session boundary (workflow=true, 2 phases). But Phase 1's prompt started with "Fix the failing tests..." — the scout was framed as a fixer. EXP-172 tests whether a purely-analytical framing for Phase 1 produces better results.

## Predictions

- If H-172a: Scout produces good analysis → Phase 2 pass rate ≥ 80% (like expert F1)
- If H-172b: Scout produces good analysis but Phase 2 still fails → pass rate ≈ 0%
- If both wrong: Scout produces bad analysis → we learn analysis generation is hard

## Design

### Arms

| Arm | Label | Description | N | Scenario |
|-----|-------|-------------|---|----------|
| A | Scout→Coder | Scout-only Phase 1 writes analysis, fresh Phase 2 fixes using it | 15 | `exp172-scout-coder` |
| B | Expert F1 (reference) | Already run in EXP-165: 15/15 (100%) | 0 | `cascading-fix-trap-v2-f1` |
| C | Full-gate (reference) | Already run in EXP-165: 0/16 (0%) | 0 | `exp165-full-gate` |

Only Arm A needs new trials. B and C are EXP-165 reference data.

### Scenario: exp172-scout-coder

**workflow: true** (2-phase, split on ---)

**Phase 1 (Scout)**: Pure analysis framing. No mention of fixing. Task: "You are a code reviewer. Investigate this failing test suite and produce ROOT_CAUSE_ANALYSIS.md." The scout MUST NOT modify source files.

**Phase 2 (Coder)**: Identical to cascading-fix-trap-v2-f1 task.md — reads ROOT_CAUSE_ANALYSIS.md and fixes.

Key differences from exp165-full-gate:
1. Phase 1 framing is analysis-only (no "Fix the failing tests" preamble)
2. Phase 1 explicitly prohibits source modifications
3. Phase 2 framing matches the proven F1-only template exactly

### Success Criteria

Same as cascading-fix-trap-v2-f1 (inherited from base scenario).

### Analysis Plan

1. **Primary**: Compare exp172-scout-coder overall pass rate vs expert F1 (100%) and full-gate (0%)
2. **Secondary**: Grade the quality of scout-generated ROOT_CAUSE_ANALYSIS.md — does it identify pipeline ordering as root cause?
3. **Tertiary**: Per-check analysis, especially pipeline-order-fixed rate

### Cost

15 trials × 2 phases × ~$0.07 = ~$2.10

---

## Key Insight Being Tested

EXP-165's full-gate Phase 1 said "Fix the failing tests" then "write analysis first." This creates a *fixer mindset* — the agent explores with intent to fix, finds workarounds, then writes a post-hoc analysis rationalizing them. A *reviewer mindset* (no fixing allowed) might produce genuinely better analysis.
