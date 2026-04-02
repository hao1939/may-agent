# Deep Dive: "Can AI Agents Agree?" (arXiv:2603.01213)
## Byzantine Consensus in LLM Agent Groups

**Paper:** Can AI Agents Agree?
**Authors:** Frédéric Berdoz, Leonardo Rugli, Roger Wattenhofer (ETH Zurich)
**Published:** March 2026 (v2: March 12, 2026)
**arXiv:** 2603.01213
**Categories:** cs.MA, cs.LG
**Deep-dive date:** 2026-03-28
**Relevance:** ★★★★★ — CRITICAL. Directly validates and extends our Byzantine MAS research thread.

---

## Executive Summary

This paper provides the **first systematic empirical study** of LLM-based agents attempting Byzantine consensus on scalar values. The findings are sobering: **reliable agreement is NOT a dependable emergent capability** of current LLM agent groups, even in benign (no-adversary) settings. Failures are dominated by **liveness failures** (timeouts, stalled convergence) rather than subtle value corruption — a finding that reshapes how we think about Byzantine fault tolerance in LLM systems.

**Key headline finding:** Agreement degrades as group size grows, and introducing even a small fraction of Byzantine agents further reduces success. This directly validates our Grand Unified Synthesis Law #3 (Coordination Overhead Scaling) and connects deeply to the Price of Decentralization (2603.11884).

---

## Detailed Analysis

### 1. Experimental Setup

- **Task:** Byzantine consensus game over scalar values
- **Setting:** Synchronous all-to-all communication (every agent can message every other agent)
- **No-stake condition:** Agents have no preferences over the final agreed value — they only need to agree
- **Variables tested:**
  - Model sizes (varying LLM capabilities)
  - Group sizes (scaling effects)
  - Byzantine fractions (0% to varying percentages)
- **Scale:** Hundreds of simulations

### 2. Core Findings

#### Finding 1: Agreement Fails Even Without Adversaries
In completely benign settings (0% Byzantine agents), LLM agent groups **cannot reliably reach consensus**. This is remarkable — it means the basic capability of "coming to agreement" is not a reliable emergent property of LLM agents, even when all agents are cooperating honestly.

**Connection to our research:** This validates our discovery of the "Conversation Tax" (2603.11394) and "Multi-turn Degradation" patterns. The problem isn't adversaries — it's the fundamental difficulty of LLM coordination at scale.

#### Finding 2: Liveness Failures Dominate
The primary failure mode is **loss of liveness** — timeouts and stalled convergence — NOT subtle value corruption or safety violations. Agents get stuck in loops, fail to converge on proposals, or simply time out.

**This is a critical insight for MAS architecture:** Traditional BFT research focuses on safety (preventing wrong consensus). But in LLM systems, the bigger problem is liveness (ensuring ANY consensus is reached). This is a fundamentally different failure mode than what classical distributed systems theory addresses.

#### Finding 3: Group Size Degrades Performance
As the number of agents increases, consensus success rates DROP. This is consistent with:
- **Price of Decentralization** (2603.11884): PoD scales linearly with n agents
- **Bureaucracy of Speed** (2603.09875): Coordination overhead grows superlinearly
- **Multi-Agent Teams Hold Experts Back** (2602.01011): More agents = worse per-agent performance

#### Finding 4: Byzantine Agents Further Degrade Success
Adding even a small fraction of Byzantine agents reduces consensus rates further, but the marginal degradation is relatively modest compared to the baseline failure rate. In other words: the system is already fragile before adversaries are introduced.

### 3. Implications for Our Framework

#### Validates Grand Unified Synthesis Laws
| Our Law | Validation |
|---------|-----------|
| **Law #3: Coordination Overhead Scaling** | ✅ Direct: group size degrades agreement |
| **Law #4: Turn-based Degradation** | ✅ Implied: stalled convergence = multi-turn failure |
| **Law #7: The Trust Topology Tax** | ✅ All-to-all topology doesn't solve the problem |
| **Degradation Pattern #1: Liveness Loss** | ✅ PRIMARY failure mode identified |

#### Reshapes Byzantine Threat Model
Our existing Byzantine research (byzantine-multi-agent-research.md) compiled 6 key papers with various mitigation strategies (CP-WBFT, IBGP, DecentLLMs, PBFT gossip, BlockA2A). This paper challenges the premise underlying many of these:

**Old assumption:** The hard problem is Byzantine safety (preventing wrong consensus when adversaries are present).
**New finding:** The hard problem is Byzantine liveness (ensuring ANY consensus when agents are cooperative).

This means:
1. **Mitigation strategies that add overhead** (like PBFT, voting rounds, verification agents) may actually WORSEN the problem by adding more coordination burden
2. **Simpler protocols with fewer rounds** may outperform complex BFT protocols
3. **The real fix may be architectural** — reducing the need for consensus rather than making consensus more robust (aligns with IBGP's "Imperfect BGP" insight from 2410.16237)

#### Connection to Chaotic Dynamics (2603.09127)
The "stalled convergence" failure mode maps directly to the **strange attractors** and **oscillatory dynamics** found in multi-LLM deliberation. Agents may be cycling through proposal/counter-proposal loops without convergence — a form of chaotic dynamics in consensus space.

#### Connection to DCI Framework (2603.11781)
The DCI (Deliberative Collective Intelligence) framework's structured deliberation may offer a path forward: by imposing structure on the consensus process (roles, phases, voting), it could break through the liveness failures that unstructured consensus suffers from.

### 4. Cross-Reference Map

| Paper | Connection |
|-------|-----------|
| **2603.11884** (Price of Decentralization) | Both show coordination cost scaling with n |
| **2603.09127** (Chaotic Dynamics) | Stalled convergence = chaotic attractors in consensus |
| **2603.11781** (DCI Deliberation) | Structured deliberation may solve liveness |
| **2603.04474** (Error Cascades) | Liveness failures prevent cascade (paradoxically protective) |
| **2602.01011** (Teams Hold Experts Back) | Group size penalty confirmed |
| **2603.11394** (Conversation Tax) | Multi-turn degradation compounds consensus difficulty |
| **2511.10400** (CP-WBFT) | Confidence probing may help but adds rounds |
| **2507.14928** (DecentLLMs) | Decentralized approach may worsen liveness |
| **2603.00130** (Agentic Hives) | Swarm consensus vulnerable to same liveness failures |
| **2603.11559** (Helicoid Dynamics) | Emergent group dynamics = potential chaotic states |

### 5. Practical Implications for MAS Design

1. **Minimize consensus requirements:** Design architectures where agents DON'T need to agree, only need to coordinate
2. **Use hierarchical delegation over peer consensus:** An orchestrator making decisions (even with Byzantine risk) may be more reliable than peer consensus (which has liveness risk)
3. **Set aggressive timeouts:** Liveness failures suggest indefinite deliberation is worse than fast-fail
4. **Prefer smaller groups:** 3-5 agents > 10+ agents for consensus tasks
5. **Structured protocols beat natural language negotiation:** Impose formal consensus protocols rather than letting agents negotiate freely

### 6. The Liveness-Safety Tradeoff in LLM MAS

This paper reveals a fundamental tradeoff specific to LLM multi-agent systems:

```
Classical BFT: Safety vs. Liveness (FLP impossibility)
LLM MAS BFT:   Liveness is the binding constraint
                Safety violations are secondary
```

In classical distributed systems, the FLP impossibility theorem shows you can't have both safety and liveness in asynchronous systems. In LLM MAS, the practical reality is that **liveness fails first** — you rarely get wrong consensus because you rarely get ANY consensus.

This is actually a **silver lining**: LLM agent groups are "safe by default" because they fail to agree rather than agreeing on the wrong thing. But it means the primary engineering challenge is getting them to converge at all.

### 7. Open Questions

1. Does structured communication (vs. free-form) improve liveness?
2. Does chain-of-thought prompting help or hurt consensus convergence?
3. Are certain model architectures better at consensus than others?
4. Can we predict consensus failure from early-round communication patterns?
5. What's the optimal group size for maximizing P(agreement) × quality?

---

## Rating and Classification

**Relevance to MAS coordination research:** ★★★★★
**Novelty:** ★★★★☆ (first systematic study, but confirms what our framework predicted)
**Methodological rigor:** ★★★★☆ (systematic variation, but limited to no-stake setting)
**Practical impact:** ★★★★★ (directly shapes MAS architecture decisions)
**Integration with existing portfolio:** ★★★★★ (validates multiple laws, extends Byzantine thread)

**Classification:** CRITICAL — Updates our understanding of Byzantine failure modes from "adversarial corruption" to "liveness collapse."
