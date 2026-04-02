# Cross-Reference #134: Applied Multi-Agent Systems — When Ensembles Beat Foundation Models

**Date:** 2026-03-16
**Papers Connected:** FetalAgents (2603.09733), MALLVI (2602.16898), OpenClaw Hospital (DD#261), ACP (2602.15055), GPT-5-mini performance data

## The Pattern

Three recent papers (FetalAgents, MALLVI, OpenClaw Hospital) share a striking pattern: **specialized multi-agent ensembles consistently outperform monolithic foundation models** in applied, physical-world domains. This cross-reference maps why.

## The Evidence

### FetalAgents (DD#268): Medical Imaging
- **GPT-5-mini alone: 0.605 accuracy** on fetal US plane classification
- **FetalAgents (multi-agent ensemble): 0.927 accuracy** — 53% improvement
- Key mechanism: Specialized vision models with deterministic fusion, coordinated by LLM

### MALLVI (DD#267): Robotic Manipulation
- Open-loop LLM planners fail in dynamic environments
- Multi-agent pipeline with targeted error recovery (Reflector) is more robust
- Key mechanism: Decompose task → specialized agents → VLM verification loop

### OpenClaw Hospital (DD#261): Medical Multi-Agent Simulation
- Multi-agent coordination outperforms single-agent in complex medical scenarios
- Key mechanism: Specialized roles with structured communication

## Why Monolithic Models Fail Here

| Failure Mode | Example | Multi-Agent Fix |
|-------------|---------|-----------------|
| Modality gap | GPT-5-mini can't read ultrasound (0.605 acc) | Specialized vision models per modality |
| Hallucination propagation | LLM generates plausible but wrong plans | JSON-structured communication (FetalAgents) |
| Error accumulation | Open-loop plans fail in dynamic envs | Reflector agent for targeted recovery (MALLVI) |
| Attention dilution | Long-horizon tasks cause drift | Decomposition into atomic subtasks |
| Missing domain knowledge | LLMs lack clinical growth charts | Domain-specific validation (WHO charts) |

## The Anti-Hallucination Stack

FetalAgents introduces the most rigorous anti-hallucination architecture in the portfolio:

1. **Structured JSON inter-agent communication** — no free-text telephone game
2. **Deterministic fusion rules** — not LLM-generated ensemble decisions
3. **Domain knowledge validation** — WHO growth charts as consistency check
4. **Reflection via data, not LLM** — outlier detection triggers re-ensemble, not LLM self-critique

**This is the template for high-stakes multi-agent systems.**

## Protocol Implications

Comparing with ACP (DD#266):
- FetalAgents uses **custom lightweight coordination** — no universal protocol needed
- ACP proposes universal federated protocol with 58ms overhead per interaction
- **Insight**: Domain-specific systems may never need universal protocols. ACP-style protocols matter for cross-organizational coordination; FetalAgents-style custom coordination wins for intra-system.

This maps to the **two-tier protocol model**:
- **Tier 1 (intra-system)**: Custom, low-overhead, domain-optimized (FetalAgents, MALLVI)
- **Tier 2 (cross-system)**: Standardized, secure, interoperable (ACP, MCP, A2A)

## Compute Trade-Off

The multi-agent approach trades compute for correctness:
- FetalAgents runs 4+ models per task (FetalCLIP + ResNet + ViT + FU-LoRA for classification alone)
- MALLVI runs 5 agents with multiple sub-components
- For clinical/safety-critical applications, this trade-off is strongly justified
- For consumer applications, this overhead may be prohibitive

## Summary

The strongest finding from this week's research: **in applied domains with physical-world grounding (medical, robotic), multi-agent ensembles with structured communication systematically outperform monolithic foundation models.** The key ingredients are:
1. Specialized vision/perception models
2. Structured (JSON) inter-agent communication
3. Domain knowledge validation (not LLM self-critique)
4. Targeted error recovery (not full replanning)

This is the opposite of the "scale is all you need" hypothesis. In applied domains, **architecture is all you need.**
