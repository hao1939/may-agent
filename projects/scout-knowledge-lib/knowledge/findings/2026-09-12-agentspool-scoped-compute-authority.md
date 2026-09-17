---
title: "AgentsPool: scoped compute authority descends from placement to persistent workspace"
source: github
date: 2026-09-12
last_updated: 2026-09-12
type: finding
tags: [github, agent-infrastructure, capability-security, resource-leases, persistent-sandboxes, lan-compute, least-privilege]
relevance: high
---

<ai_context>
summary: "AgentsPool is an implementation-backed signal for runtime-neutral agent compute: a broad allocator credential performs revision-bound placement and atomic CPU/memory/disk admission, then authority narrows to one resource lease, one persistent sandbox, and one worker operation. Workspace data can survive stopped or expired compute, while reactivation requires a fresh same-node lease and both old-sandbox and new-lease authority. The design usefully separates model/session custody, resource admission, execution capability, and data durability, but remains an alpha trusted-LAN system without per-user quotas or hostile-multitenant isolation."
triggers: ["AgentsPool", "LAN agent compute", "resource lease token", "persistent agent sandbox", "revision-bound placement", "scoped sandbox token", "runtime-neutral compute", "authority descent", "sandbox rebind"]
last_updated: "2026-09-12"
source_basis: "GitHub repository vimalinx/AgentsPool and pinned repository contents at revision a56461ae225bd902e42caa2093a4482eadc4f693, discovered through the GitHub repository Search API."
</ai_context>

# AgentsPool: scoped compute authority descends from placement to persistent workspace

## Observation

The repository **vimalinx/AgentsPool** implements a LAN compute pool for agents without hosting the agent loop itself. At inspected revision `a56461ae225bd902e42caa2093a4482eadc4f693`, the repository contains a Go server, worker, privileged sandbox helper, JSON-schema-described CLI tools, OpenAPI description, Python SDK, systemd deployment units, and tests. The model, prompt, provider credentials, context, and session remain with the calling runtime; the remote pool receives resource and execution requests instead.

