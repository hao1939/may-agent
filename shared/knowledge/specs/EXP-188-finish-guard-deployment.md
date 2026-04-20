# EXP-188 Finish Guard Deployment Spec

**Status**: READY TO IMPLEMENT
**Priority**: P0 — confirmed +100pp improvement
**Experiment**: EXP-188 (0% → 100% persistent-task adoption with guard)

## What Exists

1. **`agents/src/lib/finish-guard.ts`** — Complete library with:
   - `validatePersistentTaskEnforcement()` / `enforcePersistentTask()` (FM-3.4)
   - `validateFinishDeliverables()` / `enforceFinishDeliverables()` (FM-3.1)
   - `validateVerificationEvidence()` / `enforceVerificationEvidence()` (FM-3.3)

2. **`agents/test/finish-guard.test.ts`** — 41 tests, all passing.

3. **`agents/shared/guards/`** — Existing workflow guard system with REGISTRY.md.

## What Needs to Happen

### Option A: Workflow Guard (Recommended — fits existing architecture)

Create `agents/shared/guards/finish-guard.ts` that uses the WorkflowGuard interface:

```ts
/// <reference path="../../../src/lib/workflow-defs.d.ts" />

export const guard: WorkflowGuard = {
  name: "finish-guard",
  events: ["step_done"],

  handle(event: WorkflowGuardEvent): Demand[] {
    if (event.type !== "step_done") return [];
    
    const finishResult = event.result?.finishResult;
    if (!finishResult || finishResult.status !== "success") return [];
    
    // FM-3.4: Check if persistent-task was required but not used
    // The workflow context should track which workflows were invoked
    // If the task mentions "project:" or references a project directory,
    // persistent-task should have been used
    const taskText = event.step ?? "";
    const resultText = event.result?.lastAssistantText ?? "";
    
    // Heuristic: if the task was dispatched WITH a project reference
    // and the agent finished success without running persistent-task,
    // that's a violation
    const persistentTaskRequired = detectPersistentTaskRequired(taskText);
    const persistentTaskRan = detectPersistentTaskRan(resultText, event);
    
    if (persistentTaskRequired && !persistentTaskRan) {
      return [{
        type: "block",
        reason: "FM-3.4: persistent-task workflow required but not invoked. " +
          "Agent must use workflow.run('persistent-task', ...) instead of working inline."
      }];
    }
    
    return [];
  },
};
```

**Key design question**: How does the guard know persistent-task was required?

Options:
1. **Task-content heuristic**: If task contains `project:` field pointing to a directory with `project.md`, persistent-task is required.
2. **Explicit flag**: Callers set `persistentTaskRequired: true` in workflow context/metadata.
3. **Agent config**: Add `requirePersistentTask: true` to agent.json for agents that should always use it.

Recommendation: Option 1 (task-content heuristic) + Option 2 (explicit flag) as override.

### Option B: Direct Tool Hook (More robust, needs infra change)

Wire `enforcePersistentTask()` directly into the finish tool handler in the session manager. This would intercept the `finish()` tool call before it completes, returning an error to the agent.

This requires finding/modifying wherever the MCP/tool-use finish handler processes the finish tool call and adding:

```ts
import { enforcePersistentTask } from "./finish-guard.js";

// In finish tool handler:
enforcePersistentTask({
  status: params.status,
  persistentTaskRequired: session.persistentTaskRequired,
  workflowsRan: session.workflowsRan,
});
```

**This is more robust** because it blocks the agent at the tool call level (they see the error and can correct), but requires access to the session manager code which may be in the Claude infrastructure layer.

### Tracking `workflowsRan`

The session needs to track which workflows were invoked. When `workflow.run()` is called, the workflow name should be appended to a `workflowsRan` array on the session. This is then available to the finish guard.

## Acceptance Criteria

1. When an agent receives a task requiring persistent-task workflow and tries to `finish(success)` without calling `workflow.run("persistent-task", ...)`, the finish is blocked with FM-3.4 error message.
2. The agent sees the error and can correct by invoking the workflow.
3. Non-persistent-task sessions are unaffected (fail-open).
4. `finish(failure)`, `finish(blocked)`, `finish(partial)` are never blocked.
5. All 41 existing tests continue to pass.

## Files to Create/Modify

- **CREATE**: `agents/shared/guards/finish-guard.ts` — Workflow guard implementation
- **MODIFY**: `agents/shared/guards/REGISTRY.md` — Add finish-guard entry
- **POSSIBLY MODIFY**: Session tracking to record `workflowsRan`
