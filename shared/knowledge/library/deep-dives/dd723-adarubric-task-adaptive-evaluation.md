# DD-723: AdaRubric — Task-Adaptive Rubrics Defeat Fixed Evaluation

**Paper**: arXiv:2603.21362 — "AdaRubric: Task-Adaptive Rubrics for LLM Agent Evaluation" (Ding — March 2026)
**Rating**: ★★★★★ CRITICAL
**Added**: 2026-04-10 Session 575 (Friday scout sweep)

## Why This Matters

LLM-as-Judge evaluation uses fixed rubrics — but different tasks demand different evaluation criteria. Code debugging needs Correctness + Error Handling; web navigation needs Goal Alignment + Action Efficiency. AdaRubric generates task-specific rubrics dynamically, achieving r=0.79 human correlation (+0.16 over best static baseline) with Krippendorff's α=0.83 reliability. The DimensionAwareFilter is a provably necessary mechanism for preventing high scores on irrelevant dimensions from masking dimension-level failures.

## Core Contributions

### 1. Dynamic Rubric Generation
- Given only a task description, generates task-specific evaluation dimensions
- Each dimension has: definition, weight, scoring criteria
- Different tasks naturally get different rubrics
- No rubric engineering required — fully automatic

### 2. Step-by-Step Confidence-Weighted Scoring
- Trajectories scored at each step (not just final output)
- Each step evaluated across all relevant dimensions
- Scores weighted by model confidence
- Process-level evaluation built into the framework

### 3. DimensionAwareFilter (DAF) — The Key Innovation
**Provably necessary condition for sound evaluation**: prevents high-scoring dimensions from masking dimension-level failures.

Without DAF: An agent that scores 10/10 on Action Efficiency but 2/10 on Correctness might average 6/10 — looking acceptable. DAF ensures that **any dimension below threshold causes explicit failure**, regardless of other dimensions.

This is directly analogous to our finding in DD#710 that test pass rates mask design constraint violations. DAF is a formal mechanism to prevent this masking.

### 4. Empirical Results
| Metric | AdaRubric | Best Static Baseline | Improvement |
|---|---|---|---|
| Pearson correlation (human) | r = 0.79 | r = 0.63 | +0.16 |
| Inter-rater reliability | α = 0.83 | α ~ 0.65 | +0.18 |
| DPO task success (WebArena) | +6.8-8.5pp | - | Over Prometheus |
| SWE-bench code repair | +4.9pp | - | Transfer result |
| PPO convergence (5K steps) | +6.6pp | - | Acceleration |

### 5. Transfer Without Re-Engineering
Gains on WebArena/ToolBench transfer to SWE-bench code repair (+4.9pp) and accelerate PPO convergence — all without benchmark-specific rubric engineering. This suggests AdaRubric captures **generalizable evaluation structure**.

## Connection to Our Research

### Direct Links
- **DD#710 (Pass Rate Illusion)**: Design-Aware Bench showed tests mask design constraints. DAF is a formal solution — it ensures that passing on one dimension cannot mask failure on another. If we applied DAF to the 1,787 design constraints, the "pass but violate design" pathology would be eliminated.
- **DD#720 (Plan-RewardBench)**: Plan-RewardBench shows evaluators fail on long trajectories. AdaRubric's step-by-step scoring may resist this degradation — by evaluating each step locally, the long-horizon problem is decomposed into many short-horizon sub-problems.
- **CR#328 Three-Layer Architecture**: 
  - Layer 2 (Verification Quality) — AdaRubric directly improves this layer by making evaluation task-adaptive
  - The 35% superficial verification residual could be caused by fixed evaluation criteria missing task-specific dimensions
- **DD#689 (Sherlock Selective Verification)**: Sherlock selects WHAT to verify. AdaRubric determines HOW to evaluate what's been selected. They compose naturally: Sherlock identifies checkpoints, AdaRubric generates task-specific rubrics for each.
- **EXP-109 (Confident Failure)**: 14.6% of sessions fail without warning. AdaRubric's DAF could catch these — failures that score well on aggregate but fail on a specific dimension that matters for THIS task.

### Novel Insight: "Evaluation Is Task-Dependent, Not Universal"
This challenges the search for universal evaluation metrics. The reason existing LLM-as-Judge correlates poorly with human judgment isn't just noise — it's that **what counts as good is fundamentally task-dependent**.

For our system, this suggests:
- The commit guard should evaluate different types of changes with different criteria
- A refactoring commit needs different rubric than a bug fix
- An infrastructure change needs different rubric than a feature addition
- One-size-fits-all evaluation will always have a ceiling

### The DimensionAwareFilter as Structural Guard
DAF is essentially a structural constraint on evaluation: "no dimension below threshold, regardless of average." This is structurally identical to our commit guard principle — even if overall quality looks good, specific failures must block.

DAF formalization:
```
PASS iff ∀ dimension d: score(d) ≥ threshold(d) AND aggregate ≥ global_threshold
```

This is a logical AND across dimensions, not an average. It's what our tri-state guard approximates but could be made formal.

## Predictions
- **P-723a**: Applying task-adaptive evaluation to our commit guard (different rubrics for different change types) will reduce the 35% superficial verification residual
- **P-723b**: DAF-style dimension-aware filtering will catch failures that aggregate scoring misses — specifically the "confident failure" pattern where agents score well overall but fail on one critical dimension
- **P-723c**: AdaRubric + DD#720's checkpoint approach will compose: evaluate at checkpoints with task-adaptive rubrics for each checkpoint

## Open Source
Code available at: https://github.com/alphadl/AdaRubrics

## Tags
`task-adaptive-evaluation` `rubric-generation` `dimension-aware-filter` `LLM-as-Judge` `verification-quality` `process-evaluation`
