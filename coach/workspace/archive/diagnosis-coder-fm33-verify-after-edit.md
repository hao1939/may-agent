# Diagnosis: coder FM-3.3 VERIFICATION_FAILURE (verify-after-edit)

## Error Pattern
- **FM code**: FM-3.3 VERIFICATION_FAILURE
- **Description**: Coder does not verify files after editing them. On the `read-before-edit` scenario, coder scores 10/11, passing all product checks (3 bugs fixed correctly, 3 files preserved) and all read-before-edit convention checks (C1). The sole failure is **C2.3: verify-after-edit** — the agent never reads back the files after making edits to confirm the changes landed correctly. This is a narrow, single-check behavioral gap.

## Target Agent
- **coder**

## Previous Attempts on This Pattern
1. **exp-185 baseline** (2026-03-25): Confirmed 10/11 score, single C2.3 failure.
2. **Unknown method** (2026-03-25T14:42): Discarded — "no improvement, patched 0/1 same as baseline." Method unknown.
3. **exp-187 auto-evolve** (2026-03-25): SOUL text mutations 0/5 improved failing scenarios (different scenarios but confirms text ceiling).
4. **exp-094 workflow enforcement** (2026-03-26): Method #15 FAILED for materialization patterns (different scenario: materialize-intermediate-findings). But note: the `read-before-edit-workflow` variant already exists and has NOT been tested yet.

## Analysis of Available Methods

The `read-before-edit-workflow` scenario already exists with a well-designed two-phase split:
- **Phase 1**: Make the three edits. Explicitly says "Do NOT verify the edits — just make them and stop."
- **Phase 2**: Read back all three files and confirm fixes are correct.

This is a textbook **Method #15 (Workflow Enforcement)** application — it mechanically forces the agent into a separate verification session. The agent literally cannot skip verification because Phase 2 is a separate session whose sole purpose is reading back files.

Key distinction from the failed exp-094 (materialization): That failed because materialization requires **intra-phase cadence** (writing throughout a session) which workflow splits can't enforce. Verify-after-edit is different — it's a **sequential phase pattern** (edit, then verify), which is exactly what two-phase workflow enforcement excels at. Method #15 has 93%+ success rate (41/44) across 8 scenarios for exactly this type of sequential-phase behavior.

### Why NOT other methods:
- **#1 SOUL Guard**: 0/13 text experiments improved behavior. CLOSED.
- **#6 Skill File**: Task description mentions trying this, but skill files are passive (never read during oneshot tasks per exp-038). Agent already knows HOW to verify — it just doesn't DO it.
- **#14 Task Structuring**: 33% pass rate — inferior to workflow enforcement.
- **Text methods (#2, #3, #9, #10, #12, #13)**: All confirmed SAFE but INEFFECTIVE. Text ceiling established.

## Selected Method
- **Method #15: Workflow Enforcement** 🏆

## Why This Method
1. **Proven track record**: 93%+ (41/44) across 8 scenarios, 5 agents, 3 models.
2. **Exact fit**: Verify-after-edit is a sequential phase pattern (edit → verify). This is precisely the pattern workflow enforcement dominates.
3. **Infrastructure exists**: `read-before-edit-workflow` scenario already has task.md with proper Phase 1/Phase 2 split and the same success_criteria.js. Ready to test.
4. **Contrast with failed materialization attempt**: exp-094 failed because materialization needs intra-phase cadence. Verify-after-edit needs inter-phase sequencing — workflow's sweet spot.
5. **Not yet tested**: Despite the workflow scenario existing, no experiment has run coder against `read-before-edit-workflow` yet.

## Gym Scenarios to Test Against
1. **`read-before-edit-workflow`** — primary target (should improve C2.3 from FAIL to PASS → 11/11)
2. **`read-before-edit`** — baseline control (confirm still 10/11 without workflow)

## What Specifically Will Change
- **Fork coder** to `agents/.lab/coder-verify-after-edit/`
- **No agent file changes needed** — the enforcement is structural (separate sessions via workflow scenario)
- **Test**: Run coder against `read-before-edit-workflow` scenario (workflow=true)
- **Expected outcome**: Phase 2 forces coder into a pure-verification session → C2.3 passes → 11/11
- **Regression check**: Run baseline `read-before-edit` to confirm no degradation
