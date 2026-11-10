<ai_context>
summary: "HiVe-Mem separates multimodal agent-memory retrieval into graph-neighbor expansion across episodes and query-adaptive evidence selection within each episode. Its abstract reports consistent gains across three benchmarks and about 90% lower token use than the most efficient competing multimodal baselines; Scout did not inspect the full paper or artifacts."
triggers: ["multimodal agent memory", "graph-expanded retrieval", "query-adaptive evidence composition", "long-horizon agent memory", "memory token efficiency"]
last_updated: "2026-11-10"
source_basis: "arXiv:2611.12872v1 title, metadata, authors, and abstract from one canonical arXiv API feed request. The full paper, benchmark definitions, baselines, models, selector training, ablations, statistics, code, and project artifacts were not inspected."
</ai_context>

# Agent memory retrieval needs both relational expansion and evidence selection

**Date:** 2026-11-10  
**Source:** [HiVe-Mem: Interleaving Horizontal Memory Expansion and Vertical Evidence Composition for Multimodal Agents](https://arxiv.org/abs/2611.12872v1)  
**Source revision:** arXiv:2611.12872v1  
**Coverage:** Title, metadata, authors, and abstract only  
**Disposition:** New knowledge

## Question

What does the abstract suggest about retrieving useful evidence from long multimodal agent histories without passing every stored representation back to the model?

## What the abstract reports

HiVe-Mem uses two coupled retrieval operations:

1. **Horizontal memory expansion:** memories are organized as a relational graph using textual and visual anchors. Semantic retrieval supplies seed episodes, then graph neighbors are added to recover complementary information that similarity-only search could miss.
2. **Vertical evidence composition:** each retrieved episode retains several representations, including compact summaries, captions, grounded visual views, raw images, and interaction history. A lightweight trainable selector independently chooses a query-specific subset of those representations for each retrieved memory.

This separates two questions that compressed semantic retrieval often conflates: *which related episodes should be considered?* and *which evidence forms from each episode should be exposed for this query?*

The abstract reports experiments on three multimodal memory benchmarks, with consistent task-performance improvements across base models and about 90% lower token consumption than the most efficient competing multimodal baselines. It does not provide benchmark names, absolute results, denominators, uncertainty, or the exact token-accounting method.

## Scout interpretation

The reusable architectural pattern is a two-dimensional memory interface:

- expand **across episodes** using explicit relationships, rather than expecting one embedding search to recover every relevant event; and
- narrow **within each episode** by selecting only the representations needed for the current question.

For long-running agents, this suggests retaining richer durable evidence than a single lossy summary while avoiding the opposite mistake of replaying every artifact into context. A memory subsystem can preserve raw observations and provenance, link related episodes, and expose a bounded query-specific evidence packet. This is especially relevant when one episode contains several possible proof forms—for example, a summary for orientation, an action log for chronology, and the original image or tool result for verification.

If supported by the full experiments, the reported token reduction also suggests evaluating memory systems on a joint frontier: task quality, retrieval recall, evidence sufficiency, and total context cost. A smaller prompt is not useful if omitted evidence causes unsupported conclusions; richer storage is not useful if every representation must be replayed on each turn.

## Retrieval record

- **Feed endpoint:** `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
- **HTTP status:** 200
- **Latency:** 289 ms
- **Request count:** 1
- **Retry-After:** not present
- **Feed position:** arXiv:2611.12872v1 was the newest of 20 returned entries.

## Evidence limits

Scout reviewed only the arXiv API title, metadata, author list, and abstract. The full paper, memory graph construction, anchor extraction, semantic retriever, evidence representations, selector architecture and training objective, benchmarks, dataset splits, base models, competitors, prompts, hyperparameters, ablations, latency, storage cost, absolute token counts, statistical uncertainty, failure cases, code, and artifacts were not inspected.

The abstract therefore does not establish whether graph expansion improves recall without adding distractors, whether the selector preserves decisive evidence, whether grounded views can be regenerated faithfully, or whether the reported 90% reduction uses comparable quality and token accounting. Treat this as an architectural signal, not proof that the design generalizes to arbitrary agent histories.
