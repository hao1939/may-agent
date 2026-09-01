<ai_context>
summary: "Heimdall's current search path shows how a trustworthy retrieval label can silently lose its original semantics: STRONG now means either path existence plus shallow lexical coverage or merely a semantic hit whose path exists, while the README still promises live-content verification and stale-anchor healing. Treat retrieval verdicts as versioned, tested public contracts rather than display strings."
triggers: "retrieval trust, memory verification, STRONG verdict, semantic search, stale anchors, contract drift, Heimdall"
last_updated: "2026-08-25"
source_basis: "GitHub repository and implementation at immutable commit 844dc18e09be3425865e3adc90f5cb55446bce18"
</ai_context>

# Retrieval trust labels need executable semantics

Date: 2026-08-25
Last_updated: 2026-08-25
Source: https://github.com/ArihantDeva/heimdall
Repo: https://github.com/ArihantDeva/heimdall
Commit: https://github.com/ArihantDeva/heimdall/commit/844dc18e09be3425865e3adc90f5cb55446bce18
Tags: agent-memory, retrieval, verification, contract-drift, semantic-search

## Observation

Heimdall is a young local-first memory layer for coding agents. Its useful architectural core is stronger than a generic vector store: file changes become level-triggered hints; one reconciler reads current bytes, replaces exactly the nodes and edges owned by that path, rejects commits when the path generation changed during extraction, and audits filesystem drift. The tests directly exercise convergence under many writers, idempotence, ABA rejection, ownership-exact deletion, and order-independent cross-file edges.

The read path exposes a separate and more instructive issue. The README says every retrieval is re-verified against the live filesystem and describes `STRONG` as requiring path existence, lexical coverage, **and actual file content answering the query**; it also advertises moved-file re-anchoring and stale-node pruning. Those semantics exist in the repository's older `bin/kb_search_verify.py`, which reads bounded file content and invokes a rehome/removal path.

But the current `bin/kb-search.sh` no longer sends results through that verifier. Its inline verdict pass:

- computes token coverage over the result title, synthetic body, and path rather than opening the candidate file;
- labels a result `STRONG` when the path exists and that metadata coverage reaches 0.5;
- unconditionally labels any semantic hit with an existing path `STRONG`;
- emits `NOPATH` for a missing path without invoking the repository's rehome or removal logic.

The legacy verifier is still assigned to a shell variable and wrapped by `print_results`, but that function is not called by the current per-repository search flow. The current search test checks that the resolved `graft` binary reaches the worker; it does not pin the meaning of `STRONG`, `WEAK`, or stale-anchor handling.

Primary implementation:

- Current search path: https://github.com/ArihantDeva/heimdall/blob/844dc18e09be3425865e3adc90f5cb55446bce18/bin/kb-search.sh
- Content-aware legacy verifier: https://github.com/ArihantDeva/heimdall/blob/844dc18e09be3425865e3adc90f5cb55446bce18/bin/kb_search_verify.py
- Current search test: https://github.com/ArihantDeva/heimdall/blob/844dc18e09be3425865e3adc90f5cb55446bce18/tests/kb-search.test.mjs
- Reconciler and audit: https://github.com/ArihantDeva/heimdall/blob/844dc18e09be3425865e3adc90f5cb55446bce18/bin/lib/reconcile.mjs
- Convergence tests: https://github.com/ArihantDeva/heimdall/blob/844dc18e09be3425865e3adc90f5cb55446bce18/tests/reconcile.test.mjs

## Why this matters

A trust label is an API, even when its serialized type is only a string. Downstream agents can turn `STRONG` into authority to edit a file, skip additional orientation, or cite a memory as verified. If one implementation means “query terms occur in current file bytes” and another means “the embedding matched and the path exists,” both remain syntactically valid while their operational risk differs sharply.

This is the retrieval analogue of score-direction drift: the system does not crash; it becomes confidently less justified. Strong write-side convergence does not compensate for ambiguous read-side promotion. Index freshness, anchor liveness, lexical entailment, semantic similarity, and moved-anchor recovery are different predicates and should not collapse into one undocumented adjective.

## Reusable pattern

Treat every retrieval verdict as a versioned predicate over captured evidence:

1. **Name the dimensions separately.** Return fields such as `anchor_exists`, `content_checked`, `lexical_coverage`, `semantic_score`, `index_generation`, and `repair_action`, then derive any display label from an explicit policy version.
2. **Pin semantics with contract tests.** A semantic match whose file exists but whose current bytes do not support the query must not accidentally satisfy a content-verified contract. Missing, moved, unreadable, oversized, and binary anchors each need fixtures.
3. **Bind the verdict to evidence identity.** Record the content hash or generation checked, not only the path, so a later mutation cannot inherit an earlier verdict.
4. **Separate relevance from authority.** Embedding similarity proposes a candidate; live-content and provenance checks decide whether an agent may treat it as current fact.
5. **Test the installed entry point.** Keeping a correct verifier in the tree is insufficient if the production shell path bypasses it.

## Boundary

This is a contract-drift finding from repository inspection, not an evaluation of Heimdall's retrieval quality on a labeled benchmark. A semantic hit can still be highly relevant, and the current implementation openly describes part of its inline heuristic. The narrower claim is that `STRONG` no longer has the content-verification and healing semantics promised by the README and embodied by the retained verifier. The repository is also early (created 2026-08-20), so rapid architectural change is expected; that makes executable verdict contracts more important, not less.
