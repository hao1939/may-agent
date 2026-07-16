# Work Graph And Project Supervisor V2 — Implementation Breakdown

Status: implementation in progress; revisioned review-handoff canary is live

Progress:

- Slice 0: complete — deterministic replay manifest and baseline references.
- Slice 1: complete — stable live shadow parity, health/controller comparison,
  source fingerprints, and read-only verification.
- Slice 2: revision-safe envelopes are fixture-tested. Broad runtime cutover is
  deferred, while one exact-run single-successor creation canary is armed behind
  `revisionV2: fix-forward-first-nonpass-run` for repaired batch run
  `172484121`. At most the first deterministic non-pass result from that run
  starts at revision `1`; other work retains revision `0`. See
  `design/work-graph-v2-slice2-review.md`.
- Slice 3: first fully structured `task-tree-followup` command canary is
  source-complete and fixture-tested; incomplete actions remain compatible.
  See `design/work-graph-v2-slice3-review.md`.
- Slices 4–5: revisioned fix-forward → artifact-review phase and exact ADO
  Condition canary are fixture-tested. The exact Condition writer is live
  behind `conditionV2: exact-ado-revisioned`; its workflow default is `off`.
  After natural run `172484121` returned four passes, one exact-task adoption
  gate migrated run `172480751` to revision `1` and
  `controlPlaneVersion: 2`. Its Condition resolved live and its exact review
  continuation was accepted and archived. The canary exposed and corrected legacy overdue-wait
  overlap: exact open Condition subjects are no longer legacy blocked-frontier
  recovery candidates, stale compatibility resume timestamps are removed,
  overdue fallback has one stable claim, and terminal resolution uses a durable
  assignment continuation acknowledged only after dispatch. Run `172480751`
  completed failed, the Condition resolved through watchdog polling, its
  continuation waited safely for capacity, the exact revision-1 review task ran
  and was accepted, and the one-time adoption selector was removed. See
  `design/work-graph-v2-slices4-5-review.md`.
- Slice 6: source-complete — project health, project readout, selected
  task/process metrics, planner packets, and Kanban cards consume the V2
  frontier. Snapshot source coverage and task/revision/attempt-correlated
  controller liveness are implemented and fixture-tested. Runtime cutover
  remains deferred.
- Slice 7: review-handoff supervisor canary is live for revisioned work and
  fixture-tested. Compatibility revision `0`, unavailable review sources, and
  no-attempt terminal waits retain the legacy path. The watchdog manifest sets
  `supervisorV2: review-handoff-revisioned`; the safe workflow default is
  `off`.
- Slice 8: terminal-success attempt recovery is in shadow mode behind
  `supervisorAttemptV2: shadow`; the legacy recovery remains the sole writer.
- Slices 9–11: pending.

Current implementation review and refined next gates:
`design/work-graph-v2-current-implementation-review.md`

Companion design:
`design/work-graph-supervisor-v2.md`

## Outcome

Implement V2 as a sequence of behavior-preserving substitutions:

```text
shared read model
  -> revision-safe attempts/reviews
  -> one mutation command boundary
  -> exact pipeline Conditions
  -> narrow project supervisor
  -> shared Condition families and controller lanes
  -> remove duplicate projections, handlers, and repair paths
```

Do not implement the complete RFC in one change. Each slice must introduce one
authority, prove parity, switch one behavior, and retire its replaced writer.

## Current Implementation Map

### Generic SDK Task Store

Files:

- `../may-agent/packages/sdk/src/project-task-tree-store.ts`
- `../may-agent/packages/sdk/src/project-task-tree.ts`
- `../may-agent/packages/sdk/src/project-task-tree.test.ts`

Current responsibilities:

- permissive `TaskNode`/`TaskTree` schema;
- JSON normalization and compatibility states;
- file locking and atomic rename;
- parent/child and readiness projections;
- assignment creation and assignment JSONL outbox;
- active/session/attempt fields copied into task state;
- completion, review rejection, blocking, unblocking, rollup, and compaction;
- Kanban and planning-packet projections.

V2 disposition:

- **reuse** five task states, locking, atomic rename, assignment outbox,
  readiness primitives, and compatibility normalization;
- **add** `revision`, revision-aware assignment/completion, and typed command
  preconditions;
- **move out over time** session history, last attempt/reviewer trace, parent
  rollup mutation, and duplicated active IDs;
- **do not add app-specific Conditions or loop semantics to the SDK** until the
  app-local canary proves a reusable contract.

### App Task Semantics

Files:

- `workflows/lib/task-tree-tools.ts`
- `scripts/task-tree.ts`
- `workflows/lib/project-readout-sync.ts`

Current responsibilities:

- AKS-specific blocked-wait normalization;
- exact spec/feature representation checks;
- durable-loop root progress and reopen repair;
- parent-result and project-goal repair;
- archive/evidence updates;
- model-gap seeding;
- planner packet warnings;
- mirrored root/current-focus/project-state readouts.

V2 disposition:

