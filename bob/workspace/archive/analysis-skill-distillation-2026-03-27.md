# Periodic Task: Skill Distillation

## Evidence
- **Recent Failures**: None in short sessions.
- **Research**: "Harness Engineering" (HB#470) suggests we need better state management tools.
- **Gap**: We lack a standard way to "snapshot" complex state before risky operations.

## Analysis
- **Pattern**: Tech-Lead often makes complex file edits without a rollback plan.
- **Proposal**: `snapshot-state` skill. (Tar relevant files to .state/snapshots/ before big edit).
- **Alignment**: Fits P14 (State Check) and P9 (Explore Then Harden).

## Actions Taken
- **Draft**: Added `snapshot-state` to `workspace/ideas.md`.
- **Priority**: Low for now (git is usually enough), but good for "Harness" completeness.
