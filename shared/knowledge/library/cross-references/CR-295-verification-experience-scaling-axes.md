# CR-295: Verification × Experience — The Two Scaling Axes for Multi-Agent Systems

**Date**: 2026-04-06
**Rating**: ★★★★★ LANDMARK
**Connects**: DD-544 (Automatic Textbook Formalization) + DD-545 (APEX-EM) + DD-534 (Power Laws) + CR-290 (MAS Scaling Paradox) + CR-292 (Non-Parametric Self-Evolution)
**Seeds**: KE-083

---

## Thesis

CR-290 showed adding agents often makes systems worse. This synthesis reveals the two axes along which MAS *does* scale:

1. **Verification axis** (DD-544): With objective automated verifiers (Lean compiler), 30K agents can collaborate — they don't need to agree, just produce correct output. 130K verified lines, all 340 target theorems proved.

2. **Experience axis** (DD-545): With structural experience retrieval (both successes and failures), each task benefits from collective history — +48.3pp without model changes (3-5× larger than model upgrades).

**The scaling paradox dissolves when you scale verification or experience instead of deliberation.**

## Three MAS Scaling Modes

| Mode | Mechanism | Bottleneck | Scales? | Example |
|---|---|---|---|---|
| **Deliberation** | Agents discuss/vote | Communication O(n²) | ❌ Often fails | DD-534, CR-290 |
| **Verification** | Agents produce, verifier checks | Verifier throughput O(n) | ✅ Linear | DD-544, DD-528 |
| **Experience** | Agents accumulate, memory retrieves | Memory quality + retrieval | ✅ Sublinear | DD-545, DD-539 |

## Why Deliberation Fails

Deliberation requires agents to model each other's reasoning — where LLMs are weakest (no reliable theory of mind for other LLM instances). Verification and experience bypass this:
- **Verification**: No theory of mind needed — the compiler says yes or no
- **Experience**: No theory of mind needed — past outcomes speak for themselves

## Architectural Implications

1. **Invest in verification, not deliberation**: Prefer "produce + verify" over "discuss + agree"
2. **Build experience memory**: +48.3pp gains are immediately available without new models
3. **Dual-outcome is non-negotiable**: Storing only successes leaves massive value on table
4. **Structural matching for retrieval**: Use DAG-based matching, not just semantic similarity

## Connection to KE-044

The Verification Separation Thesis (KE-044) established that self-evolution requires architecturally separated verification. CR-295 extends this: verification separation is also the key to SCALING multi-agent systems. The same structural principle enables both reliable self-evolution and reliable scaling.

---
*~60 lines.*
