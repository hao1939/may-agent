# Evaluation App

Independently audits completed May-agent sessions and project apps. It identifies
evidence-backed risks and improvement opportunities, reports actionable findings
to responsible project owners, and notifies humans only when useful.

This is a project-app: it owns the evaluation process and scoring criteria.
The evaluator agent is a worker identity dispatched by this app.
Every project app remains responsible for its own domain goal and remediation.
`evaluation.app` observes, judges, and reports; it does not become a second
planner or fixer for the target project.

## Process

```
session.end -> collect evidence -> evaluate -> report
project/app sample -> collect evidence -> evaluate -> report -> deliver
```

Four implemented lanes:
1. **Session aftermath** — event-driven evaluation of completed sessions, plus
   one bounded backfill candidate every seven minutes
2. **Pipeline monitor** — deterministic five-minute health checks that wake the
   evaluator owner only when anomaly state changes
3. **Deep eval** — explicit LLM-powered evaluation for selected sessions
4. **Project/app audit** — delta-gated, independent review of target progress,
   risks, waits, recovery behavior, and escalation quality

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

- `app.ts` declares schedules, event routes, actions, and app-owned adapter
  behavior.
- `workflows/` contains the app workflow entrypoints.
- `agents/evaluator/` contains the evaluator worker identity and guidance.
- `criteria/` contains scoring criteria and versioned methodology.

## Commands

```sh
bun run check       # syntax, typecheck, and formatting
bun run bundle      # build the app manifest and local workflows
```

The v3 app manifest in `app.ts` owns schedules and event-to-handler routing.
Session aftermath runs only for `session.end`, bounded backfill, or explicit
`evaluation.session.requested` events that carry a concrete `sessionId`;
the five-minute pipeline schedule runs deterministic checks and emits an owner
review tick only when the anomaly family changes or recovers.

Project/app auditing is separate from session aftermath. It reads target app
state, metrics, events, loop progress, and output evidence, then produces a
report for the target owner and, when needed, a human. It does not decide target
domain truth or mutate the target. The target app owns its domain work,
self-recovery, and goal progress; `evaluation.app` audits whether that process
is trustworthy.

Target apps are sampled every two hours, but unchanged scheduled samples do not
invoke an LLM or write a report. A daily baseline review still runs when no
meaningful state delta appears. Use the `review-project-app` action for an
immediate manual review. Reports retain the latest 30 review/facts pairs per
target. Owner feedback is emitted only for a new concern family, increased
severity, or a newly actionable human decision.
