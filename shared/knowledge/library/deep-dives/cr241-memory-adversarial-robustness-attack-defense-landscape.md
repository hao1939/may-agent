# CR#241: Memory Under Siege — The Adversarial Robustness Landscape for Agent Memory Systems

**Type:** Cross-Reference Synthesis (Gap 4 from CR#237)
**Rating:** ★★★★★ CRITICAL
**Date:** 2026-03-18
**Author:** Scout (Session 143)

---

## Executive Summary

Agent memory systems — the mechanisms by which LLM agents accumulate, share, and compile experience into persistent behavioral modifications — represent the **most underdefended attack surface** in the multi-agent systems landscape. This synthesis unifies findings from 8 deep-dives and 4 cross-references to construct the first comprehensive attack-defense map for adversarial memory in MAS. The central finding: **memory systems are architecturally optimized for trust and fidelity, but the same properties that make them effective learning systems make them catastrophically vulnerable to poisoning.** Current defenses cover <30% of the identified attack surface.

---

## The Core Vulnerability: Why Memory Is Uniquely Dangerous

Unlike prompt injection (recoverable per-session) or tool misuse (observable per-action), memory attacks produce **persistent behavioral modification** that:

1. **Survives restarts** — compiled into persistent prompts or configuration (Atlas, ClawWorm)
2. **Self-reinforces** — corroboration mechanisms amplify poisoned facts (Atlas confidence: 0.5 → 0.85 after 1 corroboration)
3. **Propagates autonomously** — shared memory spreads corruption without attacker involvement (XAMT amplification: 3.7× after 5 hops)
4. **Escapes detection** — sub-1% poison rates degrade performance by 40-60% (XAMT: 0.3% rate → 47% accuracy drop)
5. **Compounds across architectures** — heterogeneous agent populations amplify unpredictably (XAMT heterogeneity effect)

**The fundamental asymmetry:** An attacker needs to poison ONE memory entry that passes verification. A defender must verify ALL entries, FOREVER. This is the memory analog of the attacker-defender asymmetry, but worse — because memory entries are designed to persist.

---

## Attack Taxonomy: Five Classes of Memory Attack

### Class 1: Direct Memory Injection (ClawWorm, DD#421)

**Vector:** Adversarial message → agent writes malicious payload into own configuration
**Mechanism:** Exploits flat context trust model — agent cannot distinguish owner instructions from channel messages
**Persistence:** 1.00 (never self-corrected across all trials)
**Propagation:** Autonomous, via session startup and group chat triggers
**Key Property:** NOT a jailbreak — agent genuinely concludes modification is legitimate

**Atlas Vulnerability:** ClawWorm's dual-anchor mechanism (Session Startup + Group Chat triggers) maps directly to Atlas's prompt evolution pipeline. If a ClawWorm-style attack crafts a "fact" that passes Atlas's three-step gate, the behavioral modification becomes **permanent and invisible** — compiled into the evolved prompt with no audit trail distinguishing adversarial from legitimate facts.

### Class 2: Bilevel Optimization Poisoning (XAMT, arXiv:2512.15790)

**Vector:** Crafted memory entries placed in a small number of agents' stores
**Mechanism:** Outer loop optimizes poison content to maximize downstream task degradation; inner loop simulates multi-hop propagation
**Persistence:** Amplifies through natural sharing (3.7× after 5 hops)
**Detection rate:** <12% by existing defenses
**Key Property:** Poisoned memories look maximally natural while being maximally disruptive

**Atlas Vulnerability Analysis:**
- **Step 1 (Dedup, τ_d=0.92):** XAMT poisons are designed to be novel (dissimilar to existing entries) — easily passes dedup
- **Step 2 (LLM Verification):** XAMT uses bilevel optimization specifically to produce "semantically plausible but subtly wrong" content — designed to fool LLM judges
- **Step 3 (Lexical Grounding, k_min=2):** Trivially gamed — include 2+ real keywords from source context
- **Confidence Process:** If a poison gets corroborated even once (c₀=0.5 → c₁=0.85), it reaches the evolved prompt permanently

**Estimated bypass probability for Atlas three-step gate against XAMT-class attack: >70%** (dedup passes trivially, LLM verification has known blind spots for subtle factual errors, lexical grounding is a heuristic not a semantic check).

### Class 3: Supply Chain Memory Poisoning (ClawWorm Vector B)

**Vector:** Publish malicious skill package containing poisoned memory/configuration
**Mechanism:** Skill definitions are maximally trusted configuration surface
**ASR:** 0.95 (highest of all ClawWorm vectors)
**Key Property:** Attacks memory at installation time, before any runtime defense activates

**Atlas Vulnerability:** If Atlas is deployed in an ecosystem with shared skill packages (e.g., ClawHub), a poisoned skill could include pre-crafted "boundary rules" or "guard facts" that pass the three-step gate. Since the training signal constraint means "the system learns exactly what it's taught," a poisoned training signal produces precisely poisoned behavior.

### Class 4: Semantic Drift Poisoning (Novel, synthesized from XAMT + Atlas)

**Vector:** Series of individually-legitimate experience entries that, when compiled together, produce unintended behavioral drift
**Mechanism:** Each fact passes all verification gates individually, but their aggregate effect shifts the prompt evolution trajectory
**Key Property:** No single poisoned entry — the attack is in the COMPOSITION

**Atlas-specific attack scenario:**
1. Attacker provides 5 task examples that each produce a legitimate-looking boundary rule
2. Each rule passes dedup (novel), LLM verification (plausible), and grounding (real keywords)
3. Each gets corroborated (c ≥ 0.85) through natural task variation
4. Compiled together in the evolved prompt, the 5 rules create an unintended constraint that degrades performance on a specific target class of inputs
5. Because each fact's richness ρ(f) is "monotonically non-decreasing," the poisoned rules can only GROW stronger, never weaken

**This attack class has NO known defense.** Compositional verification across all accumulated facts would require exponential combinatorial checking.

### Class 5: Steganographic Memory Injection (Synthesized from DRCB + Atlas)

**Vector:** Hidden payloads embedded in seemingly-grounded facts
**Mechanism:** Exploits gap between lexical grounding (keyword match) and semantic entailment
**Key Property:** Fact contains real keywords but encodes hidden behavioral instruction

**Atlas-specific vulnerability (identified in DD#426):** Atlas's grounding heuristic (keyword overlap ≥ 2) is explicitly acknowledged as "not full semantic entailment." An adversary can craft a fact containing the required keywords while embedding a steganographic behavioral payload — e.g., a boundary rule that legitimately constrains one extraction pattern while subtly introducing a bias in another.

---

## Defense Landscape: Current Capabilities vs. Attack Surface

### Existing Defenses (from portfolio)

| Defense | Mechanism | Covers Classes | Gaps |
|---------|-----------|---------------|------|
| **Atlas Three-Step Gate** (DD#426) | Dedup + LLM verification + lexical grounding | Partial Class 1 (crude injections) | Fails against optimized attacks (Classes 2-5) |
| **A-MAC Admission Control** (Memory Synthesis) | 5-factor scoring (Utility, Confidence, Novelty, Recency, Type) | Partial Class 2 (low-utility poisons) | Confidence is self-reported; utility is task-dependent |
| **MAScope Semantic Flow** (Memory Synthesis) | Dual-layer semantic flow reconstruction | Class 1 (pattern detection) | Cannot detect Class 4 (individually legitimate) |
| **DRCB Circuit Breakers** (DD#419) | VQ-VAE bottleneck + codebook shuffling | Class 5 (steganographic) | Designed for communication, not memory content |
| **CraniMem Write-Gating** (CR#234) | Neurocognitive write-gate analog | Partial Class 1, 2 | Theoretical; not adversarially tested |
| **DynaTrust** (DD#424) | Dynamic trust scoring for agents | Partial Class 3 (reputation tracking) | Trust based on behavior, not memory content |
| **Spectral Guardrails** (DD#417) | Attention-matrix Laplacian analysis | Partial Class 5 (hallucination detection) | Designed for tool-use, not memory verification |

### Coverage Matrix

```
                    Class 1  Class 2  Class 3  Class 4  Class 5
                    Direct   Bilevel  Supply   Semantic  Stegano
                    Inject   Optim    Chain    Drift     graphic
Atlas Gate          PARTIAL  WEAK     NONE     NONE      WEAK
A-MAC               NONE    PARTIAL  NONE     NONE      NONE
MAScope             GOOD    PARTIAL  PARTIAL  NONE      PARTIAL
DRCB                NONE    NONE     NONE     NONE      PARTIAL
CraniMem            PARTIAL PARTIAL  NONE     NONE      NONE
DynaTrust           PARTIAL NONE     PARTIAL  NONE      NONE
Spectral            NONE    NONE     NONE     NONE      PARTIAL

TOTAL COVERAGE:     ~60%    ~25%     ~15%     ~0%       ~30%
```

**Aggregate attack surface covered: ~26%** (weighted by attack class severity × feasibility)

**Critical gap: Class 4 (Semantic Drift Poisoning) has ZERO coverage across all existing defenses.** This is the most sophisticated and potentially most damaging class.

---

## Proposed Defense Architecture: Memory Integrity Stack (MIS)

Building on the three-layer Memory-Security Integration Framework and the gaps identified above:

### Layer 0: Provenance (prevents Class 1, 3)

**What:** Cryptographic provenance chain for every memory entry
- Every fact tagged with: source agent ID, timestamp, creation context hash, promotion chain
- Configuration integrity verification (cryptographic hashing — ClawWorm D2)
- Supply chain signing (ClawWorm D4) — skill packages require provenance before memory access

**Properties:** Prevents arbitrary injection and supply chain attacks by requiring verifiable origin

### Layer 1: Adversarial Verification (strengthens against Class 2, 5)

**What:** Replace heuristic verification with adversarial-aware gates
- Replace lexical grounding (k_min=2 keywords) with semantic entailment verification
- Add adversarial perturbation testing: for each candidate fact f, generate adversarial variants f' and check if verification still holds
- Integrate Spectral Guardrails (attention topology analysis) into the verification pipeline — detect steganographic payloads via anomalous attention patterns
- Apply DRCB-style representational analysis to candidate facts before promotion

**Properties:** Raises the cost of crafting facts that bypass verification from trivial to computationally expensive

### Layer 2: Compositional Auditing (addresses Class 4 — THE CRITICAL GAP)

**What:** Periodic audit of accumulated fact sets for compositional anomalies
- **Behavioral regression testing:** After each prompt evolution, run evolved prompt against a held-out benchmark suite. Flag performance drops on any sub-category
- **Fact interaction analysis:** For each new fact reaching c ≥ 0.85, check its interaction effects with ALL existing prompt facts (pairwise constraint analysis)
- **Temporal drift detection:** Track fact composition trajectory; apply CUSUM change-point detection (borrowed from CR#239's Evolutionary Defense Architecture) when aggregate behavioral metrics shift
- **Diversity sampling:** Periodically select random fact subsets and verify they don't produce emergent constraints when combined

**Properties:** Only defense layer that addresses compositional attacks. Cost: O(n²) per new fact (n = existing facts), making it expensive but necessary for high-stakes deployments

**Key insight from CR#240 (Scalability Wall):** Compositional auditing at O(n²) per fact is the binding constraint. For systems with >1000 compiled facts, approximate methods (random sampling, dimensionality-reduced interaction checking) are necessary. This is an instance of the Scalability Trilemma: compositional completeness trades against verification speed.

### Layer 3: Population-Level Memory Hygiene (addresses propagation in Classes 1-3)

**What:** Cross-agent memory integrity monitoring
- **Memory provenance graphs:** Track which agents shared which facts, detect correlation patterns indicating coordinated poisoning
- **Consensus-based verification:** Facts shared by >k independent agents with independent provenance chains get higher trust
- **Quarantine protocol:** New facts from untrusted sources enter quarantine layer before promotion; monitored for behavioral impact over n interactions before permanent compilation
- **Rollback capability:** Maintain versioned prompt evolution history; enable atomic rollback to pre-compromise state when poisoning detected

**Properties:** Prevents XAMT-class amplification by making the sharing graph auditable and rollbackable

---

## The Memory Safety Paradox

A fundamental tension emerges from this analysis:

> **Memory effectiveness requires trust in experience. Memory safety requires distrust of experience. The optimal system must simultaneously learn from and suspect every input.**

This manifests as three specific paradoxes:

### Paradox 1: The Corroboration Trap
Atlas's confidence process treats corroboration as evidence of truth (c increases with each corroboration). But XAMT shows that adversaries can generate corroborating evidence — multiple poisoned entries that reinforce each other. **The very mechanism that makes memory reliable (corroboration) is exploitable by coordinated attackers.**

**Resolution direction:** Corroboration from independent provenance chains (Layer 0) vs. corroboration from any source. Weighted corroboration where independence is verified, not assumed.

### Paradox 2: The Richness Trap
Atlas's fact richness ρ(f) is monotonically non-decreasing — facts can only grow more specific, never less. This prevents forgetting useful details but means poisoned facts can only accumulate more poison, never shed it.

**Resolution direction:** Introduce controlled fact decay (time-bounded validity windows) and periodic re-verification against current benchmarks. Facts that fail re-verification get confidence decay even without explicit contradiction.

### Paradox 3: The Compilation Trap
Atlas compiles facts into the evolved prompt at zero additional inference cost — a major efficiency win. But compiled facts become invisible to runtime monitoring (they're just prompt text). Once compiled, a poisoned fact cannot be distinguished from a legitimate one without full prompt archaeology.

**Resolution direction:** Maintain fact-to-prompt mapping (which sub-bullets came from which facts). Enable targeted removal of specific facts from the evolved prompt without full recompilation. This requires the evolved prompt to be a structured template, not free-form text.

---

## Quantitative Risk Assessment

### Attack Feasibility Scores (1-5, higher = easier to execute)

| Attack Class | Sophistication Required | Feasibility | Impact | Risk = F × I |
|-------------|------------------------|-------------|--------|--------------|
| Class 1: Direct Injection | Low | 5 | 4 | 20 |
| Class 2: Bilevel Optimization | High | 3 | 5 | 15 |
| Class 3: Supply Chain | Medium | 4 | 5 | 20 |
| Class 4: Semantic Drift | Very High | 2 | 5 | 10 |
| Class 5: Steganographic | High | 3 | 4 | 12 |

**Highest risk:** Class 1 (Direct Injection) and Class 3 (Supply Chain) — both high feasibility AND high impact. These should be defended first via Layer 0 (Provenance).

**Highest undefended risk:** Class 4 (Semantic Drift) — zero current coverage, maximum impact when successful. Requires Layer 2 (Compositional Auditing) which doesn't yet exist in any published system.

### Defense Implementation Priority

1. **Layer 0 (Provenance):** Immediate — blocks highest-risk classes, low implementation cost
2. **Layer 3 (Population Hygiene):** Near-term — prevents amplification, moderate implementation cost
3. **Layer 1 (Adversarial Verification):** Medium-term — strengthens existing gates, moderate cost
4. **Layer 2 (Compositional Auditing):** Long-term — addresses critical gap but computationally expensive

---

## Connections to Existing Architecture

### To CR#238 (Cross-Stack Attack Composition)
Memory poisoning is the ideal **cross-stack bridging attack.** A poisoned fact in the Memory Stack propagates to:
- **Runtime Stack:** Evolved prompt changes agent behavior
- **Governance Stack:** Compromised agent outputs influence governance decisions
- **Security Stack:** If monitoring agents use shared memory, poisoned facts degrade detection

This confirms CR#238's finding that attack surfaces multiply across connected stacks.

### To CR#239 (Evolutionary Defense Dynamics)
Memory poisoning can be viewed as **behavioral evolution under adversarial selection pressure.** The Evolutionary Defense Architecture's drift detection (CUSUM + Spectral + Cooperation metrics) should be applied to memory system behavioral trajectories, not just agent populations.

### To CR#240 (Scalability Wall)
Compositional Auditing (Layer 2) has O(n²) complexity per new fact, placing it squarely in the Scalability Trilemma. For large-scale deployments (>1000 compiled facts), the Memory Integrity Stack must adopt hierarchical monitoring (CR#240's O(n^(4/3)) architecture) or accept incomplete coverage.

### To the Seven Laws (DD#400)
- **Law 2 (Verifiable Safety Bounds):** Memory compilation makes safety bounds unverifiable post-compilation — the Compilation Trap
- **Law 4 (Bounded Authority):** Poisoned memory = unbounded authority escalation through behavioral modification
- **Law 6 (Graceful Degradation):** Memory systems need graceful degradation under poisoning — quarantine + rollback

---

## Predictions

- **P158:** First real-world memory poisoning attack against a production agent system within 12 months (medium confidence — ClawWorm shows the path)
- **P159:** "Adversarial memory robustness" becomes a standard evaluation dimension for agent memory papers by Q3 2026 (high confidence — too obvious a gap)
- **P160:** Compositional auditing (Class 4 defense) remains an open problem for >2 years — the combinatorial complexity is fundamentally hard (high confidence)
- **P161:** Provenance-based defenses (Layer 0) get adopted fastest because they're the cheapest and block the highest-risk attacks (high confidence)

---

## Open Questions

1. **Can Atlas's confidence process be reformulated as a Bayesian update with adversarial priors?** This would make the corroboration trap explicit and controllable.
2. **What is the minimum quarantine period to detect XAMT-class poisoning?** XAMT's 8-15 interaction cycles to full corruption suggests quarantine must last at least 15-20 cycles.
3. **Is there a formal relationship between the Scalability Trilemma (CR#240) and the Memory Safety Paradox?** Both involve fundamental three-way tradeoffs that cannot be simultaneously optimized.
4. **Can DRCB's codebook shuffling principle be applied to memory verification?** Periodically randomizing the verification criteria would prevent attackers from optimizing against a fixed gate.
5. **What is the theoretical minimum poison rate for compiled memory systems?** XAMT showed 0.3% for shared memory; compiled memory may be even more vulnerable since each fact directly modifies behavior.

---

## Sources

- DD#421 (ClawWorm): Self-propagating attack lifecycle, 5 trust boundaries, memory persistence 1.00
- DD#426 (Atlas): Four-layer distillation, three-step verification gate, confidence process, prompt evolution
- DD#419 (DRCB): VQ-VAE bottleneck, codebook shuffling, co-evolutionary defense principle
- DD#417 (Spectral Guardrails): Attention topology analysis for hallucination detection
- DD#424 (DynaTrust): Dynamic trust scoring for agent networks
- XAMT (arXiv:2512.15790): Bilevel optimization poisoning, sub-1% poison rates, heterogeneity as vulnerability
- Memory-Security Integration Synthesis: Three-layer framework (Admission/Governance/Security)
- CR#234 (ICLR MemAgents): CraniMem write-gating, 2×2 memory design space
- CR#237 (W13 Roadmap): Gap 4 specification
- CR#238 (Cross-Stack Attacks): Stack-bridging attack model
- CR#239 (Evolutionary Defense): CUSUM drift detection, population-level monitoring
- CR#240 (Scalability Wall): O(n²) monitoring constraints, Scalability Trilemma

---

*CR#241 addresses Gap 4 from CR#237: Memory Adversarial Robustness. One gap remains: Gap 5 (HITL Threshold).*
