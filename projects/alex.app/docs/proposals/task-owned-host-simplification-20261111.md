# Task-owned Host simplification

Status: implemented and locally verified in companion source worktrees on 2026-11-11. No deployment, restart or live state conversion has been performed.

## Decision in plain language

Keep one owner for unfinished work: the Task. An attempt runs a workflow or agent,
then returns evidence and a result. If it crashes, confirm that its processes have
stopped and let the same Task retry under its normal policy. Old sessions and
workflow runs remain history; they cannot restart work themselves.

This reduces overlapping mechanisms without removing the durable promises that
Apps and people rely on. It does not introduce another operating mode.

| Change | Capability given up | Simpler replacement |
| --- | --- | --- |
| Remove configurable Host maintenance | Loading/reloading custom Host handlers, `cron.json` duties, and the cron editing tool | Fixed Host housekeeping; App schedules/observers for business duties |
| Remove workflow crash replay | Continuing a workflow by reusing historical step results | A fresh attempt on the same Task, using saved evidence to inspect previous effects |
| Support one current App contract | App `owner` alias, `tasks.subscriptions`/`tasks.resolve`, and the dedicated Conversation executor | Explicit `agent`, ordinary subscriptions to typed input, and common Task execution/results |
| Remove cold session resume | Resurrecting an ended session or reusing its execution identity | Steer live sessions; recover obligations through Tasks; retain ended sessions as evidence |

## Implementation

- Removed the maintenance adapter/composition/private API and control protocol
  wiring. Fixed retention, watchdog/liveness, metrics and App schedules remain.
  `--cron` still controls App schedules. Nonempty or malformed retired `cron.json`
  declarations reject definition loading, so duties cannot disappear silently.
- Removed workflow `resume` and historical step replay. Ordinary workflow calls,
  guards/automatic repair, bounded execution, structured results, cancellation
  and workflow history remain.
- Removed the dedicated Conversation agent and settlement adapters. Conversation
  uses common Task `communication`, `requests` and request Conditions. May's
  production metric follow-through helper and instructions use this contract.
  Scout's event subscriptions feed typed input through its existing business
  mapping; automatic Reddit scans retain their stricter access constraints.
- Removed cold session reconstruction, resurrection and obsolete heartbeat lease
  compatibility. `cleanupStaleSessions()` records confirmed stopped executions
  as interrupted; it cannot start another execution. New sessions cannot reuse
  identifiers with persisted evidence. Native CLI `resumeSessionId` is independent
  of this removed Host mechanism and remains supported.
- Kept accepted input identity, Requests, Topics, delegated return links, accepted
  results, exact process/attempt ownership, descendant cleanup, usage accounting,
  cancellation, atomic settlement and stale-result fencing. Common settlement
  rejects substituted input payloads and refuses to converge covered input while
  its accepted human Request remains open, including live inputs acknowledged
  during the attempt. Explicit result input scope remains supported.
- Preserve Conversation lineage using its saved input binding: cancelled or
  closed Conversations require a successor even though their executor is now
  `agent`. Conversation turns retain the App's canonical workspace; an explicit
  workflow may still request a Task worktree.
- Reserve the retired executor name `conversation` at Task admission, custom
  adapter registration and dispatch. Custom adapters using that name must rename
  and migrate their retained specifications before upgrading. The offline
  converter restores verified saved event bodies, including artifact-backed and
  pre-envelope rows, and refuses mixed pending subscription/Task routes.
- Update the companion Apps checks to use only `app.agent` and reject nonempty
  retired cron declarations, including disabled entries, in the ordinary gate.

Historical SDK Conversation types/schemas remain deprecated for validating saved
history. They are not an executable compatibility contract. No startup format
fallback or parallel legacy executor remains.

## Measured code change

Counts include new untracked source and tests, relative to each worktree's base.
They count physical lines, including comments and formatting, and are not a
performance measurement. Implementation includes SDK and offline operations;
tests and fixtures are counted separately.

| Area | Added | Deleted | Net reduction |
| --- | ---: | ---: | ---: |
| Host implementation / SDK / operations | 833 | 3,968 | 3,135 |
| Companion App implementation / checks | 81 | 76 | -5 |
| Combined implementation | 914 | 4,044 | **3,130** |
| Host tests / fixtures | 1,660 | 13,187 | 11,527 |
| Companion App tests / fixtures | 310 | 110 | -200 |

The large test deletion retires suites for removed adapters; it is not runtime
code savings. Enduring contracts are exercised through the common production
path and portable boundary tests. No token, latency, memory or throughput gain
has been benchmarked.

## Verification

