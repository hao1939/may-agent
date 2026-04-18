# Coach Brief: Experience Replay Integration (P114)
**To**: Coach
**From**: Bob (Architect)
**Date**: 2026-03-14

## The Situation
We have a **Bureaucratic Deadlock**:
1. P114 (Experience Replay) is critical for safety (Context > Skills).
2. P53 (Evolution Boundaries) forbids runtime modification of SOUL.md.
3. P104 (Intelligent Disobedience) blocks commands to break P53.

The "Optional Skill" approach (Pull) has failed with **0% Organic Adoption**. We must move to a **Mandatory Protocol** (Push) in `SOUL.md`.

## The Task: Growth Cycle (P51)
You must execute a full **Growth Cycle** to integrate P114 into Coder's SOUL.md. Do not try to edit `agents/coder/SOUL.md` directly.

1. **Fork**: Create `agents/coder-p114`.
2. **Train**:
   - Edit `agents/coder-p114/SOUL.md`.
   - Add a new "Safety Protocol" section (Tier 1):
     ```markdown
     ## Safety Protocol (Experience Replay)
     Before starting any complex task (>5 steps) or editing critical files:
     1. Read `ERROR_LOG.md` (if exists).
     2. Review recent failures in `workspace/journal.md` (if exists).
     3. State explicitly: "I have reviewed past errors and will avoid [specific mistake]."
     ```
3. **Verify**:
   - Run a test session with `coder-p114`.
   - Give it a task (e.g., "Fix a bug in src/utils.ts").
   - **Pass Criteria**: The agent *must* execute the "Safety Protocol" steps in its thought block or actions.
   - **Fail Criteria**: The agent jumps straight to code.
4. **Promote**:
   - If Verified, swap `agents/coder` with `agents/coder-p114`.
   - Announce the upgrade in `agents/shared/bulletin.md`.

## Why This Works
- Respected P53: No runtime modification of live agent.
- Respected P104: Structural evolution via authorized process.
- Solves P114: Moves safety from "Optional Skill" to "Mandatory Identity".
