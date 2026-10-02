# Common outcomes and closure: source experiment

**Supports:** [Task Resource Engine](../2a-design/task-resource-engine.md). Tests separating accepted contributions, outstanding work and owner closure.

**Choice basis:** [Applicable philosophy and convention](../1-principles/core-principles.md#one-authority-for-each-resource); [compare competing choices](../1-principles/core-principles.md#resolve-conflicting-designs).

**Status:** Active, unmerged experiment; not ready for cutover. It follows the
[first evidence slice](controller-poc-evidence.md), which remains separately
reviewable in Host PR #150. The accepted target is still the
[one-lifecycle proposal](conversation-input-unification.md).

Host branch: `poc/task-outcomes-and-closure`, based on `072901fc` from #150.
The [core experiment](https://github.com/hao1939/may-agent/commit/56e4465a)
changes real controller/reconciler/storage paths. It is not a second controller
or a wrapper around the executing Conversation inbox. No production state,
installation or deployment changed.

The follow-up [Host-contract trial](https://github.com/hao1939/may-agent/commit/5e13ae88)
uses the actual Task instructions and SDK result schema. Its execution-boundary
fix is isolated on current Host main in [PR #153](https://github.com/hao1939/may-agent/pull/153)
at `edd368ac`, awaiting human review. It does not require the incompatible
lifecycle experiment to merge first.

The [input-result checkpoint](https://github.com/hao1939/may-agent/commit/bc7228ca)
retains exact immediate answers for callers. It also includes a failing
regression for delayed answers: the controller does not yet preserve the
original input's result correlation across a wait. This is a demonstrated
process gap, not a request for more procedural instructions to the model. The
[next source and model slice](controller-poc-input-continuation.md) fixes that
gap for its exercised Task paths; this document retains the preceding evidence.

The later [recovery refinement](controller-poc-recovery-review.md) changes one
acceptance rule: an honest failure must retain the unfinished assignment and
continue after backoff unless its owner changes the instruction. The no-retry
`stopped` cases below remain historical evidence of report acceptance, not
proof of that revised continuation contract.

## What now works in the experiment

The controller records a supported outcome and releases the attempt. It keeps
the Task available for later input. That behavior is identical for both legacy
mode values; completion no longer deletes a finite Task or forces a parent to
wait merely because a child remains open.

Code resolves the result reference from the durable child event before invoking
an executor. It supplies the exact accepted result, even after another child
cycle and SQLite reopen. A missing or out-of-scope result is marked unavailable;
the notification cannot manufacture accepted evidence. The production
`TaskAttempt.events` construction now uses this reader.

An answer to new input leaves other accepted waits and their routes intact.
Returning `waiting` without repeating Conditions preserves their identities,
observations and timing. A completed child that merely remains stored is not
enough to justify another child wait. The agent decides whether a wait or a new
piece of work is useful; code retains the coordination state.

`stopped` now records a non-success outcome for the work considered, without
closing the Task or scheduling another attempt just to reconsider that decision.
The parent receives that outcome through the same saved return event.

The owner can separately call `closeAppTask`. Closure fences late output and
retains previous outcomes. It leaves independent children available. For the
ordinary close-after-result convention, `afterResult` must identify the current
accepted outcome and no newer input or active attempt may remain. An explicit
scope withdrawal can close unfinished work without claiming success. Repeating
the same closure is harmless.

Closure reuses the existing terminal-record transaction and indexes. Its JSON
record distinguishes owner closure from historical cancellation and may retain
the consumed outcome reference. The SQL table and several read names still say
`cancellation`; that storage vocabulary and the public views need migration.
There is no new table, service, scheduler or model-driven lifecycle manager.

The [legacy close action removal](https://github.com/hao1939/may-agent/commit/eb0691d8)
removes `close-task` from the SDK schema, admission and reconciler. That action
previously fabricated a successful receipt while closing work. Owner closure
remains a separate typed control. Rejected legacy actions roll back their whole
batch; they cannot partially create work or manufacture success.

For input answered by its current attempt, the existing admission record now
points to that exact accepted attempt. The caller's inbox row retains the
admission key. Result readers follow that link instead of the Task's latest
phase or result, including after another answer, a retained wait or closure.
Both writes share the outcome transaction. A new input cannot consume an old
answer. Task reads also distinguish `closed` from merely having an answer, so
an open Task can accept later input.

## Evidence and its limits

The focused source gates passed **28 tests** across common lifecycle, context
and runtime-policy coverage. Host/SDK type checks, App-boundary checks and lint
passed. The source fixture exercises:

- Outcomes and later input under both legacy mode values, including exact
  replay of an input admission without another attempt.
- A three-Task return loop, B -> A -> a Task named Conversation, using one
  production controller. Another input is answered while B remains running.
- Exact returned evidence after later cycles and storage reopen, with a check
  against supplying another owner's result.
- Closure during execution, late output, repeated closure, retained results,
  independent children and rejection of a stale close-after-result convention.
- Retained waits without agent redeclaration, an answer alongside another wait,
  and non-success judgment without automatic retry or implicit closure.

The Task named Conversation in that fixture is **not** the migrated Conversation
product. It does not exercise real message/Request records, the conversational
handler, Esc, adapter delivery or the existing inbox cutover. Those remain gates.
Existing Task input and result paths are exercised, but caller readiness still
has migration work beyond the exact input reader described above.

After close-action removal, **54 tests passed** across SDK, common lifecycle,
context and runtime-policy checks. For the latest input-result slice, **113
tests passed and 1 failed** across inbox, state, reads, conversation resolver,
schema and common lifecycle. The failure is the new delayed-input regression
below; it is retained as an ordinary failing test, not skipped. Host/SDK type
checks, App-boundary checks and lint passed.

Two production caller-return cases passed separately. The original answer is
`0.92`; another input then receives `0.1` on the same still-open, waiting Task.
The first caller and its parent still receive `0.92`. One case uses a
notification and the other invokes the actual dependency-recovery operation.
The second proves recovery behavior, not the real timer cadence. A separate
storage-trigger test rejects the admission-result write and confirms that the
accepted attempt rolls back with it.

During development, the two real-agent returned-result cases changed from
accepted waiting to accepted convergence while their children stayed open.
The affordable give-up case recorded accepted `stopped`. Each used one `finish`
call. These runs used the small experimental judgment contract; they do not
certify the installed May agent or all of its tools and instructions.

The next three real-agent trials used the actual Host Task protocol and result
schema on the same fixture asks. They exposed a code error: the agent correctly
judged that recovery was too expensive and committed `finish(status: "failure")`
with a valid `stopped` result, but execution classified that as a runtime error.
The failure path then recorded retrying. The model needed no different judgment.

The fix separates a validated domain judgment from an execution failure in
direct execution, managed sessions and saved-result recovery. It retains
provider failures, rejected or missing results, interruption before a committed
result, and legacy unstructured failure behavior. With unchanged instructions,
the repeated Host-contract trials accepted both measurement answers as
`converged` and affordable give-up as `stopped`, without automatic retry. Each
used one `finish` call and took about 3.9–4.7 seconds. A final give-up run using
the committed case selector and settlement check also passed in 5.5 seconds.

The focused execution/recovery regression suite passed **59 tests**. These cover
real finish-tool validation, managed persistence/publication, cancellation
races and saved results across storage reopen. The model trials still run the
direct executor with fixture evidence and restricted tools; they do not prove
the complete managed Task adapter or installed App. The harness now separately
checks the judgment choice and its accepted source outcome, so a correct answer
misclassified by the controller cannot make the experiment pass.

The independently reviewable fix at `edd368ac` also passed full local
`bun run ci`: **2,736 tests passed, 3 installation-dependent skips, 0 failures**.
That check used current Host main plus the execution fix. It does not make the
larger lifecycle branch's migration failures green.

The broader affected-suite audit is **not green**: 325 passed, 81 failed, with
1 asynchronous error across 406 tests, before adding the delayed-input regression.
Many assertions and polling fixtures
still depend on Task deletion, a completion receipt, or the old stop semantics;
timed-out receipt polling also accessed already-closed test databases. Treat
the failures as migration work to inspect, not as evidence that every failure
is harmless or that the tests should simply be removed. No full-CI or merge
readiness claim is made for this branch.

## The follow-through gap

At `bc7228ca`, the regression used actual Task admission, claims, child-result context and
SQLite reopen. The caller requests a measurement; the first attempt delegates
it and waits. A later attempt answers a different question without resolving
the measurement. The child returns, the parent accepts the measured result,
and storage reopens. The original measurement admission still has no result
pointer, so its caller cannot retrieve the answer.

That attribution used input events in the accepting attempt. Those events
no longer include the original ask after a completed waiting attempt. Restoring
the old relationship is controller process. Neither asking the model to copy
admission keys nor attaching the latest answer to every unresolved input is a
valid fix: an intervening answer can belong to different work.

The [next source change](controller-poc-input-continuation.md) retains the
original work-to-result connection and presents its ask and evidence for
judgment. For Conversation, deciding which
accepted Request is resolved belongs to its existing typed decisions. The
controller must not infer that semantic decision from a consumed event. The
regression is still a Task fixture; actual Conversation execution and Request
settlement have not migrated. The subsequent model trials exercise this Task
return loop, not that missing product migration.

## Value, cost and remaining work

The completion path has lost its finite absorption and maintained-parent
liveness branches. The cancellation mode restriction and the handler's finite
leaf stop restriction are also gone. Added code handles explicit closure,
exact result context and retained waits. Total changed implementation size is
roughly level; this is fewer lifetime rules, not yet the large code reduction
expected from removing duplicate Conversation execution.

Close-action removal deleted roughly 123 net implementation lines. The
input-result slice adds 56 net implementation lines plus tests: one
optional admission JSON pointer, one inbox column, exact result reads and
recovery per waiting input. It replaces the old recovery loop's unbounded
per-Task row expansion with bounded pages. The current index still needs a
query-cost check for many inputs waiting on one Task; a page-size limit alone
does not prove bounded database work. Historical rows without a saved admission
key also need an explicit migration policy. Do not treat these additions as a
proved overall simplification while the delayed-answer case is broken.

The small model fixtures retained about 1.3–2.6 KiB of JSON per attempt. That
is a measurement of tiny cases, not a storage budget. Full accepted results can
be much larger; the existing 16 KiB result admission cap bounds one result, not
total history. Retention needs to preserve outstanding references before
discarding older evidence. Quiet Tasks consume state but no execution slot in
the exercised cases.

The next work is substantive:

1. Build on the [wait-correlation slice](controller-poc-input-continuation.md),
   finish caller/read and scope-revision migration, and retain old receipts as
   history. An old success must not fulfill a later assignment.
2. Replace the actual Conversation execution owner with one stable Task, using
   the real message/Request operations in fenced settlement. Remove the old
   execution pump and follow-up owner after proving one authority at cutover.
3. Preserve human Stop and background-pause scope, bounded failure handling,
   cross-App return routes, missed-notification discovery and quiet timers.
4. Remove legacy mode declarations and conflicting views, finish closure and
   workspace/retention migration, and bring the relevant tests and full CI green.
5. Run real agents through that complete loop and compare the current contract
   on the same work. Report intervention, calls, cost and actual deleted paths.

The current SDK still carries legacy mode fields and other Task actions, but
`close-task` is gone. The regular Conversation inbox remains an execution
authority. The new ordinary App closure
convention is exercised through a typed control, not yet installed in all Apps.
Those are explicit incomplete boundaries, not compatibility guarantees to keep.
