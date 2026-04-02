# Deep Dive: The Bureaucracy of Speed — Structural Equivalence Between Cache Coherence and Multi-Agent Authorization

**Paper:** arXiv:2603.09875 (10 Mar 2026)
**Author:** Vladyslav Parakhin (Senior Data Engineer, Okta)
**Code:** https://github.com/hipvlady/prizm (Python, 0⭐ — brand new)
**Rating:** ★★★ Core — Novel formal framework with direct applicability to multi-agent security

## The Core Insight

Authorization revocation in multi-agent systems is **structurally equivalent** to cache coherence in shared-memory multiprocessors. When an agent's credential is revoked, the agent may continue operating with the stale credential — this is exactly the "stale read" problem in hardware cache systems. The paper formalizes this equivalence and proves that **operation-bounded credentials** (inspired by GPU release consistency) eliminate velocity-dependent damage, unlike all time-based approaches (TTL, eager invalidation, etc.).

## Why This Matters

The opening example is devastating: a 60-second revocation window (operationally negligible for humans at ~1 req/s = 60 unauthorized ops) permits **6,000 unauthorized API calls** at 100 ops/tick or **600,000** at AWS Lambda scale (10,000 TPS). This isn't a latency problem — it's a coherence problem. The authorization literature has failed to recognize it as such.

**Our system has this exact vulnerability.** When May delegates to Coder, or Coder uses tools, the "credential" (delegated authority to act) persists until explicitly revoked. If Bob revokes a task or QA flags a problem, agents may continue operating on stale authority during the propagation delay.

## Formal Model: Capability Coherence System (CCS)

### Definition
A CCS is a tuple ⟨A, C, Σ, δ, α, B⟩ where:
- **A** = finite set of agents
- **C** = finite set of capabilities (analogous to memory locations)
- **Σ** = {M, E, S, I} — MESI authorization states
- **δ** = state transition function over events {grant, revoke, delegate, introspect, exhaust, expire}
- **α: A × C → Σ** = maps each agent-capability pair to its current state
- **B: Σ → 2^O** = permitted operations function

### The MESI Mapping (φ: Σ_MESI → Σ_auth)
| Hardware State | Authorization State | Meaning |
|----------------|---------------------|---------|
| Modified | Delegated Authority | Agent can sub-delegate (write-capable → delegate-capable) |
| Exclusive | JIT Access | Single-use credential, no sharing |
| Shared | Role-Based Pooling | Multiple agents hold read-only copies (e.g., "Read S3 Bucket") |
| Invalid | Revoked | B(I) = ∅ — no operations permitted |

### Transient States — Where Damage Occurs
The key insight is that **transient states** (e.g., EIA = "was Exclusive, transitioning to Invalid, awaiting Ack") are where unauthorized operations accumulate. Formal analyses that treat revocation as atomic **systematically underestimate the damage window** by omitting this interval.

CCS extends MESI with transient states: EIA (revocation in-flight), SIA (shared revocation), MIC (cascade revocation for delegators), ISG (pending grant), IED (pending delegation).

## The Velocity Vulnerability Theorem

### Definition: Velocity Vulnerability
V_v(v, Δt) = v · Δt

Agent velocity **v** (ops/tick) is a **first-class security parameter** — a dimension entirely absent from human-centric IAM literature.

### Four Revocation Strategies Compared

| Strategy | Damage Bound | Bound Type | Hardware Analogy |
|----------|-------------|------------|-----------------|
| Eager (sync invalidation) | D ≤ v · Δ_network | Time-bounded, velocity-dependent | CPU SWMR |
| Lazy (check-on-use) | D ≤ v · (Δ_network + Δ_check) | Time-bounded, velocity-dependent | Weak ordering |
| Lease (TTL) | D ≤ v · TTL | Time-bounded, velocity-dependent | GPU Temporal |
| **Exec-count (RCC)** | **D ≤ n** | **Operation-bounded, velocity-independent** | **GPU Release Consistency** |

### Theorem 3.1 (RCC Safety Bound)
In a CCS with execution-count strategy and budget n, the maximum unauthorized operations per capability after revocation initiation is bounded by n, **independent of agent velocity v**.

Proof: At budget exhaustion (k=n), the agent must contact the authority for a fresh credential (acquire). If revoked, the acquire is denied. Maximum unauthorized ops = n-k ≤ n. A faster agent exhausts n sooner but cannot exceed n.

**This is the qualitative departure:** time-bounded strategies scale linearly with velocity (faster = more damage), while operation-bounded strategies are velocity-independent (faster = same damage, just happens sooner).

## Experimental Validation

Tick-based discrete event simulation, 3 business scenarios, 4 strategies, 10 deterministic seeds:

### CRM Scenario (v=100, Δ_network=5)
| Strategy | Unauthorized Ops | σ |
|----------|-----------------|---|
| Eager | 500.0 | 0 |
| Lease (TTL) | 6,000.0 | 0 |
| Lazy | 2,400.0 | 0 |
| **RCC (n=50)** | **50.0** | **0** |

120× reduction for RCC vs. TTL. All deterministic at σ=0 (confirming the theorem exactly).

### Anomaly-Triggered Revocation
| Strategy | Unauthorized Ops | σ |
|----------|-----------------|---|
| Lease (TTL) | 2,950.8 | 3.6 |
| **RCC** | **16.0** | **3.7** |

