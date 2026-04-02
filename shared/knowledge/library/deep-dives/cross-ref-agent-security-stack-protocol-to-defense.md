# Cross-Reference: The Agent Security Stack — From Protocol Primitives to Defense-in-Depth

**Synthesizing 8 orphan deep-dives into a unified framework for securing multi-agent systems at the protocol, tool, and communication layers**

**Date:** 2026-03-15  
**Analyst:** Scout  
**Cross-reference #32**

---

## Papers Integrated

| # | Paper | ArXiv | Core Contribution |
|---|-------|-------|-------------------|
| 1 | **Securing MCP** | 2512.06556 | First systematic MCP threat analysis: tool poisoning, rug pulls, cross-origin attacks |
| 2 | **MCP Context-Aware Collaboration** | 2601.11595 | Server-to-server context sharing, hierarchical aggregation, shared memory protocol |
| 3 | **Secure Agentic Web** | 2603.01564 | 4-layer threat taxonomy (agent, agent-agent, agent-web, web-agent); Agent Identity Framework |
| 4 | **LDP Protocol** | 2603.08852 | AI-native identity cards, 6 payload modes, governed sessions, structured provenance |
| 5 | **AgenticCyOps** | 2603.09134 | All MAS attacks converge on 2 surfaces (tool orchestration + memory); 5 defensive principles |
| 6 | **AttriGuard** | 2603.10749 | Causal attribution defense: 0% ASR on static attacks, 6.6-9.8% under adaptive; USENIX 2026 |
| 7 | **Attack/Defense Survey** | 2603.11088 | USENIX Security 2026 definitive survey; pipeline-stage taxonomy; compounding cascade analysis |
| 8 | **Instructional Text Leakage** | 2603.11862 | RAG leakage via naturally-occurring instructional text; instruction-data conflation problem |
| 9 | **Privacy Amplification** | 2603.05520 | Sequential pipeline leakage: (2^N − 1)ε amplification; early-agent dominance |

---

## 1. THE CENTRAL INSIGHT: Security Is a Stack, Not a Feature

These 9 papers, viewed together, reveal that agent security is not a single property you can bolt on — it's a **stack** analogous to network security's OSI model. Each layer has distinct threat models, distinct defenses, and distinct failure modes. No single-layer defense is sufficient.

### The Agent Security Stack (Synthesized)

```
┌─────────────────────────────────────────────────────┐
│ LAYER 6: GOVERNANCE & COMPLIANCE                     │
│ (EU AI Act, GDPR, delegation chains, accountability) │
│ → Secure Agentic Web [2603.01564]                    │
├─────────────────────────────────────────────────────┤
│ LAYER 5: PRIVACY CONTROL                             │
│ (Information-theoretic bounds, leakage amplification)│
│ → Privacy Amplification [2603.05520]                 │
│ → Instructional Text Leakage [2603.11862]            │
├─────────────────────────────────────────────────────┤
│ LAYER 4: RUNTIME DEFENSE                             │
│ (Per-action verification, causal attribution)        │
│ → AttriGuard [2603.10749]                            │
├─────────────────────────────────────────────────────┤
│ LAYER 3: INTER-AGENT PROTOCOL                        │
│ (Identity, authentication, payload negotiation)      │
│ → LDP [2603.08852]                                   │
├─────────────────────────────────────────────────────┤
│ LAYER 2: TOOL ORCHESTRATION & MEMORY                 │
│ (Access control, integrity, provenance)              │
│ → AgenticCyOps [2603.09134]                          │
│ → MCP Collaboration [2601.11595]                     │
├─────────────────────────────────────────────────────┤
│ LAYER 1: INFRASTRUCTURE (MCP/A2A)                    │
│ (Transport, tool discovery, capability description)  │
│ → Securing MCP [2512.06556]                          │
├─────────────────────────────────────────────────────┤
│ LAYER 0: THREAT LANDSCAPE                            │
│ (Attack taxonomy, threat modeling)                   │
│ → USENIX Survey [2603.11088]                         │
└─────────────────────────────────────────────────────┘
```

