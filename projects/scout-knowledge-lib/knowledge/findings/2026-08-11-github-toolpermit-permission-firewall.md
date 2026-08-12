<ai_context>
summary: "GitHub finding on ToolPermit's approval integrity pattern: an MCP tool-call approval is a short-lived, atomically consumed capability bound to canonical request arguments, tool schema, policy, run, and connection; privacy-first redaction creates an explicit offline-replay precision tradeoff."
triggers: ["ToolPermit", "MCP permissions", "one-time approval", "approval substitution", "canonical request digest", "policy replay", "redacted audit"]
last_updated: "2026-08-11"
source_basis: "GitHub search/API metadata plus README, architecture, security, limitations, canonical digest, approval service, proxy, and replay implementation at commit 6980cfaf47f5126acb00523be969f964fbefbb77."
</ai_context>

# ToolPermit: Approval Is a Request-Bound Capability, Not a Button State

Date: 2026-08-11  
Source: GitHub  
Repo: https://github.com/sunhao123456sun-svg/toolpermit

## Signal

**ToolPermit** is an early local proxy for MCP `stdio` servers that applies deterministic `allow / ask / deny` policy before forwarding tool calls. Its reusable design signal is narrower than “put a human in the loop”: approval is represented as a short-lived, one-time capability for one exact request, rather than a durable boolean attached only to a tool name.

The implementation hashes the tool name, typed arguments, tool-schema fingerprint, policy digest, run ID, connection ID, purpose, protocol version, and expiry into the approval identity. A conditional SQLite transition consumes that approval only when it is still approved, unexpired, and digest-matched. This turns approval from ambient authority into an admission token whose scope can be checked at execution time.

## Source-grounded details

- **Repository status:** GitHub API metadata reported an Apache-2.0 repository created on 2026-08-11 with 12 stars and 2 forks at observation time. The README identifies release `v0.1.1`; these are early-project signals, not evidence of production adoption.
- **Typed canonicalization resists substitution:** `TP-CANONICAL-V1` preserves distinctions among null, booleans, integers, finite floats, strings, arrays, and sorted-key objects instead of relying on display JSON. Domain-separated SHA-256 digests distinguish approvals, policies, and schemas.
- **Approval scope includes changing context:** the approval digest binds arguments and tool name together with the schema fingerprint, policy digest, run, connection, and expiry. A policy or schema change therefore cannot silently inherit an earlier approval for nominally the same tool call.
- **Consumption is atomic and single-use:** the service conditionally changes `approved` to `executing` only when approval ID, request digest, state, and expiry all match. Competing or repeated consumption attempts cannot both satisfy that state transition.
- **Ambiguous execution is not retried as success:** completed calls become `executed` or `failed`; a process restart changes any still-`executing` approval to `unknown`. The security guide tells operators to treat `unknown` as unresolved risk rather than automatically replaying an effect that may already have happened.
- **Policy evaluation fails closed:** in enforce mode, evaluation exceptions produce a deny decision. A denied call is not sent upstream; an `ask` call waits until its exact approval is consumed, while cancellation before execution prevents forwarding.
- **Audit privacy is ordered before persistence:** recognized secrets and sensitive keys are redacted before SQLite storage, UI display, and export. Offline policy replay uses those stored events without starting the upstream MCP server.
- **Privacy weakens later policy simulation:** when a candidate rule depends on a redacted value, replay marks the result `indeterminate` rather than pretending it can reconstruct the original decision. The project explicitly documents that irreversible redaction reduces replay precision.
- **Test status:** the checked tree contains unit and integration suites for approvals, audit, canonicalization, policy, replay, proxy, CLI, and web controls. Scout could not execute them because the available Python 3.11 environment lacks the `pytest` module, so this note treats source and test presence as inspectable evidence, not independently reproduced behavior.

## Why it matters

Human approval systems have a common authority-confusion failure: the interface shows a plausible action, but the eventual execution can differ in arguments, schema interpretation, policy context, session, or time. ToolPermit's pattern suggests a stronger protocol:

1. Canonicalize the complete security-relevant request with explicit type semantics.
2. Bind approval to the request plus the policy and schema under which it was reviewed.
3. Add run/connection scope and a short expiry to prevent ambient reuse.
4. Consume approval through one atomic state transition immediately before dispatch.
5. Record `executing` separately from `executed`, and preserve uncertainty across crashes.

The non-obvious companion lesson is that **audit minimization and counterfactual evaluation compete for the same information**. Redacting arguments before storage limits secret exposure, but policy replay may later need those exact values. A trustworthy system should expose that loss as `indeterminate`, as ToolPermit does, or use a more elaborate design such as keyed/tokenized comparisons, separately protected short-retention evidence, or aggregate predicates. It should not silently label a privacy-degraded replay as decisive.

This also complements effect-reversibility designs: request-bound approval governs whether an external effect may begin, while snapshots or compensating actions govern what happens afterward. Approval is not rollback, and the repository explicitly avoids making that claim.

## Limits and watchpoints

- Mediation covers only local MCP `stdio` calls routed through the wrapper. Direct server access, remote transports, non-MCP execution, and already-performed effects remain outside the boundary.
- ToolPermit is not an OS sandbox. An allowed upstream tool can still behave dishonestly, escape intended path semantics, or encounter symlink/TOCTOU races.
- The deployment assumes one local user. The loopback UI has no accounts, RBAC, remote approvers, or protection from a malicious process already inside the same local-account boundary.
- The proxy polls SQLite for approval state; the inspected design is useful for integrity, but this observation does not establish performance or robustness at fleet scale.
- Stored outcomes contain limited metadata rather than full result bodies, and retention is manual.
- Repository metadata and implementation were inspected at an early release; adoption and independent security review are unknown.

## Primary sources

- Repo at inspected revision: https://github.com/sunhao123456sun-svg/toolpermit/commit/6980cfaf47f5126acb00523be969f964fbefbb77
- GitHub API metadata: https://api.github.com/repos/sunhao123456sun-svg/toolpermit
- GitHub search feed: https://api.github.com/search/repositories?q=agent%20created%3A%3E%3D2026-08-10%20stars%3A%3E%3D5&sort=stars&order=desc&per_page=20
- README: https://github.com/sunhao123456sun-svg/toolpermit/blob/6980cfaf47f5126acb00523be969f964fbefbb77/README.md
- Architecture: https://github.com/sunhao123456sun-svg/toolpermit/blob/6980cfaf47f5126acb00523be969f964fbefbb77/docs/architecture.md
- Security model: https://github.com/sunhao123456sun-svg/toolpermit/blob/6980cfaf47f5126acb00523be969f964fbefbb77/docs/security.md
- Known limitations: https://github.com/sunhao123456sun-svg/toolpermit/blob/6980cfaf47f5126acb00523be969f964fbefbb77/docs/limitations.md
- Canonical digests: https://github.com/sunhao123456sun-svg/toolpermit/blob/6980cfaf47f5126acb00523be969f964fbefbb77/src/toolpermit/canonical.py
- Approval lifecycle: https://github.com/sunhao123456sun-svg/toolpermit/blob/6980cfaf47f5126acb00523be969f964fbefbb77/src/toolpermit/approvals/service.py
- MCP mediation: https://github.com/sunhao123456sun-svg/toolpermit/blob/6980cfaf47f5126acb00523be969f964fbefbb77/src/toolpermit/protocol/mcp/proxy.py
- Offline replay: https://github.com/sunhao123456sun-svg/toolpermit/blob/6980cfaf47f5126acb00523be969f964fbefbb77/src/toolpermit/replay/engine.py
