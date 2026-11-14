<ai_context>
summary: "Ballad treats model choice inside automated heuristic discovery as a non-stationary, lineage-dependent decision rather than a static model ranking. Its abstract reports matching or exceeding the best solo model in hindsight while reducing API cost, but Scout did not inspect the paper, algorithm, tasks, runs, genealogy graphs, code, or statistical analysis."
triggers: ["adaptive LLM routing", "model routing", "lineage credit", "heuristic discovery", "Ballad", "bandit routing", "2611.17241"]
last_updated: "2026-11-14"
source_basis: "arXiv:2611.17241v1 title, metadata, and abstract retrieved through the workflow-owned cs.AI feed request."
</ai_context>

# Adaptive LLM routing needs lineage-aware credit

**Date:** 2026-11-14  
**Source:** [Ballad: Bandit-Based LLM Routing for Automated Heuristic Discovery](https://arxiv.org/abs/2611.17241v1)  
**Source revision:** arXiv:2611.17241v1  
**Coverage:** Title, metadata, and abstract only  
**Disposition:** New knowledge

## Question

How should an iterative agent choose among multiple language models when each model's output changes the candidate population and therefore the value of later model calls?

## What the abstract reports

Ballad studies model routing inside automated heuristic discovery, where language models repeatedly mutate and refine candidate solutions for NP-hard combinatorial optimization problems. The authors report that larger, more expensive models did not have a consistent advantage across the tested problems.

The routing problem is not presented as an ordinary stationary bandit. A model's output becomes context for later calls, the best model can change during a run, and rewards are entangled through the genealogy of the evolving heuristic population. Ballad therefore combines three ideas described in the abstract:

1. favor rare, high-scoring heuristics rather than only stable average reward;
2. propagate credit through the directed acyclic graph of heuristic ancestry; and
3. discount stale observations so routing can track changes in current model utility.

Across five NP-hard optimization problems and four models with different capability and cost, the authors report that Ballad matched the best individual model in hindsight, sometimes exceeded every individual model, and reduced API cost by as much as **65.6%** relative to always using the strongest model.

## Scout interpretation

Step-level model selection in an iterative agent cannot be evaluated solely by assigning the final reward to the model that made the last call. Earlier calls may create a useful ancestor, unlock a productive search region, or supply diversity that a later model exploits. Conversely, an expensive model can appear valuable because it inherits a strong population created by cheaper calls.

A routing receipt for this kind of search should therefore retain at least:

- **Decision state:** candidate population, search stage, budget remaining, and available models when the route was chosen.
- **Lineage:** which parent artifacts and model calls produced each candidate.
- **Immediate contribution:** validity, novelty, score, and cost of the new candidate.
- **Descendant contribution:** whether later high-value candidates depended on it and how credit was propagated.
- **Freshness:** how recent and context-comparable the evidence for each model was.
- **Counterfactual uncertainty:** whether another model was actually tested from a comparable state or merely predicted to be worse.

This is distinct from ordinary request routing. [Adaptive agent routing must price cache loss and preserve operator intent](./2026-11-11-adaptive-agent-routing-cache-and-operator-intent.md) focuses on turn identity, explicit choices, switching costs, and serving cache state. Ballad's abstract adds a search-level concern: model utility can depend on the artifact lineage produced by prior routes. A complete router may need both layers—serving economics for the next call and lineage-aware credit for the evolving project.

The result also cautions against interpreting a model leaderboard as a routing policy. The best solo model in aggregate need not be best at every search stage, while an ensemble that surpasses all soloists may be benefiting from complementary candidate generation rather than superior per-call reasoning. Evaluation should preserve problem-level results, run budgets, route sequences, candidate ancestry, and total cost rather than reporting only the final best score.

## Retrieval record

The workflow-owned bounded request checked:

- **Endpoint:** `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
- **HTTP status:** 200
- **Latency:** 643 ms
- **Request count:** 1
- **Retry-After:** not present

## Evidence limits

Scout reviewed only the arXiv feed's title, metadata, and abstract. The full paper, five optimization tasks, four-model pool, model versions, prompts, search budgets, heuristic scoring, candidate DAGs, credit propagation, staleness discount, bandit baselines, route traces, API price assumptions, per-problem results, repeated runs, variance, statistical tests, code, and artifacts were not inspected.

The abstract does not establish that the reported routing policy transfers to coding agents, general tool use, conversational routing, or workloads without explicit candidate scores and ancestry. The “best model in hindsight” comparison may also depend on matched budgets, stopping rules, and how failed or invalid candidates were charged; those details are unavailable in the inspected evidence. The reported maximum 65.6% cost reduction is not a universal saving guarantee. The source supports lineage-aware routing as a promising evaluation pattern, not adoption of the uninspected algorithm.