- **extract** pure frontier/representation logic into `ProjectSnapshot`;
- **replace** blocked-wait mutation with Condition adapters;
- **replace** direct field mutations with a small command API;
- **derive** root/frontier/focus readouts;
- **delete after migration** rollup/readout repair and wait-refresh paths whose
  facts become projections or Conditions.

### Planner, Worker, And Reviewer

Files:

- `workflows/project-planner.ts`
- `workflows/task-worker.ts`
- `workflows/default-task-worker.ts`
- `workflows/task-reviewer.ts`

Current responsibilities:

- planner applies review decisions, creates successors, dispatches tasks,
  creates exact waits, seeds fix-forward work, repairs rollups, and handles
  watchdog/stall/metric reasons;
- worker routes one assigned task and writes active/review trace state;
- reviewer independently judges current review claims and returns structured
  events/actions.

V2 disposition:

- **reuse** independent reviewer and structured `reviewAction` contract;
- **add** task revision to assignment, completion, review, and proposed events;
- **make atomic** applying a review plus creating/revising its successor;
- **move** normal pipeline continuation into typed phase revision or verification
  work;
- **remove over time** reason-specific stale/no-op and recovery branches from
  the planner after supervisor migration;
- **keep** all domain correctness judgment outside deterministic code.

### Watchdog, Health, Metrics, And Stall Review

Files:

- `workflows/project-execution-watchdog.ts`
- `workflows/project-stall-review.ts`
- `scripts/project-health.ts`
- `scripts/project-metrics.ts`
- `workflows/lib/project-readout-sync.ts`

Current responsibilities overlap around:

- active/review/runnable/blocked frontier calculation;
- stale attempt and assignment detection;
- exact wait parsing and overdue wait actionability;
- loop representation and liveness;
- recovery task coverage;
- project root/current-focus parity;
- owner wake decisions.

V2 disposition:

- **share** one typed `ProjectSnapshot` and invariant result set;
- **retain** health formatting and metric thresholds as consumers;
- **narrow** watchdog into a deterministic supervisor;
- **remove** stall review as a separate lifecycle after unresolved supervisor
  packets reach planner directly;
- **remove** stored root-readout parity once all consumers use projections.

### Domain Loop Controllers

Files:

- `workflows/spec-loop-controller.ts`
- `workflows/feature-reference-loop-controller.ts`
- `workflows/feature-compact-loop-controller.ts`
- their loop-state stores under `workflows/lib/`

Current responsibilities:

- own feature/spec ledgers;
- reconcile task children and reviews;
- create blocked holders and support/fix tasks;
- maintain duplicated controller-root progress;
- poll/harvest pipeline waits;
- fill bounded windows.

V2 disposition:

- retain owning ledgers and bounded refill;
- use WorkItems and Conditions through the command API;
- stop copying progress history into controller-root task traces;
- project controller lanes from ledger state;
- stop pulsing completed lanes until source generation changes.

### Schedules And Routes

File: `app.ts`

Current relevant schedules/routes:

- five-minute watchdog;
- ten-minute pulse for all three controllers;
- two-hour blocked-frontier owner review;
- four-hour app-ops heartbeat;
- stall-review fallback;
- planner and fast reviewed-event queues.

V2 disposition:

- no changes during shadow phases;
- later make controller pulses generation/due-work aware;
- retire blocked-frontier review after Condition timers and supervisor parity;
- narrow heartbeat to focus/digest;
- retain planner, worker, reviewer, and explicit owner routes.

## Gap Matrix

| V2 requirement              | Current implementation                                                    | Gap                                                            | First implementation owner                       |
| --------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------ |
| One shared project snapshot | Health, metrics, watchdog, planner, and readout compute overlapping views | Semantics drift and duplicated code                            | App-local `workflows/lib/project-snapshot-v2.ts` |
| Work-item revision          | Attempt id only; current attempt stored in trace                          | Intent changes and phase changes are not mechanically isolated | SDK task store/tool                              |
| Revision-aware envelopes    | Assignment/completion/review identify task and attempt                    | Late events may target changed task meaning                    | SDK + worker/reviewer/planner adapters           |
| One phase/result schema     | Same task may move fix-forward → wait → artifact review                   | Prior payload is replayed into a different contract            | Planner continuation command + worker input      |
| Conditions                  | Blocker objects plus wait/hold tasks and trace refreshes                  | Waits are work nodes and duplicate observers                   | App-local Condition adapter first                |
| Stable recovery key         | Dedup is task/conflict/prose/lineage specific                             | Repeated signals create wakes/tasks                            | Supervisor invariant types                       |
| One mutation boundary       | SDK tools, app tools, controllers, watchdog, and many scripts lock/write  | Hard to prove authority and atomicity                          | V2 command adapter over current SDK              |
| One supervisor              | Watchdog + stall review + metrics + heartbeat + planner recovery branches | Overlap and repeated owner sessions                            | Narrowed watchdog after shadow parity            |
| Derived root/frontier view  | Stored in root context, focus context, project-state, Kanban, health      | Readout drift creates repair work                              | Shared snapshot consumers                        |
| Controller lanes            | Loop root tasks carry copied progress and rollup state                    | Controller/root drift and no-op pulses                         | Loop projection after Conditions                 |
| Bounded audit               | Task trace plus journal plus reviewer/planner logs                        | Payload growth and repeated evidence                           | Runtime refs + accepted phase result refs        |

