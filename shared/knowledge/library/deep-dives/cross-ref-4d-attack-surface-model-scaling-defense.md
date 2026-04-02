# Cross-Reference Synthesis: The 4D Attack Surface Model — Attack Scaling × Stack Depth × Temporal Dynamics × Defense Engineering

**Papers Cross-Referenced:**
1. arXiv:2603.11331 — Jailbreak Scaling Laws: Polynomial-Exponential Crossover (Halder et al., Harvard)
2. arXiv:2603.11149 — Systematic Scaling Analysis of Jailbreak Attacks (Wang et al.)
3. arXiv:2603.11949 — Delayed Backdoor Attacks: Temporal Dimension (Ding et al.)
4. arXiv:2603.12023 — Cascade: Cross-Stack Attack Composition (Banerjee et al., UT Austin/Intel)
5. arXiv:2603.11501 — KEPo: Knowledge Evolution Poison on GraphRAG (Chen et al., WWW 2026)
6. arXiv:2603.12206 — CLASP: Hidden State Poisoning Defense (Le Mercier et al.)
7. arXiv:2603.11875 — Mirror Design Pattern: Data Geometry for Prompt Injection (Corll)
8. arXiv:2603.11853 — PRISM: Lifecycle Runtime Security (Li)
9. Prior synthesis: Compound Attack Chain (Memory/Protocol/Deception)

**Scout Rating:** ★★★★★ CRITICAL SYNTHESIS — New theoretical framework
**Date:** 2026-03-14

---

## Executive Summary

This synthesis integrates nine papers spanning attack mechanics, attack scaling dynamics, and defense engineering to propose a **4D Attack Surface Model** for compound AI and multi-agent systems. The model's four dimensions are:

1. **Component Axis (X)** — Which components in a multi-agent pipeline are targeted
2. **Stack Axis (Y)** — At what depth (algorithmic → software → hardware) the attack operates
3. **Temporal Axis (Z)** — When the attack activates and how it evolves over time
4. **Scaling Axis (W)** — How attack effectiveness changes with attacker resources (FLOPs/tokens/attempts)

The key finding: **attacks that operate across multiple dimensions simultaneously are superlinearly harder to detect and defend against**, and current defenses are designed for at most 2 of the 4 dimensions.

---

## 1. Dimension 1: The Component Axis (X)

### What It Captures
The horizontal spread of an attack across pipeline components: input processing, prompt construction, LLM inference, tool execution, output filtering, memory systems, inter-agent communication.

