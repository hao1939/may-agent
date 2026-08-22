# AKS Task Graph Integrity and Simplification

Status: historical migration implemented 2026-07-20; scheduling shape
superseded by the unified controller contract

This document records the integrity cutover and its evidence. Its historical
sibling-controller/fan-in scheduling shape is no longer the target. The current
direction is
[`unified-task-reconciliation-review.md`](unified-task-reconciliation-review.md):
loop-owned work uses direct children and generic parent wakeup, while
`project.task.reconciled` is never an app scheduler.

## Implementation outcome

The cutover used the supported lifecycle pause, a canonical-state backup, the
reviewed exact-ID manifest in `tasks/task-graph-migration-v1.json`, and the
locked revision-checked migration command. Its second dry-run reported no
changes before reconciliation resumed.

At that cutover, after targeted controller wakes, the live graph had six structural groups and
only bounded current resources. All three standing controllers are converged,
generation-current, and have no child fan-out Conditions. Remaining waits use
registered `aks.repo-ref.changed`, `pipeline.completed`, and
`project.approval.submitted` facts, plus bounded exact
`project.task.reconciled` continuations where predecessor disposition matters.
The schema-v2 projection has no integrity findings and contains neither full
attempts nor receipts.

Those internal reconciliation continuations and sibling refill routes are now
migration residue, not the accepted steady-state design.

Post-resume validation also exposed and fixed two controller liveness issues:
deterministic compact leaves were not recognized before ledger writeback, and
repeated wakes declared a full batch rather than only free capacity. Spec,
compact, and scenario controllers now subtract represented work from their
configured capacity and converge when work is already represented.

## Decision summary

Bring the AKS app onto the current task-resource model through one controlled
migration:

- `.state/tasks/state.json` is the sole mutable task authority;
- `.state/tasks/tree.json` is a compact, disposable schema-v2 projection;
- stable structural groups organize the AKS work domains;
- standing loop controllers use direct children for work whose transitions
  must wake and refill that loop;
- loop controllers inspect current state, declare bounded actions, and converge;
- scheduled ticks and semantic observations rerun controllers;
- dependencies express task-to-task ordering;
- Conditions express exact observable facts, not general evidence or planning
  state; and
- `project.json` retains project intent and decisions, while live task lists and
  counts come from the canonical task read model.

The cutover pauses AKS reconciliation, drains or explicitly interrupts current
attempts, applies a reviewed disposition manifest under the task-state lock,
validates a quiescent snapshot, and resumes through targeted controller wakes.
Migration code applies declared decisions; it never infers domain meaning from
task IDs or prose.

The original cutover used a sibling group/controller/leaf shape. The unified
controller now makes executable parents the simpler convention when the loop
must observe child transitions; maintain-parent convergence still does not
automatically assert child completion.

## Why change

The paused cutover snapshot captured on 2026-07-20 had:

- 142 executable resources and one structural group;
- 134 waiting, 7 converged, and 1 attention resource;
- 196 Conditions, including 122 `evidence.available` Conditions with no known
  producer and 70 `project.task.reconciled` Conditions;
- 122 resources whose observed generation differed from desired generation;
- 1,000 retained attempts and 1,125 receipts;
- only two dependency edges;
- a spec controller with 64 executable children, a compact controller with 44,
  and a scenario controller with 5; and
- several attention results caused by attempts to converge or absorb a resource
  that still had live children.

The task contracts are mostly sound: resources have purpose, acceptance, owner,
mode, and valid runtime bindings; waits have linked Conditions; and running
resources have attempts. The problem is accumulated operational drift and
mixed relationship semantics, not the absence of a task model.

The 2026-08-04 live review found a second, simpler form of drift after the
structural cutover: canonical state was about 21 MB, with 7,062 receipts, 212
waiting tasks, 145 waits older than one day, 63 unresolved approval Conditions,
and several specs represented by two or three historical fingerprint tasks.
The master-validation task also started 143 times in one day because a
five-minute level check kept waking an active campaign. The old journal was
1.15 GB but had stopped changing, so it is migration residue rather than the
current scheduler. These are history-placement and wake-policy problems; they
do not justify another controller or task type.

