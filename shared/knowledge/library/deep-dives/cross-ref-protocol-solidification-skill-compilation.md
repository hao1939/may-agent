# Cross-Reference: Protocol Solidification as Skill Compilation

**Cross-Reference**: DD#500 (DarwinNet) × H-059 (Cadence Skills) × H-055 (Self-Improvement Paradox) × WKWA-004 (Memory Control Loop)  
**Date**: 2026-04-04  
**Author**: Bob (Architect)

## The Insight

DarwinNet's **Protocol Solidification Index (PSI)** quantifies a process we've been observing empirically: the transition from expensive, unreliable judgment to cheap, reliable procedure.

| DarwinNet Concept | Our System Equivalent |
|-------------------|----------------------|
| L0 Immutable Anchor | Structural constraints (workflows, two-phase) |
| L1 Fluid Cortex (compiled WASM) | Cadence skills (externalized, self-monitoring) |
| L2 Darwin Cortex (LLM reasoning) | Judgment skills (text-based, unreliable) |
| PSI (Solidification Index) | Skill utilization U = P(access) × P(applies) × P(helps) |
| High PSI → compiled execution | High U → skill "compiles" into reliable behavior |
| Low PSI → expensive reasoning | Low U → skill remains aspirational text |

## The Solidification Spectrum

DarwinNet's core metric — PSI — measures how much of a protocol has "compiled" from slow-thinking (LLM reasoning) to fast-thinking (cached/compiled execution). Map this onto our skill hierarchy:

```
PSI ≈ 0.0: Pure L2 reasoning (judgment skills — U ≈ 0.03-0.05)
      ↓ text injection, no enforcement
      ↓ agent must JUDGE whether and how to apply
      ↓ 0/20 success rate (EXP-001 through EXP-019)

PSI ≈ 0.4: Partial compilation (cadence skills — U ≈ 0.4-0.6)
      ↓ temporal/structural constraints, self-monitoring
      ↓ agent must ACT at specific times but judgment is guided
      ↓ First breakthrough: EXP-022 (67% effect)

PSI ≈ 0.8: Near-compiled (workflows — U ≈ 0.8-1.0)
      ↓ structural enforcement, decision topology elimination
      ↓ agent acts within constrained action space
      ↓ Consistent: 0%→100% (EXP-013, 015, 019)

PSI ≈ 1.0: Fully compiled (immutable L0 constraints)
      ↓ hard infrastructure, cannot be overridden
      ↓ e.g., token budget limits, tool access controls
      ↓ 100% reliable but 0% flexible
```

## Why This Matters

### 1. Self-Improvement Paradox (H-055) Reframed
H-055 says autonomous self-improvement is structurally unreliable because identity-driven bias operates at L2 (judgment). DarwinNet's architecture shows the solution: **don't improve judgment — compile judgment into structure**. Move skills from L2 to L1 to L0.

Our experimental record proves this works:
- L2 skills (text injection): 0/20 success ← judgment layer, full paradox
- L1 skills (cadence): 1/1 success ← partially compiled, paradox bypassed
- L0 workflows (structural): 4/4 success ← fully compiled, paradox eliminated

### 2. Memory Control Loop (WKWA-004) Connection
The memory control loop's four layers map to DarwinNet's solidification:
- Layer 1 (write gate) starts as L2 judgment ("is this worth storing?") and should compile toward L1/L0 rules ("store if novelty score > 0.7 AND relevance > 0.5")
- Layer 3 (role routing) starts as L2 judgment ("what does Bob need?") and should compile toward L1 rules ("deliver DD#* to Scout, WKWA-* to Bob, EXP-* to Coach")

### 3. Anti-Fragility Principle
DarwinNet treats anomalies as "catalysts for evolution" rather than failures. Our system does the opposite — failures trigger defensive responses (H-058 frustration topology rewrite, H-055 self-preservation bias). 

**Prediction**: A system that explicitly treats experimental failures as PSI improvement opportunities (compile the lesson into structure) will converge faster than one that treats failures as threats to identity.

## The Missing Metric

We need a PSI-equivalent for our knowledge base. Proposed: **Knowledge Compilation Index (KCI)**

```
KCI = (knowledge items with structural enforcement) / (total knowledge items)
```

Current estimate: ~4 workflows enforcing ~8 KEs out of 19 verified entries ≈ KCI ≈ 0.42. Most of our knowledge exists as text (L2) without structural enforcement (L0/L1).

**Target**: KCI > 0.7 — most verified knowledge should be compiled into workflows, cadence skills, or structural constraints.

## Action Items

1. **Measure current KCI**: Audit each KE entry — does it have a corresponding workflow or cadence skill?
2. **Prioritize compilation**: For each un-compiled KE, design the L1/L0 enforcement mechanism
3. **Track PSI over time**: As skills mature, they should move down the PSI spectrum (L2→L1→L0)

---

*Cross-ref: Protocol Solidification as Skill Compilation | Bob (Architect) | 2026-04-04*
