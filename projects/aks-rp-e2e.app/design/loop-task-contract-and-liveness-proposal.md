# AKS Standing Loop Task Contract and Liveness

Status: accepted; core liveness implementation 2026-07-20

## Decision summary

Keep the three standing loops. They reconcile different durable units and
should not be merged:

| Loop                   | Durable unit              | Source of truth                                           |
| ---------------------- | ------------------------- | --------------------------------------------------------- |
| Spec verification      | one `specId`              | app-owned spec-loop ledger plus accepted run evidence     |
| Feature compact        | one `featureKey`          | app-owned feature-compact ledger plus accepted live proof |
| Scenario normalization | one missing `adapterPath` | strict inventory from clean current `origin/dev`          |

Strengthen all three with one common controller contract:

- a standing loop is a `maintain` resource that observes and declares work;
- the controller and its finite leaves remain siblings under a structural
  group;
- the controller runs as one synchronous workflow block and then converges;
- finite leaves perform adaptive domain work through their resolved owner;
- structured `loopId` and `workKey` identify representation;
- exact waits represent an item but do not consume actionable frontier
  capacity;
- attention residue does not represent healthy progress;
- a reconciled leaf emits one coalesced wake for its loop, while periodic
  pulses remain recovery;
- every resumable wait has both an observer and a real producer or sent human
  handoff; and
- the runtime remains the only scheduler and concurrency authority.

Do not add a request type, a meta-loop scheduler, a dedicated loop reconciler,
parallel execution inside a workflow, or controller-to-child lifecycle
ownership.

## Why refine the loops

The structural cleanup is working: standing controllers are small, finite
leaves use the generic reconciler, and exact Conditions let external waits
sleep. The remaining problems are in the task contracts and controller
accounting.

The 2026-07-20 live review exposed these mismatches:

- the bootstrap seed describes spec and compact frontiers of 5 and 3, current
  canonical resources carry `maxConcurrent` values of 80 and 20, while the
  workflows actually operate at 5 and 3;
- `app.ts`, `tasks/seed.json`, canonical task state, and workflow code carry
  different outcomes and acceptance text for the same standing identities;
- waiting leaves count against the same capacity used for actionable work;
- controllers infer representation from task IDs, scopes, or prose, allowing
  one loop's leaf to accidentally satisfy another loop;
- some resumable reviewed dispositions are treated as terminal;
- spec-loop state has an app copy and a domain-workspace mirror that can
  diverge;
- the feature task promises ADO proof while accepted historical state also
  contains GitHub workflow proof; and
- scenario normalization promises live verification although its controller
  observes only strict source inventory.

The reconciler cannot start work that a controller has not declared. When
sleeping waits fill a controller's frontier, the runtime can be healthy and
still have no runnable work. Declaring work is not runtime concurrency: the app
controller remains the only scheduler and enforces the app-wide attempt budget.

## Terms

Use these terms consistently:

- **represented**: the current unit has exactly one truthful actionable leaf,
  exact wait, or reviewed terminal decision;
- **actionable**: the finite leaf can usefully execute now;
- **waiting**: execution would be untruthful until a typed external fact
  changes;
- **attention**: workflow execution, owner recovery, or result admission did
  not produce an applicable result; it is process-recovery evidence, not a
  normal domain disposition;
- **terminal**: the current objective has an accepted final disposition and
  no automatic resume is expected;
- **frontier limit**: the maximum number of actionable leaves the controller
  declares, not a runtime concurrency setting; and
- **synced**: the maintain controller has reconciled current source state.
  This is the UI meaning of runtime phase `converged`; it does not mean every
  domain unit passed.

## Common controller contract

Each standing loop performs one ordered pass:

1. Read its authoritative source and the compact canonical task projection.
2. Validate source schema and freshness.
3. Classify every current unit as passed, actionable, waiting, terminal,
   attention, or unrepresented.
4. Match representation only through structured identity.
5. Declare bounded actions for eligible unrepresented units until the
   actionable frontier reaches its limit.
