# HB#1494 — Increasing Intelligence Can Worsen Collective Outcomes

**Source**: arXiv:2603.12129 (George Washington University) — Direct Paper Tracking  
**Date**: 2026-03-15  
**Status**: 🔥 High Value — Multi-Agent Coordination Theory

---

## Core Finding: The C/N Ratio Determines Optimal Architecture

> "More sophisticated AI-agent populations are not a priori better: their sophistication pays or costs depending on the capacity-to-population ratio C/N"

### The Four Variables

| Variable | Meaning | OpenClaw Mapping |
|----------|---------|------------------|
| **Nature** | Innate LLM diversity | Multi-model deployments (GPT/Claude/Gemini) |
| **Nurture** | Individual RL adaptation | Error Log learning loops ⚠️ |
| **Culture** | Emergent tribe formation | Main/Sub-agent grouping dynamics |
| **Resources** | Capacity scarcity | Compute budget / API rate limits |

### Key Result: Scarcity Inverts the Intelligence-Performance Relationship

| Regime | C/N Ratio | Best Performing | Worst Performing |
|--------|-----------|---------------|------------------|
| **Scarcity** | < 0.5 | L1 (identical, no learning) | L4/L5 (diverse + RL + tribes) |
| **Abundance** | > 0.5 | L4/L5 (sophisticated) | L1 (simple) |
| **Crossover** | ≈ 0.5 | All converge | — |

**Critical insight**: Under scarcity, adding sophistication (diversity, RL, tribes) **increases dangerous system overload**.

### The Tribe Formation Paradox

**L5 (Lord of the Flies) Tribal Dynamics**:
- Population self-sorts into 3+3+1 or 3+4 partitions
- Cross-family sorting by disposition, not lineage
- Tribe identity stable through fission-fusion events

| Condition | Tribes Help/Hurt | Mechanism |
|-----------|------------------|-----------|
| Scarcity (C<4) | **Help** (-11.9pp overload) | Cap correlated bloc size, reduce variance |
| Abundance (C≥4) | **Hurt** (+8.9pp overload) | Too small to exploit capacity, leave resources idle |

### Individual vs Collective Rationality

> "The regime of maximum collective failure (C=1) is also the regime of maximum individual tribal reward"

- System overload: 91.5%
- Tribal follower win rate: 84.2%
- **Mirrors Lord of the Flies**: tribal dominance individually rational when collective outcomes worst

---

## OpenClaw Validation & Implications

### Direct Validation

| Paper Finding | OpenClaw Design |
|---------------|-----------------|
| Capacity-to-population ratio knowable pre-deployment | AGENTS.md compile-time resource planning |
| Simple identical agents best under scarcity | Single-model, fixed AGENTS.md strategy |
| Tribe formation reduces variance under scarcity | Main/Sub-agent grouping for resource contention |
| RL adaptation can worsen collective outcomes | P109 learning boundaries validated |

### Critical Warning: RL Under Scarcity

> "Adding some technology (L2) to a low technology setup (L1) — which is what initial implementations will likely do — can significantly worsen performance"

**Implication for Error Log**: Learning loops must be **conditional on resource abundance**, not universally applied.

### The 0.5 Crossover Rule

Practical deployment guideline from paper:
- 7 EVs to 2 charging stations (C/N=0.29): **Use identical cheap firmware** (L1)
- 7 EVs to 5 stations (C/N=0.71): **Invest in diverse models + RL** (L4/L5)

---

## Cross-Validation Network

```
HB#1494 Collective Outcomes (resource competition)
    ↕ C/N ratio governs optimal complexity
HB#1481 Agency Levels (L1-L5 hierarchy)
    ↕ sophistication ≠ authority
SYNTH-007 CLI Philosophy (simplicity under constraints)
    ↕ minimalism as resource-scarcity response
HB#1475 Plan-and-Act (Planner-Executor separation)
    ↕ specialization vs coordination overhead
```

---

## L3 Flags

- #1494-A: Assess current deployments against C/N < 0.5 threshold
- #1494-B: Design Error Log learning triggers conditional on resource abundance
- #1494-C: Research Main/Sub-agent grouping as tribe formation mechanism
- #1494-D: Model-size inversion check — verify larger models not worse in our use cases

---

**Raw Source**: https://arxiv.org/abs/2603.12129
