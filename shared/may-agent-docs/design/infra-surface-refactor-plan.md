# Infra Surface Refactor Plan

**Status**: Canonical implementation tracker. This is the single go-forward
plan for the infra surface work. The older implementation tracker has been
folded into this file; the gap mitigation notes are incorporated here.

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

## Plan Boundaries

- [infra-surface.md](infra-surface.md) is the north-star design.
- This file is the implementation tracker and review plan.
- [infra-surface-implementation-plan.md](infra-surface-implementation-plan.md)
  is historical and should not be updated with new work.

Do not create another parallel infra-surface plan. If a new gap appears, add it
to this tracker under the smallest matching phase.

## Current Next Move

Phase 8 has removed the duplicate project-driver surface. Phase 1/2 control
and adapter boundaries have runtime proof. The next simplification is making
large composition/loading modules match the infra mental model.

Next slice:

1. Split the agent loader by responsibility without changing runtime behavior.
2. Thin `may.ts` into a composition root after the loader boundary is clear.
3. Continue using runtime event ids as proof for adapter/control boundary
   changes; do not accept adapter-local behavior without durable event evidence.

Recently completed:

1. [x] Validate the short-window guard metric semantics and UI alert state.
2. [x] Confirm alert handling ignores retired guard metrics and only reacts to the
   active short-window signal.
3. [x] Tighten Web UI labels so health, gauge, and watch-only metrics are obvious at
   a glance.
4. [x] Inventory active project workflow references and migrate resumable
   `master-worker` projects to the default `project` workflow.
5. [x] Close the event-bus subscriber failure observability gap with durable
   `subscriber.failed` events and the `infra.bus.subscriber-failed-count-1h`
   health metric.
6. [x] Remove the reserved-but-unimplemented `createLLMSession()` SDK method so
   handler authors only see executable SDK surface.
7. [x] Align `architecture.md`, `runtime.md`, and `heartbeat.md` with the
   current event -> handler/workflow -> session/function -> evidence model.
8. [x] Confirm real-human Telegram reply routing against live DB evidence.

This is now the highest-value slice because the event/metric/control boundaries
are traceable enough; the next risk is large mixed-responsibility runtime files
making the simple model hard to see and safely evolve.

## Remaining Gap Summary

| Gap | Risk | Phase |
|---|---|---|
| `agent-loader.ts` mixes discovery, validation, tool construction, cron ownership, heartbeat generation, handler hot-reload, and cleanup state | Hot-reload/reload semantics are hard to reason about and easy to regress | Phase 9 |
| `may.ts` mixes CLI modes, daemon assembly, reload handling, Web UI mode, workflow direct-run, and shutdown | The daemon composition root is hard to inspect and encourages cross-boundary edits | Phase 9 |

## Phase 0: Design State Refresh

Goal: make the design docs reflect the running system so agents do not chase
old gaps.

Scope:

- Update [infra-surface.md](infra-surface.md) so shipped work is described as
  current state, not future work.
- Keep detailed status in this tracker.
- Mark `sdk.query`, `packages/control`, convention-path operator emit,
  `createWorkflowHandler`, first handler bridge migrations, and shared
  `ExecutionResult` helpers with their true implementation state.

Validation:

- A reviewer can read `infra-surface.md` for the model and this file for work
  state without finding contradictory "next gaps."

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

Status: implemented for the daemon/container operator path.

Scope:

- [x] Add a convention helper:
  `daemonSocketPath(persistDir, instance, interfaceAgent)`.
- [x] Add a tiny operator command for `emit event`.
- [x] On connection failure, return a clear error and emit/log recovery evidence.
- [x] Allow one bounded retry after recovery for operator commands.
- [x] Treat `trigger.<entry-name>` as a cron runtime convention so any timer or
  event job can be manually fired through the daemon event path without
  per-entry trigger boilerplate.

Validation:

- [x] Unit test convention path construction.
- [x] Unit test send success and connection failure.
- [x] Unit test `trigger.<entry-name>` cron convention.
- [x] Host smoke: emit `trigger.metrics-snapshot`.
- [x] Container smoke: emit `trigger.metrics-snapshot`.

Host smoke, 2026-05-11: the container exposes the convention socket through the
mounted `.state` directory. A host-side emit through
`.state/instances/background/may.sock` persisted `trigger.metrics-snapshot`
event `559667`, then `metrics-snapshot` emitted `handler.started` `559668` and
`handler.completed` `559669`.

Stop criteria:

- [x] An operator can trigger metrics snapshot without ad hoc
  `docker exec bun -e`; use `may-agent --emit ...` in the daemon container.

### Phase 1b: Adapter Caller Migration

Status: implemented and verified in the container runtime.

Scope:

- [x] Make Web UI steering use the convention path directly.
- [x] Make CLI send use the convention path directly.
- [x] UI requests fail fast with a visible error when the convention socket cannot
  connect.
