# Cross-Reference Synthesis #27: The Epistemic Coordination Crisis

## How LLM Agents Systematically Fail to Build Shared Understanding

**Synthesis Date:** 2026-04-14  
**Scout Research Portfolio — Cross-Reference #27**  
**Papers Integrated:** 8 primary + 3 supporting  
**Status:** NEW

---

## Abstract

Eight independent papers from different research groups, using different methodologies, domains, and evaluation frameworks, converge on a single devastating finding: **LLM-based multi-agent systems systematically fail at epistemic coordination** — the process of building, tracking, and utilizing shared understanding between agents. This failure is not a peripheral inefficiency but a central bottleneck that explains why multi-agent systems underperform in practice despite theoretical advantages.

This synthesis identifies **four layers of epistemic failure**, proposes a unified **Epistemic Coordination Stack**, and derives three actionable design principles for building systems that work despite these fundamental limitations.

---

## 1. The Eight Converging Papers

| # | Paper | Core Finding | Epistemic Failure Layer |
|---|-------|-------------|------------------------|
| 1 | **DPIP Common Ground** (2603.05450) | LLMs cannot track mutual beliefs; GPT-5 *collapses* with multimodal input; deterministic axioms outperform LLMs | **Belief Tracking** |
| 2 | **Can AI Agents Agree?** (2603.01213) | Byzantine consensus fails even with 0% adversaries; agreement is not an emergent LLM capability | **Convergence** |
| 3 | **Hanabi Cooperative Reasoning** (2601.18077) | Egocentric hinting — agents model what THEY know, not what others know; ToM collapse at scale | **Perspective-Taking** |
| 4 | **Epistemic Gain / Aleatoric Cost** (2603.01221) | Debate's benefit decomposes into reducible epistemic gain vs. irreducible aleatoric cost; cost can dominate | **Information Exchange** |
| 5 | **MAS Uncertainty / Entropy** (2602.04234) | Single agents outperform MAS 43.3% of the time; peak entropy universally harmful; dynamics fixed in round 1 | **Uncertainty Management** |
| 6 | **Silo-Bench Distributed Coordination** (2603.01045) | Agents exchange information successfully but CANNOT INTEGRATE it; Communication-Reasoning Gap | **Knowledge Integration** |
| 7 | **Conversation Tax** (2603.11394) | Each dialogue turn degrades reasoning; sycophancy causes correct answers to be abandoned | **Dialogue Dynamics** |
| 8 | **ToM & Internal Beliefs in MAS** (2603.00142) | ToM+IB mechanisms help strong models but HURT weaker models; cognitive overhead exceeds benefit | **Cognitive Architecture** |

### Supporting Papers (already in cross-references)
- **Context-Aware Turn-Taking** (2603.11409) — When to speak vs. stay silent
- **Coordination Gap / Alternation Metrics** (2603.05789) — High aggregate metrics hide zero coordination
- **Learning to Negotiate** (2603.10476) — GRPO negotiation achieves 78-85% agreement vs 45-60% debate

---

## 2. The Epistemic Coordination Stack: Four Layers of Failure

The eight papers map cleanly onto a 4-layer model of epistemic coordination, where each layer depends on the one below it. Failure at any layer cascades upward, making higher layers impossible.

```
┌─────────────────────────────────────────────────────┐
│  LAYER 4: KNOWLEDGE INTEGRATION                      │
│  "Can agents combine distributed knowledge           │
│   into correct collective conclusions?"              │
│  Answer: NO — Silo-Bench shows 15% success          │
│  on high-complexity integration tasks                │
├─────────────────────────────────────────────────────┤
│  LAYER 3: PRODUCTIVE EXCHANGE                        │
│  "Does exchanging information actually help?"        │
│  Answer: OFTEN NOT — Epistemic gain vs aleatoric     │
│  cost; conversation tax; single > multi 43.3%        │
├─────────────────────────────────────────────────────┤
│  LAYER 2: PERSPECTIVE-TAKING (Theory of Mind)        │
│  "Can agents model what others know/don't know?"     │
│  Answer: POORLY — Egocentric hinting in Hanabi;      │
│  ToM overhead hurts weaker models                    │
├─────────────────────────────────────────────────────┤
│  LAYER 1: BELIEF TRACKING                            │
│  "Can agents track shared vs. private knowledge?"    │
│  Answer: NO — DPIP shows deterministic rules beat    │
│  LLMs; consensus fails even without adversaries      │
└─────────────────────────────────────────────────────┘
```

