<ai_context>
summary: "LiveGeo evaluates agents in a geographic world whose external state changes over time, requiring them to acquire current evidence, check whether prior support remains valid, and revise plans. Its abstract reports that strong static performance does not ensure dynamic reliability; Scout did not inspect the full paper, platform, benchmark, tasks, histories, models, traces, or artifacts."
triggers: ["dynamic agent evaluation", "evidence revalidation", "evolving world", "LiveGeo", "GeoWorld", "2611.17267"]
last_updated: "2026-11-14"
source_basis: "arXiv:2611.17267v1 title, metadata, and abstract retrieved through the workflow-owned cs.AI feed request."
</ai_context>

# Dynamic agent evaluation needs evidence revalidation

**Date:** 2026-11-14  
**Source:** [LiveGeo: Benchmarking Geographic Agents in Continuously Evolving Worlds](https://arxiv.org/abs/2611.17267v1)  
**Source revision:** arXiv:2611.17267v1  
**Coverage:** Title, metadata, and abstract only  
**Disposition:** New knowledge

## Question

What must an agent evaluation preserve when task-relevant external facts can change after the agent has already gathered evidence or chosen a plan?

## What the abstract reports

The authors introduce GeoWorld, described as a controllable geographic environment grounded in real-world geographic structure. External world states evolve through their own temporal processes while the platform preserves verifiable state histories. LiveGeo places tasks in that environment and requires agents to:

1. actively acquire task-relevant information;
2. verify whether evidence supporting earlier decisions remains valid; and
3. revise plans when necessary.

The abstract says frontier LLMs struggle even on static tasks, no model consistently excels across tasks, and strong static performance does not ensure dynamic reliability. Its analysis identifies a bottleneck in acquiring relevant evidence, translating it into valid decisions, and maintaining decision correctness as the world changes.

## Scout interpretation

A dynamic benchmark should not score only the final answer against the final world state. That collapses distinct capabilities and can hide why an agent failed. A useful evaluation record should separate:

- **Observation time:** when each external fact was acquired and the world-state revision it described.
- **Decision support:** which observations supported each plan or action at the time it was chosen.
- **Invalidation:** what later state change made prior evidence stale, incomplete, or contradictory.
- **Revalidation behavior:** whether the agent noticed the change, refreshed the relevant evidence, and reconsidered the affected decision.
- **Revision quality:** whether the updated plan became correct without unnecessary churn in unaffected parts.
- **Final outcome:** whether the executed action was valid in the state that actually obtained.

This is stricter than periodically refreshing every source. The important unit is the dependency between a decision and its supporting evidence: a changing fact should reopen the decisions that depend on it, while unrelated changes should not force indiscriminate replanning. Preserved state histories can make that distinction auditable by showing what was knowable at each point rather than judging a past decision with hindsight-only facts.

For long-running agent runtimes, the paper's abstract supports a practical test shape: inject a controlled state change after an initially reasonable plan, retain the pre-change evidence and decision, then measure detection, targeted reacquisition, plan repair, and final execution separately. Static success remains useful, but it is not evidence that the same agent can maintain correctness across environmental drift.

This finding complements [Evidence freshness is not truth](./2026-11-13-evidence-freshness-is-not-truth.md): freshness or invalidation should route reconsideration, while a separate outcome or semantic check determines whether the revised decision is correct.

## Retrieval record

The workflow-owned bounded request checked:

- **Endpoint:** `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
- **HTTP status:** 200
- **Latency:** 436 ms
- **Request count:** 1
- **Retry-After:** not present

## Evidence limits

Scout reviewed only the arXiv feed's title, metadata, and abstract. The full paper, GeoWorld implementation, LiveGeo benchmark, geographic data sources, temporal processes, state-history guarantees, task set, static and dynamic splits, model list, prompts, tools, evidence interface, scoring, traces, per-task results, statistical analysis, failure taxonomy, code, and data were not inspected.

The abstract does not quantify the reported static or dynamic failures, define “dynamic reliability,” establish whether agents received explicit change notifications, or show that the geographic findings transfer to software repositories, markets, operations, or other evolving environments. It supports the evaluation requirement to test evidence validity and plan revision under change, not a claim that LiveGeo fully measures those capabilities or that geographic simulation is representative of every deployed agent.
