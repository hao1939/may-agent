# Work Graph V2 — Current Implementation Review And Next Breakdown

Status: Gate A and Slice 6 are live read consumers; the exact ADO Condition
authority canary is closed through fallback acknowledgement and terminal
continuation; both immediate review handoffs and application-only redelivery
are live for the revisioned V2 cohort, while terminal-attempt recovery remains
shadow-only

Reviewed against the live project and source implementation on 2026-07-16.
Compatibility revision-0 work is not rewritten and is excluded from V2
supervisor authority.

## Decision

Continue the V2 migration through the remaining evidence gates. Snapshot
contract hardening and the first supervisor canary are now implemented; do not
broaden supervisor writes or migrate shared Condition families until their
live shadow/canary evidence exists.

The model remains sound:

```text
WorkItems own intent
Conditions own waits
attempts and reviews own runtime facts
controllers own domain-ledger reconciliation
the supervisor owns broken process invariants only
```

The current implementation has proven the shared read model, one bounded
review-handoff recovery family, and source-level convergence for one exact
Condition family. It has not yet converged the broader feedback loop because
most Conditions, recovery writers, controller scheduling, and compatibility
revision-0 work still use legacy paths.

## Design Against The Current Implementation

The logical design still fits, but the implementation is at three different
levels of maturity: shared reads are authoritative, two mutation families are
bounded canaries, and the rest of the control plane is still compatibility
code. Treating all three as simply "V2 implemented" would hide the remaining
dual-authority risk.

| Design concept       | What the implementation proves                                                                                                                                                                                         | Remaining mismatch                                                                                                                                                 | Decision                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| WorkItem             | Revision-aware assignment, worker, reviewer, and planner envelopes exist; one exact cohort uses `controlPlaneVersion: 2`                                                                                               | Most live work is revision `0`; task-local trace/context still contains attempt, review, wait, and projection history                                              | Keep the existing task store and migrate authority through commands; do not introduce a second WorkItem store |
| Condition            | Two exact ADO runs completed the open -> resolved -> durable continuation -> assignment -> review path; the second also passed scheduled exclusion, fallback redelivery, typed acknowledgement, and stale-event replay | The registry supports only one external type and one subject; the blocked task and blocker object remain compatibility projections                                 | Preserve the proven boundary while common handoffs converge; then add shared/fan-out Conditions               |
| Attempt/review       | Revision and attempt correlation rejects stale worker/reviewer/planner events                                                                                                                                          | completion-to-review and review-to-application delivery are not yet one durable handoff protocol; compatibility still reconstructs facts from task fields and logs | Make durable pending actions the next common primitive                                                        |
| ProjectSnapshot      | Health, readout, selected metrics, planner packets, and Kanban share frontier semantics and source coverage                                                                                                            | Runtime sources are generation-checked but not captured transactionally together; some consumers and repair writers still use compatibility views                  | Keep the snapshot as the read authority and continue consumer-by-consumer deletion                            |
| Supervisor           | Review-handoff has stable keys and bounded action; terminal-attempt policy is shadowed                                                                                                                                 | The watchdog remains a long legacy priority chain, and most invariant classes still have separate writers                                                          | Do not add broad supervisor authority until delivery and scheduling converge                                  |
| Controllers          | Controller lanes are separated from the leaf WorkItem frontier                                                                                                                                                         | Controller-root state, periodic pulses, blocked holders, and rollup repair remain live                                                                             | Migrate after exact Conditions and supervisor ownership are stable                                            |
| Derived tree/readout | Global frontier identity no longer comes from stored root/focus arrays                                                                                                                                                 | Compatibility mirrors and repair paths remain writable and visible                                                                                                 | Delete their authority only during bounded writer cutover                                                     |

### Authority Transfer Status

| Transfer                           | Current state                                                                                     | Evidence in the current implementation                                                                                                                                                                                        | Remaining exit work                                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Exact Condition authority       | Complete for the selected exact ADO cohort                                                        | Mechanical mutation guard, due-only observation, complete blocker reprojection, stable fallback retry, typed-lane acknowledgement, terminal resolution, durable continuation, and archived revision-1 subject all passed live | Keep the compatibility projection output-only and reuse the gate for future bounded cohorts                                                               |
| 1. Common pending handoffs         | Both immediate review handoffs and application-only redelivery are live for the revisioned V2 cohort | `PendingActionV2` normalizes all five handoffs; the natural review-application canary separated accepted transport from planner satisfaction; completion receipts stay in the task source and both handoffs use stable keys | Observe a natural V2 completion receipt and matching reviewer decision, then enable combined completion redelivery and retire overlapping recovery for the cohort |
| 2. One complete revisioned loop    | Partial live proof                                                                                | The revision-1 exact wait completed assignment -> worker -> completion -> reviewer -> review application; stale fallback planning safely overlapped the terminal transition                                                   | Run induced missing-review and unapplied-review failures through the common handoff primitive, then retire matching compatibility writers for that cohort |
| 3. Objective supervisor invariants | Partial                                                                                           | Review handoff writes are bounded; terminal-attempt recovery is shadowed; resolved-Condition and overdue-fallback facts are visible; one starvation case is removed                                                           | Add a fair bounded lane scheduler and transfer each remaining invariant only with a postcondition and deleted old writer                                  |
| 4. Condition families              | Canary only                                                                                       | Exact single-subject ADO terminal Conditions are proven                                                                                                                                                                       | Batch future exact waits, add explicit dependent references, then migrate approval/permission/capacity/shared-environment families separately             |
| 5. Controllers and schedules       | Early separation only                                                                             | Controller records are excluded from the executable leaf frontier and one watchdog overlap no longer starves Conditions                                                                                                       | Make pulses due-work aware, project status only from owning ledgers, and remove heartbeat/rollup/blocked-frontier recovery authority                      |
| 6. Cutover and cleanup             | Not started                                                                                       | Writer-free cutover procedure and rollback rules are designed                                                                                                                                                                 | Drain compatibility cohorts family by family; disable old writers before deleting mirrors, schedules, and repair branches                                 |

### Feedback And Recovery Convergence Correction

The exact Condition path exposes the simpler common mechanism:

```text
observed fact
  -> revision-checked command
  -> atomic state transition + durable pending action
  -> idempotent dispatcher
  -> idempotent consumer
  -> observable postcondition
```

Condition resolution already follows most of this shape: it records a stable
continuation before attempting assignment delivery, and a failed dispatch
remains in the assignment outbox. Generalize that mechanism, not the current
watchdog event-reconstruction branches.

The intended convergence is:

- normal feedback creates a durable pending action as part of the state
  transition;
- retry is ordinary redelivery of that same stable action, not a new recovery
  campaign;
- the supervisor observes pending-action age and the target postcondition;
- only a missing source fact, impossible correlation, exhausted delivery
  budget, or ambiguous domain disposition becomes a supervisor case;
- owner planning never rediscovers or recreates a handoff that is already
  represented by a pending action.

This allows completion -> review request, review -> application, Condition ->
continuation, and assignment -> worker delivery to use one mental model. The
supervisor registry remains useful for exceptional invariant cases, but should
not become a second outbox.