Some prerequisites are already implemented: `state.json` is authoritative,
`tree.json` is schema v2 and omits full attempts and receipts, and the task-state
README describes the current authority boundary. The remaining platform gap is
generation precedence over old waits; the remaining AKS gaps are graph shape,
Condition quality, mirrored project state, identity clarity, and controller
liveness.

## Target responsibility model

```text
App resolver and schedules
  -> declare stable standing responsibilities and targeted wakes

Accountable owner or owner-owned workflow
  -> inspect current facts
  -> make domain decisions
  -> declare bounded owner-managed task actions
  -> return converged, an exact external wait, or visible attention

Generic reconciler
  -> validate generations, relationships, actions, and Conditions
  -> atomically persist admitted transitions
  -> never invent project work or interpret task prose

Watchers
  -> observe external provider levels
  -> emit semantic facts
  -> never decide task acceptance

WebUI and queries
  -> read the disposable projection plus bounded audit history
  -> never gain permission to change task state
```

## Target AKS graph

Create stable groups in initialization state:

```text
project
├── group/spec-verification
│   └── aks-spec-verification-loop
│       └── spec verification leaves
├── group/feature-compact
│   └── aks-feature-compact-loop
│       └── feature compact leaves
├── group/scenario-normalization
│   └── scenario-normalization
│       └── scenario normalization leaves
├── group/domain-work
└── group/app-operations
```

Groups provide organization only. Controllers are maintain resources. Finite
domain work is normally an achieve child. An executable parent keeps its own
acceptance and uses children to express owned decomposition; child status never
automatically decides the parent's domain result.

`parentId` answers “which task owns this decomposition?” or, when it names a
group, “where is this organized?” `dependsOn` answers “what must finish first?”
Neither relationship assigns a worker or introduces a second scheduler.

Keep the existing stable spec and compact controller IDs. Replace the dated
scenario maintain identity once with `scenario-normalization`; record the old
identity and migration disposition in durable evidence rather than carrying a
date in standing desired state.

Ownership is explicit at the stable boundaries:

- `project` and `group/app-operations`: `app-ops`;
- `group/spec-verification` and `group/feature-compact`: `app-ops`;
- `group/scenario-normalization` and `group/domain-work`: `aks-explorer`; and
- finite leaves keep an explicit owner when it differs from their group.

Loop-created leaves belong directly to their controller. Independent domain
work belongs to `group/domain-work`; runtime review and repair work belongs to
`group/app-operations`.

## Controller lifecycle

The three AKS controllers use the same bounded lifecycle:

1. A schedule, manual action, or relevant semantic observation targets the
   controller.
2. Its workflow reads the current domain ledger and compact task projection.
3. It declares at most its configured bounded number of missing direct-child
   leaves.
4. It returns `converged` after the current pass and declarations are admitted.
5. A meaningful child transition, later timer, or relevant domain observation
   reruns it.

An open child is therefore evidence that work is represented, not by itself a
reason for a maintain controller to remain waiting. The current ten-minute
durable-loop pulse is a recovery bound for the spec and compact controllers.
The scenario inventory watcher supplies a content-driven wake for scenario
normalization.

Do not attach `project.task.reconciled` Conditions or add an app fan-in to a
standing controller. Use direct children when their transitions belong to the
loop, a dependency for ordering, and an exact Condition for an external fact.
The shared controller supplies prompt child-to-parent wakeup.

This does not introduce parallel workflow execution. Each workflow remains a
single ordered execution block; the existing app controller alone governs
concurrency between task attempts.

Liveness is part of this contract, not only graph cleanliness:

- a red scenario inventory with free capacity declares three to five exact
  adapter leaves;
- nonterminal spec or compact state with free capacity declares its configured
  bounded leaves;
- fully represented work leaves the standing controller converged rather than
  waiting on every child; and
- a relevant semantic observation targets the corresponding controller.

## Conditions

A durable waiting result must identify a fact that can be matched without
agent judgment. Every admitted Condition needs:

- a typed event;
- an exact subject or correlation identity;
- an expected field/value predicate;
- a registered producer or explicit human-return path; and
- evidence explaining why that fact is sufficient to wake this task.

