# Unified Session Model

## Core Insight

A workflow is just a group of sessions with parent-child relationships. `WorkflowRun` is redundant — it tracks what `parentSessionId` already records.

## Design

### Everything is a Session

- Agent session: `type: "agent"` — LLM conversation with messages
- Workflow session: `type: "workflow"` — orchestration record with `childOrder`
- Parent-child: `parentSessionId` links children to their workflow
- `childOrder: string[]` on workflow session records exact step order

### Unified Resume (decoupled from normal execution)

One mechanism for all sessions. Three phases:

1. **Reconstruct** — load interrupted session's messages from JSONL
2. **Resolve** — walk pending tool calls:
   - Workflow tool call → re-execute workflow (skip completed children via `childOrder`, run rest fresh) → inject result
   - Other tool call → inject error "process restarted"
3. **Continue** — `agent.continue()` on clean history. Normal execution has zero resume awareness.

### No Eager Resume

On startup: mark all `running` → `interrupted`. Nothing else.
Resume only when explicitly triggered (user CLI/UI, or project handler re-launch).

### Workflow Replay

When workflow engine gets `previousSessionId`:
- Read its `childOrder` → exact child session IDs in order
- For each step: child done? skip (return its `TaskResult`). Child interrupted or missing? run fresh.
- No vague queries. Exact IDs.
