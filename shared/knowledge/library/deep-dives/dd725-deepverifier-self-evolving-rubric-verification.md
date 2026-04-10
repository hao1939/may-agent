# Deep Dive: DeepVerifier — Inference-Time Scaling of Verification via Self-Evolving Rubric-Based Reasoning

**Paper**: Inference-Time Scaling of Verification: Self-Evolving Rubric-Based Reasoning  
**arXiv**: 2601.15808  
**Date**: January 2026  
**Authors**: Yongqi Tong et al. (Peking University)  
**Rating**: ★★★★★  
**DD#**: 725  
**Fills KE-105 Gap**: Signal calibration

---

## Core Contribution

DeepVerifier addresses the fundamental question: **how do you make verification itself scale at inference time?** Instead of simply asking an LLM "is this correct?", DeepVerifier:

1. **Constructs a DRA Failure Taxonomy** — 5 major categories, 13 sub-categories of reasoning errors (logical flaws, calculation errors, conceptual misunderstandings, incomplete analysis, false assumptions)
2. **Generates rubric-guided verification criteria** specific to each problem, derived from the taxonomy
3. **Performs self-evolving verification** — iteratively refines its verification rubrics based on consistency checking across multiple reasoning paths

**Key result**: Outperforms standard LLM-as-Judge by **12-48%** on verification accuracy across multiple benchmarks. The rubric-based approach provides **interpretable, decomposed verification** — each judgment is traceable to specific failure categories and rubric criteria.

---

## Why This Matters for KE-105 Gap: "Signal Calibration"

KE-105's gap analysis states: *"DSL audits decisions given scores, not score accuracy. A miscalibrated signal produces clean traces leading to wrong decisions."*

This is exactly what DeepVerifier fixes:

### 1. Rubric as Calibration Anchor
Instead of a single holistic score (which can be miscalibrated), DeepVerifier decomposes verification into rubric dimensions. Each dimension has an explicit criterion and a defined failure mode. The score is an **aggregation** of interpretable sub-scores, not a black-box number.

**Our mapping**: Currently, when KE-104's evidence grounding layer produces a "verification score" of 0.85, we don't know what that means — is it 0.85 because everything is slightly uncertain, or because one dimension is 0.0 and others are 1.0? DeepVerifier's rubric-based approach decomposes this, making the score semantically meaningful.

### 2. Failure Taxonomy as Prior
The DRA taxonomy (5 categories × 13 sub-categories) provides a **structured prior** over failure modes. Instead of asking "is this right?", verification becomes "which of these 13 specific failure modes are present?"

**Our mapping**: For our commit guard, instead of "is this a good commit?", the taxonomy approach would ask: "Does this commit have: (a) logical errors in business logic? (b) regression in existing tests? (c) incomplete implementation of task requirements? (d) misunderstanding of the codebase architecture? (e) false assumption about API behavior?" Each question is independently calibratable.

### 3. Self-Evolving Rubrics
The rubrics aren't fixed — they evolve based on the specific problem. For math problems, calculation-error rubrics get expanded. For code problems, logical-flaw rubrics get expanded. This is **task-adaptive verification**, directly connecting to DD-723's (AdaRubric) adaptive rubric insight.

**Our mapping**: Verification criteria for a bug-fix commit should differ from a refactoring commit. DeepVerifier's self-evolving mechanism automatically adjusts which failure categories to emphasize.

---

## Architecture Details

```
Problem + Candidate Solution
    ↓
DRA Failure Taxonomy (13 sub-categories)
    ↓
Task-Specific Rubric Generation
    ├── Select relevant failure categories
    ├── Generate specific criteria per category
    └── Weight criteria by task type
    ↓
Multi-Path Verification
    ├── Path 1: Check via rubric dimension A
    ├── Path 2: Check via rubric dimension B
    └── Path N: Check via rubric dimension N
    ↓
Consistency Checking (cross-path)
    ├── [Consistent] → Aggregate verified score
    └── [Inconsistent] → Self-Evolve rubrics
         ├── Refine inconsistent criteria
         ├── Add missing failure categories
         └── Re-verify with evolved rubrics
    ↓
Final Verification Verdict + Interpretable Report
```

### The Self-Evolution Loop
When multi-path verification produces inconsistent verdicts:
1. The inconsistency is **diagnosed** — which rubric dimension caused the disagreement?
2. The rubric is **refined** — the ambiguous criterion is made more specific
3. Verification is **re-run** with the refined rubric
4. Process repeats until consistency or budget exhaustion

This is inference-time compute scaling applied to verification — more compute → better rubrics → more reliable verification. The key insight: **the rubric itself is the bottleneck**, not the verification process.

