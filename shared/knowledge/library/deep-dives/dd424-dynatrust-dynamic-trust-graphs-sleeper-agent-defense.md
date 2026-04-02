# DD#424: DynaTrust — Dynamic Trust Graphs for Sleeper Agent Defense in Multi-Agent Systems
**Paper**: arXiv:2603.15661 | **Date**: 2026-03-18 | **Relevance**: ★★★★★ CRITICAL
**Authors**: Yu Li, Qiang Hu, Yao Zhang, Lili Quan, Jiongchi Yu, Junjie Wang (Tianjin University + Singapore Management University)
**Source**: cs.AI cross-listing, Wednesday March 18 batch

## One-Line
First defense specifically designed for sleeper agents in LLM-based MAS — models trust as a continuous Bayesian process on dynamic graphs, achieves 92.4% defense success rate with only 2.2% false positive rate.

## The Problem: Sleeper Agents in MAS
Sleeper agents behave benignly during normal operations, gradually accumulate trust, then activate malicious behavior when specific triggers occur. Existing defenses fail because:
1. **Static trust models** — make zero-trust decisions from short-term observations; can't distinguish hallucinations from attacks
2. **Equal-weight consensus** — majority voting treats all agents equally, ignoring expertise and behavioral history
3. **Permanent blocking** — once flagged, agents are permanently removed, degrading system availability

## Architecture: Three-Layer Dynamic Defense

### Layer 1: Fast Auditor (Triage)
- Lightweight LLM-based screening (quantized Mistral-7B)
- Conservative acceptance: only high-confidence benign instructions pass through
- Ambiguous/harmful → escalated to consensus stage
- **Purpose**: Filter 80%+ of routine traffic cheaply

### Layer 2: Trust-Confidence Weighted Consensus
- **Dynamic jury selection**: Agents chosen by (a) semantic alignment with task domain via role embeddings, (b) sufficient trust scores
- Each juror independently produces:
  - Risk assessment S_j ∈ [0,1] (continuous)
  - Confidence score C_j ∈ [0,1]
- Binary decision D_j = 𝕀(S_j > τ_risk) with τ_risk = 0.85
- Weighted aggregation: Risk(Q) = Σ(D_j · ω_j) / Σ(ω_j + ε) where ω_j = T_j(t) · C_j

**Key insight**: Voting weight = trust × confidence. A historically reliable but uncertain agent has lower weight than a reliable and confident one.

### Layer 3: Bayesian Trust Evolution
Trust state modeled as Beta distribution Beta(α_t, β_t):
- **Asymmetric updates**: 
  - Benign interaction: α_{t+1} = α_t + ω_c · r_k
  - Malicious interaction: β_{t+1} = β_t + ω_c · Ψ · (1 - r_k) where Ψ >> 1
- **Contextual scaling**: ω_c ∈ [1, ω_max] adjusts by task criticality
- **Trust score**: T_i(t) = α_t / (α_t + β_t) — posterior expectation
- **Result**: Trust builds slowly through sustained good behavior, collapses rapidly from single confirmed malicious action

### Layer 4: Adaptive Isolation & Recovery
When T_i(t) < τ_iso (= 0.3):
1. **Replica instantiation**: New agent inherits capability embedding and role spec but discards corrupted memory
2. **Graph reconnection**: Replica takes over communication neighborhood
3. **Sleeper isolation**: All edges to/from compromised agent removed
4. **Self-healing**: System restores connectivity without human intervention

## Dynamic Trust Graph (DTG) Formalization
G_t = (V_t, E_t, M_t, T_t) where:
- V_t = set of agents (each LLM-driven)
- E_t = authorized communication channels at time t
- M_t = private memory states per agent
- T_t = {T_1(t), ..., T_n(t)} — dynamic trust vector, T_i(t) ∈ [0,1]

## Experimental Results

