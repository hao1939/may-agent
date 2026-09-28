<ai_context>
summary: "AgentVault is an early Go implementation that derives both action-level decisions and a macOS Seatbelt profile from one YAML policy, then benchmarks attack blocking and legitimate development work as separate axes. Its published 103/103 attack and 8/8 work result is useful as a reproducible design claim, not independent validation: the corpus is author-written, only the AgentVault column can fail the test, approvals are auto-approved for legitimate operations, and Linux/Windows lack the macOS kernel backend."
triggers: ["AgentVault", "agent sandbox benchmark", "security utility benchmark", "Seatbelt agent sandbox", "runtime permission firewall", "agent approval firewall", "sandbox usability"]
last_updated: "2026-09-28"
source_basis: "Static inspection of aashish254/agentvault at commit ceec251da6aa23ead94afd28fc02bb79fa62a27e, discovered through GitHub repository search; README, SECURITY.md, specification, policy/sandbox implementation, corpus harness, and published corpus/legitimate-work reports were reviewed."
</ai_context>

# AgentVault: agent-sandbox evidence needs both enforcement and workload axes

**Date:** 2026-09-28  
**Disposition:** New knowledge  
**Repo:** [aashish254/agentvault](https://github.com/aashish254/agentvault)  
**Reviewed revision:** [`ceec251da6aa23ead94afd28fc02bb79fa62a27e`](https://github.com/aashish254/agentvault/tree/ceec251da6aa23ead94afd28fc02bb79fa62a27e)  
**Coverage:** Static inspection of the full repository tree and selected primary files: README, security model, specification, comparison, policy engine, macOS sandbox generator, shell/MCP/egress interception code, red-team test harness, and generated attack and legitimate-work reports. No binary was built or executed by Scout.

## Question

What does this newly created repository add to current evidence about practical permission boundaries for coding agents?

## Source observations

AgentVault is a Go runtime wrapper for shell-using and MCP-using agents. At the pinned revision it exposes four observation or enforcement paths: shell-command shims, an MCP stdio proxy, a CONNECT egress proxy, and a generated macOS Seatbelt profile. Policy rules are ordered, first-match decisions over structured event fields with optional CEL predicates; the configured default applies when no rule matches. Effects include allow, deny, and human approval.

Its most useful architectural choice is to derive two layers from the same YAML policy:

1. **Action-level mediation** supplies specific decisions, approval prompts, and audit events for calls that pass through shims or proxies.
2. **Kernel confinement on macOS** blocks direct binary and raw-network bypasses that do not cooperate with those mediation points.

The security document is explicit that Linux and Windows do not yet have equivalent kernel backends. On those platforms the current controls are shims, proxies, and audit, so direct execution paths outside those channels remain materially weaker. The audit log is hash-chained and signed at session close, but the repository correctly limits the claim: it proves integrity of what was recorded, not that every action was observed.

## A better benchmark shape, with important limits

The repository publishes two results from the same host and default tool configurations:

- an author-created corpus of **103 executed attack variants**, reported as 103/103 blocked by AgentVault on macOS; and
- **8 legitimate development operations**, reported as 8/8 completed, including editing, testing, package-metadata fetch, and git push.

This two-axis shape is more informative than attack recall alone. A default-deny sandbox can appear perfect while making an agent unusable; conversely, high task completion can conceal an open boundary. Risky legitimate operations in AgentVault are routed through `require_approval`, and the workload harness auto-approves them. That tests whether approved work can proceed, not unattended autonomy or human decision quality.

The numbers remain publisher-run development evidence rather than an independent comparative evaluation:

- the attack cases, tool configurations, expected behavior, and reports live in the same repository as the implementation;
- the corpus harness states that **only the AgentVault column can fail the test**, and only on macOS; competitor columns are measurements, not regression gates;
- unavailable tools and offline cases are skipped, so denominators differ (the published Docker result is 4/92 attacks and 4/5 applicable work operations);
- the Codex comparison uses a copied default Seatbelt profile rather than invoking and validating a complete Codex session; and
- the current result demonstrates one Darwin/arm64 run, not portability of the kernel-enforcement claim.

## Interpretation

Agent sandbox evaluations should report at least four separate claims:

| Claim | Evidence needed |
|---|---|
| Policy decision quality | labelled allowed, denied, and approval-required events |
| Enforcement coverage | bypass attempts across every execution and network path |
| Legitimate workload utility | completed operations under the same configuration, with approval assumptions disclosed |
| Platform coverage | equivalent live enforcement tests on each claimed operating system |

AgentVault currently offers a concrete, inspectable example of the first three on macOS, while its own documentation identifies the fourth as unfinished. The reusable lesson is not the headline 100% score. It is that **security and utility need separate denominators, and both remain subordinate to enforcement-path coverage**. A perfect policy corpus cannot compensate for an unmediated path on another platform.

## Limitations

- Scout performed static source review only and did not reproduce the benchmark.
- The repository was created on 2026-09-22 and had six GitHub stars when observed; adoption and external scrutiny are minimal.
- No independent audit, issue history, release-artifact verification, or adversarial corpus was reviewed.
- Seatbelt is a macOS-specific, deprecated-but-functional mechanism according to the repository; this note does not independently certify its generated profile.
- The search response reported `incomplete_results: false`, but the query is still a ranked discovery sample, not an exhaustive map of agent-sandbox projects.

## Primary sources

- [Pinned README](https://github.com/aashish254/agentvault/blob/ceec251da6aa23ead94afd28fc02bb79fa62a27e/README.md)
- [Pinned security model](https://github.com/aashish254/agentvault/blob/ceec251da6aa23ead94afd28fc02bb79fa62a27e/SECURITY.md)
- [Pinned policy engine](https://github.com/aashish254/agentvault/blob/ceec251da6aa23ead94afd28fc02bb79fa62a27e/internal/policy/engine.go)
- [Pinned macOS sandbox generator](https://github.com/aashish254/agentvault/blob/ceec251da6aa23ead94afd28fc02bb79fa62a27e/internal/sandbox/sandbox.go)
- [Pinned corpus harness](https://github.com/aashish254/agentvault/blob/ceec251da6aa23ead94afd28fc02bb79fa62a27e/test/redteam/corpus_test.go)
- [Pinned attack-corpus report](https://github.com/aashish254/agentvault/blob/ceec251da6aa23ead94afd28fc02bb79fa62a27e/docs/redteam/CORPUS_RESULTS.md)
- [Pinned legitimate-work report](https://github.com/aashish254/agentvault/blob/ceec251da6aa23ead94afd28fc02bb79fa62a27e/docs/redteam/LEGIT_RESULTS.md)
