# Alex cumulative review-round repair — 2026-11-16

The [reporting delivery trial](gym-reporting-delivery-trial-20261116.md) used
seven internal rounds across three workflow calls under one three-round limit.
The earlier implementation recovered usage only from a prior Task result, so
live reentry before owner settlement could start over. Verification argv was
also part of the requirement key; changing it discarded consumed usage.

The source repair reserves each round in the existing development Task archive
before specialist or verification work. Atomic links to immutable receipt files
allow at most three reservations, including concurrent invocations. Cancellation
does not refund a started round. No new incident/reset input or lifecycle is
introduced, and no midnight or generation-based renewal exists.

Verification remains tied to the exact command, requirements and clean candidate.
A changed command requires new verification within the remaining allowance.
An unchanged verified/reviewed candidate can still replay after exhaustion.
Exhaustion returns incomplete, retains the original acceptance and supplies the
owner with evidence for disposition. It does not imply checks passed or ask the
owner to restart the loop. Prior hash-checked Task evidence can seed consumed
rounds independently of verification validity; unknown prior usage grants no
remaining rounds. This is a conservative migration, not a reconstruction of
all old calls whose usage was never recorded cumulatively.

## Verification

Four new regressions first failed against the original source: live reentry,
changed verification argv, cancellation without an accepted result, and six
concurrent invocations. The live replay now spends one round on a rejected
judgment, two on failing repair/check attempts, and zero on a third invocation
using equivalent argv. It remains incomplete with three cumulative rounds and
the original acceptance intact. Additional migration regressions cover known,
unknown and unreadable prior allowance evidence.

The existing suite also verifies useful first-round delivery, changed-command
receipt invalidation, preservation of dirty work, exact candidate checks,
third-round success and quiet replay after accepted or rejected delivery.
The Alex workflow/evidence suite passed **140 tests, 1,287 assertions**. Strict
TypeScript checking of the workflow, allowance helper and development fixture
passed against the installed SDK. The full Gym check passed **378 Bun tests,
six Node tests and 1,488 benchmark-review checks**, plus active/archive validation.

Concurrent benchmark work advanced `outcome-completion` to v2 with five cases.
Alex's revision-3 plan now selects that whole version with no baseline; its
12 retained runs remain history. Three plan tests had assumed a three-case
grid; their totals now derive from the frozen commissioned membership and trial
count. The initial failing check and successful final check are both retained.

The initial broader suite passed 148 tests and failed four comparison-adapter
fixtures that omitted `src/plans` when copying the Gym CLI. Concurrent work
subsequently corrected that fixture; all **12 adapter tests** then passed.
That change was inspected and preserved separately from this accounting repair.
`check:may-design` still reaches two pre-existing broken absolute links in the
Gym agent instructions, so aggregate release checks are not all green.

The retained commands and results are in
`/app/.state/alex-review-rounds-20261116/`; `verification.json` records final
check outcomes and preservation hashes. `reproduction.log` retains the four
pre-repair failures, and `before/` retains the original source and plan.

## Delivery status and next action

This is a local source repair with deterministic scripted specialists and real
temporary Git worktrees and verification subprocesses. No subject/grader model,
benchmark run, truth approval or baseline promotion is part of this repair.
It does not establish a model-quality gain, cost saving or reliable unattended
delivery. The original seven-round trial and its evidence remain historical.

Definitions have not been activated and no runtime Task, daily review deadline,
Host checkout or running process was changed. The allowance depends on the
retained Task archive or readable prior evidence; full Host restart recovery,
archive deletion/replacement and separate development Tasks for one incident
remain outside this deterministic proof. It does not enforce the standing
incident's benchmark-run, development-invocation or monetary allowances.

Next, review and activate this source through the existing release path, then
observe one bounded hosted development Task. Verify the loaded source identity,
same-Task reentry, the cumulative count, honest remaining acceptance and the
unchanged daily wake. Keep the existing blocked-specialist status limitation,
environment-failure classification and archive-export gaps separate.
