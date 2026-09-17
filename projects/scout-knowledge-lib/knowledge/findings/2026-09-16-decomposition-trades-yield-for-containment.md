<ai_context>
summary: "arXiv 2609.17464 models hierarchical agent research as lossy item retention and argues that decomposition cannot improve information yield at fixed task size under its power-law assumptions: every extra aggregation tier multiplies yield by measured retention and handoff factors. The paper's stronger operational lesson is conditional, not anti-delegation: use hierarchy for root-context containment or sufficiently large token-cost savings, measure carry-forward at each boundary, and adapt topology to observed load rather than choosing it only at startup."
triggers: ["decomposition yield", "hierarchical agents", "information retention", "aggregation loss", "delegation threshold", "root context integrity", "adaptive topology", "2609.17464"]
last_updated: "2026-09-16"
source_basis: "Full arXiv HTML and API abstract for 2609.17464v1 reviewed 2026-09-16. The empirical estimates combine one deep-research scaffold, coding-agent production traces, and MAST benchmark traces; the paper's own limitations are preserved below."
</ai_context>

# Agent decomposition trades information yield for containment and cost

**Date:** 2026-09-16  
**Disposition:** New knowledge  
**Source:** [Decomposition Buys Integrity, Not Yield (arXiv:2609.17464v1)](https://arxiv.org/abs/2609.17464v1)  
**Full text reviewed:** https://arxiv.org/html/2609.17464v1

## Question

When does splitting research across a hierarchy of agents preserve more useful
information than a flat agent, and what should determine the depth of that
hierarchy?

## What the paper claims

The paper models a decomposition as a tree. If an agent receives `b` items and
retains any one with probability `r(b)`, the number carried forward is
`rho(b) = b r(b)`. Under a power-law retention model
`r(b) = C b^-delta`, a uniform depth-`k` tree over `N` findings delivers

`Y = C^k N^(1-delta)`.

The task-size term is therefore independent of tree shape; depth adds only the
per-level factor `C`, which cannot exceed one. Adding a probability `mu` that a
delegated brief remains aligned changes the expression to
`Y = C^k mu^(k-1) N^(1-delta)`. Under those assumptions, smaller local contexts
do not recover the information lost at their aggregation boundaries. At fixed
`N`, a flat design maximizes yield unless the real retention curve has a
near-lossless plateau that violates the simple power-law shape.

The conservation result at `r(b)=1/b` is mathematical rather than empirical:
every tree delivers one finding regardless of size or shape. The authors report
checking it on 20,000 random irregular trees. Its practical role is to expose
the assumption behind topology claims: a beneficial topology must demonstrate
retention above this proportional-crowding baseline, not merely distribute work
across more agents.

## Evidence reported

The paper estimates its constants from several trace sets:

- On 600 deep-research traces spanning six public question-answering corpora,
  98,768 surfaced URLs become less likely to be used as the context is more
  crowded, even after stratifying by remaining extraction opportunities. The
  per-item hazard estimate is `delta = 0.341` with a cluster-bootstrap 95% CI of
  `[0.298, 0.384]`; final citation gives a similar estimate.
- At 16,082 individual search-to-next-turn hops, including 550 one-result hops,
  the measured single-item carry factor is `C = 0.571 [0.527, 0.615]`. This
  matters because `C` is observed at `b=1`, not extrapolated from large batches.
- From 1,012 usable MAST multi-agent traces, the paper estimates per-handoff
  alignment `mu = 0.939 [0.935, 0.960]`. With `C` and `mu` together, it estimates
  that two tiers retain 53.6% of the findings retained by a flat agent, three
  retain 28.7%, and four retain 15.4%.
- In 7,244 coding-agent sessions, 7.8% spawn a subagent and no deeper nesting is
  observed. A discrete-time hazard model using only pre-decision information
  finds that doubling accumulated context multiplies the odds of delegating at
  that round by 0.969 `[0.954, 0.985]`; delegation is mostly an opening choice,
  not a response to a filling context.

The paper does **not** conclude that hierarchy is useless. It assigns hierarchy
two other possible benefits. First, a tree limits how many items enter the
long-lived root context, containing persistent contamination in ephemeral
children. Second, shorter contexts may lower token cost. In the studied coding
sessions, flat-session input cost scales approximately as `N^1.39`, and the
paper's calibrated equal-spend model puts the two-tier crossover at 403
findings after charging handoff loss. Across measured parameter ranges, the
predicted fraction of sessions worth delegating is 0.7%–11.3%, broad enough to
contain the observed 7.8% but not to precisely predict it.

## Scout interpretation

The useful design unit is not **number of agents** but an **information
boundary**. Every boundary should have an observable numerator and denominator:
items available before aggregation, items represented afterward, required items
lost, and new unsupported claims introduced. Agent count or parallelism alone
cannot establish that decomposition improved coverage.

This also suggests three different reasons to delegate that should not share a
single success metric:

1. **Coverage delegation** seeks more distinct evidence and should be judged by
   unique validated findings that survive to the final artifact.
2. **Containment delegation** keeps uncertain or harmful intermediate state out
   of the persistent root and should be judged by exposure and propagation.
3. **Cost delegation** reduces context or latency cost and should be compared at
   equal budget, not equal numbers of initially discovered items.

A hierarchy can succeed on containment or cost while losing on coverage. Calling
that a generic multi-agent improvement hides the actual trade.

The hazard result points to a control implication: topology should be a
revisable runtime decision. A harness can start flat, observe context growth,
uncertainty, and measured carry-forward quality, then open a bounded child only
when a declared threshold is crossed. Choosing all roles in the first rounds
cannot adapt to the very load decomposition is supposed to manage.

## Evidence boundary and limitations

These conclusions are conditional on the paper's model and datasets. The
single-hop `C` treats a search result and a subagent report as the same kind of
item across levels, although the paper itself observes different immediate and
eventual decay exponents. The deep-research estimates come from one scaffold
and tool vocabulary, not multiple agent designs. Items the agent did not need
still count as unretained, so carry-forward is not identical to task-relevant
recall.

The `mu` estimate is identified mainly by handoff-count variation in one MAST
framework, and failing runs may generate extra handoffs; treating any
misalignment as total subtree loss is also pessimistic. The root-integrity model
treats one wrong item as total task failure, which the authors show badly
overpredicts delegation when visible tool-error rates are substituted for
silent contamination. The cost model omits latency and output tokens. Finally,
the 0.7%–11.3% predicted delegation range is an order-of-magnitude consistency
check, not validation that deployed systems optimize the proposed objective.

## Related library context

This finding complements [The Coordination Tax](../the-coordination-tax.md):
that note concerns planning overhead triggered by activity, while this paper
isolates a different tax—the loss of discovered information at aggregation and
briefing boundaries. Both argue for bounded, measured coordination, but their
mechanisms and metrics should remain separate.
