# Analysis Review — 2026-03-24T18:15

## Data Source
8 evaluations from `.state/evaluations/` (all from 2026-03-24, covering optimizer×3, coach×4, coder×2-via-bob-analysis).

## Key Findings

### 1. FM-2.2 Instruction Noncompliance (5/8 evals, 62.5%)
Still the dominant failure mode. Agents skip required steps or drift from task instructions.
- Optimizer: Skipped gym runs in Phase 3, skipped INDEX.md edits in Phase 4, produced wrong deliverable in Phase 1
- Coach: Improvised when sprint-plan.md was ENOENT instead of halting, shifted from method-selection to scorer bugfixes
- **Structural root cause**: No runtime enforcement of task step completion. Agents optimize for "getting something done" over "doing what was asked."
- **Intervention**: FM-2.2 needs a structural fix (task-step verification), not just skill training. Binary rebuild would help (multiple guards pending).

### 2. FM-3.3 Verification Failure (4/8 evals, 50%)
Persistent but **guards are working**: coach's ghost deliverable was caught by finish-guard.
- Optimizer: Claimed file well-formed without read-back, proceeded after ENOENT errors
- Coach: "Tests passed" without showing test output
- Coder: Claimed .gitignore behavior without reading .gitignore
- **Progress**: finish-guard Gate 1 (ghost deliverables) is actively blocking false claims. Gate 2 (verification evidence) deployed but needs binary rebuild.

### 3. Environment Path Guessing (3/8 evals, 37.5%)
Agents keep guessing wrong paths: `/var/tmp/sessions`, `/home/user`, `/Users/jk/aijudge`
- All evals from different agents show this pattern
- **Root cause**: PATH_ASSUMPTION not adequately addressed in prompts; agents should always use /app-relative paths
- **Intervention**: Already in SOUL.md/heartbeat.md for optimizer. Coach/coder need similar guidance.

### 4. C40 Promise-Deliver-Report Missing (4/8 evals, 50%)
No structured reporting before/after state-changing actions.
- **Impact**: Hard to audit what was promised vs delivered
- **Status**: More of an eval reporting pattern than a production failure — agents do work but don't structure it

## Comparison to Last Review (2026-03-24T13:03)
- FM-2.2 still dominant (was 6/8, now 5/8 — slight improvement)
- FM-3.3 still persistent (was 5/8, now 4/8 — slight improvement)
- **New positive**: finish-guard catching ghost deliverables (evidence: coach eval `task_tree_coach_2026-03-24T09-38-53Z.json`)
- **Still blocked**: Binary rebuild needed to activate finish-guard Gate 2 + empty-args-guard + session-read-guard bash protection

## Actions
- Binary rebuild remains #1 priority (blocks 4+ guards from activating)
- No new task needed — existing interventions are correct but undeployed
- Track improvement after next binary rebuild via gym baseline
