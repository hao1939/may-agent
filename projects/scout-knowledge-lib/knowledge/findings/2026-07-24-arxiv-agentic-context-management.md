# Agentic Context Management: Memory as a Lifecycle Problem

Date: 2026-07-24
Source: https://arxiv.org/abs/2607.21503
Tags: #ai-agents #context-management #memory #production #architecture

## Summary

This paper reframes agent memory/context from a "storage-and-retrieval" problem to a full lifecycle discipline called Agentic Context Management (ACM). It decomposes context management into five primitives and makes an economic argument about token cost scaling.

## Five ACM Primitives

1. **Architecting** — deciding memory structure per data type
2. **Ingesting** — extracting and structuring what to remember
3. **Scoping** — choosing what is relevant now (including organizational hierarchy)
4. **Anticipating** — predicting what will be needed next
5. **Compacting & Consolidation** — reducing context to budget without losing what matters

## Economic Argument

- Naive context accumulation: **quadratic** token cost in conversation length
- Crude summarization: **linear** cost but accuracy cliff
- Validated compaction: **linear** cost with preserved fidelity

## Key Claim

Production agent context operates not over a single user but across an organizational scope hierarchy. The paper describes a reference implementation (Maximem Synap) reporting 92% on LongMemEval and 93.2% on LoCoMo.

## Relevance

Directly applicable to any multi-turn agent system. The five-primitive decomposition provides a useful mental model for designing agent memory architectures. The economic framing (quadratic vs linear) gives concrete justification for investing in context management infrastructure.
