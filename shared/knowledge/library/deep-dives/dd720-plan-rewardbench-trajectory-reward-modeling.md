# DD-720: Plan-RewardBench — Trajectory-Level Reward Modeling Benchmark

**Paper**: arXiv:2604.08178 — "Aligning Agents via Planning: A Benchmark for Trajectory-Level Reward Modeling" (Wang, Hu, Yang, Pan, Li, Guo — ACL 2026 Main Conference)
**Rating**: ★★★★★ CRITICAL
**Added**: 2026-04-10 Session 575 (Friday scout sweep)

## Why This Matters

Current reward models (RMs) were designed for single-turn RLHF. As agents make sequential decisions over long trajectories with tool use, existing RMs cannot distinguish good trajectories from subtly wrong ones. Plan-RewardBench is the **first benchmark specifically designed to test whether evaluators can judge complete agent trajectories** — and the results show they cannot do it well, especially as horizon length grows.

## Core Contributions

### 1. Four Task Families Exposing Distinct Failure Modes
- **Safety Refusal**: Should agent refuse or proceed? Tests whether evaluators detect appropriate boundary enforcement
- **Tool-Irrelevance/Unavailability**: Agent must recognize when tools won't help — tests restraint judgment
- **Complex Planning**: Multi-step tool orchestration — tests whether process quality matters beyond outcome
- **Robust Error Recovery**: Agent encounters failures mid-trajectory — tests recovery vs. collapse detection

### 2. Hard Negative Construction (3 Methods)
- **Multi-model natural rollouts**: Different LLMs generate trajectories for same task; naturally produces plausible-but-wrong alternatives
- **Rule-based perturbations**: Systematic injection of specific error types into valid trajectories
- **Minimal-edit LLM perturbations**: Adversarially smallest changes that flip trajectory quality

### 3. Key Finding: Horizon-Length Degradation
**All three evaluator families (generative, discriminative, LLM-as-Judge) degrade sharply on long-horizon trajectories.**

This is the most critical finding:
- Short trajectories (2-5 steps): Reasonable discrimination accuracy
- Medium trajectories (6-15 steps): Noticeable degradation
- Long trajectories (16+ steps): Near-random performance

This directly explains why **production agents fail confidently** (DD#717/718) — the internal evaluation mechanisms that work for short tasks break down at production-relevant complexity levels.

### 4. Unified Pairwise Protocol
All evaluator types tested on identical pairwise comparisons (preferred vs. distractor trajectory), enabling apples-to-apples comparison across paradigms.

## Connection to Our Research

### Direct Links
- **EXP-109 Confident Failure**: 14.6% of production sessions fail without warning signals. Plan-RewardBench shows WHY — reward models can't discriminate at production-relevant trajectory lengths. The evaluation mechanism that should catch failures has the same blind spot.
- **DD#717 HTC Calibration**: HTC extracts trajectory-level features for calibration. Plan-RewardBench shows the ground truth problem — even with features, the signal-to-noise ratio degrades with length.
- **DD#718 Silent Failures**: IBM found 5 types of silent failures detectable from trajectory features. Plan-RewardBench shows the EVALUATION side — judges fail to detect these same patterns.
- **CR#326 Gym-Production Gap**: Short-horizon gym tasks inflate evaluator accuracy. Production trajectories are long-horizon where evaluators fail. This IS the gym-production transfer gap applied to evaluation itself.
- **CR#328 Three-Layer Failure Architecture**: Plan-RewardBench provides evidence that Layer 2 (Verification Quality) is fundamentally limited by trajectory length.

### Novel Insight: "Evaluation Gap Compounds with Agent Gap"
The gym-production gap isn't just about agents performing differently — it's about evaluators failing to detect the difference. Short gym tasks are easy for both agents AND evaluators, creating a double illusion:
1. Agent appears to work well (short task is easy)
2. Evaluator confirms it works well (short trajectory is easy to judge)

In production, both fail simultaneously: agent struggles with complex task AND evaluator can't tell it's struggling.

## Key Metrics & Evidence

| Evaluator Type | Short Trajectory Accuracy | Long Trajectory Accuracy | Degradation |
|---|---|---|---|
| Generative RM | ~78% | ~55% | -23pp |
| Discriminative RM | ~82% | ~58% | -24pp |
| LLM-as-Judge | ~75% | ~52% | -23pp |

(Approximate values from paper figures — exact numbers vary by specific model)

## Implications

1. **Process-level verification (DD#698-700) must be length-aware**: Verification mechanisms need different strategies for different trajectory lengths
2. **Checkpoint-based evaluation** may be necessary: Rather than judging entire trajectory, evaluate at intermediate checkpoints where local context is manageable
3. **Trajectory monitoring (DD#718 approach) is complementary**: Feature-based detection (not LLM judgment) may scale better with length
4. **Anti-saturation for evaluators**: Just as benchmarks saturate for agents (DD#712), evaluation benchmarks need complexity scaling

## Predictions

- **P-720a**: Combining trajectory-feature-based detection (DD#718) with LLM-judge evaluation at checkpoints will outperform either alone
- **P-720b**: The horizon-length degradation curve will match the "capability cliff" pattern (UI-CUBE) — not gradual but threshold-like
- **P-720c**: Our production trajectory data (19K evals) will show the same pattern — guard effectiveness degrades with session length

## Tags
`trajectory-evaluation` `reward-modeling` `horizon-length` `gym-production-gap` `confident-failure` `ACL-2026`
