# Serving database contention: first implementation trial — 2026-10-16

**Status:** Merged as [Host PR #370](https://github.com/hao1939/may-agent/pull/370) at `a0b153b45`; current-head local CI and GitHub Quality/Container passed. Deployment not established.
**Supports:** [Responsive storage](../../2a-design/storage.md) and the
[Host improvement plan](../../proposals/host-contract-improvements-20261016.md).

## Question and value

Can the Host stay responsive during ordinary SQLite write contention without
adding another queue or losing accepted work? The [original review](host-contract-review-20261016.md)
reproduced about 1.73 seconds in a contended write: SQLite's 50 ms busy timeout
was followed by repeated synchronous waits. The correction removes those added
serving waits and leaves retry with the existing operation owner.

Apps continue to choose useful work and recovery strategy. Host owns honest
acceptance, retained identity and mechanical retry. This change adds no App flag,
agent instruction, public SDK type, scheduler or durable queue.

## Source and change

Host baseline: `ff3449013a77a9a79ca0c877e0a7c090f5d51228`.
Candidate: `e5bac88fcdfc3d44ada6f1b4464ed7c06c894665` on local branch
`fix/host-contracts-20261016`. Production change: `5b9c4cdacbd9d12dd20cf461cf2c96fddfc7f38c`.
The separate commits `a75375878` and `e5bac88fc` repair test expectations at the
wake-delivery and metric boundaries; they make no production behavior changes.
Documentation baseline: Apps `3ca6dd6f72aba4a408b6afdd61442cc17662576c`.

- `src/lib/db/busy-retry.ts`: ordinary serving calls make one attempt, using
  SQLite's existing short wait. Task workers retain their previous bounded retry
  schedule. The private initialization helper retains repeatable schema and
  metric-definition installation retries.
- `src/app/composition/app-inbox-runtime.ts`: recovery yields using its existing
  admission turn gap before each retained input, then checks shutdown. Several
  short lock waits therefore cannot accumulate into one blocking recovery batch.
- `src/lib/README.md`: explains the retry owner and distinct execution budgets.

Initialization is a distinct operation, not always a separate process.
Definition sync can run during reload and still has its existing longer wait.
This candidate does not claim to eliminate all synchronous startup/reload work.

## Caller audit

| Operation | Behavior after contention |
| --- | --- |
| Event append before acceptance | Return the persistence error; no consumer runs and no false receipt is returned. Caller/transport may retry the original identity on a later turn |
| Receipt recording after Event commit | Preserve the Event and its pending admission marker; recover the unfinished receipt through its existing owner |
| App admission acknowledgment or unroutable bookkeeping | Retained input remains eligible for the existing recovery scan |
| Session/workflow projection writes | Surface failure through the existing lifecycle; retained artifacts remain evidence. No new in-memory retry authority |
| Schema/metric-definition installation | Keep a separate bounded retry for repeatable setup |
| Explicit Task worker | Keep the previous worker policy; it does not acquire the serving process's new behavior |

Transport review also confirmed that Telegram advances its polling offset only
after synchronous input handling succeeds, retaining provider retry on a failed
append. Console/control calls surface rejection; their existing retry contract
does not automatically repeat every definitive daemon error. Such unsaved input
may need another caller submission. This is a tradeoff of the shorter lock wait,
not proof of automatic eventual acceptance for every transport.

This does not make arbitrary effects replay-safe. A committed transaction is not
rerun just because later delivery failed. Existing state-transaction tests retain
that boundary; rejected single SQL writes differ from a body that already ran.

## Verification

Portable tests use temporary files and synthetic Apps, without credentials,
live App operation, external model calls or a production database.

A sequential before/after probe held a second SQLite writer lock, scheduled a
zero-delay timer, attempted an Event append, then released the lock and retried
its original key. On the pinned main and candidate respectively:

| Source | Failed append blocked | Timer delayed | Rows before / after retry |
| --- | --- | --- | --- |
| Main `ff3449013` | 1,733 ms | 1,733 ms | 0 / 1 |
| Candidate `e5bac88fc` | 54 ms | 54 ms | 0 / 1 |

These are single synthetic observations while local CI was active, not a
throughput comparison or latency percentile. The structural regression is
committed in `src/lib/db-writer-transaction.test.ts`: run it with
`bun test src/lib/db-writer-transaction.test.ts`. It asserts acceptance, identity and no
added synchronous sleeps rather than a machine-dependent millisecond threshold.
For timing reproduction, measure around its contended append and schedule the
timer immediately before that append; use fresh directories and the same load.

- The new two-connection regression holds a real writer lock. Unsaved input
  fails, leaves no Event and calls no extra synchronous sleep. A timer runs;
  releasing the lock permits the same input to be saved. Contending the receipt
  write leaves the committed Event and pending marker intact. Recovering the
  receipt and repeating publication retains one original Event identity.
- A production admission-runtime fixture queues two retained inputs. The first
  schedules a timer; the second observes that the timer ran. This checks the
  per-item yield, independently of the per-write budget. Existing recovery tests
  cover admission after lock release, original identity and scan fairness.
- Process-entry tests distinguish ordinary processes from explicit Task workers.
  Ordinary calls add no sleeps; workers retain their existing retry schedule.
- Two old Event-delivery tests mocked immediate synchronous retry. They were
  replaced by the real lock/identity regression, rather than weakening acceptance
  assertions or adding redundant tests of the new helper.

The initial focused run passed **48 tests**. After adding per-input yielding and
updating worker-role expectations, the focused boundary run passed **62 tests**
across four files. Counts overlap and must not be added together.

The first full CI run passed 3,740 tests, skipped three installation-dependent
checks and failed five old serving-retry expectations. After those were updated,
the next full run passed 3,743 tests and failed one Telegram wake-storm test.
That test passed in isolation, but its interleaving was wrong: it released a held
send before all asynchronous EventBus notifications reached Telegram. Late wakes
could legitimately trigger another read. The test now observes delivery of all
51 notifications before releasing the first send, still requiring one follow-up
read and exactly one send. All eight Telegram end-to-end tests passed afterward.
Production presentation behavior is unchanged.

A third full run passed 3,743 tests and failed the worker observation scenario's
global metric assertion: the expected two failed parent deliveries remained
exact, but a concurrent diagnostic receipt write also hit a real database lock.
The metric correctly counted three unresolved deliveries. This fixture starts
persistence and the worker bridge, without the ordinary App admission recovery
runtime, then advances housekeeping straight to expiry. It cannot promise that
every unrelated receipt write succeeded. Its metric assertion now filters the
production query to the two Events being tested; exact receipt states and the
accepted Task result remain asserted. Global failure reporting is unchanged.
All **19 worker-boundary tests passed** after the correction, including the
compiled worker fixture and parent-loss/restart scenarios.

This is also a useful limit: shorter serving waits can expose receipt-write
failures. Do not claim every such receipt is automatically repaired by this
candidate. The original Event and admission marker survive; observation intent
across journal recovery remains a separate known gap below.

Final `bun run ci`: **passed** at candidate `e5bac88fc`: **3,744 passed,
three skipped, zero failed**, 21,449 assertions across 337 files in 310.37 seconds.
The skips are installation-dependent agent/fleet configuration checks; browser
coverage ran. Type checks, SDK, canonical App-boundary validation and lint passed
before the full portable suite. Reproduce from the Host checkout with `bun run ci`.
Local raw logs and the timing probe are retained in the candidate worktree's
ignored `.state/host-contract-validation/` directory. Documentation validation is recorded with the
design update, separately from Host CI. `bun run check:may-design` passed:
zero integrity errors, the existing unclassified root `reports` warning,
SDK/control examples, seeded Task admission/replay and Condition/result checks,
and canonical App validation. A separate check resolved 523 local Markdown
links and heading targets in the changed documents without errors.

## Limits and remaining work

This establishes the covered mechanical boundaries, not a 50 ms end-to-end
response guarantee. No controlled live latency/throughput comparison or token
savings measurement ran. Shorter serving waits can expose more transient errors;
observe recovery volume and pending age after any later rollout.

Observer publication/replay, restart-independent receipt expiry, private
execution-recovery semantics and installed metric-query profiling remain in the
[implementation plan](../../proposals/host-contract-improvements-20261016.md).
The observer follow-up also found a missing persistence boundary: the private
`EVENT_RECORD_ONLY` Symbol survives worker relay but is not serialized/restored
by the journal. Preserve that intent with the Event when fixing ordinary
observers; tagging only their live output would leave restart behavior different.
No source fix for those later items is claimed here.

## PR publication

Published on October 16 as [Host PR #370](https://github.com/hao1939/may-agent/pull/370).
The branch was rebased onto `da5814457119ed47afded8eeef326c6d183b8fc4` (#368),
yielding `c8a49d8d244db1b3653f41fe4971aef1da408cf9`. The measured and tested
pre-rebase revisions above remain historical evidence; current-head CI is a
separate check. #368 changes startup recovery confirmation, not this patch's
serving-write implementation.

Current-head `bun run ci` passed: 3,745 tests passed, three installation-dependent
tests skipped, zero failures; 21,452 assertions across 337 files in 255.66 seconds.
GitHub Quality and Container both passed on that revision. Publication design
checks passed with zero errors and the existing unclassified `reports` warning.
No App runtime rollout or data migration is required by this change. The
canonical design remains in the local Apps repository, which has a backup remote
but no configured GitHub remote.
