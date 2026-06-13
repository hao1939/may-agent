# Iteration 2 — live SDK bridge null-event guard

## Goal
Stop the recurring `evaluator-aftermath requires a sessionId` escalation loop so event-driven aftermath reviews either receive a concrete `session.completed` trigger or do not dispatch.

## Import-chain evidence: why the live bridge is the SDK package
The first patch hit a shadow implementation. The active runtime path is:

1. `agents/may/handlers/run-workflow.ts`
   - imports `createWorkflowHandler` from `../../../shared/agent-sdk.ts`
   - passes through `includeEvent: config.includeEvent`
2. `shared/agent-sdk.ts`
   - re-exports `@may-agent/sdk`
3. `projects/platform/repos/may-agent/packages/sdk/src/index.ts`
   - contains the exported `createWorkflowHandler()` implementation actually reached through the package boundary

Relevant evidence captured during this iteration:

```ts
// agents/may/handlers/run-workflow.ts
import { createWorkflowHandler } from "../../../shared/agent-sdk.ts";
...
return createWorkflowHandler({
  workflow: config.workflow,
  source: config.agent,
  task: config.task,
  includeEvent: config.includeEvent,
})(ctx, entry);
```

```ts
// shared/agent-sdk.ts
export * from "@may-agent/sdk";
```

```ts
// projects/platform/repos/may-agent/packages/sdk/src/index.ts
export function createWorkflowHandler(options: WorkflowHandlerOptions): HandlerModule["create"] {
```

## Code changes made in the live bridge
Patched `projects/platform/repos/may-agent/packages/sdk/src/index.ts` to mirror the null-event guard semantics designed in iteration 1, but on the real implementation surface:

- added `ValueResolver<T>` / `resolveValue()` helper support so the SDK bridge matches the richer app-side handler behavior,
- added `projectId?: ValueResolver<string | undefined>` support,
- added `includeEvent?: boolean`,
- added `appendEvent()` to attach a structured `## Trigger Event` block when an event exists,
- added an early guard:
  - if `includeEvent` is requested and the handler receives no `event`,
  - log a warning,
  - emit `handler.skipped` with reason `includeEvent requested but no event payload received`,
  - and do **not** dispatch the workflow.

Post-change dispatch shape in the SDK bridge now is:

```ts
if (options.includeEvent && !event) {
  ctx.sdk.log("warn", `[workflow-handler:${entry.name}] skipped includeEvent dispatch because no event payload was received`);
  ctx.sdk.emit("handler.skipped", {
    handler: entry.name,
    reason: "includeEvent requested but no event payload received",
    eventType: null,
  });
  return;
}
```

It also now preserves richer emitted metadata on success:

```ts
ctx.sdk.emit("handler.workflow_dispatched", {
  handler: entry.name,
  workflow,
  source: source ?? ctx.agentName,
  projectId: projectId ?? null,
  workflowRunId: result.runId ?? null,
  status: result.status,
});
```

## SDK-owned regression coverage
Added package-owned regression coverage at:
- `projects/platform/repos/may-agent/packages/sdk/src/workflow-handler.test.ts`
- `projects/platform/repos/may-agent/packages/sdk/src/bun-test.d.ts` (package-local test typing so the SDK package can typecheck its own Bun test file)

The new SDK test file covers:
1. normal dispatch with appended trigger event,
2. skip-without-dispatch when `includeEvent` is set but the event payload is missing,
3. existing `shouldRun` skip behavior with emitted `handler.skipped` evidence.

## Targeted test results
Executed from the SDK package directory:

```bash
cd /app/projects/platform/repos/may-agent/packages/sdk && bun test src/workflow-handler.test.ts
```

Result:
- `3 pass`
- `0 fail`

Initial package typecheck failed because the SDK package did not have a local declaration for `bun:test`. After adding `packages/sdk/src/bun-test.d.ts`, this passed:

```bash
cd /app/projects/platform/repos/may-agent/packages/sdk && bun x tsc --noEmit -p tsconfig.json
```

Result:
- clean exit / no output

## Post-change DB recheck
The code change is landed locally, but the runtime DB has **not** changed shape yet during this session.

24h escalation count recheck:

```sql
SELECT COUNT(*) AS c
FROM events
WHERE event_type='escalation.created'
  AND json_extract(data,'$.reason')='evaluator-aftermath requires a sessionId'
  AND timestamp > (unixepoch()*1000 - 86400000)
```

Result:
- `240`

Recent event sequence still shows the pre-fix live behavior:
- `session.completed`
- then `handler.workflow_dispatched` for `workflow='evaluator-aftermath'` with `status='escalated'`
- then `escalation.created` with reason `evaluator-aftermath requires a sessionId`

Recent sample from the DB recheck:
- `1778932899596` — `session.completed` with `sessionId = s_1778932780263_2`
- `1778932899620` — `handler.workflow_dispatched` for `evaluator-aftermath`, `status='escalated'`
- `1778932899617` — `escalation.created`, reason `evaluator-aftermath requires a sessionId`

Fresh `handler.skipped` rows with reason `includeEvent requested but no event payload received` were **not** present yet, so production has not visibly picked up the SDK patch/reload path during this iteration.

## May handoff note sent
Sent to May as a routing note:
- the prior patch hit the wrong file (`shared/lib/workflow-handler.ts`),
- the live bridge owner is `@may-agent/sdk` via `shared/agent-sdk.ts`,
- the SDK bridge is now patched in `projects/platform/repos/may-agent/packages/sdk/src/index.ts`,
- SDK regression coverage passes,
- production DB shape has not changed yet, so runtime pickup / deploy / reload still needs owner follow-through.

## Status
Implementation is complete on the correct code path and verified locally at the SDK package boundary.

What remains open is runtime adoption/validation: the production event stream still shows the old `workflow_dispatched -> escalated` sequence, so the next check should happen after the owning runtime reload/deploy cycle picks up the SDK package change.
