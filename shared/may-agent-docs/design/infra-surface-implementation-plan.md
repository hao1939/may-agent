# Infra Surface Implementation Plan

**Status**: Phase 1, Phase 2 first slice, Phase 3 guard observability, Phase 4
first slice, Phase 5 resume diagnostics, Phase 7 first slice, and Phase 8 first
slice implemented. Phase 9 is partially implemented; the next move is the
convention-path control client slice.

This plan turns [infra-surface.md](infra-surface.md) into small implementation
slices. The goal is not a broad rewrite. Each phase should improve the system
surface, reduce ad hoc behavior, and make the loop easier to observe.

Target model:

```
event/timer -> handler -> workflow -> sessions/functions/metrics -> evidence
```

Infra provides primitives. Agents build patterns.

Current runtime checkpoint:

- guard triggers are durable `guard.triggered` events with workflow/session trace fields,
- `guard.blocked-count-15m` is the active guard-block health signal,
- `project.iterations-24h` is watch-only, not a health target,
- the running instance can reach zero open metric alerts when metrics are calibrated to actionable work,
- `packages/control` now owns the socket protocol, client, and server core,
- Web UI steering and CLI send use the control client package,
- socket server is daemon-instance scoped, even though the legacy filename still
  includes the interface agent name,
- Telegram still runs in the daemon process and uses daemon internals directly.

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
- records `guard.blocked-count-15m`,
- records `guard.repeat-trigger-count-24h`,
- attaches session/workflow/step trace fields.

Rules:

- Default handler observes and measures.
- Guard runtime decides warn/repair/block/escalate.
- No per-guard config required for basic observability.

Validation:

- [x] Unit tests for emitted `guard.triggered` on `warn`, `run_step`, and `block`.
- [x] Metric snapshot test for guard counts.
- [x] One real guard trigger can be traced from metric/event to session/workflow in the running instance.

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
- [x] `resumeSession` diagnostic result mapping
- [x] `resumeWorkflow` diagnostic result mapping

Validation:

- [x] Unit tests for session result mapping.
- [x] Unit tests for workflow result mapping.
- [x] UI/API can render session/workflow result cards with the same fields.

## Phase 5: Resume Diagnostics And Failover

Problem: resume must not blindly replay partial/corrupt state.

Improve resume behavior:

- [x] inspect durable workflow state first,
- [x] preserve original workflow id for terminal no-op results,
- [x] resume only when the workflow definition and prior state are available,
- [x] return diagnostic reason when workflow resume is unsafe,
- [x] emit `session.resume_failed`,
- [x] emit `workflow.resume_failed`,
- route to owner, fallback to `may`, escalate to human only when needed.

Validation:

- [x] Corrupt workflow state test.
- [x] Missing workflow definition test.
- [x] Partial workflow state replay test.
- [x] Terminal workflow no-op resume test.
- [x] Terminal session no-op resume test.
- [ ] Container restart scenario verifies stale work is visible and recoverable.

## Phase 6: Handler Audit

Status: first audit slice documented in [handler-surface-audit.md](handler-surface-audit.md).

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

- [x] Table of handlers with classification.
- [x] At least one migrated handler has before/after trace evidence (`session-aftermath-scan` direct DB read -> `sdk.query`).
- [x] No loss of current metrics or alerts in unit suite.
- [ ] Next migration picked from the priority list.

## Phase 7: Loop Visibility

Status: first API/UI slice implemented via `GET /api/loop-trace`.

Problem: we need to know whether the system closes the loop without manual DB
digging.

Expose a loop trace:

```
event -> handler -> workflow -> session(s) -> evidence -> metrics/events
```

Minimum useful UI/API fields:

- [x] originating event id/type,
- [x] handler name/status,
- [x] workflow run id/status,
- [x] child sessions,
- [x] owner,
- [x] project id,
- [x] guard signals,
- [x] metrics changed,
- [x] failure/failover path if any.

Validation:

- [x] Pick one real event and show its full loop trace.
- [x] Pick one failure and show owner/fallback/escalation state.
- [x] Operator can answer "is the loop moving?" from the UI/API without ad hoc SQL.

## Phase 8: Alert Hygiene And Metric Calibration

Status: first slice implemented for guard block health and project iteration volume.

Problem: a metric can become misleading even when the measurement is correct.
Old windows, impossible floors, or non-actionable thresholds make agents spend
attention on stale or accepted states.

Target invariant:

```
active alert -> current actionable owner work
```

Rules:

- Health metrics should represent recent failure states that still need action.
- Watch-only metrics should keep `target=0` and `threshold=0` unless zero is
  itself a failure.
