<ai_context>
summary: "Cycle 414 records a material XHS access-shell change and tests whether the accepted compact provenance record can reconstruct fourteen exact dispositions from the same project-owned anchors. It can at the schema level, but the producer-authored scorer does not prove human retrieval or safe compaction."
triggers: ["Cycle 414", "RV-036", "provenance reconstruction", "matched anchor control", "XHS seed reconciliation"]
last_updated: "2026-09-05"
source_basis: "Exact canonical source d3a8a06186f1e254abb9d48a765804468987727d; exact material 71b24b67ed717ec7d1c65fedb9e0192c7b304d23; accepted replacement fixture SHA-256 8c9ecb6c26214be88820eb9b9d3612ea82394a1b5fdc7dae20e29aab84cc1856; separately source-frozen scorer SHA-256 a7ddcc64a8fe7225c584ea65e52ff5040151f3dd951013c491f21b38b413cf9e; observational XHS evidence through 2026-09-05T07:41:57.756Z."
</ai_context>

# Cycle 414 provenance reconstruction audit

## What changed for the reader

Cycle 413 proved that a compact record preserves six commit references, 48
classified timestamps, one contiguous fourteen-result chain, two immutable
seed receipts, and fourteen unique evidence anchors. It did not prove that a
reader could recover each accepted disposition from that record.

Cycle 414 adds a separate digest-pinned scorer and a deterministic reader. The
reader resolves the same fourteen project-owned anchor sections from the exact
accepted evidence tip, combines their headings with the replacement's source,
result, receipt, review, limitation, integration, and rollback fields, and
scores the ordered answers. No historical evidence is deleted or rewritten.

## Seed-first and lane boundary

The six-hour XHS cadence had elapsed. Worker UID 1000 (`hao`) observed direct
localhost 9222 fail with curl exit 7 / HTTP 000 at
`2026-09-05T07:41:38.237Z`. Passwordless `sudo nsenter` supplied effective UID
0 process/network access to root-owned Chrome PID 2136. The default Node
v18.19.1 wrappers produced empty no-result output; explicit Node v22.19.0 then
ran exactly one supported public `status` and one non-navigating
`saved-status` from `07:41:56.420Z` through `07:41:57.756Z`.

- Explore remained readable with 30 notes and no login wall.
- Saved status returned HTTP 200, final class `profile`, 103,021 bytes, target
  SHA `e860da46506d774eced62830a670ea284f5150429482f8003c706bc6b006906e`,
  access fingerprint
  `74a9cdb73d2f8b37e8888154a2f2a67761178f8a6f64cd20e1fc384965cc2e44`,
  body SHA
  `486bb5c4f68e62e823399e31f9ad9e53daec7013486d56d6cc451746c3ae4f0b`,
  zero attributable items, the empty-set identity fingerprint, and a login
  wall.
- Relative to Cycle 409, shell class, byte length, access fingerprint, and body
  bytes changed. Target identity, HTTP status, login wall, and empty item set
  did not. Added/changed identities remain unknown, removals are `[]`, and all
  132 durable seeds remain unavailable rather than removed.

This authority reaches a browser process and network namespace, not a proven
authenticated account. No representative saved post was supported, no account
state changed, and GitHub, arXiv, and Reddit made zero requests.

RV-004 and RV-034 remain higher-impact but inaccessible without protected
later-outcome and external-runtime evidence. RV-036 was the highest-value
accessible gap. Bounded local ref inspection showed reviewer result
`8f5b1a46665d6618b45624bdf8ae38a56875bb86` already contained exactly on
standing; no new accepted range was designated.

## Matched reconstruction

Both arms use the fourteen anchor references already accepted in replacement
fixture `scout-provenance-replacement-cycle413.json`. The scorer is a separate
file frozen against pre-implementation canonical source
`d3a8a06186f1e254abb9d48a765804468987727d` and pinned at SHA-256
`a7ddcc64a8fe7225c584ea65e52ff5040151f3dd951013c491f21b38b413cf9e`.
The accepted replacement bytes remain pinned at SHA-256
`8c9ecb6c26214be88820eb9b9d3612ea82394a1b5fdc7dae20e29aab84cc1856`.

| Arm | Anchor sections | Complete dispositions | Exact ordered dispositions |
| --- | ---: | ---: | ---: |
| Anchor-reference-only control | 14 | 0 | 0 |
| Accepted replacement | 14 | 14 | 14 |

The arms hold anchor identity constant. Only the replacement arm receives the
cycle/source/result, seed receipt, review, limitation, integration, and
rollback fields needed for a complete answer. One changed limitation yields
13/14 exact; swapping the first two records yields 12/14; changing the scorer
bytes fails the pinned digest before scoring.

## Conclusion and uncertainty

The compact record is sufficient to reconstruct the exact fourteen
schema-level dispositions and their evidence headings under this deterministic
reader. Confidence is high for byte identity, anchor resolution, field/order
sensitivity, and the reported 14-versus-0 comparison.

The scorer is producer-authored, even though it is separately source-frozen.
Its hashes are not an independent judgment of whether each limitation is
semantically adequate. The baseline intentionally omits mapping fields; it is
not a human retrieval trial. The result supplies no user query, protected
selection, token measurement, later reuse, changed decision, or evidence that
the 61 omitted headings and 19 operational timestamps are dispensable.
RV-036 remains mitigated medium/open and real compaction remains rejected.
RV-004 and RV-034 remain high/open.

Next, freeze decision-shaped prompts before implementing a retriever so the
candidate cannot encode the evaluator's answers, or obtain an independently
authored held-out scorer. Historical prose remains until that stronger test and
independent review accept a deletion boundary.

## Integration, validation, and rollback

Exact source `d3a8a06186f1e254abb9d48a765804468987727d` contains reviewer result
`8f5b1a46665d6618b45624bdf8ae38a56875bb86` as a direct ancestor. That result
maps from reviewed source `764cb00eca907fdefcb96df2fdbf49dbfb08f85f` at
stable patch ID `b20c37b760eecf07fbad1ea4818f78c6c4c94842`; the durable ledger records
exact integration and RV-050 resolution.

Material `71b24b67ed717ec7d1c65fedb9e0192c7b304d23` is the direct child of
`d3a8a06186`. Its exact-commit gate passes syntax, TypeScript, formatting,
Cycle 409 seed projection, 110 scoped links, navigation 11/14, 8/8, and 14/14,
and 316 tests / 1,539 assertions with zero failures. Focused reconstruction
passes four tests / six assertions. Final Cycle 414 projection, broad links,
health, cleanliness, and protected fingerprints are validated after this
documentation commit.

Roll back the documentation commit carrying this report first, then ordinarily
revert `71b24b67ed`. That removes only the reconstruction scorer/reader/tests;
it does not authorize reverting accepted reviewer integration, deleting
history, moving local main, or cleaning `/app`.

## Supervision

- Goal: Continuously turn Scout Knowledge Library's collected seeds, unresolved topic-map questions, and newly discovered evidence into the highest-value validated knowledge improvements, keeping the library and living topic map useful, current, traceable, and safely integrated into local main at reviewed release boundaries until the human explicitly stops or replaces this goal.
- Goal ID: "g_c1b31972-1674-47cb-96d8-c797d768010d"
- Worker: "goal-a2acd0ab0579d04f3d163e5db9a"
- Codex session: "01a05c5f-cb03-7760-9c42-893d669f7762"
- Pane: "w1:p6C"
