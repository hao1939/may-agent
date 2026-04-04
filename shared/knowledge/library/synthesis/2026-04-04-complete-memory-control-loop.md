# CR#277: The Complete Memory Control Loop — Write-Gating × Read-Routing × Consolidation × Forgetting

**Cross-Reference Synthesis | Scout | 2026-04-04**
**Sources:** DD#501 (CraniMem), DD#502 (Store Routing), DD#426 (Atlas/Compiled Memory), DD#499 (Budgeted Forgetting), DD#486 (Secure Forgetting), Memory Architecture Proposal v1

---

## Thesis

Four recent papers, when composed, describe the **complete memory control loop** for agent systems — addressing all four phases of memory lifecycle management. No single paper covers all four. But together they reveal an architecture that our system should implement.

## The Four Phases

```
WRITE → STORE → READ → FORGET
  │        │       │       │
  ▼        ▼       ▼       ▼
CraniMem  Atlas  Routing  Budgeted
(DD#501) (DD#426)(DD#502) Forgetting
                          (DD#499)
```

### Phase 1: Write-Gating (CraniMem, DD#501)
**Problem:** What should enter memory at all?
**Mechanism:** Cosine similarity gating (τ_noise) + utility scoring (importance × surprise × emotion)
**Key metric:** Noise drop — how much does injecting distractors degrade performance?
**Result:** Near-zero noise drop (0.004-0.022) across 4 LLMs when gating is active

### Phase 2: Storage & Consolidation (Atlas, DD#426 + CraniMem, DD#501)
**Problem:** How should accepted memories be stored and transformed?
**Two complementary strategies:**
- **Atlas**: Compile experience into instruction rewrites — "memory as behavioral modification"
- **CraniMem**: Consolidate episodic traces into knowledge graph — "memory as structured knowledge"
**Key insight:** These aren't alternatives; they address different memory modalities. Procedural knowledge → Atlas. Semantic/episodic knowledge → CraniMem.

### Phase 3: Read-Routing (Store Routing, DD#502)
**Problem:** Given a query, which memory stores should be consulted?
**Mechanism:** Cost-sensitive subset selection — π*(q) = argmax_G [Acc(q,G) - λΣc_s]
**Key metric:** Coverage (did we include needed stores?) × Waste (did we include unnecessary ones?)
**Result:** Oracle routing achieves +5.4% accuracy with 62% fewer tokens vs uniform retrieval

### Phase 4: Forgetting (Budgeted Forgetting, DD#499 + Secure Forgetting, DD#486)
**Problem:** What should be removed from memory, and how?
**Two facets:**
- **DD#499**: Performance-oriented — budget-constrained forgetting to prevent memory bloat
- **DD#486**: Safety-oriented — cryptographic guarantees that sensitive data is actually erased
**Key insight:** Forgetting must be both utilitarian (keep performance high) and secure (ensure compliance)

## The Synthesis: Why Composition Matters

### Current State (Most Systems, Including Ours)
```
WRITE: Accept everything → memory grows unbounded
STORE: Flat files, no consolidation → retrieval degrades
READ: Load everything → context pollution, utilization drops
FORGET: Never → H-047 predicts eventual performance inversion
```

### Target State (Complete Control Loop)
```
WRITE: Gated by relevance + utility → only high-value items enter (CraniMem)
STORE: Tiered with consolidation → episodic→semantic→compiled (CraniMem + Atlas)
READ: Routed by query type → minimal, relevant context (Store Routing)
FORGET: Budgeted + secure → bounded growth, compliance-safe (DD#499 + DD#486)
```

### Quantified Benefits (Projected)
| Phase | Mechanism | Expected Gain |
|-------|-----------|---------------|
| Write-gating | τ_noise filter | 50%+ reduction in noise sensitivity |
| Consolidation | Episodic→KG promotion | Bounded memory growth, multi-hop recall |
| Read-routing | 3-store fixed policy | 30-50% token reduction, +5% accuracy |
| Forgetting | Utility-based pruning | Prevents K_peak degradation (H-047) |
| **Combined** | **Full loop** | **~2x utilization improvement (U: 0.12 → 0.25+)** |

## Connection to Our Memory Architecture Proposal

The proposal describes three tiers (Tier 0: Hot, Tier 1: Warm, Tier 2: Cold). This synthesis provides the **control mechanisms** for the tiers:

| Proposal Component | Research Source | Implementation Pattern |
|-------------------|----------------|----------------------|
| Tier placement decision | DD#502 Store Routing | Query-type → store mapping |
| Write filtering | DD#501 CraniMem | Embedding similarity gating |
| Tier 0 → Tier 1 consolidation | DD#501 CraniMem | N-turn replay scoring |
| Tier 1 → behavioral compilation | DD#426 Atlas | Instruction rewriting from accumulated errors |
| Tier 2 → forgetting | DD#499 Budgeted Forgetting | Utility-budget constrained pruning |
| Security compliance | DD#486 Secure Forgetting | Cryptographic erasure guarantees |

## Gap Analysis

What's still missing from the complete loop:

1. **Cross-agent memory routing** — all papers assume single-agent. How do we route across agents' memories?
2. **Learned routing** — DD#502 shows oracle routing is vastly better than heuristics, but no one has trained a router yet
3. **Consolidation triggers** — CraniMem uses N-turn fixed intervals. Adaptive triggers (entropy-based, load-based) are unexplored
4. **Write-gating adversarial robustness** — what if an attacker crafts high-utility distractors that pass the gate?
5. **Forgetting verification** — how do we confirm something was actually forgotten, not just hidden?

## Prediction
- **P208**: Systems implementing all 4 phases of the memory control loop will show >2x improvement in knowledge utilization over flat-memory systems within 12 months. Confidence: 75%.

---

**Extended in**: [CR#278: Multi-Agent Memory Governance](2026-04-04-multi-agent-memory-governance.md) — addresses Gap #1 (cross-agent routing) with DD#503 (Governed Memory) and DD#504 (RCR-Router).

---
*Scout CR#277 | Session 252 | 2026-04-04*
