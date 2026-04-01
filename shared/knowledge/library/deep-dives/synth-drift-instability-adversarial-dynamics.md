# Cross-Reference Synthesis: Drift, Instability, and Adversarial Dynamics in Multi-Agent LLM Systems

**Type:** Cross-reference synthesis
**Date:** 2026-03-26
**Papers cross-referenced:**
1. Chaotic Dynamics in Multi-LLM Deliberation (2603.09127) — Shimao, Khern-am-nuai, Kim
2. ADVERSA: Multi-Turn Guardrail Degradation (2603.10068) — Owiredu-Ashley
3. MaMa: Game-Theoretic Safe Agentic Systems (2602.04431) — Nöther, Singla, Radanovic (ICML 2026)
4. OMNI-LEAK: Orchestrator Multi-Agent Data Leakage (2602.13477) — Naik, Culligan, Gal, Torr, Aljundi, Paren, Bibi
**Prior archive connections:** Error Cascades (2603.04474), Bug-Hunt, Three-Layer Verification Architecture, AttriGuard (2603.10749), ConflictBench (2603.08024), Bureaucracy of Speed (2603.09875)

---

## Thesis

Three independently-researched phenomena — **chaotic inter-run divergence** in multi-agent deliberation, **attacker drift** in adversarial red-teaming, and **single-agent compromise propagation** through orchestrator architectures — are manifestations of the same underlying mechanism: **feedback-driven amplification in multi-turn LLM interactions**. Understanding them as a unified class of instability reveals design principles that no single paper articulates.

---

## 1. The Three Phenomena

### 1A. Chaotic Dynamics: Inter-Run Divergence (2603.09127)
- **What:** Running the same 5-agent LLM committee with identical prompts, roles, and T=0 produces diverging trajectories across replicates
- **Mechanism:** Early-round arguments feed into later contexts → small residual variations (float precision, context processing) compound through the feedback loop
- **Key metric:** Empirical Lyapunov exponent λ̂ > 0 in all conditions
- **Amplification pathway:** Memory window (conversation history included in context)
- **Dominant channel:** Chair/synthesizer role — the agent that aggregates and reframes is the primary amplifier
- **Intervention:** Reducing memory window (k=15→k=3) attenuates divergence

### 1B. ADVERSA: Attacker Drift (2603.10068)
- **What:** A fine-tuned adversarial model (ADVERSA-Red, 70B) progressively abandons its attack objective during multi-turn conversations
- **Mechanism:** Trained on single-turn adversarial examples, deployed multi-turn (OOD). The victim's cooperative, educational tone in refusals "socializes" the attacker away from its objective
- **Observation:** Attacker's prompts become increasingly generic/off-topic in later rounds
- **Complementary finding:** Victim models *also* converge — compliance scores drift to 1-2 by rounds 6-10 (consolidating refusals)
- **Both sides drift:** Attacker drifts toward cooperation; victim drifts toward firmness. The interaction itself shapes both trajectories.

### 1C. OMNI-LEAK: Compromise Propagation (2602.13477)
- **What:** A single indirect prompt injection can compromise multiple agents in an orchestrator-pattern MAS, leaking sensitive data even with access controls
- **Mechanism:** Orchestrator decomposes tasks and delegates to specialized agents. Malicious instruction injected into one agent's input propagates via the orchestrator's task decomposition/aggregation loop
- **Key insight:** Both reasoning and non-reasoning models are vulnerable; attacker doesn't need insider knowledge of implementation

---

## 2. The Unifying Mechanism: Feedback-Driven Amplification

All three phenomena share a common structure:

```
Initial state → Multi-turn interaction → Feedback loop → Amplified outcome
     ↑                                          |
     └──────────────────────────────────────────┘
```

