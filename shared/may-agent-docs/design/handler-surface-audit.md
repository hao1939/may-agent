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
| `project` | Project scanner, state mutator, workflow launcher | direct FS/DB + `runWorkflow` | temporarily | Split later: scanner/projection stays direct; project judgment should become workflow-backed. |
| `metric-alert-reactor` | Alert owner resolution, dedup, triage dispatch | direct DB + `runWorkflow` + durable trace events | temporarily | Convert preflight reads to `sdk.query`; dispatch already records skip reason or triage workflow run id. |
| `closed-loop-steward` | Loop audit and retriage | direct DB + `runWorkflow`/`runAgent` | temporarily | Convert context collection to functions/query; avoid raw `runAgent` after steward workflow exists. |
| `eval-llm-scan` | Deep evaluator candidate selection and artifact validation | direct DB + `runAgent` | temporarily | Convert candidate reads to `sdk.query`; consider a workflow wrapper for context collection and artifact validation. |
| `session-eval` | Legacy direct evaluator dispatch | direct session helpers + `runAgent` | no | Prefer `session-aftermath-scan`/`evaluator-aftermath`; retire or convert to workflow if still wired. |
| `session-recovery` | Failed-session recovery action | digest helpers + `runAgent` | no | Convert recovery decisions to workflow when recovery needs context beyond digest/classifier. |
| `escalation` | Session escalation routing | digest helpers + escalate | no | Keep direct while it only routes explicit escalations. |

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
- Full test suite must stay green after each handler migration.
