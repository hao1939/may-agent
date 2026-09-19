# IETF Internet-Draft: AI Agent Authentication and Authorization

Date: 2026-07-31
Source: https://news.ycombinator.com/item?id=49113120
Repo: https://datatracker.ietf.org/doc/html/draft-klrc-aiagent-auth

## Summary

An IETF Internet-Draft (draft-klrc-aiagent-auth) proposes a standards-track framework for authenticating and authorizing AI agents acting on behalf of users or organizations. It extends existing OAuth/UMA patterns with agent-specific claims (delegation scope, tool capabilities, audit trail requirements).

## Relevance to AI Agents

- **Identity for agents**: Formalizes how agents prove who they act for and what they're allowed to do — critical as agents call external APIs autonomously.
- **Delegation chains**: Supports multi-hop delegation (user → orchestrator → sub-agent) with verifiable scope narrowing.
- **Interoperability signal**: An IETF draft means the industry is converging on standardized agent identity, not proprietary API keys.

## Key Details

- Builds on OAuth 2.0 and UMA 2.0
- Introduces "agent_capabilities" claim and "delegation_chain" token extension
- Early-stage draft; no RFC number yet

## Tags

standards, authentication, authorization, identity, agent-infrastructure, IETF

## Implementation signal — signed capability claims still need grant policy (2026-09-19)

A new HN project, [SwarmAuth](https://news.ycombinator.com/item?id=49764838),
turns part of this design space into a small Python SDK. At inspected revision
[`210d3fd7fa70d7fb6f7005b948c68f92f4699cfe`](https://github.com/waspdrey/swarmauth/commit/210d3fd7fa70d7fb6f7005b948c68f92f4699cfe),
its tokens bind an issuer, audience, capability list, five-minute maximum
lifetime, and optional call, rate, amount, and exact-parameter constraints under
an Ed25519 signature. Its execution wrapper checks those claims before invoking
the tool, and a Redis-backed tracker is offered when call or budget limits must
hold across verifier processes.

The implementation also exposes a distinction that authorization systems must
not hide: **trusting an issuer key is not the same as constraining that issuer's
grant authority**. The specification says a verifier must establish out of band
which capabilities an issuer may grant. The shipped `KeyRegistry`, however,
only maps `iss` values to trusted public keys; verification establishes that the
registered issuer signed the capability claim, but does not compare the claim
with a verifier-side grant ceiling for that issuer. In a self-issuance topology,
a compromised agent that still controls its legitimate signing key can therefore
mint any capability the receiving tool recognizes. The receiver needs a separate
policy such as `(issuer, audience, capability, constraints) -> allow`, and should
intersect the signed request with that policy rather than treating key
registration as blanket delegation.

A same-day adapter fix reinforces the integration boundary. The project's
changelog says version 0.1.1 omitted `amount_kwarg` from `secure_tool_call` and
all framework adapters, so budget-aware adapter use could not pass the amount
field through to enforcement. The inspected main revision adds the forwarding
path and a regression test, but every visible CI job for that revision was
failing at observation time; Scout inspected source and project-authored tests
but did not independently execute them. This is an early implementation signal,
not production-security validation.

**Operational implication:** an authorization receipt should prove at least
three independent facts: the signer is trusted for this issuer identity, the
requested grant is within that issuer's externally configured delegation
ceiling, and the concrete adapter carried every constraint-relevant argument to
one atomic execution-boundary check. Signature validity alone proves none of the
last two.

### SwarmAuth sources

- HN discovery item: https://news.ycombinator.com/item?id=49764838
- Repo: https://github.com/waspdrey/swarmauth
- Inspected revision: https://github.com/waspdrey/swarmauth/commit/210d3fd7fa70d7fb6f7005b948c68f92f4699cfe
- Protocol and out-of-band trust requirement: https://github.com/waspdrey/swarmauth/blob/210d3fd7fa70d7fb6f7005b948c68f92f4699cfe/SPEC.md
- Key-only issuer registry: https://github.com/waspdrey/swarmauth/blob/210d3fd7fa70d7fb6f7005b948c68f92f4699cfe/swarmauth/registry.py
- Verification and constraint path: https://github.com/waspdrey/swarmauth/blob/210d3fd7fa70d7fb6f7005b948c68f92f4699cfe/swarmauth/middleware.py
- Adapter regression test: https://github.com/waspdrey/swarmauth/blob/210d3fd7fa70d7fb6f7005b948c68f92f4699cfe/tests/test_middleware.py
- Release note: https://github.com/waspdrey/swarmauth/blob/210d3fd7fa70d7fb6f7005b948c68f92f4699cfe/CHANGELOG.md
- Observed CI run: https://github.com/waspdrey/swarmauth/actions/runs/35436010952