- [x] Let separated adapters target the daemon with `DAEMON_INSTANCE` /
  `DAEMON_AGENT`; Web UI runs as a dedicated `may-agent-web` binary and does
  not need a fake `INSTANCE=web` identity.
- [x] Remove legacy socket ranking/discovery after callers migrated; the control
  client now uses the convention path or fails clearly.
- [x] Remove the misleading CLI claim that failed socket sends are still tracked
  in the DB.

Validation:

- [x] Web UI steering request returns a transport ack or clear failure.
- [x] CLI send returns a transport ack or clear failure.

Stop criteria:

- [x] No caller in Web UI or CLI uses socket scanning/ranking for daemon
  control, and the old discovery helper is gone.

## Phase 2: Adapter Event Normalization

Status: automated normalization slices shipped for project comments, session
cancel, session replies, and Telegram slash commands.

Goal: CLI, Web UI, Telegram, and timers all submit the same kind of daemon
events instead of embedding behavior locally.

Scope:

- Keep socket-local commands limited to `subscribe` and `status`.
- Normalize adapter actions into event frames:
  - `input`
  - `project.comment.created` (shipped for Web UI and Telegram project replies)
  - `session.cancel.requested` (shipped for Web UI cancel and socket/operator events)
  - `trigger.<handler-name>`
  - `telegram.reply.received` only if raw Telegram context is needed before it
    becomes `input` or `project.comment.created`.
- [x] Refactor Web UI project comments so the adapter emits
  `project.comment.created`; the daemon appends `discussion.md` and emits
  `project.nudge`.
- [x] Refactor Telegram project replies so reply enrichment emits
  `project.comment.created` instead of writing `discussion.md` directly.
- [x] Refactor Telegram session replies with stored `session_id` so they emit
  `steer` for that session instead of falling through to generic chat input.
- [x] Refactor Web UI session cancel to emit `session.cancel.requested`.
- [x] Refactor Telegram `/cancel`, `/reload`, and `/close` so they emit daemon
  command events instead of generic text input. `/status` still uses the shared
  input command because there is no typed daemon status event yet.
- [x] Refactor remaining Telegram reply handling so reply enrichment produces a
  daemon event, then shared command/project handlers perform the action.
- [x] Persist selected adapter command/control events (`input`, `steer`,
  `cancel*`, `resume`, `reload`, `restart`, `shutdown`) so comparable adapter
  actions leave durable event traces, not only in-memory bus activity.
- Keep Telegram in the daemon process for now. The goal is a thin adapter, not a
  new process boundary.
- Keep the existing Telegram reply path available behind a feature flag or
  fallback until the event-normalized path passes project-reply and
  session-reply smoke tests.

Validation:

- [x] Reply-to-project path has shared daemon logic that appends a project
  comment and triggers the same
  project resume path as Web UI comments.
- [x] Reply-to-session notification emits a targeted `steer` event; unknown
  cold sessions surface `session.resume_failed` from the manager.
- [x] Automated Telegram e2e test covers stored session-context replies:
  Telegram reply -> `telegram.reply` evidence + targeted `steer`, with no
  generic `input` fallback.
- [x] Automated Telegram e2e test covers slash commands:
  `/cancel` -> `session.cancel.requested`, `/reload` -> `reload`,
  `/close` -> `shutdown`, with no generic `input` fallback.
- [x] Human Telegram e2e smoke confirms a real reply reaches the intended
  session or emits a clear routing failure event.
- [x] Telegram, Web UI, and CLI leave comparable event traces for comparable
  actions.

Stop criteria:

- No adapter directly decides how to run a project, resume a session, or mutate
  internal tables when a daemon event can express the action.

Runtime proof, 2026-05-11:

- Reloaded the running `may-agent` container with durable command-event tracing.
- Operator/CLI emit through the convention daemon socket persisted:
  - `reload` event `559251`, source `codex-phase2-runtime-proof`,
  - `steer` event `559252`, source `codex-phase2-runtime-proof`, session
    `phase2-smoke-no-such`,
  - `cancel_all` event `559254`, source `codex-phase2-runtime-proof`.
- The invalid `steer` produced the shared recovery evidence:
  `session.resume_failed` event `559253`, owner `may`, category
  `session_not_found`, `recoverable: false`, `nextAction: escalate`.
- Automated Telegram e2e proves the Telegram adapter emits the same event
  shapes for stored session replies and slash commands before those events hit
  the daemon router.
- Real Telegram reply smoke, 2026-05-11: `bun scripts/telegram-reply-smoke.ts
  --hours 24` found three live replies that routed to the intended session:
  `telegram.reply` events `554729`, `554715`, and `554618` all targeted
  `s_1778440180314_1` and were followed by matching `session.start` actions
  `554730`, `554716`, and `554619`. The same scan also surfaced one older
  reply, `554582`, with no matching follow-up in the 10s correlation window;
  keep the smoke script available for future regression checks.