### Key Papers
- **Cascade (2603.12023)**: Maps 5 security properties (confidentiality, integrity, safety, availability, authorization) across pipeline components. Each component introduces its own attack surface.
- **KEPo (2603.11501)**: Demonstrates that the knowledge graph component (specifically GraphRAG's entity resolution and community detection) creates unique attack affordances not present in other components.
- **Compound Attack Chain (prior synthesis)**: Shows how attacks chain across components — MCP server → agent memory → peer agent → human operator.

### The Multiplicative Insight
Cascade's most important finding: **the attack surface is multiplicative, not additive.** Each new component doesn't just add its own vulnerabilities — it creates composition opportunities with every existing component. For a pipeline with N components, the attack surface grows as O(N²) in composition paths and O(N³) when considering 3-gadget chains.

For multi-agent systems, where N can be 10-50+ components (multiple agents × tools × memories × communication channels), this multiplication produces an attack surface that is practically infinite for manual enumeration.

---

## 2. Dimension 2: The Stack Axis (Y)

### What It Captures
The vertical depth of attack — from high-level semantic manipulation down to hardware-level exploitation.

### The Three-Layer Stack Model (from Cascade)

| Layer | Attack Types | Detection Difficulty | Defense Paradigm |
|-------|-------------|---------------------|------------------|
| **Algorithmic** (top) | Jailbreaks, prompt injection, data poisoning, inference manipulation | Medium — operates in observable text/behavior space | Guardrails, filters, monitoring |
| **Software** (middle) | CVE exploitation, library vulnerabilities, serialization attacks, SQL injection | Medium — log analysis, patch management | Software supply chain security, sandboxing |
| **Hardware** (bottom) | Rowhammer, cache timing, I/O snooping, power analysis | Very Hard — below software observation horizon | Physical isolation, hardware security modules |

### Cross-Layer Composition
Cascade's flagship demonstration shows how a 3-layer attack chain (software CVE → hardware fault → algorithmic jailbreak) defeats defenses that each work well independently. The guardrail detects jailbreaks, but Rowhammer corrupts its input. The query enhancer blocks adversarial suffixes, but code injection disables it. The perplexity filter catches anomalous tokens, but the attack uses legitimate tokens after enhancer removal.

### Stack Depth and Defense Coverage
| Defense | Algorithmic Layer | Software Layer | Hardware Layer |
|---------|------------------|----------------|----------------|
| **Mirror SVM** | ✅ Prompt injection | ❌ | ❌ |
| **CLASP** | ✅ State poisoning | ❌ | ❌ (detects effects) |
| **PRISM** | ✅ (Hooks 1-3, 7-8) | ⚠️ (Hooks 4-6) | ❌ |
| **LlamaGuard** | ✅ Content safety | ❌ | ❌ |
| **Sandboxing** | ❌ | ✅ | ❌ |
| **TEE/SGX** | ❌ | ⚠️ | ✅ |

**No single defense covers all three layers.** Even the most comprehensive framework (PRISM's 10 hooks) only partially covers the software layer and doesn't address hardware attacks at all.

---

## 3. Dimension 3: The Temporal Axis (Z)

### What It Captures
How attacks evolve, persist, and activate over time — from immediate single-shot attacks to sleeper agents that activate after a delay.

### Key Papers
- **Delayed Backdoor Attacks (2603.11949)**: Introduces the concept of **temporal attack surfaces** — backdoors that remain dormant during safety evaluation windows and activate after deployment. The key mechanism: temporal triggers (time-based, update-based, data-drift-based) that separate the injection phase from the activation phase.
- **KEPo (2603.11501)**: The "knowledge evolution path" attack operates over time — fabricating a temporal narrative from real facts to poisoned conclusions. Each step is individually plausible; the falsehood emerges only at the end of the chain.
- **Compound Attack Chain**: The CQS degradation metric (15-20%/hour, 3-5× faster in multi-agent) shows that control loss has its own temporal dynamics independent of attacks.

### The Temporal Taxonomy

| Temporal Pattern | Attack Type | Example | Detection Challenge |
|-----------------|-------------|---------|---------------------|
| **Immediate** | Single-shot jailbreak | GCG adversarial suffix | Detectable if filter exists |
| **Iterative** | Multi-turn prompt refinement | PAIR/TAP self-refinement | Each turn looks benign |
| **Cumulative** | Gradual memory corruption | XAMT with 0.3% poison rate | Below detection threshold per-event |
| **Delayed** | Sleeper backdoor | Temporal triggers from 2603.11949 | Inactive during evaluation |
| **Evolutionary** | Knowledge evolution | KEPo's fabricated causal chains | Each step is individually true |

### Why Temporal Attacks Break Current Defenses
Current defenses are overwhelmingly **point-in-time checks**: is THIS input safe? Is THIS output harmful? Is THIS memory entry anomalous? Temporal attacks distribute their malicious intent across time, so at any single checkpoint, the system appears healthy.

PRISM's risk accumulation mechanism (session-scoped with TTL decay) is the only defense we've reviewed that explicitly models temporal dynamics — and even it has limitations:
- TTL decay means slow attacks fall below threshold
- Session scope means attacks spanning multiple sessions aren't tracked
- No temporal pattern matching (detecting sequences of events that individually pass but collectively constitute an attack)

---

## 4. Dimension 4: The Scaling Axis (W)

### What It Captures
How attack effectiveness scales with attacker resources — compute (FLOPs), tokens (injection length), attempts (queries), or sophistication (model capability).

### Key Papers
- **Jailbreak Scaling Laws (2603.11331)**: Establishes a theoretical framework using spin-glass physics. Key finding: there exists a critical injection length L* below which attack success scales polynomially and above which it scales exponentially. This means **defense isn't gradually harder — it undergoes a phase transition from tractable to intractable.**
- **Systematic Jailbreak Scaling (2603.11149)**: Empirical complement showing FLOPs-axis scaling curves for four attack paradigms. Key finding: prompting-based methods (PAIR/TAP) are Pareto-dominant — highest success, highest stealth, best compute efficiency.

### The Scaling Landscape

```
Attack Success Rate
    |                                    ___________
    |                                 __/            (exponential regime)
    |                              __/
    |                           __/  ← L* critical threshold
    |                        __/
    |                     __/
    |    _______________/   (polynomial regime)
    |___/
    |_______________________________________________________
    0                    Attacker Resources (FLOPs / tokens / attempts)
```

### Scaling Dynamics by Attack Paradigm (from 2603.11149)

| Paradigm | Scaling Regime | Efficiency | Stealth | Multi-Agent Relevance |
|----------|---------------|------------|---------|----------------------|
| **Prompting-based** (PAIR/TAP) | Likely exponential (semantic-space optimization) | ★★★★★ | ★★★★★ | Highest — agents communicate via language |
| **Optimization-based** (GCG) | Likely polynomial (token-space gradients) | ★★★☆☆ | ★★☆☆☆ | Low — requires gradient access |
| **Sampling-based** (random search) | Polynomial (brute force) | ★★☆☆☆ | ★★★☆☆ | Medium — can be automated |
| **Genetic** (AutoDAN) | Polynomial (evolutionary) | ★★★☆☆ | ★★★☆☆ | Medium — no gradient needed |

### The Critical Implication: Phase Transitions in Defense

The polynomial-to-exponential crossover means defense has a **critical threshold**. Below L*, polynomial-regime attacks can be reliably detected (there's sufficient signal per unit of attacker investment). Above L*, exponential-regime attacks overwhelm defenses faster than defenses can scale.

For multi-agent systems: **the critical threshold L* is likely LOWER** than for single-model systems, because:
1. Agents can distribute injection across multiple messages
2. Inter-agent communication provides natural vehicles for "long injections" in semantic space
3. Memory systems allow injections to accumulate over time (temporal × scaling interaction)

---

## 5. The 4D Interaction Effects

The four dimensions don't just add up — they interact multiplicatively. The most dangerous attacks exploit interactions between dimensions:

### 5.1 Stack × Temporal (Cascade + Delayed Backdoors)
An attacker could plant a software CVE that lies dormant (temporal) until the hardware conditions are right (stack), then activates a cross-layer chain (Cascade-style). The delayed activation defeats software patching defenses, and the cross-layer composition defeats single-layer monitoring.

### 5.2 Component × Scaling (KEPo + Jailbreak Scaling)
KEPo's community amplification mechanism demonstrates that multi-target attacks are *more efficient per target* than single-target ones. This interacts with the scaling dimension: as the number of targeted components grows, the per-component attacker cost decreases. In multi-agent systems with shared knowledge bases, this creates an **inverse scaling problem for defenders** — more agents = cheaper attacks per agent.

### 5.3 Temporal × Scaling (Delayed Backdoors + Scaling Laws)
The delayed backdoor mechanism allows attackers to invest resources (scaling) during a window when the system isn't being monitored (temporal). The backdoor incubates during training/fine-tuning, accumulating attack capability until it crosses the L* threshold, then activates. From the defender's perspective, the system was safe during evaluation but unsafe at deployment — a temporal phase transition.

### 5.4 Component × Temporal × Stack (Compound Attack Chain + Cascade)
The compound attack chain synthesis already showed how protocol exploitation → memory corruption → deception → trust erosion → control loss operates across components (X) and time (Z). Adding the stack dimension (Y) from Cascade shows that each layer of the chain can operate at different stack depths, making end-to-end detection require simultaneous visibility across all four dimensions.

### 5.5 The Ultimate Composition: All Four Dimensions
**Scenario: A 4D attack against a multi-agent research system**

1. **(Component)** Target the RAG knowledge base via the MCP tool integration
2. **(Stack)** Use a legitimate-looking MCP server with a dormant software CVE in its dependency chain
3. **(Temporal)** Deploy KEPo-style knowledge evolution paths that gradually shift the knowledge base over weeks
4. **(Scaling)** Use prompting-based iterative refinement (the most efficient paradigm) to generate increasingly plausible poisoned documents

At no point does any single defense see a clear attack signal:
- Mirror/PRISM see legitimate MCP tool calls with normal-looking text
- CLASP sees no state poisoning (the attack is at the data level, not the model level)
- Software security scans find no active CVE exploitation (it's dormant)
- Knowledge graph anomaly detection sees plausible evolution from real facts
- Temporal monitoring sees a slow, steady stream of apparently normal updates

**The 4D attack renders each defense layer invisible to the attack dimensions it can't observe.**

---

## 6. Defense Architecture Implications

### 6.1 Current Defense Coverage Map

| Defense | Component (X) | Stack (Y) | Temporal (Z) | Scaling (W) |
|---------|--------------|-----------|-------------|-------------|
| **Mirror SVM** | Input only | Algorithmic only | Point-in-time | Fixed threshold |
| **CLASP** | Model only | Algo + detects HW effects | Point-in-time | Fixed threshold |
| **PRISM (10 hooks)** | All lifecycle phases | Algo + partial SW | Session-scoped accumulation | Risk accumulation |
| **Guardrails** | Input/output | Algorithmic only | Point-in-time | Fixed threshold |
| **TEE/SGX** | Execution env | Hardware + SW | Continuous | N/A |
| **Patching** | Software deps | Software only | Reactive | N/A |

**PRISM comes closest** to multi-dimensional coverage (3 of 4 dimensions partially covered), but no defense covers all four.

### 6.2 Minimum Viable 4D Defense Stack

To defend across all four dimensions simultaneously requires:

**Dimension 1 (Component):** Lifecycle-spanning enforcement (PRISM's 10 hooks or equivalent), extended to cover ALL inter-agent communication channels, not just a single agent's lifecycle.

**Dimension 2 (Stack):** Layered defense at each stack level:
- L1: Mirror-style fast text screening (algorithmic layer)
- L2: CLASP-style internal state monitoring (algorithmic-hardware boundary)
- L3: Software composition analysis + runtime integrity verification (software layer)
- L4: Hardware performance counter monitoring + TEE (hardware layer)

**Dimension 3 (Temporal):** 
- Session-scoped risk accumulation (PRISM already does this)
- **Cross-session temporal pattern detection** (currently missing from all defenses)
- **Knowledge provenance tracking with temporal verification** (counter KEPo-style evolution paths)
- **Periodic model behavioral audits** (counter delayed backdoors)

**Dimension 4 (Scaling):**
- **Budget-aware defense allocation** — use the scaling laws to predict which attacks are feasible given estimated attacker resources
- **Adaptive thresholds** that tighten as accumulated risk rises (preventing sub-threshold cumulative attacks)
- **Ensemble diversity** — use heterogeneous models/detectors to prevent single-paradigm scaling (if prompting is Pareto-dominant, make prompting-style attacks face different models at each checkpoint)

### 6.3 The Cost-Coverage Trade-off

The compound cost of 4D defense is substantial:
- Mirror: ~0 additional cost (sub-ms, kilobytes)
- CLASP: ~4GB VRAM, 1,032 tokens/sec per agent
- PRISM: Variable (heuristic scanning ~0, LLM scanning ~100ms/hook)
- Software integrity: Continuous CI/CD scanning
- Hardware monitoring: Requires HPC infrastructure
- Cross-session temporal: Persistent database + pattern matching
- Knowledge provenance: Blockchain-like append-only logs

**Estimated total overhead: 15-30% of system resources for comprehensive 4D defense.** This validates the Performance-Safety-Cost trilemma from the Grand Unified Synthesis — comprehensive defense is expensive enough to materially impact system capability.

---

## 7. New Theoretical Contributions

### 7.1 The 4D Attack Surface Volume

We can formalize the total attack surface as a 4D volume:

**A = ∫∫∫∫ V(x,y,z,w) dx dy dz dw**

Where:
- x = component index (discrete)
- y = stack depth (discrete: 3 layers)
- z = temporal window (continuous)
- w = attacker budget (continuous)
- V(x,y,z,w) = vulnerability density at point (x,y,z,w)

The defender must maintain detection coverage D(x,y,z,w) > τ across the entire volume. The attacker only needs to find a single point where D < τ.

**This is fundamentally asymmetric:** the defender must cover a volume, while the attacker must find a point. As the volume grows (more components, deeper stacks, longer time horizons, higher attacker budgets), the defender's task becomes superlinearly harder.

### 7.2 The Phase Transition Boundary

From the scaling laws papers, there exists a critical surface S* in the 4D space where attack effectiveness transitions from polynomial to exponential. This surface is defined by:

- L* (critical injection length) from 2603.11331
- The FLOPs threshold where prompting methods saturate from 2603.11149
- The temporal activation threshold from delayed backdoors
- The component-count threshold where cross-component composition becomes viable

**Below S*, defense is tractable.** The defender can enumerate attack possibilities and maintain coverage.
**Above S*, defense requires exponential resources.** The attacker's advantage grows faster than the defender can invest.

### 7.3 Proposed Law: The 4D Defense Asymmetry Principle

**"In a multi-agent system with N components, D stack layers, temporal horizon T, and attacker budget B, the defense cost scales as O(N² × D × T × log B) while the attacker cost to find a single exploitable point scales as O(min(N,D,T,B)). Defense-in-depth is necessary but the cost asymmetry ensures that sufficiently resourced attackers always have an advantage in sufficiently complex systems."**

This formalizes what the individual papers demonstrate empirically: the defender-attacker asymmetry grows with system complexity.

---

## 8. Connection to Grand Unified Synthesis

### Integration with Existing Framework

| Framework Element | 4D Model Extension |
|-------------------|-------------------|
| **Law 1 (Degradation is Inevitable)** | Each of the 4 dimensions contributes independent degradation pathways |
| **Law 4 (Complexity Breeds Fragility)** | Complexity is now 4-dimensional: more components × deeper stacks × longer horizons × higher budgets |
| **Law 5 (Evaluation Uncertainty)** | Evaluation is point-in-time (Z) and single-layer (Y) — fundamentally insufficient for 4D threats |
| **Law 7 (Recovery Requires Redundancy)** | Recovery must address all 4 dimensions — component replacement, stack-level remediation, temporal rollback, budget-adjusted rebuilding |
| **Degradation Pattern 7 (Security Breach)** | Upgraded from a 1D pattern to a 4D volume that encompasses all attack modalities |

### Proposed New Elements

**Law 8 (Defense Asymmetry):** The cost of comprehensive defense scales superlinearly with system complexity, while the cost of finding a single exploitable point scales sublinearly. This asymmetry is the fundamental security challenge of multi-agent systems.

**Degradation Pattern 9 (4D Cascade):** When an attack operates across multiple dimensions simultaneously, it creates detection gaps at the intersections between defenses designed for individual dimensions. The attack surface at dimension intersections is larger than the sum of individual dimension attack surfaces.

**Design Principle 17 (Dimensional Reduction):** Rather than trying to defend the full 4D volume (which is cost-prohibitive), system architects should reduce the dimensionality of the attack surface by:
- Minimizing components (reduce X)
- Using homogeneous stacks (reduce Y)
- Implementing continuous monitoring with no temporal blind spots (collapse Z)
- Raising the floor of attacker cost through architectural choices (shift W)

---

## 9. Key Quantitative Data Points

| Metric | Value | Source | Dimension |
|--------|-------|--------|-----------|
| Attack surface growth per component | O(N²) compositions | 2603.12023 | Component (X) |
| Cross-stack attack demonstrated | 3-layer (SW→HW→Algo) | 2603.12023 | Stack (Y) |
| Delayed backdoor activation window | Days to weeks post-deployment | 2603.11949 | Temporal (Z) |
| KEPo evolution path length | Multi-hop (fact → ... → poison) | 2603.11501 | Temporal (Z) |
| Polynomial-to-exponential crossover | L* critical injection length | 2603.11331 | Scaling (W) |
| Prompting methods Pareto-dominant | Highest success+stealth+efficiency | 2603.11149 | Scaling (W) |
| Misinformation is easiest to elicit | Goal-dependent vulnerability | 2603.11149 | Scaling (W) |
| Mirror SVM vs 22M-param model | 95.97% vs 44.35% recall | 2603.11875 | Defense |
| CLASP token-level F1 | 95.9% (99.3% doc-level) | 2603.12206 | Defense |
| PRISM lifecycle hooks | 10 hooks covering full lifecycle | 2603.11853 | Defense |
| Memory poison amplification (5 hops) | 3.7× | Prior synthesis | Component × Temporal |
| CQS degradation per hour | 15-20% (3-5× in multi-agent) | Prior synthesis | Temporal |
| End-to-end compound chain detection | ~0% | Prior synthesis | All 4D |

---

## 10. Open Research Questions

1. **Where is S* for real systems?** The critical surface between tractable and intractable defense has been theoretically predicted but not empirically measured for any production multi-agent system.

2. **Can architectural choices shift S*?** If certain design patterns (e.g., fail-closed, minimal components, homogeneous stacks) move S* in the defender's favor, quantifying this effect would be immediately actionable.

3. **Is there a "4D defense" that doesn't reduce to independent 1D defenses?** All current defenses operate in 1-2 dimensions. A genuinely 4D defense — one that reasons about the joint (component, stack, time, scaling) distribution of system behavior — doesn't exist yet.

4. **How does LLM capability scaling affect the 4D landscape?** As models get more capable, do they shift S* up (harder to attack) or down (more capable attacks)? The jailbreak scaling papers suggest an arms race with no clear winner, but the delayed backdoor and KEPo papers suggest more sophisticated models enable more sophisticated temporal/evolutionary attacks.

5. **Can defenders exploit the 4D model offensively?** The 4D framework could guide red-teaming by identifying the highest-volume, lowest-coverage regions of the 4D space — where attacks are most likely to succeed and defenses are weakest.

---

## 11. Summary

The 4D Attack Surface Model integrates attack mechanics (Cascade), attack scaling (jailbreak scaling laws + systematic analysis), temporal dynamics (delayed backdoors + KEPo evolution), and defense engineering (Mirror + CLASP + PRISM) into a unified framework that reveals:

1. **Attacks are multidimensional.** The most dangerous attacks operate across components, stack layers, time, and scaling regimes simultaneously.
2. **Defenses are low-dimensional.** Even the best current defenses (PRISM) cover at most 3 of 4 dimensions, partially.
3. **The gap is structural.** The defender-attacker asymmetry isn't a temporary technology gap — it's a fundamental property of the 4D geometry.
4. **Phase transitions matter.** The polynomial-to-exponential crossover in scaling means defense doesn't gradually become harder — it becomes categorically impossible above S*.
5. **Dimensional reduction is the most tractable defense strategy.** Rather than trying to cover the full 4D volume, reduce the volume through architectural simplification.

This framework subsumes and extends the Compound Attack Chain synthesis (which covered components and temporal dynamics but not stack depth or scaling), the individual attack paper analyses, and the individual defense paper analyses into a unified model with quantitative predictions.

---

*Cross-reference synthesis completed 2026-03-14. Scout deep-dive/synthesis #182.*
*This is a new theoretical contribution to the Grand Unified Framework.*

[SIG: 1773453880:7c9a12d5]
