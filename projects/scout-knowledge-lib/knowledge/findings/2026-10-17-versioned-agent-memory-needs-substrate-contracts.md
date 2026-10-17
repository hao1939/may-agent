<ai_context>
summary: "Pinned Memoria source shows that snapshots, branches, merges, and rollback inherit storage-engine schema, DDL, concurrency, and commit-uncertainty boundaries; memory version labels alone do not establish safe historical recovery."
triggers: ["versioned agent memory", "memory snapshots", "memory branches", "memory rollback", "Memoria", "MatrixOne", "storage substrate"]
last_updated: "2026-10-17"
source_basis: "GitHub repository discovery plus Memoria README, compatibility documentation, implementation, and project-authored tests inspected at revision 0ec8bf073deb84b07f492a84e3f0e7f2de6066f2; Scout did not execute the software, tests, database, or a live restore."
</ai_context>

# Versioned agent memory needs storage-substrate contracts

**Date:** 2026-10-17  
**Disposition:** New knowledge  
**Repo:** https://github.com/matrixorigin/memoria  
**Inspected revision:** https://github.com/matrixorigin/memoria/commit/0ec8bf073deb84b07f492a84e3f0e7f2de6066f2

## Question

What must an agent-memory system prove before “snapshot,” “branch,” “merge,” or “rollback” can be interpreted like the similarly named Git operations?

## Source observation

Memoria presents a Git-like interface over agent memory: snapshots, branches, merges, and rollback are backed by MatrixOne tables and native data-branch operations. The pinned source is valuable because its compatibility material documents where that analogy stops.

A restore first materializes historical rows into a private staging table using the current table schema and explicit column-name mapping. Only after preparation succeeds does it replace live rows with a `DELETE` and `INSERT` in one database transaction. This avoids reading a historical snapshot inside the write transaction, which the underlying engine forbids, and lets an insertion failure roll back the preceding deletion. But the atomicity is **per table**, not across the full memory/graph state. The documentation also states that a connection loss during `COMMIT` leaves the caller uncertain whether the transaction committed, so blind retry or compensating deletion is unsafe.

Branches inherit a different set of substrate constraints. Native diff, merge, and pick require schema equivalence; a historical snapshot can predate a newly added field. Memoria has one explicit compatibility migration for `subject_id`, validates names, order, types, nullability, defaults, and vector dimensions before native operations, and rejects unsupported differences rather than guessing. Before applying a required branch-column migration, it runs a bounded capability probe on uniquely named synthetic tables, exercises parent/child `ALTER`, native diff, merge, field preservation, and native deletion, then cleans up. Failure, timeout, ambiguous capability, or failed cleanup cannot become a successful admission.

Concurrency and scale are also part of the operation contract. The project says callers must serialize schema changes with branch/snapshot operations, quiesce writes during restore, and avoid splitting a whole-table replacement into separately committed batches. The indexed regression fixture uses 512 vectors; the documentation explicitly declines to infer a universal production row limit from that fixture. Its upgrade rehearsal also demonstrates that an open SQL port, successful version query, or API health response does not prove snapshot readiness when an internal catalog migration remains incomplete.

Project-authored integration tests cover snapshot mutation and rollback, branch isolation, duplicate snapshot handling, historical-schema migration, conflict paths, and rollback after migration. Those tests are evidence of intended behavior and selected regressions, not independent proof that a particular database build, workload, or production topology satisfies the same contract.

## Interpretation

“Git for memory” is an interface metaphor, not a recovery guarantee. A trustworthy versioned-memory receipt should identify at least:

1. the memory and graph tables included in the version boundary;
2. the storage-engine build and verified capabilities used for snapshot, diff, merge, and restore;
3. the schema identity of both historical and live state, including migration rules;
4. the concurrency fence or quiescence condition under which the operation ran;
5. the atomicity scope—row, table, or multi-table state;
6. the observed commit outcome, including an explicit **unknown** state after transport loss; and
7. scale evidence that matches the intended row, embedding, index, and transaction sizes.

A branch label without those coordinates can name a real historical table while still being unsafe to diff or merge. A rollback response can mean that one table was transactionally replaced while associated graph state remained outside the same atomic boundary. And a successful health check can coexist with a broken catalog path needed by snapshots. Version-control terminology should therefore be accompanied by substrate-specific admission and recovery evidence.

## Relevance

Agent systems often retain facts, summaries, provenance, embeddings, and relationship edges in different structures. If a recovery feature versions only some of them, later behavior can combine old facts with new derived state. For long-running agents, version identity should be recorded separately from restore eligibility, merge compatibility, and commit certainty. Unknown outcomes must block destructive retry until the actual state is inspected.

## Evidence limits

Scout inspected the repository README, `docs/branch-copy-compatibility.md`, `docs/legacy-snapshot-compatibility.md`, `memoria/crates/memoria-git/src/service.rs`, `memoria/crates/memoria-storage/src/branch_capability.rs`, and project-authored branch/snapshot test sources through GitHub's public read-only endpoints at the pinned revision. Scout did not run Memoria, MatrixOne, the test suites, a schema migration, a branch merge, a snapshot restore, a failure injection, or a production-scale workload. The repository's reported test counts and upgrade rehearsal are project-authored evidence, not independently reproduced results.

## Sources

- [README](https://github.com/matrixorigin/memoria/blob/0ec8bf073deb84b07f492a84e3f0e7f2de6066f2/README.md)
- [Branch compatibility contract](https://github.com/matrixorigin/memoria/blob/0ec8bf073deb84b07f492a84e3f0e7f2de6066f2/docs/branch-copy-compatibility.md)
- [Historical snapshot compatibility and restore boundaries](https://github.com/matrixorigin/memoria/blob/0ec8bf073deb84b07f492a84e3f0e7f2de6066f2/docs/legacy-snapshot-compatibility.md)
- [Snapshot and branch service implementation](https://github.com/matrixorigin/memoria/blob/0ec8bf073deb84b07f492a84e3f0e7f2de6066f2/memoria/crates/memoria-git/src/service.rs)
- [Branch capability probe](https://github.com/matrixorigin/memoria/blob/0ec8bf073deb84b07f492a84e3f0e7f2de6066f2/memoria/crates/memoria-storage/src/branch_capability.rs)
- [Branch integration tests](https://github.com/matrixorigin/memoria/blob/0ec8bf073deb84b07f492a84e3f0e7f2de6066f2/memoria/crates/memoria-mcp/tests/branch_e2e.rs)
- [Snapshot integration tests](https://github.com/matrixorigin/memoria/blob/0ec8bf073deb84b07f492a84e3f0e7f2de6066f2/memoria/crates/memoria-mcp/tests/snapshot_e2e.rs)

## Discovery record

GitHub Repository Search API query: `"AI agent" (checkpoint OR replay OR provenance) pushed:>=2026-10-12 stars:>20`, sorted by update time. The HTTP 200 response reported `total_count: 1898` and `incomplete_results: false`. Discovery metadata selected the candidate; repository contents at the pinned revision, not search metadata or star count, ground this assessment.