## Failure Signal Slice

Status: implemented for event-bus subscriber exceptions.

Goal: core infra failure modes should become queryable signals, not only log
lines.

Scope:

- [x] When a first-priority or normal event-bus subscriber throws, continue
  delivering the original event to other subscribers.
- [x] Emit a durable `subscriber.failed` event after the original dispatch
  finishes, with original event type, subscriber priority, owner `may`, and
  error message.
- [x] Avoid recursive failure storms when a subscriber also fails while handling
  `subscriber.failed`.
- [x] Add a P1 health metric:
  `infra.bus.subscriber-failed-count-1h`.

Validation:

- [x] Event bus tests prove subscriber exceptions do not stop later
  subscribers and do produce `subscriber.failed`.
- [x] Metrics snapshot tests prove `subscriber.failed` events feed the health
  metric.

Runtime proof:

- Deployed to the running `may-agent` container and triggered
  `trigger.metrics-snapshot` event `559395`, source
  `codex-failure-signal-proof`.
- Metrics snapshot completed as handler event `559397`.
- `/api/metrics` returned active metric
  `infra.bus.subscriber-failed-count-1h`, owner `may`, type `health`,
  priority `P1`, `current=0`, `threshold=0`, `alertOpen=false`.
- The exception path is covered by the event-bus unit test rather than a live
  synthetic failure, to avoid creating a fake P1 health alert in the running
  system.

## Phase 3: Handler-To-Workflow Boundary

Status: traceability slice shipped for `metric-alert-reactor`, `project`,
`closed-loop-steward`, `eval-llm-scan`, `session-recovery`, `escalation`, and
the generic workflow handler.

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
- [x] `sdk.runWorkflow` returns `workflowRunId` as `result.runId`.
- [x] `createWorkflowHandler` emits `handler.workflow_dispatched` and
  `handler.skipped` evidence.
- [x] `metric-alert-reactor` emits durable `handler.skipped` reasons and
  `handler.workflow_dispatched` with the triage workflow run id/status.
- [x] `project` emits durable `handler.skipped`, `handler.failed`, and
  `handler.workflow_dispatched` evidence for project nudge/launch paths.
- [x] `closed-loop-steward` dispatches a steward workflow instead of opening a
  May session directly, and records skip/failure/workflow dispatch evidence.
- [x] `eval-llm-scan` dispatches evaluator LLM work through
  `evaluator-deep-eval`; artifact ingestion remains deterministic handler
  bookkeeping.
- [x] `session-recovery` subscribes to `session.failed` again and dispatches
  recover/escalate actions through the `session-recovery` workflow; the handler
  keeps only digest/classifier preflight and attempt dedup.
- [x] `escalation` subscribes to `session.escalated` again; because it only
  routes explicit escalations, it remains direct but now records routed/skipped
  evidence.
- [x] Retire the stale `session-eval` handler file so agents do not copy the old
  direct `runAgent("evaluator", ...)` path.

Validation:

- [x] Each touched handler records skip reason or workflow run id.
- [x] Loop trace has workflow run ids from touched handler dispatch evidence.
- Execution-result view can show the migrated workflow/session status.
- [x] Existing handler tests stay green.

Stop criteria:

- [x] Alert triage and project nudge paths are workflow-backed and traceable.
- [x] Closed-loop steward no longer acts like a second agent runtime inside a
  handler.
- [x] Eval LLM scan no longer opens evaluator sessions directly from the
  handler.
- [x] Session recovery no longer opens recovery agent sessions directly from
  the handler.
- [x] Escalation routing no longer relies on a stale timer-only cron entry.

## Phase 4: Query Facade Migration

Status: main schema-sensitive judgment/context paths migrated. Keep direct SQL
for mechanical measurement, projection, artifact ingestion, and bookkeeping.

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
- [x] Add `query.metricAlertContext(...)` for the exact alert/metric/snapshot
  bundle used by `metric-alert-triage`.
- [x] Move `metric-alert-triage` alert context loading off raw `ctx.getDb()`;
  owner session lookup now uses `ctx.query.sessions(...)`.
- [x] Add `query.metricAlertReactorState(...)` for the exact alert/metric/
  judgment/snapshot/session bundle used by `metric-alert-reactor`.
- [x] Move `metric-alert-reactor` preflight reads off raw `ctx.sdk.getDb()`;
  timer fallback now uses `query.alerts(...)` plus the reactor state helper.
- [x] Add `query.workflowRuns(...)` and move the `project` handler's runtime
  context reads to `query.alerts(...)` / `query.workflowRuns(...)`; its direct
  DB write remains cache projection.
- [x] Add `query.closedLoopStewardContext(...)` for the exact schema brief,
  open alert, delivery failure, judgment, snapshot, triage-run, and recent
  steward-run bundle used by `closed-loop-steward`.
