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
  type: "agent" | "workflow";   // default "agent" for backward compat
  workflow?: string;             // workflow name (only for type: "workflow")
  childOrder?: string[];         // ordered list of child sessionIds (step sequence)
}
```

### Resume model: lazy, on-demand

**No eager resume.** On crash:

1. Startup: mark ALL `running` sessions as `interrupted` (workflow parents and agent children alike)
2. Nobody gets resumed eagerly
3. Natural triggers re-launch work:
   - **Heartbeats** → timer fires again naturally
   - **Projects** → project handler sees project still active, launches new workflow
   - **Standalone tasks** → re-triggered by whatever originally triggered them
4. New workflow starts, gets reference to previous (interrupted) workflow session
5. When new workflow calls `runAgent("coder", task)`:
   - Check: did previous workflow session have a **completed** child at this step position?
   - If yes → replay its `TaskResult` (skip the step)
   - If no (child was interrupted or doesn't exist) → run live
6. **Child sessions are only replayed when execution reaches them** — never eagerly

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
