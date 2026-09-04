<ai_context>
summary: "Cycle 411 virtually removes the repeated Cycle 373-386 topic-map and detailed-ledger lines without changing repository content. Navigation and links survive, but unique chronology and provenance do not, so real compaction is rejected pending a smaller provenance replacement."
triggers: ["Cycle 411", "RV-036", "history projection", "retrieval compaction", "provenance loss"]
last_updated: "2026-09-05"
source_basis: "Clean source 73088d8c912fadb2fb6b3e6e1e721c854ce70ff9; exact Cycle 373-386 range 3ea02c3c767a77a1fb5fae7b176210edf6156ff6..08f7d1f8984fbb5cedb90b7b4ff1ac69d83add80; commit-scoped in-memory blame projection; frozen navigation fixtures v1-v3; broad relative-link audit."
</ai_context>

# Cycle 411 history projection

## What was wrong and what changes

Cycle 410 proved that fourteen stable INDEX routes improve retrieval, but it
did not prove that the repeated topic-map and detailed-ledger history could be
deleted without losing evidence. A route can still resolve while chronology,
artifact identity, or review disposition silently disappears.

This checkpoint adds a read-only projection harness and rejects real
compaction on the observed result. The harness reads committed content and
porcelain blame through Git, removes selected lines only in memory, and then
runs the existing navigation and relative-link logic over the projected
corpus. It never writes, deletes, checks out, or stages either historical file.

## Seed and source boundary

The most recent XHS observation ended at `2026-09-04T21:36:26.369Z`. When
Cycle 411 began at `2026-09-04T22:15:20.280Z`, that receipt was about 39
minutes old and inside the six-hour unchanged-surface cadence. The bounded
reconciliation therefore reused it: additions and changes remain unknown,
observed removals remain `[]`, and all 132 durable identities remain
unavailable at the login-class saved surface. No XHS state changed.

RV-004 and RV-034 remain high/open at their protected later-outcome and
external-runtime boundaries. RV-036 was the highest-value accessible question.
The audit used only accepted local Git and library evidence. XHS, GitHub,
arXiv, and Reddit made zero public requests and retain their recorded access,
freshness, and revisit triggers.

## Matched virtual-removal result

The fixture is frozen against source
`73088d8c912fadb2fb6b3e6e1e721c854ce70ff9`. It selects the fourteen commits
in exact range
`3ea02c3c767a77a1fb5fae7b176210edf6156ff6..08f7d1f8984fbb5cedb90b7b4ff1ac69d83add80`
and omits only current lines whose last blame origin is in that set.

| Projected file                                               | Current lines omitted | Bytes represented |
| ------------------------------------------------------------ | --------------------: | ----------------: |
| `knowledge/xhs-topic-map.md`                                 |                 1,082 |            67,725 |
| `reports/research/xhs-seed-first-memory-lanes-2026-09-01.md` |                 1,772 |           105,936 |
| Total                                                        |                 2,854 |           173,661 |

The exact range originally added 2,862 lines across those files. Eight later-
modified lines remain because the projection deliberately follows current
line attribution rather than pretending that later corrections belong to the
old commit.

| Control              |                         Projected result |
| -------------------- | ---------------------------------------: |
| Navigation v1        |                                    11/14 |
| Navigation v2        |                                      8/8 |
| Navigation v3        |                                    14/14 |
| Broad relative links | 1,546 documents / 1,774 links / 0 errors |

Retrieval therefore survives this local deterministic control. Evidence
retention does not. Across the projected corpus, 61 unique removed headings,
six exact commit/provenance refs, and 67 timestamps have no surviving literal;
no URL becomes absent. The six refs are
`1a8ea9c904eb439b53703e1067cfa5172dc8072a`,
`255232f3b0977d1938e62a52cdaf2e9cda1e0dff`,
`300ff7ea03469d7c3d7f07ef3427089eb57785a2`, `8b8f7179cf`,
`8dca8f4576`, and `9c52296961`. They include artifact parent/tree provenance
and stabilization-lifecycle disposition, not merely repeated prose.

## Disposition, uncertainty, and rollback

RV-036 remains **medium/open**. The projection supports a high-confidence
claim about current deterministic route and link preservation. It does not
measure human retrieval time, semantic retrieval, downstream reuse, or the
decision value of every timestamp. It positively shows that deleting the
selected lines now would remove unique exact provenance.

Real compaction is therefore rejected at this boundary. Before reconsidering
it, one compact project-owned record must preserve, for each of Cycles
373-386, the accepted entry path, exact producer/reviewer source and result
mapping, seed-access interval, reproducibility identities, limiting or
contradictory evidence, integration disposition, and rollback boundary. A
rerun must then show no loss of decision-relevant identities; any remaining
absent timestamps must be individually classified as non-decision operational
metadata rather than assumed disposable.

Rollback this checkpoint with one ordinary revert of its resulting standing
commit. That removes the harness, fixture, report, and topic-map decision
together. It does not restore or delete historical evidence because none was
changed.

## Supervision

- Goal: Continuously turn Scout Knowledge Library's collected seeds, unresolved topic-map questions, and newly discovered evidence into the highest-value validated knowledge improvements, keeping the library and living topic map useful, current, traceable, and safely integrated into local main at reviewed release boundaries until the human explicitly stops or replaces this goal.
- Goal ID: "g_c1b31972-1674-47cb-96d8-c797d768010d"
- Worker: "goal-a2acd0ab0579d04f3d163e5db9a"
- Codex session: "01a05c5f-cb03-7760-9c42-893d669f7762"
- Pane: "w1:p6C"
