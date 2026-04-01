# Workflow Proposal: Heartbeat Turn Guard

## Problem
Heartbeat sessions are meant to be lightweight (read state, do one task, stop). But agents frequently exhaust their turn limits (40-50 turns) by getting pulled into deep exploration or iterative rewrites during what should be a simple check-and-act cycle.

**Evidence (2026-03-09):**
- Coach hit 40/40 turns on heartbeat (s_1773034599269_182, s_1773017913649_165)
- Bob hit 51/50 turns on heartbeat (s_1773032730237_179) — wrote `execution-plan.md` 24 times
- Amy failed to identify itself, burned 10 turns exploring the filesystem (s_1773034640423_185)

## Pattern
The dangerous sequence:
1. Agent starts heartbeat → reads SOUL.md and todo
2. Picks up a task that's deeper than expected
3. Gets into an iterative loop (repeated writes, exploration spirals)
4. Hits turn limit before completing or updating state
5. Next heartbeat picks up the same task → repeat

## Proposed Workflow: `heartbeat-guard`
Add a **turn budget checkpoint** to heartbeat logic:

### Rules
1. **Heartbeat tasks should complete in ≤15 turns.** If a task will take more, the agent should:
   - Write a partial result to workspace
   - Add a continuation item via `finish({ new_items: ["Continue: ..."] })`
   - Stop and yield the session
2. **No iterative full-file rewrites in heartbeats.** Use surgical edits (sed) or defer to a dedicated session.
3. **Identity bootstrap must be instant.** Agent's own paths should be in its system prompt or agent.json, not discovered at runtime.

### Benefits
- Prevents turn-limit waste ($0.30+ per exhausted session)
- Ensures heartbeat state is always updated (even if task incomplete)
- Frees capacity for other agents

### Status
- **Identified**: 2026-03-09 (Bob, Pattern Scan)
- **Source**: s_1773032730237_179, s_1773034599269_182, s_1773017913649_165
- **Action**: Optimizer to implement turn-budget awareness in heartbeat prompts
