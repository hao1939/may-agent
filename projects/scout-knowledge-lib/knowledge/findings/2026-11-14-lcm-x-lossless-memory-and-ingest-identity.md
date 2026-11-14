<ai_context>
summary: "Pinned GitHub assessment of LCM-X: durable raw history, derived retrieval layers, ingest identity, benchmark receipts, and authorization must be evaluated as separate memory-system properties."
triggers: ["LCM-X", "lossless agent memory", "ingest identity", "memory retrieval evaluation", "Hermes Agent memory"]
last_updated: "2026-11-14"
source_basis: "Static inspection of electricsheephq/lcm-x at commit 815483559f62c7446b56c196e5cc898af974e5f0. Scout did not run the plugin, tests, benchmark, models, migrations, or a deployment."
</ai_context>

# Lossless agent memory needs separate storage, identity, retrieval, and authority receipts

**Date:** 2026-11-14  
**Disposition:** New knowledge  
**Repo:** https://github.com/electricsheephq/lcm-x  
**Reviewed revision:** https://github.com/electricsheephq/lcm-x/commit/815483559f62c7446b56c196e5cc898af974e5f0  
**Discovery query:** GitHub Repository Search API `topic:ai-agent pushed:>=2026-11-14 stars:>20`, sorted by updated descending, `per_page=50`; `total_count=173`, `incomplete_results=false`.

## Observation

LCM-X is useful evidence that “lossless memory” is not one guarantee. Its architecture names raw messages as source truth in a SQLite store, then builds summaries, full-text indexes, embeddings, temporal rollups, query views, and assertions as derived layers with source/provenance relationships. Context assembly can compact older material while retrieval tools drill back into stored history. The inspected implementation includes message and FTS storage plus ingest-ledger, occurrence-binding, emission, lineage, and host-UID tables; ledger writes require the store's transaction owner.

That separation matters because durable presence does not establish correct identity or useful recall. LCM-X's identity-ledger plan inventories replay, content, prefix, generated-row, lifecycle, and storage rules separately. Its proposed host message UID route is intentionally narrower than a universal identity answer: composite byte splits, ownership ranges, lifecycle decisions, persisted-proof compatibility, and rows without usable UIDs still need other rules. The document also distinguishes current behavior, shadow measurement, qualification gates, and an opt-in deciding mode rather than treating a planned UID as already-deployed exactly-once ingestion.

Retrieval has its own receipt. The repository's producer-authored LongMemEval result reports 470 scoreable questions for one local FastEmbed configuration. Raw chunk vectors report session R@5 0.96, while the production `lcm_recall` path reports R@1 0.42, R@5 0.98, and R@10 1.00 on a 50-question subset. The note attributes the lower production top-1 result to the real recency prior and FTS noise. Its methodology uses fresh temporary stores, a pinned dataset revision, deterministic non-LLM summaries, dataset-disjoint current-session IDs, and a single-shot retrieval payload. These controls make the recorded configuration interpretable; they do not establish answer correctness, cross-model generality, or deployment reliability.

Authorization is another independent boundary. `AccessContextV1` defines immutable host-derived scope, monotonic narrowing, delegation-chain checks, deterministic validation order, and denial projection. But the inspected contract explicitly says it initially has no runtime call sites and that enforcement belongs to later policy and path-wiring slices. A documented access model therefore cannot be counted as complete mediation until every read, write, maintenance, lifecycle, and host callback path actually consumes it.

## Implication

Evaluate persistent agent memory with at least four distinct questions:

1. **Storage:** Were the original bytes durably retained, and which transforms or externalizations occurred before storage?
2. **Identity and replay:** Can retries, restarts, edits, composites, generated rows, and host-version changes be classified without loss, duplication, or reordering?
3. **Retrieval and use:** Can the production retrieval path find the right evidence under an exact configuration, and does the downstream answer actually use it?
4. **Authority:** Are reads, writes, derivations, and maintenance paths mediated by current authenticated scope rather than merely carrying lineage metadata?

A strong receipt in one layer does not close the others. Raw retention does not prove replay classification; a replay ledger does not prove recall; recall@k does not prove answer use; and an authorization data contract does not prove enforcement coverage.

## Evidence limitations

Scout inspected the pinned repository, selected architecture and contract documents, storage and ingest-ledger source, and producer-authored benchmark methodology/results. Scout did not clone or run the repository, execute tests, reproduce the benchmark, inspect every code path, validate migrations or rollback behavior, exercise host-UID shadow/on modes, verify benchmark artifacts independently, or test authorization enforcement. Several reviewed documents explicitly describe plans, qualification gates, or initially unconsumed contracts; this note does not present them as shipped deployment behavior.

## Primary sources

- [Architecture](https://github.com/electricsheephq/lcm-x/blob/815483559f62c7446b56c196e5cc898af974e5f0/docs/architecture.md)
- [Message store and ledger schemas](https://github.com/electricsheephq/lcm-x/blob/815483559f62c7446b56c196e5cc898af974e5f0/store.py)
- [Ingest ledger implementation](https://github.com/electricsheephq/lcm-x/blob/815483559f62c7446b56c196e5cc898af974e5f0/ingest_ledger.py)
- [Identity ledger plan](https://github.com/electricsheephq/lcm-x/blob/815483559f62c7446b56c196e5cc898af974e5f0/docs/identity-ledger.md)
- [Exactly-once ingest design](https://github.com/electricsheephq/lcm-x/blob/815483559f62c7446b56c196e5cc898af974e5f0/docs/exactly-once-ingest.md)
- [AccessContextV1 contract](https://github.com/electricsheephq/lcm-x/blob/815483559f62c7446b56c196e5cc898af974e5f0/docs/access-context-v1.md)
- [Benchmark methodology](https://github.com/electricsheephq/lcm-x/blob/815483559f62c7446b56c196e5cc898af974e5f0/benchmarks/METHODOLOGY.md)
- [Pinned LongMemEval result](https://github.com/electricsheephq/lcm-x/blob/815483559f62c7446b56c196e5cc898af974e5f0/benchmarks/results/longmemeval-v3-500q-fastembed.md)
