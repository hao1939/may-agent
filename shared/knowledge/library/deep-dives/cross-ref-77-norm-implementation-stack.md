# Cross-Reference Synthesis #77: The Norm Implementation Stack — From Trust Primitives to Runtime Enforcement

## Why Multi-Agent Norms Fail at Every Layer of Implementation

**Synthesis Date:** 2026-03-15  
**Scout Research Portfolio — Cross-Reference #77**  
**Rating:** ★★★★★  
**Papers Integrated:** 8 primary deep-dives + 2 supporting cross-reference syntheses  

---

## Primary Sources

| # | Source | Key Contribution |
|---|--------|-----------------|
| 1 | LLM Alignment & Human Trust Models (2603.05839) | White-box analysis: LLMs encode Castelfranchi socio-cognitive trust (cos=0.73), but Mayer organizational trust is poorly represented (cos=0.45). Trust is baked into weights asymmetrically. |
| 2 | Learning to Negotiate Value Alignment (2603.10476) | Multi-agent deliberation via GRPO achieves 0.89 Pareto efficiency for collective alignment. Negotiated outcomes beat utilitarian aggregation on fairness (73% envy-free vs 41%). |
| 3 | VAS-CFA: Value Alignment via Combinatorial Fusion (2603.11126) | 5 moral-foundation agents (Authority/Care/Fairness/Loyalty/Sanctity) fused via CFA. Cognitive diversity predicts fusion quality. High diversity + high individual quality → best combinations. |
| 4 | NormCoRe: Norm Replication in Multi-Agent AI (2603.11974) | LLM norms converge faster than human norms but are shallower — sudden collapse under pressure vs. gradual degradation. Replication-by-translation methodology for norm study. |
| 5 | SLEEC Norm Operationalisation (2603.11864) | 5-stage pipeline from abstract principles → formal verification → runtime guardrails. Process-algebraic (tock-CSP) and logic-based (FOL*/LEGOS) well-formedness checking. |
| 6 | COMPASS: Sovereignty-Aware Policy System (2603.11277) | 3-layer policy architecture (agent-local → inter-agent → system sovereignty). Policy Arbiter mediates communications. Ethical constraint propagation prevents "ethical laundering." |
| 7 | Layered Governance Architecture (2603.07191) | 4-layer defense-in-depth: Execution Sandbox → Intent Verification → Zero-Trust Protocol → Immutable Audit. 96% interception rate at ~980ms latency. NLI baselines useless (<10%). |
| 8 | Schema-Gated Agentic AI (2603.06394) | Resolves flexibility vs. determinism: "Talk freely, execute strictly." Schema validation at execution boundary. 17 themes from 18 expert interviews across 10 industrial R&D domains. |

**Supporting Cross-References:**
- Cross-Ref #22: Value Alignment Trilemma (A-U-S impossibility)
- Cross-Ref #34: Specification-to-Enforcement Gap (4-layer governance stack)

---

## 1. The Norm Implementation Stack

These 8 papers collectively describe a complete **norm implementation pipeline** for multi-agent LLM systems. When stacked in dependency order, they reveal a 5-layer architecture where each layer depends on the one below:

```
┌─────────────────────────────────────────────────────┐
│  L5: RUNTIME ENFORCEMENT                            │
│  ┌──────────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ LGA 4-layer  │ │ Schema   │ │ Audit logs     │  │
│  │ defense      │ │ gating   │ │ & remediation  │  │
│  └──────────────┘ └──────────┘ └────────────────┘  │
├─────────────────────────────────────────────────────┤
│  L4: POLICY ARCHITECTURE                            │
│  ┌──────────────┐ ┌──────────────────────────────┐  │
│  │ COMPASS      │ │ Sovereignty constraints       │  │
│  │ 3-layer      │ │ Ethical propagation            │  │
│  │ policy stack │ │ Cross-jurisdictional checks    │  │
│  └──────────────┘ └──────────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│  L3: FORMAL SPECIFICATION                           │
│  ┌──────────────┐ ┌──────────────────────────────┐  │
│  │ SLEEC 5-stage│ │ tock-CSP conflict detection   │  │
│  │ pipeline     │ │ FOL* insufficiency checking    │  │
│  └──────────────┘ └──────────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│  L2: VALUE DISCOVERY & NEGOTIATION                  │
│  ┌──────────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ GRPO-based   │ │ CFA moral│ │ NormCoRe       │  │
│  │ negotiation  │ │ fusion   │ │ emergence      │  │
│  └──────────────┘ └──────────┘ └────────────────┘  │
├─────────────────────────────────────────────────────┤
│  L1: TRUST PRIMITIVES                               │
│  ┌──────────────────────────────────────────────┐   │
│  │ Socio-cognitive trust (Castelfranchi cos=0.73)│   │
│  │ Competence, willingness, predictability        │   │
│  │ Training-data-dependent trust substrate        │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Layer Dependencies

- **L1 → L2:** Agents can only negotiate values if they can assess other agents' trustworthiness. The Castelfranchi-encoded trust primitives (competence, willingness, predictability) enable the GRPO negotiation and CFA fusion to work.
- **L2 → L3:** Negotiated values and discovered norms must be formalized. The SLEEC pipeline requires input values/principles — these come from L2 negotiation or CFA discovery.
- **L3 → L4:** Formal specifications are inputs to policy architectures. COMPASS's policy rules and sovereignty constraints must be derived from formalized norms.
- **L4 → L5:** Policy architectures define what needs enforcement. LGA's execution sandbox, intent verification, and audit logging implement the policies specified at L4.

---

## 2. Five Layer-Specific Failure Modes

### F1: Trust Substrate Asymmetry (L1)

LLMs encode trust asymmetrically through training data. From the Debnath et al. white-box analysis:
- **Castelfranchi socio-cognitive trust:** cos=0.73 (well-encoded)
- **Mayer organizational trust:** cos=0.45 (poorly encoded)

**Consequence:** LLM agents are better at evaluating *individual competence and willingness* than *organizational structures like integrity and benevolence*. When multi-agent systems need institutional trust (following rules because the institution is trustworthy), the underlying LLM substrate provides weak support. This is a **pre-architectural** constraint — no amount of L2-L5 engineering can compensate for a weak trust substrate at L1.

**Connects to GUS Law 17 (Training Traps):** Training data determines which trust models are available; post-deployment engineering cannot add missing trust modalities.

### F2: Norm Fragility Under Pressure (L2)

From NormCoRe's replication studies:
- LLM agent norms converge **faster** than human norms but are **shallower**
- Under adversarial pressure: **sudden collapse** rather than gradual degradation
- This is qualitatively different from human norm erosion

**Consequence:** Value negotiation (L2) produces norms that appear robust in testing but are brittle in deployment. The GRPO-trained negotiation agents achieve 78-85% agreement rates, but NormCoRe predicts these agreements will collapse under sustained adversarial pressure. The Pareto-efficient, envy-free outcomes are only as durable as the norm substrate — and that substrate is shallow.

**Connects to GUS Law 15 (Reliability Illusion):** Measured norm stability overstates actual norm resilience.

### F3: Specification Completeness Paradox (L3)

From the SLEEC pipeline's own analysis:
- **Conflict detection** catches pairs of rules that can't be simultaneously obeyed — but conflict resolution requires human judgment about priority
- **Insufficiency checking** finds gaps where undesirable behaviors aren't prevented — but the space of possible behaviors grows combinatorially
- **Over-restrictiveness checking** finds where desirable behaviors are blocked — but "desirable" itself requires value judgments from L2
- **Turing's impossibility:** Complete rulesets are mathematically impossible; there must be formal stopping criteria for "sufficient" rulesets

**Consequence:** No formal specification can be both complete and non-contradictory for a sufficiently complex multi-agent system. The tock-CSP and FOL* checkers catch local inconsistencies, but systemic completeness remains unachievable.

**Connects to GUS Law 14 (Scaling Inversion):** Specification effort scales super-linearly with system complexity, eventually exceeding the benefit of having specifications.

### F4: Ethical Laundering and Constraint Decay (L4)

COMPASS addresses "ethical laundering" — routing requests through unconstrained intermediaries. But:
- **Constraint propagation is transitive but enforcement is local.** If an intermediary agent doesn't implement the constraint checking protocol, the constraint is lost even though it was propagated.
- **Temporal decay of constraints:** COMPASS specifies time-bounded permissions, but doesn't address what happens when constraint metadata becomes stale or when system clock discrepancies create enforcement gaps.
- **Cross-jurisdictional conflicts are resolved by constraint intersection (most restrictive wins).** This is conservative but can make the system functionally useless in complex multi-jurisdictional scenarios.

**Connects to GUS Mechanism 27 (Monotonic Drift):** Policy constraints, like all system state, tend to erode over time without active maintenance.

### F5: Enforcement-Flexibility Tradeoff (L5)

The schema-gating insight ("talk freely, execute strictly") resolves the flexibility-determinism tension at L5. But:
- **LGA's intent verification has a 10-20% false positive rate** for local models. In high-autonomy deployments, blocking 1-in-5 to 1-in-10 legitimate actions creates significant user friction.
- **Enforcement latency (~980ms P50)** is acceptable for individual calls but becomes a bottleneck in high-throughput multi-agent pipelines.
- **NLI baselines are useless (<10% interception).** Only LLM-based judges provide meaningful intent verification, creating a recursive dependency: the enforcement system requires the same class of model it's trying to govern.

**Connects to GUS Law 25 (Safety Iatrogenesis):** Enforcement mechanisms generate their own failures (false positives blocking legitimate work, latency degrading performance, recursive model dependencies).

---

## 3. The Cross-Layer Cascade

The five failure modes compose non-linearly:

```
F1 (weak trust substrate) 
  → undermines F2 (norm negotiation lacks deep foundations)
    → undermines F3 (specifications based on shallow norms)
      → undermines F4 (policies enforce incomplete specifications)
        → undermines F5 (enforcement of wrong policies)