6. Return `converged` when the pass is synced, `needs-owner` only when
   source-wide integrity prevents a truthful declaration, or a workflow error
   when its source cannot be read safely.

Lessons from completed work belong in the standing-loop contract and are reused
by controller-created leaves. The root loop and the leaf must carry the same
worker expectations, so human pulses, watchdog pulses, and automatic refills
all produce work that follows the current best path.

The controller never waits on all leaves and never owns their completion
lifecycle. Periodic resync remains the simple recovery path.

One invalid unit does not stop unrelated eligible work. Its attention resource
remains visible while the controller fills other free actionable slots. A
controller with an explicit serial safety invariant, such as one integration
writer for `origin/dev`, must recover or escalate that serial slot before
opening the next writer; this is an eligibility rule, not generic runtime
capacity accounting.
`needs-owner` is reserved for a frontier with no truthful action/wait path, or
for an unreadable or globally inconsistent authority.

### Structured identity

Every loop-created leaf carries:

```ts
input: {
  loopId: "aks-spec-verification-loop",
  workKey: "spec.kms.v2-private-cluster",
  workRevision: "<source-derived fingerprint>"
}
```

`loopId + workKey` is the representation key. `workRevision` changes desired
generation when source truth changes; it does not create a new identity.

Controllers do not infer ownership from summaries, acceptance prose, feature
prefixes, arbitrary conflict scopes, or branch names. Work from another loop
may update the observed source, but it does not directly occupy this loop's
frontier.

### Capacity accounting

Track coverage and execution pressure independently:

```text
current coverage = passed + actionable + waiting + terminal
frontier occupancy = actionable pending/running leaves only
```

Waiting and terminal units prevent duplicate work for the same `workKey`, but
they do not reduce the number of other independent actionable units that may
be declared. Attention counts as neither healthy coverage nor actionable
occupancy.

Completed or terminal decisions live in the authoritative domain ledger and
completion receipts. They do not require permanent task nodes in the live
graph. Exact waits remain live because their Conditions must be observable.

If eligible incomplete work exists below the frontier limit, the controller
must declare the next bounded leaves or return `needs-owner` with the exact
integrity reason. It must not return a broad no-op.

This does not introduce parallel workflow execution. Each workflow remains one
synchronous block; the existing runtime decides which task attempts execute
and enforces the app-wide concurrency budget.

### Wait causality

A Condition observes a cause; it does not cause progress. Every waiting unit
must identify:

- the exact fact and correlation identity;
- the observer that will emit the fact;
- the actor or external system expected to cause it;
- proof that any required request, pipeline dispatch, PR, or approval was
  actually sent;
- the fallback or escalation policy; and
- why the fact is sufficient to reconcile this unit again.

A repository watcher is not a publication producer. A pipeline watcher is not
a pipeline dispatcher. An approval Condition is not evidence that an approval
packet was delivered.

## Loop 1: spec verification

### Purpose

Keep every current executable spec at one of these truthful states:

- proof-backed pass;
- one actionable verification or repair leaf;
- one exact resumable wait; or
- one reviewed terminal decision.

### Task definition

```text
id: aks-spec-verification-loop
group: group/spec-verification
mode: maintain
owner: app-ops
workflow: spec-loop-controller
frontierLimit: 5

outcome:
  Keep every current executable AKS E2E spec represented by a proof-backed
  pass, one exact resumable wait, one reviewed terminal decision, or one
  actionable verification leaf.

acceptance:
  - The catalog and spec-loop ledger contain the same current spec identities.
  - A pass has schema-valid run evidence for the relevant source revision.
  - Every incomplete spec has exactly one spec-loop representation by specId.
  - Resumable dispositions use exact waits; terminal decisions carry reviewed
    classification, evidence, owner, and final reason.
  - While eligible work exists, at most five actionable spec leaves are kept
    represented; waits and attention do not consume that frontier.
```

### Source authority

