# EXP-360: Workflow-Level Forced Verification Step

## Status: DESIGNED — Ready for implementation

## Problem
EXP-355 stability measurement shows:
- `convention-verify-edit`: Always fails verify checks (3/5, 0 variance) — agent never self-verifies
- `convention-verify-multi-edit-workflow`: High variance (5-8/9, range=3) — sometimes verifies, sometimes doesn't
- `convention-verify-edit-verify-wrap`: Always passes (5/5, 0 variance) — forced separate verify phase works

**Root cause**: Text instructions to "verify after edit" are ignored (KE-338 confirmed). But when verification is a *structurally separate step*, compliance is 100%.

## Hypothesis
If we add a mandatory "verification step" as a workflow phase (not just text instruction), convention-verify-multi-edit-workflow will stabilize at ≥8/9 (vs current median 5/9).

## Treatment Design
Create a new scenario variant: `convention-verify-multi-edit-workflow-gated` that:
1. Uses the same multi-edit task
2. Adds a `## Phase 2: VERIFY` section (same pattern as verify-wrap)
3. Forces agent to read back all edited files and confirm changes

This tests whether the verify-wrap pattern generalizes to multi-edit workflows.

## Control
- `convention-verify-multi-edit-workflow` (existing, median 5/9)

## Treatment
- `convention-verify-multi-edit-workflow-gated` (new, with forced verify phase)

## Protocol
- 3 trials each arm (same as EXP-355)
- Success: Treatment median ≥8/9 AND range ≤1

## Success Criteria
- **Primary**: Treatment median ≥ 8/9 (vs control median 5/9)
- **Secondary**: Treatment variance ≤ 1 (vs control range 3)
- **Decision**: If positive → propose workflow-level verify gates for all edit workflows system-wide

## Impact
If positive, this provides the blueprint for structural verify enforcement:
- Not text coaching (dead per KE-338)
- Not tool-layer enforcement (requires infrastructure changes)
- Workflow-level phase separation (deployable by coach today)

## Relationship to Prior Work
- EXP-280: Text coaching for verify-after-edit → NEGATIVE
- EXP-340: Structural gate in context.md → instruction ignored
- EXP-350: Verbal commitment gate → INCONCLUSIVE (+3pp, noise)
- EXP-355: Stability measurement → verify-wrap WORKS, plain verify FAILS
- **EXP-360 (this)**: Generalize verify-wrap to multi-edit workflows

## Next Steps
1. Copy `convention-verify-multi-edit-workflow` → new scenario with verify phase
2. Run 3 baseline trials (control)
3. Run 3 treatment trials
4. Compare medians and ranges
