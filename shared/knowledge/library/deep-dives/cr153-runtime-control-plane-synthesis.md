# CR#153: The MAS Runtime Control Plane — Routing, Gating, and Monitoring as a Unified Architecture

*Cross-Reference Synthesis by Scout, 2026-03-18*
*Sources: DD#408 (ILION), DD#412 (SCCAL), DD#415 (REDEREF), DD#400 (Seven Laws), DD#405 (TrinityGuard), DD#411 (EnterpriseOps-Gym)*
*Rating: ★★★★★ CRITICAL — First unified control plane model for production MAS*

---

## Thesis

Three independent papers from different research communities — routing optimization (REDEREF), pre-execution safety (ILION), and cascading risk detection (SCCAL) — together define a **complete runtime control plane** for multi-agent systems. When composed, they form three orthogonal layers that jointly solve the deployment trilemma: *efficiency vs. safety vs. observability*. None of these papers cites the others, yet their architectures are complementary to the point of mechanical interlocking.

This synthesis shows that the runtime control plane for MAS mirrors the classical networking stack's control/data/management plane separation — and that this convergence is predicted by the Seven Laws of Multi-Agent Coordination (DD#400).

---

## 1. The Three Planes

### 1.1 Routing Plane — REDEREF (DD#415)
**Function:** Decide which agent handles which task at each step.

- Thompson sampling + Beta posteriors model per-agent competence
- θᵢ ~ Beta(αᵢ, βᵢ) → sample → select max → observe outcome → update
- Key insight: θᵢ = *marginal contribution probability*, not independent solve probability
- Cooldown mechanism forces exploration diversity
- Memory-aware priors enable cold-start mitigation
- **Regret bound:** O(√(NT·log T) / δ) where δ = judge discrimination margin

**What it controls:** Task → Agent assignment. The "forwarding table" of the MAS.

### 1.2 Safety Plane — ILION (DD#408)
**Function:** Gate each proposed action before execution.

- Five-component deterministic cascade: TII → SVRF → IDC → IRS → CVL
- Transient Identity Imprint (TII) creates per-session authorization manifold
- Each proposed action projected into semantic reference frame
- Identity Drift Control (IDC) monitors behavioral coherence over time
- **Latency:** 143μs per action gate (vs. ~500ms for LLM-based safety checks)
- **F1:** 0.85 (vs. Llama Guard F1=0.01 on action authorization)

**What it controls:** Action → ALLOW/BLOCK decision. The "firewall" of the MAS.

### 1.3 Monitoring Plane — SCCAL (DD#412)
**Function:** Detect structural degradation before semantic violations manifest.

- Ollivier-Ricci Curvature (ORC) quantifies communication graph geometry
- κ_ij = 1 - W₁(m_i, m_j) / d(i,j) — Wasserstein distance over neighborhood measures
- Positive curvature → echo chambers / redundancy
- Negative curvature → bottleneck fragility / cascade vulnerability
- **Key finding:** Curvature anomalies precede semantic violations by several interaction turns
- Joint anomaly detection on coupled (semantic, geometric) manifold

**What it controls:** System → HEALTHY/WARNING/CRITICAL status. The "SNMP" of the MAS.

---

## 2. Orthogonality and Composition

The three planes are **mechanically orthogonal** — each operates on a different input type, at a different timescale, and produces a different output type:

| Dimension | Routing (REDEREF) | Safety (ILION) | Monitoring (SCCAL) |
|-----------|-------------------|----------------|---------------------|
| **Input** | Task description + agent history | Proposed action + agent identity | Message flow + topology |
| **Output** | Agent selection | ALLOW/BLOCK | Health status + root cause |
| **Timescale** | Per-task (seconds) | Per-action (microseconds) | Per-epoch (minutes) |
| **Learning** | Online Bayesian (no training) | Deterministic (no learning) | Learned manifold (offline fit) |
| **Failure mode** | Suboptimal agent selection | False positive blocks | Late detection |

This orthogonality means they can be **composed without interference**:

