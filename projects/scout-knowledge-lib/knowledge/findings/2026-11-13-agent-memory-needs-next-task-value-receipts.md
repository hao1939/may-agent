<ai_context>
summary: "CoReMem values coding-agent memory by counterfactual performance on the unknown next repository task while charging writing, reading, and acting costs. Its abstract reports higher resolve rate with fewer steps and cache-aware tokens after prospective segment valuation and provenance-gated actor adaptation; Scout did not inspect the full paper, benchmark, implementation, trajectories, ablations, or statistical analysis."
triggers: ["coding agent memory", "memory value", "next-task counterfactual", "prospective segment valuation", "CoReMem", "ChainSWE", "2611.17316"]
last_updated: "2026-11-13"
source_basis: "arXiv:2611.17316v1 title, metadata, and abstract retrieved through the workflow-owned cs.AI feed request."
</ai_context>

# Agent memory needs next-task value receipts

**Date:** 2026-11-13  
**Source:** [CoReMem: Cost-Internalizing Memory for Successive Coding Tasks with Prospective Valuation](https://arxiv.org/abs/2611.17316v1)  
**Source revision:** arXiv:2611.17316v1  
**Coverage:** Title, metadata, and abstract only  
**Disposition:** New knowledge

## Question

How should a coding-agent system decide which parts of one task deserve durable memory when the next task is not yet known and memory itself has writing, reading, and action costs?

## What the abstract reports

CoReMem frames coding-repository memory as an investment whose value must be measured on a later task. A coding agent completes successive tasks against an evolving repository, leaves edits behind, and writes memory before it knows the next assignment. The framework therefore evaluates candidate memory segments using counterfactual runs of the next task from the same inherited repository state, comparing runs with and without each segment.

The abstract says the compact memory is organized around **anchors**: repository locations and executable checks. It also describes actor adaptation using rollout groups with and without memory. The reward prioritizes successful resolution and penalizes step count in successful runs. An additional memory-value term is credited only to steps identified as using memory-supplied anchors, while all steps retain ordinary outcome credit.

On ChainSWE, the authors report that CoReMem increased a 27B actor's resolve rate from **21.0% to 25.7%**, while using **17% fewer steps** and **11% fewer total cache-aware tokens**, including memory-module calls, relative to the untrained actor without memory.

## Scout interpretation

Memory quality should not be inferred from whether a summary looks useful, whether it was retrieved, or whether the next agent cited it. The stronger receipt is a counterfactual improvement on later work from a matched repository state, with memory production and consumption included in the cost denominator.

For an agent runtime, the abstract suggests separating at least four measurements:

1. **Write cost:** tokens, model calls, and latency used to produce durable memory.
2. **Read cost:** retrieval, injection, and cache-aware context cost paid by later tasks.
3. **Use attribution:** whether later actions actually depended on a memory-supplied repository location, command, test, or other anchor.
4. **Next-task consequence:** whether the memory changed resolution, steps, tokens, or errors compared with a matched run without that memory.

This distinction matters because a memory can be accurate yet net-negative: it may repeat repository-visible facts, consume context, misdirect search, or save fewer steps than it costs to write and read. Conversely, a compact location-plus-check anchor can be valuable without retelling the whole trajectory. Durable memory admission should therefore favor evidence that is expensive to rediscover, remains valid after repository evolution, and can be revalidated through a concrete check.

A practical implementation should not copy the paper's reported credit assignment uncritically. Memory-use attribution can be confounded by correlated context and by an agent mentioning an anchor without relying on it. Receipts should retain the originating task and repository revision, the inherited state used by the comparison, the exact memory bytes, retrieval decision, observed anchor use, validation result, and later-task outcome. Stale or failed checks should demote the memory rather than silently preserving its prior value estimate.

This complements [Agent findings need a lossless side ledger across context compaction](./2026-11-13-agent-findings-need-a-lossless-side-ledger.md), which concerns preserving decision-bearing evidence during one run. CoReMem addresses a different question: which retained evidence pays for itself on unknown future repository tasks.

## Retrieval record

The workflow-owned bounded request checked:

- **Endpoint:** `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
- **HTTP status:** 200
- **Latency:** 870 ms
- **Request count:** 1
- **Retry-After:** not present

## Evidence limits

Scout reviewed only the arXiv feed's title, metadata, and abstract. The full paper, CoReMem implementation, ChainSWE task construction, 27B actor, baseline training, memory writer, segment boundaries, counterfactual protocol, anchor-use detector, provenance gate, reward design, cache accounting, trajectories, per-task results, variance, statistical tests, failure cases, ablations, code, and data were not inspected.

The reported comparison is against an untrained actor without memory; the abstract does not establish how CoReMem compares with simpler summaries, repository search, documentation, retrieval-only memory, or equal-budget alternatives. It also does not show that the same value estimates transfer across repositories, models, task distributions, or repository drift. The results support a promising evaluation pattern—price memory by later-task consequences—not a general proof that this particular memory design is optimal or that every retained anchor caused the reported gains.
