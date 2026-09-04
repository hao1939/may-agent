<ai_context>
summary: "Cycle 412 designs a compact, range-aware provenance record for the fourteen accepted Cycles 373-386 reviews. It preserves exact producer and review lineage, seed-access provenance, canonical evidence anchors, limitations, disposition, and rollback without authorizing deletion."
triggers: ["Cycle 412", "RV-036", "provenance replacement", "retrieval compaction", "Cycles 373-386"]
last_updated: "2026-09-05"
source_basis: "Accepted standing history through 6f434a005154e93327167869f8ab0d624a1ef89f; exact range 3ea02c3c767a77a1fb5fae7b176210edf6156ff6..08f7d1f8984fbb5cedb90b7b4ff1ac69d83add80; direct-child review 2379a9fabb619c653cbabda04e60066b5c473aa4; current project-owned findings and INDEX routes; Cycle 411 source-bound loss audit."
</ai_context>

# Cycle 412 compact provenance replacement design

## What was wrong and what changes

Cycle 411 showed that the current retrieval routes survive virtual removal of
the repeated Cycle 373-386 topic-map and research-ledger prose, but exact
provenance does not: 61 headings, six commit references, and 67 timestamps
become absent. Deleting first and reconstructing later would erase the evidence
needed to decide whether a shorter record is faithful.

This checkpoint designs the smallest credible replacement before changing any
historical narrative. It uses one range-level review record, two shared XHS
receipt records, and fourteen entry records. Each entry points to accepted
project-owned evidence rather than copying its source narrative. No file is
deleted, compacted, moved, or rewritten here.

## Seed and lane boundary

Cycle 412 began from clean tip
`6f434a005154e93327167869f8ab0d624a1ef89f` at
`2026-09-04T22:45:39.279Z`. Cycle 409's exact XHS observation through
`2026-09-04T21:36:26.369Z` was about 69 minutes old and inside the six-hour
unchanged-surface cadence. This bounded reconciliation made zero XHS requests:
additions and changes remain unknown, observed removals remain `[]`, all 132
durable identities remain unavailable at the login-class saved surface, and no
account state changed. The next cadence boundary is no earlier than
`2026-09-05T03:36:26.369Z`.

GitHub, arXiv, and Reddit also made zero requests. Their retained evidence and
revisit triggers did not fire. RV-004 remains higher severity but lacks the
protected route-to-later-outcome join; RV-034 remains at its external-runtime
boundary. RV-036 was therefore the highest-value accessible item.

## Required record shape

The proposed record is fail-closed: an entry is incomplete unless it has all of
the following fields.

| Field | Purpose |
| --- | --- |
| `entry_id` | Stable cycle and subject identity, independent of heading text. |
| `producer_source` / `producer_result` | Exact parent and accepted material commit. |
| `accepted_evidence` | Project-owned file plus stable section identity containing source hashes, repository revisions, and calculations. |
| `seed_receipt` | Reference to one exact observation interval; repeated intervals are normalized rather than copied. |
| `review_source` / `review_result` | Exact independently reviewed boundary and result. |
| `limitation` | The decision-changing contradiction, missing artifact, or scope limit. |
| `integration` | `exact`, `patch-equivalent`, `superseded`, or `blocked`, with the canonical result when different. |
| `rollback` | Ordinary revert boundary and any ordering constraint. |

`accepted_evidence` is a reference, not a claim cache. The referenced section
must retain the exact archive digest, repository revision, released-result
identity, or stated unavailability needed for reproduction. A future validator
must reject a missing target, ambiguous section, non-ancestor result, absent
limitation, or review boundary that does not cover the producer result.

## Fourteen-entry mapping

All entries share range review source
`08f7d1f8984fbb5cedb90b7b4ff1ac69d83add80` and direct-child reviewer result
`2379a9fabb619c653cbabda04e60066b5c473aa4`. Each accepted material is an
ancestor of that source, so integration is `exact` for every entry. Rollback is
the ordinary revert of the named material after reverting dependent
status/review commits; none changes schema, runtime, authority, or external
state.