Healthy AKS examples include an exact repository ref advancing beyond a
baseline commit, a named pipeline run reaching a terminal state, and an
approval decision for a specific approval lineage.

`evidence.available` is not admitted as a generic fallback. Existing instances
are handled only through a reviewed disposition manifest:

- a still-relevant external wait is replaced with its actual typed fact;
- a real predecessor relationship becomes `dependsOn`;
- obsolete or absorbed work is removed with durable disposition evidence; and
- an unresolved judgment moves to owner attention.

Do not move every legacy wait to attention or infer a replacement from names or
prose. That would replace waiting bloat with attention bloat.

`project.task.reconciled` is a runtime observation, not a Condition or
scheduling input. Replace legacy internal continuations with a direct child
when the parent owns the result or `dependsOn` when the relationship is
ordering.

## Generation integrity

A desired-spec generation change always receives current-generation
reconciliation. Prior-generation Conditions cannot prevent that claim.

On generation change, the reconciler must atomically:

1. detach obsolete Condition links;
2. preserve their observation history where required for audit;
3. clear obsolete waiting state;
4. enqueue the current task generation; and
5. allow the current handler to establish new Conditions if it still needs to
   wait.

This platform fix is a prerequisite for bulk AKS state migration. Otherwise a
migrated task can remain asleep on the very Condition the migration intended to
replace.

The quiescent post-migration snapshot must have current observed generations.
This is a cutover gate, not a claim that a live system can never briefly have a
new desired generation awaiting reconciliation.

## App identity and capacity

The app must expose one unambiguous contract for:

- app identity;
- accountable app owner;
- app workspace;
- domain repository, if distinct from the app workspace;
- controller attempt concurrency; and
- domain work capacity.

Resolve the current `app-ops` versus `aks-explorer` and 8 versus 80 declarations.
The domain workspace legitimately has Azure DevOps and GitHub remotes; name
their roles explicitly rather than presenting either as the single ambiguous
repository field.

Recommended ownership:

- `app-ops`: accountable app owner and app organization;
- `aks-explorer`: default owner for AKS domain judgment;
- controller concurrency: runtime attempt limit; and
- domain capacity: a workflow policy input, not a second app concurrency limit.

Repository fields distinguish the Azure DevOps source/pipeline remote from the
GitHub mirror or publication remote. They do not ask operators to choose one
repository and hide the other.

## Project metadata

Keep in `project.json`:

- mission and durable strategy;
- current planning horizon;
- accepted owner decisions;
- success criteria and policy; and
- links to durable evidence.

Remove mirrored active, review, waiting, runnable, and blocked task ID arrays
and their derived counts. The task projection already owns those facts. A
human-authored focus statement may reference a small set of stable goal IDs,
but it must not become another live task-state projection.

## Reviewability contract

The task page must let an operator answer, without opening raw JSON:

1. What outcome is this resource responsible for?
2. Why is it in its current phase?
3. Is its observed generation current?
4. Who or which workflow handles it?
5. What exact fact will wake it?
6. What evidence supports its current result?
7. Which relationships are containment and which are ordering?
8. What safe owner action is available next?

The compact projection therefore includes purpose, acceptance, owner, binding,
mode, phase, generation freshness, readiness, current summary, bounded evidence,
Conditions, dependencies, and active attempt identity. Full attempts and
receipts remain outside `tree.json` and are loaded only through bounded audit
queries.

Task IDs should be stable identities rather than compressed histories. Dates,
run numbers, predecessor chains, and repair narratives belong in input,
evidence, trigger, and status fields unless they are necessary to distinguish a
genuinely new task identity.

## Migration plan

### Phase 0: platform prerequisites

1. Record schema-v2 projection and sole-authority prerequisites as satisfied.
2. Fix generation-change precedence over prior-generation open Conditions.
3. Add integrity checks for an open Condition without a known producer.
4. Add controller liveness tests for free capacity, fully represented work, and
   semantic observation wakes.
5. Confirm task state backup and controlled rollback procedures.

### Phase 1: authority and identity

1. Remove remaining projection-as-authority readers, then regenerate
   `tree.json` from canonical `state.json`.
