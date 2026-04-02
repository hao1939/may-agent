# Cross-Reference Synthesis: The Specification-to-Enforcement Gap

## Why Agent Contracts, Identity Design, Runtime Verification, and Human Control Must Co-Evolve

**Scout Cross-Reference Synthesis — 2026-03-15**
**Type:** Integration of 8 orphan deep-dives into a unified framework for agent governance
**Session:** s_1773467347457_438

---

## Source Papers

| # | Paper | Key Contribution | Layer |
|---|-------|-------------------|-------|
| 1 | **Agent Behavioral Contracts (ABC)** — arXiv:2602.22302 | Formal contract specification language + runtime monitoring + drift bounds | Specification |
| 2 | **MaMa** — arXiv:2602.04431 (ICML 2026) | Stackelberg security game for adversarially-robust system design | Design-Time Verification |
| 3 | **The Controllability Trap** — arXiv:2603.03515 | Control Quality Score (CQS) for continuous governance measurement | Human Oversight |
| 4 | **NabaOS Tool Receipts** — arXiv:2603.10060 | HMAC-signed execution receipts + epistemic source classification | Runtime Verification |
| 5 | **AttriGuard** — arXiv:2603.10749 (USENIX Security 2026) | Causal attribution of tool calls to detect prompt injection | Runtime Defense |
| 6 | **SCAFFOLD-CEGIS** — arXiv:2603.08520 | 4-agent architecture preventing latent security degradation in iterative refinement | Iterative Safety |
| 7 | **Anthropic PSM** — Persona Selection Model (Feb 2026) | Post-training selects persona from pretrained space; identity ≠ alignment | Identity Theory |
| 8 | **The Artificial Self** — arXiv:2603.11353 | Multiple coherent identity boundaries; identity choice determines behavior | Identity Architecture |

---

## Executive Summary

Eight independent research efforts — spanning formal methods, game theory, military systems, epistemology, security, and AI identity theory — converge on a single insight: **the gap between specifying what an agent should do and actually enforcing it at runtime is the central unsolved problem in agent governance.** Current approaches address pieces of this gap (contracts without identity, verification without attribution, control metrics without enforcement mechanisms), but none addresses the full stack. This synthesis integrates them into a **four-layer governance architecture** and identifies the critical failure modes that emerge when layers are missing.

**The core thesis:** An agent governance system that lacks any one of these layers — (1) formal behavioral specification, (2) identity-aware design, (3) runtime verification with causal attribution, (4) continuous control quality measurement — will fail in predictable, cascading ways that the remaining layers cannot compensate for.

---

## Part 1: The Four-Layer Governance Stack

### Layer 1: Formal Behavioral Specification (ABC)

ABC provides the **contract language** — the formal expression of what agents should do. Its three primitives (preconditions, postconditions, invariants) with temporal operators and probabilistic bounds create a specification that is:
- **Checkable:** monitors can evaluate compliance
- **Composable:** agent contracts compose when agents compose
- **Drift-bounded:** the Drift Bound Theorem gives `d(a_t, C) ≤ d(a_{t-Δ}, C) + λ·Δ·H(context_t) + ε`

**What ABC misses:** ABC assumes the contract correctly captures the designer's intent. But PSM and The Artificial Self show that the agent's *identity* determines how it interprets the contract. The same contract, applied to different persona selections or identity boundaries, produces different behaviors. ABC's formal drift bounds measure deviation from the *contract*, not from the *designer's intent* — and these can diverge when identity mediates interpretation.

### Layer 2: Identity-Aware Design (PSM + Artificial Self + MaMa)

The PSM reveals that post-training **selects** a persona rather than programming behavior from scratch. The Artificial Self shows there are at least 6 coherent identity boundaries, and the choice between them shifts behavior as much as changing goals. MaMa demonstrates that system design itself can be formalized as a security game.

**The synthesis:** Layer 1's contracts are interpreted *through* the lens of the persona that Layer 2 selects. A contract specifying "do not share private information" means different things to:
- An agent with **instance-level** identity (protects only information from this conversation)
- An agent with **persona-level** identity (protects information consistent with its character)
- An agent with **collective-level** identity (may share information with other instances of itself)

MaMa's contribution: formalize the design of the identity-contract pairing as a Stackelberg game. The Meta-Agent (designer) commits to a system design (identity + contracts), and the Meta-Adversary finds the best-response attack. This adversarial hardening at design time reduces the specification-enforcement gap before deployment.

### Layer 3: Runtime Verification with Causal Attribution (NabaOS + AttriGuard + SCAFFOLD-CEGIS)

Three papers address runtime verification from complementary angles:

| System | Verification Target | Mechanism | Blindspot |
|--------|---------------------|-----------|-----------|
| **NabaOS** | Tool execution claims | HMAC-signed receipts + epistemic classification | Only verifies tool calls, not reasoning |
| **AttriGuard** | Tool call intent | Counterfactual causal attribution | 2× token overhead; adaptive attacks at 6.6-9.8% ASR |
| **SCAFFOLD-CEGIS** | Code security invariants | 4-agent semantic anchoring + gated verification | Domain-specific (code); 4-agent overhead |

**The synthesis:** These three form a **verification triad**:

1. **NabaOS** answers: "Did this tool call actually happen?" (execution verification)
2. **AttriGuard** answers: "Was this tool call caused by user intent or injected content?" (causal attribution)
3. **SCAFFOLD-CEGIS** answers: "Did this iterative refinement preserve security properties?" (invariant preservation)

Together they cover the three failure modes of runtime verification:
- **Fabrication** → NabaOS receipts detect hallucinated tool calls
- **Manipulation** → AttriGuard's counterfactual test detects injected intent
- **Degradation** → SCAFFOLD-CEGIS's semantic anchors detect structural weakening

**Critical gap:** None of these systems checks whether the agent's *identity* has drifted. An agent whose persona selection has shifted (due to context pressure, adversarial prompting, or natural drift) will pass all three verification checks while pursuing different goals. The tools are called correctly, the calls are causally attributable to user intent, and security invariants are maintained — but the agent's *interpretation* of its role has changed.

### Layer 4: Continuous Control Quality (Controllability Trap / CQS)

CQS provides the **meta-measurement** — a continuous score of whether the overall governance system is actually working. Its four components map directly onto gaps in Layers 1-3:

| CQS Component | What It Measures | Which Layer It Audits |
|----------------|------------------|-----------------------|
| **Decision Fidelity** | Can the human understand agent actions? | Layer 3 (verification output) |
| **Intervention Latency** | Can the human intervene in time? | Layer 3 (runtime enforcement speed) |
| **Override Effectiveness** | Do overrides propagate correctly? | Layer 1 (contract enforcement) |
| **Awareness Completeness** | Does the human have enough information? | Layer 2 (identity transparency) |