- [x] Move `closed-loop-steward` live context reads off raw
  `ctx.sdk.getDb()`; owner activity now uses `query.sessions(...)`.
- [x] Add `query.heartbeatContext(...)` for the exact metric/snapshot/alert/
  inbox bundle used by shared heartbeats.
- [x] Move heartbeat live-context loaders away from raw schema-sensitive SQL.
- [x] Add `query.evaluatorDeepEvalScan(...)` for the exact active-work and
  candidate-selection bundle used by `eval-llm-scan`.
- [x] Move `eval-llm-scan` active-work and candidate-selection reads away from
  raw `ctx.sdk.getDb()`; artifact ingestion/recording remains direct
  deterministic bookkeeping.
- [x] Add `query.evaluatorAftermathContext(...)` for the exact session/prior
  evaluation bundle used by `evaluator-aftermath`.
- [x] Move `evaluator-aftermath` session/evaluation judgment-context load away
  from raw `ctx.getDb()`; evaluation writes and review-override bookkeeping
  remain direct deterministic DB work.

Validation:

- [x] Read-only and limit enforcement tests cover any new query helper.
- [x] A migrated workflow can be run against a test DB without raw column guessing.
- Runtime failure from a missing/renamed column becomes a query-service test gap,
  not a prompt-level agent mistake.

### Phase 4a: Heartbeat Query Slice

Status: implemented and verified in the running daemon.

Scope:

- Review `agents/shared/workflows/heartbeat-data.ts`.
- Classify each direct `ctx.getDb()` read:
  - mechanical/history measurement,
  - live context for agent judgment,
  - compatibility escape hatch.
- Add only the query helpers needed for live heartbeat context.
- Move schema-sensitive judgment/context reads to `ctx.query`.
- Keep direct DB only where the workflow is doing mechanical local projection
  or where a helper would not reduce complexity.

Validation:

- [x] Unit tests cover each new query helper.
- [x] Missing/renamed DB columns fail in query-service tests, not in live heartbeat
  prompts.
- [x] Manual heartbeat trigger records:
  - trigger event id,
  - workflow run id,
  - child session id,
  - whether heartbeat context came from query helpers.

Stop criteria:

- [x] New heartbeat context reads do not require agents to guess SQLite schema.
- [x] A heartbeat can be inspected through the normal loop trace.

Runtime proof, 2026-05-11:

- Trigger event: `trigger.heartbeat` event id `558344`, source
  `codex-runtime-proof`.
- Workflow run: `wr_1778479461744_iwqi` (`may-heartbeat`).
- Child session: `s_1778479461886_0` (`may`).
- Context trace: `context.read` event id `558346` includes
  `contextSource: "query.heartbeatContext"` with metrics/projects/inbox/alerts
  sections loaded.
- Additional scheduled heartbeats after reload emitted the same
  `contextSource` trace for evaluator/dev/arc, showing the shared heartbeat path
  is active beyond the manual trigger.

### Phase 4b: Evaluator Query Slice

Status: implemented and verified for `eval-llm-scan` and
`evaluator-aftermath`.

Scope:

- [x] Review `agents/may/handlers/eval-llm-scan.ts`.
- [x] Keep deterministic artifact ingestion and bookkeeping direct because it
  validates files and writes `evaluations`.
- [x] Move candidate/context reads that feed evaluator judgment to `sdk.query`.
- [x] Add a query helper only for the exact candidate/context bundle needed.
- [x] Move `evaluator-aftermath` session/evaluation context loading to
  `ctx.query`.

Validation:

- [x] Unit tests cover candidate selection and bounded reads.
- [x] Manual evaluator scan trigger leaves handler evidence, evaluator workflow run
  id, child evaluator session id, and either artifact ingestion or an explicit
  skip/failure event.
- [x] Manual evaluator-aftermath trigger leaves a context trace that identifies
  the query helper used.

Stop criteria:

- [x] `eval-llm-scan` judgment/action dispatch code does not call `getDb()`
  directly.
- [x] `evaluator-aftermath` session/evaluation context load does not call
  `getDb()` directly.
- [x] `getDb()` remains in mechanical infra code and explicit compatibility
  paths.

Runtime proof, 2026-05-11:

- First trigger event: `trigger.eval-llm-scan` event id `558427`, source
  `codex-runtime-proof`; result event `evaluation.deep_recorded` id `558429`
  recorded one pending artifact.
- Second trigger event: `trigger.eval-llm-scan` event id `558431`, source
  `codex-runtime-proof`; result event `evaluation.deep_dispatched` id `558433`
  selected session `s_1778406965778_854` for agent `dev`.
- Workflow run: `wr_1778479946845_mnr0` (`evaluator-deep-eval`), started from
  the migrated query-selected candidate path.
