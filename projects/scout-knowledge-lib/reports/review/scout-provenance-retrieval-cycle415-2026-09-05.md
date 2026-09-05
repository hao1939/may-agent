<ai_context>
summary: "Cycle 415 freezes fourteen decision-shaped provenance questions before a retrieval adapter and shows that accepted compact disposition fields retrieve 14/14 records versus 1/14 from the same anchor headings. The prompts are producer-authored from those dispositions, so this is a tuning-control regression, not independent retrieval or compaction evidence."
triggers: ["Cycle 415", "RV-036", "provenance retrieval", "prompt freeze", "matched heading control"]
last_updated: "2026-09-05"
source_basis: "Exact canonical source af5dc0ee06a258cb05bb47bff67450d4c21d2005; pre-adapter prompt commit d5b9b3ff943c3c2446bfb50e91e4163ec291e88b; retrieval material 6df152f71709e3251592acbc9fcb4403e6129462; prompt SHA-256 d86a0173e94fb1ca281ade40d49ddfe974e02e3973eb242aeed8d536b05023d5; accepted replacement and evidence anchors from Cycles 413-414."
</ai_context>

# Cycle 415 frozen-prompt provenance retrieval

## What changed for the reader

Cycle 414 reconstructed exact records with a producer-authored scorer. It did
not prevent the retrieval implementation from being shaped around its
questions. Cycle 415 creates a real Git boundary first: fourteen
decision-shaped prompts were committed as `d5b9b3ff943c3c2446bfb50e91e4163ec291e88b`,
whose parent is exact source `af5dc0ee06a258cb05bb47bff67450d4c21d2005`.
Only the child material `6df152f71709e3251592acbc9fcb4403e6129462`
adds the adapter and scores the result.

The adapter reuses the pre-existing generic Scout navigation ranker. It does
not introduce prompt-specific weights or inspect expected identities while
ranking. No historical evidence is deleted or compacted.

## Seed-first and integration boundary

Cycle 414's supported XHS observation ended at
`2026-09-05T07:41:57.756Z`. The Cycle 415 reconciliation at
`2026-09-05T07:59:44.049Z` was about eighteen minutes later and inside the
six-hour cadence. It therefore made zero XHS, GitHub, arXiv, or Reddit
requests. Added and changed collection identities remain unknown, observed
removals remain `[]`, and all 132 durable seeds remain unavailable. No account
state changed.

Reviewer result `8f5b1a46665d6618b45624bdf8ae38a56875bb86`
remained an exact standing ancestor. Read-only ref inspection found no newly
designated accepted result requiring integration.

## Matched result

The prompt fixture is pinned at SHA-256
`d86a0173e94fb1ca281ade40d49ddfe974e02e3973eb242aeed8d536b05023d5`.
Both arms use the same fourteen prompts, accepted evidence headings, entry
identities, ranker, and threshold. The only arm difference is whether the
accepted compact disposition fields are available as retrieval text.

| Arm | Selected | Exact top-one |
| --- | ---: | ---: |
| Anchor headings only | 1/14 | 1/14 |
| Headings plus compact dispositions | 14/14 | 14/14 |

Removing disposition text reproduces the 1/14 heading result. Cyclically
rotating all expected identities yields 0/14 exact while leaving retrieval
unchanged. Changed prompt bytes fail before scoring. These controls support a
narrow claim: at this frozen boundary, the compact fields carry the lexical
information responsible for the thirteen additional exact selections.

## Contradiction and uncertainty

The prompt freeze blocks adapter-time prompt tuning, but it does not make the
questions independent. The same producer wrote the prompts from the accepted
limitations, and many questions closely paraphrase those exact fields. The
14/14 result therefore does not estimate retrieval on fresh wording, human
queries, protected selection, later use, token savings, changed decisions, or
whether omitted headings and operational timestamps can be deleted.

RV-036 remains mitigated medium/open and real compaction remains rejected.
RV-004 and RV-034 remain high/open at their protected later-outcome and
external-runtime boundaries; RV-038 remains medium/open. The next decisive
evidence is an independently authored prompt/scorer set or genuinely later
decision queries frozen before the candidate sees them. A local follow-up
should first quantify overlap with the older post-hoc navigation prompts so
near-duplicate wording is not mistaken for a new holdout.

## Validation and rollback

Focused validation passes five tests / seven assertions, TypeScript,
formatting, and whitespace. The full current-tip repository, seed projection,
scoped and broad links, navigation, health, clean-status, lineage, and
protected-checkout checks follow this documentation commit.

Rollback is dependency-ordered: revert the documentation checkpoint carrying
this report, then `6df152f717`, then prompt freeze `d5b9b3ff94`. This removes
only Cycle 415 artifacts and does not authorize reverting accepted reviewer
integration, deleting history, compacting evidence, moving local main, or
cleaning `/app`.

## Supervision

- Goal: Continuously turn Scout Knowledge Library's collected seeds, unresolved topic-map questions, and newly discovered evidence into the highest-value validated knowledge improvements, keeping the library and living topic map useful, current, traceable, and safely integrated into local main at reviewed release boundaries until the human explicitly stops or replaces this goal.
- Goal ID: "g_c1b31972-1674-47cb-96d8-c797d768010d"
- Worker: "goal-a2acd0ab0579d04f3d163e5db9a"
- Codex session: "01a05c5f-cb03-7760-9c42-893d669f7762"
- Pane: "w1:p6C"