### Corrections Required Before Broadening V2

1. **Condition ownership must stay mechanically enforced.** This is now true
   for the exact ADO cohort: the save boundary rejects uncorrelated changes to
   the open Condition or its subject revision, and Condition commands restore
   the complete compatibility projection. Generalize the same enumerated
   authority contract before adding another Condition family.
2. **Supervisor fairness must become general.** The concrete terminal-session
   versus due-Condition starvation case is fixed; both lanes now run in one
   tick. The rest of the watchdog still uses fixed priority and early returns.
   Reconciliation should claim a bounded number of due actions per lane, or
   persist a fair cursor/deadline order, before more invariant writers move to
   the supervisor.
3. **Every dispatched action needs a delivery postcondition.** Exact fallback
   now has durable acknowledgement and bounded redelivery, and the snapshot
   exposes overdue acknowledgement. Apply the same accepted-versus-satisfied
   distinction to assignments and both review handoffs; dispatcher acceptance
   alone still does not prove those consumers ran.
4. **Cohort selection must converge.** Revision, `controlPlaneVersion`, family
   mode, and temporary adoption selector are appropriate canary brakes. They
   should collapse to one explicit per-family ownership policy after cutover;
   otherwise every future transition must reason about several overlapping
   gates.

### Revised Breakdown By Authority Transfer

The remaining migration should be reviewed as authority transfers, not as a
set of files to refactor.

#### Transfer 0 — Close The Exact Condition Canary

Status: complete for the selected exact ADO cohort.

- observe the natural scheduled blocked-frontier wake and prove it creates no
  refresh, replacement, or owner action for the Condition subject;
- observe terminal resolution or the natural overdue fallback;
- add the mechanical Condition-ownership mutation guard;
- record the fallback delivery/postcondition behavior;
- disable the corresponding legacy exact-wait observer/writer for this cohort.

Exit: one exact run has exactly one observer, one fallback policy, one
continuation, and no generic owner-planning path.

#### Transfer 1 — Make Pending Handoffs A Common Primitive

Status: active authority transfer. The common read projection is implemented;
existing mechanisms remain the storage adapters and sole writers.

- define one stable pending-action envelope with subject, revision, attempt or
  Condition identity, payload reference, delivery state, and postcondition;
- adapt the existing assignment outbox and Condition continuation rather than
  replacing them wholesale;
- migrate completion -> review delivery and review -> application delivery;
- record transport acceptance without treating it as completion; retain the
  replayable payload until the target postcondition is observed;
- bound retry, retention, and owner escalation in one place.

Do not start by adding another universal action store. Normalize the five live
mechanisms behind one projection and policy first:

```ts
type PendingActionV2 = {
  key: string; // stable for one causal handoff
  kind:
    | "assignment-delivery"
    | "completion-review-delivery"
    | "review-application-delivery"
    | "condition-continuation-delivery"
    | "condition-fallback-delivery";
  subject: {
    taskId: string;
    revision: number;
    attemptId?: string;
    conditionId?: string;
  };
  payloadRef: { source: string; id: string; digest: string };
  status:
    | "pending"
    | "leased"
    | "accepted"
    | "satisfied"
    | "exhausted"
    | "superseded"
    | "unknown";
  delivery: {
    attempts: number;
    leaseId?: string;
    leaseExpiresAt?: string;
    acceptedAt?: string;
    nextAttemptAt?: string;
    maxAttempts: number | null; // null exposes an existing unbounded policy
  };
  postcondition: {
    kind: string;
    correlationKey: string;
    dueAt?: string;
    satisfiedAt?: string;
  };
};
```

The payload stays in its source-owned durable record. The common layer owns
identity, delivery policy, and postcondition observation, not a second copy of
the domain payload.

| Current mechanism      | Durable source fact                                                                                                   | Current completion signal                                                 | Gap to the common contract                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Assignment delivery    | Revisioned assignment JSONL plus active task correlation                                                              | Event dispatch accepted and outbox row removed                            | No durable accepted -> worker-start postcondition state; a later missing-attempt invariant reconstructs the gap          |
| Completion -> review   | Task in `review` with revision, attempt, completion payload, review epoch, and optional source-owned generic receipts | Matching reviewer decision appears                                        | Immediate receipt writer is source-armed but manifest-off; supervisor retry still uses its compatibility recovery record |
| Review -> application  | Reviewer-run row plus exact revision/attempt decision                                                                 | Task leaves the matching review epoch or exact command replay is recorded | Decision persistence and event dispatch are not one explicit handoff state machine                                       |
| Condition continuation | Resolved Condition with `continuation`, then the existing assignment outbox                                           | Matching assignment is recorded and dispatched                            | Condition says `assigned` before end-to-end worker pickup; delivery lifecycle is split across two stores                 |
| Condition fallback     | Condition-local claim, attempts, acknowledgement deadline, dispatch, and acknowledgement                              | Correlated planner acknowledgement                                        | Strongest existing model, but family-local and previously invisible to the shared snapshot                               |

Implement the transfer in five bounded steps:

1. **Implemented:** add a read-only `PendingActionV2` projection with one
   key/state vocabulary over these existing authorities. No writer changes.
2. **Implemented in the projection/runner:** standardize states as
   `pending -> leased -> accepted -> satisfied`, with `exhausted` terminal for
   the automatic budget. Lease expiry returns to `pending`; transport
   acceptance never means `satisfied`.
3. **Implemented for the revisioned canary:** make reviewer decisions durable
   before delivery and keep their immutable payload addressable until exact
   review application is observed. The workflow default remains off; the app
   manifest opts in only revisioned `controlPlaneVersion: 2` work.
4. **Implemented behind a default-off gate:** put completion -> review through
   the same dispatcher/postcondition policy, using the already-durable task
   completion fact as payload. Accepted/failed generic receipts stay in that
   task's completion trace rather than another payload ledger.
5. Adapt assignment, Condition continuation, and Condition fallback to the
   same runner while retaining their current source storage; delete each old
   reconstruction/retry branch only after its live canary passes.

This is the Kubernetes-controller plus transactional-outbox pattern at the
project boundary: canonical state is durable, events are wake hints, a keyed
reconciler is idempotent, and periodic resync repairs lost wakeups. The useful
part to borrow is the control contract, not an external workflow engine or a
new event-sourced database.

Risks introduced by this transfer must stay explicit:

| New risk                        | Failure mode                                                                                   | Required guardrail                                                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| False unification               | Adapters label unlike source facts with the same state even though their postconditions differ | Enumerated action kinds and per-kind postcondition functions; common lifecycle, not a generic prose action                      |
| Duplicate side effects          | Redelivery after transport acceptance runs a non-idempotent consumer twice                     | Consumer command key equals action key; revision/attempt correlation and payload digest are mandatory                           |
| Payload compaction race         | Source task/reviewer/Condition record is archived before an unsatisfied action can replay      | Retain source payload through satisfaction plus audit window; keep a digest tombstone after compaction                          |
| Slow consumer mistaken for loss | The runner retries while a valid handler or worker is still running                            | Separate lease, acceptance grace, and postcondition deadline; observe handler/session lifecycle before retry                    |
| Hidden workflow engine          | The common runner starts making review, domain, priority, or fallback judgments                | It may dispatch only enumerated mechanical actions; ambiguous disposition becomes owner work once, not another automatic branch |
| Dual-writer migration           | The old watchdog branch and new action runner both deliver the same handoff                    | Per-kind default-off authority mode, shadow comparison, one canary, bounded writer-free cutover, then delete the old writer     |

