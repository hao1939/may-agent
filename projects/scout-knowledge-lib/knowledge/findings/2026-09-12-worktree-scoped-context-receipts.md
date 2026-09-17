<ai_context>
A September 2026 GitHub repository makes a subtle coding-agent context boundary concrete: repository identity, workspace identity, content freshness, and evidence reliability are different claims. CodeAtlas gives linked Git worktrees one shared repository identity but distinct workspace identities; its context receipts also bind session, generation, subject, projection, and delivered-content identity, falling back to full rehydration when those identities or exact-delta reconstruction do not hold. The reusable lesson is that a content hash alone cannot prevent context from one checkout being reused in another, while a workspace ID alone cannot prove that content or analysis is current.
Triggers: ["coding agent context", "worktree isolation", "context receipt", "workspace identity", "stale context", "context delta", "repository identity", "content freshness", "rehydration", "change intelligence"]
source_basis: "GitHub repository caongocquy/code-atlas, pinned revision f819c47c26fe3427ebb28ee6caab5e30fb688a75. Inspected repository-authored README, context identity/read/decision/store implementations, worktree isolation audit, and relevant tests."
</ai_context>

# Coding-agent context needs both workspace scope and freshness receipts

**Date:** 2026-09-12  
**Source:** GitHub repository discovery and pinned source inspection  
**Repo:** https://github.com/caongocquy/code-atlas  
**Pinned revision:** [`f819c47c26fe3427ebb28ee6caab5e30fb688a75`](https://github.com/caongocquy/code-atlas/tree/f819c47c26fe3427ebb28ee6caab5e30fb688a75)

## Observation

CodeAtlas is a local-first code graph and change-intelligence tool aimed at coding agents. Its README emphasizes an important negative-evidence rule: an empty result accompanied by `mayBeIncomplete=true` must not be interpreted as proof that no callers or affected tests exist ([README](https://github.com/caongocquy/code-atlas/blob/f819c47c26fe3427ebb28ee6caab5e30fb688a75/README.md#honest-confidence)). The newer context-aware read path adds another, less visible reliability problem: deciding whether previously delivered source context can safely be reused.

The implementation separates two identities ([context identity](https://github.com/caongocquy/code-atlas/blob/f819c47c26fe3427ebb28ee6caab5e30fb688a75/src/core/context/context-identity.ts)):

- linked Git worktrees share a `git-common-v1:<common-dir>` **repository identity**;
- each checkout receives a `git-worktree-v1:<canonical-path>` **workspace identity**;
- unrelated non-Git directories use canonical paths rather than content hashes.

That distinction allows repository-level lineage without treating two simultaneously divergent checkouts as one context namespace. The repository's tests assert shared repository identity and distinct workspace identity for linked worktrees, and distinct identities for unrelated directories containing identical files ([identity tests](https://github.com/caongocquy/code-atlas/blob/f819c47c26fe3427ebb28ee6caab5e30fb688a75/test/phase15a-identity.test.ts), [isolation test](https://github.com/caongocquy/code-atlas/blob/f819c47c26fe3427ebb28ee6caab5e30fb688a75/test/phase15a-worktree-isolation.test.ts)).

The context receipt then binds more than the workspace. Stored receipts carry session, repository and workspace identities, subject and projection identities, context generation, delivered-content identity, snapshot, delivery mode, and reliability metadata ([context store](https://github.com/caongocquy/code-atlas/blob/f819c47c26fe3427ebb28ee6caab5e30fb688a75/src/storage/context/context.store.ts)). Reuse is conservative: identity, generation, selector, expiration, and snapshot mismatches trigger full rehydration; changed content is sent as a delta only when applying that delta exactly reconstructs the current content and its identity ([decision logic](https://github.com/caongocquy/code-atlas/blob/f819c47c26fe3427ebb28ee6caab5e30fb688a75/src/core/context/context-decision.ts), [read service](https://github.com/caongocquy/code-atlas/blob/f819c47c26fe3427ebb28ee6caab5e30fb688a75/src/core/context/context-aware-read.service.ts)).

## The reusable boundary: scope, freshness, and reliability are orthogonal

These mechanisms expose three different questions that agent infrastructure often compresses into “is this context valid?”:

1. **Scope:** did this context come from the intended repository, checkout, session, subject, and projection?
2. **Freshness:** does the delivered content identity still match, or can an exact delta reconstruct the current bytes?
3. **Reliability:** is the analysis behind the context stale, incomplete, truncated, or affected by unresolved graph evidence?

A workspace identity answers the first but not the second: files can change inside the same worktree. A content hash answers the second for a particular subject but not the first: identical bytes in unrelated repositories should not share authority or lifecycle. Neither proves the third: perfectly current source can still feed an incomplete dependency graph. CodeAtlas reflects this separation by placing graph staleness and incomplete-resolution state in the receipt's reliability field, while its change inspection converts unmapped hunks, unresolved symbols, incomplete impact evidence, and bounded truncation into `risk: "unknown"` rather than a reassuring low-risk result ([change inspection](https://github.com/caongocquy/code-atlas/blob/f819c47c26fe3427ebb28ee6caab5e30fb688a75/src/core/change/inspect-change.service.ts)).

For coding-agent harnesses, the practical pattern is a composite context receipt:

| Dimension | Suggested binding | Failure behavior |
|---|---|---|
| Repository lineage | canonical repository/common-Git identity | reject cross-repository reuse |
| Workspace scope | canonical checkout/worktree identity | reject cross-worktree reuse |
| Consumer lifecycle | session plus context generation | rehydrate after reset or compaction boundary |
| Selection | subject plus projection/selector version | rehydrate when the requested view changes |
| Freshness | delivered-content identity and reconstructable delta | send full current content on mismatch |
| Evidence quality | stale/incomplete/truncated diagnostics | preserve uncertainty; require direct verification |

This is especially relevant when parallel coding agents use linked worktrees. Sharing a repository-level cache can be efficient, but model-visible context and “unchanged” claims must remain checkout-scoped. Conversely, isolating by worktree path is insufficient unless each delivered subject is also checked for change.

## Evidence boundary

The GitHub Search API query `topic:ai-agents pushed:>=2026-09-11`, sorted by most recently updated, returned HTTP 200 with `incomplete_results: false`; `caongocquy/code-atlas` appeared in the first result page. Claims above are limited to repository-authored documentation, implementation, audit text, and test definitions at the pinned revision. The repository's audit says its listed isolation tests passed, but Scout did not execute the software, independently validate performance, or observe a production deployment. Path-derived identities also describe this implementation's local trust boundary; they are not cryptographic attestations of repository origin or host integrity.
