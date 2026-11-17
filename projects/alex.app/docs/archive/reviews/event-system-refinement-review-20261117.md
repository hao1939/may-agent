# Review: event-system refinement — 2026-11-17

**Disposition:** good simplification direction; implement small vertical slices,
not the proposal as one rewrite. This review does not approve every retirement
or new contract in the proposal. The first implementation assignment is limited
to daemon-heartbeat storage and its existing liveness/diagnostic consumers.

Reviewed proposal: [event-system-refinement-20261117.md](event-system-refinement-20261117.md),
SHA-256 `df5000474e48d899ba64d8f2d5029c955ee6f93fc407d8168bf8c0ab10e2d992`.
Host source: `8a795c12d9c9cdcec6a55601dacd5d96ff817d1f`.
The original proposal is preserved unchanged; its live-database figures were
not independently recounted during this source review.

## Findings to resolve before the broader migration

### 1. Direct invocation must not remove durable admission and replay

Commands need not use pub/sub internally, but an immediate API receipt is not
proof of completed work. `src/app/core/events/interface.ts` currently owns
receipt replay, trusted ingress provenance, exact Task addressing and control
fences; `src/lib/db-writer.ts` and the saved App admission plan retain replay and
partial-delivery state. Replacing these paths must preserve lost-ack retries,
accepted replay before generation checks, input/result/caller correlation,
stale-command rejection and restart recovery. Do not remove pending/route
columns merely because the new API is synchronous. State mutation and any
required resulting fact/return need an explicit atomic or recoverable boundary.

### 2. “Legacy” and “internal” are not proofs that a type is dead

`chat.start.requested` and session cancellation types still have registered
public validation in `core/events/interface.ts`; the control client still
produces chat starts. `app.task.cancelled`, `app.task.reopened` and
`app.task.attempt.stopped` have real consumers in the inbox runtime and Task-wake
projection. Inventory producers, current external uses, retained replay and
replacements before retiring each type. Cancellation/reopening can also be
meaningful facts even if the command that caused them becomes a direct call.
Past-tense naming alone should not decide durability or become a generic Host
allowlist that prevents App-defined facts.

### 3. Execution tables do not yet make their producing events redundant

`DbWriter.handler` currently materializes session state and result artifacts
from session lifecycle events. Stop those writes only after the actual owning
persistence path replaces them, including failure/restart cases. Do not move
Host SQLite ownership into the generic SDK or require a standalone SDK manager
to open an installation database. Similarly, verify equivalent workflow/usage
coverage before deleting telemetry. A claim that another table exists is not
proof it contains the same evidence.

### 4. Heartbeat removal must preserve two existing consumers

`src/app/daemon-loops.ts` writes an initial heartbeat and repeats every **60
seconds**, not 30. `modes/maintenance.ts` uses retained heartbeat freshness when
the status socket fails; the control guide and
`test/e2e/event-observation-contract.test.ts` also use its compact cumulative SQL
counters. A new latest-value record must not let a stale/different process or
instance protect an unhealthy daemon, and a failed write must not fabricate
freshness or kill useful work. Preserve useful typed SQL diagnostics and explain
where the compact sample now lives. Do not quietly drop a consumer while
claiming the event was noise.

### 5. Keep delivery meaning and current API shapes explicit

One event can have several consumers, partial admission, a declared observation
or no currently interested listener. An aggregate `matched/unmatched/failed`
label cannot replace their replay/commit guarantees without a precise rule.
Unmatched audit facts are not automatically an operational failure. Current
Task Conditions use the published type/subject/expected contract; the proposed
`kind: "event"`/filter examples and the new local-key envelope are design choices,
not already installed API behavior. App schedule conversions belong to their
owning Apps; they should not require named-App privileges in generic Host code.

### 6. Correct the evidence summary before using it as a benefit claim

The four listed timer counts total **15,963 / 23,280 = 68.57%**, not 66.3%.
The listed telemetry counts total **4,371 = 18.78%**, not 21.6%. If other rows
explain the latter percentage, list them. Bind any operational count to its
capture time, database scope, source revision and query; do not describe the
quoted snapshot as a current census or treat fewer event rows alone as measured
latency/cost improvement. The claimed observation allowlist also differs from
current source.

## First finite implementation: heartbeat/liveness only

Target **the standalone `may-agent` Host repository**, using its existing Alex
implementation owner and `develop-change`, not a new App or scheduler.

Deliver one reviewed, committed source change and an unmerged PR that:

- Stops periodic daemon-heartbeat samples accumulating in the domain-event
  journal, without deleting old rows or changing unrelated event behavior.
- Uses one bounded, instance/process-aware liveness authority, with startup,
  stale/missing/corrupt state, failed-write recovery and socket-failure behavior
  covered. Reuse existing timing/lifecycle machinery; no new recurring service.
- Preserves active-work grace, failure thresholds and restart cooldown. Keeps
  useful SQL diagnostics and documents the replacement compact sample/read path.
- Updates the actual daemon, maintenance and process/e2e contract tests. Tests
  must exercise shipped behavior in temporary roots, including a regression that
  fails on the base, not only a copied parser or printed assertion.
- Retains exact candidate/test/review evidence. Host CI must pass on the current
  PR head before readiness; a missing local prerequisite is a recorded gap, not
  permission to skip or weaken acceptance.

Other timers, Scout/App schedules, input/control migration, session ownership,
general event classification and delivery-state redesign are **not** bundled.
No merge, production rollout, database mutation or restart is authorized by this
assignment. Later slices need their own finite acceptance and consumer inventory.

## Observation boundary

Watch native admission, target checkout, specialist/verification evidence, owner
reconciliation and actual PR/check/feedback state. A helper's convergence is not
whole-Task delivery. If the Task system obstructs this assignment, retain the
exact friction and use the owning correction/return path on the same Task;
do not replace its identity, restart an exhausted allowance or quietly build a
parallel work system. Task-system polish should follow observed friction, not
become another implementation outcome hidden inside this one.