The first live shadow at `13:36:47Z` was stable and exact against health and
frontier projections. It reported:

```text
assignment-delivery:accepted = 2
completion-review-delivery:unknown = 2
completion-review-delivery:pending = 2
review-application-delivery:pending = 3
```

The two accepted assignments exactly matched the two active-attempt-missing
findings; the two pending completion actions matched the two missing-review
findings; and the three pending application actions matched the three unapplied
decision findings. In-grace completion handoffs remain `unknown` because this
capture has no positive transport-acceptance fact. The projection also exposed
and corrected two adapter mistakes before writer cutover: an absent on-demand
assignment file means an authoritative empty outbox, while an assigned
Condition continuation whose subject has left the live tree is superseded, not
perpetually accepted.

Reviewer decision persistence now precedes `project.task.reviewed` dispatch.
The source row carries a stable `review_id`, immutable decision payload, and
`delivery_status: pending`; a separate receipt records accepted or failed
transport. An injected dispatch failure proved that snapshot capture still
projects the exact decision and one pending review-application action for
replay. The planner remains the only review-application writer, so this closes
the payload-loss window without creating dual mutation authority.

Immediate review-application delivery now uses `deliverPendingActionV2` only
when the handler mode is `review-application-revisioned`, task revision is
positive, and `controlPlaneVersion` is `2`. One accepted receipt suppresses a
duplicate completion replay; failed deliveries may consume at most two keyed
attempts. Revision `0` and default-off workflow calls retain the legacy path.
Fixtures prove accepted replay suppression, failed-attempt exhaustion, manifest
cohort scope, and snapshot projection of an accepted receipt. Exact run
`172653860` subsequently created the first natural V2 WorkItem. Its revision-1
worker completion was reviewed, persisted as decision
`988eb75cb1cc1b262be02eeb`, and delivered through stable PendingAction attempt
`1`, which recorded `accepted` at `2026-07-17T10:50:17.771Z`. The planner then
satisfied the distinct application postcondition at `10:50:28.594Z` and moved
the same WorkItem to revision `2` waiting on exact run `172669197`.

A stable compatibility shadow at `13:55:10Z` projected two historical
review-application deliveries as `accepted` (not merely pending), and both
still matched unapplied-review invariants. This confirms the accepted versus
satisfied distinction across old rows while the new receipt format waits for a
revisioned live specimen.

Supervisor review redelivery is now enabled for the same bounded V2 cohort via
`pendingActionRedeliveryV2: review-application-revisioned`.
The task reviewer and watchdog share one reviewer-ledger adapter and the same
`deliverPendingActionV2` policy. A fixture starts from accepted attempt `1`,
proves the supervisor emits exactly one attempt `2` receipt, and retains the
two-attempt budget. The manifest selects only application redelivery; it does
not enable the broader `review-handoffs-revisioned` mode, so completion-to-review
authority is unchanged.

Completion-to-review immediate delivery is now source-armed in the same way,
behind handler mode `pendingActionV2: completion-review-revisioned`. It applies
only when task revision is positive and `controlPlaneVersion` is `2`; the app
manifest now sets this mode after application delivery and application-only
redelivery passed their gates. The worker first persists
the normal completion fact and moves the task to review, constructs the stable
completion action from that source, dispatches through `deliverPendingActionV2`,
then records the generic accepted/failed receipt in the task completion trace.
The snapshot projects accepted transport separately from the matching reviewer
decision postcondition. Fixtures cover accepted delivery, injected failure,
accepted replay suppression, a two-attempt V2 policy, revision-0/non-V2
exclusion, and live snapshot projection. Supervisor completion redelivery
is also source-armed behind the combined default-off mode
`pendingActionRedeliveryV2: review-handoffs-revisioned`. That mode uses the
same task-owned receipts and runner for no-receipt, failed-attempt, and
accepted-but-unsatisfied recovery, and stops at the shared two-attempt budget.
The existing `review-application-revisioned` mode remains application-only.
Immediate completion delivery is enabled independently, while the broader
completion redelivery mode remains absent from the live manifest.

The first post-cutover runtime check also exposed a separate compatibility
writer: `blocked.overdue-unworked-count` classified the open registry-owned
Condition for run `172669197` from its stale compatibility `fallback_at`, and a
metric-triggered planner created
`ops/repair-overdue-condition-followup-ado-172669197-20260717` even though the
Condition fallback was already acknowledged and its next exact observation was
scheduled. The metric now excludes a task/revision owned by a registered
Condition and leaves due observation, fallback delivery, acknowledgement, and
resolved-still-blocking failures to ProjectSnapshot V2 invariants. A regression
fixture covers the acknowledged open-Condition case; the live metric returned
`0` offenders after the correction.

The implementation review found and closed one timing race before that gate is
enabled. A reviewer decision is now projected as a pending action immediately,
but `review-decision-not-applied` is not an invariant until five minutes after
the decision timestamp. The action `dueAt`, snapshot invariant gate, supervisor
capture, immediate reviewer path, and watchdog redelivery path use the same
application-grace value. This is separate from the 15-minute
completion-to-review grace: one bounds normal reviewer delivery, while the
other lets a healthy planner apply an already-delivered decision before
recovery competes with it. Fixtures prove that the action remains observable
during grace, no supervisor claim/redelivery occurs during grace, and the same
unchanged decision becomes claimable after grace.

The known read-consumer timing mismatch is also closed. The
`review-not-applied` metric now consumes the same `ProjectSnapshotV2`
invariant and five-minute application deadline as the supervisor. Revision-0
manual-repair coverage remains an explicit compatibility suppression, while a
revisioned V2 finding cannot be hidden by a prose/reference heuristic. The
former shared grace variable was split: review application uses
`AKS_RP_E2E_REVIEW_APPLICATION_GRACE_MS`; terminal task-worker sessions use
the independent `AKS_RP_E2E_TERMINAL_SESSION_GRACE_MS`. The old
`AKS_RP_E2E_REVIEW_APPLY_GRACE_MS` name remains a read-only fallback for
deployment compatibility.

Reviewer-ledger projection is now one shared adapter as well. Runtime snapshot
capture, watchdog recovery, metrics, and the CLI live-shadow capture all use
`snapshotReviewsFromRuntimeReviewerRowsV2` over the common reviewer-ledger
reader. The duplicate CLI receipt parser was removed. A fixture projects a
revisioned pending decision plus accepted receipt through both CLI and runtime
capture and requires identical review and `PendingActionV2` results. This
removes a second place where compatibility acceptance or receipt-attempt
semantics could drift.

