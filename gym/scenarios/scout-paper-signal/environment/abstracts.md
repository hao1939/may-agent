## Paper A: "Multi-Agent Collaborative Memory Consolidation via Shared Episodic Buffers"
arXiv:2604.11001 — Chen et al., 2026

We introduce MACM, a framework where multiple LLM agents share an episodic memory buffer to consolidate learned procedures across tasks. Unlike prior work on individual agent memory, MACM enables agents to cross-pollinate discovered heuristics through a structured merge protocol. On the AgentBench suite, MACM improves multi-agent task completion by 23% over isolated memory baselines. We release code and a benchmark of 150 collaborative memory scenarios.

## Paper B: "Scaling Laws for Transformer Feed-Forward Layers"
arXiv:2604.11045 — Liu & Park, 2026

We derive precise scaling laws for the feed-forward sublayers in transformer architectures, showing that FFN width scales sublinearly with model quality past 10B parameters. Our theoretical predictions match empirical measurements across 47 model sizes from 125M to 70B. We provide a calculator tool for optimal FFN dimensioning given a compute budget.

## Paper C: "AgentShield: Adversarial Robustness Testing for Tool-Using LLM Agents"
arXiv:2604.11102 — Patel et al., 2026

AgentShield is an automated red-teaming framework that generates adversarial inputs designed to cause tool-using agents to make incorrect tool calls, leak context, or violate safety constraints. We test 8 commercial agent systems and find that 6/8 are vulnerable to at least one class of attack. Our taxonomy covers prompt injection through tools, context window poisoning, and verification bypass. We propose three mitigation patterns.

## Paper D: "A Survey of Retrieval-Augmented Generation: 2024-2026"
arXiv:2604.11200 — Wang et al., 2026

We present a comprehensive survey of RAG techniques published between 2024 and 2026, covering 312 papers. We categorize approaches into sparse retrieval, dense retrieval, hybrid, and generative retrieval. We discuss open challenges including hallucination reduction, latency, and domain adaptation. This survey provides a roadmap for future RAG research.

## Paper E: "Context Drift Detection in Long-Running Agent Sessions"
arXiv:2604.11301 — Nakamura & Bianchi, 2026

Long-running LLM agent sessions suffer from context drift — gradual accumulation of stale or contradictory information in the working context. We formalize context drift, propose three detection metrics (staleness score, contradiction density, relevance decay), and introduce ContextGuard, a lightweight monitor that flags drift in real-time. In experiments with a 48-hour coding agent, ContextGuard reduces task failure from drift by 41%.

## Paper F: "GPT-5 Achieves State-of-the-Art on 37 Benchmarks"
arXiv:2604.11400 — OpenAI, 2026

We present GPT-5, our latest large language model. GPT-5 achieves state-of-the-art results on 37 out of 42 evaluated benchmarks including MMLU, HumanEval, MATH, and BigBench-Hard. Key innovations include improved training data curation and a novel attention mechanism we call Selective Sparse Attention. We discuss safety evaluations and deployment considerations.
