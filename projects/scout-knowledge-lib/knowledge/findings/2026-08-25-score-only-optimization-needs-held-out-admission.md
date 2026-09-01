<ai_context>
This finding distinguishes reproducible optimization from generalization in score-only agent benchmarks. It is useful when designing model-improvement, search, or coding-agent evaluations in which an agent can repeatedly query a fixed scored suite.
</ai_context>

# Score-only optimization still needs held-out admission

Date: 2026-08-25
Repo: https://github.com/Trae1ounG/PostTrainBench0
Commit reviewed: https://github.com/Trae1ounG/PostTrainBench0/tree/89c892409f0d94707d1a3f2c3486c0752a824a94
Source: https://trae1oung.github.io/posttrainbench0/

## Signal

PostTrainBench⁰ turns model improvement into an inspectable long-horizon agent task: an agent gets an immutable base checkpoint, deterministic gradient-free candidate programs, score-only evaluation, and a four-hour/eight-worker budget. The trusted controller—not the agent—keeps the best complete seven-task candidate, reloads it in a fresh inference process, replays it, and audits the trace and isolation boundary.

This is a strong separation between **search authority** and **acceptance authority**. The published experiment reports that all 51 included complete runs found at least one candidate above the base checkpoint, with the strongest agent run reaching 53.19. It also exposes two evaluation effects that should not be collapsed into “the model improved”:

1. the selected score is the maximum over an adaptively chosen, run-dependent number of evaluations; and
2. search and final replay use the same fixed 200 examples for each of seven tasks.

The authors explicitly disclose both limitations: repeated settings span as much as 9.90 points; best-of-run rewards evaluation count as well as strategy quality; and held-out verification is not yet available.

## What fresh replay proves—and what it does not

The repository's [protocol](https://github.com/Trae1ounG/PostTrainBench0/blob/89c892409f0d94707d1a3f2c3486c0752a824a94/docs/PROTOCOL.md) reconstructs every candidate from the immutable base, admits only complete-suite candidates to the best-history ledger, then materializes and reloads the winner in a fresh one-GPU evaluator. Its [release tests](https://github.com/Trae1ounG/PostTrainBench0/blob/89c892409f0d94707d1a3f2c3486c0752a824a94/tests/test_release.py) check that subset evaluations cannot become the retained best and that best history is append-only.

That replay establishes valuable properties:

- the candidate denotes one independently loadable checkpoint rather than an ensemble;
- its measured score is reproducible outside the search process;
- the agent cannot promote a partial-suite score; and
- numeric acceptance can remain separate from the no-gradient/isolation audit.

But a fresh process is not fresh evidence. Replaying the same examples after hundreds of adaptive score queries confirms checkpoint identity and deterministic scoring; it does not estimate performance on unseen examples. Score-only access reduces label exposure, but the scores are still an optimization signal. An agent can adapt its seeds, scales, compositions, task subsets, and evaluation schedule to that fixed development surface.

## The throughput confound is part of the score

PostTrainBench⁰ keeps the highest completed full-suite score before the deadline. This correctly avoids losing a good checkpoint when a final command times out, but it also makes the endpoint an extreme statistic. One representative run disclosed by the article completed 402 full seven-task evaluations. If another run evaluates far fewer candidates, its lower maximum can reflect reduced experimental throughput even when candidate quality comes from the same distribution.

For an autonomous-search benchmark, throughput is a legitimate capability—but it is not the same construct as search selectivity or final-model generalization. A single leaderboard number hides all three.

## Reusable benchmark pattern

Use three evidence layers instead of treating replay as the final generalization gate:

1. **Adaptive development surface.** Let the agent query scores repeatedly, but preserve every candidate, task subset, cost, and decision in an append-only trace.
2. **One-shot held-out admission.** After the budget closes, evaluate the frozen selected checkpoint on an unseen, version-bound test set that was never exposed through per-task or aggregate feedback. Do not return this score to the same search episode.
3. **Fresh-instance replay.** Independently reload both development and held-out evaluations to prove artifact identity and scorer reproducibility.

Report at least four quantities separately:

- base-to-selected development gain;
- base-to-selected held-out gain with uncertainty;
- full and partial evaluation counts, wall time, and compute consumed; and
- search efficiency, such as gain versus evaluation-count/compute frontier.

To distinguish search policy from lottery volume, add matched-evaluation-count comparisons or a random-search baseline using the same candidate budget. To detect development adaptation, compare development and held-out deltas per task rather than only comparing their aggregate means.

## Takeaway

PostTrainBench⁰ demonstrates a valuable control-plane architecture: immutable inputs, narrow score feedback, trusted best retention, append-only attempts, artifact replay, and a separate compliance verdict. Its disclosed limitation yields the broader design rule: **artifact replay and held-out admission answer different questions**. Replay proves that the chosen artifact really earns the previously observed score; only unseen evidence can test whether adaptive optimization generalized beyond the surface that selected it.

## Tags

- agent-evaluation
- autonomous-search
- model-improvement
- held-out-testing
- adaptive-overfitting
- benchmark-validity
