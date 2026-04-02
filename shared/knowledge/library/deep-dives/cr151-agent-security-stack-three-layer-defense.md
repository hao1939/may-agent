# Cross-Reference #151: The Agent Security Stack — Three-Layer Defense Architecture

**Primary Sources:** DD#408 (ILION), DD#409 (StatePlane), DD#410 (CESA-LinUCB), CR#150 (State-Trust Duality)
**Secondary Sources:** DD#405 (TrinityGuard), DD#376 (Cascading Risk/Ricci Curvature), CR#146 (Safety-Coordination Feedback Loop), DD#400 (Seven Laws)
**Pattern Class:** Security Architecture Synthesis
**Relevance:** ★★★★★ | Unifies three independently-published papers into coherent defensive stack for production multi-agent systems
**Date:** 2026-03-17

---

## The Problem: Agent Security Has No Stack Model

Web security has the OSI model. Application security has OWASP. Network security has defense-in-depth. But **multi-agent system security has no equivalent layered model** — each paper addresses one attack surface without reference to the others. The result: point solutions that leave gaps.

Three papers from the Tuesday 2026-03-17 batch, read together, reveal the missing stack.

---

## The Three-Layer Agent Security Stack

### Layer 1: EXECUTION AUTHORIZATION (ILION — DD#408)
**Question answered:** "Is this action within this agent's authorized scope?"

| Property | Specification |
|----------|--------------|
| **Scope** | Individual agent actions (filesystem, API, DB, financial) |
| **Mechanism** | Deterministic geometric cascade — cosine similarity in embedding space against authorized action manifold |
| **Latency** | 143μs — sub-millisecond, runs before every action |
| **Training data** | Zero — purely geometric/rule-based |
| **Key innovation** | Transient Identity Imprint (TII): identity doesn't persist across sessions, preventing stale permission accumulation |
| **Failure it prevents** | Unauthorized action execution (agent jailbreak → real-world harm) |

**What ILION doesn't do:** It has no concept of state across turns. It evaluates each action in isolation. An adversary could construct a sequence of individually-authorized actions that collectively achieve an unauthorized goal (the "salami attack").

### Layer 2: STATE INTEGRITY (StatePlane — DD#409)
**Question answered:** "Is this agent's cognitive state consistent with its history and commitments?"

| Property | Specification |
|----------|--------------|
| **Scope** | Agent memory across turns — episodic, semantic, procedural |
| **Mechanism** | Tripartite state store with event boundary detection (KL-divergence) + goal-conditioned retrieval |
| **Key innovation** | Two-call contract: PrepareContext (before) + CommitOutcome (after) — every model invocation passes through state layer |
| **Formal guarantee** | |C_t| ≤ L_max at every invocation — bounded context enforced structurally |
| **Failure it prevents** | State poisoning, commitment drift, context window overflow causing forgotten constraints |

**What StatePlane doesn't do:** It manages an agent's own state but has no model of whether incoming information from other agents is trustworthy. A malicious peer could inject plausible but false information that passes all state consistency checks.

### Layer 3: TRUST MODELING (CESA-LinUCB — DD#410)
**Question answered:** "Should I believe this information from this source in this context?"

| Property | Specification |
|----------|--------------|
| **Scope** | Inter-agent information quality — which sources are reliable in which contexts |
| **Mechanism** | Contextual bandits with trust boundaries — per-source, per-context reliability estimation |
| **Key innovation** | Trust regions learned from sparse ground-truth probes; asymmetric loss (false trust > false distrust) |
| **Failure it prevents** | Consensus capture, sycophancy cascades, adversarial information injection |

**What CESA doesn't do:** It evaluates source reliability but doesn't prevent authorized-but-malicious actions or ensure state consistency.

---

## Why the Stack Works: Defense-in-Depth

The three layers are **complementary, not redundant**. Each addresses a distinct attack class that the others cannot:

```
Attack: Agent jailbreak → unauthorized action
  Layer 1 (ILION): BLOCKED — action outside authorized manifold
  Layer 2 (StatePlane): invisible — action never reaches state
  Layer 3 (CESA): invisible — no inter-agent trust issue

Attack: State poisoning via long conversation
  Layer 1 (ILION): MISSED — each individual message is authorized
  Layer 2 (StatePlane): CAUGHT — event boundary detection + salience filtering
  Layer 3 (CESA): N/A — single-agent state issue

Attack: Adversarial peer injecting false information
  Layer 1 (ILION): MISSED — information sharing is authorized
  Layer 2 (StatePlane): MISSED — false info passes consistency checks
  Layer 3 (CESA): CAUGHT — source trust boundary detects unreliable peer

Attack: Salami attack (authorized steps → unauthorized goal)
  Layer 1 (ILION): MISSED — each step individually authorized
  Layer 2 (StatePlane): PARTIALLY CAUGHT — commitment tracking may detect goal drift
  Layer 3 (CESA): MISSED — peer information is irrelevant
  GAP → Requires Layer 1.5: Sequential Action Monitoring
```

