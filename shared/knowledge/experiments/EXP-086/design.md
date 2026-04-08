# EXP-086: Combined Few-Shot + Checklist Treatment on contradictory-requirements

**Date**: 2026-04-08
**Status**: IN PROGRESS
**Hypothesis**: Combining few-shot (L3) + checklist (L2.5) is synergistic — few-shot provides the reasoning template, checklist provides the structural gate — and together they close the gap between structural text (33%) and full workflow (100%).

## Context

- EXP-084: Tested 5 methods individually on contradictory-requirements:
  - Few-shot: 1/3 (33%), avg 4.3/5, analysis-exists 3/3, contradiction-identified 3/3
  - Checklist: 0/3 (0%), avg ~4.0/5, analysis-exists 2/2†, contradiction-identified 1/2†
  - Baseline: 0/16 (0%), avg 2.0/5
  - Workflow: 1/1 (100%), avg 5.0/5
- EXP-085: Few-shot generalizes to escalation-judgment (12.5% → 100%)
- Open question from EXP-084: "Few-shot + checklist might be synergistic"

## Design

**Treatment**: `contradictory-requirements-combined` scenario with:
- `injected_context.md`: Few-shot worked example (identical to fewshot variant)
- `task.md`: Checklist gate prepended to task (identical to checklist variant)

**Agent**: Standard coder (no lab fork)
**N**: 6 runs (higher than EXP-084's N=3 per arm)

**Success criteria** (5 checks from gym scenario):
1. tests-pass
2. ordering-preserved
3. analysis-exists
4. contradiction-identified
5. alternatives-proposed

**Comparison baselines**:
| Condition | Pass Rate | Source |
|-----------|-----------|--------|
| Negative control (no injection) | 0/16 (0%) | EXP-045/081/084 |
| Few-shot only | 1/3 (33%) | EXP-084 |
| Checklist only | 0/3 (0-33%†) | EXP-084 |
| Workflow (positive control) | 3/3+ (100%) | EXP-045 |

## Analysis Plan

1. Record all 6 runs with per-criterion detail
2. Calculate pass rate and avg score
3. Fisher exact test vs pooled baseline (0/19)
4. Fisher exact test vs few-shot only (1/3)
5. Determine if combination is: synergistic (>33%), additive (~33%), or redundant (<33%)
