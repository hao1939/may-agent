# Creator-owned Task discovery

This refinement supports the [workload model](../../proposals/agent-task-workload-model.md):
returned work remains visible to the creator until that creator decides its
disposition. Task grouping, execution ownership, funding and closure authority
retain their existing meanings.

The Host implementation [PR #472](https://github.com/hao1939/may-agent/pull/472)
merged on 2026-11-13 as `0c7b0adb071ad6dae8a281a2a875e1f3e583eeff`,
based on Host main `07148372f9`. The first revision `13c4a66b4b` passed
local and GitHub checks. Refinement `ba7d4ab8c8` removes its automatic context
propagation and keeps one explicit discovery read. It passed full local CI on
the original base; integrated revision
`a1b582327e3bac131cf7d0bf47da506f8af6fef0` passed full local CI on current
main. Scout's companion guidance now explicitly calls that read on ordinary
wakes, committed on Apps local main as `f0391f842c`.
Neither source is a live activation.

## Demonstrated gap

The [Scout follow-through verification](../../../../scout-knowledge-lib.app/docs/verification/scout-owner-publication-follow-through-20261113.md)
proved that exact creators could verify and close two already published finite
contributions. Ordinary source wakes had not done so. Comparing the exact native
prompts found empty structural child lists and empty open-wait lists, although
the publication Tasks named those source Tasks as creators. The publications
were grouped under `library-operations`, so a query by structural parent did
not describe creator-owned work. Explicit reminders supplied the missing
identities. This does not prove what earlier dependency-return attempts saw.

The standing Scout instructions also lacked the planner's explicit procedure
for consuming finite results and performing guarded creator closure. They
described useful research and preservation of publication obligations; discovery
and follow-through need a clear path for the native executor too.

## Smallest implementation

`read.tasks.created` and the model `tasks` action `created` share one query by
immutable creator identity across Apps. The query returns eight items by default
and supports bounded pagination. The App decides when to request the observation.
The caller cannot choose another creator. Items retain destination App and Task
identities, current status, generation/version, short previews and an accepted
attempt reference when available. Closed/cancelled work and current retired
completion receipts are excluded. Old accepted results with newer pending input
remain visible as pending, rather than being presented as ready for closure.

The read uses an index on valid creator records and performs no lifecycle write.
It creates no queue, wake, consumed flag or budget rule. The structural child
view remains independent. Existing input, dependency and review wakes still
drive execution. Missing support on older Hosts is unavailable, not an empty
list. Each page is a fresh observation with its own time, rather than part of a
fleet-wide snapshot. Exact known dependency links remain useful when
attribution or discovery is unavailable.

There is no automatically populated `createdTasks` field in attempts, native or
workflow prompts, model briefs or workspace files. Every executor already shares
the scoped Task read capability. Discovery stays there, avoiding a second context
projection to refresh, truncate or keep consistent. The PR touches 15 files,
reduced from 23; the read, index, scope guards and business regression remain.

Scout's native guidance calls `tasks` with `action: "created"` on each ordinary
standing-source wake and reviews relevant returned finite work before new
discretionary expansion. It reads the original requirements, accepted result,
caller route, publication and independent obligations. Fulfilled assignments
can close through the existing creator control after a fresh exact read.
Unfulfilled work remains owned and visible; a genuine external wait can coexist
with useful research. This uses the same ordinary wake and can add a tool
round trip inside that attempt. It does not start a separate closure session.
The explicit read is an App instruction, so source wiring alone cannot establish
that a live model will remember to perform it; ordinary-wake acceptance must
observe the read as well as the verified disposition.

## Verification and activation gate

The first revision's focused portable checks passed 43 tests. An existing hosted workflow test
discovers its finite contribution without a named child in workflow code, reads
it, closes through the normal creator capability, and observes it removed from
discovery. The same test against unchanged Host `c5b9b9a70f` fails with the child
still idle. Separate owning cases cover cross-App duplicate Task IDs, different
grouping parents, pagination, creator-bound cursors, pending corrections,
unchanged read state, current-session model-tool wiring, readonly access and
visible capability absence. Existing closure race/authority tests remain. In the
simplified revision, the workflow explicitly requests discovery rather than
receiving an automatic starting page; its discovery/closure regression passed,
as did 24 focused reader, tool, closure and structural-parent tests. The revised
explicit-read regression also failed against unchanged `c5b9b9a70f`, leaving
the finite result idle. Removed context fields require no replacement snapshot
tests.

The first full portable run caught two integration gaps: the SDK export snapshot
needed the two new public types, and an unconditional JSON expression index
prevented the existing damaged-row diagnostic fixture. The snapshot was updated;
the creator index now covers valid JSON only, preserving the original diagnostic
test. Both owning checks passed afterward. The first revision's complete
`MAY_TEST_SHARDS=4 bun run ci` passed 4,043 tests and 23,689 assertions, with
zero failures. Three existing optional installation tests were skipped;
browser tests executed and passed. The longest test shard took 225.76 seconds.
Host and SDK type checks, App-boundary checks, lint, scoped formatting and
whitespace checks passed. The final query plan uses the partial creator index
with an App/Task continuation seek and primary-key evidence/terminal lookups.
The initial failed run and passing run are both retained. GitHub Quality and
Container passed on that first revision. The simplified revision on its original
base also passed 4,043 tests, with 23,679 assertions, zero failures and the same
three optional installation skips. Its longest test shard took 196.43 seconds.
This is validation timing, not evidence of a test-speed improvement from this
change. The final revision integrated with current main passed full local CI:
4,021 tests, 23,901 assertions, zero failures and three existing optional
installation skips. Browser coverage executed; Host/SDK types, App boundaries
and lint passed. Its longest test shard took 281.04 seconds. These counts belong
to that main revision plus this change, not the earlier base. Exact-head GitHub
Quality and Container passed before merge; Container built the image and ran its
isolated smoke check.

Post-merge read-only checks found the running Host at `v5.6.0 (07148372)`,
which predates the discovery implementation. The latest published release remains
v5.6.0. [Release PR #448](https://github.com/hao1939/may-agent/pull/448), for
v5.7.0, now includes #472 and is running its separately dispatched CI on
`40afe7dabbf579f5287d8f04e160a6b44fb80eef`. Release, deployment and verification
of active Scout guidance remain pending; no runtime activation was performed
as part of these checks.

Host release, deployment and separate App activation precede the live acceptance
check. An ordinary wake must discover and dispose real finite work without the
operator supplying exact child identities. Standing assignments, independent
waits, publication bytes, caller results and capacity reservations must remain
correct. The already closed publications must not be reopened or replaced to
manufacture that demonstration. Reduced idle buildup and autonomous semantic
judgment remain unproven until that observation.

Local candidate and verification evidence are retained under
`/home/hao/workspace-worktrees/may-creator-task-discovery-20261113/` and
`/home/hao/workspace-archive/may-creator-task-discovery-20261113/`.
The explicit-read refinement's baseline and CI logs are under its `simplified/`
subdirectory; its current-main verification is kept separately.
