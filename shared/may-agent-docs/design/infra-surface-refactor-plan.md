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

Finish the query facade migration for evaluator paths that still depend on raw
schema-sensitive reads:

1. Review `agents/evaluator/workflows/evaluator-aftermath.ts` and related
   session-review context collection.
2. Move only judgment-feeding reads to targeted `ctx.query` helpers.
3. Leave deterministic artifact ingestion/bookkeeping direct when a helper would
   not reduce schema risk or complexity.

This is the best next slice because it directly mitigates schema-footgun
failures without adding a new concept.

## Remaining Gap Summary

| Gap | Risk | Phase |
|---|---|---|
| Evaluator aftermath/session review may still use raw DB for judgment context | Evaluator can inherit brittle schema guessing | Phase 4 |
| Shared `ExecutionResult` exists but is not the normal inspection surface | Sessions and workflows still feel different to debug | Phase 5 |
| Workflow guard signals are durable, but tool guard signals are not fully converged | Guard triggers are harder to learn from across the system | Phase 6 |
| Telegram still has some adapter-specific behavior | Replies can diverge from Web UI/CLI event behavior | Phase 2 |

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
- [ ] Host smoke: emit `trigger.metrics-snapshot`.
- [x] Container smoke: emit `trigger.metrics-snapshot`.

Host caveat: in the current containerized runtime, the host-visible Unix socket
connects outside the sandbox but does not return a daemon response. The
container-local convention path works. Treat host-to-container socket access as
an environment/ops follow-up, not a reason to add socket scanning.

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
- [x] Keep legacy socket ranking only as compatibility code until callers are
  migrated; do not use it as the normal path.
- [x] Remove the misleading CLI claim that failed socket sends are still tracked
  in the DB.

Validation:

- [x] Web UI steering request returns a transport ack or clear failure.
- [x] CLI send returns a transport ack or clear failure.

Stop criteria:

- [x] No caller in Web UI or CLI uses socket scanning/ranking for normal daemon
  control.

## Phase 2: Adapter Event Normalization

Status: first slice shipped for project comments and session cancel.

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
- Refactor remaining Telegram reply handling so reply enrichment produces a daemon event,
  then shared command/project handlers perform the action.
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
- [ ] Human Telegram e2e smoke confirms a real reply reaches the intended
  session or emits a clear routing failure event.
- [ ] Telegram, Web UI, and CLI leave comparable event traces for comparable
  actions.

Stop criteria:

- No adapter directly decides how to run a project, resume a session, or mutate
  internal tables when a daemon event can express the action.

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

Status: metric alert workflow, alert reactor preflight, project runtime context,
closed-loop steward context, heartbeat context, and evaluator deep-eval scan
dispatch reads migrated.

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
- [ ] Review evaluator-aftermath/session review context reads for any remaining
  schema-sensitive judgment context.

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

Status: first slice implemented and verified for `eval-llm-scan`.

Scope:

- [x] Review `agents/may/handlers/eval-llm-scan.ts`.
- [x] Keep deterministic artifact ingestion and bookkeeping direct because it
  validates files and writes `evaluations`.
- [x] Move candidate/context reads that feed evaluator judgment to `sdk.query`.
- [x] Add a query helper only for the exact candidate/context bundle needed.

Validation:

- [x] Unit tests cover candidate selection and bounded reads.
- [x] Manual evaluator scan trigger leaves handler evidence, evaluator workflow run
  id, child evaluator session id, and either artifact ingestion or an explicit
  skip/failure event.

Stop criteria:

- [x] `eval-llm-scan` judgment/action dispatch code does not call `getDb()`
  directly.
- `getDb()` remains in mechanical infra code and explicit compatibility paths.

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

## Phase 5: Execution Inspection And Recovery Symmetry

Goal: sessions and workflows share one diagnostic mental model. Operators should
not need separate inspection rules for raw sessions versus workflow-composed
work.

Scope:

- Use the existing `ExecutionResult` helpers in the query/API/UI path where
  operators inspect work.
- Show workflow runs and child sessions with the same status, summary, evidence,
  trace id, owner/project, and failure path fields.
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

- Pick a metric-alert triage workflow and show workflow + child session through
  the same result shape.
- Pick a failed/interrupted workflow and show the failure path through the same
  result shape.
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

Validation:

- A future real guard block opens a fresh `guard.blocked-count-15m` alert and
  closes after the window clears.
- Open metric alerts correspond to current actionable owner work or a documented
  accepted wait.
- Operators can tell from the UI which metrics are health, gauge, or watch-only.

Stop criteria:

- Agents do not spend attention on retired, stale, or non-actionable metric
  breaches.

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
