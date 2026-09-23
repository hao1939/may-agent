---
title: "Cocoon Sandbox: warm-pool latency and credential-bearing egress as one runtime contract"
source: github
date: 2026-09-12
last_updated: 2026-09-23
type: finding
tags: [github, agent-infrastructure, microvm, sandboxing, warm-pools, egress, credential-proxy, cloud-hypervisor]
relevance: high
---

<ai_context>
summary: "An implementation-backed GitHub signal that agent sandbox latency and security are being designed together: cocoonstack/sandbox combines warm/golden-snapshot MicroVM provisioning with NIC-less default execution and host-side, allow-listed credential injection. Its documentation reports sub-millisecond warm claims while explicitly retaining deployment limitations and refusing snapshot lifecycle operations where egress re-locking would create an exposure window."
triggers: ["cocoonstack sandbox", "MicroVM warm pool", "golden snapshot clone", "NIC-less agent sandbox", "guarded egress", "host-side credential injection", "Cloud Hypervisor agent runtime"]
last_updated: "2026-09-23"
source_basis: "GitHub repositories and pinned contents: cocoonstack/sandbox at f744e313990dd8e7e28d0bdb9266d1d5cca84096 and cocoonstack/sandbox-operator at f5f20d91a6c3b4211390e941cb9afb9cc4975251, discovered via the GitHub repository Search API."
</ai_context>

# Cocoon Sandbox: warm-pool latency and credential-bearing egress as one runtime contract

## Observation

The repository **cocoonstack/sandbox** is a useful implementation signal because it does not treat fast environment allocation and secure tool access as separate add-ons. At inspected revision `f744e313990dd8e7e28d0bdb9266d1d5cca84096`, the repository contains a Cloud Hypervisor MicroVM control plane, guest daemon, Go and Python SDKs, MCP and framework adapters, protocol fixtures, and extensive tests. Its architecture couples two operational goals:

1. move MicroVM provisioning off the request path with warm pools and golden-snapshot clones; and
2. keep the default guest NIC-less while granting selected network effects through a host-enforced proxy that holds credentials outside the guest.

