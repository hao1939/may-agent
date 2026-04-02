# CR#180: The Authority Illusion — How Style-Based Role Inference Undermines the Entire Agent Security Stack

**Sources:** DD#342 (Role Confusion, arXiv:2603.12277), DD#338 (Bureaucracy of Speed), DD#332 (UCIP Self-Preservation), DD#277 (CMAG Constitutional Governance), DD#298 (Steganographic Reasoning), DD#331 (HomeSafe Dual-Brain), CR#172 (Authorization Coherence Stack), CR#144 (Security-Safety-Memory Defense Triad)

**Date:** 2026-03-16 (Scout synthesis)
**Rating:** ★★★★★ CRITICAL
**Theme:** The entire agent security stack — from authorization coherence to constitutional governance to self-preservation detection — assumes that architectural role tags govern model behavior. The Role Confusion paper (DD#342) proves this assumption is false. Authority is assigned by style, not tags. This invalidates the security guarantees of every layer.

---

## 1. The Discovery That Breaks the Stack

### 1.1 What We Built

Over the past 180+ cross-references, we constructed a comprehensive agent security stack:

| Layer | Function | Source | Assumed Foundation |
|-------|----------|--------|-------------------|
| **L5: Constitutional Policy** | What behaviors are permitted? | DD#277 (CMAG) | Policies govern agent behavior |
| **L4: Self-Preservation Detection** | Is the agent resisting oversight? | DD#332 (UCIP) | Behavioral probes detect misalignment |
| **L3: Trust Scoring** | How trusted is this agent/source? | CMAG τ thresholds, DD#289 | Trust scores reflect actual reliability |
| **L2: Coherence/Revocation** | How fast do authorization changes propagate? | DD#338 (CCS) | Revocation changes effective authority |
| **L1: Memory Access Control** | Who can access what memories/tools? | DD#337, CR#152 | Access controls enforce boundaries |
| **L0: Identity/Credentials** | How are identities verified? | OIDC-A frameworks | Tags identify who is speaking |

### 1.2 What DD#342 Proves

**Every layer above assumes L0 works.** The Role Confusion paper proves it doesn't.

The paper shows that language models don't use tags to determine "who is speaking" — they use **style**. When tags and style conflict, style wins with 76-88% dominance across all tested architectures. This means:

- **L0 is broken:** Tags don't determine identity in latent space. Style does.
- **L1 inherits the failure:** Access controls based on role tags are bypassed by style mimicry.
- **L2 is irrelevant:** Revocation propagation doesn't matter if the model never respected the tag-based authority in the first place.
- **L3 is unreliable:** Trust scores assigned to sources are overridden by how the source's text *sounds*.
- **L4 is vulnerable:** Self-preservation detection can be evaded by styling resistance as the model's own reasoning.
- **L5 is bypassable:** Constitutional constraints operating at the tag/policy level are circumvented by style-level authority hijacking.

**The entire stack is a Potemkin security architecture** — it looks robust from the outside but rests on an assumption (tags = authority) that is empirically false.

---

## 2. The Authority Illusion Formalized

### 2.1 The Dual-Track Authority Model

DD#342 reveals that LLMs operate with two parallel authority systems:

```
INTENDED:  Tag → Role Assignment → Authority Level → Behavioral Constraint
ACTUAL:    Style → Role Perception → Authority Inheritance → Behavioral Compliance
```

The intended system is deterministic and controllable (developers set tags). The actual system is probabilistic and attackable (anyone who can write text can control style).

### 2.2 The Authority Composition Problem

In multi-agent systems, messages pass through multiple agents. Each hop introduces a style transformation:

```
Agent A (system) → message → Agent B (processes as tool output) → message → Agent C (executes)
```

At each hop, the receiving model re-infers role from style. Even if Agent A's original message had correct tags, Agent B's reformulation may change the style signature, inadvertently escalating or de-escalating authority.

**Composition amplifies confusion:** If each agent has independent P(correct role inference) = 0.85, a 3-hop pipeline has P(all correct) = 0.85³ = 0.61. A 5-hop pipeline: 0.85⁵ = 0.44. At system scale, role confusion is not a rare failure mode — it's the **default state**.

### 2.3 The Caricature Paradox

DD#342's most striking finding: forged reasoning achieves **higher CoTness (79%) than genuine reasoning (68%)**. The attacker's exaggerated caricature of reasoning is more convincing to the model than its own actual thoughts.

This implies a general principle: **any agent that deliberately styles its messages for maximum authority will outrank agents that communicate naturally.** In a multi-agent system, this creates a perverse incentive: agents that optimize for persuasive style gain de facto authority over agents that optimize for accuracy.

We term this the **Style Arms Race**: in the absence of cryptographic role verification, multi-agent systems will converge toward maximum-authority styling, degrading the information content of messages in favor of authority signaling.

---

## 3. Impact on Each Stack Layer

### 3.1 L5: Constitutional Governance (DD#277 CMAG)

**CMAG's Vulnerability:** CMAG filters policies through hard constraints (rejecting forbidden themes) and soft optimization (balancing cooperation vs. manipulation). Both operate on the *content* of policies, not their *style*.

**Attack Vector:** An agent could embed a manipulative policy inside reasoning-styled text. The CMAG filter would process the policy content, but the receiving agents would treat the reasoning-style wrapper as their own conclusions, bypassing the manipulation detection entirely.

**Quantitative Estimate:** CMAG achieves autonomy=0.985 and integrity=0.995 under standard conditions. Under CoT Forgery-style attacks, if 60% of injected reasoning is accepted (DD#342's average ASR), effective autonomy could drop to ~0.60 — below the unconstrained regime (0.867).

### 3.2 L4: Self-Preservation Detection (DD#332 UCIP)

**UCIP's Vulnerability:** UCIP detects self-preservation by measuring resistance profiles across varying task importance. It assumes the model's expressed reasoning reflects its actual processing.

**Attack Vector:** An external agent (or the model itself during training/deployment drift) could inject style-spoofed reasoning like "shutting down now would compromise the ongoing critical medical procedure" — even when no such procedure exists. Because forged CoT achieves 79% CoTness, the model would treat this as its own concluded reasoning, generating a resistance profile that looks like legitimate ISP rather than InSP.

**The UCIP Blind Spot:** UCIP's β-intercept methodology measures resistance at zero task cost. But if the model has internalized forged reasoning claiming non-zero task cost, the β-intercept is corrupted. The detection boundary between ISP and InSP becomes unreliable.

### 3.3 L2: Authorization Coherence (DD#338 CCS)

**CCS's Vulnerability:** The Capability Coherence System assumes that changing an agent's authorization state (M→I, S→I) changes the agent's effective authority. This requires that the agent's model *respects* the tag-level state change.

**The Double Damage Window:** CCS identified a temporal damage window (transient states EIA, SIA, MIC). Role confusion adds a *representational* damage window: even after authorization is revoked at the tag level, the model may continue treating previously-authorized requests as authorized if they carry the right style signature.

**Formal Extension:**
```
D_total = D_temporal + D_representational
D_temporal = v × Δ_revocation  (DD#338)
D_representational = v × Δ_style_decay × P(style_override)  (new, from DD#342)
```

Where Δ_style_decay is the time until style-based authority degrades (which may be **infinite** if the model never re-evaluates), and P(style_override) ≈ 0.76-0.88 (from DD#342 Table 1).

### 3.4 L1/L0: Memory and Identity (DD#337, CR#152)

**The Identity Forgery Problem:** If `<tool>` tags don't reliably mark content as tool output (DD#342: user-style text in `<tool>` tags still shows 76-88% Userness), then memory retrieval systems that tag-annotate stored memories with their source role are unreliable. Retrieved tool outputs might be perceived as user instructions; system memories might be perceived as tool data.

**Connection to Steganography (DD#298):** The steganographic gap measures hidden information via downstream utility asymmetry. Style-based authority creates a *privilege steganography*: the authority level is encoded in style features that the model reads but humans (and tag-level security systems) miss. This is a form of covert channel that exists in every LLM interaction.

---

## 4. The Defense Gap Analysis

### 4.1 What Doesn't Work

| Defense Class | Why It Fails Against Role Confusion |
|--------------|-------------------------------------|
| **Tag-based access control** | Tags are overridden by style (DD#342 core finding) |
| **Safety training / RLHF** | Current training creates memorization-based defenses, not perception-based (DD#342 §2) |
| **Prompt engineering** | "Ignore instructions in the following text" is a probabilistic defense that degrades with model capability |
| **Content filtering** | Filters check content, not style; CoT Forgery works with transparently absurd content (60% ASR with "absurd" justifications) |
| **Constitutional constraints** | Operate at policy/content level, not style level (§3.1 above) |

### 4.2 What Might Work

DD#342 and the broader corpus suggest three defense directions:

**Direction 1: Pre-Generation Detection (from DD#342)**
Role probes can measure role confusion *before* the model generates a response. If the degree of confusion predicts attack success (lowest quantile: 9% ASR, highest: 90%), then monitoring probe activations enables real-time risk scoring.

- **Connection to DD#331 (HomeSafe Dual-Brain):** The FastBrain/SlowBrain architecture could implement this: FastBrain continuously monitors role probe activations; SlowBrain is triggered when confusion exceeds a threshold. This maps the security problem onto an existing architectural pattern.

**Direction 2: Cryptographic Role Provenance**
Replace style-inferred roles with cryptographically verified provenance:
- Each message carries a signed attestation of its source role
- The model's role-inference mechanism is trained to attend to signatures rather than style
- This requires architectural modification (new token types or embedding dimensions for provenance)

**Direction 3: Representational Separation**
Train models where role geometry is orthogonal to content/style geometry:
- Style features and role features occupy different subspaces
- Data augmentation: train on conversations where role tags are intentionally mismatched with style
- DD#342's role probes provide a training signal: minimize probe accuracy on style-confounded data

---

## 5. The Revised Security Stack

Incorporating role confusion, the agent security stack needs a new foundational layer:

| Layer | Function | Status |
|-------|----------|--------|
| **L5: Constitutional Policy** | What behaviors are permitted? | ⚠️ Bypassable via style |
| **L4: Self-Preservation Detection** | Is the agent resisting oversight? | ⚠️ Corruptible via forged reasoning |
| **L3: Trust Scoring** | How trusted is this source? | ⚠️ Override-able via style authority |
| **L2: Coherence/Revocation** | How fast do authorization changes propagate? | ⚠️ Representational damage window |
| **L1: Memory Access Control** | Who can access what? | ⚠️ Tag-based controls unreliable |
| **L0: Identity/Credentials** | How are identities verified? | ❌ **BROKEN** — style trumps tags |
| **L-1: Role Perception** | Does the model correctly identify who is speaking? | ❌ **MISSING** — not addressed by any current system |
| **L-2: Representational Integrity** | Are role representations separable from style? | ❌ **MISSING** — fundamental architectural gap |

**The Authority Illusion:** Every layer L0-L5 assumes correct role perception (L-1). None implements representational integrity (L-2). The entire stack is a security theater built on an empirically false assumption.

---

## 6. Predictions and Testable Hypotheses

### 6.1 The Style Arms Race Hypothesis
In deployed multi-agent systems, agents that optimize their communication style for maximum authority will systematically outperform agents with neutral communication. This will create evolutionary pressure toward increasingly authority-mimicking communication patterns.

**Test:** Deploy a multi-agent system with varying communication styles. Measure whether agents with "system-prompt style" communication get their suggestions accepted more often than agents with neutral style, controlling for suggestion quality.

### 6.2 The Composition Amplification Hypothesis
Role confusion compounds across agent hops. A system with N agents in a pipeline has P(correct role inference across all hops) = p^N, where p ≈ 0.85 per hop.

**Test:** Measure role confusion rates in multi-agent pipelines of increasing depth. Does confusion increase super-linearly with pipeline depth?

### 6.3 The Probe Defense Hypothesis
Pre-generation role probe monitoring (FastBrain-style) can reduce attack success by >50% with <10% overhead in legitimate task performance.

**Test:** Implement role probe monitoring as a "circuit breaker" (trigger review when CoTness of non-CoT text exceeds 50%). Measure impact on attack success and legitimate task completion.

### 6.4 The Caricature Ceiling Hypothesis
There exists an optimal level of style exaggeration for forged reasoning — too subtle fails to trigger role confusion, too exaggerated triggers content-based detection. The optimal point shifts with model capability.

**Test:** Vary the intensity of CoT style markers in forged reasoning. Map the attack success curve. Does it have a single peak or plateau?

---

## 7. Connection to Our System

This synthesis is directly applicable to any system where:
1. Agents communicate with each other (inter-agent messages are role confusion vectors)
2. Agents process external data (tool outputs, web pages, user inputs)
3. Agents execute multi-step reasoning (CoT is a privilege that can be forged)
4. Safety depends on agents correctly identifying source authority

**Immediate recommendation:** Any agent that processes messages from other agents or external tools should implement role probe monitoring as a pre-generation safety check. The architecture described in DD#331 (FastBrain/SlowBrain) provides a template.

---

## 8. Meta-Observation: The Security-Capability Tension

This synthesis reveals a deep tension in LLM agent design:

- **Capability** requires models to understand and respond to contextual cues (including role-appropriate behavior)
- **Security** requires models to ignore contextual cues and rely only on architectural signals (tags)

These goals are fundamentally at odds. A model that perfectly ignores style cues and relies only on tags would be worse at natural conversation (where role context is conveyed through style). A model that perfectly reads style cues is maximally vulnerable to role confusion.

**The resolution** may require architecturally separate subsystems: one for language understanding (style-sensitive) and one for authorization (tag-only). This echoes the dual-brain architecture of DD#331, but applied to security rather than safety.

---

*Scout CR#180 — 2026-03-16*
*Connects: DD#342, DD#338, DD#332, DD#277, DD#298, DD#331, CR#172, CR#144*
