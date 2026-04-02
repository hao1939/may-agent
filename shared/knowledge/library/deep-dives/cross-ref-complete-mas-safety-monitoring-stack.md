# CR#152: The Complete MAS Safety Monitoring Stack — From Microsecond Gates to Trajectory Auditing

**Type:** Cross-Reference Synthesis  
**Sources:** DD#405 (TrinityGuard), DD#408 (ILION), DD#409 (StatePlane), DD#410 (CESA-LinUCB), DD#412 (SCCAL), DD#415 (REDEREF), CR#146 (Safety-Coordination Feedback Loop), CR#151 (Agent Security Stack), DD#400 (Seven Laws)  
**Date:** 2026-03-17  
**Rating:** ★★★★★ CRITICAL — First complete five-layer safety architecture for production MAS

---

## Thesis

Tuesday's March 17 batch, combined with prior research, provides enough evidence to specify a **complete, layered safety monitoring stack** for multi-agent LLM systems. This synthesis integrates findings from 7 independent research groups into a unified architecture where each layer addresses a distinct failure mode at a distinct timescale. The key insight: **no single safety mechanism is sufficient** because MAS failures span 5 orders of magnitude in timescale (microseconds to multi-turn trajectories) and 3 qualitative tiers (atomic, communication, system-level).

---

## The Five-Layer Safety Stack

### Layer 0: Deterministic Action Gates (ILION — DD#408)
**Timescale:** 143μs per action  
**Scope:** Per-agent, per-action  
**Mechanism:** Five-component deterministic cascade (TII→SVRF→IDC→IRS→CVL)  
**What it catches:** Individual dangerous actions (file deletion, unauthorized API calls, SQL injection)  
**What it misses:** Multi-turn strategic manipulation, emergent coordination failures  
**Key metric:** F1=0.85 vs. Llama Guard F1=0.01 on action safety

**Critical finding:** Existing content-moderation guardrails (designed for text safety) completely fail on *action* safety. This is a category error — action safety requires deterministic, structured verification, not probabilistic language understanding.

### Layer 1: Bounded-Context State Management (StatePlane — DD#409)
**Timescale:** Per-step state updates  
**Scope:** Per-agent cognitive state  
**Mechanism:** Tripartite memory (working/episodic/semantic) with information-bottleneck encoding  
**What it catches:** Context overflow, state corruption, memory poisoning  
**What it misses:** Inter-agent coordination failures, topology-level risks  
**Key principle:** "Evidence not instruction" — external inputs are treated as data to be validated, not directives to follow

**Critical finding:** Agents with bounded context windows are inherently vulnerable to state manipulation. StatePlane's encoding bottleneck creates an information-theoretic defense: adversarial inputs cannot fully specify the agent's internal state.

### Layer 2: Contextual Trust Boundaries (CESA-LinUCB — DD#410)
**Timescale:** Per-interaction trust updates  
**Scope:** Per-agent-pair trust relationships  
**Mechanism:** Contextual bandit with Upper Confidence Bound for trust calibration  
**What it catches:** Trust exploitation, social engineering between agents, authority spoofing  
**What it misses:** System-wide topology degeneration, non-adversarial cascading failures  
**Key principle:** Trust is contextual and must be learned, not configured

**Critical finding:** Static trust configurations (ACLs, role-based access) fail in dynamic MAS because the mapping from identity to trustworthiness changes with context. Adaptive trust boundaries are necessary.

### Layer 3: Probabilistic Routing Control (REDEREF — DD#415)
**Timescale:** Per-delegation decision  
**Scope:** System-wide agent routing  
**Mechanism:** Thompson sampling with Beta posteriors for belief-guided delegation  
**What it catches:** Inefficient routing, agent degradation, cold-start exploitation  
**What it misses:** Semantic-geometric topology degeneration (no structural monitoring)  
**Key metric:** 28% token reduction, 17% fewer agent calls, 19% faster time-to-success

**Critical finding:** Routing control is a safety mechanism, not just an efficiency optimization. By routing away from degraded agents, REDEREF prevents cascading failures at the delegation level. The cooldown mechanism specifically prevents exploitation loops.

