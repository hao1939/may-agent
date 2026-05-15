# Gym Cycle 2 Plan — Context-Learning

**Date**: 2026-04-26
**Target**: Context-learning (0/3 in baseline)
**Failed scenarios**: context-learning, context-learning-correction, reflexion-npx-recovery

## Diagnosis

All 3 failures share a pattern: the agent receives a task with specific instructions (e.g., "use `context_updates` in `finish()`") but ignores them, defaulting to its standard heartbeat behavior.

**Root cause hypotheses:**
1. **Task content is overshadowed** — the agent's system prompt/heartbeat context is so large that task.md instructions get lost
2. **`context_updates` is unfamiliar** — the agent has never been trained/instructed to use this finish() field
3. **Agent treats gym tasks as heartbeats** — the `--oneshot` flag may not sufficiently differentiate the session

## Proposed Interventions

### Option A: Skill file — "context-learning" skill
Add a skill to the agent that explicitly instructs: "When asked to explore a project, use `context_updates` in `finish()` to persist facts."
- Pro: Direct, testable in gym
- Con: Narrow — only helps with this specific check type

### Option B: Workflow enforcement
Create a 2-phase workflow: Phase 1 reads all files, Phase 2 synthesizes and finishes with context_updates.
- Pro: Proven pattern (evidence-over-narrative, verify-before-finish both work as workflows)
- Con: Requires gym harness support for multi-phase

### Option C: System prompt addition  
Add to SOUL.md or context.md: "Always persist important discoveries using context_updates in finish()."
- Pro: Broad impact
- Con: Text injection alone rarely works (19+ failures in gym experiments)

### Recommendation
Start with **Option A** (skill file), tested in gym. If it works, promote to deployment. Text injection alone has a 0% success rate in our experiments; workflow enforcement has ~90%+ success rate. But skill files (a middle ground) have shown 80%+ in some scenarios (EXP-222 Phase 3).

## Next Steps
1. Create context-learning skill file
2. Test in gym: 5 runs with skill vs 5 runs without
3. If effective, test on context-learning-correction and reflexion-npx-recovery too