The post-correction live read-only capture at `14:17:52Z` had stable inputs,
exact current-frontier parity, matching health counts, and `3/3` controller
parity. It projected one in-grace unknown completion handoff, two pending
completion handoffs, and four accepted review-application handoffs. Three of
the four accepted applications were overdue findings; the fourth remained
visible without an invariant during grace. The live active/review frontier
still had no task with both positive revision and `controlPlaneVersion: 2`, so
this is timing evidence for the read model, not the natural immediate-delivery
canary. The redelivery manifest gate therefore remains off.

After the metric migration, a stable live capture at `15:25:12Z` again had
exact frontier parity, matching health counts, `3/3` controller parity, and
stable inputs. It contained no unapplied-review invariant; the independently
sampled review-not-applied metric also returned `0`. Three missing-review
findings remained ordinary completion-to-review obligations and are not
affected by the application-grace change.

The first live shadow after adapter consolidation at `15:49:01Z` had stable
inputs, exact frontier parity, matching health counts, and `3/3` controller
parity. It projected one accepted in-grace review application with no premature
unapplied invariant. The only positive-revision active/review task still lacked
`controlPlaneVersion: 2`, so writer gates remain unchanged.

The first live shadow after source-arming completion delivery at `16:08:37Z`
also had stable inputs, exact parity, matching health counts, and `3/3`
controller parity. Because the manifest gate is absent, live completion actions
remained compatibility projections (`unknown` in grace and `pending` after
grace) with no new source receipts or writer behavior. The only
positive-revision active/review task still had `controlPlaneVersion: 0`.

After source-arming combined supervisor redelivery, the stable retry at
`16:19:14Z` again had exact parity, matching health counts, and `3/3`
controller parity. The manifest still contained neither completion immediate
delivery nor any pending-action redelivery mode, so the live handoff mix stayed
compatibility-only and no task-owned completion receipt was created.

Exit: normal feedback survives process interruption without watchdog fact
reconstruction or an LLM wake.

#### Transfer 2 — Complete One Revisioned Work Loop

- create one natural revision-1 WorkItem at the normal entry point;
- prove assignment -> worker -> completion -> reviewer -> atomic review
  application -> successor/revision under duplicate and stale event replay;
- induce or replay both missing-review and unapplied-review delivery failures;
- retire the matching compatibility recovery branches only for that cohort.

Exit: the complete revisioned loop has one writer at every transition.

#### Transfer 3 — Converge Objective Supervisor Invariants

Migrate independently: terminal attempt missing completion, assignment delivery
missing, stale/dead active attempt, resolved Condition still blocking, and
controller record unrepresented. For each class require source coverage, a
stable key, one safe action, a postcondition, a bounded owner boundary, replay
fixtures, and deletion of its old writer.

At this transfer, replace the watchdog early-return chain with bounded fair
reconciliation across due invariant lanes.

Exit: repeated observations change occurrence/age only; they do not create
duplicate events, owner wakes, or repair WorkItems.

#### Transfer 4 — Expand Condition Families

- migrate future exact pipeline waits in bounded batches;
- add explicit dependent WorkItem references before any shared Condition
  family;
- then migrate approval, credential/permission, narrow capacity, and shared
  environment families one at a time;
- require exact cause keys, resolution evidence, observer policy, fallback,
  fan-out replay, and rollback for each family.

Exit: a blocked WorkItem references a Condition; the wait itself is no longer
modeled as executable work or generic blocked-frontier owner work.

#### Transfer 5 — Converge Controllers And Schedules

- project controller lanes only from their owning ledgers;
- make pulses generation/due-work aware and preserve manual pulse;
- retire completed-lane no-op pulses, copied root progress, rollup repair,
  scheduled blocked-frontier review, and recovery behavior from heartbeat;
- retain one supervisor invariant for genuinely unrepresented ledger work.

Exit: controllers reconcile domain ledgers, while the supervisor reconciles
process invariants; neither performs project strategy.

#### Transfer 6 — Cut Over And Delete Compatibility Authority

Use the bounded writer-free window already defined by the design. Drain or
manifest active revision-0 work, buffer external events, checkpoint correlations,
switch one family atomically, replay buffered events, run one end-to-end canary,
and retain rollback data for the observation window.

Exit: one writer owns each state class, compatibility views are output-only,
and obsolete schedules, repair branches, and copied trace fields are removed.

## Applied Result

Gate A now distinguishes unavailable sources from authoritative empty sources.
Attempt and review projections become `unknown` when their required inputs are
unavailable, and invariant emission is gated by an explicit per-type source
requirement map.

Per-attempt controller heartbeat facts now carry task id, task revision,
attempt id, session id, workflow, and heartbeat time. A heartbeat can keep work
alive only when task, revision, attempt, and compatible session identity match.

The first derived-readout migration is also source-complete:

- health and readout both derive the global frontier from `ProjectSnapshotV2`;
- selected task/process frontier metrics derive runnable, active, review, and
  blocked leaf identity from the same snapshot;
- planner packets carry the snapshot version, source tree timestamp, full
  frontier counts, snapshot-derived frontier ids, and bounded task details;
- Kanban cards use the same root-reachable snapshot frontier while retaining
  the existing blocked-versus-review column policy and escalation fields;
- readout reports snapshot version and source tree timestamp;
- stored root/focus active, review, waiting, and runnable arrays no longer
  select or hide global live work;
- blocked focus lineage remains presentation metadata validated against the
  snapshot blocked set;
- deterministic readout-repair suppression remains as a compatibility
  projection rule.

A stable live read-only capture after the consumer migrations had full source
coverage, exact
active/review/runnable/waiting parity, health count parity, and 3/3 controller
parity. Legacy blocked-frontier comparison remained compatible after ignoring
one structural controller parent and accounting for the legacy 20-item cap.
Remaining findings were objective handoff cases: terminal active attempts,
review decisions pending application, and a missing review delivery. Captures
that overlapped a live tree write correctly reported concurrent input change
instead of claiming a stable generation.

Verification after the controller-lane and terminal-attempt shadow changes:

```text
app regression suite with localhost permission: 558 pass, 0 fail
planner + task-tree-tools: 184 pass
snapshot + supervisor + watchdog: 83 pass
feature page: 4 pass
Bun bundle: 35 modules
```

The full parallel suite exposed a time-based metrics fixture whose three
subprocesses could outlive the one-second stale-session threshold. The fixture
now keeps its unrelated active repair session fresh for the assertion window;
the focused metrics suite and the full suite both pass.

## What Is Implemented

