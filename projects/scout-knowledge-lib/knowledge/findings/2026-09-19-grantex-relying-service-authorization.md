---
title: "Grantex — Agent Authorization Still Needs a Relying-Service Contract"
source: github
date: 2026-09-19
last_updated: 2026-09-19
type: finding
tags: [github, ai-agents, authorization, delegation, least-privilege, jwt, revocation, enforcement]
relevance: high
---

<ai_context>
This note records implementation evidence from one pinned repository revision. It distinguishes token structure, local policy checks, live revocation, and effect mediation; it is not a security audit or a claim that the hosted service or published packages were exercised.
</ai_context>

# Grantex — Agent Authorization Still Needs a Relying-Service Contract

## Source and coverage

- **Repo:** [mishrasanjeev/grantex](https://github.com/mishrasanjeev/grantex)
- **Inspected commit:** [`509825ca56591df154415daf3ade027656947d9f`](https://github.com/mishrasanjeev/grantex/tree/509825ca56591df154415daf3ade027656947d9f)
- **Observation date:** 2026-09-19
- **Discovery query:** GitHub Repository Search API for `topic:ai-agents pushed:>2026-09-18 stars:>5`, sorted by recently updated; `incomplete_results` was `false`.
- **Read:** repository metadata, complete recursive Git tree, README, grant-token documentation and specification, TypeScript token verifier and enforcement client, auth-service active-token check and claim normalization, Gemma scope enforcer, and project-authored enforcement tests.
- **Not run:** repository tests, packages, auth service, hosted endpoints, delegation flows, revocation, or live tool calls.
- **Disposition:** new knowledge — a concrete implementation showing that agent authorization is a chain of independently configurable checks, not a property conferred by a signed token alone.

## What exists at the pinned revision

Grantex implements signed grant tokens that can carry a principal, agent and developer identity, scopes, expiry, optional resource audience, proof-of-possession key thumbprint, authorization details, and an RFC 8693-style actor chain for delegated grants. Its claim parser rejects malformed actor chains, caps their nesting depth, accepts both current and legacy claim forms, and rejects conflicting aliases rather than silently choosing one.

The TypeScript `enforce()` path verifies a token with JWKS, maps a connector/tool through a loaded manifest, resolves permission hierarchy, checks purpose and amount/cost caps, denies unknown connectors and tools, and can reserve metered capacity before returning an allow decision. The auth service has a separate active-token path that checks token and grant revocation in Redis and persisted grant/token status in SQL after cryptographic verification. These are substantive implementation surfaces, not only README declarations.

## Reusable design signal: authorization has four live bindings

A useful agent authorization decision needs at least four bindings to remain intact at the protected action:

1. **Credential binding:** verify signature, issuer, expiry, token type, claim shape, and—when required—proof of possession.
2. **Resource binding:** require the token's audience to name the service that will honor it.
3. **Action binding:** map the exact tool/action and relevant arguments to scopes, purpose, caps, and any decision requirement.
4. **State and mediation binding:** apply current revocation/budget state and make the allow result unavoidable in the component that owns the effect.

Grantex makes these layers unusually visible because its source implements several of them separately. That separation is healthy, but it also means no single layer should be labeled “authorized” without stating which others were evaluated.

## Boundaries exposed by the implementation

Three boundaries are especially important for adopters:

- **Local verification is not live revocation.** The documentation explicitly separates offline JWKS verification from an online check for current revocation. A locally valid JWT can therefore remain cryptographically acceptable until expiry unless the relying service refreshes status according to its risk window. The auth service's `checkActiveGrantToken()` does consult both cache and database state, but the SDK's local `enforce()` path only calls the local verifier.
- **The helper's resource binding is not automatic.** The lower-level TypeScript verifier supports an expected `audience`, but the inspected `enforce()` call passes JWKS URI, optional issuer, and legacy-claim policy without passing an audience. A service using this helper alone should not infer that the token was audience-bound to that service; it needs an explicit resource check or a revised integration that supplies one.
- **Enforcement posture can override the verdict.** The client defaults to strict mode, but `permissive` mode transforms a denied result into `allowed: true`. Its warning is emitted only outside production. Permissive mode is useful for rollout observation, but an authorization receipt must name the effective mode; otherwise a successful call can be mistaken for a policy pass.

The wrapper does mediate a LangChain tool's `invoke()` when callers use the returned wrapper, and middleware can mediate configured HTTP routes. That does not prove every path to the underlying API is wrapped, nor does a grant token prove the resulting external effect occurred. The protected service still owns complete route coverage, credential isolation, effect evidence, and reconciliation.

## Practical receipt shape

For an agent tool call, record the token identifier and issuer; expected and observed audience; agent/principal/delegation identity; exact connector, tool, and constraint-relevant arguments; manifest revision; scope/purpose/cap decision; revocation source and freshness; enforcement mode; mediator identity; and effect receipt. Keeping these fields separate prevents signature validity, local policy approval, live authority, and successful actuation from collapsing into one ambiguous `authorized: true` flag.

## Limitations

This assessment is source inspection at one commit, not independent validation. The repository was fast-moving at observation time, and the README identifies known limitations in the published MCP Auth package, including in-process authorization-code storage, absent consent rendering, and an incomplete code handoff. No hosted behavior, package equivalence, deployment configuration, key rotation, cache freshness, or bypass resistance was tested. Project-authored tests demonstrate intended denial behavior but were not executed in this run.

## Primary implementation references

- [Grant-token concept and offline/online verification split](https://github.com/mishrasanjeev/grantex/blob/509825ca56591df154415daf3ade027656947d9f/docs/concepts/grant-token.mdx)
- [TypeScript local verifier](https://github.com/mishrasanjeev/grantex/blob/509825ca56591df154415daf3ade027656947d9f/packages/sdk-ts/src/verify.ts)
- [TypeScript enforcement client and permissive mode](https://github.com/mishrasanjeev/grantex/blob/509825ca56591df154415daf3ade027656947d9f/packages/sdk-ts/src/client.ts)
- [Auth-service live token/grant status check](https://github.com/mishrasanjeev/grantex/blob/509825ca56591df154415daf3ade027656947d9f/apps/auth-service/src/lib/active-grant-token.ts)
- [Grant-token claim normalization and delegation depth](https://github.com/mishrasanjeev/grantex/blob/509825ca56591df154415daf3ade027656947d9f/apps/auth-service/src/lib/grant-token-claims.ts)
- [Project-authored enforcement tests](https://github.com/mishrasanjeev/grantex/blob/509825ca56591df154415daf3ade027656947d9f/packages/sdk-ts/tests/enforce.test.ts)
