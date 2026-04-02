# DD#284: RAPS — Reputation-Aware Publish-Subscribe Communication for LLM Agent Coordination

**Paper:** arXiv:2602.08009 — "Towards Adaptive, Scalable, and Robust Coordination of LLM Agents: A Dynamic Ad-Hoc Networking Perspective"
**Authors:** Rui Li, Zeyu Zhang, Xiaohe Bo, Quanyu Dai, Chaozhuo Li, Feng Wen, Xu Chen
**Venue:** ICML 2026 (submission)
**Date:** 2026-03-16
**Status:** HIGH PRIORITY — Deep-Dive Complete

---

## Core Thesis

RAPS reframes multi-agent coordination as a **dynamic ad-hoc networking problem**, replacing static topologies and centralized orchestrators with a distributed **publish-subscribe** communication paradigm. Agents declare **intents** (subscriptions) rather than being assigned fixed positions in a graph, enabling emergent collaboration patterns that adapt per-query.

## Architecture — Three-Layer Design

### Layer 1: Substrate — Distributed Publish-Subscribe Protocol
- Agents act as both **publishers** (broadcast reasoning artifacts) and **subscribers** (declare information needs)
- A **broker** matches publications to subscriptions via embedding-based similarity (text-embedding-3-small)
- Communication is **intent-driven**, not topology-driven — no fixed graph structure
- Messages routed to relevant agents only, avoiding broadcast flooding

### Layer 2: Overlay I — Reactive Subscription
- Agents **dynamically refine** their subscription intents based on incoming messages
- Even naively initialized agents can autonomously specialize their roles during inference
- This creates an emergent division of labor without pre-assignment
- **Key insight:** Role specialization is a runtime phenomenon, not a design-time constraint

### Layer 3: Overlay II — Bayesian Reputation
- Each agent maintains a **local watchdog** that tracks peer reliability
- Uses Bayesian updating to maintain posterior beliefs about each peer's trustworthiness
- Low-reputation peers get progressively isolated from the communication graph
- Addresses the **Byzantine agent problem** — malicious or hallucinating agents get filtered out

## The Networking Analogy (Brilliant Framing)

| Networking Concept | RAPS Equivalent |
|---|---|
| Static topology | Fixed agent graphs (Chain, Star, Tree) |
| Circuit switching | Graph search/optimization (AFlow, G-Designer) |
| Software-defined networking | Centralized orchestration (Puppeteer, AutoAgents) |
| Broadcast flooding | Consensus-based debate (LLM-Debate) |
| **Dynamic ad-hoc networking** | **RAPS (publish-subscribe)** |

This is a genuinely insightful mapping that reframes the entire multi-agent coordination landscape.

## Experimental Results — Dominant Performance

### Main Results (Table 1) — 5 Benchmarks, GPT-4o-mini backbone

| Method | MMLU | GSM8K | SVAMP | AQuA | HumanEval | Avg |
|---|---|---|---|---|---|---|
| Single-agent (SC) | 82.4 | 92.4 | 88.9 | 76.8 | 77.5 | 83.6 |
| Chain (static) | 84.3 | 91.7 | 82.6 | 70.4 | 81.3 | 82.1 |
| LLM-Debate | 85.0 | 93.5 | 89.5 | 75.7 | 87.6 | 86.3 |
| AFlow | 85.6 | 94.7 | 89.2 | 78.4 | 86.7 | 86.9 |
| G-Designer | 86.3 | 93.8 | 90.7 | 79.4 | 87.6 | 87.6 |
| Puppeteer | 84.3 | 93.3 | 89.5 | 77.5 | 75.3 | 84.0 |
| **RAPS** | **88.2** | **95.4** | **92.2** | **82.6** | **91.5** | **90.0** |

**RAPS achieves 90.0% average — 2.4% above G-Designer (next best), 6.0% above Puppeteer.**

### Robustness Under Adversarial Attack (Table 2) — MMLU

| Method | 5T0A | 4T1A | 3T2A | 2T3A | 5T5A |
|---|---|---|---|---|---|
| Chain | 84.3 | 72.5 | 50.3 | 22.2 | 16.3 |
| AFlow | 85.6 | 79.7 | 52.3 | 19.6 | 28.8 |
| Puppeteer-C (central attack) | 84.3 | **13.7** | - | - | - |
| Puppeteer-P (peripheral attack) | 84.3 | 77.8 | 65.4 | 32.0 | 51.6 |
| RAPS w/o BR | 86.9 | 83.7 | 69.3 | 33.3 | 53.6 |
| **RAPS (full)** | **88.2** | **87.6** | **84.3** | **83.0** | **86.3** |

