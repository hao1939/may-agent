# Task discovery, report reads and recovery cost — 2026-10-05

**Supports:** [Task reads](../../2a-design/task-resource-read-interface.md) and
[execution feedback](../../2a-design/execution-feedback.md#return-repair-evidence-to-the-original-work).
**Choice basis:** [Discover context](../../1-principles/core-principles.md#context-is-discovered-not-dumped)
and [code executes; agents judge](../../1-principles/core-principles.md#code-executes-and-brings-back-evidence-agents-judge).

## Observed problem

Five Alex report-handling sessions after the October 5 rollout accumulated
3,931,883 input/cache tokens. Three sessions fetched the same 341,215-byte,
100-Task list. The list contained full results and facts, while agents repeatedly
searched and hashed immutable Evaluation artifacts. Some sessions commissioned
useful work; their total usage is not a measurement of wholly avoidable cost.

Alex also repeated an old Task's statement that #335 was undeployed, despite a
successful independent rollout. Reading a current Task resource did not make its
saved observation current. Finally, the conversation recovery query loaded over
10,000 attempt bodies before discarding irrelevant self-returns and closed
conversations.

## Changes and bounded trials

| Boundary | Correction | Observed trial |
| --- | --- | --- |
| Agent Task discovery | Preview only, exact identities and cursor; detail remains in get | Same 100 saved Tasks: 341,215 → 65,606 bytes (80.8% less); identities/cursor unchanged |
| Evaluation consumption | Expose the existing reader in Alex's workflow catalog; add exact publication input and deterministic identity/hash checks | A retained live report validated and returned a roughly 10 KB bounded output without a model call; tampering, wrong identities and missing publication are rejected |
| Operator repair feedback | Send receipt evidence to the existing rollout Task | May and Alex completed remaining verification, retired obsolete Conditions and returned all three original May inputs; no new rollout was started |
| Conversation recovery | Apply live-conversation/self-return scope before attempt-body reads; select the saved ordinary result/report attempt in the join | One SQLite snapshot: 10,484 → 6,600 attempts; 99,271,497 → 53,471,809 body bytes; about 6,156,000 → 3,558,000 VM steps; identical pending results |

The SQL trial took 1,184 ms before and 815 ms after. These are local timings,
not proof that all multi-second spikes are resolved. Several unrelated reads
have slowed together; retained observations cannot isolate every I/O or scheduling
cause. Exact return identity, generation, cancellation and delivery receipts remain
unchanged. Existing Topic compatibility is preserved.

While validating, disk-full failures exposed an unrelated orphan test daemon
from October 3. Its isolated /tmp fixture held a 5.6 GB WAL after more than two
days of operation. Its exact command and open fixture descriptors were checked;
terminating that daemon and its admission worker checkpointed the database to
51 MB and freed about 5.5 GB. No production database was deleted or rewritten.
A separate Host test-harness candidate binds initial and restarted sandbox
processes to the runner's open pipe, with a real abrupt-parent-exit regression.
Production runtime receives no test watchdog. This explains one concrete source
of storage pressure, not every historical SQL spike.

## Boundaries and status

These changes use existing reads, publication storage and Task admission.
Infrastructure presents evidence and validates mechanical identity. Alex still
judges relevance, the current claim and whether to reuse, repair or take no action.
A verified publication is not guaranteed truth; a completed rollout does not
independently fulfill every feature-verification requirement.

The targeted live feedback and orphan-process cleanup are complete. The source
candidates need their normal review and activation; byte-size and query trials
are not live model-savings claims. Scout's INDEX-publication correction remains
owned by its existing Alex implementation request, not duplicated by this work.
The broad-review integration fixture was aligned with the already merged daily
population cut; the assertion now checks a midday wake retains that fixed cut.

## Source and validation

The Host candidates are independent changes based on `af41ca863`:

- `3a6d45124`: compact agent Task discovery. Full `bun run ci`: 3,589 passed,
  three installation-only checks skipped, zero failed.
- `df360027f`: scope conversation recovery before reading history. Full CI:
  3,588 passed, the same three skipped, zero failed.
- `cb424ab87`: bind sandbox daemon lifetime to the test runner. Full CI:
  3,589 passed, the same three skipped, zero failed. The final cleanup guard
  also passed the real parent-death regression after formatting.

App reader, intake and Evaluation checks passed 249 tests; the earlier set
including App routing passed 234. Design integrity, executable examples and
canonical App checks passed with the existing unclassified `reports` warning.
An initial Host run stopped on disk exhaustion; a later discovery run exposed
the old full-list integration expectation, which was corrected before the
passing run. Temporary test data used a separate memory-backed directory.

The 05:10 UTC follow-up still found both repaired Tasks converged with no
Conditions. Three interrupted sessions in the preceding 30 minutes were
recovered through their Tasks after the separate Host rollout; no failed
session was recorded in that window. Unresolved input recovery stayed at zero.
The latest observed worst SQL call fell to 154 ms after the disk cleanup;
this short observation does not establish lasting latency improvement.

Local evidence and check logs are retained at
`/app/.state/post337-fixes-20261005/`; the preceding read-only audit is at
`/app/.state/post337-audit-20261005/report.md`. The test cases and owning contract
changes are the portable reproduction paths.
