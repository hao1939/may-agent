<ai_context>
summary: "Cycle 416 reanalyzes Organizational Memory's retained Memory-versus-RAG outcomes as matched run/scenario labels. Both models improve in every run, but exact model-specific and cluster sensitivity checks do not pass a conventional 5% threshold, and public artifacts do not establish pair independence or shared randomness."
triggers: ["Cycle 416", "Organizational Memory", "2607.03228", "paired uncertainty", "McNemar", "run clustering"]
last_updated: "2026-09-05"
source_basis: "Exact canonical source 2bfc35ceec9e914dd64af8166dc5dda8c300c584; retained arXiv 2607.03228v1 source archive SHA-256 058b6a6d2d53aaff8846641479a8be45dadf1ff59602c80081d42078db3ef189; lukaskirchdorfer/org-memory-paper revision 11617e3191bf6307eea64476fcb1269b5ca3fb78 archive SHA-256 7e183ab73192b2ed748723147a544dc509ff1064543f09b5bedb39bbda8f6e7a; eight sorted metrics manifest SHA-256 be97df9f73649e324e5fabf8eb7e98176f75f04a1f3ff7905a14779cfd01eb0f; scenarios.yaml SHA-256 29a5d26caa1b791c8e54705e2d49c771fbeb91930ea81ba22384138820b0ba51; evaluate.py SHA-256 49e2c08cedbc80672836cc2597dfdf1a4a43e653aa9af49a9e4ff5187cf248d9."
</ai_context>

# Cycle 416: Organizational Memory paired-uncertainty audit

## What changes for the reader

The earlier finding correctly reproduced the aggregate scores but left
"paired uncertainty" as an open limitation. The released per-scenario records
support a narrower follow-up: pair Memory and RAG by the same model, run label,
and scenario label, then test whether the observed advantage is robust to the
unit chosen for uncertainty.

The direction is encouraging, not decisive. Memory beats RAG in each of the
four retained runs for both models. None of the model-specific exact checks
below passes a conventional 5% threshold, and the public artifact does not
document seeds, shared random draws, or an independence design.

## Seed and source boundary

The bounded reconciliation ran at `2026-09-05T08:15:48.771Z`, about 34 minutes
after the Cycle 414 observation through `2026-09-05T07:41:57.756Z` and before
the six-hour XHS boundary at `2026-09-05T13:41:57.756Z`. It therefore made zero
XHS, GitHub, arXiv, or Reddit requests. Added and changed XHS identities remain
unknown, observed removals remain `[]`, and all 132 durable identities remain
unavailable. No account state changed.

No newer accepted reviewer result was visible. Reviewer result
`8f5b1a46665d6618b45624bdf8ae38a56875bb86` remains an exact canonical
ancestor, with its Cycle 413 disposition recorded by `d3a8a06186`.

All analysis used the already retained goal-owned archive. The exact source,
repository, metrics-manifest, scenario, and evaluator hashes are in this
report's context block.

## Matched outcomes

The scoring unit is the retained boolean `pcr_pass`. For each model, the
aggregate matched table over four runs by ten scenarios is:

| Model | Memory only | RAG only | Both correct | Both wrong | Difference |
| --- | ---: | ---: | ---: | ---: | ---: |
| GPT-4.1 | 12 | 5 | 23 | 0 | +7/40 (+17.5 points) |
| Sonnet 4.5 | 8 | 2 | 30 | 0 | +6/40 (+15 points) |

An exact two-sided McNemar calculation conditions on the discordant count
`n=b+c` and uses
`min(1, 2 * sum[k=0..min(b,c)] choose(n,k) / 2^n)`. It returns
`p=0.143463134765625` for GPT and `p=0.109375` for Sonnet. Those values are
descriptive unless the 40 run/scenario pairs can be treated as independent;
the ten scenarios are repeated across four runs and the artifact provides no
dependence model.

The run-level view preserves complete runs:

| Model | Run 1 | Run 2 | Run 3 | Run 4 | Exact two-sided sign test |
| --- | ---: | ---: | ---: | ---: | ---: |
| GPT-4.1 | +2/10 | +2/10 | +2/10 | +1/10 | `p=0.125` |
| Sonnet 4.5 | +2/10 | +2/10 | +1/10 | +1/10 | `p=0.125` |

Every run points in the same direction, but four positive signs cannot reach
5% in a two-sided exact sign test. A complementary scenario-cluster view is
weaker still: GPT has 3 positive, 3 negative, and 4 tied scenario totals;
Sonnet has 3 positive, 2 negative, and 5 tied totals. Dropping ties, the exact
two-sided sign value is `p=1` for both models. This collapse discards
magnitude and is conservative, but it exposes sensitivity to treating the ten
fixed scenarios—not forty repeated labels—as the independent units.

The signs are auditable rather than aggregate-only: GPT is positive on
`s01,s06,s08`, negative on `s04,s05,s09`, and tied elsewhere; Sonnet is
positive on `s01,s03,s06`, negative on `s07,s09`, and tied elsewhere.

## Disposition and uncertainty

The retained evidence supports a qualified directional conclusion: structured
Memory beats document RAG in all eight model/run comparisons on this frozen
fixture. It does not support a precise population effect, a conventional 5%
model-specific claim, or a claim that the same advantage survives new
scenarios, independent seeds, reason-aware refusal scoring, or a released
generation pipeline.

The pairing itself is by shared run/scenario labels. It is not proof of shared
randomness. No confidence intervals or significance analysis appear in the
paper source, which says the preliminary result should be interpreted with
caution. The previous governance, lifecycle, proprietary-generation, and
refusal-rationale limits remain unchanged.

Confidence is high in retained label arithmetic and the exact tests as
defined; moderate in the repeated positive direction for this fixture; and low
in inferential generalization beyond these ten scenarios and four undocumented
runs. Revisit on independent scenario sampling, documented seeds or dependence
structure, reason-aware retained scores, more runs, or a released generator.

## Validation and rollback

Validation must cover the exact committed documentation tip: repository gate,
seed projection, scoped and broad links, navigation, read-only health, clean
status, accepted-result containment, and protected `/app` fingerprints.

Rollback is one ordinary revert of the Cycle 416 documentation commit. It
removes only this qualification and does not authorize result deletion,
compaction, local-main movement, or cleanup.

## Supervision

- Goal: Continuously turn Scout Knowledge Library's collected seeds, unresolved topic-map questions, and newly discovered evidence into the highest-value validated knowledge improvements, keeping the library and living topic map useful, current, traceable, and safely integrated into local main at reviewed release boundaries until the human explicitly stops or replaces this goal.
- Goal ID: "g_c1b31972-1674-47cb-96d8-c797d768010d"
- Worker: "goal-a2acd0ab0579d04f3d163e5db9a"
- Codex session: "01a05c5f-cb03-7760-9c42-893d669f7762"
- Pane: "w1:p6C"