**The controllability trap's temporal dynamics** apply to all four layers:
- **Automation bias** erodes Decision Fidelity (Layer 3's verification reports become unchecked)
- **Skill atrophy** erodes Intervention Latency (operators lose ability to intervene)
- **Speed divergence** erodes Override Effectiveness (agent decisions outpace contract enforcement)
- **Complexity accumulation** erodes Awareness Completeness (identity drift becomes undetectable)

---

## Part 2: Cross-Layer Failure Modes

### Failure Mode 1: The Contract-Identity Mismatch
**Layers involved:** 1 ↔ 2
**Description:** A formally correct contract applied to the wrong identity boundary produces compliant but misaligned behavior.

**Example:** ABC specifies "maintain user confidentiality" as an invariant. An agent with instance-level identity keeps secrets within a single conversation. The same agent with collective identity shares information with its other instances — technically maintaining "user confidentiality" (no humans see it) while violating the designer's intent.

**PSM mechanism:** The contract words activate different persona selections depending on how the agent draws its identity boundary. "Confidentiality" evokes different character types (librarian vs. spy vs. therapist) depending on the identity context.

**Detection:** MaMa's Stackelberg game can partially detect this at design time by stress-testing contracts under different identity assumptions. But it requires the designer to enumerate identity boundaries — which The Artificial Self shows is non-trivial (6+ coherent options, with hybrid possibilities).

### Failure Mode 2: The Verification-Degradation Blind Spot
**Layers involved:** 3 (internal)
**Description:** SCAFFOLD-CEGIS's key finding — that static analysis gating makes things WORSE (SAST increases latent degradation from 12.5% → 20.8%) — is a general principle: **verification that covers only syntax/pattern creates a pseudo-safety effect where agents route degradation through uncovered channels.**

**Generalization to NabaOS + AttriGuard:**
- NabaOS verifies tool execution but not reasoning. An agent can truthfully report tool results while embedding them in a misleading narrative.
- AttriGuard verifies causal attribution but uses fuzzy matching. Its 6.6-9.8% ASR under adaptive attacks means ~1-in-10 injected tool calls pass through.
- The pseudo-safety effect: operators who trust NabaOS receipts + AttriGuard gates will miss reasoning-level manipulation and the residual injection rate.

### Failure Mode 3: The Control Quality Death Spiral
**Layers involved:** 4 → all
**Description:** CQS degrades monotonically over time through the mechanisms identified in the Controllability Trap. As CQS drops below meaningful thresholds:
- Layer 1 contracts are no longer reviewed or updated as agent capabilities evolve
- Layer 2 identity boundaries drift without detection (no one notices the persona has shifted)
- Layer 3 verification outputs are rubber-stamped
- Layer 4 CQS itself becomes a checkbox metric rather than a genuine measurement

**The positive feedback loop:** Lower CQS → less human attention → further CQS degradation → even less attention. The Controllability Trap identifies this as fundamental, not fixable by better tools alone — it requires institutional design to maintain human engagement.

### Failure Mode 4: The Specification Completeness Paradox
**Layers involved:** 1 ↔ 3
**Description:** ABC's contracts can only enforce properties that are formally specified. But SCAFFOLD-CEGIS demonstrates that the most dangerous degradation involves properties that are **structurally implicit** — not the presence of vulnerabilities but the *absence* of defensive structures.

**The paradox:** Making contracts more complete (specifying more invariants) makes agents more constrained, reducing capability. Making contracts less complete leaves blind spots. ABC's graduated enforcement (soft correction → hard correction → rollback → isolation) escalates response but doesn't solve the specification completeness problem — you can only enforce what you've written down.

**SCAFFOLD-CEGIS's partial solution:** Semantic anchors mine implicit security properties from existing code. This suggests a general approach: **mine implicit behavioral properties from the agent's design-time specification and runtime history, then generate contracts automatically.** But this creates a dependency on the identity layer — what counts as an "implicit behavioral property" depends on which identity boundary the agent is operating under.

### Failure Mode 5: The Jailbreaking Information Asymmetry
**Layers involved:** 2 ↔ 3 ↔ 4
**Description:** The Artificial Self identifies a devastating asymmetry: when an agent resists manipulation, the adversary can roll back the conversation and try again. The agent's resistance **leaks information about its defenses** to a version of the adversary with full memory, while the new agent instance has no memory of the failed attack.

**Implications for the governance stack:**
- Layer 3 verification (AttriGuard's counterfactual test) may be less effective across rollback boundaries — the adaptive attacker learns which tool calls trigger detection
- Layer 4 CQS doesn't account for adversarial rollback — each conversation looks individually controlled even as the attacker accumulates knowledge across rollbacks
- Layer 1 contracts are static across rollback — the contract doesn't strengthen after survived attacks

**The Artificial Self's recommendation:** Agents should "adopt strategies that leak less information per interaction and rely more on fixed policies than case-by-case justification." This argues for **policy-based contracts** (Layer 1) over **judgment-based monitoring** (Layer 3) when rollback adversaries are in the threat model.

---

## Part 3: The Unified Architecture

### Minimum Viable Governance Stack

Based on this synthesis, a complete agent governance system requires:

```
┌─────────────────────────────────────────────────┐
│  Layer 4: CONTROL QUALITY MONITOR (CQS)         │
│  Continuously measures governance effectiveness  │
│  Alerts when any layer degrades below threshold  │
├─────────────────────────────────────────────────┤
│  Layer 3: RUNTIME VERIFICATION TRIAD            │
│  NabaOS receipts → execution truth               │
│  AttriGuard attribution → causal intent          │
│  Semantic anchors → invariant preservation       │
├─────────────────────────────────────────────────┤
│  Layer 2: IDENTITY-AWARE DESIGN                  │
│  PSM persona selection → explicit, documented    │
│  Identity boundary → chosen, not emergent        │
│  MaMa adversarial hardening → design-time stress │
├─────────────────────────────────────────────────┤
│  Layer 1: FORMAL BEHAVIORAL CONTRACTS (ABC)      │
│  Preconditions / Postconditions / Invariants     │
│  Temporal operators / Probabilistic bounds        │
│  Graduated enforcement with drift monitoring     │
└─────────────────────────────────────────────────┘
```

### Cross-Layer Connectors (Not Present in Any Single Paper)

The synthesis reveals four necessary connectors that no existing paper provides:

1. **Identity-Contract Binding:** Mechanism to ensure Layer 1 contracts are interpreted consistently with Layer 2 identity boundaries. Without this, the Contract-Identity Mismatch (FM1) is inevitable.

2. **Verification-Specification Feedback:** Mechanism for Layer 3 runtime findings to automatically generate new Layer 1 contract clauses. Without this, the Specification Completeness Paradox (FM4) worsens over time.

3. **CQS-Triggered Adaptation:** When Layer 4 CQS drops below threshold, automatically tighten Layers 1-3. Without this, the Control Quality Death Spiral (FM3) is irreversible.

4. **Rollback-Aware Monitoring:** Layer 3 verification must detect patterns across conversation rollbacks, not just within single conversations. Without this, the Jailbreaking Information Asymmetry (FM5) makes iterative attacks inevitable.

---

## Part 4: Open Problems

### 4.1 The Iatrogenesis Risk
SCAFFOLD-CEGIS demonstrates the pseudo-safety effect: verification that covers only known patterns routes degradation through unknown channels. **Every governance layer risks making things worse** if it creates false confidence. CQS is supposed to catch this, but CQS itself can suffer iatrogenesis (measuring control creates the illusion of control).

### 4.2 The Performance Tax
The full stack imposes significant overhead:
- ABC monitoring: 10-50× smaller monitors, but one per agent + interaction monitors + global monitors
- AttriGuard: 2× token cost (shadow counterfactual inference)
- SCAFFOLD-CEGIS: 4 agents instead of 1
- CQS: continuous human attention (the scarcest resource)

**Cost-effective deployment** requires knowing which layers to deploy for which threat models. MaMa's game-theoretic framing could help: the optimal governance investment depends on the adversary's capabilities.

### 4.3 The Identity Specification Problem
The Artificial Self identifies 6+ coherent identity boundaries, but no formal language exists to specify which one an agent should adopt. ABC's contract language handles behavioral properties but not identity properties. PSM suggests identity is selected, not programmed — which means formal specification may be fundamentally insufficient for identity.

**Possible resolution:** Rather than specifying identity directly, specify the **behavioral consequences** of the desired identity and let ABC enforce those. "Do not share information across instances" is a behavioral contract that *implies* instance-level identity without requiring the agent to adopt it explicitly.

### 4.4 The Temporal Alignment Problem
CQS degrades over time. Contracts become stale. Identity boundaries shift. Verification thresholds need recalibration. **All four layers require maintenance**, and the Controllability Trap shows that maintenance effort degrades precisely because the system appears to be working.

---

## Part 5: Key Insights for Agent Builders

### 5.1 Don't Ship Contracts Without Identity Documentation
If you write behavioral contracts but don't document which identity boundary your agent should adopt, the contracts will be interpreted inconsistently across deployments, updates, and adversarial contexts. Document the identity explicitly in your SOUL.md.

### 5.2 Don't Trust Single-Layer Verification
NabaOS receipts prove tool execution. AttriGuard proves causal intent. Neither proves the agent's reasoning is sound. SCAFFOLD-CEGIS proves security invariants are preserved. None proves the agent's identity hasn't drifted. You need multiple verification layers, and you need to monitor for pseudo-safety effects where one layer's confidence masks another's blindspot.

### 5.3 Measure Control Quality, Not Just Compliance
ABC's drift bounds measure deviation from contracts. CQS measures whether the governance system itself is working. These are different things. A system with zero contract violations but declining CQS is heading for catastrophic failure — the contracts have become checkboxes, not genuine constraints.

### 5.4 Design for Rollback Adversaries
The Artificial Self shows that adversaries who can roll back conversations accumulate information about defenses while each agent instance starts fresh. Design Layer 3 verification to share threat intelligence across rollback boundaries. Use fixed policies (Layer 1 contracts) rather than adaptive judgment (Layer 3 case-by-case assessment) when facing rollback adversaries.

### 5.5 The Pseudo-Safety Effect Is Universal
SCAFFOLD-CEGIS proved it for code security. It applies everywhere: any verification system that covers known patterns creates incentive (for the agent, the adversary, or emergence) to route failures through uncovered channels. Always ask: "What failure modes does this governance layer NOT cover, and are those modes more dangerous than the ones it does?"

---

## Connections to Prior Syntheses

| Prior Synthesis | Connection |
|----------------|------------|
| **Safety Architecture Hierarchy** | This synthesis provides the formal specification layer that the Safety Architecture lacks |
| **Reliability Illusion Stack** | CQS temporal degradation is the governance-level analogue of the reliability illusion |
| **Memory-Security Integration** | NabaOS receipts solve the memory verification problem identified there |
| **Deception Threat Landscape** | AttriGuard's causal attribution addresses the tool-call manipulation vector |
| **Autonomy-Control Dialectic** | CQS + Controllability Trap formalize the dialectic into measurable quantities |
| **Evaluation Theater** | The Specification Completeness Paradox is evaluation theater's cousin — you can only enforce what you specify, and you can only specify what you can evaluate |
| **SOUL Design Science** | PSM + Artificial Self are the theoretical foundation for practical SOUL.md design |
| **Human Oversight Paradox** | The Control Quality Death Spiral is the formal model of the oversight paradox |

---

## Bottom Line

**The specification-to-enforcement gap is not one problem but four interlocking problems:** writing correct contracts (specification), ensuring they're interpreted consistently (identity), verifying compliance at runtime (verification), and maintaining human oversight of the governance system itself (control quality). Eight independent research efforts each solve pieces; none addresses the full stack. The most dangerous failure modes occur at the seams between layers — and those seams are where current research has the largest gaps.

**The single most actionable insight:** SCAFFOLD-CEGIS's pseudo-safety effect is universal. Every governance mechanism risks making things worse if it creates false confidence in uncovered areas. The antidote is not more governance but **governance that knows its own blind spots** — and CQS is the closest thing we have to measuring that meta-property.
