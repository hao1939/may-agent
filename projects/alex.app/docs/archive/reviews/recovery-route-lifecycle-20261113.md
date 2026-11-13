# Recovery cycles and reusable Task routes — 2026-11-13

**Supports:** [Recovery ownership](../../proposals/unified-agent-recovery-20261017.md#repair-completion-and-the-reusable-route)
and [idle-Task disposition](../../proposals/agent-task-workload-model.md).
**Status:** Read-only installed observation, local App correction, scripted
controller/restart verification and subsequent native model comparisons in
disposable state. No activation, release or live Task mutation. Bounded model
evidence and installed adoption remain separate.

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
current routing identities without introducing incident grouping, automatic
reopening or another controller. The assignment clarification below uses the
normal requirement-revision path.

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

## Native comparison: guidance alone is inconsistent

Frozen Apps `e9b44296e923370fb1f38b492dd525b918834506` uses the real managed
Task-agent adapter, the pinned Host/SDK above, actual Alex input mapping,
guarded settlement and exact local Inbox receipts. A deterministic business
workflow verifies restored access, calculates 42 or 84 from saved data, writes
the evidence and reads it back. The model then receives a historical failure
notice or a one-off snapshot assessment. It decides through ordinary `tasks`,
`read`, `checkpoint` and `finish` tools. No decision-only helper or programmatic
application of a model recommendation substitutes for the native Task worker.
The notice is retained historical fixture evidence, not a newly produced
controller failure; the earlier production-controller regression owns that
mechanical acceptance.

Only Alex's general guidance changes between the first cohort's arms:
`69c8f38c16` instructions versus `a419eeb4c3` instructions. App mapping, closure
policy, tools and business evidence stay fixed. Two repetitions counterbalance
case and arm order. Both old-guidance recovery decisions recommend closure;
the new-guidance arm recommends closure once and correctly retains the route
once. Policy preserves every route and every caller receives its result.
All four finite assessments recommend and receive guarded App-policy closure.
Three recovery workers also try direct self-closure; creator checks reject all
three. Advice in a general prompt did not consistently explain this assignment.

Independent assessment checks original and reviewed requirements, creator and
generation against raw SQLite, each accepted result against the native finish
call, exact Inbox settlement and closure receipts, artifact arithmetic, frozen
sources and deduplicated native-session usage. The cohort has **8 accepted
decisions, 22 requests, 1,375,836 request bytes and 273,860 provider-adapter
tokens**, with no provider error or SQLite-lock warning. Historical failure
`error` fields inside successful reads are not tool errors; only actual error
envelopes or failed tool calls count. The three self-closure denials are genuine
tool errors and remain recorded.

Evidence: `/home/hao/workspace-archive/recovery-lifecycle-20261113-model1/`;
independent assessor and result use `recovery-lifecycle-assess-model1-20261113.py`
and `recovery-lifecycle-model1-assessment-20261113.json` in that archive's parent.
The frozen experiment lives under
`projects/alex.app/experiments/recovery-lifecycle-20261113/` on its linked branch;
it is not added to the installed workflow catalog or normal CI.

## Declare the responsibility with the assignment

The recovery outcome and acceptance still described one completed repair.
The source correction names current and later failure notices in both recovery
outcomes and adds one shared acceptance clause for cycle completion, quiet
idleness and route retirement. It uses existing assignment fields. Routing
identity, creator authority, caller relationships and closure policy stay fixed.

The compatibility regression starts with the exact earlier selector/general
requirements, saves a completed notice result, restarts with current source and
admits a fresh failure notice. The same Task advances from generation 1 to 2
once; a later notice keeps generation 2. Source restart itself changes nothing.
Old input replays retain the old receipt, prior accepted evidence stays readable,
and the original Task and its still-owed input remain unchanged. No live-state
migration or automatic reopening is performed. A directly addressed input keeps
its existing Task requirements, so old idle records without a new routed notice
are outside this adoption path.

The owning six suites pass **108 tests / 1,323 assertions in 46.38 seconds**,
with strict source-SDK types across the experiment and the same owners. Removing
the requirement clarification makes the upgrade regression fail at the expected
generation change. Restoring it passes **1 test / 36 assertions in 1.72 seconds**.
Eight scripted preflight passes verify the native execution/settlement paths
without inference before each real comparison. Early fixture preflights caught
a missing workflow description and an omitted native `checkpoint` tool in the
bridge's expected catalog; those rejected runs made zero provider requests.

The assignment comparison is frozen at Apps
`d9a0af5579ce6507adfe4f6a0d0153c9395596be`, with general guidance and closure policy held fixed. Its baseline
uses the earlier recovery declaration from `e9b44296e9`; the revised arm uses
the clarified assignment. Finite assessments remain the contrasting case.
The unchanged eight-pass cohort completed with these results:

| Assignment | Recovery routes retained | Finite assessments closed | Local callers answered |
| --- | --- | --- | --- |
| Earlier requirements | 2/2 | 2/2 | 4/4 |
| Clarified requirements | 2/2 | 2/2 | 4/4 |

Both arms made the expected final decisions. This sample demonstrates that the
clarified assignment can be followed through native execution and guarded
settlement; it does **not** show a measured improvement over the earlier
assignment. Retain the first cohort's inconsistent decisions as evidence of
variation rather than combining the cohorts into a causal success claim.

Independent assessment verifies both arms' actual saved requirements, shared
guidance and closure policy, frozen sources, raw SQLite, original business
evidence, native finish results and local Inbox settlement. All eight results
were accepted, all original subjects stayed unchanged, and no route left a
Condition or scheduled poll. The cohort used **27 requests, 1,774,619 request
bytes and 351,677 provider-adapter tokens**, including cache categories;
reasoning usage is reported separately. No provider error or SQLite-lock warning
occurred. Four real tool errors preceded successful corrections: one creator
authority denial, one malformed finish envelope, one waiting result without an
exact Condition and one communication without saved reply context. These remain
recorded; final correctness does not make the attempts error-free.

Evidence: `/home/hao/workspace-archive/recovery-assignment-20261113-model1/`;
independent assessor and result use `recovery-assignment-assess-model1-20261113.py`
and `recovery-assignment-model1-assessment-20261113.json` in that archive's parent.
The frozen experiment remains branch-only and outside the installed catalog
and normal CI. The same-path design-check baseline already reports May's three
omitted skills and Scout's prompt length of 36,130 over its 36,000 budget;
neither is introduced by this correction.
The final `bun run check:may-design` passes structural integrity, executable
SDK/admission examples and canonical App checks, then reports exactly those
two baseline model-surface errors. The pre-existing unclassified `reports`
directory warning also remains. The full global check remains non-green.

## Remaining acceptance

The initial native comparison establishes inconsistent guidance-only behavior;
the assignment comparison reaches correct final decisions in both arms without
demonstrating improvement. Activation and native operational observation remain
held. Bounded examples do not establish reliable judgment under arbitrary
workloads or prove production improvement. Local Inbox receipts do not prove
external delivery, and historical failure fixtures do not prove model-driven
repair of a new controller failure.
Ending a no-longer-needed operational route still needs an explicit owner
decision accounting for future admission; this change adds no automatic
retirement rule and does not resolve other finite results awaiting disposition.
Production workload benefit and original external caller delivery remain
separate acceptance gates.
