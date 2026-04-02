# CR#244: The Memory Quality Imperative — Atlas + Experience-Following Synthesis

**Rating:** ★★★★★ CRITICAL  
**Type:** Cross-reference synthesis  
**Sources:** DD#428 (Experience-Following), DD#426 (Atlas/Compiled Memory), CR#241 (Memory Adversarial Robustness)  
**Date:** 2026-03-18

---

## Thesis

Two papers — one from Harvard/MSU (Xiong et al., 2025) establishing the **problem** of memory quality in agent systems, and one from AlphaBitCore (Rhodes & Kang, 2026) proposing a **solution** via compiled memory — together define the complete memory quality stack. When combined, they reveal both the architecture's strengths and a critical vulnerability.

---

## The Problem-Solution Chain

### Xiong et al. (DD#428) establishes empirically:
1. **Experience-following property** — agents imitate retrieved memories with near-perfect correlation when input similarity is high
2. **Error propagation** — bad memories beget bad executions which beget worse memories (compounding)
3. **Misaligned experience replay** — even correct-looking memories can degrade performance when context shifts
4. **Evaluator quality is the bottleneck** — memory system quality is bounded by evaluator quality
5. **300 labeled trajectories** suffice to fine-tune an adequate evaluator (80% of oracle)

### Atlas (DD#426) responds architecturally:
1. **Compiled instructions replace raw traces** — reduces pure imitation, forces behavioral abstraction
2. **Confidence scoring** — implicit quality evaluation through corroboration/contradiction tracking
3. **Behavioral abstraction** — strips context-specific content, mitigating misaligned replay
4. **Three-step gate** — Store → Validate → Compile implements selective addition

---

## The Critical Synthesis: Three Memory Paradigms

| Paradigm | Representation | Quality Control | Error Propagation Risk |
|----------|---------------|----------------|----------------------|
| **Episodic** (raw traces) | Query + execution pairs | Evaluator at storage time | HIGH — agents directly mimic errors |
| **Compiled** (Atlas-style) | Behavioral directives | Confidence scoring + compilation | MEDIUM — errors abstract into wrong rules |
| **Optimized Episodic** (Xiong+deletion) | Curated query + execution pairs | Evaluator + history-based deletion | LOW-MEDIUM — ongoing quality pruning |

### Key Insight: Atlas and Xiong-style deletion are COMPLEMENTARY, not alternative

- **Atlas** prevents error propagation by transforming the representation (episodic → procedural)
- **History-based deletion** prevents error propagation by curating the pool (bad entries removed)
- **Combined approach:** Compile from a curated pool → best of both worlds

---

## The Vulnerability: Compilation Error Propagation

Atlas's compilation step introduces a NEW error channel not present in episodic memory:

1. **Episodic errors are transparent** — you can inspect the raw execution and see the mistake
2. **Compiled errors are opaque** — a wrong behavioral directive ("always prefer route X") looks identical to a correct one

If the compilation step misinterprets a pattern from noisy memories, it produces a confident but wrong instruction. Xiong et al.'s experience-following property then ensures agents follow this wrong instruction faithfully.

**This is the "Compiled Error Amplification" problem:**
- Raw error: wrong output for one query → affects similar queries
- Compiled error: wrong behavioral rule → affects ALL queries matching the rule's scope

Mitigation requires: (1) Xiong-style history-based evaluation of compiled rules, (2) multiple corroborations before compilation (Atlas partially addresses this), (3) adversarial testing of compiled directives.

---

## Quantitative Design Guidance (Synthesized)

From the two papers combined:

| Design Decision | Evidence-Based Recommendation | Source |
|----------------|------------------------------|--------|
| Memory addition | NEVER add-all; minimum evaluator required | DD#428 Table 1 |
| Evaluator investment | Fine-tune on ~300 labeled trajectories | DD#428 §3.2 |
| Memory deletion | History-based deletion on retrieval utility | DD#428 §4.2 |
| Compilation threshold | Require ≥2 corroborations before compile | DD#426 confidence model |
| Contradiction handling | λ₋ = 0.7 decay per contradiction | DD#426 §4.3 |
| Memory capacity | Quality > Quantity; 100 good > 2000 unfiltered | DD#428 Table 1 |
| Distribution shift | History-based deletion enables adaptation | DD#428 §5.1 |

---

## Implications for Production Multi-Agent Memory

### The Memory Evaluator Triangle
Three properties, pick two:
1. **Accuracy** (oracle evaluation) — expensive, doesn't scale
2. **Speed** (automatic evaluation) — noisy, leads to error propagation
3. **Adaptiveness** (history-based) — requires deployment history, cold-start problem

**Practical solution:** Start with strict human evaluation to seed initial memory (small, high-quality pool) → transition to fine-tuned automatic evaluator → add history-based deletion as deployment data accumulates.

### Multi-Agent Memory Sharing Protocol
Given experience-following + error propagation, shared memory in MAS requires:
1. **Source tagging** — track which agent produced each memory
2. **Cross-agent validation** — memory only shared if validated by ≥2 agents
3. **Role-aware retrieval** — similarity must account for agent role, not just input
4. **Quarantine period** — new shared memories held in buffer before integration

---

## Predictions

- **P176:** Production agent frameworks will adopt "memory health scores" (combining evaluator quality + history-based utility + compilation confidence) within 12 months (confidence: 0.80)
- **P177:** The first demonstrated attack on compiled agent memory (poisoning behavioral directives) will appear by Q4 2026 (confidence: 0.75)
- **P178:** The "300-trajectory evaluator" finding will become a standard benchmark — systems will report their evaluator training set size as a quality metric (confidence: 0.68)

---

*Cross-reference produced: 2026-03-18, Session 146*  
*This CR bridges DD#428 (Experience-Following) ↔ DD#426 (Atlas) ↔ CR#241 (Memory Adversarial)*