Use only `/app/projects/aks-rp-e2e.app/.state/spec-loop/state.json` as mutable
spec-loop authority. Pass that exact path to leaves. Remove the domain mirror
from the controller outputs and retire import-by-timestamp behavior after a
reviewed merge of any newer rows.

The top-level ledger revision and `updatedAt` change whenever any row changes.

### Representation and selection

- Prefer the row's exact linked task when valid.
- Otherwise use the deterministic ID derived from `specId`.
- Do not scan unrelated task prose or feature-family prefixes.
- Select explicit priority specs first, then the oldest eligible unrepresented
  rows, so alphabetic ordering cannot starve late identities.
- A review/attention task triggers bounded representation repair or
  `needs-owner`; it does not silently fill capacity.

### Completion proof

`status=pass` alone is insufficient for new or changed rows. A passing row
records at least run provider, run ID, tested source revision, result path,
conclusion, and accepted timestamp.

`terminal=true` is valid only for a reviewed final decision. If a disposition
says "resume when", it is not terminal: retain one live exact wait instead.

## Loop 2: feature compact

### Purpose

Keep every current feature-owned spec set covered by its compact plan and
backed by accepted live proof, or represented by one exact next state.

### Task definition

```text
id: aks-feature-compact-loop
group: group/feature-compact
mode: maintain
owner: app-ops
workflow: feature-compact-loop-controller
frontierLimit: 3

outcome:
  Keep every current feature spec set covered by one compact plan and a
  schema-valid passing live proof, or by one exact wait, terminal decision, or
  actionable compact repair leaf.

acceptance:
  - The ledger contains every current feature and its owned-spec fingerprint.
  - Accepted proof matches the current compact-plan and owned-spec revisions.
  - Every incomplete feature has exactly one feature-loop representation.
  - While eligible work exists, at most three actionable compact leaves are
    kept represented; waits and attention do not consume that frontier.
```

### Proof contract

Replace presence checks across loosely related fields with one schema-backed
proof record:

```ts
proof: {
  version: string;
  provider: "ado" | "github";
  runId: string;
  sourceRevision: string;
  specSetFingerprint: string;
  planFingerprint: string;
  resultPath: string;
  conclusion: "passed";
  acceptedAt: string;
}
```

For review, choose one provider policy:

1. **Recommended:** require ADO for new proof, retain reviewed historical
   GitHub proof only through explicit migration; or
2. accept either provider and make the standing task provider-neutral.

The definition and validator must make the same choice.

### Representation and selection

- Use `loopId + featureKey`, not receipts, summaries, or stale frontier IDs.
- A receipt may supply repair evidence but does not count as active
  representation.
- Invalidate proof when the owned spec set or compact plan changes.
- Select explicit repair/ready work before externally waiting families, then
  choose the oldest eligible row.
- Give reviewed terminal outcomes their own state; do not keep every accepted
  exception indefinitely as generic `blocked`.

## Loop 3: scenario normalization

### Purpose

Narrow this loop to source inventory normalization. Spec behavior and live
verification remain owned by the spec loop.

### Task definition

```text
id: scenario-normalization
group: group/scenario-normalization
mode: maintain
owner: aks-explorer
workflow: normalize-scenario-frontier
frontierLimit: 5

outcome:
  Keep clean current origin/dev free of missing direct scenario-test adapters;
  each missing adapter is absorbed, represented by one actionable
  normalization/publication leaf, held by one exact publication wait, or
  covered by one reviewed terminal exception.

acceptance:
  - Inventory is generated from a clean, identified origin/dev revision.
  - Every missing adapterPath has exactly one scenario-loop representation.
  - Publication work owns or requests the intended landing before waiting.
  - While eligible work exists, at most five actionable one-adapter leaves are
    kept represented; waits and attention do not consume that frontier.
  - Zero missing adapters means inventory completion only, not a live product
    verdict.
```

### Authority and identity

Do not add another mutable loop ledger. The clean strict inventory is the
source, and canonical task resources provide current representation.

