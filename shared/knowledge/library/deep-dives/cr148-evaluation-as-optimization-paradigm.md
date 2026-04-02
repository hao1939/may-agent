# Cross-Reference #148: The Evaluation-as-Optimization Paradigm

## Pattern: From Passive Metrics to Active Improvement

Three recent papers reveal a convergent evolution from passive evaluation to evaluation-driven optimization:

| Paper | Evaluation Innovation | Optimization Mechanism |
|---|---|---|
| **CRYSTAL** (DD#304) | Step-level Match F1 / Ordered Match F1 | CPR multiplicative reward → GRPO training |
| **BiCC** (DD#305) | Bilateral context as evaluation context | Contrastive conditioning → reduced gradient variance |
| **VQQA** (DD#306) | Decomposed QA diagnostic scoring | Semantic gradients → prompt optimization |

## The Unified Pattern

All three papers independently discover the same meta-principle:

```
Decomposed Evaluation → Structured Diagnosis → Targeted Optimization
```

### Level 1: Decompose, Don't Aggregate
- CRYSTAL: evaluate each reasoning **step**, not just final answer
- VQQA: generate targeted **questions** about specific quality dimensions
- BiCC: show the model what **wrong** looks like alongside what's right

### Level 2: Use Evaluation as Signal, Not Just Score
- CRYSTAL: step-level quality becomes the **reward signal** for GRPO training
- VQQA: low-scoring QA pairs become **semantic gradients** for prompt refinement
- BiCC: wrong-answer traces become **bilateral context** for conditioning

### Level 3: Prevent Drift via Global Anchoring
- CRYSTAL: multiplicative coupling of answer × reasoning quality (wrong answer kills reward)
- VQQA: Global Selection rater evaluates against **original** prompt (prevents semantic drift)
- BiCC: RCC (Reward-Confidence Correction) prevents **gradient variance** from destabilizing

## The Cherry-Picking / Gestalt Alignment Duality

Two complementary failure modes emerge:
1. **Cherry-picking** (CRYSTAL): models get some steps right but skip others → high precision, low recall
2. **Gestalt misalignment** (VQQA): local QA scores aggregate poorly into global quality → need separate holistic evaluation

These are **dual problems**: cherry-picking is about missing micro-level detail, gestalt misalignment is about missing macro-level coherence. Complete evaluation requires **both** decomposed metrics AND holistic assessment.

## Multi-Agent System Implications

For our multi-agent architecture:
- **Agent-level evaluation** should be decomposed (like VQQA's QA questions or CRYSTAL's step metrics)
- **System-level evaluation** requires a separate holistic rater (like VQQA's Global Selection)
- **Training signal** should use evaluation diagnostics as gradients (like all three papers)
- **Anti-drift mechanisms** are essential at every level (multiplicative coupling, global selection, RCC)

## New GUS Principle Candidate
> "Evaluation becomes optimization when it decomposes quality into diagnostic signals that serve as gradients for targeted improvement, while maintaining global coherence through holistic anchoring."

## Connected Deep-Dives
- DD#304 (CRYSTAL), DD#305 (BiCC), DD#306 (VQQA)
- DD#291 (ReBalance), DD#293 (CoMAM), DD#300 (AVR Routing)
- CR#147 (Reasoning Training Triad)
