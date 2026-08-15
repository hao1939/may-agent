# Evaluation App

Independently audits completed May-agent sessions and Agent Apps. It identifies
evidence-backed risks and improvement opportunities, reports actionable findings
to responsible project owners, and notifies humans only when useful.

This is an Agent App: it organizes the evaluation process, task state,
workflow capabilities, and scoring criteria. The evaluator agent provides
adaptive judgment and is the app's accountable fallback for unfamiliar work.
Every Agent App remains responsible for its own domain goal and remediation.
`evaluation.app` observes, judges, and reports; it does not become a second
planner or fixer for the target project.

## Process

```
session.end -> collect evidence -> evaluate -> report
project/app sample -> collect evidence -> evaluate -> report -> deliver
```

Three audit lanes and one derived feedback projection are implemented:

1. **Session aftermath** — exact event-driven evaluation of completed sessions,
   plus one bounded backfill candidate every seven minutes
2. **Deep eval** — explicit LLM-powered evaluation for selected sessions
3. **Project/app audit** — delta-gated, independent review of target progress,
   risks, waits, recovery behavior, and escalation quality
4. **Agent feedback projection** — a generated, disposable view of the latest
   durable evaluation fact for the evaluated agent

All four lanes use the task reconciliation model:

```text
event -> short-lived achieve task or standing maintain task
      -> bound workflow, otherwise evaluator owner entry
      -> structured workflow result
      -> reconciler updates or absorbs the task
```

Session and explicit deep evaluations use short-lived tasks so independent
events can run concurrently. Pipeline monitoring, backfill, owner review, and
per-project audits use standing tasks that converge and wait for the next
event. Completed short-lived tasks are removed from the live graph after their
results are absorbed.

## Responsibility Boundary

- Findings about another project are reported to that project's owner and,
  when useful, to a human. The target project owns acceptance and remediation.
- Findings about `evaluation.app` are handled through its normal project
  self-maintenance, just as every project handles its own defects.
- A later audit may report that a concern persists or disappeared, but that
  observation does not transfer remediation ownership to `evaluation.app`.

The external finding lifecycle is:

```text
observe -> collect evidence -> evaluate -> report -> deliver -> optionally recheck
```

## Domain Knowledge

- `criteria/criteria.md` — current scoring criteria
- `criteria/scoring.md` — scoring methodology
- `criteria/versions/` — criteria version snapshots
- `design/project-app-evaluation.md` — project/app evaluation design
- `reports/` — retained project-health summaries and facts

## Layout

- `app.ts` declares schedules, event-to-task routes, workflow capabilities,
  owner entry, actions, and bounded ingress adapters.
- `agents/evaluator/workflows/` contains the evaluator-owned workflow entrypoints.
- `agents/evaluator/` contains the evaluator worker identity and guidance.
- `criteria/` contains scoring criteria and versioned methodology.

## Commands

```sh
bun run check       # syntax, typecheck, and formatting
bun run bundle      # build the app manifest and local workflows
```

## Shared-inbox canary

After deploying the matching May-agent runtime change, submit one isolated
probe and inspect its authoritative inbox result:

```sh
key="evaluation-canary-$(date +%s)"
curl -X POST http://localhost:8080/api/projects/evaluation/actions/app-inbox-canary \
  -H 'content-type: application/json' \
  -d "{\"input\":{\"prompt\":\"Return a concise canary result.\"},\"idempotencyKey\":\"$key\"}"
curl "http://localhost:8080/api/app-inbox?appId=evaluation-canary&idempotencyKey=$key"
```

The item should move `pending -> handling -> done` and retain its owner session
and structured result. Reusing the key must not create or run a second item.

Then pass the completed item id to the manual capability-scoped workflow:

```sh
curl -X POST http://localhost:8080/api/projects/evaluation/actions/app-runtime-canary \
  -H 'content-type: application/json' \
  -d '{"input":{"itemId":"app_..."}}'
```

This workflow imports only `@may-agent/sdk/app`. It reads the bounded App
result projection and emits an observation; it has no database, queue, task
store, or global-path capability.

The app manifest in `app.ts` owns schedules, event-to-task correlation,
workflow bindings, and owner fallback.
Session aftermath runs only for `session.end`, bounded backfill, or explicit
`evaluation.session.requested` events that carry a concrete `sessionId`;
evaluator-owned metric facts wake the stable owner-review task directly.

### Canonical session aftermath

One bounded evaluator call selects and judges at most one session. Exact
`session.end` and manual requests carry `sessionId` through canonical task input;
the standing backfill call selects one uncovered terminal session through the
read-only `query_db` tool. The workflow itself receives no SQL, global runtime
path, prompt-packet, or task-store capability.

The evaluator returns one validated `evaluation`, `skip`, `existing`, or `none`
result. The workflow emits `evaluation.recorded`; the runtime atomically
persists that fact and its `evaluations` read-model projection. Owner findings
use `project.owner.requested`, and only concrete human decisions use
`evaluation.human_decision.requested` through the May App.

The canonical cutover deliberately replaces the old two-stage heuristic plus
review override. Historical false-good events and calibration documents remain
evidence, but new evaluations have one final bounded judgment. Host-owned
`session.eval.jsonl` trails, direct evaluation-table writes, and the private
learning-candidate JSONL store are retired. Structured evaluation facts,
owner requests, and human-decision requests are the durable evidence instead.

Project/app auditing is separate from session aftermath. It reads target app
state, metrics, events, loop progress, and output evidence, then produces a
report for the target owner and, when needed, a human. It does not decide target
domain truth or mutate the target. The target app owns its domain work,
self-recovery, and goal progress; `evaluation.app` audits whether that process
is trustworthy.

Target apps are sampled every two hours, but unchanged scheduled samples do not
invoke an LLM or write a report. A daily baseline review still runs when no
meaningful state delta appears. Use the `review-agent-app` action for an
immediate manual review. Reports retain the latest 30 review/facts pairs per
target. Owner feedback is emitted only for a new concern family, increased
severity, or a newly actionable human decision.
