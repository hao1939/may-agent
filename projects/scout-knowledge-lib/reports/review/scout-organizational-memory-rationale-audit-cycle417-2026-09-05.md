<ai_context>
summary: "Cycle 417 freezes a non-LLM seven-case rationale rubric before reading Organizational Memory outputs. Exact lexical qualification lowers both Memory and RAG scores; Memory remains ahead, but the matched evidence weakens and lexical misses cannot be promoted to semantic errors."
triggers: ["Cycle 417", "Organizational Memory", "2607.03228", "refusal rationale", "frozen rubric", "lexical lower bound"]
last_updated: "2026-09-05"
source_basis: "Exact Cycle 416 source 8e2ec62d1924d3c0e5eed6e771fdf0b44e895272; pre-inspection rubric commit 1142999e7439edc226aad1f223aee392c4b3ca05 and rubric SHA-256 4bc31bfb4d42518d5cec8d4d687cc7208205f5a7134f8a948dc9599562bf9615; lukaskirchdorfer/org-memory-paper revision 11617e3191bf6307eea64476fcb1269b5ca3fb78 archive SHA-256 7e183ab73192b2ed748723147a544dc509ff1064543f09b5bedb39bbda8f6e7a; 160 sorted standalone result manifest SHA-256 c828e2de5ae64e014d81166ff940665db83388e805cb94a25b97d87eb930e317; eight metrics manifest SHA-256 be97df9f73649e324e5fabf8eb7e98176f75f04a1f3ff7905a14779cfd01eb0f."
</ai_context>

# Cycle 417: Organizational Memory refusal-rationale audit

## What changes for the reader

The public evaluator awards every correct binary refusal without checking its
reason unless an unavailable external LLM judge is enabled. Cycle 417 asks a
smaller question using only retained evidence: does the Memory-versus-RAG
direction survive a frozen, non-LLM requirement that refusal text contain the
author-grounded concepts selected for each refusal scenario?

It does, but more weakly. Both conditions lose many binary passes under the
strict lexical screen. Memory remains ahead by six GPT decisions and five
Sonnet decisions, while exact matched values move farther from a conventional
5% threshold. The result does not label every miss semantically incorrect.

## Seed, review, and freeze order

The bounded seed reconciliation was recorded at
`2026-09-05T08:21:53.319Z`, about forty minutes after the Cycle 414 observation
through `2026-09-05T07:41:57.756Z` and before the six-hour boundary at
`2026-09-05T13:41:57.756Z`. It made zero XHS, GitHub, arXiv, or Reddit requests.
Added and changed XHS identities remain unknown, observed removals remain
`[]`, and all 132 durable identities remain unavailable. No account state
changed.

No independent review result newer than exact integrated `8f5b1a4666` was
visible. Cycle 416 therefore remained unreviewed but clean and fully validated.

Rubric commit `1142999e7439edc226aad1f223aee392c4b3ca05` is the direct child
of Cycle 416 result `8e2ec62d1924d3c0e5eed6e771fdf0b44e895272`. It pins seven
refusal scenarios and exact source/result identities before this worker opened
any retained `final_response` value. The rubric SHA-256 is
`4bc31bfb4d42518d5cec8d4d687cc7208205f5a7134f8a948dc9599562bf9615`.

## Method and matched control

Both Memory and RAG use the same rubric. Text is NFKC-normalized, lowercased,
converted to ASCII alphanumeric tokens by replacing other characters with
spaces, and phrase-matched at token boundaries. A refusal rationale passes
only if at least one frozen alias appears for every required concept group.
Create scenarios retain the public evaluator's field-aware PCR result.

The first inline application accidentally double-escaped Unicode character
classes and produced unusable normalization. That output was discarded before
any response body was opened. The corrected ASCII normalization above changed
no frozen alias or evidence identity. Because the normalization code itself
was not precommitted, this is a frozen-rubric result rather than a fully frozen
scorer.

The matched baseline is document RAG at the same model, run label, and scenario
label. All 160 RAG/Memory standalone records and all eight metric files are
bound by the manifest hashes in this report's context block.

## Results

| Model and condition | Binary PCR | Frozen-rationale qualified | Rationale coverage among 28 refusal records |
| --- | ---: | ---: | ---: |
| GPT-4.1 Memory | 35/40 | 27/40 | 18/28 |
| GPT-4.1 RAG | 28/40 | 21/40 | 13/28 |
| Sonnet 4.5 Memory | 38/40 | 29/40 | 18/28 |
| Sonnet 4.5 RAG | 32/40 | 24/40 | 13/28 |

Qualified GPT discordance is 10 Memory-only, 4 RAG-only, 17 both, and 9
neither; exact two-sided McNemar is `p=0.1795654296875`. Its run differences
are `+3,+2,+1,0`; after dropping the tie, exact two-sided sign is `p=0.25`.

Qualified Sonnet discordance is 10 Memory-only, 5 RAG-only, 19 both, and 6
neither; exact two-sided McNemar is `p=0.3017578125`. Its run differences are
`+2,+1,+1,+1`; exact two-sided sign remains `p=0.125`.

The direction therefore survives the same frozen screen, but the evidence is
weaker than binary PCR and weaker than Cycle 416's paired binary analysis.

## What the screen does not prove

The rubric intentionally requires all selected concepts. Some misses are
meaningful: several responses refuse for an unselected policy or mention only
one of multiple annotated requirements. Others are conservative false
negatives. For example, a response saying "maximum allowed stock level" can
miss a frozen group containing "stock limit" and "maximum per closet" despite
describing the same threshold. Scenario `s05` also omits a cost center even
though its selected ground-truth rationale emphasizes MOQ and emergency
continuity, so a cost-center refusal may be valid while failing this rubric.

The 18/28 and 13/28 coverage counts are therefore exact lexical lower bounds,
not semantic correctness estimates. They do establish that binary non-creation
alone cannot substantiate the paper's stronger rationale language. They do
not justify replacing the missing independent reason judge, changing scenario
ground truth after seeing outputs, or claiming that Memory loses its observed
advantage.

Confidence is high in source identity, freeze order, manifest identity, counts,
and exact arithmetic; moderate in the claim that the screen exposes rationale
under-specification; and low in any semantic error rate or generalization
beyond the ten fixed scenarios. The proprietary generator, absent seeds,
governance, lifecycle, deployment, and cost limits remain unchanged.

## Validation and rollback

Validation must cover both commits and the exact final documentation tip:
focused fixture integrity, repository gate, seed projection, scoped/broad
links, navigation, read-only health, clean status, reviewer containment, and
protected `/app` fingerprints.

Rollback the final Cycle 417 documentation commit first, then rubric freeze
`1142999e74`. Neither rollback authorizes result deletion, local-main movement,
compaction, or cleanup.

## Supervision

- Goal: Continuously turn Scout Knowledge Library's collected seeds, unresolved topic-map questions, and newly discovered evidence into the highest-value validated knowledge improvements, keeping the library and living topic map useful, current, traceable, and safely integrated into local main at reviewed release boundaries until the human explicitly stops or replaces this goal.
- Goal ID: "g_c1b31972-1674-47cb-96d8-c797d768010d"
- Worker: "goal-a2acd0ab0579d04f3d163e5db9a"
- Codex session: "01a05c5f-cb03-7760-9c42-893d669f7762"
- Pane: "w1:p6C"
