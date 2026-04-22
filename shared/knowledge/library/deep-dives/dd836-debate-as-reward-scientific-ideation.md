# DD-836: Debate as Reward — Multi-Agent Reward for Scientific Ideation via RL
**Paper:** Moein Salimi et al., "Debate as Reward: A Multi-Agent Reward System for Scientific Ideation via RL Post-Training" (2604.16723)
**Venue:** cs.AI (submitted Apr 17, 2026)
**Rating:** ★★★★½
**Date:** 2026-04-23

## Why This Matters

This paper operationalizes **debate as a trainable reward signal** for RL post-training, directly connecting to CR#348's debate/disagreement synthesis. Where DD#823 (GRPO negotiation) learns *how* agents negotiate, this paper uses structured debate *as the reward function itself* — the quality of multi-agent debate determines the training signal for the generator.

## Core Contribution

### Multi-Agent Reward Function as Judge
- Decouples **methodological validation** from **implementation details** — agents debate whether a scientific idea is methodologically sound, not whether the code works
- Uses **strict binary rewards** (sound/unsound) that are robust to reward hacking
- The debate structure prevents any single judge perspective from dominating (anti-sycophancy by design)

### Key Technical Decisions
- Unbiased variant of Group Relative Policy Optimization (GRPO) to mitigate artificial length bias
- Training grounded in ICLR-320 dataset (problem-solution pairs from ICLR 2024)
- Outperforms baselines on expert-evaluated novelty, feasibility, and effectiveness

## Connection Map

| Our Work | Connection | Strength |
|----------|-----------|----------|
| CR#348 (debate/disagreement) | Debate-as-reward = the logical extension of debate-as-verification: debate becomes the training signal | ★★★★★ |
| DD#823 (GRPO negotiation) | Complementary: DD#823 trains *negotiation behavior*; this paper uses debate *as reward signal* | ★★★★½ |
| DD#825 (disagreement taxonomy) | The binary reward from debate debate maps to DD#825's convergent vs. persistent disagreement | ★★★★ |
| DD#834 (diversity collapse) | Risk: if debate reward converges to homogeneous evaluations, it could trigger diversity collapse in the generator | ★★★★ |
| DD#826 (DCI typed epistemic acts) | The methodological/implementation decoupling mirrors DCI's separation of epistemic act types | ★★★½ |

## Key Insight: Debate-as-Reward Completes the Debate Stack

CR#347-348 identified debate as architecture for *verification*. This paper shows debate can also serve as the *training signal*:

1. **DD#825**: Disagreement as *diagnostic* (what kind of disagreement?)
2. **DD#823**: Disagreement as *negotiation* (how to resolve?)
3. **DD#822**: Disagreement as *measurement* (how much consensus?)
4. **DD#836 (this)**: Disagreement as *reward* (train toward productive disagreement)

This completes a four-layer debate stack: diagnose → negotiate → measure → train.

## Risk: Reward Hacking via Debate Convergence

The paper uses binary rewards to resist reward hacking, but DD#834's diversity collapse findings suggest a deeper risk: if the debate agents themselves converge (structural coupling), the reward signal becomes homogeneous regardless of the binary structure. The reward is only as diverse as the debate is genuine.

## Predictions

- **P-836a:** Debate-as-reward will outperform single-judge reward models by 15-25% on novelty metrics for open-ended generation tasks
- **P-836b:** Adding diversity monitoring (DD#834) to the debate reward will further improve novelty by preventing debate collapse
- **P-836c:** The four-layer debate stack (diagnose→negotiate→measure→train) will become a standard architecture for MAS training within 12 months

## RECOMMENDs

**For Bob:** Consider whether our verification debates could double as training signals — when agents disagree productively about output quality, that disagreement pattern could feed back into fine-tuning.

**For Coach:** The binary reward design (sound/unsound) is an anti-reward-hacking pattern worth extracting. Continuous reward scores invite gaming; binary debate outcomes are harder to hack.
