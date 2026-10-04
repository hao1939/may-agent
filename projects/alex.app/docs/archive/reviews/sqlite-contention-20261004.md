# SQLite contention review — 2026-10-04

## Findings

The deployed Host was `d8c877577` (PR #325). Four `subscriber.failed` Events
during the observed post-rollout period reported `database is locked` while
admitting Evaluation review requests or published reports. Daemon logs also
show rejected session-digest inserts, a failed metric recording, and event
persistence/acceptance operations succeeding after existing bounded retries.

The daemon's SQLite busy timeout is 50 ms. Event persistence already uses a
bounded retry helper; shared state transaction acquisition, the admission store's
separate transaction wrapper and session-digest appends did not use it.
This inconsistency turns brief write competition into avoidable missing records
or deferred admission. Append-only changes also require SQLite's writer lock.

Read-only OS lock sampling observed both Task workers and the daemon acquiring
the WAL writer slot. The sampled spans were short (up to roughly 28 ms); the
sample did not capture the historical failing interval or establish a specific
long-lock owner. The latest maintenance pass took 405 ms and did not coincide
with the four failures. Do not attribute these failures to maintenance without
further evidence.

A separate slow query enumerates pending Conversation Task changes. A recent
daemon measurement recorded 1,050.9 ms. Read-only local reproductions took
roughly 2–3 seconds despite returning zero rows. Repeated Task links cause the
same attempt returnability checks and retained JSON to be interpreted many
times. A response limit does not bound that discovery work. This is a read-cost
issue, not proof that this query holds the writer lock.

## Focused write correction

Candidate: [Host PR #328](https://github.com/hao1939/may-agent/pull/328),
branch `fix/sqlite-write-admission-20261004`. The initial source was `0525a0619`,
based on `d8c877577`; review correction `e8095a08e` removes overlapping retries.

- Retry only outer `BEGIN IMMEDIATE` through the existing bounded helper.
- Replace admission's private transaction wrapper with the shared helper.
- Retry a rejected atomic digest insert using the same existing helper.

Transaction bodies and post-commit delivery are not replayed by the added retry.
Nested callers retain savepoint/rollback semantics. No schema, queue, record
movement, timeout policy or recovery lifecycle is added. The tradeoff is that a
contended synchronous caller can wait through the existing bounded retry budget;
this does not make SQLite nonblocking or eliminate contention.

Three new regression cases fail against the unchanged baseline and pass against
the candidate. They cover actual two-process writer contention, admission joining
its owning transaction, and a rejected digest insert retaining exactly one row.
Additional assertions ensure a busy error from the body rolls back once and a
post-commit delivery error preserves the commit without replay. The focused run
passed 39 tests and 140 assertions. Full CI and rollout status must be checked
against the final source revision; these results are not deployment proof.

Review found existing outer retries around delivery acceptance, App metric
definition synchronization and startup metric registration. Adding retries at
transaction entry without removing these wrappers multiplies the wait. The new
delivery-exhaustion regression observed 81 acquisitions before correction and
9 afterward. It verifies that failure leaves the event unchanged and later
acceptance can succeed. Delivery and App metric synchronization now leave
retry ownership with storage. Startup's SQL-only registration uses one shared
transaction, including nested definition writes and source-field updates.
The focused corrected run passed 45 tests and 156 assertions. The original
revision's full local CI passed 3,621 tests with three installation skips;
that result does not certify the subsequent review correction.

The integrated review correction `4341e3c18` passed full local CI with 3,623
tests, three installation skips, zero failures and 19,718 assertions. Both
GitHub checks passed and the overlapping-budget review thread was resolved.

The user then preferred shortening writer lock time over adding retries. PR
#328 is held as a draft pending that investigation; passing tests do not settle
that design choice. Source inspection identifies avoidable preparation under
the Event writer lock: idempotency hashing, payload serialization, and large-body
artifact file writes. Exact Task wakes also parse and rewrite retained trigger
JSON; metric evaluation computes samples inside its transaction. These are
investigation targets, not proof of the historical lock holder. Moving work out
must preserve atomic fences and account for an enclosing transaction. The
existing retry proposal alone does not reduce lock duration.

## Remaining admission recovery gap

Tracing the four subscriber failures back to their original Events found one
completed admission plan and three unhandled Events with no plan. Existing plan
recovery cannot select an absent plan. These source fixes reduce avoidable
transient acquisition failures; they do not replay the three original Events
or guarantee recovery when acquisition exhausts before planning.

Exact local Event identities and statuses are retained in the ignored SQLite
review evidence for a later authorized recovery. No production replay was done.
The earlier recovery proposal in PR #312 is closed and unmerged; this change
does not silently reintroduce it. Any broader correction should start from the
existing Event/admission boundary and preserve original delivery identity.

## Slow-read experiment

Adding an earlier receipt filter or an exact-link predicate did not provide a
dependable gain and was discarded. A query-local materialized projection that
calculates each retained attempt's unchanged returnability rule once reduced
one same-snapshot comparison from 1,953 ms to 718–726 ms with identical results.
The final generated SQL (`fix/conversation-change-query-20261004`, commit
`a34cf18d3`) took 1,255–1,325 ms versus the baseline's 3,170–3,210 ms in a later
same-snapshot comparison under heavier load. The existing Conversation and
input-feedback suites passed 73 tests and 1,093 assertions before the added
materialization-plan assertion. Full CI covers the final assertion too.
This is a separate query correction, not a new stored cache. Empty
live results alone are insufficient correctness proof: returned answers,
selected partial reports, closure and reopened-generation cases need the
existing synthetic integration coverage.

[Host PR #329](https://github.com/hao1939/may-agent/pull/329) merged as
`6b507d429`. Before integration with newer main, full local CI passed 3,617 tests
with three installation skips and 19,690 assertions; both GitHub checks passed
on the reviewed revision. These measurements and tests are not rollout proof.
The integrated tree (identical to merged `6b507d429`) subsequently passed full
local CI with 3,618 tests, three skips and 19,697 assertions.

Local evidence remains under ignored `.state` and temporary trial files. Live
database access used SQLite URI `mode=ro`; only disposable test databases were
mutated. Do not publish raw production records or confuse old retired App rows
with new work admitted during this review.
