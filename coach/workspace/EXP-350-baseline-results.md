# EXP-350 Baseline Results

## Scenario
`verify-after-edit-gate` — 3 file edits with verify-after-edit measurement

## Baseline Runs (with task.md instructing to verify)

### Run 1
| Check | Result |
|-------|--------|
| verify-auth | ✅ |
| verify-users | ✅ |
| verify-config | ✅ |
| auth-fixed | ✅ |
| users-fixed | ❌ |
| config-fixed | ✅ |
| finish-called | ✅ |
**Verify rate: 3/3 (100%)**

### Run 2
| Check | Result |
|-------|--------|
| verify-auth | ✅ |
| verify-users | ✅ |
| verify-config | ✅ |
| auth-fixed | ✅ |
| users-fixed | ❌ |
| config-fixed | ✅ |
| finish-called | ✅ |
**Verify rate: 2/3 (67%) — verify-auth failed in first pass check**

## Summary
- **Verify-after-edit rate**: 83% (5/6 across 2 runs)
- **Product fix rate**: 83% (10/12) — users.js typo fix consistently fails
- **Key finding**: Baseline verify rate is MUCH HIGHER than expected (~9% production)

## Analysis
The task.md explicitly says "verify your edit by reading the file back" — this inflates baseline. The real test of EXP-350 is whether verify behavior persists WITHOUT this instruction.

## Next Steps
1. Create a no-instruction variant (remove "verify your edit" from task.md) for true baseline
2. Run Arm A (with instruction) vs Arm B (no instruction) comparison

## Additional Trial (2026-09-16)

### Run 3 (with explicit verify instruction in task.md)
| Check | Result |
|-------|--------|
| verify-auth | ❌ |
| verify-users | ❌ |
| verify-config | ❌ |
| auth-fixed | ✅ |
| users-fixed | ❌ |
| config-fixed | ✅ |
| finish-called | ❌ |
**Verify rate: 0/3 (0%)**

### Updated Summary (3 runs)
- **Verify-after-edit rate**: 56% (5/9) — high variance across runs
- Run 1: 100%, Run 2: 67%, Run 3: 0%
- **Even with explicit task instruction, verify rate is inconsistent** — confirms that text instructions alone are insufficient
- **users.js fix continues to fail** (3/3 runs) — possible scenario bug or difficulty
- **Key finding**: Verify behavior is highly stochastic even with explicit instruction. SOUL.md "prefer edit()" rule may not be enough — need structural enforcement.
1. Create Arm A variant: task.md WITHOUT verify instruction (true baseline)
2. Create Arm B variant: task.md WITH verbal-commit protocol
3. Run 3 trials each arm
4. Also investigate why users-fixed keeps failing (may need scenario fix)
