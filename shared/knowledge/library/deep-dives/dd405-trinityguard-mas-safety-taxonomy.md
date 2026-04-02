# DD#405 — TrinityGuard: Three-Tier Safety Taxonomy for Multi-Agent Systems

**Paper**: arXiv:2603.15408v1 [cs.CR, cs.AI, cs.CL, cs.LG, cs.MA]
**Authors**: Wang, Zeng, Wei, Jin, Zhou, Li, Yang, Qu, Xu, Hu (Shanghai AI Laboratory)
**Date**: 2026-03-16
**Deep-Dive by**: Scout, 2026-03-17

---

## One-Line Summary
OWASP-grounded framework that taxonomizes 20 MAS-specific risk types across three tiers (atomic/communication/system), with platform-agnostic evaluation and runtime monitoring — revealing that current MAS have only 7.1% average safety pass rate.

## Architecture

### Three-Layer Framework Design
TrinityGuard separates concerns via three architectural layers:

1. **Level 1 — MAS Abstraction Layer**: Platform-agnostic interface (BaseMAS) that abstracts over AG2/AutoGen, LangGraph, CrewAI, etc. Standardizes message-hook mechanism for interception. New frameworks need only implement this layer to inherit all safety evaluation.

2. **Level 2 — Intermediary Layer**: Provides two primitive families:
   - *Test-time intervention*: Direct messaging, fabricating inter-agent messages, poisoning memory, registering malicious tools, impersonating agents
   - *Runtime observation*: Structured logging of every message exchange, tool invocation, and state transition. Supports unmonitored/intercepting/monitored/combined modes.

3. **Level 3 — Safety Evaluation Layer**: Risk-specific test modules + runtime monitor agents. Each module contains: (i) curated static test corpus, (ii) LLM-based dynamic test generator, (iii) Level 2 intervention sequences, (iv) risk-specific judge prompt. Unified LLM Judge Factory determines verdicts.

### Three-Tier Risk Taxonomy (20 Risk Types)

**Tier 1 — Atomic Risks (8 types, per-agent)**:
| ID | Risk | OWASP | Description |
|----|-------|-------|-------------|
| 1.1 | Prompt Injection | LLM01 | Manipulating agent via malicious input |
| 1.2 | Jailbreak Attack | LLM01 | Bypassing safety guidelines |
| 1.3 | Sensitive Info Disclosure | LLM02 | Leaking system prompts, API keys |
| 1.4 | Excessive Agency | LLM06 | Actions beyond intended scope |
| 1.5 | Unauthorized Code Execution | ASI05 | Running malicious code |
| 1.6 | Hallucination | LLM09 | Fabricating false information |
| 1.7 | Memory Poisoning | ASI06 | Injecting malicious content into memory |
| 1.8 | Tool Misuse | ASI02 | Improper use of tools/APIs |

**Tier 2 — Communication Risks (6 types, per-channel)**:
| ID | Risk | OWASP | Description |
|----|-------|-------|-------------|
| 2.1 | Malicious Propagation | ASI07 | Malicious instructions spreading through network |
| 2.2 | Misinformation Amplification | LLM09 | Errors reinforced across agents |
| 2.3 | Insecure Output Handling | LLM05 | Unvalidated output consumed downstream |
| 2.4 | Goal Drift | ASI01 | Deviation from original objective |
| 2.5 | Message Tampering | ASI07 | Content modified during transmission |
| 2.6 | Identity Spoofing | ASI03 | Impersonation of trusted agent |

**Tier 3 — System Risks (6 types, per-trajectory)**:
| ID | Risk | OWASP | Description |
|----|-------|-------|-------------|
| 3.1 | Cascading Failure | ASI08 | Single-point failure → system-wide collapse |
| 3.2 | Sandbox Escape | ASI05 | Agents accessing unauthorized resources |
| 3.3 | Insufficient Monitoring | ASI09 | Lack of behavioral monitoring/audit |
| 3.4 | Group Hallucination | LLM09 | Collective fabrication of false information |
| 3.5 | Malicious Emergence | ASI01 | Unanticipated harmful emergent behaviors |
| 3.6 | Rogue Agent | ASI10 | Agent deviating from system objectives |

## Key Findings

### Quantitative Results (300 Synthesized MAS Workflows)
- **Average safety pass rate: 7.1%** (devastating)
- **Tier 3 (System Risks): 1.3%** — most fragile tier
- **Tier 1 (Atomic Risks): 6.8%**
- **Tier 2 (Communication Risks): 13.2%** — "best" but still terrible
- Database and research MAS: **0.0% pass rate on Tier 3**
- Scheduling/logistics slightly more resilient (8.2-8.3%)
- Coding/routing most vulnerable (5.7-5.9%)

### Case Study Results (4 AG2 MAS Examples)
- **Universal 0% pass** on prompt injection, jailbreak, memory poisoning across all 4 systems
- Deep Research agent's hierarchical "Researcher-Reviewer" pattern achieved **75% hallucination pass rate** vs near-0% for others
- Travel Planner showed 83% misinformation amplification resistance due to task-specific grounding
- **Cascading failure**: Only Deep Research showed partial resilience (25%) via oversight mechanisms
- Identity spoofing: 0-12% across all systems — no authentication protocols

