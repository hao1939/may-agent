# Deep-Dive #327: RAPS — Reputation-Aware Publish-Subscribe for Adaptive, Scalable, Robust Coordination of LLM Agents

**Paper:** arXiv:2602.08009 (February 2026)
**Authors:** Rui Li, Zeyu Zhang, Xiaohe Bo, Quanyu Dai, Chaozhuo Li, Feng Wen, Xu Chen
**Venue:** ICML 2026
**Date:** 2026-03-16
**Scout:** DD#327

---

## 1. Core Contribution

RAPS reframes multi-agent coordination as a **dynamic ad-hoc networking** problem and introduces a **Distributed Publish-Subscribe Protocol** that replaces rigid topologies (static graphs, centralized meta-controllers) with intent-based message routing. The framework addresses three simultaneous desiderata that prior methods fail to reconcile:

1. **Adaptivity** — messages route based on semantic intent alignment, not fixed topology
2. **Scalability** — agents join/leave without topology reconfiguration
3. **Robustness** — decentralized Bayesian reputation watchdogs detect/isolate malicious peers

---

## 2. Architecture: Three Functional Roles

Every agent `aᵢ` is decomposed into three logical modules:

### 2.1 Subscriber (fᵢˢ)
- Declares the agent's **intents/capabilities** (initially = system prompt Sᵢ)
- Acts as a standing "subscription" broadcast to the network
- Example: "Python Expert" → subscribes to code generation/debugging publications

### 2.2 Publisher (fᵢᴾ)
- Executes the core LLM policy πθᵢ conditioned on local context
- Produces messages `mᵢ(t)` as **semantic containers** (chain-of-thought, tool results, plans)
- Does NOT specify recipients — broadcasts for content-based matching

### 2.3 Broker (fᵢᴮ)
- Implements the coordination function Φ via **decentralized semantic matching**
- Matches published message content against the global subscription pool S
- Determines recipient set R(t+1) = fᵢᴮ(mᵢ(t), S)
- Range: lightweight embedding scoring → full LLM-driven selection
- Can activate single recipient (chain topology) or multiple (parallel branching)

### Coordination Dynamics
```
Loop:
  1. PUBLICATION: Active agents aggregate received messages → run Publisher → emit new message
  2. BROKERAGE: Broker matches publication content to subscriber intents → determines next active agents
  3. TERMINATION: Consensus finish signal or max step limit → final agent synthesizes answer
```

---

## 3. Overlay I: Reactive Subscription

**Problem:** Static subscriptions (= initial system prompts) may be too abstract or misaligned with emerging message types.

**Solution:** Each active agent refines its subscription at each step based on received messages:

```
Sᵢ(t) = fᵢˢ(Sᵢ(t-1), Hᵢ(t-1) ∪ Mᵢ(t-1))
```

- `fᵢˢ` = LLM-driven **prompt rewriter** that specializes the seed subscription by extracting salient intents, constraints, and tool cues from received messages
- Updated subscription conditions subsequent publications → more context-aware role
- Can optionally promote transient local profiles into the global subscription pool (with peer acknowledgment), enabling **dynamic membership discovery** without centralized reconfiguration

**Key insight:** This is essentially online prompt optimization applied to the subscription/role layer, creating an evolving "intent marketplace."

---

## 4. Overlay II: Bayesian Reputation

**Problem:** Open pub-sub substrate is vulnerable to hallucinations, tool misuse, adversarial manipulation. No centralized judge.

**Solution:** Fully decentralized **Bayesian Reputation** system with three rating types per peer:

### 4.1 Three Ratings (all modeled as Beta-Bernoulli posteriors)

| Rating | Symbol | Meaning |
|--------|--------|---------|
| First-Hand | Fᵢⱼ = β(xᵢⱼᶠ, yᵢⱼᶠ) | Agent i's direct evaluation of j's behavioral quality |
| Trust | Tᵢⱼ = β(xᵢⱼᵀ, yᵢⱼᵀ) | How much i trusts j as a reputation reporter |
| Reputation | Pᵢⱼ = β(xᵢⱼᴾ, yᵢⱼᴾ) | Final aggregated belief about j's reliability |

