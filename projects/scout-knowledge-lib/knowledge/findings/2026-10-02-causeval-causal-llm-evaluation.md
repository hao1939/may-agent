<ai_context>
summary: "Causeval is an alpha DeepEval layer that packages repeated-measure uncertainty, three-valued non-inferiority gates, intervention-based RAG and agent attribution, judge audits, and provenance. Static inspection at b3c312c found useful evaluation contracts, but its live evidence is author-run and small, framework adapters are deferred, and Scout did not execute the package."
triggers: ["Causeval", "causal evaluation", "DeepEval", "three-valued gate", "counterfactual replay", "agent attribution", "judge audit", "prediction-powered inference"]
last_updated: "2026-10-02"
</ai_context>

# Causeval turns an LLM score into an intervention record, not just a larger metric table

**Date:** 2026-10-02  
**Disposition:** new knowledge  
**Coverage:** HN submission, repository README, complete repository tree, selected implementation, progress log, package metadata, and committed benchmark reports at pinned revision `b3c312c1b0a7ab707ff993325d3866a5b288b7bd`; static inspection only

## Observation

HN item 49930810 points to **Causeval**, an Apache-2.0, alpha Python package layered on DeepEval. Its useful contribution is not one new score. It keeps several questions separate that are often collapsed into “the eval passed”:

1. **Is an observed difference distinguishable from noise?** Experiments repeat metric measurements by item. Comparisons use paired uncertainty, and release gates return `pass`, `regression`, or `inconclusive` rather than converting an underpowered result into success.
2. **Did a component cause the behavior?** The RAG path removes or edits context and measures whether the answer follows the intervention. The agent path replaces one recorded step with an oracle step and re-runs both intervention and natural conditions from the same prefix.
3. **Is the judge a valid measurement instrument?** Separate modules probe order, verbosity, formatting, and authorship bias; calibrate against human labels; and support prediction-powered inference and selective abstention.
4. **Can a result be reconstructed?** Provenance records package and DeepEval versions, judge configuration, prompt hashes, a dataset hash, Git revision, and seed.

The implementation makes two boundaries especially concrete. First, a non-inferiority gate passes only when the confidence interval clears the allowed regression margin; a confidence interval crossing the margin is `inconclusive` with a distinct CLI exit code. Second, counterfactual agent replay does not silently invoke a novel side-effecting tool call: exact recorded calls replay, declared safe read-only calls may run live, and other novel calls require a simulator or explicit side-effect permission. Replay fidelity becomes `recorded`, `live`, or `simulated`, and a divergent prefix raises an error.

This extends the library's broader [agent evaluation patterns](../agent-evaluation.md): evaluation should preserve the **estimand, intervention, uncertainty, replay fidelity, and evidence provenance** as separate fields. A causal-sounding label is not enough. The intervention must be defined, its validity recorded, and simulated or live post-intervention behavior disclosed.

## Evidence and limits

Repository-authored offline benchmarks use synthetic data with known injected effects. Committed live reports are more limited and are not independent validation. For example, the live agent-attribution report says the earliest decisive step matched an injected wrong-argument fault in 4 of 5 valid tasks; one additional setup was marked invalid. The live RAG report in the README reports Counterfactual Adherence AUROC 0.833 on 12 items, below the repository's stated 0.9 target. These are useful diagnostic examples, not broad performance evidence.

Scout inspected selected source paths and committed artifacts but did **not** install dependencies, run tests, reproduce statistical coverage, invoke a model judge, or replay an agent. The package is version `0.0.1` and explicitly alpha. It constrains DeepEval to `>=4.2,<5`; framework adapters for LangGraph, OpenAI Agents, and Pydantic AI, an HTML report, and a pytest plugin are deferred. The progress log and live reports are repository-author claims. They do not establish that the methods remain calibrated on another dataset, judge, harness, or production environment.

## Relevance to agent systems

A bounded evaluation pilot could test two contracts independently:

- **Release decisions:** preserve `inconclusive` rather than treating “not proven worse” as pass; bind each comparison to task identity, repeated samples, paired outcomes, a declared margin, and family correction.
- **Failure diagnosis:** replay one failed tool trajectory with a pinned prefix and explicit tool-call fidelity, then ask whether replacing a step changes success. Keep diagnosis separate from permission to retry or deploy.

This is a qualification for investigation, not a recommendation to adopt the alpha package. Existing execution receipts and task acceptance evidence should remain authoritative; Causeval would be an experimental measurement layer, not a replacement control plane.

## Sources

- **Source:** https://news.ycombinator.com/item?id=49930810
- **HN API record:** https://hn.algolia.com/api/v1/items/49930810
- **Repo:** https://github.com/routsom/causeval
- **Pinned revision:** https://github.com/routsom/causeval/commit/b3c312c1b0a7ab707ff993325d3866a5b288b7bd
- **Primary inspected paths:** [README](https://github.com/routsom/causeval/blob/b3c312c1b0a7ab707ff993325d3866a5b288b7bd/README.md), [gate implementation](https://github.com/routsom/causeval/blob/b3c312c1b0a7ab707ff993325d3866a5b288b7bd/src/causeval/stats/gate.py), [provenance](https://github.com/routsom/causeval/blob/b3c312c1b0a7ab707ff993325d3866a5b288b7bd/src/causeval/core/provenance.py), [replay cassette](https://github.com/routsom/causeval/blob/b3c312c1b0a7ab707ff993325d3866a5b288b7bd/src/causeval/attribution/cassette.py), [progress and limitations](https://github.com/routsom/causeval/blob/b3c312c1b0a7ab707ff993325d3866a5b288b7bd/PROGRESS.md), and [live agent-attribution report](https://github.com/routsom/causeval/blob/b3c312c1b0a7ab707ff993325d3866a5b288b7bd/bench/results/b5_agent_attribution_live.md)
