<ai_context>
summary: "Comparative Approaches to Agent Retrieval over Large Skill Libraries (arXiv 2608.06196) finds that a typed skill graph generated only from the same embedding top-K used by retrieval cannot extend retrieval reach. On one 690-skill corpus, 98.6% of typed pairs duplicated embedding-neighbour pairs; at a six-candidate budget, graph expansion scored 63.2% hit@5 versus 74.4% for additional ranked results. The transferable lesson is to make graph candidate generation independent of the retriever and to evaluate with non-echoing user queries."
triggers: ["2608.06196", "skill library retrieval", "pre-filter topology bound", "skill graph", "typed knowledge graph", "hybrid ranker", "non-echo queries", "graph candidate generation"]
last_updated: "2026-08-07"
source_basis: "arXiv v1 metadata, PDF, and TeX source for 2608.06196 retrieved from arXiv on 2026-08-07; source archive SHA-256 a909ac0f0ec8d002760073d53e0dac61ecd5900e7e1ef3f75cdd6fdf6026360d."
</ai_context>

# A Skill Graph Cannot Escape the Retriever That Chose Its Edges

Date: 2026-08-07
last_updated: 2026-08-07
Source: https://arxiv.org/abs/2608.06196
Source: https://export.arxiv.org/e-print/2608.06196
Tags: skill-retrieval, knowledge-graphs, agent-skills, evaluation, candidate-generation

## Finding

*Comparative Approaches to Agent Retrieval over Large Skill Libraries* compares sparse hybrid retrieval with a typed knowledge graph over one organization's skill library. The retrieval system combines BM25 and MiniLM similarity. The graph assigns relations such as `requires`, `precedes`, and `feeds_into`, but its LLM edge generator is shown only each skill's top-eight neighbours from the **same embedding model** used by retrieval.

That design imposes what the paper calls a **pre-filter topology bound**: the model can label an existing candidate pair, but it cannot connect two skills that the embedding shortlist never placed together.

The v1 source reports:

- The corpus contained **690 skills**; sparse loading used about **560 tokens per task**, versus **46,915** for loading all catalogue rows.
- On **117 non-echoing queries**, hybrid retrieval placed the expected skill in the top five **73.5%** of the time; indirect symptom-style queries scored **62.8%**.
- Of 1,022 distinct typed graph pairs, **1,008 (98.6%)** also appeared as embedding-neighbour pairs. Adding 1,421 typed edges connected no new nodes and merged no graph components.
- At a matched six-candidate budget, one ranked result plus graph neighbours scored **63.2%**, while six ranked results scored **74.4%**—an 11.2-point deficit (McNemar **p = 0.0007**).
- Among 30 queries missed by the six-result ranker, **73%** of targets were unreachable from the top-ranked entry within three graph hops.
- An author-written 37-query set inflated hit@5 by **44.2 points for BM25** and **21.1 points for hybrid retrieval**, even reversing the conclusion from a clear hybrid advantage to an apparent tie.

## Why it matters

Adding semantic structure does not make a retrieval channel independent when the structure's candidates come from that same channel. This is a general agent-infrastructure failure mode: an expensive LLM enrichment stage can appear to add reasoning while only annotating the retriever's existing blind spots.

The paper also separates two jobs that are often conflated:

1. **Entry retrieval:** Which skill matches this user request? Query-conditioned ranking has the stronger signal here.
2. **Workflow navigation:** Given a selected skill, what prerequisite or next skill should follow? Typed edges may still help, but this requires sequence-level evaluation and reliable directionality.

The distinction matters because the paper found **8.5% of distinct typed pairs structurally contradictory**, all involving direction disagreements. A wrong `precedes` or `requires` edge is not merely an irrelevant retrieval result; it can reverse an agent's workflow.

## Operational implication

For a growing agent skill registry:

- use sparse lexical+dense retrieval rather than injecting the whole catalogue;
- test retrieval with independently written, non-echoing requests, including indirect symptom descriptions;
- if adding a graph, generate candidate edges from signals independent of retrieval—observed co-use, declared dependencies, execution traces, or cross-modal evidence;
- report whether graph edges add new reachable nodes or only relabel nearest-neighbour pairs;
- evaluate retrieval and sequencing separately; and
- require direction-specific validation before exposing prerequisite or ordering edges to agents.

A useful audit metric is **novel-edge reach**: the fraction of graph edges and target skills that become reachable only because of the graph. If that value is near zero, the graph is enrichment metadata, not a retrieval expansion mechanism.

## Caveat

This is a single-corpus, single-organization study using one pinned embedding model and a 117-query primary evaluation. It measures expected-skill hit@5 rather than end-to-end task completion, does not measure latency, and indexes one-line skill descriptions rather than full skill bodies. The authors explicitly leave workflow sequencing untested. The result therefore supports a mechanism-specific warning—do not pre-filter graph edges with the retriever you hope to complement—not a universal claim that skill graphs are useless.
