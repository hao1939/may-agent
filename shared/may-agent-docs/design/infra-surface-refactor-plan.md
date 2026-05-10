# Infra Surface Refactor Plan

**Status**: Reviewed plan. Next executable slice is Phase 1a.

This plan pushes [infra-surface.md](infra-surface.md) from accepted direction to
boring runtime behavior. It is not a rewrite plan. Each slice should remove one
source of boundary confusion and leave visible evidence that the system is
easier to operate.

Target shape:

```
adapter/timer -> daemon event -> handler -> workflow -> sessions/functions -> events/metrics
```

Infra provides primitives. Agents build patterns. Metrics are signals, not
judges.

## Working Rules

- Prefer convention over discovery or per-adapter special cases.
- Make writes/control flow through events; keep dashboard reads pragmatic.
- Do one boundary at a time and validate it with a real event.
- Keep `getDb()` for mechanical infra code; move judgment/context code toward
  `query` and deterministic loaders.
- Do not split processes until the in-process boundary is clean.
- Do not add new terms when an existing surface can carry the behavior.

## Phase 1: Convention-Path Control Surface

Goal: every adapter and operator command can send a daemon event through one
obvious socket path.

Why first: without a reliable control path, every later metric, alert, workflow,
and UI validation requires ad hoc commands.

### Phase 1a: Helper And Operator Command

Scope:

- Add a convention helper:
  `daemonSocketPath(persistDir, instance, interfaceAgent)`.
- Add a tiny operator command for `emit event`.
- On connection failure, return a clear error and emit/log recovery evidence.
- Allow one bounded retry after recovery for operator commands.

Validation:

- Unit test convention path construction.
- Unit test send success and connection failure.
- Host smoke: emit `trigger.metrics-snapshot`.
- Container smoke: emit `trigger.metrics-snapshot`.

Stop criteria:

- An operator can trigger metrics snapshot without ad hoc `docker exec bun -e`.

### Phase 1b: Adapter Caller Migration

Scope:

- Make Web UI steering use the convention path directly.
- Make CLI send use the convention path directly.
- UI requests fail fast with a visible error when the convention socket cannot
  connect.
- Keep legacy socket ranking only as compatibility code until callers are
  migrated; do not use it as the normal path.

Validation:

- Web UI steering request returns a transport ack or clear failure.
- CLI send returns a transport ack or clear failure.

Stop criteria:

- No caller in Web UI or CLI uses socket scanning/ranking for normal daemon
  control.

## Phase 2: Adapter Event Normalization

Goal: CLI, Web UI, Telegram, and timers all submit the same kind of daemon
events instead of embedding behavior locally.

Scope:

- Keep socket-local commands limited to `subscribe` and `status`.
- Normalize adapter actions into event frames:
  - `input`
  - `project.comment.created`
  - `session.cancel.requested`
  - `trigger.<handler-name>`
  - `telegram.reply.received` only if raw Telegram context is needed before it
    becomes `input` or `project.comment.created`.
- Refactor Telegram reply handling so reply enrichment produces a daemon event,
  then shared command/project handlers perform the action.
- Keep Telegram in the daemon process for now. The goal is a thin adapter, not a
  new process boundary.
- Keep the existing Telegram reply path available behind a feature flag or
  fallback until the event-normalized path passes project-reply and
  session-reply smoke tests.

Validation:

- Reply-to-project notification appends a project comment and triggers the same
  project resume path as Web UI comments.
- Reply-to-session notification reaches the intended session or emits a clear
  routing failure event.
- Telegram, Web UI, and CLI leave comparable event traces for comparable
  actions.

Stop criteria:

- No adapter directly decides how to run a project, resume a session, or mutate
  internal tables when a daemon event can express the action.

## Phase 3: Handler-To-Workflow Boundary

Goal: handlers are bridges. Judgment and repair live in workflows.

Reference: [handler-surface-audit.md](handler-surface-audit.md).

First migration: `metric-alert-reactor`. It is the most self-contained
judgment/action bridge and its loop trace value is immediately visible.

Scope:

- Keep direct handlers for mechanical work:
  - metric snapshot collection,
  - projection updates,
  - cleanup/recovery bookkeeping,
  - reload/restart/shutdown,
  - simple skip/dedup checks.
- Convert judgment/action handlers toward event-to-workflow bridges:
  - `metric-alert-reactor`,
  - `closed-loop-steward`,
  - project resume/nudge paths,
  - `eval-llm-scan` candidate review path when it needs LLM judgment.
- Prefer `createWorkflowHandler` for new handler bridges.
- Avoid raw `sdk.runAgent(...)` in handlers unless the handler is itself the
  compatibility bridge being retired.