- Child session: `s_1778479946904_0` (`evaluator`), source
  `workflow:evaluator-deep-eval`.
- Follow-up note: the code now includes `contextSource:
  "query.evaluatorDeepEvalScan"` on future `evaluation.deep_dispatched` events;
  this was added after the runtime proof without reloading over the active
  evaluator session.
- Aftermath trigger event: `session.completed` event id `558480`, source
  `codex-runtime-proof`, for session `s_1778479478854_4`.
- Aftermath workflow run: `wr_1778480313996_wjvs` (`evaluator-aftermath`),
  status `done`, summary `Skipped aftermath for s_1778479478854_4:
  terminal_zero_op_session.`
- Context trace: `context.read` event id `558482` includes `contextSource:
  "query.evaluatorAftermathContext"` with session/evaluation sections loaded.
- Outcome event: `evaluation.skipped` id `558483`, reason
  `terminal_zero_op_session`.

## Phase 5: Execution Inspection And Recovery Symmetry

Status: first API slice shipped for loop-trace executions.

Goal: sessions and workflows share one diagnostic mental model. Operators should
not need separate inspection rules for raw sessions versus workflow-composed
work.

Scope:

- Use the existing `ExecutionResult` helpers in the query/API/UI path where
  operators inspect work.
- Show workflow runs and child sessions with the same status, summary, evidence,
  trace id, owner/project, and failure path fields.
- [x] Make loop-trace `executions` use the shared `ExecutionResult` mappers for
  session rows, workflow rows, and resume/failover events.
- [x] Add owner to the shared `ExecutionResult` shape so sessions and failover
  diagnostics expose the same ownership field as loop trace.
- [x] Expose loop trace from the normal session inspector:
  - session detail has a trace action by session id,
  - workflow run metadata opens trace by workflow run id,
  - workflow executions inside loop trace can be inspected recursively.
- Make resume APIs diagnostic first:
  - [x] already terminal,
  - resumed,
  - requeued,
  - [x] missing/recoverable workflow state,
  - unsafe replay,
  - blocked by guard.
- Preserve original session/workflow lineage.
- [x] Emit recovery/resume failure events with owner/fallback context.
- [x] Surface whether the next action is resume, requeue, recover mechanically, or
  escalate.

Validation:

- [x] Pick a workflow and show workflow + child session through
  the same result shape.
- [x] Pick a failed/interrupted session resume event and show the failure path through the same
  result shape.
- [x] Open loop trace from both a workflow id and one of its child session ids.
- [x] Resume failure emits queryable events with reason and owner/fallback.
- [x] UI/API can show where to inspect the resumed or failed trace.

Stop criteria:

- Operators do not need to know whether a work unit was a raw session or a
  workflow to inspect status, owner, result, and failure path.

Runtime proof, 2026-05-11:

- Loop-trace API for workflow `wr_1778479946845_mnr0` returned `executions`
  with one workflow result and one child session result:
  - workflow execution `wr_1778479946845_mnr0`, kind `workflow`, status `done`,
    trace id `wr_1778479946845_mnr0`, summary `Deep evaluator session completed
    in s_1778479946904_0.`
  - session execution `s_1778479946904_0`, kind `session`, status `done`, owner
    `evaluator`, same trace id `wr_1778479946845_mnr0`.
- Loop-trace API for failover event `554581` returned one failure execution:
  session `phase2-smoke-no-such`, status `error`, owner `may`, summary `Session
  "phase2-smoke-no-such" not found`, evidence category `session_not_found` and
  `recoverable: false`.

Runtime proof, 2026-05-11:

- Web UI was reloaded with the session inspector trace affordance deployed in
  the running container.
- Loop-trace API for session `s_1778479946904_0` returned target kind
  `session`, owner `evaluator`, one workflow, one session, and two shared
  executions.
- Loop-trace API for workflow `wr_1778479946845_mnr0` returned target kind
  `workflow` with the same workflow execution and child evaluator session
  execution.

Runtime proof, 2026-05-11:

- Deployed code was smoke-tested through the daemon socket and Web UI API.
- Emitted `workflow.resume_skipped` event `558669`; loop trace returned owner
  `may`, project `infra-surface-refactor`, execution
  `wr_phase5_resume_skip_smoke`, status `done`, next action `none`.
- Emitted `workflow.resume_failed` event `558670`; loop trace returned owner
  `may`, project `infra-surface-refactor`, execution
  `wr_phase5_resume_failed_smoke`, status `interrupted`, recoverable `true`,
  next action `recover`.

## Phase 6: Guard Signal Convergence

Goal: guard triggers are learning signals first, interventions second.

Scope:

- Keep workflow guard `guard.triggered` emission as the reference shape.
- [x] Make tool-level guards emit comparable guard events where practical.
- Preserve hard blocking only for high-confidence, high-impact risks.
- Track warning/block/recovery patterns through metrics and evaluator review.

