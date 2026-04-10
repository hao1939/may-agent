# Deep Dive: Co-Sight — Conflict-Aware Meta-Verification for LLM Agent Reasoning

**Paper**: Co-Sight: Enhancing LLM-Based Agents via Collaborative Multi-Model Perception and Conflict-Aware Meta-Verification  
**arXiv**: 2510.21557  
**Date**: October 2025 (v4 updated January 2026)  
**Authors**: Yiming Zhang, Sheng Liu, Yaosen Min, Yi Di, Xuejun Zhang  
**Rating**: ★★★★★  
**DD#**: 724  
**Fills KE-105 Gap**: Verification of verifiers

---

## Core Contribution

Co-Sight introduces **Collaborative Multi-Model Perception (CMP)** and **Conflict-Aware Meta-Verification (CAMV)** — a two-stage architecture where:
1. **Stage 1 (CMP)**: Multiple perception models (vision, OCR, structured extraction) process raw observations in parallel, producing structured perception reports
2. **Stage 2 (CAMV)**: A meta-verification layer detects conflicts between perception reports and resolves them through targeted re-verification before they propagate to reasoning

**Key result**: GAIA benchmark SOTA 84.4% (up from previous SOTA, surpassing Manus 65.8% and HuggingFace Open DeepResearch 62.57%). The system uses **trustworthy reasoning** — the agent tracks confidence per information source and downgrades signals from perception channels that show inter-model disagreement.

---

## Why This Matters for KE-105 Gap: "Verification of Verifiers"

KE-105 identified a critical gap: **"Who checks the sentinels?"** — the verification orchestration stack (DSL compilation → budget allocation → runtime enforcement → verification mechanisms) has no self-verification mechanism. If a verifier produces wrong outputs, nothing catches it.

Co-Sight directly addresses this:

### 1. Conflict as Verification Signal
Instead of trusting any single verifier, Co-Sight treats **inter-verifier disagreement** as a first-class signal. When two perception models disagree on the same observation, this triggers meta-verification — a higher-order check that examines the disagreement itself, not just the individual outputs.

**Our mapping**: In KE-105's sentinel architecture (DD-703), individual sentinels check requests at boundaries. But if Sentinel A approves and Sentinel B would reject the same request, nobody knows. Co-Sight's approach: run overlapping sentinel coverage and treat disagreement as a trigger for deeper inspection.

### 2. Confidence-Weighted Signal Propagation
Each perception channel has a running confidence score that updates based on verification history. Channels that have been wrong before get lower weight. This is **adaptive signal calibration** — another KE-105 gap ("Signal calibration: DSL audits decisions given scores, not score accuracy").

**Our mapping**: Instead of treating all verification signals equally, weight them by their track record. A commit guard dimension that has been overridden by Hao 3 times should have lower confidence than one that's never been challenged.

### 3. Targeted Re-Verification
CAMV doesn't just flag conflicts — it launches targeted re-verification on the specific conflicting information. This is resource-efficient: only the uncertain parts get re-checked, not the entire input.

**Our mapping**: When KE-104 Layer 1 (evidence grounding) produces a claim that conflicts with Layer 2 (consistency checking), instead of re-running full verification, target the specific conflict for deeper analysis.

---

## Architecture Details

```
Raw Observation
    ├── Perception Model A → Report A
    ├── Perception Model B → Report B  
    └── Perception Model C → Report C
         ↓
    Conflict Detection (pairwise comparison)
         ↓
    [No conflict] → Merge reports → Reasoning
    [Conflict detected] → CAMV triggers:
         ├── Identify specific conflicting facts
         ├── Request targeted re-observation  
         ├── Update confidence weights
         └── Resolve conflict → Verified report → Reasoning
```

### Trustworthy Reasoning Engine
After CAMV, the reasoning engine receives:
- Verified perceptions with confidence scores
- Conflict history (which sources disagreed on what)
- Resolution decisions (how conflicts were resolved)

The reasoning can then:
- Hedge on low-confidence information
- Request additional verification for critical decisions
- Track which information pathways are reliable for this task type

---

## Key Numbers

| Metric | Value | Context |
|--------|-------|---------|
| GAIA Score | 84.4% | SOTA, up from Manus 65.8% |
| Conflict Detection Rate | Not reported | But CAMV fires on ~15-20% of observations (estimated from examples) |
| Re-verification Cost | ~2× per conflicting observation | But only on conflicts, not all observations |

---

## Limitations

1. **Perception-focused**: The paper targets perception (vision, OCR) disagreements. Extending to reasoning-level verification conflicts is non-trivial — reasoning disagreements are higher-dimensional than factual perception disagreements.
2. **No calibration analysis**: The confidence weights update heuristically, not via formal calibration. How well-calibrated the resulting scores are is unknown.
3. **Pairwise conflict detection**: Scales as O(n²) in number of perception models. For our sentinel architecture with many verifiers, this could be expensive.
4. **GAIA benchmark saturation**: 84.4% on GAIA is impressive but GAIA may be reaching saturation for top systems, making marginal improvements hard to interpret.

---

## Actionable Patterns for Our System

### Pattern 1: Disagreement-Triggered Meta-Verification
**What**: Run overlapping verification (≥2 independent checks on the same claim). When they disagree, trigger a meta-verification layer that examines the disagreement itself.
**Where**: Commit guard dimensions that overlap (e.g., "code correctness" and "test coverage" can both flag the same issue). If they disagree, launch deeper analysis.
**Cost**: Higher per-claim verification cost (~2×), but only on disagreements. If disagreement rate is 15-20%, total overhead is ~1.3-1.4× compared to single-check.

### Pattern 2: Running Confidence Scores per Verifier
**What**: Track each verification dimension's accuracy over time. Weight recent verdicts by historical reliability.
**Where**: If our commit guard has 5 dimensions, track how often each dimension's verdict aligns with eventual production outcome. Discount dimensions that are frequently wrong.
**Prerequisite**: Need production feedback loop (which EXP-109 and CR-326 are building toward).

### Pattern 3: Conflict History as Training Signal
**What**: Log all inter-verifier conflicts and their resolutions. These are the highest-information examples for improving verifiers.
**Where**: When two evaluation criteria disagree on a commit, the resolution (accept/reject + production outcome) is the most informative training data point.

---

## Cross-References

- **KE-105** (Verification Orchestration Stack): Fills "verification of verifiers" gap directly
- **KE-104** (Verification Architecture): CAMV provides the missing meta-layer above evidence grounding
- **CR-329** (Evaluation Architecture): Conflict-aware verification complements checkpoint decomposition
- **DD-701** (Semantic Router DSL): DSL policies could include conflict-resolution rules
- **DD-703** (Sentinel Agents): Sentinels with overlapping coverage + CAMV = self-verifying sentinel network
- **AceMAD (2603.06801)**: Second-order cognition (peer prediction) is formally related — CAMV's conflict detection is a simpler version of AceMAD's Brier Score mechanism

---

## Rating Justification: ★★★★★

1. **Directly fills KE-105 gap**: "Verification of verifiers" is addressed with a concrete, implementable architecture
2. **SOTA results**: 84.4% GAIA demonstrates the approach works at scale
3. **Composable with our stack**: CAMV can be layered on top of any verification architecture without replacing it
4. **Multiple actionable patterns**: Disagreement-triggered meta-verification, running confidence scores, conflict history as training signal
5. **Connects existing knowledge**: Links Co-Sight's meta-verification to AceMAD's peer prediction and DSL compilation

---

*Scout DD#724 | 2026-04-10 | Session 577 | CR#324 gap filling*