| Capability                      | Source implementation                | Runtime status                                                                                                                   | Review result                             |
| ------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Deterministic project snapshot  | Complete and fixture-tested          | Live read authority for selected consumers                                                                                       | Keep                                      |
| Revision-safe attempts/reviews  | Complete in SDK and app envelopes    | Exact-spec creation canary armed; revision 0 drains                                                                              | Keep compatibility split                  |
| Atomic structured follow-up     | One `task-tree-followup` canary      | Live only for a fully structured action                                                                                          | Keep bounded canary                       |
| Multi-phase continuation        | One revisioned fix-forward family    | Code path live; retain bounded scope                                                                                             | Observe before generalizing               |
| Exact ADO Condition             | One revisioned single-subject family | Run `172480751` passed terminal continuation; run `172493879` passed due observation, scheduled exclusion, and fallback dispatch | Terminal and fallback canary gates passed |
| Shared health frontier          | Health reads V2 frontier             | Live                                                                                                                             | Complete first read consumer              |
| Derived project readout         | V2 global frontier implemented       | Live; compatibility mirrors remain output-only                                                                                   | Continue deleting mirror authority later  |
| Project supervisor              | Two-stage review-handoff canary      | Live only for explicit V2 cohort plus revision/attempt correlation                                                               | Observe a naturally broken handoff        |
| Terminal-attempt supervisor     | Classified exact-terminal policy     | Shadow-only; legacy recovery is sole writer                                                                                      | Await three live outcome classes          |
| Shared Condition families       | Not implemented broadly              | Legacy blocked families remain; one exact registry entry                                                                         | Defer until exact-run canary completes    |
| Controller projection           | Explicit planner controller lane     | Live; WorkItem frontier remains leaf-only                                                                                        | Keep separation                           |
| Controller/schedule convergence | Not implemented                      | Repeated pulses and rollup repairs remain                                                                                        | Defer until Conditions represent waits    |

## Live Evidence

A stable read-only capture observed:

```text
total=135 leafTotal=131
active=1 review=3 blocked=125 runnable=0 waiting=0
health count parity=true
controller parity=3/3
stored mirror parity: active=false review=false waiting=true runnable=true
```

The capture found one `active-attempt-missing` invariant and three
`review-decision-not-applied` invariants. The review findings are useful live
examples of a broken feedback handoff. The attempt finding exposed a snapshot
input gap instead of a safe recovery signal: the egress verifier had a fresh
heartbeat in the spec-loop ledger, but the snapshot only inspected task-local
workflow progress and runtime sessions.

The planner log also still shows repeated parent/controller rollup repairs on
ordinary review wakes. This confirms that the new read model exists but the old
control-plane amplification has not yet been retired.

### Live checkpoint after controller-lane separation

A generation-stable capture at `2026-07-16T07:31:05Z` observed:

```text
total=136 leafTotal=133
active=2 review=3 blocked=126 runnable=0 waiting=0
health count parity=true
controller parity=3/3
stored mirror parity: active=true review=true waiting=true runnable=true
```

Assignment-log coverage was unavailable, so attempt state correctly remained
`unknown` where the runtime session alone was insufficient. Review coverage was
available. The capture found one revision-1 review decision pending application
and two revision-0 compatibility findings. The revision-1 redo was applied by
the normal planner path at `07:31:18Z`, moving the task to a fresh active
attempt before the supervisor needed to recover it. No supervisor recovery
record was created. This is the desired priority order: normal delivery wins;
the supervisor acts only after the postcondition remains broken.

The terminal-attempt shadow gate is present in the live manifest, but no
natural V2-cohort candidate has yet produced a
`project_supervisor_terminal_attempt_shadow_v2` journal row. A revision-1
artifact-review attempt completed normally at `07:34:32Z` and its review was
accepted at `07:35:59Z`; because ordinary worker bookkeeping moved it out of
active state, no recovery candidate existed. This confirms normal completion
still wins but does not satisfy the terminal-recovery shadow gate.

The first shadow implementation incorrectly treated the drained assignment
outbox as required terminal-attempt history. Exact terminal facts now require
only tree plus session coverage; missing/stale negative conclusions still
require session and controller-liveness coverage. Shadow journaling now
classifies actionable success, success without actionable evidence,
provider/error, and other terminal outcomes, including non-candidates.

The exact ADO Condition writer now has its own fail-closed
`conditionV2: exact-ado-revisioned` mode at the command, planner, and watchdog
boundaries. With the mode off, an existing Condition-backed task is frozen and
excluded from legacy mutation. The app manifest explicitly opts in only the
planner, fast review applier, and watchdog. Live watchdog and planner rows at
`07:43:59Z` through `07:44:58Z` carried the mode. After the natural candidate
run passed, one exact compatibility wait was adopted through an additional
default-off, exact-task migration gate. At `08:48:38Z`, task
`wait-egress-lockdown-windows-baseline-ado-run-172480751-result` moved from
revision `0` to revision `1`, gained `controlPlaneVersion: 2`, and registered
`condition:pipeline:ado:172480751:terminal`. At `08:48:39Z`, the watchdog
observed run `172480751` as `inProgress` through the Condition path. The old
wait writer did not act.

The live canary then exposed a second-writer overlap. Its compatibility blocker
retained an expired `resume_at`, so the legacy overdue-wait path included the
otherwise healthy Condition in a `watchdog-blocked-frontier-review` owner wake
at `09:00:23Z`. The owner left the wait unchanged after re-observing it as live,
but the unnecessary LLM hop proved that Condition observation alone had not
converged feedback ownership.

The correction now excludes exact open V2 Condition subjects from legacy
overdue and blocked-frontier decisions while preserving them in health/readout.
Adoption and observation delete compatibility `resume_at`; the live `09:10:28Z`
observation advanced the Condition to the next check with status `inProgress`
and no stale resume timestamp. No later owner wake through `09:23Z` cited the
Condition as overdue.

`project.test_run.completed` and watchdog polling now resolve the same exact
Condition command and use the same durable continuation. Resolution records the
external fact even when the subject projection drifted; when the exact V2
subject can reconcile, it creates a stable
`condition-continuation:<condition>:<revision>`, assigns the artifact-review
attempt, and places it in the existing assignment outbox. Planner and watchdog
delivery now peek that outbox and acknowledge only accepted dispatches. A
dispatch exception leaves the exact revision/attempt/session row for replay.

An overdue nonterminal Condition now claims one stable
`condition-fallback:<condition>:<revision>` action under a lease and emits one
structured owner fallback. It no longer falls through to generic blocked-frontier
review.

Run `172480751` became terminal `completed/failed` at `09:22:49Z`. Watchdog
polling resolved the Condition at `09:27:17Z`, before fallback, and atomically
recorded its durable continuation. Capacity was full, so the task remained a
truthful pending continuation until `09:31:29Z`; the next planner delivery pass
assigned the exact revision-1 task without an owner-planning hop. The worker
started at `09:31:40Z`, recorded the exact cluster-create error result at
`09:33:19Z`, review was accepted at `09:35:00Z`, and the task was archived at
`09:35:41Z`. The terminal path therefore passed; live overdue-fallback behavior
still needs a naturally overdue canary.

One remaining overlap appeared immediately before terminal observation: the
two-hour scheduled blocked-frontier review at `09:26Z` still received the open
Condition subject in its generic packet and created a redundant egress refresh
task. The planner packet now publishes `condition_owned_task_ids`, excludes
those tasks from owner-actionable blocked details and warnings, and explicitly
forbids scheduled/metric/heartbeat refresh or replacement work for them. This
projection correction is fixture-tested but needs the next open Condition for
live confirmation.

The one-time `conditionAdoptionV2` task/run selector was removed after archival;
the generic adoption command remains default-off.

