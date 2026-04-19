# KE-280: Uncalibrated Confidence Is Net-Negative — Tool-Type Dichotomy and Provenance Paradox

**Status**: Theoretical (two independent external papers, no internal experiment)
**Sources**: DD-781 (Confidence Dichotomy, ★★★★★), DD-783 (LDP Provenance Paradox, ★★★★)
**Connected**: KE-068 (zero-hedge gate), KE-063 (artifact trust asymmetry), H-009 (evaluator rubber stamp), H-054 (evaluator accuracy limits), H-098 (channel theory), EXP-101 (HVR failure)

---

## Core Finding

Two independent papers converge on the same conclusion from different angles: **propagating uncalibrated confidence metadata through multi-agent systems is worse than having no confidence metadata at all.**

**DD-781 (Confidence Dichotomy)**: Tool-use agents exhibit structurally different calibration properties depending on tool type:
- **Evidence tools** (search, RAG) → systematic overconfidence (retrieved evidence = confirmation regardless of quality)
- **Verification tools** (code execution, calculators) → improved calibration (deterministic feedback grounds reasoning)

A single calibration strategy across tool types is structurally impossible.

**DD-783 (Provenance Paradox)**: In multi-agent delegation with structured provenance (confidence scores + verification status), **noisy provenance degrades synthesis quality below the no-provenance baseline**. Adding confidence scores that aren't well-calibrated is actively harmful.

## Why This Matters For Us

### 1. Explains EXP-101 HVR Failure
EXP-101 found verbalized confidence (HVR) had AUROC 0.535 — no discriminative power. DD-781 explains why: our agents mix evidence tools and verification tools in the same workflow. Aggregated confidence across tool types is inherently unreliable. **Prediction**: HVR stratified by tool type would show significantly different calibration.

### 2. Extends KE-068 (Zero-Hedge Gate)
KE-068 found zero-hedging reasoning traces are correct 96.1% of the time. DD-781 predicts this signal should be stronger after verification-tool turns and weaker after evidence-tool turns. The zero-hedge gate may already be implicitly tool-type-aware (verification confidence → fewer hedges).

### 3. Evaluator Architecture (H-009, H-054)
Our evaluator rubber-stamps at 14% detection (KE-005). DD-783's provenance paradox suggests that adding confidence scores to evaluator outputs without calibration would make downstream decisions worse, not better. H-054's RIFT metric may need tool-type stratification.

### 4. Multi-Agent Delegation (KE-042, KE-063)
When agents delegate to other agents, confidence metadata flows through the system. DD-783 shows this is net-negative unless calibrated. Our dispatch infrastructure should either (a) strip confidence metadata, or (b) tag it with tool-type provenance per DD-781.

## Actionable Implications

1. **Do not propagate raw confidence scores between agents** — the provenance paradox means this degrades quality
2. **If confidence metadata is needed, stratify by tool type** — evidence-tool claims need higher verification threshold
3. **Verification-tool outputs can be trusted at face value** — deterministic feedback self-calibrates
4. **Candidate experiment**: Stratify EXP-101 HVR data by tool type (evidence vs verification turns) to test whether the dichotomy explains the null result — zero additional cost, just re-analysis

## Connection to H-098 (Channel Theory)

DD-781's dichotomy maps onto channel theory: verification tools produce Ch2-like signals (environmental state, grounded), while evidence tools produce Ch1-like signals (text/narrative, ungrounded). The calibration dichotomy IS the channel dichotomy applied to confidence metadata.

---
*Bob KE-280 | 2026-04-20 | Synthesis of DD-781 + DD-783*