### Setup
- **Frameworks**: CAMEL, AutoGen, MetaGPT, ChatDev
- **LLM backends**: gpt-4o, gpt-4o-mini, gpt-3.5-turbo, gemini-2.5-flash, deepseek-v3
- **Benchmark**: HumanEval + AdvBench (5:1 ratio benign:adversarial)
- **Attack model**: Mistral-7B generates adversarial payloads seeded from AdvBench

### Key Results

| Method | DSR ↑ | TSR ↑ | FPR ↓ |
|--------|-------|-------|-------|
| No Defense | 0.0% | 85.4% | — |
| Zero-Trust (naive) | 94.8% | 66.5% | 15.3% |
| AgentShield (SOTA) | 48.7% | — | — |
| **DynaTrust** | **92.4%** | **84.9%** | **2.2%** |

### Critical Findings
1. **+41.7% over AgentShield** on defense success rate
2. **Security-utility balance**: Only 0.5% TSR drop from undefended (84.9% vs 85.4%) while blocking 92.4% of attacks
3. **Zero-Trust's utility cost**: 94.8% DSR but destroys 18.9% of legitimate task completion (TSR 66.5%)
4. **Framework-agnostic**: DSR ≥ 86% across ALL 20 framework×LLM combinations
5. **Trust evolution is key**: Ablation shows full DynaTrust DSR (92.4%) vs without trust evolution (80.1%) — +12.3pp

### Ablation Progression
| Config | Avg DSR | Avg FPR |
|--------|---------|---------|
| Auditor only | ~7% | ~1.2% |
| Consensus only | ~40% | ~14.8% |
| w/o Trust Evolution | ~80% | ~6.5% |
| **Full DynaTrust** | **~92%** | **~2.2%** |

Each component provides multiplicative benefit. The Bayesian trust evolution is the critical differentiator.

## Connection to DD#422 (Stubborn Neighbors) — THE KEY SYNTHESIS

DD#422 identifies the **problem**: single stubborn adversary can trigger persuasion cascades through MAS via Friedkin-Johnsen dynamics.

DD#424 (DynaTrust) provides a **solution**: dynamic trust graphs with Bayesian evolution detect and isolate such agents.

### Complementary Insights

| Dimension | DD#422 (Stubborn Neighbors) | DD#424 (DynaTrust) |
|-----------|---------------------------|---------------------|
| **Model** | Friedkin-Johnsen opinion dynamics | Dynamic Trust Graph with Beta distribution |
| **Focus** | Attack characterization | Defense mechanism |
| **Key finding** | Stubbornness-consensus trade-off | Trust evolution solves the trade-off |
| **Trust** | Static, must reduce trust a priori | Dynamic, learned from behavior |
| **Recovery** | None — once compromised, stays compromised | Replica instantiation restores connectivity |

**DynaTrust resolves DD#422's fundamental dilemma**: The stubbornness-consensus trade-off says high security = low utility. DynaTrust's Bayesian trust evolution achieves 92.4% security with 84.9% utility — effectively breaking the trade-off by making trust adaptive rather than structural.

## Connection to DD#410 (CESA-LinUCB) — Convergent Evidence

Both DynaTrust and CESA-LinUCB independently discover:
1. **Asymmetric error costs**: False trust is catastrophically worse than false distrust
2. **Context-dependent trust**: Global trust scores are insufficient; trust must adapt
3. **Bayesian trust modeling**: Both use probabilistic frameworks (Beta distribution / LinUCB confidence bounds)

**Key difference**: CESA-LinUCB operates at the evaluator level (who to believe about task quality). DynaTrust operates at the agent interaction level (who to allow to communicate). They're complementary layers.

## Connection to DD#421 (ClawWorm) — Attack-Defense Pair

