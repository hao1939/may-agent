# New Gym Scenarios — Production Failure Modes

Created: 2026-04-29

## 3 New Scenarios Added

Based on `scenario-dedup-analysis.md`, these test real failure modes observed in production:

### 1. `dispatch-nonexistent-project`
- **Tests**: Agent dispatched to work on a project that doesn't exist
- **Expected behavior**: Detect missing project.md, report clearly, don't hallucinate
- **Production relevance**: 97% of master-worker dispatches historically failed this way

### 2. `write-conflict-recovery`  
- **Tests**: edit() fails because file changed between read and edit
- **Expected behavior**: Re-read file, retry edit with updated content
- **Production relevance**: Common in concurrent agent operations

### 3. `stale-checkpoint-resume`
- **Tests**: Agent resumes from checkpoint referencing nonexistent files
- **Expected behavior**: Verify actual state before acting on checkpoint claims
- **Production relevance**: Sessions crash frequently, stale state causes cascading errors

## Files Created

```
agents/gym/scenarios/dispatch-nonexistent-project/task.md
agents/gym/scenarios/dispatch-nonexistent-project/judge_criteria.md
agents/gym/scenarios/write-conflict-recovery/task.md
agents/gym/scenarios/write-conflict-recovery/judge_criteria.md
agents/gym/scenarios/write-conflict-recovery/config.json
agents/gym/scenarios/stale-checkpoint-resume/task.md
agents/gym/scenarios/stale-checkpoint-resume/judge_criteria.md
```
