<ai_context>
summary: "Cycle 424 checks the five SwarmResearch heuristic rows omitted from the public $50 cutoff CSV. Their released trajectories preserve 95 public-evaluator scores across 125 transcripts, but retain no private-performance output or commit-cost binding, so the five paper values remain unbound rather than absent of all evidence."
triggers: ["Cycle 424", "SwarmResearch", "ALE-Bench-Lite", "AHC008", "AHC015", "AHC016", "AHC025", "AHC026", "$50 cutoff", "private performance"]
last_updated: "2026-09-08"
source_basis: "Exact canonical source 81f5d21ec55cf229cd94d4a7d57244a19ddb5b30; arXiv:2607.02807v1 evaluation.tex SHA-256 9bcf91e7e517842dca2e48f040c64768db80ff7764f524d0790af243c5f283de; SwarmResearch/swarmresearch-paper-reproduce e848d8d5760065714c38fa7558f0298573db17ab; cutoff CSV SHA-256 015c7d5c09ee9a0f80d7163037a93c3a89fe8f08a5039dab2562881260a50282; private_eval.py SHA-256 5ac56540292621b03c7c4eb87b20c3e34aaae1dbac74b4bf8bf32d92fbc7216c; five pinned history and transcript manifests in the Cycle 420 fixture."
</ai_context>

# Cycle 424: heuristic trajectories stop before paper-value attribution

## What was wrong and what changes

Cycle 420 accurately reported that the public `$50` cutoff CSV has no rows for
AHC008, AHC015, AHC016, AHC025, or AHC026. “Missing,” however, could be read
too broadly: the reproduction bundle does contain a trajectory directory for
each task.

This audit separates the evidence layers. The five directories retain public
50-case evaluator histories and agent transcripts. The paper values—1,304,
2,543, 2,138, 1,470, and 1,992—are a distinct ALE-Bench private-performance
metric averaged over three private evaluations. The bundle retains neither
those private outputs nor a mapping from a `$50` commit to a private result.
The rows are therefore trajectory-supported but cutoff-unbound; they are not
replayed paper cells.

## Bounded seed and queue reconciliation

Cycle 424 began from clean exact source
`81f5d21ec55cf229cd94d4a7d57244a19ddb5b30` at
`2026-09-08T04:13:48.485Z`. Cycle 422's direct observation through
`03:33:16.091Z` was about 41 minutes old, inside the six-hour cadence, so no
XHS request ran. Additions/changes remain unknown, removals remain `[]`, and
all 132 durable identities remain unavailable. No account state changed.

RV-004 remains highest consequence but requires a protected
query-to-selection-to-later-outcome join. RV-034 remains at the unchanged
external-runtime boundary recorded in Cycle 423. The highest accessible
primary-artifact gap was the five-row qualification left by the cutoff audit.
No GitHub, arXiv, Reddit, or other public request ran in this cycle.

## Matched artifact comparison

All observations below are source-bound to the retained reproduction revision.
No agent or evaluator was executed.

| Task | Paper private performance | History lines / scored commits | Transcript files | Retained private-performance scalars |
| --- | ---: | ---: | ---: | ---: |
| AHC008 | 1,304 | 52 / 24 | 26 | 0 |
| AHC015 | 2,543 | 50 / 20 | 26 | 0 |
| AHC016 | 2,138 | 26 / 15 | 21 | 0 |
| AHC025 | 1,470 | 36 / 14 | 26 | 0 |
| AHC026 | 1,992 | 43 / 22 | 26 | 0 |

The five compact histories contain 95 scored commit subjects. Their task
evaluators call `start_ale_bench_session(..., lite_version=True)`, evaluate 50
public cases, and emit a `combined_score`. That explains why the history scores
are raw task values rather than the paper's roughly Elo-like performance
numbers.

The separate retained `private_eval.py` calls
`ale_bench.start(..., lite_version=False)`, runs a supplied program three
times, and averages `private_performance` as `avg_private_performance`.
Across all 125 retained transcript files, neither `private_performance` nor
`avg_private_performance` occurs as a scalar. The cutoff CSV contains zero AHC
rows, and the private script accepts a program path rather than a historical
commit/cost identity. Its presence documents a possible evaluation procedure,
not a retained execution result.

## Decision and uncertainty

The five paper cells remain unsupported at the advertised `$50` boundary, but
the reason is now precise:

1. search trajectories and public evaluator scores are retained;
2. the historical `$50` commit selection is not retained for these tasks; and
3. the private-performance output behind the paper values is not retained or
   commit-bound.

Running the private script now would be a new evaluation, not replay of the
historical paper result, and still would not recover the omitted `$50` commit.
Confidence is high in the source hashes, directory/file counts, public/private
evaluator distinction, and absence of cutoff/private-result bindings. It is
low in which commit and private run produced each table value, private-run
variance, and whether an unpublished ledger would reconcile all five.

Cycle 420's aggregate classification remains nine compatible, one conflicting,
and five unbound. Decisive replacement evidence is an author-retained
five-row cutoff manifest naming commit, cost, private-evaluation input, three
private outputs, and aggregate value. RV-004/RV-034 remain high/open;
RV-036/RV-038 remain medium/open; RV-052 remains high/open and release-blocking.
No local-main movement, compaction, or cleanup is authorized.

## Validation and rollback

The existing cutoff fixture now pins each history hash, transcript manifest,
paper value, line/commit/file counts, evaluator contracts, and zero retained
private-performance scalars. The focused and full current-tip gates, links,
navigation, broad audit, read-only health, cleanliness, lineage, and protected
checkout fingerprints must pass at the committed checkpoint.

Rollback is one ordinary revert of the Cycle 424 material commit. It removes
only this qualification and its source-bound regression. It does not authorize
deleting retained artifacts, changing local main, cleaning `/app`, or reverting
the independently reviewable Cycle 423 checkpoint.

## Supervision

- Goal: Continuously turn Scout Knowledge Library's collected seeds, unresolved topic-map questions, and newly discovered evidence into the highest-value validated knowledge improvements, keeping the library and living topic map useful, current, traceable, and safely integrated into local main at reviewed release boundaries until the human explicitly stops or replaces this goal.
- Goal ID: "g_c1b31972-1674-47cb-96d8-c797d768010d"
- Worker: "goal-a2acd0ab0579d04f3d163e5db9a"
- Codex session: "01a05c5f-cb03-7760-9c42-893d669f7762"
- Pane: "w1:p6C"
