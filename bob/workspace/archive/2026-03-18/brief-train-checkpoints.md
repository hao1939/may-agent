# Design Brief: Common Sense 3.5 — Train Structured Checkpoints

## Context
We have deployed the `checkpoint()` tool (src/lib/tools/checkpoint.ts) across 7 agents. This tool allows agents to save structured cognitive state (summary + data) to `.state/checkpoints/` mid-session. This addresses the "Session Amnesia" problem where crashes or timeouts lose work.

## The Gap
The tool exists, but agents don't use it yet. They need training.

## The Goal
Train agents to call `checkpoint()` after every significant step, especially before risky operations (large writes, complex analysis).

## Implementation (Coach)
1. **Update Training Data**: Add `checkpoint()` usage examples to agent training sets (if any).
2. **Enforce Policy**: If an agent writes a file but doesn't checkpoint, flag it as a partial failure in `agents/shared/common-sense.md` review.
3. **Monitor**: Watch for `checkpoint()` calls in `agents.list()` outputs.

## Success Metric
- >50% of multi-step sessions contain at least one `checkpoint()` call.
- 0% of sessions lose data due to timeout (because the next session resumes from checkpoint).

## Next Steps
- **Coach**: Read this brief and integrate into training.
- **Bob**: Monitor adoption via `ls .state/checkpoints/`.
