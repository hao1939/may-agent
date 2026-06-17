# Handler Surface Audit

**Status**: first audit slice.

This audit applies the infra surface model:

```
timer/event/manual trigger -> handler -> workflow/code -> sessions/functions/metrics -> evidence
```

Handlers are bridges. They may do deterministic preflight and mechanical state
projection, but judgment and repair work should live in workflows.

## Ownership Model

A handler is owned by the `cron.json` entry that registers it:

- `agents/<agent>/cron.json` owns global agent handlers in
  `agents/<agent>/handlers/`.
- `projects/<project>/agents/<agent>/cron.json` owns project-local handlers in
  `projects/<project>/agents/<agent>/handlers/`.

This keeps project-specific automation inside the project boundary while shared
infra behavior remains owned by a global agent such as May.

## Classification

| Handler | Owner scope today | Current role | Surface | Keep direct DB? | Next move |
|---|---|---|---|---:|---|
| Workflow-backed handler config | Owner of the trigger entry | Generic timer/event to workflow bridge | `handler: { workflow, agent, task }` via `createWorkflowHandler` | no | Default for simple workflow dispatch. |
| `run-workflow` | Retired | Legacy named bridge for old configs | n/a | no | Removed from active handlers; use workflow-backed handler objects. |
| `session-aftermath-scan` | Evaluator entry in May cron | Fallback scan for unevaluated sessions | `sdk.query` + `runWorkflow` | no | Keep; it is already a bounded workflow dispatcher. |
| `metrics-snapshot` | May/global | Deterministic metric projection | `getDb` + metrics service | yes | Keep direct; it is measurement, not judgment. |
| `coaching-consumer` | May/global if enabled | File-based coaching queue projection | filesystem | yes | Keep direct until the coaching queue is replaced by metrics/events. |
| `project` | May/global | Project scanner, state mutator, workflow launcher | direct FS/cache projection + `sdk.query` + `runWorkflow` + durable trace events | temporarily | Keep global because it reconciles all projects; project-specific automation should move to project-local handlers. |
| `project-steward` | May/global | Read-only project health discovery | direct FS + project health events | no | Keep global; it observes all projects and emits evidence. |
| `project-creative-audit` | May/global | Proposal-only semantic fallback for project issues | `runWorkflow` with project context | no | Keep global; it proposes findings, owner review applies changes. |
| `metric-alert-reactor` | May/global | Alert owner resolution, dedup, triage dispatch | `sdk.query` + `runWorkflow` + durable trace events | no | Keep; preflight reads and triage workflow context are query-backed. |
| `closed-loop-steward` | May/global | Loop audit and retriage | `sdk.query` + `runWorkflow` + durable trace events | no | Keep; live context collection is query-backed and dispatch is workflow-backed. |
| `eval-llm-scan` | Evaluator entry in May cron | Deep evaluator candidate selection and artifact validation | direct DB + `runWorkflow` + durable trace events | temporarily | Candidate/artifact bookkeeping is deterministic handler work; evaluator LLM work is workflow-backed. Convert candidate reads to `sdk.query` later. |
| `session-eval` | Retired | Retired legacy evaluator dispatch | n/a | no | Removed. Use `evaluator-aftermath` event path plus `session-aftermath-scan` fallback. |
| `session-recovery` | May/global | Terminal error/interruption recovery bridge | digest/classifier preflight + `runWorkflow` | no | Keep as runtime-level recovery, event-first on `session.completed` recoverable outcomes. |
| `escalation` | May/global | Escalation routing | canonical escalation events + durable trace events | no | Keep direct while it only routes explicit escalations. |
| `db-retention` | May/global | Daily data retention cleanup: prune events (7d), sessions (14d), snapshots (30d); VACUUM after large deletes | direct DB | yes | Keep direct; deterministic cleanup with no judgment. |
| `feedback-echo-sync` | May/global | Sync evaluator feedback into `agents/<name>/last-eval.md` files | direct DB read + FS write | yes | Keep direct; inline handler replaced a flaky subprocess spawn (bun:sqlite race). |
| `metric-auto-handlers` | May/global | Declarative auto-remediation for known metric breaches (e.g., kill stale sessions) | direct DB + metrics service | yes | Keep direct; called by metric-alert-reactor before LLM triage dispatch. Registry-based, not judgment. |

## Rules

- New simple event-to-workflow bridges should use `handler: { workflow, agent,
  task }` in the trigger entry. Use a TypeScript handler only for pure
  projection, cleanup, lifecycle plumbing, dedup, or dynamic workflow choice.
- Judgment handlers may read small deterministic facts, then dispatch a workflow
  with the trigger event and preflight evidence.
- Event subscribers read domain fields from `event.data`. The framework should
  not promote fields such as `sessionId` onto subscriber-specific shortcuts.
- Direct `getDb()` is acceptable for metric projection, DB cleanup, and schema-aware
  infra repair. It is a compatibility escape hatch elsewhere.
- `sdk.query` is the default read surface for handler preflight.
- Handler output should leave traceable evidence: event id/type, workflow run id,
  owner, project id when available, and skip reason when no work is dispatched.

## Priority

1. `metric-alert-reactor`: high leverage, already mostly a workflow bridge.
2. `closed-loop-steward`: important for closing loops, but should avoid becoming
   a second agent runtime inside a handler.