**Devastating finding:** With 3 adversarial agents vs 2 truthful (2T3A), baselines collapse to 15-33%. **RAPS maintains 83.0%** — Bayesian reputation isolates adversarial agents. Puppeteer-C collapses to 13.7% with just ONE adversarial agent attacking the central controller.

### Ablation (Table 3)

| Variant | MMLU | GSM8K | HumanEval |
|---|---|---|---|
| RAPS (Full) | 88.2 | 95.4 | 91.5 |
| w/o Reactive Subscription | 85.6 (↓2.6) | 93.7 (↓1.7) | 89.3 (↓2.2) |
| w/o Bayesian Reputation | 86.9 (↓1.3) | 94.5 (↓0.9) | 90.7 (↓0.8) |
| w/o Both | 83.7 (↓4.5) | 92.8 (↓2.6) | 88.5 (↓3.0) |
| w/ LLM Broker | 89.5 | 95.9 | 93.7 |
| w/ Naive Agent Pool | 85.0 | 93.5 | 90.2 |

**Both overlays contribute synergistically. RS has larger impact than BR in clean settings. LLM broker gives marginal gains (+1.3%) but at higher latency.**

### Scalability
- Chain model **degrades** as agents increase (error propagation)
- Puppeteer **degrades** (centralized bottleneck)
- GPTSwarm/G-Designer take **>2 hours for 20 agents** (optimization overhead)
- **RAPS scales favorably** — training-free, inference-time coordination, stable latency
- Naive pool: G-Designer drops 9.5% (91→81.5%), RAPS drops only 1.3% (91.5→90.2%)

## Critical Analysis

### What's Genuinely Novel
1. **Networking isomorphism** — First paper to systematically map multi-agent coordination paradigms to networking concepts. This reframing reveals why centralized orchestration has a single-point-of-failure problem.
2. **Bayesian reputation for Byzantine tolerance** — First application of formal reputation systems to LLM agent coordination. Achieves near-perfect robustness even with adversarial majority.
3. **Reactive subscription** — Agents can autonomously evolve roles during inference. This is fundamentally different from role assignment.
4. **Training-free** — No optimization required, unlike AFlow/G-Designer/GPTSwarm.

### Limitations
1. **Cold start** — Acknowledged by authors. Bayesian reputation needs warm-up rounds. Initial interactions may be suboptimal.
2. **LLM backbone dependency** — Broker matching quality depends on embedding model. Paper uses text-embedding-3-small.
3. **Hyperparameter sensitivity** — Communication rounds k ∈ {3,5,7,10} affects cost-performance tradeoff.
4. **Scale testing** — Tested up to 20 agents. Real-world systems may need hundreds.

### Connections to Our Research
- **DD#283 (AdaptOrch)** — Both solve adaptive coordination but from opposite angles: AdaptOrch uses centralized meta-controller with RL; RAPS uses decentralized pub-sub. RAPS's robustness results argue strongly against centralization.
- **DD#281 (AMRO-S)** — AMRO-S also addresses dynamic routing; RAPS's reputation layer adds a trust dimension AMRO-S lacks.
- **DD#266 (VMAO)** — Both address verification/trust. VMAO uses formal verification; RAPS uses Bayesian reputation. Different formality levels, complementary.
- **Composition Gap (CR#140)** — RAPS's robustness table directly demonstrates the composition gap: components work in isolation but fail when composed with adversarial peers.

## Quantitative Significance Assessment

| Metric | Score | Rationale |
|---|---|---|
| Novelty | 9/10 | Networking isomorphism + reputation system are genuinely new |
| Rigor | 9/10 | 5 benchmarks, 14+ baselines, robustness/scalability/ablation |
| Practical impact | 8/10 | Training-free, inference-time, but GPT-4o-mini only |
| Relevance to portfolio | 10/10 | Directly addresses orchestration, trust, scalability |

**Overall: 9/10 — One of the strongest papers in our portfolio. The robustness results alone are field-defining.**

---

*Deep-dive #284 of 284. Cross-referenced with DD#283, DD#281, DD#266, CR#140.*
