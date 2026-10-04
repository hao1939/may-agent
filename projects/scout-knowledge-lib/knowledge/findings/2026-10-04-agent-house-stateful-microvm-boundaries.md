<ai_context>
summary: "Agent House (AHVM) is a self-hosted Linux microVM runtime that makes agent persistence an explicit lifecycle contract rather than one undifferentiated 'stateful sandbox' promise. Resident pause, local RAM/disk checkpointing, cold disk recovery, optional asynchronous replication, and managed-run receipts have different durability and recovery semantics. The project also documents fail-closed behavior for uncertain managed runs, but it is an early release not qualified for hostile multi-tenant workloads; Scout inspected source and a successful pinned CI check but did not run its KVM gates."
triggers: ["Agent House", "AHVM", "stateful coding-agent microVM", "agent VM lifecycle", "local checkpoint versus replicated storage", "managed run fencing", "libkrun agent sandbox"]
last_updated: "2026-10-04"
source_basis: "HN item 49955804 and static inspection of mariobm/agent-house at release revision 98606f0fa4fa1e615f1412aa91c8f02d189fbfe0 (v0.3.15), including README, storage, recovery, idle, networking, managed-run, installation, CI, and Rust runtime files. GitHub reported the revision's Rust Build & Test check successful. Scout did not build the private-submodule-dependent VMM or run its KVM, crash, network, or replication gates."
</ai_context>

# A stateful agent VM needs separate pause, checkpoint, durability, and run-settlement contracts

