# Recovery cycles and reusable Task routes — 2026-11-13

**Supports:** [Recovery ownership](../../proposals/unified-agent-recovery-20261017.md#repair-completion-and-the-reusable-route)
and [idle-Task disposition](../../proposals/agent-task-workload-model.md).
**Status:** Read-only installed observation, local App correction and scripted
controller/restart verification. No activation, release, live Task mutation or
model request. Changed model judgment remains unproved.

## Finding and decision

The installed Alex Task
`runtime/recovery/scout-knowledge-lib-goal-app_03b90188-69a4-49f0-8f89-35c82c435606-2f9efc27f895`
accepted a verified repair result at `2026-11-12T11:35:16.371Z`. Its worker called
the assignment finite and recommended closure. The Task remained idle and open,
with no input waits, Conditions or pending notices. Its generation was 1,
resource version 15, and accepted attempt
`r_1_d3e79e21-b13b-4e00-98a2-6da84d3ecd49`.

At first this looked like a missing completion-policy case: the mapper retains
only `{appId, taskId}`, while automatic finite closure recognizes message/goal
envelopes. Following the route exposed the more important constraint. Every
failure for the named original Task deliberately maps to the same recovery ID,
including notices during repair and genuinely later incidents. Host treats a
closed identity as terminal. Broadening closure to normalized input would strand
future notices unless admission also changed.

Keep the existing declared operational route. Finishing a repair cycle answers
its notices and returns recovery evidence; the route becomes idle without
polling. Retirement requires App/operator disposition of future notices.
Ordinary finite assignments keep their guarded closure path. This preserves
current identities and requirements instead of introducing incident grouping,
automatic reopening or another controller.

The source correction shares the existing recovery-ID predicate across event
routing, completion policy and bounded disposition review. Completion now
explicitly preserves that route independently of input representation. The
reader recognizes an idle, App-created Alex recovery route only after checking
consistent projections and complete current obligations. A pending notice,
Condition, reconsideration or active state still returns current work. Foreign
Apps and Task-created assignments do not acquire this classification.
Alex's instructions and the owning guide now explain the repair/route distinction.

The other normalized mappings do not justify a blanket closure rule either.
Metric/reviewer Tasks are reusable; finite Task assessments use per-admission
identities and the existing result consumer; comparisons use their explicit
request identity. Their lifecycle does not follow from input shape alone.

## Installed context and direct read

The selected Host image was `localhost/may-agent:pr461-merged`; accepted App
source remained `e45aaa596994bcbe6529ff9386f979440dae0a8d`, definitions v5.
Workload-review/owner-notification/Host-feedback opt-ins were unset. No budget
policy or execution-limit records were installed. This is not a running trial
of the latest workload controls.

The read-only November 13 census found 60 Alex, 26 May and 12 Scout open
converged Tasks, alongside 6 Alex and 12 May waiting Tasks. No Task in those
sets was ready in that snapshot. Many waits retained actual human/approval
dependencies. Historical disabled-App totals and stale running-session rows
are not evidence of present execution pressure; Task counts alone cannot
establish overload or useful idleness.

Two public control reads captured the exact recovery Task's App and human
projections. Both old and corrected readers consumed those same responses:
the old reader returned `owner-review`; the corrected reader returned
`retain-standing`. Both retained generation 1, resource version 15 and the same
accepted attempt. This verifies read behavior on installed evidence; the
corrected workflow was not installed or invoked as a live Task.

Private evidence is under
`/home/hao/workspace-archive/workload-runtime-audit-20261113/`, including
`finite-recovery-open.json`, `summary-initial.json` and
`disposition-baseline-comparison.json`. Raw observations remain local.

## Source verification

Apps base: `69c8f38c16a1bbbb042f89c5bb81545e093c519b`.
Candidate: `/home/hao/workspace-worktrees/apps-recovery-lifecycle-20261113`.
Pinned Host/SDK: `0c7b0adb071ad6dae8a281a2a875e1f3e583eeff` (#472).
No Host source change is included.

The existing production-controller regression now covers two incidents. The
first holds a scripted repair while real controller failures continue, uses
the real write tool to restore access, and verifies the original sample 42
through normal retry and caller delivery. It settles every failure notice and
preserves the recovery route even with a mistaken cycle-close recommendation.
An idle reconcile invokes no worker. After restart, a new addressed input and
removed fixture prerequisite cause real failures again. The same recovery Task
repairs access and verifies sample 84; the first receipt remains sample 42.
There are still exactly two Tasks, and the recovery generation remains 1.
The fixture does not synthesize failure events or manually advance recovery
between failure, repair and result return. Decisions are scripted and all
effects are disposable local files/SQLite.

Six focused suites passed **107 tests / 1,287 assertions in 40.59 seconds**:
App mapping, completion policy, disposition reader, recovery, workload review
and workload policy. Strict source-SDK types passed across the same owners.
After the final creator-provenance refinement, the three affected boundary
cases passed **3 tests / 57 assertions in 2.72 seconds** and strict types passed
again.
Removing just the new classification branches produced the expected two
regression failures: the reader lost the operational route, and closure again
depended on input representation. The normalized recovery representation was
already protected by the earlier finite-input filter; this is not evidence that
the installed Host wrongly failed to close a finite obligation.

The first expanded runtime test used `taskId` instead of supported
`targetTaskId` for a new addressed input, so it correctly created another Task
and failed the identity assertion. The corrected test uses ordinary targeted
admission; the failed run is retained separately. Logs and strict compiler
configuration use the `workload-recovery-lifecycle-` prefix in
`/home/hao/workspace-archive/`.

`bun run check:may-design` passed structure, executable SDK/control examples and
canonical App checks. Its model-surface stage reported May's existing omitted
`system-investigation` and `verification` skills, identical to the captured
baseline at this candidate path. The full global check remains non-green.

## Remaining acceptance

Verify the changed guidance through an isolated model comparison before
claiming better judgment. Activation and native observation remain held.
Ending a no-longer-needed operational route still needs an explicit owner
decision accounting for future admission; this change adds no automatic
retirement rule and does not resolve other finite results awaiting disposition.
Production workload benefit and original external caller delivery remain
separate acceptance gates.
