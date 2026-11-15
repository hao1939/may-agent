<ai_context>
summary: "ClickHouse Loom's pinned `memory.definitions.list` change models an admin-approved shared definition as governed only while its namespace-wide source remains live, text-equivalent, and below the sensitivity boundary. The read-time verdict exposes explicit lapse reasons and deterministic name-loss rules, showing that durable approval should be recomputed from current authority rather than stored as a permanent badge. This commit adds inspection and tests; its own design says the search term leg is not built yet and nothing is served differently in this change."
triggers: ["agent memory governance", "shared memory approval", "read-time liveness verdict", "definition provenance", "memory revocation", "ClickHouse Loom"]
last_updated: "2026-11-15"
source_basis: "Live GitHub Repository Search API discovery and static inspection of ClickHouse/loom at commit 3458d33261079f51a72ff03a3a8775f680d9f32c: merged PR #679, definition-check and list-operation source, promotion-source helper, curation-loop design, and project-authored unit/integration tests. Scout did not install Loom, run its tests, query a deployment, or inspect every changed file."
</ai_context>

# Agent memory approvals need read-time liveness verdicts

**Date:** 2026-11-15  
**Disposition:** new knowledge  
**Repo:** https://github.com/ClickHouse/loom  
**Reviewed revision:** [`3458d33261079f51a72ff03a3a8775f680d9f32c`](https://github.com/ClickHouse/loom/commit/3458d33261079f51a72ff03a3a8775f680d9f32c)  
**Pull request:** [#679 — `memory.definitions.list` says which shared definitions are governed, and why a lapsed one lapsed](https://github.com/ClickHouse/loom/pull/679)

## Question

When an administrator promotes agent memory into a shared, organization-level definition, should that approval remain a permanent property of the copied row, or should readers recompute whether the approval is still valid from the current source state?

## Source observation

ClickHouse Loom describes shared definitions as admin-approved copies of namespace-wide memory. The reviewed change adds an experimental admin operation, `memory.definitions.list`, that reports whether each shared definition is currently `governed` or `lapsed`, along with a closed lapse-reason vocabulary. Its central rule is that approval is derived state, not a permanent badge on the shared copy.

The pure `definition_check.py` module treats a copy as eligible only when it was promoted from exactly one namespace-wide source row under the same key and still contains a usable term. It then compares that copy with a strong read of the current source head. Governance lapses when the source is gone, superseded, conflicted, marked duplicate, otherwise inactive, expired, past `valid_to`, textually changed under Loom's served-content hash, or labelled/graded `medium` or `high` sensitivity. A non-namespace-wide provenance reference and a copy without a term lapse before any source read.

The list operation applies the checks in a deliberate order. It fetches current source heads strongly and across the whole namespace. It runs liveness and content-equivalence checks before sensitivity grading, so a source already known to be changed or ended is not needlessly graded. The sensitivity decision considers both the stored label and a fresh grade of the current value. The implementation also carries the amount of text graded so far, allowing a long run to yield to Loom's loop.

Approval can therefore recover without inventing a second governance state. The design says a source restored to the exact approved text can become governed again; a changed text needs a new promotion. Conversely, edits, tombstones, expiry, invalidation, or sensitivity changes can lapse a previously approved copy even though the copy itself remains in the shared table. This keeps the verdict tied to the source authority and its current state.

The change also makes conflicts among approved names inspectable. When multiple governed definitions claim the same folded term or alias, the latest `promoted_at` wins, with `promotion_event` as a deterministic tie-breaker. Losing definitions remain governed for names they still hold, while a lapsed definition holds no name. Entries beyond the configured ceiling are listed as capped without reading or decoding their values.

Project-authored tests cover every lapse category, JSON key reordering that must not count as a text change, both stored and freshly detected sensitivity, UTC comparison of `valid_to`, skipped grading for already-changed sources, deterministic same-second name winners, capped rows that are not source-read, and namespace-wide provenance failures that require no source read.

A crucial boundary is explicit in the pull request and design document: this commit adds the verdict check and admin inspection operation, but **does not yet change what search serves**. The planned term-search leg that would serve only governed definitions is described as not built yet. The merged source therefore demonstrates a governance model and tested inspection path, not complete enforcement across retrieval.

## Reusable pattern

Treat durable approval of shared agent memory as a current verdict computed from separately retained evidence:

1. **Pin the promoted source:** record the exact authoritative row and reject copies whose provenance does not match the expected scope and key.
2. **Re-read authority strongly:** inspect the current source head rather than trusting the old shared copy or a cached approval flag.
3. **Separate lapse reasons:** distinguish withdrawal, supersession, conflict, duplication, inactivity, expiry, validity-window end, changed content, and sensitivity so remediation is specific.
4. **Compare served meaning:** use the same canonical content hash as the serving path, so irrelevant serialization differences do not revoke approval while semantic content changes do.
5. **Fail closed on source loss:** a missing or unreadable authority source must not silently preserve a shared definition's trusted status.
6. **Resolve name collisions deterministically:** expose which definition wins each term or alias and preserve the exact winner rule as evidence.
7. **Bound inspection honestly:** mark rows outside the read ceiling as capped rather than implying they were evaluated.
8. **Keep inspection and enforcement receipts separate:** an API that correctly reports a lapsed definition does not prove every retrieval path withholds it.

This complements [Source-versioned memory validity](./2026-10-02-sibyl-source-versioned-memory-validity.md): both make memory validity non-monotonic and source-dependent, while Loom adds explicit admin-promotion provenance, sensitivity lapse, deterministic term ownership, and a visible distinction between verdict computation and search enforcement.

## Evidence boundary

This is static inspection of one merged commit and its project-authored tests. Scout read the merged PR description, the complete new pure verdict module, the list operation, the promotion-source helper, relevant design sections, and named tests. Scout did not clone or install Loom, run the test suite, inspect every changed file, query a live ClickHouse/Postgres deployment, verify rolling-upgrade behavior, exercise the admin API, or audit every search and memory-serving path. The tests are regression evidence supplied by the project, not independent verification.

The reviewed design explicitly says the term leg and review path are not built yet, and PR #679 says nothing is served differently by this change. The finding therefore supports the architecture of revocable, source-derived approval and an inspection receipt; it does not establish complete retrieval enforcement or deployed behavior.

## Discovery evidence

A live GitHub Repository Search API query for `coding agent pushed:>=2026-11-14 stars:>50`, sorted by updated descending with `per_page=10`, returned HTTP 200 and 725 matches. The bounded result surfaced `ClickHouse/loom`, whose repository metadata reported 60 stars, 12 forks, and a push at `2026-11-15T00:01:55Z`. The reviewed head commit was committed at `2026-11-15T00:00:56Z`. Search across the Scout library found no prior source record for `ClickHouse/loom`, `memory.definitions.list`, or this governed-definition lapse mechanism.