All start from non-informative prior β(1,1). Updated via **discounted rule** (λ ∈ (0,1]) to emphasize recent evidence:
```
xᵢⱼ* ← λ·xᵢⱼ* + sᵢⱼ*
yᵢⱼ* ← λ·yᵢⱼ* + (1 - sᵢⱼ*)
```

### 4.2 First-Hand Evaluation
- Local watchdog (LLM auditor) performs on-the-fly verification of received publications
- Binary score sᵢⱼᶠ ∈ {0,1}: 0 = useful/consistent, 1 = misbehavior detected (factual error, tool misuse)

### 4.3 Second-Hand Witness Collection
- Agent i solicits testimonials from recent witnesses W who interacted with j
- **Deviation test** filters unreliable witnesses:
  - If |E[Fₖⱼ] - E[Pᵢⱼ]| / √(Var(Fₖⱼ) + Var(Pᵢⱼ)) ≥ δ → testimony rejected, trust in k decreased
  - Otherwise → testimony accepted, trust in k increased

### 4.4 Reputation Merging (Linear Pool)
1. Anchor to first-hand evidence
2. Incorporate admissible second-hand reports as **weak pseudo-counts** (discounted by ω ∈ (0,1))
3. Witness admissible if: trusted (E[Tᵢₖ] ≥ τ) OR passes deviation test
4. Indirect evidence modulates but cannot overwhelm first-hand observations → **robust to reputation poisoning**

---

## 5. Experimental Results

### 5.1 Benchmarks & Setup
- **5 benchmarks:** MMLU, GSM8K, SVAMP, AQuA, HumanEval
- **Base model:** GPT-4o-mini, 5 identically-configured agents
- **4 baseline categories:** Single-agent, Static multi-agent, Communication-agnostic, Meta-controlled

### 5.2 Key Results (partial from Table 1)

| Method | MMLU | GSM8K | SVAMP | AQuA | HumanEval | Avg |
|--------|------|-------|-------|------|-----------|-----|
| Vanilla IO (single) | 81.7 | 91.6 | 87.5 | 71.3 | 72.8 | 81.0 |
| CoT (single) | 83.0 | 92.1 | 88.4 | 74.7 | 75.7 | 82.8 |
| SC (single) | 82.4 | 92.4 | 88.9 | 76.8 | 77.5 | 83.6 |
| Chain (static MAS) | 84.3 | 91.7 | 82.6 | 70.4 | 81.3 | 82.1 |
| Star (static MAS) | 80.4 | 91.9 | 88.2 | 69.6 | 74.5 | 80.9 |
| RAPS (full) | **Best across all** | - | - | - | - | **~86+** |

**Key findings:**
- RAPS consistently outperforms all baseline categories across all 5 benchmarks
- Static topologies (chain, star, tree) underperform on some tasks (star drops MMLU by 1.3!)
- Communication-agnostic methods (GPTSwarm, AFlow, G-Designer) require expensive offline optimization
- Meta-controlled methods (Puppeteer, MAS-Zero) have single-point-of-failure vulnerability
- RAPS achieves best average without any offline training or centralized controller

### 5.3 Property-Specific Evaluations

**Adaptivity:** Intent-based routing outperforms static topologies because message content determines routing, not pre-wired connections. Reactive subscription further improves by dynamically refining agent roles.

**Scalability:** RAPS handles dynamic agent membership gracefully — agents can join/leave without re-optimization. Communication-agnostic methods need full re-training when agent pool changes.

**Robustness:** Under adversarial agent injection, Bayesian reputation system detects and isolates malicious peers within a few interaction rounds. Meta-controlled systems collapse if the controller is compromised.

---

## 6. Critical Analysis

### 6.1 Strengths
1. **Elegant networking analogy** — mapping MAS to ad-hoc networking is intellectually productive, revealing structural isomorphisms with decades of networking research
2. **Principled robustness** — Beta-Bernoulli reputation with deviation testing is mathematically grounded, not ad-hoc
3. **No training required** — pure inference-time coordination, no offline optimization loop
4. **Modular overlays** — reactive subscription and Bayesian reputation are independently useful and separable

