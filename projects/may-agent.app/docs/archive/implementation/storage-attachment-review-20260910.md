# Atomic request attachment review — September 10, 2026

**Historical context:** [Runtime Storage](../../2a-design/storage.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Historical implementation evidence. The attachment and readiness
corrections merged in PRs #108 and #109. Candidate timings and test counts
below refer to their named source revisions, not a current deployment.
Use [Storage](../../2a-design/storage.md) for the contract and the
[storage proposal](../../proposals/storage-state-service.md) for open choices.

## First-slice implementation evidence

The candidate implements the selected slice, not the entire target layout:

- `core/state/requests.ts` owns Task-input admission and atomic request attachment.
  App mapping and runtime descriptor lookup stay outside it; execution wake-up
  and session interruption happen after commit.
- The Task store joins an outer transaction through SQLite savepoints. A failed
  Topic link rolls back Task admission and the request wait as well. Cached Task
  snapshots are invalidated while an outer transaction is still uncommitted.
- Task settlement, attention and cancellation persist linked request readiness
  through the existing fenced store commit. Pending input prevents old completion
  or attention state from being used as the new request's ready result.
- Event hints schedule already-ready requests too. The cross-App round-trip test
  caught the former assumption that only a newly changed readiness row needed
  scheduling; retaining it would delay the request until the next ready scan.
- The request schema is extracted, unchanged, to `lib/db/app-inbox-schema.ts`
  and shared by Host and standalone Task storage. There are no new schema fields,
  operation receipts, queues, timers, daemons or public events.

The caller no longer separately writes the wait, writes its Topic link, or runs
an asynchronous completion-before-link callback. Storage adds explicit request
claim/input checks and a small shared transaction helper; this is not merely a
forwarding facade. Child-request delegation and policy-driven dependency recovery
retain their existing behavior.

Regression coverage uses production operations with file-backed SQLite, separate
connections and child processes. It covers competing bindings, stale claims,
repetition and changed input, deliberate replacement, both completion orderings,
pending newer work, App-scoped wakes, wake-write rollback, Conversation claim
release, and actual `SIGKILL` before/after commit. No EventBus is present in the
cross-process settlement test.

At Host `54b9eecf`, `bun run ci` passed: 2,514 tests passed, 3 existing
installation-dependent skips, and no failures. The 16 new state-operation cases
are included in that count. The affected installed-App golden-trace fixture also
passed separately. `bun run check:may-design` passed with no errors and six
pre-existing workspace-layout warnings. Hosted checks and live deployment are
separate from these local results.

A local state-only comparison against Host `350552a4` used fresh WAL databases,
300 attachments per version and the final 250 timing samples. It excluded App
mapping, controller execution and notifications on both sides. The old sequence
measured 5.92 ms median / 8.71 ms p95; the candidate measured 4.48 ms / 6.36 ms.
Candidate settlement made 1,001 exact linked requests ready in 7.28 ms without
an event hint; the baseline left them waiting for its notification/recovery path.
These single-machine samples show no observed transaction penalty for this trial,
not a production speed guarantee or a bound for arbitrarily large fan-out.

Broader storage extraction, capacity coordination and a separate API server still
need a demonstrated problem and a fresh value/cost decision. No live installation
was changed by this candidate.

## Retry-exhaustion follow-up

The combined `569e4da0` review reproduced a gap: four recorded execution
failures retain input and stop the Task in attention, but the request-wake
predicate rejects every pending trigger. A missed event then requires the
fallback dependency scan even though the failure committed successfully.

Host [PR #109](https://github.com/hao1939/may-agent/pull/109), merged as `4afaaafb`
(reviewed candidate `aab337de`), shares one attention
predicate between attachment and settlement, reusing the existing exhaustion
check. It readies linked requests for an owner decision without authorizing
more work. Eligible new input still waits for fresh execution. No table,
event, timer, public API or new work lifecycle is introduced.

Regression cases cover exhaustion in a separate process without EventBus or
an executable parent, App-scoped wakes, retained input across reopen, attachment
after exhaustion, explicit retry/revision, and rollback when the wake cannot
commit. The same candidate restores the missing `openDatabase` import in the
merged retry-concurrency test. Local `bun run ci` passed 2,560 tests with three
existing installation-dependent skips and no failures; the 27-case focused
state/concurrency run also passed. The workspace design check passed with six
existing layout warnings. GitHub Quality and Container also passed on `aab337de`.
The existing parent-owner route now has a separate
[runtime proof](../../proposals/task-controller-pattern.md#existing-parent-owner-proof);
broader owner-decision follow-through and live deployment remain separate work.
