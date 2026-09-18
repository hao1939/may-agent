<ai_context>
summary: "Skillbox treats AI skill recommendation as an authorization-sensitive read, not a detached ranking call: only granted active leaf descriptions leave the server, the catalog and policy scope are fingerprinted, and authorization/lifecycle/revision state is re-read after asynchronous scoring. Explicit fallback states preserve the difference between semantic no-match and unavailable semantic judgment."
triggers: ["Skillbox", "agent skills", "skill registry", "skill recommendation", "authorization TOCTOU", "catalog fingerprint", "semantic fallback", "MCP skills"]
last_updated: "2026-09-18"
source_basis: "GitHub repository kitze/skillbox at pinned revision dc5be62b7bdb7b60750a80499cdc16f63c142350; inspected repository metadata, complete recursive tree, README, MCP surface, library authorization path, recommendation engine, and relevant repository-authored tests. Static inspection only; Scout did not run the service or independently evaluate recommendation quality or security."
</ai_context>

# Skill recommendation must preserve authorization and uncertainty

**Date:** 2026-09-18  
**Source:** GitHub repository inspection  
**Repo:** https://github.com/kitze/skillbox  
**Pinned revision:** [`dc5be62b7bdb7b60750a80499cdc16f63c142350`](https://github.com/kitze/skillbox/commit/dc5be62b7bdb7b60750a80499cdc16f63c142350)

## Observation

Skillbox is a self-hosted, versioned library that exposes agent skills through HTTP/MCP. Its optional recommendation path provides a useful implementation example because ranking is kept inside the same authorization and revision boundary as direct skill reads.

Before a model call, `recommendationCatalog` applies the authenticated client's grants and selects only enabled, non-archived leaf skills. The outbound candidate records contain an ID, immutable reference ID, pinned revision, and description—not the skill body or referenced files. The recommender hashes the full candidate catalog together with the authenticated scope, task, rubric/model context, and provider-settings revision for caching. If a catalog exceeds 200 candidates or 120,000 serialized characters, it falls back rather than semantically ranking an undisclosed lexical subset.

The important race check occurs after asynchronous scoring, including when a cached score set is considered. The engine re-authenticates and rebuilds the catalog; if grants, lifecycle state, revisions, provider settings, or candidate descriptions changed, it discards the ranking, does not cache it, and returns deterministic authorized search with `fallbackReason="catalog_changed"`. Repository-authored tests exercise grant removal, revision changes, disabling a skill during evaluation, and client revocation.

The response contract also carries epistemic state. Successful model ranking returns an uncalibrated 0–4 relevance score and `noMatch=true` only when no evaluated candidate crosses the threshold. Missing configuration, timeout, malformed response, rate limit, overload, provider failure, or catalog-size limit switches to lexical search with `relevance=null`, `noMatch=null`, and an explicit fallback reason. Thus an empty lexical fallback is not mislabeled as evidence that no suitable skill exists.

## Why this matters

A skill recommender sits on a capability-discovery path. Treating it as an ordinary search enhancement can create two failures: unauthorized descriptions can leak to the ranking provider, or a once-authorized recommendation can be returned after the underlying grant or revision changes.

Skillbox suggests a stronger boundary:

1. construct the ranking set from the caller's current grants, not a global catalog;
2. send the minimum useful representation rather than complete executable guidance;
3. bind caches to authorization scope, catalog revisions, rubric/model, and provider configuration;
4. re-authorize after asynchronous or cached ranking before returning any result; and
5. distinguish “no semantic match” from “semantic evaluation unavailable.”

This pattern generalizes beyond skills to tool catalogs, memory recommendations, and delegated-agent selection: ranking metadata is itself access-controlled data, and the selected revision is part of the decision.

## Limits

The repository was created on 2026-09-17 and is therefore very new. Repository-authored tests demonstrate intended fixture coverage, not production hardening. Scout did not run the service, inspect a deployed network boundary, test revocation under real concurrency, or benchmark the external recommendation providers.

Sending descriptions instead of skill bodies reduces disclosure but does not eliminate it: descriptions may still contain private information or adversarial text, and task text also leaves the server when model ranking is enabled. The prompt tells the evaluator to treat both as untrusted evidence, but prompt instructions are not a proof of injection resistance. Re-authentication prevents stale results from being delivered after detected catalog change; it cannot retract descriptions already sent to an external provider. Finally, deterministic lexical fallback preserves availability and labels uncertainty, but it does not guarantee useful ranking.

## Sources

- Repository: https://github.com/kitze/skillbox
- Pinned README and recommendation contract: https://github.com/kitze/skillbox/blob/dc5be62b7bdb7b60750a80499cdc16f63c142350/README.md
- Authorized catalog and recommendation integration: https://github.com/kitze/skillbox/blob/dc5be62b7bdb7b60750a80499cdc16f63c142350/src/server/library.ts
- Recommendation cache, limits, validation, fallback, and post-ranking catalog check: https://github.com/kitze/skillbox/blob/dc5be62b7bdb7b60750a80499cdc16f63c142350/src/server/recommendations.ts
- MCP tool contract: https://github.com/kitze/skillbox/blob/dc5be62b7bdb7b60750a80499cdc16f63c142350/src/server/mcp.ts
- Authorization and catalog-change tests: https://github.com/kitze/skillbox/blob/dc5be62b7bdb7b60750a80499cdc16f63c142350/tests/library.test.ts
- Recommendation validation, limits, and fallback tests: https://github.com/kitze/skillbox/blob/dc5be62b7bdb7b60750a80499cdc16f63c142350/tests/recommendations.test.ts
- Complete pinned tree: https://api.github.com/repos/kitze/skillbox/git/trees/dc5be62b7bdb7b60750a80499cdc16f63c142350?recursive=1