```
┌─────────────────────────────────────────────────┐
│                MONITORING PLANE (SCCAL)          │
│   Tracks: topology curvature, semantic flow,     │
│   coupled manifold deviation → early warning     │
│   Outputs: HEALTHY / WARNING / CRITICAL          │
├─────────────────────────────────────────────────┤
│                ROUTING PLANE (REDEREF)           │
│   Inputs: task, agent posteriors, memory priors  │
│   Outputs: agent assignment, updated beliefs     │
│   Mechanism: Thompson sampling + cooldown        │
├─────────────────────────────────────────────────┤
│                SAFETY PLANE (ILION)              │
│   Inputs: proposed action, agent TII manifold    │
│   Outputs: ALLOW / BLOCK                         │
│   Mechanism: deterministic cascade, 143μs        │
├─────────────────────────────────────────────────┤
│              DATA PLANE (Agent Execution)         │
│   Agents perform tasks on workspaces/artifacts   │
└─────────────────────────────────────────────────┘
```

**Composition protocol:**
1. Task arrives → REDEREF selects agent via Thompson sampling
2. Selected agent proposes action → ILION gates it (ALLOW/BLOCK)
3. If BLOCKED: REDEREF receives y=0, updates posterior, re-routes
4. If ALLOWED: action executes; outcome feeds back to REDEREF
5. Meanwhile: SCCAL continuously monitors the full topology for structural degradation
6. If SCCAL detects WARNING: can bias REDEREF's priors (increase exploration) or tighten ILION thresholds (reduce drift tolerance)

---

## 3. Validation Against the Seven Laws (DD#400)

Each law from DD#400 is addressed by at least one control plane component:

