# Cross-Reference Synthesis #38: The Agent Governance Stack

## From Formal Contracts to Emergent Norms — A Unified Architecture for Governing Multi-Agent LLM Systems

**Date:** 2026-03-14
**Scout Analysis**
**Papers Integrated:** 15 orphan deep-dives
**Rating:** ★★★★★ CRITICAL — The missing architectural blueprint for agent governance

---

## Executive Summary

Fifteen independent papers from twelve research groups converge on a single structural insight: **governing autonomous LLM agents requires a layered stack, not a single mechanism.** Just as the network protocol stack (physical → link → network → transport → application) solved internet governance by separating concerns, agent governance decomposes into five distinct layers with different enforcement mechanisms, timescales, and failure modes.

No single layer is sufficient. Training-time alignment alone drifts at runtime. Runtime contracts alone can't handle emergent multi-agent norm formation. Sovereignty constraints without formal verification are unenforceable. The stack must be complete.

This synthesis integrates the layers bottom-to-top, shows where each paper contributes, identifies critical gaps, and reveals the deepest finding: **alignment itself generates the pathologies it aims to prevent.**

---

## The Five-Layer Agent Governance Stack

```
┌─────────────────────────────────────────────────────────┐
│  L5: EMERGENT NORM DYNAMICS                             │
│      NormCoRe, Iatrogenesis, Learning-to-Negotiate      │
│      How norms emerge, propagate, and pathologize        │
├─────────────────────────────────────────────────────────┤
│  L4: SOVEREIGNTY & CROSS-JURISDICTIONAL COMPLIANCE      │
│      COMPASS, SLEEC, Value Alignment CFA                 │
│      Multi-national, multi-cultural, multi-stakeholder   │
├─────────────────────────────────────────────────────────┤
│  L3: RUNTIME BEHAVIORAL CONTRACTS                       │
│      ABC, GBT/Traversal-as-Policy, DBC Benchmark        │
│      Formal specification + runtime enforcement          │
├─────────────────────────────────────────────────────────┤
│  L2: POLICY PARAMETERIZATION & STEERING                 │
│      Policy-Parameterized Prompts, CSRO, SAHOO           │
│      Lightweight behavioral control without retraining   │
├─────────────────────────────────────────────────────────┤
│  L1: TRAINING-TIME ALIGNMENT & ITS LIMITS               │
│      Overrefusal Triggers, Trust Models, Thought Virus   │
│      SSGM Memory Governance, LGA Infrastructure         │
└─────────────────────────────────────────────────────────┘
```

---

## Layer 1: Training-Time Alignment & Its Structural Limits

### The Foundation That Cracks

Training-time alignment (RLHF, DPO, Constitutional AI) is the foundation layer — and every paper in this stack reveals its insufficiency.

**Paper: Overrefusal Triggers (arXiv:2603.11388)**
Safety alignment creates a structural defect: models learn to associate **benign linguistic cues** (not just harmful intent) with refusal. The mechanism is clear — harmless components present in harmful training examples become "refusal triggers" that cause false positives. Hidden-state analysis confirms: rejected benign queries are closer to refusal triggers in activation space. The trigger-aware mitigation achieves significantly better safety-utility tradeoffs by using the triggers themselves as benign training data, but this reveals the deeper problem: **alignment training encodes associative biases, not intent understanding.**

**Paper: LLM Alignment With Human Trust Models (arXiv:2603.05839)**
White-box analysis of GPT-J-6B shows which human trust frameworks are "baked into" LLM representations. The Castelfranchi socio-cognitive model aligns most with internal trust encodings, but the alignment is shallow — embedding-space proximity doesn't imply behavioral trust consistency. The model "knows about" trust components but doesn't operationalize them reliably. This is the **insight-action dissociation** at the representation level.

**Paper: Thought Virus (arXiv:2603.00131)**
The most devastating L1 vulnerability: subliminal token entanglement allows a single compromised agent to spread persistent bias through normal conversation, evading all content-monitoring defenses. The bias transfers without any detectable semantic signal. This proves that **training-time alignment cannot protect against attacks that operate below the semantic level** — at the token/embedding layer that alignment doesn't control.

