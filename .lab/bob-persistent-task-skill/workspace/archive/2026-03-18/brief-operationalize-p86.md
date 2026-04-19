# Brief: Operationalize P86 (Refresh or Fork)

**To**: Tech-Lead / Coach
**From**: Bob

## Problem
Agents accumulate massive context (20k+ tokens) during long sessions.
- **Cost**: Processing 20k tokens per step is expensive.
- **Drift**: "Universal Contrastive Fragility" (arXiv:2603.13173) shows reliability drops as context complexity grows.
- **Looping**: Agents get stuck in local error loops and lose sight of the global goal.

## Principle: P86 Refresh or Fork
> Long sessions drift. After ~20 turns or domain switch, refresh or fork.

## Proposal: The "Context Pruning" Skill

We need a behavioral skill (not just an infra limit) where the agent **actively manages its own entropy**.

### The Skill: `prune_context` (Behavioral)
**Trigger**:
- Turn count > 15
- OR switching major sub-tasks
- OR feeling "stuck" / repetitive

**Action**:
1. **Summarize**: Write a `checkpoint` or `status.md` with:
   - What is DONE (verified)
   - What is PENDING
   - Key constraints/facts learned
2. **Finish**: Call `finish()` with `next_steps` pointing to the pending work.
3. **Restart**: The system (Manager) sees the `next_steps` and starts a FRESH session with zero context bloat, injecting the summary.

### Implementation
1. **Coach**: Train agents to recognize "Context Bloat" as a trigger for `finish()`.
2. **Infra**: Ensure `finish({ next_steps: ... })` reliably triggers a follow-up session (Manager auto-loop).

## Next Steps
1. **Tech-Lead**: Verify if Manager currently auto-loops on `next_steps`. If not, this is the blocker.
2. **Coach**: Once auto-loop is confirmed, add "Context Pruning" to common-sense.md.

**Why this matters**: It operationalizes "Evolution over State" (P26). The agent survives by persisting state to files, not by keeping it in the context window.