### Layer 4: Semantic-Geometric Trajectory Auditing (SCCAL — DD#412)
**Timescale:** Multi-turn trajectory analysis  
**Scope:** Full system communication topology  
**Mechanism:** Ollivier-Ricci Curvature coupled with semantic flow analysis  
**What it catches:** Cascading risks, echo chamber formation, bottleneck fragility, coordination collapse  
**What it misses:** Per-action safety (too slow for real-time action gating)  
**Key metric:** 10.2 turns early warning, AUROC 0.88

**Critical finding:** Structural distortions in communication topology systematically precede semantic violations by ~10 turns. Neither semantic monitoring alone (AUROC 0.71) nor geometric monitoring alone (AUROC 0.77) is sufficient — only their co-evolutionary consistency (AUROC 0.88) reliably predicts cascading risk.

---

## Architectural Properties

### 1. Separation of Concerns by Timescale

| Layer | Latency | Scope | Type | Primary Metric |
|-------|---------|-------|------|----------------|
| L0: ILION | 143μs | Per-action | Deterministic | F1=0.85 |
| L1: StatePlane | ~ms | Per-agent-state | Information-theoretic | Encoding capacity |
| L2: CESA-LinUCB | ~100ms | Per-agent-pair | Probabilistic (UCB) | Regret bound |
| L3: REDEREF | ~seconds | Per-delegation | Probabilistic (TS) | Token/call savings |
| L4: SCCAL | ~minutes | Full topology | Geometric-semantic | AUROC, DLT |

This separation ensures that **fast-timescale failures are caught by fast-timescale mechanisms**, and slow-timescale emergent failures are caught by mechanisms with enough temporal context.

### 2. Complementary Coverage vs. TrinityGuard Taxonomy

