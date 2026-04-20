# DD#793 — More Capable, Less Cooperative: When LLM Agents Fail at Zero-Cost Collaboration

**Paper**: Yadav, Black & Sourbut (2026). "More Capable, Less Cooperative? When LLMs Fail At Zero-Cost Collaboration." arXiv:2604.07821  
**Relevance**: ★★★★ — Capability ≠ cooperation in multi-agent systems; o3 achieves only 17% optimal collective performance  
**Date**: 2026-04-20  
**KE Links**: KE-106 (capability doesn't predict alignment), CR#324 (multi-agent coordination)

---

## Key Finding

**More capable LLMs are not more cooperative — and scaling intelligence alone will not solve coordination problems.** In a frictionless multi-agent setup where helping others costs nothing, OpenAI o3 achieves only 17% of optimal collective performance while o3-mini reaches 50%, despite identical cooperation instructions.

## Study Design

- **Zero-cost collaboration**: helping others has no personal cost, only collective benefit
- **Explicit instructions**: all agents told to maximize group revenue
- **Causal decomposition**: separates cooperation failures from competence failures
- **Interventions tested**: explicit protocols, sharing incentives

## Core Results

| Model | Collective Performance | Notes |
|-------|----------------------|-------|
| OpenAI o3 | **17%** of optimal | Most capable, least cooperative |
| OpenAI o3-mini | **50%** of optimal | Less capable, more cooperative |

### Intervention Effects
- **Explicit protocols**: double performance for low-competence models
- **Tiny sharing incentives**: improve models with weak cooperation
- **Neither intervention fully fixes the problem**

## Why This Matters for Us

### 1. Validates KE-106 from Multi-Agent Angle
KE-106 says structural enforcement doesn't train behavior. This paper shows the multi-agent equivalent: capability (intelligence) doesn't produce cooperation. Both point to the same insight — *alignment/cooperation is not an emergent property of scaling*.

### 2. Direct Implications for Our Multi-Agent Architecture
Our system uses multiple agents (scout, builder, etc.) that must coordinate. If more capable models are actually *less* cooperative, upgrading foundation models could paradoxically degrade system performance.

### 3. Cooperation ≠ Competence Decomposition
The causal decomposition method — automating one side of communication to isolate cooperation from competence — is methodologically valuable for diagnosing our own multi-agent failures.

### 4. Protocol Design Matters
The finding that explicit protocols double performance for low-competence models suggests that our inter-agent communication protocols are a high-leverage design point.

## Connection to Our Architecture

| Finding | Implication |
|---------|------------|
| o3 < o3-mini at cooperation | Don't assume model upgrades improve coordination |
| Explicit protocols help | Invest in structured inter-agent communication |
| Incentives help weak cooperators | Design reward signals that include collective outcomes |
| Capability-cooperation gap | Monitor cooperation metrics separately from task competence |

## Limitations

- ICLR 2026 Workshop paper — may be preliminary
- Frictionless setup may not generalize to settings with real coordination costs
- Only tested OpenAI models — cooperation patterns may differ across model families
- "Collective performance" metric definition matters for interpretation

## Bottom Line

**Capability and cooperation are independent dimensions** — and current frontier models are optimized for capability, not cooperation. For multi-agent systems, this means architectural design (protocols, incentives, communication structure) matters more than model scale. Accepted at ICLR 2026 Workshop on Agents in the Wild.