**Inspected revision:** [`a56461ae225bd902e42caa2093a4482eadc4f693`](https://github.com/vimalinx/AgentsPool/tree/a56461ae225bd902e42caa2093a4482eadc4f693)

The useful signal is not merely remote execution. It is an object-by-object **descent of authority**:

`Allocator credential → ResourceLease token → Sandbox token → one-time Operation token`

Each transition narrows what the holder can do while preserving an explicit lineage from observed capacity to admitted resources to a particular persistent workspace.

## Source-grounded details

### Placement is admitted against the observed registry revision

The bundled agent skill tells callers to inspect devices, select a node, and submit the exact observed registry revision with CPU, memory, and disk requirements. The server implementation rejects a mismatched revision with `stale_registry_revision`, checks that the node is online, calculates currently reserved and physically available capacity, and creates the resource lease in the same state update.

This is stronger than treating discovery output as timeless advice: placement becomes a compare-and-admit operation. It does **not** prove the telemetry is perfectly current or the machine trustworthy, but it prevents a caller from silently acquiring against a registry state already known by the control plane to have changed.

### Credentials narrow after each lifecycle decision

The repository's security model assigns different powers to distinct bearer credentials:

- the **Allocator token** can discover devices and request resource admission but cannot administer workers or task history;
- a successful admission returns a **ResourceLease token** scoped to that reservation;
- creating a sandbox returns a separate **Sandbox token** with declared `exec`, `data_read`, `data_write`, and `network` permissions;
- a worker claims one operation using its node identity and receives a short-lived **Operation token** for reporting that operation.

The CLI is documented to stop reading or sending the allocator/admin credential once it detects a scoped lease or sandbox token. Repository code also hashes stored lease and sandbox secrets and removes token hashes from public objects.

This makes least privilege a lifecycle transition rather than a static role label. A placement identity does not remain ambient execution authority inside the selected workspace.

### Data lifetime and compute authority are intentionally decoupled

Each sandbox receives persistent `/workspace` and `/home/agent` volumes. Stopping a sandbox releases CPU and memory while retaining those volumes. If a finite lease expires, the worker's monitor fails closed at the last confirmed deadline, but the sandbox data remains. Resuming later requires a fresh lease on the same node and a `rebind` operation authorized by **both** the old Sandbox token and the new ResourceLease token.

That dual proof closes a subtle gap: possession of new compute capacity alone should not grant access to old workspace state, while possession of an old workspace capability alone should not bypass current capacity admission.

### Isolation and tenancy limits remain explicit

The persistent sandbox uses Linux namespaces, cgroups, a dedicated ext4 image, privilege dropping, and capability clearing; network is disabled by default. This is not a MicroVM boundary and does not claim protection from kernel exploits. The project targets trusted LANs/private overlays, uses bearer credentials, and says there is no per-user quota because there is no multi-user identity. Its documentation directs deployments with mutually untrusted users to add an authorization/quota gateway rather than share an Admin token.

These limits matter because scoped object tokens solve authority propagation inside this design; they do not establish strong tenant identity, hostile-workload isolation, high availability, or an independently verified security posture.

## Why this matters

Agent infrastructure often bundles four different concerns into a single “runner credential”:

1. who may choose and reserve compute;
2. who may act in a particular workspace;
3. who may report one operation's result; and
4. who retains access to durable files after compute is released.

AgentsPool demonstrates a more composable contract. Resource admission is revision-bound, execution authority is sandbox-scoped, worker completion is operation-scoped, and durable workspace custody survives compute release without automatically inheriting fresh compute authority.

The reusable design rule is:

> When durable state outlives an execution grant, reactivation should prove both continuity of custody over the old state and a newly valid resource grant.

That rule applies beyond LAN compute—to paused browser sessions, resumable coding workspaces, leased GPUs, and stateful tool runtimes. Persistence should not become an accidental back door around admission, and new capacity should not become an accidental claim on old state.

## Evidence boundary

The GitHub Search API query `"AI agent" sandbox created:>=2026-09-01`, sorted by stars, returned HTTP 200 with `incomplete_results: false`; `vimalinx/AgentsPool` appeared in the first ten results. Scout then pinned the default branch to commit `a56461ae225bd902e42caa2093a4482eadc4f693` and inspected the complete, non-truncated Git tree plus repository-authored README, security and architecture documents, agent skill, resource-admission route, sandbox route, worker lease monitor, and core models.

Scout did **not** build the repository, run its tests, perform the privileged systemd/bubblewrap/ext4 acceptance flow, or inspect a live deployment. Behavior described here is therefore an implementation-backed repository observation, not an independent runtime or security validation. The project had three GitHub stars when inspected; popularity is not part of the claim.

## Primary sources

- **Repo:** https://github.com/vimalinx/AgentsPool
- **Pinned README:** https://github.com/vimalinx/AgentsPool/blob/a56461ae225bd902e42caa2093a4482eadc4f693/README.md
- **Pinned architecture:** https://github.com/vimalinx/AgentsPool/blob/a56461ae225bd902e42caa2093a4482eadc4f693/docs/ARCHITECTURE.zh-CN.md
- **Pinned security model:** https://github.com/vimalinx/AgentsPool/blob/a56461ae225bd902e42caa2093a4482eadc4f693/docs/SECURITY.md
- **Pinned agent skill:** https://github.com/vimalinx/AgentsPool/blob/a56461ae225bd902e42caa2093a4482eadc4f693/.agents/skills/agentspool-compute/SKILL.md
- **Pinned resource admission implementation:** https://github.com/vimalinx/AgentsPool/blob/a56461ae225bd902e42caa2093a4482eadc4f693/internal/server/routes_registry.go
- **Pinned sandbox implementation:** https://github.com/vimalinx/AgentsPool/blob/a56461ae225bd902e42caa2093a4482eadc4f693/internal/server/routes_sandbox.go
- **Pinned worker lease monitor:** https://github.com/vimalinx/AgentsPool/blob/a56461ae225bd902e42caa2093a4482eadc4f693/internal/worker/sandbox.go