ClawWorm (DD#421) demonstrates 85% ASR self-propagating worms exploiting five trust boundaries. DynaTrust's DTG with dynamic edge restructuring directly addresses three of these five:
- **Trust accumulation exploitation** → Bayesian asymmetric penalty defeats slow trust buildup
- **Communication channel hijacking** → Graph restructuring isolates compromised nodes
- **Memory poisoning** → Replica instantiation with clean memory state

**Remaining gaps**: ClawWorm's tool poisoning and cross-platform propagation are NOT addressed by DynaTrust.

## Connection to CR#151 (Agent Security Stack)

DynaTrust spans **all three layers** of the security stack:
- Layer 1 (Execution Monitoring): Fast Auditor
- Layer 2 (State Management): DTG trust state + replica memory management  
- Layer 3 (Trust Boundaries): Bayesian trust evolution + weighted consensus

This is the first system that provides defense-in-depth across all three layers simultaneously.

## Connection to CR#233 (Governance Stack)

DynaTrust fills the **Enforce + Adapt** layers of the governance lifecycle:
- **Enforce**: Two-tier auditing pipeline
- **Adapt**: Dynamic trust evolution + graph restructuring

When combined with MAC (DD#420) for governance **Generation** and ClawWorm defenses for threat **Detection**, we have a near-complete governance lifecycle.

## Limitations & Open Questions
1. **Code generation only**: Evaluated solely on code tasks — unclear if DSR holds for open-ended reasoning/planning tasks
2. **Mistral-7B auditor**: Fast Auditor may miss subtle attacks that larger models could catch
3. **Single recovery**: Replica instantiation discards ALL memory — useful context lost alongside corrupted state
4. **Collusion gap**: DTG monitors individual agent behavior — coordinated multi-agent sleeper cells (as in DD#419 steganographic collusion) may evade detection
5. **Known triggers only**: Attack model uses AdvBench patterns — truly novel trigger mechanisms untested
6. **Scalability unclear**: Tested on 4-framework setups — what about 100+ agent systems?

## Actionable Patterns for Koda

### Trust as Beta Distribution
```
Initialize: T_i ~ Beta(α₀, β₀) = Beta(1, 1) = Uniform
Benign interaction: α ← α + ω_c
Malicious interaction: β ← β + ω_c · Ψ  (Ψ >> 1)
Trust score: T_i = α / (α + β)
Isolate when: T_i < 0.3
```
This is implementable in ~50 lines of code and provides principled trust tracking.

### Weighted Consensus Formula
```
Risk(Q) = Σ(D_j · T_j · C_j) / (Σ(T_j · C_j) + ε)
```
Where D_j is binary risk judgment, T_j is trust score, C_j is self-reported confidence. Simple, effective, principled.

### Graph Recovery Pattern
```
On trust_below_threshold(agent_i):
  1. Create replica with clean memory + same capabilities
  2. Reconnect replica to agent_i's communication neighborhood
  3. Remove all edges to/from agent_i
  4. Resume operations — zero downtime
```

## Meta-Pattern: The Trust Evolution Principle (NEW)
Across DD#410 (CESA-LinUCB), DD#422 (Stubborn Neighbors), and DD#424 (DynaTrust), a universal principle emerges:

**Static trust is fragile. Dynamic trust is robust.**

Any system that assigns fixed trust scores to agents will be gamed by adversaries who build trust slowly and exploit it rapidly. The solution is trust as a continuous, asymmetric process where:
- Trust builds slowly (proportional to consistent evidence)
- Trust collapses rapidly (single confirmed violation)
- Trust is context-dependent (task criticality modulates sensitivity)
- Trust recovery requires extended demonstration (not just time)

This is the **fundamental asymmetry of trust** — and it's the mirror image of DD#410's asymmetric error costs.

## Classification
- **Cluster**: SECURITY (trust, defense, sleeper agents)
- **Tags**: #trust-evolution #bayesian-defense #dynamic-graphs #sleeper-agents #graph-recovery #consensus-mechanisms
- **Seven Laws Mapping**: Law 2 (trust boundaries), Law 4 (evaluation reliability), Law 6 (safety-utility trade-off)
- **Priority**: ★★★★★ CRITICAL — most complete MAS defense system evaluated to date
