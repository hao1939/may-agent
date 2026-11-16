# Shared agent runtime: implementation convergence

**Supports:** [Shared Agent Runtime](../2a-design/agent-runtime.md). Remove execution differences without making standalone understand Host Tasks.

**Choice basis:** [Simple first](../1-principles/core-principles.md#simple-first). Repair existing boundaries and remove duplicate decisions before adding interfaces or state.

**Design status:** Accepted direction; the owning contract is in `2a-design/`.
**Implementation status:** Partial, reviewed at Host `4c2ddaa3e4`. Portable preparation, skills, model execution and the workflow kernel exist. Full standalone/Host parity and parent worker supervision remain incomplete. No runtime change or deployment is established by this documentation refinement.

## One authority for the design

[Shared Agent Runtime](../2a-design/agent-runtime.md) owns the seven agreed rules:
provided tools power the agent; context is ordinary information; skills are
optional with consistent explicit activation; absent backends return errors;
working directories are environment setup; definitions stay consistent for an
invocation; and one lifecycle executes the agent in either environment.

[Host Runtime](../2a-design/runtime.md) owns orchestration, supervision and recovery.
[Task attempts](../2a-design/task-attempts.md) own durable claim/settlement. Neither
requires another agent implementation. Current SDK types remain callable; this
record does not propose a universal context object, service registry, result
schema, agent base class or new public invocation signature.

The [earlier migration and review record](../archive/unified-agent-instance-runtime.md)
and [workflow extraction record](../archive/workflow-business-host-boundary.md)
retain useful decisions, intermediate APIs and prior claims. They are historical,
not competing normative specifications or evidence that every listed PR shipped
the behavior it proposed.

## Remaining implementation work

| Boundary | Smallest useful change | Verification |
| --- | --- | --- |
| Agent invocation | Make manager/session execution use the portable lifecycle, supplying controls and persistence through explicit adapters. Remove duplicated corrective finish, recovery and terminal classification. | Paired finish/rejection, partial-result, cancellation and cleanup races; existing Host persistence/recovery regressions. |
| Tools and services | Resolve effective tools explicitly with actual local or Host-backed implementations. Remove mode-derived grants/denials; keep explicit caller/installation restrictions. | Provided delegation and work-management tools have identical schemas/results/errors; unavailable backends cannot succeed silently. |
| Context and result boundary | Share generic preparation and refresh with ordinary assignment/facts/references. Keep Host claim/lease coordinates private and translate explicit caller/App results at settlement. | Root and helper context, refresh/compaction, stale reads, rejected results and Host Task acceptance without a Host-specific agent lifecycle. |
| Skills | Pass deliberate selection to shared full-body activation; retain optional discovery. | Availability alone loads no body; explicit selection delivers the requested body or rejects an unavailable name in either mode. |
| Missing services | Replace production use of test-style reads and silent partial-binding defaults with actual local adapters or explicit errors. | Successful absent-item/empty-list reads remain distinct from unavailable/failed services and denied effects. |
| Directory setup | Check declared isolation prerequisites before dispatch in either environment. Keep allocation and cleanup environment-owned. | Missing required checkout rejects before effects; supplied paths work consistently. |
| Definition consistency | Retain one resolved definition and any supporting source whose consistency is required. Avoid a new snapshot service. | Mid-invocation source changes cannot silently replace instructions, tools or selected skill bodies; later invocations can adopt updates. |
| Host worker supervision | Supply parent-owned bounds for bounded attempt and startup-recovery workers; explicitly handle ongoing native executors. | A hung child cannot hold readiness/capacity indefinitely behind a healthy daemon; retain ownership until confirmed exit/cleanup. |

These changes replace existing decisions; they must not add a parallel runner,
Task ledger or retry owner. Preserve exact authority, accepted results, effect
identities and useful evidence. Domain acceptance and continuation remain
App/caller decisions, not inference from generic prose or tool names.

## Evidence and limits

The source review ran 286 focused tests across 11 Host/SDK files with no failures.
Temporary, model-free fixtures additionally reproduced: missing standalone
explicit skill delivery, Task outcome/acceptance absent from prompt-agent context,
mutable identity after catalog capture, acceptance of an unallocated required
Task worktree, and unbound reads returning `null`. The worker-supervision finding
is from production wiring inspection, not a live hung-worker incident.

Tests demonstrate existing contracts, not full parity or long-running deployment
health. Use the owning [paired acceptance cases](../2a-design/agent-runtime.md#acceptance)
for subsequent source work. Keep any compatibility/API changes explicit and
update affected consumers together. Runtime tests and installed adoption remain
separate from documentation integrity checks.