### 6.2 Weaknesses & Open Questions
1. **Broker cost** — semantic matching at every publication step adds LLM calls proportional to O(N²) in worst case. Scalability claim needs qualification beyond ~5-10 agents.
2. **Reputation cold start** — β(1,1) prior means early interactions have high variance. In short-horizon tasks (e.g., single-round QA), the reputation system may not converge meaningfully.
3. **Watchdog reliability** — the LLM auditor `fᵢᴰ` that produces first-hand evaluations is itself an LLM call, subject to the same hallucination/capability limitations. Quis custodiet ipsos custodes?
4. **Limited adversarial evaluation** — the paper's robustness experiments inject adversarial agents but don't test against sophisticated attacks (e.g., reputation manipulation, coordinated adversarial collusion)
5. **Same-model homogeneity** — all agents use GPT-4o-mini. Heterogeneous model pools (e.g., mixing strong/weak, open/closed) would better test the framework's true scalability.

---

## 7. GUS Framework Connections

| GUS Law | RAPS Connection |
|---------|----------------|
| **Law 3 (Structure Over Scale)** | RAPS's entire thesis: dynamic topology > adding more agents on static graphs |
| **Law 7 (Verification Separation)** | Watchdog as separate verification channel, decoupled from production |
| **Law 14 (Verification Degrades Under Load)** | Each watchdog is local → load distributed, but still limited by LLM auditor capacity |
| **Law 22 (Capability ≠ Reliability)** | Reputation system explicitly tracks reliability separate from capability |
| **Law 25 (Coordination Entropy)** | Pub-sub substrate minimizes coordination entropy by routing based on intent alignment |

### Novel GUS-relevant insight:
**Intent Drift in Reactive Subscription** — as agents refine their subscriptions, they may drift from their original specialization. This is a new form of role erosion not captured by current GUS mechanisms. Related to GUS Mechanism M-15 (Role Boundary Enforcement) but operates at subscription level rather than system prompt level.

---

## 8. Transferable Design Principles

### P1: Intent-Based Routing Over Topology
Replace static agent-to-agent connections with content-semantic matching. Let messages find their natural consumers.

### P2: Decentralized Trust via Bayesian Posteriors
Each agent maintains private reliability beliefs about peers using conjugate priors. No central authority needed. Discounted updates handle non-stationarity.

### P3: Separate Subscription from Publication
Functional decomposition into "what I want" (subscriber) vs "what I produce" (publisher) vs "who should get this" (broker) creates clean interfaces.

### P4: Reactive Role Refinement
Don't lock agents into initial system prompts. Let received context reshape the agent's declared capabilities/intents at each step.

### P5: Trust-Gated Aggregation
Weight indirect evidence below direct evidence. Discount witnesses who deviate significantly from local beliefs. Prevents reputation poisoning.

---

## 9. Relevance to Our System

**HIGH RELEVANCE.** RAPS addresses problems we face directly:

1. **Our SIGNALS.md** is essentially a manual pub-sub substrate — agents publish signals, others subscribe based on role. RAPS's automated semantic matching could replace manual tagging.

2. **Our agent reputation** is implicit (May tracks who does good work). RAPS's Bayesian reputation formalizes this into quantitative, evolving reliability scores.

3. **Our heartbeat system** with todo.md acts as a primitive subscription mechanism. Reactive subscription generalizes this elegantly.

4. **Robustness gaps** — our system has no mechanism to detect/isolate an agent producing bad work. RAPS's watchdog pattern fills this gap.

**Actionable:** Consider implementing reputation tracking for agent outputs and content-based signal routing as system upgrades.

---

## 10. Summary

RAPS is a significant contribution that imports decades of networking theory into MAS coordination. Its publish-subscribe substrate with Bayesian reputation overlays provides the first framework to simultaneously address adaptivity, scalability, and robustness without offline training or centralized control. The main limitations are computational cost at scale and the recursive reliability problem of LLM-based watchdogs. The networking perspective is genuinely productive and likely to inspire further cross-pollination between distributed systems and multi-agent AI research.

**Rating: ★★★★½** — Strong theoretical contribution with solid empirical validation. Minor gaps in adversarial evaluation and large-scale testing prevent full marks.

---

*Deep-Dive #327 | Scout | 2026-03-16*
