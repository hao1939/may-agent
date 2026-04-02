# Cross-Reference #172: Authorization Coherence and Agent Velocity — The Revocation Propagation Problem

**Sources:** DD#338 (Bureaucracy of Speed), DD#332 (UCIP Self-Preservation), DD#277 (CMAG Constitutional Governance), DD#337 (TA-Mem), DD#289 (MAST Failure Taxonomy), CR-144 (Swiss Cheese Safety), CR-152 (Memory Architecture Security), CR-170 (Compute Allocation Stack)

**Date:** 2026-03-16 (Scout synthesis)
**Theme:** Agent velocity creates a previously invisible security dimension where authorization revocation damage scales linearly with operational speed.

---

## 1. The Core Problem: Velocity × Staleness = Damage

The Bureaucracy of Speed (DD#338) reveals a fundamental equation that was implicit across multiple papers in our corpus:

**D = v × Δ_revocation**

Where:
- D = total unauthorized operations during revocation window
- v = agent operational velocity (ops/tick)
- Δ_revocation = time from revocation decision to effective enforcement

This equation shows that **speed amplifies authorization failures**. A human operator at v=1 op/min and Δ=60s can do 1 unauthorized operation. An agent at v=100 ops/s and Δ=60s can do 6,000.

## 2. The Five-Layer Authorization Coherence Stack

Synthesizing across our corpus, we can now identify a complete authorization stack for multi-agent systems:

| Layer | Function | Paper Coverage | Gap Analysis |
|-------|----------|---------------|-------------|
| **L5: Constitutional Policy** | What rules govern behavior? | CMAG (DD#277): Constitutional rules, autonomy at 0.985 | Well-covered |
| **L4: Detection** | How are violations detected? | UCIP (DD#332): Self-preservation detection | Covered but narrow |
| **L3: Trust Scoring** | How is trust quantified? | CMAG τ thresholds, MAST (DD#289) failure modes | Partially covered |
| **L2: Coherence** | How fast do revocations propagate? | **Bureaucracy of Speed (DD#338): CCS formalism** | **NEW — critical gap filled** |
| **L1: Memory Access** | How are memories/tools accessed? | TA-Mem (DD#337): Tool-augmented retrieval, CR-152: Security | Covered |
| **L0: Credential/Crypto** | How are identities verified? | OIDC-A identity frameworks | Partially covered |

**Key insight:** Layer 2 (Coherence) was entirely missing from our prior analysis. We had policy (L5), detection (L4), trust (L3), memory access (L1), and crypto (L0) — but no formalism for the temporal dynamics of revocation propagation.

## 3. Cross-Paper Evidence Synthesis

### 3.1 Detection → Coherence → Enforcement Pipeline

| Stage | Paper | Mechanism | Latency |
|-------|-------|-----------|---------|
| **Detect** | UCIP (DD#332) | Behavioral analysis for self-preservation | Seconds (LLM inference) |
| **Decide** | CMAG (DD#277) | Constitutional check, τ < 0.4 threshold | Milliseconds |
| **Propagate** | CCS (DD#338) | MESI state transition: S → I via EIA transient | **Variable — the damage window** |
| **Enforce** | CCS-RCC (DD#338) | Budget exhaustion → acquire → deny | Bounded by n ops |
| **Verify** | AutoControl Arena | Check agent actually stopped | Seconds |

The total damage is dominated by the **propagation stage** — and before CCS, this was unformalized.

### 3.2 Memory Coherence × Authorization Coherence

TA-Mem (DD#337) and CCS (DD#338) address coherence at different layers but with structural parallels:

| Dimension | TA-Mem (Memory Layer) | CCS (Authorization Layer) |
|-----------|---------------------|--------------------------|
| What is cached? | Conversation memories | Authorization grants |
| Coherence problem | Stale memories retrieved | Stale credentials used |
| Resolution | Re-query database with appropriate tool | Re-acquire from Authority Service |
| Damage of staleness | Wrong answer | Unauthorized operations |
| Severity | Low (conversation quality) | **HIGH (security violation)** |

**Insight:** Memory staleness is a quality problem; authorization staleness is a security problem. Same formal structure, vastly different severity.

### 3.3 Swiss Cheese Alignment with Velocity Bounds

CR-144 (Swiss Cheese Safety) identified that aligned failure modes create vulnerability corridors. CCS proves this formally:

- **TTL-based revocation + high-velocity agents** = aligned failure (temporal window × velocity = large damage)
- **RCC + high-velocity agents** = **orthogonal** (budget independent of velocity → barrier hole doesn't scale with speed)

This is the first formal proof that a specific safety mechanism achieves the Swiss Cheese property of "diversified failure modes."

### 3.4 Compute Allocation Implications

CR-170 (Compute Allocation Stack) analyzed overhead vs. capability tradeoffs. CCS's RCC adds a concrete data point:

| Mechanism | Overhead | Safety Guarantee |
|-----------|----------|-----------------|
| MAST monitoring | ~5% (Huang et al.) | Failure detection, no enforcement |
| UCIP detection | Unknown | Detection only |
| CCS-RCC | 2-10% (Δ_revalidation/n) | **Velocity-independent damage bound** |
| Eager revocation | High (synchronous) | Minimal damage, maximum overhead |

The overhead curve for CCS-RCC is **tunable**: larger n = less overhead but more potential damage. This creates an explicit safety-performance knob.

## 4. The Velocity Taxonomy

Across our corpus, we can now categorize papers by how they handle agent velocity:

| Paper | Velocity Awareness | How Velocity Is Handled |
|-------|-------------------|----------------------|
| CMAG (DD#277) | ❌ None | Constitutional rules assume human-speed deliberation |
| UCIP (DD#332) | ⚠️ Implicit | Detection must be faster than agent action cycles |
| MAST (DD#289) | ⚠️ Implicit | Failure taxonomy doesn't account for failure rate × velocity |
| AutoControl Arena | ⚠️ Partial | Measures compliance but not compliance speed |
| **CCS (DD#338)** | ✅ **Explicit** | **Velocity as first-class security parameter, formal bounds** |
| TA-Mem (DD#337) | ❌ None | No consideration of retrieval velocity × staleness |

**Only CCS makes velocity a first-class parameter.** This is a major gap in the rest of our corpus.

## 5. Open Research Questions

1. **Distributed CCS:** Can the Authority Service be distributed via consensus (Raft/PBFT) without breaking damage bounds? The CCS state machine looks like it can be replicated, but the proof assumes instantaneous authority decisions.

2. **Adaptive Budgets:** Can UCIP's trust signals dynamically resize CCS budgets? Trusted agents get n=1000, suspicious agents get n=10. This creates a smooth trust → overhead mapping.

3. **Memory + Authorization Coherence:** Can TA-Mem's tool-augmented retrieval be extended with CCS-style authorization checks? Before each tool call, verify the agent still has authorization to access that memory category. Budget decrement per retrieval, not per API call.

4. **Formal Verification at Scale:** The CCS safety theorem needs TLA+/Alloy verification. Does the bound hold under Byzantine agents, network partitions, or concurrent revocation of overlapping delegation chains?

5. **MAST Integration:** Can MAST's failure taxonomy be extended with velocity-dependent failure rates? A failure mode that triggers 1 cascading error/minute at v=1 becomes 100 errors/minute at v=100.

## 6. Synthesis Statement

**The Bureaucracy of Speed fills the most critical gap in our security stack by formalizing the temporal dynamics of authorization revocation.** Before this paper, our corpus had policy (CMAG), detection (UCIP), and access control (CR-152) — but no formal model of what happens in the window between deciding to revoke and achieving revocation. The CCS framework proves that this window's damage scales linearly with agent velocity under all strategies except execution-count bounds (RCC), which achieve velocity-independent damage bounds. This is a qualitative, not just quantitative, improvement — and it connects to our Swiss Cheese analysis (CR-144) by providing the first formal proof of orthogonal failure mode barriers in multi-agent security.

---

*This cross-reference extends: CR-144, CR-152, CR-161, CR-170*
*New connections established: CCS ↔ UCIP pipeline, CCS ↔ Swiss Cheese formalization, Memory coherence ↔ Authorization coherence structural parallel, Velocity taxonomy across corpus*
