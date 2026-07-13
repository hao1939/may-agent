# The Context Access Divide

**Source**: arXiv 2607.08495 (Fujita, 2026-07-09)
**Scout scan**: #188 (2026-07-11)

## Core Concept

The **Context Access Divide (CAD)** is a structural inequality in AI usefulness
that operates at the *interaction level*, not the system level. Two users with
identical AI agent access experience qualitatively different utility depending on
whether the agent can autonomously retrieve context from the user's knowledge
corpus (Dynamic Context Retrieval via MCP/RAG) or requires the user to manually
identify and attach relevant documents per query (Manual Attachment).

## The Combinatorial Collapse

Formalized using cognitive psychology's fan effect: manual context attachment
leads to **combinatorial collapse** in task-success probability as:
- Corpus size grows (more documents to search through)
- Task conjunctivity grows (more pieces of context needed simultaneously)

Dynamic retrieval architectures are **structurally insulated** from this collapse.
This is not a gradual degradation — it's a phase transition. Above a certain
corpus size × task complexity threshold, manual attachment becomes effectively
impossible while dynamic retrieval remains tractable.

## "Contextuality" as an Inequality Dimension

The paper introduces **contextuality** — the degree to which an AI system
autonomously accesses a user's accumulated knowledge capital — as a dimension
of AI-mediated inequality that complements but is not reducible to the Sharp
et al. (2025) framework of availability, quality, and quantity.

## Connections

- **Impedance Principle**: The gap between human and agent context access is
  itself a form of impedance mismatch. Organizations on the wrong side of the
  CAD experience the full Impedance Principle; those with good context
  infrastructure partially dissolve it.

- **Eternal Present**: The CAD is the cross-user analog of the Eternal Present.
  Without dynamic retrieval, each interaction starts from scratch — the agent
  lives in an eternal present *with respect to the user's knowledge*.

- **Cold Start Tax**: The CAD amplifies the Cold Start Tax. New tasks in
  knowledge-rich domains require extensive context; without dynamic retrieval,
  every task pays a cold start tax proportional to corpus size.

## Implications for Our System

Our agent architecture (persistent context.md, SKILL.md, knowledge files loaded
at session start) places us on the dynamic retrieval side of the divide. But the
paper raises the question: is *file-level* context retrieval sufficient, or does
the CAD reappear at finer granularity when individual knowledge files grow large
enough that relevant information within them isn't surfaced?

The answer likely depends on whether our knowledge files remain focused enough
to be loaded in their entirety, or whether we eventually need intra-file
retrieval (RAG over our own knowledge base).
