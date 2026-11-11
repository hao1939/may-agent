<ai_context>
summary: "An abstract-level analysis shows that agreement among screening agents establishes concurrence rather than correctness, while assessor acceptance estimates precision but cannot identify relevant items that every agent filtered out. Estimating recall requires judging a random sample from the rejected pool unless additional assumptions about agent dependence are justified."
triggers: ["multi-agent screening", "screening recall", "agent agreement", "rejected-item audit", "agentic search evaluation", "selection bias"]
last_updated: "2026-11-11"
source_basis: "arXiv:2611.12705v1 title, metadata, and abstract retrieved through the workflow-owned cs.AI feed request. Scout did not inspect the full paper, proofs, estimators, assumptions, examples, simulations, code, or supplementary material."
</ai_context>

# Multi-agent screening requires audit sampling

**Date:** 2026-11-11  
**Source:** [Multi-Agent Screening: What Agreement and Acceptance Cannot Tell You](https://arxiv.org/abs/2611.12705v1)  
**Source revision:** arXiv:2611.12705v1  
**Coverage:** Title, metadata, and abstract only  
**Disposition:** New knowledge

## Question

What can agreement among screening agents and human acceptance of passed items establish about screening quality, and what evidence is still needed to estimate recall?

## What the abstract reports

The paper considers systems where AI agents screen a larger item pool before a costly human assessor reviews the items they pass, including agentic search, e-discovery, and AI-assisted paper review. This creates a selective-observation problem: the assessor normally sees only passed items, so relevant items rejected by every agent remain unlabelled.

The abstract distinguishes several evidence levels:

- **Agent agreement** shows that agents made the same selection decision, not that the decision was correct. Adding more agreeing agents does not by itself resolve this.
- **Assessor acceptance among passed items** identifies precision, but supplies only a lower bound on recall because jointly missed relevant items are absent from the judged set.
- **Which agents found which relevant items** can support an upper bound on recall if agents' discoveries are not negatively correlated. If agents are interchangeable, the same evidence can bound how much one additional agent may add.
- **Randomly judging rejected items** is the assumption-light route to estimating how many relevant items the screen missed. The abstract states that the required sample size can be chosen for a target accuracy and does not grow with the number of agents.

## Scout interpretation

Multi-agent redundancy is not an evaluation denominator. A panel can agree perfectly while sharing the same blind spot, and high acceptance among forwarded items can coexist with poor coverage. This is especially important when an agent system reports only successful discoveries, accepted recommendations, merged patches, or items that survived an internal verifier: those observations characterize the selected subset, not the unobserved reject pool.

A useful evaluation design should therefore keep four quantities separate:

1. the full candidate inventory or a defensible sampling frame;
2. which agent passed or rejected each item;
3. assessor judgments for passed items; and
4. independent judgments for a random sample of items rejected by all agents.

The fourth quantity is the key recall audit. Without it, adding agents, voting, measuring agreement, or reporting human acceptance can improve confidence in the visible subset while leaving shared omissions unmeasured. Dependence assumptions may yield bounds, but they should be explicit and tested rather than inferred from the number of agents.

For May-like task or research routing, the implication is concrete: evaluation should sometimes sample work that no planner, screener, verifier, or specialist selected. Accepted outputs can estimate the quality of routed work, but only an audit of unselected candidates can reveal whether the routing layer systematically misses useful or required work. The sampling frame and rejection reasons should be retained so that the audit measures selection coverage rather than merely reviewing another hand-picked subset.

This finding complements [The Evaluation Mirage](../the-evaluation-mirage.md), which concerns low-information evaluation outputs. The present paper identifies a different failure: even accurate judgments can be structurally unable to measure recall when they are applied only after a screening gate.

## Retrieval record

The workflow-owned bounded request checked:

- **Endpoint:** `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
- **HTTP status:** 200
- **Latency:** 297 ms
- **Request count:** 1
- **Retry-After:** not present

## Evidence limits

Scout reviewed only the arXiv feed's title, metadata, and abstract. The full paper, formal identification results, proofs, definitions of interchangeability and negative correlation, sampling estimator, confidence intervals, finite-population corrections, examples, simulations, empirical datasets, code, and supplementary material were not inspected.

The abstract does not specify the rejected-pool prevalence regimes, desired error measure, confidence level, or exact sample-size formula behind the claim that audit sample size does not grow with the number of agents. It also does not establish that real screening agents satisfy the dependence assumptions needed for the proposed upper bounds. Random rejected-item auditing is therefore a sound evaluation direction from the abstract, not a fully specified deployment procedure.
