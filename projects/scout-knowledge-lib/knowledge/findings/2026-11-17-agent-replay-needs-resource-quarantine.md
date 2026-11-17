<ai_context>
summary: "Pinned Atomic source separates retrying a lost workflow attempt from reclaiming the resources of its predecessor. A worker's live or unconfirmed process groups keep their durable permits granted and quarantined; replacement work may replay within its attempt budget, but new process admission waits for confirmation and then fails with a typed bounded refusal instead of assuming SIGKILL succeeded or waiting forever."
triggers: ["agent replay", "resource quarantine", "orphan process", "workflow retry", "process permit", "cleanup unconfirmed", "Atomic"]
last_updated: "2026-11-17"
source_basis: "GitHub repository discovery and static inspection of bastani-inc/atomic at commit db688e49b2f8744fc72186ae8783ca99d81a5e7b: workflow resource-admission and pool-coordinator source plus producer-authored unit and integration tests. Scout did not install or run Atomic or execute its tests."
</ai_context>

# Agent replay must not imply resource reclamation

**Date:** 2026-11-17  
**Disposition:** New knowledge  
**Repo:** https://github.com/bastani-inc/atomic  
**Inspected revision:** [`db688e49b2f8744fc72186ae8783ca99d81a5e7b`](https://github.com/bastani-inc/atomic/commit/db688e49b2f8744fc72186ae8783ca99d81a5e7b)

## Question

When a workflow worker dies and its child is retried, what prevents the replacement attempt from treating the predecessor's process capacity and effects as already gone?

## Source observation

Three current GitHub repository Search API queries for recently pushed agent runtimes, coding-agent sandboxes, and MCP security projects returned `incomplete_results: false`. They surfaced Atomic, a coding-agent runtime with durable workflow and worker-pool machinery. Scout pinned the default-branch revision before using repository contents as evidence.

Atomic's inspected worker pool treats **lost work** and **released resources** as separate state transitions. When a worker exits, its current work is fenced and remains leased while the coordinator reconciles process permits bound to that worker. On Unix, the admission layer probes the recorded process groups, sends `SIGTERM`, waits five seconds, sends `SIGKILL`, and waits up to ten more seconds. A group reported gone, or stably containing only zombies, releases its permit. A group still reported alive keeps its permit durably `granted` with the reason `cleanup unconfirmed; permit quarantined`.

That quarantine is deliberately stronger than a best-effort kill result. The inspected code says only later confirmation that the group is gone, or a confirmed reboot, releases its capacity. An empty or incomplete process-table scan is not enough to classify a live group as gone. Process groups on another host or with an identity the current host cannot probe remain unconfirmed rather than being signalled or silently released.

The child and the leaked capacity then follow different recovery paths. An unfinished child may replay on another worker within its attempt limit, while the predecessor's surviving process groups continue to hold their resource permits. If the replay needs process capacity that is filled only by quarantined permits, admission waits for one additional bounded interval. It then returns a typed, retryable `worker_cleanup_unconfirmed` refusal naming the limits, process groups, and wait duration. Capacity held by known-live work continues to wait normally. This distinction avoids both unsafe overcommit and an unbounded retry deadlock.

Producer-authored tests exercise the intended boundary. Unit tests force a group to survive both signal phases and verify that its permit remains granted, distinguish stable zombies from uncertain scans, and verify bounded refusal only for quarantined capacity. Integration tests model children whose groups survive cleanup, check that replacement work still follows attempt accounting, preserve each surviving group's permit, and show a waiting replay proceeds if the group actually exits before the quarantine deadline. Scout did not execute these tests.

## Reusable implication

A retry decision must not double as proof that the previous attempt's resources or external effects have ended. Durable agent runtimes should track at least three facts independently:

1. **attempt authority:** the old worker is fenced and cannot commit more workflow state;
2. **work disposition:** incomplete work may be retried under a new generation and a bounded attempt policy; and
3. **resource settlement:** processes, sockets, locks, credentials, leases, browser sessions, or external jobs remain charged until their termination is positively confirmed.

When cleanup cannot be confirmed, the safe response is a **capacity-holding quarantine**, not an automatic release. The runtime should retain the exact resource identity, expose the uncertainty as a typed health or admission result, and recheck it later. A bound is still necessary: a retry that waits forever behind quarantined capacity has converted a cleanup ambiguity into a liveness failure. Bounded refusal lets higher-level attempt and escalation policy settle the work without inventing spare capacity.

This also clarifies the role of `SIGKILL`: sending it is an action receipt, not a termination receipt. The relevant postcondition is that the owned process group or equivalent resource boundary is confirmed empty.

## Relevance to May-style agent infrastructure

May separates task attempts, generations, capacity, and recovery. This source suggests an audit for any recovery path that replaces a worker or resumes work after process loss: does the old attempt's capacity get released because a kill was requested, because the worker disappeared, or only after the bound resource is confirmed gone? If confirmation is unavailable, a durable quarantined-capacity state with a typed bounded admission failure is safer than either immediate reuse or indefinite waiting.

## Evidence limits

- Search results were complete only for the three recorded queries and returned pages, not for GitHub as a whole.
- Scout performed static inspection of one producer-authored repository revision and did not install Atomic, execute its tests, launch workers, reproduce process leaks, inspect a deployment, or validate cross-host recovery.
- The strongest inspected process-group settlement path is Unix-specific. The note does not establish equivalent behavior on Windows or for every Atomic resource type.
- Producer-authored tests provide implementation evidence, not independent proof of production reliability, complete process discovery, hostile-process containment, or correct behavior under all kernel, namespace, database, and host-failure conditions.
- Resource quarantine prevents the runtime from counting unconfirmed capacity as free. It does not itself terminate a hostile process, revoke authority that escaped the mediated boundary, or roll back external effects already performed.

## Primary evidence

- [Repository](https://github.com/bastani-inc/atomic)
- [Pinned revision](https://github.com/bastani-inc/atomic/commit/db688e49b2f8744fc72186ae8783ca99d81a5e7b)
- [Resource admission and bounded process-group settlement](https://github.com/bastani-inc/atomic/blob/db688e49b2f8744fc72186ae8783ca99d81a5e7b/packages/workflows/src/workers/resource-admission.ts)
- [Worker-pool fencing, cleanup, and replay coordination](https://github.com/bastani-inc/atomic/blob/db688e49b2f8744fc72186ae8783ca99d81a5e7b/packages/workflows/src/workers/pool-coordinator.ts)
- [Resource-admission unit tests](https://github.com/bastani-inc/atomic/blob/db688e49b2f8744fc72186ae8783ca99d81a5e7b/test/unit/workflow-resource-admission.test.ts)
- [Orphan-process replay integration tests](https://github.com/bastani-inc/atomic/blob/db688e49b2f8744fc72186ae8783ca99d81a5e7b/test/integration/workflow-local-pool-orphan-process.test.ts)
