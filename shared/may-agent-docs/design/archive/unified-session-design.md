# Unified Session Model — Draft Proposal

## Status: Draft — on hold pending decision on priority vs other simplifications

## Problem

Two separate persistence models doing overlapping jobs:
- **Sessions**: `sessions/{id}/session.jsonl` + `meta.json` + SQLite — agent conversations
- **WorkflowRun**: `workflows/{runId}.json` — tracks steps by reference to sessions

A workflow is just a group of sessions with parent-child relationships. `WorkflowRun` redundantly tracks what `parentSessionId` already records.

## Core Insight

A workflow is just sessions. The orchestration logic (JS code) is ephemeral. What persists is:
- The parent-child relationship (already in `parentSessionId`)
- The step order (new: `childOrder` on workflow session)
- Each child session's messages and result (already in JSONL)

## Design

### Everything is a Session

Workflow run becomes a session with `type: "workflow"`. Children link via `parentSessionId`.

**PersistedSession gains:**
```typescript
type?: "agent" | "workflow";  // default "agent"
workflow?: string;             // workflow name (workflow sessions only)
childOrder?: string[];         // ordered child sessionIds (workflow sessions only)
```

### Unified Resume

Reuse existing resume mechanism in manager.ts. One addition: when a pending tool call is a workflow call, re-execute the workflow with `previousSessionId` (skip completed children via `childOrder`) instead of injecting an error.

```
Resume (existing code + one if-branch):
  1. Load interrupted session messages from JSONL
  2. For each pending tool call in last assistant message:
     - Workflow tool call → re-execute with replay → inject result
     - Other tool call → inject error "process restarted"
  3. agent.continue()
```

### Workflow Replay

Same logic as today, different data source:

```typescript
// Today: reads WorkflowRun.steps[stepCounter]
// After: reads childOrder[stepCounter] from previous workflow session
if (previousChildOrder && stepCounter < previousChildOrder.length) {
  const prevChildId = previousChildOrder[stepCounter];
  const prevMeta = readSessionMeta(persistDir, prevChildId);
  if (prevMeta?.status === "done" && prevMeta.agent === agentName) {
    return manager.result(prevChildId); // skip — exact ID
  }
}
```

### No Eager Resume on Startup

Mark all `running` → `interrupted`. ~20 lines replaces 250. Resume only when explicitly triggered.

### What gets deleted

- `WorkflowRun` / `WorkflowStep` interfaces and all persistence functions (~80 lines)
- `cleanupStaleWorkflowRuns()` (~15 lines)
- `resumeStaleSessions()` bulk (~230 lines, replaced by ~20)
- Workflow-specific trace paths in `manager-trace.ts` (~80 lines)
- `resume` action on workflow tool (~30 lines)

### What gets added

- `type`, `workflow`, `childOrder` fields on PersistedSession
- `appendChildOrder()` helper
- One if-branch in existing resume for workflow tool calls

### Net impact

- Delete ~400 lines, add ~50 lines
- One persistence model instead of two
- One cleanup path instead of two
- One trace builder instead of two
- One resume mechanism (existing, extended) instead of two

### Files affected

- `src/lib/persistence.ts` — add fields, remove WorkflowRun
- `src/lib/workflow-tool.ts` — workflow session instead of WorkflowRun, childOrder replay
- `src/lib/workflow.ts` — remove WorkflowRun/WorkflowStep exports
- `src/lib/manager.ts` — simplify resume, remove workflow-specific cleanup
- `src/lib/manager-trace.ts` — tree from parentSessionId + childOrder
- `src/lib/manager-agents-tool.ts` — use childOrder for workflow context
- `src/app/ui/web.ts` — query by parentSessionId
- `agents/shared/agent-sdk.ts` — remove exports

### Open questions

- Is this worth the refactor effort vs other higher-value simplifications?
- Other simplifications discussed in this session (not yet acted on):
  - Eliminate dual session modes (chat vs job)
  - Align status via finish() tool outcomes
  - Flatten SubagentManager from 2,332 lines to ~500
  - Remove session archival (file moving)
  - Remove TOOLS.md/LESSONS.md (no longer used)
