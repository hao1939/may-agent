# Task resources: a clear entry into durable work

**Supports:** [Task reads](../2a-design/task-resource-read-interface.md). Workers need usable assignment and evidence access to complete work and recover without operator hints.

**Choice basis:** [One authority for each resource](../1-principles/core-principles.md#one-authority-for-each-resource); [agent judgment and code mechanics](../1-principles/code-vs-data.md); [compare value and cost](../1-principles/design-philosophy.md#value-and-cost).

**Design status:** Proposed entry/read refinements; existing storage remains authoritative.
**Implementation status:** Existing facilities plus unproved usability improvements.
Reviewed October 3 from unmerged September drafts `dc46463cca` and `274e67697a`.
This document does not introduce a new SDK field or change installed behavior.

## Decision

Infra preserves the assignment, current state and evidence, and supplies usable
access. The agent chooses which material to retrieve and how to reason with it.
Workflow authors can encode an appropriate procedure. Executor adapters carry
the same supported semantics in their natural interfaces.

Keep canonical SQLite Task/input/attempt/Condition records and existing artifact
locations. The generated `TASK.md`, snapshot and catalog are navigation and
execution evidence. They are not a writable Task database. A copied snapshot is
neither a current-state read nor proof that the native worker has a live tool.

## What the entry must make clear

| Information | Why it matters | Existing owner |
| --- | --- | --- |
| Exact assignment, contribution, authority and result contract | A helper must not mistake access to the parent Task for ownership of it | Task attempt and invocation |
| Assigned input | It is already claimed by this attempt and may contain the correction it must consider | Attempt event batch and linked context |
| Currently pending input | It covers unclaimed input at the observed revision; empty does not mean the attempt has no work | Scoped Task read |
| Accepted result and independent obligations | Useful progress, unanswered requirements and Conditions can coexist | Accepted attempt, exact input links and Conditions |
| Current reads and omitted detail | Short context must remain usable and truthful about coverage | Existing reader, artifact references and catalog |
| Prior execution and effect receipts | Recovery must not assume a failed process had no effects | Execution evidence and the owning capability's receipt |

Infra can label types, versions, omissions and exact references mechanically.
The agent judges relevance and whether the addressed requirements are fulfilled.
Reading, considering, reporting and fulfilling are different facts. No new
read acknowledgment, mandatory read order or semantic progress score is proposed.

## Start, live input and recovery

Supply the assignment and entry reference on every applicable invocation,
including resume and helper dispatch. Keep helper-specific scope intact.
Managed workers already receive refreshed decision context. Whether a smaller
entry plus selective reads is better remains a comparison, not a reason to
silently remove current context delivery.

New input stays durable. Supported adapters can notify the live worker; a missed
hint leaves the input for reconciliation. Cancellation and stale-effect fences
remain infra responsibilities. The worker chooses whether to continue independent
work, revise its plan or yield. A waiting Condition alone does not force it to
stop or prevent an admitted convergence judgment.

Routine retry belongs to the owning infra capability. Recovery reuses its
retained operation identity and receipt. An agent may choose an explicit retry,
repair or alternative from the evidence. Follow the shared
[retry contract](../2a-design/system-boundary.md#retry-and-recovery-ownership),
including disclosed exceptions where an external effect remains unknown.

## What the missed-review case proves

The September record found review request
`app_8fc834e0-f006-43ec-bf45-05299689d2f9` assigned to attempt
`r_1_92ecbe1e-cee1-4d96-b750-bb06b490577f`. Its preview was weak, but it included
an omission marker and exact detail reference. The full review existed. The
worker read current state and an earlier result, treated an empty unclaimed
window as absence of assigned work, and missed the review. A human correction
on the same Task led it to inspect the detail.

This supports clearer presentation and agent evidence-use guidance. It does not
establish lost storage, autonomous recovery, or the need for a new context ledger.
The existing data could distinguish one assigned review, no unclaimed input,
an independent approval and prior execution without a storage migration.

## Smallest useful comparison

Compare the current entry with a clearer ordering of assignment, input scopes,
accepted work, waits and exact reads. Use one long correction plus a transfer
case, a previous accepted result, independent approval, and an interrupted
effect with a retained receipt. Measure missed requirements, repeated effects,
human hints, result quality and actual request cost under the same allowance.

Deterministic checks establish truthful links, scope and durable state. A model
trial assesses discovery and use. Failure to read a detail does not by itself
prove an infra failure; a missing capability cannot be repaired by instructions.
Extend the existing reader only for a demonstrated access gap.

The related Gym practice draft (`ebf86427b6`) remains an unadopted experiment:
it proposes fresh-worker transfer and independent evaluation of methods. Keep
that experiment with its source in the archive rather than establishing a
mandatory Host context-preparation procedure. Complete entry history and generic
annotation-driven behavior also remain unimplemented proposals.

The [App environment review](app-environment-review-20260928.md) owns the adoption
question; the [capability contract proposal](task-execution-capability-contracts-20261003.md)
owns the common agent/workflow/executor direction. Source provenance and recovery
instructions are in the [workspace review](workspace-hygiene-review-20261003.md).