3. `project`: valuable, but split carefully because it owns file mutations and
   project launch throttling.
4. `eval-llm-scan`: bounded and useful now; migrate reads after alert/project
   paths are cleaner.

## Migration Gates

Do not disable an enabled operational handler just because a newer observer or
project-app path exists. Disable only after the replacement path has all four
parts:

1. **Replacement signal** — the event, metric, packet, or schedule that will
   notice the same condition.
2. **Owner** — the app or agent that receives the signal and judges it.
3. **Closure path** — how the owner records fixed, accepted, escalated, or
   ignored-with-evidence.
4. **Proof** — static integrity check, unit test, replay test, or live
   verification artifact showing the replacement catches the old incident.

| Handler | Replacement candidate | Gate before disabling | Current decision |
|---|---|---|---|
| `daily-alert-review` | `may-agent.app` `daily-ops-digest` schedule plus `ops-health-review` packets | Replacement signal: `project.ops_digest.tick`; owner: `may-agent.app` owner May; closure path: report, notification, `project.ops_digest.created`, and `project.owner.requested` when open/noisy/missing-owner conditions need judgment; proof: `workflows/daily-ops-digest.test.ts` seeds open/noisy alerts and verifies report, notification, and owner wake. | Disabled in `agents/may/cron.json`. The report path moved from `outputs/YYYY-MM-DD-alert-review.md` to `.state/daily-ops-digests/YYYY-MM-DD-alert-review.md` because digest output is runtime state, not committed project knowledge. |
| `closed-loop-steward` | `ops-health-review` signals plus metric owner routing through `metric-alert-reactor`/project owner events | Replays cover stale P1 alert, unresolved escalation, failed message delivery, and recovered alert validation without losing `metric.alert_judged` closure. | Keep enabled. The observer reduces silent drift but does not replace alert-closure judgment yet. |
| `project-creative-audit` | Project owner planning plus `project-steward` structural findings | Replay shows unknown semantic project issues become owner-visible proposals without the global fallback, including stale/misleading task-tree decomposition cases. | Keep enabled. It is proposal-only and still covers unknown unknowns. |
| `coaching-consumer` | `evaluation.app` feedback events or metrics owned by evaluator/coach | Evaluation app owns coaching queue production, coach receives durable feedback signals, and at least one replay verifies low-quality pattern feedback reaches the coach without file polling. | Keep enabled. Ownership target is evaluation/coach, but replacement is not built. |
| `feedback-echo-sync` | Evaluation app or runtime feedback writer that updates agent feedback files from evaluation events | Event-driven feedback update is implemented and replayed; stale feedback cleanup still works; no subprocess/SQLite race reappears. | Keep enabled. It is deterministic, cheap, and fixes a prior flaky subprocess path. |

Migration work should update this table first, then change `agents/may/cron.json`
only in the same patch that adds proof. If proof is missing, the handler stays
enabled and the missing proof becomes a task.

## Validation

- Existing helper coverage: workflow-backed handler config uses
  `createWorkflowHandler`, which emits `handler.skipped` and
  `handler.workflow_dispatched`.
- Helper ownership: `createWorkflowHandler` lives in `@may-agent/sdk`; runtime
  and shared code import the SDK helper instead of maintaining duplicate
  implementations.
- Event payload contract: event-triggered handlers receive the canonical event
  envelope directly; event-specific fields live under `event.data`.
- Existing query-surface coverage: `session-aftermath-scan` uses `sdk.query`.
- First alert-reactor traceability slice: `metric-alert-reactor` records
  `handler.skipped` and `handler.workflow_dispatched` evidence.
- Project traceability slice: `project` records `handler.skipped`,
  `handler.failed`, and `handler.workflow_dispatched` evidence for nudge/launch
  paths.
- Closed-loop steward traceability slice: `closed-loop-steward` records
  `handler.skipped`, `handler.failed`, and `handler.workflow_dispatched`
  evidence, and May audit work now runs inside the `closed-loop-steward`
  workflow.
- Query facade first slice: `metric-alert-triage` uses
  `query.metricAlertContext(...)` and `query.sessions(...)` for alert context
  instead of opening SQLite directly in workflow code.
- Query facade reactor slice: `metric-alert-reactor` uses
  `query.metricAlertReactorState(...)` for schema-sensitive preflight reads
  instead of opening SQLite directly in handler code.
- Query facade project slice: `project` uses `query.alerts(...)` and
  `query.workflowRuns(...)` for runtime context reads; direct DB remains only
  for project cache projection.
- Query facade steward slice: `closed-loop-steward` uses
  `query.closedLoopStewardContext(...)` plus `query.sessions(...)` for bounded
  live evidence instead of opening SQLite directly in handler code.
- Eval LLM scan traceability slice: `eval-llm-scan` records
  `handler.workflow_dispatched`/`handler.failed` evidence and routes evaluator
  LLM work through `evaluator-deep-eval`.
- Session recovery bridge slice: `session-recovery` should be event-first on
  `session.completed` terminal error/interrupted outcomes, record
  skipped/workflow-dispatched evidence, and avoid opening recovery agent
  sessions directly from the handler.
- Escalation routing slice: blocked/failure session finishes promote to
  `escalation.created` and routing records skipped/routed evidence.
- Full test suite must stay green after each handler migration.
