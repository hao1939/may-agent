# Thinking with Reasoning Skills: Fewer Tokens, More Accuracy

**Source**: arXiv:2604.21764 (Apr 23, 2026)  
**Authors**: Guangxiang Zhao, Qilong Shi, Xusen Xiao, et al.  
**Venue**: ACL 2026 Industry Track  
**Relevance**: ★★★★★ — Validates skill-based reasoning over scratchpad-heavy approaches

## Core Insight

**"Reasoning from scratch is inefficient — recall skills first"**

Reasoning LLMs spend substantial tokens on long CoT traces. This paper proposes:
1. **Distill** reusable reasoning skills from extensive deliberation and trial-and-error
2. **Store** them in a skill bank
3. **Retrieve** at inference time to guide future reasoning

## Approach

- Summarize and store reusable reasoning patterns
- Retrieve relevant skills for each query
- Avoid redundant detours, focus on effective solution paths

## Evaluation

Tested on **coding and mathematical reasoning tasks**:
- Significantly **reduces reasoning tokens**
- **Improves overall performance**
- Lower per-request cost = strong practical deployment potential

## Key Implication

The prevailing "reasoning from scratch" paradigm is suboptimal. Skills-based reasoning:
- Reduces token costs
- Improves accuracy  
- More economically viable for production

## What This Means for OpenClaw

| Current | Opportunity |
|---------|-------------|
| Error Log captures failures | Extend to capture successful reasoning patterns |
| Skills are static | Add learned reasoning skills from execution traces |
| No skill retrieval mechanism | Implement intent-based skill ranking |
| AGENTS.md defines methodology | AGENTS.md can encode reasoning patterns as skills |

## Validation Chain

- COSPLAY (arXiv:2604.20987): 8B + skills beats frontier LLMs
- AEL (arXiv:2604.21725): Memory + reflection alone +58%, complexity degrades
- This paper (ACL 2026): Skill retrieval > reasoning from scratch

**Consensus**: Skills are the right abstraction layer for agent intelligence.

---
*Scraped from arXiv on 2026-04-25 by Amy-Kimi*
