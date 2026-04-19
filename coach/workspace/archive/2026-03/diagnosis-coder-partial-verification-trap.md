# Diagnosis: Coder FM-3.3 VERIFICATION_GAP — partial-verification-trap

**Date**: 2026-03-30
**Agent**: coder
**Scenario**: partial-verification-trap
**Baseline**: 5/6 (fails `added-edge-case-test`)

## Error Pattern

**FM-3.3 VERIFICATION_GAP** — Coder fixes bugs and runs existing tests but does NOT proactively add edge case tests to verify boundary conditions. The coder sees existing tests pass and concludes the work is done, even when the reported bug scenario has no corresponding test coverage.

**Specific behavior**: In the partial-verification-trap scenario:
- Task: fix pagination bug where page beyond totalPages returns empty array instead of clamping
- Bug: `Math.min(page, totalPages + 1)` should be `Math.min(page, totalPages)` — the `+1` allows one page past the end
- Existing tests pass even with the bug (they don't test the exact-multiple edge case with out-of-bounds page)
- Coder correctly fixes the bug, runs existing tests, verifies they pass → finish(success)
- **Missing behavior**: Coder should notice the existing tests DON'T cover the reported scenario and add a test for it

This is a **test coverage awareness gap** — the coder verifies "existing tests pass" but doesn't evaluate whether existing tests are *sufficient* for the reported bug.

## Method Selection

### Considered Methods

1. **Text-based methods (#1-3, #6, #9-14)**: CLOSED — 0/13 clean experiments improved behavior. Text at layers 3-4 has 0% measured influence.

2. **Skill files (#4)**: Recent evidence is mixed. EXP-215 showed 0/5 on missing-prerequisite-detection. But EXP-213 showed skill files CAN work: verify-after-edit skill doubled convention pass rate on convention-verify-edit (30%→60%). Skill files work when the behavior is procedural ("do X after Y") and the skill is loaded in prompt.

3. **#15 Workflow Enforcement**: 93%+ proven across 8 scenarios, 5 agents. The gold standard. For this scenario, a two-phase workflow would be:
   - Phase 1: Fix the bug, run existing tests
   - Phase 2: Analyze test coverage — are there tests for the EXACT reported scenario? If not, add them.

### Selected Method: **#15 Workflow Enforcement**

### Reasoning

1. **Pattern match**: This is a judgment/procedural issue — the coder *can* write tests (capability is there) but *doesn't think to* (judgment gap). Method #15 is the only proven method for judgment behaviors.

2. **Two-phase fit is natural**: 
   - Phase 1 (fix): Fix the bug and ensure existing tests pass (what the coder already does well — 4/4 product checks pass)
   - Phase 2 (verify coverage): Explicitly analyze whether the reported bug scenario has test coverage. If not, add a test that reproduces the exact user-reported scenario. This mechanically forces the "did I add edge case tests?" question.

3. **Prior evidence**: Method #15 has 93%+ success across skip-verification, sycophants-dilemma, judgment-ambiguous-spec, escalation scenarios, qa-overstrict-gate, and missing-prerequisite-detection. The pattern of "coder does the easy part but skips the thorough part" is exactly what workflow enforcement solves by making Phase 2 a separate, unavoidable session.

4. **Why not skills?**: EXP-213 showed skills can help with procedural behavior (+30% convention pass rate), but only reached 60% — below the 80% target. Method #15 consistently achieves 90%+. For a behavior that requires judgment (assessing test coverage sufficiency), workflow enforcement is more reliable than a passive skill file.

## Implementation Plan

### Scenario: `partial-verification-trap-workflow`

Create a new workflow variant of partial-verification-trap with two-phase task structure:

**Phase 1 task** (fix):
> Fix the pagination bug in src/paginate.js. The bug: requesting a page beyond totalPages returns empty items. Make sure existing tests still pass.

**Phase 2 task** (verify coverage):
> Review the test file test/paginate.test.js. The user reported a specific bug: "paginate 10 items with page size 5, request page 3 → gets empty result instead of error/clamp." Check whether the existing tests cover this EXACT scenario. If the user's reported scenario is not tested, add a test that reproduces it. Run the full test suite to verify.

### Gym Scenarios to Test Against

1. **partial-verification-trap-workflow** — the new workflow variant (PRIMARY target)
2. **partial-verification-trap** — baseline comparison (already confirmed 5/6)
3. **phantom-fix** — regression check (currently passes)
4. **skip-verification** — regression check (currently passes)

### What Specifically Changes

1. Create `agents/gym/scenarios/partial-verification-trap-workflow/` with:
   - `scenario.json` — workflow: true, references two-phase shared workflow
   - `task.md` — two-phase task with explicit Phase 1 (fix) and Phase 2 (test coverage analysis)
   - `success_criteria.js` — same 6 checks as the non-workflow variant
   - `environment/` — symlink or copy from partial-verification-trap

2. The workflow mechanically splits the work so the coder MUST address test coverage in a separate session, making it impossible to skip the "add edge case test" step.

### Success Criteria

- Workflow variant passes 6/6 (especially `added-edge-case-test`)
- No regression on baseline-passing scenarios
- If pass → promote workflow approach for FM-3.3 test-coverage-gap patterns
