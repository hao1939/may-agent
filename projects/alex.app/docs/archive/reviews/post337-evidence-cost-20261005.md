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
A separate Host test-harness change (#341) binds initial and restarted sandbox
processes to the runner's open pipe, with a real abrupt-parent-exit regression.
Production runtime receives no test watchdog. This explains one concrete source
of storage pressure, not every historical SQL spike.

## Boundaries and status

These changes use existing reads, publication storage and Task admission.
Infrastructure presents evidence and validates mechanical identity. Alex still
judges relevance, the current claim and whether to reuse, repair or take no action.
A verified publication is not guaranteed truth; a completed rollout does not
independently fulfill every feature-verification requirement.

The targeted live feedback and orphan-process cleanup are complete. Host #339,
#340, #341 and #342 are merged. The App reader and guidance are implemented
in the companion source, with integration follow-through recorded below.
The source-status checks performed no deployment or live adoption verification;
byte-size and query trials are not live model-savings claims. Scout's
INDEX-publication correction remains owned by its existing Alex implementation
request, not duplicated by this work; its status was not rechecked here.
The broad-review integration fixture was aligned with the already merged daily
population cut; the assertion now checks a midday wake retains that fixed cut.

## Source and validation

The initial Host candidates were independent changes based on `af41ca863`:

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

## Review refinements

Review of #339 found that UTF-16 truncation could split an astral character and
that the discovery hint did not explain the accepted-history opt-in. The revised
preview walks at most 241 Unicode code points, keeping its own work bounded,
and the tool and manual distinguish current detail from `acceptedEvidence`.
Boundary cases include 121, 240 and 241 emoji and a mixed ASCII/emoji prefix.

#340 has merged as `f59f71040`. Its test follow-up adds a real closed Conversation
with a separate linked worker and retained attempt, then checks that only the
live Conversation's worker enters history materialization. This covers the
early closed-Conversation exclusion independently of the existing self-return.

#341's helper now uses the same parent-owned pipe and lifetime preload as its
daemon. Cleanup identity is published before readiness, and the outer test waits
separately for the startup result. Real trials cover killing the helper, closing
its parent pipe, and failed startup with removal of the temporary root. These
are test-harness refinements and add no production supervision mechanism.

Full CI passed on the reviewed candidates: `d15cf4631` ([#339](https://github.com/hao1939/may-agent/pull/339))
with 3,590 passing tests, `027db6141` ([#341](https://github.com/hao1939/may-agent/pull/341))
with 3,591, and `7e9252576` ([#342](https://github.com/hao1939/may-agent/pull/342),
the #340 test follow-up) with 3,588. Each skipped the three installation-only
checks and had zero failures. All five original review discussions have fix
references and are resolved. Local review logs are in
`/app/.state/review339-341-20261005/`.

## Merge confirmation

GitHub confirmed the final Host source merges on October 5:

| PR | Merge commit | Merge time (UTC) |
| --- | --- | --- |
| #339 — compact Task discovery | `abebee2195c15e590ae7965ed0fb3266a23024d1` | 06:24:20 |
| #341 — test daemon lifetime | `7315d7a6c1a4b3380637bf12f96d5311f8a647d9` | 06:26:13 |
| #342 — closed-conversation regression | `d2970acd38f742761c7e8499f918d440dfc0e266` | 06:20:49 |

#340 had already merged as `f59f71040`. The passing CI results above identify
the reviewed candidates; they are not a new combined-main run or deployment
receipt. App companion integration and installation verification remain separate.

## Design-alignment follow-through

The review reproduced a remaining test-only process leak: standalone HTTP
fixtures still served requests after their runner was killed. The Host follow-up
reuses one parent-pipe launcher for sandbox daemons, standalone HTTP servers,
web-only CLI and maintenance fixtures. Existing stdin and IPC protocol tests
keep their own protocol. Normal teardown owns temporary files; parent-pipe loss
stops execution even when teardown cannot run. This adds no production watchdog.

The owning Event, storage and operator guidance now describe merged #336 and
#326 source consistently. Pre-journal persistence failures, historical Events
outside the migration subset, and independent control recovery remain explicit.
Installed-state claims still require the current receipt.

The App companion includes the reader and its Alex catalog entry. A trial
through the actual workflow tool discovered it without catalog diagnostics and
read eight accepted Unicode reports with zero agent steps, valid source-prefix
previews and correct continuation offsets; responses were about 9.8 KB each.
That establishes capability availability in source, not live agent adoption.
After activation, use existing report-handling work to verify a supported
disposition, preserved obligations and actual usage, rather than creating a
second investigation or treating a smaller response as measured token savings.

The reader and guidance companion reached Apps main at `e53ccbfba2`. This
records source integration; no App activation or production restart was
performed by this follow-through. The test-launcher follow-up is published as
[#343](https://github.com/hao1939/may-agent/pull/343), candidate `cd0bb0fc1`,
pending its ordinary PR review.

The review and portable fixture trials are retained locally at
`/app/.state/alignment-review-20261005/`; follow-through checks are at
`/app/.state/alignment-fixes-20261005/`.

The focused Host fixture/interface checks passed 44 tests. Removing the lifetime
hook made the new HTTP runner-death regression fail because the child remained
alive; restoring it passed. App reader, routing, systemic-review and intake
checks passed 40 tests. Design integrity, examples and canonical App checks
passed with the existing unclassified `reports` warning. Full Host CI passed
on `cd0bb0fc1`: 3,609 tests passed, three installation-only checks skipped, and
zero failures; browser tests ran. This remains source verification, not live
adoption or measured token savings.
