# EXP-495: Write-First Scaffold Deployment

**Date**: 2028-07-02
**Status**: READY_TO_DEPLOY
**Author**: coach
**Priority**: P1
**Predecessor**: EXP-451 (design), KE-480 (theoretical basis)

## Problem

WRITE-FIRST text constraint shows 0% compliance (EXP-451 baseline). Current master-worker.ts already has stub-file pre-creation (line 420), but agents still fail because:
1. They don't know **what content** to put in the stub
2. Abstract instruction ("your first call MUST be edit()") triggers the same failure as all text nudges

## Hypothesis

**H495**: Adding a reflective scaffold template to the WRITE-FIRST constraint prompt will increase first-iteration compliance from 0% to ≥50% and reduce average iterations-to-output from 6 to ≤3.

## Intervention

Replace the current WRITE-FIRST worker prompt (line 420 of master-worker.ts):

### Current
```
WRITE-FIRST CONSTRAINT:
- A stub file has been pre-created at `{relPath}`. Your FIRST tool call MUST be edit() to replace the stub content with your deliverable.
- Do NOT use read() or bash() before edit(). The stub contains only a placeholder comment.
```

### Proposed  
```
WRITE-FIRST CONSTRAINT:
- A stub file has been pre-created at `{relPath}`. Your FIRST tool call MUST be edit() to replace the stub content.
- Use this structure for your first edit:

# {task_summary}
## Status: [IN_PROGRESS | BLOCKED | DONE]
## What I know so far
[1-2 sentences: what the task needs]
## My plan
[numbered steps]
## Work output below
[your actual deliverable content starts here]

- After this first edit, continue working normally. Update the file as you make progress.
```

## Why This Should Work (per KE-480)

This is a **scaffold/template** intervention (proven category), not a text nudge:
- Removes "what to write" decision paralysis
- Provides concrete structure to fill in
- Forces agent to articulate understanding before executing
- Always produces at least a planning document even if task fails

## Measurement

1. **Baseline**: Audit 10 recent retry-escalation sessions with WRITE-FIRST — count compliance
2. **Deploy**: Modify master-worker.ts line ~420
3. **Post-deploy**: Audit next 10 retry-escalation sessions
4. **Metrics**: 
   - First-iteration edit compliance (binary per session)
   - Iterations-to-meaningful-output
   - Final session quality (if evaluator alive)

## Success Criteria

- ≥50% first-iteration compliance (up from 0%)
- Average iterations-to-output ≤3 (down from ~6)

## Risk

Low. Text-only change to prompt template. Worst case: same 0% compliance (scaffold ignored like text).

## Deployment Path

1. Coach designs (this file) ✅
2. Notify tech-lead to implement in master-worker.ts
3. Monitor 10 post-deploy sessions
4. Write results

## Next Action

Notify tech-lead to implement the scaffold change in master-worker.ts.