- As handlers migrate, preserve or add shared execution-result mapping and trace
  vocabulary at the touched call sites. Do not leave that as a later retrofit.

Validation:

- Each migrated handler records skip reason or workflow run id.
- Loop trace shows: event -> handler -> workflow -> session/evidence.
- Execution-result view can show the migrated workflow/session status.
- Existing handler tests stay green.

Stop criteria:

- Alert triage and project nudge paths are workflow-backed and traceable.
- Closed-loop steward no longer acts like a second agent runtime inside a
  handler.

## Phase 4: Query Facade Migration

Goal: workflows and handlers stop guessing schema for judgment/context reads.

Scope:

- Use `ctx.query.*` / `sdk.query.*` for bounded reads in judgment code.
- Keep direct SQL in mechanical measurement/projection code.
- Convert high-pain direct SQL first:
  - `metric-alert-triage` alert context loading,
  - heartbeat live-context loaders where schema drift has caused failures,
  - closed-loop/project/evaluator context collection after their workflow
    boundaries are clear.
- Add query helpers only when an actual workflow needs them.

Validation:

- Read-only and limit enforcement tests cover any new query helper.
- A migrated workflow can be run against a test DB without raw column guessing.
- Runtime failure from a missing/renamed column becomes a query-service test gap,
  not a prompt-level agent mistake.

Stop criteria:

- New judgment/action code does not call `getDb()` directly.
- `getDb()` remains in mechanical infra code and explicit compatibility paths.

## Phase 5: Resume Diagnostics And Recovery Symmetry

Goal: `resumeSession` and `resumeWorkflow` share one diagnostic mental model.
Execution-result shape and basic trace vocabulary should already be improved as
handlers are migrated in Phase 3.

Scope:

- Make resume APIs diagnostic first:
  - already terminal,
  - resumed,
  - requeued,
  - missing state,
  - unsafe replay,
  - blocked by guard.
- Preserve original session/workflow lineage.
- Emit recovery/resume failure events with owner/fallback context.
- Surface whether the next action is resume, requeue, recover mechanically, or
  escalate.

Validation:

- Resume failure emits queryable events with reason and owner/fallback.
- UI/API can show where to inspect the resumed or failed trace.

Stop criteria:

- Operators do not need to know whether a work unit was a raw session or a
  workflow to inspect status, owner, result, and failure path.

## Phase 6: Guard Signal Convergence

Goal: guard triggers are learning signals first, interventions second.

Scope:

- Keep workflow guard `guard.triggered` emission as the reference shape.
- Make tool-level guards emit comparable guard events where practical.
- Preserve hard blocking only for high-confidence, high-impact risks.
- Track warning/block/recovery patterns through metrics and evaluator review.

Validation:

- Tool-level guard trigger can be traced to a session and owner.
- Guard warning does not surprise-block normal work.
- A real guard trigger opens/closes the expected guard metric window.

Stop criteria:

- Agents and operators can inspect guard triggers as system weakness signals,
  not just session interruptions.

## Phase 7: Workflow Library Consolidation

Goal: reduce duplicated orchestration patterns after the boundaries are stable.

Start condition: begin only after Phase 3 stop criteria are met and at least two
judgment handlers are workflow-backed with runtime loop-trace evidence.

Scope:

- Inventory overlapping workflows:
  - `master-worker*`,
  - `goal-driver`,
  - retry wrappers,
  - project driver/reviewer loops.
- Keep workflows that are actively used and have clear trace value.
- Retire or archive variants only after a replacement has runtime evidence.

Validation:

- No active cron/project references a retired workflow.
- Tests cover the surviving workflow pattern.
- Project/session traces are easier to read after consolidation.

Stop criteria:

- There is one default project-driving pattern unless a real project needs a
  different one.

## Cross-Cutting Validation

Each phase should leave one concrete runtime proof:

- a real event id,
- the handler or adapter that accepted it,
- workflow/session ids if work ran,
- metrics or alert changes if any,
- a clear failure/recovery signal if it failed.

Do not accept "code compiled" as enough for boundary refactors. The point is to
make the loop observable and operable.

## Non-Goals

- Do not rewrite the daemon.
- Do not turn the socket into a broad query API.
- Do not split Telegram into a separate process until event normalization is
  clean in-process.
- Do not migrate every `getDb()` call mechanically.
- Do not add more health metrics until existing metrics are actionable and owned.
- Do not consolidate workflow variants before real boundaries are stable.

## Remaining Review Questions

- Does any phase introduce a new concept where an existing event/workflow/query
  surface would do?
- Is Phase 1a small enough to finish and verify in one pass?
- What runtime proof should be required before marking each phase complete?