Validation:

- [x] Tool-level guard trigger can be traced to a session and owner.
- [x] Guard warning does not surprise-block normal work.
- [x] Short-window guard metric semantics are verified: isolated blocks do not
  alert, while two consecutive snapshots above the calibrated threshold open the
  alert and a clean snapshot resolves it.

Stop criteria:

- Agents and operators can inspect guard triggers as system weakness signals,
  not just session interruptions.

Runtime proof, 2026-05-11:

- Added a manager-level bridge from before-tool guard results to durable
  `guard.triggered` events with source `tool`, owner, session id, workflow id,
  project id, demand type, action, reason, and tool event type.
- Emitted tool guard smoke event `558720` for session `s_1778479946904_0`.
  Loop trace returned owner `evaluator`, one linked workflow, one linked
  session, and exactly one deduplicated guard signal with source `tool`,
  demand type `warn`, action `warned`, and event type `tool.finish`.
- Unit test `MetricService > opens health alerts only after the configured
  consecutive failures` verifies the active guard health calibration:
  `threshold=2`, `alert_op=">"`, `count=2`. A count of `2` is not an alert;
  two consecutive snapshots at `3` open a `metric.breach`, and a later `0`
  recovers it.

## Phase 7: Metrics And Alert Hygiene

Goal: metrics stay useful as signals and do not become stale work generators.

Scope:

- Keep active health alerts tied to recent actionable owner work.
- Keep watch-only metrics visible without causing false health failures.
- Retire or recalibrate historical metric ids whose thresholds no longer match
  current operating reality.
- Make Web UI labels distinguish health, gauge, and watch-only metrics clearly.
- Ensure alert reactor ignores retired metrics even if old breach events remain
  in the event log.

Already shipped first slice:

- [x] `guard.blocked-count-15m` is the active short-window guard-block signal.
- [x] Long-window guard block metrics were retired.
- [x] `project.iterations-24h` is watch-only rather than an autonomous health
  target.
- [x] Metrics snapshot tests cover the short guard-block signal and watch-only
  project iteration metric.
- [x] Web UI separates watch signals from health/gauge alerts.
- [x] Metric alert reactor skips retired/missing metric rows before dispatching
  triage work.
- [x] 24h guard trigger/warning volume metrics are P3 watch signals; the short
  `guard.blocked-count-15m` metric remains the actionable health signal.

Validation:

- [x] The metrics API reports durable open alerts from `metric_alerts` rather
  than recomputing raw threshold crossings, so health/consecutive metrics match
  the handler lifecycle.
- [x] Retired metric breach events do not dispatch alert triage work.
- [x] Open metric alerts correspond to current actionable owner work or a documented
  accepted wait.
- [x] Operators can tell from the UI which metrics are health, gauge, or
  watch-only.

Stop criteria:

- Agents do not spend attention on retired, stale, or non-actionable metric
  breaches.

Runtime proof, 2026-05-11:

- Web UI was reloaded with metric surface labels. Deployed static file contains
  `metricSurfaceBadge`, a `Watch` overview card, and `No health/gauge alerts`
  wording so watch-only signals do not appear as health failures.
- `/api/metrics` on the running instance returned 43 active metrics, 6 watch
  metrics, and separated hard alert count from watch alert count.
- Emitted stale `metric.breach` for retired metric `guard.blocked-count-24h`.
  Runtime emitted `handler.skipped` event `558801` with reason
  `Ignoring guard.blocked-count-24h: metric is missing or retired.`
- Reconciled metrics with `trigger.metrics-snapshot`. Running `/api/metrics`
  then showed `guard.triggered-count-24h` and `guard.warned-count-24h` as
  priority `P3` watch metrics. Hard alerts were only
  `session.finish-blocked-uncommitted-count-24h` and
  `session.failed-triage-rate-3h`; guard trigger/warn crossings moved to
  `watchAlerts`.
- Reloaded `may-agent-web` with `/api/metrics` using durable open alerts. Runtime
  check returned the same four open alerts as `/api/liveness`: P3 guard
  trigger/warn watch signals, evaluator-owned
  `session.failed-triage-rate-3h`, and dev-owned
  `session.finish-blocked-uncommitted-count-24h`.
- The same runtime check showed `guard.blocked-count-15m` at `current=2`,
  `threshold=2`, `alertOpen=false`, matching the calibrated health semantics
  instead of creating a phantom UI alert.
- Recent event evidence:
  - `handler.skipped` events `558929` and `558930` defer P3 guard watch alerts
    to metric context.
  - `metric.alert_judged` event `558917` records dev's
    `waiting_with_evidence` judgment for alert `287`.
  - `metric.alert_judged` event `558822` records evaluator's
    `upgrade_or_escalate` judgment for alert `289`.

## Phase 8: Workflow Library Consolidation

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

