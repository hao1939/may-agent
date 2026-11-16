# Shared agent runtime: implementation convergence

**Supports:** [Shared Agent Runtime](../2a-design/agent-runtime.md). Remove execution differences without making standalone understand Host Tasks.

**Choice basis:** [Simple first](../1-principles/core-principles.md#simple-first). Repair existing boundaries and remove duplicate decisions before adding interfaces or state.

**Design status:** Accepted direction; the owning contract is in `2a-design/`.
**Implementation status:** Partial. Standalone skill activation, service absence,
snapshots and workspace prerequisites are implemented foundations, followed by
the root/App SDK split and bounded helper lifecycle. Hosted invocation, parent
worker supervision and paired adoption remain incomplete. The
[source record](../archive/implementation/host-ingress-sdk-source-review-20261116.md)
pins the completed scope; source status is not deployment evidence.

## One authority for the design

[Shared Agent Runtime](../2a-design/agent-runtime.md) owns the seven agreed rules:
provided tools power the agent; context is ordinary information; skills are
optional with consistent explicit activation; absent backends return errors;
working directories are environment setup; definitions stay consistent for an
invocation; and one lifecycle executes the agent in either environment.

[Host Runtime](../2a-design/runtime.md) owns orchestration, supervision and recovery.
[Task attempts](../2a-design/task-attempts.md) own durable claim/settlement. Neither
requires another agent implementation. SDK entry points and compatibility limits
are owned by [SDK](../2a-design/sdk.md).
The [ingress/SDK follow-up](host-ingress-and-boundary-simplification-20261116.md)
owns the shared-run/App/Conversation integration sequence; this record retains
the complementary parent-worker supervision boundary.

The [earlier migration and review record](../archive/unified-agent-instance-runtime.md)
and [workflow extraction record](../archive/workflow-business-host-boundary.md)
retain useful decisions, intermediate APIs and prior claims. They are historical,
not competing normative specifications or evidence that every listed PR shipped
the behavior it proposed.

## Remaining implementation work

| Boundary | Smallest useful change | Verification |
| --- | --- | --- |
| Hosted agent invocation | Make Host execution call shared `run()` and its kernel lifecycle with explicit controls/providers. | Real Host finish/rejection, cancellation, identities, cleanup and checkpoint recovery. |
| Worker input and capabilities | Remove injected Task briefs/tools/schema from domain workers; construct explicit current input at the App boundary. | Hosted/standalone payload parity, explicit coordinator tools and fresh resumed input. |
| Storage and settlement | Parent owns Host SQLite; connect the existing result translator and preserve finite-assignment eligibility. | No child Host DB connections; admitted results, stale generations and restart cannot falsely close work. |
| Paired adoption | Migrate App/coordinator imports and workers against an exact Host/SDK revision. | Whole-pair checks plus blocked/wake/resume/completion through the real App. |
| Host worker supervision | Supply parent-owned bounds for bounded attempt and startup-recovery workers; explicitly handle ongoing native executors. | A hung child cannot hold readiness/capacity indefinitely behind a healthy daemon; retain ownership until confirmed exit/cleanup. |

These changes replace existing decisions; they must not add a parallel runner,
Task ledger or retry owner. Preserve exact authority, accepted results, effect
identities and useful evidence. Domain acceptance and continuation remain
App/caller decisions, not inference from generic prose or tool names.

## Evidence and limits

The earlier review at Host `4c2ddaa3e4` ran 286 focused tests across 11 Host/SDK
files with no failures.
Temporary, model-free fixtures additionally reproduced: missing standalone
explicit skill delivery, Task outcome/acceptance absent from prompt-agent context,
mutable identity after catalog capture, acceptance of an unallocated required
Task worktree, and unbound reads returning `null`. Those standalone reproductions
predate the completed convergence work and are
not a current defect list. The worker-supervision finding is from production
wiring inspection, not a live hung-worker incident.

Tests demonstrate existing contracts, not full parity or long-running deployment
health. Use the owning [paired acceptance cases](../2a-design/agent-runtime.md#acceptance)
for subsequent source work. Keep any compatibility/API changes explicit and
update affected consumers together. Runtime tests and installed adoption remain
separate from documentation integrity checks.