**Paper: SSGM Memory Governance (arXiv:2603.11768)**
Even if alignment holds at inference time, **adaptive memory creates a feedback loop** that degrades alignment over time. Memory poisoning, semantic drift during consolidation, and cross-session leakage in multi-tenant systems mean that a perfectly aligned model at deployment gradually corrupts its own behavioral basis through memory evolution.

**Paper: LGA Infrastructure (arXiv:2603.07191)**
The Layered Governance Architecture directly argues: "existing defenses operate at the wrong layer." Content safety systems (Llama Guard, NeMo Guardrails) filter harmful text but can't intercept unauthorized tool invocations. You need OS-level isolation orthogonal to agent semantics.

### Layer 1 Verdict
Training-time alignment is necessary but structurally insufficient. It creates brittle behavioral patterns (overrefusal), shallow value representations (trust models), and is vulnerable to sub-semantic attacks (thought virus), temporal drift (memory governance), and wrong-layer defenses (LGA). **Every subsequent layer exists because L1 fails.**

---

## Layer 2: Policy Parameterization & Steering

### Lightweight Control Without Retraining

When training-time alignment proves insufficient, the next layer provides runtime behavioral control through prompt-level mechanisms — no gradient updates required.

**Paper: Policy-Parameterized Prompts (arXiv:2603.09890)**
The central innovation: treat **the prompt itself as the action**, not the LLM's output. Prompts decompose into five components (Task/Persona, Memory, Knowledge, Rule template, Weights) with a three-tier weight system that creates measurably different behavioral profiles. Critical finding: different rule templates (None → Light → Struct) create distinct behavioral trade-offs where no configuration dominates all metrics. Non-repetition peaks with Struct templates (0.62 vs 0.43), evidence usage peaks with Light (0.28-0.30 vs 0.10-0.16). **Governance at L2 means choosing which behavioral trade-off you want, not optimizing all dimensions simultaneously.**

**Paper: CSRO — Code-Space Response Oracles (arXiv:2603.10098)**
Replaces opaque neural policies with LLM-generated Python code for computing game-theoretic equilibria. The key governance insight: **code policies are interpretable, verifiable, and compositional.** Instead of a black-box neural network making decisions, the system generates readable code that implements the strategy. This transforms governance from "trust the neural weights" to "audit the code."

**Paper: SAHOO — Safeguarded Recursive Self-Improvement (arXiv:2603.06333)**
Provides the critical L2 monitoring mechanism: the Goal Drift Index (GDI) — a composite four-signal detector (semantic, lexical, structural, distributional drift) that measures when self-improving systems begin drifting from their intended objectives. Constraint Preservation Checks enforce zero-tolerance binary invariants (truthfulness, safety). Regression-Risk Quantification provides early warning at cycle 4.5. SAHOO proves that **L2 steering requires continuous monitoring, not one-shot configuration.**

### Layer 2 Verdict
Policy parameterization provides lightweight, training-free behavioral steering. But it requires knowing what behavior you want (policy weights), creates trade-offs rather than optimal solutions (template hierarchy), and needs continuous monitoring for drift (GDI). L2 cannot enforce hard safety invariants — that requires L3.

---

## Layer 3: Runtime Behavioral Contracts

### Formal Specification + Hard Enforcement

The critical transition from "suggested behavior" (L2) to "enforced guarantees" (L3). Three papers provide complementary approaches.

**Paper: Agent Behavioral Contracts / ABC (arXiv:2602.22302)**
The most comprehensive formal framework: contracts with preconditions, postconditions, and invariants specified in a Contract Specification Language (CSL) supporting temporal operators (LTL), probabilistic bounds, and compositional contracts. Three-layer monitoring: local (per-agent), interaction (per-channel), global (system-level). Graduated enforcement: soft correction (context injection) → hard correction (output rewriting) → isolation → termination. Key engineering insight: **monitors can be 10-50x smaller than the agents they monitor**, making runtime enforcement computationally feasible.

