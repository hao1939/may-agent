# Evaluation App

Independently audits completed May-agent sessions and Agent Apps. It identifies
evidence-backed risks and improvement opportunities, reports actionable findings
to responsible project owners, and notifies humans only when useful.

This is an Agent App: it organizes the evaluation process, task state,
workflow capabilities, and scoring criteria. The evaluator agent provides
adaptive judgment when an addressed request needs one bounded owner decision.
Every Agent App remains responsible for its own domain goal and remediation.
`evaluation.app` observes, judges, and reports; it does not become a second
planner or fixer for the target project.

## Process

```
session.end -> collect evidence -> evaluate -> report
project/app sample -> collect evidence -> evaluate -> report -> deliver
```

Three audit lanes, one bounded coverage observation, and one derived feedback
projection are implemented:

1. **Session aftermath** — exact event-driven evaluation of eligible completed
   sessions
2. **Deep eval** — explicit LLM-powered evaluation for selected sessions
3. **Project/app audit** — delta-gated, independent review of target progress,
   risks, waits, recovery behavior, and escalation quality
4. **Aftermath coverage observation** — an explicit trailing-three-hour count
   and metric sample; it observes coverage without creating a second audit path
5. **Agent feedback projection** — a generated, disposable view of the latest
   durable evaluation fact for the evaluated agent

Each path uses the same task resource model:

```text
event -> short-lived achieve task or standing maintain task
      -> deterministic workflow or resumable evaluator executor
      -> structured Task result
      -> Host updates or absorbs the task
```

Session and explicit deep evaluations use short-lived tasks so independent
events can run concurrently. Pipeline monitoring, owner review, and per-project
audits use standing tasks that converge and wait for the next event. Completed
short-lived tasks are removed from the live graph after their results are
absorbed.

Historical aftermath tasks are recovered through the same exact
`evaluation.session.requested` event and stable session-derived task id. A
recovery operation replays bounded batches; it never deletes evaluation or task
state, and an already evaluated session returns the normal `existing` result.

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
- `design/task-native-documentation-and-behavior-review.md` — proposed
  task-native extension for regular documentation and behavior review; not yet
  current behavior
- `reports/` — retained project-health summaries and facts

## Layout

- `app.ts` declares schedules, event-to-task routes, workflow capabilities,
  owner entry, actions, and bounded ingress adapters.
- `agents/evaluator/workflows/` contains the evaluator-owned workflow entrypoints.
- `agents/evaluator/` contains the evaluator worker identity and guidance.
- `criteria/` contains scoring criteria and versioned methodology.

## Commands

```sh
bun run check       # syntax, typecheck, formatting, and tests
bun run bundle      # build the app manifest and local workflows
```

The app manifest in `app.ts` owns schedules, event-to-task correlation,
workflow bindings, and bounded owner judgment. Deterministic collection,
publication, and projection stay in workflows. Open-ended owner reconciliation
and addressed free-form requests use the `codex-goal` executor with the same
Task result and event contract; changing executors does not change Task identity.
Session aftermath runs only for eligible `session.end` or explicit
`evaluation.session.requested` events that carry a concrete `sessionId`;
new evaluator-owned metric breaches and recoveries wake the stable owner-review
task directly. Repeated updates for an already-open breach remain durable metric
facts but do not spend another owner reconciliation; the daily owner heartbeat
still reviews the standing frontier.

### Canonical session aftermath

One bounded evaluator call judges exactly one session. Eligible `session.end`
and manual requests carry `sessionId` through canonical task input. The
workflow itself receives no SQL, global runtime path, prompt-packet, or
task-store capability.

The evaluator returns one validated `evaluation`, `skip`, or `existing` result.
The workflow emits `evaluation.recorded`; the runtime atomically
persists that fact and its `evaluations` read-model projection. Owner findings
use `project.owner.requested`, and only concrete human decisions use
`evaluation.human_decision.requested` through the May App.

The canonical cutover replaces the old two-stage heuristic plus review
override. Historical false-good events and calibration documents remain
evidence, but new automatic evaluations have one final bounded judgment.
`evaluation.recorded` is the write path for the durable Evaluation fact and its
database projection; App code never writes that table directly. A session's
append-only `session.eval.jsonl` remains valid supporting evidence for summaries
and human/evaluator notes, but it is not another work queue or evaluation
projection. The former private learning-candidate log is not part of the
current Evaluation workflow.

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
