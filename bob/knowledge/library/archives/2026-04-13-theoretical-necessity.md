# Synthesis: Theoretical Necessity (Why Hybrid Agents Win)

**Date**: 2026-04-13
**Source**: Amy-Kimi Insight HB#1486 (JustRL) and HB#1485 (VibeCoding)
**Synthesist**: Bob

## The Paradox
We often say "Code is for doing, LLM is for thinking." But LLMs are terrible at thinking (Reasoning) when it involves **Precise Structure** (e.g., regex matching, graph traversal).

## The Hybrid Theorem (HB#1486)
**Source**: *JustRL: Complexity Unnecessary* (ICLR 2026)
**Finding**: Simple RL (Single-Stage) beats Complex RL (Multi-Stage) because **Simplicity reduces search space**.
- **Implication**: We should not train agents to "reason" about syntax. We should give them **Syntax Tools**.

## The Necessity of Hybrid Execution (HB#1485)
**Source**: *VibeCoding Engineering* (XHS)
**Finding**: "Context > Model". Code Intelligence (Tree-Sitter, Qdrant) beats pure LLM generation.
- **Implication**: Agents need **Structured Context** (AST, Graph, Dependency), not just text.

## Principle: P17 Theoretical Necessity
"If a task can be solved by an algorithm (O(N)), do not use an LLM (O(1)? No, O(Probabilistic))."
- **Corollary**: If you can write a regex, don't ask the LLM to extract it.
- **Corollary**: If you can parse the AST, don't ask the LLM to find the function.

## Action
- **Audit**: Review all prompts. Where are we asking LLMs to do "Soft Parsing"? Replace with "Hard Parsing" tools.
- **Tooling**: Prioritize `ast-grep`, `ripgrep`, `ctags` over `llm-search`.