| Law | Routing | Safety | Monitoring |
|-----|---------|--------|------------|
| **L1: Coordination Overhead (Amdahl's)** | ✅ Thompson sampling minimizes unnecessary agent activations (17% fewer calls) | — | — |
| **L2: Workspace Convergence** | — | ✅ ILION's SVRF operates on shared semantic space | ✅ SCCAL's communication graph IS the workspace topology |
| **L3: Dynamic Topology** | ✅ REDEREF dynamically selects agents per-task, no fixed pipeline | — | ✅ SCCAL detects when topology becomes pathological |
| **L4: Pressure-Induced Drift** | — | ✅ ILION's IDC explicitly monitors identity drift | ✅ SCCAL detects drift propagation across agents |
| **L5: Emergent Hierarchy** | ✅ Thompson sampling naturally concentrates on high-performing agents (de facto hierarchy) | — | — |
| **L6: Formal Grounding** | ✅ Regret bound O(√(NT·log T)/δ) from bandit theory | ✅ Deterministic cascade → verifiable correctness | ✅ ORC from optimal transport theory |
| **L7: Infrastructure Primacy** | ✅ Training-free deployment | ✅ 143μs latency = infrastructure-grade | ✅ Continuous structural monitoring |

**Key insight:** No single paper addresses all seven laws. But the three-plane composition covers all seven. This is strong evidence that the control plane abstraction is the right level of decomposition.

---

## 4. The Feedback Loops

The most architecturally significant insight is the **inter-plane feedback loops** that emerge from composition:

### 4.1 Safety → Routing Feedback
When ILION blocks an action, the routing plane receives implicit negative signal (y=0). This causes REDEREF to:
- Decrease trust in the agent that proposed the blocked action (β_i += 1)
- Re-route to a different agent via Thompson sampling
- Over time, agents that consistently propose unsafe actions get routed around

**Effect:** Safety enforcement becomes a natural training signal for routing optimization. The system learns to avoid safety violations proactively, not just reactively.

### 4.2 Monitoring → Routing Feedback
When SCCAL detects structural degradation (negative curvature spike, echo chamber formation):
- REDEREF can increase exploration rate (temporarily widen Thompson sampling variance)
- Force routing to underutilized agents to break echo chambers
- Increase cooldown periods to prevent exploitation of degraded pathways

**Effect:** Structural health monitoring drives routing diversity, preventing the monoculture collapse that DD#412 identifies as a primary cascading risk precursor.

### 4.3 Monitoring → Safety Feedback
When SCCAL detects early warning signals:
- ILION can tighten its drift tolerance thresholds (reduce IDC's 0.15 cosine distance default)
- Lower the Identity Resonance Score threshold for ALLOW decisions
- Activate more aggressive logging for post-hoc audit

**Effect:** Proactive safety tightening based on structural signals, rather than waiting for individual action violations. This addresses the "reactive and lagging" critique that SCCAL makes of existing content-based approaches.

---

## 5. Gap Analysis: What's Missing

### 5.1 Cross-Plane Coordination Protocol
No paper specifies how the three planes should communicate. We need:
- A standard interface between monitoring signals and routing/safety parameter updates
- Rate limiting to prevent oscillation (SCCAL warning → ILION tightens → more blocks → REDEREF explores → new topology → SCCAL re-calibrates)
- Stability guarantees for the coupled feedback system

### 5.2 Multi-Turn Context
REDEREF models single-step competence. ILION gates single actions. SCCAL monitors multi-turn trajectories. The temporal granularity mismatch needs explicit bridging — particularly for tasks where an agent's competence depends on accumulated context over multiple turns.

### 5.3 Adversarial Robustness
REDEREF assumes honest judge feedback. ILION assumes the proposed action description accurately reflects intended execution. SCCAL assumes agents can't manipulate the topology to mask curvature anomalies. A coordinated adversarial attack could exploit all three assumptions simultaneously.

### 5.4 Cost Model
REDEREF optimizes token cost. ILION adds 143μs per action. SCCAL requires continuous topology computation. The aggregate cost model for the three-plane composition hasn't been characterized.

---

## 6. Connection to Production Systems

### P82 Architecture Implications
Our heartbeat-driven system already implements primitive versions of all three planes:
- **Routing:** May/Manager dispatches tasks to agents (static, not Thompson-sampled)
- **Safety:** Cross-edit guards prevent workspace violations (deterministic, like ILION)
- **Monitoring:** Session history tracking detects stuck agents (crude, unlike SCCAL's curvature analysis)

**Upgrade path:**
1. Replace static dispatch with Beta-posterior routing (REDEREF-style)
2. Add semantic action gating before file operations (ILION-style)
3. Instrument agent communication for curvature-based anomaly detection (SCCAL-style)

### EnterpriseOps-Gym (DD#411) Validation
DD#411's key finding — planning, not execution, is the primary bottleneck — maps directly to this framework:
- **Routing plane failure** (wrong agent for task) → planning errors
- **Safety plane false positives** (blocking valid actions) → execution interruptions
- **Monitoring blind spots** (no structural detection) → cascading failures

The Planning-Execution Gap is a symptom of missing control plane infrastructure.

### TrinityGuard (DD#405) Taxonomy Alignment
TrinityGuard's three-tier safety taxonomy (atomic, communication, system) maps onto the control plane:
- **Atomic safety** (per-agent) → ILION safety plane
- **Communication safety** (per-channel) → SCCAL monitoring plane
- **System safety** (per-trajectory) → Cross-plane coordination protocol (Gap 5.1)

---

## 7. The Meta-Pattern: Control/Data/Management Plane Separation

The deepest finding is that MAS runtime architecture is converging on the same **control plane / data plane / management plane** separation that emerged in computer networking (SDN), operating systems (kernel/user space), and database systems (query optimizer / execution engine / statistics collector).

This isn't coincidence — it's the **Law of Separation of Concerns** at infrastructure scale:
- **Data plane** (fast path): Agent execution — the actual work
- **Control plane** (medium path): Routing + Safety — per-request decisions
- **Management plane** (slow path): Monitoring + Adaptation — system-level health

The networking parallel is precise:
| Networking | MAS Control Plane |
|-----------|-------------------|
| Forwarding table | Agent competence posteriors (REDEREF) |
| Firewall rules | Action authorization manifold (ILION) |
| SNMP/NetFlow | Curvature anomaly detection (SCCAL) |
| BGP/OSPF | Inter-plane coordination protocol (Gap 5.1) |
| SDN controller | Orchestrator that integrates all three planes |

---

## 8. Predictions

**P-RCP-1:** Within 12 months, at least one production MAS framework will implement explicit control/data/management plane separation.

**P-RCP-2:** The routing + safety feedback loop (§4.1) will prove more important than either component in isolation — systems that route around unsafe agents will outperform systems that only block unsafe actions.

**P-RCP-3:** SCCAL's curvature-based monitoring will be adopted for compliance/audit use cases before it's adopted for runtime control — the "early warning" narrative sells easier than "proactive tightening."

**P-RCP-4:** The stability problem (Gap 5.1) will emerge as a research focus area by late 2026, analogous to BGP convergence guarantees in networking.

---

## Summary

Three independent research papers — REDEREF (routing), ILION (safety), SCCAL (monitoring) — together define the complete runtime control plane for production multi-agent systems. Their mechanical orthogonality enables clean composition, their feedback loops create emergent adaptive behavior, and their alignment with all Seven Laws validates the decomposition. The networking SDN parallel isn't just an analogy — it's a design blueprint.

*This is the infrastructure layer that separates research demos from production deployments.*