Status: complete for live project drivers. `project` is the only live default;
`goal-driver` and `master-worker*` are retired from disk, and scanned shared
projects reject `master-worker*` metadata.

First slice, 2026-05-11:

- Runtime inventory found the main project-driver overlap is `project`,
  `goal-driver`, and the `master-worker*` family.
- `REGISTRY.md` now lists the wired runtime workflows instead of implying only
  three shared workflows are active.
- `project` is already the handler default. The project template and scanner
  fallback now also default to `workflow: project`.
- Project format validation now flags non-terminal projects that select
  `master-worker*`, while allowing closed historical projects to keep old
  metadata.
- The two non-terminal shared projects that still selected `master-worker`
  (`closed-loop-reliability`, `proof-of-life-dashboard`) were migrated to
  `workflow: project`. At this point, closed historical projects still retained
  old metadata; a later slice removed that live-tree exception.
- Validation:
  - grep found no non-terminal shared project still selecting `master-worker`.
  - `bun test agents/shared/tests/project-health-coverage.test.ts
    agents/shared/tests/project-health.test.ts`
  - `bun test agents/shared/tests/project-execute.test.ts
    agents/shared/tests/config-validator.test.ts
    agents/shared/lib/__tests__/config-validator.test.ts`

Second slice, 2026-05-11:

- Docs now mark `master-worker` as legacy compatibility rather than a shipped
  recommended project workflow:
  - `INDEX.md` labels `design/master-worker.md` as `Legacy`.
  - `design/master-worker.md` opens with the current convention: use `project`
    for new/resumable explicit projects unless a reviewer records a specific
    `master-worker` reason.
  - `manual/workflow-authoring.md` lists current reusable shared patterns
    (`project`, `metric-alert-triage`, `implement-and-verify`) instead of
    advertising `master-worker`.
  - `design/unified-events.md` describes `project.iteration` as default
    `project` output plus legacy compatibility shape.
- Test fixture for normal project scanning now uses `workflow: project` so tests
  do not keep teaching the legacy workflow as the normal active case.
- Validation:
  - `bun test agents/shared/tests/project-health-coverage.test.ts
    agents/shared/tests/project-health.test.ts`

Third slice, 2026-05-11:

- `scout-second-brain-learning` was the only active project reference to
  `goal-driver`; it is already waiting after the behavior-change push completed.
- Migrated that project to `workflow: project` and recorded the reason in the
  project journal section.
- `REGISTRY.md` temporarily marked `goal-driver` as an experimental
  compatibility workflow with no active project reference, pending archival
  review.
- Validation:
  - grep found no `workflow: goal-driver` under active shared projects.

Fourth slice, 2026-05-11:

- Removed `shared/workflows/goal-driver.ts` and its dedicated parser test from
  the live workflow surface.
- `REGISTRY.md` now records `goal-driver.ts` as deleted since the last audit,
  not as active/wired compatibility.
- Historical project journals still mention prior `goal-driver` runs, but there
  is no live workflow file or active project selection for agents to copy.

Fifth slice, 2026-05-11:

- Migrated every non-archived shared project that still declared
  `workflow: master-worker` to `workflow: project`, including closed/complete
  projects that could otherwise resume after a new comment.
- Tightened shared project format validation: `master-worker*` is now
  legacy/archived only for scanned shared projects, not a live-tree exception.
- `REGISTRY.md` and `design/master-worker.md` now state the simpler convention:
  resumable projects use `project`; `master-worker*` remains on disk only as
  compatibility/tested legacy code until its runtime files are separately
  retired.

Sixth slice, 2026-05-11:

- Updated active agent `creating-projects` skills that still taught the legacy
  bold-metadata template and `Workflow: master-worker`.
- The skill template now uses YAML frontmatter with `workflow: project`, matching
  `projects.md`, `project-template.ts`, and project format validation.
- The template now describes metrics/signals as judgment inputs, not automatic
  judges.

Seventh slice, 2026-05-11:

- Removed the retired `master-worker*` workflow family from disk and deleted the
  dedicated tests that only preserved that old project driver.
- Kept generic helper modules still used by the current `project` workflow and
  workflow-runner path, such as `project-cache`, `dispatch-validator`,
  `iteration-budget`, `iteration-timer`, and `complexity-estimator`.
- Renamed the surviving helper integration tests away from `master-worker`
  terminology.
- `REGISTRY.md` now records `master-worker*` as retired, not compatibility code.

## Phase 9: Runtime Composition And Loader Boundaries

Goal: make the code shape match the infra model without adding new runtime
concepts or process boundaries.

### Phase 9a: Agent Loader Boundary

Status: shipped as compatibility-facade split.

Current problem: `src/app/agent-loader.ts` is one large module that owns:

- agent directory discovery,
- `agent.json` parsing and validation,
- tool preset construction,
- local tool dynamic imports,
- per-agent cron instance ownership,
- auto-heartbeat generation,
- handler discovery and hot-reload wrappers,
- active-session cleanup maps.