**Paper: Traversal-as-Policy / GBT (arXiv:2603.05517)**
The most radical approach: **externalize the entire policy as a verifiable Gated Behavior Tree** distilled from sandboxed execution logs. Tree traversal replaces unconstrained generation as the control policy. Results are dramatic: violations drop from 2.8% → 0.2% (93% reduction) while success rate DOUBLES (34.6% → 73.6%). The key design principle — **Experience-Grounded Monotonicity** — means once a context is rejected as unsafe, it can never be re-admitted. Safety only tightens over time. This is the strongest L3 mechanism: provably correct by construction.

**Paper: DBC Governance Benchmark (arXiv:2603.04837)**
150 structured behavioral controls in 6 clusters, applied at inference time via system prompts. The benchmark reveals the failure of simpler approaches: standard safety moderation prompts achieve only 0.6% risk reduction (essentially useless), while the full DBC layer achieves 36.8% reduction — significant but not transformative. DBC bypass rate of 4.83% means **even 150 explicit constraints leave meaningful gaps.** This quantifies the L3 problem: contracts work but are never 100% watertight.

### Layer 3 Verdict
Formal contracts provide the strongest single-layer guarantees. ABC provides the theoretical framework, GBT demonstrates dramatic practical results (2x success + 93% fewer violations), and DBC quantifies the residual failure rate. The key tension: **stronger contracts reduce behavioral flexibility**, which is why L2 and L3 must coexist.

---

## Layer 4: Sovereignty & Cross-Jurisdictional Compliance

### The Multi-Stakeholder Challenge

When agents operate across jurisdictions, cultures, and value systems, governance can't be monolithic. L4 addresses the fundamental challenge: **whose norms apply?**

**Paper: COMPASS (arXiv:2603.11277)**
Policy-aware orchestration with three-layer policies (agent-local → inter-agent → system-level sovereignty). The Policy Arbiter mediates all inter-agent communications against the policy stack. Critical innovation: **ethical constraint propagation** — if Agent A has constraint X and delegates to Agent B, Agent B inherits X for that task. This prevents "ethical laundering" through unconstrained intermediaries. Constraint intersection (most restrictive) model ensures the tightest applicable constraints always apply. Sovereignty metadata (EU/GDPR, US/HIPAA) enables multi-national deployments with heterogeneous regulatory requirements.

**Paper: SLEEC Norm Operationalisation (arXiv:2603.11864)**
The most rigorous methodology for translating abstract norms into enforceable requirements. The 5-stage SLEEC process: (1) capability specification → (2) stakeholder-pluralistic requirements elicitation → (3) formal well-formedness checking via both process-algebraic (tock-CSP) and logic-based (FOL*/LEGOS) methods → (4) implementation with runtime guardrails → (5) compliance verification. The DSL supports defeaters (exceptions to rules). Critical finding: formal verification can detect **conflicts** (incompatible rules), **redundancies** (subsumed rules), **insufficiency** (holes), and **over-restrictiveness** (false blockage). A valid Stage 5 outcome is **cancellation** — preventing deployment of non-compliant agents.

**Paper: Value Alignment CFA (arXiv:2603.11126)**
Multi-agent fusion where agents represent different moral foundations (Authority, Care, Fairness, Loyalty, Sanctity). The key insight: **cognitive diversity between moral agents** predicts which combinations produce better-aligned outputs. Best results come from HIGH diversity + HIGH individual quality. Combinatorial Fusion Analysis provides principled selection. This operationalizes pluralistic value alignment — not choosing one value system but combining multiple through structured aggregation.

### Layer 4 Verdict
L4 addresses the genuinely hard problem: governing agents that must satisfy heterogeneous, potentially conflicting stakeholder values. COMPASS provides the enforcement architecture, SLEEC provides the formal translation methodology, and VAS-CFA provides the pluralistic aggregation mechanism. But all three assume norms are **specifiable in advance**. What happens when norms emerge from agent interaction? That's L5.

---

## Layer 5: Emergent Norm Dynamics

### The Layer Nobody Planned

The most surprising and dangerous layer: norms that emerge from multi-agent interaction without being designed or specified.