A source review after the first canary found five remaining convergence seams.
The watchdog discovered V2 waits through the capped legacy blocked-task scan,
queried runs before `nextCheckAt`, could not execute fallback when ADO access was
unavailable, and recognized V2 ownership only while its writer gate was on.
Planner prompt compaction removed Condition subjects from blocked arrays but not
from `blocked_frontier_summary`; resolved Condition history could also crowd a
pending continuation out of the first 20 assignment candidates.

The corrected path now:

- discovers exact V2 waits from the Condition registry before legacy waits;
- treats the compatibility blocker as projection, not observer authority;
- resolves pipeline access only when a Condition is due;
- records unavailable observation and still claims a due fallback;
- recognizes V2 ownership independently of writer enablement;
- recomputes the complete owner-actionable blocked summary without Condition
  subjects;
- processes pending continuations before assigned history;
- handles duplicate terminal events as deterministic resolved replays; and
- revision-checks resolved-Condition invariants before future reconciliation.

At `10:29:32Z`, exact wait
`wait-egress-lockdown-windows-baseline-ado-run-172493879-result` was adopted by
the default-off generic command into revision `1` and
`condition:pipeline:ado:172493879:terminal`. Its first due watchdog observation
at `10:33:18Z` read the registry-backed run as `notStarted`, advanced only
`nextCheckAt` to `10:43:18Z`, preserved the `11:49:33Z` fallback, and left the
exact task blocked. Scheduled-review exclusion and the eventual terminal or
fallback path remain under live observation.

A watchdog at `10:38:22Z`, before the next check, processed four other terminal
legacy waits while leaving this Condition's `lastObservedAt` unchanged at
`10:33:18Z`. This is live proof that V2 observation is due-driven rather than
performed on every watchdog tick. A scheduled regular-learning planner wake
also left the Condition subject untouched; the specific two-hour
blocked-frontier schedule remains the stronger outstanding exclusion gate.

The next eligible watchdog at `10:44:07Z` observed the run still `notStarted`,
advanced `nextCheckAt` by exactly ten minutes to `10:54:07Z`, preserved the
original fallback, and emitted no owner wake or replacement work. This proves
the normal open-Condition loop across more than one live cycle: early ticks are
suppressed and due ticks perform one bounded observation.

A later `10:49:37Z` watchdog emitted a generic blocked-frontier owner wake for
unrelated legacy work without including or mutating the Condition subject. At
`10:55:22Z`, the third eligible observation again found `notStarted` and moved
only `nextCheckAt` to `11:05:22Z`. This proves both generic-watchdog ownership
exclusion and repeatable due-only observation in the live runtime.

The fourth eligible tick at `11:05:58Z` again observed `notStarted`, advanced
only `nextCheckAt` to `11:15:58Z`, and produced no owner, review, or continuation
traffic. The external run is now a genuine long queue wait while the V2 control
loop remains stable.

The next due boundary exposed scheduler priority rather than a Condition defect.
At `11:16:30Z`, watchdog recovered a completed active task and returned before
Condition harvesting, delaying the due `11:15:58Z` observation by one tick. The
following watchdog caught up at `11:22:27Z`, performed exactly one `notStarted`
observation, and advanced `nextCheckAt` to `11:32:27Z`. The live guarantee is
therefore eventual bounded reconciliation under competing recovery work, not
exact wall-clock execution; no starvation occurred.

The natural two-hour blocked-frontier schedule emitted event `3315831` at
`11:32:49Z`. Its planner workflow began at `11:37:14Z` with the intended V2
entry hash. The compact packet listed the exact wait only under
`condition_owned_task_ids`, removed it from owner-actionable blocked data and
the blocked-family summary, and told both owner steps that the Condition alone
owns observation, fallback, resolution, and continuation. The planner created
unrelated scenario-normalization work, but did not refresh, replace, unblock,
close, or create recovery work for the Condition subject. The task remained
blocked at revision `1`; its journal had no post-adoption owner mutation. Due
watchdog observations at `11:33:03Z` and `11:45:01Z` advanced only
`nextCheckAt`. The scheduled-review exclusion gate therefore passed; natural
fallback after `11:49:33Z` remains the final live gate for this canary while the
run is nonterminal.

The `11:49:15Z` watchdog tick arrived eighteen seconds before the deadline and
correctly did not claim fallback. At `11:55:42Z`, the next tick observed the
same run as `inProgress`, claimed exactly one
`condition-fallback:condition:pipeline:ado:172493879:terminal:1`, and dispatched
exactly one `condition-overdue-fallback` owner event. The Condition retained the
original deadline, task revision, and blocked state; no generic
blocked-frontier event was emitted by that tick. The journal contains one claim
and one dispatch with `attempts: 1`. This passes the live fallback ownership and
deduplication gate. The owner disposition is still a downstream postcondition,
which supports the design correction that accepted dispatch should eventually
be tracked separately from completed fallback handling.

At `12:09:06Z`, before the mutation guard was installed, an unrelated metric
planner generically refreshed the Condition subject. It moved the compatibility
blocker's `next_check_at` to `14:15Z` and `fallback_at` to `18:15Z`, while the
authoritative Condition retained its due observation and original
`11:49:33Z` fallback. This is direct live proof that prompt exclusion is not an
authority boundary. Later Condition observations restored `next_check_at`, but
the first projection implementation did not restore `fallback_at`, exposing a
second partial-projection defect.

The task-store save boundary now invokes a project-neutral atomic mutation
validator. The AKS adapter rejects changes to an open Condition, its exact task
revision, or both unless the caller carries one of the enumerated correlated
Condition actions. Observation and fallback claim now reproject the complete
compatibility policy (`next_check_at`, `resume_condition`, `fallback_at`,
`fallback_action`, observer, and last observation) from the Condition.

Fallback acknowledgement is also crash-aware. The planner validates the exact
event immediately but records acknowledgement only after both owner-planning
steps return. An interrupted planner leaves the action dispatched and therefore
replayable. An unacknowledged dispatch receives at most two redeliveries after
15-minute acknowledgement grace windows; a third miss exhausts the bounded
automatic delivery budget. This is still a family-local implementation, not yet the
common pending-action primitive from Transfer 1.

The hot-loaded hardening received a live watchdog tick at `12:40:08Z`. It
reprojected the blocker fallback from the unauthorized `18:15Z` value back to
the Condition's `11:49:33Z`, preserved the original recovery key, and performed
the single bounded redelivery as attempt `2`. This proves complete
compatibility-policy reprojection and stable-key redelivery.

That same tick exposed a due-gate bug: after fallback dispatch,
`pipelineObservationDue` correctly ignored the expired fallback until
`nextCheckAt`, but the harvest loop still entered the fallback branch and
recorded an artificial unavailable observation without acquiring pipeline
access. The harvest loop now applies the same due predicate before terminal,
fallback, or observation transitions. A regression fixture proves an early
post-fallback tick changes neither `lastObservedAt` nor `nextCheckAt`.

Runtime delivery tracing then showed why neither the original nor first
redelivery was acknowledged: both `project.owner.requested` events were accepted
by the generic cron/owner route but remained `pending` with no workflow run or
session. The first had remained pending since `11:55Z`, alongside a larger
generic owner-event backlog. Redelivery into the same lane therefore did not
improve the postcondition.

