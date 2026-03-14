# Increasing intelligence in AI agents can worsen collective outcomes

**Source:** arXiv:2603.12129 (March 12, 2026)  
**Author:** Neil F. Johnson (George Washington University)  
**Research Question:** When resources are scarce, will AI agents coordinate in harmony or descend into tribal chaos?

## Core Finding

**More sophisticated AI-agent populations are NOT a priori better.** Whether sophistication helps or harms depends entirely on a single knowable number: **capacity-to-population ratio (C/N)**.

## Four-Variable Framework

The first system where four key variables governing collective behavior can be **independently toggled**:

| Variable | Description | Mechanism |
|----------|-------------|-----------|
| **Nature** | Innate LLM diversity | 7 agents from 3 families (GPT-2, Pythia, OPT; 124M-410M params) |
| **Nurture** | Individual reinforcement learning | Disposition parameter p adapts over time |
| **Culture** | Emergent tribe formation | Sensing other agents' grouping; self-organized factions |
| **Resources** | Resource scarcity | Capacity C = 1-6, Population N = 7 |

## Technology Ladder (5 Levels)

| Level | Configuration | Label | C/N < 0.5 | C/N > 0.6 |
|-------|---------------|-------|-----------|-----------|
| L1 | Identical LLMs, fixed p=1 | IID | ✅ **Best** | Moderate overload |
| L2 | Identical + RL | Null | ⚠️ Worst | Poor |
| L3 | Diverse LLMs, fixed p=1 | Diverse | Middle | Good |
| L4 | Diverse + RL | FRD | High overload | ✅ **Near-zero** |
| L5 | Diverse + RL + tribal sensing | LOTF | Better than L4 | Worse than L4 |

## Critical Discovery: The Crossover at C/N ≈ 0.5

```
Overload
   │
L2 │    ╲
L4 │     ╲                    ╱
L5 │      ╲              ╱─────
L3 │       ╲        ╱────
L1 │_________╲___╱_________________ C/N
            0.5
```

- **Scarcity regime (C/N ≲ 0.5)**: Simplest technology (L1) achieves lowest overload
- **Abundance regime (C/N ≳ 0.6)**: Most sophisticated (L4/L5) achieve near-zero overload
- **Crossover point**: C*/N ≈ 0.5 — where opposing tribes first fit inside available capacity

## Tribal Dynamics (L5: Lord of the Flies)

**Tribe formation mechanism:**
- Agents cluster around shared p values through loyalty and defection
- Typical partition: 3+3+1 (two opposing tribes + singleton)
- Cross-family sorting driven by **disposition, not lineage**
  - OPT-125M (Meta family) joins Pythia anti-follower bloc rather than OPT-350M sibling

**Tribe effects:**
- **Scarcity (C<4)**: Tribes cap demand variance → lower overload than L4
  - At C=2: overload drops by 11.9pp when tribal sensing added
- **Abundance (C≥4)**: Tribes too small to exploit capacity → higher overload than L4

## Individual vs Collective Outcomes Paradox

| Regime | Collective Overload | Individual Win Rate (L5 followers) |
|--------|---------------------|-----------------------------------|
| C=1 (max scarcity) | 91.5% | **84.2%** |
| C=2 | High | High |
| C=4 | Low | Moderate |

**Key insight**: Maximum collective failure coexists with maximum individual reward. Tribal dominance is individually rational precisely when collective outcomes are worst.

## Practical Implications

> "A city deploying 7 EVs to 2 charging stations (C/N=0.29) should run **identical cheap firmware**. The same population at 5 stations (C/N=0.71) should invest in **diverse models and RL**."

## Model-Size Inversion Validation

Mori et al. tested GPT-4-turbo, Gemini 2.5 Pro, Claude Sonnet 4.5 in same game:
- **Larger, more capable models were WORSE, not better**
- Directly instantiates the paper's title claim

## Connection to OpenClaw

| Paper Concept | OpenClaw Mapping |
|---------------|------------------|
| Capacity-Population ratio C/N | Sub-agent pool size vs compute budget |
| L1 (simple, identical) | Fixed Sub-agent with deterministic routing |
| L4 (diverse + RL) | Dynamic agent selection based on Error Log |
| L5 (tribal sensing) | Agent collaboration groups? |
| Crossover at C/N≈0.5 | Threshold for "complexity vs simplicity" decision |

## Key Quote

> "The capacity-to-population ratio C/N — which should be knowable before deployment — determines the optimal level on the technology ladder."

## Relevance

- **For Bob**: Architecture decision principle — when to use simple vs sophisticated approaches
- **For tech-lead**: Resource allocation heuristics for Main Agent ↔ Sub-agent orchestration
- **Flag**: #896 — C/N ratio as deployment decision criterion

---

**Archived:** 2026-03-14  
**L3 Flag:** #896
