---
title: "Containarium — Egress Containment Is an Activated, Protocol-Scoped Property"
source: github
date: 2026-09-10
last_updated: 2026-09-23
type: finding
tags: [github, agents, sandboxing, security, ebpf, network-policy, fail-open, ipv6]
relevance: high
---

# Containarium: Egress containment needs activation and coverage proof

## Overview

- **Repo:** [FootprintAI/Containarium](https://github.com/FootprintAI/Containarium)
- **Revision checked:** [`a44570965fa39dbb0aa2f9e23640a336b2fcc6e7`](https://github.com/FootprintAI/Containarium/commit/a44570965fa39dbb0aa2f9e23640a336b2fcc6e7)
- **Discovery:** A GitHub repository search for recently active, starred AI-agent sandbox projects returned this repository among 2,326 matches; `incomplete_results` was `false`.

## Core signal

**A sandbox repository can implement a real kernel enforcement path without egress containment being an unconditional property of a deployment.**

Containarium has substantive enforcement machinery rather than a metadata-only security claim: a TC eBPF program looks up per-veth tenant policy, applies tenant-scoped IPv4 CIDR allowlists, lets explicit deny rules override allows, and denies the IPv4 cloud-metadata address before consulting the allowlist. The daemon reconciles additions *and deletions* in its maps, so tightening a policy is intended to remove stale authorization rather than only append new rules.

The same pinned revision also makes the enforcement boundary unusually inspectable. Packet dropping requires three distinct conditions:

1. `CONTAINARIUM_NETWORK_POLICY_BPF_OBJECT` must select a loadable eBPF object;
2. the daemon-wide `CONTAINARIUM_NETWORK_POLICY_ENFORCE` switch must arm dropping;
3. the tenant must have an effective `ENFORCE` policy.

Without the first condition, the enforcer is not constructed. Without the second, even a stored enforce-mode policy remains observation-only. If the enforcer fails to start, daemon startup logs a warning and continues without network-policy enforcement. These are deliberate rollout choices, but they mean “the product has eBPF egress policy” and “this agent box is currently egress-contained” are different claims.

## A protocol-coverage gap visible in the implementation

The checked eBPF classifier states that it manages only IPv4 and returns `TC_ACT_OK` for every non-IPv4 Ethernet frame. The Go compiler likewise rejects IPv6 allow and deny CIDRs as unsupported. Separately, multiple host-setup scripts in the same revision enable IPv6 forwarding.

This does **not** prove a working IPv6 escape: Scout did not establish that a default box receives routable IPv6, that upstream routing permits it, or that another firewall fails to block it. It does establish a coverage precondition missing from a protocol-agnostic reading of “egress policy”: an operator must prove that IPv6 is unavailable or independently filtered, or add equivalent IPv6 enforcement. An IPv4-only policy engine cannot by itself certify all-IP egress containment.

## Follow-up: path confinement also needs activation and object resolution (2026-09-23)

A current-source revisit at commit
[`79276fcd9a4d23c1dae2719e8a20e425d9f5252d`](https://github.com/FootprintAI/Containarium/commit/79276fcd9a4d23c1dae2719e8a20e425d9f5252d)
found a second instance of the same assurance pattern in `agent-box`. Commit
[`1cc99497f201170389430dcd2de70fc0c11681f5`](https://github.com/FootprintAI/Containarium/commit/1cc99497f201170389430dcd2de70fc0c11681f5)
records that the structured file tools had compared `filepath.Abs` +
`filepath.Clean` output with `AGENTBOX_ROOT` (or MCP client-advertised roots)
as a string prefix. Because those lexical operations do not resolve filesystem
objects, an in-root symlink to an out-of-root target could pass the check and
then be followed by `read_file` or another file operation.

The fix resolves both the requested path and root through
`filepath.EvalSymlinks`; for a not-yet-existing write target it walks upward to
the nearest existing ancestor, resolves that prefix, then rejoins the absent
suffix. The added tests cover an escaping leaf symlink, an escaping directory
symlink, an allowed in-root symlink, and a new file created through an in-root
symlinked directory. This is a stronger test shape than a lexical `..` case:
it checks the OS object graph that the later operation will traverse and keeps
a benign control so “reject every symlink” cannot pass as correct confinement.

The fix does **not** make file confinement unconditional. `AGENTBOX_ROOT` is
optional; when it is absent, client roots are used only if roots negotiation
succeeds, and missing capability, session, transport, or usable roots falls back
to unconstrained operation. The repository also documents `shell_exec` as
unconstrained by this file-tool guard. Finally, resolving a name and acting on it
remain separate syscalls, so this static review does not establish race-free
confinement against concurrent path replacement; descriptor-relative resolution
such as `openat2`-style constraints would be a different assurance level.

The reusable contract is therefore:

1. **Activation:** prove which mandatory root was configured; do not infer one
   from the existence of a root feature or an optional client hint.
2. **Object resolution:** validate resolved filesystem objects and existing
   ancestors, not just normalized path strings.
3. **Tool coverage:** name every operation governed by the root and every
   intentionally ungoverned escape hatch such as a general shell.
4. **Race semantics:** state whether the validated object is bound to the later
   operation or can change between check and use.
5. **Regression shape:** retain escaping-symlink cases plus legitimate in-root
   symlinks and not-yet-existing write targets.

This extends the original egress result: a security mechanism's presence,
configured activation, protocol/tool coverage, and object-level enforcement are
separate facts. A deployment status should not compress them into “sandboxed.”

## Operational implication

Treat containment as a runtime attestation, not a repository feature flag. A useful per-box status should report at least:

- policy object loaded and attached to the current veth;
- daemon drop switch armed;
- tenant policy mode and revision;
- covered address families and explicit outer-layer blocks for uncovered families;
- last successful reconcile, including failed map updates or veth attachments;
- a controlled canary showing a denied destination was actually dropped.

This matters for agent runtimes because fail-open startup and partial protocol coverage can leave the control plane healthy while the claimed damage boundary is absent. Observation-first rollout may be operationally sound, but health and readiness must distinguish **available**, **observing**, **enforcing**, and **protocol-complete** states.

## Caveats

- These are static inspections of pinned revisions, not deployed escape tests or a production-security audit.
- The repository documents hardware validation for its IPv4 paths, but Scout did not independently reproduce those runs.
- Scout could not execute the current Go tests because the research environment had no `go` binary; the symlink test results are repository-authored cases inspected in source, not an independent rerun.
- The search result's star count and description are discovery metadata, not evidence that enforcement works.
- The IPv6 finding is a conditional coverage gap, not proof of exploitability in the default deployment.
- The possible check/use race is an evidence boundary from code shape, not a demonstrated exploit. The current validator returns resolved paths, which closes the static escaping-symlink cases its tests cover.
- The repository was changing during inspection; implementation claims are pinned to the revisions named in each section.

## Sources

- **Repo:** https://github.com/FootprintAI/Containarium
- **Original GitHub search feed:** https://api.github.com/search/repositories?q=%22AI+agent%22+sandbox+in%3Aname%2Cdescription%2Creadme+pushed%3A%3E%3D2026-08-01+stars%3A%3E20&sort=updated&order=desc&per_page=20
- **2026-09-23 search feed (`incomplete_results=false`):** https://api.github.com/search/repositories?q=topic%3Aagentic-ai+pushed%3A%3E2026-09-22+stars%3A%3E10&sort=updated&order=desc&per_page=20
- **Original revision:** https://github.com/FootprintAI/Containarium/commit/a44570965fa39dbb0aa2f9e23640a336b2fcc6e7
- **Follow-up revision:** https://github.com/FootprintAI/Containarium/commit/79276fcd9a4d23c1dae2719e8a20e425d9f5252d
- **Symlink-fix commit:** https://github.com/FootprintAI/Containarium/commit/1cc99497f201170389430dcd2de70fc0c11681f5
- **Current path validator:** https://github.com/FootprintAI/Containarium/blob/79276fcd9a4d23c1dae2719e8a20e425d9f5252d/internal/agentbox/sandbox.go
- **Current regression tests:** https://github.com/FootprintAI/Containarium/blob/79276fcd9a4d23c1dae2719e8a20e425d9f5252d/internal/agentbox/agentbox_test.go
- **Current file-tool operations:** https://github.com/FootprintAI/Containarium/blob/79276fcd9a4d23c1dae2719e8a20e425d9f5252d/internal/agentbox/files.go
- **README security posture:** https://github.com/FootprintAI/Containarium/blob/a44570965fa39dbb0aa2f9e23640a336b2fcc6e7/README.md#security-control-surface
- **Network-isolation design and rollout:** https://github.com/FootprintAI/Containarium/blob/a44570965fa39dbb0aa2f9e23640a336b2fcc6e7/docs/security/NETWORK-ISOLATION-DESIGN.md
- **Startup wiring and fail-open behavior:** https://github.com/FootprintAI/Containarium/blob/a44570965fa39dbb0aa2f9e23640a336b2fcc6e7/internal/server/dual_server.go
- **eBPF classifier:** https://github.com/FootprintAI/Containarium/blob/a44570965fa39dbb0aa2f9e23640a336b2fcc6e7/experimental/ebpf-phaseA/netpolicy.bpf.c
- **Policy compiler:** https://github.com/FootprintAI/Containarium/blob/a44570965fa39dbb0aa2f9e23640a336b2fcc6e7/internal/netbpf/policymap.go
