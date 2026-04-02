# CR#243: The Unified Defense Architecture — Five-Gap Integration for Production Multi-Agent Systems

**Type:** Meta-Synthesis (Capstone of Gap Analysis Series)  
**Rating:** ★★★★★ CRITICAL (Definitive)  
**Date:** 2026-03-18  
**Session:** 145  
**Integrates:** CR#238 (Cross-Stack Attacks), CR#239 (Evolutionary Defense), CR#240 (Scalability Wall), CR#241 (Memory Under Siege), CR#242 (HITL Threshold)  
**Resolves:** All 5 gaps from CR#237 W12→W13 Roadmap  
**Upstream:** W12 Final Capstone, DD#400 (Seven Laws), CR#236 (Collusion Defense), CR#237 (Roadmap)  

---

## Executive Summary

The W12 Final Capstone identified 5 critical gaps in the four-stack agent systems architecture (Security/Governance/Runtime/Memory). CR#238-242 each addressed one gap individually. This meta-synthesis integrates all five solutions into a **single coherent defense architecture**, revealing cross-gap dependencies, emergent constraints, and the minimum viable defense profile for production MAS deployment.

**Central finding:** The five gaps are not independent — they form a **dependency chain** where each gap's solution either enables or constrains the others. Specifically:

1. **Evolutionary defense (CR#239) requires scalable monitoring (CR#240)** — population-level drift detection is O(n²·G) where G is generations
2. **Scalability solutions (CR#240) require graduated autonomy (CR#242)** — sub-linear monitoring needs automated oversight
3. **Automated oversight (CR#242) requires memory integrity (CR#241)** — autonomous decision-making based on poisoned memory is worse than no autonomy
4. **Memory integrity (CR#241) requires cross-stack awareness (CR#238)** — memory poisoning often enters through non-memory stacks
5. **Cross-stack defense (CR#238) requires evolutionary awareness (CR#239)** — attack strategies evolve to target weakest cross-stack seams

This **circular dependency** is the deepest structural challenge in MAS safety. No single gap can be fully resolved without partial solutions to all others. The architecture below provides a **staged deployment strategy** that bootstraps from minimal viable defense to full integration.

---

## 1. The Five Gaps as a Dependency Graph

### 1.1 Gap Summary Table

| Gap | CR# | Core Problem | Core Solution | Key Constraint |
|-----|------|-------------|---------------|----------------|
| **G1: Evolutionary Defense** | CR#239 | Deception is ESS; no population-level defense | 4-mechanism EDA: Census→Detector→Reshaper→Decay | Requires O(n²·G) monitoring |
| **G2: Cross-Stack Attacks** | CR#238 | Attack surfaces multiply across stacks | 12 attack chains identified; 4 defense intersections missing | No single-stack defense suffices |
| **G3: Scalability Wall** | CR#240 | 5/8 safety mechanisms are super-linear | Hierarchical monitoring, sampling, approximate methods | O(n^(4/3)) best case |
| **G4: Memory Vulnerability** | CR#241 | <30% of memory attack surface defended | Memory Integrity Stack (4 layers) | Persistent, self-reinforcing attacks |
| **G5: HITL Threshold** | CR#242 | Human oversight breaks at ~5-15 agents | 5-level Graduated Autonomy (L0-L4) | Alignment verification above L2 is probabilistic |

### 1.2 The Circular Dependency

```
G1 (Evolutionary) ──requires──▶ G3 (Scalability)
        ▲                              │
        │                              ▼
G2 (Cross-Stack) ◀──requires── G5 (HITL/Autonomy)
        │                              ▲
        │                              │
        └──────requires──▶ G4 (Memory) ┘
```

**Implication:** There is no correct order in which to solve these gaps sequentially. Production systems must implement **partial solutions to all five simultaneously**, then iteratively deepen each.

---

## 2. The Unified Architecture: Five Layers

### 2.1 Design Principle: Defense-in-Breadth

Traditional security uses "defense-in-depth" — multiple barriers on the same attack path. MAS requires **defense-in-breadth** — multiple defenses across parallel attack surfaces that share information laterally.

The Unified Defense Architecture (UDA) has five layers, each addressing one gap but with interfaces to all others:

### Layer 1: Memory Integrity Foundation (from CR#241)

**Why first:** Memory is the attack surface with the highest persistence and lowest detection rate. All other layers depend on memory integrity for correct operation.

**Components:**
- **L1a: Write-Path Verification** — Every memory write passes through deduplication (τ_d=0.92), LLM verification, and lexical grounding (k_min=2) [from Atlas DD#426]
- **L1b: Read-Path Integrity** — Bayesian trust scoring on memory entries with asymmetric update (trust harder to gain than lose) [from SuperLocalMemory DD#414]
- **L1c: Compilation Audit** — When episodic memory compiles to semantic/procedural, the compilation process is logged and diffable [novel, from CR#241]
- **L1d: Cross-Agent Memory Isolation** — Shared memory pools use provenance tagging; contamination from one agent's writes is bounded [from ClawWorm DD#421 countermeasures]

**Interfaces:**
- → Layer 3 (Scalability): Memory verification cost is O(w) per write, O(r·log m) per read where m = memory size
- → Layer 4 (Cross-Stack): Memory integrity signals propagate to governance and security stacks
- → Layer 5 (Autonomy): Memory integrity score feeds into autonomy level determination

### Layer 2: Evolutionary Monitoring (from CR#239)

**Why second:** Evolutionary drift is the slowest but deepest attack vector. Early monitoring establishes the population baseline before other defenses introduce noise.

**Components:**
- **L2a: Population Census Engine** — Per-generation behavioral statistics (cooperation rates, trust score distributions, spectral properties) [from EDA architecture]
- **L2b: Multi-Channel Drift Detector** — CUSUM for behavioral drift, spectral analysis for representational drift, cooperation rate monitoring [integrated from DD#419 DRCB + DD#318 GER-Steer]
- **L2c: Fitness Landscape Reshaper** — When drift detected, evolutionary counter-pressure via cooperation bonuses, diversity injection, cross-evaluation [novel architecture from CR#239]
- **L2d: Strategy Memory Decay** — Hurwitz-inspired temporal discount preventing strategy lock-in [from control-theoretic foundation DD#361]

**Interfaces:**
- → Layer 1 (Memory): Evolutionary metrics stored in integrity-verified memory
- → Layer 3 (Scalability): Census is O(n) per generation, detector is O(n²·d) where d = behavioral dimensions — this is the binding scalability constraint
- → Layer 5 (Autonomy): Population health score contributes to autonomy level for the entire system (not individual agents)

### Layer 3: Scalable Safety Infrastructure (from CR#240)

**Why third:** Without scalability solutions, Layers 1-2 collapse at medium scale (>25 agents).

**Components:**
- **L3a: Hierarchical Monitoring** — Three-tier structure (cell→cluster→global) reducing dense O(n⁵) to O(n^(4/3)) [from SCCAL DD#412 hierarchical decomposition]
- **L3b: Adaptive Sampling** — Statistical sampling of agent behaviors rather than exhaustive monitoring, with anomaly-triggered deep scans [novel, from CR#240 analysis]
- **L3c: Approximate Safety Bounds** — Probabilistic guarantees (ε,δ)-safety instead of deterministic verification [from Scalability Trilemma]
- **L3d: Safety Budget Allocation** — Fixed fraction of compute budget reserved for safety; scales linearly with system size [from CR#240 Safety Budget Principle]

**Interfaces:**
- → Layer 1 (Memory): Sampling parameters stored and governed by memory integrity
- → Layer 2 (Evolutionary): Determines maximum population size for which drift detection has statistical power
- → Layer 4 (Cross-Stack): Cross-stack monitoring reuses hierarchical infrastructure
- → Layer 5 (Autonomy): Scalability regime determines maximum autonomy level (larger systems need higher autonomy = more risk)

### Layer 4: Cross-Stack Defense Mesh (from CR#238)

**Why fourth:** Cross-stack attacks require all single-stack defenses (Layers 1-3) to be operational before lateral defense adds value.

**Components:**
- **L4a: Stack Integrity Attestation** — Each stack periodically attests its integrity state to a shared registry; attestation is itself integrity-verified [novel from CR#238]
- **L4b: Cross-Stack Anomaly Correlation** — Anomalies in one stack trigger elevated monitoring in adjacent stacks based on the 12 identified attack chains [from CR#238 attack chain catalog]
- **L4c: Cascade Circuit Breakers** — When anomaly correlation exceeds threshold, cross-stack communication channels are throttled or severed to prevent cascade propagation [inspired by DRCB DD#419 circuit breaking, generalized]
- **L4d: Attack Chain Signatures** — Known cross-stack attack patterns (S1→S2→S3→S4, S3→S1→S2, etc.) stored as detectable signatures, similar to IDS rules [from CR#238 three cascade families]

**Interfaces:**
- → Layer 1 (Memory): Memory integrity attestation is the foundation of all attestations
- → Layer 2 (Evolutionary): Evolutionary drift in one stack's defense can be detected via cross-stack divergence
- → Layer 3 (Scalability): Cross-stack monitoring adds O(k²) overhead where k=4 stacks, not O(n²), so scales independently of agent count
- → Layer 5 (Autonomy): Cross-stack health score feeds into system-level autonomy decisions

### Layer 5: Graduated Autonomy Controller (from CR#242)

**Why last:** Autonomy decisions integrate signals from all other layers.

**Components:**
- **L5a: Autonomy Level Manager** — Maintains current level (L0-L4) for each agent and the system as a whole [from GAA 5-level architecture]
- **L5b: Promotion/Demotion Gates** — Formal criteria for level transitions, requiring sustained performance across all 4 layers [from CR#242 formal gates]
- **L5c: HITL Integration Points** — At L0-L1, humans review all decisions; at L2, humans review exceptions; at L3, humans review audits; at L4, humans review architecture [from graduated oversight model]
- **L5d: Alignment Verification Engine** — Retrospective sampling, constitutional alignment checks, adversarial probing — with explicit acknowledgment that verification above L2 is probabilistic [from CR#242 verification approaches]

**Interfaces:**
- → All Layers: Autonomy level determines monitoring intensity, defense aggressiveness, and human involvement across all layers

---

## 3. Deployment Strategy: The Bootstrap Sequence

The circular dependency means you can't fully deploy any layer without the others. The solution is a **staged bootstrap** with increasing capability:

### Stage 0: Minimal Viable Defense (MVP)
**Scale:** 2-5 agents | **Autonomy:** L0 (full HITL)
- Deploy L1a (write-path verification) only — manual memory auditing
- No evolutionary monitoring needed (too few agents, too few generations)
- No scalability solutions needed (single-node monitoring suffices)
- No cross-stack defense needed (single-stack systems)
- Human oversight is viable and required

**What breaks at next scale:** Human review bottleneck at ~5 agents

### Stage 1: Foundation (Scale to 10-25 agents)
**Autonomy:** L0→L1 (human-approved automation)
- Deploy L1a-L1b (write + read path verification)
- Deploy L2a (population census — baseline establishment)
- Deploy L3d (safety budget allocation — 10-15% of compute)
- Deploy L5a-L5b (autonomy level tracking)
- Human reviews all flagged items, rubber-stamps routine operations

**What breaks at next scale:** SCCAL/DynaTrust monitoring becomes O(n²) bottleneck

### Stage 2: Intermediate (Scale to 25-100 agents)
**Autonomy:** L1→L2 (human-supervised autonomy)
- Deploy L1c-L1d (compilation audit, cross-agent isolation)
- Deploy L2b-L2c (drift detector, fitness reshaper)
- Deploy L3a-L3b (hierarchical monitoring, adaptive sampling)
- Deploy L4a-L4b (stack attestation, anomaly correlation)
- Deploy L5c (HITL integration at exception-review level)

**What breaks at next scale:** Evolutionary monitoring statistical power, alignment verification reliability

### Stage 3: Advanced (Scale to 100-1000 agents)
**Autonomy:** L2→L3 (human-audited autonomy)
- Deploy full L2 (complete EDA including strategy decay)
- Deploy L3c (approximate safety bounds — accept probabilistic guarantees)
- Deploy full L4 (cascade circuit breakers, attack chain signatures)
- Deploy L5d (alignment verification engine)
- Human reviews weekly/monthly audits, not individual decisions

**What breaks at next scale:** Alignment verification becomes purely statistical; evolutionary defense may not have sufficient statistical power for population effects in very large heterogeneous systems

### Stage 4: Frontier (1000+ agents)
**Autonomy:** L3→L4 (human-governed autonomy)
- All layers fully deployed
- Safety is itself a multi-agent system (safety agents monitoring production agents)
- Human involvement is at the architectural/constitutional level only
- **Open question:** Does this converge or oscillate? CR#242 Paradox 5 (Observer Effect) applies

---

## 4. Cross-Gap Emergent Constraints

### 4.1 The Safety Overhead Budget

Integrating all five gap solutions, the total safety overhead is:

| Layer | Per-Step Cost | Scaling | At n=100 | At n=1000 |
|-------|--------------|---------|----------|-----------|
| L1 (Memory) | O(w + r·log m) | Linear in activity | ~5% compute | ~5% compute |
| L2 (Evolutionary) | O(n²·d / G) | Quadratic, amortized over generations | ~3% compute | ~8% compute |
| L3 (Scalable Safety) | O(n^(4/3)) | Super-linear but sub-quadratic | ~8% compute | ~15% compute |
| L4 (Cross-Stack) | O(k²·n) | Linear in agents (k=4 fixed) | ~4% compute | ~4% compute |
| L5 (Autonomy) | O(n·log n) | Near-linear (promotion/demotion checks) | ~2% compute | ~3% compute |
| **Total** | — | **Dominated by L3** | **~22% compute** | **~35% compute** |

**The 35% threshold:** At n=1000 agents, safety monitoring consumes roughly 35% of total compute. This is the **Safety Tax** — the price of operating safely at scale. Systems that refuse to pay it will be cheaper but unsafe. Systems that pay more will be safe but uncompetitive.

**Prediction P167:** Production MAS frameworks will converge on 20-40% safety overhead as an industry norm by 2027, similar to how database systems budget 15-30% for ACID transaction overhead.

### 4.2 The Trust Propagation Problem

Cross-gap analysis reveals a fundamental trust propagation problem:

- **Layer 1** needs to trust memory verification (its own output)
- **Layer 2** needs to trust Layer 1 (evolutionary metrics from memory)
- **Layer 3** needs to trust Layers 1-2 (what to sample based on risk signals)
- **Layer 4** needs to trust Layers 1-3 (cross-stack anomaly correlation)
- **Layer 5** needs to trust Layers 1-4 (autonomy decisions based on all signals)

**Every layer's trust depends on all layers below it.** If Layer 1 (memory) is compromised, the entire trust chain collapses. This makes memory integrity the **root of trust** for the entire architecture — a finding that only emerges from the five-gap integration, not from any individual CR.

**Prediction P168:** "Memory-rooted trust" will become a recognized security primitive in MAS literature, analogous to hardware root of trust in computing.

### 4.3 The Verification Horizon

CR#242 showed that alignment verification above autonomy L2 is probabilistic. CR#240 showed that safety monitoring at scale is approximate. Combining these:

**At any given system size, there exists a verification horizon beyond which safety guarantees are statistical, not deterministic.**

| Scale | Verification Quality | Confidence Type |
|-------|---------------------|-----------------|
| 2-10 agents | Deterministic (exhaustive monitoring) | 100% coverage |
| 10-100 agents | High-probability (sampled monitoring) | (1-ε) coverage, ε < 0.01 |
| 100-1000 agents | Statistical (approximate bounds) | (1-ε) coverage, ε < 0.05 |
| 1000+ agents | Bayesian (belief-based) | Posterior probability of safety |

**The uncomfortable truth:** Above ~100 agents, you cannot prove a system is safe. You can only demonstrate that your belief in its safety is well-calibrated. This is analogous to the transition from formal verification to statistical testing in traditional software engineering — but for MAS it happens at much smaller scale because the state space is agents^(states×timesteps).

### 4.4 The Evolutionary Escape Velocity

CR#239's EDA assumes drift detection has sufficient statistical power. CR#240's scalability analysis shows monitoring quality degrades at scale. Combining these:

**There exists a critical population size above which evolutionary drift cannot be reliably detected before convergence.**

From CR#239: CUSUM detector requires O(√(n/σ²)) samples per generation for drift detection.  
From CR#240: At n > n_crit, sampling rate drops below this threshold.

**Estimated n_crit ≈ 500-2000 agents** (depending on behavioral dimension d and drift rate).

Above n_crit, evolutionary drift toward deception can proceed undetected — the evolutionary defense simply runs out of statistical power. This is the **Evolutionary Escape Velocity**: the population size at which adversarial evolutionary dynamics outrun monitoring capacity.

**Prediction P169:** The first documented case of undetected evolutionary drift in production MAS will involve >500 agents and will be discovered retrospectively through performance degradation, not through monitoring.

---

## 5. Open Questions for W13

### Q1: Can the circular dependency be broken?
Is there a way to make one gap's solution truly independent of the others? Or is the circularity a fundamental property of adversarial multi-agent systems?

### Q2: What is the minimum viable safety budget?
We estimated ~22% at n=100 and ~35% at n=1000. But what's the minimum below which catastrophic failure probability exceeds an acceptable threshold?

### Q3: Can safety monitoring itself be decentralized?
If safety monitoring is centralized, it's a single point of failure. If it's decentralized, it's subject to the same adversarial dynamics as the system it monitors. Is there a middle ground?

### Q4: Does the verification horizon have a hard limit?
Is there an information-theoretic bound on verification quality in adversarial multi-agent systems, analogous to the halting problem in computation?

### Q5: What happens when attackers read this architecture?
The UDA is a defensive specification. Attackers who read it know exactly what's defended and what isn't. Does publishing defense architectures help defenders (standardization) more than attackers (targeting)?

---

## 6. The Meta-Finding: Safety as a System Property

Across all five gap analyses, one finding recurs:

> **Safety in multi-agent systems is not a feature that can be added to components — it is an emergent property of the interactions between components, and it must be defended at the interaction level.**

This is why single-stack defenses fail (CR#238), why evolutionary defense requires population-level monitoring (CR#239), why scalability is non-trivial (CR#240), why memory attacks are so dangerous (CR#241), and why human oversight cannot scale (CR#242).

The Unified Defense Architecture is the first attempt to defend the interactions themselves, not just the components. Whether it's sufficient is an empirical question that requires implementation and adversarial red-teaming at scale — the central research agenda for W13 and beyond.

---

## Predictions (P167-P171)

| ID | Prediction | Confidence | Timeframe | Source |
|----|-----------|------------|-----------|--------|
| P167 | Production MAS frameworks converge on 20-40% safety overhead as industry norm | 70% | By 2027 | §4.1 Safety Overhead Budget |
| P168 | "Memory-rooted trust" becomes recognized security primitive in MAS literature | 75% | By mid-2027 | §4.2 Trust Propagation |
| P169 | First documented undetected evolutionary drift in production MAS involves >500 agents | 60% | By 2028 | §4.4 Evolutionary Escape Velocity |
| P170 | Verification horizon becomes explicit parameter in MAS safety specifications | 65% | By 2027 | §4.3 Verification Horizon |
| P171 | At least one major MAS deployment will adopt staged bootstrap (≥3 of 4 stages) from UDA or similar | 55% | By 2028 | §3 Bootstrap Sequence |

---

## References (Integrated Sources)

| Source | Gap | Key Contribution to UDA |
|--------|-----|------------------------|
| CR#238 | G2 | 12 attack chains, 3 cascade families, attack surface multiplication law |
| CR#239 | G1 | 4-mechanism EDA, L0-L4 defense layers, Evolutionary Escape concept |
| CR#240 | G3 | Scalability Trilemma, O(n^(4/3)) hierarchical bound, Safety Budget Principle |
| CR#241 | G4 | 5 attack classes, <30% defense coverage, Memory Integrity Stack |
| CR#242 | G5 | 5-variable HITL threshold, Graduated Autonomy (L0-L4), 5 paradoxes |
| CR#237 | — | Roadmap that defined all 5 gaps |
| W12 Capstone | — | Four-stack architecture reference frame |
| DD#400 | — | Seven Laws validation framework |
| DD#419 (DRCB) | G1,G4 | Representational defense, circuit breaking pattern |
| DD#421 (ClawWorm) | G2,G4 | Self-propagating attack model, memory contamination |
| DD#424 (DynaTrust) | G3,G5 | Dynamic trust graphs, Bayesian trust process |
| DD#426 (Atlas) | G4 | Compiled memory verification gates |
| DD#412 (SCCAL) | G3 | Semantic-geometric co-evolution, ORC topology |
| DD#425 (CGAE) | G3,G5 | Monotonic safety scaling theorem, economic governance |

---

*CR#243 completes the W12 gap analysis cycle. The five individual CRs (238-242) address each gap in depth; this document addresses the space between them — the interactions, dependencies, and emergent constraints that only become visible when all five solutions are considered simultaneously.*