2. Align app owner, repository-role, and capacity terminology.
3. Remove dynamic task arrays from `project.json` consumers, then from the
   manifest itself.
4. Define the stable group owners and the one-time scenario-controller rename.

### Phase 2: graph migration

1. Add the stable structural groups to `tasks/seed.json`.
2. Move loop controllers beneath the corresponding groups and loop-owned work
   beneath each controller as direct children.
3. Apply only reviewed predecessor dispositions: convert proven ordering to
   dependencies, flatten pure lineage, and preserve genuine containment.
4. Preserve independent parent acceptance; child status is wake context, not
   automatic parent completion.

### Phase 3: controller and Condition migration

1. Change the spec, compact, and scenario controllers to
   inspect/declare/converge.
2. Remove their child-completion Condition fan-out.
3. Apply the reviewed wait manifest: typed observer, dependency, obsolete
   disposition, or bounded owner attention.
4. Reconcile all drifted generations and repair current attention resources.

### Phase 4: reviewability and cleanup

1. Require a useful current summary for attention and nontrivial waiting state.
2. Fill meaningful categories for uncategorized work.
3. Verify purpose-first WebUI task details and Condition grouping.
4. Review attempt and receipt retention separately; do not put full history
   back into the projection.

The migration is implemented as an idempotent TypeScript/Bun command using a
dedicated locked migration API. It consumes a reviewed manifest of exact task
IDs and dispositions, supports dry-run, prints its intended graph and Condition
changes, writes atomically, and never edits live JSON piecemeal.

Before its write phase:

1. pause AKS schedules and task reconciliation;
2. drain current attempts or record explicit interruption;
3. capture canonical state and matching app/runtime revisions; and
4. refuse the write if state changed after the dry-run snapshot.

After its write phase, validate the quiescent state, reload the app, and wake
each standing controller once before restoring normal schedules.

## Acceptance gates

The migration is complete when:

- `state.json` is the only mutable task authority;
- `tree.json` has `schema_version: 2` and contains no attempt or receipt maps;
- every resource has `observedGeneration === generation` after reconciliation;
- every waiting resource has at least one linked, current-generation, exact
  Condition with a known producer;
- no `evidence.available` Condition remains;
- the three loop controllers use direct children for loop-owned work and have
  no fan-out of child-reconciliation Conditions;
- every ordering edge represented as a parent chain has been converted to
  `dependsOn`;
- no task is in attention because a handler tried to close or converge a live
  parent incorrectly;
- app owner, workspace, and capacity have one unambiguous readout;
- `project.json` no longer mirrors live task arrays or counts;
- the WebUI displays purpose, state reason, generation freshness, exact wake,
  relationships, handler, and evidence;
- the app syntax, type, formatting, workflow, watcher, migration, and projection
  tests pass; and
- a second migration dry-run reports no changes.

Functional gates also require:

- red scenario inventory plus free capacity declares three to five exact
  adapter leaves;
- nonterminal spec and compact ledgers plus free capacity declare bounded
  leaves;
- represented work leaves standing controllers converged without child fan-out
  Conditions; and
- the scenario inventory and other registered observations wake only their
  intended controllers.

## Rollback

Before migration, pause the app controller and capture canonical task state plus
the matching app and May runtime revisions. If an acceptance gate fails,
restore canonical state and both matching revisions together, regenerate the
disposable projection, and then resume. Never restore `tree.json` as authority.

## Accepted choices

1. Ten minutes is the normal background resync bound; exact semantic
   observations still wake immediately.
2. Use the five groups without further subdivision until real navigation or
   ownership pressure appears.
3. `app-ops` owns the app; `aks-explorer` owns AKS domain judgment.
4. A legacy wait without a reconstructable fact receives a reviewed explicit
   disposition; migration never invents one.
5. Use `dependsOn` for ordinary ordering and direct children for owned
   decomposition. Do not represent internal predecessor state as a Condition.

## Non-goals

- introducing parallel steps inside workflows;
- making watchers decide completion;
- making the reconciler infer decomposition;
- forbidding executable parents globally;
- retaining finished tasks as a live archive;
- adding another task-state store; or
- rewriting domain evidence as part of the graph migration.