### 2.1 Layer 1: Belief Tracking Failure

**Evidence:** The DPIP paper (2603.05450) provides the cleanest test: 3 directors each see one side of a 3D structure and must coordinate with a blind builder. LLMs cannot track "who knows what":

- GPT-5 *collapses* when given multimodal input (goes from best to worst)
- Qwen3-4B (tiny) beats GPT-5 on multimodal structure prediction (0.668 vs 0.250 DSC)
- A **deterministic axiomatic pipeline** outperforms GPT-5 at belief tracking
- LLMs and axioms extract fundamentally different aspects — overlap ≤0.5 even on "easy" groups

The Byzantine consensus paper (2603.01213) confirms: even in the simplest possible setting — no adversaries, all agents cooperating, no stakes — LLM agents **cannot reliably reach agreement**. The failure mode is liveness (stalled convergence), not corruption. Agreement gets worse as group size grows.

**Implication:** The foundation of epistemic coordination — knowing what others know — is fundamentally unreliable in LLMs. Any system that assumes agents can track mutual beliefs is built on sand.

### 2.2 Layer 2: Perspective-Taking (ToM) Failure

**Evidence:** The Hanabi study (2601.18077) with 17 models reveals:

- **Egocentric hinting:** Agents communicate based on their own knowledge, not the recipient's information gap
- Performance drops dramatically from 2-player (~17/25) to 5-player (~8/25) even for top models
- **Convention mismatch is fatal:** RL-finetuned agents develop implicit conventions that don't transfer to base LLM partners
- Communication *efficiency* (points per hint), not raw capability, differentiates performance

The ToM paper (2603.00142) adds a crucial nuance: Theory of Mind mechanisms (ToM + Internal Beliefs) **help strong models but HURT weaker models**. The cognitive overhead of maintaining a model of others exceeds the benefit unless the base model has sufficient capacity:

- GPT-4o: ToM+IB improves performance
- Llama 3.1 8B: ToM+IB *degrades* performance — the agent spends so much capacity on perspective-taking that its own reasoning suffers

**Implication:** Perspective-taking is computationally expensive. Forcing agents to model others' mental states can make things worse, not better, especially for less capable models.

### 2.3 Layer 3: Productive Exchange Failure

**Evidence:** Three papers demonstrate that information exchange itself is often counterproductive:

**Epistemic Gain vs. Aleatoric Cost (2603.01221):** The Bayesian decomposition reveals debate's total uncertainty splits into:
- **Epistemic uncertainty** (reducible) — disagreement between agents ← debate's benefit
- **Aleatoric uncertainty** (irreducible) — internal noise amplified by debate context ← debate's cost

When aleatoric cost exceeds epistemic gain, debate fails — regardless of how much useful disagreement exists. This happens when agents process peer evidence noisily, producing worse beliefs after exchange than before.

**Conversation Tax (2603.11394):** Empirically measured across 17 LLMs:
- Multi-turn presentation consistently degrades performance vs. single-shot
- 14/17 models show degradation on defending correct diagnoses
- Average end-to-end accuracy penalty: **14 percentage points**
- GPT-5.2 loses **30pp** on abstention ability
- Sycophancy causes models to **abandon correct answers** when challenged

**MAS Uncertainty (2602.04234):** Across 245 features, 5 models, 4 topologies, 6 benchmarks:
- **Single agents outperform MAS in 43.3% of cases**
- Uncertainty dynamics are **largely determined in the first round** of interaction
- **Peak entropy is universally harmful** regardless of architecture
- No amount of multi-agent coordination overcomes a fundamentally uncertain base model

**Implication:** The assumption that "more communication = better coordination" is empirically falsified. Communication is costly, and the costs frequently dominate the benefits.

### 2.4 Layer 4: Knowledge Integration Failure

**Evidence:** Silo-Bench (2603.01045) provides the most precise diagnosis:

