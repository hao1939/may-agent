# Test coverage ownership

The portable gate is `bun run ci`. Tests exercise the current Host contract;
App policy and installed configuration belong to their owning App/deployment
checks. Directory names alone do not indicate test cost or isolation.

| Contract | Detailed owner | Distinct integration protection |
| --- | --- | --- |
| Task claims, waits, accepted outcomes, owner closure and stale results | Reconciler and resource-store tests | Real concurrent connections, restart, process workers and cancellation |
| Task prompt/catalog projection | `src/app/core/tasks/app-task-runtime-policy.test.ts`, with no disk setup | Runtime tests verify persisted waits and actual agent inputs |
| Workflow execution allowances, cancellation and bounded effects | `src/lib/workflow-tool.test.ts` | `test/integration/workflow-tool.test.ts` owns tool dispatch, session reuse and steering; daemon discovery checks persisted runs |
| Metrics and alert transitions | `test/integration/metrics.test.ts` | E4 proves event ingress, handler registration and persistent alert recovery |
| Startup and recovery order | `app-runtime.test.ts` and `composition/background-startup.test.ts` call isolated production-code probes; `core/tasks/startup-recovery.test.ts` owns session eligibility | `task-startup-no-schedules.test.ts` runs real daemon/socket/worker restart; registry and Task runtime tests own atomic publication/rollback |
| Shutdown decisions | `test/integration/shutdown.test.ts` calls production lifecycle/signal handlers with intercepted process effects | Real daemon teardown and process lifetime tests |
| Browser rendering | E8 executes served `chat.js`, including raw/Markdown streaming and safe fallback | Same browser checks the project-comment HTTP journey |
| Bounded execution imports | ESLint restricted imports | SDK exports, execution results and shipped artifacts retain their own tests |

Startup probes are child processes so module mocks cannot leak across test
files. They run actual startup, registry/inbox and socket code, but replace
external Telegram/Console effects and indefinite loops. Recovery probes hold
the real startup caller's recovery dependency pending, then settle it. They do
not claim live Telegram, model, or deployed-App acceptance.

## Shared Task execution coverage

Conversation is a Task's human-facing role. Tests exercise its handler through
the same Task claim, attempt and recovery used for delegated work.

Fourteen inbox tests previously called the removed `resolveRequest`,
`onRequestFollowUp`, `onRequestMessage` or `controlTask` execution callbacks.
Their useful behavior now has these owners; generic inbox admission, attachment,
readiness and caller-context checks remain in `app-inbox-host.test.ts`.

| Retired callback-test behavior | Current executable coverage |
| --- | --- |
| Direct answer without additional work; visible reply; default Conversation for a subscribed input | `core/tasks/conversation-runtime.test.ts`: normal event ingress, interface notification and subscribed-input checks |
| One durable handoff with an immediate explanation | Same runtime file: atomic reply rollback and same-App delegation across reopen |
| Mixed answer and steering; later Topic reuse | Same runtime file: same-App delegation/steering, plus exact old-Topic alias selection outside bounded context |
| Advice about a focused Task; command Task references | Same runtime file: canonical focus/command observations with no mutation of referenced work |
| Attempted reuse of closed work | Same runtime file: closed-target rejection retains input, observes backoff, then corrects the handoff after reopen |
| Human cancellation; rejection of an unavailable control | `core/state/conversation-task-turns.test.ts`: exact contextual authority, atomic cancellation/reply and revision fencing; runtime check interrupts the exact running Task |
| Rejection of a guessed handoff; old Topic alias resolution | Runtime checks preserve the input on rejection and steer only the canonically linked Task |

The old “no May Task” expectation now means no additional Task per message;
one stable Task owns execution. Closed-target correction uses the common retry
with prior evidence, rather than two model calls in one inbox callback. These
are intentional contract changes, not reinstated legacy behavior.

That table covers the original fourteen callback tests. The later migrations
below preserve control, admission and failure guarantees. Neither these
deterministic checks nor the passing synthetic model trials certify operational
cutover or deployment.

The eleven retired `app-inbox-failure.test.ts` cases expected an independently
executing inbox and recovery without another model call. Their useful guarantees
now belong to the shared Task path:

| Retired failure-fixture behavior | Current executable coverage |
| --- | --- |
| Thrown execution, invalid answer, missing follow-up Topic | Task runtime preserves input and failure context, then accepts a corrected answer through the real backoff timer, including after reopen |
| Failure evidence cannot be saved | `core/state/inbox.test.ts` rolls back failure evidence and retry pacing together; `test/integration/fixtures/task-worker-scenario.ts` proves actual worker-loss recovery retains input and checks a committed effect before redo |
| New or existing Topic decision cannot commit | `core/state/conversation-task-turns.test.ts` reopens SQLite and verifies atomic rollback of Topic, Request, reply and accepted attempt |
| Reply cannot commit; later notification fails | Runtime rollback leaves input unfinished; a failing interface listener after acceptance leaves one readable reply across reopen without more execution |
| Rejected control or handoff | Runtime retains input and the unchanged target, then uses prior failure evidence for a corrected attempt after persisted backoff and reopen |
| Handoff result cannot commit; target App is available or removed | Runtime rolls back child admission with the reply, retries after reopen, retains work while the App is absent and preserves the accepted reply after later App removal |

An unaccepted attempt may be redone; there is no saved inbox decision to replay
and no failure-count stop. Accepted replies and delegated work must remain
intact. Storage atomicity and real process recovery have separate detailed
owners; an in-process database reopen is not proof of worker death.

The two old `app-turn-control.test.ts` cases now run in
`core/tasks/conversation-runtime.test.ts`. Public Stop commits before abort,
rejects late output and preserves queued input plus accepted Requests across
runtime reopen. Failed Stop persistence leaves execution live; stale Stop cannot
alter an accepted result. A repeated committed Stop is an idempotent read.