- Historical metric ids should be retired instead of left active with stale
  alerts.
- Calibration changes must preserve measurement history, resolve obsolete
  alerts, and keep the metric visible when it is still useful as context.
- Metrics remain signals. The owner still judges using facts, goal, and context.

Implemented first slice:

- [x] `guard.blocked-count-24h` and `guard.blocked-count-1h` retired.
- [x] `guard.blocked-count-15m` added as the active P1 guard-block health signal.
- [x] `project.iterations-24h` kept as watch-only so zero active iterations is
  allowed when no projects are active.
- [x] Metrics snapshot test covers the short guard-block health signal and
  watch-only project iteration metric.
- [x] Runtime check reached zero open metric alerts after recalibration.

Next validation:

- [ ] Web UI labels distinguish health, gauge, and watch-only metrics clearly.
- [ ] Alert reactor ignores retired metrics even if older breach events remain
  in the event log.
- [ ] A future real guard block opens a fresh `guard.blocked-count-15m` alert and
  closes after the window clears.

## Phase 9: Universal Control Surface Reliability

Status: partially implemented.

Problem: the socket is intended to be the universal interface for CLI, Web UI,
Telegram, tests, and manual operations, but host/container endpoint discovery is
still too clever. Manual triggering works best when the caller knows the daemon
socket path. Host-side socket lookup can find a stale or wrong candidate, which
adds failure modes instead of removing them.

Target invariant:

```
thin adapter -> control client -> daemon socket -> event bus
```

Minimum slice:

- [x] extract protocol/client/server into `packages/control`,
- [x] keep the server instance-scoped, not per-agent,
- [x] normalize non-control socket frames into daemon events,
- [x] ack daemon events before async dispatch,
- [x] Web UI steering sends daemon event frames through the control client,
- [x] CLI send uses the control client package,
- [ ] use the convention daemon socket path instead of scanning/ranking
  candidates,
- [ ] fail clearly when the convention socket cannot be connected,
- [ ] retry only as a recovery step, not as discovery,
- [ ] provide one small script or command for `emit event` so operators do not
  need ad hoc `docker exec bun -e ...`,
- [ ] verify `trigger.metrics-snapshot` can be emitted from the normal host
  command path and from inside the container,
- [ ] keep Telegram as a thin adapter over daemon events when it needs to steer
  sessions/projects. Do not split the process until socket reliability is solid.

Validation:

- [x] Unit tests for protocol ack, status, subscription filter, invalid frame handling.
- [x] Legacy unit tests cover the old daemon-vs-job ranking helper.
- [ ] Unit test for convention-path send success and connection failure.
- [ ] Integration/smoke test for `trigger.metrics-snapshot` through the normal
  control client.
- [ ] Web UI, Telegram, and CLI use the same control client package rather than
  custom socket logic.

## Recommended First Slice

Start with:

1. [x] Implement `sdk.query` with sessions/events/metrics/alerts helpers.
2. [x] Add bounded read-only tests.
3. [x] Add event-to-workflow handler helper.
4. [x] Convert one workflow bridge handler to the helper.
5. [x] Convert one deterministic handler read path from raw DB to `sdk.query`.
6. [x] Verify trace from a real event to workflow to session in the running instance.

This gives immediate value and keeps the change set small.

## Recommended Next Slice

Finish Phase 9a before adding more agent behavior. The loop is observable, but
manual and adapter-triggered events should use one obvious daemon socket path
instead of heuristic discovery.

Phase 9a should be intentionally small:

1. Add a convention-path helper in `packages/control/src/client.ts`, for example:
   `daemonSocketPath(persistDir, instance, interfaceAgent)`.
2. Make Web UI, CLI send, and operator commands use that path directly.
3. On connection failure, return a clear error and trigger/log recovery. Do not
   scan for another socket.
4. Keep one bounded retry after recovery when the caller is an operator command.
   UI requests can fail fast with a visible error.
5. Add a tiny operator command for `emit event`, backed by the same control
   client.
6. Smoke-test `trigger.metrics-snapshot` from the host path and from inside the
   container.

After Phase 9a, use the control surface to validate later slices quickly:

- Phase 8 UI labels for health/gauge/watch-only metrics,
- alert reactor behavior for retired metrics,
- a real guard trigger opening and clearing `guard.blocked-count-15m`,
- Telegram reply/project-comment steering through the same event path.

## Non-Goals

- Do not remove `getDb()` immediately.
- Do not migrate every handler at once.
- Do not build a large socket query API.
- Do not add many new metrics before guard/handler basics are visible.
- Do not make workflows a second agent runtime.
- Do not add adapter-specific event paths when the control client can send the
  same event to the daemon.