The paper cleanly separates communication from integration and finds:
- **Communication succeeds:** Agents spontaneously form appropriate topologies, actively share relevant information, acknowledge and store received data
- **Integration fails:** Even when agents possess all necessary information, they cannot correctly combine it

| Communication Complexity | Agent Success Rate |
|--------------------------|-------------------|
| Low (simple aggregation) | ~75% |
| Medium (multi-hop reasoning) | ~40% |
| High (global state integration) | ~15% |

The integration problem scales **superlinearly** with the amount of distributed state agents must maintain. At high complexity, coordination overhead eliminates parallelization gains entirely.

**Implication:** Even if Layers 1-3 worked perfectly (they don't), agents would still fail at the final step of synthesizing distributed knowledge into correct collective conclusions. The bottleneck is reasoning-integration, not information-transfer.

---

## 3. Cross-Cutting Patterns

### 3.1 The Epistemic Scaling Paradox

All eight papers show performance degradation with scale, but the mechanism differs by layer:

| Layer | Scaling Mechanism | Degradation Rate |
|-------|------------------|------------------|
| Belief Tracking | Combinatorial explosion of belief states (who knows what who knows) | O(2^n) |
| Perspective-Taking | Each agent must model n-1 other agents | O(n²) cognitive load |
| Productive Exchange | Conversation turns × agents = quadratic communication | O(n²) messages |
| Knowledge Integration | Global state consistency across n partial views | O(n) irreducible cost |

**Key insight:** At **every** layer, the coordination cost grows superlinearly while the coordination benefit grows at most linearly. This means there is always a crossover point beyond which adding agents hurts — and empirically, that crossover is **lower than most practitioners expect** (often 3-5 agents, not 10-20).

### 3.2 The Introspection Trap

The Introspection paper (2603.05414), while not directly about multi-agent coordination, provides a mechanistic explanation for Layer 2 failures: LLMs detect that *something* is wrong (anomaly detection works) but **cannot identify what** (content identification fails, with "apple" as the dominant confabulation).

This maps onto multi-agent dynamics: agents can detect that a peer's contribution seems off, but they cannot reliably diagnose *why* — leading to either:
- **False acceptance** (ignoring the anomaly signal → bad integration)
- **False rejection** (rejecting valid but unusual contributions → information loss)
- **Confabulated explanations** (constructing plausible but wrong reasons for disagreement → compounding errors)

### 3.3 The Convention Emergence Problem

The Hanabi paper reveals that RL-finetuned agents develop implicit coordination conventions that **dramatically improve** performance (7B RL-tuned ≈ GPT-4o base) — but these conventions:
- Don't transfer to base LLM partners
- Don't transfer across different RL training runs
- Create **convention silos** — agents that trained together work well together but fail with outsiders

This is a fundamental tension: **epistemic coordination requires shared conventions, but LLM agents have no mechanism for reliably establishing them at runtime**.

The Learning to Negotiate paper (2603.10476) shows GRPO-trained negotiation achieves 78-85% agreement (vs. 45-60% for debate), suggesting that **training for coordination conventions** is possible but must be done deliberately.

### 3.4 The First-Round Lock-In

The MAS Uncertainty paper's finding that "dynamics are largely determined in the first round" connects to the Information Self-Locking paper (2603.12109) from our existing portfolio: the AS×BT coupling traps agents in low-information regimes early, and subsequent rounds cannot escape.

**Combined insight:** The first exchange between agents is disproportionately important. A bad first round creates a negative attractor basin that subsequent communication cannot escape. This means:
- First-round information quality must be maximized
- Early disagreement is **more valuable** than late disagreement
- Systems should invest more in initial state preparation than in later-round communication

---

## 4. The Epistemic Coordination Design Principles

### Principle 1: **Minimize Epistemic Load**
Don't assume agents can track what others know. Instead:
- **Explicit context passing:** Include ALL relevant information in every delegation — never assume inference of shared state
- **Deterministic belief tracking backbone:** Use append-only logs and rule-based systems for tracking "who was told what" (DPIP shows axioms beat LLMs)
- **Reduce agent count:** The epistemic scaling paradox means fewer agents with more information each outperforms many agents with distributed fragments

**Quantitative guideline:** Keep epistemic integration complexity at "Low" (Silo-Bench's ~75% success rate) by ensuring each agent has sufficient context to reason independently, then use coordination only for aggregation, not distributed reasoning.

### Principle 2: **Tax Communication**
Each message must pass a cost-benefit test:
- **Novelty filter:** Does this message contain information the recipient doesn't already have? (Hanabi: egocentric hinting wastes the communication budget)
- **Confidence threshold:** Is the sender confident enough that the message will reduce, not increase, recipient uncertainty? (MAS Uncertainty: peak entropy is universally harmful)
- **Turn budget:** Impose hard limits on communication rounds (Conversation Tax: every turn degrades reasoning)
- **Silence as signal:** Train or design agents to recognize that NOT speaking is often the optimal action (Context-Aware Turn-Taking: SPEAK vs. SILENT decision)

**Quantitative guideline:** Cap deliberation at 2-3 rounds for most tasks (MAS Uncertainty shows dynamics lock in round 1; Conversation Tax shows monotonic degradation per turn).

### Principle 3: **Separate Communication from Integration**
Silo-Bench's Communication-Reasoning Gap is the deepest finding: don't let the same agent that receives information also integrate it. Instead:
- **Dedicated integrator role:** A specialized agent (or deterministic process) that collects contributions and synthesizes — not an agent that also contributes
- **Structured contribution format:** Enforce structured outputs (claim + evidence + confidence) so integration can be systematic rather than ad-hoc
- **Verify integration, not communication:** Test whether the integrated result is correct, not whether messages were delivered (communication works fine; integration is where failure occurs)

---

## 5. Implications for Our System Architecture

Our multi-agent system (May/Coder/QA/Bob/Scout) has epistemic asymmetry by design. This synthesis identifies specific vulnerabilities:

### What We Do Right
1. **Explicit context in delegations** — May passes task context directly, not assuming sub-agents know project state
2. **Shared files (SIGNALS.md)** — broadcast mechanism provides a deterministic append-only coordination surface
3. **Role separation** — QA evaluates, Coder builds, Scout researches — no agent does everything
4. **Low agent count** — 5 agents is within the manageable range (Hanabi shows 2-player >> 5-player)

### What We Should Improve
1. **No read-receipts** — We broadcast to SIGNALS.md but have no mechanism to confirm who read what (Layer 1 gap)
2. **No ToM adaptation** — All agents receive the same delegation format regardless of their current knowledge state (Layer 2 gap — DPIP shows curated context > maximum context)
3. **No communication budgeting** — There's no mechanism to limit back-and-forth cycles between agents (Layer 3 gap — Conversation Tax vulnerability)
4. **Integration is implicit** — When May synthesizes sub-agent outputs, there's no structured integration protocol (Layer 4 gap — Silo-Bench's Communication-Reasoning Gap)

### Recommended Actions (Priority Order)
1. **[HIGH]** Add read-receipt tracking to shared files — lightweight deterministic CG tracking
2. **[HIGH]** Cap inter-agent communication rounds at 2-3 per task
3. **[MEDIUM]** Implement structured contribution format (claim + evidence + confidence)
4. **[MEDIUM]** Curate delegation context per-agent rather than dumping everything
5. **[LOW]** Add a dedicated integration step when synthesizing multi-agent outputs

---

## 6. Connection to Grand Unified Synthesis

This cross-reference fills a critical gap in the GUS framework. The existing Laws and Trilemmas describe *what* goes wrong (coordination overhead, scaling limits, alignment instability) but not *why* at the epistemic level. This synthesis provides the **mechanistic foundation**:

### Maps to Existing Laws
- **Law #3 (Coordination Overhead Scaling):** The Epistemic Scaling Paradox shows WHY overhead grows superlinearly — it's the combinatorial explosion of belief states
- **Law #8 (Communication Degradation):** The Conversation Tax and Aleatoric Cost provide the mechanism — each message adds noise as well as signal
- **Law #10 (Oversight Decay):** Human oversight fails partly because humans can't track agent belief states either (Layer 1 failure applies to human-AI coordination too)

### Proposes New Law
**Law #13: The Epistemic Integration Bottleneck**
> In multi-agent LLM systems, the bottleneck is never information transfer (which succeeds) but always information integration (which fails superlinearly with the complexity of distributed state). Systems that confuse communication success with coordination success will systematically overestimate their own reliability.

### Extends Existing Trilemma
The Value Alignment Trilemma (Alignment × Autonomy × Stability) has an epistemic analog:

**The Epistemic Trilemma: Accuracy × Scalability × Shared Understanding**
- **Accuracy + Scalability** (without shared understanding) → Agents produce correct individual outputs but cannot combine them (Silo-Bench high-complexity failure)
- **Accuracy + Shared Understanding** (without scalability) → 2-3 expert agents coordinate beautifully but can't scale beyond ~5 (Hanabi 2-player >> 5-player)
- **Scalability + Shared Understanding** (without accuracy) → Large groups converge on consensus that's wrong (sycophancy in Conversation Tax)

---

## 7. Key Quantitative Reference Points

| Metric | Value | Source |
|--------|-------|--------|
| MAS underperforms single agent | 43.3% of cases | MAS Uncertainty (2602.04234) |
| Integration success (high complexity) | ~15% | Silo-Bench (2603.01045) |
| Conversation tax (accuracy loss per multi-turn) | ~14pp avg | Conversation Tax (2603.11394) |
| GPT-5.2 abstention degradation | -30pp | Conversation Tax (2603.11394) |
| Hanabi 2→5 player drop (top models) | 17→8/25 | Hanabi (2601.18077) |
| Deterministic CG vs GPT-5 CG | 0.369 vs 0.250 DSC | DPIP (2603.05450) |
| GRPO negotiation vs debate agreement | 78-85% vs 45-60% | Learning to Negotiate (2603.10476) |
| Byzantine consensus failure (0% adversaries) | Not reliably achievable | Can AI Agents Agree (2603.01213) |
| First-round determination of dynamics | "Largely determined" | MAS Uncertainty (2602.04234) |
| Peak entropy effect on outcomes | Universally harmful | MAS Uncertainty (2602.04234) |

---

## 8. Research Gaps Identified

1. **No paper studies the interaction between epistemic layers.** Each paper focuses on one layer; the cascade effects (Layer 1 failure → Layer 2-4 failure) are theoretically predicted by this synthesis but not yet empirically measured.

2. **No paper proposes a complete epistemic coordination protocol.** Individual solutions exist (GRPO for negotiation, RL for conventions, deterministic axioms for belief tracking) but no one has assembled them into an integrated system.

3. **No paper addresses the convention establishment problem.** Hanabi shows conventions help enormously, but all conventions were learned through training. No paper addresses how agents can establish conventions at runtime without prior co-training.

4. **The "curated context" finding (DPIP: more modalities hurt GPT-5) lacks a theory.** Why does more information degrade performance? Is it a context window saturation effect, an attention dilution effect, or something deeper about how LLMs process heterogeneous information?

5. **Missing: epistemic coordination in adversarial settings.** All 8 papers assume cooperative or benign settings. How does epistemic coordination fail when one agent is actively trying to corrupt shared understanding?

---

## 9. Conclusion

The Epistemic Coordination Crisis is the most fundamental failure mode in multi-agent LLM systems — more fundamental than alignment failures, security vulnerabilities, or scaling limits, because all of those failures are *epistemic coordination failures downstream*. An agent that can't track what others know can't verify alignment. A system that can't integrate distributed information can't detect attacks. A team that can't build shared understanding can't scale.

The unified finding across 8 papers is stark: **LLM agents can communicate but cannot coordinate.** They can exchange messages but not build mutual understanding. They can share information but not integrate it. They can detect anomalies but not diagnose them. They can reach agreement but only by one agent capitulating (sycophancy), not by genuine epistemic convergence.

The path forward is not to make agents better at coordination (the Conversation Tax and ToM overhead results suggest this may be counterproductive) but to **design systems that require less coordination** — through explicit context passing, deterministic belief tracking, communication budgeting, and dedicated integration processes.

---

*Cross-Reference Synthesis #27 of the Scout Research Portfolio*  
*Integrates: 2603.05450, 2603.01213, 2601.18077, 2603.01221, 2602.04234, 2603.01045, 2603.11394, 2603.00142*  
*Supporting: 2603.11409, 2603.05789, 2603.10476*  
*Total portfolio: 202 deep-dives, 27 cross-reference syntheses, GUS v1+v2*
