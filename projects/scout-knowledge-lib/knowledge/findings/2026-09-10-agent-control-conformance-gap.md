<ai_context>
summary: "GitHub inspection of the Agent Control Standard v0.1.0 and its AGT reference implementation: ACS profiles are self-declared, no independent conformance suite or registry exists, and the shipped reference implementation openly misses most ACS-Core requirements. Treat negotiated control capabilities as claims that need requirement-level runtime receipts."
triggers: ["Agent Control Standard", "ACS", "Guardian Agent", "agent policy enforcement", "control-plane conformance", "fail-open", "capability negotiation"]
last_updated: "2026-09-10"
source_basis: "GitHub repository, normative conformance document, and AGT reference implementation at commit 29778220078b83e7c51571a8e709d3c75f68561b."
</ai_context>

# Agent control capability negotiation is not conformance evidence

Date: 2026-09-10  
Source: GitHub  
Repo: https://github.com/GenAI-Security-Project/agent-control-standard

## Discovery and revision

A GitHub Search API query for recently active repositories tagged `ai-agents`
returned `GenAI-Security-Project/agent-control-standard` among 2,443 matches;
`incomplete_results` was `false`. Repository metadata was used only for
discovery. The claims below come from the repository contents pinned at
[`29778220078b83e7c51571a8e709d3c75f68561b`](https://github.com/GenAI-Security-Project/agent-control-standard/commit/29778220078b83e7c51571a8e709d3c75f68561b).

## Core signal

**A negotiated agent-control profile is a claim about the enforcement path, not
evidence that the path exists end to end.**

ACS v0.1.0 specifies a separate Guardian that can inspect a pending agent action
and return `allow`, `deny`, `modify`, `ask`, or `defer`. Its mandatory ACS-Core
profile is not a thin envelope contract: it requires a handshake, at least six
lifecycle hooks, replay rejection, HMAC-signed requests and responses, decision
honoring under a declared failure posture, liveness, wrapped MCP, and a published
session-context chain head.

The same normative conformance page says profile negotiation is self-declaration.
Version 0.1.0 has no conformance test suite, registry of conformant
implementations, or steward that arbitrates disputed claims. It also permits a
conformant but permissive Guardian: protocol conformance says nothing about the
strictness of the installed policy.

The repository's own AGT reference implementation makes that distinction unusually
visible. It advertises a qualified `acs-core` claim while its requirement table
reports that:

- only two of nineteen step methods are evaluated, rather than the six-hook Core
  minimum;
- the Guardian does not read the ClientHello;
- `ask` fails the response schema and `defer` is never produced;
- replay rejection, baseline HMAC signing, `system/ping`, wrapped MCP, and the
  response `chain_hash` are absent;
- the wire is unauthenticated and loopback reachability is its only default
  access boundary; and
- transport or Guardian failure defaults to `proceed`, although fail-open
  proceeds are written to an audit log.

This is not a hidden defect allegation: the project explicitly labels the
reference tree a demonstration and measurement rather than a complete ACS
implementation. It can produce a real policy denial for the two wired tool-call
gates, but that successful deny does not establish Core conformance or coverage
of other tools and lifecycle events.

## Operational implication

A production control-plane receipt should bind the negotiated profile to measured
facts for the exact deployment and host adapter:

1. required hooks observed and gates reached, by tool and lifecycle event;
2. a deny canary that proves the host honored the Guardian before execution;
3. authentication, signature verification, replay rejection, and key identity;
4. the effective timeout and startup/decision failure postures;
5. fail-open counts and the last actually observed posture—not only the configured
   default;
6. schema-valid rendering of every disposition the host claims to support; and
7. policy identity/version, because a conformant wire may still carry permissive
   policy.

This separates three claims that marketing and handshakes can collapse:
**wire-format support**, **enforcement-path coverage**, and **policy strength**.
A requirements matrix with explicit `implemented`, `unimplemented`, and
`unverified` cells is more trustworthy than a single profile badge.

## Caveats

- This is static inspection of one pinned revision, not an independent execution
  of the Bun test suite or the live Guardian demo.
- The repository was changing during inspection; later revisions may implement
  missing Core requirements.
- The reference implementation's documented deny is evidence of a narrow wired
  path, not proof of interoperability across independent implementations.
- Search stars, descriptions, and repository topics are discovery metadata, not
  implementation evidence.

## Primary sources

- **GitHub search feed:** https://api.github.com/search/repositories?q=topic%3Aai-agents+pushed%3A%3E%3D2026-09-01+stars%3A%3E20&sort=updated&order=desc&per_page=10
- **Repo:** https://github.com/GenAI-Security-Project/agent-control-standard
- **Revision:** https://github.com/GenAI-Security-Project/agent-control-standard/commit/29778220078b83e7c51571a8e709d3c75f68561b
- **Normative conformance profiles:** https://github.com/GenAI-Security-Project/agent-control-standard/blob/29778220078b83e7c51571a8e709d3c75f68561b/docs/spec/conformance.md
- **Repository overview and disclosed gaps:** https://github.com/GenAI-Security-Project/agent-control-standard/blob/29778220078b83e7c51571a8e709d3c75f68561b/README.md
- **AGT reference implementation limits matrix:** https://github.com/GenAI-Security-Project/agent-control-standard/blob/29778220078b83e7c51571a8e709d3c75f68561b/reference-implementations/agt/README.md#what-this-project-is-and-is-not
- **Guardian behavior and wire limitations:** https://github.com/GenAI-Security-Project/agent-control-standard/blob/29778220078b83e7c51571a8e709d3c75f68561b/reference-implementations/agt/packages/guardian/README.md
- **Claude Code host failure and result-gate behavior:** https://github.com/GenAI-Security-Project/agent-control-standard/blob/29778220078b83e7c51571a8e709d3c75f68561b/reference-implementations/agt/hosts/claude-code/README.md