| Cycle / entry | Exact producer source → result | Accepted project-owned evidence | Decision-changing limit |
| --- | --- | --- | --- |
| 373 / HexStrike | `3ea02c3c767a77a1fb5fae7b176210edf6156ff6` → `b7d2a647c7217a47b63ab533bb3687e34606ebca` | [HexStrike client contrast](../../knowledge/findings/2026-07-07-hn-arxiv-github-scan-425.md#high-hexstrike-ai--a-strong-qualified-client-contrast-260702873) | Matched rows support a client-associated contrast, not client-only causality. |
| 374 / SkillOpt-Lite | `b7d2a647c7217a47b63ab533bb3687e34606ebca` → `55aa18a884d097d71d3e70e7270fe5351e591798` | [SkillOpt-Lite audit](../../knowledge/findings/2026-07-07-hn-arxiv-github-scan-425.md#high-skillopt-lite--minimal-viable-skill-optimization-260703451) | Smaller-model headlines also change optimization method; the public artifact omits headline results. |
| 375 / Anchored Self-Play | `55aa18a884d097d71d3e70e7270fe5351e591798` → `ea3ca60daaecd86da482fc6f04c7a99d6a9c2635` | [Anchored Self-Play audit](../../knowledge/findings/2026-07-07-hn-arxiv-github-scan-425.md#medium-anchored-self-play-for-code-repair-260703523) | The main result bundles two interventions, lacks repeated-run uncertainty, and does not test self-configuration. |
| 376 / GameEngineBench | `ea3ca60daaecd86da482fc6f04c7a99d6a9c2635` → `165db64db9dd3c0d355948ff33eb010e410e919e` | [GameEngineBench audit](../../knowledge/findings/2026-07-07-arxiv-scan-424.md#gameenginebench--runtime-environments-expose-agent-limits-260703525) | The named repository was unavailable; the 31-task result does not establish general runtime impossibility. |
| 377 / AtomicCommitBench | `165db64db9dd3c0d355948ff33eb010e410e919e` → `1cfeda1e1767acd3feb7ee935aa112413eefba4f` | [AtomicCommitBench audit](../../knowledge/findings/2026-07-07-arxiv-scan-424.md#atomiccommitbench--commit-history-reconstruction-260703332) | Manuscript and released summary counts disagree; replay saturation and grouping remain distinct. |
| 378 / hidden computation | `1cfeda1e1767acd3feb7ee935aa112413eefba4f` → `7baa4d39971df7f4d3f5277bad5897ccc4f9b93c` | [Hidden-computation audit](../../knowledge/findings/2026-07-07-arxiv-scan-424.md#critical-reading-between-the-dots--hidden-computation-is-readable-260703502) | Recovery is partial and task-scoped, not general monitorability or zero-information evidence. |
| 379 / single-prover verification | `7baa4d39971df7f4d3f5277bad5897ccc4f9b93c` → `bf0ec2e3f4773c8f3969f017f3b56d9b88928bb5` | [Single-prover audit](../../knowledge/findings/2026-07-08-hn-arxiv-github-scan-452.md#3-how-to-avoid-debate-scalable-ai-safety-via-doubly-efficient-interactive-proofs-260703561) | The theorem needs structured oracle classes and supplies no deployed cost comparison. |
| 380 / DSCC | `bf0ec2e3f4773c8f3969f017f3b56d9b88928bb5` → `37cd39f6434d8464d771c783ef61fb6a051b821a` | [DSCC audit](../../knowledge/findings/2026-07-07-arxiv-scan-424.md#critical-securing-multi-tool-agent-chains--compositional-taint-260703423) | Catalog rejection arithmetic is not real violation recall; implementation and zone assignments are absent. |
| 381 / CodeRabbit | `37cd39f6434d8464d771c783ef61fb6a051b821a` → `2a50934903820fb996a6dde046b27f5202fd3c24` | [CodeRabbit audit](../../knowledge/findings/2026-07-07-arxiv-scan-424.md#high-agentic-code-review--563-rejection-rate-260703316) | Reply-selected automated labels cannot estimate all-comment user impact. |
| 382 / RLSR | `2a50934903820fb996a6dde046b27f5202fd3c24` → `d7cca640660903036f7b1da37c9477afcdfcced2` | [RLSR audit](../../knowledge/findings/2026-07-07-arxiv-scan-424.md#high-selective-prediction--training-abstention-260703528) | Abstention is post-hoc thresholding, results vary by dataset, and low-coverage MedQA lacks a finite-sample guarantee. |
| 383 / agentic TTT | `d7cca640660903036f7b1da37c9477afcdfcced2` → `fc4dcc7d0c98a29686dd63c291c7d7efa68e2b6c` | [Agentic test-time-training audit](../../knowledge/findings/2026-07-07-arxiv-scan-424.md#high-agentic-test-time-training--qualified-preservation-hypothesis-260703441) | Selected means do not isolate token weighting or causally establish competence preservation. |
| 384 / policy repair | `fc4dcc7d0c98a29686dd63c291c7d7efa68e2b6c` → `83a35e8e0f66c46f3e1c66a54132991ba311cf14` | [Aggregate policy-repair audit](../../knowledge/findings/2026-07-08-hn-arxiv-github-scan-452.md#6-when-aggregate-alignment-misleads-auditing-policy-repair-260703386-supporting) | One simulator misranking supports multi-resolution audit, not a universal repair law. |
| 385 / HASE | `83a35e8e0f66c46f3e1c66a54132991ba311cf14` → `02ae7286bcbe8d66c18ca4f56b1e23d095a93549` | [HASE audit](../../knowledge/findings/2026-07-08-hn-arxiv-github-scan-452.md#1-harness-aware-self-evolving-hase-260703935) | Cross-system rows jointly change model, harness, proposer, and budget; no attributable release was found. |
| 386 / VERITAS | `02ae7286bcbe8d66c18ca4f56b1e23d095a93549` → `08f7d1f8984fbb5cedb90b7b4ff1ac69d83add80` | [VERITAS audit](../../knowledge/findings/2026-07-08-hn-arxiv-github-scan-452.md#2-veritas-towards-a-general-purpose-replication-tool-for-scientific-research-260702931) | The public release omits benchmark trajectories/results and differs from the paper's grader boundary. |

The seed receipts normalize to two records rather than fourteen copied
paragraphs: Cycles 373-374 reuse Cycle 341 observation through
`2026-09-04T05:00:03.241Z`; Cycle 375 records the supported observation through
`2026-09-04T11:09:20.326Z`; Cycles 376-386 reference that second receipt. Each
states unknown additions/changes, observed removals `[]`, 132 unavailable
identities, and observational-only access.

## Decision and remaining uncertainty

The schema is sufficient to represent the known required distinctions, but it
is not yet a proven replacement. Exact section anchors must pass link checks;
the six lost commit references and every reproduction identity must survive a
new source-bound virtual projection; and each of the 67 timestamps must be
classified as receipt/review/reproduction/decision time or non-decision
operational metadata. A protected retrieval or later-decision comparison is
still required before any user-value or RV-004 claim.

The current relative-link gate removes fragments before checking target-file
existence, so it cannot prove any section identity in this table. The isolated
candidate validator must additionally resolve each fragment against the
target document, reject missing or ambiguous headings, and regression-pin all
fourteen anchors. A file-existence-only pass is not compaction evidence.

RV-036 remains medium/open and real compaction remains rejected. The next
ranked step is an isolated candidate record implementing this schema, followed
by the same source-bound loss audit and a field-completeness control. Historical
topic-map and research-ledger prose must remain untouched until that candidate
is independently reviewed and proves no decision-relevant loss.

## Supervision

- Goal: Continuously turn Scout Knowledge Library's collected seeds, unresolved topic-map questions, and newly discovered evidence into the highest-value validated knowledge improvements, keeping the library and living topic map useful, current, traceable, and safely integrated into local main at reviewed release boundaries until the human explicitly stops or replaces this goal.
- Goal ID: "g_c1b31972-1674-47cb-96d8-c797d768010d"
- Worker: "goal-a2acd0ab0579d04f3d163e5db9a"
- Codex session: "01a05c5f-cb03-7760-9c42-893d669f7762"
- Pane: "w1:p6C"