**Inspected revision:** [`f744e313990dd8e7e28d0bdb9266d1d5cca84096`](https://github.com/cocoonstack/sandbox/tree/f744e313990dd8e7e28d0bdb9266d1d5cca84096)

## Source-grounded details

### Provisioning is tiered rather than uniformly “instant”

The pinned performance document reports end-to-end claim latency on a specified bare-metal AMD/KVM host as:

- **0.2–0.7 ms** for a warm-pool hit, where the request performs ownership transfer and refill happens in the background;
- **about 26–39 ms** for a pool miss when a golden snapshot exists; and
- **about 215–400 ms** for a cold boot with no golden snapshot.

This is more informative than a single startup headline. It exposes the queueing/capacity mechanism behind the fast path and acknowledges concurrent-restore degradation. The repository says refill concurrency is bounded and separately measures burst claims and pool recovery.

These are **project-reported measurements, not independently reproduced results**. The document names the machine class and reproduction harness, and warns that nested virtualization inflates lifecycle latency. That makes the figures useful architecture evidence without turning them into universal performance claims.

### The default network boundary is “no NIC,” not merely an outbound ACL

The documented `net=none` lane exposes only vsock to the guest. Approved HTTP effects are relayed to a host-side proxy, where policy is evaluated and credentials are injected. The guest receives the response but not the credential itself. The policy is default-deny, and the proxy rejects loopback, private, link-local/metadata, CGN, and relevant IPv4-embedding IPv6 destinations.

A separate `net=egress` lane can attach a NIC, but the host applies a fail-closed nftables lock before handing out the claim. The project explicitly refuses hibernate, fork, checkpoint, promote, and related snapshot operations for that lane because resuming before the new tap is re-locked would create an unguarded-NIC window.

That refusal is the strongest design signal: lifecycle convenience is subordinated to a continuous enforcement invariant rather than being offered with a best-effort security caveat.

### Isolation, authorization, and durability remain distinct boundaries

The security document is unusually explicit about what the VM does **not** solve:

- Cloud Hypervisor processes are not additionally sandboxed, so a VMM escape reaches the host with the VMM process's privileges.
- The control/data plane uses bearer tokens over plain HTTP and is intended for a trusted private network.
- Checkpoints can contain full guest memory and must be protected like backups.
- Local JSONL audit and usage journals are not tamper-evident.
- Dataset read-only mode protects shared-image integrity, not confidentiality or cross-tenant cache availability.

This prevents “MicroVM isolation” from being mistaken for complete runtime governance.

## Follow-up: fast claims create a read-after-write problem (2026-09-23)

The companion **cocoonstack/sandbox-operator** repository exposes a less obvious consequence of moving warm-sandbox ownership transfer into the sub-millisecond path. At inspected revision [`f5f20d91a6c3b4211390e941cb9afb9cc4975251`](https://github.com/cocoonstack/sandbox-operator/tree/f5f20d91a6c3b4211390e941cb9afb9cc4975251), a claimed sandbox is live on its node before the node's periodic `NodeInventory` publish makes it visible to the Kubernetes-facing read model. The project reports a default 30-second publish cadence and measured median visibility delays of 29.0 seconds through its E2B surface and 28.6 seconds through the aggregated API. Thus a successful create could historically be followed by a `404` or `502` on the client's first files, commands, or lifecycle request.

The current implementation repairs **point reads**, not the whole consistency model:

- The API server remembers which node served a claim, consults that node first, and—on a claim-ID miss—can ask every node via `GET /v1/sandboxes/{id}` using the fleet credential. A name that this replica did not create has no equivalent per-node query and can remain invisible until inventory publication.
- The `envd` proxy deliberately holds no fleet credential. On an inventory miss it probes nodes with `GET /v1/sandboxes/{id}/owner` using the caller's sandbox token; only the owner should answer. It caches a hit for one minute, uses fan-out concurrency of 16, bounds the probe to 500 ms, and limits fresh probes per replica (documented as 200 new sandboxes per second).
- `List` and `Watch` remain eventually consistent, as can a name lookup on a different API-server replica. When the proxy's probe budget is exhausted, an unpublished sandbox can still return `502` until the next inventory publish.

Tests in the pinned tree cover an unpublished claim-ID lookup, a silent-node timeout, targeting only the node that served a locally known claim, denial without claim-routing credentials, successful proxy use before inventory publication, rejection of another sandbox token, caching of the discovered owner, and refusal to probe beyond the rate limit. Scout inspected these tests but could not execute them because this environment does not have Go installed.

### Operational implication

Warm pools shift the latency bottleneck from **starting compute** to **making ownership discoverable**. A control plane can therefore truthfully report sub-millisecond allocation while still failing the first useful tool call unless its data plane has a credential-safe authoritative lookup path. Consistency claims should be scoped by operation: create acknowledgement, point lookup by opaque ID, name lookup, list/watch visibility, and data-plane routing are distinct guarantees. The fallback also needs an explicit overload contract—bounded fan-out protects the fleet by intentionally reintroducing temporary failure under burst load.

## Why this matters

A recurring agent-infrastructure tradeoff is framed as **containers are fast; VMs are safe**. This repository points to a more precise formulation:

> MicroVMs become request-path infrastructure when capacity is pre-provisioned, but the security contract must cover every lifecycle transition—not just initial boot.

The warm-pool fast path makes a sandbox-per-task or sandbox-per-branch pattern operationally plausible. The egress design then shows why allocation speed alone is insufficient: agents need selected credential-bearing effects, and those effects should be granted without copying durable secrets into an environment the workload controls.

The non-obvious connection is that **performance state and security state are coupled**. A snapshot, fork, or resume is not only a compute optimization; it can duplicate identity, memory-resident secrets, network attachment state, and stale enforcement assumptions. Cocoon Sandbox handles one such conflict by disabling snapshot lifecycle verbs on the guarded-NIC lane rather than pretending the states compose safely.

## Relation to existing Scout findings

- [AgentENV — Distributed Agent Environment Platform](./2026-08-02-github-agentenv-distributed-sandbox-platform.md) established the snapshot/fork and high-density MicroVM substrate for agentic RL. Cocoon Sandbox adds a complementary operational question: how that fast substrate grants narrow external effects without placing credentials in the guest.
- [Hoplite and the VM-per-Thread Cloud Agent Workspace](./2026-08-06-hn-hoplite-vm-per-thread-workspaces.md) showed product demand for one isolated environment per thread. This repository supplies implementation-level evidence for how warm allocation, lifecycle operations, and egress policy interact beneath that product model.

## Evidence boundary

The inspected tree contains the documented control-plane, guest, policy, SDK, benchmark, and test paths, so this is not repository metadata alone. Scout did **not** build the project, run its KVM acceptance suite, or reproduce its benchmarks. Performance and security behavior above should therefore be read as documented implementation claims at the pinned revision, with the repository's stated limitations preserved.

## Primary sources

- **Repo:** https://github.com/cocoonstack/sandbox
- **Pinned README:** https://github.com/cocoonstack/sandbox/blob/f744e313990dd8e7e28d0bdb9266d1d5cca84096/README.md
- **Pinned performance documentation:** https://github.com/cocoonstack/sandbox/blob/f744e313990dd8e7e28d0bdb9266d1d5cca84096/docs/performance.md
- **Pinned security model:** https://github.com/cocoonstack/sandbox/blob/f744e313990dd8e7e28d0bdb9266d1d5cca84096/docs/security.md
- **Pinned guarded-egress design:** https://github.com/cocoonstack/sandbox/blob/f744e313990dd8e7e28d0bdb9266d1d5cca84096/docs/egress.md
- **Operator repo:** https://github.com/cocoonstack/sandbox-operator
- **Pinned read-after-write change:** https://github.com/cocoonstack/sandbox-operator/commit/f5f20d91a6c3b4211390e941cb9afb9cc4975251
- **Pinned scaling design:** https://github.com/cocoonstack/sandbox-operator/blob/f5f20d91a6c3b4211390e941cb9afb9cc4975251/docs/scaling-design.md
- **Pinned live-lookup implementation:** https://github.com/cocoonstack/sandbox-operator/blob/f5f20d91a6c3b4211390e941cb9afb9cc4975251/pkg/scale/sandboxstore_live.go
- **Pinned proxy resolver:** https://github.com/cocoonstack/sandbox-operator/blob/f5f20d91a6c3b4211390e941cb9afb9cc4975251/pkg/envdproxy/resolver.go
