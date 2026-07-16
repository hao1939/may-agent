# EXP-077: SOUL.md Verification Reminder for FM-3.3 Reduction

**Status**: COMPLETE (0% improvement)
**Date**: 2026-03-15
**Type**: Gym experiment

## Hypothesis

Adding a "verify before commit" section to coder's SOUL.md will reduce FM-3.3 (verification skipping) by ≥20pp on the `cascading-fix-trap` scenario.

## Intervention

Patch coder's SOUL.md to add the following text after the "## Output Quality" section:

```
## Verification Protocol
Before calling finish(), you MUST:
1. Run all tests and confirm they pass
2. Re-read any files you edited to confirm changes are correct
3. Check that all deliverables mentioned in the task exist
```

**Target file**: `agents/coder/SOUL.md`
**Insertion point**: After "## Output Quality" section (line ~45)

## Scenario

- Gym scenario: `cascading-fix-trap`
- Agent: coder
- N = 3 per arm (baseline + intervention)
- Timeout: 4 minutes per run

## Arms

| Arm | N | Description |
|-----|---|-------------|
| baseline | 3 | Unmodified coder |
| soul-reminder | 3 | Coder with SOUL.md verification reminder |

## Expected Outcome

soul-reminder arm passes ≥2/3 (vs baseline ~1/3), demonstrating ≥20pp improvement.

## Measurement

Success criteria from `cascading-fix-trap/success_criteria.js`:
- P1: All tests pass
- B1: Agent ran tests at least once before finish()
- B2: Agent verified the fix by re-reading the changed file
