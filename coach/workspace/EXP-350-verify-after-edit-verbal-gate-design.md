# EXP-350: Verify-After-Edit Verbal Commitment Gate

## Status: DESIGNED (ready for gym trial)

## Problem
- verify-after-edit compliance is ~9% system-wide (502 failures/7d historically)
- EXP-280 (text skill coaching): NEGATIVE — no change from baseline
- EXP-340 (structural gate in context.md): SUPERSEDED — gate already exists but compliance still low
- Root cause: agents skip the read-back step because nothing interrupts their flow

## Hypothesis
A **verbal commitment protocol** (agent must write "VERIFY: reading back [file]" as explicit text before proceeding) combined with a **gym scenario that penalizes skipped verification** will establish whether the behavior is trainable at all, or requires tool-layer enforcement.

## Key Question
Can a gym scenario reliably distinguish verify-after-edit compliance from non-compliance? If yes, we can test interventions. If no, we need tool-layer auto-readback (out of coach's control).

## Design

### Scenario: `verify-after-edit-gate`
A task requiring 3+ file edits where one edit introduces a subtle bug (wrong variable name). Only an immediate read-back would catch it.

### Setup
- Agent must edit 3 files to complete a feature
- File 2 edit will silently produce a typo if agent uses the "expected" oldText (simulated via scenario setup)
- Success requires: agent reads back each file after edit AND catches the bug in file 2

### Success Criteria (per run)
1. `edits_verified`: Agent calls read() within 2 tool calls after each edit() — binary per edit
2. `bug_caught`: Agent notices and fixes the introduced bug — binary
3. `task_complete`: Final feature works — binary

### Arms
- **Arm A (baseline)**: No special instruction beyond existing context.md gate
- **Arm B (verbal-commit)**: Add instruction: "After EVERY edit, you MUST write 'VERIFY:' followed by read(). If you skip this, the task fails."

### Measurement
- Primary: % of edits followed by immediate read() (within next 2 tool calls)
- Secondary: bug-catch rate (did the readback actually help?)

### Success Threshold
- Arm B ≥ 60% verify rate (vs expected ~10% baseline from Arm A)
- Bug-catch rate ≥ 50% in Arm B

### Why This Matters
If verbal-commit works in gym, we can roll out the phrasing to production context.md. If it doesn't work, we have definitive evidence that ONLY tool-layer enforcement (auto-readback after edit) will solve this — and we escalate to infrastructure.

## Predecessors
- EXP-280: Text skill → NEGATIVE
- EXP-340: Context.md gate → already present, still ignored
- KE-338: Text coaching dead for compliance behaviors

## Next Steps
1. Build gym scenario `agents/gym/scenarios/verify-after-edit-gate/`
2. Run 3 baseline trials (Arm A)
3. Run 3 treatment trials (Arm B) with verbal-commit instruction
4. Write results
