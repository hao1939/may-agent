# Work Graph V2 Slice 2 Review — Revision-safe lifecycle

Status: implemented in source and fixture-tested; not yet runtime-reloaded

## Result

Task lifecycle correlation is now:

```text
task id + task revision + attempt id
```

Legacy work without a stored revision reads as compatibility revision `0`.
Existing active/review tasks therefore drain without a tree rewrite. New SDK
assignments include `taskRevision`; assignment outbox parsing also accepts old
rows as revision `0`.

For revisions greater than zero:

- dispatch may require an expected revision;
- the worker refuses a stale assignment before starting;
- completion requires matching revision and attempt;
- the reviewer refuses a stale completion before invoking the reviewer model;
- reviewed events and reviewer-ledger replay retain the revision;
- the planner refuses stale reviewed events before applying any decision;
- SDK completion, review rejection, and review acceptance enforce correlation;
- watchdog completion recovery and reviewer-decision dedupe are revision-aware;
- a late completion from an older revision is audit-only.

The default worker, single-spec verifier, feature-reference collector,
feature-compact planner, and watchdog recovery all carry the same revision.

## Intent revision rules

The SDK exposes a canonical intent fingerprint over:

- goal and workflow;
- inputs, outputs, acceptance, and forbidden clauses;
- dependencies and conflict scope;
- semantic legacy blocker/Condition contract.

Changing an intent field increments the revision. A retry of unchanged intent
gets a new attempt id but retains its revision. Metadata-only edits do not
change the fingerprint.

Polling fields are deliberately excluded: moving `next_check_at`,
`fallback_at`, observer metadata, or last-observed facts does not revise work
intent. Changing the named condition, owner, wait identity, resume rule, or
fallback action does.

## Problems resolved

| Previous failure                                                       | Mechanical prevention now                                                  |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Late completion closes changed task meaning                            | Worker, SDK, reviewer, and planner compare revision before mutation.       |
| Stored reviewer decision is replayed after task intent changes         | Reviewer-run lookup key includes task id, revision, and attempt.           |
| Watchdog re-emits a completion already reviewed under another revision | Watchdog decision key and emitted completion include revision.             |
| Archived task id is recreated and consumes an old result               | Old attempt/revision correlation fails against the recreated current task. |
| Retry accidentally looks like new intent                               | Retry changes attempt, not revision.                                       |
| Polling refresh invalidates work repeatedly                            | Observation-window fields are excluded from the intent fingerprint.        |

## Remaining boundaries

Slice 2 does not make all task mutation atomic or authoritative:

- planner/controller code still has direct tree mutations that do not pass
  through one command boundary;
- current multi-phase tasks still reuse one revision/contract in some paths;
- Conditions are still blocker projections rather than a registry;
- review application may still create a successor and close the source in
  separate writes;
- existing live revision-`0` work is compatible but cannot distinguish an
  intent change that happened historically before revisions existed.

These are the reasons Slice 3 must introduce commands before multi-phase and
Condition cutovers.

## Verification

Passing suites:

```text
SDK project-task-tree:                 41 tests
worker + reviewer + planner:          148 tests
watchdog:                              53 tests
task-tree tools:                       84 tests
verifier/reference/compact paths:     134 tests
ProjectSnapshot V2:                     7 tests
```

Targeted bundling of the app entrypoint and all changed lifecycle workflows
succeeded. TypeScript CLI checking remains unavailable in this checkout
because `tsc` is not installed; this is the same pre-existing environment
limitation recorded before Slice 2.

No live app reload or source-tree canary was performed, so the currently
running project continues on its loaded revision-`0` runtime until a planned
cutover window.