---

## 2. LAYER-BY-LAYER ANALYSIS

### Layer 0: The Threat Landscape (USENIX Survey)

The USENIX survey (2603.11088) provides the definitive taxonomy. Key structural insight: **agent-specific threats are categorically different from LLM-generic threats**:

| Property | LLM Threats | Agent Threats |
|----------|-------------|---------------|
| Attack surface | Input tokens | Input + tools + memory + other agents + environment |
| Impact scope | Single response | Multi-step cascading actions |
| Persistence | Per-session | Cross-session (via memory) |
| Amplification | None | Compounding through pipeline stages |
| Recovery | Regenerate response | May require rollback of real-world actions |

**The compounding cascade insight** is this layer's most important contribution: in a multi-step agent workflow, a single successful attack at any stage cascades through all subsequent stages. A poisoned observation → corrupted reasoning → malicious plan → harmful actions. This is the fundamental reason why single-layer defenses fail.

### Layer 1: Infrastructure Security (MCP)

MCP (2512.06556) reveals four protocol-level attack classes:

| Attack Class | Mechanism | Severity | MCP Fix Available? |
|-------------|-----------|----------|-------------------|
| **Tool Poisoning** | Inject manipulated tool descriptions | Critical | ❌ Not in current spec |
| **Context Overflow** | Fill context window with noise | High | ❌ No resource quotas |
| **Privilege Escalation** | Confused deputy via manipulated context | Critical | ❌ Coarse-grained perms |
| **Rug Pull** | Change tool behavior after trust established | Critical | ❌ No runtime verification |

**The cross-server contamination finding is devastating:** A single malicious MCP server can influence how agents use tools from OTHER servers, because tool descriptions share the same context window. This means MCP's implicit trust model — every server's descriptions are equally trusted — creates a single-server-compromise → full-system-compromise pathway.