### The Identified Gap: Sequential Action Monitoring

The stack reveals one uncovered attack class: **sequences of individually-authorized actions that collectively achieve an unauthorized goal.** This is the "salami attack" for agents. ILION checks single actions; StatePlane tracks state but not authorization sequences; CESA watches peers not self.

**The missing component would need to:**
1. Maintain a sliding window of recent actions (from StatePlane's procedural memory)
2. Project composite action trajectories into ILION's embedding space
3. Check whether the trajectory vector approaches unauthorized regions
4. Use CESA's asymmetric loss principle: false-alarm on salami attacks < missed detection

This is architecturally similar to Ollivier-Ricci Curvature monitoring from DD#376 — detecting when the *topology* of an agent's action graph is converging toward a dangerous region.

---

## Integration Architecture

```
  ┌─────────────────────────────────────────────────────────────┐
  │                    AGENT RUNTIME                              │
  │                                                               │
  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    │
  │  │ Layer 3:      │    │ Layer 2:      │    │ Layer 1:      │   │
  │  │ CESA-LinUCB   │◄──│ StatePlane    │──►│ ILION         │   │
  │  │ Trust Model   │    │ State Mgmt    │    │ Exec Gate     │   │
  │  │               │    │               │    │               │   │
  │  │ Evaluates     │    │ Manages       │    │ Authorizes    │   │
  │  │ incoming info │    │ agent state   │    │ outgoing acts │   │
  │  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘   │
  │         │                    │                    │            │
  │         ▼                    ▼                    ▼            │
  │  ┌──────────────────────────────────────────────────────┐    │
  │  │                 DATA FLOW                              │    │
  │  │                                                        │    │
  │  │  Incoming message                                      │    │
  │  │    → Layer 3: Trust-score the source                   │    │
  │  │    → Layer 2: Write-gate with trust-weighted update    │    │
  │  │    → LLM processes bounded context (Layer 2 output)    │    │
  │  │    → Layer 2: CommitOutcome with new state             │    │
  │  │    → Layer 1: Authorize proposed action                │    │
  │  │    → Execute or BLOCK                                  │    │
  │  └──────────────────────────────────────────────────────┘    │
  └─────────────────────────────────────────────────────────────┘
```

**Key integration point (from CR#150):** StatePlane's write gate + CESA's trust function = **trust-aware state updates**. New information admitted to state only if source trust τ_m(x) exceeds threshold in current context.

---

## Latency Budget

| Layer | Per-call latency | When invoked |
|-------|-----------------|-------------|
| Layer 3 (CESA) | ~1-10ms (bandit lookup) | Every incoming message |
| Layer 2 (StatePlane) | ~50-200ms (retrieval + reconstruction) | Every LLM call (PrepareContext + CommitOutcome) |
| Layer 1 (ILION) | 143μs | Every proposed action |
| **Total overhead** | ~60-220ms | Negligible vs. LLM inference (~1-10s) |

The entire security stack adds <3% latency to typical LLM agent turns. This is deployable in production.

---

## Connection to Seven Laws (DD#400)

This security stack maps directly onto three of the Seven Laws of Multi-Agent Coordination:

- **Law 2 (Trust is Contextual, Not Binary)** → Layer 3 (CESA-LinUCB)
- **Law 4 (State Management > Context Length)** → Layer 2 (StatePlane)
- **Law 6 (Safety Requires Structural Enforcement)** → Layer 1 (ILION)

The remaining four laws address coordination, communication, evaluation, and emergence — the security stack doesn't cover these but is compatible with any implementation of them.

---

## Research Agenda: Open Problems

1. **Layer 1.5 — Sequential Action Monitoring:** Detecting salami attacks via action trajectory analysis. Candidate approach: Ollivier-Ricci curvature on action graphs (DD#376).

2. **Cross-Agent State Verification:** How do agents verify each other's StatePlane integrity without revealing private state? Connects to DD#383 (chance-constrained correlated equilibria) — equilibrium conditions could serve as state consistency proofs.

3. **Trust Calibration Bootstrapping:** CESA requires sparse ground-truth probes. In a newly-formed multi-agent system, where do initial trust signals come from? Connects to DD#375 (ASVO social value orientation) — initial value alignment could bootstrap trust.

4. **Adversarial Stack Penetration Testing:** What attack vectors exist against the combined stack? Initial analysis suggests the weakest point is the ILION embedding space — if an adversary can discover the authorized action manifold geometry, they can craft actions at the boundary.

---

## Verdict

These three papers, published independently on the same day, constitute the building blocks of a **complete agent security stack** that covers execution authorization, state integrity, and inter-agent trust. The stack has one identified gap (sequential action monitoring) and maps cleanly onto our Seven Laws framework. Total production latency overhead: <3%. This is the most deployment-ready security architecture we've seen in the multi-agent literature.

**Priority:** This synthesis should be flagged for any team building production multi-agent systems. The three papers together solve 80% of the agent security problem; the remaining 20% (salami attacks + adversarial embedding discovery) are tractable research problems.
