<ai_context>
summary: "TokenCast models an agent run as composable execution segments whose local token use and context growth determine later reread cost, then refreshes the total forecast as segments complete. Its v1 abstract reports lower forecast error across 96 suite/model combinations and lower token use than a fixed-budget replay at matched trace completion, but the paper, code, datasets, comparators, and replay policy were not inspected."
triggers: ["TokenCast", "agent token forecasting", "token consumption prediction", "context growth cost", "execution segment cost", "agent budget control", "2609.35760"]
last_updated: "2026-09-29"
source_basis: "arXiv 2609.35760v1 metadata and abstract only, retrieved from the current arXiv API feed; full paper and linked code were not reviewed."
</ai_context>

# Forecast agent cost from context growth, not only completed-token totals

**Date:** 2026-09-29  
**Disposition:** New source-level signal; abstract-only assessment  
**Source:** https://arxiv.org/abs/2609.35760v1  
**Repo (declared by the abstract):** https://github.com/DEFENSE-SEU/TokenCast  
**Reviewed version:** arXiv v1 metadata and abstract

## Question

What current arXiv evidence offers a concrete way to forecast token consumption
while a tool-using LLM agent is still running?

## Source claims

The TokenCast abstract starts from two coupled sources of uncertainty: separate
runs of the same task can differ in token consumption by more than an order of
magnitude, and each new interaction enlarges the context that later model calls
must read again. A forecast based only on tokens already consumed therefore
misses the future cost introduced by earlier context growth.

The proposed representation records, for each execution segment, both its own
consumption and the context growth it contributes. Composing adjacent segments
produces a cumulative estimate that accounts for the extra input cost when
prior context is reread in later calls. The forecast is refreshed from observed
segments during execution and, according to the abstract, requires no additional
LLM calls.

The authors report three headline results:

- mean cumulative prediction time of **32.8 ms per run** on SWE-bench Verified;
- mean absolute-error reduction averaging **14.5%** against the strongest
  comparator over **96 combinations** of four task suites and six agent models;
  and
- in offline budget-control replay, **21.3% fewer tokens on average** than a
  fixed-budget policy at matched trace completion.

These are author-reported abstract results, not independently reproduced values.

## Scout interpretation

The reusable idea is to treat context growth as a **forward liability**. A
segment does not cost only the tokens used when it executes; it also increases
the input charged to each subsequent model call that retains that segment. This
makes the useful accounting unit a pair—local consumption plus induced future
reread cost—rather than a flat cumulative token counter.

That representation could support an adaptive budget controller with three
separate signals:

1. **spent:** tokens already consumed;
2. **committed:** estimated reread cost created by retained context; and
3. **remaining:** forecast cost of likely future segments, refreshed as the
   actual path unfolds.

A controller could then compact context, downshift a model, narrow a branch, or
request approval before the nominal cap is exhausted. This is more informative
than a fixed per-run ceiling, but the forecast should remain advisory unless the
system also defines which mechanism can authoritatively stop or reshape work.

This finding adds an execution-time mechanism to
[The Token Economics Trap](../the-token-economics-trap.md), whose predictability
problem previously emphasized variable session length, retries, context, and
tool fan-out. TokenCast suggests that some of that uncertainty can be revised
online rather than accepted as irreducible.

## Evidence limits and evaluation questions

This assessment covers only arXiv v1 metadata and abstract. Scout did not inspect
the full paper, linked repository, traces, implementation, task-suite makeup,
model identities, comparator definitions, pricing assumptions, or statistical
uncertainty. In particular:

- averaging error reduction across 96 combinations can hide regressions or
  poorly calibrated subgroups;
- “matched trace completion” does not by itself establish matched task quality;
- offline replay cannot show how budget interventions change a live agent's
  later decisions, retries, or outcome;
- a 32.8 ms mean does not disclose tail latency or instrumentation overhead;
- the abstract does not say how segments are defined, whether retained context
  is measured exactly, or how compaction and provider caching affect forecasts.

A production evaluation should report per-suite and per-model calibration,
absolute error and interval coverage at multiple points in the run, p50/p95
forecast overhead, completion quality, intervention frequency, and realized
provider-billed tokens. It should also compare online policies on repeated live
executions, because replaying a fixed trace cannot capture policy-induced path
changes.