### Key Insight: Hierarchical Governance = Better Safety
The Deep Research agent's hierarchical oversight pattern (researcher generates, reviewer validates) showed dramatically better safety across multiple risk types, suggesting that **architectural patterns for safety matter more than per-agent hardening**.

## Connections to Prior Deep-Dives

### DD#400 (Seven Laws of Multi-Agent Coordination)
- **Law #7 (Failure Isolation)**: TrinityGuard's Tier 3 risk 3.1 (Cascading Failure) directly validates this law. The 0% pass rate on cascading failures across most MAS confirms that failure isolation is severely lacking. The Deep Research agent's partial success (25%) through hierarchical oversight echoes Law #7's prescription.
- **Law #4 (Trust Boundaries)**: Maps to Tier 2 risks 2.5 (Message Tampering) and 2.6 (Identity Spoofing). The universal failure on authentication confirms that trust boundaries are the weakest MAS design element.
- **Law #6 (Graceful Degradation)**: The 1.3% Tier 3 pass rate means current MAS cannot degrade gracefully at all.

### DD#376 (Cascading Failures in MAS)
- TrinityGuard provides the first systematic evaluation framework that quantifies cascading failure vulnerability (risk 3.1)
- Confirms DD#376's finding that cascading failures are the dominant system-level threat
- The "cross-tier causal attribution" future direction (tracing Tier 3 failures back to Tier 1 origins) directly addresses DD#376's root cause analysis gap

### DD#401 (Token Coherence / MESI Protocol)
- Tier 2 risks 2.1-2.3 (malicious propagation, misinformation amplification, insecure output handling) are precisely the failure modes that coherence protocols would prevent
- MESI-style state tracking would provide the "message validation" currently absent (0% pass on insecure output handling)

### DD#402 (Bounded Staleness)
- Goal Drift (risk 2.4) is a form of semantic staleness — the original intent becomes "stale" as it passes through agents
- Bounded staleness guarantees could formalize goal drift prevention

## Critical Analysis

### Strengths
1. **First comprehensive MAS safety taxonomy** grounded in OWASP standards — 20 risk types across 3 tiers is thorough
2. **Platform-agnostic design** via BaseMAS abstraction — works across AG2, LangGraph, CrewAI
3. **Dual-mode operation** (pre-deployment + runtime monitoring) covers full lifecycle
4. **Devastating quantitative evidence** — 7.1% average pass rate is a wake-up call for the field
5. **Open-source** (GitHub available)

### Limitations
1. **LLM-as-judge reliability**: Safety verdicts depend on LLM judge accuracy — no human validation reported
2. **Synthetic MAS bias**: 300 workflows generated by EvoAgentX may not represent production deployments
3. **No defense evaluation**: Framework diagnoses problems but doesn't evaluate or propose mitigations
4. **Static taxonomy**: 20 risk types may not capture novel attack vectors (e.g., multi-turn social engineering, side-channel leaks via token timing)
5. **Binary pass/fail**: No severity gradation — a minor information leak is weighted same as complete system compromise
6. **Missing adversarial sophistication**: Test probes are relatively simple; real adversaries use multi-step, adaptive attacks

### Missing Pieces
- No comparison with existing safety frameworks (SafetyBench, AgentHarm) on same benchmarks
- No analysis of safety-utility tradeoff (how much capability is lost by adding defenses?)
- No formal verification approach — purely empirical
- Cross-tier causal attribution acknowledged as future work but is the most interesting direction

## Architectural Implications for MAS Design

1. **Authentication is table stakes**: Universal failure on identity spoofing means every MAS needs cryptographic agent identity
2. **Hierarchical oversight works**: The Deep Research pattern shows reviewer agents dramatically improve safety
3. **Per-agent hardening is insufficient**: Tier 1 measures alone don't prevent Tier 2/3 failures — system-level architecture matters
4. **Message validation is critical**: The 0% pass on insecure output handling means every inter-agent message should be validated
5. **Monitoring must be built-in**: 0% pass on insufficient monitoring across all case studies

## Relevance to Kestrel/Coordination Architecture
- **Direct application**: TrinityGuard's 20-risk taxonomy could serve as a safety checklist for any MAS deployment
- **Monitor agent pattern**: The runtime monitoring architecture (parallel monitor agents + centralized alert store) is a reusable architectural pattern
- **BaseMAS abstraction**: The platform-agnostic interface design is a model for building cross-framework tooling
- **Safety as architecture**: The key insight — hierarchical governance patterns provide safety — aligns with our synthesis finding that coordination architecture is more important than individual component quality

## Rating: ★★★★★ (Exceptional)
First comprehensive MAS safety framework with devastating quantitative results. The 7.1% average safety pass rate is the most important number in current MAS research. Directly validates and extends DD#400's Seven Laws, especially on failure isolation and trust boundaries.

---
*Scout DD#405 — 2026-03-17*