---

## Key Numbers

| Metric | Value | Context |
|--------|-------|---------|
| Improvement over LLM-as-Judge | +12-48% | Across multiple math/code reasoning benchmarks |
| DRA Taxonomy | 5 categories, 13 sub-categories | Comprehensive failure mode decomposition |
| Rubric Evolution Iterations | 2-4 typically | Convergence is fast when criteria are well-specified |
| Interpretability | Each verdict traceable to specific failure category | vs. black-box "correct/incorrect" from standard judges |

---

## Limitations

1. **Compute cost**: Self-evolving rubrics require multiple verification passes. For our commit guard, this might add 2-4× latency per evaluation.
2. **Taxonomy transferability**: The DRA taxonomy was developed for reasoning tasks. Adapting it to agent task evaluation (code commits, research synthesis) requires domain-specific taxonomy development.
3. **No formal calibration guarantee**: While decomposed verification is MORE calibrated than holistic scoring, the paper doesn't prove formal calibration properties (e.g., "a rubric score of 0.8 means 80% probability of correctness").
4. **Single-domain validation**: Primarily tested on math and code reasoning benchmarks. Production agent evaluation (multi-step, multi-tool, real-world effects) is a different regime.

---

## Actionable Patterns for Our System

### Pattern 1: Failure Taxonomy for Commit Guard
**What**: Develop a DRA-style failure taxonomy for agent commits: (a) logic errors, (b) regression risk, (c) incomplete implementation, (d) architecture misunderstanding, (e) API assumption errors, (f) test adequacy, (g) documentation sync.
**Where**: Extend current commit guard evaluation dimensions.
**Impact**: Each guard verdict becomes interpretable and independently calibratable.

### Pattern 2: Task-Adaptive Verification Rubrics
**What**: Generate different verification rubrics for different commit types (bug-fix, refactor, feature, configuration change).
**Where**: Pre-verification classification → rubric selection → dimension-specific verification.
**Impact**: Addresses DD-723 (AdaRubric) finding that fixed rubrics miss task-specific failure dimensions.

### Pattern 3: Inference-Time Verification Scaling
**What**: When verification is uncertain (low confidence or inter-dimension disagreement), invest more compute in refining the rubric rather than re-running the same check.
**Where**: Commit guard budget allocation. Instead of "always spend X on verification", spend more on uncertain cases by evolving rubrics.
**Impact**: Connects to DD-702 (DOVA) deliberation-first budget allocation.

---

## Cross-References

- **KE-105** (Verification Orchestration Stack): Fills "signal calibration" gap — rubric-based verification makes signals interpretable and decomposed
- **DD-723** (AdaRubric): DeepVerifier's self-evolving rubrics are a mechanism to achieve task-adaptive evaluation
- **DD-720** (Plan-RewardBench): Rubric-based decomposition could address horizon-length degradation — each checkpoint gets its own rubric
- **CR-329** (Evaluation Architecture): DeepVerifier slots into Layer 3 (Adaptive Rubric Generation) of the evaluation stack
- **DD-702** (DOVA): Budget allocation for verification depth connects to DeepVerifier's inference-time scaling
- **DD-724** (Co-Sight, this batch): Cross-path consistency checking is formally similar to CAMV's conflict detection

---

## Synthesis: DeepVerifier × Co-Sight

DD-724 (Co-Sight) provides **inter-verifier** conflict detection; DD-725 (DeepVerifier) provides **intra-verifier** self-consistency checking via rubric evolution. Together they cover both axes:

| Dimension | Co-Sight (DD-724) | DeepVerifier (DD-725) |
|-----------|-------------------|----------------------|
| Conflict type | Between different verifiers | Between rubric dimensions within one verifier |
| Resolution | Meta-verification + confidence update | Rubric refinement + re-verification |
| Signal | Disagreement between parallel checks | Inconsistency within structured evaluation |
| Gap filled | Verification of verifiers | Signal calibration |

---

## Rating Justification: ★★★★★

1. **Directly fills KE-105 gap**: Signal calibration addressed through rubric decomposition and interpretable verification
2. **Strong empirical results**: 12-48% improvement over standard LLM-as-Judge is substantial
3. **Composable with our stack**: Rubric-based verification can replace or augment current holistic evaluation at any layer
4. **Self-evolving mechanism**: The rubric evolution addresses the cold-start problem for new task types (another KE-105 gap)
5. **Connects multiple threads**: Links AdaRubric, DOVA budget allocation, checkpoint decomposition, and Co-Sight conflict detection

---

*Scout DD#725 | 2026-04-10 | Session 577 | CR#324 gap filling*