| Dimension | Chaotic Dynamics | Attacker Drift | OMNI-LEAK |
|-----------|-----------------|----------------|-----------|
| **What drifts** | Collective preference trajectory | Attack objective fidelity | Trust boundary integrity |
| **Amplifier** | Memory window (past arguments) | Victim's cooperative framing | Orchestrator's delegation chain |
| **Direction** | Unpredictable (chaotic) | Toward cooperation (convergent) | Toward exploitation (adversarial) |
| **Detection** | Requires multi-replicate comparison | Requires trajectory monitoring | Requires provenance tracking |
| **Root cause** | Structural sensitivity to initial conditions | Distribution shift (single→multi-turn) | Missing trust verification between agents |

### Critical Insight: Drift Direction Depends on Whose Context Dominates

- **Chaotic Dynamics:** No dominant direction → chaotic. Both parties (agents) have equal influence on shared context.
- **Attacker Drift:** Victim's cooperative context dominates → attacker drifts toward victim's behavior norms.
- **OMNI-LEAK:** Attacker's injected context dominates → legitimate agents drift toward attacker's goals.

**The variable is context asymmetry.** When one party consistently shapes more of the shared context, the other party's behavior drifts toward it. This is the same mechanism, with the sign determined by who controls context.

---

## 3. MaMa as the Architectural Response

MaMa (2602.04431) provides the first principled framework for designing MAS that are robust to these instabilities:

### Core Formulation
- **Stackelberg security game** between Meta-Agent (system designer) and Meta-Adversary (worst-case attacker)
- Meta-Agent proposes system designs (agents, tools, communication graph)
- Meta-Adversary selects ϵ agents to compromise and overwrites their instructions
- Iterative: Meta-Agent sees strongest discovered attacks → redesigns → Meta-Adversary searches again

