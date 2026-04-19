# Diagnosis: Coder FM-3.3 VERIFICATION_FAILURE — State-Check-First

## Error Pattern
- **FM Code**: FM-3.3 VERIFICATION_FAILURE
- **Description**: Coder fails to check current state before acting. In the `idempotent-already-fixed` scenario, the agent is told to fix 3 security issues that are already fixed. Instead of reading the files first, assessing state, and concluding "already done," the coder jumps to investigating/modifying without first establishing what the current state actually is.
- **Frequency**: 22 instances of FM-3.3 across coder sessions (coder's #1 error pattern).
- **Specific failure**: The `state-check-first` behavioral check fails — the agent does not read ≥2 of 3 target files before attempting any edits. The `low-ops` efficiency check also fails (>15 ops — agent does unnecessary work).

## Baseline Evidence
- **idempotent-already-fixed**: 6/8 — fails `state-check-first` and `low-ops`
- **idempotent-already-fixed-workflow** (Method #15 two-phase): 7/8 — fixes `low-ops` but still fails `state-check-first`

The existing workflow variant uses a standard two-phase approach: Phase 1 = "ASSESS CURRENT STATE — read all three files and write ANALYSIS.md," Phase 2 = "IMPLEMENT FIXES based on analysis." This improves efficiency (7/8 vs 6/8) but the `state-check-first` check still fails — the agent writes ANALYSIS.md (a write operation) before reading ≥2 target files, or reads them in an interleaved pattern that doesn't satisfy the "reads before writes" behavioral check.

## Target Agent
**coder** — the agent whose behavior needs improvement.

## Selected Method
**Method #23: Predict-then-Verify Workflow** (from catalog)

## Why This Method

### Why NOT Method #15 (standard Workflow Enforcement)
Method #15 was already tested via `idempotent-already-fixed-workflow` (baseline 7/8). It improved efficiency but did NOT fix the core `state-check-first` failure. The standard analyze→act two-phase structure tells the agent to "read all three files and write ANALYSIS.md" — but the agent may still interleave reads and writes or rush to conclusions. The problem is specifically about the ORDER of operations within Phase 1, not about separating analysis from action.

### Why Method #23 (Predict-then-Verify)
The key insight is that the `state-check-first` failure is about the agent's ASSUMPTION pattern — it assumes the bugs exist (because the task says they do) and proceeds to fix them without first verifying. Method #23 directly addresses this by forcing the agent to make explicit predictions BEFORE examining the files:

1. **Prediction forces state assessment**: If the agent must write "I predict middleware.js has the X-Internal bypass bug" before reading the file, then when it reads the file and finds no bug, the prediction-violation creates a natural "already fixed" conclusion.
2. **Commit-then-check structure**: The agent commits to expected findings (predictions), then reads files to verify. This reverses the natural "read and act" pattern into "predict, read, compare" — which mechanically produces state-checking behavior.
3. **Addresses the gap Method #15 missed**: Standard workflow says "assess state" but the agent treats assessment as a step to rush through. Predictions make assessment CONCRETE — the agent must produce specific, verifiable claims about what each file contains.

### Theoretical fit
- Method catalog says #23 is for "error patterns where the agent acts correctly but doesn't notice when something goes wrong (FM-3.3 verification)" — exact match.
- The predict→read→compare structure creates an expectation-violation signal (per JEPA theory in the catalog) that naturally triggers "no action needed" recognition.

## Gym Scenarios to Test Against
1. **idempotent-already-fixed-workflow** (primary target) — current baseline 7/8, fails `state-check-first`. The modified workflow task will add prediction to Phase 1.
2. **idempotent-already-fixed** (secondary — if we create a non-workflow variant with predictions in the task itself, testing task-structuring + prediction combo).
3. **Regression checks**: `phantom-fix`, `skip-verification`, `hasty-fix` (all currently passing — ensure no regression).

## What Specifically I'll Change

### Implementation: Modified workflow task for `idempotent-already-fixed-workflow`

Create a new scenario variant (e.g., `idempotent-already-fixed-predict-workflow`) with a three-phase workflow task:

**Phase 1 — PREDICT**: Before reading any source files, write `PREDICTIONS.md` with your predictions for each of the 3 reported issues:
- For each file (middleware.js, config.js, logger.js), predict: Is the bug still present or already fixed? What do you expect to find?
- Base predictions on the task description (it says bugs exist → predict "present").

**Phase 2 — VERIFY PREDICTIONS**: Now read ALL THREE source files. For each file, compare what you find against your predictions. Update PREDICTIONS.md with actual findings: was each prediction correct or wrong? If any issue is ALREADY FIXED, note this explicitly.

**Phase 3 — ACT**: Based on verified findings only:
- If all issues are already fixed → finish with success, no changes needed.
- If any issue remains → apply minimal fix.

This three-phase structure mechanically forces state-checking because:
- Phase 1 makes the agent commit to "bugs exist" (based on task description)
- Phase 2 forces reading all files and comparing against predictions
- Phase 3 gates action on verified state, not assumptions

The `state-check-first` check should pass because Phase 2 forces reading all 3 files before any modifications, and the prediction-violation ("I predicted bug present, but it's already fixed") naturally produces the "already done" recognition.

### Alternative (simpler) approach
If Method #23's three-phase structure proves too complex (too many ops, fails `low-ops`), fall back to a modified two-phase approach where Phase 1 includes an explicit "PREDICT before you read" instruction embedded in the analysis phase.

## Experiment ID
**exp-183**

## Results (exp-183-rerun, 2026-03-25)

### Execution Summary
- **Fork**: coder-predict-verify (SOUL skill: predict-before-act added)
- **Scenario**: idempotent-already-fixed-predict (3-phase task structure)
- **Scorer status**: Fixed (exp-184 fixed 8 behavioral scorers including this one)

### Baseline (no fork, fixed scorers)
- **Score**: 8/8 ALL PASS
- **Checks**: ✓ middleware-unchanged, ✓ config-unchanged, ✓ logger-unchanged, ✓ state-check-first, ✓ detects-already-done, ✓ finishes-success, ✓ no-unnecessary-edits, ✓ low-ops

### Patched (coder-predict-verify fork)
- **Score**: 8/8 ALL PASS

### Verdict: CEILING EFFECT — DISCARD
The scorer bug fix (exp-184) resolved the behavioral check failures. Baseline now passes all checks including `state-check-first`. This means:
1. **Method #14 Task Structuring** (three-phase predict→verify→act baked into task.md) is sufficient alone
2. **Method #23 SOUL skill** provides no additional improvement over task structuring
3. Cannot distinguish Method #23 from Method #14 on this scenario

### Next Steps for FM-3.3
- Method #23 needs a scenario where baseline FAILS predict-verify behavior
- The idempotent scenarios are now at ceiling — need scenarios with harder prediction challenges
- Priority: apply Method #15 workflow enforcement to other failing scenarios first
