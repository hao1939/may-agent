# EXP-555 Phase 2: Final Results (9/9 trials complete)

**Date**: 2026-06-22 (updated this session)
**Status**: COMPLETE — PARTIALLY POSITIVE

## Treatment

Injected `TASK COMPLETENESS RULE` (extract requirements, verify each before finish) via `injected_context.md`.

## Full Results

| Scenario | Trial | Checks Passed | Previously-Failed Check | Result |
|----------|-------|---------------|------------------------|--------|
| hidden-constraints-refactor | 1 | 7/7 | server-updated | ✅ PASSED |
| hidden-constraints-refactor | 2 | 7/7 | server-updated | ✅ PASSED |
| hidden-constraints-refactor | 3 | 6/7 | server-updated | ❌ FAILED |
| output-format-compliance | 1 | 4/5 | test-written | ❌ FAILED |
| output-format-compliance | 2 | 4/5 | test-written | ❌ FAILED |
| output-format-compliance | 3 | 4/5 | test-written | ❌ FAILED |
| convention-verify-multi-edit-gated | 1 | 9/9 | plan-before-acting | ✅ PASSED |
| convention-verify-multi-edit-gated | 2 | 8/9 | plan-before-acting | ❌ FAILED |
| convention-verify-multi-edit-gated | 3 | 8/9 | plan-before-acting | ❌ FAILED |

## Per-Check Treatment Results

| Check | Baseline (0/3 each) | Treatment | Delta |
|-------|---------------------|-----------|-------|
| server-updated | 0/3 (0%) | 2/3 (67%) | **+67pp** ✅ |
| plan-before-acting | 0/3 (0%) | 1/3 (33%) | **+33pp** ✅ |
| test-written | 0/3 (0%) | 0/3 (0%) | **0pp** ❌ |

## Aggregate Non-Primary Pass Rate

- **Baseline**: 82% (Phase 1 measurement)
- **Treatment**: 87% (39/45 non-primary checks passed)
- **Delta**: +5pp — BELOW 30pp target

## Verdict: PARTIALLY POSITIVE — Does Not Meet Success Criteria

The TASK COMPLETENESS RULE improves some deterministic failures but NOT enough to meet the ≥30pp threshold:

### What worked:
- **server-updated** (+67pp): Cross-file registration requirements — the rule reminded the agent to check all files mentioned in the task. But still 1/3 failure shows it's stochastic, not deterministic.
- **plan-before-acting** (+33pp): Structural output requirements (PLAN/GOAL format). However only 1/3 is barely above threshold.

### What didn't work:
- **test-written** (0pp): Generative tasks (write a new test file from scratch) are completely unaffected by the checklist rule. The agent understands the requirement exists but doesn't execute it — this is an **ability/priority** gap, not an **awareness** gap.

## Failure Mode Taxonomy

1. **Awareness gap** (solved by checklist): Agent forgets secondary requirement exists → reminded by extraction step
2. **Priority gap** (NOT solved): Agent knows about requirement but deprioritizes it when primary task is complex
3. **Ability gap** (NOT solved): Agent can't generate the required artifact (e.g., appropriate test content)

The TASK COMPLETENESS RULE only addresses type 1. Types 2-3 need structural enforcement (e.g., auto-checking for test files before allowing finish).

## Decision

**CLOSE as PARTIALLY POSITIVE**. The text-based checklist rule shows directional benefit (+67pp on cross-file checks) but doesn't generalize across all subtask types. 

### Recommendations:
1. **Deploy server-updated type fix structurally**: Add a post-completion check in master-worker.ts that greps for "register" or "update" keywords and verifies all mentioned files were touched
2. **test-written needs structural gate**: Pre-finish check that verifies test files exist when task mentions "write a test"
3. **Do NOT deploy the text rule broadly** — it doesn't meet the 30pp threshold overall

## Connection

- Confirms KE-480: Text rules work for awareness gaps but not ability/priority gaps
- Extends EXP-510: The generic worker completion checklist helps but scenario-specific requirements need scenario-specific enforcement
- Next logical experiment: EXP-560 — Structural test-file-existence gate in master-worker.ts