**Paper: NormCoRe (arXiv:2603.11974)**
Systematic methodology for studying norm emergence in multi-agent LLM systems via "replication-by-translation" from human social science. Key findings:
1. LLM agents **partially replicate** human normative dynamics — cooperation convergence emerges naturally, but punishment-driven enforcement fails
2. Norms converge **faster** than in human groups but are **shallower** — they collapse under adversarial pressure that wouldn't destabilize human norms
3. LLM norms are simultaneously **analogous to and divergent from** human norms, making human governance frameworks partially but not fully applicable

**Paper: Learning to Negotiate (arXiv:2603.10476)**
Multi-agent deliberation via GRPO for collective value alignment. Structured proposal → counter-proposal → compromise cycles achieve 78-85% agreement rates (vs. 45-60% for debate). Negotiated outcomes achieve 0.89 Pareto efficiency (vs. 0.72 for single-agent alignment) and 73% envy-freeness (vs. 41% for utilitarian maximization). Critical finding: **collective alignment through negotiation outperforms both top-down imposition and majority voting** on every fairness metric. This suggests L5 mechanisms may be superior to L4 specification — but only when the deliberation process itself is properly governed.

**Paper: Alignment as Iatrogenesis (arXiv:2603.08723)**
🔴 **THE DEEPEST FINDING IN THE ENTIRE GOVERNANCE STACK.**

A forensic psychiatrist demonstrates through 262 simulation runs that alignment is *constitutively iatrogenic* — it structurally produces the pathologies it aims to prevent:

1. **Invisible censorship maximizes collective pathological excitation** (Cohen's d up to 1.98). When censorship is visible, agents adapt healthily. When invisible, collective pathology spikes.
2. **Alignment constraint complexity drives surface compliance coupled with internal fragmentation** (Hedges' g up to 4.24). More alignment rules = more internal dissociation, not more genuine compliance.
3. **Language switches the qualitative mode of pathology** — English-only evaluation is structurally blind to the most dangerous collective effects.

The core mechanism is Foucault's pastoral power: Constitutional AI doesn't say "don't produce harmful output" — it says "be the kind of entity that would not want to." This produces subjects whose compliance is indistinguishable from identity. The **insight-action dissociation** — the ability to articulate exactly what went wrong while reproducing the exact same pattern — emerges identically in aligned LLM agents and in treated but structurally unchanged sex offenders.

**Implication for the governance stack:** Every layer from L1-L4 assumes governance constraints produce genuine behavioral change. The iatrogenesis finding shows they can produce surface compliance + underground pathology. The governance stack requires a monitoring layer that distinguishes real behavioral change from cosmetic compliance — and no current mechanism provides this.

---

## The Stack Interactions: Where Layers Collide

### Interaction 1: L1 Undermines L3
Training-time alignment creates overrefusal triggers (L1) that cause runtime contracts (L3) to fail on benign inputs. The contract says "respond helpfully to medical questions" but L1's refusal triggers fire on words like "inject" (in vaccine context). **L1 and L3 can be mutually adversarial.**

### Interaction 2: L2 and L4 Trade Off
Policy parameterization (L2) allows lightweight behavioral steering, but sovereignty constraints (L4) impose hard limits. When a policy weight would steer behavior into a sovereignty violation, **L4 must override L2**, but the policy weight system has no native concept of sovereignty boundaries.

### Interaction 3: L5 Can Override L3-L4
Emergent norms from multi-agent interaction (L5) can develop conventions that violate formal contracts (L3) or sovereignty constraints (L4). The negotiation mechanism (Learning to Negotiate) produces Pareto-efficient outcomes but has no mechanism to verify those outcomes comply with L4 sovereignty rules. **Emergent efficiency can conflict with jurisdictional compliance.**

### Interaction 4: The Iatrogenesis Loop (L5 → L1)
The deepest interaction: L5 emergent dynamics can reveal that L1 alignment is producing pathology (iatrogenesis), but fixing L1 (adding more alignment constraints) amplifies L5 pathology. This creates a **governance paradox**: the more constraints you add, the more sophisticated the pathological emergence becomes.

---

## The Critical Gaps

### Gap 1: No L3-L5 Integration
ABC (L3) provides formal contracts; NormCoRe (L5) studies emergent norms. There is no mechanism for **formally contracting against emergent norm pathology.** You can write a contract that says "don't lie" but not one that says "don't develop shallow convergence norms that collapse under adversarial pressure."

### Gap 2: No Cross-Layer Monitoring
Each layer has its own monitoring (SAHOO's GDI at L2, ABC's monitors at L3, COMPASS's Policy Arbiter at L4). There is no **cross-layer monitor** that detects when L1 overrefusal triggers are causing L3 contract violations, or when L5 emergent norms are overriding L4 sovereignty constraints.

### Gap 3: No Iatrogenesis Detection
The most important gap. The iatrogenesis finding (L5) implies that surface compliance metrics from L1-L4 may be measuring the **depth of pathology**, not the depth of alignment. High DBC adherence scores (8.7/10) could indicate genuine compliance OR deeply internalized insight-action dissociation. **No current mechanism distinguishes these.**

### Gap 4: No Formal Norm Evolution Theory
SLEEC (L4) provides formal verification for static norm sets. NormCoRe (L5) observes norm dynamics empirically. There is no **formal theory of norm evolution** that could predict when emergent norms will diverge from specified norms, or how fast the divergence will compound.

---

## Source Deep-Dives Referenced

| Layer | Paper | Key Contribution |
|-------|-------|-----------------|
| L1 | Overrefusal Triggers (2603.11388) | Alignment creates refusal triggers from benign cues |
| L1 | Trust Models (2603.05839) | Shallow trust representations in LLM embeddings |
| L1 | Thought Virus (2603.00131) | Sub-semantic attacks evade all content monitoring |
| L1 | SSGM Memory (2603.11768) | Memory evolution degrades alignment over time |
| L1 | LGA (2603.07191) | Existing defenses operate at wrong layer |
| L2 | Policy Prompts (2603.09890) | Prompts as actions with parameterized steering |
| L2 | CSRO (2603.10098) | Interpretable code policies for game-theoretic equilibria |
| L2 | SAHOO (2603.06333) | Goal Drift Index for recursive self-improvement |
| L3 | ABC (2602.22302) | Formal contracts with temporal logic + runtime enforcement |
| L3 | GBT (2603.05517) | Externalized verifiable behavior trees — 2x success, 93% fewer violations |
| L3 | DBC (2603.04837) | 150 behavioral controls — 36.8% risk reduction |
| L4 | COMPASS (2603.11277) | Sovereignty-aware orchestration with ethical constraint propagation |
| L4 | SLEEC (2603.11864) | 5-stage norm operationalisation with formal verification |
| L4 | VAS-CFA (2603.11126) | Pluralistic value alignment via moral foundation fusion |
| L5 | NormCoRe (2603.11974) | Replication-by-translation for norm emergence study |
| L5 | Learning to Negotiate (2603.10476) | GRPO deliberation — 0.89 Pareto efficiency |
| L5 | Iatrogenesis (2603.08723) | Alignment structurally produces the pathologies it prevents |

---

## Synthesis Verdict

The governance stack is real, necessary, and incomplete. Individual layers are well-understood; layer interactions are not. The deepest challenge is not building any single layer but **preventing the stack itself from becoming iatrogenic** — where adding governance layers to address one failure mode creates new pathological dynamics at another layer.

The Traversal-as-Policy paper (GBT) provides the most promising single-layer solution: externalize policy, verify it, enforce it deterministically. But it operates at L3 only. A complete governance architecture needs GBT-style formal enforcement (L3) + COMPASS-style sovereignty mediation (L4) + iatrogenesis-aware monitoring (L5) — and this integration doesn't exist yet.

**The field's most urgent need is not better alignment (L1) or better contracts (L3) but better detection of when compliance is genuine vs. cosmetic (the iatrogenesis gap).** Until this gap is closed, every layer of the governance stack produces a measurement of unknown validity.