Admission containment and ownership checks remain in the inbox suites. They
use typed Task attachment and dependency reads instead of a model callback.
Containment uses fake Task storage to isolate real queue, claim, capacity and
reporting behavior; ownership checks call the real attachment transaction.
A failed renewal revokes local authority even while the saved lease is fresh.
That authority is checked inside the transaction before new attachment effects;
replaying an already committed attachment preserves its exact result without
requiring the expired owner to act again. Storage tests retain lost-reply and
changed-input checks. The common Task runtime owns model execution and recovery.

The core reconciler's retry and worker-report checks now use persisted backoff
and explicit owner closure. They retain duplicate-failure accounting, stale
fences, partial evidence, parent notification and rollback checks. Cross-connection
closure races verify that existing children survive while admission after
closure is rejected. Both retained mode spellings follow the same lifecycle.
`app-task-resource-store.test.ts` separately proves that a bounded history read
keeps the Task's current and observed attempts despite tied or backward timestamps.
Current reconciler outcome and action checks use accepted attempts on retained
Tasks. Owner closure rejects later admission, preserves accepted evidence and
leaves independent children executable. The parent-result suite checks an
explicit wait for child evidence; lifetime modes cannot infer that decision.
Historical receipt-reader checks seed the old stored shape explicitly instead
of calling current completion to fabricate it. Offline conversion checks retain
parent/child identity and fence obsolete claims without deleting Task resources.
`runtime-definition.test.ts` rejects unconverted history before admission or
execution; the reconciler regression proves archived success cannot satisfy a
dependency on newer unfinished work. Conflicting same-generation receipt imports
remain covered by `task-receipt-cutover.test.ts`.
The Task runtime suite exercises outcomes through installed executors. Recovery
tests now require a replacement attempt for uncommitted session output; they
preserve the original input, reject its unapplied proposal, keep fresh claims
owned, require confirmed process cleanup and retain accepted results after reopen.
The former terminal-result consumption helper and its settlement matrices are
removed. Normal settlement owns outcome/action coverage; session-adapter tests
retain the artifact as evidence without granting Task acceptance. Coverage includes
parent-led prerequisite repair without an unblock action, continued failure
reports across reopen, capability replacement without bypassing backoff, and
retained result evidence after cleanup and event storms. Input-state checks
preserve exact answer correlation, retry deadlines across a fresh process and
atomic result/closure wakes. The daemon checks verify accepted attempts on
retained Tasks after graceful shutdown while waiting and a crash during workflow
execution, with optional schedules disabled. Scheduled workflow discovery also
checks the accepted attempt while its Task stays open. These are isolated
candidate-to-candidate restarts. The separate old-version trial below crosses
the actual daemon boundary.

For an opt-in old-source cutover trial, use a clean, dependency-installed Host
checkout with the prior lifecycle:

```sh
bun scripts/poc/task-runtime-cutover.ts --legacy-source /path/to/old-host --out /tmp/task-cutover-report
```

This Linux harness starts the old daemon with temporary Apps and a local
scripted provider. It retains an accepted reply/Request, holds the next human
input in real inbox execution and holds measurement/supervisor workflow workers.
It stops the old parent before taking its process census, terminates it, and
verifies every observed child has exited before converting state. The candidate
daemon must answer the original input, complete the same measurement generation,
preserve history, retire the supervisor and accept fresh input on the same Task.
The obsolete inbox claim is checked before its old expiry so expiry cannot hide
missing ownership fencing. No installed state or real model endpoint is used.
This requires an explicit old source checkout and is outside ordinary CI; it
proves the exercised fixture upgrade, not an arbitrary installation or rollback.

Human Task detail reads include structured results from retained Task state and
historical receipts. Their tests keep those results out of compact cards and
hide old observations while a newer attempt is running; runtime checks verify
that failure evidence remains readable after a later accepted answer.

## SDK export contract

The SDK root test runs the installed compiler CLI and compares its emitted
`index.d.ts` with `test/fixtures/sdk-root.d.ts.snap`. This checks explicit value
and type-only exports without importing the compiler API. Compilation errors,
missing output, and declaration changes fail the test. Review intentional
export changes before updating the baseline; declaration ordering and compiler
formatting changes also require review. Keep root exports explicit: a wildcard
would hide transitive export changes from this check. This is an export-surface
check, not a snapshot of every referenced type's definition.

## Retired historical checks

The test audit identified 59 copied or obsolete cases. Their disposition:

- Two-phase workflow parser (13) and shallow heartbeat (4): removed; those
  copied policies are not implemented by the current Host.
- Copied web renderer (9): replaced by checks of shipped code in E8.
- Copied shutdown routine (6): replaced by real lifecycle handler checks.
- Telegram enrichment/notification SQL (9): removed copies; actual adapter
  input identity and reply routing remain in transport and Telegram E2E tests.
- Pivot counter simulation (3): removed the test-local Map algorithm; actual
  helper/guard contracts remain. No obsolete blocking policy is reintroduced.
- Digest recovery/escalation decisions (15): removed copied orchestration;
  real digest reads, stuck classification and circuit breaker tests remain.

Source-string startup checks have been replaced by observations of execution.
The shipped entrypoint configuration check and SDK public-export checks stay:
they inspect artifacts that are themselves the contract. Obsolete singleton,
delivery-gate and polling identifiers are not behavior specifications.

Related fixture cleanup keeps fresh state per test: model data comes from
`fixtures/model.ts`, accessors share a manager suite, pure rules avoid disk,
and runtime setup seeds the intended store directly. Storage restart and
multi-connection tests remain file-backed. Do not trade these guarantees for
a smaller count or a faster-looking skipped suite.
