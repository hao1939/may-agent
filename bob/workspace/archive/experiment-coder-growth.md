# Experiment: Coder Growth Cycle (v1)

**Objective**: Verify the "Fork → Train → Verify → Promote" cycle by improving Coder's test-debugging workflow.

## 1. Hypothesis
**Problem**: Coder often "shotguns" fixes—guessing at code changes without reading the full error output or stating a hypothesis.
**Proposed Fix**: Update Coder's `SOUL.md` to enforce a strict **"Diagnosis Loop"**:
1. Read the *full* error log (don't truncate).
2. State the *exact* line number and error message in the thought block.
3. Formulate a hypothesis *before* editing code.

## 2. Experiment Plan

### Step 1: Fork
- Command: `agents.call("coach", "fork_agent('coder', 'coder-strict')")`
- Result: `agents/.lab/coder-strict/` created.

### Step 2: Train (Modify)
- Action: Edit `agents/.lab/coder-strict/SOUL.md`.
- **Change**: Add a new "Debug Protocol" section to the Instruction Hierarchy.
  > "## Debug Protocol
  > 1. **Evidence**: You must read the failure log. Quote the specific error.
  > 2. **Hypothesis**: Explain *why* it failed before fixing.
  > 3. **Fix**: Apply the fix.
  > 4. **Verify**: Run the test again."

### Step 3: Verify
- **Task**: Create a "trap" test file `tests/trap_error.ts` that fails with a misleading error message (e.g., a type error that looks like a runtime crash).
- **Metric**:
  - `coder` (Control): Likely tries to fix the runtime logic.
  - `coder-strict` (Variant): Should quote the type error and fix the types.
- Command: `agents.call("coach", "verify_agent('coder-strict', 'Fix the test in tests/trap_error.ts')")`

### Step 4: Promote (or Discard)
- If `coder-strict` succeeds and follows the protocol:
  - Command: `agents.call("coach", "promote_agent('coder-strict', 'coder')")`
- If it fails:
  - Command: `agents.call("coach", "discard_agent('coder-strict')")`

## 3. Results (2026-03-14)
**Status**: SUCCESS
- **Fork**: Created `coder-strict` successfully.
- **Train**: Added "Debug Protocol" to `SOUL.md`.
- **Verify**: Created `tests/trap_error.test.ts` (addition returning string "42" instead of number 42).
  - The agent correctly identified the root cause (unnecessary `String()` wrapper + `@ts-ignore`).
  - It fixed the code, not the test.
  - It followed the protocol (Evidence -> Hypothesis -> Fix).
- **Promote**: Successfully promoted `coder-strict` to `coder`.
- **Cleanup**: Deleted temporary test file.

**Conclusion**: The "Growth Cycle" (Fork/Train/Verify/Promote) is operational and safe.
