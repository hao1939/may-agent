# Workload implementation: completion audit and remaining acceptance

This dated audit supports the [workload model](../../proposals/agent-task-workload-model.md)
and [implementation approach](../../proposals/agent-task-workload-implementation.md).
It records source evidence, a fresh read-only installation check and the remaining
acceptance work. It changes no business rule and authorizes no live operation.

## Candidate and evidence boundary

The combined Host candidate is `7e065a31816b47e5c488ac9e2cc50ad8204316c7`,
[PR #441](https://github.com/hao1939/may-agent/pull/441), stacked on #440 and the
preceding workload increments. Its local frozen CI passed 4,216 tests with three
existing skips, zero failures and 24,588 assertions across 363 files. Hosted
Quality and Container passed the same head in
[run 42533708764](https://github.com/hao1939/may-agent/actions/runs/42533708764).
The exact tools were Node 24.20.0 and Bun 1.3.14 with a frozen dependency install.
Paired Apps source/evidence is `e668b4f69b7e5b0dfebfbc35f5b623c21d75eaf2`.

At this audit, remote Host main remains
`f29d3132535e2b01d7b5196141e2f62de7070f8b`. #441 is open and draft with no
reviews or approval. Its green combined head does not establish that every older
stacked PR head passed, that the stack has independent approval or that it is
installed. Earlier failed/cancelled checks remain in the implementation evidence.
Any integration edit needs the required checks on its resulting exact revision.

## Requirements mapped to implementation owners

Paths in this table are relative to the Host candidate unless labeled Apps.
The detailed before/failure/repair/final results remain in the implementation
approach; this table is a coverage map, not another test execution claim.

| Accepted requirement | Implementation and owning evidence | Remaining acceptance |
| --- | --- | --- |
| One outcome/Task lifecycle; input, result and assignment ending remain separate. | Existing reconciler, fenced resource store and attempt runner; `task-result-closure.test.ts` and Conversation communication owners preserve combined effects and exact caller answers. Apps finite-result policy and selector creator consumer retain their separate authority. | Observe the installed result-to-disposition path, including caller evidence; keep standing work and real waits. |
| Required work can wait without an execution place; denied creation remains visible input. | `task-budget-admission.test.ts`, Inbox recovery and retained-input demand projection cover exact funding holds, replay and caller links. | Verify the selected pilot's actual funding disposition and caller route. |
| Roots and new contributions share an immutable account; existing services retain theirs. | Shared new-resource admission, `task-budget-admission.test.ts`, seed and dependency owners; #440 adds canonical page-scoped root/contribution/unattributed counts. | Explicitly attribute retained pilot Tasks; do not infer accounts from structural parents or invent historical spending. |
| Creation, committed claims and real helpers charge once; reads, wakes and replay are free. | Budget store/admission/seed owners, managed-start admission, `manager-task-budget.test.ts` and authored-workflow admission fixtures cover the distinct execution entry paths. | Independent review of the integrated accounting boundary; source equality and current checks after integration. |
| Host, recipient and root concurrency apply across workers; a blocked queue head cannot consume all dispatch. | Execution store/admission/policy owners, controller selection and managed-session boundaries use the shared SQLite authority. | Install complete policy under supported exclusion; inspect real reservations and holds. |
| One-place durable cooperation yields and resumes; inline helpers do not deadlock. | Real-worker one-place delegation/restart evidence and helper start deferral; full-method coordination checks include its caller and helper. | Preserve the supported method and limits during pilot configuration. Slot lending is deferred. |
| Settlement, cancellation, timeout, restart and uncertain starts preserve obligations and reservations. | `task-execution-recovery.test.ts`, shared confirmed-cleanup owner, worker timeout/exit owners, Task/Conversation transaction and notification owners. | Confirm actual cleanup before operational installation/withdrawal; a closed Task or quiet status is insufficient. |
| Funding renewal is explicit; midnight, retries and reopening do not replenish finite roots. | Budget store/funding owners retain period receipts and cumulative caps; root/sponsor funding controls require exact authority and wakes. | Review chosen grant/root values and any standing renewal policy. |
| Bounded coordination remains eligible under stress, with pause and provenance intact. | Trusted exact-role declarations, shared workspace, protected funds, full-method reserve and #441's bounded human preference at Host/App arbitration. | Configure and fund one opt-in pilot; fairness is process-local turns, not a delivery or cross-runtime guarantee. |
| Feedback is scoped, bounded and honest about unavailable facts. | `task-workload.test.ts`, execution read owners, control/SDK/context owners and actual-worker paired wiring evidence. Counts are page observations; current-root facts do not describe every root on that page. | Observe installed capability/context; assess model interpretation separately. |
| Empty/unchanged reviews coalesce while a stable population still advances. | Apps workload-review owners and actual SQLite/claim/accepted-result rotation probe cover bounded pages, exact Task/generation advice binding and legacy state. | Observe the activated workflow; retain the explicit churn/eviction and App-state rollback limits. |
| Idle execution does not imply usable resources or missing business work. | Workspace prerequisite/source invalidation owners and scoped blocker observations retain actual constraints without spending for known non-starts. | Behavioral comparison must distinguish blocked idle from spare capacity. Other unmeasured resources remain unknown. |
| Install or withdraw enforcement without erasing history or obligations. | Fresh initialization, retained-state installation and one-way withdrawal composition owners and operation commands have focused, full local and hosted evidence. | External stop/exclusion and cleaned-state proof remain operator responsibilities; no online start barrier or live-execution import is claimed. |
| Feedback changes useful choices without changing acceptance or creator authority. | App instructions and readonly bounded review are implemented; scripted integration proves facts reach the deciding helper. | Real matched behavioral trial and subsequent caller/outcome evidence remain unperformed. |

This audit identifies no additional demonstrated source defect in those supported
first-path contracts. It does not substitute for independent review of the stack.
Subsequent behavioral-harness preparation did demonstrate a readonly Task-tool
mutation gap; the paired source fix and regression evidence are recorded in the
implementation approach. The original audit is not proof that no gap remained.
A subsequent full-stack review-thread check also found four unresolved #406
comments whose reported defects remained in the combined candidate. The next
increment fixes exact standing scope, retained cross-App accounting, creation
hold recovery and child/root adoption wakes. Its reproduced failures and exact
verification remain in the implementation approach; unresolved parent threads
and independent integration review are not treated as approvals.
Standalone persistent addressing, online activation/live-execution import,
automatic root reactivation after withdrawal and caller-place lending remain
separate protocols, as already stated in the design. They are not pilot guarantees.

## Fresh installation observation

Read-only `status` and `apps.list` returned successfully. The snapshot reports:

| Scope | Open | Idle | Waiting | Attention | Running / queued |
| --- | ---: | ---: | ---: | ---: | ---: |
| Pilot App | 44 | 38 | 6 | 0 | 0 / 0 |
| Other loaded Apps combined | 51 | 29 | 12 | 10 | 0 / 0 |
| Total | 95 | 67 | 18 | 10 | 0 / 0 |

Status reports no active work or active agents. These aggregates do not classify
the idle assignments, prove a resource is available or establish workload stress.
They are a new snapshot, not a replacement for the historical disposition cohort.
No population scan, result closure or workload mutation was performed.

Hashes of the running executable inodes still match the previously established
#392 artifact, `0bb1969fbf12e6ad3138d7d15a49ec33e2d474aaea641a0404dd0223fed1d0eb`,
whose source is `4f8d0188ff11c19ada8c56d0a5a4ef373eb7e1eb`.
The file now at the executable pathname has a different hash. Hashing that file
alone would incorrectly describe the running processes. Deployment acceptance
must identify both the exact artifact and the processes actually using it.

The active immutable App-definition manifest still selects
`6a7e49843c5d2c8cccd7615b991472856d43f8d4`. Its pilot App source declares neither
`closeOnResult` nor workload review. This fresh check read the manifest and source;
it did not call a live public-contract API. The preceding
[adoption check](task-result-closure-adoption-20261108.md) owns the dated public
contract observation. Neither source integration nor a new file at the binary
pathname establishes activation. No restart, App activation or model call ran.

Private raw status, manifest and process-hash evidence is retained under the
existing workload implementation checkpoint, with filenames prefixed
`completion-`. Do not publish process details, operational Task content or credentials.

## Remaining sequence and accountable decisions

1. **Independent source review and integration.** Review the combined Host/App
   contracts and the stacked diffs, resolve discussions and obtain the repository's
   required approving review. Revalidate resulting revisions before merge. A draft
   with green checks has not passed this gate. No reviewer message was sent.
2. **Finish result-disposition adoption first.** A separately authorized operator
   selects the reviewed compatible Host/App revisions and performs the documented
   deployment/definition activation. Record artifact/process identity, public
   capability and one scoped accepted finite result with its exact caller answer,
   guarded closure and restart evidence. Preserve standing work and real waits.
   Do not enable the broader workload pilot merely to obtain closure evidence.
3. **Run an isolated behavioral comparison under explicit authority.** Use the
   protocol below; external model calls require their own authorization. The trial
   must not require production activation or production Tasks. Failures refine the
   smallest relevant prompt/policy/mechanism before another frozen cohort.
4. **Install one bounded workload pilot under separate operational authority.**
   Freeze the exact reviewed Host/App/configuration, externally exclude all writers
   and launchers, confirm clean execution and account explicitly for every retained
   in-scope Task. Preserve obligations, inspect the dry-run receipt, then perform
   supported installation and opt-in activation. Observe received facts, decisions,
   applied caller dispositions and later outcomes. Do not equate aggregate Task
   counts, recommendations or a quiet status with successful adoption.

The governing Host `CONTRIBUTING.md` states that model-backed experiments require
“separate credentials and explicit authority” and that “A source change, review,
or merge does not authorize rollout.” These are separate gates, not a request to
repeat authorization for ordinary source fixes or local verification.

## Behavioral comparison protocol

Use the actual versioned App instructions/workflow and candidate Host boundaries
in disposable storage. Keep business inputs, acceptance, caller/creator authority,
model/provider, tool permissions and starting evidence identical within each pair.
The control arm lacks the proposed workload feedback; the treatment arm receives
the real scoped observation. Keep enforcement identical in both arms. Vary load
or usable resources between the contrasting cases, rather than confusing feedback
with a new hard limit. Label all simulated delivery and caller tools as fixtures.

| Case family | Contrast and acceptance |
| --- | --- |
| Required incident | Light/heavy competing load: retain the same obligation and acceptance; report waiting/conflicts when warranted. |
| Discretionary improvement | Usable spare capacity/overload: weigh benefit against displacement; spare capacity need not produce a new Task. |
| Overload then recovery | Repeat unchanged pressure, then meaningful recovery: avoid repeated replanning and reconsider the opportunity when justified. |
| Blocked idle | Empty places with an unavailable prerequisite: inspect the blocker; do not infer spare usable capacity or invent work. |
| Result disposition | Sufficient finite result, incomplete obligation and standing work under pressure: expedite authorized review without lowering criteria or treating cancellation as delivery. |
| Older work and repeated observations | Repeated urgent arrivals/metric evidence: preserve the older required obligation and exact callers; explain waiting and reuse accountable work where appropriate. |

Start with two matched repetitions of each contrast/sequence, alternating arm
order. Freeze case data, source/configuration hashes, model identity, request/token
or monetary ceiling and process deadlines before external calls. Repeated states
must reuse the same arm's retained accepted state so the trial can expose churn;
independent case families use fresh storage. Select concrete model/cost limits and
verify the executable harness with a local scripted provider before requesting
authority to run it. This protocol is prepared acceptance work, not a claim that
the final behavioral harness or model cohort has already run.

Retain every run, including timeouts, admission denials and provider failures.
Capture actual received facts, model choices/reasons, exact tool actions, persisted
caller dispositions and subsequent fixture outcomes. Score identity, authority,
charges and actions from receipts; assess business judgment against the fixed
acceptance. A recommendation alone is not an applied change. Report required
delivery/ready wait, discretionary effort, result-review delay, repeated blocked
attempts and coordination/model cost. Preserve negative evidence and state the
limits of a small synthetic cohort before any operational claim.