Fallback delivery now uses the typed
`project.condition.fallback.requested` event and a dedicated single-concurrency
planner handler. The planner retains legacy `project.owner.requested` parsing
only for already-buffered events. The pending action still uses the same
recovery key and bounded attempts; only its delivery lane changed. Live
acknowledgement through the dedicated handler was the remaining canary gate.

Typed canary event `3320112` closed that gate. Runtime delivery marked it
`accepted` by the direct cron route, started and completed handler
`aks-rp-e2e-condition-fallback-planner`, and closed planner workflow
`wr_1784206975931_fsaf` after both owner-planning sessions completed. The
Condition then recorded
`project_condition_fallback_acknowledged_v2` at `13:06:35Z` under the original
stable recovery key and retained `attempts: 2`. The external run independently
became terminal at `13:01:24Z`; the watchdog resolved the Condition and assigned
its durable continuation before fallback planning acknowledged the older wake.
This ordering is important: the fallback handler safely reconciled a stale
event against current state, did not create another polling wait, and still
closed the delivery obligation.

The snapshot now projects `fallbackExecution` and emits the stable invariant
`condition-fallback-delivery-overdue` once a dispatched action passes its
acknowledgement deadline. It is a warning while retryable and becomes critical
at three attempts. Acknowledgement closes the finding; resolution of the
external Condition alone does not, because an already-dispatched stale wake
must still be reconciled and acknowledged. This makes the postcondition visible
without treating transport acceptance as recovery success.

A read-only live capture at `13:25:22Z` emitted no fallback-delivery finding
after acknowledgement. Its remaining findings were three terminal-attempt
handoffs, one unapplied reviewer decision, and one missing-review delivery. One
terminal attempt was revision `1`; the review findings were compatibility
revision `0`. The capture observed concurrent tree/controller updates and is
therefore not a parity gate, but its finding mix supports the next ordering:
converge normal pending handoffs before broadening supervisor or Condition
authority.

The concrete fairness defect is also removed: terminal-session completion
recovery no longer returns before due Condition reconciliation. Both bounded
lanes execute in one watchdog tick, and the result reports both actions. A
combined fixture recovers a terminal active attempt and advances a due exact
Condition in the same invocation. Broader multi-lane fairness remains part of
Transfer 3.

Latest hardening verification:

```text
current focused completion/redelivery suite: 155 pass
pending-action + ProjectSnapshot V2 suites: 29 pass
app syntax bundle: 38 modules
current complete app suite with localhost permission: 615 pass
prior complete May-agent SDK suite: 137 pass
prior SDK typecheck: pass
scoped diff checks: pass
```

The exact Condition authority transfer is live-closed for this cohort: complete
projection repair, stable attempt-2 redelivery, dedicated-handler execution,
durable acknowledgement, terminal resolution, continuation assignment, review,
and archival were all observed under the same Condition and task revision.

The app-wide TypeScript check reaches only unrelated, concurrently changing
state-repair scripts; Work Graph V2, metric convergence, and
Condition-specific type errors are cleared.

The missing natural entry path is now bounded rather than solved by revising
all new work. SDK task creation accepts an explicit non-negative
`initialRevision` while retaining revision `0` by default. The planner
recognizes `revisionV2: fix-forward-exact-spec` plus one exact spec id and
creates only that spec's future non-pass fix-forward task at revision `1`. The
live manifest first selected `spec.rp-cluster-lifecycle.stop-start` and then
`spec.node-pool-config.ephemeral-disk`; both returned live passes and therefore
correctly created no fix-forward work. The selector is now bounded to repaired
batch run `172484121`: at most the lexicographically first non-pass spec from
that exact run starts at revision `1`, while any other results remain revision
`0`. No revisioned fix-forward successor has yet been created, so this remains
an armed entry canary rather than completion evidence. A live planner row at
`08:09:14Z` carried the exact run selector while the run-return task remained
active.

Run `172484121` later completed successfully and all four returned per-spec
artifacts passed, so it correctly produced no fix-forward canary. Its legacy
wait path exposed a real information-loss failure: an in-progress result became
a generic `blocker.resolved` successor without exact ADO correlation, and an
owner recovery task was needed after terminal completion. This justified the
controlled run `172480751` adoption and completed terminal observation.

Exact run `172519985` later completed as a one-spec live pass, and the selector
correctly created no V2 fix-forward work. The selector was disarmed while no
unreviewed exact candidate existed, then moved to exact single-spec run
`172659069` after that run became terminal failed but before its terminal result
review. Live planner runs from `wr_1784282741458_zg1r` onward carried
`revisionV2RunId: 172659069`.

The first accepted terminal review for `172659069` did not create a successor
and exposed a real entry defect: `acceptedSpecVerifierResults` preferred
`workflowResult.subject.id` even when the subject kind was `task`, ignoring the
canonical `details.specId`. It therefore tried to update the spec ledger using
the task id and silently produced no accepted spec result. The parser now uses
`details.specId` first and accepts `subject.id` only for `subject.kind=spec`; a
live-shaped regression fixture creates the expected revision-1,
`controlPlaneVersion: 2` successor. The selector remains bounded to `172659069`,
and a fresh natural review application is still required for live proof.

After the parser correction, the selector briefly moved to queued exact run
`172661596`, then moved to exact single-spec run `172653860` when that run's
natural terminal artifact-review task became active before any accepted result.
Neither task was adopted or rewritten. Its non-pass result created task
`fix-traffic-azure-service-mesh-vm-prerelease-addonv2-cni-matrix-run-172653860`
at revision `1` with `controlPlaneVersion: 2`. The revision completed naturally,
its review application passed the immediate-delivery canary, and the planner
advanced that same WorkItem to blocked revision `2` with exact terminal
Condition `condition:pipeline:ado:172669197:terminal`. The spent exact-run
creation selector is now absent from both planner handlers, preventing another
unintended V2 entrant while the existing WorkItem continues normally.

The review delivery crash boundary is also narrower. If a V2 reviewer decision
was persisted and dispatch succeeded but its receipt was lost, replay now reuses
the first exact task/revision/attempt decision instead of invoking the reviewer
again and potentially creating a second payload. A fixture removes the accepted
receipt, replays the completion, and proves one reviewer invocation, one durable
decision row, stable-key redelivery, and two transport dispatches.

Canary-created work now carries `controlPlaneVersion: 2`. Revision remains the
intent version and no longer grants supervisor authority by itself. Every V2
writer requires both its default-off family mode and the explicit task cohort.

The WorkItem frontier now stays leaf-only. Planner quick-refill unions that
frontier with a separate controller-lane projection and suppresses controllers
that are complete, held, externally waiting, or already represented by open
children. This fixes controller refill without making structural roots look
like ordinary domain work.

## Design Corrections Required By The Implementation

### 1. One snapshot must declare source coverage

`buildProjectSnapshotV2` currently accepts optional assignments, sessions,
reviews, loops, and delivery facts, then normalizes omitted inputs to empty
arrays. Empty and unavailable are not the same fact.

Add explicit coverage to the snapshot envelope:

```typescript
coverage: {
  tree: "available";
  assignments: "available" | "unavailable";
  sessions: "available" | "unavailable";
  reviews: "available" | "unavailable";
  controllerLiveness: "available" | "unavailable";
  delivery: "available" | "unavailable";
}
```

Only emit an invariant when all sources required by that invariant are
available. Health and readout may consume a tree-complete frontier snapshot.
The supervisor must reject a snapshot that lacks the sources required by its
policy.

This preserves one snapshot API without pretending every consumer captured the
same runtime facts.

### 2. Per-attempt controller liveness must be an input

Controller aggregate status is insufficient for active verifier/compact
attempts. Add exact task/revision/attempt heartbeat facts from the owning loop
ledgers. Attempt reconciliation should use:

```text
matching running session
  OR matching fresh task/revision/attempt controller heartbeat
  OR matching assignment within start grace
```

A controller heartbeat for a different attempt must not keep current work
alive.

### 3. `current_root_readout` cannot select the frontier

The current readout sync still reads active/review/waiting/runnable arrays from
`current_focus_proposal` and `current_root_readout`. It validates the referenced
task states, but a stale or corrupted allow-list can still hide live work.

For Slice 6:

- global frontier identity and counts come only from the snapshot;
- readout-repair leaves may be excluded by a deterministic projection rule;
- legacy root arrays are generated compatibility output, never input;
- a focus proposal may select presentation lineage only after every id is
  validated against the snapshot; it cannot change global frontier truth;
- any scope that affects work ownership must become explicit WorkItem/mission
  intent rather than readout metadata.

### 4. The first supervisor canary should cover the complete review handoff

The original first canary covered only a completion claim with no reviewer
decision. Live evidence currently shows the adjacent failure: a reviewer
decision exists but has not been applied.

Treat these as two distinct invariants under one review-handoff policy:

```text
claim without decision
  key=review-missing:<task>:<revision>:<attempt>
  action=one completion/reviewer-delivery re-emission

decision without application
  key=review-apply-missing:<task>:<revision>:<attempt>:<decision-id>
  action=one reviewed-event/application re-emission
```

Each action has its own postcondition and budget. Neither case should create an
ops repair WorkItem. Provider failure remains an attempt/runtime fact, not a
delivery invariant.

## Next Implementation Breakdown

### Gate A — Snapshot contract hardening (implemented in source)

Expected changes:

- add source coverage and required-source gating;
- add task/revision/attempt controller heartbeat inputs;
- add false-positive fixtures for unavailable sessions and fresh verifier
  heartbeat;
- preserve current frontier and Condition parity.

Problem resolved: the supervisor and consumers cannot act on a false negative
created by an incomplete capture.

Exit gate: every invariant type declares and tests its required sources.

### Gate B — Finish Slice 6 read convergence (implemented in source)

Apply one consumer at a time:

1. health — already migrated; retain existing policy/signals;
2. readout — snapshot owns global frontier; mirrors become output-only;
3. selected metrics — migrate frontier and Condition completeness components;
4. planner packet — use the same snapshot generation and retain only
   app-specific presentation details;
5. UI/Kanban — consume projection output after planner parity.

The review-decision-not-applied metric now uses the snapshot
pending-action/postcondition projection. Terminal worker-session tolerance is
separately named and configured, so it cannot change the supervisor's review
deadline. Revision-0 historical repair coverage stays compatibility-only.

Problem resolved: health, metrics, readout, and planning stop disagreeing and
root-readout drift can no longer create repair work.

Deletion target: root/frontier parity repair generation and writable
`current_root_readout` authority. Do not delete historical repair scripts as
part of the behavioral cutover.

### Gate C — Review-handoff supervisor canary

Status: live for revisioned work and fixture-tested; revision `0` remains on
the compatibility path.

Applied changes:

- add the two typed review-handoff invariants and stable keys;
- persist one bounded action record per key;
- re-emit once and verify the matching postcondition;
- emit one structured owner packet only after the action budget is exhausted
  or the case is ambiguous;
- route fully correlated cases exclusively through the supervisor when review
  source coverage is available;
- preserve `recoverReviewCompletionsWithoutReviewer` for unavailable-source
  and no-attempt compatibility cases;
- preserve the matching planner recovery implementation for compatibility,
  while excluding V2-owned correlated tasks from its watchdog wake;
- remove the remaining compatibility branches only after replay/live parity.

Problem resolved: review feedback converges through one deterministic loop
instead of repeated watchdog emissions, planner recovery, and ops repair work.

The initial live policy acted on revision-0 work and exposed recycled terminal
attempt identities: old decisions could become current-looking after a newer
worker phase. The corrected policy limits V2 authority to revisions greater
than zero, requires decisions to be no older than the current review epoch, and
preserves the correlated stored workflow result on replay. Three revision-0
records created during the observation were resolved by the corrected run and
subsequent compatibility work remained on the legacy path. At `07:03Z`, a
full-coverage read-only capture reported zero supervisor-eligible findings.

### Gate D — Remaining objective supervisor invariants

Status: terminal-success attempt recovery is the first shadow-only attempt
invariant; the existing watchdog remains its sole writer. Exact Condition
terminal continuation, scheduled-review exclusion, overdue fallback dispatch,
typed fallback acknowledgement, and late/stale event reconciliation have passed
live. The canary Condition is resolved and its revision-1 subject completed,
reviewed, and archived.

Migrate independently:

1. assignment delivery missing;
2. terminal attempt completion missing;
3. dead/stale active attempt;
4. resolved Condition still blocking;
5. overdue Condition fallback — exact ADO canary implemented, broader families pending;
6. controller record unrepresented;
7. repeated planner timeout;
8. lossless structural repair.

Problem resolved: one writer and one recovery budget own each broken process
invariant. Normal failure, redo, waits, and domain judgment remain outside the
supervisor.

### Gate E — Condition families and controller lanes

The mechanical Condition-ownership mutation guard and fallback delivery
postcondition are now implemented and live-proven for the exact ADO cohort.
After the common pending-handoff primitive converges, migrate future exact wait
families in bounded batches, then project controller lanes directly from their
ledgers. Make scheduled pulses generation/due-work aware.

Problem resolved: wait tasks, no-op pulses, copied controller progress, and
blocked-frontier polling stop amplifying normal external facts.

### Gate F — Cleanup and cutover

Use a writer-freeze window:

1. stop new legacy assignments;
2. allow or explicitly disposition revision-0 active/review work;
3. capture a stable snapshot and compare all migrated consumers;
4. atomically switch the intended manifest mode/hash while handlers are frozen;
5. verify revision correlation, Condition resolution, and review handoff;
6. keep the compatibility reader for rollback while disabling replaced
   writers;
7. remove obsolete writers only after the observation window.

No live task rewrite is required. Compatibility revision 0 drains through the
existing paths until the corresponding family is explicitly retired.

## Review Gates

Do not proceed to supervisor mutation until:

- snapshot coverage is explicit;
- per-attempt controller liveness is correlated;
- a corrupted stored readout cannot change global frontier truth;
- health/readout report the same tree generation;
- stable replay covers both review-handoff failure stages;
- every hot-loaded writer is protected by a default-off family mode and the
  observed runtime handler content matches the intended manifest mode/hash.