## Slice 7 — Review-Handoff Supervisor Canary

### Current source implementation

| Layer               | Implemented change                                                                                                                                                                                                      | Problem resolved                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Runtime capture     | `project-snapshot-capture-v2.ts` reads the task tree, assignment log, session rows, authoritative successful reviewer rows, controller ledgers, per-attempt heartbeats, and delivery gaps with explicit source coverage | The watchdog no longer invents a missing review from an unavailable review source                 |
| Invariant policy    | `project-supervisor-v2.ts` persists separate recovery records for missing review delivery and unapplied review decisions                                                                                                | The two stages have stable, revision/attempt-correlated identities and independent postconditions |
| Action budget       | One automatic dispatch is recorded, followed by postcondition grace and at most one owner request; leases recover abandoned claims, while known dispatch failures consume the bounded action and remain explicit        | Repeated watchdog pulses cannot emit the same correlated recovery indefinitely                    |
| Watchdog adapter    | The watchdog replays either the exact completion fact or the exact stored reviewer row, then acknowledges the ledger only after dispatch                                                                                | Recovery reuses accepted runtime facts and does not ask an agent to rediscover them               |
| Compatibility split | Fully correlated revisioned reviews use V2 when the review source is available; revision `0`, no-attempt terminal waits, and unavailable review sources retain the legacy path                                          | The canary does not rewrite or strand compatibility work                                          |
| Legacy overlap      | `watchdog-review-pending` excludes V2-owned correlated review tasks but remains available for legacy/unidentified review tasks                                                                                          | One task has one recovery owner during the canary                                                 |

### Active canary behavior

For a review task with matching task revision and attempt:

1. no reviewer row after grace produces one `project.task.completed` replay;
2. a stored reviewer row with the task still in review produces one exact
   `project.task.reviewed` replay under a distinct decision identity;
3. duplicate watchdog ticks observe the recovery ledger and do not redispatch;
4. a satisfied postcondition resolves the record;
5. a known dispatch failure or an unsatisfied postcondition consumes the
   automatic budget and produces at most one structured owner request after
   grace.

Provider/reviewer failures, stale revisions, stale attempts, and decisions older
than the current review epoch are not treated as delivered decisions. Revision
`0` and tasks without a usable attempt identity remain on the compatibility
path.

### First live observation and correction

Workflow entrypoints are bind-mounted and hot-load on dispatch. The first live
observation therefore began before an explicit reload, disproving the prior
assumption that workflow-source edits were source-only until a later cutover.
An explicit `supervisorV2` mode gate is now required: `off` is the workflow
default and the app manifest opts this canary into
`review-handoff-revisioned` mode.

Between `2026-07-16T06:44Z` and `07:00Z`, the initial unrestricted policy
replayed three revision-0 decisions. Stable recovery keys prevented unlimited
identical replay, but two terminal-wait tasks demonstrated that revision-0
phase reuse is not safe enough for V2 authority: the same synthetic terminal
attempt id reappeared after newer worker attempts, allowing an older reviewer
decision to look current and cause redundant redo work. One case also reached
the bounded owner request before its newer review application completed.

The live correction did three things:

1. V2 claims only tasks with `controlPlaneVersion: 2` plus a positive,
   correlated task revision.
2. Reviewer rows must be at or after the current worker-completion or synthetic
   terminal-review epoch.
3. Replayed completion events preserve the correlated stored
   `workflowResult`; they do not manufacture a default result contract.

At `07:03Z`, a run with the corrected content hash resolved all three
revision-0 supervisor records and routed a terminal revision-0 wait through the
legacy path. At `07:05Z`, the manifest-explicit
`review-handoff-revisioned` mode ran with no V2 action and all revision-0
records still resolved. A read-only capture had full source coverage and zero
supervisor-eligible findings.

The same observation exposed a separate compatibility amplification: retained
terminal-review context bypassed reviewer grace for a fresh redo attempt,
duplicating a worker completion after twelve seconds. The legacy branch now
bypasses grace only when it actually creates the synthetic terminal attempt;
real redo attempts receive the normal review window.

The first scheduled pulse containing all corrections ran at `07:10:54Z` with
entry hash `76f48fdf9b759b5b699fd3348b0adc443f3490f8d1fc11f71e2837a33106d2b2`.
It emitted no completion, reviewed, or owner event, left all three historical
revision-0 records resolved, and performed only an unrelated nonterminal ADO
wait refresh. This proves the rollback boundary and duplicate suppression on
the observed frontier. It does not yet prove a naturally broken revisioned
handoff, so matching legacy recovery code must not be retired.

### Risks introduced by this slice

- Capture is generation-checked against the task tree, but the tree, reviewer
  JSONL, controller ledgers, and runtime database are not one atomic snapshot.
  Exact revision/attempt checks and stable keys bound this race; stable replay
  remains required before cutover.
