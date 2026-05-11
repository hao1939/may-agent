# Handler Surface Audit

**Status**: first audit slice.

This audit applies the infra surface model:

```
event/timer -> handler -> workflow -> sessions/functions/metrics -> evidence
```

Handlers are bridges. They may do deterministic preflight and mechanical state
projection, but judgment and repair work should live in workflows.

## Classification

| Handler | Current role | Surface | Keep direct DB? | Next move |
|---|---|---|---:|---|
| `run-workflow` | Generic timer/event to workflow bridge | `createWorkflowHandler` | no | Keep as default bridge. |
| `session-aftermath-scan` | Fallback scan for unevaluated sessions | `sdk.query` + `runWorkflow` | no | Keep; it is already a bounded workflow dispatcher. |
| `metrics-snapshot` | Deterministic metric projection | `getDb` + metrics service | yes | Keep direct; it is measurement, not judgment. |
| `coaching-consumer` | File-based coaching queue projection | filesystem | yes | Keep direct until the coaching queue is replaced by metrics/events. |
| `project` | Project scanner, state mutator, workflow launcher | direct FS/DB + `runWorkflow` + durable trace events | temporarily | Split later: scanner/projection stays direct; project launch path now records skip/failure/workflow dispatch evidence. |
| `metric-alert-reactor` | Alert owner resolution, dedup, triage dispatch | direct DB + `runWorkflow` + durable trace events | temporarily | Convert preflight reads to `sdk.query`; dispatch already records skip reason or triage workflow run id. Triage workflow alert context is now query-backed. |
| `closed-loop-steward` | Loop audit and retriage | direct DB + `runWorkflow` + durable trace events | temporarily | Context collection still needs `sdk.query`/function cleanup; dispatch is workflow-backed. |
| `eval-llm-scan` | Deep evaluator candidate selection and artifact validation | direct DB + `runWorkflow` + durable trace events | temporarily | Candidate/artifact bookkeeping is deterministic handler work; evaluator LLM work is now workflow-backed. Convert candidate reads to `sdk.query` later. |
| `session-eval` | Retired legacy evaluator dispatch | n/a | no | Removed. Use `evaluator-aftermath` event path plus `session-aftermath-scan` fallback. |
| `session-recovery` | Failed-session recovery bridge | digest/classifier preflight + `runWorkflow` | no | Keep as event-first bridge for `session.failed`; recovery action now runs inside the `session-recovery` workflow. |
| `escalation` | Session escalation routing | digest helpers + escalate + durable trace events | no | Keep direct while it only routes explicit escalations; it is event-first on `session.escalated`. |

## Rules

- New handlers should use `createWorkflowHandler` unless they are pure projection,
  cleanup, or lifecycle plumbing.
- Judgment handlers may read small deterministic facts, then dispatch a workflow
  with the trigger event and preflight evidence.
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

## Validation

- Existing helper coverage: `run-workflow` uses `createWorkflowHandler`, which
  now emits `handler.skipped` and `handler.workflow_dispatched`.
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
- Eval LLM scan traceability slice: `eval-llm-scan` records
  `handler.workflow_dispatched`/`handler.failed` evidence and routes evaluator
  LLM work through `evaluator-deep-eval`.
- Session recovery bridge slice: `session-recovery` is event-first again on
  `session.failed`, records skipped/workflow-dispatched evidence, and no longer
  opens recovery agent sessions directly from the handler.
- Escalation routing slice: `escalation` is event-first again on
  `session.escalated` and records skipped/routed evidence.
- Full test suite must stay green after each handler migration.