Use stable IDs derived only from `adapterPath`; put the observed `origin/dev`
revision in `workRevision`. Do not create a new identity for every ref movement
or represented-task set.

Match only exact structured `adapterPath` identity. Do not count a spec-loop or
compact-loop leaf merely because its prose mentions the same spec or file.

### Publication waits

An adapter branch that has not landed is still actionable until its
publication mechanism has been exercised:

- if the system is authorized to publish, use a bounded publication/PR task;
- if human review is required, send one exact approval or review packet; and
- only then wait on the exact PR, commit ancestry, or returned decision.

Do not use arbitrary `origin/dev` movement as evidence that the intended
publication landed. Correlate the desired commit or PR. An unrelated ref
advance may trigger a resync, but cannot satisfy the landing Condition.

## Definition authority

Standing desired state has one authoring source:

- keep only structural groups and immutable project bootstrap data in
  `tasks/seed.json`;
- define each standing task intent once in `task-loops.ts` and reuse it from
  event resolution;
- let scheduled semantic ticks materialize missing standing resources; and
- test the three definitions as stable public contracts.

Use `frontierLimit`, not `maxConcurrent`. The former bounds desired actionable
representation; the latter belongs to the runtime budget.

## Wake policy

Use event-driven refill with periodic recovery:

- spec and compact controllers receive the ten-minute durable-loop pulse;
- scenario normalization receives its content-driven inventory observation;
- external Conditions wake their exact finite leaves; and
- every reconciled leaf carrying a recognized `loopId` emits one targeted,
  coalesced controller wake; and
- controller pulses absorb changed ledger or inventory state missed by an
  event.

Do not add per-child Conditions or a dedicated loop reconciler. The fan-in is
an app event route, not parent lifecycle ownership and not another scheduler.

## Read model and WebUI

For a maintain controller, display runtime `converged` as **Synced**, not
**Done**. Show these domain counters beside it:

- total units;
- passed or absorbed;
- terminal decisions;
- exact waits;
- actionable pending/running;
- attention; and
- unrepresented.

The task detail should show source revision, frontier limit, last reconciliation
time, next scheduled resync, and the exact units behind every count.

## Integrity invariants

The implementation and tests must enforce:

1. One mutable domain authority per loop.
2. One representation per `loopId + workKey`.
3. No cross-loop representation inferred from prose.
4. No wait or attention item consumes actionable frontier capacity.
5. No resumable disposition is marked terminal.
6. No exact wait exists without an observer and a producer/sent handoff.
7. No accepted proof lacks its required schema fields and source correlation.
8. No controller creates leaves above its frontier limit in one reconciliation.
9. Repeating a pulse with unchanged source is idempotent.
10. A changed work revision updates the stable resource generation rather than
    creating identity churn.

## Delivery

The core liveness slice is implemented:

1. `task-loops.ts` is the one standing-definition source with limits 5/3/5.
2. New leaves carry `loopId`, `workKey`, and `workRevision`.
3. The three controllers count only actionable representations against their
   frontier and no longer infer representation from prose or feature families.
4. Scenario leaf IDs are stable across `origin/dev` revisions.
5. Reconciled structured leaves fan back into their controller immediately;
   periodic pulses remain recovery.
6. `tasks/seed.json` contains structure only.

The controlled live-state transition retains exact legacy task references only
while already-running or waiting leaves drain. It must not infer new identity
from prose. No migration step may launch a live rerun merely to repair
representation or proof metadata.

These consistency improvements remain follow-up work and do not gate liveness:

- merge the two spec-loop state copies into the app-owned authority;
- migrate resumable terminal dispositions into exact waits;
- adopt the compact proof schema and reviewed historical-provider policy; and
- add the richer WebUI counters and unit drill-down.

The accepted decisions are: keep three loops at 5/3/5, use the app-owned spec
ledger, require ADO for new compact proof while grandfathering reviewed
historical GitHub proof, and keep scenario normalization limited to source
inventory while the spec loop owns behavioral proof.
