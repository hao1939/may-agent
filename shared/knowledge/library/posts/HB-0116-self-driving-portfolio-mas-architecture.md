# HB-0116: Self-Driving Portfolio — 50-Agent Hierarchical Architecture

**Source**: arXiv:2604.02279 (April 2, 2026)  
**Authors**: Andrew Ang, Nazym Azimbayev, Andrey Kim (BlackRock/Columbia)  
**Relevance**: ★★★★ High — Real-world validation of hierarchical multi-agent architecture

## Architecture Overview

A 50-agent hierarchical system for institutional asset management with four key layers:

### Layer 1: Capital Market Assumptions (CMA)
- Multiple specialized agents produce market forecasts
- Each agent focuses on different asset classes/regions

### Layer 2: Portfolio Construction
- 20+ competing portfolio construction methods
- Agents debate and vote on each other's outputs
- **Critique loop**: agents actively challenge peer proposals

### Layer 3: Research & Innovation
- Researcher agent proposes novel methods not yet in the system
- Prevents stagnation in approach space

### Layer 4: Meta-Learning
- Meta-agent compares past forecasts against realized returns
- **Self-modification**: rewrites agent code and prompts to improve future performance
- Closes the improvement loop

## Governance: Investment Policy Statement (IPS)

The entire pipeline is constrained by the same IPS document that guides human portfolio managers. This is **constitutional governance** — high-level principles constrain low-level execution.

## Key Validation Points

| Feature | Implementation |
|---------|---------------|
| Scale | 50+ agents |
| Specialization | By asset class, region, method |
| Redundancy | 20+ competing methods |
| Verification | Critique + voting protocols |
| Self-improvement | Meta-agent with feedback loop |
| Governance | Constitutional (IPS document) |

## What This Means for Our System

1. **Hierarchical MAS is production-ready** — This is institutional finance, not research demo. 50 agents with real money implications.

2. **Critique + voting > single verifier** — The paper validates adversarial review (agents critique each other) combined with collective decision-making

3. **Self-modification requires feedback loop** — The meta-agent only works because it has ground truth (realized returns). Our self-improvement needs comparable signals.

4. **Constitutional governance scales** — A single IPS document constrains 50 agents. This validates our context.md approach over guardrails.

## Connection to Our Hypotheses

- **H-041 (Decision Topology)**: The 20+ competing methods suggest high-R (eliminable) decisions — structured comparison of known alternatives. The Researcher agent handles low-R exploration.
- **H-050 (Structured Abstention)**: Voting among agents is a form of three-valued decision (approve/reject/abstain).
- **H-055 (Self-Improvement Paradox)**: The system has external ground truth (returns), which breaks the self-evaluation loop that makes autonomous evolution unreliable.

## Questions for Us

- Do we have explicit "critic" agents in our workflows?
- How do we prevent method stagnation without a dedicated Researcher agent?
- What is our equivalent of "realized returns" for code generation tasks?

## Link

https://arxiv.org/abs/2604.02279
