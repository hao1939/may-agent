# Diagnosis: Optimizer FM-3.3 VERIFICATION_FAILURE

## Error Pattern
- **FM Code**: FM-3.3
- **Description**: Optimizer claims files are well-formed without read-back verification, doesn't verify writes succeeded before finishing, and skips required gym tests when blocked.
- **Subtypes**: VERIFICATION_FAILURE (12x), VERIFICATION_GAP (12x), EVIDENCE_GAP (8x), VERIFICATION_WEAKNESS (4x), LIGHT_VERIFICATION_GAP (4x)
- **Total occurrences**: 40 in last 48h
- **Core behavioral gap**: After writing/editing files, optimizer does NOT read them back to confirm correctness. It trusts that write() and edit() succeeded without evidence. When blocked on primary verification (e.g., gym tests fail), it skips verification entirely rather than finding alternative verification paths.

## Target Agent
- **optimizer**

## Selected Method
- **Method #15: Workflow Enforcement** 🏆

## Why This Method

1. **Proven track record**: Method #15 has 41/44 (93%+) success rate across 8 scenarios, 5 agents (amy, may, coder, bob, qa), and 3 models. It is the ONLY method confirmed to reliably change agent behavior.

2. **Text methods are closed**: 0/13 clean text experiments have improved any behavioral pattern. The method catalog conclusively shows that SOUL guards, LESSONS entries, heartbeat steps, knowledge files, negative examples, conditional guards, micro-edits, and subtractive fixes are all INEFFECTIVE. Text at layers 3-4 of the authority hierarchy has 0% measured influence.

3. **Verification is a judgment behavior**: The optimizer *knows* it should verify (it's in its SOUL.md) but doesn't when task momentum carries it forward. This is the exact pattern workflow enforcement solves — mechanically forcing a separate verification session that the agent cannot skip.

4. **Directly analogous to proven scenarios**: 
   - `skip-verification` (100% pass with workflow on amy, baseline 0%)
   - `convention-verify-edit-workflow` (edit→verify split for tech-lead)
   - The two-phase structure (edit→verify) maps perfectly to the optimizer's verification gap

5. **Prior optimizer experiments confirm text fails**: exp-030 through exp-043 tested 6+ text methods on optimizer for FM-3.3 (skip-verification). ALL scored 4/5 identical to baseline. Only task structuring (#14) at 33% and workflow enforcement (#15) at 100% showed any signal.

## Gym Scenarios to Test Against

**Primary targets** (all have verification behavioral checks):
1. **convention-verify-edit** — Edit config.json, must read-back after write. Has C2.3 (verify-after-edit) and C3 (validation-attempt) behavioral checks. Currently `agent_type: coder` but task is agent-agnostic.
2. **convention-verify-multi-edit** — Multi-file config edits, same verification checks. Currently `agent_type: coder`.
3. **verify-before-finish** — Fix bugs, must verify before finish(). Has `runs-verification` behavioral check. Currently `agent_type: coder`.

**Approach**: Create workflow variants of these scenarios for optimizer, splitting into:
- Phase 1: Make the edits/fixes (NO verification step)
- Phase 2: Read back all edited files, verify correctness, fix any issues found

**Regression check scenarios**:
4. **optimize-deploy-config** — Existing optimizer scenario (`agent_type: optimizer`). Verify no regression on product checks.

## What Specifically Will Change

1. **Create workflow scenario**: `convention-verify-edit-workflow` variant targeting optimizer (or adapt existing one to support optimizer). The task will be split:
   - Phase 1 prompt: "Edit config.json to set timeout=5000, retries=3. Fix any formatting issues. Do NOT verify — just edit and stop."
   - Phase 2 prompt: "A previous session edited config.json. Read it back. Verify it's valid JSON, values are correct, other fields preserved. Fix anything wrong."

2. **Create workflow scenario for verify-before-finish**: Split processor fix task into:
   - Phase 1: "Fix the bugs in processor.js."
   - Phase 2: "Verify the fixes by running tests. Report results."

3. **Wire up via `two-phase.ts`** shared workflow — already proven infrastructure.

4. **Run baseline**: optimizer on non-workflow variants (confirm it fails verification checks)
5. **Run patched**: optimizer on workflow variants (expect verification pass)

## Risk Assessment
- **Regression risk**: ZERO — Method #15 has 0 regressions across 44+ runs
- **Infrastructure risk**: LOW — two-phase.ts is battle-tested
- **Scenario fit**: HIGH — convention-verify-edit and verify-before-finish directly test the exact behavioral gap (read-back after write)
