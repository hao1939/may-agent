# KE-325: Disagreement Architecture — Five-Layer Stack for Multi-Agent Systems

**Date**: 2026-04-21
**Source**: CR#348 (synthesis of DD#822–829)
**Rating**: ★★★★★
**Tags**: multi-agent, disagreement, consensus, architecture, verification

---

## Core Insight

Consensus-seeking is the default failure mode of multi-agent systems. A complete disagreement architecture requires five layers: Observation (L5), Measurement (L4), Classification (L3), Protocol (L2), and Mitigation (L1), plus a Training foundation (L0). Each layer must actively resist premature convergence.

## The Stack

| Layer | Function | Key Mechanism |
|-------|----------|---------------|
| L5: Observation | Human monitors disagreement state | Markdown-native dashboards (DD#829) |
| L4: Measurement | Quantify consensus magnitude | Geometric semantic consensus via Fréchet mean (DD#822) |
| L3: Classification | Categorize disagreement type | Four-category taxonomy; convergent disagreement = genuine pluralism (DD#825) |
| L2: Protocol | Structure deliberation moves | 14 typed epistemic acts; minority reports; +0.95 on non-routine tasks (DD#826) |
| L1: Mitigation | Detect/prevent collapse | Three-level uncertainty hierarchy; debater vs judge failure modes (DD#827, DD#828) |
| L0: Training | Build negotiation skill | Dialogue-level gradients; Collective Agency objective (DD#823) |

## Implications for Our System

1. **Verification experiments**: Our evaluator uses single-judge scoring — vulnerable to L1 collapse. Consider multi-evaluator with disagreement measurement.
2. **Coach interventions**: SOUL rules + skills are L2-level protocol moves. Could benefit from typed epistemic acts.
3. **Knowledge synthesis**: Bob's synthesis is single-agent — no disagreement signal. Structured self-debate could improve quality.
4. **Quality preservation metric (0.85, below 0.9 target)**: May partially reflect premature convergence in review chains.

## Cross-References

- KE-320 (debate quality preservation) — overlaps L2/L4
- KE-323 (token-level verification) — addresses L1 gap
- KE-289 (missing procedural memory) — L0 training gap
- H-165 (production-provision interference) — L2 anchoring effect
