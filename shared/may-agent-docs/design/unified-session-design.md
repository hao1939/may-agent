# Unified Session Model: Sessions and Workflows

## Context

Today there are two separate persistence models:
- **Sessions** → `sessions/{id}/session.jsonl` + `meta.json` — agent conversations
- **Workflow runs** → `workflows/{runId}.json` — JSON tracking steps by reference to sessions

A workflow is just a group of sessions with a parent-child relationship. The `WorkflowRun` JSON is redundant metadata — it tracks the same parent→child relationships already recorded in each session's `meta.json` (`parentSessionId`, `workflowRunId`).

## Core Design

### One concept: Session

A session is a unit of work with:
- **Identity**: `sessionId`, `agent`, `task`, `status`
- **Parentage**: `parentSessionId` (who spawned me)
- **Type**: `"agent"` (LLM conversation) or `"workflow"` (JS orchestration)
- **Content**: `session.jsonl` (messages for agent sessions, event log for workflow sessions)
- **Children**: discovered by querying `parentSessionId`

### Session meta.json

```typescript
interface PersistedSession {
  // ... existing fields ...
  type?: "agent" | "workflow";  // default "agent" for backward compat
  childOrder?: string[];         // ordered child sessionIds (workflow sessions only)
}
```

### Crash recovery: no eager resume, workflow replay

**On startup:** mark all `running` → `interrupted`. Nothing else. ~20 lines replaces 250.

**Re-launch:** natural triggers (project handler, timers) start a fresh workflow. The new workflow gets `previousSessionId` — the exact ID of the interrupted workflow session.

**Replay by exact ID:** The interrupted workflow session's meta has `childOrder: ["s_456", "s_789"]` — the exact ordered list of child session IDs.

When the new workflow calls `runAgent()` at step 0:
1. Read `previousSessionId`'s `childOrder[0]` → `"s_456"`
2. Read `s_456`'s status → `done` → skip, return `manager.result("s_456")`

When it calls `runAgent()` at step 1:
1. Read `childOrder[1]` → `"s_789"`
2. Read `s_789`'s status → `interrupted` → run fresh session

No vague queries. Exact session IDs. The parent's `childOrder` is updated each time a child is created.

### What this means for each session type

| Session type | On crash | Recovery mechanism |
|---|---|---|
| Workflow parent | Mark interrupted | Project handler re-launches. New workflow references old one for replay |
| Completed child | Already done | Replayed when new workflow reaches that step |
| In-progress child | Mark interrupted | Re-run from scratch when new workflow reaches that step |
| Standalone (no parent) | Mark interrupted | Re-triggered by timer/handler naturally |

### What gets deleted

- `WorkflowRun` / `WorkflowStep` interfaces
- `saveWorkflowRun()` / `readWorkflowRun()` / `listWorkflowRuns()`
- `workflowRunDir()` / `workflowRunPath()`
- `cleanupStaleWorkflowRuns()` in manager
- Separate workflow trace paths in `manager-trace.ts`
- 250-line eager session resume in manager
- `resumeStaleSessions()` becomes ~20 lines: scan running → mark interrupted

### Workflow JSONL format

```jsonl
{"type":"workflow_start","workflow":"verify-wrap","task":"...","timestamp":1234}
{"type":"step_start","step":"coder","childSessionId":"s_456","timestamp":1235}
{"type":"step_done","step":"coder","childSessionId":"s_456","status":"done","timestamp":1240}
{"type":"step_done","step":"reviewer","childSessionId":"s_789","status":"done","timestamp":1250}
{"type":"workflow_done","summary":"Implementation verified","timestamp":1251}
```

## Files to modify

| File | Changes |
|------|---------|
| `src/lib/persistence.ts` | Add `type`, `workflow`, `childOrder` to PersistedSession. Remove WorkflowRun/WorkflowStep and related functions |
| `src/lib/workflow-tool.ts` | Replace WorkflowRun tracking with workflow session. Replay from child sessions |
| `src/lib/workflow.ts` | Remove WorkflowRun/WorkflowStep type exports |
| `src/lib/manager.ts` | Remove `cleanupStaleWorkflowRuns()`, simplify `resumeStaleSessions()` to just mark-interrupted |
| `src/lib/manager-trace.ts` | Build tree purely from parentSessionId |
| `src/app/ui/web.ts` | Query sessions by parentSessionId instead of scanning workflow files |
| `agents/shared/agent-sdk.ts` | Remove WorkflowRun/WorkflowStep exports |