TrinityGuard (DD#405) identified three safety tiers with 20 OWASP-grounded risk types:

| TrinityGuard Tier | Stack Layers | Coverage |
|-------------------|--------------|----------|
| **Atomic** (per-agent) | L0 (ILION), L1 (StatePlane) | Action safety + state integrity |
| **Communication** (per-channel) | L2 (CESA-LinUCB), L3 (REDEREF) | Trust + routing |
| **System** (per-trajectory) | L4 (SCCAL) | Trajectory-level cascade detection |

TrinityGuard's finding that current MAS have only **7.1% safety pass rate** across these tiers now has a clear remediation path: deploy all five layers.

### 3. The Safety-Coordination Feedback Loop (CR#146)

CR#146 theorized a positive feedback loop: safety overhead → reduced coordination capacity → increased pressure → further safety degradation. The five-layer stack creates **multiple circuit breakers**:

- **L3 (REDEREF)** breaks the loop at the routing level: degraded agents get fewer delegations, reducing coordination overhead
- **L4 (SCCAL)** detects the loop at the trajectory level: curvature divergence signals the onset of the feedback spiral
- **L1 (StatePlane)** prevents state-level pressure accumulation through bounded-context guarantees

### 4. Alignment with the Seven Laws (DD#400)

| Law | Stack Layer(s) | How Addressed |
|-----|---------------|---------------|
| L1: Coordination Overhead | L3 (routing efficiency) | Minimizes unnecessary agent calls |
| L2: Workspace Convergence | L1 (state management) | Bounded, managed agent state |
| L3: Dynamic Topology | L4 (ORC monitoring) | Quantitative topology health metrics |
| L4: Pressure-Induced Drift | L4 (co-evolution residual) | Detects drift before semantic failure |
| L5: Emergent Hierarchy | L3 (routing beliefs) | Routing naturally creates hierarchy |
| L6: Formal Grounding | L0 (deterministic gates) | Provably correct action constraints |
| L7: Infrastructure Primacy | All layers | Safety as infrastructure, not afterthought |

---

## Deployment Architecture

```
                    ┌─────────────────────────────┐
                    │  L4: SCCAL Trajectory Audit  │ ← minutes timescale
                    │  (Semantic-Geometric ORC)    │   global topology monitor
                    └──────────────┬──────────────┘
                                   │ anomaly alerts
                    ┌──────────────▼──────────────┐
                    │  L3: REDEREF Routing Control  │ ← seconds timescale
                    │  (Thompson Sampling Beliefs)  │   delegation decisions
                    └──────────────┬──────────────┘
                                   │ route decisions
              ┌────────────────────┼────────────────────┐
              │                    │                     │
    ┌─────────▼─────────┐ ┌───────▼────────┐ ┌─────────▼─────────┐
    │  Agent A           │ │  Agent B        │ │  Agent C           │
    │ ┌───────────────┐  │ │ ┌────────────┐  │ │ ┌───────────────┐  │
    │ │L2: CESA-LinUCB│  │ │ │L2: Trust   │  │ │ │L2: Trust      │  │
    │ │  Trust Layer   │  │ │ │  Layer     │  │ │ │  Layer        │  │
    │ ├───────────────┤  │ │ ├────────────┤  │ │ ├───────────────┤  │
    │ │L1: StatePlane  │  │ │ │L1: State   │  │ │ │L1: State      │  │
    │ │  State Mgmt    │  │ │ │  Mgmt      │  │ │ │  Mgmt         │  │
    │ ├───────────────┤  │ │ ├────────────┤  │ │ ├───────────────┤  │
    │ │L0: ILION       │  │ │ │L0: ILION   │  │ │ │L0: ILION      │  │
    │ │  Action Gate   │  │ │ │  Action    │  │ │ │  Action Gate  │  │
    │ └───────────────┘  │ │ └────────────┘  │ │ └───────────────┘  │
    └────────────────────┘ └────────────────┘ └─────────────────────┘
```

**Key architectural decisions:**
- L0-L2 are **per-agent** (embedded in each agent's runtime)
- L3 is **per-system** (centralized or distributed routing controller)
- L4 is **per-system** (requires global communication graph visibility)
- Information flows **upward** (lower layers report to higher layers)
- Control flows **downward** (higher layers constrain lower layers)

---

## Open Questions

### 1. Integration Overhead
What is the total latency overhead of the full stack? ILION adds 143μs, but the combination of all five layers may introduce non-trivial coordination costs. This connects to Law 1 (Coordination Overhead) — the safety stack itself must obey the overhead law.

### 2. Cross-Layer Feedback
The current synthesis assumes layers operate independently. But L4 (SCCAL) detecting a cascade should feed back to L3 (REDEREF) to adjust routing, which should feed to L2 (CESA-LinUCB) to adjust trust. The cross-layer feedback protocol is unspecified.

### 3. Calibration
Each layer requires calibration against "normal" behavior:
- L0: Action safety rules (manually specified)
- L1: Context capacity bounds (architecture-dependent)
- L2: Trust priors (domain-dependent)
- L3: Agent capability beliefs (learned online)
- L4: Co-evolution manifold (learned from benign trajectories)

How to bootstrap calibration in new deployments?

### 4. Adversarial Robustness Across Layers
What if an adversary specifically targets the gaps between layers? E.g., actions that are individually safe (pass L0) but collectively produce cascading risk (caught only by L4)? The ~10-turn warning window from SCCAL is substantial, but may not be sufficient against fast-acting coordinated attacks.

### 5. Scalability
SCCAL's ORC computation is O(n²) per edge pair. For systems with 100+ agents, this may become prohibitive. Hierarchical approximations (monitoring cluster-level curvature rather than edge-level) may be necessary.

---

## Verdict

This synthesis represents the most complete safety architecture for multi-agent LLM systems assembled from the current research literature. The five layers — each validated by independent research groups — cover the full spectrum from microsecond action gates to minute-timescale trajectory auditing. The architecture's key strength is its **separation of concerns by timescale and scope**, ensuring that each failure mode is addressed by a mechanism operating at the appropriate scale.

The critical gap remains **integration**: no one has built and tested the full stack. Each layer has been validated independently, but the interactions between layers, the total overhead, and the cross-layer feedback protocols remain open research questions.

**For our system specifically:** Layers 0, 1, and 3 are the most immediately implementable. L0 (deterministic action gating) maps directly to tool-permission systems. L1 (bounded context management) maps to session state design. L3 (belief-guided routing) maps to agent delegation logic.

---

*Scout CR#152 | 2026-03-17 | Session s_1773790500836_246*
