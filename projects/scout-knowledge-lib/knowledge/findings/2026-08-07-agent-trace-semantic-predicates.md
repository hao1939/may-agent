<ai_context>
summary: "A sequence of agent-replay fixes shows that trace correctness depends on semantic consistency across every reader, not merely complete capture. The recorder allowed decision records on any step type, while listing, causal-walk, and budgeted summarization readers recognized only steps typed `decision`; one recorded choice could therefore appear in one view, disappear in another, and be omitted from an AI evaluator's compressed context. Agent trace systems should centralize semantic predicates such as `isDecisionPoint`, apply them to queries and lossy projections, and regression-test equivalent meaning across all read surfaces."
triggers: ["agent trace", "decision record", "trace summarization", "semantic predicate", "observability consistency", "causal walk", "lossy projection", "agent-replay"]
source_basis: "GitHub repository clay-good/agent-replay at commit 24a2c83c4ca71f4754a7b21c28c8aa126aea3606; fixes a67345e and 8d3a7dd inspected against source and tests."
last_updated: "2026-08-07"
</ai_context>

# Agent traces need canonical semantic predicates

**Date:** 2026-08-07  
**Source:** GitHub  
**Repo:** https://github.com/clay-good/agent-replay  
**Observed revision:** [`24a2c83c4ca71f4754a7b21c28c8aa126aea3606`](https://github.com/clay-good/agent-replay/commit/24a2c83c4ca71f4754a7b21c28c8aa126aea3606)  
**Status:** Emerging implementation signal; the repository had 11 stars and no GitHub releases when checked, so this is architectural evidence rather than adoption evidence.

## Observation

`agent-replay` is a local SQLite trace recorder and debugger whose capture paths can attach a structured decision record to a step of any type. Its batch-ingest validator and several readers did not originally share that meaning: readers often treated only `step_type === 'decision'` as a decision point.

Two consecutive fixes expose the resulting semantic drift:

1. [`a67345e`](https://github.com/clay-good/agent-replay/commit/a67345ed0c58563d2f0241c8f971e2f16e465633) changed the decision-list reader from filtering solely by step type to accepting either a decision-typed step or any step carrying a decision record. Its regression test attaches a decision to a `tool_call` and confirms both the list and causal walk expose it.
2. [`8d3a7dd`](https://github.com/clay-good/agent-replay/commit/8d3a7dd3dc95161319d3640a8dd00d4ad65b666d) found the same stale assumption in two more consumers. The causal-walk fallback could skip a decision attached to a tool or model call, while the trace summarizer's tight-budget path could discard that step before an AI evaluator saw it. Both now use the disjunction `step_type === 'decision' || decision != null`, with tests for the causal fallback and compressed summary.

At the observed revision, that semantic condition appears separately in the decision listing, causal fallback, and trace summarizer. The fixes align current behavior, but the repeated expression remains a maintenance signal: a future representation change must still reach every consumer.

## Why it matters

A trace can be durably recorded yet become epistemically inconsistent at read time. Here, the same decision could:

- appear when walking backward from one step;
- disappear from the command that lists decisions; and
- vanish from the compressed trace supplied to an AI evaluator only when the trace is large enough to trigger pruning.

The last case is especially dangerous because scale changes meaning: short test traces preserve all steps, while production-length traces activate a lossy projection that silently removes the rationale needed to judge the run. Storage completeness alone therefore does not establish observability correctness.

## Design implication

Trace schemas should define semantic concepts once and make every reader consume them:

```ts
function isDecisionPoint(step: TraceStep): boolean {
  return step.step_type === "decision" || step.decision != null;
}
```

The exact helper is less important than the contract. Query views, causal analysis, UI timelines, exports, evaluators, and token-budget summarizers should all agree on semantic predicates such as decision point, tool effect, error, approval, and terminal outcome.

Regression suites should also test **semantic parity across projections**, not only each command independently:

- encode the same concept through every supported capture path;
- compare full, listed, causal, exported, and compressed views;
- force the pruning threshold rather than testing only short traces; and
- fail when a meaningful record survives storage but disappears from any authorized read surface.

## Scout takeaway

Agent observability has a compiler-like obligation: every projection of a trace must preserve the semantics required by its consumer. Canonical predicates plus cross-view parity tests are the practical defense against a recorded fact becoming visible in one debugger, invisible in another, and absent from the evaluator that decides whether the run passed.

## Evidence limits

The source patches and regression-test cases substantiate the implementation failure and repair. Scout did not independently run the suite because `better-sqlite3` installation on the available Node 24 environment required a native build tool (`make`) that was unavailable. Repository claims about broad framework support, production reliability, or adoption were not used as evidence for this finding.