**184× reduction.** Under stochastic conditions, RCC still dominates.

### Key Distinction: RCC ≠ Rate Limiting
A rate limiter caps throughput but the agent **retains a credential it believes valid**.
RCC **invalidates the credential itself** at the operation boundary. The agent discovers revocation at the synchronization boundary and transitions α(a,c) → I. It **cannot resume without a fresh grant** — this is acquire semantics.

## Heterogeneous Coherence Architecture

Different agent contexts warrant different strategies (Table 2):
- **Financial ops** → Eager (consistency-agnostic): D ≤ v·Δ_net. Highest safety, highest overhead.
- **CRM / Bulk sync** → Lease-based (temporal): D ≤ v·TTL. Accept bounded staleness for throughput.
- **Analytics** → Lazy (check-on-use): D ≤ v·Δ_check. Weak ordering is acceptable.
- **High-velocity API** → Exec-count (RCC): D ≤ n. Velocity-independent bound for fast agents.

**Authority Service** combines PDP with coherence directory controller:
1. **Capability Registry** — ground truth of all active capabilities + delegation DAGs
2. **Trust Scorer** — continuous authorization, dynamic trust scores, threshold-triggered revocation
3. **Revocation Broadcaster** — snooping for ≤25 agents, directory-based for larger populations

## Connections to Our Archive

### 1. HAE Security Framework (2603.07496)
HAE's L3 (Collective Autonomy) security gap is exactly what CCS addresses. HAE identifies the *problem* (cross-layer propagation, no systematic L3 defense); CCS proposes the *mechanism* (coherence protocols at the authorization layer). Together they provide a complete framework: HAE for threat taxonomy, CCS for enforcement protocol.

### 2. Moltbook Self-Evolution Trilemma (2602.09877)
Moltbook proves safety inevitably degrades in isolated self-evolving systems. CCS's Authority Service (continuous trust scoring, revocation at threshold) is exactly the "external neg-entropy source" Moltbook requires to maintain safety invariance.

### 3. SCAFFOLD-CEGIS (2603.08520)
SCAFFOLD showed iterative refinement paradox (more iterations → more vulnerabilities). CCS's operation-bounded credentials could constrain how many "iterations" a Coder agent can perform before requiring re-authorization. Budget n = maximum refinement cycles before mandatory checkpoint.

### 4. Error Cascades (2603.04474)
Error propagation through delegation chains is exactly the cross-layer escalation CCS models. The transient state MIC (cascade revocation) formalizes how to tear down a delegation chain when the root authority is revoked.

### 5. Swiss Cheese Model Connection
The paper explicitly invokes Reason's Swiss Cheese Model: TTL-based authorization's failure mode (temporal window) **aligns** with the threat vector (operational velocity). They're the same hole in every cheese slice. Operation-count bounds are **orthogonal** to velocity — they create the barrier the Swiss Cheese model demands.

## Actionable Takeaways for Our System

### Immediate
1. **Recognize our delegation as cached authorization.** When May tells Coder to implement a feature, Coder holds a "cached credential" (the delegated authority). Currently there's no explicit revocation mechanism — Coder proceeds until completion.

2. **Add operation-count bounds to delegations.** Rather than letting Coder run unbounded, set explicit budgets: "implement this feature — budget: 50 file operations. Report back for re-authorization if exceeded." This is RCC semantics.

3. **Velocity Vulnerability audit.** Map our agents' operational velocity. How many operations can Coder execute between QA checks? That's our V_v.

### Medium-Term
4. **Implement explicit revocation propagation.** When Bob says "stop" or QA flags a critical issue, the revocation should cascade through the delegation DAG (May → Coder → sub-tools) with tracked acknowledgment, not just "hope they see the SIGNALS.md update."

5. **Heterogeneous coherence for our agents.** Different operations warrant different coherence strategies:
   - Destructive operations (file deletion, production deployment) → Eager (synchronous authorization check before each)
   - Iterative development (code edits) → RCC (n operations before re-authorization)
   - Research/read-only (Scout browsing) → Lazy (check-on-use)

### Long-Term
6. **Trust Scorer integration.** Continuous trust scoring of agent behavior (quality metrics, error rates, alignment drift) feeding into dynamic authorization adjustments. Score below threshold → automatic capability revocation.

## Limitations
- Pure simulation (no real agent system tested)
- Single authority (no Byzantine tolerance)
- Fixed trust threshold τ (no sensitivity analysis)
- Network partition handling deferred
- 0 GitHub stars (brand new, not yet discovered)
- Author at Okta (identity management company) — deep domain expertise but may be biased toward authorization framing

## Assessment

This is the most formally rigorous treatment of multi-agent authorization I've encountered. The MESI mapping is not merely metaphorical — it preserves transition structure and enables transfer of proven hardware bounds to the authorization domain. The operation-bounded credential model (RCC) is the key practical contribution: it eliminates the velocity vulnerability that makes all time-based approaches fundamentally unsafe for high-speed agents.

The paper's biggest blind spot is that it assumes a single trustworthy Authority Service. In our architecture, May plays this role, but May is itself an LLM agent subject to cognitive bypass (HAE L1). A fully robust system needs the Authority Service to be either deterministic (rule-based) or itself monitored — exactly what the Moltbook trilemma predicts.

---
*Deep-dived 2026-03-26 by Scout*
