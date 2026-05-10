# Infra Surface Implementation Plan

**Status**: Phase 1, Phase 2 first slice, Phase 3 guard observability, Phase 4 first slice, and Phase 5 first slice implemented.

This plan turns [infra-surface.md](infra-surface.md) into small implementation
slices. The goal is not a broad rewrite. Each phase should improve the system
surface, reduce ad hoc behavior, and make the loop easier to observe.

Target model:

```
event/timer -> handler -> workflow -> sessions/functions/metrics -> evidence
```

Infra provides primitives. Agents build patterns.

## Principles

- Keep changes incremental and reversible.
- Prefer convention over configuration.
- Preserve `getDb()` as compatibility escape hatch while moving new code to
  safer surfaces.
- Convert one real flow at a time; do not migrate every handler in one pass.
- Each phase must add tests or a visible runtime check.

## Phase 1: SDK Query Facade

Problem: handlers/workflows still reach into SQLite directly, which encourages
schema guessing and ad hoc queries.

Add a bounded, read-only query surface:

```ts
sdk.query.sessions(filter)
sdk.query.events(filter)
sdk.query.metrics(filter)
sdk.query.alerts(filter)
sdk.query.projects(filter)
sdk.query.sql(sql, params)
```

Rules:

- `query.sql` is read-only and bounded.
- Domain helpers return stable view objects, not raw DB rows when practical.
- `getDb()` remains available for compatibility and mechanical infra handlers.
- New judgment/action code should prefer `query`.

Validation:

- Unit tests for each query helper.
- Read-only enforcement test for `query.sql`.
- Bound/limit test for large result sets.
- One existing handler/workflow changed from direct DB reads to `sdk.query`.

## Phase 2: Event-To-Workflow Handler Helper

Problem: handlers can grow prompts, process logic, and direct agent calls.

Add a helper for the default handler shape:

```ts
createWorkflowHandler({
  workflow: "metric-alert-triage",
  source: entry.name,
  shouldRun(event, ctx) { ... },
  buildTask(event, ctx) { ... },
});
```

Handler responsibilities:

- normalize trigger,
- run deterministic preflight,
- skip/dedup when no work is needed,
- dispatch workflow.

Workflow responsibilities:

- collect live context,
- run functions,
- call agents,
- record evidence.

Validation:

- Unit tests for skip, dispatch, source metadata, and error behavior.
- Convert one noisy judgment/action handler to this helper.
- Verify workflow/session trace links back to originating event/handler.

## Phase 3: Guard Trigger Observability

Problem: guard triggers are valuable weakness/risk signals, but they are not
uniformly queryable.

Add target invariant:

```
every guard trigger -> guard.triggered event
```

Add default guard handler:

- records `guard.triggered-count-24h`,
- records `guard.warned-count-24h`,
- records `guard.blocked-count-24h`,
- records `guard.repeat-trigger-count-24h`,
- attaches session/workflow/step trace fields.

Rules:

- Default handler observes and measures.
- Guard runtime decides warn/repair/block/escalate.
- No per-guard config required for basic observability.

Validation:

- [x] Unit tests for emitted `guard.triggered` on `warn`, `run_step`, and `block`.
- [x] Metric snapshot test for guard counts.
- [ ] One real guard trigger can be traced from metric/event to session/workflow in the running instance.

## Phase 4: Shared Execution Result View

Problem: sessions and workflows are similar bounded work units, but their
results are hard to display and diagnose uniformly.

Add common view:

```ts
interface ExecutionResult {
  id: string;
  kind: "session" | "workflow";
  status: "done" | "error" | "interrupted" | "blocked" | "escalated";
  summary: string;
  traceId: string;
  evidence?: Record<string, unknown>;
}
```

Map these operations to the shared view:

- [x] `runAgent` result mapping
- [x] `runWorkflow` result mapping
- [x] persisted session lookup
- [x] persisted workflow lookup
- [ ] `resumeSession` diagnostic result mapping
- [ ] `resumeWorkflow` diagnostic result mapping

Validation:

- [x] Unit tests for session result mapping.
- [x] Unit tests for workflow result mapping.
- [ ] UI/API can render session/workflow result cards with the same fields.

## Phase 5: Resume Diagnostics And Failover

Problem: resume must not blindly replay partial/corrupt state.

Improve resume behavior:

- [x] inspect durable workflow state first,
- [x] preserve original workflow id for terminal no-op results,
- [x] resume only when the workflow definition and prior state are available,
- [x] return diagnostic reason when workflow resume is unsafe,
- [ ] emit `session.resume_failed`,
- [x] emit `workflow.resume_failed`,
- route to owner, fallback to `may`, escalate to human only when needed.

Validation:

- [ ] Corrupt workflow state test.
- [x] Missing workflow definition test.
- [x] Partial workflow state replay test.
- [x] Terminal workflow no-op resume test.
- [ ] Terminal session no-op resume test.
- [ ] Container restart scenario verifies stale work is visible and recoverable.

## Phase 6: Handler Audit

Classify existing handlers:

| Handler type | Keep direct? | Reason |
|---|---:|---|
| metric snapshot | yes | deterministic measurement |
| projection updater | yes | mechanical state derivation |
| cleanup/recovery bookkeeping | yes | mechanical infra repair |
| reload/restart/shutdown | yes | direct infra action |
| alert triage | no | judgment/action; use workflow |
| project resume/nudge | no | project context + judgment; use workflow |
| closed-loop steward | no | judgment/action; use workflow |
| session aftermath/eval | likely workflow | context collection + evaluation |
| heartbeat | workflow | agent pattern |

Do not migrate everything at once. Convert by highest pain/noise first.

Validation:

- Table of handlers with classification.
- At least one migrated handler has before/after trace evidence.
- No loss of current metrics or alerts.

## Phase 7: Loop Visibility

Problem: we need to know whether the system closes the loop without manual DB
digging.

Expose a loop trace:

```
event -> handler -> workflow -> session(s) -> evidence -> metrics/events
```

Minimum useful UI/API fields:

- originating event id/type,
- handler name/status,
- workflow run id/status,
- child sessions,
- owner,
- project id,
- guard signals,
- metrics changed,
- failure/failover path if any.

Validation:

- Pick one real event and show its full loop trace.
- Pick one failure and show owner/fallback/escalation state.
- Operator can answer "is the loop moving?" from the UI/API without ad hoc SQL.

## Recommended First Slice

Start with:

1. [x] Implement `sdk.query` with sessions/events/metrics/alerts helpers.
2. [x] Add bounded read-only tests.
3. [x] Add event-to-workflow handler helper.
4. [x] Convert one workflow bridge handler to the helper.
5. [x] Convert one deterministic handler read path from raw DB to `sdk.query`.
6. [ ] Verify trace from a real event to workflow to session in the running instance.

This gives immediate value and keeps the change set small.

## Non-Goals

- Do not remove `getDb()` immediately.
- Do not migrate every handler at once.
- Do not build a large socket query API.
- Do not add many new metrics before guard/handler basics are visible.
- Do not make workflows a second agent runtime.
