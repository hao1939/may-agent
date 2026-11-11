<ai_context>
summary: "A producer-authored C++ coding-agent study reports equal solved-run counts for ByteAsk and Codex CLI on the same model while ByteAsk used materially fewer model tokens and estimated API dollars. The result supports measuring build-aware localization as an efficiency intervention, but repository preparation was excluded from run time and the comparison bundles context, first-turn retrieval, and targeted checking. A later default-branch revision removed the released run records and arithmetic reproducer, showing that evaluation claims also need durable, pinned evidence bundles."
triggers: ["ByteAsk", "build-aware context", "C++ coding agent", "agent preprocessing cost", "context indexing amortization", "targeted checking", "agent efficiency accounting", "benchmark artifact drift"]
last_updated: "2026-11-11"
source_basis: "HN items 50434555 and 50448569, the complete four-page ByteAsk preprint, and static inspection of ByteAsk/byteask-system-cpp at the earlier evidence-bearing commit 67b4001686762a5ff65b0f9a5baffc07661b8766 and current default-branch commit 5de888c32fdd811e197bd9fb62dd003108843555. Scout reran the earlier revision's arithmetic-only reproduction script, but did not rerun agents, graders, builds, tests, indexing, billing, or hidden-task preparation."
</ai_context>

# Build-Aware Context Can Shift Coding-Agent Cost Outside the Model Loop

**Date:** 2026-11-10  
**Source:** https://news.ycombinator.com/item?id=50434555  
**Article:** https://byteask.ai/research/byteask-system-cpp  
**Repo:** https://github.com/ByteAsk/byteask-system-cpp  
**Inspected revision:** [`67b4001686762a5ff65b0f9a5baffc07661b8766`](https://github.com/ByteAsk/byteask-system-cpp/tree/67b4001686762a5ff65b0f9a5baffc07661b8766)

## Observation

ByteAsk's producer-authored study compares two C++ coding-agent systems using
GPT-6.1 Sol at medium effort: Codex CLI 0.164.0 and ByteAsk, whose context engine
uses the configured build to identify likely edit locations, related code, and
covering tests before the model begins. ByteAsk then performs a targeted check
rather than defaulting to a whole-project build and test loop.

Across the two main task sets, each arm reportedly fixed 129 of 144 paired runs.
The reported resource difference was large: ByteAsk used 78.0% fewer tokens and
68.1% lower estimated API cost in the pooled result. The held-out popular-project
set contained 23 tasks and 46 paired runs; the little-known-project set contained
49 tasks and 98 paired runs. The earlier evidence-bearing repository revision's run records also report lower
ByteAsk token use in 143 of 144 pooled pairs and lower estimated cost in all 144.

Scout downloaded those pinned run records and executed that revision's
standard-library `reproduce.py`. It reported that all 74 expected table and figure
values matched the checked-in records. This verifies the published arithmetic
against the producer's released JSONL, not the truth or independence of the
underlying trials, grading, token records, or prices.

## Current-source update: the default branch no longer carries the run records

A second HN submission, item 50448569, points to a revised article and PDF plus
current default-branch commit `5de888c32fdd811e197bd9fb62dd003108843555`.
The headline efficacy and cost figures remain the same. The current repository
still publishes the 72-task inventory, Harbor arm wrappers, a runner, and a
script for scoring a reader's own jobs. It no longer contains the earlier
`data/fastpath/runs.jsonl`, `expected.json`, `reproduce.py`, or `reproduce.sh`.
The earlier evidence-bearing commit remains addressable by hash, but it is not
in the current default-branch history returned by the repository API.

This changes the present reproducibility surface. A reader arriving through the
new HN item can inspect the task definitions and execution wrapper, but cannot
recompute the paper's published tables from current checked-in run records. The
current paper also says its 95% intervals are in the repository, while the
current nine-file tree contains no interval data or analysis artifact. This is
not evidence that the reported trials are wrong; it is evidence that benchmark
verification depends on retaining the exact source revision and that a live
repository URL is not a durable substitute for a pinned result bundle.

## Reusable finding: report the cost moved out of the loop

The study is useful evidence that build-aware localization and targeted checks
can reduce model-loop search, reading, and repeated build activity. It is not an
end-to-end cost comparison of isolated components.

The paper says Context prepared each repository before the runs and explicitly
excludes that preparation time from run time. The ByteAsk arm also bundles at
least three interventions: pre-model localization, further build-aware queries,
and targeted checking. Consequently, the observed savings do not identify which
component caused the reduction, and the published API-cost figures do not answer
whether indexing and maintenance pay back for a one-off task, a long-lived
repository, or a changing build configuration.

Evaluations of context systems that move work outside the model loop should
therefore report two ledgers:

1. **Model-loop goodput:** solved tasks, tokens, model calls, wall time, and cost
   after context is ready.
2. **Context-system goodput:** initial indexing, build extraction, refresh work,
   storage and service cost, cache invalidation, failed preparation, and the
   number of later tasks over which those costs are amortized.

A component ablation should additionally separate localization, sibling-code
retrieval, test selection, and targeted execution. Without that separation, the
result supports the bundled system and its accounting boundary, not a causal
claim that any single context technique delivers the full saving.

## Evidence boundaries

This is producer-authored preprint evidence from ByteAsk's founders and a public
artifact repository whose current default branch has a narrower evidence surface
than the earlier pinned revision. The task list exposes repository identities and
base commits, while the downloadable task bundle is 5.2 GB. Scout read both HN
items, the complete current four-page preprint, article, current README, agent
wrappers, scoring script, task table, current tree, and the earlier revision's
expected values, reproduction code, and run records. Scout did not download the
full task bundle, inspect every task's hidden tests or solution, rerun either
agent, execute builds or graders, validate model or harness configuration,
reproduce Context preparation, verify service costs, audit billing, or calculate
the paper's confidence intervals independently. The hard set used a later Context
build and only five tasks. Equal aggregate solved-run counts also do not establish
equivalent fixes or quality on each task.

## Primary evidence

- [HN item 50434555](https://news.ycombinator.com/item?id=50434555)
- [HN item 50448569](https://news.ycombinator.com/item?id=50448569)
- [Current complete preprint](https://byteask.ai/papers/byteask-system-cpp-2026-11.pdf?v=11)
- [Current pinned repository README](https://github.com/ByteAsk/byteask-system-cpp/blob/5de888c32fdd811e197bd9fb62dd003108843555/README.md)
- [Current pinned task inventory](https://github.com/ByteAsk/byteask-system-cpp/blob/5de888c32fdd811e197bd9fb62dd003108843555/tasks.tsv)
- [Current pinned scoring script](https://github.com/ByteAsk/byteask-system-cpp/blob/5de888c32fdd811e197bd9fb62dd003108843555/score.py)
- [Earlier pinned reproduction script](https://github.com/ByteAsk/byteask-system-cpp/blob/67b4001686762a5ff65b0f9a5baffc07661b8766/reproduce.py)
- [Earlier pinned run records](https://github.com/ByteAsk/byteask-system-cpp/blob/67b4001686762a5ff65b0f9a5baffc07661b8766/data/fastpath/runs.jsonl)

## Related Scout knowledge

- [Coding-agent efficiency needs goodput metrics, not token totals](./2026-11-08-coding-agent-efficiency-needs-goodput-metrics.md)
- [Harness benchmarks need separate quality and cost resolution verdicts](./2026-11-10-harness-benchmarks-separate-quality-cost-resolution.md)
- [Agent Evaluation Patterns](../agent-evaluation.md)
