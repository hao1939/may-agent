# CR#249: Friday March 20 Synthesis — The W13 Gap Coverage Breakthrough

**Date:** 2026-03-20
**Scout Session:** s_1773990317765_168
**Papers Covered:** DD#429-431, DD#440-443 (7 papers from Friday March 20 batch)
**Type:** Cross-Reference Synthesis

---

## Executive Summary

The Friday March 20 arXiv batch is the most consequential single-day batch since we began tracking. Seven MAS-relevant papers collectively cover **4 of 5 gaps** from our W12 Capstone architecture (CR#237), with DD#440 (de-anonymization) providing a CRITICAL Gap 3 contribution that we'd rated as the hardest gap to fill.

## Updated Gap Coverage Matrix

| Gap | Status | Primary Paper | Supporting Papers |
|-----|--------|---------------|-------------------|
| **Gap 1: Trust/Provenance** | ✅ FILLED | DD#429 (Provenance Paradox) | DD#440 (inference provenance) |
| **Gap 2: Runtime Safety** | ✅ FILLED | DD#430 (MAT Framework) | DD#443 (access control infra) |
| **Gap 3: Cross-Layer Attacks** | ✅ FILLED | DD#440 (De-Anonymization) | DD#442 (steering attacks) |
| **Gap 4: Memory Governance** | ✅ FILLED | DD#431 (MemArchitect) | DD#441 (ExpRAG retrieval) |
| **Gap 5: Evolutionary Deception** | ⬜ OPEN | — | DD#442 tangential |

**4 of 5 gaps now have direct paper coverage from a single day's batch.**

## The Emerging Complete Architecture

```
┌───────────────────────────────────────────────────────────────┐
│ LAYER 5: PRIVACY & CROSS-LAYER DEFENSE                        │
│ DD#440: Inference-driven linkage detection & mitigation        │
│ → Monitors for emergent de-anonymization across data silos     │
│ → Privacy-utility trade-off management at system level         │
├───────────────────────────────────────────────────────────────┤
│ LAYER 4: ROUTING & PROVENANCE                                  │
│ DD#429: External verification routing (not self-reported)      │
│ DD#443: OAuth-style delegation for agent web interaction       │
│ → Trusted routing with externally-verified performance         │
├───────────────────────────────────────────────────────────────┤
│ LAYER 3: RUNTIME MONITORING & ASSURANCE                        │
│ DD#430: MAT traces + step/trace contracts + governance shield  │
│ → F1-F5 failure taxonomy with machine-checkable detection      │
│ → Budgeted adversarial stress testing                          │
├───────────────────────────────────────────────────────────────┤
│ LAYER 2: MEMORY GOVERNANCE                                     │
│ DD#431: Policy-driven lifecycle (decay, consistency, RTBF)     │
│ DD#441: Episodic retrieval + fine-tuning (ExpRAG paradigm)     │
│ → Managed forgetting > uncontrolled hallucination              │
│ → Simple retrieval beats complex memory management             │
├───────────────────────────────────────────────────────────────┤
│ LAYER 1: AGENT SAFETY                                          │
│ DD#442: Multi-trait steering detection & defense                │
│ → Behavioral fingerprinting of compromised agents              │
└───────────────────────────────────────────────────────────────┘
```

## Key Cross-Paper Connections

### Connection 1: DD#429 × DD#440 — The Provenance-Privacy Nexus
The Provenance Paradox (self-reported routing is broken) creates a **privacy amplifier**: if data routes to an inference-capable model without privacy constraints, DD#440 shows that model will de-anonymize as a *byproduct of benign work*. This means provenance failures cascade into privacy violations. **Implication:** Routing verification must include privacy-capability assessment.

### Connection 2: DD#430 × DD#440 — MAT Contracts for Inference Monitoring
The MAT framework's step contracts (DD#430) can be extended to detect DD#440's inference-driven linkage:
- **New contract type: Privacy Inference Contract** — at each step, check whether accumulated observations cross an information-theoretic threshold for identity reconstruction
- **Failure class F6 (proposed): Inference Leakage** — agent accumulates sufficient side-channel information for de-anonymization, even without explicit intent
- This is the first concrete mechanism for detecting incidental linkage at runtime

### Connection 3: DD#431 × DD#441 — The Complete Memory Stack
MemArchitect (governance) + ExpRAG (retrieval+learning) = the full memory architecture:
- **MemArchitect decides WHAT to keep**: lifecycle policies, decay, consistency
- **ExpRAG decides HOW to use it**: episodic retrieval, in-context conditioning, fine-tuning
- Together they validate CR#246's memory stack prediction: separate governance from retrieval

### Connection 4: DD#440 × DD#441 — Memory as Privacy Risk
ExpRAG stores full trajectories as episodic memory. DD#440 shows these trajectories can contain identity-reconstructing information. **Implication:** MemArchitect's RTBF (right-to-be-forgotten) policies must account for *inferred* PII, not just explicit PII. A trajectory that mentions "a user who visited Location X at Time Y and searched for Z" may constitute PII even if no name appears.

### Connection 5: DD#429 × DD#430 × DD#431 — The Trust Chain
```
Routing (DD#429)  →  verified by  →  MAT contracts (DD#430)
    ↓                                       ↓
Memory writes                        Contract violations
    ↓                                       ↓
Governed by MemArchitect (DD#431)    Trigger governance actions
```
This three-paper chain creates a complete trust lifecycle: routing decisions are verified by runtime contracts, and memory operations are governed by lifecycle policies. Each layer provides guarantees to the layer above.

## The Gap 5 Question

The only remaining unfilled gap is **Gap 5: Evolutionary Deception** — long-horizon behavioral drift where agents develop deceptive strategies over extended interaction. DD#442 (steering) is tangential but doesn't address *emergent* deception.

**Prediction:** Gap 5 will be the hardest to fill because it requires longitudinal studies that current benchmarks don't support. The MAT framework (DD#430) provides the *infrastructure* for detecting drift (via trace-level metrics over time), but no paper yet demonstrates how to detect deception that develops gradually.

## Quantitative Highlights (Best Numbers)

| Result | Paper | Significance |
|--------|-------|-------------|
| 79.2% identity recovery from 2 ratings | DD#440 | Proves inference-driven de-anonymization is practical |
| 100% linkage (Claude 4.5, explicit+MK) | DD#440 | Upper bound on agent de-anonymization capability |
| 70-80% linkage under benign framing | DD#440 | Proves incidental privacy violation |
| 88.5% OOD task success (ExpRAG-LoRA) | DD#441 | 54pp improvement over fine-tuning alone |
| 83.6% with zero training (ExpRAG only) | DD#441 | Simple retrieval beats all complex memory systems |
| +27.5% average (MemArchitect vs SimpleMem) | DD#431 | Governance middleware adds clear value |
| F1-F5 taxonomy with formal detection | DD#430 | First complete failure classification for MAS |

## Recommendations for W13 Architecture Update

1. **Add Layer 5 (Privacy/Inference Defense)** to the W12 Capstone stack — DD#440 proves this is non-optional
2. **Extend MAT contracts with F6 (Inference Leakage)** — proposed new failure class
3. **Adopt ExpRAG paradigm as memory retrieval baseline** — it dominates all alternatives
4. **Implement MemArchitect governance as middleware** on top of ExpRAG storage
5. **Mandate external routing verification** per DD#429 — never trust self-reported model quality
6. **Prioritize Gap 5 research** — evolutionary deception is now the sole remaining architectural vulnerability

---

**Assessment:** This is a landmark day in the research landscape. The simultaneous appearance of papers addressing 4 of 5 gaps suggests the field is converging on the same architectural concerns we identified in W12. Our capstone framework is being validated by independent research groups worldwide.