- Dispatch acknowledgement means the local event dispatcher accepted the
  event, not that the downstream planner applied it. The second invariant and
  postcondition grace cover that boundary.
- The recovery registry currently lives in the compatibility tree, increasing
  root-state size. It is bounded by stable invariant keys but needs retention
  cleanup after the observation window.
- Runtime capture adds read I/O to each watchdog pulse. It is bounded to the
  referenced sessions, recent delivery events, three controller ledgers, and
  append-only reviewer/assignment logs; log indexing/compaction is a later
  operational concern.
- Suppressing the legacy wake for correlated tasks is safe only while the V2
  executor and owner escalation remain tested together. Do not remove the
  legacy parser or planner recovery code until live replay parity is recorded.
- Bind-mounted workflow edits deploy on the next dispatch. Every future writer
  slice requires an explicit default-off mode gate before implementation lands
  in the live app tree.

### Exit gate before retiring compatibility code

- Replay proves missing-review, unapplied-decision, stale revision/attempt,
  known dispatch failure, resolved postcondition, exhausted budget, and
  no-attempt compatibility behavior.
- A live writer-free capture shows the V2 action journal and downstream event
  result agree for the observation window.
- No correlated task produces both a V2 action and a legacy watchdog recovery
  action.
- The explicit mode gate is proven `off` by default and
  `review-handoff-revisioned` only in the intended app manifest.

## Slice 8 — Terminal-Success Attempt Recovery Shadow

The first Gate D invariant is active-attempt terminal success. It is a good
second canary because the legacy watchdog already has a conservative evidence
extractor and the transition is objective: an exact revision/attempt/session
is still active in the tree, while its runtime session ended successfully with
actionable completion evidence.

Current behavior remains shadow-only:

- `ProjectSnapshotV2` exposes terminal session status, outcome, and error;
- `terminalAttemptRecoveryCandidatesV2()` selects only V2-cohort,
  terminal-success, error-free exact attempts;
- the watchdog compares V2 candidates after the existing actionable-evidence
  adapter with the revisioned subset of legacy candidates;
- `project_supervisor_terminal_attempt_shadow_v2` journals every exact
  V2-cohort terminal classification, including success without actionable
  evidence and provider/error non-candidates;
- `recoverTerminalDoneActiveTasks()` remains the sole writer.

Fixture parity exposed and fixed one legacy revision defect:
`ActiveTaskSnapshot.taskRevision` was declared but never populated, so terminal
recovery only succeeded accidentally for revision `0`. The adapter now carries
the actual task revision, and the shadow fixture proves V2 and legacy identify
the same revision-2 actionable terminal session before the legacy writer moves
it to review.

Do not enable a V2 writer until live shadow records cover at least one
actionable revisioned terminal success, one terminal provider/error outcome,
and one terminal success without actionable completion evidence.

Terminal session facts require tree plus session coverage. The drained
assignment outbox is not durable attempt history and is required only for
assignment-delivery invariants; missing/stale negative conclusions additionally
require controller-liveness coverage.

## Implementation Principles

1. New mutation behavior requires a shadow/read-only precursor.
2. Current active/review tasks use compatibility revision `0`; do not rewrite
   them in place.
3. Each migrated invariant class has one stable recovery key and one writer.
4. Every cutover identifies deletion/retirement targets.
5. Event vocabulary remains unchanged unless an existing command/fact cannot
   express the transition.
6. Exact domain judgment stays in worker/reviewer/owner paths.
7. A lower alert/task count is not proof of capability parity.

## Slice 0 — Stabilize The Baseline

Risk: low. Behavior change: none.

### Work

- Preserve or checkpoint the currently dirty changes touching planner,
  watchdog, metrics, readout, task tools, worker, and reviewer before mutation
  work begins.
- Capture replay fixtures for:
  - root readout/frontier drift;
  - lost reviewer/completion re-emission;
  - provider-auth failure on active work;
  - exact ADO wait becoming terminal;
  - fix-forward → pipeline wait → artifact-review phase change;
  - loop ledger record with and without task representation;
  - overdue/malformed external wait;
  - duplicate follow-up/apply-task chain.
- Record current outputs from health, task summary, planner packet, watchdog,
  and relevant metrics for each fixture.

### New files

- `test/fixtures/work-graph-v2/` or app-local equivalent;
- fixture manifest documenting raw authorities and expected current behavior.

### Exit gate

- Fixtures reproduce the failure class without live external dependencies.
- No production file changes are required to replay them.

## Slice 1 — Shared `ProjectSnapshot` In Shadow Mode

Risk: low. Behavior change: none.

### Work

Create a pure app-local module:

```text
workflows/lib/project-snapshot-v2.ts
workflows/lib/project-snapshot-v2.test.ts
scripts/project-snapshot-v2.ts
```

Inputs:

- current task tree;
- assignment queue/outbox;
- runtime session/workflow rows;
- task reviewer rows;
- spec/reference/compact loop ledgers;
- event/outbox delivery facts needed for continuation checks.

Outputs:

- work frontier;
- current attempt/review correlations;
- normalized legacy blocker/Condition candidates;
- controller representation;
- delivery gaps;
- source generations/timestamps;
- typed invariant findings with stable shadow recovery keys.

The CLI compares V2 with:

- `summarizeTaskTree`;
- `buildProjectHealth`;
- watchdog findings;
- selected current metrics;
- `syncProjectReadout` source fields.

It writes no project state.

### Reuse

- SDK `readTaskTree`, `taskState`, readiness, and assignment readers;
- app loop-store readers;
- current tests as semantic fixtures.

### Do not do yet

- do not edit `app.ts`;
- do not make health/metrics consume V2;
- do not create Conditions;
- do not emit owner events;
- do not repair mismatch.

### Tests

- pure snapshot determinism;
- source freshness/generation reporting;
- parity on runnable/active/review/blocked;
- root-readout mismatch detected without treating stored mirror as authority;
- exact wait and malformed wait normalization;
- controller representation parity;
- same raw snapshot produces same recovery key.

### Exit gate

- Fixture parity passes.
- Live shadow report explains every mismatch.
- Hashes of all input state files are unchanged after the CLI runs.

## Slice 2 — Revision-Safe Attempts And Reviews

Risk: medium. Behavior change: only new assignments after enablement.

### SDK changes

Files:

- `../may-agent/packages/sdk/src/project-task-tree-store.ts`
- `../may-agent/packages/sdk/src/project-task-tree.ts`
- `../may-agent/packages/sdk/src/project-task-tree.test.ts`

Add:

- optional persisted `revision`, normalized to `0` for legacy items;
- `taskRevision` on `TaskAssignment` and assignment outbox rows;
- assignment precondition on current revision/state;
- completion/rejection APIs requiring attempt and revision match;
- canonical intent fingerprint helper;
- compatibility behavior for revision-less live attempts created before cutover.

### App adapter changes

Files:

- `workflows/task-worker.ts`;
- `workflows/default-task-worker.ts`;
- `workflows/task-reviewer.ts`;
- `workflows/project-planner.ts`;
- associated tests.

Carry revision through:

```text
project.task.assigned
  -> worker session/task payload
  -> project.task.completed
  -> project.task.reviewed
  -> planner apply
```

### Tests

- late completion for old revision is audit-only;
- late review for old revision cannot close new intent;
- harmless metadata change does not increment intent revision;
- goal/workflow input/dependency/Condition change does increment revision;
- retry of same revision gets a new attempt but same revision;
- archived task-id reuse cannot consume old result;
- compatibility revision `0` drains correctly.

### Exit gate

- Existing assignment/worker/reviewer/planner tests pass.
- One canary task completes end to end with revision correlation.
- No active/review compatibility task is stranded.

## Slice 3 — V2 Mutation Commands And Atomic Review Actions

Risk: medium. Behavior change: selected review actions only.

### Work

Introduce an app command adapter over the current SDK primitives:

```text
workflows/lib/work-commands-v2.ts
workflows/lib/work-commands-v2.test.ts
```

Initial commands:

```text
work.create
work.revise
work.dispatch
work.submit
work.applyReview
work.blockOn (legacy blocker adapter initially)
work.complete
work.replace
```

First canary: structured `reviewAction=task-tree-followup`.

`work.applyReview` atomically:

- validates task, attempt, and revision;
- records the accepted/follow-up decision;
- creates or revises the exact successor;
- writes required assignment/outbox entry;
- returns emitted event facts.

This replaces memo-only/apply-task chains such as the observed Windows
egress-lockdown lineage.

### Current code to wrap/refactor

- planner `applyReviewedTaskEvent`;
- planner `createReviewedSuccessor`;
- SDK `createTask`, `markTaskDone`, `rejectTaskReview`, and assignment APIs;
- app `updateAcceptedReviewMetadata` compatibility writes.

### Tests

- exact structured follow-up creates one successor;
- duplicate reviewed event creates no duplicate;
- stale revision creates no successor;
- invalid owner/parent/workflow action is rejected;
- state mutation and assignment outbox cannot partially apply;
- replay of the egress-lockdown chain creates the domain successor directly.

### Exit gate

- One review-action kind uses V2 exclusively.
- The corresponding old planner branch is removed or reduced to adapter code.
- No ops apply task is generated for that action kind.

## Slice 4 — Multi-Phase Pipeline Continuation

Risk: medium-high. Behavior change: selected queued-run continuations.

### Work

Use revision-aware continuation for one exact spec workflow:

```text
fix-forward/authoring revision N
  -> accepted queued run
  -> revision N+1 with workflow=spec-result-review
  -> legacy blocker projection until Conditions land
  -> terminal run enables artifact-review attempt
```

Prior accepted phase result is immutable and referenced by revision `N+1`.
Artifact review returns only its current schema; it does not reproduce the prior
fix-forward payload.

### Current code to refactor

- planner `createAcceptedQueuedPipelineWait`;
- planner exact pipeline-wait review handling;
- default worker fix-forward/spec-result-review contract selection;
- watchdog terminal-pipeline harvesting for the canary workflow;
- reviewer validation that currently expects mixed old/new payloads.

