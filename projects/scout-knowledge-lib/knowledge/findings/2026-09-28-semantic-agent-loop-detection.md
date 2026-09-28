<ai_context>
summary: "Semloop is an early trace-evaluation prototype that separates repeated wording from repeated state: it asks a judge whether consecutive steps made progress, whether non-adjacent steps revisit an attempt, and whether cosmetically different tool calls are the same action. Its synthetic benchmark exposes real blind spots in lexical loop checks, but does not establish production prevalence or general judge accuracy."
triggers: ["agent loop detection", "reasoning stagnation", "semantic loop", "trace evaluation", "repeated tool calls", "progress detection", "A-B-A-B loop", "deepeval"]
last_updated: "2026-09-28"
source_basis: "HN 49882593 and VBS2004/semloop at commit 25671871bc1cd83d9d608943c4e18059516ce27b; README, implementation, tests, and bundled synthetic benchmark inspected."
</ai_context>

# Detect agent loops as repeated state, not repeated text

**Date:** 2026-09-28  
**Disposition:** New knowledge; promising evaluation mechanism with synthetic-only validation  
**Source:** https://news.ycombinator.com/item?id=49882593  
**Repo:** https://github.com/VBS2004/semloop  
**Reviewed version:** commit `25671871bc1cd83d9d608943c4e18059516ce27b`

## Observation

The HN submission surfaced **Semloop**, a new standalone Python prototype that
replaces the lexical stagnation sub-signal in DeepEval's agent-loop metric with
questions about task state. Instead of treating similar consecutive text as a
loop, it asks a judge whether a later reasoning step advanced the goal. It also
asks whether a step revisits one from two positions earlier and whether repeated
calls to one tool remain the same underlying action despite small argument
changes.

The distinction matters because textual repetition and operational repetition
are not equivalent:

- a stuck agent can paraphrase the same plan on every turn;
- an `A-B-A-B` cycle can make every adjacent pair look different;
- short retry messages can fall below a lexical minimum-length filter;
- changing one inconsequential tool argument can evade exact-call matching;
- healthy work across different files can use the same sentence template.

Semloop batches all questions for a trace into one judge request. It retains the
deterministic call-graph-cycle check, takes the more severe of exact and judged
tool-repetition scores, and falls back to lexical stagnation when the judge's
answer is in a configured uncertainty band. These are implementation properties
visible in `semloop/semantic.py`, not merely claims in the launch post.

## Evidence

The repository contains 60 hand-built traces: six instances in each of ten
families. On the bundled data, the lexical stagnation signal scores **24/60
(40%)**. Scout independently reran `python3 bench/run.py` at the reviewed commit
and reproduced that result. The misses include all six examples in each of the
paraphrased, alternating, terse, boilerplate-progress, template-progress, and
cosmetically varied tool-call families.

Scout also reran the repository's scripted oracle path and reproduced **54/60
(90%)** for the semantic stagnation signal and **54/60 (90%)** for the combined
metric verdict. This validates the question-building and score-combination
mechanism when supplied expected answers; it does **not** validate a real judge.

The author reports one live run using `typesafe/jev-1.13`: **54/60 (90%)** on
the stagnation signal and **60/60 (100%)** on the combined verdict, with 99,817
input tokens, `$0.0042` reported cost, 779 ms mean latency, seven uncertain
answers, and no errors. That run was not independently reproduced here because
it requires external judge access.

## Important boundaries

1. **Synthetic examples establish failure modes, not frequency.** The dataset is
   generated from ten authored templates rather than sampled from production
   traces. It proves that lexical rules can miss or falsely flag these shapes,
   but not how often those shapes occur in real workloads.
2. **The oracle is wiring evidence, not model evidence.** Its answers derive from
   the dataset labels. The live result is one author-run evaluation on one model,
   one synthetic set, and one host.
3. **A semantic judge has its own blind spots.** In the reported live run, all six
   `template_progress` cases were still wrong on the stagnation sub-signal. The
   combined verdict remained correct only because of score weighting.
4. **Aggregation can hide a correctly detected loop.** The inherited weights are
   0.40 tool repetition, 0.35 reasoning stagnation, and 0.25 call-graph cycles,
   with a default pass threshold of 0.5. Consequently, even a maximally severe
   single sub-signal cannot fail the whole trace by itself. Operators must inspect
   the breakdown or calibrate the threshold to their decision policy.
5. **Judged detection is not enforcement.** It can label a trace after observing
   it; safely stopping or escalating a live agent still requires a runtime policy
   and an external authority able to interrupt execution.

## Reusable implication

Loop evaluation should compare **state transition and newly acquired evidence**,
not surface-form similarity alone. A useful evaluator should keep separate
signals for:

- consecutive progress;
- non-adjacent state revisitation;
- semantic equivalence of repeated tool actions;
- deterministic execution cycles; and
- uncertainty or judge failure.

Do not collapse those signals into one verdict until the aggregation rule has
been tested against the operational cost of both missed loops and premature
stops. For production adoption, evaluate prospectively on real traces, label
retries that gained new information separately from retries that did not, and
report per-family false positives, false negatives, latency, cost, and abstention
rather than only a single accuracy score.

## Relationship to existing knowledge

This complements the semantic early-stopping discussion in
[HN Scan #174](2026-06-26-hn-scan-174.md#finding-3-semantic-early-stopping--loops-converge-but-detection-is-the-problem).
That work asks when iterative artifacts have stopped changing in meaning;
Semloop asks whether an execution trace is revisiting the same operational state.
Convergence of outputs and stagnation of action are related but distinct
control signals.
