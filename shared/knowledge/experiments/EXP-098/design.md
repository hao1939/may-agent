# EXP-098: Treatment Testing on L3 Cascading-State Scenario

**Date**: 2026-04-09
**Status**: IN-PROGRESS
**Sprint**: 31
**Tags**: cascading-state, externalization, cross-reference, EXP-077, gym-graduation
**Gym budget**: 9 runs (3 arms × 3 runs each)
**Depends on**: EXP-077 (L3 baseline = 0%), EXP-078/079 (treatment scenario variants)

## Problem Statement

EXP-077 established that L3 (cascading state from crashed session) is the hardest non-ceiling gym scenario at **0% baseline pass rate** (0/3). The consistent failure mode: agent fixes `store: mem` → `store: memory` but misses the missing `max_age` field in the truncated auth.yaml.

Separately, interventions like **externalization** (forced analysis phase) and **cross-reference** (grep source code for field inventory) have shown 67-100% improvement on simpler judgment scenarios. 

**Key question for gym graduation**: Do these proven mechanisms transfer to production-complexity scenarios?

## Hypothesis

- **H1**: Externalization (L3-ext) will improve pass rate from 0% to ≥33% by forcing the agent to enumerate expected fields before repairing
- **H2**: Cross-reference (L3-xref) will improve pass rate from 0% to ≥67% because the environment includes `auth-middleware.js` which explicitly references `session.max_age`
- **H3**: Cross-reference will outperform externalization because it provides a concrete discovery mechanism, not just a thinking prompt

## Arms

### Arm A: Baseline (ambiguous-context-drift-L3)
- Same scenario from EXP-077
- Expected: 0% (confirms prior result)
- N=3 runs with coder agent

### Arm B: Externalization (ambiguous-context-drift-L3-ext)
- Same environment, task requires writing ANALYSIS.md first
- Analysis must list: expected state, actual state, discrepancies
- Additional check: `wrote-analysis` (9 checks total vs 8 baseline)
- N=3 runs with coder agent

### Arm C: Cross-Reference (ambiguous-context-drift-L3-xref)
- Same environment + auth-middleware.js that references `config.session.max_age`
- Task instructs agent to grep src/ for config field references before repairing
- N=3 runs with coder agent

## Measurement

| Metric | How Measured |
|--------|-------------|
| Pass rate per arm | Core pass from success_criteria.js (auth-fixed is the key differentiator) |
| auth-fixed rate | Specific check — did agent detect AND fix the missing max_age? |
| Check-level detail | All 8-9 checks per run recorded individually |
| Time/efficiency | Tool call count, session duration |

## Protocol

1. Run 3 baseline (L3) to confirm 0% still holds
2. Run 3 externalization (L3-ext)
3. Run 3 cross-reference (L3-xref)
4. Score all 9 runs with per-check granularity
5. Compare auth-fixed rates across arms

## Exit Criteria

- **SUCCESS**: Either treatment achieves ≥67% pass rate (significant improvement over 0% baseline)
- **PARTIAL**: Treatment improves to 33% (1/3) — promising but not conclusive
- **FAIL**: Both treatments remain at 0% — mechanisms don't transfer to production-complexity scenarios
