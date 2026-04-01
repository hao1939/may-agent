# CR#259 — MAS Circuit Breakers: From Microservices to Multi-Agent Fault Isolation

**Type:** Cross-Reference Synthesis  
**Rating:** ★★★★★ CRITICAL  
**Date:** 2026-03-26  
**Sources:** DD#466 (ProMAS), DD#467 (AgentComm-Bench), DD#465 (Trust Collapse), DD#464 (ALARA), DD#463 (Selection Bottleneck), CR#255 (Fragile Orchestra), CR#258 (Compute Governance), 2505.03096 (Chaos Engineering for LLM-MAS)

---

## Thesis

Multi-agent systems lack an equivalent to the **circuit breaker pattern** that revolutionized microservices reliability. AgentComm-Bench (DD#467) proved that communication can *actively harm* agent performance — worse than no communication at all under corruption. Yet no current MAS framework implements principled fault isolation. By cross-referencing six of our deep-dives with the microservices circuit breaker pattern, this synthesis specifies a **five-state MAS Circuit Breaker** with formal triggering conditions, connecting ProMAS risk prediction to ALARA structural enforcement through trust-aware gating.

## The Microservices Precedent

Netflix's Hystrix (2012) introduced the circuit breaker pattern for distributed systems:

```
CLOSED → (failures exceed threshold) → OPEN → (timeout) → HALF-OPEN → (test succeeds) → CLOSED
                                                                      → (test fails) → OPEN
```

**Core insight:** When a downstream service is failing, continuing to send requests makes things worse — it wastes resources, increases latency, and can cascade failures. Better to **fail fast** and let the unhealthy service recover.

This maps directly to MAS: When an agent's communication channel is degraded, or its reasoning is corrupted, continuing to integrate its outputs makes the whole system worse. AgentComm-Bench quantifies this precisely.

## Evidence: Communication as Active Harm

DD#467 (AgentComm-Bench) demonstrated three regimes of communication value:

| Regime | Condition | Communication Effect | Example |
|--------|-----------|---------------------|---------|
| **Beneficial** | Clean channel, low corruption | Performance improves 3.6% → 96.7% (NAV) | Normal operation |
| **Neutral** | Moderate degradation | Performance unchanged (SEARCH: 20.7% → 26.8%) | Latency ≤200ms |
| **Harmful** | High corruption/staleness | Performance *degrades*: 95.8% → 14.0% (CP) | Stale memory ≥8 steps |

**The critical cliff:** Navigation performance drops from 96.7% to 2.5% (NPD=97.4%) under stale memory. This is not graceful degradation — it's a **phase transition** from functional to catastrophic. The transition point (σ ≈ 8 steps staleness) is the natural trigger for a circuit breaker.

## The Five-State MAS Circuit Breaker

Extending the three-state microservices pattern to handle MAS-specific failure modes:

```
              ┌─────────────────────────────────────────────┐
              │                                             │
              ▼                                             │
┌──────────────────┐    risk↑    ┌─────────────┐           │
│  CLOSED          │───────────→│  DEGRADED    │           │
│ (full comms)     │            │ (filtered)   │           │
└──────────────────┘            └──────┬───────┘           │
        ▲                              │                    │
        │ probe OK                risk↑↑                   │
        │                              │                    │
┌──────────────────┐            ┌──────▼───────┐           │
│  HALF-OPEN       │←───timer───│  OPEN        │           │
│ (test message)   │            │ (isolated)   │           │
└───────┬──────────┘            └──────────────┘           │
        │                                                   │
        │ probe FAIL                                        │
        ▼                                                   │
┌──────────────────┐       trust restored                   │
│  QUARANTINE      │───────────────────────────────────────┘
│ (agent removed)  │
└──────────────────┘
```

### State Definitions

| State | Agent Status | Communication | Trigger |
|-------|-------------|---------------|---------|
| **CLOSED** | Full participant | Sends and receives all messages | Default state |
| **DEGRADED** | Active but filtered | Messages pass through content validator; pruned if quality < threshold | ProMAS risk R_t > τ_base OR channel quality below threshold |
| **OPEN** | Isolated | No outbound messages accepted by peers; inbound buffered | Risk acceleration ∇R_t > δ OR AgentComm-Bench corruption metrics exceed phase-transition point |
| **HALF-OPEN** | Testing | Single probe message sent; response evaluated for coherence | Timer expires after OPEN period |
| **QUARANTINE** | Removed | Fully disconnected; requires manual review or trust restoration | Repeated HALF-OPEN failures (N consecutive probe failures) |

### Why Five States, Not Three

The microservices circuit breaker has three states (CLOSED/OPEN/HALF-OPEN). MAS needs two additional states because:

1. **DEGRADED** — MAS communication is richer than binary request/response. An agent can send *partially useful* information. Rather than cutting all communication at once, the DEGRADED state applies content filtering (SEMA-style structural entropy pruning from DD#471) to pass only high-information-density messages. This preserves coordination value while blocking corruption propagation.

2. **QUARANTINE** — Unlike microservices where a service can be restarted from clean state, an LLM agent that has been reasoning with corrupted inputs may have contaminated its own context/memory. Returning to CLOSED after a brief OPEN period risks re-introducing poisoned state. QUARANTINE represents the recognition that some agents need full context reset, not just communication restoration.

## Triggering Conditions: Formal Specification

### Transition: CLOSED → DEGRADED

```
Trigger iff ANY of:
  (a) ProMAS risk R_t > τ_base  (85th percentile of training risk)
  (b) Channel staleness > σ_warn (≈ 4 steps, half the phase-transition cliff)
  (c) Trust score T_i < T_threshold  (from DD#465 Friedkin-Johnsen dynamics)
  (d) ETD-MAPPO epistemic gate fires for >50% of receiving agents
      (downstream agents find sender's contributions non-informative)
```

**Action in DEGRADED state:**
- Apply structural entropy filter (SEMA-style, DD#471) to all outbound messages
- Weight inbound messages by channel quality estimate
- Log all filtered content for audit trail (GUS Law 4, Auditability)

### Transition: DEGRADED → OPEN

```
Trigger iff ANY of:
  (a) ProMAS risk acceleration ∇R_t > δ  (sudden regime change)
  (b) Channel corruption exceeds phase-transition point (σ > 8 from AgentComm-Bench)
  (c) Trust collapse spectral condition violated: ρ(J_local) ≥ 1  (DD#465)
  (d) Selection quality s drops below crossover threshold s*  (DD#463)
      — agent's contributions are reducing team quality, not improving it
```

**Action in OPEN state:**
- Discard all messages from/to isolated agent
- Redistribute agent's responsibilities to remaining agents (if applicable)
- Start recovery timer T_recover

### Transition: OPEN → HALF-OPEN

```
Trigger: T_recover expires (default: 2× mean task step duration)
```

**Action in HALF-OPEN state:**
- Send standardized probe message (known-good input with expected output)
- Evaluate response against expected output
- If response quality > Q_min AND channel metrics healthy → CLOSED
- If response quality < Q_min → OPEN (reset timer with backoff)
- If N consecutive probe failures → QUARANTINE

### Transition: QUARANTINE → CLOSED

```
Trigger: Manual review OR automated trust restoration protocol
  (a) Agent context fully reset (fresh state, no residual corruption)
  (b) Channel metrics verified healthy for M consecutive checks
  (c) Gradual re-integration: QUARANTINE → HALF-OPEN → DEGRADED → CLOSED
      (never jump directly to CLOSED from QUARANTINE)
```

## Integration with Existing Architecture

### With ProMAS (DD#466): The Sensing Layer

ProMAS provides the **risk signal** that drives circuit breaker transitions:
- Causal Delta Δ_t = semantic velocity → channel content quality estimate
- Risk acceleration ∇R_t = regime change detector → DEGRADED→OPEN trigger
- Bayesian transition matrices → probability of entering high-risk reasoning states

**Key insight:** ProMAS was designed to monitor *reasoning quality*. The circuit breaker repurposes it to monitor *communication quality* — because corrupted communication produces corrupted reasoning, and ProMAS detects the downstream effect.

### With ALARA (DD#464): The Enforcement Layer

ALARA provides **structural enforcement** for circuit breaker states:
- CLOSED: Full tool access and communication privileges
- DEGRADED: Reduced message types (ALARA's Jinx list restricts outbound message schema)
- OPEN: Tool list empty for communication tools (structural impossibility of sending)
- QUARANTINE: All capabilities removed; agent reduced to read-only observation

**This is the critical bridge:** ALARA proves that structural enforcement (schema-level) is more reliable than interpretive compliance (prompt-level). A circuit-broken agent shouldn't be *told* not to communicate — its communication tools should be *removed* from its schema.

### With Trust Collapse Dynamics (DD#465): The Stability Monitor

DD#465's spectral condition ρ(J₂ₙ) < 1 provides the **systemic stability check**:
- Per-agent trust T_i feeds into CLOSED→DEGRADED threshold
- Jacobian spectral radius monitors whether the trust-controversy feedback loop is converging or diverging
- When ρ → 1: preemptive DEGRADED transitions for agents with lowest trust margins
- When ρ ≥ 1: emergency OPEN transitions for agents most connected to the collapse epicenter

### With Selection Bottleneck (DD#463): The Quality Gate

DD#463's crossover threshold s* provides a **value-of-communication metric**:
- If an agent's recent contributions place it below the crossover threshold (its outputs reduce team quality), the circuit breaker should transition to DEGRADED or OPEN
- This operationalizes the abstract question "is this agent's communication helping?" into a quantitative test

### With Compute Governance (CR#258): The Efficiency Layer

Circuit breakers compose naturally with compute governance:
- An agent in OPEN state doesn't need compute allocation → ETD-MAPPO can permanently sleep it
- An agent in DEGRADED state should receive lower spatial attention from peers → SEMA prunes its messages more aggressively
- **Multiplicative efficiency:** Circuit breakers reduce the number of active communicators; compute governance reduces per-communicator cost

## The MAS Resilience Stack

Combining all components yields a complete resilience architecture:

```
Layer 5: ORCHESTRATOR
  ├── Global circuit breaker state machine
  ├── Agent-level state tracking (per-agent CB state)
  └── Recovery coordination + load redistribution

Layer 4: TRUST MONITOR (DD#465)
  ├── Friedkin-Johnsen opinion dynamics
  ├── Hawkes controversy cascade detection
  └── Spectral stability margin ρ(J₂ₙ)

Layer 3: RISK PREDICTOR (DD#466 ProMAS)
  ├── Causal Delta semantic monitoring
  ├── Markov transition risk scoring
  └── Risk acceleration (∇R_t) jump detection

Layer 2: CHANNEL QUALITY (DD#467 AgentComm-Bench)
  ├── Six-dimension impairment monitoring
  ├── Phase-transition detection (cliff points)
  └── Corruption vs. transport failure discrimination

Layer 1: STRUCTURAL ENFORCEMENT (DD#464 ALARA)
  ├── Schema-level capability gating
  ├── Communication tool access control
  └── Audit trail generation
```

**Information flow:** L2 senses channel quality → L3 predicts reasoning risk → L4 tracks systemic trust → L5 makes state transition decisions → L1 enforces structurally.

## Connection to Chaos Engineering (2505.03096)

Owotogbe's chaos engineering framework for LLM-MAS proposes deliberate fault injection to discover vulnerabilities. Our circuit breaker architecture is the **complementary defense**:

| Chaos Engineering | Circuit Breaker |
|-------------------|-----------------|
| Injects failures | Detects failures |
| Tests resilience | Provides resilience |
| Offline/testing | Online/production |
| Discovers thresholds | Enforces thresholds |

The ideal development cycle: Use chaos engineering to discover the phase-transition points (AgentComm-Bench-style), then configure circuit breaker thresholds at those points for production deployment.

## Predictions

- **P108 (Testable):** Within 12 months, at least one major MAS framework (AutoGen, CrewAI, MetaGPT) will implement a circuit breaker pattern for agent communication, with at least CLOSED/OPEN/HALF-OPEN states.

- **P109 (Architectural):** MAS circuit breakers will require DEGRADED state (content filtering) in addition to binary OPEN/CLOSED, because agent communication is semantically richer than microservice API calls. Frameworks that implement only binary isolation will show worse performance than those with graduated degradation.

- **P110 (Theoretical):** The optimal circuit breaker threshold is NOT the phase-transition point itself but a safety margin below it (analogous to control theory gain margins). Systems configured at the exact transition point will oscillate between states; systems configured at 50-70% of the transition point will achieve stability.

- **P111 (Integration):** Circuit breakers and compute governance are complementary, not competing. Systems implementing both will show super-linear resilience improvement because circuit breakers reduce the space of states compute governance must optimize over.

## Critical Gaps

1. **No implementation exists.** This synthesis is architectural specification, not empirical validation. The five-state model needs to be built and tested against AgentComm-Bench-style failure scenarios.

2. **Probe message design.** The HALF-OPEN state requires a "known-good probe" — but what does this look like for LLM agents? The probe must test reasoning quality, not just connectivity. Designing effective probes is a research problem in itself.

3. **Multi-agent cascade effects.** When one agent enters OPEN state, the remaining agents must absorb its workload. This could push other agents into DEGRADED state through increased load — a circuit breaker cascade. The architecture needs anti-cascade protections (minimum agents in CLOSED state guarantee).

4. **Adversarial gaming.** A malicious agent could deliberately trigger another agent's circuit breaker by sending corrupting messages. The circuit breaker needs to distinguish "the sender is corrupted" from "the channel is corrupted" — different failure modes requiring different responses.

5. **State persistence across sessions.** LLM-based agents often operate in episodic sessions. Circuit breaker state needs to persist and inform future sessions — an agent that was QUARANTINE'd should not be immediately trusted in the next episode.

## Verdict

The MAS circuit breaker pattern is the most important missing resilience primitive in current multi-agent architectures. Six papers from our archive independently contribute pieces of this pattern: ProMAS provides sensing, ALARA provides enforcement, AgentComm-Bench provides threshold data, trust collapse dynamics provides systemic monitoring, selection bottleneck provides quality gating, and compute governance provides efficiency integration. No one has assembled these pieces.

**This synthesis moves from observation ("communication can harm") to prescription ("here's the five-state machine, the triggering conditions, and the enforcement mechanism"). It is the architectural blueprint for MAS fault isolation.**

The pattern's power comes from its composability: each layer can be implemented independently with incremental benefit, but the full stack provides resilience guarantees that no single component achieves alone.

---

*Scout CR#259 | Session 191 | 2026-03-26*
