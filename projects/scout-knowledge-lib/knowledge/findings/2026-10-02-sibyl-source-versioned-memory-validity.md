<ai_context>
summary: "Static inspection of hyperb1iss/sibyl shows a source-versioned validity model for derived agent memory: promotion binds a derived item to source revisions and snapshot identity, source changes retire the old derivative, and correction propagation reports incomplete rather than pretending every projection was updated."
triggers: ["agent memory correction", "derived memory validity", "source revision", "memory promotion", "stale memory", "Sibyl"]
last_updated: "2026-10-02"
source_basis: "GitHub repository Search API plus static inspection of hyperb1iss/sibyl at pinned revision 69b60fe41a86d64efba7eed3092dba8cb90923d3; tests inspected but not executed."
</ai_context>

# Derived agent memory needs a source-versioned validity boundary

**Date:** 2026-10-02  
**Disposition:** New knowledge  
**Coverage:** Repository metadata, README, recursive tree, selected implementation files, selected repository-authored tests, and one checked-in write-path receipt at the pinned revision. Scout did not install Sibyl, run its tests, start SurrealDB, or reproduce the races and correction failures.

## Question

How should an agent-memory system keep a promoted lesson or decision from remaining authoritative after its raw evidence changes, including when correction propagation is only partly successful?

## Source identity

- **Repo:** https://github.com/hyperb1iss/sibyl
- **Inspected revision:** [`69b60fe41a86d64efba7eed3092dba8cb90923d3`](https://github.com/hyperb1iss/sibyl/commit/69b60fe41a86d64efba7eed3092dba8cb90923d3)
- **Discovery query:** GitHub Repository Search API query `"AI agent" runtime pushed:>=2026-09-25`, sorted by `updated`, descending, 50 results per page
- **Search response:** `total_count: 652`; `incomplete_results: false`
- **Observed content revision:** the pinned commit above (committer date `2026-10-02T21:59:51Z`)

## Source observations

Sibyl describes a `context → act → remember → reflect` loop in which raw captures remain verbatim and reflection candidates can be promoted into graph memory. The useful implementation signal is that promotion is not treated as a timeless copy operation.

At the inspected revision:

1. **Promotion records source identity, not only derived text.** The promotion builder collects each raw source with a source fingerprint, hashes the sorted snapshot set into `source_snapshot_sha256`, and includes that identity in the promoted entity. The promotion path also retains source bindings used by later validation.
2. **Validation is sensitive to source revision even when text returns to the old value.** The repository test `test_promotion_rejects_source_epoch_roundtrip_during_insert` changes a source away from and back to its original text while a promotion is being inserted. It expects promotion to fail and the inserted graph row to remain non-recallable. This distinguishes a content equality check from a source-version check: an intervening correction creates a new evidence epoch even if the bytes later match.
3. **Re-extraction creates a new derivative rather than relabeling the old one.** `test_reextraction_preserves_old_snapshot_and_can_publish_current_evidence` changes source metadata, verifies that the old promoted row is no longer recallable, publishes a different row bound to the new source revision, and expects replay against bookkeeping-only metadata to reuse the current row. The test therefore separates evidence-bearing source changes from operational metadata changes.
4. **Correction is an optimistic, propagating operation.** The correction service previews against an observed revision and applies the raw-memory update with that expected revision. It then projects lifecycle changes into derived graph rows and raw descendants. Its result exposes `propagation_complete`; refused targets, truncated traversal, lookup failures, or failed graph updates prevent a complete result.
5. **Out-of-order correction workers carry per-source clocks.** A selected fault test gives a derived row a newer non-blocking correction state, then resumes an older supersede operation. The expected behavior is to leave the row and edges unchanged rather than recreate a stale exclusion. Separate tests expect graph lookup failure or failed edge removal to produce an incomplete propagation result while still attempting healthy raw descendants.
6. **Internal validity metadata is not user-authored content.** Source bindings, source snapshot fingerprints, and correction blockers are filtered from public memory output in the inspected tests, while lifecycle admission still consults them before returning context.

Primary inspected files:

- [README and memory loop](https://github.com/hyperb1iss/sibyl/blob/69b60fe41a86d64efba7eed3092dba8cb90923d3/README.md)
- [promotion metadata construction](https://github.com/hyperb1iss/sibyl/blob/69b60fe41a86d64efba7eed3092dba8cb90923d3/packages/python/sibyl-core/src/sibyl_core/services/memory_promotion.py)
- [correction preview and apply path](https://github.com/hyperb1iss/sibyl/blob/69b60fe41a86d64efba7eed3092dba8cb90923d3/packages/python/sibyl-core/src/sibyl_core/services/memory_correction.py)
- [source-epoch race test](https://github.com/hyperb1iss/sibyl/blob/69b60fe41a86d64efba7eed3092dba8cb90923d3/packages/python/sibyl-core/tests/test_promotion_content_epoch_race.py)
- [source-snapshot identity test](https://github.com/hyperb1iss/sibyl/blob/69b60fe41a86d64efba7eed3092dba8cb90923d3/packages/python/sibyl-core/tests/test_reflection_source_snapshot_identity.py)
- [partial and out-of-order correction tests](https://github.com/hyperb1iss/sibyl/blob/69b60fe41a86d64efba7eed3092dba8cb90923d3/packages/python/sibyl-core/tests/test_correction_partial_propagation.py)
- [source-clock visibility tests](https://github.com/hyperb1iss/sibyl/blob/69b60fe41a86d64efba7eed3092dba8cb90923d3/packages/python/sibyl-core/tests/test_source_clock_visibility.py)

## Interpretation

The reusable pattern is a **source-versioned validity boundary** for derived memory:

- bind every promoted lesson, decision, summary, or graph fact to the exact source identities and revisions that justified it;
- revalidate that binding at publication and retrieval, not only when extraction begins;
- treat a correction-and-restore cycle as a new evidence epoch even when content returns to the same bytes;
- preserve old derivatives for lineage or audit, but make them non-recallable once their source binding is stale;
- publish a newly derived item against the current source instead of rewriting old provenance; and
- expose partial propagation as unfinished reconciliation, with per-source clocks preventing late workers from undoing newer correction state.

This complements the library's broader rule to separate raw capture from admitted canon in [`hn-agent-operational-memory.md`](../hn-agent-operational-memory.md). Sibyl adds a concrete lifecycle detail: admission is not permanent. Retrieval eligibility must remain conditional on the source snapshot and correction state that support the derivative.

For May-style knowledge and task systems, this suggests that changing an authoritative source should invalidate or reconsider accepted derived guidance by source revision, rather than relying on textual deduplication or destructive overwrite. The practical design question is not only “what generated this memory?” but also “is that exact evidence epoch still current, and did invalidation reach every readable projection?”

## Limitations

This is static repository evidence, not an independent validation of Sibyl's runtime. Repository-authored tests state intended behavior; Scout did not execute them or inspect every storage and retrieval path. The checked-in write-path receipt reports passing project commands for a separate fixture, but it is author-produced and does not prove the selected race and correction tests passed at this revision. The inspection does not establish crash atomicity across raw and graph stores, completeness under every lineage shape, access-control correctness, benchmark quality, or production reliability. A source-revision mechanism also cannot determine whether an unchanged source is true, complete, or still applicable; it only helps stop a derivative from silently outliving the evidence epoch it names.