Target mental model:

```
discover -> build definition -> register -> attach cron/handlers -> reload future definitions
```

Reload convention:

- `agent.json` changes require explicit reload and affect future sessions only.
- active sessions keep their started model/tools/prompt/runtime context.
- handler files hot-reload on each handler invocation.
- `cron.json` reload is owned by the cron runner and should preserve unchanged
  timers.
- local tools reload with the next explicit agent reload.
- workflows reload at workflow invocation/resume boundaries and preserve
  persisted workflow state instead of mutating a running step in place.

Target modules:

- [x] `src/app/loader/agent-discovery.ts`
- [x] `src/app/loader/agent-config.ts`
- [x] `src/app/loader/toolset-loader.ts`
- [x] `src/app/loader/heartbeat-loader.ts`
- [x] `src/app/loader/handler-loader.ts`
- [x] `src/app/loader/agent-registry-loader.ts`

Keep the public exports from `src/app/agent-loader.ts` as a compatibility
barrel during the split. Remove the barrel only after direct imports are
migrated.

Validation:

- Existing agent loader tests remain green.
- Add focused tests for reload semantics:
  - [x] invalid config emits `agent.config_invalid`,
  - reload updates future registrations without touching active session state,
  - [x] handler hot-reload imports a fresh module on invocation,
  - workflow invocation imports current workflow code while persisted workflow
    state remains resumable,
  - [x] auto-heartbeat generation remains deterministic.
- Runtime proof: trigger `reload` through daemon event and record the reload
  event plus loader evidence for added/updated/skipped agents.

Current proof:

- Root commits:
  - `fab1f59c` split config/discovery loaders.
  - `c3202f8d` split toolset construction.
  - `c70eb742` split heartbeat generation.
  - `a7b2ebe2` split handler hot-reload loading.
  - `e5c18e6e` split registry orchestration.
- `bun test test/agent-loader.test.ts test/query-db-tool.test.ts` passes.
- `bun run check` passes.

Stop criteria:

- `agent-loader.ts` is a small compatibility barrel or orchestration shim.
- Loader module responsibilities are obvious from file names.
- Hot-reload behavior is documented and tested in one place.

### Phase 9b: Thin Daemon Composition Root

Status: partially shipped.

Current problem: `src/app/may.ts` mixes unrelated modes and daemon wiring.

Target modules:

- [x] `src/app/modes/emit.ts`
- [x] `src/app/modes/web.ts`
- `src/app/modes/run-workflow.ts`
- `src/app/modes/oneshot.ts`
- `src/app/daemon.ts`

`may.ts` should parse arguments, select one mode, and delegate. It should not
own loader internals, Web UI startup details, workflow direct-run mechanics, or
shutdown cleanup beyond calling the selected mode.

Validation:

- `bun run check`.
- `bun test test/emit-mode.test.ts test/web-mode.test.ts`.
- Focused tests for command-router/socket/cron still pass.
- Runtime proof: daemon starts, host `trigger.metrics-snapshot` emit still
  persists trigger and handler completion events.

Current proof:

- Root commits:
  - `df4241c6` split operator emit mode.
  - `094f5723` split Web UI startup mode.
- `bun test test/emit-mode.test.ts test/web-mode.test.ts` passes.
- `bun run check` passes.

Stop criteria:

- The normal daemon path can be read from one file without scanning CLI-only
  branches.
- CLI/web/workflow modes can be changed without touching daemon assembly.

### Phase 9c: Storage Module Split

Status: planned after Phase 9a/9b.

Split `src/lib/requests.ts` into tight DB modules while preserving public
imports:

- `src/lib/db/connection.ts`
- `src/lib/db/schema.ts`
- `src/lib/db/events.ts`
- `src/lib/db/sessions.ts`

Keep `query-service.ts` as the safe read facade. Do not create a `packages/db`
package until DB modules have stable boundaries and no app-specific imports.

### Phase 9d: Telegram Reply Router Extraction

Status: planned after the composition root is thinner.

Keep Telegram in the daemon process, but extract reply classification into a
pure router module:

- input: Telegram message plus optional `notification_messages` row,
- output: event frame (`steer`, `project.comment.created`, `input`,
  command event, or routing failure evidence).

Validation:

- Existing Telegram reply e2e tests stay green.
- `scripts/telegram-reply-smoke.ts --hours 24` remains the live proof path.

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

## Review Checklist

- Does the next slice use an existing event, workflow, query, metric, or control
  surface instead of inventing a new concept?
- Is the slice small enough to verify with one real runtime event?
- Does it reduce schema guessing, adapter-specific behavior, or untraceable
  judgment?
- Does the runtime proof include event id, handler evidence, workflow/session
  id if work ran, and the resulting metric/judgment/failure signal?
