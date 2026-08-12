<ai_context>
summary: "MERIT tests causal cross-query repair memory in Text-to-SQL. Earlier finalized corrections improve a frozen agent over stateless repair on Spider, but the gain is weaker on BIRD; elaborate polarity and hard error-type routing are not reliably better than untyped retrieval. The clearest ablation is locality: excluding same-database memories costs 0.93 points on Spider and 2.74 on BIRD, suggesting that repair memory should retain environment identity and prefer local experience before global analogies."
triggers: ["2608.05906", "MERIT", "causal episodic memory", "cross-query repair", "schema-local memory", "dual-polarity memory", "Text-to-SQL repair"]
last_updated: "2026-08-09"
source_basis: "arXiv 2608.05906v1 metadata, abstract, full HTML, results, ablations, and limitations inspected."
</ai_context>

# Repair memory works best near the environment that produced it

**Date:** 2026-08-09  
**Source:** https://arxiv.org/abs/2608.05906v1  
**Source:** https://arxiv.org/html/2608.05906v1  
**Source:** https://export.arxiv.org/api/query?id_list=2608.05906  
**Tags:** agent-memory, repair, retrieval, environment-locality, text-to-sql, feedback

## Finding

*Causal Episodic Memory for Feedback-Driven Agent Repair* evaluates whether a frozen agent can reuse finalized corrections from earlier tasks rather than rediscovering them. Its MERIT system stores oracle-verified fixes as positive memories and failed directions as negative memories. A deterministic failure classifier and hybrid lexical/dense retrieval select prior episodes before each repair attempt; only memories from already finalized queries are eligible, preventing future leakage.

With identical Qwen2.5-7B-Instruct initial predictions and seven-step repair budgets, MERIT raises execution accuracy over stateless iterative repair from **66.34% to 69.79% on Spider** (paired difference +3.45 points, 95% CI **[+1.97, +4.96]**) and from **47.35% to 48.44% on BIRD** (+1.09, **[0.00, +2.17]**). This supports cross-episode memory on Spider but is weak evidence on BIRD.

The important result is what did **not** generalize. MERIT ties untyped Dynamic RAG on Spider and leads it by only 0.28 points on BIRD, with both paired intervals crossing zero. Removing negative memory costs only 0.13 and 0.09 points. Hard failure-type filtering also has opposite, unresolved effects across the two datasets. The classifier itself is only about 48% accurate, so its labels function as rough routing hints rather than diagnoses.

By contrast, environment locality is the clearest ablation. Restricting retrieval to memories from *other* databases lowers accuracy by **0.93 points on Spider** and **2.74 on BIRD**. Same-database episodes retain join paths, table relationships, and domain terminology that broad semantic similarity and failure labels do not recover.

## Operational implication

Repair memory should be partitioned by environment identity before it is organized by a universal failure taxonomy:

1. persist the exact tool, repository, database, or service scope that produced a correction;
2. retrieve verified local episodes first, then broaden to cross-environment analogies;
3. treat coarse error classes as ranking features, not hard partitions, unless classifier reliability is measured;
4. store failed attempts only when their incremental value justifies prompt growth; and
5. evaluate memory against a simple untyped retrieval baseline, not only against stateless repair.

This suggests a **local-first memory hierarchy**: environment-specific evidence supplies operational detail, while global memory supplies transferable procedure. Flattening both into one semantic pool can erase the boundary that carried the strongest signal.

## Evidence limits

This is an arXiv v1 study on the Spider and BIRD development sets with one frozen 7B model and only three query orders. It assumes denotation-level correctness feedback, which is stronger than the errors, incomplete tests, or delayed user confirmation available in many deployments. MERIT is also not cheaper than stateless repair: it uses **5.274M vs 2.529M tokens on Spider** and **17.569M vs 9.325M on BIRD**, excluding embedding, indexing, retrieval latency, and memory-maintenance overhead. The evidence therefore supports local-first retrieval as a design hypothesis, not a universal memory architecture or production cost win.
