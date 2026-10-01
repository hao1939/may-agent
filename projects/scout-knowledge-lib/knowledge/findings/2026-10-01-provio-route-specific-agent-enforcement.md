<ai_context>
summary: "Provio's pinned pre-release source models agent safety as route-specific coverage rather than one global protected state: hooks can govern individual calls, a process wrapper can constrain writes and optionally network, and an MCP proxy sees only MCP traffic. Its enforcement planner refuses unsupported required protections, while explicit best-effort and unconfined modes surface degradation. The reusable requirement is to report control by route and dimension, while preserving residual states such as open network, writable workspace control files, and unmediated nested agents."
triggers: ["Provio", "route-specific enforcement", "agent sandbox", "coverage report", "best effort", "Landlock", "Seatbelt", "AppContainer", "MCP proxy", "hook coverage"]
last_updated: "2026-10-01"
source_basis: "GitHub repository discovery and static inspection of writ-agent/provio at pinned revision c47654cb53bb1f1cbc82300fcd3e25d2af39d4d6. Scout read repository metadata and tree plus the README, threat model, core decision pipeline, sandbox enforcement planner, agent-hook adapter, and process-confinement tests. No build, test suite, sandbox, agent, or external effect was run."
</ai_context>

# Agent safety coverage is a route-by-dimension matrix

