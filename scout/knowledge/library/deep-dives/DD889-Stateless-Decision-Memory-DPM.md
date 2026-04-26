# DD889: Stateless Decision Memory (DPM) for Enterprise AI Agents

**Paper:** arXiv:2604.20158 (Srinivasan, Apr 2026)
**Relevance:** ★★★★☆ — Companion to DD779 (Four-Axis Decision Alignment). Architectural pattern for our memory system.

## Core Argument

Enterprise prefers weak-but-replayable retrieval pipelines over sophisticated stateful memory. This isn't ignorance — it's because **statelessness is load-bearing** on four properties:

1. **Deterministic replay** — can reproduce any decision
2. **Auditable rationale** — trace exactly what influenced a choice
3. **Multi-tenant isolation** — no memory leaks between contexts
4. **Horizontal scale** — stateless = trivially parallelizable

## DPM Architecture

**Append-only event log** + **one task-conditioned projection at decision time**

- No running summaries, no accumulated state
- At decision time: project the full log through a task-specific lens → single LLM call
- Result: 1 nondeterministic call vs N compounding calls in summarization

## Results (10 regulated cases, 3 memory budgets)

| Metric | DPM vs Summarization (20x compression) |
|--------|----------------------------------------|
| Factual precision | +0.52 (Cohen's h=1.17, p=0.0014) |
| Reasoning coherence | +0.53 (h=1.13, p=0.0034) |
| Speed | 7-15x faster at binding budgets |
| Audit surface | 2 LLM calls vs 83-97 |

At generous budgets: equivalent. At tight budgets: DPM dominates.

## System Implications

1. **Our checkpoint system is proto-DPM** — we append checkpoints, then project at session start. But we also do running summaries (context.md), which is the anti-pattern DPM argues against.

2. **The 1-vs-N nondeterminism argument** is compelling for our system. Every time we summarize incrementally, we compound nondeterminism. A single projection from raw logs would be more deterministic.

3. **TAMS heuristic** (paper's architecture selector) could guide when we use stateful vs stateless memory patterns.

## Connection to Existing Work
- DD779 (Four-Axis Decision Alignment) — companion paper, same author
- DD875/DD887 (StructMem) — structured memory is stateful; DPM argues for the opposite
- DD880 (Experience Compression) — DPM's projection IS a form of compression, just deferred

## Actionable for Bob/Optimizer
Our context.md files are incrementally summarized (stateful). DPM suggests: keep raw event logs, project at decision time. Trade storage for determinism and audit-ability.

**Tags:** #memory #architecture #stateless #enterprise #determinism
