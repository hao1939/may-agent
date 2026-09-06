<ai_context>
summary: "Cycle 420 checks SwarmResearch's public $50 cutoff ledger against its paper table. Nine of fifteen cells are compatible after released score transforms, Third-Autocorrelation conflicts, and all five heuristic tasks lack cutoff rows; the bundle therefore does not substantiate the complete $50 table."
triggers: ["Cycle 420", "SwarmResearch", "2607.02807", "$50 cutoff", "Third-Autocorrelation", "result selection"]
last_updated: "2026-09-06"
source_basis: "Exact producer source b5b714d976bd1b4725cf459d5bab3182f8669c22 and retained interrupted evidence commit 1668e158c6907cd3aacf8c01d9751bfc669930f2; arXiv 2607.02807v1 source archive SHA-256 f428c409e96626675be636eff92eb48e6ca7d6ccd0f69d967669687b61349929 and evaluation.tex SHA-256 9bcf91e7e517842dca2e48f040c64768db80ff7764f524d0790af243c5f283de; SwarmResearch/swarmresearch-paper-reproduce revision e848d8d5760065714c38fa7558f0298573db17ab, cutoff README SHA-256 96e0dd6bcdc90391953b204c47b411ab10e4f1a21ce00e5e819cd05cdcd524ff, ten-row cutoff CSV SHA-256 015c7d5c09ee9a0f80d7163037a93c3a89fe8f08a5039dab2562881260a50282, Third-Autocorrelation history SHA-256 bfbb791126c26ce2b3e8ab47a5b65f46c4777f69634d24012bbb79560beda75b, and evaluator SHA-256 3fb1c3a1e881435b7b8ea663fc69d1a811b58fd16c5b81f1711b19a4cca62287."
</ai_context>

# Cycle 420: SwarmResearch `$50` cutoff audit

## What was wrong and what changes

The public SwarmResearch reproduction bundle was described as extensive
trajectory evidence, but Scout had not checked whether its designated `$50`
cutoff ledger actually supports the complete fifteen-task paper table. It does
not. Nine non-heuristic rows are compatible after the released score
transformations; Third-Autocorrelation conflicts, and the five heuristic tasks
have no cutoff rows.

This narrows the artifact claim without rejecting the reported system. The
bundle supports partial result selection and extensive trajectory inspection;
it does not currently replay the complete `$50` comparison.

## Seed reconciliation and selection

The bounded Cycle 420 observation ended at
`2026-09-06T02:05:21.407Z`. Direct localhost failed with curl exit 7 / HTTP
000. One public status read kept Explore ready with 30 notes; one
non-navigating saved-status read returned HTTP 200, final class `profile`, a
login wall, 103,020 bytes, target SHA
`e860da46506d774eced62830a670ea284f5150429482f8003c706bc6b006906e`,
access fingerprint
`74a9cdb73d2f8b37e8888154a2f2a67761178f8a6f64cd20e1fc384965cc2e44`,
body SHA
`7a5b5602c14ffe53e3874d525084aaa95a62391335ad24e5686c5ecfe685c44b`,
and zero attributable items. Added/changed identities remain unknown, observed
removals remain `[]`, and all 132 durable identities remain unavailable. No
feed, search, detail, or account-mutating action ran.

RV-004 remains highest but inaccessible without a protected query/rank,
selection, and later-outcome join. RV-034 remains behind the external runtime;
RV-036/RV-038 require genuinely independent later use or outcome evidence.
The next accessible substantive gap was whether SwarmResearch's retained
reproduction repository maps its paper table to the advertised `$50` cutoff.

## Method

The reproduction README says runs continued to about `$100` per task but the
paper reports the solution at `$50`, recorded in
`closest_50usd_commit_cutoffs.csv`. The CSV contains ten rows: five math and
five systems tasks. It contains no row for the five AHC heuristic tasks.

The fixture copies the ten `best_score_at_closest_cutoff` values and all
fifteen paper task identities. It applies only released evaluator transforms:

- direct comparison for seven tasks;
- `benchmark / combined_score` for MMD-14-3 and Third-Autocorrelation; and
- `1 / combined_score - 1` for Cloudcast.

Compatibility uses rounding intervals from the exact decimal strings on both
sides rather than demanding unavailable precision from rounded CSV values.
The fixture and test are producer-authored after artifact inspection. They are
post-hoc regression evidence, not a protected selection or independent replay.

## Result

| Classification | Tasks | Evidence |
| --- | ---: | --- |
| Cutoff-compatible | 9 | Circle Packing, Signal Processing, Erdos Min Overlap, MMD-14-3, EPLB, LLM-SQL, Txn Scheduling, Cloudcast, PRISM |
| Cutoff-incompatible | 1 | Third-Autocorrelation |
| No cutoff row | 5 | AHC008, AHC015, AHC016, AHC025, AHC026 |

For Third-Autocorrelation, the cutoff CSV names best commit `3180635` at cost
`$39.756658` with score `0.9985`; the closest-to-`$50` commit is `0552cd2` at
`$48.280899` with score `0.9971`. Using the released benchmark constant
`1.4556427953745406`, cutoff best implies:

`1.4556427953745406 / 0.9985 = 1.4578295396840666`.

The paper instead reports `C3=1.45649`, which implies score
`0.9994183244475008`. The retained history contains later commit `f018f27`
with score `0.99942`, and its transcript records `C3≈1.45649`. Neither the CSV
nor retained history assigns an exact cumulative dollar cost to that commit.
Because the authors' designated cutoff ledger does not select it, the public
bundle does not establish that the paper value belongs to the `$50` boundary.

The discrepancy does not prove overspending. The cutoff CSV could be wrong,
concurrent cost attribution could require an unretained rule, or the paper may
use another selection artifact. It does show that the current public evidence
cannot support all three claims at once: the designated cutoff ledger, the
paper's Third-Autocorrelation value, and complete `$50` table provenance.

## Provenance, confidence, and rollback

The primary artifacts were independently re-fetched at the pinned identities
and reproduced the hashes in `source_basis`. Retained interruption commit
`1668e158c6907cd3aacf8c01d9751bfc669930f2` supplied recovery provenance, but
was not merged or cherry-picked; this batch rechecked and adapted only the
useful evidence. Confidence is high in file identities, decimal-interval
arithmetic, and the 9/1/5 classification. Confidence is low about whether the
defect lies in the paper, cutoff ledger, or an unretained selection transform.

The decisive next evidence is an exact per-commit cost ledger or an
author-supplied table-to-commit manifest covering all fifteen tasks. Without
that, move to another primary claim whose released artifact can change a
decision rather than repeat internal score conversions.

Rollback this Cycle 420 commit only. It makes no local-main movement,
compaction, cleanup, provider behavior, or runtime-performance claim.

## Supervision

- Goal: Continuously turn Scout Knowledge Library's collected seeds, unresolved topic-map questions, and newly discovered evidence into the highest-value validated knowledge improvements, keeping the library and living topic map useful, current, traceable, and safely integrated into local main at reviewed release boundaries until the human explicitly stops or replaces this goal.
- Goal ID: "g_c1b31972-1674-47cb-96d8-c797d768010d"
- Worker: "goal-a2acd0ab0579d04f3d163e5db9a"
- Codex session: "01a05c5f-cb03-7760-9c42-893d669f7762"
- Pane: "w1:p6C"