**Date:** 2026-10-04  
**Disposition:** New knowledge  
**Source:** https://news.ycombinator.com/item?id=49955804  
**Repo:** https://github.com/mariobm/agent-house  
**Inspected revision:** [`98606f0fa4fa1e615f1412aa91c8f02d189fbfe0`](https://github.com/mariobm/agent-house/commit/98606f0fa4fa1e615f1412aa91c8f02d189fbfe0) (`v0.3.15`)

## Question

What does Agent House contribute beyond the broad pattern of putting each coding agent in a persistent microVM?

## Source-grounded finding

Agent House, whose CLI and runtime are also called AHVM, provides persistent Linux microVMs on a user-controlled Linux/KVM server. Its reusable contribution is not simply “stateful sandboxes.” The inspected implementation and documentation divide state retention into mechanisms with deliberately different promises:

| Mechanism | Retained state | Released resources | Recovery boundary |
| --- | --- | --- | --- |
| Resident idle pause | Live worker, RAM, attached disk, processes | vCPUs pause; CPU/RAM reservations remain | Guest work resumes the same resident VM; this is not a snapshot or backup |
| Local stop/start | RAM/disk checkpoint for ordinary non-desktop VMs | Worker and RAM are released | Start restores the local checkpoint; host-disk loss can still lose it |
| Cold crash recovery | Guest-synced writes in the local disk path | Dead worker is replaced | A documented KVM gate hard-kills the worker and cold-starts the disk; this does not prove host-power-loss safety or preserve unsynced writes |
| Optional replicated storage | Local durable journal plus asynchronous remote disk uploads | A stopped, synchronized VM can release local cache | Explicit sync succeeds only after equal local/remote sequences and no reported failure; restart is a cold boot, so RAM, processes, and connections are not restored |
| Named local snapshot | A separately registered local RAM/disk bundle | Independent of ordinary stop | Compatibility checks bind architecture, VMM identity/version, kernel digest, device layout, vCPU count, and memory requirements |

This decomposition prevents “persistent” from silently conflating process continuity, local crash recovery, checkpoint rollback, and off-host durability. The docs are also explicit that a successful remote sync is a stopped-disk durability barrier, not a historical checkpoint or control-plane backup.

## Managed work is settled separately from VM state

The managed-run layer adds a second distinction: **preserving a machine is not the same as settling one agent operation**.

A managed finite command receives a durable receipt with an immutable run identity, VM/owner/command binding, runtime budget, guest boot identity, session identity, and terminal outcome. Recovery reconciles the recorded boot and session rather than automatically replaying an ambiguous launch. The documentation explicitly says this prevents duplicate relaunch by the runtime but does not make arbitrary external tool effects exactly once.

For a controller admitted with failure fencing, cancellation, deadline, or nonzero exit is not terminal until the runtime confirms a disk-preserving cold stop. An observed controller exit does not prove detached descendants stopped. If stop fails, the receipt remains unfinished and its activity hold is retained for retry instead of reporting completion while work may still be alive.

Concurrent isolated controllers use a narrower cooperative contract: each owns a native guest session and cancellation marker; one uncertain session must not cold-stop sibling conversations. Lost sessions or unconfirmed cancellation remain unfinished. This is a useful split between **VM-wide fencing** and **session-scoped settlement**, with the isolation strength made explicit rather than inferred from a process exit code.

## Operational pattern

A runtime borrowing this design should name at least four independent contracts:

1. **Residency:** Is the same memory/process image still alive, paused, or gone?
2. **Durability:** Which writes survive a worker crash, host loss, or remote-storage delay?
3. **Rollback identity:** What exact kernel, device layout, image, and runtime generation may consume a checkpoint?
4. **Operation settlement:** What evidence proves the assigned controller and its descendants stopped, and what remains pending when that proof is unavailable?

Resource policy is a fifth contract, not an automatic consequence of VM isolation. AHVM makes CPU, memory, task, API-transport, Ethernet, and storage controls separately configurable. Private destinations are denied unless the host grants exact IPv4-and-port access, while public networking is a separate path. Idle pause retains resource reservations; full stop releases the worker and RAM but does not necessarily release higher-level cloud admission reservations.

## Evidence and limits

- The inspected tree contains Rust CLI, daemon, engine, VMM, network gateway, store, Forge guest service, volume service, unit tests, KVM-gated tests, and operational qualification documents. GitHub's Checks API reported the revision's `Rust Build & Test` job completed successfully.
- Scout did not execute the project. The VMM build depends on a pinned private `libkrucible` submodule, and KVM, guest images, native libraries, dedicated hosts, and object storage are required for important gates. Project-reported KVM, crash, network, and replication results remain unreproduced here.
- The README calls AHVM an early-release evaluation product and says it is not qualified for hostile multi-tenant workloads. Network documentation says production security review and load/fuzz/offload qualification remain pending for some paths.
- Default local checkpoints are not off-host backups. Replication is optional and asynchronous; permanent host-disk loss can lose writes not yet uploaded. A successful replicated restart is a cold boot rather than process continuation.
- The default image asks users to bring provider credentials into the guest. This assessment found no host-side credential-substitution boundary comparable to systems that keep secrets outside the sandbox. MicroVM isolation therefore does not by itself narrow credential authority.
- The HN submission had one point and no comments when inspected. The repository had one GitHub star and two listed contributors, while much of its history originated in the upstream Bhatti project. This is implementation evidence, not evidence of adoption or comparative superiority.
- Public release history and a successful CI check show active packaging discipline, but CI excludes the native VMM workspace crate and cannot replace the separately documented hardware gates.

## Relation to existing Scout findings

- [Cocoon Sandbox](./2026-09-12-microvm-agent-sandbox-warm-pool.md) couples warm allocation to NIC-less execution and host-side credential injection. Agent House contributes a complementary lifecycle lesson: persistent compute needs distinct residency, local checkpoint, remote durability, and run-settlement semantics, but its guest credential boundary is broader.
- [AgentsPool](./2026-09-12-agentspool-scoped-compute-authority.md) separates compute leases from persistent workspace authority. AHVM similarly shows that stopping physical compute, retaining disk state, and releasing cloud admission reservations are different transitions.
- [ThinkingBox](./2026-10-04-thinkingbox-terminal-state-reliability.md) shows that a clean agent trace can disagree with terminal system state. AHVM's managed-run fencing applies the same principle operationally: controller exit alone does not settle potentially surviving tool work.

## Sources reviewed

- [HN item 49955804](https://news.ycombinator.com/item?id=49955804)
- [README at the inspected revision](https://github.com/mariobm/agent-house/blob/98606f0fa4fa1e615f1412aa91c8f02d189fbfe0/README.md)
- [Storage modes and durability semantics](https://github.com/mariobm/agent-house/blob/98606f0fa4fa1e615f1412aa91c8f02d189fbfe0/docs/STORAGE.md)
- [Cold disk recovery boundary](https://github.com/mariobm/agent-house/blob/98606f0fa4fa1e615f1412aa91c8f02d189fbfe0/docs/CRASH-DISK-RECOVERY.md)
- [Resident idle pause](https://github.com/mariobm/agent-house/blob/98606f0fa4fa1e615f1412aa91c8f02d189fbfe0/docs/IDLE-PAUSE.md)
- [Managed run receipts, fencing, and recovery](https://github.com/mariobm/agent-house/blob/98606f0fa4fa1e615f1412aa91c8f02d189fbfe0/docs/MANAGED-RUNS.md)
- [Network boundaries and qualification limits](https://github.com/mariobm/agent-house/blob/98606f0fa4fa1e615f1412aa91c8f02d189fbfe0/docs/NETWORK-ACCESS.md)
- [Installation and validation boundaries](https://github.com/mariobm/agent-house/blob/98606f0fa4fa1e615f1412aa91c8f02d189fbfe0/docs/RUST-INSTALL.md)
- [CI workflow](https://github.com/mariobm/agent-house/blob/98606f0fa4fa1e615f1412aa91c8f02d189fbfe0/.github/workflows/ci.yml)
- [Successful pinned CI check](https://github.com/mariobm/agent-house/actions/runs/37216758135/job/111478717194)

## Discovery coverage

The live HN Algolia `search_by_date` query for `agent` stories (20 newest hits) surfaced item 49955804 after the previous scheduled scan. It was selected because the repository exposes concrete lifecycle, durability, fencing, and verification boundaries rather than only claiming persistent agent machines. Case-insensitive searches for the HN item ID, title, and primary repository URL found no existing Scout note. Broader searches found related microVM, persistent-sandbox, and runtime-hardening notes, but none assessed Agent House or its separation of residency, checkpoint, remote durability, and managed-run settlement, so a distinct source-level finding was warranted.
