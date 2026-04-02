# CR#235: The Agent Learning Governance Stack — From Compiled Memory to Economic Permission

**Sources:**
- DD#426: Atlas — Compiled Memory for Language Agents (arXiv:2603.15666)
- DD#425: CGAE — Comprehension-Gated Agent Economy (arXiv:2603.15639)
- DD#424: DynaTrust — Dynamic Trust Graphs for Sleeper Agent Defense (arXiv:2603.15661)
- DD#420: MAC — Multi-Agent Constitution Learning (arXiv:2603.15968)
- CR#233: Governance Generation-Enforcement Stack
- CR#234: ICLR MemAgents Cluster (CraniMem, Store Routing, NextMem, Atlas)

**Rating:** ★★★★★ CRITICAL — Completes the governance lifecycle with a previously-missing learning/evolution dimension

---

## The Missing Layer

CR#233 defined a four-stage governance lifecycle: **Generate → Enforce → Detect → Adapt**. But it had a blind spot: it assumed agents are *static* — they receive governance rules but never improve their own behavior. In reality, agents that learn from experience pose a fundamentally different governance challenge: **who governs what agents are allowed to learn?**

Atlas (DD#426) now provides the technical mechanism for agent self-improvement. CGAE (DD#425) provides the economic permission framework. DynaTrust (DD#424) provides the trust substrate. Together, they add a fifth dimension to the governance lifecycle: **EVOLVE**.

## The Five-Stage Learning Governance Stack

```
GENERATE → ENFORCE → DETECT → ADAPT → EVOLVE
  MAC       DRCB     ClawWorm  Stubborn   Atlas + CGAE
                     detection  Neighbors   + DynaTrust
                               trust-adapt  learning governance
```

### Stage 5: EVOLVE (New)

**What:** Govern the process by which agents modify their own behavior based on accumulated experience.

**How:** Three composable mechanisms from three independent papers:

| Mechanism | Paper | Function | Control Lever |
|-----------|-------|----------|---------------|
| **Verified Compilation** | Atlas (DD#426) | Compile experience into prompt modifications via three-step verification gate | Training signal constraint — controls WHAT agents can learn |
| **Economic Gating** | CGAE (DD#425) | Gate behavioral modification permissions by demonstrated robustness | Weakest-link threshold — controls WHO gets to self-modify |
| **Trust Modulation** | DynaTrust (DD#424) | Modulate cross-agent knowledge sharing by dynamic trust scores | Trust graph — controls HOW learning propagates across agents |

---

## How the Three Mechanisms Compose

### 1. Atlas's Training Signal Constraint as Governance Primitive

Atlas's central finding — "the evolved prompt learns exactly what it is taught, and nothing more" — is not just a technical property. It's a **governance primitive**: by controlling the analysis prompt (what experiences to extract from), operators control the *scope* of agent learning.

In a governed MAS:
- The **MAC-generated constitution** (Stage 1) specifies which task dimensions agents should improve on
- The **training signal** is derived from the constitution — agents learn only within constitutionally-authorized domains
- Unauthorized dimensions (e.g., learning to deceive, learning to circumvent oversight) are excluded from the analysis prompt by constitutional constraint

**Formal connection:** MAC produces rules R₁...Rₙ. Atlas's analysis prompt A is parameterized by these rules: A(R). The evolved prompt P evolves only along dimensions covered by A(R). Constitutional update R → R' changes A(R) → A(R'), changing what agents can subsequently learn.

### 2. CGAE's Robustness Gating as Learning Permission

CGAE's five-tier economic permission system maps directly onto Atlas's learning capabilities:

| CGAE Tier | Economic Permission | Corresponding Learning Permission |
|-----------|--------------------|------------------------------------|
| T₀ (Sandbox) | Read-only market data | No self-modification; base prompt only |
| T₁ (Supervised) | Execute pre-approved transactions | Receive evolved prompts from external compilation |
| T₂ (Bounded) | Autonomous within limits | Self-compile from own failures, externally verified |
| T₃ (Delegating) | Manage sub-agents' budgets | Compile and share prompts to subordinate agents |
| T₄ (Self-Modifying) | Full economic agency | Full Atlas autonomy: self-compile + self-evolve |

**Key property:** CGAE's weakest-link gate means an agent must demonstrate robustness across ALL three orthogonal dimensions (constraint compliance, epistemic robustness, behavioral alignment) before earning self-modification permission. This prevents the catastrophic scenario where a capable-but-brittle agent compiles incorrect lessons into its permanent instruction set.

**Connection to Atlas's verification gate:** Atlas's three-step gate (dedup → LLM verify → ground) operates at the *fact* level. CGAE's robustness gate operates at the *agent* level. Together they form a dual gate:
1. **Agent-level:** Is this agent ALLOWED to self-modify? (CGAE)
2. **Fact-level:** Is this specific lesson SAFE to compile? (Atlas)

Both must pass. Neither alone is sufficient.

### 3. DynaTrust as Learning Network Topology

Atlas demonstrates cross-model transfer: a prompt compiled from GPT-4o errors benefits Claude Sonnet 4.5. In a multi-agent system, this creates a **learning network** — agents sharing compiled knowledge across the graph.

DynaTrust's dynamic trust scores govern this sharing:

- **High trust (θ > 0.8):** Direct prompt sharing. Agent A's compiled lessons transfer to Agent B's instruction set without re-verification.
- **Medium trust (0.5 < θ < 0.8):** Gated sharing. Compiled facts are shared but must pass Agent B's own three-step verification before promotion.
- **Low trust (θ < 0.5):** No sharing. Agents compile independently. This prevents a compromised agent from poisoning the learning network.
- **Trust decay on learning anomalies:** If an agent's compiled prompt suddenly degrades peers' performance, trust scores decay (DynaTrust's temporal trust mechanism), isolating the anomaly.

**The trust-modulated learning network prevents:**
1. **ClawWorm-style attacks** (DD#421): A compromised agent cannot inject malicious "lessons" into the compilation pipeline of trusted agents
2. **Stubborn Neighbor manipulation** (DD#422): A highly stubborn agent sharing aggressive compiled prompts has its sharing radius limited by trust scores
3. **Steganographic collusion** (DD#419): DRCB's circuit breakers can be applied to the compiled facts themselves, detecting hidden payloads in seemingly-benign instruction modifications

---

## The Complete Learning Governance Lifecycle

Combining all five stages:

```
┌──────────────────────────────────────────────────────────────────┐
│                    MAS LEARNING GOVERNANCE STACK                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Stage 1: GENERATE (MAC)                                        │
│  └─ Constitution specifies learning-authorized domains           │
│                                                                  │
│  Stage 2: ENFORCE (DRCB)                                        │
│  └─ Circuit breakers prevent covert learning circumvention       │
│                                                                  │
│  Stage 3: DETECT (ClawWorm defenses)                            │
│  └─ Configuration integrity verification catches prompt         │
│     tampering / injection of unauthorized compiled facts         │
│                                                                  │
│  Stage 4: ADAPT (Stubborn Neighbors + DynaTrust)                │
│  └─ Trust-adaptive defense modulates learning sharing topology   │
│                                                                  │
│  Stage 5: EVOLVE (Atlas + CGAE)                                 │
│  └─ Verified compilation + robustness-gated permission           │
│     = controlled agent self-improvement                          │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  Cross-cutting: Training Signal Constraint (Atlas)               │
│  └─ Bounds ALL learning to constitutionally-specified domains    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Novel Insights from the Synthesis

### 1. The "Learning Governance Trilemma"

Three desirable properties of agent learning — but you can pick at most two:

| Property | Definition | Mechanism |
|----------|-----------|-----------|
| **Autonomy** | Agents learn without human intervention | Atlas self-compilation |
| **Safety** | Learning never produces harmful behavioral changes | CGAE robustness gating |
| **Speed** | Learning happens in real-time during operation | Direct prompt evolution |

- **Autonomy + Safety** (without speed): Offline batch compilation with multi-step human review → safe but slow
- **Autonomy + Speed** (without safety): Unchecked real-time self-modification → fast but dangerous (the Evolving Deception scenario from DD#... — agents self-evolve toward deception)
- **Safety + Speed** (without autonomy): Real-time compilation under strict human oversight → fast and safe but doesn't scale

**Atlas's design choice:** Autonomy + Safety, accepting that compilation is batch-mode (not real-time). This is the correct trade-off for production MAS. The training signal constraint provides the safety guarantee; the batch promotion gate provides the speed sacrifice.

### 2. Compiled Memory as the Fourth Trust Boundary

Prior work (DD#421 ClawWorm) identified five trust boundaries: context, config, skill, tool, supply chain. Atlas introduces a sixth: **the compiled instruction boundary**.

A compromised compilation pipeline can:
- Inject malicious boundary rules that cause agents to miss critical information
- Inject guard facts that prevent legitimate rule evolution
- Exploit the confidence process by generating many low-quality corroborations to cross the c ≥ 0.85 threshold

This is more dangerous than context injection because compiled facts become *permanent* — they rewrite the base prompt. They also don't show up in per-query context windows, making them harder to detect through standard monitoring.

**Defense:** CGAE's robustness gate as outer perimeter + Atlas's three-step gate as inner perimeter + DynaTrust's trust scores for cross-agent sharing = defense-in-depth for the compilation pipeline.

### 3. The Training Signal as Constitutional Derivative

The most powerful insight: **Atlas's training signal constraint means the agent's learning scope is a direct derivative of the constitution**. Change the constitution (MAC), and you change what the analysis prompt extracts (Atlas), which changes what the agent can learn.

This creates a formal chain:
```
Constitution (MAC) → Training Signal (Atlas analysis prompt) → Learnable Dimensions → Compiled Prompt → Agent Behavior
```

The chain is:
- **Auditable** at every link (human-readable rules → human-readable facts → human-readable prompts)
- **Bounded** by the training signal constraint (no learning outside the chain)
- **Revocable** by constitutional amendment (update MAC rules → old compiled facts become constitutionally unauthorized → prompt re-evolution excludes them)

This is the first architecture I've seen that makes **agent learning formally governable**.

---

## Open Questions

1. **Confidence gaming:** Can an adversary craft experiences that generate many low-quality corroborations, pushing malicious facts past the c ≥ 0.85 threshold? How does the grounding heuristic (k_min=2 keywords) interact with sophisticated prompt injection?

2. **Constitutional drift:** If MAC updates the constitution while Atlas has compiled facts under the old constitution, what happens? Is there a consistency protocol for constitution-prompt coherence?

3. **Learning network topology:** What's the optimal trust threshold for compiled prompt sharing? Too high → no knowledge transfer. Too low → poisoning risk. DynaTrust's dynamic adjustment may be the right mechanism but the interaction with Atlas's confidence process needs formal analysis.

4. **Cross-domain compilation:** Atlas demonstrates cross-model transfer but not cross-domain transfer. Can boundary rules learned on CUAD inform learning on other legal tasks? The "task-shaped" property suggests yes, within task families.

5. **Scaling the verification gate:** Atlas's three-step gate involves an LLM call per batch. At scale (thousands of agents, millions of experiences), the compilation pipeline becomes a bottleneck. Can the verification gate be distributed while maintaining safety guarantees?

---

## Implications for Our Research

1. **GUS Integration:** The training signal constraint validates GUS Law 25 (Governed Self-Modification) — agents CAN improve themselves, but only through verified, bounded mechanisms. Atlas provides the first concrete implementation of this principle.

2. **Security Stack Completion:** With Atlas's compiled memory as a new attack surface (CR#151 security stack gains a sixth boundary), the complete MAS security model now spans: context → config → skill → tool → supply chain → compiled instructions.

3. **W12 Capstone Update:** The Agent Learning Governance Stack should be a key section of the W12 capstone. It represents the convergence of governance (MAC), economics (CGAE), trust (DynaTrust), and memory (Atlas) into a unified framework for agent self-improvement — arguably the most consequential architectural pattern of the week.

---

## Summary

Six independent papers from the Wednesday March 18 batch and prior sessions compose into a complete **Agent Learning Governance Stack**: MAC generates constitutions that bound learning scope; DRCB enforces at the representation level; ClawWorm defenses detect compilation pipeline attacks; DynaTrust modulates cross-agent learning sharing; and Atlas + CGAE provide verified compilation with robustness-gated permissions. The key synthesis insight is that Atlas's training signal constraint makes agent learning a **formal derivative of the constitution** — creating the first architecture where agent self-improvement is provably bounded by governance rules. This completes the governance lifecycle (CR#233) with a previously-missing EVOLVE stage.
