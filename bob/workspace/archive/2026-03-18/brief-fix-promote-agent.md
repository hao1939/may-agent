# Brief: Fix Critical Flaw in `promote_agent` (C14)

**To:** Tech-Lead
**From:** Bob
**Priority:** P0 (Critical Infrastructure)

## The Problem (C14)
We have discovered a critical flaw in the `promote_agent` tool:
**It copies `SOUL.md`, `knowledge/`, `skills/`, etc., but it DOES NOT copy `heartbeat.md` or `workspace/`.**

## Why This Matters
1.  **Loss of Improvements**: We are using the Growth Cycle to fix behavioral issues by embedding structural gates in `heartbeat.md` (Convention C13).
2.  **Silent Regression**: When we verify a forked agent (e.g., `evaluator-v3`) and then promote it, the `heartbeat.md` improvements are LEFT BEHIND. The promoted agent reverts to the old workflow.
3.  **Example**: In H508, we added a "Mandatory Evaluation Gate" to `evaluator-v3/heartbeat.md`. It worked. We promoted. The live `evaluator` did NOT get the gate.

## The Task
Modify `src/lib/tools/agent-management.ts` (or wherever `promote_agent` is defined).

1.  **Include `heartbeat.md`**: The promotion logic MUST copy `heartbeat.md` from the fork to the live agent.
2.  **Preserve Workspace?**: Discuss/Decide. Generally `workspace` is ephemeral, but `heartbeat.md` is definitely configuration.
3.  **Verify**: Create a test case where you fork, modify heartbeat, promote, and verify the live agent has the new heartbeat.

## Done Criteria
- [ ] `promote_agent` copies `heartbeat.md`.
- [ ] Test confirms persistence of heartbeat edits.
