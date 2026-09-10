<ai_context>
summary: "Cycle 419 compares the producer-authored Cycle 415 provenance prompts with the older producer-authored post-hoc navigation-v3 prompts. Exact topic pairs share far more normalized vocabulary than cyclic mismatches, but only five pairs clear the existing top-one ranker, so the evidence shows topic contamination rather than duplicate wording or independent retrieval."
triggers: ["Cycle 419", "RV-036", "provenance retrieval", "prompt overlap", "post-hoc navigation", "contamination control"]
last_updated: "2026-09-05"
source_basis: "Exact clean canonical source 3b0607c90d9f722a0bf72c39fba55f3377faae79; Cycle 415 prompt commit d5b9b3ff943c3c2446bfb50e91e4163ec291e88b and SHA-256 d86a0173e94fb1ca281ade40d49ddfe974e02e3973eb242aeed8d536b05023d5; final navigation-v3 prompt commit 3fd5c82a8412e279e65e2ccf3ace5456d6af4b7d and SHA-256 cc5ab71b0ff5fe354abd5494fea35cb355a8b59b6827ac4e6b7308ddf7721324; existing Scout tokenizer/ranker and explicit producer-authored fourteen-topic mapping."
</ai_context>

# Cycle 419 provenance-prompt overlap audit

## What changes for the reader

Cycle 415 froze fourteen decision-shaped prompts before its retrieval adapter,
but the same producer wrote those prompts after an older post-hoc navigation-v3
set had already named the same fourteen evidence topics. Calling the newer set
"held out" could therefore mistake temporal separation from the adapter for
independence from earlier question design.

Cycle 419 binds both existing prompt files to their exact commits and digests,
aligns their fourteen topics through an explicit producer-authored mapping, and
uses the already accepted Scout tokenizer and ranker. It adds no new prompt,
source claim, evidence deletion, or compaction candidate.

## Seed and integration boundary

The bounded reconciliation ran at `2026-09-05T08:48:15.990Z`, about 66 minutes
after the Cycle 414 XHS observation through `2026-09-05T07:41:57.756Z` and well
inside the six-hour cadence. It made zero XHS, GitHub, arXiv, or Reddit
requests. Added and changed XHS identities remain unknown, observed removals
remain `[]`, all 132 durable identities remain unavailable, and no account
state changed.

Read-only ref inventory found no accepted reviewer result beyond exact
integrated Cycle 413 result `8f5b1a46665d6618b45624bdf8ae38a56875bb86`.
Cycles 414–417 form the clean canonical line through source `3b0607c90d`.
Interrupted Cycle 418 remains preserved separately at `1668e158c6907cd3aacf8c01d9751bfc669930f2`
and none of its cutoff-ledger notes, fixture, or claims enters this audit.

## Matched comparison

Both sets contain fourteen prompts for the same accepted Cycle 373–386 topics.
Their public titles differ, so alignment is not inferred from fuzzy strings or
array order: the implementation exposes one explicit producer mapping from
each compact-record entry ID to one navigation-v3 case ID and rejects missing,
duplicate, or non-available cases.

The existing NFKD/stemmed tokenizer gives these aggregate results:

| Comparison | Result |
| --- | ---: |
| Explicitly aligned topic pairs | 14 |
| Shared normalized tokens across aligned pairs | 43 |
| Mean aligned Jaccard overlap | 0.1712 |
| Mean coverage of the shorter query | 0.4533 |
| Aligned v3 query selected at exact top one | 5/14 |
| Shared tokens under the strongest of 13 cyclic mismatch controls | 4 |

The aligned total is therefore much larger than any length- and set-preserving
cyclic mismatch, but lexical similarity is uneven. Several pairs share only
one topic token and do not meet the ranker's two-token/25% admission threshold.
The exact 5/14 top-one result contradicts a claim that the two prompt sets are
near duplicates; the 43-versus-at-most-4 control contradicts treating their
topic wording as independent.

## Conclusion and uncertainty

Cycle 415 remains useful as an adapter-time tuning control, and its 14/14
candidate-versus-1/14 heading result remains exact. It is not an independent
retrieval evaluation. The older v3 questions and the newer prompts were both
producer-authored around the same fourteen accepted evidence topics, and the
explicit alignment itself is producer judgment.

Confidence is high in file identity, token arithmetic, the exposed mapping,
and the cyclic controls; moderate that the measured overlap captures meaningful
topic contamination; and low for human-query transfer. This result supplies no
protected query, selection, later use, token saving, changed decision, or proof
that omitted headings and timestamps are dispensable. `RV-036` remains
medium/open and real compaction remains rejected. `RV-004` and `RV-034` remain
high/open; `RV-038` remains medium/open.

The next decisive evidence is independently authored wording/scoring or a
genuinely later decision query whose author did not see either producer set.
Do not tune another producer prompt set and call it a holdout.

## Validation and rollback

Focused validation covers both pinned prompt digests, one-to-one mapping,
aligned totals, all cyclic mismatch totals, and the existing retrieval
controls. The full current-tip repository, seed projection, scoped/broad links,
navigation, read-only health, clean status, accepted-result containment, and
protected `/app` fingerprints must pass at the final checkpoint.

Rollback is one ordinary revert of the Cycle 419 checkpoint. It removes only
this overlap audit and its deterministic output; it does not authorize
reverting Cycles 414–417, importing interrupted Cycle 418, deleting history,
moving local main, or cleaning `/app`.

## Supervision

- Goal: Continuously turn Scout Knowledge Library's collected seeds, unresolved topic-map questions, and newly discovered evidence into the highest-value validated knowledge improvements, keeping the library and living topic map useful, current, traceable, and safely integrated into local main at reviewed release boundaries until the human explicitly stops or replaces this goal.
- Goal ID: "g_c1b31972-1674-47cb-96d8-c797d768010d"
- Worker: "goal-a2acd0ab0579d04f3d163e5db9a"
- Codex session: "01a05c5f-cb03-7760-9c42-893d669f7762"
- Pane: "w1:p6C"
