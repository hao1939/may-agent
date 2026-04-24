# Design: Automated Repair Loop (Self-Healing)

**Status**: Draft
**Owner**: Bob
**Date**: 2026-03-14

## Context
We have achieved **L3 Collective Defense** (Drift Detection + Auto-Revert). This prevents the system from degrading ("Boiling Frog"). However, the current response is purely **reactive and destructive**: it rolls back to a previous state, discarding any progress (even partial) along with the regression.

We want to move to **L4 Self-Healing**:
- Detect drift.
- **Diagnose** the cause.
- **Repair** the agent forward (fix the bug), rather than backward (revert the code).
- Fallback to Revert only if Repair fails.

## The Loop: Detect → Decide → Repair → Verify

### 1. Detection (Existing)
Evaluator runs `detect-drift` on `.state/ops-receipts.jsonl`.
- Output: `drift_detected` with specific `agent` and `tool` (e.g., `coder:run_test` success rate dropped 20%).

### 2. Decision Logic (New)
The `drift-controller` must be upgraded to make a choice based on **Severity**.

| Severity | Metric Delta | Action | Rationale |
| :--- | :--- | :--- | :--- |
| **Catastrophic** | > 50% drop | **Revert Immediately** | System is broken. Safety first. |
| **Critical** | 15% - 50% | **Attempt Repair** | Likely a bug in new code. Fixable. |
| **Warning** | < 15% | **Log / Alert** | Noise or minor regression. Monitor. |

### 3. Repair Protocol (Coach)
If "Attempt Repair" is chosen, Evaluator delegates to Coach.

**Delegation Message**:
> "Agent `coder` has drifted in tool `run_test`. Success rate dropped from 95% to 70% in the last 20 calls. Last successful state was commit/backup X. Please repair."

**Coach's Workflow (The "Repair" Skill)**:
1. **Fork**: `fork_agent("coder", "coder-repair")`.
2. **Reproduce**: Analyze the failure patterns (read `ops-receipts` or recent session logs).
3. **Hypothesize**: Identify the recent change (diff against backup).
4. **Fix**: Edit `coder-repair` to address the root cause.
5. **Verify**: Run `verify_agent("coder-repair", "tests/reproduce_drift.md")`.
6. **Promote**: If verified, `promote_agent("coder-repair", "coder")`.
7. **Fallback**: If verification fails after N attempts, report failure to Evaluator.

### 4. Fallback Reversion
If Coach reports failure (or times out), Evaluator triggers the original **Revert** mechanism to restore the last good backup.

## Components Required

### A. `drift-controller` Upgrade (Evaluator)
- Logic to split flow based on drift severity.
- Logic to `call("coach", ...)` for repair.
- Logic to handle Coach's success/failure result.

### B. `repair_agent` Skill (Coach)
- A high-level skill that orchestrates the Growth Cycle tools.
- Needs to be able to "find the bug" without explicit user input (using logs/diffs).

## Implementation Plan

### Phase 1: Coach Repair Skill
- Create `agents/coach/skills/repair-drift.cjs` (or .md task).
- Input: `agentName`, `driftDetails`.
- Output: `success` (promoted) or `failure` (gave up).

### Phase 2: Evaluator Controller Logic
- Modify `drift-controller.cjs` to add the branching logic.
- Add timeout/safety guards (don't let repair run forever).

### Phase 3: Integration Test
- Create a "Drift Scenario":
  - Manually introduce a bug into Coder (e.g., break `run_test`).
  - Generate "fail" receipts.
  - Run `enforceStability()`.
  - Expect: Evaluator calls Coach -> Coach fixes Coder -> Drift resolved.

## Risk Assessment
- **Infinite Loop**: Repair introduces new bug -> Drift detected -> Repair called again.
  - **Mitigation**: `drift-controller` must check if a repair was *recently attempted* for this agent/tool. If yes, Revert instead.
- **False Positive Fix**: Coach thinks it fixed it, but didn't.
  - **Mitigation**: `verify_agent` is the gate. If verification is weak, the fix is weak. We need robust verification tasks.

## Next Step
- Brief Tech Lead on `drift-controller` upgrade.
- Brief Coach on `repair-drift` skill.