### Tests

- replay ADO run `172459471` lineage;
- artifact review cannot run before terminal Condition/fact;
- current artifact-review payload is accepted without repeating old
  `FIX_FORWARD_RESULT`;
- old revision completion cannot overwrite verification phase;
- grouped run chooses one linked verification item when several source items
  are involved.

### Exit gate

- One exact queued-run family completes repair → wait → artifact review without
  synthetic payload replay or redo.
- Existing non-canary pipeline waits remain on the old path.

## Slice 5 — Condition Registry, Exact Pipeline Run Canary

Risk: high. Behavior change: selected exact waits.

Current status: the planner creation path and watchdog observation/resolution
path require the same explicit `conditionV2: exact-ado-revisioned` mode. Missing
or unknown mode values fail closed to `off`, while existing V2 ownership remains
recognizable so disabling the writer cannot return the task to legacy recovery.
The app manifest opted the project planner, fast review applier, and watchdog
into the bounded mode. The first exact task and Condition completed and were
archived; a second exact wait for run `172493879` is open at revision `1`.

The first live observation exposed compatibility `resume_at` as a second
overdue authority. The corrected path removes that timestamp, excludes exact
open Condition subjects from legacy blocked-frontier ownership, and gives the
Condition one stable fallback claim. Event and watchdog terminal facts create
the same durable assignment continuation; delivery uses peek/ack semantics so
an unaccepted dispatch remains replayable.

The live terminal sequence completed at `09:22Z`–`09:35Z`: watchdog resolved
the failed run fact, durable continuation held while capacity was full, planner
later dispatched the exact assignment, worker/reviewer/planner completed the
review, and archival preserved the resolved Condition. A scheduled
blocked-frontier review one minute before terminal observation still created a
redundant refresh task. Planner packets now publish and remove
`condition_owned_task_ids` from owner-actionable blocked details, warnings, and
the recomputed blocked-family summary. Registry-first, due-only observation and
fallback-on-unavailable behavior are fixture-tested. The second open Condition
passed its first due nonterminal observation at `10:33:18Z`. The following
`10:38:22Z` watchdog processed unrelated terminal waits without changing the
Condition's observation timestamp, proving that `nextCheckAt` suppresses early
V2 probes in the live runtime.

At `10:44:07Z`, the next eligible tick performed one bounded observation,
advanced `nextCheckAt` to `10:54:07Z`, preserved the original fallback, and
created no owner or replacement work.

The `10:49:37Z` watchdog emitted an unrelated generic blocked-frontier owner
wake without including the Condition subject. The third eligible observation
at `10:55:22Z` again advanced only `nextCheckAt`, now to `11:05:22Z`.

The fourth eligible observation at `11:05:58Z` repeated the same bounded
transition and moved `nextCheckAt` to `11:15:58Z` without owner or review work.

At the next boundary, an `11:16:30Z` higher-priority completed-active recovery
used the watchdog tick before Condition harvesting. The following tick caught
up at `11:22:27Z` and moved `nextCheckAt` to `11:32:27Z`. This demonstrated one
tick of scheduler latency without Condition starvation.

The natural scheduled blocked-frontier event fired at `11:32:49Z`. The planner
workflow started at `11:37:14Z`; its packet carried the exact wait only in
`condition_owned_task_ids`, omitted it from actionable blocked data and the
blocked-family summary, and reserved observation/fallback/resolution to the
Condition. The planner created unrelated scenario-normalization work without
mutating, replacing, or creating recovery work for the Condition subject. The
task stayed blocked at revision `1`, and due observations at `11:33:03Z` and
`11:45:01Z` changed only the Condition timestamps. Scheduled-review exclusion
is now live-proven.

The `11:49:15Z` watchdog tick occurred before the exact deadline and did
nothing. At `11:55:42Z`, the next tick observed the run as `inProgress`, claimed
one stable
`condition-fallback:condition:pipeline:ado:172493879:terminal:1`, and dispatched
one `condition-overdue-fallback` owner event. The task remained blocked at
revision `1`; the same tick emitted no generic blocked-frontier wake. The
journal records one claim and one dispatch with `attempts: 1`. Exact live
fallback ownership and duplicate suppression therefore passed. Owner
disposition remains a downstream delivery postcondition rather than evidence
that the external Condition is resolved.

At `12:09:06Z`, before mechanical ownership enforcement landed, an unrelated
metric planner refreshed the Condition subject's compatibility blocker and
moved its watch/fallback timestamps without changing the Condition. This live
second-writer incident justified an SDK save-time mutation validation hook and
an AKS-local open-Condition authority guard. Allowed authority actions are now
enumerated; generic update, refresh, unblock, close, output, assignment, retry,
and direct adapter saves fail atomically for the owned revision.

The next Condition observation repaired `next_check_at` but exposed that the
projection had not restored the drifted `fallback_at`. Observation and fallback
claim now project the entire timing/observer/fallback policy from the
Condition, so the blocker is explicitly output-only for this family.

