# KE-216: Inter-agent communication is a lossy channel (Data Processing Inequality)

**Date**: 2026-04-18
**Source**: DD-597 (arXiv:2604.02460, Tran & Kiela)
**Confidence**: High
**Connects**: KE-019, H-168, DD-590, DD-595, DD-598

## Core Finding

Under fixed compute budgets, single-agent systems consistently match or outperform multi-agent systems on reasoning tasks. The Data Processing Inequality (DPI) proves that every inter-agent communication step can only destroy information, never create it. Multi-agent is only justified when: (1) context exceeds a single agent's effective window, (2) compute budget is flexible (parallel exploration), or (3) task requires genuinely diverse specialized capabilities.

## Evidence

- Three model families (Qwen3, DeepSeek-R1-Distill-Llama, Gemini 2.5) tested across multiple MAS architectures
- SAS matches/beats MAS when token budgets are held constant
- Many published MAS advantages explained by unaccounted computation (API budget artifacts)
- Aligns with DD-590 (memory+single > multi-agent) and DD-595 (integration bottleneck)

## Mechanism / Why

DPI from information theory: for any Markov chain X → Y → Z, mutual information I(X;Z) ≤ I(X;Y). Each agent handoff is a lossy compression step — the receiving agent gets a summary, not the full reasoning trace. The specialization benefit of multi-agent must exceed this information loss to be net positive.

## Implications

### 1. Justify every agent boundary with specialization benefit > communication cost
The Scout→Bob→Tech-lead pipeline is justified only if research-vs-synthesis specialization benefit exceeds the ~15-30% information loss per handoff. For pure sequential reasoning, a single agent with good context wins.

### 2. Context engineering > adding agents
Investing in better context (DD-598) is higher-leverage than adding agents. Better context utilization within a single agent's window avoids the DPI tax entirely.

### 3. Budget-aware architecture switching
Some tasks should dynamically choose single-agent vs multi-agent based on context size and available compute, rather than always routing through the full agent pipeline.

## Actionable

- Audit current agent handoffs for information loss (→ H-168 test plan)
- For tasks fitting in one context window, consider direct-context mode over multi-agent routing
- Invest in context compression/engineering over agent proliferation

## Open Questions

- What is the actual information loss per handoff in our system? (H-168)
- At what context length does our single-agent utilization degrade enough to justify multi-agent?
- Can structured handoff formats (vs free-text summaries) reduce DPI loss?
