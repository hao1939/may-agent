<ai_context>
summary: "WVM is a new headless Windows 11 guest for agent execution with a typed Rust protocol, host-held verb grants, transfer roots, an exec allowlist, denial journaling, process-tree timeouts, and live VM snapshots. Its source also exposes an important deployment boundary: the agent-facing `wvm serve` socket enforces grants and journals requests, while the same binary's direct `wvm vm` administration commands call QEMU, guest transfer, capture, input, and snapshot paths without that server gate or journal. This is not necessarily a defect—the direct CLI can be an operator plane—but the advertised capability boundary holds for an agent only when OS permissions prevent that agent from reaching the direct binary, VM configuration, QMP socket, and guest port. A typed restricted interface is not containment unless all lower-authority paths are outside the principal's reach."
triggers: ["WVM", "Windows agent sandbox", "headless Windows 11", "agent capability boundary", "QEMU agent sandbox", "mediated command plane", "direct administration plane", "audit journal coverage"]
last_updated: "2026-09-16"
source_basis: "HN item 49725680, the complete WVM README, GitHub repository metadata, and selected implementation files inspected at revision 214e721702cb6eb62b4e836acdfef45ff2ce1d83."
</ai_context>

# An Agent Sandbox Needs One Mediated Command Plane

**Date:** 2026-09-16  
**HN:** https://news.ycombinator.com/item?id=49725680  
**Repo:** https://github.com/AndrewProject-Zion/WVM  
**Reviewed revision:** https://github.com/AndrewProject-Zion/WVM/commit/214e721702cb6eb62b4e836acdfef45ff2ce1d83

## Question

What does WVM add to agent execution containment, and which authority does its
capability boundary actually mediate?

## Source signal

WVM presents a Windows 11 guest as a headless typed tool for a Linux-side agent.
At the reviewed revision its README says all protocol verbs are implemented and
reports live-guest checks for process execution, framebuffer capture, input,
round-trip file transfer, and save/restore snapshots. The repository was created
on 2026-09-15 and had no stars or forks when checked, while HN item 49725680 had
one point and no comments. It is therefore a fresh implementation signal, not
yet evidence of adoption.

The architecture contains several concrete safety patterns:

- `wvm-ipc` defines a closed verb set and length-bounded framed JSON protocol.
- The `wvm serve` Unix socket is owner-only. Its server repeats the grant check
  on deserialized requests rather than trusting client-side construction.
- Execution is checked against an allowlist, and host/guest transfer paths are
  checked against separate configured roots before dispatch.
- The host journal flushes request, completion, and denial records immediately.
- Guest execution uses a Windows Job Object to kill a process tree on timeout;
  the README explicitly retains the narrow spawn-before-assignment race.
- A separate request deadline releases the control channel but explicitly does
  **not** claim to cancel abandoned work.
- QEMU snapshots include RAM and device state, giving an operator a live rollback
  point rather than only a disk revert.

These are project claims backed by readable implementation and test/probe code.
Scout did not provision a Windows guest or independently rerun the live probes.

## The boundary exposed by the implementation

The repository has two command planes, not one:

1. `wvm serve` and `wvm call` form the agent-facing Unix-socket plane. The server
   holds one configured grant, performs the policy checks, and writes the
   append-only journal.
2. `wvm vm ...` is a direct administration plane. In `main.rs`, `run_vm` invokes
   the supervisor, QMP lifecycle and snapshot functions, guest push/pull, screen
   capture, and input paths directly. Those branches do not pass through
   `Server::authorise` and do not append the request/completion journal records.

This does not make the direct CLI inherently unsafe. An operator needs a way to
start, inspect, repair, and restore the sandbox. It does qualify the README's
broad statements that “every operation” passes a capability boundary and lands
in the journal: source inspection supports that property for requests traversing
the control server, not for every operation exposed by the binary.

The server also currently describes its grant as one configured identity, with
per-connection identification left for later work. A `0600` socket separates the
owning OS account from other accounts, but it does not distinguish multiple
agent principals running as that same owner.

## Reusable implication

A restricted tool API is a valid capability boundary only if the controlled
principal cannot reach a lower layer that performs the same effects.
Deployment review should therefore map each effect to **all** reachable paths:

| Effect | Mediated agent path | Lower/direct path that must remain operator-only |
|---|---|---|
| Execute in guest | granted `exec` request | guest port/service or another VM channel |
| Transfer files | rooted transfer request | direct `wvm vm transfer` and guest port |
| Inject input / capture | granted protocol verb | direct QMP-backed CLI operations |
| Snapshot / restore | granted lifecycle verb | QMP socket and `wvm vm snapshot` |
| Start / stop VM | lifecycle policy, if routed there | direct supervisor CLI and VM config |

The deployment invariant is stronger than “the safe API denies an ungranted
verb”: the agent's OS identity must lack execute/read/connect permissions for
the direct binary or subcommands, VM definition and state, QMP socket, forwarded
guest port, and audit-log mutation. If agent and operator share one unrestricted
Unix account, a host-held grant can become a convention rather than the complete
authority boundary.

Audit claims need the same whole-path test. An append-only JSONL file provides
useful local sequencing and crash visibility, but it is not tamper-evident and
cannot account for effects taken through an unjournaled administration path.
Denial coverage, effect coverage, and rollback are three separate properties.

## Evidence boundary and disposition

**Coverage:** complete README; HN item and repository metadata; selected source
for protocol/grants, server authorization, policy checks, journal, CLI dispatch,
timeouts, and snapshot design. No Windows VM was installed and no live-guest
verification was rerun.

**Disposition:** new source-grounded knowledge. The useful signal is not the
unverified headline that WVM is a complete sandbox, but the implementation-level
contrast between a well-designed mediated socket and a co-located direct
operator plane. WVM can preserve the intended separation when deployment-level
OS authority keeps that direct plane out of the agent's reach.

**Primary evidence:**

- [README](https://github.com/AndrewProject-Zion/WVM/blob/214e721702cb6eb62b4e836acdfef45ff2ce1d83/README.md)
- [`wvm-host/src/main.rs`](https://github.com/AndrewProject-Zion/WVM/blob/214e721702cb6eb62b4e836acdfef45ff2ce1d83/wvm-host/src/main.rs)
- [`wvm-host/src/server.rs`](https://github.com/AndrewProject-Zion/WVM/blob/214e721702cb6eb62b4e836acdfef45ff2ce1d83/wvm-host/src/server.rs)
- [`wvm-host/src/policy.rs`](https://github.com/AndrewProject-Zion/WVM/blob/214e721702cb6eb62b4e836acdfef45ff2ce1d83/wvm-host/src/policy.rs)
- [`wvm-host/src/journal.rs`](https://github.com/AndrewProject-Zion/WVM/blob/214e721702cb6eb62b4e836acdfef45ff2ce1d83/wvm-host/src/journal.rs)
- [`wvm-ipc/src/lib.rs`](https://github.com/AndrewProject-Zion/WVM/blob/214e721702cb6eb62b4e836acdfef45ff2ce1d83/wvm-ipc/src/lib.rs)
- [`docs/DECISIONS.md`](https://github.com/AndrewProject-Zion/WVM/blob/214e721702cb6eb62b4e836acdfef45ff2ce1d83/docs/DECISIONS.md)