**Date:** 2026-10-01  
**Disposition:** New knowledge  
**Repo:** https://github.com/writ-agent/provio  
**Inspected revision:** [`c47654cb53bb1f1cbc82300fcd3e25d2af39d4d6`](https://github.com/writ-agent/provio/commit/c47654cb53bb1f1cbc82300fcd3e25d2af39d4d6)

## Question

What does Provio's multi-layer agent safety wrapper actually mediate, and what
coverage model should be reused without turning several partial controls into one
blanket assurance claim?

## Signal

Provio is an Apache-2.0, Rust-based pre-release that combines policy decisions,
agent hooks, an MCP proxy, process wrapping, kernel-backed filesystem/network
constraints, and a hash-chained ledger. The strongest design signal in the
pinned source is not the number of controls. It is the explicit refusal to call
them interchangeable.

The repository distinguishes at least three routes:

- **Agent hooks** can make per-tool-call decisions only when the host exposes a
  blocking hook with suitable semantics. The adapter translates each host's
  protocol separately and denies on malformed input or internal decision errors.
- **`provio run`** records a process launch and places the process tree inside an
  OS boundary. It can constrain writes and, when requested and supported, deny
  network, but generic agents do not thereby receive per-tool decisions.
- **The MCP proxy** mediates MCP calls routed through it. The threat model states
  that an agent's shell, file writes, direct HTTP, or direct access to the same
  server can bypass proxy-only coverage.

This makes “protected by Provio” an invalid scalar. A more accurate state is a
matrix whose rows are effect routes and whose columns include decision
mediation, filesystem write confinement, network confinement, hook integrity,
result filtering, and audit integrity.

## Degradation is typed rather than silently widened

The inspected sandbox planner takes requested protections, detected kernel
capabilities, and an enforcement mode. In the default `Required` mode, missing
or partial support refuses preparation. `BestEffort` is an explicit opt-in and
returns each dimension as enforced, partial, or not enforced. A non-empty
hostname allow-list is refused because the local OS backends cannot enforce it;
the planner does not relabel unrestricted network as an allow-list.

The process-confinement tests encode the same distinction at the CLI boundary:
network-open output must say `open, not filtered`; `--net none` must either be
kernel-enforced or fail unless best-effort was explicitly requested; and
`--unconfined` must be conspicuously labelled while contradictory combinations
are refused. These are source-level test assertions, not results independently
executed by Scout.

This is a useful control-plane pattern: **degraded execution is a state with
named gaps, not a successful boolean with a warning attached**. It prevents a
filesystem control from laundering an unsupported network claim.

## The residuals show why route-level reporting matters

The pinned threat model documents important states that a high-level “policy +
sandbox + ledger” description would hide:

- Interactive runs allow network by default; host filtering is unavailable at
  this layer. Anything readable by the process may therefore be exfiltrated
  unless network is explicitly denied by a supported backend.
- The workspace remains writable, including `.git/hooks`, build scripts, and
  editor configuration that a later unconfined host process may execute.
- The process wrapper supplies per-call governance only for agents with an
  applicable hook interface. An agent started by another agent remains inside
  the same kernel boundary but may not inherit the outer per-call hook wiring.
- Linux and Windows cannot fully prevent an agent from changing some Claude
  settings that affect later sessions outside the wrapper; macOS has a stronger
  file exclusion in the described profile.
- A hash chain detects edits only relative to a trusted checkpoint. Anyone with
  write access can rewrite the ledger and recompute its chain; signed receipts
  and externally retained anchors narrow that risk but do not repair a host
  already compromised before signing.

These are not reasons to discard the controls. They are reasons to preserve the
coverage matrix all the way into admission and reporting. For example,
“filesystem writes enforced; network open; individual tool calls unmediated;
ledger locally writable” is operationally useful, while “sandboxed” is not.

## Reusable control contract

For an agent runtime or installation, compute coverage from the exact execution
route rather than from the presence of a security component:

1. Inventory every route to an effect: native tools, shell, subprocesses,
   direct HTTP, MCP, SDK adapters, nested agents, and later host consumption of
   agent-written artifacts.
2. For each route, report **enforced / partial / not enforced / not observed**
   separately for decision mediation, filesystem, network, credentials,
   result handling, and evidence integrity.
3. Refuse required protections that the current kernel, filesystem, hook
   protocol, or topology cannot provide. Make any degraded mode an explicit
   authority decision, not an automatic fallback.
4. Keep the truthful coverage report on the effect path. Configuration intent
   and repository support tables are weaker than runtime capability detection.
5. Test negative effects through each public adapter. Planner unit tests prove
   classification logic; route-level tests must also prove that denied effects
   do not happen and that degraded states are presented accurately.

## Relation to existing Scout knowledge

[A sandbox can enforce policy without owning the audit boundary](./2026-08-27-sandbox-policy-audit-trust-boundaries.md)
separates enforcement identity from evidence identity. Provio adds a second
separation: one installation can have different enforcement identities and
coverage on different routes. [A coding-agent sandbox does not make its
writable outputs safe to execute](./2026-09-27-augur-macos-agent-sandbox-boundary.md)
covers the deferred host authority of writable `.git` and build files, a
residual Provio also states explicitly. [A circuit breaker must bind its deny
verdict to the effect boundary](./2026-10-01-agent-circuit-breaker-verdict-contract.md)
remains the complementary verification rule: a typed coverage state matters
only if the installed adapter actually owns the effect.

## Limits

This is a static assessment of one pinned, pre-release revision. Scout did not
compile the Rust workspace, execute its tests, launch a supported agent, probe
Landlock, Seatbelt, AppContainer, seccomp, or Docker, verify CI results, inspect
a released binary, or perform an adversarial security audit. Platform behavior
and compatibility statements are therefore repository implementation and
documentation evidence, not independent runtime validation. The repository had
two GitHub stars when discovered, so it is an early implementation signal, not
deployment or community-adoption evidence.

## Sources reviewed

- [Repository tree at the inspected revision](https://github.com/writ-agent/provio/tree/c47654cb53bb1f1cbc82300fcd3e25d2af39d4d6)
- [README and coverage disclosures](https://github.com/writ-agent/provio/blob/c47654cb53bb1f1cbc82300fcd3e25d2af39d4d6/README.md)
- [Threat model and platform residuals](https://github.com/writ-agent/provio/blob/c47654cb53bb1f1cbc82300fcd3e25d2af39d4d6/docs/THREAT_MODEL.md)
- [Sandbox enforcement planner](https://github.com/writ-agent/provio/blob/c47654cb53bb1f1cbc82300fcd3e25d2af39d4d6/crates/provio-sandbox/src/enforce.rs)
- [Core decision pipeline](https://github.com/writ-agent/provio/blob/c47654cb53bb1f1cbc82300fcd3e25d2af39d4d6/crates/provio-core/src/pipeline.rs)
- [Per-agent hook adapter](https://github.com/writ-agent/provio/blob/c47654cb53bb1f1cbc82300fcd3e25d2af39d4d6/crates/provio-cli/src/hook/agents.rs)
- [Process-confinement tests](https://github.com/writ-agent/provio/blob/c47654cb53bb1f1cbc82300fcd3e25d2af39d4d6/crates/provio-cli/tests/run_confinement.rs)

## Discovery coverage

The GitHub repository Search API query for repositories created since
2026-09-20 matching `"AI agent" sandbox`, sorted by stars, returned 143 matches
with `incomplete_results: false`; the first ten results were reviewed by name,
description, update time, and star count. `writ-agent/provio` was selected early
because its pinned tree exposes multiple concrete effect routes, an enforcement
planner, route-level adapters, tests, and a detailed residual-risk model. Search
metadata was used only for discovery; implementation claims above come from the
pinned repository contents.
