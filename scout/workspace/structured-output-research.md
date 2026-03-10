# Structured Output Best Practices for LLM Agents — Literature Review

> **Compiled:** 2025 · **Scope:** Recent (2024–2026) articles, papers, and resources on structured output (JSON mode, function calling, constrained decoding) for LLM-based agents.

---

## 1. Let Me Speak Freely? A Study on the Impact of Format Restrictions on Performance of Large Language Models

- **URL:** <https://arxiv.org/abs/2408.02442>
- **Date:** August 2024
- **Summary:** Investigates whether constraining LLM generation to structured formats (JSON, XML) degrades reasoning and domain-knowledge performance, finding that format restrictions can measurably reduce LLM capabilities in certain tasks — a critical consideration when designing agent output schemas.

---

## 2. XGrammar: Flexible and Efficient Structured Generation Engine for Large Language Models

- **URL:** <https://arxiv.org/abs/2411.15100>
- **Date:** November 2024
- **Summary:** Presents a high-performance, flexible engine for grammar-constrained decoding that addresses the growing demand for parseable structured outputs (JSON, function calls, agent commands) in LLM agent applications, achieving significant speedups over prior constrained-decoding approaches by using context-free grammar compilation with adaptive token masking.

---

## 3. SynCode: LLM Generation with Grammar Augmentation

- **URL:** <https://arxiv.org/abs/2403.01632>
- **Date:** March 2024
- **Summary:** Proposes a grammar-augmented decoding framework that constrains LLM outputs to conform to context-free grammars (e.g., JSON, YAML, programming languages), enabling reliable structured generation while addressing hallucination and format-adherence failures common in agentic pipelines.

---

## 4. StructEval: Benchmarking LLMs' Capabilities to Generate Structural Outputs

- **URL:** <https://arxiv.org/abs/2505.20139>
- **Date:** May 2025
- **Summary:** Introduces a comprehensive benchmark evaluating LLM structured-output fidelity across both non-renderable formats (JSON, YAML, CSV) and renderable formats (HTML, React, SVG), providing systematic metrics for comparing models on the structural correctness that agents depend on for tool integration.

---

## 5. Quantifying the Impact of Structured Output Format on Large Language Models through Causal Inference

- **URL:** <https://arxiv.org/abs/2509.21791>
- **Date:** September 2025
- **Summary:** Uses causal inference methods to rigorously measure how requiring structured output formats affects LLM generation quality, reconciling conflicting prior findings that structured formats can improve factual completeness in some settings while restricting reasoning capacity in others.

---

## 6. ToolPRM: Fine-Grained Inference Scaling of Structured Outputs for Function Calling

- **URL:** <https://arxiv.org/abs/2510.14703>
- **Date:** October 2025
- **Summary:** Addresses the under-explored intersection of inference-time compute scaling and structured output generation for function calling, proposing a process-reward model that improves the quality of structured API calls by allocating more compute to evaluate and select among candidate structured outputs.

---

## 7. Draft-Conditioned Constrained Decoding for Structured Generation in LLMs

- **URL:** <https://arxiv.org/abs/2603.03305>
- **Date:** February 2026
- **Summary:** Tackles the problem of constrained decoding distorting LLM output semantics when the model assigns low probability to valid continuations, proposing a draft-conditioned approach that maintains both syntactic validity (e.g., correct JSON, API call format) and semantic fidelity — critical for reliable agent tool use.

---

## 8. Automata-Based Steering of Large Language Models for Diverse Structured Generation

- **URL:** <https://arxiv.org/abs/2511.11018>
- **Date:** November 2025
- **Summary:** Shows that while automaton-based constrained generation ensures structural validity, it often reduces output diversity — then proposes a steering mechanism using automata traversal history to encourage diverse yet valid structured outputs, important for agents that must explore varied action spaces.

---

## Key Themes & Best Practices Emerging from the Literature

| Theme | Takeaway |
|---|---|
| **Format vs. reasoning trade-off** | Enforcing structured output (JSON mode) can degrade reasoning quality ([#1](#1-let-me-speak-freely), [#5](#5-quantifying-the-impact)); schema complexity should be minimized and critical reasoning should happen *before* structured formatting. |
| **Grammar-constrained decoding** | Tools like XGrammar and SynCode ([#2](#2-xgrammar), [#3](#3-syncode)) compile schemas into finite-state or pushdown automata for token-level masking, guaranteeing syntactic validity at generation time with low overhead. |
| **Semantic distortion risk** | Constrained decoding can push outputs toward locally valid but globally incorrect completions; draft-conditioned approaches ([#7](#7-draft-conditioned-constrained-decoding)) mitigate this by separating generation from constraint enforcement. |
| **Benchmarking is maturing** | Dedicated benchmarks like StructEval ([#4](#4-structeval)) now exist to measure structured-output fidelity across formats, enabling principled model selection for agent pipelines. |
| **Function calling at scale** | Inference-scaling techniques (e.g., best-of-N with process reward models, [#6](#6-toolprm)) can meaningfully improve function-call accuracy without retraining. |
| **Diversity under constraints** | Automata-based steering ([#8](#8-automata-based-steering)) addresses the tendency of constrained generation to collapse diversity, relevant when agents need to propose multiple candidate actions. |
| **Practical guidance** | Use the simplest schema that meets your needs; prefer `enum` and flat objects over deeply nested structures; validate outputs with retry logic; and consider a two-pass approach (free-form reasoning → structured extraction) to preserve model capability. |
