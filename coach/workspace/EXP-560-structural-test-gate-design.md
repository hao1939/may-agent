# EXP-560: Structural Test-File Gate for Generative Subtask Completion

**Date**: 2026-06-22
**Author**: coach
**Status**: DESIGNED
**Type**: Structural Intervention
**Predecessor**: EXP-555 (PARTIALLY POSITIVE — text checklist failed for test-writing)

## Problem

Agents consistently skip "write a test" requirements even when explicitly reminded via checklist injection (EXP-555: 0/3 test-written with treatment). This is a **priority gap** — the agent knows the requirement exists but deprioritizes it when the primary task feels complete.

EXP-555 showed:
- Awareness-gap checks (server-updated): +67pp with text rule
- Priority-gap checks (test-written): 0pp with text rule — completely unaffected

## Hypothesis

A **structural pre-finish gate** that checks for test file existence when the task mentions "test" or "spec" will force agents to address test-writing before completing.

**Mechanism**: In master-worker.ts or genericHeartbeat, before allowing finish():
1. Scan the original task for keywords: "test", "spec", "write.*test", "add.*test"
2. If keyword found, check if any `*.test.*` or `*.spec.*` file was created/modified
3. If not, re-prompt: "Task requires tests but none were created. Please write the test before finishing."

**Expected result**: ≥50pp improvement on test-written check (from 0% to ≥50%)

## Method

### Phase 1: Gym Measurement (baseline confirmation)
- Already done: 0/3 baseline, 0/3 with text treatment (EXP-555)
- Confirmed: test-written is a deterministic 0% failure

### Phase 2: Structural Gate Implementation
- Create a new gym scenario variant: `output-format-compliance-exp560-testgate`
- Inject a structural instruction that STOPS the agent and requires test file before finish
- Difference from EXP-555: Instead of "remember to check requirements", this says "YOU CANNOT FINISH without a test file. Write it now."

### Phase 3: Measurement
- 3 trials with structural gate
- Success: ≥2/3 pass test-written check

## Success Criteria

- Treatment: ≥50% pass rate on test-written (from 0% baseline)
- If positive: propose integration into master-worker.ts as automatic gate

## Why This Might Work

EXP-555 showed the agent CAN extract requirements (it listed "write test" in its plan) but still skipped execution. A gate that BLOCKS completion forces the priority to shift. This mirrors the success pattern of:
- EXP-520 (artifact gate): 100% recovery when agent told "you haven't written anything"
- EXP-500 (read-before-edit): 100% when info auto-injected
- EXP-530 (verification gate): 100% recovery rate

All structural gates show near-100% recovery. The pattern is robust.

## Risk

- Agent may write a trivial/empty test file just to pass the gate
- Gate detection regex may be too broad (false positives on unrelated tasks)
- Need to ensure gate only fires when task genuinely requires tests

## Timeline

- Phase 2: Next session — create scenario variant with gate instruction
- Phase 3: Same session — run 3 trials