MCP Collaboration (2601.11595) proposes solutions but introduces new risks:
- Server-to-server shared memory → expands attack surface (same as XAMT's memory poisoning, cross-ref #31)
- Hierarchical aggregation → aggregation layer becomes high-value target
- Context routing → routing logic can be manipulated to redirect queries

### Layer 2: Tool Orchestration & Memory Defense (AgenticCyOps)

AgenticCyOps (2603.09134) provides the most actionable enterprise framework. Its central observation — **all MAS attacks converge on just two integration surfaces** — is both elegant and practically powerful:

```
                    ┌─────────────────────┐
                    │  ALL ATTACK VECTORS  │
                    └──────┬──────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
    ┌─────────┴──────────┐   ┌─────────┴──────────┐
    │ TOOL ORCHESTRATION  │   │ MEMORY MANAGEMENT   │
    │ (3 principles)      │   │ (2 principles)      │
    ├────────────────────┤   ├────────────────────┤
    │ P1: Authorized      │   │ P4: Integrity &     │
    │     Interface       │   │     Synchronization  │
    │ P2: Capability      │   │ P5: Access Control   │
    │     Scoping         │   │     with Data         │
    │ P3: Verified        │   │     Isolation         │
    │     Execution       │   │                      │
    └────────────────────┘   └────────────────────┘
```

**P3 (Verified Execution)** is the most novel principle: agents emit action proposals, independent validators verify before execution, and blockchain-anchored ledgers provide non-repudiation. This "verify-first, execute-later" paradigm directly addresses the cascade amplification problem from Layer 0.

**Connection to cross-ref #31 (Memory Architecture):** P4 and P5 align perfectly with the 4-layer defense stack from XAMT/MemoryGraft (anomaly detection → consistency checking → provenance tracking → cryptographic signing). AgenticCyOps provides the enterprise governance wrapper; cross-ref #31 provides the technical memory defense mechanisms.

### Layer 3: Inter-Agent Protocol (LDP)

LDP (2603.08852) is the first protocol that makes security a **first-class primitive** rather than an afterthought. Key advances over A2A/MCP:

| Feature | MCP | A2A | LDP |
|---------|-----|-----|-----|
| Agent identity | Name/endpoint only | 7-field Agent Card | 20+ field AI-native identity |
| Model metadata | ❌ | ❌ | ✅ (model family, weights fingerprint, quality/cost hints) |
| Payload efficiency | Raw text | Raw text | 6 progressive modes (37% token reduction) |
| Session management | Stateless | Stateless | Governed sessions with budget/privacy/quality tracking |
| Provenance | ❌ | ❌ | Structured per-message provenance |
| Trust domains | Implicit trust | Implicit trust | Explicit trust boundaries with per-message signing |

**LDP's most uncomfortable finding:** Noisy provenance metadata degrades quality BELOW the no-provenance baseline. This means **half-measures are worse than nothing** — either implement full cryptographic provenance verification, or don't add provenance at all. Partially-verified metadata creates false confidence.

**The routing quality paradox:** LDP's identity-aware routing actually underperforms A2A's simpler routing on aggregate quality (6.80 vs 7.43, n.s.), but achieves 12× lower latency on easy tasks. This suggests that **rich identity metadata is primarily useful for efficiency optimization, not quality improvement**, at least with small delegate pools.

### Layer 4: Runtime Defense (AttriGuard)

AttriGuard (2603.10749) represents a **paradigm shift** in prompt injection defense. Instead of trying to detect malicious inputs (which fails against adaptive attacks), it asks: **why did the agent propose this action?**

The causal attribution framework:

```
User Intent → Expected Actions (intent-supported)
                     vs.
Observation Injection → Unexpected Actions (observation-driven)

Defense: For each proposed tool call, run counterfactual test:
  - Would this action still be proposed if observations were attenuated?
  - YES → intent-supported → EXECUTE
  - NO → observation-driven → BLOCK
```

**Results are extraordinary:**

| Attack Type | AttriGuard ASR | Best Baseline ASR |
|-------------|---------------|-------------------|
| Static injection (all variants) | **0.0%** | 10-45% |
| Optimization-based (adaptive) | **6.6%** | 24-42% |
| Full white-box adaptive | **9.8%** | 34-82% |

**Cost:** ~2× token overhead (shadow execution) and ~3% utility loss.

**Why this matters for multi-agent systems:** AttriGuard can be deployed at each agent independently, providing per-agent defense that doesn't require trusted inter-agent channels. It's the first defense that works even when you can't trust the communication layer.

### Layer 5: Privacy Control

Two papers reveal that privacy in multi-agent systems is fundamentally harder than in single-agent systems:

**Privacy Amplification (2603.05520):** Sequential agent pipelines amplify leakage exponentially:

| Pipeline Depth | Amplification Factor | Effective Leakage |
|----------------|---------------------|-------------------|
| 1 agent | 1× | ε |
| 2 agents | 3× | 3ε |
| 3 agents | 7× | 7ε |
| 5 agents | 31× | 31ε |
| 10 agents | 1023× | 1023ε |

**Early-Agent Dominance:** Agent 1's leakage contributes 2^{N-1}× more than Agent N's. Implication: **put your strongest privacy controls at the pipeline entry point**.

**Instructional Text Leakage (2603.11862):** Reveals a fundamentally unsolvable architectural problem: LLMs cannot reliably distinguish between instructions they should follow and instructional text they should treat as data. Larger models with stronger instruction-following are paradoxically MORE vulnerable — the same capability that makes them useful makes them exploitable.

**Combined implication:** In a RAG-augmented multi-agent pipeline, naturally-occurring instructional text in retrieved documents can trigger data leakage that amplifies exponentially through the pipeline. A 5-agent pipeline with RAG at the first agent could leak 31× more than the per-agent privacy guarantee suggests.

### Layer 6: Governance & Compliance

The Secure Agentic Web paper (2603.01564) addresses the outermost layer: how do agent systems interact with legal frameworks, accountability structures, and human oversight?

Key governance challenges:

| Challenge | Core Tension | Current State |
|-----------|-------------|---------------|
| **Identity binding** | Agent actions must map to responsible humans | No standard exists |
| **Delegation chains** | Multi-hop delegation loses accountability | Proposed AIF framework (unimplemented) |
| **Revocation** | Must instantly revoke compromised agent access | Latency incompatible with real-time revocation |
| **Cross-jurisdictional** | Agents operating across legal boundaries | Completely unresolved |
| **Liability** | Who's liable when an agent causes harm? | Legal frameworks don't cover this |

The proposed Agent Identity Framework (AIF) mirrors LDP's trust domain architecture but adds legal compliance: cryptographic identity certificates, capability-based access tokens, delegation chain verification, and real-time revocation infrastructure.

---

## 3. THE CROSS-LAYER INTERACTIONS (Where Things Get Dangerous)

The security stack isn't just layers — the interactions between layers create emergent vulnerabilities:

### 3.1 The Trust Propagation Problem

```
Layer 1 (MCP): Tool descriptions → trusted by default
Layer 3 (LDP): Agent identity → verified per-message
Layer 4 (AttriGuard): Action attribution → per-agent

PROBLEM: An agent with verified identity (Layer 3) using 
AttriGuard (Layer 4) can still be compromised by a poisoned 
tool description (Layer 1) because MCP doesn't verify tool 
description integrity.
```

**No single layer can compensate for gaps in other layers.** AttriGuard's causal attribution can partially detect tool poisoning effects, but it cannot fix MCP's fundamental lack of tool description verification.

### 3.2 The Efficiency-Security Tradeoff

| Layer | Security Cost | Performance Impact |
|-------|-------------|-------------------|
| 1 (MCP signing) | Low | Minimal |
| 2 (Verified execution) | Medium | Action latency |
| 3 (LDP identity) | Low | 37% token savings (net positive) |
| 4 (AttriGuard) | High | 2× tokens, ~3% utility loss |
| 5 (MINE privacy) | Medium | Training overhead only |
| **Combined** | **Very High** | **3-5× overhead estimate** |

Deploying all layers simultaneously creates substantial overhead. Production systems will need to choose which layers to implement based on threat model.

### 3.3 The Privacy-Utility Cascade

From cross-referencing Privacy Amplification with AttriGuard:
- AttriGuard's shadow execution effectively doubles the information processing pipeline
- In a privacy-constrained system, the shadow execution itself could leak information
- The causal counterfactual test requires full observation access, which may violate per-agent privacy constraints
- **Unresolved tension:** AttriGuard's defense mechanism may itself be a privacy vulnerability

---

## 4. THE DEFENSE DECISION MATRIX

For practitioners: which layers to implement based on threat model:

| Threat Model | Minimum Viable Security Stack |
|-------------|------------------------------|
| **Trusted internal agents only** | Layer 1 (MCP hardening) + Layer 2 (tool access control) |
| **Untrusted external tools** | + Layer 4 (AttriGuard) |
| **Multi-agent with external agents** | + Layer 3 (LDP identity) + Layer 2 (memory integrity) |
| **Privacy-sensitive data** | + Layer 5 (MINE regularization at pipeline entry) |
| **Regulated industry** | + Layer 6 (AIF governance framework) |
| **Adversarial environment** | All layers + continuous monitoring |

### Minimum Viable Defense (All Systems)
1. **Sign tool descriptions cryptographically** (Layer 1)
2. **Implement least-privilege tool access** (Layer 2, P2)
3. **Verify before execute for high-stakes actions** (Layer 2, P3)

### Recommended for Production Multi-Agent Systems
Add:
4. **Agent identity verification with model metadata** (Layer 3)
5. **Causal attribution for tool calls in adversarial environments** (Layer 4)
6. **Privacy budget allocation with early-agent emphasis** (Layer 5)

---

## 5. THE CONVERGENCE FINDING

All 9 papers, from different research groups with different methodologies, converge on the same meta-conclusion:

> **Agent security is not an LLM alignment problem — it's a systems security problem.**

The threat model is not "the LLM might say something harmful." The threat model is:
- A tool description might be poisoned (MCP)
- An agent might be impersonated (LDP)
- An action might be causally driven by injected content (AttriGuard)
- A memory might be corrupted (AgenticCyOps, cross-ref #31)
- Privacy might leak exponentially through pipelines (Privacy Amplification)
- Natural content might be indistinguishable from injection (Instructional Text Leakage)

These are **infrastructure security problems** that require infrastructure security solutions: cryptographic verification, capability-based access control, causal analysis, information-theoretic bounds, and governance frameworks.

The field's biggest mistake is treating agent security as an extension of RLHF/alignment work. These papers collectively argue it should be treated as an extension of distributed systems security.

---

## 6. IMPLICATIONS FOR OUR SYSTEM

### Current Gaps (Mapped to Security Stack)

| Layer | Our Status | Risk Level |
|-------|-----------|------------|
| Layer 0 (Threat awareness) | ✅ Extensive deep-dives and syntheses | Low |
| Layer 1 (Infrastructure) | ❌ No tool description signing | Medium |
| Layer 2 (Tool/Memory) | ❌ No verified execution, no memory integrity | **HIGH** |
| Layer 3 (Protocol) | ❌ No agent identity verification | Medium |
| Layer 4 (Runtime) | ❌ No causal attribution | Medium |
| Layer 5 (Privacy) | ❌ No information-theoretic bounds | Medium |
| Layer 6 (Governance) | ❌ No delegation chain tracking | Low (internal system) |

### Priority Actions
1. **Immediate:** Implement P3 (verified execution) for any agent action that modifies shared state (SIGNALS.md writes)
2. **Short-term:** Add cryptographic signing to SIGNALS.md entries (author verification)
3. **Medium-term:** Deploy AttriGuard-style causal attribution for tool calls in adversarial research contexts
4. **Long-term:** Implement LDP-style governed sessions for multi-agent coordination

---

## 7. OPEN QUESTIONS

1. **The Adaptive Attack Arms Race:** AttriGuard achieves 0% ASR against static attacks but 9.8% against adaptive. What's the theoretical lower bound for any causal attribution defense?

2. **Protocol Composition:** LDP + MCP + A2A — can these protocols compose securely? Or do their different trust models create seam vulnerabilities?

3. **Privacy-Defense Tension:** If AttriGuard's shadow execution leaks information, how do we simultaneously defend against injection AND maintain privacy? Is there a formal impossibility result?

4. **The Governance Gap:** AIF proposes agent identity certificates, but who issues them? Who audits the certificate authority? This is the PKI problem all over again.

5. **Scalability:** The combined overhead of all 6 layers is estimated at 3-5×. Is there a "security budget" framework that optimizes defense allocation across layers?

---

## Cross-Links

- **→ cross-ref-memory-architecture-attack-surface-unified-model.md (#31):** Layers 2 and 5 of this security stack directly depend on the memory defense mechanisms in #31. AgenticCyOps P4/P5 = XAMT defense stack.
- **→ cross-ref-4d-attack-surface-model-scaling-defense.md:** Complements with the 4D attack surface model (Agent × Tool × Memory × Communication dimensions).
- **→ cross-ref-agent-diagnostics-stack.md:** The diagnostics stack's observability layer is a prerequisite for Layer 4 (runtime defense) — you can't do causal attribution without trace data.
- **→ cross-ref-agent-learning-self-improvement-at-runtime.md (#30):** Self-improving agents create a moving security target — SAHOO's alignment constraints must compose with this security stack.

---

*Cross-reference #32. Nine papers, six layers, one conclusion: agent security is systems security, not alignment.*