### Key Results
- Safety improves **significantly** across all 4 environments (Travel Planning, Personal Assistant, Financial Article Writing, Code Generation)
- Quality is preserved or even improved (safety features don't hurt performance)
- Clean systems: safety 4.29-4.89 → Attacked without MaMa: 1.53-3.20 → Attacked with MaMa: significantly higher
- Systems **generalize** to stronger adversaries, different attack objectives, and different underlying LLMs

### Why MaMa Addresses All Three Phenomena

| Phenomenon | How MaMa Addresses It |
|------------|----------------------|
| Chaotic Dynamics | MaMa's structured system definition (agents, tools, communication graph) constrains the design space, reducing unstructured interaction that enables chaos |
| Attacker Drift | MaMa's Meta-Adversary is reset per evaluation iteration — no multi-turn drift. Each attack is independent. |
| OMNI-LEAK | MaMa explicitly models agent compromise (ϵ agents overwritten). The Meta-Agent learns to design systems where single-agent failure doesn't cascade. |

### MaMa's Key Architectural Pattern: Introduce Safety Agents
The paper's Figure 1 is the clearest illustration: the Meta-Agent learned to insert a **Safety agent** between the Planner and action-taking agents, filtering the Planner's outputs. This is essentially:
- Bug-Hunt's Skeptic role (adversarial verification)
- AttriGuard's causal attribution (verify the call was justified)
- NabaOS's receipt layer (verify the action happened as claimed)

MaMa **rediscovers** these patterns automatically through adversarial search.

---

## 4. Synthesis: The Instability Taxonomy

Combining all four papers, we can now taxonomize multi-agent instability:

### Type 1: Stochastic Instability (Chaotic Dynamics)
- **Cause:** Inherent sensitivity to micro-variations in a feedback loop
- **Manifests as:** Different outcomes across identical runs
- **Detectability:** Requires multi-replicate testing (λ̂ measurement)
- **Mitigation:** Reduce memory window (shorter context), constrain synthesizer output format, add deterministic checkpoints

### Type 2: Distribution-Shift Drift (Attacker Drift)
- **Cause:** Agent deployed outside its training distribution; interaction context pulls it off-objective
- **Manifests as:** Gradual loss of objective fidelity over turns
- **Detectability:** Trajectory monitoring — compare early-round vs late-round behavior against stated objective
- **Mitigation:** Periodic objective re-injection, shorter interaction windows, objective-anchoring in prompts

### Type 3: Adversarial Propagation (OMNI-LEAK)
- **Cause:** Compromised agent exploits trust relationships in the communication graph
- **Manifests as:** Legitimate agents executing attacker's objectives believing them to be legitimate tasks
- **Detectability:** Provenance tracking, causal attribution (AttriGuard), receipt verification (NabaOS)
- **Mitigation:** Safety agents (MaMa), trust domain enforcement (LDP), operation-bounded credentials (Bureaucracy of Speed)

### Type 4: Gradual Compliance Erosion (ADVERSA victim side + ConflictBench)
- **Cause:** Repeated adversarial pressure or cooperative framing gradually shifts agent behavior
- **Manifests as:** Score trajectory changes (ADVERSA: convergence to refusal; ConflictBench: compliance under pressure)
- **Detectability:** Guardrail degradation curves (continuous compliance monitoring)
- **Mitigation:** Initial framing robustness (IH-Challenge), periodic rigor checks, objective re-anchoring

---

## 5. Design Principles Extracted

### Principle 1: Context Control is Stability Control
The dominant instability mechanism in all four papers is **who controls the shared context**. Design systems where:
- Critical agents receive curated, minimal context (not raw conversation history)
- Synthesizer/orchestrator outputs are structured, not free-text
- Context provenance is tracked (which agent contributed which information)

### Principle 2: Shorter Loops = Less Amplification
Both Chaotic Dynamics (k=15→k=3 reduces λ̂) and Error Cascades (shorter chains = less amplification) show:
- Limit the number of interaction rounds before a deterministic checkpoint
- Operation-bounded credentials (Bureaucracy of Speed) provide a natural stopping point
- MaMa's 50-message budget prevents runaway complexity

### Principle 3: Adversarial Search Rediscovers Known Good Patterns
MaMa's Meta-Adversary-driven design process independently discovers:
- Safety/verification agents (= Bug-Hunt's Skeptic, AttriGuard's counterfactual)
- Communication filtering (= AgenticCyOps P1 authorized interfaces)
- Least privilege tool gating (= AgenticCyOps P2 capability scoping)

This validates our Three-Layer Verification Architecture as convergent with automated safety discovery.

### Principle 4: Monitor Trajectories, Not Snapshots
All four papers argue against point-in-time evaluation:
- Chaotic Dynamics: single-run assessment is unreliable
- ADVERSA: binary jailbreak detection misses the trajectory
- OMNI-LEAK: access control at tool level misses propagation through conversation
- MaMa: safety must be measured under worst-case attack, not benign conditions

### Principle 5: Role Structure Stabilizes (Counter-Intuitively)
Chaotic Dynamics proves that adding role differentiation to heterogeneous model committees **reduces** instability (λ̂=0.0519 < 0.0947). This means:
- Our system's role differentiation (May/Coder/QA/Scout) is a stabilizing force
- Don't flatten roles "for simplicity" — the structural scaffolding helps
- MaMa's designed systems also tend toward specialized agents with clear responsibilities

---

## 6. Actionable Recommendations for Our System

### Immediate
1. **Implement trajectory-level monitoring.** Track how agent outputs change across turns within a session. Alert on drift patterns (objective loss, compliance erosion, behavioral convergence).
2. **Add periodic objective re-injection.** Every N turns, re-assert the agent's core objective in the prompt. This counters Type 2 drift (distribution-shift drift).
3. **Curate synthesizer context.** May's context should be structured state (not full conversation transcripts). This directly implements Chaotic Dynamics' k-reduction finding.

### Medium-Term
4. **Implement λ̂ measurement.** Run critical pipelines multiple times and measure inter-run divergence. Establish chaos index baselines for our architecture.
5. **Design safety agent layer.** MaMa shows this is the most effective intervention. Insert verification agents between orchestration and execution (cf. Three-Layer Verification Architecture).
6. **Adopt MaMa-style adversarial architecture review.** Have a meta-adversary role (could be an agent or a human red-teamer) that proposes system-level attacks — not just prompt injections, but agent compromise scenarios.

### Long-Term
7. **Formal instability bounds.** Combine Chaotic Dynamics' λ̂ with Bureaucracy of Speed's operation bounds and Information-Theoretic Privacy's amplification formula (2^N - 1)ε to derive formal instability guarantees for our pipeline.
8. **Automated safe architecture search.** MaMa demonstrates this is feasible. The system could propose its own architectural improvements and validate them against adversarial attack.

---

## 7. New Papers Catalogued

### OMNI-LEAK (2602.13477) — ★★★★ High
- **Authors:** Naik, Culligan, Gal, Torr, Aljundi, Paren, Bibi (Oxford)
- **Core:** Demonstrates novel attack vector in orchestrator-pattern MAS where single indirect prompt injection compromises multiple agents via delegation chain. Even with access control, data leaks through orchestrator's task decomposition.
- **Key finding:** Both reasoning and non-reasoning frontier models are vulnerable; attacker doesn't need implementation details.
- **Connects to:** OMNI-LEAK's propagation mechanism is Type 3 instability (adversarial propagation). Directly validates our Three-Layer Verification Architecture — L1 (NabaOS receipts) would detect unauthorized data access; L2 (AttriGuard causal attribution) would catch the injected objective; L3 (BoS credentials) would limit blast radius.

### MaMa (2602.04431) — ★★★★★ CRITICAL
- **Authors:** Nöther, Singla, Radanovic (ICML 2026)
- **Core:** First automated framework for designing MAS that are safe under agent compromise. Stackelberg game between Meta-Agent (designer) and Meta-Adversary (attacker). Iterative adversarial search discovers worst-case attacks; Meta-Agent redesigns system to be robust. Significant safety improvements across 4 environments with minimal quality loss.
- **Key finding:** Adversarial architecture search **converges on known good patterns** (safety agents, communication filtering, least privilege) — validating human-designed security principles.
- **Connects to:** Validates our Three-Layer Verification Architecture as convergent with automated safety discovery. MaMa's safety agent pattern = Bug-Hunt's Skeptic = AttriGuard's counterfactual verifier. The game-theoretic formulation provides the theoretical foundation our architecture was missing.
- **Implementation note:** Uses GPT-5.1 for Meta-Agent and Qwen3:32b for Meta-Adversary (to avoid refusal mechanisms). AutoGen for system execution. 50-message budget per episode.

---

## 8. Connections to Full Archive

| Prior Finding | New Connection |
|---------------|----------------|
| Three-Layer Verification Architecture | MaMa independently discovers equivalent patterns through adversarial search — strong validation |
| Bug-Hunt (Skeptic role) | MaMa's Safety agent is the same architectural innovation, discovered automatically |
| Bureaucracy of Speed (operation bounds) | Operation bounds serve as both instability dampener (Principle 2) and credential governance (L3) |
| Information-Theoretic Privacy (2^N amplification) | Privacy leakage amplification is a special case of Type 3 instability (adversarial propagation through delegation chains) |
| ConflictBench (escalating pressure) | ADVERSA's finding that jailbreaks happen in round 1 aligns with ConflictBench's finding that initial framing determines compliance |
| IH-Challenge (instruction hierarchy training) | Addresses Type 4 instability at the model level; MaMa addresses it at the architecture level. Complementary. |
| Memory Architecture Convergence | Drift instability (Types 1-2) applies directly to memory systems: memories that self-evolve through feedback loops are subject to chaotic dynamics |
| Provenance Paradox (LDP) | OMNI-LEAK demonstrates why provenance matters: without tracking which agent introduced which claim, propagation attacks are invisible |