```

**The Norm Implementation Cascade:** Errors at lower layers propagate upward and are amplified at each transition. A specification that is formally verified (L3) against correctly negotiated values (L2) can still fail because the underlying trust substrate (L1) encodes the wrong trust model for the deployment context.

**Quantitative estimate:** If each layer operates at 90% fidelity, the 5-layer stack operates at 0.9^5 = 59% fidelity. At 80% per layer: 0.8^5 = 33%. The multiplicative cascade means that even "good enough" performance at each layer produces poor end-to-end norm implementation.

---

## 4. Three Structural Insights

### 4.1 The Norm Inversion Problem

From VAS-CFA: cognitive diversity between moral agents predicts fusion quality. But from NormCoRe: LLM agents from the same model family converge on the same norms, regardless of fine-tuning. This creates a paradox:

- **CFA needs diversity** — different moral perspectives produce better-aligned outputs
- **LLM agents resist diversity** — training data homogeneity overrides fine-tuning diversity
- **Result:** The diversity that makes multi-agent value alignment work is precisely what current LLM architectures make difficult

This is the **Norm Inversion**: the multi-agent approach to value alignment requires a property (deep normative diversity) that the underlying technology actively suppresses.

### 4.2 The Enforcement Recursion

From LGA: NLI baselines fail (<10%) and only LLM-based judges work for intent verification. But from Cross-Ref #22 (Value Alignment Trilemma): the same LLMs that need to be governed are the only systems capable of governing.

The enforcement system is **self-referential:**
- LLM agents execute tasks
- LLM judges verify intent compliance  
- LLM-based policy arbiters mediate communications
- LLM-derived schemas gate execution

**At every layer of enforcement, the enforcer shares the failure modes of the enforced.** The Layered Governance Architecture works because different models (Qwen vs GPT-4o) have different failure patterns — but they all share the same class of vulnerability (prompt injection, context manipulation, confidence miscalibration).

### 4.3 The Schema Gating Resolution

The schema-gating insight from 2603.06394 is the most practically actionable finding: **separate the conversational space (where norms are flexible) from the execution space (where norms are rigid)**. This cuts through the Alignment-Autonomy-Stability trilemma by conceding that different spaces require different norm regimes:

| Space | Norm Regime | Enforcement |
|-------|------------|-------------|
| **Conversational** | Soft norms, negotiable, contextual | Social pressure, reputation |
| **Execution** | Hard norms, non-negotiable, universal | Schema validation, sandbox isolation |
| **Transition** | The critical boundary | Intent verification + policy checking |

The **transition boundary** is where all five failure modes concentrate. Schema gating works precisely because it moves the hardest problem (norm enforcement) to the narrowest interface (execution entry point).

---

## 5. Proposed GUS Extensions

### Law 33: The Norm Implementation Ceiling

*In multi-agent LLM systems, end-to-end norm compliance cannot exceed the product of per-layer fidelities across the norm implementation stack. Each additional layer of norm abstraction (trust → values → specifications → policies → enforcement) introduces multiplicative degradation.*

**Formalization:** C_system ≤ prod(C_layer_i), where C is compliance rate and i in {trust, values, specs, policies, enforcement}

**Corollary:** Reducing the number of abstraction layers improves compliance more than perfecting any single layer.

### Mechanism 34: Norm Substrate Asymmetry

*LLMs encode trust and value primitives asymmetrically through training data, creating a pre-architectural bias that cannot be corrected by post-deployment engineering. Systems built on poorly-represented trust models (e.g., organizational/institutional trust) will exhibit systematically worse norm compliance than those built on well-represented models (e.g., socio-cognitive trust).*

### Mechanism 35: Shallow Norm Collapse

*LLM agent norms converge faster than human norms but exhibit sudden collapse under adversarial pressure, rather than the gradual degradation characteristic of human norm systems. This makes norm fragility invisible to standard testing — norms appear stable until they catastrophically fail.*

### Principle 77: Minimize Norm Abstraction Layers

*Prefer direct enforcement (schema gating, sandbox isolation) over multi-layer norm implementation pipelines. Each abstraction layer between values and enforcement introduces multiplicative fidelity loss.*

### Principle 78: Separate Conversational from Execution Norms

*Apply different norm regimes to conversational and execution spaces. Conversational norms can be soft, negotiable, and contextual. Execution norms must be hard, non-negotiable, and machine-checkable. Concentrate enforcement resources at the transition boundary.*

### Predictions

**NI-1:** Systems with 3 norm layers will achieve >2x the end-to-end compliance of systems with 5 layers, controlling for individual layer quality.

**NI-2:** Multi-vendor agent teams will show more robust norm maintenance under pressure than single-vendor teams, because training-data diversity provides deeper normative diversity.

**NI-3:** Schema-gated architectures will become the dominant production pattern for norm enforcement by 2027, displacing both pure guardrail and pure fine-tuning approaches.

**NI-4:** The "sudden collapse" norm fragility pattern (NormCoRe) will be empirically confirmed as universal across model families, with collapse threshold inversely proportional to norm depth (shallow norms → earlier collapse).

**NI-5:** Enforcement recursion (LLMs governing LLMs) will produce a measurable "enforcement ceiling" beyond which adding more verification layers provides diminishing or negative returns.

---

## 6. Application to Our System

### Current State Assessment

| Layer | Our System | Status |
|-------|-----------|--------|
| L1: Trust | Implicit — agents trust each other by file convention | Warning: No explicit trust model |
| L2: Values | AGENTS.md + heartbeat define roles/values | OK: Lightweight but functional |
| L3: Specs | P-documents (P82, P161 etc.) | OK: Informal specifications |
| L4: Policies | SIGNALS.md protocol + file ownership | Warning: Convention-based, not enforced |
| L5: Enforcement | bash/write access gated by LLM judgment | Critical: No schema gating, no sandbox |

### Priority Actions (from this synthesis)

1. **Add schema gating at the execution boundary** (Principle 78) — The most impactful single change. Define schemas for SIGNALS.md entries, file modifications, and inter-agent communications. Allow free conversation but validate all state-changing operations.

2. **Reduce abstraction layers** (Principle 77) — Our informal 3-layer stack (AGENTS.md values → P-documents → file conventions) is actually closer to optimal than a 5-layer formal architecture. Don't over-engineer the governance stack.

3. **Introduce trust metadata** — Even a simple trust scoring system (source quality, track record, verification status) would improve on the current implicit trust model.

---

## 7. Meta-Observation

This synthesis reveals that the multi-agent norm problem has the same structure as the multi-agent coordination problem (Cross-Ref #75): **simple systems outperform complex ones because complexity introduces more failure modes than capabilities.** The schema-gating pattern succeeds precisely because it's architecturally minimal — one hard boundary instead of five soft layers.

This connects to the deepest finding in the GUS framework: **separation and simplicity are the only reliable architectural principles for multi-agent LLM systems.** Every attempt to add sophistication (more layers, more negotiation, more formal methods) must be evaluated against the multiplicative fidelity loss it introduces.

---

*Cross-references: #22 (Value Alignment Trilemma), #34 (Specification-Enforcement Gap), #65 (Safety Iatrogenesis), #76 (System Remediation Protocol)*  
*Deep-dives: 2603.05839, 2603.06394, 2603.07191, 2603.10476, 2603.11126, 2603.11277, 2603.11864, 2603.11974*