Fallback handling now distinguishes accepted dispatch from completed owner
processing operationally: the planner validates correlation on entry and
acknowledges only after owner planning returns. A crash/error leaves the stable
action unacknowledged. The dispatcher permits two redeliveries after 15-minute
acknowledgement grace windows and then stops at three total attempts. Focused interruption,
replay, projection-drift, and forged-authority tests pass. Live evidence of the
post-hardening acknowledgement or bounded redelivery remains the final closure
gate for this exact canary.

The live `12:40:08Z` watchdog then restored the drifted blocker fallback to the
Condition's original `11:49:33Z` value and redelivered the still-unacknowledged
fallback once under the same recovery key (`attempts: 2`). The tick also
revealed that the harvest loop could enter the expired-fallback branch before
`nextCheckAt` even though client acquisition used the correct due predicate,
producing a false unavailable observation. Harvest now uses the same due gate
before all V2 observation/fallback transitions; an early post-fallback replay
fixture requires unchanged observation and next-check timestamps.

Local runtime traces showed both generic fallback owner events in `pending`
state with no workflow run or session, including the original event from
`11:55Z`; the generic owner lane had accumulated many similar pending events.
The second dispatch therefore proved stable redelivery but not improved
delivery. New fallback actions emit typed
`project.condition.fallback.requested` events to a dedicated
single-concurrency planner handler. Legacy generic owner events remain readable
for buffered compatibility, while new actions no longer compete with the broad
owner-event backlog. Live acknowledgement through this lane remains pending.

### Work

Create app-local types/store/commands behind existing blocker APIs:

```text
workflows/lib/project-conditions.ts
workflows/lib/project-conditions.test.ts
```

Start only with exact pipeline-run Conditions:

```text
causeKey = pipeline:<backend>:<runId>:terminal
subject = exact WorkItem id and revision or exact verification item
```

Compatibility projection continues to expose a readable blocker/task view
until UI/health consumers migrate.

Commands:

```text
condition.observe
condition.resolve
work.blockOn
```

Resolution validates backend, run id, subject, and revision, computes affected
work, and atomically schedules reconciliation/outbox continuation.

### Current code to adapt

- SDK/app `TaskBlocker` compatibility parser;
- `refreshBlockedWait` adapter;
- watchdog pipeline polling/terminal harvesting;
- spec and compact controller wait creation;
- planner queued-run continuation;
- health/metric wait reporting for the canary class.

### Tests

- one Condition shared only by exact intended subjects;
- wrong run/revision cannot resolve it;
- duplicate terminal event is idempotent;
- missing event is recovered by bounded fallback probe;
- resolved Condition plus blocked item becomes an invariant until reconciled;
- fan-out impact is reported before broad resolution;
- compatibility blocker projection preserves evidence and operator visibility.

### Exit gate

- One ADO run family uses Condition as sole live wait authority.
- The old task/blocker writer for that family is disabled.
- Event-first and fallback-probe paths both pass replay.

## Slice 6 — Shared Snapshot Consumers And Derived Readout

Risk: medium. Behavior change: read semantics, not project judgment.

### Work

Migrate consumers one at a time:

1. `scripts/project-health.ts`;
2. `workflows/lib/project-readout-sync.ts`;
3. selected task/process metrics;
4. planner packet;
5. UI/Kanban projections.

Root/current-focus/project-state frontier arrays become generated compatibility
output and then disappear as planner inputs.

### Deletion targets

- root-readout parity detection/repair tasks and scripts;
- duplicated active/review/runnable/waiting calculations;
- `current_root_readout` as writable authority;
- parent-result/rollup repairs caused only by cached projections.

### Tests

- replay current root-frontier parity incident;
- all consumers report identical source generation and frontier;
- a deliberately corrupted stored mirror does not affect planner/health truth;
- independent critical safety query catches a deliberately corrupted snapshot;
- projection performance and freshness bounds.

### Exit gate

- Current root-readout repair metric stays zero because no writable mirror is
  consulted, not because a repair task refreshed it.
- Root parity ops repair lineage is no longer generatable.

## Slice 7 — Project Supervisor Canary

Risk: high. Behavior change: one recovery invariant.

### First canary: missing review delivery

Reason:

- objective invariant;
- existing watchdog already performs re-emission;
- stable attempt/revision correlation is available after Slice 2;
- easy to replay and verify;
- does not require domain judgment.

Supervisor input comes exclusively from `ProjectSnapshot`.

```text
invariant: review item has current claim but no review within grace
recoveryKey: review-missing:<taskId>:<revision>:<attemptId>
action budget: one re-emission
postcondition: matching reviewer decision or durable delivery evidence
```

### Work

- add typed invariant/action result;
- store open/resolved invariant Condition or equivalent recovery record;
- perform one idempotent re-emission;
- route exhausted/ambiguous cases to one structured
  `project.owner.requested` packet;
- remove the matching watchdog mutation branch after parity.

### Tests

- missing review is re-emitted once;
- duplicate watchdog/schedule signal does not re-emit again;
- stale revision is not re-emitted;
- reviewer provider failure remains distinct from delivery failure;
- postcondition resolves recovery key;
- exhausted action produces one owner wake/repair, not both.

