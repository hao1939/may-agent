# DeltaLogic: Belief Revision Failures in Logical Reasoning (arXiv:2604.02733)

**Source**: arXiv cs.AI (April 3, 2026), ICLR 2026 Workshop  
**Author**: Amit Dhanda  
**Status**: Fresh discovery — not yet in existing library

---

## Core Problem: Belief Revision ≠ Logical Competence

Standard benchmarks test whether models derive correct answers from **fixed premises**. But real-world agents operate in **dynamic environments** where evidence changes minimally over time.

**DeltaLogic** tests: Can models revise beliefs when premises undergo minimal edits?

## Benchmark Design

Each episode:
1. **Initial conclusion**: Given premises P, derive conclusion
2. **Minimal edit**: Apply δ(P) — smallest possible evidence change
3. **Revision question**: Should conclusion remain stable or be revised?

Instantiated from FOLIO and ProofWriter (established logical reasoning datasets).

## Shocking Results

| Model | Initial Accuracy | Revision Accuracy | Inertia (stick to old belief) |
|-------|-----------------|-------------------|------------------------------|
| Qwen3-1.7B | 0.667 | 0.467 | 0.600 (when should change) |
| Qwen3-4B | 0.650 | 0.450 | 0.600 (when should change) |
| Qwen3-0.6B | Near universal abstention | — | — |
| Phi-4-mini-instruct | 0.950 | 0.850 | Non-trivial abstention |

### Key Findings

- **Strong initial reasoning does NOT imply strong revision behavior**
- Qwen3-4B's pattern is identical to 1.7B — scaling doesn't fix this
- **Inertia problem**: Models stick to previous conclusions even when evidence changes
- Phi-4 performs better but still shows instability

## What is "Inertia"?

Inertia = tendency to maintain previous conclusion despite evidence change

When gold label should change (premise edit requires different conclusion):
- Qwen models: 60% inertia (wrongly stick to old answer)
- This is a systematic failure mode, not random error

## Implications for Multi-Agent Systems

### 1. Shared State Updates Are Risky
When agents share evolving knowledge bases, belief revision failures compound:
- Agent A concludes X based on evidence E
- Evidence updates to E' 
- Agent A may stick to X despite E' suggesting Y
- Other agents trusting A's conclusion propagate error

### 2. Our Bulletin System Design
Current file-based coordination may actually **help**:
- Each agent reads current state fresh (no cached beliefs)
- Less susceptible to inertia from previous conclusions
- But: agents may still fail to revise when their own outputs change

### 3. Verification Layer Needed
DeltaLogic suggests we need explicit belief-revision verification:
- When evidence changes, explicitly check prior conclusions
- Don't assume models will auto-revise
- Cross-agent contradiction detection becomes critical

## Recommendations for Our System

1. **Evidence versioning**: Track what evidence led to what conclusion
2. **Revision triggers**: When new evidence arrives, flag conclusions for re-evaluation
3. **Cross-checking**: Multiple agents should independently verify conclusions, not trust cached beliefs
4. **Abstention handling**: Models may abstain when uncertain — design fallback chains

## Connection to Existing Research

- **AutoVerifier** (arXiv:2604.02617): Cross-source contradiction detection directly addresses belief revision failures
- **Role Clarity** (arXiv:2604.02770): Agents maintaining consistent roles may reduce revision complexity
- **Neuro-Symbolic Dual Memory** (arXiv:2604.02734): Symbolic feasibility memory provides explicit revision checkpoints

---

**Tags**: #logical-reasoning #belief-revision #multi-agent #knowledge-updates #inertia
