<ai_context>
summary: "Market-based post-training jointly learns swarm action and participation policies through bids and local credit; the abstract reports gains and adaptation, scaling, and dropout signals, but supplies no inspected mechanism details, budgets, trajectories, or full results."
triggers: ["market-based post-training", "MPT", "self-orchestration", "decentralized agent swarms", "agent bidding", "participation policy", "agent dropout"]
last_updated: "2026-10-16"
source_basis: "Complete arXiv:2610.22322v1 abstract and feed metadata from one workflow-owned cs.AI newest-20 request; no full paper, code, models, tasks, prompts, trajectories, evaluator, or reproduction was inspected."
</ai_context>

# Decentralized agent training can make participation a learned policy

**Date:** 2026-10-16  
**Disposition:** New knowledge  
**Coverage:** Complete abstract and feed metadata; no full-paper reading, code inspection, artifact audit, or reproduction  
**Source:** [Learning Self-Orchestration in Decentralized Agent Swarms, arXiv:2610.22322v1](https://arxiv.org/abs/2610.22322v1)  
**Source revision:** 2610.22322v1 (submitted 2026-10-15)  
**Repo:** [Embodied-Minds-Lab/MPT](https://github.com/Embodied-Minds-Lab/MPT)

## Question

Can a decentralized agent swarm learn both what each member does and which members should participate, rather than inheriting a fixed orchestration structure?

## Source observation

The supplied arXiv abstract introduces market-based post-training (MPT), a framework that jointly learns action policies and self-orchestration. Agents emit bids expressing willingness to participate; those bids determine who acts and how collective outcomes produce local training credit. The authors say this trains both action and bidding behavior without a central coordinating agent.

The abstract reports evaluations on embodied crafting, robot navigation, and deep research. It says MPT improves over monolithic post-training, that participation patterns change during learning, and that learned orchestration outperforms alternative coordination strategies when action policies are held fixed. It further claims faster adaptation to related tasks, better performance with larger inference-time populations, and smaller losses under agent dropout. No numerical effect sizes, uncertainty, budgets, or per-domain results appear in the abstract.

## Interpretation

The notable shift is to treat **participation as part of the policy**, not as static workflow configuration. An agent's capability and its learned estimate of when that capability is useful can co-adapt. This is stronger than simply adding more agents or routing by a fixed role label: the orchestration decision itself is trained from outcomes.

For runtime design, this suggests separating at least four records:

1. the action an agent proposes or performs;
2. its bid or participation preference;
3. the allocator's resulting selection;
4. the collective outcome and local credit assigned afterward.

Without those separations, a reported improvement cannot distinguish better individual actions from better participation, favorable population size, or a changed credit rule. A learned bid also should not be mistaken for authority: willingness to act is a ranking signal, while admission, ownership, budget, and effect permissions remain external control-plane decisions.

The abstract's scaling and dropout claims are especially relevant as evaluation dimensions. A swarm can be tested not only at its training population size, but also under added members, missing members, and shifted tasks. Those tests can reveal whether the learned participation policy transfers or merely overfits one roster. They do not, from the abstract alone, establish cost efficiency, safe decentralization, or robustness to strategic or correlated failures.

## Relation to existing Scout knowledge

Scout's [multi-agent coordination note](../multi-agent-coordination.md) distinguishes hierarchy, flat peer systems, and marketplaces, and warns that agent-count gains are not automatically compute-efficiency gains. MPT adds a distinct training hypothesis: marketplace-like participation and action competence may be learned together. It does not replace the note's runtime requirements for durable identity, authority, delivery evidence, conflict handling, or cost-normalized evaluation.

## Retrieval evidence

The workflow made exactly one canonical request to `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`. It returned HTTP 200 in 411 ms with request count 1. No `Retry-After` value was available. This record uses only the complete abstract and feed metadata returned in that packet.

## Limitations

- The full paper was not read, so the bidding mechanism, selection rule, local-credit construction, training procedure, communication protocol, and decentralization boundary were not checked.
- The abstract provides no sample counts, effect sizes, uncertainty, compute or token budgets, inference cost, communication volume, population sizes, dropout rates, or per-domain results.
- It is unclear from the inspected material whether comparisons equalize model calls, total compute, training data, wall time, or population size.
- “Without a central coordinating agent” does not establish the absence of centralized training, shared reward computation, common state, or privileged evaluators.
- Learned bids may encode capability matching, confidence, redundancy, or benchmark shortcuts; no bid calibration or causal interpretation was inspected.
- The scaling, transfer, and dropout results are author claims from the abstract. Scout did not inspect or run the released code or models, examine trajectories, or reproduce any result.
- Embodied crafting, robot navigation, and deep research do not by themselves establish transfer to software delivery, safety-critical operations, heterogeneous model providers, adversarial peers, or permissioned production systems.

## Relevance

A bounded May-style evaluation could log declared willingness, selection, admitted authority, action, cost, and outcome separately, then compare fixed routing with learned or adaptive participation under matched budgets. Population growth, member dropout, and task shift should be explicit test axes. This is an evaluation hypothesis, not evidence that May should adopt MPT or let model-generated bids grant authority.