- Final Host gate: `bun run ci` passed, including Host/SDK typechecks, canonical
  App-boundary validation, ESLint errors and the complete portable suite:
  **4,109 passed, 3 skipped, 0 failed**, across 351 files.
  The three skips are optional installed-agent/configuration checks. Real browser,
  daemon, process and scripted worker tests executed; none was disabled for this
  change. Earlier failures in retired fixtures and status-label assertions were
  corrected before this successful full run.
- Affected Apps: **84 passed, 0 failed** across both App definitions, May's metric
  helper, scripted metric integration and metric-response workflow tests.
- Apps checker regressions: **7 passed, 0 failed**, covering missing/empty,
  nonempty, disabled, malformed and nonarray retired cron declarations. The
  complete `check:may-design` gate passes with one pre-existing root-layout
  warning for `reports/`.
- Both full affected App TypeScript projects pass against the paired current
  Host/SDK. Validation uses local source links, not a deployed bundle.
- Coverage includes real scripted Task workers, direct answers and multiple
  asks, delegated/nested work, corrections before failure/Stop, restart history,
  SQLite contention, shared funding, exact input scope, failed delegation and
  retained open Requests.
- Ten offline conversion/contract regressions cover retained identity/history, atomic
  dry-run/refusal, idempotency, unsafe/orphan/frozen state and startup rejection
  before another execution attempt, exact inline/artifact/pre-envelope payloads,
  corrupt or mixed-route refusal and the reserved executor name.
- The actual conversion CLI also passes dry-run and apply smoke checks against
  isolated empty state. This checks command wiring, not a retained-state upgrade;
  retained transformations are covered by the regressions above.

## Integration and upgrade

Source preparation and integration:

- Host: `refactor/task-owned-simplification`, based on
  `946d3ff4ad314394714e3a196d0f95a7ac8e4914`.
  Review fixes and both GitHub checks passed at
  `3c1522e162b758c7d8ab6cae13b81b0278e92930`.
- Apps: `refactor/task-owned-app-contract`, based on
  `d8ab97cd7ae28e0cd4a2273867a08c2c34b1f90e`.

By user instruction, the companion App commit lands directly on Apps `main`,
while the Host change goes through a PR. Record the exact paired revisions in
that PR. Review both halves together and activate matching Host/Apps source in
one stopped upgrade window; source review or merge alone does not authorize
activation.

1. Inventory removed maintenance duties and move needed ones to App schedules or
   observers. Review workflows for safe fresh attempts before activation.
2. With the previous Host, complete confirmed execution cleanup and settle pending
   Conversation proposals/frozen Conversation admission commands. Do not delete
   execution markers, reservations or obligations to make checks pass.
3. Externally stop and exclude ingress, Host, workers, descendants and every
   launcher/restart path. Keep that exclusion throughout backup, dry run and apply.
   Take and verify a consistent offline SQLite/WAL backup.
4. From the new Host checkout, run
   `scripts/operations/convert-task-contracts.ts` with `--state-dir`,
   `--projects-root` pointing at matching new App source and `--confirm-quiesced`.
   The default is a real conversion transaction rolled back as a dry run.
5. Review the counts and retained input/Request/result identities. Add `--apply`
   only while all launchers remain excluded. Inspect the committed state before
   separately authorized activation. The operation is atomic and idempotent;
   unsafe or unmappable state rejects rather than being dropped.

The converter changes linked Task executor `conversation` to `agent`, increments
resource versions, and translates unresolved old event routes through current
subscriptions using the original saved event. It preserves generation, accepted
history, readiness, waits, exact Condition targets and input/Request identity.
A current subscription returning null deliberately declines an event while
preserving existing Condition targets. Frozen ordinary intents and terminal
history are not reinterpreted. Startup refuses retained retired execution
contracts until the offline conversion has succeeded.

The confirmation flag and file/SQL checks cannot establish the external start
barrier. See the Host's `scripts/operations/README.md`, section “Convert retired
Task contracts”, for the command and operating constraints. No installed state
has been inspected or converted as part of this implementation.

## Limits and deliberate exclusions

A fresh workflow attempt may repeat an external action unless its method checks
operation receipts or the current destination first. This change provides no
exactly-once guarantee for external effects and adds no replacement checkpoint
framework. Standalone ended sessions no longer continue through a generic
session-message route; durable work must use its Task.

May's optional model-backed `poc/intent-learning` experiment still targets the
retired adapter. Its historical evidence remains, but the experiment requires a
separate port before another run. No model-backed experiment or live acceptance
run was performed.

Budget accounting, protected funding, automatic workflow repair guards, event
graph design, model-step context refresh and TaskTree command redesign remain
outside this change. Live activation and hosted Container checks have not run.