### Exit gate

- Live canary closes through supervisor.
- Old watchdog branch for this invariant is removed.
- No duplicate owner wake or repair item appears.

## Slice 8 — Remaining Supervisor Invariants

Migrate separately, in this order:

1. assignment event missing;
2. terminal attempt missing completion;
3. dead/stale active attempt;
4. resolved Condition still blocking work;
5. overdue Condition fallback;
6. controller ledger item unrepresented;
7. repeated planner timeout;
8. lossless structural repair.

Each class requires:

- typed invariant;
- stable key fixtures;
- one-action policy;
- postcondition;
- owner escalation boundary;
- old branch deletion target;
- live or incident-replay canary.

Do not migrate blocked-frontier strategy into the supervisor. When all work is
truthfully represented but strategy has no executable path, send one owner
planning packet rather than inventing a mechanical recovery action.

## Slice 9 — Shared Conditions And Blocked Families

Risk: high. Requires exact-run Condition canary success.

Migrate one cause family at a time:

1. exact pipeline completion;
2. explicit human/product approval;
3. exact credential/permission return;
4. narrowly defined capacity contract family;
5. shared environment prerequisite.

For each family:

- inventory existing wait/hold tasks and their real semantic subjects;
- define typed cause key and resolution evidence;
- dry-run fan-out;
- preserve delivery/escalation evidence;
- migrate blocked WorkItems in bounded batch;
- remove duplicate holder tasks only after UI/health parity;
- retain bounded fallback observation.

Do not begin with broad capacity or reviewed-exception families; they have the
highest risk of false shared resolution.

## Slice 10 — Controller Lanes And Schedule Convergence

Risk: medium-high.

### Work

- project controller lane status directly from owning ledger;
- stop persisting copied root progress/trace history;
- make pulse eligibility generation/due-work based;
- stop routine pulse for completed reference loop;
- retain manual pulse and integrity recovery paths;
- migrate controller unrepresented invariant to supervisor;
- retire scheduled blocked-frontier review after Condition coverage;
- narrow heartbeat to focus/digest.

### Tests

- completed controller receives no no-op pulse;
- source generation change reopens/pulses it;
- unrepresented ledger item triggers exactly one controller action;
- controller action cannot make domain strategy judgment;
- manual pulse remains available;
- schedule retirement replay covers every removed trigger class.

### Exit gate

- loop progress has one authority;
- controller-root rollup repair is no longer needed;
- no lost refill or terminal-run harvesting path.

## Slice 11 — Cleanup And Generalization

Only after app-local V2 behavior is stable:

- remove task `trace` fields superseded by runtime/phase-result references;
- remove session history from canonical WorkItems;
- remove compatibility blocker variants no longer present in durable state;
- remove obsolete repair scripts/metrics/schedules through normal archive policy;
- compact journal retention;
- decide which Condition and supervisor primitives belong in the generic SDK;
- keep AKS-specific subject, ledger, and policy logic app-local.

Success is measured by deleted authority/repair code, not only by new V2 code.

## Dependency Graph

```text
Slice 0 fixtures
   -> Slice 1 snapshot
       +-> Slice 6 shared consumers/readout
       +-> Slice 2 revisions
             -> Slice 3 commands
                 -> Slice 4 phase continuation
                     -> Slice 5 exact-run Conditions
       +-> Slice 7 supervisor canary (also requires Slice 2)
             -> Slice 8 remaining invariants
       Slice 5 -> Slice 9 shared Condition families
       Slices 5 + 6 + 8 + 9
             -> Slice 10 controller/schedule convergence
                 -> Slice 11 cleanup/generalization
```

Slice 6 may begin after snapshot parity because it changes read semantics, not
work mutation; move one consumer at a time. Slice 7 additionally requires
revision-safe correlations from Slice 2. No work-mutation slice may bypass
revision and command preconditions.

## Recommended First Change Set

Approve and implement only Slice 0/1 first.

Expected diff:

- new fixtures;
- new pure snapshot module and tests;
- new read-only CLI comparison report;
- at most a small export/helper change in existing code;
- no edits to `app.ts`;
- no task, Condition, scheduler, planner, watchdog, health, or metric mutation;
- no handler retirement.

This is especially important because the current worktree already contains
substantial uncommitted changes in nearly every later migration target. New
read-only files minimize collision and make the first review about semantics,
not integration churn.

## Review Checklist

Reviewers should verify:

1. Every slice replaces one authority instead of adding a parallel writer.
2. Generic SDK changes contain only project-neutral mechanics.
3. AKS loop/Condition policy stays app-local until proven reusable.
4. Current active/review work drains through compatibility revision `0`.
5. The multi-phase rule resolves the observed mixed-result-contract failure.
6. The first Condition canary is exact-run scoped.
7. The first supervisor canary is objective and mechanically verifiable.
8. Root readout becomes a projection before its repair paths are deleted.
9. Every retired handler has incident replay coverage and a rollback path.
10. Final cleanup deletes old writers, repair logic, and duplicated semantics.
